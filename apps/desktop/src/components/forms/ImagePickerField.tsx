import { useState, useRef, useCallback } from 'react'
import { Control, useController } from 'react-hook-form'
import {
  Upload,
  ImagePlus,
  X,
  Loader2,
} from 'lucide-react'
import { adminApi } from '@pos/api-client'
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

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await adminApi.uploadMedia(formData)
      if (res.success && res.data) {
        field.onChange(res.data.file_url)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [field])

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

      {/* Action button when no image */}
      {!currentUrl && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
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
    </div>
  )
}

