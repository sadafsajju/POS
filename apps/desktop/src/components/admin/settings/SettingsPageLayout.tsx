import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-full',
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
  maxWidth = '2xl',
}: SettingsPageLayoutProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className={`p-6 mx-auto ${maxWidthClasses[maxWidth]}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <span className="text-destructive text-sm">{error}</span>
          </div>
        )}

        {/* Unsaved changes warning */}
        {hasChanges && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <span className="text-yellow-600 text-sm">You have unsaved changes</span>
          </div>
        )}

        {/* Content */}
        <div className="space-y-6">
          {children}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
