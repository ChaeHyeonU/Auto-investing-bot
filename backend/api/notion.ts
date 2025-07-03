import { Router, Request, Response, NextFunction } from 'express';
import { NotionService } from '../services/notionService';
import { Trade } from '@/types';
import logger from '../utils/logger';

/**
 * Notion API Routes
 * 
 * Provides RESTful endpoints for:
 * - Trading journal integration
 * - Automated trade documentation
 * - AI-powered trade analysis
 * - Daily summaries and reports
 * - Performance tracking in Notion
 */

export default function createNotionRoutes(): Router {
  const router = Router();
  const notionService = new NotionService();

  /**
   * POST /api/notion/initialize
   * Initialize trading journal database
   */
  router.post('/initialize', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await notionService.initializeTradingJournal();

      res.json({
        success: true,
        message: 'Trading journal initialized successfully',
        timestamp: new Date().toISOString()
      });

      logger.info('Trading journal initialized via API', {
        requestId: (req as any).requestId,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error initializing trading journal', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/notion/journal-entry
   * Create a new trading journal entry
   */
  router.post('/journal-entry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const trade: Trade = req.body;

      // Validate required fields
      if (!trade.id || !trade.symbol || !trade.side || !trade.entryPrice || !trade.quantity) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: id, symbol, side, entryPrice, quantity'
        });
      }

      // Ensure proper date formats
      if (typeof trade.entryTime === 'string') {
        trade.entryTime = new Date(trade.entryTime);
      }
      if (trade.exitTime && typeof trade.exitTime === 'string') {
        trade.exitTime = new Date(trade.exitTime);
      }

      const notionPage = await notionService.createJournalEntry(trade);

      res.status(201).json({
        success: true,
        message: 'Journal entry created successfully',
        data: {
          notionPageId: notionPage.id,
          tradeId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entryPrice,
          pnl: trade.pnl
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Journal entry created via API', {
        requestId: (req as any).requestId,
        tradeId: trade.id,
        notionPageId: notionPage.id,
        symbol: trade.symbol,
        pnl: trade.pnl,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error creating journal entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        tradeData: req.body,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * PUT /api/notion/journal-entry/:pageId
   * Update an existing journal entry
   */
  router.put('/journal-entry/:pageId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pageId } = req.params;
      const trade: Trade = req.body;

      if (!pageId) {
        return res.status(400).json({
          success: false,
          error: 'Page ID is required'
        });
      }

      // Validate required fields for update
      if (!trade.id || !trade.symbol) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: id, symbol'
        });
      }

      // Ensure proper date formats
      if (trade.exitTime && typeof trade.exitTime === 'string') {
        trade.exitTime = new Date(trade.exitTime);
      }

      await notionService.updateJournalEntry(pageId, trade);

      res.json({
        success: true,
        message: 'Journal entry updated successfully',
        data: {
          pageId,
          tradeId: trade.id,
          status: trade.status,
          pnl: trade.pnl
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Journal entry updated via API', {
        requestId: (req as any).requestId,
        pageId,
        tradeId: trade.id,
        newStatus: trade.status,
        pnl: trade.pnl,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error updating journal entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        pageId: req.params.pageId,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/notion/daily-summary
   * Create daily trading summary
   */
  router.post('/daily-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        date,
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnL,
        winRate,
        bestTrade,
        worstTrade,
        strategiesUsed
      } = req.body;

      // Validate required fields
      if (totalTrades === undefined || winningTrades === undefined || losingTrades === undefined || totalPnL === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: totalTrades, winningTrades, losingTrades, totalPnL'
        });
      }

      const summary = {
        date: date ? new Date(date) : new Date(),
        totalTrades: Number(totalTrades),
        winningTrades: Number(winningTrades),
        losingTrades: Number(losingTrades),
        totalPnL: Number(totalPnL),
        winRate: winRate !== undefined ? Number(winRate) : (winningTrades / totalTrades) * 100,
        bestTrade: bestTrade || null,
        worstTrade: worstTrade || null,
        strategiesUsed: strategiesUsed || []
      };

      const notionPage = await notionService.createDailySummary(summary);

      res.status(201).json({
        success: true,
        message: 'Daily summary created successfully',
        data: {
          notionPageId: notionPage.id,
          date: summary.date,
          totalTrades: summary.totalTrades,
          winRate: summary.winRate,
          totalPnL: summary.totalPnL
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Daily summary created via API', {
        requestId: (req as any).requestId,
        date: summary.date.toISOString().split('T')[0],
        totalTrades: summary.totalTrades,
        totalPnL: summary.totalPnL,
        notionPageId: notionPage.id,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error creating daily summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        summaryData: req.body,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/notion/test-connection
   * Test Notion API connection
   */
  router.post('/test-connection', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isConnected = await notionService.testConnection();

      res.json({
        success: true,
        message: isConnected ? 'Notion connection successful' : 'Notion connection failed',
        data: {
          connected: isConnected,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Notion connection test via API', {
        requestId: (req as any).requestId,
        connected: isConnected,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error testing Notion connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/notion/bulk-entries
   * Create multiple journal entries in batch
   */
  router.post('/bulk-entries', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { trades } = req.body;

      if (!Array.isArray(trades) || trades.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'trades array is required and must not be empty'
        });
      }

      if (trades.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 trades allowed per batch request'
        });
      }

      const results = [];
      const errors = [];

      for (const trade of trades) {
        try {
          // Ensure proper date formats
          if (typeof trade.entryTime === 'string') {
            trade.entryTime = new Date(trade.entryTime);
          }
          if (trade.exitTime && typeof trade.exitTime === 'string') {
            trade.exitTime = new Date(trade.exitTime);
          }

          const notionPage = await notionService.createJournalEntry(trade);
          results.push({
            tradeId: trade.id,
            notionPageId: notionPage.id,
            success: true
          });
        } catch (error) {
          errors.push({
            tradeId: trade.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          });
        }
      }

      res.status(results.length > 0 ? 201 : 400).json({
        success: errors.length === 0,
        message: `Processed ${trades.length} trades: ${results.length} successful, ${errors.length} failed`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: trades.length,
            successful: results.length,
            failed: errors.length
          }
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Bulk journal entries processed', {
        requestId: (req as any).requestId,
        totalTrades: trades.length,
        successful: results.length,
        failed: errors.length,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error processing bulk entries', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/notion/manual-entry
   * Create a manual journal entry with custom data
   */
  router.post('/manual-entry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        symbol,
        side,
        entryPrice,
        exitPrice,
        quantity,
        pnl,
        strategy,
        notes,
        entryTime,
        exitTime
      } = req.body;

      // Validate required fields
      if (!symbol || !side || !entryPrice || !quantity) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: symbol, side, entryPrice, quantity'
        });
      }

      // Create trade object
      const trade: Trade = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        symbol,
        side,
        entryPrice: Number(entryPrice),
        exitPrice: exitPrice ? Number(exitPrice) : undefined,
        quantity: Number(quantity),
        pnl: pnl ? Number(pnl) : undefined,
        strategy: strategy || 'Manual Entry',
        status: exitPrice ? 'CLOSED' : 'OPEN',
        entryTime: entryTime ? new Date(entryTime) : new Date(),
        exitTime: exitTime ? new Date(exitTime) : undefined,
        notes
      };

      const notionPage = await notionService.createJournalEntry(trade);

      res.status(201).json({
        success: true,
        message: 'Manual journal entry created successfully',
        data: {
          tradeId: trade.id,
          notionPageId: notionPage.id,
          symbol: trade.symbol,
          side: trade.side,
          pnl: trade.pnl
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Manual journal entry created', {
        requestId: (req as any).requestId,
        tradeId: trade.id,
        notionPageId: notionPage.id,
        symbol: trade.symbol,
        strategy: trade.strategy,
        service: 'NotionAPI'
      });

    } catch (error) {
      logger.error('Error creating manual entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        service: 'NotionAPI'
      });
      next(error);
    }
  });

  return router;
}