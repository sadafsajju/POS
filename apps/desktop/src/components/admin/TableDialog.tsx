import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { TableForm } from '@/components/forms/TableForm'
import type { DiningTable } from '@/types'

interface TableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTable?: DiningTable | null
  onSuccess?: () => void
}

/**
 * Full-screen create/edit dialog for dining tables. Wraps `TableForm` so the
 * same flow can be triggered from the admin tables page or from any empty
 * state in the POS that needs to add a table inline.
 */
export function TableDialog({ open, onOpenChange, editingTable, onSuccess }: TableDialogProps) {
  const handleClose = () => {
    onOpenChange(false)
  }

  const handleSuccess = () => {
    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="dark flex flex-col !max-w-none !w-screen !h-screen !rounded-none p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-900">
          <DialogTitle className="text-zinc-100">
            {editingTable ? 'Edit Table' : 'Create New Table'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            {editingTable
              ? `Editing Table ${editingTable.table_number}`
              : 'Add a new table to your restaurant'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <TableForm
            key={editingTable ? `edit-${editingTable.id}` : 'create'}
            table={editingTable || undefined}
            mode={editingTable ? 'edit' : 'create'}
            onSuccess={handleSuccess}
            onCancel={handleClose}
            hideChrome
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
