/**
 * Interactive Brokers Exchange Configuration
 * Americas Region - Complete Exchange and Product Type Mappings
 * 
 * Source: IB Symbol Lookup - Americas (United States, Canada, Mexico, Brazil)
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Exchange {
  value: string;
  label: string;
  description: string;
  products: ProductType[];
}

export interface Country {
  code: string;
  label: string;
  currency: string;
  exchanges: Exchange[];
}

export interface Region {
  code: string;
  label: string;
  countries: Country[];
}

export type ProductType = 
  | 'STK'    // Stocks
  | 'OPT'    // Options
  | 'FUT'    // Futures
  | 'FOP'    // Futures Options (Options on Futures)
  | 'WAR'    // Warrants
  | 'BOND'   // Bonds
  | 'IND'    // Indices
  | 'CASH'   // Forex/Currencies
  | 'FUND'   // Mutual Funds
  | 'CRYPTO' // Cryptocurrency
  | 'ETF'    // Exchange Traded Funds (subset of STK)
  | 'CFD'    // Contracts for Difference
  | 'CMDTY' // Commodities
  | 'BAG';   // Basket Products

export interface ProductTypeConfig {
  value: ProductType;
  label: string;
  description: string;
}

export interface CurrencyConfig {
  value: string;
  label: string;
  description: string;
}

// =============================================================================
// PRODUCT TYPES (IB Security Types)
// =============================================================================

export const PRODUCT_TYPES: ProductTypeConfig[] = [
  { value: 'STK', label: 'Stocks', description: 'Common and preferred stocks, ETFs' },
  { value: 'OPT', label: 'Options', description: 'Stock and index options' },
  { value: 'FUT', label: 'Futures', description: 'Futures contracts' },
  { value: 'FOP', label: 'Futures Options', description: 'Options on futures contracts' },
  { value: 'WAR', label: 'Warrants', description: 'Stock warrants' },
  { value: 'BOND', label: 'Bonds', description: 'Corporate and government bonds' },
  { value: 'IND', label: 'Indices', description: 'Market indices' },
  { value: 'CASH', label: 'Forex', description: 'Foreign exchange currency pairs' },
  { value: 'FUND', label: 'Mutual Funds', description: 'Mutual fund holdings' },
  { value: 'CRYPTO', label: 'Cryptocurrency', description: 'Digital currencies' },
  { value: 'ETF', label: 'ETF', description: 'Exchange Traded Funds' },
  { value: 'CFD', label: 'CFD', description: 'Contracts for Difference' },
  { value: 'CMDTY', label: 'Commodities', description: 'Commodity contracts' },
  { value: 'BAG', label: 'Baskets', description: 'Basket products' }
];

// =============================================================================
// PAXOS CRYPTOCURRENCY SYMBOLS
// For IBKR: Symbol is just the ticker (BTC), currency field = USD
// =============================================================================

export interface PaxosSymbol {
  symbol: string;       // Crypto ticker (e.g., BTC) - this is what IBKR expects
  name: string;         // Full name
  currency: string;     // Quote currency (typically USD)
}

export const PAXOS_SYMBOLS: PaxosSymbol[] = [
  { symbol: 'AAVE', name: 'Aave', currency: 'USD' },
  { symbol: 'BCH', name: 'Bitcoin Cash', currency: 'USD' },
  { symbol: 'BTC', name: 'Bitcoin', currency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', currency: 'USD' },
  { symbol: 'LINK', name: 'Chainlink', currency: 'USD' },
  { symbol: 'LTC', name: 'Litecoin', currency: 'USD' },
  { symbol: 'MATIC', name: 'Polygon', currency: 'USD' },
  { symbol: 'SOL', name: 'Solana', currency: 'USD' },
  { symbol: 'UNI', name: 'Uniswap', currency: 'USD' }
];

// =============================================================================
// IBFX FOREX SYMBOLS
// For IBKR: Symbol format is BASE.QUOTE (e.g., EUR.USD)
// secType = CASH, exchange = IDEALPRO or IBFX
// =============================================================================

export interface ForexSymbol {
  symbol: string;       // Full pair symbol (e.g., EUR.USD)
  baseCurrency: string; // Base currency (e.g., EUR) - this is sent as 'symbol' to IB
  quoteCurrency: string; // Quote currency (e.g., USD) - this is sent as 'currency' to IB
  description: string;   // Full description
}

export const IBFX_SYMBOLS: ForexSymbol[] = [
  // Major Pairs
  { symbol: 'EUR.USD', baseCurrency: 'EUR', quoteCurrency: 'USD', description: 'Euro / US Dollar' },
  { symbol: 'GBP.USD', baseCurrency: 'GBP', quoteCurrency: 'USD', description: 'British Pound / US Dollar' },
  { symbol: 'USD.JPY', baseCurrency: 'USD', quoteCurrency: 'JPY', description: 'US Dollar / Japanese Yen' },
  { symbol: 'USD.CHF', baseCurrency: 'USD', quoteCurrency: 'CHF', description: 'US Dollar / Swiss Franc' },
  { symbol: 'AUD.USD', baseCurrency: 'AUD', quoteCurrency: 'USD', description: 'Australian Dollar / US Dollar' },
  { symbol: 'NZD.USD', baseCurrency: 'NZD', quoteCurrency: 'USD', description: 'New Zealand Dollar / US Dollar' },
  { symbol: 'USD.CAD', baseCurrency: 'USD', quoteCurrency: 'CAD', description: 'US Dollar / Canadian Dollar' },
  
  // EUR Crosses
  { symbol: 'EUR.GBP', baseCurrency: 'EUR', quoteCurrency: 'GBP', description: 'Euro / British Pound' },
  { symbol: 'EUR.JPY', baseCurrency: 'EUR', quoteCurrency: 'JPY', description: 'Euro / Japanese Yen' },
  { symbol: 'EUR.CHF', baseCurrency: 'EUR', quoteCurrency: 'CHF', description: 'Euro / Swiss Franc' },
  { symbol: 'EUR.AUD', baseCurrency: 'EUR', quoteCurrency: 'AUD', description: 'Euro / Australian Dollar' },
  { symbol: 'EUR.CAD', baseCurrency: 'EUR', quoteCurrency: 'CAD', description: 'Euro / Canadian Dollar' },
  { symbol: 'EUR.NZD', baseCurrency: 'EUR', quoteCurrency: 'NZD', description: 'Euro / New Zealand Dollar' },
  { symbol: 'EUR.SEK', baseCurrency: 'EUR', quoteCurrency: 'SEK', description: 'Euro / Swedish Krona' },
  { symbol: 'EUR.NOK', baseCurrency: 'EUR', quoteCurrency: 'NOK', description: 'Euro / Norwegian Krone' },
  { symbol: 'EUR.DKK', baseCurrency: 'EUR', quoteCurrency: 'DKK', description: 'Euro / Danish Krone' },
  { symbol: 'EUR.HKD', baseCurrency: 'EUR', quoteCurrency: 'HKD', description: 'Euro / Hong Kong Dollar' },
  { symbol: 'EUR.SGD', baseCurrency: 'EUR', quoteCurrency: 'SGD', description: 'Euro / Singapore Dollar' },
  { symbol: 'EUR.TRY', baseCurrency: 'EUR', quoteCurrency: 'TRY', description: 'Euro / Turkish Lira' },
  { symbol: 'EUR.ZAR', baseCurrency: 'EUR', quoteCurrency: 'ZAR', description: 'Euro / South African Rand' },
  { symbol: 'EUR.MXN', baseCurrency: 'EUR', quoteCurrency: 'MXN', description: 'Euro / Mexican Peso' },
  { symbol: 'EUR.PLN', baseCurrency: 'EUR', quoteCurrency: 'PLN', description: 'Euro / Polish Zloty' },
  { symbol: 'EUR.HUF', baseCurrency: 'EUR', quoteCurrency: 'HUF', description: 'Euro / Hungarian Forint' },
  { symbol: 'EUR.CZK', baseCurrency: 'EUR', quoteCurrency: 'CZK', description: 'Euro / Czech Koruna' },
  { symbol: 'EUR.ILS', baseCurrency: 'EUR', quoteCurrency: 'ILS', description: 'Euro / Israeli Shekel' },
  { symbol: 'EUR.CNH', baseCurrency: 'EUR', quoteCurrency: 'CNH', description: 'Euro / Chinese Renminbi Offshore' },
  { symbol: 'EUR.RUB', baseCurrency: 'EUR', quoteCurrency: 'RUB', description: 'Euro / Russian Ruble' },
  
  // GBP Crosses
  { symbol: 'GBP.JPY', baseCurrency: 'GBP', quoteCurrency: 'JPY', description: 'British Pound / Japanese Yen' },
  { symbol: 'GBP.CHF', baseCurrency: 'GBP', quoteCurrency: 'CHF', description: 'British Pound / Swiss Franc' },
  { symbol: 'GBP.AUD', baseCurrency: 'GBP', quoteCurrency: 'AUD', description: 'British Pound / Australian Dollar' },
  { symbol: 'GBP.CAD', baseCurrency: 'GBP', quoteCurrency: 'CAD', description: 'British Pound / Canadian Dollar' },
  { symbol: 'GBP.NZD', baseCurrency: 'GBP', quoteCurrency: 'NZD', description: 'British Pound / New Zealand Dollar' },
  { symbol: 'GBP.SEK', baseCurrency: 'GBP', quoteCurrency: 'SEK', description: 'British Pound / Swedish Krona' },
  { symbol: 'GBP.NOK', baseCurrency: 'GBP', quoteCurrency: 'NOK', description: 'British Pound / Norwegian Krone' },
  { symbol: 'GBP.DKK', baseCurrency: 'GBP', quoteCurrency: 'DKK', description: 'British Pound / Danish Krone' },
  { symbol: 'GBP.HKD', baseCurrency: 'GBP', quoteCurrency: 'HKD', description: 'British Pound / Hong Kong Dollar' },
  { symbol: 'GBP.SGD', baseCurrency: 'GBP', quoteCurrency: 'SGD', description: 'British Pound / Singapore Dollar' },
  { symbol: 'GBP.TRY', baseCurrency: 'GBP', quoteCurrency: 'TRY', description: 'British Pound / Turkish Lira' },
  { symbol: 'GBP.ZAR', baseCurrency: 'GBP', quoteCurrency: 'ZAR', description: 'British Pound / South African Rand' },
  { symbol: 'GBP.MXN', baseCurrency: 'GBP', quoteCurrency: 'MXN', description: 'British Pound / Mexican Peso' },
  { symbol: 'GBP.PLN', baseCurrency: 'GBP', quoteCurrency: 'PLN', description: 'British Pound / Polish Zloty' },
  { symbol: 'GBP.HUF', baseCurrency: 'GBP', quoteCurrency: 'HUF', description: 'British Pound / Hungarian Forint' },
  { symbol: 'GBP.CZK', baseCurrency: 'GBP', quoteCurrency: 'CZK', description: 'British Pound / Czech Koruna' },
  { symbol: 'GBP.CNH', baseCurrency: 'GBP', quoteCurrency: 'CNH', description: 'British Pound / Chinese Renminbi Offshore' },
  
  // AUD Crosses
  { symbol: 'AUD.JPY', baseCurrency: 'AUD', quoteCurrency: 'JPY', description: 'Australian Dollar / Japanese Yen' },
  { symbol: 'AUD.CHF', baseCurrency: 'AUD', quoteCurrency: 'CHF', description: 'Australian Dollar / Swiss Franc' },
  { symbol: 'AUD.CAD', baseCurrency: 'AUD', quoteCurrency: 'CAD', description: 'Australian Dollar / Canadian Dollar' },
  { symbol: 'AUD.NZD', baseCurrency: 'AUD', quoteCurrency: 'NZD', description: 'Australian Dollar / New Zealand Dollar' },
  { symbol: 'AUD.SGD', baseCurrency: 'AUD', quoteCurrency: 'SGD', description: 'Australian Dollar / Singapore Dollar' },
  { symbol: 'AUD.HKD', baseCurrency: 'AUD', quoteCurrency: 'HKD', description: 'Australian Dollar / Hong Kong Dollar' },
  { symbol: 'AUD.ZAR', baseCurrency: 'AUD', quoteCurrency: 'ZAR', description: 'Australian Dollar / South African Rand' },
  { symbol: 'AUD.CNH', baseCurrency: 'AUD', quoteCurrency: 'CNH', description: 'Australian Dollar / Chinese Renminbi Offshore' },
  
  // NZD Crosses
  { symbol: 'NZD.JPY', baseCurrency: 'NZD', quoteCurrency: 'JPY', description: 'New Zealand Dollar / Japanese Yen' },
  { symbol: 'NZD.CHF', baseCurrency: 'NZD', quoteCurrency: 'CHF', description: 'New Zealand Dollar / Swiss Franc' },
  { symbol: 'NZD.CAD', baseCurrency: 'NZD', quoteCurrency: 'CAD', description: 'New Zealand Dollar / Canadian Dollar' },
  
  // CAD Crosses
  { symbol: 'CAD.JPY', baseCurrency: 'CAD', quoteCurrency: 'JPY', description: 'Canadian Dollar / Japanese Yen' },
  { symbol: 'CAD.CHF', baseCurrency: 'CAD', quoteCurrency: 'CHF', description: 'Canadian Dollar / Swiss Franc' },
  { symbol: 'CAD.HKD', baseCurrency: 'CAD', quoteCurrency: 'HKD', description: 'Canadian Dollar / Hong Kong Dollar' },
  { symbol: 'CAD.CNH', baseCurrency: 'CAD', quoteCurrency: 'CNH', description: 'Canadian Dollar / Chinese Renminbi Offshore' },
  
  // CHF Crosses
  { symbol: 'CHF.JPY', baseCurrency: 'CHF', quoteCurrency: 'JPY', description: 'Swiss Franc / Japanese Yen' },
  { symbol: 'CHF.SEK', baseCurrency: 'CHF', quoteCurrency: 'SEK', description: 'Swiss Franc / Swedish Krona' },
  { symbol: 'CHF.NOK', baseCurrency: 'CHF', quoteCurrency: 'NOK', description: 'Swiss Franc / Norwegian Krone' },
  { symbol: 'CHF.DKK', baseCurrency: 'CHF', quoteCurrency: 'DKK', description: 'Swiss Franc / Danish Krone' },
  { symbol: 'CHF.TRY', baseCurrency: 'CHF', quoteCurrency: 'TRY', description: 'Swiss Franc / Turkish Lira' },
  { symbol: 'CHF.PLN', baseCurrency: 'CHF', quoteCurrency: 'PLN', description: 'Swiss Franc / Polish Zloty' },
  { symbol: 'CHF.HUF', baseCurrency: 'CHF', quoteCurrency: 'HUF', description: 'Swiss Franc / Hungarian Forint' },
  { symbol: 'CHF.CZK', baseCurrency: 'CHF', quoteCurrency: 'CZK', description: 'Swiss Franc / Czech Koruna' },
  { symbol: 'CHF.ZAR', baseCurrency: 'CHF', quoteCurrency: 'ZAR', description: 'Swiss Franc / South African Rand' },
  { symbol: 'CHF.CNH', baseCurrency: 'CHF', quoteCurrency: 'CNH', description: 'Swiss Franc / Chinese Renminbi Offshore' },
  
  // USD Crosses
  { symbol: 'USD.TRY', baseCurrency: 'USD', quoteCurrency: 'TRY', description: 'US Dollar / Turkish Lira' },
  { symbol: 'USD.ZAR', baseCurrency: 'USD', quoteCurrency: 'ZAR', description: 'US Dollar / South African Rand' },
  { symbol: 'USD.CNH', baseCurrency: 'USD', quoteCurrency: 'CNH', description: 'US Dollar / Chinese Renminbi Offshore' },
  { symbol: 'USD.ILS', baseCurrency: 'USD', quoteCurrency: 'ILS', description: 'US Dollar / Israeli Shekel' },
  { symbol: 'USD.BGN', baseCurrency: 'USD', quoteCurrency: 'BGN', description: 'US Dollar / Bulgarian Lev' },
  
  // Scandinavian Crosses
  { symbol: 'NOK.SEK', baseCurrency: 'NOK', quoteCurrency: 'SEK', description: 'Norwegian Krone / Swedish Krona' },
  { symbol: 'NOK.JPY', baseCurrency: 'NOK', quoteCurrency: 'JPY', description: 'Norwegian Krone / Japanese Yen' },
  { symbol: 'SEK.JPY', baseCurrency: 'SEK', quoteCurrency: 'JPY', description: 'Swedish Krona / Japanese Yen' },
  { symbol: 'DKK.SEK', baseCurrency: 'DKK', quoteCurrency: 'SEK', description: 'Danish Krone / Swedish Krona' },
  { symbol: 'DKK.NOK', baseCurrency: 'DKK', quoteCurrency: 'NOK', description: 'Danish Krone / Norwegian Krone' },
  { symbol: 'DKK.JPY', baseCurrency: 'DKK', quoteCurrency: 'JPY', description: 'Danish Krone / Japanese Yen' },
  
  // Asian Crosses
  { symbol: 'SGD.JPY', baseCurrency: 'SGD', quoteCurrency: 'JPY', description: 'Singapore Dollar / Japanese Yen' },
  { symbol: 'SGD.HKD', baseCurrency: 'SGD', quoteCurrency: 'HKD', description: 'Singapore Dollar / Hong Kong Dollar' },
  { symbol: 'SGD.CNH', baseCurrency: 'SGD', quoteCurrency: 'CNH', description: 'Singapore Dollar / Chinese Renminbi Offshore' },
  { symbol: 'HKD.JPY', baseCurrency: 'HKD', quoteCurrency: 'JPY', description: 'Hong Kong Dollar / Japanese Yen' },
  { symbol: 'CNH.JPY', baseCurrency: 'CNH', quoteCurrency: 'JPY', description: 'Chinese Renminbi Offshore / Japanese Yen' },
  { symbol: 'CNH.HKD', baseCurrency: 'CNH', quoteCurrency: 'HKD', description: 'Chinese Renminbi Offshore / Hong Kong Dollar' },
  
  // Korean Won Crosses
  { symbol: 'KRW.USD', baseCurrency: 'KRW', quoteCurrency: 'USD', description: 'Korean Won / US Dollar' },
  { symbol: 'KRW.JPY', baseCurrency: 'KRW', quoteCurrency: 'JPY', description: 'Korean Won / Japanese Yen' },
  { symbol: 'KRW.HKD', baseCurrency: 'KRW', quoteCurrency: 'HKD', description: 'Korean Won / Hong Kong Dollar' },
  { symbol: 'KRW.GBP', baseCurrency: 'KRW', quoteCurrency: 'GBP', description: 'Korean Won / British Pound' },
  { symbol: 'KRW.EUR', baseCurrency: 'KRW', quoteCurrency: 'EUR', description: 'Korean Won / Euro' },
  { symbol: 'KRW.CHF', baseCurrency: 'KRW', quoteCurrency: 'CHF', description: 'Korean Won / Swiss Franc' },
  { symbol: 'KRW.CAD', baseCurrency: 'KRW', quoteCurrency: 'CAD', description: 'Korean Won / Canadian Dollar' },
  { symbol: 'KRW.AUD', baseCurrency: 'KRW', quoteCurrency: 'AUD', description: 'Korean Won / Australian Dollar' },
  
  // MXN Crosses
  { symbol: 'MXN.JPY', baseCurrency: 'MXN', quoteCurrency: 'JPY', description: 'Mexican Peso / Japanese Yen' },
  
  // Middle East Crosses
  { symbol: 'EUR.OMR', baseCurrency: 'EUR', quoteCurrency: 'OMR', description: 'Euro / Omani Rial' },
  { symbol: 'EUR.KWD', baseCurrency: 'EUR', quoteCurrency: 'KWD', description: 'Euro / Kuwaiti Dinar' },
  { symbol: 'EUR.BHD', baseCurrency: 'EUR', quoteCurrency: 'BHD', description: 'Euro / Bahraini Dinar' },
  { symbol: 'EUR.QAR', baseCurrency: 'EUR', quoteCurrency: 'QAR', description: 'Euro / Qatari Riyal' },
  { symbol: 'EUR.AED', baseCurrency: 'EUR', quoteCurrency: 'AED', description: 'Euro / UAE Dirham' },
  { symbol: 'EUR.SAR', baseCurrency: 'EUR', quoteCurrency: 'SAR', description: 'Euro / Saudi Riyal' }
];

/**
 * Get the base currency for a forex pair (the part before the dot)
 * @param symbol - The forex pair symbol (e.g., EUR.USD)
 * @returns The base currency (e.g., EUR)
 */
export function getForexBaseCurrency(symbol: string): string {
  const parts = symbol.toUpperCase().split('.');
  return parts[0] || symbol;
}

/**
 * Get the quote currency for a forex pair (the part after the dot)
 * @param symbol - The forex pair symbol (e.g., EUR.USD)
 * @returns The quote currency (e.g., USD)
 */
export function getForexQuoteCurrency(symbol: string): string {
  const parts = symbol.toUpperCase().split('.');
  return parts[1] || 'USD';
}

/**
 * Check if a symbol is a forex pair
 * @param symbol - The symbol to check
 * @returns True if the symbol is a forex pair (contains a dot)
 */
export function isForexSymbol(symbol: string): boolean {
  return symbol.includes('.') && IBFX_SYMBOLS.some(fx => fx.symbol === symbol.toUpperCase());
}

/**
 * Get forex symbol details
 * @param symbol - The forex pair symbol (e.g., EUR.USD)
 * @returns The ForexSymbol object or undefined if not found
 */
export function getForexSymbolDetails(symbol: string): ForexSymbol | undefined {
  return IBFX_SYMBOLS.find(fx => fx.symbol === symbol.toUpperCase());
}

/**
 * Get the IBKR formatted symbol for PAXOS crypto
 * IBKR expects just the ticker (BTC), NOT BTC.USD
 * @param symbol - The symbol (e.g., BTC or BTC.USD)
 * @returns The clean ticker symbol (e.g., BTC)
 */
export function getPaxosIBKRSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  // Remove .USD suffix if present - IBKR expects just the ticker
  if (upperSymbol.endsWith('.USD')) {
    return upperSymbol.slice(0, -4);
  }
  return upperSymbol;
}

/**
 * Get the display symbol for PAXOS crypto (same as IBKR symbol now)
 * @param symbol - The symbol (e.g., BTC or BTC.USD)
 * @returns The clean ticker symbol (e.g., BTC)
 */
export function getPaxosDisplaySymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.endsWith('.USD')) {
    return upperSymbol.slice(0, -4);
  }
  return upperSymbol;
}

// =============================================================================
// CURRENCIES BY REGION
// =============================================================================

export const CURRENCIES: Record<string, CurrencyConfig[]> = {
  AMERICAS: [
    { value: 'USD', label: 'USD', description: 'US Dollar' },
    { value: 'CAD', label: 'CAD', description: 'Canadian Dollar' },
    { value: 'MXN', label: 'MXN', description: 'Mexican Peso' },
    { value: 'BRL', label: 'BRL', description: 'Brazilian Real' }
  ],
  US: [
    { value: 'USD', label: 'USD', description: 'US Dollar' },
    { value: 'EUR', label: 'EUR', description: 'Euro' },
    { value: 'GBP', label: 'GBP', description: 'British Pound' },
    { value: 'JPY', label: 'JPY', description: 'Japanese Yen' },
    { value: 'CAD', label: 'CAD', description: 'Canadian Dollar' }
  ],
  CA: [
    { value: 'CAD', label: 'CAD', description: 'Canadian Dollar' },
    { value: 'USD', label: 'USD', description: 'US Dollar' }
  ],
  MX: [
    { value: 'MXN', label: 'MXN', description: 'Mexican Peso' },
    { value: 'USD', label: 'USD', description: 'US Dollar' }
  ],
  BR: [
    { value: 'BRL', label: 'BRL', description: 'Brazilian Real' },
    { value: 'USD', label: 'USD', description: 'US Dollar' }
  ],
  AU: [
    { value: 'AUD', label: 'AUD', description: 'Australian Dollar' },
    { value: 'USD', label: 'USD', description: 'US Dollar' },
    { value: 'EUR', label: 'EUR', description: 'Euro' },
    { value: 'GBP', label: 'GBP', description: 'British Pound' },
    { value: 'JPY', label: 'JPY', description: 'Japanese Yen' }
  ],
  GLOBAL: [
    { value: 'USD', label: 'USD', description: 'US Dollar' },
    { value: 'EUR', label: 'EUR', description: 'Euro' },
    { value: 'GBP', label: 'GBP', description: 'British Pound' },
    { value: 'JPY', label: 'JPY', description: 'Japanese Yen' },
    { value: 'AUD', label: 'AUD', description: 'Australian Dollar' },
    { value: 'CAD', label: 'CAD', description: 'Canadian Dollar' },
    { value: 'CHF', label: 'CHF', description: 'Swiss Franc' },
    { value: 'NZD', label: 'NZD', description: 'New Zealand Dollar' },
    { value: 'HKD', label: 'HKD', description: 'Hong Kong Dollar' },
    { value: 'SGD', label: 'SGD', description: 'Singapore Dollar' }
  ]
};

// =============================================================================
// AMERICAS EXCHANGES - UNITED STATES (52 Exchanges)
// =============================================================================

export const US_EXCHANGES: Exchange[] = [
  // Smart Routing
  { value: 'SMART', label: 'SMART (Best Execution)', description: 'Automated routing for best execution', products: ['STK', 'OPT', 'FUT', 'WAR', 'ETF'] },
  
  // Major Stock Exchanges
  { value: 'NYSE', label: 'NYSE', description: 'New York Stock Exchange', products: ['STK', 'BOND', 'IND', 'WAR'] },
  { value: 'NASDAQ', label: 'NASDAQ', description: 'National Association of Security Dealers', products: ['STK', 'IND', 'WAR'] },
  { value: 'AMEX', label: 'AMEX', description: 'American Stock Exchange', products: ['STK', 'OPT', 'IND', 'WAR'] },
  { value: 'ARCA', label: 'ARCA', description: 'NYSE Arca (Archipelago)', products: ['STK', 'IND', 'WAR'] },
  { value: 'ARCAEDGE', label: 'ARCAEDGE', description: 'ARCAEDGE', products: ['STK'] },
  
  // BATS/CBOE Family
  { value: 'BATS', label: 'BATS', description: 'BATS Trading Inc', products: ['STK', 'OPT', 'IND', 'WAR'] },
  { value: 'BYX', label: 'BYX', description: 'BATS Y Exchange', products: ['STK', 'WAR'] },
  { value: 'EDGX', label: 'EDGX', description: 'BATS Trading EDGX', products: ['STK', 'OPT', 'IND'] },
  { value: 'EDGEA', label: 'EDGEA', description: 'Direct Edge ECN EDGEA', products: ['STK', 'WAR'] },
  
  // NASDAQ Family
  { value: 'BEX', label: 'BEX', description: 'NASDAQ OMX BX', products: ['STK', 'WAR'] },
  { value: 'PSX', label: 'PSX', description: 'Nasdaq OMX PSX', products: ['STK', 'WAR'] },
  { value: 'NASDAQBX', label: 'NASDAQBX', description: 'NASDAQ OMX BX Options Exchange', products: ['OPT'] },
  { value: 'NASDAQOM', label: 'NASDAQOM', description: 'National Association of Security Dealers Options Market', products: ['OPT'] },
  
  // Other ECNs and Stock Exchanges
  { value: 'IEX', label: 'IEX', description: 'Investors Exchange', products: ['STK', 'WAR'] },
  { value: 'LTSE', label: 'LTSE', description: 'Long Term Stock Exchange', products: ['STK', 'WAR'] },
  { value: 'MEMX', label: 'MEMX', description: 'Members Exchange', products: ['STK', 'OPT', 'WAR'] },
  { value: 'CHX', label: 'CHX', description: 'Chicago Stock Exchange', products: ['STK', 'WAR'] },
  { value: 'DRCTEDGE', label: 'DRCTEDGE', description: 'Direct Edge ECN LLC', products: ['STK', 'WAR'] },
  { value: 'ISLAND', label: 'ISLAND', description: 'ISLAND', products: ['STK', 'WAR'] },
  { value: 'NYSEFLOOR', label: 'NYSEFLOOR', description: 'NYSE Floor', products: ['STK', 'WAR'] },
  { value: 'NYSENAT', label: 'NYSENAT', description: 'NYSE National', products: ['STK', 'WAR'] },
  { value: 'T24X', label: 'T24X', description: '24X National Exchange', products: ['STK', 'WAR'] },
  
  // OTC and Pink Sheets
  { value: 'OTCLNKECN', label: 'OTCLNKECN', description: 'OTC Link ECN', products: ['STK', 'WAR'] },
  { value: 'PINK', label: 'PINK', description: 'Pink Sheets', products: ['STK', 'WAR'] },
  
  // Options Exchanges
  { value: 'CBOE', label: 'CBOE', description: 'Chicago Board Options Exchange', products: ['STK', 'OPT', 'IND'] },
  { value: 'CBOE2', label: 'CBOE2', description: 'Chicago Board Options Exchange 2', products: ['OPT', 'IND'] },
  { value: 'BOX', label: 'BOX', description: 'Boston Option Exchange', products: ['OPT'] },
  { value: 'ISE', label: 'ISE', description: 'International Securities Exchange', products: ['STK', 'OPT', 'IND', 'WAR'] },
  { value: 'GEMINI', label: 'GEMINI', description: 'ISE Gemini', products: ['OPT'] },
  { value: 'MERCURY', label: 'MERCURY', description: 'ISE Mercury', products: ['OPT'] },
  { value: 'MIAX', label: 'MIAX', description: 'Miami Options Exchange', products: ['OPT'] },
  { value: 'EMERALD', label: 'EMERALD', description: 'MIAX EMERALD Exchange', products: ['OPT'] },
  { value: 'PEARL', label: 'PEARL', description: 'MIAX PEARL Exchange', products: ['STK', 'OPT', 'WAR'] },
  { value: 'PHLX', label: 'PHLX', description: 'Philadelphia Stock Exchange', products: ['STK', 'OPT', 'IND'] },
  { value: 'PSE', label: 'PSE', description: 'Pacific Stock Exchange', products: ['OPT', 'IND'] },
  { value: 'FORECASTX', label: 'FORECASTX', description: 'ForecastEx', products: ['OPT', 'FOP'] },
  
  // Futures Exchanges
  { value: 'CME', label: 'CME', description: 'Chicago Mercantile Exchange', products: ['FUT', 'IND', 'FOP'] },
  { value: 'CBOT', label: 'CBOT', description: 'Chicago Board of Trade', products: ['FUT', 'IND', 'FOP'] },
  { value: 'NYMEX', label: 'NYMEX', description: 'New York Mercantile Exchange', products: ['FUT', 'IND', 'FOP'] },
  { value: 'COMEX', label: 'COMEX', description: 'Commodity Exchange', products: ['FUT', 'IND', 'FOP'] },
  { value: 'CFE', label: 'CFE', description: 'CBOE Futures Exchange', products: ['FUT', 'IND', 'FOP'] },
  { value: 'CFETAS', label: 'CFETAS', description: 'Chicago Futures Exchange Trading At Settlement', products: ['FUT'] },
  { value: 'NYBOT', label: 'NYBOT', description: 'New York Board of Trade', products: ['FUT', 'IND', 'FOP'] },
  { value: 'NYSELIFFE', label: 'NYSELIFFE', description: 'NYSE Liffe US', products: ['FUT', 'IND', 'FOP'] },
  { value: 'ICEUS', label: 'ICEUS', description: 'Ice Futures US Inc', products: ['FUT'] },
  { value: 'SMFE', label: 'SMFE', description: 'The Small Exchange', products: ['FUT', 'FOP'] },
  
  // Forex - IDEALPRO is the primary forex exchange (IBFX is an alias that may not work)
  { value: 'IDEALPRO', label: 'IDEALPRO (Forex)', description: 'Interactive Brokers Forex Exchange - Primary', products: ['CASH'] },
  { value: 'IBFX', label: 'IBFX (Forex)', description: 'Interactive Brokers Forex Exchange - Routes to IDEALPRO', products: ['CASH'] },
  
  // Other Specialty Exchanges
  { value: 'FUNDSERV', label: 'FUNDSERV', description: 'Mutual Fund Holding Venue', products: ['FUND'] },
  { value: 'TRADEWEB', label: 'TRADEWEB', description: 'TradeWeb Corporate', products: ['BOND'] },
  { value: 'IBKRAM', label: 'IBKRAM', description: 'Interactive Brokers Asset Management', products: ['IND'] },
  { value: 'IBEOS', label: 'IBEOS', description: 'IBKR Overnight Exchange', products: ['STK'] },
  
  // Cryptocurrency
  { value: 'ZEROHASH', label: 'ZEROHASH', description: 'Zero Hash', products: ['CRYPTO'] },
  { value: 'PAXOS', label: 'PAXOS', description: 'Paxos Cryptocurrency Exchange', products: ['CRYPTO'] }
];

// =============================================================================
// AMERICAS EXCHANGES - CANADA (4 Exchanges)
// =============================================================================

export const CA_EXCHANGES: Exchange[] = [
  { value: 'TSE', label: 'TSE', description: 'Toronto Stock Exchange', products: ['STK', 'IND', 'WAR'] },
  { value: 'VENTURE', label: 'VENTURE', description: 'TSX Venture Exchange', products: ['STK', 'WAR'] },
  { value: 'AEQLIT', label: 'AEQLIT', description: 'Aequitas Neo', products: ['STK', 'WAR'] },
  { value: 'CDE', label: 'CDE', description: 'Canadian Derivatives Exchange (Bourse de Montreal)', products: ['FUT', 'OPT', 'IND', 'FOP'] }
];

// =============================================================================
// AMERICAS EXCHANGES - MEXICO (2 Exchanges)
// =============================================================================

export const MX_EXCHANGES: Exchange[] = [
  { value: 'MEXI', label: 'MEXI', description: 'Mexico Stock Exchange', products: ['STK'] },
  { value: 'MEXDER', label: 'MEXDER', description: 'Mercado Mexicano de Derivados', products: ['FUT', 'OPT', 'FOP'] }
];

// =============================================================================
// AMERICAS EXCHANGES - BRAZIL (1 Exchange)
// =============================================================================

export const BR_EXCHANGES: Exchange[] = [
  { value: 'B3', label: 'B3', description: 'Bolsa do Brasil', products: ['STK'] }
];

// =============================================================================
// AUSTRALIA EXCHANGES (Existing)
// =============================================================================

export const AU_EXCHANGES: Exchange[] = [
  { value: 'ASX', label: 'ASX', description: 'Australian Securities Exchange', products: ['STK', 'OPT', 'IND', 'WAR', 'ETF'] },
  { value: 'ASXCEN', label: 'ASXCEN', description: 'ASX Centre Point Dark Pool', products: ['STK'] },
  { value: 'CHIXAU', label: 'CHIXAU', description: 'CBOE Australia (formerly Chi-X)', products: ['STK', 'WAR'] },
  { value: 'SNFE', label: 'SNFE', description: 'Sydney Futures Exchange', products: ['FUT', 'OPT', 'FOP'] }
];

// =============================================================================
// GLOBAL EXCHANGES (Forex/Crypto)
// =============================================================================

export const GLOBAL_EXCHANGES: Exchange[] = [
  { value: 'IDEALPRO', label: 'IDEALPRO (Forex)', description: 'Interactive Brokers forex exchange for currency pairs', products: ['CASH'] },
  { value: 'PAXOS', label: 'PAXOS (Cryptocurrency)', description: 'Paxos cryptocurrency exchange for digital assets', products: ['CRYPTO'] },
  { value: 'ZEROHASH', label: 'ZEROHASH (Cryptocurrency)', description: 'Zero Hash cryptocurrency exchange', products: ['CRYPTO'] }
];

// =============================================================================
// REGION CONFIGURATION
// =============================================================================

export const AMERICAS_COUNTRIES: Country[] = [
  {
    code: 'US',
    label: 'United States',
    currency: 'USD',
    exchanges: US_EXCHANGES
  },
  {
    code: 'CA',
    label: 'Canada',
    currency: 'CAD',
    exchanges: CA_EXCHANGES
  },
  {
    code: 'MX',
    label: 'Mexico',
    currency: 'MXN',
    exchanges: MX_EXCHANGES
  },
  {
    code: 'BR',
    label: 'Brazil',
    currency: 'BRL',
    exchanges: BR_EXCHANGES
  }
];

export const REGIONS: Region[] = [
  {
    code: 'AMERICAS',
    label: 'Americas',
    countries: AMERICAS_COUNTRIES
  },
  {
    code: 'AU',
    label: 'Australia',
    countries: [
      {
        code: 'AU',
        label: 'Australia',
        currency: 'AUD',
        exchanges: AU_EXCHANGES
      }
    ]
  },
  {
    code: 'GLOBAL',
    label: 'Global',
    countries: [
      {
        code: 'GLOBAL',
        label: 'Global Markets',
        currency: 'USD',
        exchanges: GLOBAL_EXCHANGES
      }
    ]
  }
];

// =============================================================================
// POPULAR SYMBOLS BY EXCHANGE
// =============================================================================

export const POPULAR_SYMBOLS: Record<string, Record<string, string[]>> = {
  // US Exchanges
  'SMART': {
    'STK': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ'],
    'OPT': ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMD', 'AMZN', 'MSFT', 'META', 'GOOGL'],
    'ETF': ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'GLD', 'SLV', 'TLT', 'XLF']
  },
  'NASDAQ': {
    'STK': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'ADBE', 'CRM'],
    'ETF': ['QQQ', 'TQQQ', 'SQQQ', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLU', 'XLY']
  },
  'NYSE': {
    'STK': ['JPM', 'JNJ', 'PG', 'UNH', 'HD', 'MA', 'V', 'DIS', 'PYPL', 'BAC'],
    'ETF': ['SPY', 'VTI', 'VOO', 'IVV', 'DIA', 'IWM', 'GLD', 'SLV', 'TLT', 'VEA'],
    'BOND': ['TLT', 'BND', 'AGG', 'LQD', 'HYG', 'MUB', 'VCIT', 'VCSH', 'SHY', 'IEF']
  },
  'AMEX': {
    'STK': ['SPY', 'GLD', 'SLV', 'USO', 'XLF', 'XLE', 'XLV', 'XLI', 'XLU', 'XLY'],
    'OPT': ['SPY', 'GLD', 'SLV', 'USO', 'VXX', 'XLF', 'XLE', 'IWM', 'EEM', 'GDX']
  },
  'ARCA': {
    'STK': ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'GLD', 'SLV', 'TLT', 'XLF']
  },
  'CBOE': {
    'OPT': ['SPX', 'VIX', 'RUT', 'NDX', 'DJX', 'OEX', 'XSP', 'MRUT', 'MXEA', 'MXEF'],
    'IND': ['VIX', 'SPX', 'NDX', 'RUT', 'DJX', 'OEX']
  },
  'CME': {
    'FUT': ['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC', 'SI', 'NG', '6E', '6J'],
    'FOP': ['ES', 'NQ', 'CL', 'GC', 'SI', 'NG', '6E', '6B', '6J', '6A']
  },
  'CBOT': {
    'FUT': ['ZB', 'ZN', 'ZF', 'ZT', 'ZC', 'ZW', 'ZS', 'ZM', 'ZL', 'YM'],
    'FOP': ['ZB', 'ZN', 'ZC', 'ZW', 'ZS']
  },
  'NYMEX': {
    'FUT': ['CL', 'NG', 'HO', 'RB', 'PA', 'PL', 'QM', 'QG', 'BZ', 'MCL'],
    'FOP': ['CL', 'NG', 'HO', 'RB']
  },
  'COMEX': {
    'FUT': ['GC', 'SI', 'HG', 'MGC', 'SIL', 'QO', 'QI', 'GCE', 'SIE', 'HGE'],
    'FOP': ['GC', 'SI', 'HG']
  },
  'IDEALPRO': {
    'CASH': [
      // Major Pairs
      'EUR.USD', 'GBP.USD', 'USD.JPY', 'AUD.USD', 'USD.CAD', 'USD.CHF', 'NZD.USD',
      // Popular Crosses
      'EUR.GBP', 'EUR.JPY', 'GBP.JPY', 'EUR.CHF', 'EUR.AUD', 'EUR.CAD', 'GBP.CHF',
      'AUD.JPY', 'NZD.JPY', 'CAD.JPY', 'CHF.JPY',
      // Exotic Pairs
      'USD.TRY', 'EUR.TRY', 'USD.ZAR', 'EUR.ZAR', 'USD.CNH', 'EUR.CNH'
    ]
  },
  'IBFX': {
    'CASH': [
      // Major Pairs
      'EUR.USD', 'GBP.USD', 'USD.JPY', 'AUD.USD', 'USD.CAD', 'USD.CHF', 'NZD.USD',
      // Popular Crosses
      'EUR.GBP', 'EUR.JPY', 'GBP.JPY', 'EUR.CHF', 'EUR.AUD', 'EUR.CAD', 'GBP.CHF',
      'AUD.JPY', 'NZD.JPY', 'CAD.JPY', 'CHF.JPY',
      // Exotic Pairs
      'USD.TRY', 'EUR.TRY', 'USD.ZAR', 'EUR.ZAR', 'USD.CNH', 'EUR.CNH'
    ]
  },
  'PAXOS': {
    'CRYPTO': ['BTC', 'ETH', 'LTC', 'BCH', 'SOL', 'LINK', 'AAVE', 'MATIC', 'UNI']
  },
  'ZEROHASH': {
    'CRYPTO': ['BTC', 'ETH', 'LTC', 'BCH', 'SOL', 'AVAX', 'LINK', 'MATIC', 'DOT', 'UNI']
  },
  
  // Canadian Exchanges
  'TSE': {
    'STK': ['RY', 'TD', 'BNS', 'BMO', 'CM', 'ENB', 'CNR', 'CP', 'SU', 'TRP'],
    'WAR': ['RY.WT', 'TD.WT', 'BNS.WT']
  },
  'VENTURE': {
    'STK': ['HIVE', 'BITF', 'HUT', 'NXE', 'LUC', 'BES', 'CKK', 'CVE', 'FVI', 'GPV']
  },
  'CDE': {
    'FUT': ['SXF', 'CGB', 'BAX', 'SCF', 'SXM', 'SXA', 'SXB', 'SXH', 'SXY', 'CGZ'],
    'OPT': ['SXO', 'RYO', 'TDO', 'BNSO', 'BMOO', 'ENBO', 'CNRO']
  },
  
  // Mexican Exchanges
  'MEXI': {
    'STK': ['AMXL', 'WALMEX', 'FEMSAUBD', 'GFNORTEO', 'GMEXICOB', 'TLOVISACPO', 'GAPB', 'ASURB', 'KOFUBL', 'CEMEXCPO']
  },
  'MEXDER': {
    'FUT': ['IPC', 'DA', 'TE28', 'DC', 'DL', 'NA', 'CE', 'EU', 'WI', 'FA'],
    'OPT': ['IPCO', 'DAO', 'TEO', 'DCO', 'DLO']
  },
  
  // Brazilian Exchange
  'B3': {
    'STK': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 'BBAS3', 'MGLU3', 'WEGE3', 'RENT3', 'BPAC11']
  },
  
  // Australian Exchanges
  'ASX': {
    'STK': ['CBA', 'CSL', 'NAB', 'ANZ', 'WBC', 'BHP', 'RIO', 'WES', 'WOW', 'MQG'],
    'ETF': ['VAS', 'VGS', 'VAF', 'VGE', 'VGT', 'VISM', 'VESG', 'VDHG', 'VTS', 'VEU'],
    'OPT': ['CBAO', 'CSLO', 'BHPO', 'WBCO', 'NABO', 'ANZO', 'RIOO', 'WESO', 'MQGO', 'TLSO'],
    'WAR': ['CBAW', 'CSLW', 'BHPW', 'WBCW', 'NABW', 'ANZW', 'RIOW', 'WESW', 'MQGW', 'TLSW']
  },
  'ASXCEN': {
    'STK': ['CBA', 'CSL', 'NAB', 'ANZ', 'WBC', 'BHP', 'RIO', 'WES', 'WOW', 'MQG']
  },
  'CHIXAU': {
    'STK': ['CBA', 'CSL', 'NAB', 'ANZ', 'WBC', 'BHP', 'RIO', 'WES', 'WOW', 'MQG'],
    'WAR': ['CBAW', 'CSLW', 'BHPW', 'WBCW', 'NABW', 'ANZW', 'RIOW', 'WESW', 'MQGW', 'TLSW']
  },
  'SNFE': {
    'FUT': ['SPI', 'YT', 'IR', 'XT', 'TF', 'CF', 'WF', 'SF', 'MF', 'BF'],
    'OPT': ['SPIO', 'YTO', 'IRO', 'XTO', 'TFO', 'CFO', 'WFO', 'SFO', 'MFO', 'BFO'],
    'FOP': ['SPIFO', 'YTFO', 'IRFO']
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all exchanges for a specific country
 */
export function getExchangesByCountry(countryCode: string): Exchange[] {
  for (const region of REGIONS) {
    const country = region.countries.find(c => c.code === countryCode);
    if (country) {
      return country.exchanges;
    }
  }
  return [];
}

/**
 * Get all exchanges for a specific region
 */
export function getExchangesByRegion(regionCode: string): Exchange[] {
  const region = REGIONS.find(r => r.code === regionCode);
  if (!region) return [];
  
  return region.countries.flatMap(country => country.exchanges);
}

/**
 * Get available product types for a specific exchange
 */
export function getProductTypesForExchange(exchangeCode: string): ProductTypeConfig[] {
  // Search all regions for the exchange
  for (const region of REGIONS) {
    for (const country of region.countries) {
      const exchange = country.exchanges.find(e => e.value === exchangeCode);
      if (exchange) {
        return PRODUCT_TYPES.filter(pt => exchange.products.includes(pt.value));
      }
    }
  }
  return [];
}

/**
 * Get exchange details by code
 */
export function getExchangeByCode(exchangeCode: string): Exchange | undefined {
  for (const region of REGIONS) {
    for (const country of region.countries) {
      const exchange = country.exchanges.find(e => e.value === exchangeCode);
      if (exchange) {
        return exchange;
      }
    }
  }
  return undefined;
}

/**
 * Get country for an exchange
 */
export function getCountryForExchange(exchangeCode: string): Country | undefined {
  for (const region of REGIONS) {
    for (const country of region.countries) {
      const exchange = country.exchanges.find(e => e.value === exchangeCode);
      if (exchange) {
        return country;
      }
    }
  }
  return undefined;
}

/**
 * Get popular symbols for exchange and product type
 */
export function getPopularSymbolsForExchange(exchangeCode: string, productType?: string): string[] {
  const exchangeSymbols = POPULAR_SYMBOLS[exchangeCode];
  if (!exchangeSymbols) return [];
  
  if (productType && exchangeSymbols[productType]) {
    return exchangeSymbols[productType];
  }
  
  // Return all symbols if no product type specified
  return Object.values(exchangeSymbols).flat();
}

/**
 * Get currencies for a country
 */
export function getCurrenciesForCountry(countryCode: string): CurrencyConfig[] {
  return CURRENCIES[countryCode] || CURRENCIES['GLOBAL'];
}

/**
 * Validate if exchange supports product type
 */
export function exchangeSupportsProduct(exchangeCode: string, productType: ProductType): boolean {
  const exchange = getExchangeByCode(exchangeCode);
  return exchange ? exchange.products.includes(productType) : false;
}

/**
 * Get all unique product types across all exchanges
 */
export function getAllProductTypes(): ProductTypeConfig[] {
  return PRODUCT_TYPES;
}

/**
 * Get exchanges that support a specific product type
 */
export function getExchangesForProductType(productType: ProductType): Exchange[] {
  const exchanges: Exchange[] = [];
  
  for (const region of REGIONS) {
    for (const country of region.countries) {
      for (const exchange of country.exchanges) {
        if (exchange.products.includes(productType)) {
          exchanges.push(exchange);
        }
      }
    }
  }
  
  return exchanges;
}

/**
 * Get default exchange for a country
 */
export function getDefaultExchange(countryCode: string): string {
  const defaults: Record<string, string> = {
    'US': 'SMART',
    'CA': 'TSE',
    'MX': 'MEXI',
    'BR': 'B3',
    'AU': 'ASX',
    'GLOBAL': 'IDEALPRO'
  };
  return defaults[countryCode] || 'SMART';
}

/**
 * Get default product type for an exchange
 */
export function getDefaultProductType(exchangeCode: string): ProductType {
  const exchange = getExchangeByCode(exchangeCode);
  if (!exchange) return 'STK';
  
  // Priority order for default product type
  const priority: ProductType[] = ['STK', 'FUT', 'OPT', 'CASH', 'CRYPTO', 'BOND', 'IND', 'WAR', 'FOP', 'FUND'];
  
  for (const pt of priority) {
    if (exchange.products.includes(pt)) {
      return pt;
    }
  }
  
  return exchange.products[0] || 'STK';
}

