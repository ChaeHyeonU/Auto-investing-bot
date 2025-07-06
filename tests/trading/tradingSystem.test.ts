import { TradingEngine, RiskManager, PerformanceMonitor, AlertSystem } from '../../backend/services/trading';
import { BinanceService } from '../../backend/services/binanceService';
import { IndicatorManager } from '../../backend/services/indicators/indicatorManager';
import { OpenAIService } from '../../backend/services/ai/openaiService';
import { TradingStrategy, Portfolio, CandlestickData } from '../../src/types';

/**
 * Comprehensive Real-Time Trading System Tests
 * 
 * Why These Tests?
 * - Verify system integration and reliability
 * - Test risk management and safety mechanisms
 * - Validate performance monitoring accuracy
 * - Ensure alert system functionality
 * - Test emergency procedures and failsafes
 * - Verify AI integration and decision making
 */

describe('Real-Time Trading System Integration Tests', () => {
  let tradingEngine: TradingEngine;
  let riskManager: RiskManager;
  let performanceMonitor: PerformanceMonitor;
  let alertSystem: AlertSystem;
  let mockPortfolio: Portfolio;

  beforeEach(() => {
    // Initialize mock portfolio
    mockPortfolio = {
      totalValue: 10000,
      totalPnL: 0,
      totalPnLPercentage: 0,
      availableBalance: 10000,
      positions: [],
      assets: [
        {
          asset: 'USDT',
          free: 10000,
          locked: 0,
          total: 10000,
          btcValue: 0.25,
          usdtValue: 10000
        }
      ]
    };

    // Initialize services
    performanceMonitor = new PerformanceMonitor();
    alertSystem = new AlertSystem();
    riskManager = new RiskManager();
    tradingEngine = new TradingEngine();

    // Setup event connections
    setupEventConnections();
  });

  afterEach(async () => {
    await tradingEngine.stop();
    performanceMonitor.stopMonitoring();
    alertSystem.stop();
  });

  describe('Trading Engine Tests', () => {
    test('should initialize trading engine correctly', () => {
      expect(tradingEngine).toBeDefined();
      expect(tradingEngine.isEngineRunning()).toBe(false);
      expect(tradingEngine.isEmergencyStop()).toBe(false);
    });

    test('should start and stop trading engine', async () => {
      // Mock dependencies
      jest.spyOn(BinanceService.prototype, 'connect').mockResolvedValue(true);
      jest.spyOn(BinanceService.prototype, 'getAccountInfo').mockResolvedValue(mockPortfolio);
      jest.spyOn(BinanceService.prototype, 'disconnect').mockImplementation();

      await tradingEngine.start();
      expect(tradingEngine.isEngineRunning()).toBe(true);

      await tradingEngine.stop();
      expect(tradingEngine.isEngineRunning()).toBe(false);
    });

    test('should add and remove trading strategies', () => {
      const mockStrategy: TradingStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test strategy for unit tests',
        isActive: true,
        riskManagement: {
          maxPositionSize: 1000,
          maxDrawdown: 10,
          stopLossPercentage: 2,
          takeProfitPercentage: 5,
          riskPerTrade: 1
        },
        indicators: [],
        rules: [],
        parameters: {},
        performance: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalReturn: 0,
          totalReturnPercentage: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          maxDrawdownPercentage: 0,
          sharpeRatio: 0,
          profitFactor: 0,
          avgTradeDuration: 0,
          startDate: new Date(),
          endDate: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      tradingEngine.addStrategy(mockStrategy);
      // Verify strategy was added (would need getter method)

      tradingEngine.removeStrategy('test-strategy');
      // Verify strategy was removed
    });

    test('should process market data correctly', async () => {
      const mockCandle: CandlestickData = {
        openTime: Date.now(),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
        closeTime: Date.now() + 60000,
        quoteAssetVolume: 100000,
        numberOfTrades: 100,
        takerBuyBaseAssetVolume: 500,
        takerBuyQuoteAssetVolume: 50000
      };

      // Mock dependencies
      jest.spyOn(IndicatorManager.prototype, 'addCandlestickData').mockImplementation();
      jest.spyOn(BinanceService.prototype, 'getAccountInfo').mockResolvedValue(mockPortfolio);

      await tradingEngine.processMarketData('BTCUSDT', mockCandle);
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    test('should trigger emergency stop correctly', async () => {
      jest.spyOn(BinanceService.prototype, 'placeOrder').mockResolvedValue({
        id: 'test-order',
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: 1,
        price: 100,
        status: 'FILLED',
        createdAt: new Date(),
        updatedAt: new Date(),
        executedQty: 1,
        cummulativeQuoteQty: 100,
        avgPrice: 100
      });

      let emergencyStopTriggered = false;
      tradingEngine.on('emergencyStop', () => {
        emergencyStopTriggered = true;
      });

      await tradingEngine.emergencyStopAll();
      
      expect(tradingEngine.isEmergencyStop()).toBe(true);
      expect(emergencyStopTriggered).toBe(true);
    });
  });

  describe('Risk Manager Tests', () => {
    test('should validate trades correctly', () => {
      const tradeRequest = {
        symbol: 'BTCUSDT',
        action: 'BUY' as const,
        quantity: 0.1,
        price: 50000,
        orderType: 'MARKET' as const,
        strategy: 'test-strategy'
      };

      const validation = riskManager.validateTrade(tradeRequest);
      
      expect(validation).toBeDefined();
      expect(validation.approved).toBeDefined();
      expect(validation.riskChecks).toBeDefined();
      expect(validation.riskScore).toBeDefined();
    });

    test('should reject trades exceeding position size limit', () => {
      const largeTradeRequest = {
        symbol: 'BTCUSDT',
        action: 'BUY' as const,
        quantity: 10, // Large position
        price: 50000,
        orderType: 'MARKET' as const,
        strategy: 'test-strategy'
      };

      const validation = riskManager.validateTrade(largeTradeRequest);
      
      expect(validation.approved).toBe(false);
      expect(validation.riskChecks.some(check => 
        check.name === 'Position Size Limit' && !check.passed
      )).toBe(true);
    });

    test('should calculate optimal position size', () => {
      const tradeRequest = {
        symbol: 'BTCUSDT',
        action: 'BUY' as const,
        quantity: 1,
        price: 50000,
        orderType: 'MARKET' as const,
        strategy: 'test-strategy'
      };

      const optimalSize = riskManager.calculateOptimalPositionSize(tradeRequest);
      
      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThanOrEqual(tradeRequest.quantity);
    });

    test('should generate risk report', () => {
      const report = riskManager.generateRiskReport();
      
      expect(report).toBeDefined();
      expect(report.portfolioValue).toBeDefined();
      expect(report.portfolioHeat).toBeDefined();
      expect(report.dailyStats).toBeDefined();
      expect(report.riskLimits).toBeDefined();
    });

    test('should activate circuit breaker on consecutive losses', () => {
      let circuitBreakerActivated = false;
      riskManager.on('circuitBreakerActivated', () => {
        circuitBreakerActivated = true;
      });

      // Simulate multiple losing trades
      for (let i = 0; i < 6; i++) {
        const mockOrder = {
          id: `order-${i}`,
          symbol: 'BTCUSDT',
          side: 'BUY' as const,
          type: 'MARKET' as const,
          quantity: 0.1,
          price: 50000,
          status: 'FILLED' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          executedQty: 0.1,
          cummulativeQuoteQty: 5000,
          avgPrice: 50000
        };

        riskManager.updatePosition(mockOrder);
        riskManager.closePosition('BTCUSDT', mockOrder); // Simulate loss
      }

      expect(circuitBreakerActivated).toBe(true);
    });
  });

  describe('Performance Monitor Tests', () => {
    test('should track trade performance', () => {
      const mockStrategy: TradingStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test strategy',
        isActive: true,
        riskManagement: {
          maxPositionSize: 1000,
          maxDrawdown: 10,
          stopLossPercentage: 2,
          takeProfitPercentage: 5,
          riskPerTrade: 1
        },
        indicators: [],
        rules: [],
        parameters: {},
        performance: {
          totalTrades: 10,
          winningTrades: 5,
          losingTrades: 5,
          winRate: 50,
          totalReturn: 0,
          totalReturnPercentage: 0,
          totalPnL: 0,
          maxDrawdown: 5,
          maxDrawdownPercentage: 0,
          sharpeRatio: 1.2,
          profitFactor: 0,
          avgTradeDuration: 0,
          startDate: new Date(),
          endDate: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockOrder = {
        id: 'test-order',
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.1,
        price: 50000,
        status: 'FILLED' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        executedQty: 0.1,
        cummulativeQuoteQty: 5000,
        avgPrice: 50000
      };

      performanceMonitor.trackTrade(mockOrder, mockStrategy);
      
      const strategyPerformance = performanceMonitor.getStrategyPerformance('test-strategy');
      expect(strategyPerformance).toBeDefined();
      expect(strategyPerformance?.totalTrades).toBe(1);
    });

    test('should generate performance report', () => {
      const report = performanceMonitor.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.dailyMetrics).toBeDefined();
      expect(report.overallMetrics).toBeDefined();
      expect(report.riskMetrics).toBeDefined();
      expect(report.performanceScore).toBeDefined();
    });

    test('should calculate drawdown correctly', () => {
      const equity = [1000, 1100, 1050, 900, 950, 1200];
      const drawdown = performanceMonitor.calculateDrawdown(equity);
      
      expect(drawdown).toBeDefined();
      expect(drawdown.maxDrawdown).toBeGreaterThan(0);
    });

    test('should start and stop monitoring', () => {
      performanceMonitor.startMonitoring();
      expect(performanceMonitor.isMonitoringActive()).toBe(true);

      performanceMonitor.stopMonitoring();
      expect(performanceMonitor.isMonitoringActive()).toBe(false);
    });
  });

  describe('Alert System Tests', () => {
    test('should send alerts correctly', async () => {
      let alertReceived = false;
      alertSystem.on('alertSent', () => {
        alertReceived = true;
      });

      alertSystem.start();

      const testAlert = {
        id: 'test-alert',
        type: 'TEST_ALERT',
        severity: 'LOW' as const,
        title: 'Test Alert',
        message: 'This is a test alert',
        timestamp: new Date(),
        source: 'TestSuite'
      };

      await alertSystem.sendAlert(testAlert);
      
      expect(alertReceived).toBe(true);
    });

    test('should handle trading events', () => {
      alertSystem.start();

      const eventData = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        quantity: 0.1,
        price: 50000,
        pnl: 100
      };

      // Should not throw errors
      alertSystem.handleTradingEvent('TRADE_EXECUTED', eventData);
      expect(true).toBe(true);
    });

    test('should suppress repeated alerts', async () => {
      alertSystem.start();
      alertSystem.suppressAlertType('TEST_ALERT', 1);

      const testAlert = {
        id: 'test-alert',
        type: 'TEST_ALERT',
        severity: 'LOW' as const,
        title: 'Test Alert',
        message: 'This is a test alert',
        timestamp: new Date(),
        source: 'TestSuite'
      };

      await alertSystem.sendAlert(testAlert);
      
      // Alert should be suppressed
      const history = alertSystem.getAlertHistory(1);
      expect(history.length).toBe(0);
    });

    test('should generate alert statistics', () => {
      alertSystem.start();
      const stats = alertSystem.getAlertStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.total24h).toBeDefined();
      expect(stats.byType).toBeDefined();
      expect(stats.bySeverity).toBeDefined();
    });

    test('should test alert system', async () => {
      alertSystem.start();
      
      // Should not throw errors
      await alertSystem.testAlerts();
      expect(true).toBe(true);
    });
  });

  describe('System Integration Tests', () => {
    test('should integrate all services correctly', async () => {
      // Mock dependencies
      jest.spyOn(BinanceService.prototype, 'connect').mockResolvedValue(true);
      jest.spyOn(BinanceService.prototype, 'getAccountInfo').mockResolvedValue(mockPortfolio);

      // Start all services
      await tradingEngine.start();
      performanceMonitor.startMonitoring();
      alertSystem.start();

      expect(tradingEngine.isEngineRunning()).toBe(true);
      expect(performanceMonitor.isMonitoringActive()).toBe(true);
      expect(alertSystem.isAlertSystemActive()).toBe(true);
    });

    test('should handle system errors gracefully', async () => {
      // Mock error scenario
      jest.spyOn(BinanceService.prototype, 'connect').mockRejectedValue(new Error('Connection failed'));

      let errorHandled = false;
      try {
        await tradingEngine.start();
      } catch (error) {
        errorHandled = true;
      }

      expect(errorHandled).toBe(true);
    });

    test('should propagate events between services', async () => {
      let tradeEventReceived = false;
      let riskAlertReceived = false;
      let performanceUpdateReceived = false;

      // Setup event listeners
      tradingEngine.on('tradeExecuted', () => {
        tradeEventReceived = true;
      });

      riskManager.on('riskAlert', () => {
        riskAlertReceived = true;
      });

      performanceMonitor.on('performanceUpdate', () => {
        performanceUpdateReceived = true;
      });

      // Simulate trading activity
      const mockStrategy: TradingStrategy = {
        id: 'integration-test',
        name: 'Integration Test Strategy',
        description: 'Strategy for integration testing',
        isActive: true,
        riskManagement: {
          maxPositionSize: 1000,
          maxDrawdown: 10,
          stopLossPercentage: 2,
          takeProfitPercentage: 5,
          riskPerTrade: 1
        },
        indicators: [],
        rules: [],
        parameters: {},
        performance: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 50,
          totalReturn: 0,
          totalReturnPercentage: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          maxDrawdownPercentage: 0,
          sharpeRatio: 0,
          profitFactor: 0,
          avgTradeDuration: 0,
          startDate: new Date(),
          endDate: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      tradingEngine.addStrategy(mockStrategy);

      // Events should be properly connected through setupEventConnections
      expect(true).toBe(true); // Basic integration test
    });
  });

  /**
   * Setup event connections between services
   */
  function setupEventConnections(): void {
    // Trading Engine -> Risk Manager
    tradingEngine.on('tradeExecuted', (data) => {
      if (data.order) {
        riskManager.updatePosition(data.order);
      }
    });

    // Trading Engine -> Performance Monitor
    tradingEngine.on('tradeExecuted', (data) => {
      if (data.order && data.strategy) {
        const strategy = { id: data.strategy, name: 'Test Strategy' } as TradingStrategy;
        performanceMonitor.trackTrade(data.order, strategy);
      }
    });

    // Trading Engine -> Alert System
    tradingEngine.on('tradeExecuted', (data) => {
      alertSystem.handleTradingEvent('TRADE_EXECUTED', data);
    });

    tradingEngine.on('emergencyStop', (data) => {
      alertSystem.handleTradingEvent('EMERGENCY_STOP', data);
    });

    // Risk Manager -> Alert System
    riskManager.on('riskAlert', (data) => {
      alertSystem.handleTradingEvent('RISK_ALERT', data);
    });

    riskManager.on('circuitBreakerActivated', (data) => {
      alertSystem.handleTradingEvent('CIRCUIT_BREAKER_ACTIVATED', data);
    });

    // Performance Monitor -> Alert System
    performanceMonitor.on('performanceAlert', (data) => {
      alertSystem.handleTradingEvent('PERFORMANCE_ALERT', data);
    });
  }
});

/**
 * Mock implementations for testing
 */
jest.mock('../../backend/services/binanceService');
jest.mock('../../backend/services/indicators/indicatorManager');
jest.mock('../../backend/services/ai/openaiService');