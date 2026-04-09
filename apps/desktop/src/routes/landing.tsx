import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ArrowRight, Apple, ChevronDown } from 'lucide-react';

export const Route = createFileRoute('/landing')({
  component: LandingPage,
});

function LandingPage() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.removeItem('pos-logging-out')
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <Link to="/setup">
              <Button
                size="lg"
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-8 h-12 text-base rounded-xl"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <div className="relative" ref={dropdownRef}>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 font-semibold px-8 h-12 text-base rounded-xl"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download App
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>

              {showDropdown && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl z-10">
                  <a
                    href="https://github.com/yourpos/releases/latest/download/yourpos.dmg"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-zinc-100"
                  >
                    <Apple className="h-5 w-5" />
                    <div className="text-left">
                      <div className="text-sm font-medium">macOS</div>
                      <div className="text-xs text-zinc-500">.dmg</div>
                    </div>
                  </a>
                  <a
                    href="https://github.com/yourpos/releases/latest/download/yourpos.exe"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-zinc-100 border-t border-zinc-800"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                    </svg>
                    <div className="text-left">
                      <div className="text-sm font-medium">Windows</div>
                      <div className="text-xs text-zinc-500">.exe</div>
                    </div>
                  </a>
                </div>
              )}
            </div>
          </div>

          <p className="mt-8 text-sm text-zinc-600">
            Available for macOS and Windows
          </p>

          <p className="mt-4 text-sm text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
