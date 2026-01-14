'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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

export default function ChartPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSymbol = params.symbol as string;
  const urlTimeframe = params.timeframe as string;
  const isFullscreen = searchParams.get('fullscreen') === 'true';
  
  // Function to update URL when timeframe changes
  const updateTimeframeUrl = (newTimeframe: string) => {
    const queryString = isFullscreen ? '?fullscreen=true' : '';
    router.replace(`/chart/${symbol}/${newTimeframe}${queryString}`, { scroll: false });
  };

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Use state for symbol and timeframe - allows in-app changes WITHOUT page reload
  const [symbol, setSymbol] = useState(urlSymbol);
  const [timeframe, setTimeframe] = useState(urlTimeframe);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'ib_service' | null>(null);
  const [barCount, setBarCount] = useState<number>(0);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    // Create chart with autoSize and larger fonts
    chart.current = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d4dc',
        fontSize: 20, // Large font for better visibility - Options: 10, 11, 12, 13, 14, 16, 18, 20, 24
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

    // Add candlestick series
    candlestickSeries.current = chart.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

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

    return () => {
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
    };
  }, []);

  // Fetch data when symbol or timeframe changes
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !timeframe) return;

      setIsLoading(true);
      setError(null);

      try {
        const backendUrl = getApiUrl();
        if (!backendUrl) {
          throw new Error('API URL not configured');
        }

        const url = `${backendUrl}/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=3M&use_database=true`;
        const response = await fetch(url, {
          headers: { 'X-Data-Query-Enabled': 'true' }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.bars || data.bars.length === 0) {
          throw new Error('No data received from API');
        }

        // Capture data source
        setDataSource(data.source || 'ib_service');
        setBarCount(data.bars.length);

        // Format data with validation
        const formattedData: CandlestickData[] = data.bars
          .filter((bar: any) => {
            // Filter out bars with null/undefined values
            if (bar === null || bar === undefined) return false;
            if (bar.open === null || bar.open === undefined) return false;
            if (bar.high === null || bar.high === undefined) return false;
            if (bar.low === null || bar.low === undefined) return false;
            if (bar.close === null || bar.close === undefined) return false;
            if ((bar.timestamp === null || bar.timestamp === undefined) && 
                (bar.time === null || bar.time === undefined)) return false;
            return true;
          })
          .map((bar: any) => {
            // Handle both 'time' (from IB service) and 'timestamp' (from database)
            const rawTime = bar.timestamp || bar.time;
            
            let timeValue: Time;
            if (typeof rawTime === 'number') {
              timeValue = (rawTime > 1000000000000 ? Math.floor(rawTime / 1000) : rawTime) as Time;
            } else if (typeof rawTime === 'string') {
              timeValue = Math.floor(new Date(rawTime).getTime() / 1000) as Time;
            } else if (rawTime instanceof Date) {
              timeValue = Math.floor(rawTime.getTime() / 1000) as Time;
            } else {
              timeValue = Math.floor(new Date(rawTime).getTime() / 1000) as Time;
            }

            return {
              time: timeValue,
              open: Number(bar.open),
              high: Number(bar.high),
              low: Number(bar.low),
              close: Number(bar.close),
              volume: bar.volume && !isNaN(Number(bar.volume)) ? Number(bar.volume) : undefined,
            };
          })
          .filter((bar: CandlestickData) => {
            // Final validation: ensure no NaN values
            if (isNaN(bar.open) || isNaN(bar.high) || isNaN(bar.low) || isNaN(bar.close)) {
              return false;
            }
            if (bar.high < bar.low) {
              return false;
            }
            return true;
          });

        // Sort by time ascending (required by lightweight-charts)
        formattedData.sort((a, b) => (a.time as number) - (b.time as number));
        
        // Remove duplicate timestamps (required by lightweight-charts)
        const uniqueData: CandlestickData[] = [];
        const seenTimes = new Set<number>();
        for (const bar of formattedData) {
          const timeNum = bar.time as number;
          if (!seenTimes.has(timeNum)) {
            seenTimes.add(timeNum);
            uniqueData.push(bar);
          }
        }

        if (uniqueData.length === 0) {
          throw new Error('No valid data after processing');
        }

        // Set candlestick data
        if (candlestickSeries.current) {
          candlestickSeries.current.setData(uniqueData);
        }

        // Set volume data
        if (volumeSeries.current) {
          const volumeData = uniqueData
            .filter(d => d.volume !== undefined)
            .map(d => ({
              time: d.time,
              value: d.volume!,
              color: d.close >= d.open ? '#26a69a80' : '#ef535080',
            }));
          volumeSeries.current.setData(volumeData);
        }

        // Fit content to view
        if (chart.current) {
          chart.current.timeScale().fitContent();
        }

        setIsLoading(false);

      } catch (err) {
        console.error('Chart data fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setIsLoading(false);
      }
    };

    // Small delay to ensure chart is initialized
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

        {/* Header with Symbol and Timeframe Selector */}
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
          {/* Symbol Display with Data Source */}
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '10px 16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {symbol}
            </div>
            {dataSource && (
              <div style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: dataSource === 'database' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                color: dataSource === 'database' ? '#10b981' : '#3b82f6',
                border: `1px solid ${dataSource === 'database' ? '#10b981' : '#3b82f6'}`
              }}>
                {dataSource === 'database' ? '📊 DATABASE' : '🌐 API'}
              </div>
            )}
            {barCount > 0 && (
              <div style={{ color: '#9ca3af', fontSize: '13px' }}>
                {barCount.toLocaleString()} bars
              </div>
            )}
          </div>

          {/* Timeframe Selector */}
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            gap: '4px'
          }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => {
                  setTimeframe(tf.value);
                  updateTimeframeUrl(tf.value);
                }}
                style={{
                  padding: '8px 14px',
                  fontSize: '14px',
                  fontWeight: timeframe === tf.value ? 'bold' : 'normal',
                  color: timeframe === tf.value ? '#ffffff' : '#d1d4dc',
                  backgroundColor: timeframe === tf.value ? '#26a69a' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
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
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e1e1e' }}>
              {symbol} - {timeframe}
            </h1>
            {dataSource && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: dataSource === 'database' ? '#d1fae5' : '#dbeafe',
                color: dataSource === 'database' ? '#059669' : '#2563eb'
              }}>
                {dataSource === 'database' ? '📊 Database' : '🌐 API'}
              </span>
            )}
          </div>
          {barCount > 0 && (
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {barCount.toLocaleString()} bars loaded
            </div>
          )}
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
