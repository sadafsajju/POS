import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import apiClient from '@/api/client';
import { TokenDisplay } from '@/components/token-display/TokenDisplay';

export const Route = createFileRoute('/token-display')({
  component: TokenDisplayPage,
});

function TokenDisplayPage() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('pos-auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        if (parsed.state?.token) {
          setHasAuth(true);
        }
      }
    } catch {
      apiClient.clearAuth();
    }
    setIsLoadingAuth(false);
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading token display...</p>
        </div>
      </div>
    );
  }

  if (!hasAuth) {
    return <Navigate to="/login" replace />;
  }

  return <TokenDisplay />;
}
