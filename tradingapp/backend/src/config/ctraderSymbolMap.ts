/**
 * C10: cTrader symbol mapping - harden toBrokerSymbol/toCanonicalSymbol
 * for forex, CFDs, indices (see CTRADER_INTEGRATION_PLAN §7).
 *
 * cTrader format: EURUSD (no separator), #AAPL for CFDs
 * IB format: EUR.USD, AAPL
 */

// Well-known 3-letter currency codes for forex detection
const CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF',
  'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'PLN', 'MXN', 'ZAR',
  'TRY', 'CNH', 'CNY', 'CZK', 'HUF', 'ILS', 'THB', 'TWD',
]);

/** Explicit canonical -> cTrader broker symbol mappings */
export const CANONICAL_TO_CTRADER: Record<string, string> = {
  // Major USD pairs
  'EUR/USD': 'EURUSD', 'EUR.USD': 'EURUSD', 'EURUSD': 'EURUSD',
  'GBP/USD': 'GBPUSD', 'GBP.USD': 'GBPUSD', 'GBPUSD': 'GBPUSD',
  'USD/JPY': 'USDJPY', 'USD.JPY': 'USDJPY', 'USDJPY': 'USDJPY',
  'AUD/USD': 'AUDUSD', 'AUD.USD': 'AUDUSD', 'AUDUSD': 'AUDUSD',
  'USD/CHF': 'USDCHF', 'USD.CHF': 'USDCHF', 'USDCHF': 'USDCHF',
  'NZD/USD': 'NZDUSD', 'NZD.USD': 'NZDUSD', 'NZDUSD': 'NZDUSD',
  'USD/CAD': 'USDCAD', 'USD.CAD': 'USDCAD', 'USDCAD': 'USDCAD',
  // Cross pairs
  'EUR/GBP': 'EURGBP', 'EUR.GBP': 'EURGBP', 'EURGBP': 'EURGBP',
  'EUR/JPY': 'EURJPY', 'EUR.JPY': 'EURJPY', 'EURJPY': 'EURJPY',
  'GBP/JPY': 'GBPJPY', 'GBP.JPY': 'GBPJPY', 'GBPJPY': 'GBPJPY',
  'AUD/JPY': 'AUDJPY', 'AUD.JPY': 'AUDJPY', 'AUDJPY': 'AUDJPY',
  'EUR/AUD': 'EURAUD', 'EUR.AUD': 'EURAUD', 'EURAUD': 'EURAUD',
  'EUR/CAD': 'EURCAD', 'EUR.CAD': 'EURCAD', 'EURCAD': 'EURCAD',
  'EUR/CHF': 'EURCHF', 'EUR.CHF': 'EURCHF', 'EURCHF': 'EURCHF',
  'GBP/AUD': 'GBPAUD', 'GBP.AUD': 'GBPAUD', 'GBPAUD': 'GBPAUD',
  'GBP/CAD': 'GBPCAD', 'GBP.CAD': 'GBPCAD', 'GBPCAD': 'GBPCAD',
  'GBP/CHF': 'GBPCHF', 'GBP.CHF': 'GBPCHF', 'GBPCHF': 'GBPCHF',
  'AUD/CAD': 'AUDCAD', 'AUD.CAD': 'AUDCAD', 'AUDCAD': 'AUDCAD',
  'AUD/CHF': 'AUDCHF', 'AUD.CHF': 'AUDCHF', 'AUDCHF': 'AUDCHF',
  'AUD/NZD': 'AUDNZD', 'AUD.NZD': 'AUDNZD', 'AUDNZD': 'AUDNZD',
  'NZD/JPY': 'NZDJPY', 'NZD.JPY': 'NZDJPY', 'NZDJPY': 'NZDJPY',
  'NZD/CAD': 'NZDCAD', 'NZD.CAD': 'NZDCAD', 'NZDCAD': 'NZDCAD',
  'NZD/CHF': 'NZDCHF', 'NZD.CHF': 'NZDCHF', 'NZDCHF': 'NZDCHF',
  'CAD/JPY': 'CADJPY', 'CAD.JPY': 'CADJPY', 'CADJPY': 'CADJPY',
  'CAD/CHF': 'CADCHF', 'CAD.CHF': 'CADCHF', 'CADCHF': 'CADCHF',
  'CHF/JPY': 'CHFJPY', 'CHF.JPY': 'CHFJPY', 'CHFJPY': 'CHFJPY',
  // Indices
  'US500': '#US500', 'US30': '#US30', 'USTEC': '#USTEC',
  'SPX': '#US500', 'DJI': '#US30', 'NDX': '#USTEC',
};

/** Explicit cTrader -> canonical symbol mappings */
export const CTRADER_TO_CANONICAL: Record<string, string> = {
  // Major USD pairs
  'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY',
  'AUDUSD': 'AUD/USD', 'USDCHF': 'USD/CHF', 'NZDUSD': 'NZD/USD',
  'USDCAD': 'USD/CAD',
  // Cross pairs
  'EURGBP': 'EUR/GBP', 'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY',
  'AUDJPY': 'AUD/JPY', 'EURAUD': 'EUR/AUD', 'EURCAD': 'EUR/CAD',
  'EURCHF': 'EUR/CHF', 'GBPAUD': 'GBP/AUD', 'GBPCAD': 'GBP/CAD',
  'GBPCHF': 'GBP/CHF', 'AUDCAD': 'AUD/CAD', 'AUDCHF': 'AUD/CHF',
  'AUDNZD': 'AUD/NZD', 'NZDJPY': 'NZD/JPY', 'NZDCAD': 'NZD/CAD',
  'NZDCHF': 'NZD/CHF', 'CADJPY': 'CAD/JPY', 'CADCHF': 'CAD/CHF',
  'CHFJPY': 'CHF/JPY',
  // Indices
  '#US500': 'US500', '#US30': 'US30', '#USTEC': 'USTEC',
};

/**
 * Check whether a 6-char uppercase string looks like a forex pair (CCY1+CCY2).
 */
function looksLikeForex(s: string): boolean {
  return s.length === 6
    && CURRENCIES.has(s.slice(0, 3))
    && CURRENCIES.has(s.slice(3));
}

/**
 * Convert canonical symbol to cTrader broker format.
 */
export function toBrokerSymbol(canonical: string): string {
  const normalized = canonical.trim().toUpperCase();
  const mapped = CANONICAL_TO_CTRADER[normalized] ?? CANONICAL_TO_CTRADER[canonical];
  if (mapped) return mapped;

  // Forex with separator: EUR/USD -> EURUSD
  if (normalized.includes('/')) return normalized.replace('/', '');
  if (normalized.includes('.')) return normalized.replace('.', '');

  // Already-concatenated forex: EURUSD stays EURUSD (no # prefix)
  if (looksLikeForex(normalized)) return normalized;

  // Stocks/CFDs: AAPL -> #AAPL
  if (!normalized.startsWith('#')) return `#${normalized}`;
  return normalized;
}

/**
 * Convert cTrader broker symbol to canonical format.
 */
export function toCanonicalSymbol(brokerSymbol: string): string {
  const normalized = brokerSymbol.trim();
  const upper = normalized.toUpperCase();
  const mapped = CTRADER_TO_CANONICAL[normalized] ?? CTRADER_TO_CANONICAL[upper];
  if (mapped) return mapped;

  // Remove # prefix for CFDs
  if (normalized.startsWith('#')) return normalized.slice(1);

  // Generic forex detection for any 6-char CCY1CCY2
  if (looksLikeForex(upper)) {
    return `${upper.slice(0, 3)}/${upper.slice(3)}`;
  }
  return normalized;
}
