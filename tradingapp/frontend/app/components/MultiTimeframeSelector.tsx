'use client';

import React from 'react';

interface Timeframe {
  value: string;
  label: string;
  minutes: number;
}

interface MultiTimeframeSelectorProps {
  selectedTimeframes: string[];
  onTimeframeChange: (timeframes: string[]) => void;
  disabled?: boolean;
}

const TIMEFRAMES: Timeframe[] = [
  { value: '5min', label: '5m', minutes: 5 },
  { value: '15min', label: '15m', minutes: 15 },
  { value: '30min', label: '30m', minutes: 30 },
  { value: '1hour', label: '1h', minutes: 60 },
  { value: '4hour', label: '4h', minutes: 240 },
  { value: '8hour', label: '8h', minutes: 480 },
  { value: '1day', label: '1d', minutes: 1440 }
];

export default function MultiTimeframeSelector({
  selectedTimeframes,
  onTimeframeChange,
  disabled = false
}: MultiTimeframeSelectorProps) {
  const handleToggle = (timeframe: string) => {
    if (disabled) return;
    
    if (selectedTimeframes.includes(timeframe)) {
      // Don't allow deselecting if it's the last one
      if (selectedTimeframes.length > 1) {
        onTimeframeChange(selectedTimeframes.filter(tf => tf !== timeframe));
      }
    } else {
      onTimeframeChange([...selectedTimeframes, timeframe]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onTimeframeChange(TIMEFRAMES.map(tf => tf.value));
  };

  const handleClearAll = () => {
    if (disabled) return;
    // Keep at least one timeframe selected
    if (selectedTimeframes.length > 1) {
      onTimeframeChange([selectedTimeframes[0]]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-lg">⏱️</span>
          <h3 className="font-medium text-gray-900">Select Timeframes</h3>
          {selectedTimeframes.length > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
              {selectedTimeframes.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {selectedTimeframes.length < TIMEFRAMES.length && (
            <button
              onClick={handleSelectAll}
              disabled={disabled}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              Select All
            </button>
          )}
          {selectedTimeframes.length > 1 && (
            <button
              onClick={handleClearAll}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {TIMEFRAMES.map((timeframe) => {
          const isSelected = selectedTimeframes.includes(timeframe.value);
          const isOnlySelection = selectedTimeframes.length === 1 && isSelected;
          
          return (
            <label
              key={timeframe.value}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled || isOnlySelection ? 'opacity-50' : ''} ${
                isOnlySelection ? 'cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(timeframe.value)}
                disabled={disabled || isOnlySelection}
                className="sr-only"
              />
              <div className="text-lg font-semibold mb-1">{timeframe.label}</div>
              <div className="text-xs text-gray-500">{timeframe.value}</div>
              {isOnlySelection && (
                <div className="text-xs text-gray-400 mt-1">Required</div>
              )}
            </label>
          );
        })}
      </div>

      {selectedTimeframes.length === 0 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ At least one timeframe must be selected
        </div>
      )}
    </div>
  );
}

