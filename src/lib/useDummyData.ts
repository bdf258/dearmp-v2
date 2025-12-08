import { useState, useEffect } from 'react';
import dummyDataRaw from '@/data/dummyData.json';

export interface Office {
  id: string;
  name: string;
  mode: 'casework' | 'westminster';
  tags: string[];
}

export interface User {
  id: string;
  office_id: string;
  name: string;
  role: 'admin' | 'staff';
  email: string;
}

export interface Constituent {
  id: string;
  office_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Case {
  id: string;
  office_id: string;
  constituent_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  office_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Message {
  id: string;
  office_id: string;
  from_email: string;
  from_name: string;
  subject: string;
  body: string;
  is_triage_needed: boolean;
  is_policy_email: boolean;
  case_id: string | null;
  campaign_id: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  office_id: string;
  name: string;
  color: string;
}

export interface DummyData {
  offices: Office[];
  users: User[];
  constituents: Constituent[];
  cases: Case[];
  campaigns: Campaign[];
  messages: Message[];
  tags: Tag[];
  currentUser: {
    id: string;
    office_id: string;
  };
}

export function useDummyData() {
  const [data] = useState<DummyData>(dummyDataRaw as DummyData);
  const [currentOfficeMode, setCurrentOfficeMode] = useState<'casework' | 'westminster'>('casework');

  // Get current user from data
  const currentUser = data.users.find(u => u.id === data.currentUser.id);

  // Get current office
  const currentOffice = data.offices.find(o => o.id === data.currentUser.office_id);

  // Set initial office mode based on current office
  useEffect(() => {
    if (currentOffice) {
      setCurrentOfficeMode(currentOffice.mode);
    }
  }, [currentOffice]);

  // Helper function to filter data by office
  const filterByOffice = <T extends { office_id: string }>(items: T[]): T[] => {
    return items.filter(item => item.office_id === data.currentUser.office_id);
  };

  return {
    // Raw data
    offices: data.offices,
    users: filterByOffice(data.users),
    constituents: filterByOffice(data.constituents),
    cases: filterByOffice(data.cases),
    campaigns: filterByOffice(data.campaigns),
    messages: filterByOffice(data.messages),
    tags: filterByOffice(data.tags),

    // Current user/office info
    currentUser,
    currentOffice,
    currentOfficeMode,
    setCurrentOfficeMode,

    // Helper to get my office ID (simulating get_my_office_id())
    getMyOfficeId: () => data.currentUser.office_id,

    // Helper to get current user ID (simulating auth.uid())
    getCurrentUserId: () => data.currentUser.id,
  };
}
