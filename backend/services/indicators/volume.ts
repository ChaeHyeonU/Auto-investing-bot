import { BaseIndicator } from './baseIndicator';
import { TechnicalIndicator } from '@/types';

/**
 * Volume Weighted Average Price (VWAP)
 * 
 * Why VWAP?
 * - Shows the average price weighted by volume - institutional benchmark
 * - Identifies fair value and institutional support/resistance levels
 * - Heavily used by large traders and algorithms for execution
 * - Provides context for whether current price is above/below institutional average
 * - Excellent for intraday trading and large position entries/exits
 * 
 * Formula: VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * Where Typical Price = (High + Low + Close) / 3
 * 
 * Best Use Cases:
 * - Institutional trading reference point
 * - Fair value identification
 * - Large order execution benchmark
 * - Intraday mean reversion strategies
 */
export class VolumeWeightedAveragePrice extends BaseIndicator {
  private cumulativePriceVolume: number = 0;
  private cumulativeVolume: number = 0;
  private sessionStart: Date | null = null;

  constructor(resetDaily: boolean = true) {
    super('VWAP', 1); // VWAP doesn't use traditional period
    // Note: In a real implementation, you'd want to reset VWAP at session start
  }

  public calculate(): TechnicalIndicator | null {
    if (this.data.length === 0) {
      return null;
    }

    // Calculate VWAP for all available data
    this.recalculateVWAP();

    if (this.cumulativeVolume === 0) {
      return null;
    }

    const vwapValue = this.cumulativePriceVolume / this.cumulativeVolume;
    const currentPrice = this.data[this.data.length - 1].close;

    const signal = this.generateSignal(currentPrice, vwapValue);
    const strength = this.calculateStrength([currentPrice, vwapValue]);

    return {
      name: this.name,
      value: vwapValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        cumulativeVolume: this.cumulativeVolume,
        priceDeviation: ((currentPrice - vwapValue) / vwapValue) * 100
      }
    };
  }

  private recalculateVWAP(): void {
    this.cumulativePriceVolume = 0;
    this.cumulativeVolume = 0;

    for (const candle of this.data) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      this.cumulativePriceVolume += typicalPrice * candle.volume;
      this.cumulativeVolume += candle.volume;
    }
  }

  protected generateSignal(currentPrice: number, vwapValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    const deviation = (currentPrice - vwapValue) / vwapValue;
    
    // Check volume trend for confirmation
    const volumes = this.getVolumes(3);
    const avgVolume = volumes.length > 0 ? volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length : 0;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    // Signals based on price deviation from VWAP with volume confirmation
    if (deviation < -0.005 && volumeRatio > 1.2) { // Price > 0.5% below VWAP with high volume
      return 'BUY'; // Potential value buying opportunity
    } else if (deviation > 0.005 && volumeRatio > 1.2) { // Price > 0.5% above VWAP with high volume
      return 'SELL'; // Potential overvalued selling opportunity
    }

    // Trend continuation signals
    if (Math.abs(deviation) > 0.02) { // Significant deviation (>2%)
      if (deviation > 0 && volumeRatio > 1) {
        return 'BUY'; // Strong upward momentum above VWAP
      } else if (deviation < 0 && volumeRatio > 1) {
        return 'SELL'; // Strong downward momentum below VWAP
      }
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [currentPrice, vwapValue] = values;
    const deviation = Math.abs(currentPrice - vwapValue) / vwapValue;
    
    // Consider volume relative to average
    const volumes = this.getVolumes(10);
    const avgVolume = volumes.length > 0 ? volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length : 0;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeStrength = avgVolume > 0 ? Math.min(2, currentVolume / avgVolume) : 1;
    
    // Combine price deviation and volume strength
    const deviationStrength = Math.min(100, deviation * 5000); // Scale deviation
    return Math.min(100, deviationStrength * volumeStrength);
  }

  public reset(): void {
    super.reset();
    this.cumulativePriceVolume = 0;
    this.cumulativeVolume = 0;
    this.sessionStart = null;
  }
}

/**
 * On Balance Volume (OBV)
 * 
 * Why OBV?
 * - Measures buying and selling pressure by tracking volume flow
 * - Leading indicator that often changes before price
 * - Confirms price trends and identifies potential reversals
 * - Simple but effective way to incorporate volume into analysis
 * - Excellent for divergence analysis
 * 
 * Formula: 
 * - If Close > Previous Close: OBV = Previous OBV + Volume
 * - If Close < Previous Close: OBV = Previous OBV - Volume
 * - If Close = Previous Close: OBV = Previous OBV
 * 
 * Best Use Cases:
 * - Trend confirmation with price action
 * - Early reversal signal identification
 * - Divergence analysis (price vs OBV)
 * - Volume-based momentum analysis
 */
export class OnBalanceVolume extends BaseIndicator {
  private obvValue: number = 0;
  private previousClose: number | null = null;

  constructor() {
    super('OBV', 1); // OBV doesn't use traditional period
  }

  public calculate(): TechnicalIndicator | null {
    if (this.data.length === 0) {
      return null;
    }

    const currentCandle = this.data[this.data.length - 1];
    
    if (this.previousClose !== null) {
      if (currentCandle.close > this.previousClose) {
        this.obvValue += currentCandle.volume;
      } else if (currentCandle.close < this.previousClose) {
        this.obvValue -= currentCandle.volume;
      }
      // If close equals previous close, OBV remains unchanged
    } else {
      // Initialize OBV with first volume
      this.obvValue = currentCandle.volume;
    }

    this.previousClose = currentCandle.close;

    const signal = this.generateSignal(this.obvValue);
    const strength = this.calculateStrength(this.obvValue);

    return {
      name: this.name,
      value: this.obvValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        volume: currentCandle.volume,
        priceChange: this.previousClose ? 
          ((currentCandle.close - this.previousClose) / this.previousClose) * 100 : 0
      }
    };
  }

  protected generateSignal(obvValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    // OBV signals are typically based on trend and divergences
    if (this.data.length < 10) {
      return 'NEUTRAL'; // Need enough data for trend analysis
    }

    // Calculate OBV trend over recent periods
    const obvHistory = this.getOBVHistory(5);
    if (obvHistory.length < 5) {
      return 'NEUTRAL';
    }

    // Simple trend analysis of OBV
    const recentOBVTrend = this.calculateTrend(obvHistory);
    const priceHistory = this.getClosingPrices(5);
    const recentPriceTrend = this.calculateTrend(priceHistory);

    // OBV and price trending in same direction (confirmation)
    if (recentOBVTrend > 0.02 && recentPriceTrend > 0.01) {
      return 'BUY'; // Both OBV and price trending up
    } else if (recentOBVTrend < -0.02 && recentPriceTrend < -0.01) {
      return 'SELL'; // Both OBV and price trending down
    }

    // Divergence signals (OBV trending opposite to price)
    if (recentOBVTrend > 0.02 && recentPriceTrend < -0.005) {
      return 'BUY'; // Bullish divergence: OBV up, price down
    } else if (recentOBVTrend < -0.02 && recentPriceTrend > 0.005) {
      return 'SELL'; // Bearish divergence: OBV down, price up
    }

    return 'NEUTRAL';
  }

  private getOBVHistory(periods: number): number[] {
    // This is a simplified implementation
    // In practice, you'd store OBV history
    const history: number[] = [];
    let tempOBV = 0;
    let tempPrevClose: number | null = null;

    const dataToUse = this.data.slice(-periods);
    for (const candle of dataToUse) {
      if (tempPrevClose !== null) {
        if (candle.close > tempPrevClose) {
          tempOBV += candle.volume;
        } else if (candle.close < tempPrevClose) {
          tempOBV -= candle.volume;
        }
      } else {
        tempOBV = candle.volume;
      }
      history.push(tempOBV);
      tempPrevClose = candle.close;
    }

    return history;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (first === 0) return 0;
    return (last - first) / Math.abs(first);
  }

  protected calculateStrength(obvValue: number): number {
    if (this.data.length < 5) return 0;

    // Strength based on OBV trend consistency and magnitude
    const obvHistory = this.getOBVHistory(5);
    const trend = this.calculateTrend(obvHistory);
    
    // Volume strength compared to recent average
    const volumes = this.getVolumes(10);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeStrength = avgVolume > 0 ? Math.min(2, currentVolume / avgVolume) : 1;
    
    // Combine trend strength and volume strength
    const trendStrength = Math.min(100, Math.abs(trend) * 100);
    return Math.min(100, trendStrength * volumeStrength);
  }

  public reset(): void {
    super.reset();
    this.obvValue = 0;
    this.previousClose = null;
  }
}

/**
 * Money Flow Index (MFI)
 * 
 * Why MFI?
 * - RSI with volume consideration - shows money flow into/out of asset
 * - More reliable than RSI in identifying overbought/oversold conditions
 * - Combines price and volume for better signal quality
 * - Excellent for confirming price movements with volume backing
 * - Less prone to false signals than pure price-based indicators
 * 
 * Formula: MFI = 100 - (100 / (1 + Money Flow Ratio))
 * Money Flow Ratio = Positive Money Flow / Negative Money Flow
 * Money Flow = Typical Price × Volume
 * 
 * Best Use Cases:
 * - Volume-confirmed overbought/oversold signals
 * - Divergence analysis with volume backing
 * - Confirmation of breakouts and reversals
 * - High-volume trading environments
 */
export class MoneyFlowIndex extends BaseIndicator {
  constructor(period: number = 14) {
    super(`MFI_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (this.data.length < 2) { // Need at least 2 candles for money flow calculation
      return null;
    }

    const moneyFlows = this.calculateMoneyFlows();
    
    if (moneyFlows.length < this.period) {
      return null;
    }

    const recentMoneyFlows = moneyFlows.slice(-this.period);
    let positiveMoneyFlow = 0;
    let negativeMoneyFlow = 0;

    for (const mf of recentMoneyFlows) {
      if (mf > 0) {
        positiveMoneyFlow += mf;
      } else {
        negativeMoneyFlow += Math.abs(mf);
      }
    }

    if (negativeMoneyFlow === 0) {
      const mfiValue = 100;
      return this.createMFIResult(mfiValue);
    }

    const moneyFlowRatio = positiveMoneyFlow / negativeMoneyFlow;
    const mfiValue = 100 - (100 / (1 + moneyFlowRatio));

    return this.createMFIResult(mfiValue);
  }

  private calculateMoneyFlows(): number[] {
    const moneyFlows: number[] = [];
    
    for (let i = 1; i < this.data.length; i++) {
      const current = this.data[i];
      const previous = this.data[i - 1];
      
      const currentTypicalPrice = (current.high + current.low + current.close) / 3;
      const previousTypicalPrice = (previous.high + previous.low + previous.close) / 3;
      
      const rawMoneyFlow = currentTypicalPrice * current.volume;
      
      // Positive money flow if typical price increased, negative if decreased
      if (currentTypicalPrice > previousTypicalPrice) {
        moneyFlows.push(rawMoneyFlow);
      } else if (currentTypicalPrice < previousTypicalPrice) {
        moneyFlows.push(-rawMoneyFlow);
      } else {
        moneyFlows.push(0); // No change in typical price
      }
    }
    
    return moneyFlows;
  }

  private createMFIResult(mfiValue: number): TechnicalIndicator {
    const signal = this.generateSignal(mfiValue);
    const strength = this.calculateStrength(mfiValue);

    return {
      name: this.name,
      value: mfiValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        overbought: 80,
        oversold: 20
      }
    };
  }

  protected generateSignal(mfiValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    // Volume-confirmed overbought/oversold signals
    if (mfiValue < 20) {
      return 'BUY'; // Oversold with volume confirmation
    } else if (mfiValue > 80) {
      return 'SELL'; // Overbought with volume confirmation
    }

    // Secondary signals in extreme zones
    if (mfiValue < 30) {
      return 'BUY'; // Strong oversold signal
    } else if (mfiValue > 70) {
      return 'SELL'; // Strong overbought signal
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(mfiValue: number): number {
    // Strength increases at extreme levels, similar to RSI
    if (mfiValue <= 20) {
      return 100 - (mfiValue / 20) * 30; // 70-100 strength when oversold
    } else if (mfiValue >= 80) {
      return 70 + ((mfiValue - 80) / 20) * 30; // 70-100 strength when overbought
    }
    
    // Consider current volume vs average for additional strength
    const volumes = this.getVolumes(5);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeBoost = avgVolume > 0 ? Math.min(1.5, currentVolume / avgVolume) : 1;
    
    // Neutral zone - lower base strength but volume can boost it
    const distanceFromMiddle = Math.abs(mfiValue - 50);
    const baseStrength = Math.max(0, 50 - distanceFromMiddle);
    
    return Math.min(100, baseStrength * volumeBoost);
  }
}

/**
 * Accumulation/Distribution Line (A/D)
 * 
 * Why A/D Line?
 * - Shows the relationship between price and volume flow
 * - Identifies accumulation (buying pressure) vs distribution (selling pressure)
 * - Leading indicator that can predict price movements
 * - Excellent for confirming trends and spotting divergences
 * - Widely used by institutional traders
 * 
 * Formula: A/D = Previous A/D + Current Period's Money Flow Volume
 * Money Flow Volume = ((Close - Low) - (High - Close)) / (High - Low) × Volume
 * 
 * Best Use Cases:
 * - Trend confirmation and divergence analysis
 * - Accumulation/distribution phase identification
 * - Volume-price relationship analysis
 * - Long-term trend analysis
 */
export class AccumulationDistributionLine extends BaseIndicator {
  private adValue: number = 0;

  constructor() {
    super('AD_LINE', 1); // A/D Line doesn't use traditional period
  }

  public calculate(): TechnicalIndicator | null {
    if (this.data.length === 0) {
      return null;
    }

    const currentCandle = this.data[this.data.length - 1];
    
    // Calculate Money Flow Volume
    const high = currentCandle.high;
    const low = currentCandle.low;
    const close = currentCandle.close;
    const volume = currentCandle.volume;
    
    if (high === low) {
      // No price range, no money flow volume added
      return {
        name: this.name,
        value: this.adValue,
        signal: 'NEUTRAL',
        strength: 0,
        timestamp: new Date(),
        parameters: { volume, priceRange: 0 }
      };
    }

    const moneyFlowVolume = ((close - low) - (high - close)) / (high - low) * volume;
    this.adValue += moneyFlowVolume;

    const signal = this.generateSignal(this.adValue);
    const strength = this.calculateStrength(this.adValue);

    return {
      name: this.name,
      value: this.adValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        volume,
        moneyFlowVolume,
        priceRange: high - low
      }
    };
  }

  protected generateSignal(adValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (this.data.length < 10) {
      return 'NEUTRAL'; // Need enough data for trend analysis
    }

    // Calculate A/D Line trend
    const adHistory = this.getADHistory(5);
    if (adHistory.length < 5) {
      return 'NEUTRAL';
    }

    const adTrend = this.calculateTrend(adHistory);
    const priceHistory = this.getClosingPrices(5);
    const priceTrend = this.calculateTrend(priceHistory);

    // Trend confirmation signals
    if (adTrend > 0 && priceTrend > 0) {
      return 'BUY'; // Both A/D and price trending up (accumulation)
    } else if (adTrend < 0 && priceTrend < 0) {
      return 'SELL'; // Both A/D and price trending down (distribution)
    }

    // Divergence signals
    if (adTrend > 0 && priceTrend < 0) {
      return 'BUY'; // Bullish divergence: A/D up, price down
    } else if (adTrend < 0 && priceTrend > 0) {
      return 'SELL'; // Bearish divergence: A/D down, price up
    }

    return 'NEUTRAL';
  }

  private getADHistory(periods: number): number[] {
    // Simplified implementation - in practice, you'd store A/D history
    const history: number[] = [];
    let tempAD = 0;

    const dataToUse = this.data.slice(-periods);
    for (const candle of dataToUse) {
      if (candle.high !== candle.low) {
        const mfv = ((candle.close - candle.low) - (candle.high - candle.close)) / 
                    (candle.high - candle.low) * candle.volume;
        tempAD += mfv;
      }
      history.push(tempAD);
    }

    return history;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (first === 0) return last > 0 ? 1 : (last < 0 ? -1 : 0);
    return (last - first) / Math.abs(first);
  }

  protected calculateStrength(adValue: number): number {
    if (this.data.length < 5) return 0;

    // Strength based on A/D Line trend and volume
    const adHistory = this.getADHistory(5);
    const trend = Math.abs(this.calculateTrend(adHistory));
    
    // Volume component
    const volumes = this.getVolumes(5);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeStrength = avgVolume > 0 ? Math.min(2, currentVolume / avgVolume) : 1;
    
    // Combine trend consistency and volume strength
    const trendStrength = Math.min(100, trend * 100);
    return Math.min(100, trendStrength * volumeStrength);
  }

  public reset(): void {
    super.reset();
    this.adValue = 0;
  }
}