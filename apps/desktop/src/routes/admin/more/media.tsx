import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import {
  ImagePlus,
  Upload,
  Trash2,
  Loader2,
  FileImage,
  Search,
} from 'lucide-react'

import { imageUrl } from '@/lib/utils'

export const Route = createFileRoute('/admin/more/media')({
  component: MediaSettingsPage,
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function MediaSettingsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: mediaRes, isLoading } = useQuery({
    queryKey: queryKeys.media.admin,
    queryFn: () => adminApi.getMedia(),
    staleTime: staleTime.media,
  })

  const media: any[] = Array.isArray(mediaRes?.data) ? mediaRes.data : []

  const filteredMedia = searchQuery
    ? media.filter(
        (m) =>
          (m.original_name || m.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : media

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.media.all })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteMedia(id),
    onSuccess: () => {
      setDeletingId(null)
      invalidate()
    },
  })

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const formData = new FormData()
      formData.append('file', file)
      try {
        await adminApi.uploadMedia(formData)
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }
    setUploading(false)
    invalidate()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div>
            <FileImage className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Media Library</h2>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* Drop zone + grid */}
        <div
          ref={dropZoneRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`min-h-[300px] rounded-xl border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-zinc-800 bg-zinc-900/50'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImagePlus className="w-12 h-12 text-zinc-700 mb-4" />
              {media.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-zinc-400">No images yet</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Drag & drop images here or click Upload above.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">No images match "{searchQuery}"</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors"
                >
                  {/* Image */}
                  <div className="aspect-square bg-zinc-800">
                    <img
                      src={imageUrl(item.file_url)}
                      alt={item.original_name || item.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="p-2 rounded-lg bg-zinc-900/80 text-red-400 hover:bg-zinc-800 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs text-zinc-400 truncate" title={item.original_name || item.filename}>
                      {item.original_name || item.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-600">
                        {item.file_size ? formatBytes(item.file_size) : ''}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {item.created_at ? formatDate(item.created_at) : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {media.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <div className="flex items-center gap-1.5">
              <FileImage className="w-3.5 h-3.5" />
              {media.length} image{media.length !== 1 ? 's' : ''}
            </div>
            <div>
              Total: {formatBytes(media.reduce((acc: number, m: any) => acc + (m.file_size || 0), 0))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Delete Image</h3>
            <p className="text-sm text-zinc-400">
              This will permanently remove this image. Products using it will show a broken image.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
