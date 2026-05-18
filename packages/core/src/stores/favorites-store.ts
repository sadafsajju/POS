import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesState {
  byOrg: Record<string, string[]>
  toggle: (orgId: string | null | undefined, productId: string) => void
  isFavorite: (orgId: string | null | undefined, productId: string) => boolean
  getFavorites: (orgId: string | null | undefined) => string[]
  clear: (orgId: string | null | undefined) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      byOrg: {},
      toggle: (orgId, productId) => {
        if (!orgId || !productId) return
        set((state) => {
          const current = state.byOrg[orgId] ?? []
          const next = current.includes(productId)
            ? current.filter((id) => id !== productId)
            : [...current, productId]
          return { byOrg: { ...state.byOrg, [orgId]: next } }
        })
      },
      isFavorite: (orgId, productId) => {
        if (!orgId || !productId) return false
        return (get().byOrg[orgId] ?? []).includes(productId)
      },
      getFavorites: (orgId) => {
        if (!orgId) return []
        return get().byOrg[orgId] ?? []
      },
      clear: (orgId) => {
        if (!orgId) return
        set((state) => {
          const next = { ...state.byOrg }
          delete next[orgId]
          return { byOrg: next }
        })
      },
    }),
    { name: 'pos-favorites' }
  )
)
