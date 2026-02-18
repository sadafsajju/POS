import { Building2, MapPin, Phone, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Location } from '@/types'

interface LocationPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locations: Location[]
  currentLocationId?: string
  onSelect: (location: Location) => void
  isLoading?: boolean
  loadingLocationId?: string
  title?: string
  description?: string
}

export function LocationPickerDialog({
  open,
  onOpenChange,
  locations,
  currentLocationId,
  onSelect,
  isLoading = false,
  loadingLocationId,
  title = 'Switch Location',
  description = 'Select the branch you want to work from',
}: LocationPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark sm:max-w-lg p-0 gap-0 bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg text-zinc-100">{title}</DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {locations.map((loc) => {
            const isCurrent = loc.id === currentLocationId
            const isSwitching = isLoading && loadingLocationId === loc.id
            const hasDetails = loc.address || loc.phone

            return (
              <button
                key={loc.id}
                onClick={() => {
                  if (!isCurrent && !isLoading) onSelect(loc)
                }}
                disabled={isCurrent || isLoading}
                className={`
                  w-full text-left rounded-xl border-2 transition-all
                  ${hasDetails ? 'px-5 py-4' : 'px-5 py-5'}
                  ${isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900'
                  }
                  disabled:opacity-60
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isCurrent ? 'bg-emerald-500/15' : 'bg-zinc-800'}
                  `}>
                    <Building2 className={`h-5 w-5 ${isCurrent ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[15px] font-semibold ${isCurrent ? 'text-emerald-300' : 'text-zinc-100'}`}>
                        {loc.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50">
                        {loc.code}
                      </span>
                    </div>

                    {hasDetails && (
                      <div className="flex items-center gap-4 mt-1.5">
                        {loc.address && (
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{loc.address}</span>
                          </span>
                        )}
                        {loc.phone && (
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {loc.phone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 w-6 flex items-center justify-center">
                    {isSwitching ? (
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    ) : isCurrent ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
