import type { Category } from '@/types'

interface CategorySidebarProps {
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function CategorySidebar({ categories, selectedId, onSelect }: CategorySidebarProps) {
  return (
    <div className="w-48 lg:w-56 border-r border-zinc-800 overflow-y-auto flex-shrink-0 bg-zinc-900/50">
      <div className="p-2 space-y-1">
        {/* All category */}
        <button
          onClick={() => onSelect(null)}
          className={`
            w-full text-left px-4 py-4 rounded-xl text-sm font-semibold transition-all
            ${selectedId === null
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
              : 'text-zinc-300 hover:bg-zinc-800'
            }
          `}
        >
          All Items
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`
              w-full text-left px-4 py-4 rounded-xl text-sm font-semibold transition-all
              ${selectedId === cat.id
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-800'
              }
            `}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
