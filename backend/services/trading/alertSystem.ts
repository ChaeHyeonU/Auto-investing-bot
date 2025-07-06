import { EventEmitter } from 'events';
import { Portfolio, Position, Order, TradingStrategy } from '../../../src/types';
import logger from '../../utils/logger';
import config from '../../config/config';

/**
 * Alert System for Trading Events
 * 
 * Why Comprehensive Alerting?
 * - Real-time notification of critical trading events
 * - Early warning system for risk management
 * - Performance monitoring and anomaly detection
 * - System health and operational alerts
 * - Customizable alert channels (email, webhook, console)
 * - Alert prioritization and escalation
 */
export class AlertSystem extends EventEmitter {
  private alertChannels: Map<string, AlertChannel> = new Map();
  private alertHistory: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private suppressedAlerts: Set<string> = new Set();
  private alertCounters: Map<string, number> = new Map();
  private isActive: boolean = false;

  constructor() {
    super();
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    
    logger.info('Alert System initialized', { 
      service: 'AlertSystem' 
    });
  }

  /**
   * Start alert system
   */
  public start(): void {
    if (this.isActive) {
      logger.warn('Alert system already active', { service: 'AlertSystem' });
      return;
    }

    this.isActive = true;
    this.setupEventListeners();
    
    logger.info('Alert system started', { 
      alertChannels: Array.from(this.alertChannels.keys()),
      alertRules: Array.from(this.alertRules.keys()),
      service: 'AlertSystem' 
    });
  }

  /**
   * Stop alert system
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.removeAllListeners();
    
    logger.info('Alert system stopped', { service: 'AlertSystem' });
  }

  /**
   * Add alert channel
   */
  public addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.id, channel);
    
    logger.info('Alert channel added', {
      channelId: channel.id,
      type: channel.type,
      service: 'AlertSystem'
    });
  }

  /**
   * Remove alert channel
   */
  public removeAlertChannel(channelId: string): void {
    this.alertChannels.delete(channelId);
    
    logger.info('Alert channel removed', {
      channelId,
      service: 'AlertSystem'
    });
  }

  /**
   * Add alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    
    logger.info('Alert rule added', {
      ruleId: rule.id,
      eventType: rule.eventType,
      service: 'AlertSystem'
    });
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    
    logger.info('Alert rule removed', {
      ruleId,
      service: 'AlertSystem'
    });
  }

  /**
   * Send alert
   */
  public async sendAlert(alert: Alert): Promise<void> {
    if (!this.isActive) return;

    try {
      // Check if alert should be suppressed
      if (this.shouldSuppressAlert(alert)) {
        logger.debug('Alert suppressed', {
          alertType: alert.type,
          reason: 'Rate limiting or suppression rule',
          service: 'AlertSystem'
        });
        return;
      }

      // Add to history
      this.addToHistory(alert);

      // Send to all applicable channels
      const channels = this.getApplicableChannels(alert);
      const sendPromises = channels.map(channel => this.sendToChannel(alert, channel));
      
      await Promise.allSettled(sendPromises);

      // Update counters
      this.updateAlertCounters(alert);

      // Emit alert event
      this.emit('alertSent', alert);

      logger.info('Alert sent', {
        alertType: alert.type,
        severity: alert.severity,
        channels: channels.length,
        service: 'AlertSystem'
      });

    } catch (error) {
      logger.error('Failed to send alert', {
        error,
        alertType: alert.type,
        service: 'AlertSystem'
      });
    }
  }

  /**
   * Handle trading events
   */
  public handleTradingEvent(eventType: string, eventData: any): void {
    if (!this.isActive) return;

    try {
      const matchingRules = this.getMatchingRules(eventType, eventData);
      
      for (const rule of matchingRules) {
        if (this.evaluateRule(rule, eventData)) {
          const alert = this.createAlert(rule, eventData);
          this.sendAlert(alert);
        }
      }

    } catch (error) {
      logger.error('Error handling trading event', {
        error,
        eventType,
        service: 'AlertSystem'
      });
    }
  }

  /**
   * Get alert history
   */
  public getAlertHistory(hours: number = 24): Alert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alertHistory.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get alert statistics
   */
  public getAlertStatistics(): AlertStatistics {
    const last24Hours = this.getAlertHistory(24);
    const last7Days = this.getAlertHistory(24 * 7);

    return {
      total24h: last24Hours.length,
      total7d: last7Days.length,
      byType: this.getAlertCountsByType(last24Hours),
      bySeverity: this.getAlertCountsBySeverity(last24Hours),
      topAlerts: this.getTopAlerts(last24Hours),
      channels: Array.from(this.alertChannels.keys()),
      rules: Array.from(this.alertRules.keys())
    };
  }

  /**
   * Suppress alert type temporarily
   */
  public suppressAlertType(alertType: string, durationMinutes: number = 60): void {
    this.suppressedAlerts.add(alertType);
    
    setTimeout(() => {
      this.suppressedAlerts.delete(alertType);
    }, durationMinutes * 60 * 1000);

    logger.info('Alert type suppressed', {
      alertType,
      durationMinutes,
      service: 'AlertSystem'
    });
  }

  /**
   * Test alert system
   */
  public async testAlerts(): Promise<void> {
    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      type: 'SYSTEM_TEST',
      severity: 'LOW',
      title: 'Alert System Test',
      message: 'This is a test alert to verify the alert system is working properly.',
      timestamp: new Date(),
      source: 'AlertSystem',
      data: { test: true }
    };

    await this.sendAlert(testAlert);
    
    logger.info('Test alert sent', { service: 'AlertSystem' });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'trade-executed',
        eventType: 'TRADE_EXECUTED',
        severity: 'LOW',
        enabled: true,
        condition: () => true,
        title: 'Trade Executed',
        messageTemplate: 'Trade executed: {{action}} {{quantity}} {{symbol}} at {{price}}'
      },
      {
        id: 'high-profit-trade',
        eventType: 'TRADE_EXECUTED',
        severity: 'MEDIUM',
        enabled: true,
        condition: (data) => data.pnl > 1000,
        title: 'High Profit Trade',
        messageTemplate: 'High profit trade: {{pnl}} on {{symbol}}'
      },
      {
        id: 'high-loss-trade',
        eventType: 'TRADE_EXECUTED',
        severity: 'HIGH',
        enabled: true,
        condition: (data) => data.pnl < -1000,
        title: 'High Loss Trade',
        messageTemplate: 'High loss trade: {{pnl}} on {{symbol}}'
      },
      {
        id: 'position-opened',
        eventType: 'POSITION_OPENED',
        severity: 'LOW',
        enabled: true,
        condition: () => true,
        title: 'Position Opened',
        messageTemplate: 'New position opened: {{side}} {{quantity}} {{symbol}}'
      },
      {
        id: 'position-closed',
        eventType: 'POSITION_CLOSED',
        severity: 'LOW',
        enabled: true,
        condition: () => true,
        title: 'Position Closed',
        messageTemplate: 'Position closed: {{symbol}} P&L: {{pnl}}'
      },
      {
        id: 'stop-loss-triggered',
        eventType: 'STOP_LOSS_TRIGGERED',
        severity: 'MEDIUM',
        enabled: true,
        condition: () => true,
        title: 'Stop Loss Triggered',
        messageTemplate: 'Stop loss triggered for {{symbol}}: {{reason}}'
      },
      {
        id: 'take-profit-triggered',
        eventType: 'TAKE_PROFIT_TRIGGERED',
        severity: 'MEDIUM',
        enabled: true,
        condition: () => true,
        title: 'Take Profit Triggered',
        messageTemplate: 'Take profit triggered for {{symbol}}: {{pnl}}'
      },
      {
        id: 'risk-alert',
        eventType: 'RISK_ALERT',
        severity: 'HIGH',
        enabled: true,
        condition: () => true,
        title: 'Risk Alert',
        messageTemplate: 'Risk alert: {{message}}'
      },
      {
        id: 'circuit-breaker',
        eventType: 'CIRCUIT_BREAKER_ACTIVATED',
        severity: 'CRITICAL',
        enabled: true,
        condition: () => true,
        title: 'Circuit Breaker Activated',
        messageTemplate: 'Circuit breaker activated: {{reason}}'
      },
      {
        id: 'emergency-stop',
        eventType: 'EMERGENCY_STOP',
        severity: 'CRITICAL',
        enabled: true,
        condition: () => true,
        title: 'Emergency Stop',
        messageTemplate: 'Emergency stop activated: {{reason}}'
      },
      {
        id: 'connection-lost',
        eventType: 'CONNECTION_LOST',
        severity: 'HIGH',
        enabled: true,
        condition: () => true,
        title: 'Connection Lost',
        messageTemplate: 'Lost connection to {{service}}'
      },
      {
        id: 'system-error',
        eventType: 'SYSTEM_ERROR',
        severity: 'HIGH',
        enabled: true,
        condition: () => true,
        title: 'System Error',
        messageTemplate: 'System error: {{error}}'
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Initialize default alert channels
   */
  private initializeDefaultChannels(): void {
    // Console channel (always enabled)
    this.alertChannels.set('console', {
      id: 'console',
      type: 'CONSOLE',
      enabled: true,
      minSeverity: 'LOW',
      config: {}
    });

    // Email channel (if configured)
    if (config.alerts && config.alerts.email) {
      this.alertChannels.set('email', {
        id: 'email',
        type: 'EMAIL',
        enabled: true,
        minSeverity: 'MEDIUM',
        config: config.alerts.email
      });
    }

    // Webhook channel (if configured)
    if (config.alerts && config.alerts.webhook) {
      this.alertChannels.set('webhook', {
        id: 'webhook',
        type: 'WEBHOOK',
        enabled: true,
        minSeverity: 'LOW',
        config: config.alerts.webhook
      });
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for trading events
    this.on('tradeExecuted', (data) => this.handleTradingEvent('TRADE_EXECUTED', data));
    this.on('positionOpened', (data) => this.handleTradingEvent('POSITION_OPENED', data));
    this.on('positionClosed', (data) => this.handleTradingEvent('POSITION_CLOSED', data));
    this.on('stopLossTriggered', (data) => this.handleTradingEvent('STOP_LOSS_TRIGGERED', data));
    this.on('takeProfitTriggered', (data) => this.handleTradingEvent('TAKE_PROFIT_TRIGGERED', data));
    this.on('riskAlert', (data) => this.handleTradingEvent('RISK_ALERT', data));
    this.on('circuitBreakerActivated', (data) => this.handleTradingEvent('CIRCUIT_BREAKER_ACTIVATED', data));
    this.on('emergencyStop', (data) => this.handleTradingEvent('EMERGENCY_STOP', data));
    this.on('connectionLost', (data) => this.handleTradingEvent('CONNECTION_LOST', data));
    this.on('systemError', (data) => this.handleTradingEvent('SYSTEM_ERROR', data));
  }

  /**
   * Check if alert should be suppressed
   */
  private shouldSuppressAlert(alert: Alert): boolean {
    // Check if alert type is suppressed
    if (this.suppressedAlerts.has(alert.type)) {
      return true;
    }

    // Check rate limiting
    const alertKey = `${alert.type}-${alert.source}`;
    const count = this.alertCounters.get(alertKey) || 0;
    
    // Rate limit: max 10 alerts per hour for same type/source
    if (count >= 10) {
      return true;
    }

    return false;
  }

  /**
   * Get applicable channels for alert
   */
  private getApplicableChannels(alert: Alert): AlertChannel[] {
    const channels: AlertChannel[] = [];
    
    for (const channel of this.alertChannels.values()) {
      if (channel.enabled && this.shouldSendToChannel(alert, channel)) {
        channels.push(channel);
      }
    }

    return channels;
  }

  /**
   * Check if alert should be sent to channel
   */
  private shouldSendToChannel(alert: Alert, channel: AlertChannel): boolean {
    const severityLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    const alertLevel = severityLevels[alert.severity];
    const channelLevel = severityLevels[channel.minSeverity];
    
    return alertLevel >= channelLevel;
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'CONSOLE':
          this.sendToConsole(alert);
          break;
        case 'EMAIL':
          await this.sendToEmail(alert, channel);
          break;
        case 'WEBHOOK':
          await this.sendToWebhook(alert, channel);
          break;
        default:
          logger.warn('Unknown channel type', { 
            channelType: channel.type,
            service: 'AlertSystem'
          });
      }
    } catch (error) {
      logger.error('Failed to send alert to channel', {
        error,
        channelId: channel.id,
        channelType: channel.type,
        service: 'AlertSystem'
      });
    }
  }

  /**
   * Send alert to console
   */
  private sendToConsole(alert: Alert): void {
    const logLevel = this.getLogLevel(alert.severity);
    const message = `[${alert.severity}] ${alert.title}: ${alert.message}`;
    
    logger.log(logLevel, message, {
      alertId: alert.id,
      alertType: alert.type,
      source: alert.source,
      service: 'AlertSystem'
    });
  }

  /**
   * Send alert to email
   */
  private async sendToEmail(alert: Alert, channel: AlertChannel): Promise<void> {
    // Email sending would be implemented here
    // For now, just log the intent
    logger.info('Email alert would be sent', {
      alertId: alert.id,
      alertType: alert.type,
      to: channel.config.to,
      service: 'AlertSystem'
    });
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(alert: Alert, channel: AlertChannel): Promise<void> {
    // Webhook sending would be implemented here
    // For now, just log the intent
    logger.info('Webhook alert would be sent', {
      alertId: alert.id,
      alertType: alert.type,
      url: channel.config.url,
      service: 'AlertSystem'
    });
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: string): string {
    switch (severity) {
      case 'LOW': return 'info';
      case 'MEDIUM': return 'warn';
      case 'HIGH': return 'error';
      case 'CRITICAL': return 'error';
      default: return 'info';
    }
  }

  /**
   * Get matching rules for event
   */
  private getMatchingRules(eventType: string, eventData: any): AlertRule[] {
    const rules: AlertRule[] = [];
    
    for (const rule of this.alertRules.values()) {
      if (rule.enabled && rule.eventType === eventType) {
        rules.push(rule);
      }
    }

    return rules;
  }

  /**
   * Evaluate rule condition
   */
  private evaluateRule(rule: AlertRule, eventData: any): boolean {
    try {
      return rule.condition(eventData);
    } catch (error) {
      logger.error('Error evaluating alert rule', {
        error,
        ruleId: rule.id,
        service: 'AlertSystem'
      });
      return false;
    }
  }

  /**
   * Create alert from rule and data
   */
  private createAlert(rule: AlertRule, eventData: any): Alert {
    const message = this.processTemplate(rule.messageTemplate, eventData);
    
    return {
      id: `${rule.id}-${Date.now()}`,
      type: rule.eventType,
      severity: rule.severity,
      title: rule.title,
      message,
      timestamp: new Date(),
      source: 'TradingEngine',
      data: eventData
    };
  }

  /**
   * Process message template
   */
  private processTemplate(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Add alert to history
   */
  private addToHistory(alert: Alert): void {
    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  /**
   * Update alert counters
   */
  private updateAlertCounters(alert: Alert): void {
    const alertKey = `${alert.type}-${alert.source}`;
    const count = this.alertCounters.get(alertKey) || 0;
    this.alertCounters.set(alertKey, count + 1);
    
    // Reset counter after 1 hour
    setTimeout(() => {
      const currentCount = this.alertCounters.get(alertKey) || 0;
      this.alertCounters.set(alertKey, Math.max(0, currentCount - 1));
    }, 60 * 60 * 1000);
  }

  /**
   * Get alert counts by type
   */
  private getAlertCountsByType(alerts: Alert[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const alert of alerts) {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get alert counts by severity
   */
  private getAlertCountsBySeverity(alerts: Alert[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const alert of alerts) {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get top alerts
   */
  private getTopAlerts(alerts: Alert[]): Array<{ type: string; count: number }> {
    const counts = this.getAlertCountsByType(alerts);
    
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Public getters
  public isAlertSystemActive(): boolean { return this.isActive; }
  public getAlertChannels(): AlertChannel[] { return Array.from(this.alertChannels.values()); }
  public getAlertRules(): AlertRule[] { return Array.from(this.alertRules.values()); }
}

// Type definitions
interface Alert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  data?: any;
}

interface AlertRule {
  id: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  condition: (data: any) => boolean;
  title: string;
  messageTemplate: string;
}

interface AlertChannel {
  id: string;
  type: 'CONSOLE' | 'EMAIL' | 'WEBHOOK' | 'SMS';
  enabled: boolean;
  minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  config: any;
}

interface AlertStatistics {
  total24h: number;
  total7d: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topAlerts: Array<{ type: string; count: number }>;
  channels: string[];
  rules: string[];
}