import Binance from 'binance-api-node';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import config from '../config/config';
import logger from '../utils/logger';
import { 
  OrderSide, 
  OrderType, 
  Asset, 
  Portfolio, 
  Ticker24hr, 
  Kline, 
  Order, 
  Trade,
  OrderStatus
} from '../../src/types';

interface BinanceOrder {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  origQty: string;
  price: string;
  status: string;
  transactTime: number;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export class BinanceService extends EventEmitter {
  private client: any;
  private wsConnections: Map<string, any> = new Map();
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
        // binance-api-node에서는 sandbox 옵션 사용
        clientConfig.sandbox = true;
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

  /**
   * Binance API 에러 처리
   */
  private handleBinanceError(error: any, operation: string) {
    const errorCode = error.code || error.response?.data?.code;
    const errorMsg = error.msg || error.response?.data?.msg || error.message;

    logger.error(`❌ ${operation} 실패:`, {
      code: errorCode,
      message: errorMsg,
      status: error.response?.status
    });

    // 일반적인 에러 코드별 처리
    switch (errorCode) {
      case -2015:
        logger.error('🔑 API 키 문제: 유효하지 않은 API 키 또는 권한 부족');
        logger.error('💡 해결 방법:');
        logger.error('   1. Binance 테스트넷에서 새로운 API 키 생성');
        logger.error('   2. "Spot & Margin Trading" 권한 활성화');
        logger.error('   3. .env.local 파일의 API 키 업데이트');
        logger.error('   4. 서버 재시작');
        break;
      case -2014:
        logger.error('🔑 API 키 형식 오류');
        break;
      case -1021:
        logger.error('⏰ 타임스탬프 오류: 시스템 시간 확인 필요');
        break;
      case -1022:
        logger.error('🔐 서명 오류: Secret 키 확인 필요');
        break;
      default:
        logger.error(`🚨 알 수 없는 오류 (코드: ${errorCode})`);
    }

    throw error;
  }

  /**
   * API 키 유효성 검사
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.accountInfo();
      logger.info('✅ Binance API 키 검증 성공');
      return true;
    } catch (error: any) {
      this.handleBinanceError(error, 'API 키 검증');
      return false;
    }
  }

  public async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        logger.info('Already connected to Binance', { service: 'BinanceService' });
        return;
      }

      const serverTime = await this.client.time();
      logger.info('Connected to Binance', { 
        serverTime: new Date(serverTime.serverTime).toISOString(),
        service: 'BinanceService'
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      // 연결 후 API 키 검증
      await this.validateApiKey();

    } catch (error: any) {
      logger.error('Failed to connect to Binance', { error, service: 'BinanceService' });
      this.handleBinanceError(error, '연결');
      this.emit('error', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, {
          service: 'BinanceService'
        });
        
        setTimeout(() => this.connect(), this.reconnectDelay);
      } else {
        logger.error('Max reconnection attempts reached', { service: 'BinanceService' });
        this.emit('maxReconnectAttemptsReached');
      }
    }
  }

  public async getAccountInfo(): Promise<Portfolio> {
    try {
      const accountInfo = await this.client.accountInfo();
      
      const assets: Asset[] = accountInfo.balances
        .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map((balance: any) => ({
          symbol: balance.asset,
          amount: parseFloat(balance.free) + parseFloat(balance.locked),
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked)
        }));

      const totalValue = assets.reduce((sum, asset) => sum + asset.amount, 0);

      const portfolio: Portfolio = {
        totalValue,
        assets,
        timestamp: new Date(),
        positions: [],
        totalPnL: 0,
        totalPnLPercentage: 0,
        availableBalance: totalValue
      };

      return portfolio;
    } catch (error: any) {
      this.handleBinanceError(error, '계정 정보 조회');
      throw error;
    }
  }

  public async getAllTickers(): Promise<Ticker24hr[]> {
    try {
      const tickers = await this.client.dailyStats();
      
      return tickers.map((ticker: any) => ({
        symbol: ticker.symbol,
        baseAsset: ticker.symbol.replace(/USDT$|BTC$|ETH$|BNB$/, ''),
        quoteAsset: ticker.symbol.match(/USDT$|BTC$|ETH$|BNB$/)?.[0] || '',
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
      }));
    } catch (error: any) {
      this.handleBinanceError(error, '전체 티커 조회');
      throw error;
    }
  }

  public async getSymbolTicker(symbol: string): Promise<Ticker24hr> {
    try {
      const ticker = await this.client.dailyStats({ symbol });
      
      return {
        symbol: ticker.symbol,
        baseAsset: ticker.symbol.replace(/USDT$|BTC$|ETH$|BNB$/, ''),
        quoteAsset: ticker.symbol.match(/USDT$|BTC$|ETH$|BNB$/)?.[0] || '',
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
    } catch (error: any) {
      this.handleBinanceError(error, `심볼 티커 조회 (${symbol})`);
      throw error;
    }
  }

  public async getKlines(symbol: string, interval: string, limit: number = 500): Promise<Kline[]> {
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
    } catch (error: any) {
      this.handleBinanceError(error, `K라인 조회 (${symbol})`);
      throw error;
    }
  }

  public async getHistoricalKlines(
    symbol: string, 
    interval: string, 
    startTime: number, 
    endTime: number, 
    limit: number = 1000
  ): Promise<Kline[]> {
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
    } catch (error: any) {
      this.handleBinanceError(error, `과거 K라인 조회 (${symbol})`);
      throw error;
    }
  }

  public async getRecentTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
      const trades = await this.client.myTrades({ symbol, limit });
      
      return trades.map((trade: any) => ({
        id: trade.id.toString(),
        symbol: trade.symbol,
        side: trade.isBuyer ? 'BUY' : 'SELL',
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        commission: parseFloat(trade.commission),
        commissionAsset: trade.commissionAsset,
        time: new Date(trade.time),
        isBuyer: trade.isBuyer,
        isMaker: trade.isMaker
      }));
    } catch (error: any) {
      this.handleBinanceError(error, `최근 거래 조회 (${symbol})`);
      throw error;
    }
  }

  public async getServerTime(): Promise<number> {
    try {
      const time = await this.client.time();
      return time.serverTime;
    } catch (error: any) {
      this.handleBinanceError(error, '서버 시간 조회');
      throw error;
    }
  }

  public async get24hrTicker(symbol: string): Promise<any> {
    try {
      const ticker = await this.client.dailyStats({ symbol });
      return ticker;
    } catch (error: any) {
      this.handleBinanceError(error, `24시간 티커 조회 (${symbol})`);
      throw error;
    }
  }

  public async getOrderBook(symbol: string, limit: number = 100): Promise<any> {
    try {
      const orderBook = await this.client.book({ symbol, limit });
      
      return {
        lastUpdateId: orderBook.lastUpdateId,
        bids: orderBook.bids,
        asks: orderBook.asks
      };
    } catch (error: any) {
      this.handleBinanceError(error, `호가창 조회 (${symbol})`);
      throw error;
    }
  }

  public async createOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    stopPrice?: number,
    timeInForce?: string
  ): Promise<Order> {
    try {
      const orderParams: any = {
        symbol,
        side,
        type,
        quantity: quantity.toString()
      };

      if (price) {
        orderParams.price = price.toString();
      }

      if (stopPrice) {
        orderParams.stopPrice = stopPrice.toString();
      }

      if (timeInForce) {
        orderParams.timeInForce = timeInForce;
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

      logger.info('Order created successfully', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        service: 'BinanceService'
      });

      return order;
    } catch (error: any) {
      this.handleBinanceError(error, `주문 생성 (${symbol})`);
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
        status: order.status as OrderStatus,
        createdAt: new Date(order.time),
        updatedAt: new Date(order.updateTime),
        executedQty: parseFloat(order.executedQty),
        cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty)
      }));
    } catch (error: any) {
      this.handleBinanceError(error, `열린 주문 조회 (${symbol || '전체'})`);
      throw error;
    }
  }

  public async cancelOrder(symbol: string, orderId: string): Promise<any> {
    try {
      const result = await this.client.cancelOrder({
        symbol,
        orderId: parseInt(orderId)
      });

      logger.info('Order cancelled successfully', {
        orderId: result.orderId,
        symbol: result.symbol,
        service: 'BinanceService'
      });

      return result;
    } catch (error: any) {
      this.handleBinanceError(error, `주문 취소 (${symbol}, ${orderId})`);
      throw error;
    }
  }

  public async subscribeToTicker(symbol: string, callback: (data: any) => void): Promise<void> {
    try {
      const stream = this.client.ws.ticker(symbol, callback);
      this.wsConnections.set(`ticker_${symbol}`, stream);
      
      logger.info('Subscribed to ticker stream', { symbol, service: 'BinanceService' });
    } catch (error: any) {
      this.handleBinanceError(error, `티커 구독 (${symbol})`);
      throw error;
    }
  }

  public async subscribeToKlines(symbol: string, interval: string, callback: (data: any) => void): Promise<void> {
    try {
      const stream = this.client.ws.candles(symbol, interval, callback);
      this.wsConnections.set(`klines_${symbol}_${interval}`, stream);
      
      logger.info('Subscribed to klines stream', { symbol, interval, service: 'BinanceService' });
    } catch (error: any) {
      this.handleBinanceError(error, `K라인 구독 (${symbol})`);
      throw error;
    }
  }

  public async subscribeToUserData(callback: (data: any) => void): Promise<void> {
    try {
      const stream = this.client.ws.user(callback);
      this.wsConnections.set('user_data', stream);
      
      logger.info('Subscribed to user data stream', { service: 'BinanceService' });
    } catch (error: any) {
      this.handleBinanceError(error, '사용자 데이터 구독');
      throw error;
    }
  }

  public async unsubscribe(streamKey: string): Promise<void> {
    try {
      const stream = this.wsConnections.get(streamKey);
      if (stream) {
        if (typeof stream === 'function') {
          stream();
        } else if (stream && typeof stream.close === 'function') {
          stream.close();
        }
        this.wsConnections.delete(streamKey);
        logger.info('Unsubscribed from stream', { streamKey, service: 'BinanceService' });
      }
    } catch (error: any) {
      this.handleBinanceError(error, `구독 해제 (${streamKey})`);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    // Close all WebSocket connections
    for (const [key, stream] of this.wsConnections.entries()) {
      try {
        if (typeof stream === 'function') {
          stream();
        } else if (stream && typeof stream.close === 'function') {
          stream.close();
        }
        this.wsConnections.delete(key);
      } catch (error) {
        logger.error('Failed to close WebSocket connection', { key, error, service: 'BinanceService' });
      }
    }

    this.isConnected = false;
    this.emit('disconnected');
    logger.info('Disconnected from Binance', { service: 'BinanceService' });
  }

  /**
   * 서비스 상태 확인
   */
  async getServiceStatus() {
    try {
      // 기본 연결 테스트
      const serverTime = await this.getServerTime();
      
      // API 키 검증
      const isApiKeyValid = await this.validateApiKey();

      return {
        isConnected: true,
        serverTime,
        isTestnet: config.binance.testnet,
        apiKeyValid: isApiKeyValid,
        timestamp: Date.now()
      };
    } catch (error: any) {
      logger.error('❌ Binance 서비스 상태 확인 실패:', error.message);
      return {
        isConnected: false,
        serverTime: null,
        isTestnet: config.binance.testnet,
        apiKeyValid: false,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * 거래 이력 조회
   */
  public async getTradeHistory(params: { symbol?: string; limit?: number } = {}): Promise<Trade[]> {
    try {
      const { symbol, limit = 500 } = params;
      
      let trades: any[];
      if (symbol) {
        trades = await this.client.myTrades({ symbol, limit });
      } else {
        // 주요 심볼들만 조회
        const mainSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
        trades = [];
        for (const sym of mainSymbols) {
          try {
            const symTrades = await this.client.myTrades({ symbol: sym, limit: 100 });
            trades.push(...symTrades);
          } catch (error) {
            logger.warn(`Failed to get trades for ${sym}`, { error });
          }
        }
      }

      return trades.map((trade: any) => ({
        id: trade.id.toString(),
        symbol: trade.symbol,
        side: trade.isBuyer ? 'BUY' : 'SELL',
        entryPrice: parseFloat(trade.price),
        quantity: parseFloat(trade.qty),
        pnl: parseFloat(trade.quoteQty) * (trade.isBuyer ? -1 : 1),
        commission: parseFloat(trade.commission),
        entryTime: new Date(trade.time),
        status: 'CLOSED'
      }));
    } catch (error: any) {
      logger.error('Failed to get trade history', { error, params, service: 'BinanceService' });
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  public isConnectedToBinance(): boolean {
    return this.isConnected;
  }

  /**
   * 주문 생성 (별칭)
   */
  public async placeOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    stopPrice?: number,
    timeInForce?: string
  ): Promise<Order> {
    return this.createOrder(symbol, side, type, quantity, price, stopPrice, timeInForce);
  }
}

export default BinanceService;
export const binanceService = new BinanceService();