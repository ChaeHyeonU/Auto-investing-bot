import { Router, Request, Response, NextFunction } from 'express';
import { AlertSystem } from '../services/trading';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Settings API Routes
 * 
 * Provides RESTful endpoints for:
 * - Application configuration management
 * - Alert system settings
 * - Trading parameters and limits
 * - User preferences and customization
 * - System maintenance and controls
 */

export default function createSettingsRoutes(
  alertSystem: AlertSystem
): Router {
  const router = Router();

  /**
   * GET /api/settings
   * Get all application settings
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = {
        trading: {
          mode: config.trading.mode,
          maxTradeAmount: config.trading.maxTradeAmount,
          riskPercentage: config.trading.riskPercentage,
          symbols: config.trading.symbols,
          timeframes: config.trading.timeframes,
          defaultTimeframe: config.trading.defaultTimeframe
        },
        alerts: {
          channels: alertSystem.getAlertChannels().map(channel => ({
            id: channel.id,
            type: channel.type,
            enabled: channel.enabled,
            minSeverity: channel.minSeverity
          })),
          rules: alertSystem.getAlertRules().map(rule => ({
            id: rule.id,
            eventType: rule.eventType,
            severity: rule.severity,
            enabled: rule.enabled,
            title: rule.title
          })),
          statistics: alertSystem.getAlertStatistics()
        },
        binance: {
          testnet: config.binance.testnet,
          recvWindow: config.binance.recvWindow,
          // Don't expose API keys for security
          hasApiKey: !!config.binance.apiKey,
          hasApiSecret: !!config.binance.apiSecret
        },
        openai: {
          model: config.openai.model,
          maxTokens: config.openai.maxTokens,
          temperature: config.openai.temperature,
          hasApiKey: !!config.openai.apiKey
        },
        server: {
          port: config.server.port,
          host: config.server.host,
          cors: config.server.cors
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: settings
      });

      logger.info('Settings requested', {
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error getting settings', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * PUT /api/settings/trading
   * Update trading settings
   */
  router.put('/trading', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        mode,
        maxTradeAmount,
        riskPercentage,
        symbols,
        defaultTimeframe
      } = req.body;

      // Validate trading mode
      if (mode && !['PAPER', 'LIVE'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid trading mode. Must be PAPER or LIVE'
        });
      }

      // Validate risk percentage
      if (riskPercentage && (riskPercentage < 0.1 || riskPercentage > 10)) {
        return res.status(400).json({
          success: false,
          error: 'Risk percentage must be between 0.1% and 10%'
        });
      }

      // Validate symbols array
      if (symbols && (!Array.isArray(symbols) || symbols.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Symbols must be a non-empty array'
        });
      }

      // Update config (in production, this would persist to database/file)
      const updatedSettings = {
        mode: mode || config.trading.mode,
        maxTradeAmount: maxTradeAmount || config.trading.maxTradeAmount,
        riskPercentage: riskPercentage || config.trading.riskPercentage,
        symbols: symbols || config.trading.symbols,
        defaultTimeframe: defaultTimeframe || config.trading.defaultTimeframe
      };

      // Apply updates to runtime config
      Object.assign(config.trading, updatedSettings);

      res.json({
        success: true,
        message: 'Trading settings updated successfully',
        data: updatedSettings,
        timestamp: new Date().toISOString()
      });

      logger.info('Trading settings updated', {
        requestId: (req as any).requestId,
        updatedFields: Object.keys(req.body),
        newMode: updatedSettings.mode,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error updating trading settings', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/settings/alerts
   * Get alert system configuration
   */
  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertSettings = {
        channels: alertSystem.getAlertChannels(),
        rules: alertSystem.getAlertRules(),
        statistics: alertSystem.getAlertStatistics(),
        isActive: alertSystem.isAlertSystemActive()
      };

      res.json({
        success: true,
        data: alertSettings,
        timestamp: new Date().toISOString()
      });

      logger.info('Alert settings requested', {
        requestId: (req as any).requestId,
        channelsCount: alertSettings.channels.length,
        rulesCount: alertSettings.rules.length,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error getting alert settings', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/settings/alerts/channel
   * Add a new alert channel
   */
  router.post('/alerts/channel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, type, enabled, minSeverity, config: channelConfig } = req.body;

      if (!id || !type) {
        return res.status(400).json({
          success: false,
          error: 'Channel id and type are required'
        });
      }

      if (!['CONSOLE', 'EMAIL', 'WEBHOOK', 'SMS'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid channel type. Must be CONSOLE, EMAIL, WEBHOOK, or SMS'
        });
      }

      const newChannel = {
        id,
        type,
        enabled: enabled !== false,
        minSeverity: minSeverity || 'LOW',
        config: channelConfig || {}
      };

      alertSystem.addAlertChannel(newChannel);

      res.status(201).json({
        success: true,
        message: 'Alert channel added successfully',
        data: newChannel,
        timestamp: new Date().toISOString()
      });

      logger.info('Alert channel added', {
        requestId: (req as any).requestId,
        channelId: id,
        channelType: type,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error adding alert channel', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * DELETE /api/settings/alerts/channel/:channelId
   * Remove an alert channel
   */
  router.delete('/alerts/channel/:channelId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params;

      if (!channelId) {
        return res.status(400).json({
          success: false,
          error: 'Channel ID is required'
        });
      }

      alertSystem.removeAlertChannel(channelId);

      res.json({
        success: true,
        message: 'Alert channel removed successfully',
        data: { channelId },
        timestamp: new Date().toISOString()
      });

      logger.info('Alert channel removed', {
        requestId: (req as any).requestId,
        channelId,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error removing alert channel', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        channelId: req.params.channelId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/settings/alerts/rule
   * Add or update an alert rule
   */
  router.post('/alerts/rule', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, eventType, severity, enabled, title, messageTemplate, condition } = req.body;

      if (!id || !eventType || !severity || !title) {
        return res.status(400).json({
          success: false,
          error: 'Rule id, eventType, severity, and title are required'
        });
      }

      if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid severity. Must be LOW, MEDIUM, HIGH, or CRITICAL'
        });
      }

      const newRule = {
        id,
        eventType,
        severity,
        enabled: enabled !== false,
        title,
        messageTemplate: messageTemplate || `${eventType}: {{message}}`,
        condition: condition || (() => true)
      };

      alertSystem.addAlertRule(newRule);

      res.status(201).json({
        success: true,
        message: 'Alert rule added successfully',
        data: {
          id: newRule.id,
          eventType: newRule.eventType,
          severity: newRule.severity,
          enabled: newRule.enabled,
          title: newRule.title,
          messageTemplate: newRule.messageTemplate
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Alert rule added', {
        requestId: (req as any).requestId,
        ruleId: id,
        eventType,
        severity,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error adding alert rule', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * DELETE /api/settings/alerts/rule/:ruleId
   * Remove an alert rule
   */
  router.delete('/alerts/rule/:ruleId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ruleId } = req.params;

      if (!ruleId) {
        return res.status(400).json({
          success: false,
          error: 'Rule ID is required'
        });
      }

      alertSystem.removeAlertRule(ruleId);

      res.json({
        success: true,
        message: 'Alert rule removed successfully',
        data: { ruleId },
        timestamp: new Date().toISOString()
      });

      logger.info('Alert rule removed', {
        requestId: (req as any).requestId,
        ruleId,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error removing alert rule', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        ruleId: req.params.ruleId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/settings/alerts/suppress/:alertType
   * Temporarily suppress an alert type
   */
  router.post('/alerts/suppress/:alertType', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alertType } = req.params;
      const { durationMinutes = 60 } = req.body;

      if (!alertType) {
        return res.status(400).json({
          success: false,
          error: 'Alert type is required'
        });
      }

      alertSystem.suppressAlertType(alertType, durationMinutes);

      res.json({
        success: true,
        message: `Alert type ${alertType} suppressed for ${durationMinutes} minutes`,
        data: { alertType, durationMinutes },
        timestamp: new Date().toISOString()
      });

      logger.info('Alert type suppressed', {
        requestId: (req as any).requestId,
        alertType,
        durationMinutes,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error suppressing alert type', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        alertType: req.params.alertType,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/settings/alerts/test
   * Test alert system
   */
  router.post('/alerts/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await alertSystem.testAlerts();

      res.json({
        success: true,
        message: 'Test alert sent successfully',
        timestamp: new Date().toISOString()
      });

      logger.info('Alert system tested', {
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error testing alert system', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/settings/system-info
   * Get system information and health
   */
  router.get('/system-info', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const systemInfo = {
        application: {
          name: 'Auto Trading System',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: process.uptime(),
          startTime: new Date(Date.now() - process.uptime() * 1000)
        },
        system: {
          platform: process.platform,
          nodeVersion: process.version,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
          },
          cpu: {
            usage: process.cpuUsage()
          }
        },
        configuration: {
          tradingMode: config.trading.mode,
          defaultSymbols: config.trading.symbols,
          alertChannels: alertSystem.getAlertChannels().length,
          alertRules: alertSystem.getAlertRules().length
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: systemInfo
      });

      logger.info('System info requested', {
        requestId: (req as any).requestId,
        uptime: systemInfo.application.uptime,
        memoryUsed: systemInfo.system.memory.used,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error getting system info', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/settings/export
   * Export settings configuration
   */
  router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { includeSecrets = false } = req.body;

      const exportData = {
        trading: config.trading,
        alerts: {
          channels: alertSystem.getAlertChannels(),
          rules: alertSystem.getAlertRules()
        },
        openai: {
          model: config.openai.model,
          maxTokens: config.openai.maxTokens,
          temperature: config.openai.temperature,
          ...(includeSecrets && { apiKey: config.openai.apiKey })
        },
        ...(includeSecrets && {
          binance: {
            ...config.binance,
            apiKey: config.binance.apiKey,
            apiSecret: config.binance.apiSecret
          }
        }),
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json({
        success: true,
        data: exportData,
        warning: includeSecrets ? 'This export contains sensitive information' : undefined
      });

      logger.info('Settings exported', {
        requestId: (req as any).requestId,
        includeSecrets,
        service: 'SettingsAPI'
      });

    } catch (error) {
      logger.error('Error exporting settings', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'SettingsAPI'
      });
      next(error);
    }
  });

  return router;
}