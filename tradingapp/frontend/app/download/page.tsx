'use client';

import React, { useState, useEffect } from 'react';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import DataSwitch from '../components/DataSwitch';
import DataframeViewer from '../components/DataframeViewer';
import BackToHome from '../components/BackToHome';
import ExchangeDrivenFilters from '../components/ExchangeDrivenFilters';
import PeriodDateFilters from '../components/PeriodDateFilters';
import DatabaseConnectivityTest from '../components/DatabaseConnectivityTest';

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

interface TimerConfig {
  enabled: boolean;
  interval: number; // in seconds
  lastExecution?: Date;
  nextExecution?: Date;
}

interface TimerStatus {
  singleSymbol: TimerConfig;
  bulkCollection: TimerConfig;
}

export default function DownloadPage() {
  const { isLiveTrading, accountMode, dataType } = useTradingAccount();
  
  // Enhanced filter state
  const [exchangeFilters, setExchangeFilters] = useState({
    region: 'US' as 'US' | 'AU',
    exchange: 'SMART',
    secType: 'STK',
    symbol: 'MSFT',
    currency: 'USD',
    searchTerm: ''
  });
  
  const [periodFilters, setPeriodFilters] = useState<{
    period: string;
    startDate?: string;
    endDate?: string;
    useDateRange: boolean;
  }>({
    period: '3M',
    startDate: undefined,
    endDate: undefined,
    useDateRange: false
  });
  
  const [timeframe, setTimeframe] = useState('1hour');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<HistoricalData | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    isDownloading: false,
    isUploading: false,
    isBulkCollecting: false,
    isValidating: false
  });
  
  // New state for enhanced features
  const [bulkSymbols, setBulkSymbols] = useState('MSFT,AAPL,GOOGL,AMZN,TSLA');
  const [bulkTimeframes, setBulkTimeframes] = useState(['1day', '1hour']);
  const [bulkResults, setBulkResults] = useState<BulkCollectionResult | null>(null);
  const [bulkData, setBulkData] = useState<Record<string, Record<string, any>> | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [showBulkMode, setShowBulkMode] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showDatabaseTest, setShowDatabaseTest] = useState(false);
  const [databaseConnectivityStatus, setDatabaseConnectivityStatus] = useState<any>(null);
  
  // Timer configuration state
  const [timerStatus, setTimerStatus] = useState<TimerStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('download-page-timer-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          singleSymbol: {
            ...parsed.singleSymbol,
            lastExecution: parsed.singleSymbol.lastExecution ? new Date(parsed.singleSymbol.lastExecution) : undefined,
            nextExecution: parsed.singleSymbol.nextExecution ? new Date(parsed.singleSymbol.nextExecution) : undefined
          },
          bulkCollection: {
            ...parsed.bulkCollection,
            lastExecution: parsed.bulkCollection.lastExecution ? new Date(parsed.bulkCollection.lastExecution) : undefined,
            nextExecution: parsed.bulkCollection.nextExecution ? new Date(parsed.bulkCollection.nextExecution) : undefined
          }
        };
      }
    }
    return {
      singleSymbol: { enabled: false, interval: 1800 }, // 30 minutes in seconds
      bulkCollection: { enabled: false, interval: 7200 } // 120 minutes in seconds
    };
  });
  
  // Timer intervals state (in seconds)
  const [timerIntervals, setTimerIntervals] = useState({
    singleSymbol: 1800, // 30 minutes
    bulkCollection: 7200 // 120 minutes
  });
  
  // Real-time countdown state
  const [countdown, setCountdown] = useState({
    singleSymbol: '',
    bulkCollection: ''
  });
  
  // Data query switch state
  const [dataQueryEnabled, setDataQueryEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('download-page-data-enabled');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  // Updated timeframes to match backend API expectations
  const timeframes = [
    { label: 'Tick Data', value: 'tick' },
    { label: '1 Minute', value: '1min' },
    { label: '5 Minutes', value: '5min' },
    { label: '15 Minutes', value: '15min' },
    { label: '30 Minutes', value: '30min' },
    { label: '1 Hour', value: '1hour' },
    { label: '4 Hours', value: '4hour' },
    { label: '8 Hours', value: '8hour' },
    { label: '1 Day', value: '1day' }
  ];

  // Handle data switch toggle
  const handleDataSwitchToggle = (enabled: boolean) => {
    setDataQueryEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('download-page-data-enabled', JSON.stringify(enabled));
    }
    if (!enabled) {
      setError(null);
      setChartData(null);
    }
  };

  // Fetch historical data from IB API with retry logic
  const fetchHistoricalData = async (retryCount = 0) => {
    if (!dataQueryEnabled) {
      console.log('Data querying disabled');
      setIsLoading(false);
      return;
    }
    
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      // Build query parameters
      const params = new URLSearchParams({
        symbol: exchangeFilters.symbol,
        timeframe: timeframe,
        period: periodFilters.useDateRange ? 'CUSTOM' : periodFilters.period,
        account_mode: accountMode,
        secType: exchangeFilters.secType,
        exchange: exchangeFilters.exchange,
        currency: exchangeFilters.currency
      });

      // Add date range if using custom dates
      if (periodFilters.useDateRange && periodFilters.startDate && periodFilters.endDate) {
        params.append('start_date', periodFilters.startDate);
        params.append('end_date', periodFilters.endDate);
      }

      const url = `${apiUrl}/api/market-data/history?${params.toString()}`;
      
      console.log('Fetching historical data:', url);
      
      setDownloadStatus(prev => ({ ...prev, downloadProgress: 'Fetching data from IB Gateway...' }));
      
      const response = await fetch(url, {
        headers: { 
          'X-Data-Query-Enabled': 'true',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(300000) // 5 minute timeout for IB Gateway
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        
        if (response.status === 504) {
          throw new Error('Gateway timeout - IB service busy, please try again');
        } else if (response.status === 503) {
          throw new Error('Service temporarily unavailable, please try again');
        } else if (response.status === 500) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.detail && errorData.detail.includes('subscription')) {
              throw new Error('Using delayed market data - real-time subscription not available');
            } else if (errorData.detail && errorData.detail.includes('timeout')) {
              throw new Error('IB Gateway timeout - please try again');
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

      const data: HistoricalData = await response.json();
      console.log('Historical data received:', data);
      
      if (!data.bars || !Array.isArray(data.bars)) {
        throw new Error('No bars data received from API');
      }

      console.log('Received', data.bars.length, 'bars');

      setChartData(data);
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false, 
        downloadProgress: `Successfully downloaded ${data.bars.length} records` 
      });
      console.log('Historical data downloaded successfully');
      
      // Schedule next execution if timer is enabled
      if (timerStatus.singleSymbol.enabled) {
        scheduleNextExecution('singleSymbol');
      }

    } catch (err) {
      console.error('Error fetching historical data:', err);
      
      // Retry logic for timeout and connection issues
      if (retryCount < 3 && (
        (err instanceof Error && err.message.includes('timeout')) ||
        (err instanceof Error && err.message.includes('Gateway timeout')) ||
        (err instanceof Error && err.message.includes('Service temporarily unavailable')) ||
        (err instanceof Error && err.message.includes('No data received'))
      )) {
        const retryDelay = Math.min(10000 * (retryCount + 1), 30000); // Progressive delay: 10s, 20s, 30s
        console.log(`Retrying in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1})`);
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
    }
  };

  // Load data into PostgreSQL database
  const loadDataToDatabase = async () => {
    if (!chartData || !chartData.bars || chartData.bars.length === 0) {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

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
          secType: exchangeFilters.secType,
          exchange: exchangeFilters.exchange,
          currency: exchangeFilters.currency
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
        uploadProgress: `Successfully uploaded ${result.uploaded_count || chartData.bars.length} records to database` 
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
      setError('Data querying is disabled. Please enable the switch above.');
      return;
    }
    
    if (!exchangeFilters.symbol.trim()) {
      setError('Please select a valid symbol');
      return;
    }
    
    fetchHistoricalData();
    
    // If timer is enabled, schedule next execution
    if (timerStatus.singleSymbol.enabled) {
      scheduleNextExecution('singleSymbol');
    }
  };

  // Handle bulk collection button click
  const handleBulkCollection = () => {
    performBulkCollection();
  };

  // Handle upload button click
  const handleUploadData = () => {
    if (!chartData || !chartData.bars || chartData.bars.length === 0) {
      setError('No data available to upload. Please download data first.');
      return;
    }
    
    loadDataToDatabase();
  };

  // Load bulk collection data to PostgreSQL database
  const loadBulkDataToDatabase = async () => {
    if (!bulkData || Object.keys(bulkData).length === 0) {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      setDownloadStatus(prev => ({ ...prev, uploadProgress: 'Uploading bulk data to PostgreSQL...' }));

      const response = await fetch(`${apiUrl}/api/market-data/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
        body: JSON.stringify({
          bulkData: bulkData,
          account_mode: accountMode,
          secType: exchangeFilters.secType,
          exchange: exchangeFilters.exchange,
          currency: exchangeFilters.currency
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

  // Bulk collection function with retry logic
  const performBulkCollection = async (retryCount = 0) => {
    if (!dataQueryEnabled) {
      setError('Data querying is disabled. Please enable the switch above.');
      return;
    }

    const symbolsArray = bulkSymbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    
    if (symbolsArray.length === 0) {
      setError('Please enter at least one symbol for bulk collection.');
      return;
    }

    if (bulkTimeframes.length === 0) {
      setError('Please select at least one timeframe for bulk collection.');
      return;
    }
    
    // If timer is enabled, schedule next execution
    if (timerStatus.bulkCollection.enabled) {
      scheduleNextExecution('bulkCollection');
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      setDownloadStatus(prev => ({ 
        ...prev, 
        bulkProgress: `Collecting data for ${symbolsArray.length} symbols across ${bulkTimeframes.length} timeframes...` 
      }));

      const response = await fetch(`${apiUrl}/api/market-data/bulk-collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true'
        },
        signal: AbortSignal.timeout(600000), // 10 minute timeout for bulk operations
        body: JSON.stringify({
          symbols: symbolsArray,
          timeframes: bulkTimeframes,
          period: periodFilters.useDateRange ? 'CUSTOM' : periodFilters.period,
          start_date: periodFilters.startDate,
          end_date: periodFilters.endDate,
          account_mode: accountMode,
          secType: exchangeFilters.secType,
          exchange: exchangeFilters.exchange,
          currency: exchangeFilters.currency
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bulk collection error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: BulkCollectionResult = await response.json();
      setBulkResults(result);
      setBulkData(result.results);
      
      const successRate = (result.summary.successful_operations / result.summary.total_operations) * 100;
      setDownloadStatus({ 
        isDownloading: false, 
        isUploading: false, 
        isBulkCollecting: false, 
        isValidating: false,
        bulkProgress: `Bulk collection completed: ${result.summary.successful_operations}/${result.summary.total_operations} operations successful (${successRate.toFixed(1)}%)` 
      });
      
      // Schedule next execution if timer is enabled
      if (timerStatus.bulkCollection.enabled) {
        scheduleNextExecution('bulkCollection');
      }

    } catch (err) {
      console.error('Error in bulk collection:', err);
      
      // Retry logic for timeout and connection issues
      if (retryCount < 3 && (
        (err instanceof Error && err.message.includes('timeout')) ||
        (err instanceof Error && err.message.includes('Gateway timeout')) ||
        (err instanceof Error && err.message.includes('Service temporarily unavailable')) ||
        (err instanceof Error && err.message.includes('No data received'))
      )) {
        const retryDelay = Math.min(15000 * (retryCount + 1), 45000); // Progressive delay: 15s, 30s, 45s
        console.log(`Retrying bulk collection in ${retryDelay/1000} seconds... (Attempt ${retryCount + 1})`);
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

  // Data validation function
  const performDataValidation = async () => {
    const symbolsArray = bulkSymbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    
    if (symbolsArray.length === 0) {
      setError('Please enter at least one symbol for validation.');
      return;
    }

    if (bulkTimeframes.length === 0) {
      setError('Please select at least one timeframe for validation.');
      return;
    }

    setDownloadStatus({ 
      isDownloading: false, 
      isUploading: false, 
      isBulkCollecting: false, 
      isValidating: true,
      validationProgress: 'Starting data validation...' 
    });
    setError(null);
    setValidationResults(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      setDownloadStatus(prev => ({ 
        ...prev, 
        validationProgress: `Validating data for ${symbolsArray.length} symbols across ${bulkTimeframes.length} timeframes...` 
      }));

      const response = await fetch(`${apiUrl}/api/market-data/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbols: symbolsArray,
          timeframes: bulkTimeframes,
          start_date: periodFilters.startDate,
          end_date: periodFilters.endDate
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

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

  // Timer management functions
  const saveTimerConfig = (config: TimerStatus) => {
    setTimerStatus(config);
    if (typeof window !== 'undefined') {
      localStorage.setItem('download-page-timer-config', JSON.stringify(config));
    }
  };

  const updateTimerConfig = (type: 'singleSymbol' | 'bulkCollection', updates: Partial<TimerConfig>) => {
    const newConfig = {
      ...timerStatus,
      [type]: { ...timerStatus[type], ...updates }
    };
    saveTimerConfig(newConfig);
  };

  const scheduleNextExecution = (type: 'singleSymbol' | 'bulkCollection') => {
    if (!timerStatus[type].enabled) return;
    
    const interval = timerStatus[type].interval;
    const nextExecution = new Date(Date.now() + interval * 1000); // Convert seconds to milliseconds
    
    updateTimerConfig(type, {
      nextExecution
    });
  };

  const executeTimerOperation = async (type: 'singleSymbol' | 'bulkCollection') => {
    const now = new Date();
    updateTimerConfig(type, { lastExecution: now });
    
    if (type === 'singleSymbol') {
      await fetchHistoricalData();
    } else if (type === 'bulkCollection') {
      await performBulkCollection();
    }
    
    // Schedule next execution
    scheduleNextExecution(type);
  };

  // Timer effect for single symbol operations
  React.useEffect(() => {
    if (!timerStatus.singleSymbol.enabled || !timerStatus.singleSymbol.nextExecution) {
      return;
    }

    const now = new Date();
    const timeUntilNext = timerStatus.singleSymbol.nextExecution.getTime() - now.getTime();

    if (timeUntilNext <= 0) {
      executeTimerOperation('singleSymbol');
      return;
    }

    const timeoutId = setTimeout(() => {
      executeTimerOperation('singleSymbol');
    }, timeUntilNext);

    return () => clearTimeout(timeoutId);
  }, [timerStatus.singleSymbol.enabled, timerStatus.singleSymbol.nextExecution]);

  // Timer effect for bulk collection operations
  React.useEffect(() => {
    if (!timerStatus.bulkCollection.enabled || !timerStatus.bulkCollection.nextExecution) {
      return;
    }

    const now = new Date();
    const timeUntilNext = timerStatus.bulkCollection.nextExecution.getTime() - now.getTime();

    if (timeUntilNext <= 0) {
      executeTimerOperation('bulkCollection');
      return;
    }

    const timeoutId = setTimeout(() => {
      executeTimerOperation('bulkCollection');
    }, timeUntilNext);

    return () => clearTimeout(timeoutId);
  }, [timerStatus.bulkCollection.enabled, timerStatus.bulkCollection.nextExecution]);

  // Real-time countdown update effect
  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      
      setCountdown({
        singleSymbol: timerStatus.singleSymbol.enabled && timerStatus.singleSymbol.nextExecution 
          ? formatTimeRemaining(timerStatus.singleSymbol.nextExecution)
          : '',
        bulkCollection: timerStatus.bulkCollection.enabled && timerStatus.bulkCollection.nextExecution 
          ? formatTimeRemaining(timerStatus.bulkCollection.nextExecution)
          : ''
      });
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [timerStatus.singleSymbol.enabled, timerStatus.singleSymbol.nextExecution, 
      timerStatus.bulkCollection.enabled, timerStatus.bulkCollection.nextExecution]);

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

  // Helper function to format time remaining
  const formatTimeRemaining = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) return 'Now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
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
              <div className="text-xs sm:text-sm text-gray-500">
                {isLiveTrading ? 'Live Trading Mode' : 'Paper Trading Mode'}
              </div>
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

        {/* Timer Configuration */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-sm border p-3 sm:p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">⏰ Auto-Execution Timer Configuration</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single Symbol Timer */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Single Symbol Download</h4>
                <div className={`px-2 py-1 rounded text-xs ${
                  timerStatus.singleSymbol.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {timerStatus.singleSymbol.enabled ? '🟢 Auto-Executing' : '⚪ Disabled'}
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Auto-execution interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={timerIntervals.singleSymbol}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1800;
                      setTimerIntervals(prev => ({ ...prev, singleSymbol: value }));
                      updateTimerConfig('singleSymbol', { interval: value });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min: 60s (1 min) | Max: 86400s (24 hours)
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateTimerConfig('singleSymbol', { enabled: true })}
                    disabled={!dataQueryEnabled || timerStatus.singleSymbol.enabled}
                    className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enable Auto-Execution
                  </button>
                  <button
                    onClick={() => updateTimerConfig('singleSymbol', { enabled: false, nextExecution: undefined })}
                    disabled={!timerStatus.singleSymbol.enabled}
                    className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disable Auto-Execution
                  </button>
                </div>
                
                {timerStatus.singleSymbol.enabled && timerStatus.singleSymbol.nextExecution && (
                  <div className="text-xs text-gray-600">
                    <div>Next execution: {formatTime(timerStatus.singleSymbol.nextExecution)}</div>
                    <div className="font-medium text-blue-600">Time remaining: {countdown.singleSymbol}</div>
                    {timerStatus.singleSymbol.lastExecution && (
                      <div>Last execution: {formatTime(timerStatus.singleSymbol.lastExecution)}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bulk Collection Timer */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Bulk Collection</h4>
                <div className={`px-2 py-1 rounded text-xs ${
                  timerStatus.bulkCollection.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {timerStatus.bulkCollection.enabled ? '🟢 Auto-Executing' : '⚪ Disabled'}
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Auto-execution interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={timerIntervals.bulkCollection}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 7200;
                      setTimerIntervals(prev => ({ ...prev, bulkCollection: value }));
                      updateTimerConfig('bulkCollection', { interval: value });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min: 60s (1 min) | Max: 86400s (24 hours)
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateTimerConfig('bulkCollection', { enabled: true })}
                    disabled={!dataQueryEnabled || timerStatus.bulkCollection.enabled}
                    className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enable Auto-Execution
                  </button>
                  <button
                    onClick={() => updateTimerConfig('bulkCollection', { enabled: false, nextExecution: undefined })}
                    disabled={!timerStatus.bulkCollection.enabled}
                    className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disable Auto-Execution
                  </button>
                </div>
                
                {timerStatus.bulkCollection.enabled && timerStatus.bulkCollection.nextExecution && (
                  <div className="text-xs text-gray-600">
                    <div>Next execution: {formatTime(timerStatus.bulkCollection.nextExecution)}</div>
                    <div className="font-medium text-blue-600">Time remaining: {countdown.bulkCollection}</div>
                    {timerStatus.bulkCollection.lastExecution && (
                      <div>Last execution: {formatTime(timerStatus.bulkCollection.lastExecution)}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>Auto-Execution Mode:</strong> When enabled, timers will automatically execute "Download from IB API" 
              and "Start Bulk Collection" operations at your configured intervals. Operations will continue automatically 
              after each completion. Timer configurations are saved automatically.
            </p>
            <p className="text-xs text-amber-800 mt-2">
              <strong>⚠️ Important:</strong> IB Gateway operations can take 2-10 minutes to complete. Set timer intervals 
              to at least 30 minutes for single symbols and 2 hours for bulk collection to avoid overlapping operations.
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
          <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Exchange-Driven Filters */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Market & Symbol</h3>
                <ExchangeDrivenFilters
                  onFiltersChange={setExchangeFilters}
                  disabled={!dataQueryEnabled}
                />
              </div>

              {/* Period & Date Filters */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Time Period</h3>
                <PeriodDateFilters
                  onFiltersChange={setPeriodFilters}
                  disabled={!dataQueryEnabled}
                />
              </div>

              {/* Timeframe & Actions */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Download Settings</h3>
                  
                  {/* Timeframe Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeframe
                    </label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!dataQueryEnabled}
                    >
                      {timeframes.map((tf) => (
                        <option key={tf.value} value={tf.value}>
                          {tf.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleDownloadData}
                      disabled={isLoading || !dataQueryEnabled || downloadStatus.isDownloading}
                      className="w-full px-4 py-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {downloadStatus.isDownloading ? 'Downloading...' : 'Download from IB API'}
                    </button>
                    
                    <button
                      onClick={handleUploadData}
                      disabled={!chartData || !chartData.bars || chartData.bars.length === 0 || downloadStatus.isUploading}
                      className="w-full px-4 py-3 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {downloadStatus.isUploading ? 'Uploading...' : 'Load to PostgreSQL'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Collection Mode */}
        {showBulkMode && !showDatabaseTest && (
          <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Bulk Data Collection</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Symbols Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbols (comma-separated)
                </label>
                <textarea
                  value={bulkSymbols}
                  onChange={(e) => setBulkSymbols(e.target.value)}
                  placeholder="MSFT,AAPL,GOOGL,AMZN,TSLA"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  disabled={!dataQueryEnabled}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter symbols separated by commas (e.g., MSFT,AAPL,GOOGL)
                </p>
              </div>

              {/* Timeframes Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframes
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {timeframes.map((tf) => (
                    <label key={tf.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={bulkTimeframes.includes(tf.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkTimeframes([...bulkTimeframes, tf.value]);
                          } else {
                            setBulkTimeframes(bulkTimeframes.filter(t => t !== tf.value));
                          }
                        }}
                        disabled={!dataQueryEnabled}
                        className="rounded"
                      />
                      <span className="text-sm">{tf.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Period Selection for Bulk */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Time Period</h4>
              <PeriodDateFilters
                onFiltersChange={setPeriodFilters}
                disabled={!dataQueryEnabled}
              />
            </div>

            {/* Bulk Action Buttons */}
            <div className="mt-6 flex space-x-4">
              <button
                onClick={handleBulkCollection}
                disabled={!dataQueryEnabled || downloadStatus.isBulkCollecting}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {downloadStatus.isBulkCollecting ? 'Collecting...' : 'Start Bulk Collection'}
              </button>
              <button
                onClick={loadBulkDataToDatabase}
                disabled={!bulkData || Object.keys(bulkData).length === 0 || downloadStatus.isUploading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {downloadStatus.isUploading ? 'Uploading...' : 'Load to PostgreSQL'}
              </button>
            </div>
          </div>
        )}

        {/* Data Validation Mode */}
        {showValidation && !showDatabaseTest && (
          <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🔍 Data Validation</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Symbols Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbols to Validate
                </label>
                <textarea
                  value={bulkSymbols}
                  onChange={(e) => setBulkSymbols(e.target.value)}
                  placeholder="MSFT,AAPL,GOOGL,AMZN,TSLA"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter symbols to validate (comma-separated)
                </p>
              </div>

              {/* Timeframes Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframes to Validate
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {timeframes.map((tf) => (
                    <label key={tf.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={bulkTimeframes.includes(tf.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkTimeframes([...bulkTimeframes, tf.value]);
                          } else {
                            setBulkTimeframes(bulkTimeframes.filter(t => t !== tf.value));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{tf.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Date Range for Validation */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Validation Period</h4>
              <PeriodDateFilters
                onFiltersChange={setPeriodFilters}
                disabled={false}
              />
            </div>

            {/* Validation Action Button */}
            <div className="mt-6">
              <button
                onClick={performDataValidation}
                disabled={downloadStatus.isValidating}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {downloadStatus.isValidating ? 'Validating...' : 'Validate Data Quality'}
              </button>
            </div>
          </div>
        )}

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
                              ✅ {result.records_uploaded} records
                              {result.records_skipped > 0 && <span className="text-xs"> ({result.records_skipped} skipped)</span>}
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
        {chartData && chartData.bars && chartData.bars.length > 0 ? (
          <div className="space-y-6">
            {/* Data Summary */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Downloaded Data: {chartData.symbol}
                </h2>
                <div className="text-sm text-gray-500">
                  {exchangeFilters.exchange} - {exchangeFilters.secType} | Timeframe: {timeframes.find(tf => tf.value === timeframe)?.label}
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
                  <p className="text-green-700">{chartData.bars.length}</p>
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
            
                         {/* Dataframe Viewer */}
             <DataframeViewer
               data={chartData.bars.map(bar => ({
                 timestamp: bar.timestamp,
                 open: bar.open,
                 high: bar.high,
                 low: bar.low,
                 close: bar.close,
                 volume: bar.volume,
                 wap: bar.wap,
                 count: bar.count
               }))}
               title={`Historical Data - ${chartData.symbol}`}
               description={`${chartData.bars.length} records from ${chartData.source} | Timeframe: ${timeframes.find(tf => tf.value === timeframe)?.label}`}
               maxHeight="600px"
               showExport={true}
               showPagination={true}
               itemsPerPage={25}
             />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-600">No data downloaded yet</p>
              <p className="text-sm text-gray-500 mt-2">
                {dataQueryEnabled 
                  ? `Select market, symbol, and timeframe, then click "Download from IB API" to fetch data`
                  : 'Enable data querying to download historical data from IB Gateway'
                }
              </p>
              {!dataQueryEnabled && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    Data querying is currently disabled. Enable the switch above to connect to IB Gateway.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
