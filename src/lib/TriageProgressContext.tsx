import { createContext, useContext, useState, ReactNode } from 'react';

interface TriageProgress {
  current: number;
  total: number;
}

interface TriageProgressContextValue {
  progress: TriageProgress | null;
  setProgress: (progress: TriageProgress | null) => void;
}

const TriageProgressContext = createContext<TriageProgressContextValue | undefined>(undefined);

export function TriageProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TriageProgress | null>(null);

  return (
    <TriageProgressContext.Provider value={{ progress, setProgress }}>
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
