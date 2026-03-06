import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Control, useController } from 'react-hook-form'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import {
  Upload,
  ImagePlus,
  X,
  Loader2,
  Library,
  Check,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { imageUrl } from '@/lib/utils'

interface ImagePickerFieldProps {
  control: Control<any>
  name: string
  label?: string
  description?: string
}

export function ImagePickerField({ control, name, label, description }: ImagePickerFieldProps) {
  const { field } = useController({ control, name })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const queryClient = useQueryClient()

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await adminApi.uploadMedia(formData)
      if (res.success && res.data) {
        field.onChange(res.data.file_url)
        queryClient.invalidateQueries({ queryKey: queryKeys.media.all })
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [field, queryClient])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset so re-selecting same file still triggers
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const currentUrl = field.value as string | undefined

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-zinc-300">{label}</label>
      )}

      {/* Preview / empty state */}
      {currentUrl ? (
        <div className="relative group w-full rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
          <img
            src={imageUrl(currentUrl)}
            alt="Product"
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Replace image"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLibrary(true)}
              className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Choose from library"
            >
              <Library className="w-4 h-4" />
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
        <div
          className="w-full h-40 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const file = e.dataTransfer.files?.[0]
            if (file) handleUpload(file)
          }}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-zinc-500" />
              <span className="text-xs text-zinc-500">Click or drag to upload</span>
            </>
          )}
        </div>
      )}

      {/* Action buttons when no image */}
      {!currentUrl && !uploading && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <button
            type="button"
            onClick={() => setShowLibrary(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
          >
            <Library className="w-3.5 h-3.5" /> Library
          </button>
        </div>
      )}

      {uploading && currentUrl && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {description && (
        <p className="text-xs text-zinc-500">{description}</p>
      )}

      {/* Media Library Dialog */}
      <MediaLibraryDialog
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={(url) => {
          field.onChange(url)
          setShowLibrary(false)
        }}
        currentUrl={currentUrl}
      />
    </div>
  )
}

interface MediaLibraryDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  currentUrl?: string
}

function MediaLibraryDialog({ open, onClose, onSelect, currentUrl }: MediaLibraryDialogProps) {
  const { data: mediaRes, isLoading } = useQuery({
    queryKey: queryKeys.media.admin,
    queryFn: () => adminApi.getMedia(),
    staleTime: staleTime.media,
    enabled: open,
  })

  const media = Array.isArray(mediaRes?.data) ? mediaRes.data : []

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-zinc-200">Media Library</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12">
              <ImagePlus className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">No images uploaded yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Upload images from the product form or the Media settings page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {media.map((item: any) => {
                const selected = currentUrl === item.file_url
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.file_url)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selected
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <img
                      src={imageUrl(item.file_url)}
                      alt={item.original_name || item.filename}
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="p-1.5 rounded-full bg-blue-500">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
