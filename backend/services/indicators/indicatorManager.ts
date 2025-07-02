import { BaseIndicator } from './baseIndicator';
import { 
  SimpleMovingAverage, 
  ExponentialMovingAverage, 
  DoubleExponentialMovingAverage, 
  MACD 
} from './movingAverages';
import { 
  RelativeStrengthIndex, 
  StochasticOscillator, 
  WilliamsR, 
  CommodityChannelIndex 
} from './oscillators';
import { 
  BollingerBands, 
  AverageTrueRange, 
  KeltnerChannels 
} from './volatility';
import { 
  VolumeWeightedAveragePrice, 
  OnBalanceVolume, 
  MoneyFlowIndex, 
  AccumulationDistributionLine 
} from './volume';
import { CandlestickData, TechnicalIndicator, MarketData } from '@/types';
import logger from '../../utils/logger';

/**
 * Indicator Manager
 * 
 * Manages all technical indicators for a trading pair
 * Provides centralized indicator calculation and signal aggregation
 * Handles indicator combinations and weighted signal generation
 */
export class IndicatorManager {
  private symbol: string;
  private indicators: Map<string, BaseIndicator> = new Map();
  private indicatorWeights: Map<string, number> = new Map();
  private marketCondition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'UNKNOWN' = 'UNKNOWN';

  constructor(symbol: string) {
    this.symbol = symbol;
    this.initializeIndicators();
    this.setDefaultWeights();
  }

  /**
   * Initialize all indicators with default parameters
   */
  private initializeIndicators(): void {
    // Trend Following Indicators
    this.indicators.set('SMA_20', new SimpleMovingAverage(20));
    this.indicators.set('SMA_50', new SimpleMovingAverage(50));
    this.indicators.set('EMA_12', new ExponentialMovingAverage(12));
    this.indicators.set('EMA_26', new ExponentialMovingAverage(26));
    this.indicators.set('DEMA_14', new DoubleExponentialMovingAverage(14));
    this.indicators.set('MACD', new MACD(12, 26, 9));

    // Momentum Oscillators
    this.indicators.set('RSI_14', new RelativeStrengthIndex(14));
    this.indicators.set('RSI_7', new RelativeStrengthIndex(7)); // Short-term
    this.indicators.set('STOCH_14', new StochasticOscillator(14, 3, 3));
    this.indicators.set('WILLIAMS_R_14', new WilliamsR(14));
    this.indicators.set('CCI_20', new CommodityChannelIndex(20));

    // Volatility Indicators
    this.indicators.set('BB_20', new BollingerBands(20, 2));
    this.indicators.set('ATR_14', new AverageTrueRange(14));
    this.indicators.set('KC_20', new KeltnerChannels(20, 10, 2));

    // Volume Indicators
    this.indicators.set('VWAP', new VolumeWeightedAveragePrice());
    this.indicators.set('OBV', new OnBalanceVolume());
    this.indicators.set('MFI_14', new MoneyFlowIndex(14));
    this.indicators.set('AD_LINE', new AccumulationDistributionLine());

    logger.info(`Initialized ${this.indicators.size} indicators for ${this.symbol}`, {
      service: 'IndicatorManager'
    });
  }

  /**
   * Set default weights for each indicator based on reliability and market conditions
   */
  private setDefaultWeights(): void {
    // Trend Following Indicators (higher weight in trending markets)
    this.indicatorWeights.set('SMA_20', 0.08);
    this.indicatorWeights.set('SMA_50', 0.06);
    this.indicatorWeights.set('EMA_12', 0.09);
    this.indicatorWeights.set('EMA_26', 0.07);
    this.indicatorWeights.set('DEMA_14', 0.05);
    this.indicatorWeights.set('MACD', 0.12); // High weight due to trend + momentum

    // Momentum Oscillators (higher weight in ranging markets)
    this.indicatorWeights.set('RSI_14', 0.10);
    this.indicatorWeights.set('RSI_7', 0.06);
    this.indicatorWeights.set('STOCH_14', 0.08);
    this.indicatorWeights.set('WILLIAMS_R_14', 0.05);
    this.indicatorWeights.set('CCI_20', 0.04);

    // Volatility Indicators
    this.indicatorWeights.set('BB_20', 0.09);
    this.indicatorWeights.set('ATR_14', 0.03); // Lower weight as it's mainly for risk management
    this.indicatorWeights.set('KC_20', 0.06);

    // Volume Indicators (important for confirmation)
    this.indicatorWeights.set('VWAP', 0.08);
    this.indicatorWeights.set('OBV', 0.07);
    this.indicatorWeights.set('MFI_14', 0.06);
    this.indicatorWeights.set('AD_LINE', 0.05);
  }

  /**
   * Add new candlestick data to all indicators
   */
  public addCandlestickData(candle: CandlestickData): void {
    for (const indicator of this.indicators.values()) {
      indicator.addData(candle);
    }

    // Update market condition based on recent data
    this.updateMarketCondition();
  }

  /**
   * Update the last candlestick data (for real-time updates)
   */
  public updateLastCandlestickData(candle: CandlestickData): void {
    for (const indicator of this.indicators.values()) {
      indicator.updateLastData(candle);
    }
  }

  /**
   * Calculate all indicators and return results
   */
  public calculateAllIndicators(): Map<string, TechnicalIndicator | null> {
    const results = new Map<string, TechnicalIndicator | null>();

    for (const [name, indicator] of this.indicators) {
      try {
        const result = indicator.calculate();
        results.set(name, result);
      } catch (error) {
        logger.error(`Error calculating indicator ${name}`, { 
          error, 
          symbol: this.symbol,
          service: 'IndicatorManager' 
        });
        results.set(name, null);
      }
    }

    return results;
  }

  /**
   * Get aggregated signal based on all indicators
   */
  public getAggregatedSignal(): {
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    breakdown: { [key: string]: { signal: string; weight: number; strength: number } };
  } {
    const results = this.calculateAllIndicators();
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;
    const breakdown: { [key: string]: { signal: string; weight: number; strength: number } } = {};

    // Adjust weights based on market condition
    const adjustedWeights = this.getMarketAdjustedWeights();

    for (const [name, result] of results) {
      if (!result) continue;

      const weight = adjustedWeights.get(name) || 0;
      const strength = result.strength / 100; // Normalize to 0-1
      const weightedStrength = weight * strength;

      breakdown[name] = {
        signal: result.signal,
        weight,
        strength: result.strength
      };

      if (result.signal === 'BUY') {
        buyScore += weightedStrength;
      } else if (result.signal === 'SELL') {
        sellScore += weightedStrength;
      }

      totalWeight += weight;
    }

    // Normalize scores
    const normalizedBuyScore = totalWeight > 0 ? buyScore / totalWeight : 0;
    const normalizedSellScore = totalWeight > 0 ? sellScore / totalWeight : 0;

    // Determine final signal
    const scoreDifference = Math.abs(normalizedBuyScore - normalizedSellScore);
    const minThreshold = 0.15; // Minimum threshold for signal generation

    let signal: 'BUY' | 'SELL' | 'NEUTRAL';
    let confidence: number;

    if (normalizedBuyScore > normalizedSellScore && scoreDifference >= minThreshold) {
      signal = 'BUY';
      confidence = Math.min(100, normalizedBuyScore * 100);
    } else if (normalizedSellScore > normalizedBuyScore && scoreDifference >= minThreshold) {
      signal = 'SELL';
      confidence = Math.min(100, normalizedSellScore * 100);
    } else {
      signal = 'NEUTRAL';
      confidence = Math.max(normalizedBuyScore, normalizedSellScore) * 100;
    }

    return {
      signal,
      confidence,
      breakdown
    };
  }

  /**
   * Get market-adjusted weights based on current market condition
   */
  private getMarketAdjustedWeights(): Map<string, number> {
    const adjustedWeights = new Map(this.indicatorWeights);

    switch (this.marketCondition) {
      case 'TRENDING':
        // Increase weight for trend-following indicators
        this.adjustWeight(adjustedWeights, 'MACD', 1.3);
        this.adjustWeight(adjustedWeights, 'EMA_12', 1.2);
        this.adjustWeight(adjustedWeights, 'EMA_26', 1.2);
        // Decrease weight for mean-reversion indicators
        this.adjustWeight(adjustedWeights, 'RSI_14', 0.8);
        this.adjustWeight(adjustedWeights, 'BB_20', 0.8);
        break;

      case 'RANGING':
        // Increase weight for oscillators and mean-reversion indicators
        this.adjustWeight(adjustedWeights, 'RSI_14', 1.3);
        this.adjustWeight(adjustedWeights, 'STOCH_14', 1.2);
        this.adjustWeight(adjustedWeights, 'BB_20', 1.2);
        // Decrease weight for trend-following indicators
        this.adjustWeight(adjustedWeights, 'MACD', 0.7);
        this.adjustWeight(adjustedWeights, 'EMA_12', 0.8);
        break;

      case 'VOLATILE':
        // Increase weight for volatility indicators
        this.adjustWeight(adjustedWeights, 'ATR_14', 1.5);
        this.adjustWeight(adjustedWeights, 'BB_20', 1.3);
        this.adjustWeight(adjustedWeights, 'KC_20', 1.2);
        // Increase weight for volume indicators
        this.adjustWeight(adjustedWeights, 'VWAP', 1.2);
        this.adjustWeight(adjustedWeights, 'MFI_14', 1.2);
        break;
    }

    return adjustedWeights;
  }

  /**
   * Adjust indicator weight by multiplier
   */
  private adjustWeight(weights: Map<string, number>, indicator: string, multiplier: number): void {
    const currentWeight = weights.get(indicator) || 0;
    weights.set(indicator, currentWeight * multiplier);
  }

  /**
   * Update market condition based on recent price action and volatility
   */
  private updateMarketCondition(): void {
    const atrIndicator = this.indicators.get('ATR_14');
    const bbIndicator = this.indicators.get('BB_20');
    
    if (!atrIndicator || !bbIndicator) return;

    const atrResult = atrIndicator.calculate();
    const bbResult = bbIndicator.calculate();

    if (!atrResult || !bbResult) return;

    const atrValue = atrResult.value as number;
    const bbValues = bbResult.value as number[];
    const bandwidth = bbValues[4]; // Bandwidth from Bollinger Bands

    // Determine market condition based on volatility and price action
    if (bandwidth > 0.05) { // High volatility
      this.marketCondition = 'VOLATILE';
    } else if (bandwidth < 0.02) { // Low volatility, likely ranging
      this.marketCondition = 'RANGING';
    } else {
      this.marketCondition = 'TRENDING';
    }

    logger.debug(`Market condition updated to ${this.marketCondition}`, {
      symbol: this.symbol,
      atr: atrValue,
      bandwidth,
      service: 'IndicatorManager'
    });
  }

  /**
   * Get specific indicator result
   */
  public getIndicator(name: string): TechnicalIndicator | null {
    const indicator = this.indicators.get(name);
    return indicator ? indicator.calculate() : null;
  }

  /**
   * Get market data with all calculated indicators
   */
  public getMarketData(): MarketData {
    const results = this.calculateAllIndicators();
    const indicators: TechnicalIndicator[] = [];

    for (const result of results.values()) {
      if (result) {
        indicators.push(result);
      }
    }

    return {
      symbol: this.symbol,
      candlesticks: [], // Would be populated by the calling service
      indicators
    };
  }

  /**
   * Reset all indicators
   */
  public reset(): void {
    for (const indicator of this.indicators.values()) {
      indicator.reset();
    }
    this.marketCondition = 'UNKNOWN';
    
    logger.info(`Reset all indicators for ${this.symbol}`, {
      service: 'IndicatorManager'
    });
  }

  /**
   * Get current market condition
   */
  public getMarketCondition(): string {
    return this.marketCondition;
  }

  /**
   * Get indicator statistics
   */
  public getStatistics(): {
    totalIndicators: number;
    activeIndicators: number;
    marketCondition: string;
    lastUpdate: Date;
  } {
    const results = this.calculateAllIndicators();
    const activeIndicators = Array.from(results.values()).filter(r => r !== null).length;

    return {
      totalIndicators: this.indicators.size,
      activeIndicators,
      marketCondition: this.marketCondition,
      lastUpdate: new Date()
    };
  }
}