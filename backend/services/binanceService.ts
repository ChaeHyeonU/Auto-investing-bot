import Binance from 'binance-api-node';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import config from '../config/config';
import logger from '../utils/logger';
import { 
  TradingPair, 
  Order, 
  Portfolio, 
  Asset, 
  CandlestickData, 
  PriceUpdate, 
  OrderBook, 
  Ticker24hr,
  OrderSide,
  OrderType,
  OrderStatus
} from '../../src/types';

interface BinanceOrder {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export class BinanceService extends EventEmitter {
  private client: any;
  private wsConnections: Map<string, WebSocket> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;

  constructor() {
    super();
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const clientConfig: any = {
        apiKey: config.binance.apiKey,
        apiSecret: config.binance.apiSecret,
        recvWindow: config.binance.recvWindow
      };
      
      // Configure for testnet if needed
      if (config.binance.testnet) {
        clientConfig.httpBase = 'https://testnet.binance.vision';
        clientConfig.wsBase = 'wss://testnet.binance.vision';
      }
      
      this.client = Binance(clientConfig);

      logger.info('Binance client initialized', {
        testnet: config.binance.testnet,
        service: 'BinanceService'
      });
    } catch (error) {
      logger.error('Failed to initialize Binance client', { error, service: 'BinanceService' });
      throw error;
    }
  }

  public async connect(): Promise<boolean> {
    try {
      // Test connection
      await this.client.ping();
      
      // Get server time to check connection
      const serverTime = await this.client.time();
      logger.info('Connected to Binance', { 
        serverTime: new Date(serverTime.serverTime).toISOString(),
        service: 'BinanceService'
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to Binance', { error, service: 'BinanceService' });
      this.isConnected = false;
      this.emit('disconnected', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
      service: 'BinanceService'
    });

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  public async getAccountInfo(): Promise<Portfolio> {
    try {
      const accountInfo = await this.client.accountInfo();
      
      const assets: Asset[] = accountInfo.balances
        .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map((balance: any) => ({
          asset: balance.asset,
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked),
          btcValue: 0, // Will be calculated separately
          usdtValue: 0  // Will be calculated separately
        }));

      // Calculate total portfolio value (simplified)
      let totalValue = 0;
      const usdtAsset = assets.find(asset => asset.asset === 'USDT');
      if (usdtAsset) {
        totalValue = usdtAsset.total;
      }

      const portfolio: Portfolio = {
        totalValue,
        totalPnL: 0, // Will be calculated based on historical data
        totalPnLPercentage: 0,
        availableBalance: usdtAsset?.free || 0,
        positions: [], // Will be populated separately
        assets
      };

      return portfolio;
    } catch (error) {
      logger.error('Failed to get account info', { error, service: 'BinanceService' });
      throw error;
    }
  }

  public async getAllTickers(): Promise<TradingPair[]> {
    try {
      const tickers = await this.client.dailyStats();
      
      return tickers.map((ticker: any) => ({
        symbol: ticker.symbol,
        baseAsset: ticker.symbol.replace(/USDT$|BTC$|ETH$|BNB$/, ''),
        quoteAsset: ticker.symbol.match(/USDT$|BTC$|ETH$|BNB$/)?.[0] || '',
        price: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.priceChange),
        volume24h: parseFloat(ticker.volume),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice)
      }));
    } catch (error) {
      logger.error('Failed to get all tickers', { error, service: 'BinanceService' });
      throw error;
    }
  }

  public async getSymbolTicker(symbol: string): Promise<Ticker24hr> {
    try {
      const ticker = await this.client.dailyStats({ symbol });
      
      return {
        symbol: ticker.symbol,
        priceChange: ticker.priceChange,
        priceChangePercent: ticker.priceChangePercent,
        weightedAvgPrice: ticker.weightedAvgPrice,
        prevClosePrice: ticker.prevClosePrice,
        lastPrice: ticker.lastPrice,
        lastQty: ticker.lastQty,
        bidPrice: ticker.bidPrice,
        bidQty: ticker.bidQty,
        askPrice: ticker.askPrice,
        askQty: ticker.askQty,
        openPrice: ticker.openPrice,
        highPrice: ticker.highPrice,
        lowPrice: ticker.lowPrice,
        volume: ticker.volume,
        quoteVolume: ticker.quoteVolume,
        openTime: ticker.openTime,
        closeTime: ticker.closeTime,
        firstId: ticker.firstId,
        lastId: ticker.lastId,
        count: ticker.count
      };
    } catch (error) {
      logger.error('Failed to get symbol ticker', { error, symbol, service: 'BinanceService' });
      throw error;
    }
  }

  public async getKlines(symbol: string, interval: string, limit: number = 500): Promise<CandlestickData[]> {
    try {
      const klines = await this.client.candles({
        symbol,
        interval,
        limit
      });

      return klines.map((kline: any) => ({
        openTime: kline.openTime,
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        closeTime: kline.closeTime,
        quoteAssetVolume: parseFloat(kline.quoteAssetVolume),
        numberOfTrades: kline.numberOfTrades,
        takerBuyBaseAssetVolume: parseFloat(kline.takerBuyBaseAssetVolume),
        takerBuyQuoteAssetVolume: parseFloat(kline.takerBuyQuoteAssetVolume)
      }));
    } catch (error) {
      logger.error('Failed to get klines', { error, symbol, interval, service: 'BinanceService' });
      throw error;
    }
  }

  public async getHistoricalKlines(
    symbol: string, 
    interval: string, 
    startTime: number, 
    endTime: number, 
    limit: number = 1000
  ): Promise<CandlestickData[]> {
    try {
      const klines = await this.client.candles({
        symbol,
        interval,
        startTime,
        endTime,
        limit
      });

      return klines.map((kline: any) => ({
        openTime: kline.openTime,
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        closeTime: kline.closeTime,
        quoteAssetVolume: parseFloat(kline.quoteAssetVolume),
        numberOfTrades: kline.numberOfTrades,
        takerBuyBaseAssetVolume: parseFloat(kline.takerBuyBaseAssetVolume),
        takerBuyQuoteAssetVolume: parseFloat(kline.takerBuyQuoteAssetVolume)
      }));
    } catch (error) {
      logger.error('Failed to get historical klines', { error, symbol, interval, startTime, endTime, service: 'BinanceService' });
      throw error;
    }
  }

  public async getTradeHistory(symbol?: string, limit: number = 100): Promise<Order[]> {
    try {
      if (config.trading.mode === 'PAPER') {
        // Return empty array for paper trading
        return [];
      }

      // For real trading, fetch actual trade history
      const trades = await this.client.myTrades({ symbol, limit });
      
      return trades.map((trade: any) => ({
        id: trade.id.toString(),
        symbol: trade.symbol,
        side: trade.isBuyer ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        status: 'FILLED',
        createdAt: new Date(trade.time),
        updatedAt: new Date(trade.time),
        executedQty: parseFloat(trade.qty),
        cummulativeQuoteQty: parseFloat(trade.quoteQty),
        avgPrice: parseFloat(trade.price),
        pnl: 0 // Would need additional calculation
      }));
    } catch (error) {
      logger.error('Failed to get trade history', { error, symbol, service: 'BinanceService' });
      return [];
    }
  }

  public async getServerTime(): Promise<number> {
    try {
      const time = await this.client.time();
      return time.serverTime;
    } catch (error) {
      logger.error('Failed to get server time', { error, service: 'BinanceService' });
      return Date.now();
    }
  }

  public async get24hrTicker(symbol: string): Promise<any> {
    try {
      const ticker = await this.client.dailyStats({ symbol });
      return ticker;
    } catch (error) {
      logger.error('Failed to get 24hr ticker', { error, symbol, service: 'BinanceService' });
      throw error;
    }
  }

  public async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    try {
      const orderBook = await this.client.book({ symbol, limit });
      
      return {
        lastUpdateId: orderBook.lastUpdateId,
        bids: orderBook.bids,
        asks: orderBook.asks
      };
    } catch (error) {
      logger.error('Failed to get order book', { error, symbol, service: 'BinanceService' });
      throw error;
    }
  }

  public async placeOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    stopPrice?: number
  ): Promise<Order> {
    try {
      if (config.trading.mode === 'PAPER') {
        // Paper trading - simulate order
        const simulatedOrder: Order = {
          id: `PAPER_${Date.now()}`,
          symbol,
          side,
          type,
          quantity,
          price,
          stopPrice,
          status: 'FILLED',
          createdAt: new Date(),
          updatedAt: new Date(),
          executedQty: quantity,
          cummulativeQuoteQty: quantity * (price || 0),
          avgPrice: price
        };

        logger.info('Paper trade executed', { 
          order: simulatedOrder, 
          service: 'BinanceService' 
        });

        return simulatedOrder;
      }

      // Real trading
      const orderParams: any = {
        symbol,
        side: side.toLowerCase(),
        type: type.toLowerCase(),
        quantity: quantity.toString()
      };

      if (type === 'LIMIT') {
        orderParams.price = price?.toString();
        orderParams.timeInForce = 'GTC';
      }

      if (type.includes('STOP')) {
        orderParams.stopPrice = stopPrice?.toString();
      }

      const result: BinanceOrder = await this.client.order(orderParams);

      const order: Order = {
        id: result.orderId.toString(),
        symbol: result.symbol,
        side: result.side as OrderSide,
        type: result.type as OrderType,
        quantity: parseFloat(result.origQty),
        price: parseFloat(result.price),
        status: result.status as OrderStatus,
        createdAt: new Date(result.transactTime),
        updatedAt: new Date(result.transactTime),
        executedQty: parseFloat(result.executedQty),
        cummulativeQuoteQty: parseFloat(result.cummulativeQuoteQty),
        avgPrice: result.fills.length > 0 ? 
          result.fills.reduce((sum, fill) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0) / 
          result.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0) : undefined
      };

      logger.info('Order placed successfully', { 
        order, 
        service: 'BinanceService' 
      });

      return order;
    } catch (error) {
      logger.error('Failed to place order', { 
        error, 
        symbol, 
        side, 
        type, 
        quantity, 
        price, 
        service: 'BinanceService' 
      });
      throw error;
    }
  }

  public async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      if (config.trading.mode === 'PAPER') {
        logger.info('Paper trade order cancelled', { 
          symbol, 
          orderId, 
          service: 'BinanceService' 
        });
        return true;
      }

      await this.client.cancelOrder({
        symbol,
        orderId: parseInt(orderId)
      });

      logger.info('Order cancelled successfully', { 
        symbol, 
        orderId, 
        service: 'BinanceService' 
      });

      return true;
    } catch (error) {
      logger.error('Failed to cancel order', { 
        error, 
        symbol, 
        orderId, 
        service: 'BinanceService' 
      });
      throw error;
    }
  }

  public async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params = symbol ? { symbol } : {};
      const orders = await this.client.openOrders(params);

      return orders.map((order: any) => ({
        id: order.orderId.toString(),
        symbol: order.symbol,
        side: order.side as OrderSide,
        type: order.type as OrderType,
        quantity: parseFloat(order.origQty),
        price: parseFloat(order.price),
        stopPrice: order.stopPrice ? parseFloat(order.stopPrice) : undefined,
        status: order.status as OrderStatus,
        timeInForce: order.timeInForce,
        createdAt: new Date(order.time),
        updatedAt: new Date(order.updateTime),
        executedQty: parseFloat(order.executedQty),
        cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty)
      }));
    } catch (error) {
      logger.error('Failed to get open orders', { error, symbol, service: 'BinanceService' });
      throw error;
    }
  }

  public subscribeToTicker(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    
    if (this.wsConnections.has(streamName)) {
      logger.warn('Already subscribed to ticker', { symbol, service: 'BinanceService' });
      return;
    }

    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
      
      ws.on('open', () => {
        logger.info('Ticker WebSocket connected', { symbol, service: 'BinanceService' });
      });

      ws.on('message', (data: string) => {
        try {
          const ticker = JSON.parse(data);
          const priceUpdate: PriceUpdate = {
            symbol: ticker.s,
            price: parseFloat(ticker.c),
            change: parseFloat(ticker.P),
            changePercent: parseFloat(ticker.P),
            volume: parseFloat(ticker.v),
            high: parseFloat(ticker.h),
            low: parseFloat(ticker.l),
            timestamp: new Date()
          };

          this.emit('priceUpdate', priceUpdate);
        } catch (error) {
          logger.error('Failed to parse ticker data', { error, service: 'BinanceService' });
        }
      });

      ws.on('error', (error) => {
        logger.error('Ticker WebSocket error', { error, symbol, service: 'BinanceService' });
      });

      ws.on('close', () => {
        logger.info('Ticker WebSocket closed', { symbol, service: 'BinanceService' });
        this.wsConnections.delete(streamName);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          this.subscribeToTicker(symbol);
        }, 5000);
      });

      this.wsConnections.set(streamName, ws);
    } catch (error) {
      logger.error('Failed to subscribe to ticker', { error, symbol, service: 'BinanceService' });
    }
  }

  public unsubscribeFromTicker(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const ws = this.wsConnections.get(streamName);
    
    if (ws) {
      ws.close();
      this.wsConnections.delete(streamName);
      logger.info('Unsubscribed from ticker', { symbol, service: 'BinanceService' });
    }
  }

  public subscribeToKline(symbol: string, interval: string): void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    
    if (this.wsConnections.has(streamName)) {
      logger.warn('Already subscribed to kline', { symbol, interval, service: 'BinanceService' });
      return;
    }

    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
      
      ws.on('open', () => {
        logger.info('Kline WebSocket connected', { symbol, interval, service: 'BinanceService' });
      });

      ws.on('message', (data: string) => {
        try {
          const klineData = JSON.parse(data);
          const kline = klineData.k;
          
          if (kline.x) { // Only emit completed klines
            const candlestick: CandlestickData = {
              openTime: kline.t,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
              closeTime: kline.T,
              quoteAssetVolume: parseFloat(kline.q),
              numberOfTrades: kline.n,
              takerBuyBaseAssetVolume: parseFloat(kline.V),
              takerBuyQuoteAssetVolume: parseFloat(kline.Q)
            };

            this.emit('klineUpdate', { symbol, interval, candlestick });
          }
        } catch (error) {
          logger.error('Failed to parse kline data', { error, service: 'BinanceService' });
        }
      });

      ws.on('error', (error) => {
        logger.error('Kline WebSocket error', { error, symbol, interval, service: 'BinanceService' });
      });

      ws.on('close', () => {
        logger.info('Kline WebSocket closed', { symbol, interval, service: 'BinanceService' });
        this.wsConnections.delete(streamName);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          this.subscribeToKline(symbol, interval);
        }, 5000);
      });

      this.wsConnections.set(streamName, ws);
    } catch (error) {
      logger.error('Failed to subscribe to kline', { error, symbol, interval, service: 'BinanceService' });
    }
  }

  public unsubscribeFromKline(symbol: string, interval: string): void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const ws = this.wsConnections.get(streamName);
    
    if (ws) {
      ws.close();
      this.wsConnections.delete(streamName);
      logger.info('Unsubscribed from kline', { symbol, interval, service: 'BinanceService' });
    }
  }

  public isConnectedToBinance(): boolean {
    return this.isConnected;
  }

  public disconnect(): void {
    // Close all WebSocket connections
    this.wsConnections.forEach((ws) => {
      ws.close();
    });
    this.wsConnections.clear();

    this.isConnected = false;
    this.emit('disconnected');
    
    logger.info('Disconnected from Binance', { service: 'BinanceService' });
  }
}

export default BinanceService;