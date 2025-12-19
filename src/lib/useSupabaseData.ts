import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useSessionSecurity } from './useSessionSecurity';
import type {
  Office,
  OfficeSettings,
  OfficeSettingsUpdate,
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
  TagAssignment,
  BulkResponse,
  CaseInsert,
  ConstituentInsert,
  MessageInsert,
  MessageUpdate,
  CasePartyInsert,
  CasePriority,
  UserRole,
  OutlookSession,
  Note,
  NoteReply,
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

  // MFA state
  requiresMfa: boolean;
  mfaVerified: boolean;
  checkMfaStatus: () => Promise<void>;

  // Current office
  currentOffice: Office | null;
  currentOfficeSettings: OfficeSettings | null;
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
  tagAssignments: TagAssignment[];
  bulkResponses: BulkResponse[];
  notes: Note[];
  noteReplies: NoteReply[];

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
  createCampaign: (data: { name: string; description?: string; subject_pattern?: string; fingerprint_hash?: string }) => Promise<Campaign | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, invitationCode?: string) => Promise<{ success: boolean; message: string }>;
  validateInvitation: (token: string) => Promise<{ valid: boolean; officeName?: string; error?: string }>;

  // Invitation management (admin only)
  createInvitation: (options: { email?: string; role?: UserRole; expiresInDays?: number; maxUses?: number }) => Promise<{ token: string; expiresAt: string } | null>;
  listInvitations: () => Promise<Array<{ id: string; token: string; email: string | null; role: UserRole; created_at: string; expires_at: string; use_count: number; max_uses: number | null; used_at: string | null }>>;
  revokeInvitation: (invitationId: string) => Promise<boolean>;

  signOut: () => Promise<void>;

  // Settings actions
  updateOffice: (updates: { name?: string }) => Promise<Office | null>;
  updateOfficeSettings: (updates: OfficeSettingsUpdate) => Promise<OfficeSettings | null>;
  fetchOfficeSettings: () => Promise<OfficeSettings | null>;
  updateProfileRole: (profileId: string, role: UserRole) => Promise<Profile | null>;
  createTag: (name: string, color: string) => Promise<Tag | null>;
  updateTag: (id: string, updates: { name?: string; color?: string }) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<boolean>;
  emailIntegration: OutlookSession | null;
  fetchEmailIntegration: () => Promise<OutlookSession | null>;
  deleteEmailIntegration: () => Promise<boolean>;

  // Bulk response processing
  processBulkResponse: (bulkResponseId: string) => Promise<{ queued_count: number } | null>;

  // Notes actions
  fetchNotes: (context: { caseId?: string; campaignId?: string; threadId?: string }) => Promise<Note[]>;
  createNote: (noteData: { body: string; caseId?: string; campaignId?: string; threadId?: string }) => Promise<Note | null>;
  createNoteReply: (noteId: string, body: string) => Promise<NoteReply | null>;

  // Tag assignment actions
  getTagsForEntity: (entityType: string, entityId: string) => TagAssignment[];
  addTagToEntity: (tagId: string, entityType: string, entityId: string) => Promise<TagAssignment | null>;
  removeTagFromEntity: (tagId: string, entityType: string, entityId: string) => Promise<boolean>;

  // Session security
  sessionSecurity: {
    riskScore: number;
    anomalies: Array<{ type: string; expected: string; actual: string }>;
    actionRequired: boolean;
    isLoading: boolean;
    error: string | null;
    trustCurrentContext: () => Promise<boolean>;
    dismissAnomaly: () => void;
  };
}

export function useSupabaseData(): UseSupabaseDataReturn {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // MFA state
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

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
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [bulkResponses, setBulkResponses] = useState<BulkResponse[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteReplies, setNoteReplies] = useState<NoteReply[]>([]);
  const [emailIntegration, setEmailIntegration] = useState<OutlookSession | null>(null);
  const [currentOfficeSettings, setCurrentOfficeSettings] = useState<OfficeSettings | null>(null);

  // Session security
  const sessionSecurity = useSessionSecurity(user?.id || null);

  // Derived state
  const currentOffice = offices.find(o => o.id === profile?.office_id) || null;

  // Helper functions
  const getMyOfficeId = useCallback(() => profile?.office_id || null, [profile]);
  const getCurrentUserId = useCallback(() => user?.id || null, [user]);

  // Check MFA status - determines if user needs to complete MFA verification
  const checkMfaStatus = useCallback(async () => {
    if (!user) {
      setRequiresMfa(false);
      setMfaVerified(false);
      return;
    }

    try {
      // Get current session to check assurance level
      const { data: { session } } = await supabase.auth.getSession();
      // The aal (Authenticator Assurance Level) indicates MFA status
      // aal1 = password only, aal2 = password + MFA verified
      const currentAal = (session as { aal?: string } | null)?.aal || 'aal1';

      // List user's MFA factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactor = factorsData?.totp?.some(f => f.status === 'verified') || false;

      // User requires MFA if they have a verified factor but session is only aal1
      if (hasVerifiedFactor && currentAal === 'aal1') {
        setRequiresMfa(true);
        setMfaVerified(false);
      } else if (hasVerifiedFactor && currentAal === 'aal2') {
        setRequiresMfa(false);
        setMfaVerified(true);
      } else {
        // No MFA factor enrolled
        setRequiresMfa(false);
        setMfaVerified(false);
      }
    } catch (err) {
      console.error('Error checking MFA status:', err);
      // On error, don't block the user but don't claim MFA is verified
      setRequiresMfa(false);
      setMfaVerified(false);
    }
  }, [user]);

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
        tagAssignmentsRes,
        bulkRes,
        notesRes,
        noteRepliesRes,
        officeSettingsRes,
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
        supabase.from('tag_assignments').select('*'),
        supabase.from('bulk_responses').select('*').order('created_at', { ascending: false }),
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('note_replies').select('*').order('created_at', { ascending: true }),
        (profileData as Profile).office_id
          ? supabase.from('office_settings').select('*').eq('office_id', (profileData as Profile).office_id!).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      // Check for errors (excluding officeSettingsRes which may not exist yet)
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
        tagAssignmentsRes.error,
        bulkRes.error,
        notesRes.error,
        noteRepliesRes.error,
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
      setTagAssignments((tagAssignmentsRes.data || []) as TagAssignment[]);
      setBulkResponses((bulkRes.data || []) as BulkResponse[]);
      setNotes((notesRes.data || []) as Note[]);
      setNoteReplies((noteRepliesRes.data || []) as NoteReply[]);
      setCurrentOfficeSettings(officeSettingsRes.data as OfficeSettings | null);

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
      checkMfaStatus();
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
      setTagAssignments([]);
      setBulkResponses([]);
      setNotes([]);
      setNoteReplies([]);
      setEmailIntegration(null);
      setCurrentOfficeSettings(null);
      setRequiresMfa(false);
      setMfaVerified(false);
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

  const createCampaign = async (data: { name: string; description?: string; subject_pattern?: string; fingerprint_hash?: string }): Promise<Campaign | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const insertData = {
      office_id: officeId,
      name: data.name,
      description: data.description || null,
      subject_pattern: data.subject_pattern || null,
      fingerprint_hash: data.fingerprint_hash || null,
      status: 'active',
    };

    const { data: newCampaign, error: insertError } = await supabase
      .from('campaigns')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating campaign:', insertError);
      return null;
    }

    const campaign = newCampaign as Campaign;
    setCampaigns(prev => [campaign, ...prev]);
    return campaign;
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

  const validateInvitation = async (token: string): Promise<{ valid: boolean; officeName?: string; error?: string }> => {
    try {
      // Note: office_invitations table is created by migration 20241219000001
      // Type assertion needed until database types are regenerated
      const { data, error: fetchError } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              single: () => Promise<{ data: { id: string; office_id: string; offices?: { name: string } } | null; error: Error | null }>;
            };
          };
        };
      }).from('office_invitations')
        .select('id, office_id, offices(name)')
        .eq('token', token)
        .single();

      if (fetchError || !data) {
        return { valid: false, error: 'Invalid invitation code' };
      }

      const officeName = data.offices?.name;
      return { valid: true, officeName };
    } catch {
      return { valid: false, error: 'Failed to validate invitation' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    invitationCode?: string
  ): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return { success: false, message: signUpError.message };
      }

      if (!authData.user) {
        setLoading(false);
        return { success: false, message: 'Failed to create account' };
      }

      // Step 2: If invitation code provided, claim it and assign office
      if (invitationCode) {
        // Note: claim_invitation function is created by migration 20241219000001
        // Type assertion needed until database types are regenerated
        type ClaimResult = { success: boolean; office_id: string | null; role: UserRole | null; error_message: string | null };
        const { data: claimResult, error: claimError } = await (supabase.rpc as unknown as (
          fn: string,
          params: Record<string, unknown>
        ) => Promise<{ data: ClaimResult[] | null; error: Error | null }>)('claim_invitation', {
          p_token: invitationCode,
          p_user_id: authData.user.id,
          p_email: email,
        });

        if (claimError) {
          console.error('Error claiming invitation:', claimError);
          // User is created but without office - they can be assigned later
          setLoading(false);
          return {
            success: true,
            message: 'Account created but invitation could not be applied. Please contact your administrator.',
          };
        }

        const result = claimResult?.[0];
        if (result && result.success && result.office_id) {
          // Create profile with office assignment
          const assignedRole: UserRole = result.role || 'staff';
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              full_name: fullName,
              office_id: result.office_id,
              role: assignedRole,
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }

          setLoading(false);
          return {
            success: true,
            message: 'Account created successfully! Please check your email to verify your account.',
          };
        } else {
          setLoading(false);
          return {
            success: true,
            message: result?.error_message || 'Account created but invitation was invalid. Please contact your administrator.',
          };
        }
      }

      // No invitation code - create profile without office (pending assignment)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: fullName,
          office_id: null,
          role: 'staff',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      setLoading(false);
      return {
        success: true,
        message: 'Account created! Please check your email to verify your account. An administrator will assign you to an office.',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      setLoading(false);
      return { success: false, message };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Invitation management functions (admin only)
  type Invitation = {
    id: string;
    token: string;
    email: string | null;
    role: UserRole;
    created_at: string;
    expires_at: string;
    use_count: number;
    max_uses: number | null;
    used_at: string | null;
  };

  const createInvitation = async (options: {
    email?: string;
    role?: UserRole;
    expiresInDays?: number;
    maxUses?: number;
  }): Promise<{ token: string; expiresAt: string } | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    try {
      // Use the database function to create the invitation
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>
      ) => Promise<{ data: { token: string; expires_at: string } | null; error: Error | null }>)('create_office_invitation', {
        p_office_id: officeId,
        p_email: options.email || null,
        p_role: options.role || 'staff',
        p_expires_in_days: options.expiresInDays || 7,
        p_max_uses: options.maxUses || 1,
      });

      if (rpcError || !data) {
        console.error('Error creating invitation:', rpcError);
        return null;
      }

      return { token: data.token, expiresAt: data.expires_at };
    } catch (err) {
      console.error('Error creating invitation:', err);
      return null;
    }
  };

  const listInvitations = async (): Promise<Invitation[]> => {
    const officeId = getMyOfficeId();
    if (!officeId) return [];

    try {
      // Query the office_invitations table directly
      // Type assertion needed until database types are regenerated
      const { data, error: fetchError } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options: { ascending: boolean }) => Promise<{ data: Invitation[] | null; error: Error | null }>;
            };
          };
        };
      }).from('office_invitations')
        .select('id, token, email, role, created_at, expires_at, use_count, max_uses, used_at')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (fetchError || !data) {
        console.error('Error fetching invitations:', fetchError);
        return [];
      }

      return data;
    } catch (err) {
      console.error('Error fetching invitations:', err);
      return [];
    }
  };

  const revokeInvitation = async (invitationId: string): Promise<boolean> => {
    const officeId = getMyOfficeId();
    if (!officeId) return false;

    try {
      // Delete the invitation (RLS will ensure it belongs to the user's office)
      const { error: deleteError } = await (supabase as unknown as {
        from: (table: string) => {
          delete: () => {
            eq: (column: string, value: string) => Promise<{ error: Error | null }>;
          };
        };
      }).from('office_invitations')
        .delete()
        .eq('id', invitationId);

      if (deleteError) {
        console.error('Error revoking invitation:', deleteError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error revoking invitation:', err);
      return false;
    }
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

  // Office settings functions
  const fetchOfficeSettings = async (): Promise<OfficeSettings | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    const { data, error: fetchError } = await supabase
      .from('office_settings')
      .select('*')
      .eq('office_id', officeId)
      .single();

    if (fetchError) {
      // No settings found - this is expected for new offices
      if (fetchError.code !== 'PGRST116') {
        console.error('Error fetching office settings:', fetchError);
      }
      setCurrentOfficeSettings(null);
      return null;
    }

    const settings = data as OfficeSettings;
    setCurrentOfficeSettings(settings);
    return settings;
  };

  const updateOfficeSettings = async (updates: OfficeSettingsUpdate): Promise<OfficeSettings | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    // First try to update existing settings
    const { data: existingData, error: selectError } = await supabase
      .from('office_settings')
      .select('id')
      .eq('office_id', officeId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking office settings:', selectError);
      return null;
    }

    let result;
    if (existingData) {
      // Update existing
      result = await supabase
        .from('office_settings')
        .update(updates as never)
        .eq('office_id', officeId)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('office_settings')
        .insert({ ...updates, office_id: officeId } as never)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error updating office settings:', result.error);
      return null;
    }

    const updatedSettings = result.data as OfficeSettings;
    setCurrentOfficeSettings(updatedSettings);
    return updatedSettings;
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

  // Notes functions
  const fetchNotes = async (context: { caseId?: string; campaignId?: string; threadId?: string }): Promise<Note[]> => {
    let query = supabase.from('notes').select('*').order('created_at', { ascending: false });

    if (context.caseId) {
      query = query.eq('case_id', context.caseId);
    } else if (context.campaignId) {
      query = query.eq('campaign_id', context.campaignId);
    } else if (context.threadId) {
      query = query.eq('thread_id', context.threadId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notes:', error);
      return [];
    }

    return (data || []) as Note[];
  };

  const createNote = async (noteData: { body: string; caseId?: string; campaignId?: string; threadId?: string }): Promise<Note | null> => {
    const officeId = getMyOfficeId();
    const userId = getCurrentUserId();
    if (!officeId || !userId) return null;

    const insertData = {
      office_id: officeId,
      case_id: noteData.caseId || null,
      campaign_id: noteData.campaignId || null,
      thread_id: noteData.threadId || null,
      body: noteData.body,
      created_by: userId,
    };

    const { data, error: insertError } = await supabase
      .from('notes')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating note:', insertError);
      return null;
    }

    const newNote = data as Note;
    setNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  const createNoteReply = async (noteId: string, body: string): Promise<NoteReply | null> => {
    const officeId = getMyOfficeId();
    const userId = getCurrentUserId();
    if (!officeId || !userId) return null;

    const insertData = {
      office_id: officeId,
      note_id: noteId,
      body,
      created_by: userId,
    };

    const { data, error: insertError } = await supabase
      .from('note_replies')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating note reply:', insertError);
      return null;
    }

    const newReply = data as NoteReply;
    setNoteReplies(prev => [...prev, newReply]);
    return newReply;
  };

  // Tag assignment functions
  const getTagsForEntity = (entityType: string, entityId: string): TagAssignment[] => {
    return tagAssignments.filter(ta => ta.entity_type === entityType && ta.entity_id === entityId);
  };

  const addTagToEntity = async (tagId: string, entityType: string, entityId: string): Promise<TagAssignment | null> => {
    const officeId = getMyOfficeId();
    if (!officeId) return null;

    // Check if already assigned
    const existing = tagAssignments.find(
      ta => ta.tag_id === tagId && ta.entity_type === entityType && ta.entity_id === entityId
    );
    if (existing) return existing;

    const insertData = {
      office_id: officeId,
      tag_id: tagId,
      entity_type: entityType,
      entity_id: entityId,
    };

    const { data, error: insertError } = await supabase
      .from('tag_assignments')
      .insert(insertData as never)
      .select()
      .single();

    if (insertError) {
      console.error('Error adding tag to entity:', insertError);
      return null;
    }

    const newAssignment = data as TagAssignment;
    setTagAssignments(prev => [...prev, newAssignment]);
    return newAssignment;
  };

  const removeTagFromEntity = async (tagId: string, entityType: string, entityId: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('tag_assignments')
      .delete()
      .eq('tag_id', tagId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (deleteError) {
      console.error('Error removing tag from entity:', deleteError);
      return false;
    }

    setTagAssignments(prev => prev.filter(
      ta => !(ta.tag_id === tagId && ta.entity_type === entityType && ta.entity_id === entityId)
    ));
    return true;
  };

  return {
    // Supabase client
    supabase,

    // Auth
    user,
    profile,
    loading,
    error,

    // MFA
    requiresMfa,
    mfaVerified,
    checkMfaStatus,

    // Office
    currentOffice,
    currentOfficeSettings,
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
    tagAssignments,
    bulkResponses,
    notes,
    noteReplies,

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
    createCampaign,
    signIn,
    signUp,
    validateInvitation,
    createInvitation,
    listInvitations,
    revokeInvitation,
    signOut,

    // Settings actions
    updateOffice,
    updateOfficeSettings,
    fetchOfficeSettings,
    updateProfileRole,
    createTag,
    updateTag,
    deleteTag,
    emailIntegration,
    fetchEmailIntegration,
    deleteEmailIntegration,

    // Bulk response processing
    processBulkResponse,

    // Notes actions
    fetchNotes,
    createNote,
    createNoteReply,

    // Tag assignment actions
    getTagsForEntity,
    addTagToEntity,
    removeTagFromEntity,

    // Session security
    sessionSecurity: {
      riskScore: sessionSecurity.riskScore,
      anomalies: sessionSecurity.anomalies,
      actionRequired: sessionSecurity.actionRequired,
      isLoading: sessionSecurity.isLoading,
      error: sessionSecurity.error,
      trustCurrentContext: sessionSecurity.trustCurrentContext,
      dismissAnomaly: sessionSecurity.dismissAnomaly,
    },
  };
}
