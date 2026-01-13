'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { getApiUrl } from '../../../utils/apiConfig';

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const TIMEFRAMES = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '30m', value: '30min' },
  { label: '1h', value: '1hour' },
  { label: '4h', value: '4hour' },
  { label: '1D', value: '1day' },
];

export default function WorkingChartPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const urlSymbol = params.symbol as string;
  const urlTimeframe = params.timeframe as string;
  const isFullscreen = searchParams.get('fullscreen') === 'true';

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Use state for symbol and timeframe - allows in-app changes WITHOUT page reload
  const [symbol, setSymbol] = useState(urlSymbol);
  const [timeframe, setTimeframe] = useState(urlTimeframe);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize chart - SIMPLE & CLEAN
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    console.log('=== CHART INITIALIZATION START ===');
    console.log('Container:', container);
    console.log('Container dimensions:', {
      width: container.clientWidth,
      height: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight
    });

    // Create chart with autoSize
    chart.current = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    console.log('Chart instance created:', chart.current);

    // Add candlestick series
    candlestickSeries.current = chart.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    console.log('Candlestick series added');

    // Add volume series
    volumeSeries.current = chart.current.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });

    console.log('Volume series added');
    console.log('=== CHART INITIALIZATION COMPLETE ===');

    return () => {
      console.log('Cleaning up chart');
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
    };
  }, []);

  // Fetch data - SEPARATE from initialization
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !timeframe) {
        console.log('Missing symbol or timeframe');
        return;
      }

      console.log('=== DATA FETCH START ===');
      console.log('Symbol:', symbol, 'Timeframe:', timeframe);

      setIsLoading(true);
      setError(null);

      try {
        const backendUrl = getApiUrl();
        if (!backendUrl) {
          throw new Error('API URL not configured');
        }

        const url = `${backendUrl}/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=3M`;
        console.log('Fetching from:', url);

        const response = await fetch(url, {
          headers: { 'X-Data-Query-Enabled': 'true' }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('=== RAW API RESPONSE ===');
        console.log('Full response:', data);
        console.log('Bars count:', data.bars?.length || 0);
        console.log('First 3 bars (RAW):', data.bars?.slice(0, 3));
        console.log('Last 3 bars (RAW):', data.bars?.slice(-3));

        if (!data.bars || data.bars.length === 0) {
          throw new Error('No data received from API');
        }

        // Check for null values in first bar
        const firstBar = data.bars[0];
        const debugInfo = {
          bar: firstBar,
          hasTime: 'time' in firstBar,
          hasTimestamp: 'timestamp' in firstBar,
          time: firstBar?.time,
          timestamp: firstBar?.timestamp,
          open: firstBar?.open,
          high: firstBar?.high,
          low: firstBar?.low,
          close: firstBar?.close,
          volume: firstBar?.volume,
          allKeys: Object.keys(firstBar || {})
        };
        console.log('First bar detailed check:', debugInfo);
        console.log('Timestamp type:', typeof firstBar?.timestamp);
        console.log('Timestamp value:', firstBar?.timestamp);

        // Format data with STRICT null/undefined checking
        const formattedData: CandlestickData[] = data.bars
          .filter((bar: any) => {
            // CRITICAL: Filter out bars with null/undefined OHLC values BEFORE processing
            if (bar === null || bar === undefined) return false;
            if (bar.open === null || bar.open === undefined) return false;
            if (bar.high === null || bar.high === undefined) return false;
            if (bar.low === null || bar.low === undefined) return false;
            if (bar.close === null || bar.close === undefined) return false;
            // Check BOTH time AND timestamp fields (backend inconsistency)
            if ((bar.timestamp === null || bar.timestamp === undefined) && 
                (bar.time === null || bar.time === undefined)) return false;
            return true;
          })
          .map((bar: any) => {
            // Handle both 'time' (from IB service) and 'timestamp' (from database)
            const rawTime = bar.timestamp || bar.time;
            
            let timeValue: Time;
            if (typeof rawTime === 'number') {
              // Unix timestamp - convert to seconds if in milliseconds
              timeValue = (rawTime > 1000000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
            } else if (typeof rawTime === 'string') {
              // ISO string from database - convert to Unix seconds
              timeValue = Math.floor(new Date(rawTime).getTime() / 1000) as Time;
            } else if (rawTime instanceof Date) {
              // Date object - convert to Unix seconds
              timeValue = Math.floor(rawTime.getTime() / 1000) as Time;
            } else {
              // Fallback: try to parse whatever we got
              timeValue = Math.floor(new Date(rawTime).getTime() / 1000) as Time;
            }

            // Convert to numbers and validate
            const open = Number(bar.open);
            const high = Number(bar.high);
            const low = Number(bar.low);
            const close = Number(bar.close);

            return {
              time: timeValue,
              open,
              high,
              low,
              close,
              volume: bar.volume && !isNaN(Number(bar.volume)) ? Number(bar.volume) : undefined,
            };
          })
          .filter((bar: CandlestickData) => {
            // Final validation: ensure no NaN values
            if (isNaN(bar.open) || isNaN(bar.high) || isNaN(bar.low) || isNaN(bar.close)) {
              console.warn('Filtered out bar with NaN values:', bar);
              return false;
            }
            // Ensure valid price range (high >= low, etc.)
            if (bar.high < bar.low) {
              console.warn('Filtered out bar with invalid price range (high < low):', bar);
              return false;
            }
            return true;
          });

        console.log('Formatted data:', {
          originalCount: data.bars.length,
          validCount: formattedData.length,
          filteredOut: data.bars.length - formattedData.length,
          first: formattedData[0],
          last: formattedData[formattedData.length - 1]
        });

        // CRITICAL: Only set data if we have valid bars
        if (formattedData.length === 0) {
          throw new Error(`All ${data.bars.length} bars were invalid (contained null/NaN values)`);
        }

        // Set data on chart
        if (candlestickSeries.current && formattedData.length > 0) {
          console.log('Setting candlestick data...');
          try {
            candlestickSeries.current.setData(formattedData);
            console.log('✅ Candlestick data set successfully');
          } catch (err) {
            console.error('❌ Error setting candlestick data:', err);
            console.error('First 5 bars that failed:', formattedData.slice(0, 5));
            throw err;
          }
        }

        if (volumeSeries.current && formattedData.length > 0) {
          console.log('Setting volume data...');
          const volumeData = formattedData
            .filter(d => d.volume !== undefined)
            .map(d => ({
              time: d.time,
              value: d.volume!,
              color: d.close >= d.open ? '#26a69a80' : '#ef535080',
            }));
          volumeSeries.current.setData(volumeData);
          console.log('Volume data set successfully');
        }

        if (chart.current) {
          console.log('Fitting content to timeScale...');
          chart.current.timeScale().fitContent();
          console.log('Content fitted');
        }

        console.log('=== DATA FETCH COMPLETE ===');
        setIsLoading(false);

      } catch (err) {
        console.error('=== DATA FETCH ERROR ===');
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setIsLoading(false);
      }
    };

    // Small delay to ensure chart is fully initialized
    const timeoutId = setTimeout(fetchData, 100);
    return () => clearTimeout(timeoutId);
  }, [symbol, timeframe]);

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#1e1e1e',
        position: 'relative'
      }}>
        {error && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '12px',
            backgroundColor: '#ff5252',
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            zIndex: 40
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                border: '3px solid #333',
                borderTop: '3px solid #26a69a',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <div style={{ color: '#d1d4dc' }}>Loading {symbol} chart...</div>
            </div>
          </div>
        )}

        {/* Header with Symbol and In-App Timeframe Selector */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          zIndex: 30,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Symbol Display */}
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '8px 12px',
            borderRadius: '4px'
          }}>
            <div style={{ color: '#d1d4dc', fontSize: '14px', fontWeight: 'bold' }}>
              {symbol}
            </div>
          </div>

          {/* Timeframe Selector - TradingView Best Practice */}
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            gap: '4px'
          }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => {
                  console.log('Timeframe changed to:', tf.value);
                  setTimeframe(tf.value);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: timeframe === tf.value ? 'bold' : 'normal',
                  color: timeframe === tf.value ? '#ffffff' : '#d1d4dc',
                  backgroundColor: timeframe === tf.value ? '#26a69a' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (timeframe !== tf.value) {
                    e.currentTarget.style.backgroundColor = 'rgba(38, 166, 154, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (timeframe !== tf.value) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div 
          ref={chartContainerRef} 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        />

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Normal mode
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <header style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #e5e5e5'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '16px 24px'
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e1e1e' }}>
            {symbol} - {timeframe}
          </h1>
        </div>
      </header>

      <main style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px'
      }}>
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#ffebee',
            border: '1px solid #ef5350',
            borderRadius: '4px',
            color: '#c62828'
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '16px',
          position: 'relative'
        }}>
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              zIndex: 10,
              borderRadius: '8px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  border: '3px solid #f3f3f3',
                  borderTop: '3px solid #26a69a',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <div style={{ color: '#666' }}>Loading chart data...</div>
              </div>
            </div>
          )}

          <div 
            ref={chartContainerRef} 
            style={{ 
              width: '100%', 
              height: '600px' 
            }} 
          />
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
