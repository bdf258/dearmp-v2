import { createContext, useContext, useState, ReactNode } from 'react';

interface TriageProgress {
  current: number;
  total: number;
}

interface TriageNavigation {
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onBack: () => void;
}

interface TriageProgressContextValue {
  progress: TriageProgress | null;
  setProgress: (progress: TriageProgress | null) => void;
  navigation: TriageNavigation | null;
  setNavigation: (navigation: TriageNavigation | null) => void;
}

const TriageProgressContext = createContext<TriageProgressContextValue | undefined>(undefined);

export function TriageProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TriageProgress | null>(null);
  const [navigation, setNavigation] = useState<TriageNavigation | null>(null);

  return (
    <TriageProgressContext.Provider value={{ progress, setProgress, navigation, setNavigation }}>
      {children}
    </TriageProgressContext.Provider>
  );
}

export function useTriageProgress() {
  const context = useContext(TriageProgressContext);
  if (context === undefined) {
    throw new Error('useTriageProgress must be used within a TriageProgressProvider');
  }
  return context;
}
