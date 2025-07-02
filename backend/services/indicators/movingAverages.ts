import { BaseIndicator } from './baseIndicator';
import { TechnicalIndicator } from '@/types';

/**
 * Simple Moving Average (SMA)
 * 
 * Why SMA?
 * - Smooths out price action to identify trend direction
 * - Acts as dynamic support and resistance levels
 * - Foundation for many other indicators
 * - Easy to understand and widely used by traders
 * 
 * Best Use Cases:
 * - Long-term trend identification
 * - Support/resistance level identification
 * - Trend confirmation with other indicators
 */
export class SimpleMovingAverage extends BaseIndicator {
  constructor(period: number = 20) {
    super(`SMA_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const closingPrices = this.getClosingPrices();
    const smaValue = this.calculateSMA(closingPrices, this.period);
    
    // Generate signal based on price vs SMA
    const currentPrice = closingPrices[closingPrices.length - 1];
    const signal = this.generateSignal(currentPrice, smaValue);
    const strength = this.calculateStrength(currentPrice / smaValue);

    return {
      name: this.name,
      value: smaValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { period: this.period }
    };
  }

  protected generateSignal(currentPrice: number, smaValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    const priceDiff = (currentPrice - smaValue) / smaValue;
    
    if (priceDiff > 0.01) { // Price > 1% above SMA
      return 'BUY';
    } else if (priceDiff < -0.01) { // Price > 1% below SMA
      return 'SELL';
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(priceToSmaRatio: number): number {
    // Strength based on how far price is from SMA
    const deviation = Math.abs(priceToSmaRatio - 1);
    return Math.min(100, deviation * 1000); // Convert to 0-100 scale
  }
}

/**
 * Exponential Moving Average (EMA)
 * 
 * Why EMA?
 * - More responsive to recent price changes than SMA
 * - Reduces lag in trend identification
 * - Better for short-term trading strategies
 * - Gives more weight to recent data points
 * 
 * Best Use Cases:
 * - Short-term trend following
 * - Quick trend reversal detection
 * - Crossover strategies
 * - Dynamic stop-loss levels
 */
export class ExponentialMovingAverage extends BaseIndicator {
  private previousEMA: number | null = null;

  constructor(period: number = 12) {
    super(`EMA_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const closingPrices = this.getClosingPrices();
    const emaValue = this.calculateEMA(closingPrices, this.period, this.previousEMA || undefined);
    
    this.previousEMA = emaValue;

    // Generate signal based on price vs EMA and EMA slope
    const currentPrice = closingPrices[closingPrices.length - 1];
    const signal = this.generateSignal(currentPrice, emaValue);
    const strength = this.calculateStrength([currentPrice, emaValue]);

    return {
      name: this.name,
      value: emaValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { period: this.period }
    };
  }

  protected generateSignal(currentPrice: number, emaValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    const closingPrices = this.getClosingPrices(2);
    if (closingPrices.length < 2) return 'NEUTRAL';

    const priceDiff = (currentPrice - emaValue) / emaValue;
    const previousPrice = closingPrices[closingPrices.length - 2];
    const priceChange = (currentPrice - previousPrice) / previousPrice;

    // Consider both price vs EMA and price momentum
    if (priceDiff > 0.005 && priceChange > 0) { // Price above EMA and rising
      return 'BUY';
    } else if (priceDiff < -0.005 && priceChange < 0) { // Price below EMA and falling
      return 'SELL';
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [currentPrice, emaValue] = values;
    const deviation = Math.abs(currentPrice - emaValue) / emaValue;
    
    // Also consider EMA slope
    const closingPrices = this.getClosingPrices(3);
    if (closingPrices.length >= 3 && this.previousEMA) {
      const emaChange = (emaValue - this.previousEMA) / this.previousEMA;
      const slopeStrength = Math.abs(emaChange) * 1000;
      return Math.min(100, deviation * 500 + slopeStrength);
    }
    
    return Math.min(100, deviation * 500);
  }

  public reset(): void {
    super.reset();
    this.previousEMA = null;
  }
}

/**
 * Double Exponential Moving Average (DEMA)
 * 
 * Why DEMA?
 * - Even more responsive than EMA
 * - Reduces lag further by applying EMA twice
 * - Better for very short-term trading
 * - Smooths out whipsaws while maintaining responsiveness
 * 
 * Best Use Cases:
 * - Scalping strategies
 * - High-frequency trading
 * - Quick momentum changes
 */
export class DoubleExponentialMovingAverage extends BaseIndicator {
  private ema1: ExponentialMovingAverage;
  private ema2: ExponentialMovingAverage;

  constructor(period: number = 14) {
    super(`DEMA_${period}`, period);
    this.ema1 = new ExponentialMovingAverage(period);
    this.ema2 = new ExponentialMovingAverage(period);
  }

  public addData(candle: any): void {
    super.addData(candle);
    this.ema1.addData(candle);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const ema1Result = this.ema1.calculate();
    if (!ema1Result) return null;

    // Create synthetic data for second EMA
    const syntheticCandle = {
      ...this.data[this.data.length - 1],
      close: ema1Result.value as number
    };
    this.ema2.addData(syntheticCandle);

    const ema2Result = this.ema2.calculate();
    if (!ema2Result) return null;

    // DEMA = 2 * EMA1 - EMA2
    const demaValue = 2 * (ema1Result.value as number) - (ema2Result.value as number);
    
    const currentPrice = this.getClosingPrices(1)[0];
    const signal = this.generateSignal(currentPrice, demaValue);
    const strength = this.calculateStrength([currentPrice, demaValue]);

    return {
      name: this.name,
      value: demaValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { period: this.period }
    };
  }

  protected generateSignal(currentPrice: number, demaValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    const priceDiff = (currentPrice - demaValue) / demaValue;
    
    // More sensitive thresholds for DEMA
    if (priceDiff > 0.002) { // Price > 0.2% above DEMA
      return 'BUY';
    } else if (priceDiff < -0.002) { // Price > 0.2% below DEMA
      return 'SELL';
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [currentPrice, demaValue] = values;
    const deviation = Math.abs(currentPrice - demaValue) / demaValue;
    
    // Higher sensitivity for DEMA
    return Math.min(100, deviation * 1000);
  }

  public reset(): void {
    super.reset();
    this.ema1.reset();
    this.ema2.reset();
  }
}

/**
 * Moving Average Convergence Divergence (MACD)
 * 
 * Why MACD?
 * - Shows relationship between two moving averages
 * - Excellent for identifying trend changes and momentum
 * - Provides both trend direction and momentum strength
 * - Widely used and trusted by professional traders
 * 
 * Components:
 * - MACD Line: 12-period EMA - 26-period EMA
 * - Signal Line: 9-period EMA of MACD Line
 * - Histogram: MACD Line - Signal Line
 * 
 * Best Use Cases:
 * - Trend reversal identification
 * - Momentum confirmation
 * - Divergence analysis
 * - Entry/exit timing
 */
export class MACD extends BaseIndicator {
  private fastEMA: ExponentialMovingAverage;
  private slowEMA: ExponentialMovingAverage;
  private signalEMA: ExponentialMovingAverage;
  private macdHistory: number[] = [];

  constructor(fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    super(`MACD_${fastPeriod}_${slowPeriod}_${signalPeriod}`, slowPeriod);
    this.fastEMA = new ExponentialMovingAverage(fastPeriod);
    this.slowEMA = new ExponentialMovingAverage(slowPeriod);
    this.signalEMA = new ExponentialMovingAverage(signalPeriod);
  }

  public addData(candle: any): void {
    super.addData(candle);
    this.fastEMA.addData(candle);
    this.slowEMA.addData(candle);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const fastEMAResult = this.fastEMA.calculate();
    const slowEMAResult = this.slowEMA.calculate();
    
    if (!fastEMAResult || !slowEMAResult) return null;

    // Calculate MACD line
    const macdLine = (fastEMAResult.value as number) - (slowEMAResult.value as number);
    
    // Add MACD value to history for signal line calculation
    this.macdHistory.push(macdLine);
    if (this.macdHistory.length > 50) { // Keep last 50 values
      this.macdHistory = this.macdHistory.slice(-50);
    }

    // Create synthetic data for signal line EMA
    if (this.macdHistory.length > 0) {
      const syntheticCandle = {
        ...this.data[this.data.length - 1],
        close: macdLine
      };
      this.signalEMA.addData(syntheticCandle);
    }

    const signalEMAResult = this.signalEMA.calculate();
    if (!signalEMAResult) {
      return {
        name: this.name,
        value: [macdLine, 0, macdLine],
        signal: 'NEUTRAL',
        strength: 0,
        timestamp: new Date(),
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
      };
    }

    const signalLine = signalEMAResult.value as number;
    const histogram = macdLine - signalLine;

    const signal = this.generateSignal([macdLine, signalLine, histogram]);
    const strength = this.calculateStrength([macdLine, signalLine, histogram]);

    return {
      name: this.name,
      value: [macdLine, signalLine, histogram],
      signal,
      strength,
      timestamp: new Date(),
      parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    };
  }

  protected generateSignal(values: number[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    const [macdLine, signalLine, histogram] = values;
    
    // Check for bullish/bearish crossovers
    if (this.macdHistory.length >= 2) {
      const previousHistogram = this.macdHistory[this.macdHistory.length - 2] - signalLine;
      
      // Bullish crossover: MACD crosses above signal line
      if (previousHistogram <= 0 && histogram > 0) {
        return 'BUY';
      }
      
      // Bearish crossover: MACD crosses below signal line
      if (previousHistogram >= 0 && histogram < 0) {
        return 'SELL';
      }
    }

    // Secondary signals based on MACD position
    if (macdLine > signalLine && macdLine > 0) {
      return 'BUY';
    } else if (macdLine < signalLine && macdLine < 0) {
      return 'SELL';
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [macdLine, signalLine, histogram] = values;
    
    // Strength based on histogram magnitude and MACD line position
    const histogramStrength = Math.abs(histogram) * 10000; // Scale histogram
    const macdStrength = Math.abs(macdLine) * 10000; // Scale MACD line
    
    return Math.min(100, histogramStrength + macdStrength);
  }

  public reset(): void {
    super.reset();
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
    this.macdHistory = [];
  }
}