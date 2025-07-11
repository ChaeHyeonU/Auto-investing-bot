import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
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

/**
 * Binance API 직접 구현
 * 공식 Binance Testnet 문서 기반으로 구현
 * https://github.com/binance/binance-spot-api-docs/tree/master/testnet
 */
export class BinanceApiDirect extends EventEmitter {
  private httpClient: AxiosInstance;
  private baseURL: string;
  private wsBaseURL: string;
  private apiKey: string;
  private apiSecret: string;
  private isTestnet: boolean;
  private wsConnections: Map<string, WebSocket> = new Map();
  private isConnected: boolean = false;

  constructor() {
    super();
    
    this.apiKey = config.binance.apiKey;
    this.apiSecret = config.binance.apiSecret;
    this.isTestnet = config.binance.testnet;
    
    // 공식 문서에 따른 올바른 URL 설정
    if (this.isTestnet) {
      this.baseURL = 'https://testnet.binance.vision/api';
      this.wsBaseURL = 'wss://stream.testnet.binance.vision/ws';
    } else {
      this.baseURL = 'https://api.binance.com/api';
      this.wsBaseURL = 'wss://stream.binance.com:9443/ws';
    }

    // HTTP 클라이언트 설정
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    logger.info('✅ Binance API Direct 초기화 완료', {
      testnet: this.isTestnet,
      baseURL: this.baseURL,
      wsBaseURL: this.wsBaseURL,
      service: 'BinanceApiDirect'
    });
  }

  /**
   * 서명 생성 (HMAC SHA256)
   */
  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * 인증이 필요한 요청용 파라미터 생성
   */
  private getSignedParams(params: Record<string, any> = {}): string {
    const timestamp = Date.now();
    const queryParams: Record<string, any> = {
      ...params,
      timestamp,
      recvWindow: config.binance.recvWindow || 5000
    };

    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${queryParams[key]}`)
      .join('&');

    const signature = this.createSignature(queryString);
    return `${queryString}&signature=${signature}`;
  }

  /**
   * 연결 테스트
   */
  async connect(): Promise<void> {
    try {
      logger.info('🔄 Binance API 연결 테스트 중...', { service: 'BinanceApiDirect' });

      // 1. 서버 시간 확인
      const timeResponse = await this.httpClient.get('/v3/time');
      const serverTime = timeResponse.data.serverTime;
      logger.info('⏰ 서버 시간 확인 성공', { 
        serverTime: new Date(serverTime).toISOString(),
        service: 'BinanceApiDirect' 
      });

      // 2. 계정 정보 조회로 API 키 검증
      const accountInfo = await this.getAccountInfo();
      logger.info('🔑 API 키 검증 성공', { 
        accountType: accountInfo.assets?.length ? 'Active' : 'Empty',
        service: 'BinanceApiDirect' 
      });

      this.isConnected = true;
      this.emit('connected');
      
      logger.info('✅ Binance API 연결 완료', { service: 'BinanceApiDirect' });
    } catch (error: any) {
      this.isConnected = false;
      this.handleError(error, 'API 연결');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 계정 정보 조회
   */
  async getAccountInfo(): Promise<Portfolio> {
    try {
      const params = this.getSignedParams();
      const response = await this.httpClient.get(`/v3/account?${params}`);
      const accountData = response.data;

      const assets: Asset[] = accountData.balances
        .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map((balance: any) => ({
          symbol: balance.asset,
          amount: parseFloat(balance.free) + parseFloat(balance.locked),
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked)
        }));

      const totalValue = assets.reduce((sum, asset) => sum + asset.amount, 0);

      return {
        totalValue,
        assets,
        availableBalance: totalValue,
        positions: [],
        totalPnL: 0,
        totalPnLPercentage: 0,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.handleError(error, '계정 정보 조회');
      throw error;
    }
  }

  /**
   * 24시간 티커 조회
   */
  async get24hrTicker(symbol: string): Promise<Ticker24hr> {
    try {
      const response = await this.httpClient.get(`/v3/ticker/24hr?symbol=${symbol}`);
      const ticker = response.data;

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
      this.handleError(error, `24시간 티커 조회 (${symbol})`);
      throw error;
    }
  }

  /**
   * K라인 데이터 조회
   */
  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<Kline[]> {
    try {
      const response = await this.httpClient.get(`/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const klines = response.data;

      return klines.map((kline: any[]) => ({
        openTime: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: kline[6],
        quoteAssetVolume: parseFloat(kline[7]),
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: parseFloat(kline[9]),
        takerBuyQuoteAssetVolume: parseFloat(kline[10])
      }));
    } catch (error: any) {
      this.handleError(error, `K라인 조회 (${symbol})`);
      throw error;
    }
  }

  /**
   * 주문 생성
   */
  async createOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    timeInForce: string = 'GTC'
  ): Promise<Order> {
    try {
      const params: any = {
        symbol,
        side,
        type,
        quantity: quantity.toString()
      };

      if (type === 'LIMIT') {
        params.price = price?.toString();
        params.timeInForce = timeInForce;
      }

      const queryString = this.getSignedParams(params);
      const response = await this.httpClient.post(`/v3/order?${queryString}`);
      const orderData = response.data;

      return {
        id: orderData.orderId.toString(),
        symbol: orderData.symbol,
        side: orderData.side as OrderSide,
        type: orderData.type as OrderType,
        quantity: parseFloat(orderData.origQty),
        price: parseFloat(orderData.price || '0'),
        status: orderData.status as OrderStatus,
        createdAt: new Date(orderData.transactTime),
        updatedAt: new Date(orderData.transactTime),
        executedQty: parseFloat(orderData.executedQty),
        cummulativeQuoteQty: parseFloat(orderData.cummulativeQuoteQty)
      };
    } catch (error: any) {
      this.handleError(error, `주문 생성 (${symbol})`);
      throw error;
    }
  }

  /**
   * WebSocket 스트림 구독
   */
  subscribeToTicker(symbol: string, callback: (data: any) => void): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const wsUrl = `${this.wsBaseURL}/${streamName}`;
    
    if (this.wsConnections.has(streamName)) {
      logger.warn('이미 구독 중인 스트림', { symbol, service: 'BinanceApiDirect' });
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        logger.info('✅ 티커 WebSocket 연결 성공', { symbol, service: 'BinanceApiDirect' });
      });

      ws.on('message', (data: Buffer) => {
        try {
          const ticker = JSON.parse(data.toString());
          callback(ticker);
        } catch (error) {
          logger.error('티커 데이터 파싱 실패', { error, service: 'BinanceApiDirect' });
        }
      });

      ws.on('error', (error) => {
        logger.error('티커 WebSocket 에러', { error, symbol, service: 'BinanceApiDirect' });
      });

      ws.on('close', () => {
        logger.info('티커 WebSocket 연결 종료', { symbol, service: 'BinanceApiDirect' });
        this.wsConnections.delete(streamName);
      });

      this.wsConnections.set(streamName, ws);
    } catch (error) {
      logger.error('티커 WebSocket 구독 실패', { error, symbol, service: 'BinanceApiDirect' });
    }
  }

  /**
   * K라인 WebSocket 구독
   */
  subscribeToKlines(symbol: string, interval: string, callback: (data: any) => void): void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `${this.wsBaseURL}/${streamName}`;

    if (this.wsConnections.has(streamName)) {
      logger.warn('이미 구독 중인 K라인 스트림', { symbol, interval, service: 'BinanceApiDirect' });
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        logger.info('✅ K라인 WebSocket 연결 성공', { symbol, interval, service: 'BinanceApiDirect' });
      });

      ws.on('message', (data: Buffer) => {
        try {
          const klineData = JSON.parse(data.toString());
          if (klineData.k && klineData.k.x) { // 완료된 K라인만 처리
            callback(klineData.k);
          }
        } catch (error) {
          logger.error('K라인 데이터 파싱 실패', { error, service: 'BinanceApiDirect' });
        }
      });

      ws.on('error', (error) => {
        logger.error('K라인 WebSocket 에러', { error, symbol, interval, service: 'BinanceApiDirect' });
      });

      ws.on('close', () => {
        logger.info('K라인 WebSocket 연결 종료', { symbol, interval, service: 'BinanceApiDirect' });
        this.wsConnections.delete(streamName);
      });

      this.wsConnections.set(streamName, ws);
    } catch (error) {
      logger.error('K라인 WebSocket 구독 실패', { error, symbol, interval, service: 'BinanceApiDirect' });
    }
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void {
    for (const [streamName, ws] of this.wsConnections.entries()) {
      try {
        ws.close();
        this.wsConnections.delete(streamName);
      } catch (error) {
        logger.error('WebSocket 연결 해제 실패', { streamName, error, service: 'BinanceApiDirect' });
      }
    }

    this.isConnected = false;
    this.emit('disconnected');
    logger.info('🔌 Binance API 연결 해제', { service: 'BinanceApiDirect' });
  }

  /**
   * 에러 처리
   */
  private handleError(error: any, operation: string): void {
    const errorCode = error.response?.data?.code || error.code;
    const errorMsg = error.response?.data?.msg || error.message;

    logger.error(`❌ ${operation} 실패`, {
      code: errorCode,
      message: errorMsg,
      status: error.response?.status,
      service: 'BinanceApiDirect'
    });

    // Binance 에러 코드별 안내
    switch (errorCode) {
      case -2015:
        logger.error('🔑 API 키 권한 문제 - Testnet에서 새로운 API 키 생성 필요');
        break;
      case -1021:
        logger.error('⏰ 타임스탬프 문제 - 시스템 시간 동기화 확인 필요');
        break;
      case -1022:
        logger.error('🔐 서명 문제 - API Secret 키 확인 필요');
        break;
    }
  }

  /**
   * 주문 취소
   */
  async cancelOrder(symbol: string, orderId: string): Promise<any> {
    try {
      const params = { symbol, orderId: parseInt(orderId) };
      const queryString = this.getSignedParams(params);
      const response = await this.httpClient.delete(`/v3/order?${queryString}`);
      return response.data;
    } catch (error: any) {
      this.handleError(error, `주문 취소 (${symbol}, ${orderId})`);
      throw error;
    }
  }

  /**
   * 열린 주문 조회
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params = symbol ? { symbol } : {};
      const queryString = this.getSignedParams(params);
      const response = await this.httpClient.get(`/v3/openOrders?${queryString}`);
      const orders = response.data;

      return orders.map((order: any) => ({
        id: order.orderId.toString(),
        symbol: order.symbol,
        side: order.side as OrderSide,
        type: order.type as OrderType,
        quantity: parseFloat(order.origQty),
        price: parseFloat(order.price || '0'),
        status: order.status as OrderStatus,
        createdAt: new Date(order.time),
        updatedAt: new Date(order.updateTime),
        executedQty: parseFloat(order.executedQty),
        cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty)
      }));
    } catch (error: any) {
      this.handleError(error, `열린 주문 조회 (${symbol || '전체'})`);
      throw error;
    }
  }

  /**
   * 거래 이력 조회
   */
  async getTradeHistory(params: { symbol?: string; limit?: number } = {}): Promise<Trade[]> {
    try {
      const { symbol, limit = 500 } = params;
      
      if (!symbol) {
        // 주요 심볼들만 조회
        const mainSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
        const allTrades: Trade[] = [];
        
        for (const sym of mainSymbols) {
          try {
            const trades = await this.getSymbolTrades(sym, 100);
            allTrades.push(...trades);
          } catch (error) {
            // 개별 심볼 에러는 무시하고 계속
            logger.warn(`거래 이력 조회 실패: ${sym}`, { error });
          }
        }
        
        return allTrades.slice(0, limit);
      } else {
        return this.getSymbolTrades(symbol, limit);
      }
    } catch (error: any) {
      this.handleError(error, '거래 이력 조회');
      throw error;
    }
  }

  private async getSymbolTrades(symbol: string, limit: number): Promise<Trade[]> {
    const params = { symbol, limit };
    const queryString = this.getSignedParams(params);
    const response = await this.httpClient.get(`/v3/myTrades?${queryString}`);
    const trades = response.data;

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
  }

  /**
   * 주문 생성 (별칭)
   */
  async placeOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    stopPrice?: number,
    timeInForce?: string
  ): Promise<Order> {
    return this.createOrder(symbol, side, type, quantity, price, timeInForce);
  }

  /**
   * 심볼 티커 조회 (별칭)
   */
  async getSymbolTicker(symbol: string): Promise<Ticker24hr> {
    return this.get24hrTicker(symbol);
  }

  // Getter methods
  isConnectedToBinance(): boolean { return this.isConnected; }
  getServerTime(): Promise<number> {
    return this.httpClient.get('/v3/time').then(response => response.data.serverTime);
  }
}

export default BinanceApiDirect;