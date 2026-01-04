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
// Symbol mapping: Display Symbol -> IBKR Symbol (automatically converted)
// =============================================================================

export interface PaxosSymbol {
  symbol: string;       // Display symbol (e.g., BTC)
  ibkrSymbol: string;   // IBKR format (e.g., BTC.USD)
  name: string;         // Full name
}

export const PAXOS_SYMBOLS: PaxosSymbol[] = [
  { symbol: 'AAVE', ibkrSymbol: 'AAVE.USD', name: 'Aave' },
  { symbol: 'BCH', ibkrSymbol: 'BCH.USD', name: 'Bitcoin Cash' },
  { symbol: 'BTC', ibkrSymbol: 'BTC.USD', name: 'Bitcoin' },
  { symbol: 'ETH', ibkrSymbol: 'ETH.USD', name: 'Ethereum' },
  { symbol: 'LINK', ibkrSymbol: 'LINK.USD', name: 'Chainlink' },
  { symbol: 'LTC', ibkrSymbol: 'LTC.USD', name: 'Litecoin' },
  { symbol: 'MATIC', ibkrSymbol: 'MATIC.USD', name: 'Polygon' },
  { symbol: 'SOL', ibkrSymbol: 'SOL.USD', name: 'Solana' },
  { symbol: 'UNI', ibkrSymbol: 'UNI.USD', name: 'Uniswap' }
];

/**
 * Get the IBKR formatted symbol for PAXOS crypto
 * @param symbol - The display symbol (e.g., BTC)
 * @returns The IBKR formatted symbol (e.g., BTC.USD)
 */
export function getPaxosIBKRSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  // If already in IBKR format, return as-is
  if (upperSymbol.endsWith('.USD')) {
    return upperSymbol;
  }
  return `${upperSymbol}.USD`;
}

/**
 * Get the display symbol from IBKR format for PAXOS crypto
 * @param ibkrSymbol - The IBKR symbol (e.g., BTC.USD)
 * @returns The display symbol (e.g., BTC)
 */
export function getPaxosDisplaySymbol(ibkrSymbol: string): string {
  const upperSymbol = ibkrSymbol.toUpperCase();
  if (upperSymbol.endsWith('.USD')) {
    return upperSymbol.replace('.USD', '');
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
  
  // Forex
  { value: 'IDEALPRO', label: 'IDEALPRO', description: 'Interactive Brokers Dealing System Pro', products: ['CASH'] },
  { value: 'IBFX', label: 'IBFX', description: 'Interactive Brokers Dealing System Pro', products: ['CASH'] },
  
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
    'CASH': ['EUR.USD', 'GBP.USD', 'USD.JPY', 'AUD.USD', 'USD.CAD', 'USD.CHF', 'NZD.USD', 'EUR.GBP', 'EUR.JPY', 'GBP.JPY']
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

