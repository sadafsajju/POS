import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/landing')({
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    sessionStorage.removeItem('pos-logging-out')
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 text-zinc-100">
            Your restaurant,
            <br />
            <span className="text-zinc-400">always running.</span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            A fast, offline-first POS system built for restaurants that can't afford downtime. Take orders, manage your kitchen, and track sales — with or without internet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/sign-up">
              <Button
                size="lg"
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-8 h-12 text-base rounded-xl"
              >
                Sign Up
              </Button>
            </Link>

            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 font-semibold px-8 h-12 text-base rounded-xl"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
