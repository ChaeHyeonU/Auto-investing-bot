import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from './config/config';
import logger from './utils/logger';

// Import route handlers
import tradingRoutes from './api/trading';
import portfolioRoutes from './api/portfolio';
import strategyRoutes from './api/strategy';
import backtestRoutes from './api/backtest';
import analyticsRoutes from './api/analytics';
import settingsRoutes from './api/settings';
import notionRoutes from './api/notion';

// Import services
import { TradingEngine, RiskManager, PerformanceMonitor, AlertSystem } from './services/trading';
import { BinanceApiDirect } from './services/binanceApiDirect';

/**
 * Express.js Backend Server with TypeScript
 * 
 * Why This Architecture?
 * - RESTful API design for clear separation of concerns
 * - Real-time WebSocket support for live trading data
 * - Comprehensive middleware stack for security and logging
 * - Service-oriented architecture for scalability
 * - Production-ready error handling and monitoring
 * - Seamless integration with trading engine services
 */

class TradingServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private tradingEngine!: TradingEngine;
  private riskManager!: RiskManager;
  private performanceMonitor!: PerformanceMonitor;
  private alertSystem!: AlertSystem;
  private binanceService!: BinanceApiDirect;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: config.server.cors
    });

    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
    
    logger.info('Trading Server initialized', { 
      port: config.server.port,
      environment: process.env.NODE_ENV || 'development',
      service: 'TradingServer'
    });
  }

  /**
   * Initialize core trading services
   */
  private initializeServices(): void {
    try {
      this.binanceService = new BinanceApiDirect();
      this.performanceMonitor = new PerformanceMonitor();
      this.alertSystem = new AlertSystem();
      
      this.riskManager = new RiskManager();
      this.tradingEngine = new TradingEngine();

      this.setupServiceEventHandlers();
      
      logger.info('All trading services initialized successfully', { 
        service: 'TradingServer' 
      });
    } catch (error) {
      logger.error('Failed to initialize trading services', { 
        error: error instanceof Error ? error.message : String(error), 
        service: 'TradingServer' 
      });
      throw error;
    }
  }

  /**
   * Setup service event handlers for real-time updates
   */
  private setupServiceEventHandlers(): void {
    // Trading Engine Events
    this.tradingEngine.on('tradeExecuted', (data) => {
      this.io.emit('tradeExecuted', data);
      this.performanceMonitor.trackTrade(data.order, data.strategy);
      this.alertSystem.handleTradingEvent('TRADE_EXECUTED', data);
    });

    this.tradingEngine.on('positionOpened', (data) => {
      this.io.emit('positionOpened', data);
      this.alertSystem.handleTradingEvent('POSITION_OPENED', data);
    });

    this.tradingEngine.on('positionClosed', (data) => {
      this.io.emit('positionClosed', data);
      this.alertSystem.handleTradingEvent('POSITION_CLOSED', data);
    });

    this.tradingEngine.on('emergencyStop', (data) => {
      this.io.emit('emergencyStop', data);
      this.alertSystem.handleTradingEvent('EMERGENCY_STOP', data);
    });

    // Risk Manager Events
    this.riskManager.on('riskAlert', (data) => {
      this.io.emit('riskAlert', data);
      this.alertSystem.handleTradingEvent('RISK_ALERT', data);
    });

    this.riskManager.on('circuitBreakerActivated', (data) => {
      this.io.emit('circuitBreakerActivated', data);
      this.alertSystem.handleTradingEvent('CIRCUIT_BREAKER_ACTIVATED', data);
    });

    // Performance Monitor Events
    this.performanceMonitor.on('performanceUpdate', (data) => {
      this.io.emit('performanceUpdate', data);
    });

    this.performanceMonitor.on('performanceAlert', (data) => {
      this.io.emit('performanceAlert', data);
      this.alertSystem.handleTradingEvent('PERFORMANCE_ALERT', data);
    });

    // Alert System Events
    this.alertSystem.on('alertSent', (data) => {
      this.io.emit('alertSent', data);
    });

    // Binance Service Events
    this.binanceService.on('priceUpdate', (data) => {
      this.io.emit('priceUpdate', data);
    });

    this.binanceService.on('connectionLost', () => {
      this.io.emit('connectionLost');
      this.alertSystem.handleTradingEvent('CONNECTION_LOST', { service: 'Binance' });
    });

    this.binanceService.on('connected', () => {
      this.io.emit('connectionRestored');
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors(config.server.cors));

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim(), { service: 'HTTP' });
        }
      }
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID middleware for tracking
    this.app.use((req: any, res, next) => {
      req.requestId = Math.random().toString(36).substring(2, 15);
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // Request logging middleware
    this.app.use((req: any, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        requestId: req.requestId,
        userAgent: req.get('User-Agent'),
        service: 'HTTP'
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          tradingEngine: this.tradingEngine.isEngineRunning(),
          riskManager: !this.riskManager.isCircuitBreakerActive(),
          performanceMonitor: this.performanceMonitor.isMonitoringActive(),
          alertSystem: this.alertSystem.isAlertSystemActive(),
          binanceConnection: true // BinanceService가 생성되면 연결된 것으로 간주
        }
      };

      res.json(healthStatus);
    });

    // API routes with service injection
    this.app.use('/api/trading', tradingRoutes(this.tradingEngine, this.riskManager));
    this.app.use('/api/portfolio', portfolioRoutes(this.binanceService, this.performanceMonitor));
    this.app.use('/api/strategy', strategyRoutes(this.tradingEngine));
    this.app.use('/api/backtest', backtestRoutes(this.binanceService));
    this.app.use('/api/analytics', analyticsRoutes(this.performanceMonitor, this.riskManager));
    this.app.use('/api/settings', settingsRoutes(this.alertSystem));
    this.app.use('/api/notion', notionRoutes());

    // Catch-all route for undefined endpoints
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup WebSocket connections
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to WebSocket', { 
        socketId: socket.id,
        service: 'WebSocket'
      });

      // Send initial data to new client
      socket.emit('initialData', {
        portfolio: this.tradingEngine.getPortfolio(),
        positions: this.tradingEngine.getActivePositions(),
        tradingStats: this.tradingEngine.getTradingStats(),
        performanceReport: this.performanceMonitor.generatePerformanceReport(),
        riskReport: this.riskManager.generateRiskReport()
      });

      // Handle client requests
      socket.on('startTrading', async () => {
        try {
          await this.tradingEngine.start();
          this.performanceMonitor.startMonitoring();
          this.alertSystem.start();
          socket.emit('tradingStarted', { success: true });
        } catch (error) {
          socket.emit('tradingError', { error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('stopTrading', async () => {
        try {
          await this.tradingEngine.stop();
          this.performanceMonitor.stopMonitoring();
          this.alertSystem.stop();
          socket.emit('tradingStopped', { success: true });
        } catch (error) {
          socket.emit('tradingError', { error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('emergencyStop', async () => {
        try {
          await this.tradingEngine.emergencyStopAll();
          socket.emit('emergencyStopActivated', { success: true });
        } catch (error) {
          socket.emit('tradingError', { error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('subscribeToSymbol', (symbol: string) => {
        try {
          // 실시간 가격 데이터 구독
          this.binanceService.subscribeToTicker(symbol, (tickerData) => {
            socket.emit('tickerUpdate', { symbol, data: tickerData });
          });
          
          // 캔들스틱 데이터 구독 (올바른 메서드명 사용)
          this.binanceService.subscribeToKlines(symbol, '1m', (klineData) => {
            socket.emit('klineUpdate', { symbol, data: klineData });
          });
          
          socket.emit('subscriptionSuccess', { symbol });
        } catch (error) {
          socket.emit('subscriptionError', { symbol, error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from WebSocket', { 
          socketId: socket.id,
          service: 'WebSocket'
        });
      });
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error in request', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        service: 'ErrorHandler'
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        error: error.name || 'Internal Server Error',
        message: isDevelopment ? (error instanceof Error ? error.message : String(error)) : 'An internal server error occurred',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      // Graceful shutdown
      this.shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      // Graceful shutdown
      this.shutdown();
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Start trading services
      this.performanceMonitor.startMonitoring();
      this.alertSystem.start();

      // Start HTTP server
      this.httpServer.listen(config.server.port, config.server.host, () => {
        logger.info('Trading Server started successfully', {
          port: config.server.port,
          host: config.server.host,
          environment: process.env.NODE_ENV || 'development',
          service: 'TradingServer'
        });
      });

      // Try to connect to Binance (non-blocking)
      try {
        await this.binanceService.connect();
        logger.info('Binance connection established', { service: 'TradingServer' });
      } catch (binanceError) {
        logger.warn('Failed to connect to Binance, server will continue without trading capabilities', { 
          error: binanceError instanceof Error ? binanceError.message : String(binanceError),
          service: 'TradingServer' 
        });
      }
      
      logger.info('Trading Server is running', { 
        port: config.server.port,
        binanceConnected: this.binanceService.isConnectedToBinance(),
        service: 'TradingServer' 
      });

    } catch (error) {
      logger.error('Failed to start trading server', { 
        error: error instanceof Error ? error.message : String(error), 
        service: 'TradingServer' 
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Initiating graceful shutdown...', { service: 'TradingServer' });

    try {
      // Stop trading services
      await this.tradingEngine.stop();
      this.performanceMonitor.stopMonitoring();
      this.alertSystem.stop();
      
      // Disconnect from Binance
      this.binanceService.disconnect();

      // Close WebSocket connections
      this.io.close();

      // Close HTTP server
      this.httpServer.close(() => {
        logger.info('Trading Server shut down successfully', { 
          service: 'TradingServer' 
        });
        process.exit(0);
      });

    } catch (error) {
      logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error), service: 'TradingServer' });
      process.exit(1);
    }
  }

  // Getters for testing and external access
  public getApp(): express.Application { return this.app; }
  public getIO(): SocketIOServer { return this.io; }
  public getTradingEngine(): TradingEngine { return this.tradingEngine; }
  public getRiskManager(): RiskManager { return this.riskManager; }
  public getPerformanceMonitor(): PerformanceMonitor { return this.performanceMonitor; }
  public getAlertSystem(): AlertSystem { return this.alertSystem; }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new TradingServer();
  
  // Handle shutdown signals
  process.on('SIGTERM', () => server.shutdown());
  process.on('SIGINT', () => server.shutdown());
  
  // Start server
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}

export default TradingServer;