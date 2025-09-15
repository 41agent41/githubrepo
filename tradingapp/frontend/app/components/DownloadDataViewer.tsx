'use client';

import React from 'react';
import DataframeViewer from './DataframeViewer';

export interface DownloadDataViewerProps {
  mode: 'single' | 'bulk' | 'validation';
  data: any[] | null;
  title?: string;
  description?: string;
  isVisible?: boolean;
  onReset?: () => void;
}

export default function DownloadDataViewer({
  mode,
  data,
  title,
  description,
  isVisible = true,
  onReset
}: DownloadDataViewerProps) {

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Get mode-specific configuration
  const getModeConfig = () => {
    switch (mode) {
      case 'single':
        return {
          defaultTitle: 'Historical Data',
          emptyMessage: 'No data downloaded yet',
          emptySubMessage: "Select market, symbol, and timeframe, then click 'Download from IB API' to fetch data",
          maxHeight: '600px',
          itemsPerPage: 25
        };
      case 'bulk':
        return {
          defaultTitle: 'Bulk Collection Data',
          emptyMessage: 'No data downloaded yet',
          emptySubMessage: "Enter required symbols, time period, and timeframe, then click 'Start Bulk Collection' to fetch data",
          maxHeight: '600px',
          itemsPerPage: 25
        };
      case 'validation':
        return {
          defaultTitle: 'Validation Results Summary',
          emptyMessage: 'No validation results yet',
          emptySubMessage: "Enter required symbols, time period, and timeframe, then click 'Validate Data Quality' to fetch data",
          maxHeight: '400px',
          itemsPerPage: 20
        };
      default:
        return {
          defaultTitle: 'Data',
          emptyMessage: 'No data available',
          emptySubMessage: 'Please configure and run a data operation',
          maxHeight: '400px',
          itemsPerPage: 25
        };
    }
  };

  const config = getModeConfig();

  return (
    <div className="mb-6">
      {onReset && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300 hover:border-gray-400"
          >
            Clear Data
          </button>
        </div>
      )}
      
      <DataframeViewer
        data={data || []}
        title={title || config.defaultTitle}
        description={description}
        maxHeight={config.maxHeight}
        showExport={true}
        showPagination={true}
        itemsPerPage={config.itemsPerPage}
        emptyStateMessage={config.emptyMessage}
        emptyStateSubMessage={config.emptySubMessage}
      />
    </div>
  );
}
