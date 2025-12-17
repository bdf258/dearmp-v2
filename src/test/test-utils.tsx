import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseProvider } from '@/lib/SupabaseContext'

// Wrapper that provides all necessary providers for tests
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <SupabaseProvider>
        {children}
      </SupabaseProvider>
    </BrowserRouter>
  )
}

// Custom render that wraps components with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllProviders, ...options })

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
