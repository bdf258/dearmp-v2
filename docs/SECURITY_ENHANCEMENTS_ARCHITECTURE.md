# Security Enhancements Architecture

## Executive Summary

This document analyzes five proposed security features and recommends the most effective additions to DearMP v2, prioritized by impact and implementation feasibility.

### Current Security Posture

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Strong | Supabase Auth + TOTP 2FA |
| Row-Level Security | ✅ Strong | Recently hardened, office-scoped |
| Role-Based Access | ✅ Good | Admin/Staff/ReadOnly roles |
| Audit Logging | ⚠️ Partial | Table exists, not actively used |
| Session Security | ⚠️ Basic | JWT only, no binding/tracking |
| Admin Controls | ⚠️ Basic | Same security as regular users |
| Data Encryption | ⚠️ Partial | TLS in transit, no app-level encryption |
| Secret Rotation | ❌ None | No documented policies |

---

## Feature Analysis & Prioritization

### Priority Matrix

| Feature | Security Impact | Implementation Effort | Recommendation |
|---------|-----------------|----------------------|----------------|
| **Audit log alerting** | HIGH | LOW | **#1 - Implement First** |
| **Separate admin accounts** | HIGH | MEDIUM | **#2 - Implement Second** |
| **Session binding/anomaly detection** | HIGH | MEDIUM | **#3 - Implement Third** |
| Database encryption at rest | MEDIUM | LOW (Supabase managed) | Document existing |
| Secret rotation policies | MEDIUM | LOW (policy only) | Document policies |

---

## Recommended Implementations

### 1. Audit Log Alerting for Sensitive Operations

**Priority: #1 - Highest Impact, Lowest Effort**

**Rationale:** The `audit_logs` table and infrastructure already exist but are not actively utilized. This is a critical gap—without active logging, security incidents cannot be detected or investigated.

#### 1.1 Architecture Overview

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Application    │────▶│  PostgreSQL     │────▶│  Edge Function   │
│   Operations     │     │  Triggers       │     │  (Alert Router)  │
└──────────────────┘     └─────────────────┘     └──────────────────┘
                                                          │
                         ┌────────────────────────────────┼────────────────┐
                         ▼                                ▼                ▼
                  ┌─────────────┐                ┌─────────────┐   ┌─────────────┐
                  │   Email     │                │   Slack     │   │   Webhook   │
                  │   Alert     │                │   Alert     │   │   (SIEM)    │
                  └─────────────┘                └─────────────┘   └─────────────┘
```

#### 1.2 Sensitive Operations to Monitor

**Critical (Immediate Alert):**
| Operation | Action | Why Critical |
|-----------|--------|--------------|
| User role change | `role_change` | Privilege escalation |
| Admin user created | `admin_create` | New admin access |
| MFA disabled | `mfa_unenroll` | Security downgrade |
| Bulk data export | `bulk_export` | Data exfiltration |
| Failed login spike | `login_failure_spike` | Brute force attack |
| Session anomaly | `session_anomaly` | Potential hijacking |

**High (Hourly Digest):**
| Operation | Action | Why Important |
|-----------|--------|---------------|
| User created/deleted | `user_create`, `user_delete` | Access changes |
| Email integration connected | `outlook_connect` | External access |
| Settings modified | `settings_change` | Configuration drift |
| Case assigned | `case_assign` | Workflow tracking |

**Standard (Daily Summary):**
| Operation | Action | Purpose |
|-----------|--------|---------|
| Login success | `login_success` | Access patterns |
| Email sent | `email_send` | Audit trail |
| Case created/closed | `case_create`, `case_close` | Activity tracking |

#### 1.3 Database Implementation

```sql
-- Migration: 20241217000001_audit_log_triggers.sql

-- 1. Extend audit_action enum for new action types
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'login_success';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'login_failure';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'role_change';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_create';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user_delete';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'settings_change';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'outlook_connect';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'outlook_disconnect';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'bulk_export';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'session_anomaly';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'case_assign';

-- 2. Add severity and alert_status columns
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'standard'
    CHECK (severity IN ('critical', 'high', 'standard')),
ADD COLUMN IF NOT EXISTS alert_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requires_alert BOOLEAN DEFAULT false;

-- 3. Create alert queue table
CREATE TABLE IF NOT EXISTS audit_alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_log_id UUID REFERENCES audit_logs(id),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'standard')),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Function to determine severity and queue alerts
CREATE OR REPLACE FUNCTION process_audit_alert()
RETURNS TRIGGER AS $$
DECLARE
    alert_severity TEXT;
    should_alert BOOLEAN := false;
BEGIN
    -- Determine severity based on action type
    CASE NEW.action
        WHEN 'role_change' THEN
            alert_severity := 'critical';
            should_alert := true;
        WHEN 'mfa_unenroll' THEN
            alert_severity := 'critical';
            should_alert := true;
        WHEN 'bulk_export' THEN
            alert_severity := 'critical';
            should_alert := true;
        WHEN 'session_anomaly' THEN
            alert_severity := 'critical';
            should_alert := true;
        WHEN 'user_create' THEN
            alert_severity := 'high';
            should_alert := true;
        WHEN 'user_delete' THEN
            alert_severity := 'high';
            should_alert := true;
        WHEN 'outlook_connect' THEN
            alert_severity := 'high';
            should_alert := true;
        WHEN 'settings_change' THEN
            alert_severity := 'high';
            should_alert := true;
        ELSE
            alert_severity := 'standard';
            should_alert := false;
    END CASE;

    -- Update the audit log with severity
    UPDATE audit_logs
    SET severity = alert_severity, requires_alert = should_alert
    WHERE id = NEW.id;

    -- Queue alert if needed
    IF should_alert THEN
        INSERT INTO audit_alert_queue (audit_log_id, severity)
        VALUES (NEW.id, alert_severity);

        -- For critical alerts, trigger immediate notification
        IF alert_severity = 'critical' THEN
            PERFORM pg_notify('critical_security_alert', json_build_object(
                'audit_log_id', NEW.id,
                'action', NEW.action,
                'actor_id', NEW.actor_id,
                'office_id', NEW.office_id,
                'metadata', NEW.metadata
            )::text);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for alert processing
CREATE TRIGGER audit_alert_trigger
    AFTER INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION process_audit_alert();

-- 6. Audit trigger for profile role changes
CREATE OR REPLACE FUNCTION audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Detect role changes
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO audit_logs (
            office_id, actor_id, action, entity_type, entity_id, metadata
        ) VALUES (
            NEW.office_id,
            auth.uid(),
            'role_change',
            'profile',
            NEW.id,
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'target_user_id', NEW.id,
                'target_user_name', NEW.full_name
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profile_audit_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_profile_changes();

-- 7. Audit trigger for user creation/deletion
CREATE OR REPLACE FUNCTION audit_user_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            office_id, actor_id, action, entity_type, entity_id, metadata
        ) VALUES (
            NEW.office_id,
            auth.uid(),
            'user_create',
            'profile',
            NEW.id,
            jsonb_build_object('new_user_name', NEW.full_name, 'role', NEW.role)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            office_id, actor_id, action, entity_type, entity_id, metadata
        ) VALUES (
            OLD.office_id,
            auth.uid(),
            'user_delete',
            'profile',
            OLD.id,
            jsonb_build_object('deleted_user_name', OLD.full_name)
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_lifecycle_audit_trigger
    AFTER INSERT OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_lifecycle();

-- 8. Index for efficient alert queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created
    ON audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_alert_queue_unprocessed
    ON audit_alert_queue(processed_at) WHERE processed_at IS NULL;
```

#### 1.4 Edge Function: Alert Router

```typescript
// supabase/functions/security-alerts/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_SECURITY_WEBHOOK')
const ALERT_EMAIL = Deno.env.get('SECURITY_ALERT_EMAIL')

interface AuditAlert {
  id: string
  audit_log_id: string
  severity: 'critical' | 'high' | 'standard'
  audit_log: {
    action: string
    actor_id: string
    office_id: string
    metadata: Record<string, unknown>
    created_at: string
    profiles: { full_name: string; email: string } | null
    offices: { name: string } | null
  }
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch unprocessed alerts
  const { data: alerts, error } = await supabase
    .from('audit_alert_queue')
    .select(`
      id,
      audit_log_id,
      severity,
      audit_log:audit_logs(
        action,
        actor_id,
        office_id,
        metadata,
        created_at,
        profiles:actor_id(full_name, email),
        offices:office_id(name)
      )
    `)
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const processedIds: string[] = []

  for (const alert of alerts as AuditAlert[]) {
    try {
      if (alert.severity === 'critical') {
        await sendCriticalAlert(alert)
      } else if (alert.severity === 'high') {
        await sendHighPriorityAlert(alert)
      }
      processedIds.push(alert.id)
    } catch (e) {
      console.error(`Failed to process alert ${alert.id}:`, e)
    }
  }

  // Mark alerts as processed
  if (processedIds.length > 0) {
    await supabase
      .from('audit_alert_queue')
      .update({ processed_at: new Date().toISOString() })
      .in('id', processedIds)
  }

  return new Response(JSON.stringify({ processed: processedIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})

async function sendCriticalAlert(alert: AuditAlert) {
  const message = formatAlertMessage(alert)

  // Send to Slack immediately
  if (SLACK_WEBHOOK_URL) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 CRITICAL SECURITY ALERT`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚨 Critical Security Alert' }
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message }
          }
        ]
      })
    })
  }
}

async function sendHighPriorityAlert(alert: AuditAlert) {
  // Queue for hourly digest or send immediately based on config
  const message = formatAlertMessage(alert)

  if (SLACK_WEBHOOK_URL) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Security Alert: ${alert.audit_log.action}`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message }
          }
        ]
      })
    })
  }
}

function formatAlertMessage(alert: AuditAlert): string {
  const { action, metadata, created_at } = alert.audit_log
  const actorName = alert.audit_log.profiles?.full_name || 'Unknown User'
  const officeName = alert.audit_log.offices?.name || 'Unknown Office'

  return `
*Action:* ${action}
*Actor:* ${actorName}
*Office:* ${officeName}
*Time:* ${new Date(created_at).toISOString()}
*Details:* ${JSON.stringify(metadata, null, 2)}
  `.trim()
}
```

#### 1.5 Frontend: Audit Log Viewer (Admin Only)

Add to `SettingsPage.tsx`:

```typescript
// New component: src/components/settings/AuditLogViewer.tsx
interface AuditLogViewerProps {
  officeId: string
}

export function AuditLogViewer({ officeId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all')

  useEffect(() => {
    fetchAuditLogs()
  }, [filter])

  const fetchAuditLogs = async () => {
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        actor:profiles!actor_id(full_name)
      `)
      .eq('office_id', officeId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter !== 'all') {
      query = query.eq('severity', filter)
    }

    const { data } = await query
    setLogs(data || [])
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Security Audit Log</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectItem value="all">All Events</SelectItem>
          <SelectItem value="critical">Critical Only</SelectItem>
          <SelectItem value="high">High Priority</SelectItem>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(log => (
            <TableRow key={log.id}>
              <TableCell>{formatDate(log.created_at)}</TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>{log.actor?.full_name || 'System'}</TableCell>
              <TableCell>
                <Badge variant={getSeverityVariant(log.severity)}>
                  {log.severity}
                </Badge>
              </TableCell>
              <TableCell>
                <code className="text-xs">
                  {JSON.stringify(log.metadata)}
                </code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

### 2. Separate Admin Accounts with Stricter Controls

**Priority: #2 - High Impact, Medium Effort**

**Rationale:** Admin accounts can change user roles, access all office data, and manage integrations. Currently they have the same security controls as regular users. Compromise of an admin account could lead to full office takeover.

#### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Security Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Mandatory   │    │   Shorter    │    │   Enhanced   │       │
│  │     MFA      │    │   Sessions   │    │   Logging    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Re-auth for │    │  IP Allow-   │    │  Action      │       │
│  │  Sensitive   │    │  listing     │    │  Confirmation│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Enhanced Admin Controls

| Control | Description | Implementation |
|---------|-------------|----------------|
| Mandatory MFA | Admins must have 2FA enabled | DB constraint + UI enforcement |
| Shorter sessions | 4-hour max session (vs 24-hour) | JWT claim + session check |
| Re-authentication | Password required for sensitive ops | Modal prompt before action |
| IP allowlisting | Optional IP restrictions | Profile setting + RLS check |
| Action confirmation | Double-confirm destructive actions | UI confirmation dialogs |
| Enhanced logging | All admin actions logged with full context | Automatic via triggers |

#### 2.3 Database Implementation

```sql
-- Migration: 20241217000002_admin_security_controls.sql

-- 1. Add admin security columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS admin_mfa_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS admin_session_timeout_minutes INTEGER DEFAULT 240,
ADD COLUMN IF NOT EXISTS admin_allowed_ips TEXT[],
ADD COLUMN IF NOT EXISTS admin_last_sensitive_action TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_requires_reauth_at TIMESTAMPTZ;

-- 2. Constraint: Admins must have MFA enabled (enforced at application level)
-- Note: This is a soft constraint - enforced via RLS and application logic

-- 3. Function to check if admin can perform sensitive action
CREATE OR REPLACE FUNCTION check_admin_action_allowed(
    action_type TEXT,
    target_office_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    user_ip TEXT;
BEGIN
    -- Get current user's profile
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = auth.uid();

    -- Non-admins cannot perform admin actions
    IF user_profile.role != 'admin' THEN
        RETURN false;
    END IF;

    -- Check if admin has MFA enabled (required for admins)
    IF NOT COALESCE(user_profile.mfa_enabled, false) THEN
        RAISE EXCEPTION 'Admin accounts require MFA to be enabled';
    END IF;

    -- Check IP allowlist if configured
    IF user_profile.admin_allowed_ips IS NOT NULL AND
       array_length(user_profile.admin_allowed_ips, 1) > 0 THEN
        -- Get IP from request headers (set by edge function or RLS context)
        user_ip := current_setting('request.headers', true)::json->>'x-real-ip';
        IF user_ip IS NOT NULL AND NOT (user_ip = ANY(user_profile.admin_allowed_ips)) THEN
            -- Log the blocked attempt
            INSERT INTO audit_logs (office_id, actor_id, action, entity_type, metadata)
            VALUES (
                user_profile.office_id,
                auth.uid(),
                'session_anomaly',
                'admin_action',
                jsonb_build_object(
                    'reason', 'ip_not_in_allowlist',
                    'attempted_ip', user_ip,
                    'action_type', action_type
                )
            );
            RETURN false;
        END IF;
    END IF;

    -- Check office context if provided
    IF target_office_id IS NOT NULL AND target_office_id != user_profile.office_id THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Updated RLS policy for admin role changes with MFA check
DROP POLICY IF EXISTS "Admins can update profiles in their office" ON profiles;

CREATE POLICY "Admins can update profiles in their office with MFA"
ON profiles FOR UPDATE
USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT COALESCE(mfa_enabled, false) FROM profiles WHERE id = auth.uid()) = true
)
WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 5. Admin session timeout tracking
CREATE OR REPLACE FUNCTION check_admin_session_valid()
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    session_start TIMESTAMPTZ;
    timeout_minutes INTEGER;
BEGIN
    SELECT * INTO user_profile FROM profiles WHERE id = auth.uid();

    -- Non-admins don't have special session requirements
    IF user_profile.role != 'admin' THEN
        RETURN true;
    END IF;

    -- Get session start time from JWT claims
    session_start := to_timestamp(
        (current_setting('request.jwt.claims', true)::json->>'iat')::integer
    );

    timeout_minutes := COALESCE(user_profile.admin_session_timeout_minutes, 240);

    -- Check if session has exceeded timeout
    IF NOW() > session_start + (timeout_minutes || ' minutes')::interval THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. View for admin security status
CREATE OR REPLACE VIEW admin_security_status AS
SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.mfa_enabled,
    p.admin_session_timeout_minutes,
    p.admin_allowed_ips,
    p.admin_last_sensitive_action,
    CASE
        WHEN p.role = 'admin' AND NOT COALESCE(p.mfa_enabled, false)
        THEN 'MFA_REQUIRED'
        WHEN p.role = 'admin' AND NOT check_admin_session_valid()
        THEN 'SESSION_EXPIRED'
        ELSE 'OK'
    END as security_status
FROM profiles p
WHERE p.office_id = get_my_office_id();
```

#### 2.4 Frontend Implementation

```typescript
// src/hooks/useAdminSecurity.ts
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AdminSecurityState {
  mfaRequired: boolean
  sessionValid: boolean
  lastReauthAt: Date | null
  requiresReauth: boolean
}

export function useAdminSecurity(userRole: string) {
  const [securityState, setSecurityState] = useState<AdminSecurityState>({
    mfaRequired: userRole === 'admin',
    sessionValid: true,
    lastReauthAt: null,
    requiresReauth: false
  })

  const checkAdminSession = useCallback(async () => {
    if (userRole !== 'admin') return true

    const { data, error } = await supabase.rpc('check_admin_session_valid')
    if (error || !data) {
      setSecurityState(prev => ({ ...prev, sessionValid: false }))
      return false
    }
    return true
  }, [userRole])

  const performSensitiveAction = useCallback(async (
    action: () => Promise<void>,
    actionName: string
  ) => {
    // Check session validity
    const sessionValid = await checkAdminSession()
    if (!sessionValid) {
      throw new Error('Admin session expired. Please re-authenticate.')
    }

    // For sensitive actions, require re-authentication if last auth > 15 min ago
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    if (!securityState.lastReauthAt || securityState.lastReauthAt < fifteenMinutesAgo) {
      setSecurityState(prev => ({ ...prev, requiresReauth: true }))
      throw new Error('REAUTH_REQUIRED')
    }

    // Perform the action
    await action()

    // Log the sensitive action
    await supabase.from('audit_logs').insert({
      action: 'admin_sensitive_action',
      entity_type: 'admin_action',
      metadata: { action_name: actionName }
    })
  }, [checkAdminSession, securityState.lastReauthAt])

  const reauthenticate = useCallback(async (password: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) throw new Error('No user session')

    // Verify password by attempting sign-in
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password
    })

    if (error) throw new Error('Invalid password')

    setSecurityState(prev => ({
      ...prev,
      lastReauthAt: new Date(),
      requiresReauth: false
    }))
  }, [])

  return {
    securityState,
    checkAdminSession,
    performSensitiveAction,
    reauthenticate
  }
}
```

```typescript
// src/components/settings/AdminReauthDialog.tsx
interface AdminReauthDialogProps {
  open: boolean
  onSuccess: () => void
  onCancel: () => void
  actionDescription: string
}

export function AdminReauthDialog({
  open, onSuccess, onCancel, actionDescription
}: AdminReauthDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { reauthenticate } = useAdminSecurity('admin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await reauthenticate(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Your Identity</DialogTitle>
          <DialogDescription>
            This action requires re-authentication: {actionDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                Confirm
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

#### 2.5 MFA Enforcement for Admins

```typescript
// Update in useSupabaseData.ts - Add admin MFA check

const checkAdminMfaCompliance = useCallback(async () => {
  if (profile?.role !== 'admin') return true

  // Check if MFA is enabled
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified')

  if (!hasVerifiedFactor) {
    // Redirect to MFA setup with warning
    setAdminMfaRequired(true)
    return false
  }

  return true
}, [profile?.role])

// Add to the auth check flow
useEffect(() => {
  if (profile?.role === 'admin') {
    checkAdminMfaCompliance()
  }
}, [profile?.role, checkAdminMfaCompliance])
```

---

### 3. Session Binding with Anomaly Detection

**Priority: #3 - High Impact, Medium Effort**

**Rationale:** Currently, a stolen JWT token can be used from any location. Session binding adds defense-in-depth by detecting when sessions are used from unexpected IPs or devices.

#### 3.1 Architecture Overview

```
                                   Session Verification Flow

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Request    │───▶│   Extract    │───▶│   Compare    │───▶│   Allow or   │
│   Arrives    │    │   Context    │    │   to Stored  │    │   Challenge  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │    IP    │  │   User   │
              │  Address │  │  Agent   │
              └──────────┘  └──────────┘
```

#### 3.2 Session Context Tracking

| Context | Weight | Anomaly Threshold |
|---------|--------|-------------------|
| IP Address | High | Different /24 subnet |
| User Agent | Medium | Different browser/OS |
| Country (GeoIP) | High | Different country |
| Time of Day | Low | Unusual hours |
| Request Pattern | Medium | Unusual API calls |

#### 3.3 Database Implementation

```sql
-- Migration: 20241217000003_session_binding.sql

-- 1. Session context tracking table
CREATE TABLE IF NOT EXISTS session_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, -- From JWT jti claim

    -- Binding context
    ip_address INET NOT NULL,
    ip_subnet CIDR GENERATED ALWAYS AS (
        set_masklen(ip_address, 24)
    ) STORED,
    user_agent TEXT,
    user_agent_hash TEXT GENERATED ALWAYS AS (
        encode(sha256(COALESCE(user_agent, '')::bytea), 'hex')
    ) STORED,
    country_code TEXT, -- From GeoIP lookup

    -- Risk assessment
    risk_score INTEGER DEFAULT 0,
    is_trusted BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, session_id)
);

-- 2. Session anomaly events
CREATE TABLE IF NOT EXISTS session_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,

    anomaly_type TEXT NOT NULL, -- ip_change, ua_change, country_change, time_anomaly
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Context at time of anomaly
    expected_value TEXT,
    actual_value TEXT,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution TEXT, -- user_verified, admin_dismissed, session_terminated

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Known/trusted contexts per user
CREATE TABLE IF NOT EXISTS trusted_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    context_type TEXT NOT NULL, -- ip_subnet, user_agent_hash, country
    context_value TEXT NOT NULL,

    -- Trust metadata
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    use_count INTEGER DEFAULT 1,
    trusted_at TIMESTAMPTZ, -- When explicitly trusted by user

    UNIQUE(user_id, context_type, context_value)
);

-- 4. Function to record session context
CREATE OR REPLACE FUNCTION record_session_context(
    p_ip_address INET,
    p_user_agent TEXT,
    p_country_code TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_session_id TEXT;
    v_existing_context RECORD;
    v_anomalies jsonb := '[]'::jsonb;
    v_risk_score INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    v_session_id := current_setting('request.jwt.claims', true)::json->>'session_id';

    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No valid session');
    END IF;

    -- Get or create session context
    SELECT * INTO v_existing_context
    FROM session_contexts
    WHERE user_id = v_user_id AND session_id = v_session_id;

    IF v_existing_context IS NULL THEN
        -- First request with this session - record initial context
        INSERT INTO session_contexts (
            user_id, session_id, ip_address, user_agent, country_code
        ) VALUES (
            v_user_id, v_session_id, p_ip_address, p_user_agent, p_country_code
        );

        -- Check if this is a known context
        PERFORM add_or_update_trusted_context(v_user_id, 'ip_subnet',
            set_masklen(p_ip_address, 24)::text);
        PERFORM add_or_update_trusted_context(v_user_id, 'user_agent_hash',
            encode(sha256(COALESCE(p_user_agent, '')::bytea), 'hex'));

    ELSE
        -- Check for anomalies against initial session context

        -- IP change detection
        IF v_existing_context.ip_subnet != set_masklen(p_ip_address, 24) THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'ip_change',
                'expected', v_existing_context.ip_address::text,
                'actual', p_ip_address::text
            );
            v_risk_score := v_risk_score + 30;

            -- Check if new IP is trusted
            IF NOT EXISTS (
                SELECT 1 FROM trusted_contexts
                WHERE user_id = v_user_id
                AND context_type = 'ip_subnet'
                AND context_value = set_masklen(p_ip_address, 24)::text
                AND trusted_at IS NOT NULL
            ) THEN
                v_risk_score := v_risk_score + 20;
            END IF;
        END IF;

        -- User agent change detection
        IF v_existing_context.user_agent_hash !=
           encode(sha256(COALESCE(p_user_agent, '')::bytea), 'hex') THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'ua_change',
                'expected', v_existing_context.user_agent,
                'actual', p_user_agent
            );
            v_risk_score := v_risk_score + 20;
        END IF;

        -- Country change detection (highest severity)
        IF v_existing_context.country_code IS NOT NULL
           AND p_country_code IS NOT NULL
           AND v_existing_context.country_code != p_country_code THEN
            v_anomalies := v_anomalies || jsonb_build_object(
                'type', 'country_change',
                'expected', v_existing_context.country_code,
                'actual', p_country_code
            );
            v_risk_score := v_risk_score + 50;
        END IF;

        -- Update risk score
        UPDATE session_contexts
        SET risk_score = v_risk_score, last_seen_at = NOW()
        WHERE id = v_existing_context.id;

        -- Record anomalies if found
        IF jsonb_array_length(v_anomalies) > 0 THEN
            FOR i IN 0..jsonb_array_length(v_anomalies)-1 LOOP
                INSERT INTO session_anomalies (
                    user_id, session_id, anomaly_type, severity,
                    expected_value, actual_value
                ) VALUES (
                    v_user_id,
                    v_session_id,
                    v_anomalies->i->>'type',
                    CASE
                        WHEN v_risk_score >= 50 THEN 'critical'
                        WHEN v_risk_score >= 30 THEN 'high'
                        WHEN v_risk_score >= 15 THEN 'medium'
                        ELSE 'low'
                    END,
                    v_anomalies->i->>'expected',
                    v_anomalies->i->>'actual'
                );
            END LOOP;

            -- Log to audit for critical anomalies
            IF v_risk_score >= 50 THEN
                INSERT INTO audit_logs (
                    office_id, actor_id, action, entity_type, metadata
                ) VALUES (
                    (SELECT office_id FROM profiles WHERE id = v_user_id),
                    v_user_id,
                    'session_anomaly',
                    'session',
                    jsonb_build_object(
                        'risk_score', v_risk_score,
                        'anomalies', v_anomalies,
                        'session_id', v_session_id
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'risk_score', v_risk_score,
        'anomalies', v_anomalies,
        'action_required', v_risk_score >= 50
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper function to manage trusted contexts
CREATE OR REPLACE FUNCTION add_or_update_trusted_context(
    p_user_id UUID,
    p_type TEXT,
    p_value TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO trusted_contexts (user_id, context_type, context_value)
    VALUES (p_user_id, p_type, p_value)
    ON CONFLICT (user_id, context_type, context_value)
    DO UPDATE SET
        last_used_at = NOW(),
        use_count = trusted_contexts.use_count + 1;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to trust current context
CREATE OR REPLACE FUNCTION trust_current_context()
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_context RECORD;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_context
    FROM session_contexts
    WHERE user_id = v_user_id
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_context IS NOT NULL THEN
        UPDATE trusted_contexts
        SET trusted_at = NOW()
        WHERE user_id = v_user_id
        AND context_type = 'ip_subnet'
        AND context_value = v_context.ip_subnet::text;

        UPDATE trusted_contexts
        SET trusted_at = NOW()
        WHERE user_id = v_user_id
        AND context_type = 'user_agent_hash'
        AND context_value = v_context.user_agent_hash;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_contexts_user_session
    ON session_contexts(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_user_unresolved
    ON session_anomalies(user_id, created_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_contexts_user_type
    ON trusted_contexts(user_id, context_type);
```

#### 3.4 Frontend Implementation

```typescript
// src/hooks/useSessionSecurity.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface SessionSecurityState {
  riskScore: number
  anomalies: Array<{
    type: string
    expected: string
    actual: string
  }>
  actionRequired: boolean
}

export function useSessionSecurity() {
  const [state, setState] = useState<SessionSecurityState>({
    riskScore: 0,
    anomalies: [],
    actionRequired: false
  })

  const recordContext = useCallback(async () => {
    // Get client context
    const ipResponse = await fetch('https://api.ipify.org?format=json')
    const { ip } = await ipResponse.json()

    const { data, error } = await supabase.rpc('record_session_context', {
      p_ip_address: ip,
      p_user_agent: navigator.userAgent,
      p_country_code: null // Could use a GeoIP service
    })

    if (data && !error) {
      setState({
        riskScore: data.risk_score || 0,
        anomalies: data.anomalies || [],
        actionRequired: data.action_required || false
      })
    }
  }, [])

  const trustCurrentContext = useCallback(async () => {
    await supabase.rpc('trust_current_context')
    setState(prev => ({ ...prev, actionRequired: false, riskScore: 0 }))
  }, [])

  // Record context on mount and periodically
  useEffect(() => {
    recordContext()
    const interval = setInterval(recordContext, 5 * 60 * 1000) // Every 5 minutes
    return () => clearInterval(interval)
  }, [recordContext])

  return {
    ...state,
    trustCurrentContext,
    recordContext
  }
}
```

```typescript
// src/components/SessionSecurityBanner.tsx
interface SessionSecurityBannerProps {
  riskScore: number
  anomalies: Array<{ type: string; expected: string; actual: string }>
  onTrust: () => void
  onLogout: () => void
}

export function SessionSecurityBanner({
  riskScore,
  anomalies,
  onTrust,
  onLogout
}: SessionSecurityBannerProps) {
  if (riskScore < 50) return null

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-yellow-400" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Unusual Session Activity Detected
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>We detected changes in your session that may indicate unauthorized access:</p>
            <ul className="list-disc pl-5 mt-1">
              {anomalies.map((a, i) => (
                <li key={i}>
                  {a.type === 'ip_change' && 'Your IP address changed'}
                  {a.type === 'ua_change' && 'Your browser/device changed'}
                  {a.type === 'country_change' && 'Access from a different country'}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={onTrust}>
              This was me
            </Button>
            <Button size="sm" variant="destructive" onClick={onLogout}>
              Secure my account
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Lower Priority Items (Document Only)

### 4. Database Encryption at Rest

**Status: Supabase Managed**

Supabase provides encryption at rest for all PostgreSQL data by default:

- **Storage**: Data encrypted using AES-256
- **Backups**: Encrypted at rest
- **In Transit**: TLS 1.2+ enforced

**Application-Level Enhancement (Optional):**

For highly sensitive data like Outlook tokens, consider adding pgcrypto encryption:

```sql
-- Enable extension (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns
ALTER TABLE integration_outlook_sessions
ADD COLUMN cookies_encrypted BYTEA;

-- Function to encrypt
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;
```

### 5. Secret Rotation Policies

**Recommended Policy:**

| Secret | Rotation Frequency | Responsible Party |
|--------|-------------------|-------------------|
| Supabase Service Role Key | 90 days | DevOps |
| Gemini API Key | 90 days | DevOps |
| JWT Secret | Never (Supabase managed) | - |
| User Passwords | User-initiated | Users |
| OAuth Tokens | Auto-refresh | Application |

**Implementation:** Document in `SECURITY.md` and set calendar reminders.

---

## Implementation Roadmap

### Phase 1: Audit Logging (Week 1)
1. Create audit_log_triggers migration
2. Deploy security-alerts edge function
3. Configure Slack webhook
4. Add AuditLogViewer to admin settings

### Phase 2: Admin Security (Week 2)
1. Create admin_security_controls migration
2. Implement useAdminSecurity hook
3. Add AdminReauthDialog component
4. Enforce MFA for admin accounts

### Phase 3: Session Binding (Week 3)
1. Create session_binding migration
2. Implement useSessionSecurity hook
3. Add SessionSecurityBanner component
4. Configure anomaly thresholds

### Phase 4: Documentation (Week 4)
1. Document encryption at rest status
2. Create secret rotation policy
3. Update SECURITY.md
4. Security team review

---

## Conclusion

The recommended implementation order prioritizes:

1. **Audit log alerting** - Provides immediate visibility into security events with minimal code changes
2. **Admin account hardening** - Protects the highest-value targets with mandatory MFA and re-authentication
3. **Session binding** - Adds defense-in-depth against session hijacking

These three features together create a comprehensive security monitoring and enforcement layer that significantly improves the application's security posture.
