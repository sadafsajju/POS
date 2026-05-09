import { useState, useCallback, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Upload,
  Loader2,
  Check,
  Trash2,
  ImagePlus,
  AlertCircle,
  ArrowLeft,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { toastHelpers } from '@/lib/toast-helpers'
import { useSettingsStore } from '@pos/core'
import type { Category } from '@/types'

export const Route = createFileRoute('/admin/more/import')({
  component: AIMenuImport,
})

interface ExtractedItem {
  name: string
  price: number
  category: string
  description: string
  selected: boolean
  categoryId?: string // matched to existing category
}

/** Resize + compress an image to JPEG, returns base64 string (no data URL prefix) */
function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1])
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

type Step = 'upload' | 'processing' | 'preview' | 'importing' | 'done'

function AIMenuImport() {
  const [step, setStep] = useState<Step>('upload')
  const [items, setItems] = useState<ExtractedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResult, setImportResult] = useState({ products: 0, categories: 0 })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()

  // Fetch existing categories for matching
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-for-import'],
    queryFn: () => apiClient.getCategories(true),
  })
  const existingCategories: Category[] = Array.isArray(categoriesData)
    ? categoriesData
    : Array.isArray((categoriesData as any)?.data)
      ? (categoriesData as any).data
      : []

  // Parse menu image mutation
  const parseMutation = useMutation({
    mutationFn: (params: { image_base64: string; content_type: string }) =>
      apiClient.parseMenuImage(params),
    onSuccess: (res: any) => {
      if (res.success && Array.isArray(res.data)) {
        const extracted = res.data.map((item: any) => {
          // Try to match category to existing
          const match = existingCategories.find(
            c => c.name.toLowerCase() === (item.category || '').toLowerCase()
          )
          return {
            ...item,
            selected: true,
            categoryId: match?.id || undefined,
          }
        })
        setItems(extracted)
        setStep('preview')
        setError(null)
      } else {
        setError(res.message || 'Failed to extract menu items')
        setStep('upload')
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to analyze menu image')
      setStep('upload')
    },
  })

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB')
      return
    }

    setError(null)
    setStep('processing')

    try {
      // Compress and send base64 directly to edge function (no storage round-trip)
      const compressed = await compressImage(file, 1500, 0.8)
      parseMutation.mutate({ image_base64: compressed, content_type: 'image/jpeg' })
    } catch (err: any) {
      setError(err.message || 'Failed to process image')
      setStep('upload')
    }
  }, [parseMutation])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleFile])

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  const toggleAll = () => {
    const allSelected = items.every(i => i.selected)
    setItems(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ExtractedItem, value: any) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleImport = async () => {
    const selected = items.filter(i => i.selected)
    if (selected.length === 0) return

    setStep('importing')
    setImportProgress({ current: 0, total: selected.length })

    let createdProducts = 0
    let createdCategories = 0
    const categoryIdMap: Record<string, string> = {}

    // Map existing categories
    for (const cat of existingCategories) {
      categoryIdMap[cat.name.toLowerCase()] = cat.id
    }

    try {
      // Create new categories first
      const uniqueCategories = [...new Set(selected.map(i => i.category))]
      for (const catName of uniqueCategories) {
        const key = catName.toLowerCase()
        if (!categoryIdMap[key] && catName !== 'Uncategorized') {
          try {
            const res = await apiClient.createCategory({ name: catName, is_active: true })
            if (res?.data?.id) {
              categoryIdMap[key] = res.data.id
              createdCategories++
            } else if ((res as any)?.success && (res as any)?.data?.id) {
              categoryIdMap[key] = (res as any).data.id
              createdCategories++
            }
          } catch (e) {
            console.warn(`Failed to create category "${catName}":`, e)
          }
        }
      }

      // Create products
      for (let i = 0; i < selected.length; i++) {
        const item = selected[i]
        setImportProgress({ current: i + 1, total: selected.length })

        try {
          const categoryId = categoryIdMap[item.category.toLowerCase()] || null
          const res = await apiClient.createProduct({
            name: item.name,
            price: item.price,
            description: item.description || undefined,
            category_id: categoryId,
            product_type: 'simple',
            is_available: true,
            sort_order: i,
            preparation_time: 0,
          })
          if (res?.success !== false) createdProducts++
        } catch (e) {
          console.warn(`Failed to create product "${item.name}":`, e)
        }
      }

      setImportResult({ products: createdProducts, categories: createdCategories })
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-for-import'] })

      if (createdProducts > 0) {
        toastHelpers.success('Import complete', `${createdProducts} products imported`)
      }
    } catch (err: any) {
      setError(err.message || 'Import failed')
      setStep('preview')
    }
  }

  const reset = () => {
    setStep('upload')
    setItems([])
    setError(null)
    setImportProgress({ current: 0, total: 0 })
    setImportResult({ products: 0, categories: 0 })
  }

  const selectedCount = items.filter(i => i.selected).length

  return (
    <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <span className="text-lg font-bold tracking-tight text-zinc-300">AI Menu Import</span>
          {step === 'preview' && (
            <>
              <div className="h-5 w-px bg-zinc-700" />
              <span className="text-sm font-bold text-zinc-200 tabular-nums">{items.length}</span>
              <span className="text-xs text-zinc-500">items detected</span>
            </>
          )}
        </div>
        {(step === 'preview' || step === 'done') && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            New Import
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* ── Upload Step ─────────────────────────────── */}
        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-full max-w-lg space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full h-64 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                  dragOver
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/50"
                )}
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <ImagePlus className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-200">
                    Drop your menu image here
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    or click to browse — JPG, PNG up to 10MB
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />

              {error && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400">{error}</p>
                    <p className="text-xs text-red-400/60 mt-1">Try a clearer, well-lit photo of the menu</p>
                  </div>
                </div>
              )}

              {/* How it works */}
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">How it works</p>
                <div className="space-y-2.5">
                  {[
                    'Upload a photo of your physical menu or PDF screenshot',
                    'AI extracts all product names, prices, categories & descriptions',
                    'Review and edit the results, then import with one click',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-400">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Processing Step ─────────────────────────── */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200">Analyzing your menu</p>
              <p className="text-sm text-zinc-500 mt-1">This may take 10-20 seconds...</p>
            </div>
          </div>
        )}

        {/* ── Preview Step ────────────────────────────── */}
        {step === 'preview' && (
          <div className="p-4 space-y-3">
            {/* Select all bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    items.every(i => i.selected)
                      ? "bg-indigo-500 border-indigo-500"
                      : "border-zinc-600 hover:border-zinc-400"
                  )}
                >
                  {items.every(i => i.selected) && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className="text-sm text-zinc-300">
                  {selectedCount} of {items.length} selected
                </span>
              </div>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-400 active:bg-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                Import {selectedCount} Products
              </button>
            </div>

            {/* Item cards */}
            <div className="grid gap-1.5">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                    item.selected
                      ? "bg-zinc-900 border-zinc-800"
                      : "bg-zinc-900/40 border-zinc-800/40 opacity-50"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(index)}
                    className={cn(
                      "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      item.selected
                        ? "bg-indigo-500 border-indigo-500"
                        : "border-zinc-600 hover:border-zinc-400"
                    )}
                  >
                    {item.selected && <Check className="w-3 h-3 text-white" />}
                  </button>

                  {/* Name */}
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium text-zinc-100 focus:outline-none focus:bg-zinc-800 px-2 py-1 rounded-md transition-colors"
                  />

                  {/* Price */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <span className="text-xs text-zinc-600">{settings.currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-transparent text-sm font-mono font-semibold text-white text-right focus:outline-none focus:bg-zinc-800 px-2 py-1 rounded-md transition-colors"
                    />
                  </div>

                  {/* Category */}
                  <select
                    value={item.categoryId || `__new__${item.category}`}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val.startsWith('__new__')) {
                        updateItem(index, 'categoryId', undefined)
                        updateItem(index, 'category', val.replace('__new__', ''))
                      } else {
                        const cat = existingCategories.find(c => c.id === val)
                        if (cat) {
                          updateItem(index, 'categoryId', cat.id)
                          updateItem(index, 'category', cat.name)
                        }
                      }
                    }}
                    className="flex-shrink-0 w-36 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  >
                    {/* Existing categories */}
                    {existingCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    {/* New category option (if not matching existing) */}
                    {!existingCategories.some(c => c.name.toLowerCase() === item.category.toLowerCase()) && (
                      <option value={`__new__${item.category}`}>+ {item.category}</option>
                    )}
                  </select>

                  {/* Description (truncated, editable on focus) */}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Description..."
                    className="flex-shrink-0 w-40 bg-transparent text-xs text-zinc-500 focus:outline-none focus:bg-zinc-800 focus:text-zinc-300 px-2 py-1 rounded-md transition-colors truncate"
                  />

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(index)}
                    className="flex-shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Package className="w-10 h-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">All items removed</p>
                <button onClick={reset} className="text-sm text-indigo-400 hover:text-indigo-300">
                  Start over
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Importing Step ──────────────────────────── */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200">
                Importing {importProgress.current} of {importProgress.total}
              </p>
              <div className="w-64 h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Done Step ───────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200">Import Complete</p>
              <p className="text-sm text-zinc-500 mt-2">
                {importResult.products} products imported
                {importResult.categories > 0 && ` in ${importResult.categories} new categories`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                <ImagePlus className="h-4 w-4" />
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
