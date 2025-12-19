import { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
}

/**
 * Standard page layout wrapper that provides consistent padding.
 * Used for most pages, but not for full-screen layouts like TriageWorkspace
 * and CampaignDashboard which need edge-to-edge content.
 */
export function PageLayout({ children }: PageLayoutProps) {
  return <div className="p-6">{children}</div>;
}
