import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDummyData } from '@/lib/useDummyData';
import { Header } from '@/components/Header';
import { SidebarNav } from '@/components/SidebarNav';
import Dashboard from '@/pages/Dashboard';
import SettingsPage from '@/pages/SettingsPage';
import LettersPage from '@/pages/office/LettersPage';
import ThirdPartiesPage from '@/pages/office/ThirdPartiesPage';
import ConstituentsPage from '@/pages/office/ConstituentsPage';
import TriagePage from '@/pages/casework/TriagePage';
import CasesPage from '@/pages/casework/CasesPage';
import CaseDetailPage from '@/pages/casework/CaseDetailPage';
import NewCasePage from '@/pages/casework/NewCasePage';
import InboundRulesPage from '@/pages/casework/InboundRulesPage';
import ReportingPage from '@/pages/casework/ReportingPage';

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
            <Route path="/office/letters" element={<LettersPage />} />
            <Route path="/office/third-parties" element={<ThirdPartiesPage />} />
            <Route path="/office/constituents" element={<ConstituentsPage />} />
            <Route path="/casework/triage" element={<TriagePage />} />
            <Route path="/casework/cases" element={<CasesPage />} />
            <Route path="/casework/cases/:caseId" element={<CaseDetailPage />} />
            <Route path="/casework/new-case" element={<NewCasePage />} />
            <Route path="/casework/inbound-rules" element={<InboundRulesPage />} />
            <Route path="/casework/reporting" element={<ReportingPage />} />
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
