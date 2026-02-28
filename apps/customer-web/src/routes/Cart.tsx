import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { customerAPI } from '../lib/api';
import { useCartStore } from '../stores/cart-store';

interface CartProps {
  onBack: () => void;
  onOrderPlaced: () => void;
}

export default function Cart({ onBack, onOrderPlaced }: CartProps) {
  const { items, updateQuantity, removeItem, getTotal, clearCart, getOrderItems } =
    useCartStore();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const placeOrderMutation = useMutation({
    mutationFn: () =>
      customerAPI.placeOrder({
        items: getOrderItems(),
      }),
    onSuccess: () => {
      clearCart();
      onOrderPlaced();
    },
  });

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      await placeOrderMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-2xl mb-4">🛒</p>
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  const total = getTotal();
  const tax = total * 0.1; // 10% tax
  const grandTotal = total + tax;

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Your Cart</h1>
        </div>
      </div>

      {/* Cart Items */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm divide-y">
          {items.map((item) => (
            <div key={item.product.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-600">
                    ${item.product.price.toFixed(2)} each
                  </p>
                </div>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-red-500 hover:text-red-700 ml-4"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                <span className="font-semibold text-gray-900">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm mt-4 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (10%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-medium text-lg"
          >
            {isPlacingOrder ? 'Placing Order...' : `Place Order • $${grandTotal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
