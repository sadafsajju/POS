import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../lib/api';

interface OrdersProps {
  onBackToMenu: () => void;
}

export default function Orders({ onBackToMenu }: OrdersProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => customerAPI.getMyOrders(),
    refetchInterval: 10000, // Poll every 10 seconds
  });

  return (
    <div className="min-h-screen">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{order.order_number}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : order.status === 'preparing'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'ready'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>

                {order.items && (
                  <div className="space-y-1 mb-3">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.quantity}x {item.product_name}
                        </span>
                        <span className="text-gray-600">${item.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">${order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No orders yet</p>
          </div>
        )}

        <button
          onClick={onBackToMenu}
          className="w-full mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
