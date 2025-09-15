'use client';

import React from 'react';

export interface DownloadStatus {
  isDownloading: boolean;
  isUploading: boolean;
  isBulkCollecting: boolean;
  isValidating: boolean;
  downloadProgress?: string;
  uploadProgress?: string;
  bulkProgress?: string;
  validationProgress?: string;
  error?: string;
}

export interface DownloadActionButtonsProps {
  mode: 'single' | 'bulk' | 'validation';
  status: DownloadStatus;
  disabled?: boolean;
  hasData?: boolean;
  hasBulkData?: boolean;
  onDownload?: () => void;
  onUpload?: () => void;
  onBulkCollection?: () => void;
  onBulkUpload?: () => void;
  onValidation?: () => void;
}

export default function DownloadActionButtons({
  mode,
  status,
  disabled = false,
  hasData = false,
  hasBulkData = false,
  onDownload,
  onUpload,
  onBulkCollection,
  onBulkUpload,
  onValidation
}: DownloadActionButtonsProps) {

  if (mode === 'single') {
    return (
      <div className="space-y-3">
        <button
          onClick={onDownload}
          disabled={disabled || status.isDownloading}
          className="w-full px-4 py-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {status.isDownloading ? 'Downloading...' : 'Download from IB API'}
        </button>
        
        <button
          onClick={onUpload}
          disabled={!hasData || status.isUploading}
          className="w-full px-4 py-3 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {status.isUploading ? 'Uploading...' : 'Load to PostgreSQL'}
        </button>
      </div>
    );
  }

  if (mode === 'bulk') {
    return (
      <div className="flex space-x-4">
        <button
          onClick={onBulkCollection}
          disabled={disabled || status.isBulkCollecting}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {status.isBulkCollecting ? 'Collecting...' : 'Start Bulk Collection'}
        </button>
        <button
          onClick={onBulkUpload}
          disabled={!hasBulkData || status.isUploading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {status.isUploading ? 'Uploading...' : 'Load to PostgreSQL'}
        </button>
      </div>
    );
  }

  if (mode === 'validation') {
    return (
      <div>
        <button
          onClick={onValidation}
          disabled={status.isValidating}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {status.isValidating ? 'Validating...' : 'Validate Data Quality'}
        </button>
      </div>
    );
  }

  return null;
}
