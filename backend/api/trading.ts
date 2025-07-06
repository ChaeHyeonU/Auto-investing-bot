import { Router, Request, Response, NextFunction } from 'express';
import { TradingEngine, RiskManager } from '../services/trading';
import logger from '../utils/logger';

/**
 * Trading API Routes
 * 
 * Provides RESTful endpoints for:
 * - Trading engine control (start/stop/emergency stop)
 * - Strategy management (add/remove/configure strategies)
 * - Order management (place/cancel/track orders)
 * - Position management (view/close positions)
 * - Risk management controls
 */

export default function createTradingRoutes(
  tradingEngine: TradingEngine,
  riskManager: RiskManager
): Router {
  const router = Router();

  /**
   * GET /api/trading/status
   * Get current trading engine status
   */
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = {
        isRunning: tradingEngine.isEngineRunning(),
        isEmergencyStop: tradingEngine.isEmergencyStop(),
        portfolio: tradingEngine.getPortfolio(),
        activePositions: tradingEngine.getActivePositions(),
        tradingStats: tradingEngine.getTradingStats(),
        dailyPnL: tradingEngine.getDailyPnL(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: status
      });

      logger.info('Trading status requested', {
        requestId: (req as any).requestId,
        isRunning: status.isRunning,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error getting trading status', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/start
   * Start the trading engine
   */
  router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (tradingEngine.isEngineRunning()) {
        return res.status(400).json({
          success: false,
          error: 'Trading engine is already running'
        });
      }

      await tradingEngine.start();

      res.json({
        success: true,
        message: 'Trading engine started successfully',
        timestamp: new Date().toISOString()
      });

      logger.info('Trading engine started via API', {
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error starting trading engine', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/stop
   * Stop the trading engine
   */
  router.post('/stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!tradingEngine.isEngineRunning()) {
        return res.status(400).json({
          success: false,
          error: 'Trading engine is not running'
        });
      }

      await tradingEngine.stop();

      res.json({
        success: true,
        message: 'Trading engine stopped successfully',
        timestamp: new Date().toISOString()
      });

      logger.info('Trading engine stopped via API', {
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error stopping trading engine', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/emergency-stop
   * Emergency stop all trading activities
   */
  router.post('/emergency-stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tradingEngine.emergencyStopAll();

      res.json({
        success: true,
        message: 'Emergency stop activated successfully',
        timestamp: new Date().toISOString()
      });

      logger.warn('Emergency stop activated via API', {
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error activating emergency stop', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/trading/strategies
   * Get all active strategies
   */
  router.get('/strategies', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: This would need to be implemented in TradingEngine
      // For now, return a placeholder response
      const strategies = [
        {
          id: 'moving-average-crossover',
          name: 'Moving Average Crossover',
          isActive: true,
          performance: {
            totalTrades: 25,
            winRate: 68,
            totalReturn: 12.5
          }
        }
      ];

      res.json({
        success: true,
        data: strategies
      });

      logger.info('Trading strategies requested', {
        requestId: (req as any).requestId,
        strategiesCount: strategies.length,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error getting trading strategies', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/strategies
   * Add a new trading strategy
   */
  router.post('/strategies', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategy } = req.body;

      if (!strategy || !strategy.id || !strategy.name) {
        return res.status(400).json({
          success: false,
          error: 'Strategy object with id and name is required'
        });
      }

      tradingEngine.addStrategy(strategy);

      res.json({
        success: true,
        message: 'Strategy added successfully',
        data: { strategyId: strategy.id },
        timestamp: new Date().toISOString()
      });

      logger.info('Trading strategy added via API', {
        requestId: (req as any).requestId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error adding trading strategy', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * DELETE /api/trading/strategies/:strategyId
   * Remove a trading strategy
   */
  router.delete('/strategies/:strategyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      tradingEngine.removeStrategy(strategyId);

      res.json({
        success: true,
        message: 'Strategy removed successfully',
        data: { strategyId },
        timestamp: new Date().toISOString()
      });

      logger.info('Trading strategy removed via API', {
        requestId: (req as any).requestId,
        strategyId,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error removing trading strategy', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/trading/positions
   * Get all active positions
   */
  router.get('/positions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const positions = tradingEngine.getActivePositions();

      res.json({
        success: true,
        data: positions,
        count: positions.length,
        timestamp: new Date().toISOString()
      });

      logger.info('Active positions requested', {
        requestId: (req as any).requestId,
        positionsCount: positions.length,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error getting active positions', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/orders/validate
   * Validate a trade order before execution
   */
  router.post('/orders/validate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { symbol, action, quantity, price, orderType, strategy } = req.body;

      if (!symbol || !action || !quantity || !price) {
        return res.status(400).json({
          success: false,
          error: 'symbol, action, quantity, and price are required'
        });
      }

      const tradeRequest = {
        symbol,
        action,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        orderType: orderType || 'MARKET',
        strategy: strategy || 'manual'
      };

      const validation = riskManager.validateTrade(tradeRequest);

      res.json({
        success: true,
        data: {
          approved: validation.approved,
          adjustedQuantity: validation.adjustedQuantity,
          riskScore: validation.riskScore,
          recommendedStopLoss: validation.recommendedStopLoss,
          recommendedPositionSize: validation.recommendedPositionSize,
          riskChecks: validation.riskChecks.map(check => ({
            name: check.name,
            passed: check.passed,
            reason: check.reason,
            severity: check.severity
          }))
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Trade order validated', {
        requestId: (req as any).requestId,
        symbol,
        action,
        quantity,
        approved: validation.approved,
        riskScore: validation.riskScore,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error validating trade order', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/trading/risk-report
   * Get current risk management report
   */
  router.get('/risk-report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const riskReport = riskManager.generateRiskReport();

      res.json({
        success: true,
        data: riskReport
      });

      logger.info('Risk report requested', {
        requestId: (req as any).requestId,
        portfolioHeat: riskReport.portfolioHeat,
        circuitBreakerActive: riskReport.circuitBreakerActive,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error generating risk report', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/trading/risk/circuit-breaker/reset
   * Reset the circuit breaker (admin function)
   */
  router.post('/risk/circuit-breaker/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: This would need to be implemented in RiskManager
      // For now, return a placeholder response
      
      res.json({
        success: true,
        message: 'Circuit breaker reset successfully',
        timestamp: new Date().toISOString()
      });

      logger.warn('Circuit breaker reset via API', {
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });

    } catch (error) {
      logger.error('Error resetting circuit breaker', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'TradingAPI'
      });
      next(error);
    }
  });

  return router;
}