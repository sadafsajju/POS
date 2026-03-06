import { createFileRoute } from '@tanstack/react-router'
import { CounterInterface } from '@/components/counter/CounterInterface'

type PosSearch = {
  view?: 'order-type' | 'tables' | 'create' | 'payment'
  type?: 'dine_in' | 'takeout' | 'delivery'
}

export const Route = createFileRoute('/admin/pos')({
  validateSearch: (search: Record<string, unknown>): PosSearch => ({
    view: (['order-type', 'tables', 'create', 'payment'].includes(search.view as string)
      ? search.view as PosSearch['view']
      : undefined),
    type: (['dine_in', 'takeout', 'delivery'].includes(search.type as string)
      ? search.type as PosSearch['type']
      : undefined),
  }),
  component: () => <CounterInterface />,
})
