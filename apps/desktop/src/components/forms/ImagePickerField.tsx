import { useState } from 'react'
import { Control, useController } from 'react-hook-form'
import { ImagePlus, X, FolderOpen } from 'lucide-react'
import { imageUrl } from '@/lib/utils'
import { MediaPickerDialog } from './MediaPickerDialog'

interface ImagePickerFieldProps {
  control: Control<any>
  name: string
  label?: string
  description?: string
}

export function ImagePickerField({ control, name, label, description }: ImagePickerFieldProps) {
  const { field } = useController({ control, name })
  const [pickerOpen, setPickerOpen] = useState(false)

  const currentUrl = field.value as string | undefined

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-zinc-300">{label}</label>
      )}

      {currentUrl ? (
        <div className="relative group w-full rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
          <img
            src={imageUrl(currentUrl)}
            alt="Selected"
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Choose a different image"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => field.onChange('')}
              className="p-2 rounded-lg bg-zinc-800/80 text-red-400 hover:bg-zinc-700 transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full h-40 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
        >
          <ImagePlus className="w-6 h-6 text-zinc-500" />
          <span className="text-xs text-zinc-500">Choose from media library</span>
        </button>
      )}

      {!currentUrl && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" /> Choose from library
        </button>
      )}

      {description && (
        <p className="text-xs text-zinc-500">{description}</p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedUrl={currentUrl}
        onSelect={(url) => field.onChange(url)}
      />
    </div>
  )
}
