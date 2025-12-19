/**
 * Triage Hooks
 *
 * Data hooks for triage operations - fetching queue, message details,
 * searching constituents/cases, and performing triage actions.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { supabase } from '@/lib/supabase';
import type {
  Message,
  MessageRecipient,
  Constituent,
  Campaign,
  CasePriority,
} from '@/lib/database.types';

// ============= TYPES =============

export type ConstituentStatus = 'known' | 'has_address' | 'no_address';

export interface TriageMessage extends Message {
  recipients: MessageRecipient[];
  senderConstituent: Constituent | null;
  senderEmail: string;
  senderName: string;
  constituentStatus: ConstituentStatus;
  addressFromEmail?: string;
}

export interface CampaignWithCounts extends Campaign {
  totalCount: number;
  knownCount: number;
  hasAddressCount: number;
  noAddressCount: number;
}

export interface TriageQueueFilters {
  campaignId?: string;
  constituentStatus?: ConstituentStatus;
  hasCase?: boolean;
}

// ============= TRIAGE QUEUE HOOK =============

export function useTriageQueue(filters?: TriageQueueFilters) {
  const { messages, messageRecipients, constituents, constituentContacts, campaigns, getMyOfficeId, loading } = useSupabase();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync loading state with context
  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);

  // Get inbound messages that need triage (pending or triaged status)
  const triageMessages = useMemo(() => {
    const officeId = getMyOfficeId();
    if (!officeId) return [];

    // Filter to inbound messages that need triage
    // Messages with triage_status 'pending' or 'triaged' (AI processed but not human confirmed)
    // Also include messages with no triage_status and no case (backwards compatibility)
    let filtered = messages.filter(m =>
      m.direction === 'inbound' &&
      (
        m.triage_status === 'pending' ||
        m.triage_status === 'triaged' ||
        (m.triage_status === null && m.case_id === null)
      )
    );

    // Apply campaign filter
    if (filters?.campaignId) {
      filtered = filtered.filter(m => m.campaign_id === filters.campaignId);
    }

    // Enrich with recipient and constituent data
    return filtered.map(message => {
      const recipients = messageRecipients.filter(r => r.message_id === message.id);
      const fromRecipient = recipients.find(r => r.recipient_type === 'from');

      // Find constituent by email
      const senderEmail = fromRecipient?.email_address || '';
      const senderConstituent = fromRecipient?.constituent_id
        ? constituents.find(c => c.id === fromRecipient.constituent_id) || null
        : constituents.find(c => {
            const contacts = constituentContacts.filter(cc => cc.constituent_id === c.id);
            return contacts.some(cc => cc.type === 'email' && cc.value.toLowerCase() === senderEmail.toLowerCase());
          }) || null;

      // Determine constituent status
      let constituentStatus: ConstituentStatus = 'no_address';
      let addressFromEmail: string | undefined;

      if (senderConstituent) {
        constituentStatus = 'known';
      } else {
        // Check if address is in the message body (simplified check)
        const addressPattern = /\b\d+\s+[\w\s]+(?:street|road|lane|avenue|drive|close|way|place)\b/i;
        const bodyText = message.body_search_text || message.snippet || '';
        const addressMatch = bodyText.match(addressPattern);
        if (addressMatch) {
          constituentStatus = 'has_address';
          addressFromEmail = addressMatch[0];
        }
      }

      return {
        ...message,
        recipients,
        senderConstituent,
        senderEmail,
        senderName: fromRecipient?.name || senderEmail,
        constituentStatus,
        addressFromEmail,
      } as TriageMessage;
    });
  }, [messages, messageRecipients, constituents, constituentContacts, filters, getMyOfficeId]);

  // Further filter by constituent status
  const filteredMessages = useMemo(() => {
    if (!filters?.constituentStatus) return triageMessages;
    return triageMessages.filter(m => m.constituentStatus === filters.constituentStatus);
  }, [triageMessages, filters?.constituentStatus]);

  return {
    messages: filteredMessages,
    allMessages: triageMessages,
    campaigns,
    isLoading,
    error,
    setError,
  };
}

// ============= CAMPAIGNS WITH TRIAGE COUNTS =============

export function useCampaignsWithTriageCounts() {
  const { campaigns, messages, messageRecipients, constituents, constituentContacts, getMyOfficeId } = useSupabase();

  const campaignsWithCounts = useMemo(() => {
    const officeId = getMyOfficeId();
    if (!officeId) return [];

    return campaigns.map(campaign => {
      // Get messages for this campaign that need triage
      const campaignMessages = messages.filter(m =>
        m.campaign_id === campaign.id &&
        m.direction === 'inbound' &&
        m.case_id === null
      );

      let knownCount = 0;
      let hasAddressCount = 0;
      let noAddressCount = 0;

      campaignMessages.forEach(message => {
        const recipients = messageRecipients.filter(r => r.message_id === message.id);
        const fromRecipient = recipients.find(r => r.recipient_type === 'from');
        const senderEmail = fromRecipient?.email_address || '';

        const senderConstituent = fromRecipient?.constituent_id
          ? constituents.find(c => c.id === fromRecipient.constituent_id)
          : constituents.find(c => {
              const contacts = constituentContacts.filter(cc => cc.constituent_id === c.id);
              return contacts.some(cc => cc.type === 'email' && cc.value.toLowerCase() === senderEmail.toLowerCase());
            });

        if (senderConstituent) {
          knownCount++;
        } else {
          const addressPattern = /\b\d+\s+[\w\s]+(?:street|road|lane|avenue|drive|close|way|place)\b/i;
          const bodyText = message.body_search_text || message.snippet || '';
          if (addressPattern.test(bodyText)) {
            hasAddressCount++;
          } else {
            noAddressCount++;
          }
        }
      });

      return {
        ...campaign,
        totalCount: campaignMessages.length,
        knownCount,
        hasAddressCount,
        noAddressCount,
      } as CampaignWithCounts;
    }).filter(c => c.totalCount > 0);
  }, [campaigns, messages, messageRecipients, constituents, constituentContacts, getMyOfficeId]);

  return { campaigns: campaignsWithCounts };
}

// ============= CONSTITUENT SEARCH =============

export function useConstituentSearch() {
  const { constituents, constituentContacts } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return constituents.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return constituents.filter(c => {
      // Search by name
      if (c.full_name.toLowerCase().includes(query)) return true;

      // Search by contact
      const contacts = constituentContacts.filter(cc => cc.constituent_id === c.id);
      return contacts.some(cc => cc.value.toLowerCase().includes(query));
    }).slice(0, 20);
  }, [constituents, constituentContacts, searchQuery]);

  const getConstituentWithContacts = useCallback((constituentId: string) => {
    const constituent = constituents.find(c => c.id === constituentId);
    if (!constituent) return null;

    const contacts = constituentContacts.filter(cc => cc.constituent_id === constituentId);
    return { ...constituent, contacts };
  }, [constituents, constituentContacts]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    getConstituentWithContacts,
  };
}

// ============= CASE SEARCH =============

export function useCaseSearch(constituentId?: string | null) {
  const { cases } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    let filtered = cases;

    // If constituent is selected, prioritize their cases but show all
    if (constituentId) {
      filtered = [...cases].sort((a, b) => {
        // Cases with no assigned constituent or matching constituent come first
        const aMatch = !a.assigned_to || a.assigned_to === constituentId;
        const bMatch = !b.assigned_to || b.assigned_to === constituentId;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    if (!searchQuery.trim()) return filtered.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return filtered.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.reference_number?.toString().includes(query) ||
      c.description?.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [cases, constituentId, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
  };
}

// ============= CASEWORKER SELECTOR =============

export function useCaseworkers() {
  const { profiles, getMyOfficeId } = useSupabase();

  const caseworkers = useMemo(() => {
    const officeId = getMyOfficeId();
    if (!officeId) return [];

    return profiles.filter(p =>
      p.office_id === officeId &&
      (p.role === 'admin' || p.role === 'staff')
    );
  }, [profiles, getMyOfficeId]);

  return { caseworkers };
}

// ============= TRIAGE ACTIONS =============

interface TriageActionResult {
  success: boolean;
  error?: string;
}

export function useTriageActions() {
  const {
    updateMessage,
    updateCase,
    createCase,
    createConstituent,
    createCaseParty,
    removeTagFromEntity,
    getMyOfficeId,
    getCurrentUserId,
    refreshData,
  } = useSupabase();

  const [isProcessing, setIsProcessing] = useState(false);

  // Link message to case
  const linkMessageToCase = useCallback(async (messageId: string, caseId: string): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      const result = await updateMessage(messageId, { case_id: caseId });
      if (!result) throw new Error('Failed to link message to case');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [updateMessage]);

  // Assign caseworker to case
  const assignCaseworker = useCallback(async (caseId: string, profileId: string): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      const result = await updateCase(caseId, { assigned_to: profileId });
      if (!result) throw new Error('Failed to assign caseworker');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [updateCase]);

  // Set case priority
  const setCasePriority = useCallback(async (caseId: string, priority: CasePriority): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      const result = await updateCase(caseId, { priority });
      if (!result) throw new Error('Failed to set priority');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [updateCase]);

  // Create new case and link message
  const createCaseForMessage = useCallback(async (
    messageId: string,
    caseData: { title: string; description?: string; priority?: CasePriority; assigned_to?: string }
  ): Promise<{ success: boolean; caseId?: string; error?: string }> => {
    setIsProcessing(true);
    try {
      const userId = getCurrentUserId();
      const newCase = await createCase({
        ...caseData,
        status: 'open',
        created_by: userId || undefined,
      });
      if (!newCase) throw new Error('Failed to create case');

      // Link message to new case
      const linkResult = await updateMessage(messageId, { case_id: newCase.id });
      if (!linkResult) throw new Error('Failed to link message to new case');

      return { success: true, caseId: newCase.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [createCase, updateMessage, getCurrentUserId]);

  // Create constituent with contacts
  const createConstituentWithContacts = useCallback(async (
    data: { full_name: string; email?: string; address?: string; phone?: string }
  ): Promise<{ success: boolean; constituentId?: string; error?: string }> => {
    setIsProcessing(true);
    try {
      const officeId = getMyOfficeId();
      if (!officeId) throw new Error('No office ID');

      const constituent = await createConstituent({ full_name: data.full_name });
      if (!constituent) throw new Error('Failed to create constituent');

      // Add contacts
      if (data.email) {
        await supabase.from('constituent_contacts').insert({
          office_id: officeId,
          constituent_id: constituent.id,
          type: 'email' as const,
          value: data.email,
          is_primary: true,
        });
      }
      if (data.address) {
        await supabase.from('constituent_contacts').insert({
          office_id: officeId,
          constituent_id: constituent.id,
          type: 'address' as const,
          value: data.address,
          is_primary: true,
        });
      }
      if (data.phone) {
        await supabase.from('constituent_contacts').insert({
          office_id: officeId,
          constituent_id: constituent.id,
          type: 'phone' as const,
          value: data.phone,
        });
      }

      await refreshData();

      return { success: true, constituentId: constituent.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [createConstituent, getMyOfficeId, refreshData]);

  // Link constituent to case
  const linkConstituentToCase = useCallback(async (
    caseId: string,
    constituentId: string,
    role: string = 'primary'
  ): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      const result = await createCaseParty({
        case_id: caseId,
        constituent_id: constituentId,
        role,
      });
      if (!result) throw new Error('Failed to link constituent to case');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [createCaseParty]);

  // Update message recipient constituent link
  const linkRecipientToConstituent = useCallback(async (
    recipientId: string,
    constituentId: string
  ): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('message_recipients')
        .update({ constituent_id: constituentId })
        .eq('id', recipientId);

      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [refreshData]);

  // Dismiss/reject message from triage (not a valid constituent email)
  const dismissTriage = useCallback(async (
    messageId: string,
    reason?: string
  ): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      // Use the dismiss_triage RPC function for proper audit logging
      const { data, error } = await supabase.rpc('dismiss_triage', {
        p_message_ids: [messageId],
        p_reason: reason || null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to dismiss');

      await refreshData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [refreshData]);

  // Bulk dismiss multiple messages - uses RPC for efficiency
  const bulkDismissTriage = useCallback(async (
    messageIds: string[],
    reason?: string
  ): Promise<{ success: boolean; successCount: number; error?: string }> => {
    setIsProcessing(true);
    try {
      // Use the dismiss_triage RPC function with multiple message IDs
      const { data, error } = await supabase.rpc('dismiss_triage', {
        p_message_ids: messageIds,
        p_reason: reason || null,
      });

      if (error) throw error;

      const successCount = data?.dismissed_count || 0;
      await refreshData();

      return {
        success: data?.success || false,
        successCount,
        error: data?.error,
      };
    } catch (err) {
      return { success: false, successCount: 0, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [refreshData]);

  // Remove tag from case
  const removeTagFromCase = useCallback(async (
    tagId: string,
    caseId: string
  ): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      await removeTagFromEntity(tagId, 'case', caseId);
      await refreshData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [removeTagFromEntity, refreshData]);

  // Batch approve triage - uses RPC for proper status tracking and audit logging
  const approveTriage = useCallback(async (
    messageId: string,
    triageData: {
      caseId?: string;
      newCaseTitle?: string;
      constituentId?: string;
      assigneeId?: string;
      priority?: CasePriority;
      tagIds?: string[];
    }
  ): Promise<TriageActionResult> => {
    setIsProcessing(true);
    try {
      let caseId = triageData.caseId;

      // Create case if needed
      if (!caseId && triageData.newCaseTitle) {
        const caseResult = await createCaseForMessage(messageId, {
          title: triageData.newCaseTitle,
          priority: triageData.priority,
          assigned_to: triageData.assigneeId,
        });
        if (!caseResult.success) throw new Error(caseResult.error);
        caseId = caseResult.caseId;

        // Use confirm_triage RPC to update status with proper audit trail
        const { error: confirmError } = await supabase.rpc('confirm_triage', {
          p_message_ids: [messageId],
          p_case_id: caseId,
          p_assignee_id: triageData.assigneeId || null,
          p_tag_ids: triageData.tagIds || null,
        });
        if (confirmError) throw confirmError;
      } else if (caseId) {
        // Use confirm_triage RPC for existing case
        const { error: confirmError } = await supabase.rpc('confirm_triage', {
          p_message_ids: [messageId],
          p_case_id: caseId,
          p_assignee_id: triageData.assigneeId || null,
          p_tag_ids: triageData.tagIds || null,
        });
        if (confirmError) throw confirmError;

        // Update case priority if specified
        if (triageData.priority) {
          await updateCase(caseId, { priority: triageData.priority });
        }
      }

      // Link constituent to case if both exist
      if (caseId && triageData.constituentId) {
        await linkConstituentToCase(caseId, triageData.constituentId);
      }

      await refreshData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsProcessing(false);
    }
  }, [
    createCaseForMessage,
    updateCase,
    linkConstituentToCase,
    refreshData,
  ]);

  return {
    isProcessing,
    linkMessageToCase,
    assignCaseworker,
    setCasePriority,
    createCaseForMessage,
    createConstituentWithContacts,
    linkConstituentToCase,
    linkRecipientToConstituent,
    removeTagFromCase,
    approveTriage,
    dismissTriage,
    bulkDismissTriage,
  };
}

// ============= MESSAGE BODY FETCHER =============

export function useMessageBody(messageId: string | null) {
  const [body, setBody] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBody = useCallback(async () => {
    if (!messageId) {
      setBody(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from storage path
      const { data: message } = await supabase
        .from('messages')
        .select('storage_path_text, storage_path_html, snippet')
        .eq('id', messageId)
        .single();

      if (!message) throw new Error('Message not found');

      if (message.storage_path_text) {
        const { data, error: storageError } = await supabase.storage
          .from('message-bodies')
          .download(message.storage_path_text);

        if (!storageError && data) {
          const text = await data.text();
          setBody(text);
          return;
        }
      }

      // Fall back to snippet
      setBody(message.snippet || 'No content available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load message');
      setBody(null);
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  // Auto-fetch when messageId changes
  useState(() => {
    fetchBody();
  });

  return { body, isLoading, error, refetch: fetchBody };
}
