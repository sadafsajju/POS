// Aggregator platform catalogue — single source of truth.
// Adding a new aggregator means adding an entry here, extending the
// CHECK constraint and TS unions, and (eventually) a webhook handler.
// UI components map over PLATFORMS; never hardcode platform-specific UI.

export type PlatformCode =
  | 'swiggy'
  | 'zomato'
  | 'deliveroo'
  | 'uber_eats'
  | 'just_eat'

export type PlatformRegion = 'IN' | 'UK' | 'global'

export interface PlatformDescriptor {
  code: PlatformCode
  label: string
  region: PlatformRegion
  brandColor: string         // accent for badges/borders (Tailwind class fragment)
  badgeClass: string         // self-contained Tailwind classes for inline badges
  buttonClass: string        // brand-coloured button class
  /** Shown in cards as the human-friendly description */
  description: string
}

export const PLATFORMS: PlatformDescriptor[] = [
  {
    code: 'swiggy',
    label: 'Swiggy',
    region: 'IN',
    brandColor: 'orange',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    buttonClass: 'bg-orange-500 text-white hover:bg-orange-600',
    description: 'Indian food delivery aggregator',
  },
  {
    code: 'zomato',
    label: 'Zomato',
    region: 'IN',
    brandColor: 'red',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    buttonClass: 'bg-red-500 text-white hover:bg-red-600',
    description: 'Indian food delivery aggregator',
  },
  {
    code: 'deliveroo',
    label: 'Deliveroo',
    region: 'UK',
    brandColor: 'teal',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    buttonClass: 'bg-teal-500 text-white hover:bg-teal-600',
    description: 'UK food delivery aggregator',
  },
  {
    code: 'uber_eats',
    label: 'Uber Eats',
    region: 'UK',
    brandColor: 'emerald',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
    description: 'Global food delivery aggregator',
  },
  {
    code: 'just_eat',
    label: 'Just Eat',
    region: 'UK',
    brandColor: 'rose',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    buttonClass: 'bg-rose-500 text-white hover:bg-rose-600',
    description: 'UK food delivery aggregator',
  },
]

const PLATFORM_BY_CODE = new Map<string, PlatformDescriptor>(
  PLATFORMS.map(p => [p.code, p])
)

export function getPlatform(code: string | null | undefined): PlatformDescriptor | undefined {
  if (!code) return undefined
  return PLATFORM_BY_CODE.get(code)
}

export function getPlatformLabel(code: string | null | undefined): string {
  return getPlatform(code)?.label ?? (code ?? 'Unknown')
}

export function getPlatformBadgeClass(code: string | null | undefined): string {
  return getPlatform(code)?.badgeClass ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600'
}
