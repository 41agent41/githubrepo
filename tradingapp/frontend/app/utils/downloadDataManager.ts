// Centralized data management utilities for download page features

export interface DownloadDataState {
  // Single symbol data
  chartData: any | null;
  
  // Bulk collection data
  bulkResults: any | null;
  bulkData: Record<string, Record<string, any>> | null;
  bulkDisplayData: any | null;
  
  // Validation data
  validationResults: any | null;
  validationSampleData: any | null;
  selectedValidationItem: {symbol: string, timeframe: string} | null;
  
  // Common error state
  error: string | null;
}

export type DownloadDataActions = {
  resetSingleSymbolData: () => void;
  resetBulkData: () => void;
  resetValidationData: () => void;
  resetAllData: () => void;
  setError: (error: string | null) => void;
};

// Create reset functions for different features
export const createDataResetFunctions = (
  setState: React.Dispatch<React.SetStateAction<any>>
): DownloadDataActions => {
  
  const resetSingleSymbolData = () => {
    setState((prev: any) => ({
      ...prev,
      chartData: null,
      error: null
    }));
  };

  const resetBulkData = () => {
    setState((prev: any) => ({
      ...prev,
      bulkResults: null,
      bulkData: null,
      bulkDisplayData: null,
      error: null
    }));
  };

  const resetValidationData = () => {
    setState((prev: any) => ({
      ...prev,
      validationResults: null,
      validationSampleData: null,
      selectedValidationItem: null,
      error: null
    }));
  };

  const resetAllData = () => {
    setState((prev: any) => ({
      ...prev,
      chartData: null,
      bulkResults: null,
      bulkData: null,
      bulkDisplayData: null,
      validationResults: null,
      validationSampleData: null,
      selectedValidationItem: null,
      error: null
    }));
  };

  const setError = (error: string | null) => {
    setState((prev: any) => ({
      ...prev,
      error
    }));
  };

  return {
    resetSingleSymbolData,
    resetBulkData,
    resetValidationData,
    resetAllData,
    setError
  };
};

// Utility functions for data processing
export const processHistoricalDataBars = (bars: any[]) => {
  if (!bars || !Array.isArray(bars)) return [];
  
  return bars.map(bar => ({
    timestamp: bar.timestamp || bar.time,
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: Number(bar.volume || 0)
    // WAP and count columns removed as per existing pattern
  }));
};

// Validation helpers
export const validateDownloadConfig = (config: any, mode: 'single' | 'bulk' | 'validation') => {
  const errors: string[] = [];

  if (mode === 'single') {
    if (!config.exchangeFilters?.symbol?.trim()) {
      errors.push('Please select a valid symbol');
    }
    if (!config.timeframe) {
      errors.push('Please select a timeframe');
    }
  }

  if (mode === 'bulk' || mode === 'validation') {
    const symbolsArray = config.bulkSymbols?.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => s.length > 0) || [];
    
    if (symbolsArray.length === 0) {
      errors.push(`Please enter at least one symbol for ${mode === 'bulk' ? 'bulk collection' : 'validation'}.`);
    }

    if (!config.bulkTimeframes || config.bulkTimeframes.length === 0) {
      errors.push(`Please select at least one timeframe for ${mode === 'bulk' ? 'bulk collection' : 'validation'}.`);
    }
  }

  return errors;
};
