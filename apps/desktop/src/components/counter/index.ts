// Main component
export { CounterInterface } from './CounterInterface'

// Types
export type {
  CartItem,
  ProcessPaymentRequest,
  KOTItem,
  PaymentAmounts,
  PaymentMethodType,
  ActiveTab,
  OrderType,
  ConsolidatedItem,
  PaidPaymentDetails,
  CreateOrderRequest,
  OrderItemResponse
} from './types'

// Hooks
export { useCart } from './hooks/useCart'
export { usePayment } from './hooks/usePayment'
export { useOrderSelection } from './hooks/useOrderSelection'
export { useElapsedTimer } from './hooks/useElapsedTimer'

// Utils
export {
  consolidateItems,
  formatElapsedTime,
  getOrderTypeIcon,
  getOrderTypeBadge,
  getTableOrders,
  calculateTableTotal,
  getCurrentUserRole,
  isAdminOrManager
} from './utils/orderUtils'

export {
  isTauriEnvironment,
  printThermalReceipt,
  printKOT,
  generateReceiptHtml,
  generateKOTHtml
} from './utils/printUtils'

// Views
export { TablesView } from './views/TablesView'
export { CreateOrderView } from './views/CreateOrderView'
export { PaymentView } from './views/PaymentView'

// Panels
export { TableDetailsPanel } from './panels/TableDetailsPanel'
export { CartPanel } from './panels/CartPanel'
export { PaymentPanel } from './panels/PaymentPanel'

// Dialogs
export { CancelOrderDialog } from './dialogs/CancelOrderDialog'
