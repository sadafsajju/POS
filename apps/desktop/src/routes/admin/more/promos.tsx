import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import type { PromoItem } from '@pos/api-client'
import {
  Image,
  Upload,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Film,
  Clock,
  GripVertical,
  Loader2,
  Library,
  Check,
  ImagePlus,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { imageUrl } from '@/lib/utils'

export const Route = createFileRoute('/admin/more/promos')({
  component: PromosSettingsPage,
})

function PromosSettingsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  const { data: promosRes, isLoading } = useQuery({
    queryKey: queryKeys.promos.admin,
    queryFn: () => adminApi.getPromos(),
    staleTime: staleTime.promos,
  })

  const promos: PromoItem[] = Array.isArray(promosRes?.data) ? promosRes.data : []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.promos.all })

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => adminApi.uploadPromo(formData),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePromo(id),
    onSuccess: invalidate,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.togglePromo(id),
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; display_order: number }[]) => adminApi.reorderPromos(items),
    onSuccess: invalidate,
  })

  const durationMutation = useMutation({
    mutationFn: ({ id, duration }: { id: string; duration: number }) =>
      adminApi.updatePromoDuration(id, duration),
    onSuccess: invalidate,
  })

  const fromMediaMutation = useMutation({
    mutationFn: (file_url: string) => adminApi.createPromoFromMedia(file_url),
    onSuccess: invalidate,
  })

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^.]+$/, ''))
      await uploadMutation.mutateAsync(formData)
    }
    setUploading(false)
  }, [uploadMutation])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const movePromo = useCallback((index: number, direction: -1 | 1) => {
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= promos.length) return
    const updated = promos.map((p, i) => {
      if (i === index) return { id: p.id, display_order: swapIndex }
      if (i === swapIndex) return { id: p.id, display_order: index }
      return { id: p.id, display_order: i }
    })
    reorderMutation.mutate(updated)
  }, [promos, reorderMutation])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div >
            <Image className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Promo Management</h2>
            {/* <p className="text-sm text-zinc-500">Upload images and videos for the customer display carousel</p> */}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Upload zone */}
        <div className="flex gap-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex-1 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragOver
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                <p className="text-zinc-300 font-medium">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-zinc-500" />
                <p className="text-zinc-300 font-medium">Drop images or videos here, or click to browse</p>
                <p className="text-xs text-zinc-500">Supports JPG, PNG, WebP, MP4, WebM (max 50MB)</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowLibrary(true)}
            className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3 w-48"
          >
            <Library className="w-10 h-10 text-zinc-500" />
            <p className="text-zinc-300 font-medium text-sm">Choose from Library</p>
          </button>
        </div>

        {/* Promos grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-12">
            <Image className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No promos yet. Upload your first image or video above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold px-1">
              {promos.length} promo{promos.length !== 1 ? 's' : ''} &middot; drag to reorder
            </p>
            {promos.map((promo, index) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                index={index}
                total={promos.length}
                onMoveUp={() => movePromo(index, -1)}
                onMoveDown={() => movePromo(index, 1)}
                onToggle={() => toggleMutation.mutate(promo.id)}
                onDelete={() => {
                  if (confirm('Delete this promo?')) deleteMutation.mutate(promo.id)
                }}
                onDurationChange={(d) => durationMutation.mutate({ id: promo.id, duration: d })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Media Library Picker */}
      <PromoMediaLibraryDialog
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={(file_url) => {
          fromMediaMutation.mutate(file_url)
          setShowLibrary(false)
        }}
        existingUrls={promos.map((p) => p.file_url)}
      />
    </div>
  )
}

function PromoMediaLibraryDialog({
  open,
  onClose,
  onSelect,
  existingUrls,
}: {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  existingUrls: string[]
}) {
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
          <DialogTitle className="text-zinc-200">Choose from Media Library</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12">
              <ImagePlus className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">No images in the media library yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Upload images from the Media settings page first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {media.map((item: any) => {
                const alreadyUsed = existingUrls.includes(item.file_url)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !alreadyUsed && onSelect(item.file_url)}
                    disabled={alreadyUsed}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      alreadyUsed
                        ? 'border-zinc-700 opacity-40 cursor-not-allowed'
                        : 'border-zinc-700 hover:border-purple-500 cursor-pointer'
                    }`}
                  >
                    <img
                      src={imageUrl(item.file_url)}
                      alt={item.original_name || item.filename}
                      className="w-full h-full object-cover"
                    />
                    {alreadyUsed && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="p-1.5 rounded-full bg-zinc-700">
                          <Check className="w-3.5 h-3.5 text-zinc-300" />
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

function PromoCard({
  promo,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
  onDurationChange,
}: {
  promo: PromoItem
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: () => void
  onDelete: () => void
  onDurationChange: (d: number) => void
}) {
  const isVideo = promo.media_type === 'video'
  const mediaUrl = imageUrl(promo.file_url)

  return (
    <div className={`
      flex items-center gap-4 p-3 rounded-xl border transition-colors
      ${promo.is_active
        ? 'bg-zinc-900 border-zinc-800'
        : 'bg-zinc-900/50 border-zinc-800/50 opacity-60'
      }
    `}>
      {/* Grip + order controls */}
      <div className="flex flex-col items-center gap-0.5 text-zinc-600">
        <GripVertical className="w-4 h-4" />
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0.5 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-0.5 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="w-24 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 relative">
        {isVideo ? (
          <>
            <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Film className="w-5 h-5 text-white/80" />
            </div>
          </>
        ) : (
          <img src={mediaUrl} alt={promo.title || 'Promo'} className="w-full h-full object-cover" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">
          {promo.title || 'Untitled'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isVideo ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {isVideo ? 'Video' : 'Image'}
          </span>
          {!isVideo && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              <Select
                value={String(promo.duration_seconds)}
                onValueChange={(v) => onDurationChange(Number(v))}
              >
                <SelectTrigger className="h-6 w-16 border-zinc-700 bg-transparent text-zinc-400 text-xs px-2 py-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-16">
                  {[3, 5, 7, 10, 15, 20, 30].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isVideo && (
            <span className="text-xs text-zinc-500">Plays to end</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          className={`p-2 rounded-lg transition-colors ${
            promo.is_active
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-zinc-500 hover:bg-zinc-800'
          }`}
          title={promo.is_active ? 'Disable' : 'Enable'}
        >
          {promo.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
