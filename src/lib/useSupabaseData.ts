import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type {
  Office,
  Profile,
  Constituent,
  ConstituentContact,
  Organization,
  Case,
  CaseParty,
  Campaign,
  Message,
  MessageRecipient,
  Tag,
  BulkResponse,
  CaseInsert,
  ConstituentInsert,
  MessageInsert,
  MessageUpdate,
  CasePartyInsert,
  CasePriority,
  UserRole,
  OutlookSession,
} from './database.types';
import type { User } from '@supabase/supabase-js';

interface UseSupabaseDataReturn {
  // Supabase client (for realtime subscriptions, etc.)
  supabase: typeof supabase;

  // Auth state
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;

  // Current office
  currentOffice: Office | null;
  currentOfficeMode: 'casework' | 'westminster';
  setCurrentOfficeMode: (mode: 'casework' | 'westminster') => void;

  // Data
  offices: Office[];
  profiles: Profile[];
  constituents: Constituent[];
  constituentContacts: ConstituentContact[];
  organizations: Organization[];
  cases: Case[];
  caseParties: CaseParty[];
  campaigns: Campaign[];
  messages: Message[];
  messageRecipients: MessageRecipient[];
  tags: Tag[];
  bulkResponses: BulkResponse[];

  // Helpers
  getMyOfficeId: () => string | null;
  getCurrentUserId: () => string | null;

  // Actions
  refreshData: () => Promise<void>;
  createCase: (caseData: Omit<CaseInsert, 'office_id'>) => Promise<Case | null>;
  updateCase: (id: string, updates: Partial<Case>) => Promise<Case | null>;
  createConstituent: (data: Omit<ConstituentInsert, 'office_id'>) => Promise<Constituent | null>;
  createMessage: (data: Omit<MessageInsert, 'office_id'>) => Promise<Message | null>;
  updateMessage: (id: string, updates: MessageUpdate) => Promise<Message | null>;
  createCaseParty: (data: Omit<CasePartyInsert, 'office_id'>) => Promise<CaseParty | null>;
  removeCaseParty: (casePartyId: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Settings actions
  updateOffice: (updates: { name?: string }) => Promise<Office | null>;
  updateProfileRole: (profileId: string, role: UserRole) => Promise<Profile | null>;
  createTag: (name: string, color: string) => Promise<Tag | null>;
  updateTag: (id: string, updates: { name?: string; color?: string }) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<boolean>;
  emailIntegration: OutlookSession | null;
  fetchEmailIntegration: () => Promise<OutlookSession | null>;
  deleteEmailIntegration: () => Promise<boolean>;

  // Bulk response processing
  processBulkResponse: (bulkResponseId: string) => Promise<{ queued_count: number } | null>;
}

export function useSupabaseData(): UseSupabaseDataReturn {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Office mode (UI state)
  const [currentOfficeMode, setCurrentOfficeMode] = useState<'casework' | 'westminster'>('casework');

  // Data state
  const [offices, setOffices] = useState<Office[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [constituentContacts, setConstituentContacts] = useState<ConstituentContact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [caseParties, setCaseParties] = useState<CaseParty[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageRecipients, setMessageRecipients] = useState<MessageRecipient[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [bulkResponses, setBulkResponses] = useState<BulkResponse[]>([]);
  const [emailIntegration, setEmailIntegration] = useState<OutlookSession | null>(null);

  // Derived state
  const currentOffice = offices.find(o => o.id === profile?.office_id) || null;

  // Helper functions
  const getMyOfficeId = useCallback(() => profile?.office_id || null, [profile]);
  const getCurrentUserId = useCallback(() => user?.id || null, [user]);

  // Fetch all data for current office
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch profile first to get office_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as Profile);

      if (!(profileData as Profile)?.office_id) {
        setLoading(false);
        return;
      }

      // Fetch all data in parallel (RLS will filter by office)
      const [
        officesRes,
        profilesRes,
        constituentsRes,
        contactsRes,
        orgsRes,
        casesRes,
        partiesRes,
        campaignsRes,
        messagesRes,
        recipientsRes,
        tagsRes,
        bulkRes,
      ] = await Promise.all([
        supabase.from('offices').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('constituents').select('*').order('full_name'),
        supabase.from('constituent_contacts').select('*'),
        supabase.from('organizations').select('*').order('name'),
        supabase.from('cases').select('*').order('created_at', { ascending: false }),
        supabase.from('case_parties').select('*'),
        supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('received_at', { ascending: false }),
        supabase.from('message_recipients').select('*'),
        supabase.from('tags').select('*').order('name'),
        supabase.from('bulk_responses').select('*').order('created_at', { ascending: false }),
      ]);

      // Check for errors
      const errors = [
        officesRes.error,
        profilesRes.error,
        constituentsRes.error,
        contactsRes.error,
        orgsRes.error,
        casesRes.error,
        partiesRes.error,
        campaignsRes.error,
        messagesRes.error,
        recipientsRes.error,
        tagsRes.error,
        bulkRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error(errors.map(e => e?.message).join(', '));
      }

      // Set all data with type assertions
      setOffices((officesRes.data || []) as Office[]);
      setProfiles((profilesRes.data || []) as Profile[]);
      setConstituents((constituentsRes.data || []) as Constituent[]);
      setConstituentContacts((contactsRes.data || []) as ConstituentContact[]);
      setOrganizations((orgsRes.data || []) as Organization[]);
      setCases((casesRes.data || []) as Case[]);
      setCaseParties((partiesRes.data || []) as CaseParty[]);
      setCampaigns((campaignsRes.data || []) as Campaign[]);
      setMessages((messagesRes.data || []) as Message[]);
      setMessageRecipients((recipientsRes.data || []) as MessageRecipient[]);
      setTags((tagsRes.data || []) as Tag[]);
      setBulkResponses((bulkRes.data || []) as BulkResponse[]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auth state listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // Clear data on sign out
      setProfile(null);
      setOffices([]);
      setProfiles([]);
      setConstituents([]);
      setConstituentContacts([]);
      setOrganizations([]);
      setCases([]);
      setCaseParties([]);
      setCampaigns([]);
      setMessages([]);
      setMessageRecipients([]);
      setTags([]);
      setBulkResponses([]);
      setEmailIntegration(null);
      setLoading(false);
    }
  }, [user, fetchData]);

  // Actions
  const createCase = async (caseData: Omit<CaseInsert, 'office_id'>): Promise<Case | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const insertData = {
      office_id: officeId,
      title: caseData.title,
      description: caseData.description,
      status: caseData.status,
      priority: caseData.priority as CasePriority,
      category: caseData.category,
      assigned_to: caseData.assigned_to,
      created_by: caseData.created_by,
    };

    const { data, error: insertError } = await supabase
      .from('cases')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating case:', insertError);
      return null;
    }

    const newCase = data as Case;
    setCases(prev => [newCase, ...prev]);
    return newCase;
  };

  const updateCase = async (id: string, updates: Partial<Case>): Promise<Case | null> => {
    const { data, error: updateError } = await supabase
      .from('cases')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating case:', updateError);
      return null;
    }

    const updatedCase = data as Case;
    setCases(prev => prev.map(c => c.id === id ? updatedCase : c));
    return updatedCase;
  };

  const createConstituent = async (constituentData: Omit<ConstituentInsert, 'office_id'>): Promise<Constituent | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const insertData = {
      office_id: officeId,
      full_name: constituentData.full_name,
      salutation: constituentData.salutation,
      notes: constituentData.notes,
    };

    const { data, error: insertError } = await supabase
      .from('constituents')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating constituent:', insertError);
      return null;
    }

    const newConstituent = data as Constituent;
    setConstituents(prev => [...prev, newConstituent].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    return newConstituent;
  };

  const createMessage = async (messageData: Omit<MessageInsert, 'office_id'>): Promise<Message | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const insertData = {
      office_id: officeId,
      direction: messageData.direction,
      channel: messageData.channel,
      subject: messageData.subject,
      snippet: messageData.snippet,
      case_id: messageData.case_id,
      campaign_id: messageData.campaign_id,
    };

    const { data, error: insertError } = await supabase
      .from('messages')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating message:', insertError);
      return null;
    }

    const newMessage = data as Message;
    setMessages(prev => [newMessage, ...prev]);
    return newMessage;
  };

  const updateMessage = async (id: string, updates: MessageUpdate): Promise<Message | null> => {
    const { data, error: updateError } = await supabase
      .from('messages')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating message:', updateError);
      return null;
    }

    const updatedMessage = data as Message;
    setMessages(prev => prev.map(m => m.id === id ? updatedMessage : m));
    return updatedMessage;
  };

  const createCaseParty = async (partyData: Omit<CasePartyInsert, 'office_id'>): Promise<CaseParty | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const insertData = {
      office_id: officeId,
      case_id: partyData.case_id,
      constituent_id: partyData.constituent_id,
      organization_id: partyData.organization_id,
      role: partyData.role,
    };

    const { data, error: insertError } = await supabase
      .from('case_parties')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating case party:', insertError);
      return null;
    }

    const newCaseParty = data as CaseParty;
    setCaseParties(prev => [...prev, newCaseParty]);
    return newCaseParty;
  };

  const removeCaseParty = async (casePartyId: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('case_parties')
      .delete()
      .eq('id', casePartyId);

    if (deleteError) {
      console.error('Error removing case party:', deleteError);
      return false;
    }

    setCaseParties(prev => prev.filter(cp => cp.id !== casePartyId));
    return true;
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      throw signInError;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Settings actions
  const updateOffice = async (updates: { name?: string }): Promise<Office | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const { data, error: updateError } = await supabase
      .from('offices')
      .update(updates as never)
      .eq('id', officeId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating office:', updateError);
      return null;
    }

    const updatedOffice = data as Office;
    setOffices(prev => prev.map(o => o.id === officeId ? updatedOffice : o));
    return updatedOffice;
  };

  const updateProfileRole = async (profileId: string, role: UserRole): Promise<Profile | null> => {
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ role } as never)
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile role:', updateError);
      return null;
    }

    const updatedProfile = data as Profile;
    setProfiles(prev => prev.map(p => p.id === profileId ? updatedProfile : p));
    return updatedProfile;
  };

  const createTag = async (name: string, color: string): Promise<Tag | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const { data, error: insertError } = await supabase
      .from('tags')
      .insert({ office_id: officeId, name, color } as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tag:', insertError);
      return null;
    }

    const newTag = data as Tag;
    setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
    return newTag;
  };

  const updateTag = async (id: string, updates: { name?: string; color?: string }): Promise<Tag | null> => {
    const { data, error: updateError } = await supabase
      .from('tags')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating tag:', updateError);
      return null;
    }

    const updatedTag = data as Tag;
    setTags(prev => prev.map(t => t.id === id ? updatedTag : t).sort((a, b) => a.name.localeCompare(b.name)));
    return updatedTag;
  };

  const deleteTag = async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting tag:', deleteError);
      return false;
    }

    setTags(prev => prev.filter(t => t.id !== id));
    return true;
  };

  const fetchEmailIntegration = async (): Promise<OutlookSession | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const { data, error: fetchError } = await supabase
      .from('integration_outlook_sessions')
      .select('id, office_id, is_connected, last_used_at, created_at, updated_at')
      .eq('office_id', officeId)
      .single();

    if (fetchError) {
      // No integration found is not an error
      if (fetchError.code !== 'PGRST116') {
        console.error('Error fetching email integration:', fetchError);
      }
      setEmailIntegration(null);
      return null;
    }

    const integration = data as OutlookSession;
    setEmailIntegration(integration);
    return integration;
  };

  const deleteEmailIntegration = async (): Promise<boolean> => {
    const officeId = getMyOfficeId();
    if (!officeId) return false;

    const { error: deleteError } = await supabase
      .from('integration_outlook_sessions')
      .delete()
      .eq('office_id', officeId);

    if (deleteError) {
      console.error('Error deleting email integration:', deleteError);
      return false;
    }

    setEmailIntegration(null);
    return true;
  };

  // Process a bulk response by calling the RPC function that uses constituent_contacts as source of truth
  const processBulkResponse = async (bulkResponseId: string): Promise<{ queued_count: number } | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const { data, error } = await supabase.rpc('generate_campaign_outbox_messages', {
      p_bulk_response_id: bulkResponseId,
      p_office_id: officeId,
    });

    if (error) {
      console.error('Error processing bulk response:', error);
      throw error;
    }

    // Refresh data to show status changes
    await fetchData();
    return data as { queued_count: number };
  };

  return {
    // Supabase client
    supabase,

    // Auth
    user,
    profile,
    loading,
    error,

    // Office
    currentOffice,
    currentOfficeMode,
    setCurrentOfficeMode,

    // Data
    offices,
    profiles,
    constituents,
    constituentContacts,
    organizations,
    cases,
    caseParties,
    campaigns,
    messages,
    messageRecipients,
    tags,
    bulkResponses,

    // Helpers
    getMyOfficeId,
    getCurrentUserId,

    // Actions
    refreshData: fetchData,
    createCase,
    updateCase,
    createConstituent,
    createMessage,
    updateMessage,
    createCaseParty,
    removeCaseParty,
    signIn,
    signOut,

    // Settings actions
    updateOffice,
    updateProfileRole,
    createTag,
    updateTag,
    deleteTag,
    emailIntegration,
    fetchEmailIntegration,
    deleteEmailIntegration,

    // Bulk response processing
    processBulkResponse,
  };
}
