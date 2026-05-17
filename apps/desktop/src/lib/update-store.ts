// Shared state for the Tauri auto-updater. Two things subscribe:
//   1. `UpdateChecker` — the modal dialog. Sets `update` after the periodic
//      poll finds something, reads `dialogVisible` to decide whether to
//      render itself.
//   2. The header in `RoleBasedLayout` — renders a small "Update" button to
//      the left of Lock whenever `update` is non-null, so the operator can
//      re-open the install dialog after dismissing it.

import { create } from 'zustand'

// Plugin updater types are loaded lazily inside UpdateChecker — keep the
// store type-loose so this file doesn't drag the Tauri plugin into the
// browser bundle.
type UpdateRef = unknown

interface UpdateStore {
  /** The Tauri `Update` ref when a new version is available, else null. */
  update: UpdateRef | null
  /** The semver of the available update, for header label + dedup. */
  version: string | null
  /** Whether the install dialog should render. Independent of `update` so
   *  "Later" hides the dialog without clearing the available-update state. */
  dialogVisible: boolean
  setAvailable: (update: UpdateRef, version: string) => void
  clear: () => void
  showDialog: () => void
  hideDialog: () => void
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  update: null,
  version: null,
  dialogVisible: false,
  setAvailable: (update, version) => set({ update, version }),
  clear: () => set({ update: null, version: null, dialogVisible: false }),
  showDialog: () => set({ dialogVisible: true }),
  hideDialog: () => set({ dialogVisible: false }),
}))

// Dev convenience: expose the store on window so QA can simulate an
// "update available" state without waiting for the periodic poll. No-op in
// production builds (Vite tree-shakes the import.meta.env.DEV branch).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as any).__updateStore = useUpdateStore
}
