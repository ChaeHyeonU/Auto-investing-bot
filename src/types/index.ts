// Trading Types
export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  createdAt: Date;
  updatedAt: Date;
  executedQty: number;
  cummulativeQuoteQty: number;
  avgPrice?: number;
}

export interface Portfolio {
  totalValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  availableBalance: number;
  positions: Position[];
  assets: Asset[];
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  value: number;
  side: 'LONG' | 'SHORT';
}

export interface Asset {
  asset: string;
  free: number;
  locked: number;
  total: number;
  btcValue: number;
  usdtValue: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  strategy?: string;
  status: 'OPEN' | 'CLOSED' | 'PARTIAL';
  entryTime: Date;
  exitTime?: Date;
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
  notes?: string;
}

// Technical Indicators
export interface TechnicalIndicator {
  name: string;
  value: number | number[];
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number; // 0-100
  timestamp: Date;
  parameters?: Record<string, any>;
}

export interface CandlestickData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
}

export interface MarketData {
  symbol: string;
  candlesticks: CandlestickData[];
  indicators: TechnicalIndicator[];
  orderBook?: OrderBook;
  ticker?: Ticker24hr;
}

export interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface Ticker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// Trading Strategy
export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  indicators: IndicatorConfig[];
  rules: TradingRule[];
  riskManagement: RiskManagementConfig;
  isActive: boolean;
  performance: StrategyPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndicatorConfig {
  name: string;
  type: string;
  parameters: Record<string, any>;
  weight: number;
}

export interface TradingRule {
  condition: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface RiskManagementConfig {
  maxPositionSize: number;
  maxDrawdown: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  riskPerTrade: number;
}

export interface StrategyPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercentage: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  sharpeRatio: number;
  profitFactor: number;
  avgTradeDuration: number;
  startDate: Date;
  endDate: Date;
}

// Backtest
export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  timeframe: string;
  commission: number;
  slippage: number;
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercentage: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equity: EquityPoint[];
  createdAt: Date;
}

export interface BacktestTrade {
  id: string;
  entryDate: Date;
  exitDate?: Date;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercentage?: number;
  commission: number;
  reason: string;
  status: 'OPEN' | 'CLOSED';
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
}

// AI Analysis
export interface AIAnalysisRequest {
  symbol: string;
  timeframe: string;
  marketData: MarketData;
  indicators: TechnicalIndicator[];
  context?: string;
}

export interface AIAnalysis {
  id: string;
  symbol: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  targetPrice?: number;
  stopLoss?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeframe: string;
  indicators: IndicatorAnalysis[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timestamp: Date;
}

export interface IndicatorAnalysis {
  name: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
  interpretation: string;
}

// Notion Integration
export interface TradingJournalEntry {
  id: string;
  date: Date;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  reasoning: string;
  aiAnalysis: AIAnalysis;
  strategy: string;
  outcome?: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  pnl?: number;
  pnlPercentage?: number;
  lessons?: string;
  screenshots?: string[];
  tags?: string[];
}

export interface NotionPage {
  id: string;
  title: string;
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Configuration
export interface AppConfig {
  binance: BinanceConfig;
  openai: OpenAIConfig;
  notion: NotionConfig;
  trading: TradingConfig;
  server: ServerConfig;
}

export interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  recvWindow?: number;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

export interface TradingConfig {
  mode: 'PAPER' | 'LIVE';
  maxTradeAmount: number;
  riskPercentage: number;
  symbols: string[];
  timeframes: string[];
  defaultTimeframe: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

// WebSocket Data
export interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: Date;
}

export interface TradeUpdate {
  symbol: string;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
  tradeId: number;
}

// Dashboard
export interface DashboardData {
  portfolio: Portfolio;
  activeStrategies: TradingStrategy[];
  recentTrades: Order[];
  priceUpdates: PriceUpdate[];
  aiAnalyses: AIAnalysis[];
  systemStatus: SystemStatus;
}

export interface SystemStatus {
  isConnected: boolean;
  lastUpdate: Date;
  uptime: number;
  errors: SystemError[];
  performance: PerformanceMetrics;
}

export interface SystemError {
  id: string;
  type: 'API_ERROR' | 'TRADING_ERROR' | 'SYSTEM_ERROR';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceMetrics {
  apiLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Event Types
export interface TradingEvent {
  type: 'TRADE_EXECUTED' | 'STRATEGY_ACTIVATED' | 'STRATEGY_DEACTIVATED' | 'ERROR_OCCURRED' | 'ANALYSIS_COMPLETED';
  data: any;
  timestamp: Date;
}

// Utility Types
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';

export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED';

export type TradingMode = 'PAPER' | 'LIVE';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';