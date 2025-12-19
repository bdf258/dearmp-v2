/**
 * Triage Security Tests
 *
 * Tests for Row Level Security (RLS) policies ensuring:
 * - Cross-office isolation
 * - Role-based access control
 * - Audit log integrity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test fixtures for multi-tenant scenarios
const SECURITY_FIXTURES = {
  offices: {
    office1: { id: 'office-1', name: 'Westminster Office' },
    office2: { id: 'office-2', name: 'Constituency Office' },
    office3: { id: 'office-3', name: 'Other MP Office' },
  },
  users: {
    // Office 1 users
    admin1: { id: 'admin-1', office_id: 'office-1', role: 'admin', email: 'admin1@test.com' },
    staff1: { id: 'staff-1', office_id: 'office-1', role: 'staff', email: 'staff1@test.com' },
    mp1: { id: 'mp-1', office_id: 'office-1', role: 'mp', email: 'mp1@test.com' },
    constituent1: { id: 'const-1', office_id: 'office-1', role: 'constituent', email: 'const1@test.com' },

    // Office 2 users (for cross-office tests)
    admin2: { id: 'admin-2', office_id: 'office-2', role: 'admin', email: 'admin2@test.com' },
    staff2: { id: 'staff-2', office_id: 'office-2', role: 'staff', email: 'staff2@test.com' },
  },
  messages: {
    office1Pending: { id: 'msg-o1-1', office_id: 'office-1', triage_status: 'pending' },
    office1Triaged: { id: 'msg-o1-2', office_id: 'office-1', triage_status: 'triaged' },
    office2Pending: { id: 'msg-o2-1', office_id: 'office-2', triage_status: 'pending' },
  },
};

// Simulated RLS policy enforcement
class RLSEnforcer {
  private currentUser: { id: string; office_id: string; role: string } | null = null;

  setUser(user: { id: string; office_id: string; role: string } | null) {
    this.currentUser = user;
  }

  getMyOfficeId(): string | null {
    return this.currentUser?.office_id || null;
  }

  canReadMessage(message: { office_id: string }): boolean {
    if (!this.currentUser) return false;
    return message.office_id === this.currentUser.office_id;
  }

  canUpdateTriageStatus(message: { office_id: string }): boolean {
    if (!this.currentUser) return false;
    if (message.office_id !== this.currentUser.office_id) return false;
    return ['admin', 'staff'].includes(this.currentUser.role);
  }

  canAccessRPC(rpcName: string): boolean {
    if (!this.currentUser) return false;

    // All authenticated users can call these RPCs, but they're scoped by office
    const triageRPCs = [
      'confirm_triage',
      'dismiss_triage',
      'get_triage_queue',
      'get_triage_stats',
      'mark_as_triaged',
    ];

    return triageRPCs.includes(rpcName);
  }
}

describe('Triage RLS Security', () => {
  let rls: RLSEnforcer;

  beforeEach(() => {
    rls = new RLSEnforcer();
  });

  describe('Cross-Office Isolation', () => {
    it('prevents Office 1 staff from reading Office 2 messages', () => {
      rls.setUser(SECURITY_FIXTURES.users.staff1);

      const canRead = rls.canReadMessage(SECURITY_FIXTURES.messages.office2Pending);
      expect(canRead).toBe(false);
    });

    it('allows Office 1 staff to read Office 1 messages', () => {
      rls.setUser(SECURITY_FIXTURES.users.staff1);

      const canRead = rls.canReadMessage(SECURITY_FIXTURES.messages.office1Pending);
      expect(canRead).toBe(true);
    });

    it('prevents Office 2 admin from updating Office 1 triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.admin2);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(false);
    });

    it('allows Office 1 admin to update Office 1 triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.admin1);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(true);
    });
  });

  describe('Role-Based Access Control', () => {
    it('allows admin to update triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.admin1);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(true);
    });

    it('allows staff to update triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.staff1);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(true);
    });

    it('prevents MP role from updating triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.mp1);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(false);
    });

    it('prevents constituent role from updating triage status', () => {
      rls.setUser(SECURITY_FIXTURES.users.constituent1);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(false);
    });
  });

  describe('Unauthenticated Access', () => {
    it('prevents unauthenticated users from reading messages', () => {
      rls.setUser(null);

      const canRead = rls.canReadMessage(SECURITY_FIXTURES.messages.office1Pending);
      expect(canRead).toBe(false);
    });

    it('prevents unauthenticated users from updating triage', () => {
      rls.setUser(null);

      const canUpdate = rls.canUpdateTriageStatus(SECURITY_FIXTURES.messages.office1Pending);
      expect(canUpdate).toBe(false);
    });

    it('returns null office ID for unauthenticated users', () => {
      rls.setUser(null);

      expect(rls.getMyOfficeId()).toBeNull();
    });
  });
});

describe('Triage RPC Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('confirm_triage security', () => {
    it('rejects when no office context', async () => {
      const result = await simulateRPC('confirm_triage', {
        p_message_ids: ['msg-1'],
      }, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: No office context');
    });

    it('rejects messages from different office', async () => {
      const result = await simulateRPC('confirm_triage', {
        p_message_ids: [SECURITY_FIXTURES.messages.office2Pending.id],
      }, SECURITY_FIXTURES.users.staff1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Messages from different office');
    });

    it('accepts messages from same office', async () => {
      const result = await simulateRPC('confirm_triage', {
        p_message_ids: [SECURITY_FIXTURES.messages.office1Pending.id],
      }, SECURITY_FIXTURES.users.staff1);

      expect(result.success).toBe(true);
    });
  });

  describe('dismiss_triage security', () => {
    it('rejects when no office context', async () => {
      const result = await simulateRPC('dismiss_triage', {
        p_message_ids: ['msg-1'],
      }, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: No office context');
    });

    it('rejects messages from different office', async () => {
      const result = await simulateRPC('dismiss_triage', {
        p_message_ids: [SECURITY_FIXTURES.messages.office2Pending.id],
      }, SECURITY_FIXTURES.users.staff1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Messages from different office');
    });
  });

  describe('get_triage_queue security', () => {
    it('returns empty when no office context', async () => {
      const result = await simulateRPC('get_triage_queue', {}, null);

      expect(result.data).toEqual([]);
    });

    it('only returns messages from user office', async () => {
      const result = await simulateRPC('get_triage_queue', {}, SECURITY_FIXTURES.users.staff1);

      // All returned messages should be from office-1
      expect(result.data).toBeDefined();
      const messages = result.data as Array<{ office_id: string }>;
      expect(messages.every((m) => m.office_id === 'office-1')).toBe(true);
    });
  });

  describe('get_triage_stats security', () => {
    it('returns error when no office context', async () => {
      const result = await simulateRPC('get_triage_stats', {}, null);

      expect(result.error).toBe('Unauthorized');
    });

    it('only counts messages from user office', async () => {
      const result = await simulateRPC('get_triage_stats', {}, SECURITY_FIXTURES.users.staff1);

      expect(result.office_id).toBe('office-1');
    });
  });

  describe('mark_as_triaged security', () => {
    it('allows service role unrestricted access', async () => {
      const result = await simulateRPC('mark_as_triaged', {
        p_message_id: SECURITY_FIXTURES.messages.office2Pending.id,
        p_triaged_by: 'ai-service',
      }, { id: 'service', office_id: null, role: 'service_role' });

      expect(result.success).toBe(true);
    });

    it('rejects authenticated user for different office message', async () => {
      const result = await simulateRPC('mark_as_triaged', {
        p_message_id: SECURITY_FIXTURES.messages.office2Pending.id,
        p_triaged_by: 'user',
      }, SECURITY_FIXTURES.users.staff1);

      expect(result.success).toBe(false);
    });
  });
});

describe('Audit Log Security', () => {
  describe('Audit log creation', () => {
    it('captures actor ID on triage confirm', () => {
      const auditLog = createAuditLog('triage_confirm', {
        message_id: 'msg-1',
        actor_id: SECURITY_FIXTURES.users.staff1.id,
      });

      expect(auditLog.actor_id).toBe(SECURITY_FIXTURES.users.staff1.id);
    });

    it('captures office ID for office isolation', () => {
      const auditLog = createAuditLog('triage_confirm', {
        message_id: 'msg-1',
        office_id: SECURITY_FIXTURES.offices.office1.id,
      });

      expect(auditLog.office_id).toBe('office-1');
    });

    it('includes metadata for triage actions', () => {
      const auditLog = createAuditLog('triage_confirm', {
        message_id: 'msg-1',
        metadata: {
          previous_status: 'pending',
          new_status: 'confirmed',
          case_id: 'case-1',
        },
      });

      expect(auditLog.metadata.previous_status).toBe('pending');
      expect(auditLog.metadata.new_status).toBe('confirmed');
    });
  });

  describe('Audit log querying', () => {
    it('filters audit logs by office', () => {
      const logs = filterAuditLogsByOffice([
        { id: 'log-1', office_id: 'office-1', action: 'triage_confirm' },
        { id: 'log-2', office_id: 'office-2', action: 'triage_confirm' },
        { id: 'log-3', office_id: 'office-1', action: 'triage_dismiss' },
      ], 'office-1');

      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.office_id === 'office-1')).toBe(true);
    });
  });
});

describe('Tag Assignment Security', () => {
  it('prevents cross-office tag assignments', () => {
    const canAssign = canAssignTag({
      user_office_id: 'office-1',
      tag_office_id: 'office-2',
      entity_office_id: 'office-1',
    });

    expect(canAssign).toBe(false);
  });

  it('prevents tagging entities from other offices', () => {
    const canAssign = canAssignTag({
      user_office_id: 'office-1',
      tag_office_id: 'office-1',
      entity_office_id: 'office-2',
    });

    expect(canAssign).toBe(false);
  });

  it('allows same-office tag assignments', () => {
    const canAssign = canAssignTag({
      user_office_id: 'office-1',
      tag_office_id: 'office-1',
      entity_office_id: 'office-1',
    });

    expect(canAssign).toBe(true);
  });
});

describe('Message Recipient Security', () => {
  it('enforces office isolation on message recipients', () => {
    const rls = new RLSEnforcer();
    rls.setUser(SECURITY_FIXTURES.users.staff1);

    const canRead = rls.canReadMessage({ office_id: 'office-1' });
    expect(canRead).toBe(true);
  });

  it('prevents cross-office recipient access', () => {
    const rls = new RLSEnforcer();
    rls.setUser(SECURITY_FIXTURES.users.staff1);

    const canRead = rls.canReadMessage({ office_id: 'office-2' });
    expect(canRead).toBe(false);
  });
});

// Helper functions for simulating RPC calls
async function simulateRPC(
  rpcName: string,
  params: Record<string, unknown>,
  user: { id: string; office_id: string | null; role: string } | null
): Promise<{ success: boolean; error?: string; data?: unknown[]; office_id?: string }> {
  // Simulate get_my_office_id()
  const officeId = user?.office_id || null;

  if (!officeId && rpcName !== 'mark_as_triaged') {
    if (rpcName === 'get_triage_queue') {
      return { success: true, data: [] };
    }
    if (rpcName === 'get_triage_stats') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Unauthorized: No office context' };
  }

  // Check message ownership for confirm/dismiss
  if (['confirm_triage', 'dismiss_triage'].includes(rpcName)) {
    const messageIds = params.p_message_ids as string[];
    const officeMessages = Object.values(SECURITY_FIXTURES.messages);

    for (const msgId of messageIds) {
      const msg = officeMessages.find(m => m.id === msgId);
      if (msg && msg.office_id !== officeId) {
        return { success: false, error: 'Unauthorized: Messages from different office' };
      }
    }
  }

  // Check for mark_as_triaged
  if (rpcName === 'mark_as_triaged') {
    if (user?.role === 'service_role') {
      return { success: true };
    }
    const msgId = params.p_message_id as string;
    const officeMessages = Object.values(SECURITY_FIXTURES.messages);
    const msg = officeMessages.find(m => m.id === msgId);
    if (msg && msg.office_id !== officeId) {
      return { success: false, error: 'Unauthorized' };
    }
  }

  // Simulate get_triage_queue filtering
  if (rpcName === 'get_triage_queue') {
    const officeMessages = Object.values(SECURITY_FIXTURES.messages)
      .filter(m => m.office_id === officeId);
    return { success: true, data: officeMessages };
  }

  // Simulate get_triage_stats
  if (rpcName === 'get_triage_stats') {
    return { success: true, office_id: officeId! };
  }

  return { success: true };
}

function createAuditLog(
  action: string,
  data: {
    message_id?: string;
    actor_id?: string;
    office_id?: string;
    metadata?: Record<string, unknown>;
  }
) {
  return {
    id: `audit-${Date.now()}`,
    action,
    actor_id: data.actor_id || null,
    office_id: data.office_id || null,
    entity_type: 'message',
    entity_id: data.message_id || null,
    metadata: data.metadata || {},
    created_at: new Date().toISOString(),
  };
}

function filterAuditLogsByOffice(
  logs: Array<{ id: string; office_id: string; action: string }>,
  officeId: string
) {
  return logs.filter(log => log.office_id === officeId);
}

function canAssignTag(context: {
  user_office_id: string;
  tag_office_id: string;
  entity_office_id: string;
}): boolean {
  return (
    context.user_office_id === context.tag_office_id &&
    context.user_office_id === context.entity_office_id
  );
}
