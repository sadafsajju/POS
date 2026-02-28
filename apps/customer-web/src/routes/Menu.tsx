import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../lib/api';
import { useCartStore } from '../stores/cart-store';
import type { Product } from '@pos/types';

interface MenuProps {
  onNavigateToCart: () => void;
}

export default function Menu({ onNavigateToCart }: MenuProps) {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['menu'],
    queryFn: () => customerAPI.getMenu(),
  });

  const { addItem, getItemCount } = useCartStore();
  const sessionData = customerAPI.getSessionData();
  const cartCount = getItemCount();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600">Failed to load menu. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {sessionData?.restaurant_info.name || 'Restaurant'}
          </h1>
          <p className="text-sm text-gray-600">
            {sessionData?.table.table_number || 'Table'}
          </p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products?.map((product: Product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-40 object-cover rounded-md mb-3"
                />
              )}
              <h3 className="font-semibold text-lg text-gray-900">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-bold text-gray-900">
                  ${product.price.toFixed(2)}
                </span>
                <button
                  onClick={() => addItem(product)}
                  disabled={!product.is_available}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  {product.is_available ? 'Add' : 'Unavailable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <button
              onClick={onNavigateToCart}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium flex items-center justify-between"
            >
              <span>View Cart</span>
              <span className="bg-white text-primary-600 px-3 py-1 rounded-full font-bold">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
