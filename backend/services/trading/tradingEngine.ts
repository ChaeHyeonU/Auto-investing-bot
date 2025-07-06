import { EventEmitter } from 'events';
import { BinanceService } from '../binanceService';
import { IndicatorManager } from '../indicators/indicatorManager';
import { OpenAIService } from '../ai/openaiService';
import { 
  TradingStrategy, 
  Order, 
  Position, 
  Portfolio, 
  CandlestickData, 
  AIAnalysis,
  PriceUpdate,
  TradingEvent 
} from '../../../src/types';
import config from '../../config/config';
import logger from '../../utils/logger';

/**
 * Real-Time Trading Engine
 * 
 * Why This Architecture?
 * - Event-driven design for real-time market response
 * - Multi-layer risk management with circuit breakers
 * - AI integration for intelligent decision making
 * - Comprehensive position and portfolio management
 * - Emergency stop mechanisms for risk control
 * - Detailed logging and audit trail for compliance
 */
export class TradingEngine extends EventEmitter {
  private binanceService: BinanceService;
  private indicatorManagers: Map<string, IndicatorManager> = new Map();
  private aiService: OpenAIService;
  private activeStrategies: Map<string, TradingStrategy> = new Map();
  private activePositions: Map<string, Position> = new Map();
  private portfolio: Portfolio;
  private isRunning: boolean = false;
  private emergencyStop: boolean = false;
  private lastHealthCheck: Date = new Date();
  
  // Risk management parameters
  private readonly maxDailyLoss: number;
  private readonly maxPositions: number = 5;
  private readonly maxPositionSize: number;
  private dailyPnL: number = 0;
  private dailyTradeCount: number = 0;
  private readonly maxDailyTrades: number = 50;

  // Performance tracking
  private tradingStats: {
    totalTrades: number;
    winningTrades: number;
    totalPnL: number;
    startTime: Date;
  };

  constructor() {
    super();
    
    this.binanceService = new BinanceService();
    this.aiService = new OpenAIService();
    
    // Initialize risk parameters from config
    this.maxDailyLoss = config.trading.maxTradeAmount * 0.05; // 5% daily loss limit
    this.maxPositionSize = config.trading.maxTradeAmount * 0.2; // 20% per position
    
    // Initialize portfolio
    this.portfolio = {
      totalValue: 0,
      totalPnL: 0,
      totalPnLPercentage: 0,
      availableBalance: 0,
      positions: [],
      assets: []
    };

    // Initialize trading stats
    this.tradingStats = {
      totalTrades: 0,
      winningTrades: 0,
      totalPnL: 0,
      startTime: new Date()
    };

    this.setupEventHandlers();
    
    logger.info('Trading Engine initialized', {
      maxDailyLoss: this.maxDailyLoss,
      maxPositions: this.maxPositions,
      maxPositionSize: this.maxPositionSize,
      service: 'TradingEngine'
    });
  }

  /**
   * Start the trading engine
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading engine already running', { service: 'TradingEngine' });
      return;
    }

    try {
      logger.info('Starting trading engine...', { service: 'TradingEngine' });

      // Connect to Binance
      await this.binanceService.connect();
      
      // Initialize portfolio
      await this.updatePortfolio();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Reset daily counters
      this.resetDailyCounters();
      
      this.isRunning = true;
      this.emergencyStop = false;
      
      this.emit('engineStarted');
      
      logger.info('Trading engine started successfully', {
        portfolioValue: this.portfolio.totalValue,
        availableBalance: this.portfolio.availableBalance,
        service: 'TradingEngine'
      });
    } catch (error) {
      logger.error('Failed to start trading engine', { error, service: 'TradingEngine' });
      throw error;
    }
  }

  /**
   * Stop the trading engine
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading engine not running', { service: 'TradingEngine' });
      return;
    }

    logger.info('Stopping trading engine...', { service: 'TradingEngine' });

    this.isRunning = false;
    
    // Close all positions if configured to do so
    if (config.trading.mode === 'LIVE') {
      await this.closeAllPositions('Engine shutdown');
    }
    
    // Disconnect from Binance
    this.binanceService.disconnect();
    
    this.emit('engineStopped');
    
    logger.info('Trading engine stopped', {
      finalPnL: this.dailyPnL,
      totalTrades: this.dailyTradeCount,
      service: 'TradingEngine'
    });
  }

  /**
   * Add trading strategy
   */
  public addStrategy(strategy: TradingStrategy): void {
    if (!strategy.isActive) {
      logger.warn('Attempting to add inactive strategy', { 
        strategyId: strategy.id, 
        service: 'TradingEngine' 
      });
      return;
    }

    this.activeStrategies.set(strategy.id, strategy);
    
    // Create indicator managers for strategy symbols
    const symbols = config.trading.symbols;
    symbols.forEach(symbol => {
      if (!this.indicatorManagers.has(symbol)) {
        const indicatorManager = new IndicatorManager(symbol);
        this.indicatorManagers.set(symbol, indicatorManager);
        
        // Subscribe to price updates
        this.binanceService.subscribeToTicker(symbol);
        this.binanceService.subscribeToKline(symbol, config.trading.defaultTimeframe);
      }
    });

    logger.info('Strategy added to trading engine', {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbols: symbols,
      service: 'TradingEngine'
    });
  }

  /**
   * Remove trading strategy
   */
  public removeStrategy(strategyId: string): void {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) {
      logger.warn('Strategy not found for removal', { strategyId, service: 'TradingEngine' });
      return;
    }

    this.activeStrategies.delete(strategyId);
    
    logger.info('Strategy removed from trading engine', {
      strategyId,
      strategyName: strategy.name,
      service: 'TradingEngine'
    });
  }

  /**
   * Process market data and generate trading signals
   */
  public async processMarketData(symbol: string, candle: CandlestickData): Promise<void> {
    if (!this.isRunning || this.emergencyStop) return;

    try {
      // Update indicators
      const indicatorManager = this.indicatorManagers.get(symbol);
      if (!indicatorManager) return;

      indicatorManager.addCandlestickData(candle);

      // Check each active strategy
      for (const strategy of this.activeStrategies.values()) {
        if (this.shouldProcessStrategy(strategy, symbol)) {
          await this.evaluateStrategy(strategy, symbol, indicatorManager);
        }
      }

      // Update portfolio
      await this.updatePortfolio();
      
      // Emit market data event
      this.emit('marketDataProcessed', { symbol, candle });
      
    } catch (error) {
      logger.error('Error processing market data', { 
        error, 
        symbol, 
        service: 'TradingEngine' 
      });
    }
  }

  /**
   * Evaluate strategy and make trading decisions
   */
  private async evaluateStrategy(
    strategy: TradingStrategy, 
    symbol: string, 
    indicatorManager: IndicatorManager
  ): Promise<void> {
    try {
      // Get aggregated signals from indicators
      const signalResult = indicatorManager.getAggregatedSignal();
      
      // Get AI analysis
      const marketData = indicatorManager.getMarketData();
      const aiAnalysis = await this.aiService.analyzeMarketData({
        symbol,
        timeframe: config.trading.defaultTimeframe,
        marketData,
        indicators: marketData.indicators,
        context: `Real-time trading evaluation for strategy: ${strategy.name}`
      });

      // Combine technical and AI signals
      const finalDecision = this.combineSignals(signalResult, aiAnalysis, strategy);
      
      // Check if we should execute trade
      if (finalDecision.shouldTrade) {
        await this.executeTrade(finalDecision, symbol, strategy, aiAnalysis);
      }

      // Check existing positions for management
      await this.manageExistingPositions(symbol, signalResult, aiAnalysis);
      
    } catch (error) {
      logger.error('Error evaluating strategy', { 
        error, 
        strategyId: strategy.id, 
        symbol, 
        service: 'TradingEngine' 
      });
    }
  }

  /**
   * Combine technical and AI signals
   */
  private combineSignals(
    signalResult: any, 
    aiAnalysis: AIAnalysis, 
    strategy: TradingStrategy
  ): TradingDecision {
    // Weight the signals
    const technicalWeight = 0.4;
    const aiWeight = 0.6;
    
    const technicalScore = this.calculateTechnicalScore(signalResult);
    const aiScore = this.calculateAIScore(aiAnalysis);
    
    const combinedScore = (technicalScore * technicalWeight) + (aiScore * aiWeight);
    const combinedConfidence = (signalResult.confidence * technicalWeight) + (aiAnalysis.confidence * aiWeight);
    
    // Determine final action
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let shouldTrade = false;
    
    if (combinedScore > 0.6 && combinedConfidence > 70) {
      action = signalResult.signal === 'BUY' || aiAnalysis.recommendation.includes('BUY') ? 'BUY' : 'SELL';
      shouldTrade = true;
    }

    // Additional risk checks
    shouldTrade = shouldTrade && this.passesRiskChecks(action, strategy);

    return {
      action,
      shouldTrade,
      confidence: combinedConfidence,
      reasoning: this.generateDecisionReasoning(signalResult, aiAnalysis, combinedScore),
      technicalSignal: signalResult,
      aiAnalysis
    };
  }

  /**
   * Execute trade based on decision
   */
  private async executeTrade(
    decision: TradingDecision,
    symbol: string,
    strategy: TradingStrategy,
    aiAnalysis: AIAnalysis
  ): Promise<void> {
    try {
      // Calculate position size
      const positionSize = this.calculatePositionSize(decision, strategy, aiAnalysis);
      
      if (positionSize <= 0) {
        logger.warn('Position size too small, skipping trade', {
          symbol,
          positionSize,
          service: 'TradingEngine'
        });
        return;
      }

      // Place order (only if not HOLD)
      if (decision.action === 'HOLD') {
        return;
      }
      
      const order = await this.binanceService.placeOrder(
        symbol,
        decision.action as 'BUY' | 'SELL',
        'MARKET', // Using market orders for simplicity
        positionSize
      );

      // Track the trade
      this.trackTrade(order, strategy, aiAnalysis, decision);
      
      // Update daily counters
      this.dailyTradeCount++;
      
      // Emit trade event
      this.emit('tradeExecuted', {
        order,
        strategy: strategy.id,
        decision,
        aiAnalysis
      });

      logger.info('Trade executed successfully', {
        symbol,
        action: decision.action,
        quantity: positionSize,
        confidence: decision.confidence,
        strategyId: strategy.id,
        service: 'TradingEngine'
      });

    } catch (error) {
      logger.error('Failed to execute trade', {
        error,
        symbol,
        action: decision.action,
        service: 'TradingEngine'
      });
      
      this.emit('tradeError', { error, symbol, decision });
    }
  }

  /**
   * Manage existing positions
   */
  private async manageExistingPositions(
    symbol: string, 
    signalResult: any, 
    aiAnalysis: AIAnalysis
  ): Promise<void> {
    const position = this.activePositions.get(symbol);
    if (!position) return;

    try {
      // Update position with current price
      const currentPrice = await this.getCurrentPrice(symbol);
      this.updatePositionPnL(position, currentPrice);

      // Check stop loss and take profit
      const shouldClose = this.shouldClosePosition(position, signalResult, aiAnalysis);
      
      if (shouldClose.close) {
        await this.closePosition(position, shouldClose.reason);
      }

    } catch (error) {
      logger.error('Error managing position', { 
        error, 
        symbol, 
        service: 'TradingEngine' 
      });
    }
  }

  /**
   * Calculate position size based on risk management
   */
  private calculatePositionSize(
    decision: TradingDecision, 
    strategy: TradingStrategy, 
    aiAnalysis: AIAnalysis
  ): number {
    const availableCash = this.portfolio.availableBalance;
    const riskPerTrade = strategy.riskManagement.riskPerTrade;
    const confidence = decision.confidence / 100;
    
    // Base position size on risk per trade
    let positionSize = (availableCash * riskPerTrade) / 100;
    
    // Adjust based on confidence
    positionSize *= confidence;
    
    // Adjust based on AI risk assessment
    const riskMultiplier = aiAnalysis.riskLevel === 'LOW' ? 1.2 : 
                          aiAnalysis.riskLevel === 'HIGH' ? 0.7 : 1.0;
    positionSize *= riskMultiplier;
    
    // Apply maximum position size limit
    positionSize = Math.min(positionSize, this.maxPositionSize);
    
    // Ensure we don't exceed portfolio limits
    positionSize = Math.min(positionSize, availableCash * 0.9); // Leave 10% buffer
    
    return Math.floor(positionSize);
  }

  /**
   * Risk management checks
   */
  private passesRiskChecks(action: 'BUY' | 'SELL' | 'HOLD', strategy: TradingStrategy): boolean {
    // Check daily loss limit
    if (this.dailyPnL <= -this.maxDailyLoss) {
      logger.warn('Daily loss limit exceeded', { 
        dailyPnL: this.dailyPnL, 
        limit: this.maxDailyLoss,
        service: 'TradingEngine' 
      });
      return false;
    }

    // Check daily trade limit
    if (this.dailyTradeCount >= this.maxDailyTrades) {
      logger.warn('Daily trade limit exceeded', { 
        tradeCount: this.dailyTradeCount,
        service: 'TradingEngine' 
      });
      return false;
    }

    // Check position limit
    if (this.activePositions.size >= this.maxPositions) {
      logger.warn('Maximum positions reached', { 
        activePositions: this.activePositions.size,
        service: 'TradingEngine' 
      });
      return false;
    }

    // Check emergency stop
    if (this.emergencyStop) {
      logger.warn('Emergency stop active', { service: 'TradingEngine' });
      return false;
    }

    return true;
  }

  /**
   * Emergency stop all trading
   */
  public async emergencyStopAll(): Promise<void> {
    logger.warn('EMERGENCY STOP ACTIVATED', { service: 'TradingEngine' });
    
    this.emergencyStop = true;
    
    // Close all positions
    await this.closeAllPositions('Emergency stop');
    
    // Cancel all open orders
    await this.cancelAllOrders();
    
    this.emit('emergencyStop');
  }

  /**
   * Close all positions
   */
  private async closeAllPositions(reason: string): Promise<void> {
    const positions = Array.from(this.activePositions.values());
    
    for (const position of positions) {
      try {
        await this.closePosition(position, reason);
      } catch (error) {
        logger.error('Failed to close position during emergency stop', {
          error,
          symbol: position.symbol,
          service: 'TradingEngine'
        });
      }
    }
  }

  /**
   * Close single position
   */
  private async closePosition(position: Position, reason: string): Promise<void> {
    try {
      const order = await this.binanceService.placeOrder(
        position.symbol,
        position.side === 'LONG' ? 'SELL' : 'BUY',
        'MARKET',
        position.quantity
      );

      // Update daily P&L
      this.dailyPnL += position.pnl;
      
      // Update trading stats
      this.tradingStats.totalTrades++;
      this.tradingStats.totalPnL += position.pnl;
      if (position.pnl > 0) {
        this.tradingStats.winningTrades++;
      }

      // Remove from active positions
      this.activePositions.delete(position.symbol);

      this.emit('positionClosed', { position, order, reason });

      logger.info('Position closed', {
        symbol: position.symbol,
        pnl: position.pnl,
        reason,
        service: 'TradingEngine'
      });

    } catch (error) {
      logger.error('Failed to close position', {
        error,
        symbol: position.symbol,
        service: 'TradingEngine'
      });
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Binance service events
    this.binanceService.on('priceUpdate', (priceUpdate: PriceUpdate) => {
      this.handlePriceUpdate(priceUpdate);
    });

    this.binanceService.on('klineUpdate', (data: any) => {
      this.processMarketData(data.symbol, data.candlestick);
    });

    this.binanceService.on('disconnected', () => {
      logger.warn('Binance connection lost', { service: 'TradingEngine' });
      this.emit('connectionLost');
    });

    this.binanceService.on('connected', () => {
      logger.info('Binance connection restored', { service: 'TradingEngine' });
      this.emit('connectionRestored');
    });
  }

  /**
   * Handle price updates
   */
  private handlePriceUpdate(priceUpdate: PriceUpdate): void {
    // Update positions with new prices
    const position = this.activePositions.get(priceUpdate.symbol);
    if (position) {
      this.updatePositionPnL(position, priceUpdate.price);
    }

    this.emit('priceUpdate', priceUpdate);
  }

  /**
   * Update position P&L
   */
  private updatePositionPnL(position: Position, currentPrice: number): void {
    position.currentPrice = currentPrice;
    
    if (position.side === 'LONG') {
      position.pnl = (currentPrice - position.averagePrice) * position.quantity;
    } else {
      position.pnl = (position.averagePrice - currentPrice) * position.quantity;
    }
    
    position.pnlPercentage = (position.pnl / (position.averagePrice * position.quantity)) * 100;
    position.value = position.quantity * currentPrice;
  }

  /**
   * Get current price for symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    const ticker = await this.binanceService.getSymbolTicker(symbol);
    return parseFloat(ticker.lastPrice);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const now = new Date();
    
    // Check if Binance connection is healthy
    if (!this.binanceService.isConnectedToBinance()) {
      logger.warn('Binance connection unhealthy', { service: 'TradingEngine' });
      this.emit('healthCheckFailed', 'Binance connection');
    }

    // Check for excessive losses
    if (this.dailyPnL <= -this.maxDailyLoss * 0.8) { // 80% of limit
      logger.warn('Approaching daily loss limit', {
        dailyPnL: this.dailyPnL,
        limit: this.maxDailyLoss,
        service: 'TradingEngine'
      });
      this.emit('riskWarning', 'Daily loss approaching limit');
    }

    this.lastHealthCheck = now;
    this.emit('healthCheckCompleted');
  }

  /**
   * Reset daily counters (call at start of each trading day)
   */
  private resetDailyCounters(): void {
    this.dailyPnL = 0;
    this.dailyTradeCount = 0;
    
    logger.info('Daily counters reset', { service: 'TradingEngine' });
  }

  /**
   * Update portfolio information
   */
  private async updatePortfolio(): Promise<void> {
    try {
      this.portfolio = await this.binanceService.getAccountInfo();
    } catch (error) {
      logger.error('Failed to update portfolio', { error, service: 'TradingEngine' });
    }
  }

  // Helper methods
  private shouldProcessStrategy(strategy: TradingStrategy, symbol: string): boolean {
    return strategy.isActive && config.trading.symbols.includes(symbol);
  }

  private calculateTechnicalScore(signalResult: any): number {
    const signalMap: Record<string, number> = { 'BUY': 1, 'SELL': -1, 'NEUTRAL': 0 };
    return (signalMap[signalResult.signal] || 0) * (signalResult.confidence / 100);
  }

  private calculateAIScore(aiAnalysis: AIAnalysis): number {
    const signalMap = { 
      'STRONG_BUY': 1, 'BUY': 0.7, 'HOLD': 0, 'SELL': -0.7, 'STRONG_SELL': -1 
    };
    return (signalMap[aiAnalysis.recommendation] || 0) * (aiAnalysis.confidence / 100);
  }

  private generateDecisionReasoning(signalResult: any, aiAnalysis: AIAnalysis, score: number): string {
    return `Combined analysis (Score: ${score.toFixed(2)}). Technical: ${signalResult.signal} (${signalResult.confidence}%). AI: ${aiAnalysis.recommendation} (${aiAnalysis.confidence}%). ${aiAnalysis.reasoning}`;
  }

  private trackTrade(order: Order, strategy: TradingStrategy, aiAnalysis: AIAnalysis, decision: TradingDecision): void {
    // Create position if it's an opening trade
    if (order.status === 'FILLED') {
      const position: Position = {
        symbol: order.symbol,
        quantity: order.executedQty,
        averagePrice: order.avgPrice || order.price || 0,
        avgPrice: order.avgPrice || order.price || 0,
        currentPrice: order.avgPrice || order.price || 0,
        pnl: 0,
        unrealizedPnL: 0,
        pnlPercentage: 0,
        value: order.executedQty * (order.avgPrice || order.price || 0),
        side: order.side === 'BUY' ? 'LONG' : 'SHORT'
      };

      this.activePositions.set(order.symbol, position);
    }
  }

  private shouldClosePosition(position: Position, signalResult: any, aiAnalysis: AIAnalysis): { close: boolean; reason: string } {
    // Stop loss check
    if (position.pnlPercentage <= -5) { // 5% stop loss
      return { close: true, reason: 'Stop loss triggered' };
    }

    // Take profit check
    if (position.pnlPercentage >= 10) { // 10% take profit
      return { close: true, reason: 'Take profit triggered' };
    }

    // Signal reversal check
    const isOppositeSignal = (
      (position.side === 'LONG' && (signalResult.signal === 'SELL' || aiAnalysis.recommendation.includes('SELL'))) ||
      (position.side === 'SHORT' && (signalResult.signal === 'BUY' || aiAnalysis.recommendation.includes('BUY')))
    );

    if (isOppositeSignal && aiAnalysis.confidence > 75) {
      return { close: true, reason: 'Signal reversal detected' };
    }

    return { close: false, reason: '' };
  }

  private async cancelAllOrders(): Promise<void> {
    try {
      for (const symbol of config.trading.symbols) {
        const openOrders = await this.binanceService.getOpenOrders(symbol);
        for (const order of openOrders) {
          await this.binanceService.cancelOrder(symbol, order.id);
        }
      }
    } catch (error) {
      logger.error('Failed to cancel all orders', { error, service: 'TradingEngine' });
    }
  }

  // Getters for monitoring
  public getPortfolio(): Portfolio { return this.portfolio; }
  public getActivePositions(): Position[] { return Array.from(this.activePositions.values()); }
  public getTradingStats(): any { return this.tradingStats; }
  public getDailyPnL(): number { return this.dailyPnL; }
  public isEngineRunning(): boolean { return this.isRunning; }
  public isEmergencyStop(): boolean { return this.emergencyStop; }
}

// Type definitions
interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  shouldTrade: boolean;
  confidence: number;
  reasoning: string;
  technicalSignal: any;
  aiAnalysis: AIAnalysis;
}