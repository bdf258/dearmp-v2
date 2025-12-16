import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SupabaseProvider, useSupabase } from '@/lib/SupabaseContext';
import { Header } from '@/components/Header';
import { SidebarNav } from '@/components/SidebarNav';
import Dashboard from '@/pages/Dashboard';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import LettersPage from '@/pages/office/LettersPage';
import ThirdPartiesPage from '@/pages/office/ThirdPartiesPage';
import ConstituentsPage from '@/pages/office/ConstituentsPage';
import BatchTriagePage from '@/pages/BatchTriagePage';
import CasesPage from '@/pages/casework/CasesPage';
import CaseDetailPage from '@/pages/casework/CaseDetailPage';
import NewCasePage from '@/pages/casework/NewCasePage';
import InboundRulesPage from '@/pages/casework/InboundRulesPage';
import ReportingPage from '@/pages/casework/ReportingPage';
import CampaignsPage from '@/pages/policy/CampaignsPage';
import PolicyEmailsPage from '@/pages/policy/PolicyEmailsPage';
import PolicyEmailGroupDetailPage from '@/pages/policy/PolicyEmailGroupDetailPage';
import OfficeStylePage from '@/pages/policy/OfficeStylePage';
import MPApprovalPage from '@/pages/mp/MPApprovalPage';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Check if mobile on initial load and collapse sidebar
  useEffect(() => {
    const checkMobile = () => {
      setIsSidebarCollapsed(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Navigation */}
      <SidebarNav
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Policy Routes */}
            <Route path="/policy/triage" element={<BatchTriagePage />} />
            <Route path="/policy/campaigns" element={<CampaignsPage />} />
            <Route path="/policy/emails" element={<PolicyEmailsPage />} />
            <Route path="/policy/email-group/:groupId" element={<PolicyEmailGroupDetailPage />} />
            <Route path="/policy/campaign/:campaignId" element={<PolicyEmailGroupDetailPage />} />
            <Route path="/policy/office-style" element={<OfficeStylePage />} />

            {/* Office Routes */}
            <Route path="/office/letters" element={<LettersPage />} />
            <Route path="/office/third-parties" element={<ThirdPartiesPage />} />
            <Route path="/office/constituents" element={<ConstituentsPage />} />
            <Route path="/casework/triage" element={<BatchTriagePage />} />
            <Route path="/casework/cases" element={<CasesPage />} />
            <Route path="/casework/cases/:caseId" element={<CaseDetailPage />} />
            <Route path="/casework/new-case" element={<NewCasePage />} />
            <Route path="/casework/inbound-rules" element={<InboundRulesPage />} />
            <Route path="/casework/reporting" element={<ReportingPage />} />
            <Route path="/mp-approval" element={<MPApprovalPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function RootLayout() {
  const { user, loading } = useSupabase();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <SupabaseProvider>
        <RootLayout />
      </SupabaseProvider>
    </BrowserRouter>
  );
}

export default App;
