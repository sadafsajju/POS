import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Save, RotateCcw, Loader2, AlertCircle } from 'lucide-react'

interface SettingsPageLayoutProps {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
  hasChanges: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  onReset: () => void
}

export function SettingsPageLayout({
  title,
  description,
  icon,
  children,
  hasChanges,
  saving,
  error,
  onSave,
  onReset,
}: SettingsPageLayoutProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Fixed Header Strip ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">{title}</h2>
            <p className="text-sm text-zinc-500">{description}</p>
          </div>
        </div>

        {/* Inline alerts */}
        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
        {hasChanges && !error && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-amber-400 text-sm">You have unsaved changes</span>
          </div>
        )}
      </header>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {children}
      </div>

      {/* ── Fixed Footer ───────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 flex items-center gap-3 px-6 py-3.5 bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={onReset}
          disabled={!hasChanges || saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold tracking-wide transition-colors',
            'bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </footer>
    </div>
  )
}
