import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import './index.css'

// Import shared packages
import { initApiClient } from '@pos/api-client'
import { useAuthStore } from '@pos/core'
import { defaultQueryOptions, staleTime } from '@pos/api-client'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Initialize API client with auth store integration
const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1'
console.log('🔧 Initializing API client with URL:', apiUrl)

initApiClient({
  baseURL: apiUrl,
  timeout: 30000,
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    console.log('🔒 Unauthorized - clearing auth state')
    useAuthStore.getState().logout()
    // Only redirect if not already on login page to prevent loop
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
})

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
