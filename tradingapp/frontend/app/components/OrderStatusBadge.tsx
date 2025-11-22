'use client';

import React from 'react';

interface OrderStatusBadgeProps {
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected' | 'partial';
  size?: 'sm' | 'md' | 'lg';
}

export default function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⏳'
    },
    submitted: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '📤'
    },
    filled: {
      label: 'Filled',
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '🚫'
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
    },
    partial: {
      label: 'Partial',
      className: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: '⚡'
    }
  };

  const config = statusConfig[status] || statusConfig.pending;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span
      className={`inline-flex items-center space-x-1 font-medium rounded-full border ${config.className} ${sizeClasses[size]}`}
      title={config.label}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

