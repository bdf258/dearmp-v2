/**
 * Unified Prototype Data
 *
 * Shared data for TriagePrototype5 and DashboardPrototype.
 * Contains ~10 triage cases and ~20 campaign emails.
 */

// ============= TYPES =============

export interface Constituent {
  id: string;
  name: string;
  email: string;
  address?: string;
}

export interface Case {
  id: string;
  ref: string;
  title: string;
  constituentId?: string;
}

export interface CaseTag {
  id: string;
  name: string;
  color: string;
  borderColor: string;
}

export interface Caseworker {
  id: string;
  name: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export interface Email {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  addressFound?: string;
}

export interface ThreadEmail {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  snippet: string;
  body: string;
  sentAt: string;
  fromName: string;
}

export interface TriageCase {
  email: Email;
  threadEmails: ThreadEmail[];
  suggestedConstituentId: string | null;
  suggestedCaseId: string | null;
  suggestedTagIds: string[];
  suggestedAssigneeId: string;
  suggestedPriority: 'L' | 'M' | 'H';
}

// Dashboard-specific types
export interface CampaignEmail {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  constituentStatus: 'known' | 'has_address' | 'no_address';
  constituentName?: string;
  constituentId?: string;
  addressFromEmail?: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface DashboardCampaign {
  id: string;
  name: string;
  emails: CampaignEmail[];
}

// Response email types for dashboard
export type ConstituentPillStatus = 'approved' | 'determined' | 'uncertain_with_address' | 'uncertain_no_address';
export type CasePillStatus = 'approved' | 'determined' | 'uncertain';
export type CaseworkerPillStatus = 'approved' | 'determined' | 'uncertain';

export interface ResponseEmail {
  id: string;
  triageCaseIndex: number; // Index into triageCases array for navigation
  subject: string;
  preview: string;
  fromEmail: string;
  receivedAt: string;
  isSelected: boolean;
  constituent: {
    status: ConstituentPillStatus;
    name?: string;
    id?: string;
  };
  case: {
    status: CasePillStatus;
    caseNumber?: string;
    caseId?: string;
  };
  caseworker: {
    status: CaseworkerPillStatus;
    name?: string;
    id?: string;
  };
}

// ============= MOCK DATA =============

export const constituents: Constituent[] = [
  { id: 'con-1', name: 'Maria Santos', email: 'maria.santos@gmail.com', address: '45 Park Lane, Westminster' },
  { id: 'con-2', name: 'John Smith', email: 'john.smith@email.com', address: '12 High Street' },
  { id: 'con-3', name: 'Sarah Williams', email: 'sarah.w@outlook.com' },
  { id: 'con-4', name: 'David Brown', email: 'david.brown@gmail.com', address: '78 Oak Road' },
  { id: 'con-5', name: 'Emma Wilson', email: 'emma.wilson@yahoo.com' },
  { id: 'con-6', name: 'James Okonkwo', email: 'james.okonkwo@outlook.com', address: '23 Victoria Road' },
  { id: 'con-7', name: 'Helen Baker', email: 'helen.baker@gmail.com', address: '56 Church Lane' },
  { id: 'con-8', name: 'Robert Chen', email: 'robert.chen@gmail.com', address: '99 Queens Road' },
];

export const cases: Case[] = [
  { id: 'case-1', ref: 'CW-2024-0123', title: 'Housing Association Dispute', constituentId: 'con-1' },
  { id: 'case-2', ref: 'CW-2024-0098', title: 'Council Tax Dispute', constituentId: 'con-2' },
  { id: 'case-3', ref: 'CW-2024-0087', title: 'Planning Application Query', constituentId: 'con-1' },
  { id: 'case-4', ref: 'CW-2023-0456', title: 'Benefits Query - PIP', constituentId: 'con-4' },
  { id: 'case-5', ref: 'CW-2024-0134', title: 'Parking Permit Issue' },
  { id: 'case-6', ref: 'CW-2024-0156', title: 'Immigration Visa Delay', constituentId: 'con-6' },
  { id: 'case-7', ref: 'CW-2024-0178', title: 'NHS Waiting List', constituentId: 'con-7' },
  { id: 'case-8', ref: 'CW-2024-0189', title: 'School Admissions Appeal', constituentId: 'con-8' },
];

export const tags: CaseTag[] = [
  { id: 'tag-1', name: 'Urgent', color: 'bg-red-100 text-red-700', borderColor: 'border-red-700' },
  { id: 'tag-2', name: 'Housing', color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-700' },
  { id: 'tag-3', name: 'Benefits', color: 'bg-green-100 text-green-700', borderColor: 'border-green-700' },
  { id: 'tag-4', name: 'Follow-up Required', color: 'bg-yellow-100 text-yellow-700', borderColor: 'border-yellow-700' },
  { id: 'tag-5', name: 'Immigration', color: 'bg-purple-100 text-purple-700', borderColor: 'border-purple-700' },
  { id: 'tag-6', name: 'Council Tax', color: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-700' },
  { id: 'tag-7', name: 'Planning', color: 'bg-teal-100 text-teal-700', borderColor: 'border-teal-700' },
  { id: 'tag-8', name: 'NHS', color: 'bg-pink-100 text-pink-700', borderColor: 'border-pink-700' },
];

export const caseworkers: Caseworker[] = [
  { id: 'cw-1', name: 'Mark' },
  { id: 'cw-2', name: 'Sarah' },
  { id: 'cw-3', name: 'Senior Caseworker' },
  { id: 'cw-4', name: 'Office Manager' },
];

export const campaigns: Campaign[] = [
  { id: 'camp-1', title: 'Housing Crisis Response', description: 'Coordinated response to housing issues in the constituency', tags: ['Housing', 'Urgent'] },
  { id: 'camp-2', title: 'Benefits Support Drive', description: 'Helping constituents with PIP and Universal Credit applications', tags: ['Benefits'] },
  { id: 'camp-3', title: 'Local Planning Objections', description: 'Coordinating response to major planning applications', tags: ['Planning'] },
  { id: 'camp-4', title: 'NHS Waiting Times', description: 'Campaign addressing NHS delays and waiting lists', tags: ['NHS', 'Health'] },
];

// Mock: original tags for existing cases (simulating what was saved)
export const originalCaseTags: Record<string, string[]> = {
  'case-1': ['tag-1', 'tag-2'],
  'case-2': ['tag-6'],
  'case-3': ['tag-7'],
  'case-4': ['tag-3'],
  'case-5': [],
  'case-6': ['tag-5'],
  'case-7': ['tag-8'],
  'case-8': ['tag-7'],
};

// ============= TRIAGE CASES (10 cases) =============
// Cases 0-5: Have constituent AND case assigned -> "Responses"
// Cases 6-9: Have "new case" OR no constituent -> "New Cases"

export const triageCases: TriageCase[] = [
  // === RESPONSES (confirmed constituent + assigned case) ===

  // Case 0: Maria Santos - Housing/Eviction (Response)
  {
    email: {
      id: 'email-1',
      subject: 'URGENT - Eviction notice received',
      body: `Dear MP,

I am writing to you in desperation as I have just received an eviction notice from my housing association.

I have been a tenant at this property for over 8 years and have always paid my rent on time. However, due to recent changes in my circumstances (I was made redundant from my job in March), I fell behind on a few payments.

I have since found new employment and have been making regular payments to catch up on arrears, but the housing association is still proceeding with eviction proceedings.

I am terrified of losing my home. I have two young children who are settled in local schools and this would be devastating for our family.

Please, I am begging you to help me. Is there anything you can do to intervene or advise me on my options?

I can be reached at this email address or by phone on 07700 900123.

Thank you for any help you can provide.

Yours sincerely,
Maria Santos`,
      fromEmail: 'maria.santos@gmail.com',
      fromName: 'Maria Santos',
      receivedAt: '2024-01-15T09:30:00Z',
      addressFound: '45 Park Lane, Westminster',
    },
    threadEmails: [
      {
        id: 'thread-1-1',
        direction: 'outbound',
        subject: 'Re: URGENT - Eviction notice received',
        snippet: 'Thank you for contacting my office. I have asked my caseworker to look into this matter urgently...',
        body: `Dear Ms Santos,

Thank you for contacting my office. I have asked my caseworker to look into this matter urgently.

I understand how distressing this situation must be for you and your family.

Kind regards,
[MP Name]`,
        sentAt: '2024-01-14T14:22:00Z',
        fromName: 'Office of [MP Name]',
      },
    ],
    suggestedConstituentId: 'con-1',
    suggestedCaseId: 'case-1',
    suggestedTagIds: ['tag-1', 'tag-2'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'H',
  },

  // Case 1: John Smith - Council Tax (Response)
  {
    email: {
      id: 'email-2',
      subject: 'Council Tax Bill Query',
      body: `Dear MP,

I am writing regarding my council tax bill which I believe contains errors. I have been charged for a Band D property but my house was reassessed last year and should be Band C.

I have contacted the council multiple times but they keep sending me the same incorrect bill. I am worried about penalties if I don't pay, but I don't want to overpay either.

Could you please help me resolve this matter with the council?

Best regards,
John Smith
12 High Street`,
      fromEmail: 'john.smith@email.com',
      fromName: 'John Smith',
      receivedAt: '2024-01-15T10:15:00Z',
      addressFound: '12 High Street',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-2',
    suggestedCaseId: 'case-2',
    suggestedTagIds: ['tag-6'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'M',
  },

  // Case 2: David Brown - Benefits/PIP (Response)
  {
    email: {
      id: 'email-4',
      subject: 'PIP Assessment Appeal Help',
      body: `Dear MP,

I am writing to ask for your help with my PIP appeal. I was recently reassessed and my award was reduced from enhanced to standard rate for daily living, despite my condition worsening.

I have fibromyalgia and chronic fatigue syndrome which severely impacts my daily life. The assessor spent only 20 minutes with me and seemed to ignore what I told them.

I have submitted a mandatory reconsideration but I am scared about managing if my benefits are cut.

Please could you advise on what I can do?

Thank you,
David Brown
78 Oak Road`,
      fromEmail: 'david.brown@gmail.com',
      fromName: 'David Brown',
      receivedAt: '2024-01-15T11:45:00Z',
      addressFound: '78 Oak Road',
    },
    threadEmails: [
      {
        id: 'thread-4-1',
        direction: 'inbound',
        subject: 'Benefits concern',
        snippet: 'I wanted to let you know about my upcoming PIP assessment...',
        body: `Dear MP,

I wanted to let you know about my upcoming PIP assessment. I am very anxious about it.

Thank you,
David Brown`,
        sentAt: '2024-01-10T09:00:00Z',
        fromName: 'David Brown',
      },
    ],
    suggestedConstituentId: 'con-4',
    suggestedCaseId: 'case-4',
    suggestedTagIds: ['tag-3', 'tag-4'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'M',
  },

  // Case 3: James Okonkwo - Immigration (Response)
  {
    email: {
      id: 'email-6',
      subject: 'Re: Spouse Visa Update',
      body: `Dear MP,

Thank you for your previous assistance with my spouse visa application. I am writing to inform you that we have received a request for additional documents.

The Home Office has asked for updated financial evidence from the past 6 months. We are gathering these documents now.

Could you please advise if there is anything else we should include to strengthen the application?

Best regards,
James Okonkwo
23 Victoria Road`,
      fromEmail: 'james.okonkwo@outlook.com',
      fromName: 'James Okonkwo',
      receivedAt: '2024-01-15T11:15:00Z',
      addressFound: '23 Victoria Road',
    },
    threadEmails: [
      {
        id: 'thread-6-1',
        direction: 'outbound',
        subject: 'Re: Spouse Visa Application',
        snippet: 'I have written to the Home Office on your behalf...',
        body: `Dear Mr Okonkwo,

I have written to the Home Office on your behalf requesting an update on your spouse visa application.

Kind regards,
[MP Name]`,
        sentAt: '2024-01-05T10:00:00Z',
        fromName: 'Office of [MP Name]',
      },
    ],
    suggestedConstituentId: 'con-6',
    suggestedCaseId: 'case-6',
    suggestedTagIds: ['tag-5', 'tag-4'],
    suggestedAssigneeId: 'cw-3',
    suggestedPriority: 'M',
  },

  // Case 4: Helen Baker - NHS (Response)
  {
    email: {
      id: 'email-7',
      subject: 'NHS Waiting List - 18 Month Wait',
      body: `Dear MP,

I am writing to follow up on my previous correspondence about my hip replacement surgery.

I have now been on the waiting list for 18 months and my mobility is deteriorating rapidly. I can barely walk to the shops anymore and am becoming increasingly isolated.

Is there any update from the NHS Trust? I am desperate for some good news.

Thank you for your continued support.

Helen Baker
56 Church Lane`,
      fromEmail: 'helen.baker@gmail.com',
      fromName: 'Helen Baker',
      receivedAt: '2024-01-15T12:00:00Z',
      addressFound: '56 Church Lane',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-7',
    suggestedCaseId: 'case-7',
    suggestedTagIds: ['tag-8', 'tag-1'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'H',
  },

  // Case 5: Robert Chen - School Admissions (Response)
  {
    email: {
      id: 'email-8',
      subject: 'School Admissions Appeal Update',
      body: `Dear MP,

Thank you for your letter of support for our school admissions appeal.

I wanted to let you know that the appeal hearing has been scheduled for next month. We have gathered all the evidence you suggested, including medical reports and statements from teachers.

Is there anything else you would recommend we prepare?

Best regards,
Robert Chen
99 Queens Road`,
      fromEmail: 'robert.chen@gmail.com',
      fromName: 'Robert Chen',
      receivedAt: '2024-01-15T13:00:00Z',
      addressFound: '99 Queens Road',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-8',
    suggestedCaseId: 'case-8',
    suggestedTagIds: ['tag-4'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'M',
  },

  // === NEW CASES (no constituent OR new case) ===

  // Case 6: New constituent - Immigration (no constituent, so New Case)
  {
    email: {
      id: 'email-3',
      subject: 'Spouse Visa Application Delay',
      body: `Dear MP,

My name is Amara Okonkwo and I am writing to seek your assistance with my spouse visa application.

I applied for a spouse visa to join my husband in the UK over 14 months ago. We have a 2-year-old British citizen daughter who has never met her father in person.

The Home Office website shows "awaiting decision" but we have heard nothing despite multiple enquiries. The separation is causing immense distress to our family.

I would be extremely grateful if you could make enquiries on our behalf.

Yours faithfully,
Amara Okonkwo
Currently residing in Lagos, Nigeria`,
      fromEmail: 'amara.okonkwo@gmail.com',
      fromName: 'Amara Okonkwo',
      receivedAt: '2024-01-15T11:00:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: null,
    suggestedCaseId: null,
    suggestedTagIds: ['tag-5', 'tag-1'],
    suggestedAssigneeId: 'cw-3',
    suggestedPriority: 'H',
  },

  // Case 7: Emma Wilson - Planning (has constituent but new case)
  {
    email: {
      id: 'email-5',
      subject: 'Objection to Planning Application 2024/0892',
      body: `Dear MP,

I am writing to express my strong objection to planning application 2024/0892 for a 5-storey apartment block on Green Lane.

This development would:
- Overlook my garden and remove all privacy
- Block natural light to my property
- Increase traffic on an already congested road
- Destroy the character of our neighbourhood

The council planning committee is meeting next week. Could you please intervene?

I have lived here for 30 years and this would ruin our quality of life.

Regards,
Emma Wilson`,
      fromEmail: 'emma.wilson@yahoo.com',
      fromName: 'Emma Wilson',
      receivedAt: '2024-01-15T14:20:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-5',
    suggestedCaseId: null, // New case
    suggestedTagIds: ['tag-7'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'M',
  },

  // Case 8: Unknown sender - no constituent or address (New Case)
  {
    email: {
      id: 'email-9',
      subject: 'Question about local planning decision',
      body: `Hello,

I saw in the local paper that there is a new development planned for the old factory site. I have concerns about the traffic impact this will have.

Can you tell me more about what is being proposed and whether there will be a public consultation?

Thank you`,
      fromEmail: 'unknown.sender@proton.me',
      fromName: 'Unknown Sender',
      receivedAt: '2024-01-15T09:45:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: null,
    suggestedCaseId: null,
    suggestedTagIds: ['tag-7'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'L',
  },

  // Case 9: No address constituent (New Case)
  {
    email: {
      id: 'email-10',
      subject: 'Help needed with council issue',
      body: `I need assistance with my council tax bill which seems incorrect.

I have been charged for months when I wasn't even living at the property. The council won't listen to me and I don't know what to do.

Can you help?

Thanks`,
      fromEmail: 'no.address@email.com',
      fromName: 'Anonymous Constituent',
      receivedAt: '2024-01-15T08:30:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: null,
    suggestedCaseId: null,
    suggestedTagIds: ['tag-6'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'L',
  },
];

// ============= DASHBOARD CAMPAIGN EMAILS (20+ emails) =============

export const dashboardCampaigns: DashboardCampaign[] = [
  {
    id: '1',
    name: 'Save our local Library',
    emails: [
      {
        id: 'camp-email-1',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I am deeply concerned about the proposed closure of our local library. As a parent of two young children, the library has been invaluable for their education and love of reading. I urge you to oppose these cuts and fight to keep our library open.',
        fromEmail: 'john.smith@gmail.com',
        fromName: 'John Smith',
        receivedAt: '2024-01-15T09:30:00Z',
        constituentStatus: 'known',
        constituentName: 'John Smith',
        constituentId: 'con-2',
        status: 'pending',
      },
      {
        id: 'camp-email-2',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, As a lifelong user of the library, I cannot stress enough how important it is to our community. Please do everything in your power to prevent its closure.',
        fromEmail: 'mary.jones@yahoo.com',
        fromName: 'Mary Jones',
        receivedAt: '2024-01-15T09:45:00Z',
        constituentStatus: 'known',
        constituentName: 'Mary Jones',
        constituentId: 'con-3',
        status: 'pending',
      },
      {
        id: 'camp-email-3',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I use the library every week and it would be devastating if it closed. Please support our community.',
        fromEmail: 'robert.brown@hotmail.com',
        fromName: 'Robert Brown',
        receivedAt: '2024-01-15T10:00:00Z',
        constituentStatus: 'known',
        constituentName: 'Robert Brown',
        constituentId: 'con-4',
        status: 'pending',
      },
      {
        id: 'camp-email-4',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I am writing to express my concern about the library closure. I live at 45 Oak Street, Westbury and rely on the library for my studies.',
        fromEmail: 'sarah.williams@gmail.com',
        fromName: 'Sarah Williams',
        receivedAt: '2024-01-15T10:15:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '45 Oak Street, Westbury',
        status: 'pending',
      },
      {
        id: 'camp-email-5',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, As a resident of 12 High Street, I want to add my voice to those calling for the library to remain open.',
        fromEmail: 'tom.wilson@outlook.com',
        fromName: 'Tom Wilson',
        receivedAt: '2024-01-15T10:30:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '12 High Street',
        status: 'pending',
      },
      {
        id: 'camp-email-6',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, Please save our library! It means so much to the community.',
        fromEmail: 'emma.davis@gmail.com',
        fromName: 'Emma Davis',
        receivedAt: '2024-01-15T10:45:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-7',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, The library closure would be a tragedy. Please stand with us to keep it open.',
        fromEmail: 'james.taylor@yahoo.com',
        fromName: 'James Taylor',
        receivedAt: '2024-01-15T11:00:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
    ],
  },
  {
    id: '2',
    name: 'Protect Green Belt',
    emails: [
      {
        id: 'camp-email-8',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, I am writing to urge you to oppose the proposed housing development on protected green belt land.',
        fromEmail: 'emma.wilson@gmail.com',
        fromName: 'Emma Wilson',
        receivedAt: '2024-01-15T10:15:00Z',
        constituentStatus: 'known',
        constituentName: 'Emma Wilson',
        constituentId: 'con-5',
        status: 'pending',
      },
      {
        id: 'camp-email-9',
        subject: 'Stop Green Belt Development',
        body: 'Dear MP, The proposed development on our green belt is unacceptable. We moved here for the countryside.',
        fromEmail: 'david.clark@btinternet.com',
        fromName: 'David Clark',
        receivedAt: '2024-01-15T10:30:00Z',
        constituentStatus: 'known',
        constituentName: 'David Clark',
        constituentId: 'con-6',
        status: 'pending',
      },
      {
        id: 'camp-email-10',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Writing from 78 Meadow Lane to oppose the green belt development.',
        fromEmail: 'peter.hall@gmail.com',
        fromName: 'Peter Hall',
        receivedAt: '2024-01-15T11:00:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '78 Meadow Lane',
        status: 'pending',
      },
      {
        id: 'camp-email-11',
        subject: 'Stop the Green Belt Development',
        body: 'Dear MP, Please protect our green belt from developers.',
        fromEmail: 'lucy.white@hotmail.com',
        fromName: 'Lucy White',
        receivedAt: '2024-01-15T11:15:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-12',
        subject: 'Green Belt Must Be Protected',
        body: 'Dear MP, I strongly oppose any development on our green belt.',
        fromEmail: 'mark.green@gmail.com',
        fromName: 'Mark Green',
        receivedAt: '2024-01-15T11:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-13',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Green spaces are essential for mental health and wellbeing. Please protect our green belt.',
        fromEmail: 'anna.jones@gmail.com',
        fromName: 'Anna Jones',
        receivedAt: '2024-01-15T11:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '33 Riverside Drive',
        status: 'pending',
      },
    ],
  },
  {
    id: '3',
    name: 'Stop NHS Cuts',
    emails: [
      {
        id: 'camp-email-14',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, I am extremely worried about the proposed cuts to NHS services in our constituency.',
        fromEmail: 'helen.baker@gmail.com',
        fromName: 'Helen Baker',
        receivedAt: '2024-01-15T12:00:00Z',
        constituentStatus: 'known',
        constituentName: 'Helen Baker',
        constituentId: 'con-7',
        status: 'pending',
      },
      {
        id: 'camp-email-15',
        subject: 'Protect Our Local NHS Services',
        body: 'Dear MP, The NHS is our most precious institution. Please do not let these cuts go ahead.',
        fromEmail: 'steven.morris@yahoo.com',
        fromName: 'Steven Morris',
        receivedAt: '2024-01-15T12:15:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '23 Church Road, Northfield',
        status: 'pending',
      },
      {
        id: 'camp-email-16',
        subject: 'Save Our NHS',
        body: 'Dear MP, Please oppose any cuts to NHS funding in our area.',
        fromEmail: 'karen.wright@outlook.com',
        fromName: 'Karen Wright',
        receivedAt: '2024-01-15T12:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-17',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, As a nurse, I see daily how stretched our services are. Please fight against these cuts.',
        fromEmail: 'jane.smith@nhs.net',
        fromName: 'Jane Smith',
        receivedAt: '2024-01-15T12:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '56 Victoria Street',
        status: 'pending',
      },
      {
        id: 'camp-email-18',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, My family depends on local NHS services. Please protect them.',
        fromEmail: 'paul.davies@gmail.com',
        fromName: 'Paul Davies',
        receivedAt: '2024-01-15T13:00:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-19',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, The NHS saved my life. Please do everything you can to protect it.',
        fromEmail: 'margaret.taylor@btinternet.com',
        fromName: 'Margaret Taylor',
        receivedAt: '2024-01-15T13:15:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: 'camp-email-20',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, Healthcare is a right, not a privilege. Please stand up for our NHS.',
        fromEmail: 'george.wilson@yahoo.com',
        fromName: 'George Wilson',
        receivedAt: '2024-01-15T13:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
    ],
  },
];

// ============= RESPONSE EMAILS FOR DASHBOARD =============
// Responses: have confirmed constituent AND assigned case (triageCase indices 0-5)
// New Cases: no constituent OR new case (triageCase indices 6-9)

export const responseEmails: ResponseEmail[] = [
  // Responses (indices 0-5 from triageCases)
  {
    id: 'resp-1',
    triageCaseIndex: 0,
    subject: 'URGENT - Eviction notice received',
    preview: 'Dear MP, I am writing to you because I have just received an eviction notice...',
    fromEmail: 'maria.santos@gmail.com',
    receivedAt: '2024-01-15T09:30:00Z',
    isSelected: false,
    constituent: {
      status: 'approved',
      name: 'Maria Santos',
      id: 'con-1',
    },
    case: {
      status: 'approved',
      caseNumber: 'CW-2024-0123',
      caseId: 'case-1',
    },
    caseworker: {
      status: 'approved',
      name: 'Mark',
      id: 'cw-1',
    },
  },
  {
    id: 'resp-2',
    triageCaseIndex: 1,
    subject: 'Council Tax Bill Query',
    preview: 'Dear MP, I am writing regarding my council tax bill which I believe contains errors...',
    fromEmail: 'john.smith@email.com',
    receivedAt: '2024-01-15T10:15:00Z',
    isSelected: false,
    constituent: {
      status: 'determined',
      name: 'John Smith',
      id: 'con-2',
    },
    case: {
      status: 'determined',
      caseNumber: 'CW-2024-0098',
      caseId: 'case-2',
    },
    caseworker: {
      status: 'determined',
      name: 'Sarah',
      id: 'cw-2',
    },
  },
  {
    id: 'resp-3',
    triageCaseIndex: 2,
    subject: 'PIP Assessment Appeal Help',
    preview: 'Dear MP, I am writing to ask for your help with my PIP appeal...',
    fromEmail: 'david.brown@gmail.com',
    receivedAt: '2024-01-15T11:45:00Z',
    isSelected: false,
    constituent: {
      status: 'approved',
      name: 'David Brown',
      id: 'con-4',
    },
    case: {
      status: 'approved',
      caseNumber: 'CW-2023-0456',
      caseId: 'case-4',
    },
    caseworker: {
      status: 'approved',
      name: 'Sarah',
      id: 'cw-2',
    },
  },
  {
    id: 'resp-4',
    triageCaseIndex: 3,
    subject: 'Re: Spouse Visa Update',
    preview: 'Thank you for your previous assistance with my spouse visa application...',
    fromEmail: 'james.okonkwo@outlook.com',
    receivedAt: '2024-01-15T11:15:00Z',
    isSelected: false,
    constituent: {
      status: 'determined',
      name: 'James Okonkwo',
      id: 'con-6',
    },
    case: {
      status: 'determined',
      caseNumber: 'CW-2024-0156',
      caseId: 'case-6',
    },
    caseworker: {
      status: 'determined',
      name: 'Senior Caseworker',
      id: 'cw-3',
    },
  },
  {
    id: 'resp-5',
    triageCaseIndex: 4,
    subject: 'NHS Waiting List - 18 Month Wait',
    preview: 'Dear MP, I am writing to follow up on my previous correspondence about my hip replacement...',
    fromEmail: 'helen.baker@gmail.com',
    receivedAt: '2024-01-15T12:00:00Z',
    isSelected: false,
    constituent: {
      status: 'approved',
      name: 'Helen Baker',
      id: 'con-7',
    },
    case: {
      status: 'approved',
      caseNumber: 'CW-2024-0178',
      caseId: 'case-7',
    },
    caseworker: {
      status: 'approved',
      name: 'Mark',
      id: 'cw-1',
    },
  },
  {
    id: 'resp-6',
    triageCaseIndex: 5,
    subject: 'School Admissions Appeal Update',
    preview: 'Thank you for your letter of support for our school admissions appeal...',
    fromEmail: 'robert.chen@gmail.com',
    receivedAt: '2024-01-15T13:00:00Z',
    isSelected: false,
    constituent: {
      status: 'determined',
      name: 'Robert Chen',
      id: 'con-8',
    },
    case: {
      status: 'determined',
      caseNumber: 'CW-2024-0189',
      caseId: 'case-8',
    },
    caseworker: {
      status: 'determined',
      name: 'Sarah',
      id: 'cw-2',
    },
  },
];

// New Cases: no constituent OR new case (indices 6-9)
export const newCaseEmails: ResponseEmail[] = [
  {
    id: 'new-1',
    triageCaseIndex: 6,
    subject: 'Spouse Visa Application Delay',
    preview: 'My name is Amara Okonkwo and I am writing to seek your assistance...',
    fromEmail: 'amara.okonkwo@gmail.com',
    receivedAt: '2024-01-15T11:00:00Z',
    isSelected: false,
    constituent: {
      status: 'uncertain_no_address',
    },
    case: {
      status: 'uncertain',
    },
    caseworker: {
      status: 'uncertain',
    },
  },
  {
    id: 'new-2',
    triageCaseIndex: 7,
    subject: 'Objection to Planning Application 2024/0892',
    preview: 'I am writing to express my strong objection to planning application...',
    fromEmail: 'emma.wilson@yahoo.com',
    receivedAt: '2024-01-15T14:20:00Z',
    isSelected: false,
    constituent: {
      status: 'determined',
      name: 'Emma Wilson',
      id: 'con-5',
    },
    case: {
      status: 'uncertain',
      caseNumber: 'New case',
    },
    caseworker: {
      status: 'uncertain',
    },
  },
  {
    id: 'new-3',
    triageCaseIndex: 8,
    subject: 'Question about local planning decision',
    preview: 'I saw in the local paper that there is a new development planned...',
    fromEmail: 'unknown.sender@proton.me',
    receivedAt: '2024-01-15T09:45:00Z',
    isSelected: false,
    constituent: {
      status: 'uncertain_no_address',
    },
    case: {
      status: 'uncertain',
      caseNumber: 'New case',
    },
    caseworker: {
      status: 'uncertain',
    },
  },
  {
    id: 'new-4',
    triageCaseIndex: 9,
    subject: 'Help needed with council issue',
    preview: 'I need assistance with my council tax bill which seems incorrect...',
    fromEmail: 'no.address@email.com',
    receivedAt: '2024-01-15T08:30:00Z',
    isSelected: false,
    constituent: {
      status: 'uncertain_no_address',
    },
    case: {
      status: 'uncertain',
      caseNumber: 'New case',
    },
    caseworker: {
      status: 'uncertain',
    },
  },
];
