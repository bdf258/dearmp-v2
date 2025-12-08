import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDummyData } from '@/lib/useDummyData';
import { Header } from '@/components/Header';
import { SidebarNav } from '@/components/SidebarNav';
import Dashboard from '@/pages/Dashboard';
import SettingsPage from '@/pages/SettingsPage';
import LettersPage from '@/pages/office/LettersPage';
import ThirdPartiesPage from '@/pages/office/ThirdPartiesPage';
import ConstituentsPage from '@/pages/office/ConstituentsPage';
import TriagePage from '@/pages/policy/TriagePage';
import CampaignsPage from '@/pages/policy/CampaignsPage';
import PolicyEmailsPage from '@/pages/policy/PolicyEmailsPage';
import PolicyEmailGroupDetailPage from '@/pages/policy/PolicyEmailGroupDetailPage';
import OfficeStylePage from '@/pages/policy/OfficeStylePage';
import MPApprovalPage from '@/pages/mp/MPApprovalPage';

function RootLayout() {
  const { currentOfficeMode, setCurrentOfficeMode } = useDummyData();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Navigation */}
      <SidebarNav currentMode={currentOfficeMode} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          currentMode={currentOfficeMode}
          onModeChange={setCurrentOfficeMode}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Policy Routes */}
            <Route path="/policy/triage" element={<TriagePage />} />
            <Route path="/policy/campaigns" element={<CampaignsPage />} />
            <Route path="/policy/emails" element={<PolicyEmailsPage />} />
            <Route path="/policy/email-group/:groupId" element={<PolicyEmailGroupDetailPage />} />
            <Route path="/policy/campaign/:campaignId" element={<PolicyEmailGroupDetailPage />} />
            <Route path="/policy/office-style" element={<OfficeStylePage />} />

            {/* Office Routes */}
            <Route path="/office/letters" element={<LettersPage />} />
            <Route path="/office/third-parties" element={<ThirdPartiesPage />} />
            <Route path="/office/constituents" element={<ConstituentsPage />} />
            <Route path="/mp-approval" element={<MPApprovalPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RootLayout />
    </BrowserRouter>
  );
}

export default App;
