import { 
  TradingStrategy, 
  IndicatorConfig, 
  TradingRule, 
  RiskManagementConfig 
} from '@/types';

/**
 * Strategy Factory
 * 
 * Why Predefined Strategies?
 * - Proven trading methodologies with historical track records
 * - Standardized approach to strategy configuration
 * - Easy to test, compare, and optimize
 * - Foundation for AI-driven strategy enhancement
 * - Educational value for understanding different trading approaches
 */
export class StrategyFactory {
  
  /**
   * Trend Following Strategy using Moving Average Crossover
   * 
   * Theory: Trends persist, and moving average crossovers identify trend changes
   * Best Markets: Strong trending markets (bull/bear runs)
   * Risk Profile: Higher volatility but captures large moves
   */
  public static createMovingAverageCrossoverStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'EMA_12',
        type: 'ExponentialMovingAverage',
        parameters: { period: 12 },
        weight: 0.4
      },
      {
        name: 'EMA_26',
        type: 'ExponentialMovingAverage',
        parameters: { period: 26 },
        weight: 0.4
      },
      {
        name: 'MACD',
        type: 'MACD',
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        weight: 0.2
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'EMA_12 crosses above EMA_26 AND MACD > 0',
        action: 'BUY',
        confidence: 75,
        stopLoss: 3,
        takeProfit: 9
      },
      {
        condition: 'EMA_12 crosses below EMA_26 AND MACD < 0',
        action: 'SELL',
        confidence: 75,
        stopLoss: 3,
        takeProfit: 9
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.1, // 10% of portfolio per position
      maxDrawdown: 0.15, // 15% maximum drawdown
      stopLossPercentage: 3,
      takeProfitPercentage: 9,
      riskPerTrade: 0.02 // Risk 2% per trade
    };

    return {
      id: 'ma_crossover_trend',
      name: 'Moving Average Crossover (Trend Following)',
      description: 'Classic trend following strategy using EMA crossovers with MACD confirmation. Works best in trending markets.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Mean Reversion Strategy using RSI and Bollinger Bands
   * 
   * Theory: Prices tend to revert to their mean over time
   * Best Markets: Range-bound, sideways markets
   * Risk Profile: Lower volatility, consistent smaller gains
   */
  public static createMeanReversionStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'RSI_14',
        type: 'RelativeStrengthIndex',
        parameters: { period: 14 },
        weight: 0.35
      },
      {
        name: 'BB_20',
        type: 'BollingerBands',
        parameters: { period: 20, standardDeviations: 2 },
        weight: 0.35
      },
      {
        name: 'STOCH_14',
        type: 'StochasticOscillator',
        parameters: { period: 14, smoothK: 3, smoothD: 3 },
        weight: 0.3
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'RSI < 30 AND price touches lower Bollinger Band',
        action: 'BUY',
        confidence: 80,
        stopLoss: 2,
        takeProfit: 4
      },
      {
        condition: 'RSI > 70 AND price touches upper Bollinger Band',
        action: 'SELL',
        confidence: 80,
        stopLoss: 2,
        takeProfit: 4
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.15,
      maxDrawdown: 0.1,
      stopLossPercentage: 2,
      takeProfitPercentage: 4,
      riskPerTrade: 0.015
    };

    return {
      id: 'mean_reversion_rsi_bb',
      name: 'RSI Bollinger Bands Mean Reversion',
      description: 'Mean reversion strategy using RSI oversold/overbought levels with Bollinger Band touches for entry signals.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Momentum Breakout Strategy
   * 
   * Theory: Strong momentum often continues in the same direction
   * Best Markets: Volatile markets with clear breakouts
   * Risk Profile: High reward potential but requires good timing
   */
  public static createMomentumBreakoutStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'KC_20',
        type: 'KeltnerChannels',
        parameters: { period: 20, atrPeriod: 10, multiplier: 2 },
        weight: 0.3
      },
      {
        name: 'ATR_14',
        type: 'AverageTrueRange',
        parameters: { period: 14 },
        weight: 0.2
      },
      {
        name: 'MACD',
        type: 'MACD',
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        weight: 0.25
      },
      {
        name: 'VWAP',
        type: 'VolumeWeightedAveragePrice',
        parameters: {},
        weight: 0.25
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'Price breaks above upper Keltner Channel with high volume',
        action: 'BUY',
        confidence: 70,
        stopLoss: 4,
        takeProfit: 12
      },
      {
        condition: 'Price breaks below lower Keltner Channel with high volume',
        action: 'SELL',
        confidence: 70,
        stopLoss: 4,
        takeProfit: 12
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.08,
      maxDrawdown: 0.2,
      stopLossPercentage: 4,
      takeProfitPercentage: 12,
      riskPerTrade: 0.025
    };

    return {
      id: 'momentum_breakout',
      name: 'Keltner Channel Momentum Breakout',
      description: 'Momentum strategy that trades breakouts from Keltner Channels with volume confirmation.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Volume-Price Analysis Strategy
   * 
   * Theory: Volume precedes price movement
   * Best Markets: High-volume trading sessions
   * Risk Profile: Institutional-style trading with volume backing
   */
  public static createVolumePriceStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'VWAP',
        type: 'VolumeWeightedAveragePrice',
        parameters: {},
        weight: 0.3
      },
      {
        name: 'OBV',
        type: 'OnBalanceVolume',
        parameters: {},
        weight: 0.25
      },
      {
        name: 'MFI_14',
        type: 'MoneyFlowIndex',
        parameters: { period: 14 },
        weight: 0.25
      },
      {
        name: 'AD_LINE',
        type: 'AccumulationDistributionLine',
        parameters: {},
        weight: 0.2
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'Price above VWAP with OBV increasing and MFI > 50',
        action: 'BUY',
        confidence: 75,
        stopLoss: 2.5,
        takeProfit: 6
      },
      {
        condition: 'Price below VWAP with OBV decreasing and MFI < 50',
        action: 'SELL',
        confidence: 75,
        stopLoss: 2.5,
        takeProfit: 6
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.12,
      maxDrawdown: 0.12,
      stopLossPercentage: 2.5,
      takeProfitPercentage: 6,
      riskPerTrade: 0.018
    };

    return {
      id: 'volume_price_analysis',
      name: 'Volume-Price Analysis Strategy',
      description: 'Strategy based on volume-price relationships using VWAP, OBV, and MFI for institutional-style trading.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Multi-Timeframe Confluence Strategy
   * 
   * Theory: Multiple timeframe confirmation reduces false signals
   * Best Markets: All market conditions with proper timeframe selection
   * Risk Profile: Higher accuracy but fewer trading opportunities
   */
  public static createMultiTimeframeStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'EMA_12',
        type: 'ExponentialMovingAverage',
        parameters: { period: 12 },
        weight: 0.2
      },
      {
        name: 'RSI_14',
        type: 'RelativeStrengthIndex',
        parameters: { period: 14 },
        weight: 0.2
      },
      {
        name: 'MACD',
        type: 'MACD',
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        weight: 0.2
      },
      {
        name: 'BB_20',
        type: 'BollingerBands',
        parameters: { period: 20, standardDeviations: 2 },
        weight: 0.2
      },
      {
        name: 'VWAP',
        type: 'VolumeWeightedAveragePrice',
        parameters: {},
        weight: 0.2
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'Multiple timeframe confluence with 3+ indicators agreeing',
        action: 'BUY',
        confidence: 85,
        stopLoss: 3,
        takeProfit: 9
      },
      {
        condition: 'Multiple timeframe confluence with 3+ indicators agreeing',
        action: 'SELL',
        confidence: 85,
        stopLoss: 3,
        takeProfit: 9
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.15,
      maxDrawdown: 0.1,
      stopLossPercentage: 3,
      takeProfitPercentage: 9,
      riskPerTrade: 0.02
    };

    return {
      id: 'multi_timeframe_confluence',
      name: 'Multi-Timeframe Confluence Strategy',
      description: 'High-probability strategy requiring confluence from multiple indicators and timeframes before taking positions.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Scalping Strategy for Short-Term Trading
   * 
   * Theory: Small, frequent profits from market inefficiencies
   * Best Markets: High-volume, liquid markets
   * Risk Profile: Low risk per trade but high frequency
   */
  public static createScalpingStrategy(): TradingStrategy {
    const indicators: IndicatorConfig[] = [
      {
        name: 'EMA_5',
        type: 'ExponentialMovingAverage',
        parameters: { period: 5 },
        weight: 0.25
      },
      {
        name: 'RSI_7',
        type: 'RelativeStrengthIndex',
        parameters: { period: 7 },
        weight: 0.25
      },
      {
        name: 'WILLIAMS_R_14',
        type: 'WilliamsR',
        parameters: { period: 14 },
        weight: 0.25
      },
      {
        name: 'VWAP',
        type: 'VolumeWeightedAveragePrice',
        parameters: {},
        weight: 0.25
      }
    ];

    const rules: TradingRule[] = [
      {
        condition: 'Quick momentum with volume confirmation',
        action: 'BUY',
        confidence: 60,
        stopLoss: 0.5,
        takeProfit: 1.5
      },
      {
        condition: 'Quick momentum with volume confirmation',
        action: 'SELL',
        confidence: 60,
        stopLoss: 0.5,
        takeProfit: 1.5
      }
    ];

    const riskManagement: RiskManagementConfig = {
      maxPositionSize: 0.05,
      maxDrawdown: 0.05,
      stopLossPercentage: 0.5,
      takeProfitPercentage: 1.5,
      riskPerTrade: 0.005
    };

    return {
      id: 'scalping_strategy',
      name: 'High-Frequency Scalping Strategy',
      description: 'Fast-paced scalping strategy for capturing small price movements with tight risk control.',
      indicators,
      rules,
      riskManagement,
      isActive: true,
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get all predefined strategies
   */
  public static getAllStrategies(): TradingStrategy[] {
    return [
      this.createMovingAverageCrossoverStrategy(),
      this.createMeanReversionStrategy(),
      this.createMomentumBreakoutStrategy(),
      this.createVolumePriceStrategy(),
      this.createMultiTimeframeStrategy(),
      this.createScalpingStrategy()
    ];
  }

  /**
   * Get strategy by ID
   */
  public static getStrategyById(id: string): TradingStrategy | null {
    const strategies = this.getAllStrategies();
    return strategies.find(s => s.id === id) || null;
  }

  /**
   * Create strategies optimized for specific market conditions
   */
  public static getStrategiesForMarketCondition(condition: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'VOLATILE'): TradingStrategy[] {
    const allStrategies = this.getAllStrategies();
    
    switch (condition) {
      case 'BULL':
        return [
          this.createMovingAverageCrossoverStrategy(),
          this.createMomentumBreakoutStrategy(),
          this.createVolumePriceStrategy()
        ];
      
      case 'BEAR':
        return [
          this.createMeanReversionStrategy(),
          this.createVolumePriceStrategy(),
          this.createMultiTimeframeStrategy()
        ];
      
      case 'SIDEWAYS':
        return [
          this.createMeanReversionStrategy(),
          this.createScalpingStrategy(),
          this.createMultiTimeframeStrategy()
        ];
      
      case 'VOLATILE':
        return [
          this.createMomentumBreakoutStrategy(),
          this.createVolumePriceStrategy(),
          this.createScalpingStrategy()
        ];
      
      default:
        return allStrategies;
    }
  }

  /**
   * Create custom strategy with user-defined parameters
   */
  public static createCustomStrategy(
    name: string,
    description: string,
    indicators: IndicatorConfig[],
    rules: TradingRule[],
    riskManagement: RiskManagementConfig
  ): TradingStrategy {
    return {
      id: `custom_${Date.now()}`,
      name,
      description,
      indicators,
      rules,
      riskManagement,
      isActive: false, // Start inactive for testing
      performance: this.createEmptyPerformance(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create empty performance record for new strategies
   */
  private static createEmptyPerformance() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalReturnPercentage: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      avgTradeDuration: 0,
      startDate: new Date(),
      endDate: new Date()
    };
  }

  /**
   * Validate strategy configuration
   */
  public static validateStrategy(strategy: TradingStrategy): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!strategy.name || strategy.name.trim() === '') {
      errors.push('Strategy name is required');
    }

    if (!strategy.indicators || strategy.indicators.length === 0) {
      errors.push('At least one indicator is required');
    }

    if (!strategy.rules || strategy.rules.length === 0) {
      errors.push('At least one trading rule is required');
    }

    // Validate risk management
    if (!strategy.riskManagement) {
      errors.push('Risk management configuration is required');
    } else {
      const rm = strategy.riskManagement;
      
      if (rm.maxPositionSize <= 0 || rm.maxPositionSize > 1) {
        errors.push('Max position size must be between 0 and 1 (0-100%)');
      }
      
      if (rm.stopLossPercentage <= 0 || rm.stopLossPercentage > 50) {
        errors.push('Stop loss percentage must be between 0 and 50%');
      }
      
      if (rm.takeProfitPercentage <= rm.stopLossPercentage) {
        errors.push('Take profit must be greater than stop loss');
      }
      
      if (rm.riskPerTrade <= 0 || rm.riskPerTrade > 0.1) {
        errors.push('Risk per trade must be between 0 and 10%');
      }
    }

    // Validate indicator weights sum
    const totalWeight = strategy.indicators.reduce((sum, ind) => sum + ind.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      errors.push('Indicator weights should sum to approximately 1.0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}