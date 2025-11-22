'use client';

import React, { useState } from 'react';

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  signal?: {
    signal_type: 'BUY' | 'SELL';
    strategy: string;
    price: number;
    confidence?: number;
    timestamp: string;
  };
  symbol: string;
  contractId?: number;
  setupId?: number;
  signalId?: number;
}

export default function OrderDialog({
  isOpen,
  onClose,
  signal,
  symbol,
  contractId,
  setupId,
  signalId
}: OrderDialogProps) {
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!signal) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const backendUrl = (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('API URL not configured');
      }

      const quantityNum = parseFloat(quantity);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      if (orderType === 'LIMIT' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
        throw new Error('Limit price required for LIMIT orders');
      }

      const orderPayload: any = {
        contract_id: contractId,
        action: signal.signal_type,
        quantity: quantityNum,
        order_type: orderType,
        setup_id: setupId,
        signal_id: signalId
      };

      if (orderType === 'LIMIT') {
        orderPayload.price = parseFloat(limitPrice);
      }

      const response = await fetch(`${backendUrl}/api/trading/place-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to place order');
      }

      const orderData = await response.json();
      setSuccess(true);
      
      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setQuantity('1');
        setLimitPrice('');
        setOrderType('MARKET');
      }, 2000);

    } catch (err) {
      console.error('Error placing order:', err);
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onClose();
    setError(null);
    setSuccess(false);
    setQuantity('1');
    setLimitPrice('');
    setOrderType('MARKET');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Place Order</h2>

          {signal && (
            <div className={`p-4 rounded-lg mb-4 border-2 ${
              signal.signal_type === 'BUY' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`text-2xl ${signal.signal_type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                      {signal.signal_type === 'BUY' ? '📈' : '📉'}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {signal.signal_type} Signal: {signal.strategy}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Symbol: <span className="font-medium">{symbol}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <div className="text-xs text-gray-500">Signal Price</div>
                      <div className="text-lg font-bold text-gray-900">${signal.price.toFixed(2)}</div>
                    </div>
                    {signal.confidence && (
                      <div>
                        <div className="text-xs text-gray-500">Confidence</div>
                        <div className="text-lg font-bold text-gray-900">
                          {(signal.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {orderType === 'LIMIT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Limit Price ($)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder={signal ? signal.price.toFixed(2) : '0.00'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting}
                  />
                  {signal && (
                    <button
                      type="button"
                      onClick={() => setLimitPrice(signal.price.toFixed(2))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      disabled={isSubmitting}
                    >
                      Use Signal Price
                    </button>
                  )}
                </div>
                {signal && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current signal price: ${signal.price.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                ❌ {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
                ✅ Order placed successfully!
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !signal}
              className={`px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                signal?.signal_type === 'BUY'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isSubmitting ? 'Placing...' : `Place ${signal?.signal_type || 'Order'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

