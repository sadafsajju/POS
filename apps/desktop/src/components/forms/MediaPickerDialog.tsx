import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Search, Upload, X } from 'lucide-react'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { imageUrl } from '@/lib/utils'

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (fileUrl: string) => void
  selectedUrl?: string
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedUrl,
}: MediaPickerDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: mediaRes, isLoading } = useQuery({
    queryKey: queryKeys.media.admin,
    queryFn: () => adminApi.getMedia(),
    staleTime: staleTime.media,
    enabled: open,
  })

  const media: any[] = Array.isArray(mediaRes?.data) ? mediaRes.data : []

  const filteredMedia = searchQuery
    ? media.filter((m) =>
        (m.original_name || m.filename || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : media

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.media.all })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return adminApi.uploadMedia(formData)
    },
    onSuccess: (res: any) => {
      invalidate()
      const url = res?.data?.file_url
      if (url) {
        onSelect(url)
        onOpenChange(false)
      }
    },
  })

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true)
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        try {
          await uploadMutation.mutateAsync(file)
        } catch (err) {
          console.error('Upload failed:', err)
        }
      }
      setUploading(false)
    },
    [uploadMutation],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 bg-zinc-900 border-zinc-800">
        <DialogHeader className="px-5 py-3 border-b border-zinc-800">
          <DialogTitle className="text-base font-semibold text-zinc-200">
            Choose from Media Library
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload new
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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImagePlus className="w-12 h-12 text-zinc-700 mb-4" />
              {media.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-zinc-400">
                    No images yet
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Upload an image to get started.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  No images match "{searchQuery}"
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredMedia.map((item) => {
                const isSelected = selectedUrl === item.file_url
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      onSelect(item.file_url)
                      onOpenChange(false)
                    }}
                    className={`group relative rounded-lg overflow-hidden border bg-zinc-900 transition-colors text-left ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="aspect-square bg-zinc-800">
                      <img
                        src={imageUrl(item.file_url)}
                        alt={item.original_name || item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2">
                      <p
                        className="text-xs text-zinc-400 truncate"
                        title={item.original_name || item.filename}
                      >
                        {item.original_name || item.filename}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
