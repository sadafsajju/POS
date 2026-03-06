import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import './index.css'

// Import shared packages
import { defaultQueryOptions, staleTime } from '@pos/api-client'
import { createSupabaseClient } from '@pos/supabase'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (supabaseUrl && supabaseAnonKey) {
  createSupabaseClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Supabase credentials not set. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

// Create a query client with shared configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: staleTime.products, // Default 5 minutes
      retry: defaultQueryOptions.retry,
      refetchOnWindowFocus: defaultQueryOptions.refetchOnWindowFocus,
      refetchOnReconnect: defaultQueryOptions.refetchOnReconnect,
    },
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  )
}
