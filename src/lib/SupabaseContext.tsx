import { createContext, useContext, ReactNode } from 'react';
import { useSupabaseData } from './useSupabaseData';

type SupabaseContextType = ReturnType<typeof useSupabaseData>;

const SupabaseContext = createContext<SupabaseContextType | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const data = useSupabaseData();

  return (
    <SupabaseContext.Provider value={data}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
