import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { AlertTriangle, X } from 'lucide-react'
import type { AllergenCode } from '@/types'

const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  celery: 'Celery',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  gluten: 'Gluten',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  nuts: 'Nuts (tree)',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soya: 'Soya',
  sulphites: 'Sulphites',
}

interface AllergenConfirmDialogProps {
  open: boolean
  // Allergens that genuinely require a fresh confirmation (KOT delta excludes already-confirmed)
  allergens: AllergenCode[]
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AllergenConfirmDialog({
  open,
  allergens,
  isSubmitting,
  onConfirm,
  onCancel,
}: AllergenConfirmDialogProps) {
  if (!open || allergens.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4 bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-black tracking-tight text-zinc-100">
                  Allergen check
                </CardTitle>
                <CardDescription className="text-base text-zinc-400">
                  Required before this order can be sent
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 w-12 p-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-base text-zinc-300">
              This order contains the following allergens:
            </p>
            <div className="flex flex-wrap gap-2 p-4 bg-red-500/5 border border-red-500/30 rounded-lg">
              {allergens.map((code) => (
                <span
                  key={code}
                  className="px-3 py-1.5 rounded-lg border border-red-500/60 bg-red-500/10 text-red-300 text-sm font-medium"
                >
                  {ALLERGEN_LABELS[code] ?? code}
                </span>
              ))}
            </div>
            <p className="text-base text-zinc-300 leading-relaxed">
              Have you confirmed allergen requirements with the customer?
            </p>
            <p className="text-xs text-zinc-500">
              Your confirmation is recorded against this order with your user ID and timestamp.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 text-base bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 text-base bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Yes — confirmed'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
