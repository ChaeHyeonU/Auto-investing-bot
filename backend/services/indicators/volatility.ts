import { BaseIndicator } from './baseIndicator';
import { TechnicalIndicator } from '@/types';

/**
 * Bollinger Bands
 * 
 * Why Bollinger Bands?
 * - Shows market volatility using standard deviations
 * - Identifies overbought/oversold conditions relative to volatility
 * - Dynamic support and resistance levels that adapt to market conditions
 * - Excellent for mean reversion strategies in ranging markets
 * - Shows volatility expansions that often precede significant moves
 * 
 * Components:
 * - Middle Band: Simple Moving Average (typically 20-period)
 * - Upper Band: Middle Band + (2 * Standard Deviation)
 * - Lower Band: Middle Band - (2 * Standard Deviation)
 * 
 * Best Use Cases:
 * - Mean reversion in ranging markets
 * - Volatility breakout strategies
 * - Support/resistance identification
 * - Squeeze patterns for breakout timing
 */
export class BollingerBands extends BaseIndicator {
  private standardDeviations: number;

  constructor(period: number = 20, standardDeviations: number = 2) {
    super(`BB_${period}_${standardDeviations}`, period);
    this.standardDeviations = standardDeviations;
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const closingPrices = this.getClosingPrices();
    const middleBand = this.calculateSMA(closingPrices, this.period);
    const standardDeviation = this.calculateStandardDeviation(
      closingPrices.slice(-this.period),
      middleBand
    );

    const upperBand = middleBand + (this.standardDeviations * standardDeviation);
    const lowerBand = middleBand - (this.standardDeviations * standardDeviation);
    const currentPrice = closingPrices[closingPrices.length - 1];

    // Calculate %B (position within bands)
    const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);

    // Calculate bandwidth (volatility measure)
    const bandwidth = (upperBand - lowerBand) / middleBand;

    const signal = this.generateSignal([currentPrice, upperBand, middleBand, lowerBand, percentB]);
    const strength = this.calculateStrength([percentB, bandwidth]);

    return {
      name: this.name,
      value: [upperBand, middleBand, lowerBand, percentB, bandwidth],
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        standardDeviations: this.standardDeviations,
        percentB,
        bandwidth
      }
    };
  }

  protected generateSignal(values: number[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    const [currentPrice, upperBand, middleBand, lowerBand, percentB] = values;
    
    // Mean reversion signals
    if (currentPrice <= lowerBand || percentB <= 0) {
      return 'BUY'; // Price touching or below lower band (oversold)
    } else if (currentPrice >= upperBand || percentB >= 1) {
      return 'SELL'; // Price touching or above upper band (overbought)
    }

    // Trend continuation signals when price is near middle band
    const closingPrices = this.getClosingPrices(2);
    if (closingPrices.length >= 2) {
      const previousPrice = closingPrices[closingPrices.length - 2];
      const priceChange = currentPrice - previousPrice;
      
      // If price is moving through middle band with momentum
      if (Math.abs(currentPrice - middleBand) / middleBand < 0.005) { // Near middle band
        if (priceChange > 0 && percentB > 0.5) {
          return 'BUY'; // Upward momentum through middle band
        } else if (priceChange < 0 && percentB < 0.5) {
          return 'SELL'; // Downward momentum through middle band
        }
      }
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [percentB, bandwidth] = values;
    
    // Strength increases at extreme %B levels and during low volatility (squeeze)
    let strengthFromPosition = 0;
    if (percentB <= 0 || percentB >= 1) {
      strengthFromPosition = 100; // Maximum strength at band touches
    } else if (percentB <= 0.2 || percentB >= 0.8) {
      strengthFromPosition = 75; // High strength near bands
    } else {
      strengthFromPosition = Math.abs(percentB - 0.5) * 100; // Strength based on distance from center
    }

    // Consider volatility - lower volatility can lead to higher strength signals
    const volatilityFactor = Math.max(0.5, 1 - bandwidth); // Higher factor for lower volatility
    
    return Math.min(100, strengthFromPosition * volatilityFactor);
  }
}

/**
 * Average True Range (ATR)
 * 
 * Why ATR?
 * - Measures market volatility without considering price direction
 * - Essential for position sizing and risk management
 * - Helps set appropriate stop-loss levels
 * - Identifies periods of high/low volatility for strategy adaptation
 * - Used in many volatility-based trading strategies
 * 
 * Formula: ATR = EMA of True Range over period
 * True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
 * 
 * Best Use Cases:
 * - Position sizing based on volatility
 * - Dynamic stop-loss placement
 * - Volatility filtering for strategy activation
 * - Market regime identification (high/low vol periods)
 */
export class AverageTrueRange extends BaseIndicator {
  private previousATR: number | null = null;
  private isInitialized: boolean = false;

  constructor(period: number = 14) {
    super(`ATR_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (this.data.length < 2) { // Need at least 2 candles for True Range
      return null;
    }

    const trueRanges = this.calculateTrueRanges();
    
    if (trueRanges.length < this.period && !this.isInitialized) {
      // Not enough data yet, return null
      return null;
    }

    let atrValue: number;
    
    if (!this.isInitialized && trueRanges.length >= this.period) {
      // Initialize with SMA of true ranges
      atrValue = this.calculateSMA(trueRanges, this.period);
      this.isInitialized = true;
    } else if (this.previousATR !== null) {
      // Use Wilder's smoothing method
      const currentTR = trueRanges[trueRanges.length - 1];
      atrValue = ((this.previousATR * (this.period - 1)) + currentTR) / this.period;
    } else {
      return null;
    }

    this.previousATR = atrValue;

    const signal = this.generateSignal(atrValue);
    const strength = this.calculateStrength(atrValue);

    return {
      name: this.name,
      value: atrValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        currentTrueRange: trueRanges[trueRanges.length - 1]
      }
    };
  }

  private calculateTrueRanges(): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < this.data.length; i++) {
      const current = this.data[i];
      const previous = this.data[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    return trueRanges;
  }

  protected generateSignal(atrValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    // ATR itself doesn't generate buy/sell signals
    // It's primarily used for risk management and volatility analysis
    // Signal strength will indicate volatility level
    return 'NEUTRAL';
  }

  protected calculateStrength(atrValue: number): number {
    // Strength represents volatility level
    // Higher ATR = higher volatility = higher strength
    const closingPrices = this.getClosingPrices(1);
    if (closingPrices.length === 0) return 0;
    
    const currentPrice = closingPrices[0];
    const volatilityPercentage = (atrValue / currentPrice) * 100;
    
    // Scale volatility to 0-100 strength
    // 1% volatility = 25 strength, 4% volatility = 100 strength
    return Math.min(100, volatilityPercentage * 25);
  }

  public reset(): void {
    super.reset();
    this.previousATR = null;
    this.isInitialized = false;
  }
}

/**
 * Keltner Channels
 * 
 * Why Keltner Channels?
 * - Similar to Bollinger Bands but uses ATR instead of standard deviation
 * - Better for trending markets as ATR adapts to volatility changes
 * - Provides dynamic support/resistance levels
 * - Less prone to false signals in volatile markets
 * - Excellent for breakout strategies
 * 
 * Components:
 * - Middle Line: EMA (typically 20-period)
 * - Upper Channel: Middle Line + (multiplier * ATR)
 * - Lower Channel: Middle Line - (multiplier * ATR)
 * 
 * Best Use Cases:
 * - Trend following in volatile markets
 * - Breakout identification
 * - Dynamic support/resistance
 * - Volatility-adjusted trading ranges
 */
export class KeltnerChannels extends BaseIndicator {
  private atr: AverageTrueRange;
  private ema: import('./movingAverages').ExponentialMovingAverage;
  private multiplier: number;

  constructor(period: number = 20, atrPeriod: number = 10, multiplier: number = 2) {
    super(`KC_${period}_${atrPeriod}_${multiplier}`, Math.max(period, atrPeriod));
    this.atr = new AverageTrueRange(atrPeriod);
    // Import EMA dynamically to avoid circular dependency
    const { ExponentialMovingAverage } = require('./movingAverages');
    this.ema = new ExponentialMovingAverage(period);
    this.multiplier = multiplier;
  }

  public addData(candle: any): void {
    super.addData(candle);
    this.atr.addData(candle);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    // Calculate EMA of closing prices
    const closingPrices = this.getClosingPrices();
    const ema = this.calculateEMA(closingPrices, 20); // Using 20-period EMA

    const atrResult = this.atr.calculate();
    if (!atrResult) {
      return null;
    }

    const atrValue = atrResult.value as number;
    const upperChannel = ema + (this.multiplier * atrValue);
    const lowerChannel = ema - (this.multiplier * atrValue);
    const currentPrice = closingPrices[closingPrices.length - 1];

    const signal = this.generateSignal([currentPrice, upperChannel, ema, lowerChannel]);
    const strength = this.calculateStrength([currentPrice, upperChannel, lowerChannel, atrValue]);

    return {
      name: this.name,
      value: [upperChannel, ema, lowerChannel],
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        atrPeriod: this.atr.getPeriod(),
        multiplier: this.multiplier,
        atrValue
      }
    };
  }

  protected generateSignal(values: number[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    const [currentPrice, upperChannel, middleLine, lowerChannel] = values;
    
    // Breakout signals
    if (currentPrice > upperChannel) {
      return 'BUY'; // Bullish breakout above upper channel
    } else if (currentPrice < lowerChannel) {
      return 'SELL'; // Bearish breakout below lower channel
    }

    // Trend continuation signals
    const closingPrices = this.getClosingPrices(3);
    if (closingPrices.length >= 3) {
      const priceChange = currentPrice - closingPrices[closingPrices.length - 2];
      
      // Strong move towards channel boundaries
      if (currentPrice > middleLine && priceChange > 0) {
        const channelPosition = (currentPrice - middleLine) / (upperChannel - middleLine);
        if (channelPosition > 0.7) {
          return 'BUY'; // Strong upward momentum
        }
      } else if (currentPrice < middleLine && priceChange < 0) {
        const channelPosition = (middleLine - currentPrice) / (middleLine - lowerChannel);
        if (channelPosition > 0.7) {
          return 'SELL'; // Strong downward momentum
        }
      }
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [currentPrice, upperChannel, lowerChannel, atrValue] = values;
    
    // Strength based on position within channels and volatility
    const channelWidth = upperChannel - lowerChannel;
    const middleChannel = (upperChannel + lowerChannel) / 2;
    
    // Distance from center as percentage of channel width
    const distanceFromCenter = Math.abs(currentPrice - middleChannel);
    const positionStrength = (distanceFromCenter / (channelWidth / 2)) * 100;
    
    // Volatility component - higher ATR can indicate stronger signals
    const volatilityStrength = Math.min(50, (atrValue / currentPrice) * 2500);
    
    return Math.min(100, positionStrength + volatilityStrength);
  }

  public reset(): void {
    super.reset();
    this.atr.reset();
  }
}