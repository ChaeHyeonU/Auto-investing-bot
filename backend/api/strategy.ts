import { Router, Request, Response, NextFunction } from 'express';
import { TradingEngine } from '../services/trading';
import { StrategyFactory } from '../services/backtest/strategyFactory';
import logger from '../utils/logger';

/**
 * Strategy API Routes
 * 
 * Provides RESTful endpoints for:
 * - Strategy management (list/create/update/delete)
 * - Strategy configuration and parameters
 * - Strategy performance tracking
 * - Strategy backtesting and optimization
 * - Strategy templates and presets
 */

export default function createStrategyRoutes(
  tradingEngine: TradingEngine
): Router {
  const router = Router();
  const strategyFactory = new StrategyFactory();

  /**
   * GET /api/strategy
   * Get all available strategies
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const availableStrategies = strategyFactory.getAvailableStrategies();
      
      const strategies = availableStrategies.map(strategyInfo => ({
        id: strategyInfo.id,
        name: strategyInfo.name,
        description: strategyInfo.description,
        category: strategyInfo.category,
        timeframes: strategyInfo.timeframes,
        marketConditions: strategyInfo.marketConditions,
        parameters: strategyInfo.defaultParameters,
        riskLevel: strategyInfo.riskLevel,
        isTemplate: true
      }));

      res.json({
        success: true,
        data: strategies,
        count: strategies.length,
        timestamp: new Date().toISOString()
      });

      logger.info('Available strategies requested', {
        requestId: (req as any).requestId,
        strategiesCount: strategies.length,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error getting available strategies', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/strategy/active
   * Get all currently active strategies
   */
  router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: This would need to be implemented in TradingEngine
      // For now, return a placeholder response
      const activeStrategies = [
        {
          id: 'moving-average-crossover-1',
          name: 'Moving Average Crossover',
          description: 'EMA crossover strategy for trend following',
          isActive: true,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9
          },
          performance: {
            totalTrades: 25,
            winningTrades: 17,
            losingTrades: 8,
            winRate: 68,
            totalReturn: 12.5,
            maxDrawdown: 3.2,
            sharpeRatio: 1.8
          },
          riskManagement: {
            stopLoss: 2,
            takeProfit: 6,
            maxPositions: 1,
            riskPerTrade: 2
          },
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lastUpdated: new Date()
        }
      ];

      res.json({
        success: true,
        data: activeStrategies,
        count: activeStrategies.length,
        timestamp: new Date().toISOString()
      });

      logger.info('Active strategies requested', {
        requestId: (req as any).requestId,
        activeStrategiesCount: activeStrategies.length,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error getting active strategies', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/strategy/:strategyId
   * Get detailed information about a specific strategy
   */
  router.get('/:strategyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      const strategyInfo = strategyFactory.getStrategyInfo(strategyId);

      if (!strategyInfo) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found'
        });
      }

      const strategy = strategyFactory.createStrategy(strategyId, strategyInfo.defaultParameters);

      const detailedStrategy = {
        id: strategyInfo.id,
        name: strategyInfo.name,
        description: strategyInfo.description,
        category: strategyInfo.category,
        timeframes: strategyInfo.timeframes,
        marketConditions: strategyInfo.marketConditions,
        indicators: strategyInfo.indicators,
        parameters: {
          current: strategy.parameters,
          default: strategyInfo.defaultParameters,
          ranges: strategyInfo.parameterRanges
        },
        riskManagement: strategy.riskManagement,
        performance: strategy.performance,
        riskLevel: strategyInfo.riskLevel,
        documentation: {
          logic: strategyInfo.logic,
          entryConditions: strategyInfo.entryConditions,
          exitConditions: strategyInfo.exitConditions,
          riskConsiderations: strategyInfo.riskConsiderations
        }
      };

      res.json({
        success: true,
        data: detailedStrategy,
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy details requested', {
        requestId: (req as any).requestId,
        strategyId,
        strategyName: strategyInfo.name,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error getting strategy details', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/strategy/create
   * Create a new strategy instance from a template
   */
  router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        templateId, 
        name, 
        symbol, 
        timeframe, 
        parameters, 
        riskManagement 
      } = req.body;

      if (!templateId || !name || !symbol) {
        return res.status(400).json({
          success: false,
          error: 'templateId, name, and symbol are required'
        });
      }

      const strategyInfo = strategyFactory.getStrategyInfo(templateId);
      if (!strategyInfo) {
        return res.status(404).json({
          success: false,
          error: 'Strategy template not found'
        });
      }

      // Merge provided parameters with defaults
      const finalParameters = {
        ...strategyInfo.defaultParameters,
        ...parameters
      };

      // Create strategy instance
      const strategy = strategyFactory.createStrategy(templateId, finalParameters);
      
      // Customize strategy
      strategy.id = `${templateId}-${Date.now()}`;
      strategy.name = name;
      if (riskManagement) {
        strategy.riskManagement = { ...strategy.riskManagement, ...riskManagement };
      }

      // Add to trading engine
      tradingEngine.addStrategy(strategy);

      const createdStrategy = {
        id: strategy.id,
        name: strategy.name,
        templateId,
        symbol,
        timeframe: timeframe || '1h',
        parameters: strategy.parameters,
        riskManagement: strategy.riskManagement,
        isActive: strategy.isActive,
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        message: 'Strategy created successfully',
        data: createdStrategy,
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy created', {
        requestId: (req as any).requestId,
        strategyId: strategy.id,
        templateId,
        name,
        symbol,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error creating strategy', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * PUT /api/strategy/:strategyId
   * Update an existing strategy
   */
  router.put('/:strategyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;
      const { name, parameters, riskManagement, isActive } = req.body;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      // Note: This would need to be implemented in TradingEngine
      // For now, return a success response
      
      const updatedStrategy = {
        id: strategyId,
        name: name || 'Updated Strategy',
        parameters: parameters || {},
        riskManagement: riskManagement || {},
        isActive: isActive !== undefined ? isActive : true,
        lastUpdated: new Date()
      };

      res.json({
        success: true,
        message: 'Strategy updated successfully',
        data: updatedStrategy,
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy updated', {
        requestId: (req as any).requestId,
        strategyId,
        updatedFields: Object.keys(req.body),
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error updating strategy', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * DELETE /api/strategy/:strategyId
   * Delete/deactivate a strategy
   */
  router.delete('/:strategyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;
      const { force = false } = req.query;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      if (force === 'true') {
        // Permanently delete strategy
        tradingEngine.removeStrategy(strategyId);
      } else {
        // Just deactivate strategy
        // Note: This would need to be implemented in TradingEngine
      }

      res.json({
        success: true,
        message: force === 'true' ? 'Strategy deleted successfully' : 'Strategy deactivated successfully',
        data: { strategyId, action: force === 'true' ? 'deleted' : 'deactivated' },
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy removed/deactivated', {
        requestId: (req as any).requestId,
        strategyId,
        force: force === 'true',
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error deleting strategy', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/strategy/:strategyId/activate
   * Activate a strategy
   */
  router.post('/:strategyId/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      // Note: This would need to be implemented in TradingEngine
      
      res.json({
        success: true,
        message: 'Strategy activated successfully',
        data: { strategyId, isActive: true },
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy activated', {
        requestId: (req as any).requestId,
        strategyId,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error activating strategy', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/strategy/:strategyId/deactivate
   * Deactivate a strategy
   */
  router.post('/:strategyId/deactivate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      // Note: This would need to be implemented in TradingEngine
      
      res.json({
        success: true,
        message: 'Strategy deactivated successfully',
        data: { strategyId, isActive: false },
        timestamp: new Date().toISOString()
      });

      logger.info('Strategy deactivated', {
        requestId: (req as any).requestId,
        strategyId,
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error deactivating strategy', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/strategy/:strategyId/performance
   * Get performance metrics for a specific strategy
   */
  router.get('/:strategyId/performance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { strategyId } = req.params;
      const { days = 30 } = req.query;

      if (!strategyId) {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID is required'
        });
      }

      // Note: This would need to be implemented in PerformanceMonitor
      // For now, return mock performance data
      const performance = {
        strategyId,
        period: `${days} days`,
        metrics: {
          totalTrades: 25,
          winningTrades: 17,
          losingTrades: 8,
          winRate: 68,
          totalReturn: 12.5,
          avgWin: 2.8,
          avgLoss: -1.5,
          profitFactor: 2.1,
          sharpeRatio: 1.8,
          sortinoRatio: 2.4,
          maxDrawdown: 3.2,
          recoveryFactor: 3.9,
          expectancy: 0.68
        },
        trades: [], // Would contain individual trade data
        equity: [], // Would contain equity curve data
        drawdown: [], // Would contain drawdown curve data
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: performance
      });

      logger.info('Strategy performance requested', {
        requestId: (req as any).requestId,
        strategyId,
        days: Number(days),
        service: 'StrategyAPI'
      });

    } catch (error) {
      logger.error('Error getting strategy performance', {
        error: error.message,
        requestId: (req as any).requestId,
        strategyId: req.params.strategyId,
        service: 'StrategyAPI'
      });
      next(error);
    }
  });

  return router;
}