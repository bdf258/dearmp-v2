import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SupabaseProvider, useSupabase } from '@/lib/SupabaseContext';
import { TriageProgressProvider } from '@/lib/TriageProgressContext';
import { Header } from '@/components/Header';
import { SidebarNav } from '@/components/SidebarNav';
import { SessionSecurityBanner } from '@/components/SessionSecurityBanner';
import Dashboard from '@/pages/Dashboard';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import TwoFAVerificationPage from '@/pages/TwoFAVerificationPage';
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
import TriagePrototype1 from '@/pages/prototypes/TriagePrototype1';
import TriagePrototype2 from '@/pages/prototypes/TriagePrototype2';
import TriagePrototype3 from '@/pages/prototypes/TriagePrototype3';
import TriagePrototype4 from '@/pages/prototypes/TriagePrototype4';
import TriagePrototype5 from '@/pages/prototypes/TriagePrototype5';
import CasePrototypeTabs from '@/pages/prototypes/case/CasePrototypeTabs';
import CasePrototypeColumns from '@/pages/prototypes/case/CasePrototypeColumns';
import CasePrototypeCards from '@/pages/prototypes/case/CasePrototypeCards';
import DashboardPrototype from '@/pages/prototypes/DashboardPrototype';
import PrototypesPage from '@/pages/PrototypesPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { TriageDashboard, CampaignDashboard, TriageWorkspace } from '@/pages/triage';

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
  const { sessionSecurity, signOut } = useSupabase();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });

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

  const toggleMinimize = () => {
    const newValue = !isSidebarMinimized;
    setIsSidebarMinimized(newValue);
    localStorage.setItem('sidebarMinimized', JSON.stringify(newValue));
  };

  const handleSecurityLogout = async () => {
    // Log out and redirect to login page
    await signOut();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Navigation */}
      <SidebarNav
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        isMinimized={isSidebarMinimized}
        onMinimize={toggleMinimize}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Session Security Banner */}
        {sessionSecurity.actionRequired && (
          <div className="px-6 pt-4">
            <SessionSecurityBanner
              riskScore={sessionSecurity.riskScore}
              anomalies={sessionSecurity.anomalies}
              onTrust={sessionSecurity.trustCurrentContext}
              onLogout={handleSecurityLogout}
              onDismiss={sessionSecurity.dismissAnomaly}
            />
          </div>
        )}

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

            {/* Production Triage Routes */}
            <Route path="/triage" element={<TriageDashboard />} />
            <Route path="/triage/campaigns" element={<CampaignDashboard />} />
            <Route path="/triage/campaigns/:campaignId" element={<CampaignDashboard />} />
            <Route path="/triage/messages/:messageId" element={<TriageWorkspace />} />

            {/* Prototypes Index */}
            <Route path="/prototypes" element={<PrototypesPage />} />

            {/* Triage Prototypes (not linked in navigation) */}
            <Route path="/triage-prototype-1" element={<TriagePrototype1 />} />
            <Route path="/triage-prototype-2" element={<TriagePrototype2 />} />
            <Route path="/triage-prototype-3" element={<TriagePrototype3 />} />
            <Route path="/triage-prototype-4" element={<TriagePrototype4 />} />
            <Route path="/triage-prototype-5" element={<TriagePrototype5 />} />
            {/* Prototype Routes - Not linked in navigation */}
            <Route path="/prototypes/case/tabs" element={<CasePrototypeTabs />} />
            <Route path="/prototypes/case/columns" element={<CasePrototypeColumns />} />
            <Route path="/prototypes/case/cards" element={<CasePrototypeCards />} />
            <Route path="/prototypes/dashboard" element={<DashboardPrototype />} />

            {/* 404 Catch-all Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function RootLayout() {
  const { user, loading, requiresMfa, checkMfaStatus, signOut } = useSupabase();
  const [showSignUp, setShowSignUp] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    if (showSignUp) {
      return <SignUpPage onNavigateToLogin={() => setShowSignUp(false)} />;
    }
    return <LoginPage onNavigateToSignUp={() => setShowSignUp(true)} />;
  }

  // If user has MFA enabled but hasn't verified yet in this session
  if (requiresMfa) {
    return (
      <TwoFAVerificationPage
        onVerified={() => {
          // Re-check MFA status after verification
          checkMfaStatus();
        }}
        onSignOut={() => {
          signOut();
        }}
      />
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <SupabaseProvider>
        <TriageProgressProvider>
          <RootLayout />
        </TriageProgressProvider>
      </SupabaseProvider>
    </BrowserRouter>
  );
}

export default App;
