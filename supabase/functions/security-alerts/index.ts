// Security Alerts Edge Function
// Processes audit alert queue and sends notifications via Slack webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_SECURITY_WEBHOOK')
const SECURITY_ALERT_EMAIL = Deno.env.get('SECURITY_ALERT_EMAIL')

interface AuditLog {
  id: string
  action: string
  actor_id: string | null
  office_id: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  severity: string
  created_at: string
  ip_address: string | null
}

interface AuditAlert {
  id: string
  audit_log_id: string
  severity: 'critical' | 'high' | 'standard'
  office_id: string
  created_at: string
}

interface AlertWithDetails extends AuditAlert {
  audit_log: AuditLog
  actor_name: string | null
  office_name: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Fetch unprocessed alerts with details
    const { data: alerts, error: fetchError } = await supabase
      .from('audit_alert_queue')
      .select(`
        id,
        audit_log_id,
        severity,
        office_id,
        created_at
      `)
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      console.error('Error fetching alerts:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending alerts', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedIds: string[] = []
    const errors: { id: string; error: string }[] = []

    for (const alert of alerts) {
      try {
        // Fetch full audit log details
        const { data: auditLog, error: logError } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('id', alert.audit_log_id)
          .single()

        if (logError || !auditLog) {
          throw new Error(`Failed to fetch audit log: ${logError?.message}`)
        }

        // Fetch actor name if available
        let actorName: string | null = null
        if (auditLog.actor_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', auditLog.actor_id)
            .single()
          actorName = profile?.full_name || null
        }

        // Fetch office name
        const { data: office } = await supabase
          .from('offices')
          .select('name')
          .eq('id', alert.office_id)
          .single()

        const alertWithDetails: AlertWithDetails = {
          ...alert,
          audit_log: auditLog,
          actor_name: actorName,
          office_name: office?.name || null,
        }

        // Send alert based on severity
        if (alert.severity === 'critical') {
          await sendCriticalAlert(alertWithDetails)
        } else if (alert.severity === 'high') {
          await sendHighPriorityAlert(alertWithDetails)
        }

        processedIds.push(alert.id)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Failed to process alert ${alert.id}:`, errorMessage)
        errors.push({ id: alert.id, error: errorMessage })

        // Update retry count
        await supabase
          .from('audit_alert_queue')
          .update({
            retry_count: (alert as unknown as { retry_count: number }).retry_count + 1,
            error_message: errorMessage,
          })
          .eq('id', alert.id)
      }
    }

    // Mark processed alerts
    if (processedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('audit_alert_queue')
        .update({ processed_at: new Date().toISOString() })
        .in('id', processedIds)

      if (updateError) {
        console.error('Error marking alerts as processed:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        processed: processedIds.length,
        errors: errors.length,
        error_details: errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Security alerts function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendCriticalAlert(alert: AlertWithDetails): Promise<void> {
  const message = formatAlertMessage(alert)

  // Send to Slack immediately for critical alerts
  if (SLACK_WEBHOOK_URL) {
    try {
      const response = await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `CRITICAL SECURITY ALERT`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Critical Security Alert', emoji: true },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: message },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Alert ID: ${alert.id} | Time: ${new Date(alert.created_at).toISOString()}`,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        console.error('Slack webhook failed:', await response.text())
      }
    } catch (err) {
      console.error('Failed to send Slack alert:', err)
    }
  } else {
    console.log('No Slack webhook configured. Critical alert:', message)
  }
}

async function sendHighPriorityAlert(alert: AlertWithDetails): Promise<void> {
  const message = formatAlertMessage(alert)

  // Send to Slack for high priority alerts
  if (SLACK_WEBHOOK_URL) {
    try {
      const response = await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Security Alert: ${alert.audit_log.action}`,
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: message },
            },
          ],
        }),
      })

      if (!response.ok) {
        console.error('Slack webhook failed:', await response.text())
      }
    } catch (err) {
      console.error('Failed to send Slack alert:', err)
    }
  } else {
    console.log('No Slack webhook configured. High priority alert:', message)
  }
}

function formatAlertMessage(alert: AlertWithDetails): string {
  const { action, metadata, created_at, ip_address } = alert.audit_log
  const actorName = alert.actor_name || 'Unknown User'
  const officeName = alert.office_name || 'Unknown Office'

  const actionDescriptions: Record<string, string> = {
    role_change: 'User role was changed',
    mfa_unenroll: 'MFA was disabled for a user',
    mfa_disable: 'MFA was disabled for a user',
    bulk_export: 'Bulk data export was initiated',
    session_anomaly: 'Unusual session activity detected',
    user_create: 'New user account was created',
    user_delete: 'User account was deleted',
    outlook_connect: 'Outlook integration was connected',
    outlook_disconnect: 'Outlook integration was disconnected',
    settings_change: 'Office settings were modified',
  }

  const description = actionDescriptions[action] || `Action: ${action}`

  let metadataStr = ''
  if (metadata && Object.keys(metadata).length > 0) {
    metadataStr = `\n*Details:*\n\`\`\`${JSON.stringify(metadata, null, 2)}\`\`\``
  }

  return `
*${description}*
*Severity:* ${alert.severity.toUpperCase()}
*Actor:* ${actorName}
*Office:* ${officeName}
*Time:* ${new Date(created_at).toLocaleString()}
${ip_address ? `*IP Address:* ${ip_address}` : ''}
${metadataStr}
  `.trim()
}
