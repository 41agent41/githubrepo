'use client';

import React, { useState, useEffect } from 'react';
import { useIBConnection } from '../contexts/IBConnectionContext';
import DataSwitch from '../components/DataSwitch';
import DataframeViewer from '../components/DataframeViewer';
import BackToHome from '../components/BackToHome';
import DatabaseConnectivityTest from '../components/DatabaseConnectivityTest';
import DownloadConfigPanel, { DownloadConfig } from '../components/DownloadConfigPanel';
import DownloadActionButtons, { DownloadStatus as DownloadActionStatus } from '../components/DownloadActionButtons';
import DownloadDataViewer from '../components/DownloadDataViewer';
import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';
import { createDataResetFunctions, processHistoricalDataBars, validateDownloadConfig } from '../utils/downloadDataManager';
import { getApiUrl } from '../utils/apiConfig';

interface HistoricalData {
  symbol: string;
  timeframe: string;
  account_mode: string;
  bars: any[];
  count: number;
  last_updated: string;
  source: string;
  exchange?: string;
  secType?: string;
}

interface DownloadStatus {
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

interface BulkCollectionResult {
  summary: {
    total_operations: number;
    successful_operations: number;
    failed_operations: number;
    total_records_collected: number;
    errors: string[];
  };
  results: Record<string, Record<string, any>>;
}

interface ValidationResult {
  summary: {
    total_validations: number;
    valid_count: number;
    invalid_count: number;
    error_count: number;
  };
  results: Record<string, Record<string, any>>;
}

interface HealthStatus {
  healthy: boolean;
  services: {
    database: boolean;
    ib_service: boolean;
  };
}


export default function DownloadPage() {
  const { isLiveTrading, accountMode } = useIBConnection();
  // Use 'paper' as safe default if account mode is unknown
  const effectiveAccountMode = accountMode === 'unknown' ? 'paper' : accountMode;
  
  // Centralized configuration state
  const [config, setConfig] = useState<DownloadConfig>({
    exchangeFilters: {
      region: 'AMERICAS',
      country: 'US',
      exchange: 'SMART',
      secType: 'STK',
      symbol: 'MSFT',
      currency: 'USD',
      searchTerm: ''
    },
    periodFilters: {
      period: '3M',
      startDate: undefined,
      endDate: undefined,
      useDateRange: false
    },
    timeframe: '1hour',
    bulkSymbols: 'MSFT,AAPL,GOOGL,AMZN,TSLA',
    bulkTimeframes: ['1day', '1hour']
  });
  
  // Data state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<HistoricalData | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    isDownloading: false,
    isUploading: false,
    isBulkCollecting: false,
    isValidating: false
  });
  
  // Request tracking to prevent duplicate API calls
  const [activeRequests, setActiveRequests] = useState<Set<string>>(new Set());
  
  const createRequestKey = (symbol: string, timeframe: string, period: string) => 
    `${symbol}-${timeframe}-${period}`;
  
  const isRequestActive = (key: string) => activeRequests.has(key);
  
  const addActiveRequest = (key: string) => {
    setActiveRequests(prev => new Set([...Array.from(prev), key]));
  };
  
  const removeActiveRequest = (key: string) => {
    setActiveRequests(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.delete(key);
      return newSet;
    });
  };
  
  // Feature-specific data state
  const [bulkResults, setBulkResults] = useState<BulkCollectionResult | null>(null);
  const [bulkData, setBulkData] = useState<Record<string, Record<string, any>> | null>(null);
  const [bulkDisplayData, setBulkDisplayData] = useState<HistoricalData | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [validationSampleData, setValidationSampleData] = useState<HistoricalData | null>(null);
  const [selectedValidationItem, setSelectedValidationItem] = useState<{symbol: string, timeframe: string} | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [showBulkMode, setShowBulkMode] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showDatabaseTest, setShowDatabaseTest] = useState(false);
  const [databaseConnectivityStatus, setDatabaseConnectivityStatus] = useState<any>(null);
  
  // Centralized data reset functions
  const dataResetActions = {
    resetSingleSymbolData: () => {
      setChartData(null);
      setError(null);
    },
    resetBulkData: () => {
      setBulkResults(null);
      setBulkData(null);
      setBulkDisplayData(null);
      setError(null);
    },
    resetValidationData: () => {
      setValidationResults(null);
      setValidationSampleData(null);
      setSelectedValidationItem(null);
      setError(null);
    },
    resetAllData: () => {
      setChartData(null);
      setBulkResults(null);
      setBulkData(null);
      setBulkDisplayData(null);
      setValidationResults(null);
      setValidationSampleData(null);
      setSelectedValidationItem(null);
      setError(null);
    },
    setError: (error: string | null) => {
      setError(error);
    }
  };

  // User-configurable interval for manual operations (in seconds)
  const [operationIntervals, setOperationIntervals] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('download-page-operation-intervals');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return {
      singleSymbol: 1800, // 30 minutes in seconds
      bulkCollection: 7200 // 120 minutes in seconds
    };
  });
  
  // Data query switch state
  const [dataQueryEnabled, setDataQueryEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('download-page-data-enabled');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  // Updated timeframes for historical data (tick data handled by streaming functions)
  const timeframes = [
    { label: '1 Minute', value: '1min' },
    { label: '5 Minutes', value: '5min' },
    { label: '15 Minutes', value: '15min' },
    { label: '30 Minutes', value: '30min' },
    { label: '1 Hour', value: '1hour' },
    { label: '4 Hours', value: '4hour' },
    { label: '8 Hours', value: '8hour' },
    { label: '1 Day', value: '1day' }
  ];

  // Handle configuration changes
  const handleConfigChange = (updates: Partial<DownloadConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Handle data switch toggle
  const handleDataSwitchToggle = (enabled: boolean) => {
    setDataQueryEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('download-page-data-enabled', JSON.stringify(enabled));
    }
    if (!enabled) {
      dataResetActions.resetAllData();
    }
  };

  // Fetch historical data from IB API with enhanced completion detection
  const fetchHistoricalData = async (retryCount = 0) => {
    if (!dataQueryEnabled) {
      console.log('Data querying disabled');
      setIsLoading(false);
      return;
    }
    
    if (!config.exchangeFilters.symbol || !config.exchangeFilters.symbol.trim()) {
      setError('Symbol is required.');
      setIsLoading(false);
      return;
    }
    
    // Create request key to prevent duplicates
    const requestKey = createRequestKey(
      config.exchangeFilters.symbol,
      config.timeframe || '1hour',
      config.periodFilters.useDateRange ? 'CUSTOM' : config.periodFilters.period
    );
    
    // Check if this exact request is already active
    if (isRequestActive(requestKey)) {
      console.log('Request already active, skipping duplicate:', requestKey);
      return;
    }
    
    addActiveRequest(requestKey);
    setIsLoading(true);
    setError(null);
    setDownloadStatus({ 
      isDownloading: true, 
      isUploading: false, 
      isBulkCollecting: false, 
      isValidating: false, 
      downloadProgress: retryCount > 0 ? `Retrying connection to IB Gateway... (Attempt ${retryCount + 1})` : 'Connecting to IB Gateway...' 
    });
    
    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      // Build query parameters
      const params = new URLSearchParams({
        symbol: config.exchangeFilters.symbol,
        timeframe: config.timeframe || '1hour',
        period: config.periodFilters.useDateRange ? 'CUSTOM' : config.periodFilters.period,
        account_mode: effectiveAccountMode,
        secType: config.exchangeFilters.secType,
        exchange: config.exchangeFilters.exchange,
        currency: config.exchangeFilters.currency
      });

      // Add date range if using custom dates
      if (config.periodFilters.useDateRange && config.periodFilters.startDate && config.periodFilters.endDate) {
        params.append('start_date', config.periodFilters.startDate);
        params.append('end_date', config.periodFilters.endDate);
      }

      const url = `${apiUrl}/api/market-data/history?${params.toString()}`;
      
      console.log('Fetching historical data:', url);
      
      setDownloadStatus(prev => ({ ...prev, downloadProgress: 'Requesting data from IB Gateway...' }));
      
      // Enhanced request with longer timeout and better progress tracking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 600000); // 10 minute timeout for IB Gateway operations
      
      setDownloadStatus(prev => ({ ...prev, downloadProgress: 'Waiting for IB Gateway response...' }));
      
      const response = await fetch(url, {
        headers: { 
          'X-Data-Query-Enabled': 'true',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        
        if (response.status === 504) {
          throw new Error('Gateway timeout - IB service is taking longer than expected. Please try again.');
        } else if (response.status === 503) {
          throw new Error('IB service temporarily unavailable - please wait and try again');
        } else if (response.status === 500) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.detail && errorData.detail.includes('subscription')) {
              throw new Error('Using delayed market data - real-time subscription not available');
            } else if (errorData.detail && errorData.detail.includes('timeout')) {
              throw new Error('IB Gateway timeout - data request is taking longer than expected');
            } else if (errorData.detail && errorData.detail.includes('No historical data available')) {
              throw new Error('No historical data available for the specified symbol and timeframe');
            } else {
              throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }
          } catch (jsonError) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      setDownloadStatus(prev => ({ ...prev, downloadProgress: 'Processing response data...' }));
      
      const data: HistoricalData = await response.json();
      console.log('Historical data received:', data);
      
      // Enhanced validation of received data
      if (!data) {
        throw new Error('No data received from API');
      }
      
      if (!data.bars || !Array.isArray(data.bars)) {
        throw new Error('Invalid data format received from API - missing bars array');
      }
      
      if (data.bars.length === 0) {
        throw new Error('No historical data bars available for the specified parameters');
      }

      // Validate data structure and normalize timestamp format
      const firstBar = data.bars[0];
      if (!firstBar.timestamp && !firstBar.time) {
        throw new Error('Invalid data structure received - missing timestamp field');
      }
      if (firstBar.open === undefined || firstBar.close === undefined) {
        throw new Error('Invalid data structure received - missing OHLC data');
      }
      
      // Normalize bars data format for consistency
      data.bars = processHistoricalDataBars(data.bars);

      console.log('Received', data.bars.length, 'bars');
      console.log('Data validation passed - setting chart data');

      setChartData(data);
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        downloadProgress: `Successfully downloaded ${data.bars.length} records from ${data.source || 'IB Gateway'}` 
      });
      console.log('Historical data downloaded successfully');

    } catch (err) {
      console.error('Error fetching historical data:', err);
      
      // Enhanced retry logic with better error categorization
      if (retryCount < 3 && (
        (err instanceof Error && err.message.includes('timeout')) ||
        (err instanceof Error && err.message.includes('Gateway timeout')) ||
        (err instanceof Error && err.message.includes('Service temporarily unavailable')) ||
        (err instanceof Error && err.message.includes('taking longer than expected')) ||
        (err instanceof Error && err.name === 'AbortError')
      )) {
        const retryDelay = Math.min(15000 * (retryCount + 1), 45000); // Progressive delay: 15s, 30s, 45s
        console.log(`Retrying in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1}/3)`);
        setDownloadStatus(prev => ({ 
          ...prev, 
          downloadProgress: `Retrying in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1}/3)` 
        }));
        setTimeout(() => {
          fetchHistoricalData(retryCount + 1);
        }, retryDelay);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to fetch historical data');
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch historical data' 
      });
    } finally {
      setIsLoading(false);
      removeActiveRequest(requestKey);
    }
  };

  // Load data into PostgreSQL database
  const loadDataToDatabase = async () => {
    if (!chartData?.bars?.length) {
      setError('No data available to upload. Please download data first.');
      return;
    }

    setDownloadStatus({ 
      isDownloading: false, 
      isUploading: true, 
      isBulkCollecting: false, 
      isValidating: false, 
      uploadProgress: 'Preparing data for database...' 
    });
    setError(null);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      setDownloadStatus(prev => ({ ...prev, uploadProgress: 'Uploading data to PostgreSQL...' }));

      const response = await fetch(`${apiUrl}/api/market-data/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
        body: JSON.stringify({
          symbol: chartData.symbol,
          timeframe: chartData.timeframe,
          bars: chartData.bars,
          account_mode: chartData.account_mode,
          secType: config.exchangeFilters.secType,
          exchange: config.exchangeFilters.exchange,
          currency: config.exchangeFilters.currency
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload Error:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        } catch (jsonError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('Upload result:', result);
      
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        uploadProgress: `Successfully uploaded ${result.uploaded_count || chartData?.bars?.length || 0} records to database` 
      });

    } catch (err) {
      console.error('Error uploading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload data to database');
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        error: err instanceof Error ? err.message : 'Failed to upload data to database' 
      });
    }
  };

  // Handle download button click
  const handleDownloadData = () => {
    if (!dataQueryEnabled) {
      dataResetActions.setError('Data querying is disabled. Please enable the switch above.');
      return;
    }
    
    if (!config.exchangeFilters.symbol.trim()) {
      dataResetActions.setError('Symbol is required.');
      return;
    }
    
    // Validate configuration
    const errors = validateDownloadConfig(config, 'single');
    if (errors.length > 0) {
      dataResetActions.setError(errors[0]);
      return;
    }
    
    // Reset DataframeViewer to default empty state
    dataResetActions.resetSingleSymbolData();
    
    fetchHistoricalData();
  };

  // Handle bulk collection button click
  const handleBulkCollection = () => {
    // Validate configuration
    const errors = validateDownloadConfig(config, 'bulk');
    if (errors.length > 0) {
      dataResetActions.setError(errors[0]);
      return;
    }
    
    // Reset DataframeViewer to default empty state
    dataResetActions.resetBulkData();
    
    // Switch to bulk mode to ensure DataframeViewer is visible
    setShowBulkMode(true);
    setShowValidation(false);
    setShowDatabaseTest(false);
    
    performBulkCollection();
  };

  // Handle upload button click
  const handleUploadData = () => {
    if (!chartData?.bars?.length) {
      setError('No data available to upload. Please download data first.');
      return;
    }
    
    loadDataToDatabase();
  };

  // Load bulk collection data to PostgreSQL database
  const loadBulkDataToDatabase = async () => {
    if (!bulkData || !Object.keys(bulkData).length) {
      setError('No bulk data available to upload. Please perform bulk collection first.');
      return;
    }

    setDownloadStatus({ 
      isDownloading: false, 
      isUploading: true, 
      isBulkCollecting: false, 
      isValidating: false, 
      uploadProgress: 'Preparing bulk data for database...' 
    });
    setError(null);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      setDownloadStatus(prev => ({ ...prev, uploadProgress: 'Uploading bulk data to PostgreSQL...' }));

      const response = await fetch(`${apiUrl}/api/market-data/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
          body: JSON.stringify({
            bulkData: bulkData,
            account_mode: effectiveAccountMode,
            secType: config.exchangeFilters.secType,
            exchange: config.exchangeFilters.exchange,
            currency: config.exchangeFilters.currency
          })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bulk upload error:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        } catch (jsonError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('Bulk upload result:', result);
      
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        uploadProgress: `Successfully uploaded bulk data to database` 
      });

    } catch (err) {
      console.error('Error uploading bulk data:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload bulk data to database');
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        error: err instanceof Error ? err.message : 'Failed to upload bulk data to database' 
      });
    }
  };

  // Function to fetch and display bulk collected data from database
  // Function to display fetched data directly from bulk collection results
  const displayFetchedBulkData = (symbol: string, timeframe: string, bulkResultsData?: BulkCollectionResult) => {
    try {
      setIsLoading(true);
      setError(null);
      setBulkDisplayData(null); // Clear previous data

      // Use provided data or state data
      const resultsToUse = bulkResultsData || bulkResults;
      console.log('Debug - Using bulk results:', resultsToUse);
      console.log('Debug - Looking for:', symbol, timeframe);
      
      // Get the data from bulk results
      const symbolResults = resultsToUse?.results[symbol];
      console.log('Debug - Symbol Results:', symbolResults);
      
      const timeframeResult = symbolResults?.[timeframe];
      console.log('Debug - Timeframe Result:', timeframeResult);
      
      if (!timeframeResult?.success || !timeframeResult?.data || !Array.isArray(timeframeResult.data)) {
        console.log('Debug - Data check failed:', {
          success: timeframeResult?.success,
          hasData: !!timeframeResult?.data,
          isArray: Array.isArray(timeframeResult?.data),
          dataLength: timeframeResult?.data?.length
        });
        throw new Error(`No fetched data available for ${symbol} ${timeframe}`);
      }

      // Process the fetched data
      const normalizedBars = processHistoricalDataBars(timeframeResult.data);

      const normalizedData: HistoricalData = {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe,
        bars: normalizedBars,
        source: timeframeResult.source || 'IB Gateway',
        count: normalizedBars.length,
        account_mode: effectiveAccountMode,
        last_updated: new Date().toISOString()
      };

      setBulkDisplayData(normalizedData);
      console.log(`Successfully displaying ${normalizedData.bars.length} fetched bars for ${symbol} ${timeframe}`);

    } catch (err) {
      console.error('Error displaying fetched bulk data:', err);
      setError(err instanceof Error ? err.message : 'Failed to display fetched bulk data');
      setBulkDisplayData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBulkDataForDisplay = async (symbol: string, timeframe: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setBulkDisplayData(null); // Clear previous data
      
      const response = await fetch(`/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=1Y&account_mode=${effectiveAccountMode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: HistoricalData = await response.json();
      
      // Validate and normalize the data
      if (!data || !data.bars || !Array.isArray(data.bars)) {
        throw new Error(`Invalid data format received from server for ${symbol} ${timeframe}`);
      }

      if (data.bars.length === 0) {
        throw new Error(`No data available for ${symbol} ${timeframe}. The data may not have been uploaded to the database yet.`);
      }

      // Normalize timestamp and numeric fields
      const normalizedBars = processHistoricalDataBars(data.bars);

      const normalizedData: HistoricalData = {
        ...data,
        bars: normalizedBars
      };

      setBulkDisplayData(normalizedData);
      console.log(`Successfully fetched ${normalizedData.bars.length} bars for ${symbol} ${timeframe}`);

    } catch (err) {
      console.error('Error fetching bulk data for display:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bulk data for display');
      setBulkDisplayData(null); // Ensure data is cleared on error
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced bulk collection function with improved completion detection
  const performBulkCollection = async (retryCount = 0) => {
    if (!dataQueryEnabled) {
      dataResetActions.setError('Data querying is disabled. Please enable the switch above.');
      return;
    }

    const symbolsArray = (config.bulkSymbols || '').split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    const timeframesArray = config.bulkTimeframes || [];
    
    if (symbolsArray.length === 0) {
      dataResetActions.setError('Please enter at least one symbol for bulk collection.');
      return;
    }

    if (timeframesArray.length === 0) {
      dataResetActions.setError('Please select at least one timeframe for bulk collection.');
      return;
    }

    setDownloadStatus({ 
      isDownloading: false, 
      isUploading: false, 
      isBulkCollecting: true, 
      isValidating: false,
      bulkProgress: retryCount > 0 ? `Retrying bulk collection... (Attempt ${retryCount + 1})` : 'Starting bulk collection...' 
    });
    setError(null);
    setBulkResults(null);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      const totalOperations = symbolsArray.length * timeframesArray.length;
      setDownloadStatus(prev => ({ 
        ...prev, 
        bulkProgress: `Initiating bulk collection for ${symbolsArray.length} symbols across ${timeframesArray.length} timeframes (${totalOperations} total operations)...` 
      }));

      // Enhanced request with better timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 1200000); // 20 minute timeout for bulk operations (longer for multiple symbols)

      setDownloadStatus(prev => ({ 
        ...prev, 
        bulkProgress: `Processing bulk collection request - this may take several minutes...` 
      }));

      const response = await fetch(`${apiUrl}/api/market-data/bulk-collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          symbols: symbolsArray,
          timeframes: timeframesArray,
          period: config.periodFilters.useDateRange ? 'CUSTOM' : config.periodFilters.period,
          start_date: config.periodFilters.startDate,
          end_date: config.periodFilters.endDate,
          account_mode: effectiveAccountMode,
          secType: config.exchangeFilters.secType,
          exchange: config.exchangeFilters.exchange,
          currency: config.exchangeFilters.currency
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bulk collection error:', errorText);
        
        if (response.status === 504) {
          throw new Error('Bulk collection timeout - operation is taking longer than expected. Please try with fewer symbols or timeframes.');
        } else if (response.status === 503) {
          throw new Error('IB service temporarily unavailable for bulk operations - please wait and try again');
        } else {
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
          } catch (jsonError) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
      }

      setDownloadStatus(prev => ({ 
        ...prev, 
        bulkProgress: `Processing bulk collection results...` 
      }));

      const result: BulkCollectionResult = await response.json();
      
      // Validate bulk collection result
      if (!result || !result.summary) {
        throw new Error('Invalid bulk collection result received from server');
      }

      console.log('Debug - Setting bulk results:', result);
      setBulkResults(result);
      setBulkData(result.results);
      console.log('Debug - Bulk results set, should be available for auto-display');
      
      const successRate = result.summary.total_operations > 0 
        ? (result.summary.successful_operations / result.summary.total_operations) * 100 
        : 0;
      
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false,
        bulkProgress: `Bulk collection completed: ${result.summary.successful_operations}/${result.summary.total_operations} operations successful (${successRate.toFixed(1)}%), ${result.summary.total_records_collected} total records fetched` 
      });

      console.log('Bulk collection completed successfully:', result.summary);

      // Auto-display the first successful result's fetched data
      if (result.summary.successful_operations > 0 && result.results) {
        console.log('Debug - Auto-display: Looking for successful results in:', result.results);
        
        const firstSuccessfulResult = Object.entries(result.results).find(([symbol, timeframes]) => 
          Object.values(timeframes as Record<string, any>).some((result: any) => result.success && result.records_fetched > 0)
        );
        
        if (firstSuccessfulResult) {
          const [symbol, timeframes] = firstSuccessfulResult;
          console.log('Debug - Auto-display: Found successful symbol:', symbol, 'with timeframes:', timeframes);
          
          const successfulTimeframe = Object.entries(timeframes as Record<string, any>).find(([_, result]: [string, any]) => 
            result.success && result.records_fetched > 0
          );
          
          if (successfulTimeframe) {
            const [timeframe] = successfulTimeframe;
            console.log(`Auto-displaying fetched data for ${symbol} ${timeframe}`);
            console.log('Debug - Auto-display: Timeframe result:', successfulTimeframe[1]);
            // Automatically display the first successful result's fetched data
            setTimeout(() => {
              displayFetchedBulkData(symbol, timeframe, result);
            }, 1000); // Small delay to ensure UI updates
          }
        } else {
          console.log('Debug - Auto-display: No successful results found');
        }
      }

    } catch (err) {
      console.error('Error in bulk collection:', err);
      
      // Enhanced retry logic with better error categorization
      if (retryCount < 2 && ( // Reduced retry count for bulk operations
        (err instanceof Error && err.message.includes('timeout')) ||
        (err instanceof Error && err.message.includes('taking longer than expected')) ||
        (err instanceof Error && err.message.includes('Service temporarily unavailable')) ||
        (err instanceof Error && err.name === 'AbortError')
      )) {
        const retryDelay = Math.min(30000 * (retryCount + 1), 60000); // Longer delays for bulk: 30s, 60s
        console.log(`Retrying bulk collection in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1}/2)`);
        setDownloadStatus(prev => ({ 
          ...prev, 
          bulkProgress: `Retrying bulk collection in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1}/2)` 
        }));
        setTimeout(() => {
          performBulkCollection(retryCount + 1);
        }, retryDelay);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to perform bulk collection');
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false,
        error: err instanceof Error ? err.message : 'Failed to perform bulk collection' 
      });
    }
  };

  // Fetch sample data for validation results
  const fetchValidationSampleData = async (symbol: string, timeframe: string) => {
    setSelectedValidationItem({ symbol, timeframe });
    setValidationSampleData(null);
    
    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=1M&account_mode=${effectiveAccountMode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && data.bars && Array.isArray(data.bars) && data.bars.length > 0) {
        // Take first 50 records as sample
        const sampleData = {
          ...data,
          bars: processHistoricalDataBars(data.bars.slice(0, 50))
        };
        setValidationSampleData(sampleData);
      } else {
        throw new Error('No sample data available');
      }

    } catch (err) {
      console.error('Error fetching validation sample data:', err);
      setError(`Failed to fetch sample data for ${symbol} ${timeframe}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Data validation function
  const performDataValidation = async () => {
    // Validate configuration
    const errors = validateDownloadConfig(config, 'validation');
    if (errors.length > 0) {
      dataResetActions.setError(errors[0]);
      return;
    }

    const symbolsArray = (config.bulkSymbols || '').split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    const timeframesArray = config.bulkTimeframes || [];

    // Reset DataframeViewer to default empty state
    dataResetActions.resetValidationData();

    setDownloadStatus({ 
      isDownloading: false, 
      isUploading: false, 
      isBulkCollecting: false, 
      isValidating: true,
      validationProgress: 'Starting data validation...' 
    });

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      setDownloadStatus(prev => ({ 
        ...prev, 
        validationProgress: `Validating data for ${symbolsArray.length} symbols across ${timeframesArray.length} timeframes...` 
      }));

      const response = await fetch(`${apiUrl}/api/market-data/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
        body: JSON.stringify({
          symbols: symbolsArray,
          timeframes: timeframesArray,
          start_date: config.periodFilters.startDate,
          end_date: config.periodFilters.endDate
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Validation error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ValidationResult = await response.json();
      setValidationResults(result);
      
      const successRate = (result.summary.valid_count / result.summary.total_validations) * 100;
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false,
        validationProgress: `Data validation completed: ${result.summary.valid_count}/${result.summary.total_validations} datasets valid (${successRate.toFixed(1)}%)` 
      });

    } catch (err) {
      console.error('Error in data validation:', err);
      setError(err instanceof Error ? err.message : 'Failed to perform data validation');
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false,
        error: err instanceof Error ? err.message : 'Failed to perform data validation' 
      });
    }
  };

  // Health check function
  const checkSystemHealth = async () => {
    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/market-data/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: HealthStatus = await response.json();
      setHealthStatus(result);

    } catch (err) {
      console.error('Error checking system health:', err);
      setHealthStatus({
        healthy: false,
        services: {
          database: false,
          ib_service: false
        }
      });
    }
  };

  // Save operation intervals to localStorage
  const saveOperationIntervals = (intervals: typeof operationIntervals) => {
    setOperationIntervals(intervals);
    if (typeof window !== 'undefined') {
      localStorage.setItem('download-page-operation-intervals', JSON.stringify(intervals));
    }
  };


  // Check health on component mount
  React.useEffect(() => {
    checkSystemHealth();
  }, []);

  // Helper function to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <BackToHome />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Download Historical Data</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Download data from IB API and load into PostgreSQL database</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ConnectionStatusIndicator showDetails={true} />
              {healthStatus && (
                <div className={`text-xs sm:text-sm px-2 py-1 rounded ${
                  healthStatus.healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {healthStatus.healthy ? '✅ System Healthy' : '⚠️ System Issues'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Data Query Switch */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border p-3 sm:p-4">
          <DataSwitch
            enabled={dataQueryEnabled}
            onToggle={handleDataSwitchToggle}
            label="IB Gateway Data Query"
            description="Enable or disable historical data fetching from IB Gateway"
            size="medium"
          />
        </div>

        {/* Operation Intervals Configuration */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border p-3 sm:p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">⏱️ Operation Interval Settings</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single Symbol Interval */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Single Symbol Download</h4>
                <div className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  📊 Manual Operation
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Recommended interval between downloads (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={operationIntervals.singleSymbol}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1800;
                      saveOperationIntervals({ ...operationIntervals, singleSymbol: value });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min: 60s (1 min) | Max: 86400s (24 hours) | Current: {Math.floor(operationIntervals.singleSymbol / 60)} minutes
                  </p>
                </div>
              </div>
            </div>

            {/* Bulk Collection Interval */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Bulk Collection</h4>
                <div className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                  📈 Manual Operation
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Recommended interval between bulk collections (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={operationIntervals.bulkCollection}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 7200;
                      saveOperationIntervals({ ...operationIntervals, bulkCollection: value });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min: 60s (1 min) | Max: 86400s (24 hours) | Current: {Math.floor(operationIntervals.bulkCollection / 60)} minutes
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>Manual Operation Mode:</strong> Use the "Download from IB API" and "Start Bulk Collection" buttons to manually trigger operations. 
              The interval settings above are recommendations to avoid overwhelming the IB Gateway.
            </p>
            <p className="text-xs text-amber-800 mt-2">
              <strong>⚠️ Important:</strong> IB Gateway operations can take 2-10 minutes to complete. Wait for operations to finish 
              before starting new ones, and respect the recommended intervals to maintain system stability.
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowBulkMode(false);
                setShowValidation(false);
                setShowDatabaseTest(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                !showBulkMode && !showValidation && !showDatabaseTest
                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } border`}
            >
              📊 Single Symbol
            </button>
            <button
              onClick={() => {
                setShowBulkMode(true);
                setShowValidation(false);
                setShowDatabaseTest(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                showBulkMode && !showValidation && !showDatabaseTest
                  ? 'bg-green-100 text-green-800 border-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } border`}
            >
              📈 Bulk Collection
            </button>
            <button
              onClick={() => {
                setShowValidation(true);
                setShowBulkMode(false);
                setShowDatabaseTest(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                showValidation && !showBulkMode && !showDatabaseTest
                  ? 'bg-purple-100 text-purple-800 border-purple-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } border`}
            >
              🔍 Data Validation
            </button>
            <button
              onClick={() => {
                setShowDatabaseTest(true);
                setShowBulkMode(false);
                setShowValidation(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                showDatabaseTest 
                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } border`}
            >
              🗄️ Database Test
            </button>
            <button
              onClick={checkSystemHealth}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 border"
            >
              🏥 Health Check
            </button>
          </div>
        </div>

        {/* Single Symbol Mode */}
        {!showBulkMode && !showValidation && !showDatabaseTest && (
          <div className="mb-6 sm:mb-8">
            <DownloadConfigPanel
              config={config}
              onConfigChange={handleConfigChange}
              mode="single"
              disabled={!dataQueryEnabled}
              timeframes={timeframes}
            />
            
            <div className="mt-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <DownloadActionButtons
                  mode="single"
                  status={downloadStatus as DownloadActionStatus}
                  disabled={!dataQueryEnabled}
                  hasData={!!(chartData?.bars?.length && chartData.bars.length > 0)}
                  onDownload={handleDownloadData}
                  onUpload={handleUploadData}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Collection Mode */}
        {showBulkMode && !showDatabaseTest && (
          <div className="mb-6 sm:mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Bulk Data Collection</h3>
            </div>
            
            <DownloadConfigPanel
              config={config}
              onConfigChange={handleConfigChange}
              mode="bulk"
              disabled={!dataQueryEnabled}
              timeframes={timeframes}
            />
            
            <div className="mt-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <DownloadActionButtons
                  mode="bulk"
                  status={downloadStatus as DownloadActionStatus}
                  disabled={!dataQueryEnabled}
                  hasBulkData={!!(bulkData && Object.keys(bulkData).length > 0)}
                  onBulkCollection={handleBulkCollection}
                  onBulkUpload={loadBulkDataToDatabase}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Collection DataframeViewer */}
        <DownloadDataViewer
          mode="bulk"
          data={bulkDisplayData?.bars ? processHistoricalDataBars(bulkDisplayData.bars) : null}
          title={bulkDisplayData ? `Bulk Collection Data - ${bulkDisplayData.symbol} (${bulkDisplayData.timeframe})` : undefined}
          description={bulkDisplayData?.bars?.length ? `${bulkDisplayData.bars.length} records from ${bulkDisplayData.source}` : undefined}
          isVisible={showBulkMode || downloadStatus.isBulkCollecting || !!(bulkDisplayData?.bars?.length) || !!bulkResults}
          onReset={() => dataResetActions.resetBulkData()}
        />

        {/* Data Validation Mode */}
        {showValidation && !showDatabaseTest && (
          <div className="mb-6 sm:mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🔍 Data Validation</h3>
            </div>
            
            <DownloadConfigPanel
              config={config}
              onConfigChange={handleConfigChange}
              mode="validation"
              disabled={false}
              timeframes={timeframes}
            />
            
            <div className="mt-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <DownloadActionButtons
                  mode="validation"
                  status={downloadStatus as DownloadActionStatus}
                  disabled={false}
                  onValidation={performDataValidation}
                />
              </div>
            </div>
          </div>
        )}

        {/* Data Validation DataframeViewer */}
        <DownloadDataViewer
          mode="validation"
          data={validationResults ? Object.entries(validationResults.results).flatMap(([symbol, timeframes]) =>
            Object.entries(timeframes as Record<string, any>).map(([timeframe, result]) => ({
              symbol,
              timeframe,
              status: result.valid ? 'Valid' : 'Invalid',
              record_count: result.record_count || 0,
              issues: result.issues ? result.issues.join('; ') : 'None',
              error: result.error || 'None',
              invalid_ohlc_count: result.invalid_ohlc_count || 0,
              zero_volume_count: result.zero_volume_count || 0,
              negative_price_count: result.negative_price_count || 0,
              has_gaps: result.has_gaps ? 'Yes' : 'No'
            }))
          ) : null}
          title="Validation Results Summary"
          description={validationResults ? `${validationResults.summary.total_validations} validation results across all symbols and timeframes` : undefined}
          isVisible={showValidation && !showDatabaseTest}
          onReset={() => dataResetActions.resetValidationData()}
        />

        {/* Database Connectivity Test Mode */}
        {showDatabaseTest && (
          <div className="mb-6 sm:mb-8">
            <DatabaseConnectivityTest
              onStatusChange={setDatabaseConnectivityStatus}
              autoRefresh={false}
              refreshInterval={30000}
            />
          </div>
        )}

        {/* Status Display */}
        {(downloadStatus.isDownloading || downloadStatus.isUploading || downloadStatus.isBulkCollecting || downloadStatus.isValidating || 
          downloadStatus.downloadProgress || downloadStatus.uploadProgress || downloadStatus.bulkProgress || 
          downloadStatus.validationProgress || downloadStatus.error) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {downloadStatus.isDownloading && <span className="text-blue-600">⏳</span>}
                {downloadStatus.isUploading && <span className="text-green-600">⏳</span>}
                {downloadStatus.isBulkCollecting && <span className="text-green-600">📈</span>}
                {downloadStatus.isValidating && <span className="text-purple-600">🔍</span>}
                {downloadStatus.error && <span className="text-red-600">⚠️</span>}
                {!downloadStatus.isDownloading && !downloadStatus.isUploading && !downloadStatus.isBulkCollecting && 
                 !downloadStatus.isValidating && !downloadStatus.error && <span className="text-green-600">✅</span>}
                <div>
                  {downloadStatus.isDownloading && <p className="text-sm text-blue-800">Downloading...</p>}
                  {downloadStatus.isUploading && <p className="text-sm text-green-800">Uploading...</p>}
                  {downloadStatus.isBulkCollecting && <p className="text-sm text-green-800">Bulk Collecting...</p>}
                  {downloadStatus.isValidating && <p className="text-sm text-purple-800">Validating...</p>}
                  {downloadStatus.error && <p className="text-sm text-red-800">{downloadStatus.error}</p>}
                  {downloadStatus.downloadProgress && !downloadStatus.isDownloading && !downloadStatus.error && (
                    <p className="text-sm text-blue-800">{downloadStatus.downloadProgress}</p>
                  )}
                  {downloadStatus.uploadProgress && !downloadStatus.isUploading && !downloadStatus.error && (
                    <p className="text-sm text-green-800">{downloadStatus.uploadProgress}</p>
                  )}
                  {downloadStatus.bulkProgress && !downloadStatus.isBulkCollecting && !downloadStatus.error && (
                    <p className="text-sm text-green-800">{downloadStatus.bulkProgress}</p>
                  )}
                  {downloadStatus.validationProgress && !downloadStatus.isValidating && !downloadStatus.error && (
                    <p className="text-sm text-purple-800">{downloadStatus.validationProgress}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={handleDownloadData}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Bulk Collection Results */}
        {bulkResults && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Bulk Collection Results</h3>
            
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 font-medium">Total Operations</p>
                <p className="text-blue-700 text-lg">{bulkResults.summary.total_operations}</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 font-medium">Successful</p>
                <p className="text-green-700 text-lg">{bulkResults.summary.successful_operations}</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 font-medium">Failed</p>
                <p className="text-red-700 text-lg">{bulkResults.summary.failed_operations}</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                <p className="text-purple-800 font-medium">Records Collected</p>
                <p className="text-purple-700 text-lg">{bulkResults.summary.total_records_collected}</p>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Detailed Results</h4>
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(bulkResults.results).map(([symbol, timeframes]) => (
                  <div key={symbol} className="border border-gray-200 rounded-md p-3 mb-3">
                    <h5 className="font-medium text-gray-800 mb-2">{symbol}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {Object.entries(timeframes as Record<string, any>).map(([timeframe, result]) => (
                        <div 
                          key={timeframe} 
                          className={`p-2 rounded text-sm ${
                            result.success 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <div className="font-medium">{timeframe}</div>
                          {result.success ? (
                            <div>
                              <div>✅ {result.records_fetched || 0} records fetched
                              {result.records_uploaded > 0 && <span className="text-xs text-green-600"> ({result.records_uploaded} uploaded)</span>}
                              {result.records_skipped > 0 && <span className="text-xs"> ({result.records_skipped} skipped)</span>}
                              </div>
                              <div className="mt-1 space-y-1">
                                {result.records_fetched > 0 && (
                                  <button
                                    onClick={() => displayFetchedBulkData(symbol, timeframe)}
                                    disabled={isLoading}
                                    className="block px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isLoading ? 'Loading...' : 'View Fetched Data'}
                                  </button>
                                )}
                                {result.records_uploaded > 0 && (
                                  <button
                                    onClick={() => fetchBulkDataForDisplay(symbol, timeframe)}
                                    disabled={isLoading}
                                    className="block px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isLoading ? 'Loading...' : 'View DB Data'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>❌ {result.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Errors Summary */}
            {bulkResults.summary.errors.length > 0 && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-800 mb-2">Errors ({bulkResults.summary.errors.length})</h4>
                <div className="max-h-32 overflow-y-auto">
                  {bulkResults.summary.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700 mb-1">• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Validation Results */}
        {validationResults && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🔍 Data Validation Results</h3>
            
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 font-medium">Total Validations</p>
                <p className="text-blue-700 text-lg">{validationResults.summary.total_validations}</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 font-medium">Valid</p>
                <p className="text-green-700 text-lg">{validationResults.summary.valid_count}</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 font-medium">Invalid</p>
                <p className="text-red-700 text-lg">{validationResults.summary.invalid_count}</p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 font-medium">Errors</p>
                <p className="text-yellow-700 text-lg">{validationResults.summary.error_count}</p>
              </div>
            </div>

            {/* Validation Summary Table using DataframeViewer */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-4">Validation Summary Table</h4>
              <div className="space-y-4">
                <DataframeViewer
                  data={Object.entries(validationResults.results).flatMap(([symbol, timeframes]) =>
                    Object.entries(timeframes as Record<string, any>).map(([timeframe, result]) => ({
                      symbol,
                      timeframe,
                      status: result.valid ? 'Valid' : 'Invalid',
                      record_count: result.record_count || 0,
                      issues: result.issues ? result.issues.join('; ') : 'None',
                      error: result.error || 'None',
                      invalid_ohlc_count: result.invalid_ohlc_count || 0,
                      zero_volume_count: result.zero_volume_count || 0,
                      negative_price_count: result.negative_price_count || 0,
                      has_gaps: result.has_gaps ? 'Yes' : 'No'
                    }))
                  )}
                  title="Validation Results Summary"
                  description={`${validationResults.summary.total_validations} validation results across all symbols and timeframes`}
                  maxHeight="400px"
                  showExport={true}
                  showPagination={true}
                  itemsPerPage={20}
                  emptyStateMessage="No data downloaded yet"
                  emptyStateSubMessage="Enter required symbols, time period, and timeframe, then click 'Validate Data Quality' to fetch data"
                />
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <p className="text-sm text-gray-600 mr-2">Quick Actions:</p>
                  {Object.entries(validationResults.results).flatMap(([symbol, timeframes]) =>
                    Object.entries(timeframes as Record<string, any>)
                      .filter(([, result]) => !result.valid && !result.error) // Only show for invalid results with data
                      .map(([timeframe, result]) => (
                        <button
                          key={`${symbol}-${timeframe}`}
                          onClick={() => fetchValidationSampleData(symbol, timeframe)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                          title={`View sample data for ${symbol} ${timeframe} (${result.record_count} records)`}
                        >
                          📊 {symbol} {timeframe}
                        </button>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Validation Details</h4>
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(validationResults.results).map(([symbol, timeframes]) => (
                  <div key={symbol} className="border border-gray-200 rounded-md p-3 mb-3">
                    <h5 className="font-medium text-gray-800 mb-2">{symbol}</h5>
                    <div className="space-y-2">
                      {Object.entries(timeframes as Record<string, any>).map(([timeframe, result]) => (
                        <div key={timeframe} className="border-l-4 border-gray-200 pl-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{timeframe}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              result.valid 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.valid ? '✅ Valid' : '❌ Invalid'}
                            </span>
                          </div>
                          {result.record_count !== undefined && (
                            <p className="text-sm text-gray-600">Records: {result.record_count}</p>
                          )}
                          {result.issues && result.issues.length > 0 && (
                            <div className="mt-1">
                              {result.issues.map((issue: string, index: number) => (
                                <p key={index} className="text-xs text-red-600">• {issue}</p>
                              ))}
                            </div>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-600 mt-1">Error: {result.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Validation Sample Data Viewer */}
        {validationSampleData && selectedValidationItem && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                📊 Sample Data - {selectedValidationItem.symbol} ({selectedValidationItem.timeframe})
              </h3>
              <button
                onClick={() => {
                  setValidationSampleData(null);
                  setSelectedValidationItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
            
            <DataframeViewer
              data={processHistoricalDataBars(validationSampleData.bars)}
              title={`Sample Data - ${selectedValidationItem.symbol} ${selectedValidationItem.timeframe}`}
              description={validationSampleData?.bars?.length ? `${validationSampleData.bars.length} sample records from ${validationSampleData.source} | Account: ${validationSampleData.account_mode}` : undefined}
              maxHeight="500px"
              showExport={true}
              showPagination={true}
              itemsPerPage={25}
              emptyStateMessage="No data downloaded yet"
              emptyStateSubMessage="Click on a validation result to view sample data"
            />
          </div>
        )}

        {/* Health Status Display */}
        {healthStatus && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🏥 System Health Status</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-md border ${
                healthStatus.healthy 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className={healthStatus.healthy ? 'text-green-600' : 'text-red-600'}>
                    {healthStatus.healthy ? '✅' : '❌'}
                  </span>
                  <span className={`font-medium ${
                    healthStatus.healthy ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Overall System
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  healthStatus.healthy ? 'text-green-700' : 'text-red-700'
                }`}>
                  {healthStatus.healthy ? 'All services operational' : 'Some services have issues'}
                </p>
              </div>

              <div className={`p-4 rounded-md border ${
                healthStatus.services.database 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className={healthStatus.services.database ? 'text-green-600' : 'text-red-600'}>
                    {healthStatus.services.database ? '✅' : '❌'}
                  </span>
                  <span className={`font-medium ${
                    healthStatus.services.database ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Database
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  healthStatus.services.database ? 'text-green-700' : 'text-red-700'
                }`}>
                  {healthStatus.services.database ? 'Connected' : 'Connection failed'}
                </p>
              </div>

              <div className={`p-4 rounded-md border ${
                healthStatus.services.ib_service 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className={healthStatus.services.ib_service ? 'text-green-600' : 'text-red-600'}>
                    {healthStatus.services.ib_service ? '✅' : '❌'}
                  </span>
                  <span className={`font-medium ${
                    healthStatus.services.ib_service ? 'text-green-800' : 'text-red-800'
                  }`}>
                    IB Service
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  healthStatus.services.ib_service ? 'text-green-700' : 'text-red-700'
                }`}>
                  {healthStatus.services.ib_service ? 'Connected' : 'Connection failed'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Display */}
        <div className="space-y-6">
          {/* Data Summary */}
          {chartData?.bars?.length && chartData.bars.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Downloaded Data: {chartData.symbol}
                </h2>
                <div className="text-sm text-gray-500">
                  {config.exchangeFilters.exchange} - {config.exchangeFilters.secType} | Timeframe: {timeframes.find(tf => tf.value === config.timeframe)?.label}
                  {chartData.last_updated && (
                    <span className="ml-4">
                      Last update: {formatTime(new Date(chartData.last_updated))}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 font-medium">Records Downloaded</p>
                  <p className="text-green-700">{chartData?.bars?.length || 0}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 font-medium">Data Source</p>
                  <p className="text-blue-700">{chartData.source}</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                  <p className="text-purple-800 font-medium">Account Mode</p>
                  <p className="text-purple-700">{chartData.account_mode}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Dataframe Viewer */}
          <DownloadDataViewer
            mode="single"
            data={chartData?.bars ? processHistoricalDataBars(chartData.bars) : null}
            title={chartData ? `Historical Data - ${chartData.symbol}` : undefined}
            description={chartData?.bars?.length ? `${chartData.bars.length} records from ${chartData.source} | Timeframe: ${timeframes.find(tf => tf.value === config.timeframe)?.label}` : undefined}
            isVisible={!showBulkMode && !showValidation && !showDatabaseTest}
            onReset={() => dataResetActions.resetSingleSymbolData()}
          />
        </div>

      </main>
    </div>
  );
}
