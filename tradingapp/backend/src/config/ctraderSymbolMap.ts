/**
 * C10: cTrader symbol mapping - harden toBrokerSymbol/toCanonicalSymbol
 * for forex, CFDs, indices (see CTRADER_INTEGRATION_PLAN §7).
 *
 * cTrader format: EURUSD (no separator), #AAPL for CFDs
 * IB format: EUR.USD, AAPL
 */

/** Explicit canonical -> cTrader broker symbol mappings */
export const CANONICAL_TO_CTRADER: Record<string, string> = {
  // Forex - common pairs
  'EUR/USD': 'EURUSD',
  'EUR.USD': 'EURUSD',
  'EURUSD': 'EURUSD',
  'GBP/USD': 'GBPUSD',
  'GBP.USD': 'GBPUSD',
  'GBPUSD': 'GBPUSD',
  'USD/JPY': 'USDJPY',
  'USD.JPY': 'USDJPY',
  'USDJPY': 'USDJPY',
  'AUD/USD': 'AUDUSD',
  'AUD.USD': 'AUDUSD',
  'AUDUSD': 'AUDUSD',
  'USD/CHF': 'USDCHF',
  'USD.CHF': 'USDCHF',
  'USDCHF': 'USDCHF',
  'NZD/USD': 'NZDUSD',
  'NZDUSD': 'NZDUSD',
  'USD/CAD': 'USDCAD',
  'USD.CAD': 'USDCAD',
  'USDCAD': 'USDCAD',
  // Indices - cTrader often uses # prefix
  'US500': '#US500',
  'US30': '#US30',
  'USTEC': '#USTEC',
  'SPX': '#US500',
  'DJI': '#US30',
  'NDX': '#USTEC',
};

/** Explicit cTrader -> canonical symbol mappings */
export const CTRADER_TO_CANONICAL: Record<string, string> = {
  'EURUSD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'USDJPY': 'USD/JPY',
  'AUDUSD': 'AUD/USD',
  'USDCHF': 'USD/CHF',
  'NZDUSD': 'NZD/USD',
  'USDCAD': 'USD/CAD',
  '#US500': 'US500',
  '#US30': 'US30',
  '#USTEC': 'USTEC',
};

/**
 * Convert canonical symbol to cTrader broker format.
 */
export function toBrokerSymbol(canonical: string): string {
  const normalized = canonical.trim().toUpperCase();
  const mapped = CANONICAL_TO_CTRADER[normalized] ?? CANONICAL_TO_CTRADER[canonical];
  if (mapped) return mapped;
  // Forex: EUR/USD -> EURUSD
  if (normalized.includes('/')) return normalized.replace('/', '');
  if (normalized.includes('.')) return normalized.replace('.', '');
  // Stocks/CFDs: AAPL -> #AAPL (cTrader CFD convention)
  if (!normalized.startsWith('#')) return `#${normalized}`;
  return normalized;
}

/**
 * Convert cTrader broker symbol to canonical format.
 */
export function toCanonicalSymbol(brokerSymbol: string): string {
  const normalized = brokerSymbol.trim();
  const mapped = CTRADER_TO_CANONICAL[normalized] ?? CTRADER_TO_CANONICAL[normalized.toUpperCase()];
  if (mapped) return mapped;
  // Remove # prefix for CFDs
  if (normalized.startsWith('#')) return normalized.slice(1);
  // Forex: EURUSD -> EUR/USD (6-char major pairs)
  if (normalized.length === 6 && normalized.endsWith('USD')) {
    return `${normalized.slice(0, 3)}/USD`;
  }
  if (normalized.length === 6 && normalized.startsWith('USD')) {
    return `USD/${normalized.slice(3)}`;
  }
  return normalized;
}
