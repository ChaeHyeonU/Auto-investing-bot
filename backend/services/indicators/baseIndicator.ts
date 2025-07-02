import { CandlestickData, TechnicalIndicator } from '@/types';

/**
 * Base class for all technical indicators
 * Provides common functionality and ensures consistent interface
 */
export abstract class BaseIndicator {
  protected name: string;
  protected period: number;
  protected data: CandlestickData[] = [];
  
  constructor(name: string, period: number) {
    this.name = name;
    this.period = period;
  }

  /**
   * Add new candlestick data to the indicator
   * @param candle New candlestick data
   */
  public addData(candle: CandlestickData): void {
    this.data.push(candle);
    
    // Keep only necessary data points for efficiency
    // Most indicators need at most 200 periods for calculation
    if (this.data.length > Math.max(200, this.period * 2)) {
      this.data = this.data.slice(-Math.max(200, this.period * 2));
    }
  }

  /**
   * Update the last candlestick data (for real-time updates)
   * @param candle Updated candlestick data
   */
  public updateLastData(candle: CandlestickData): void {
    if (this.data.length > 0) {
      this.data[this.data.length - 1] = candle;
    } else {
      this.addData(candle);
    }
  }

  /**
   * Calculate the indicator value
   * Must be implemented by each specific indicator
   */
  public abstract calculate(): TechnicalIndicator | null;

  /**
   * Get the latest indicator value
   */
  public getLatest(): TechnicalIndicator | null {
    return this.calculate();
  }

  /**
   * Check if enough data is available for calculation
   */
  protected hasEnoughData(): boolean {
    return this.data.length >= this.period;
  }

  /**
   * Get closing prices for the specified number of periods
   * @param periods Number of periods to get (default: this.period)
   */
  protected getClosingPrices(periods?: number): number[] {
    const periodCount = periods || this.period;
    if (this.data.length < periodCount) {
      return this.data.map(d => d.close);
    }
    return this.data.slice(-periodCount).map(d => d.close);
  }

  /**
   * Get high prices for the specified number of periods
   * @param periods Number of periods to get (default: this.period)
   */
  protected getHighPrices(periods?: number): number[] {
    const periodCount = periods || this.period;
    if (this.data.length < periodCount) {
      return this.data.map(d => d.high);
    }
    return this.data.slice(-periodCount).map(d => d.high);
  }

  /**
   * Get low prices for the specified number of periods
   * @param periods Number of periods to get (default: this.period)
   */
  protected getLowPrices(periods?: number): number[] {
    const periodCount = periods || this.period;
    if (this.data.length < periodCount) {
      return this.data.map(d => d.low);
    }
    return this.data.slice(-periodCount).map(d => d.low);
  }

  /**
   * Get volumes for the specified number of periods
   * @param periods Number of periods to get (default: this.period)
   */
  protected getVolumes(periods?: number): number[] {
    const periodCount = periods || this.period;
    if (this.data.length < periodCount) {
      return this.data.map(d => d.volume);
    }
    return this.data.slice(-periodCount).map(d => d.volume);
  }

  /**
   * Get typical prices (HLC/3) for the specified number of periods
   * @param periods Number of periods to get (default: this.period)
   */
  protected getTypicalPrices(periods?: number): number[] {
    const periodCount = periods || this.period;
    const dataToUse = this.data.length < periodCount ? this.data : this.data.slice(-periodCount);
    return dataToUse.map(d => (d.high + d.low + d.close) / 3);
  }

  /**
   * Calculate Simple Moving Average
   * @param values Array of values
   * @param period Period for SMA
   */
  protected calculateSMA(values: number[], period: number): number {
    if (values.length < period) {
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average
   * @param values Array of values
   * @param period Period for EMA
   * @param previousEMA Previous EMA value (optional)
   */
  protected calculateEMA(values: number[], period: number, previousEMA?: number): number {
    if (values.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    
    if (previousEMA === undefined) {
      // If no previous EMA, start with SMA
      return this.calculateSMA(values, Math.min(period, values.length));
    }
    
    const latestValue = values[values.length - 1];
    return (latestValue * multiplier) + (previousEMA * (1 - multiplier));
  }

  /**
   * Calculate standard deviation
   * @param values Array of values
   * @param mean Mean value (optional, will be calculated if not provided)
   */
  protected calculateStandardDeviation(values: number[], mean?: number): number {
    if (values.length < 2) return 0;
    
    const avg = mean || (values.reduce((sum, val) => sum + val, 0) / values.length);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Generate trading signal based on indicator value
   * @param currentValue Current indicator value
   * @param previousValue Previous indicator value (optional)
   */
  protected generateSignal(currentValue: number | number[], previousValue?: number | number[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    // Default implementation - should be overridden by specific indicators
    return 'NEUTRAL';
  }

  /**
   * Calculate signal strength (0-100)
   * @param value Current indicator value
   */
  protected calculateStrength(value: number | number[]): number {
    // Default implementation - should be overridden by specific indicators
    return 50;
  }

  /**
   * Reset the indicator (clear all data)
   */
  public reset(): void {
    this.data = [];
  }

  /**
   * Get indicator name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get indicator period
   */
  public getPeriod(): number {
    return this.period;
  }
}