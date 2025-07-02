import { BaseIndicator } from './baseIndicator';
import { TechnicalIndicator } from '@/types';

/**
 * Relative Strength Index (RSI)
 * 
 * Why RSI?
 * - Measures momentum on a 0-100 scale
 * - Identifies overbought (>70) and oversold (<30) conditions
 * - Shows momentum divergences before price reversals
 * - Works well in ranging markets for mean reversion
 * 
 * Formula: RSI = 100 - (100 / (1 + RS))
 * Where RS = Average Gain / Average Loss over period
 * 
 * Best Use Cases:
 * - Mean reversion strategies in ranging markets
 * - Divergence analysis for trend reversals
 * - Overbought/oversold identification
 * - Momentum confirmation
 */
export class RelativeStrengthIndex extends BaseIndicator {
  private previousClose: number | null = null;
  private avgGain: number = 0;
  private avgLoss: number = 0;
  private isInitialized: boolean = false;

  constructor(period: number = 14) {
    super(`RSI_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const closingPrices = this.getClosingPrices();
    const currentClose = closingPrices[closingPrices.length - 1];

    if (!this.isInitialized) {
      this.initializeRSI(closingPrices);
      this.isInitialized = true;
    }

    if (this.previousClose !== null) {
      const change = currentClose - this.previousClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Use Wilder's smoothing method
      this.avgGain = ((this.avgGain * (this.period - 1)) + gain) / this.period;
      this.avgLoss = ((this.avgLoss * (this.period - 1)) + loss) / this.period;
    }

    this.previousClose = currentClose;

    if (this.avgLoss === 0) {
      const rsiValue = 100;
      return this.createRSIResult(rsiValue);
    }

    const rs = this.avgGain / this.avgLoss;
    const rsiValue = 100 - (100 / (1 + rs));

    return this.createRSIResult(rsiValue);
  }

  private initializeRSI(prices: number[]): void {
    let totalGain = 0;
    let totalLoss = 0;

    for (let i = 1; i < Math.min(prices.length, this.period + 1); i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        totalGain += change;
      } else {
        totalLoss += Math.abs(change);
      }
    }

    this.avgGain = totalGain / this.period;
    this.avgLoss = totalLoss / this.period;
    this.previousClose = prices[prices.length - 1];
  }

  private createRSIResult(rsiValue: number): TechnicalIndicator {
    const signal = this.generateSignal(rsiValue);
    const strength = this.calculateStrength(rsiValue);

    return {
      name: this.name,
      value: rsiValue,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        overbought: 70,
        oversold: 30
      }
    };
  }

  protected generateSignal(rsiValue: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (rsiValue < 30) {
      return 'BUY'; // Oversold condition
    } else if (rsiValue > 70) {
      return 'SELL'; // Overbought condition
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(rsiValue: number): number {
    // Strength increases as RSI approaches extreme levels
    if (rsiValue <= 30) {
      return 100 - (rsiValue / 30) * 50; // 50-100 strength when oversold
    } else if (rsiValue >= 70) {
      return 50 + ((rsiValue - 70) / 30) * 50; // 50-100 strength when overbought
    }
    
    // Neutral zone - lower strength
    const distanceFromMiddle = Math.abs(rsiValue - 50);
    return Math.max(0, 50 - distanceFromMiddle);
  }

  public reset(): void {
    super.reset();
    this.previousClose = null;
    this.avgGain = 0;
    this.avgLoss = 0;
    this.isInitialized = false;
  }
}

/**
 * Stochastic Oscillator
 * 
 * Why Stochastic?
 * - Compares current closing price to price range over time
 * - More sensitive than RSI to recent price changes
 * - Excellent for timing entries in trending markets
 * - Shows momentum changes before price reversals
 * 
 * Formula: %K = ((Close - LowestLow) / (HighestHigh - LowestLow)) * 100
 * %D = SMA of %K over period
 * 
 * Best Use Cases:
 * - Entry timing in trending markets
 * - Divergence analysis
 * - Overbought/oversold in volatile markets
 * - Short-term momentum shifts
 */
export class StochasticOscillator extends BaseIndicator {
  private smoothK: number;
  private smoothD: number;
  private kValues: number[] = [];

  constructor(period: number = 14, smoothK: number = 3, smoothD: number = 3) {
    super(`STOCH_${period}_${smoothK}_${smoothD}`, period);
    this.smoothK = smoothK;
    this.smoothD = smoothD;
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const highs = this.getHighPrices();
    const lows = this.getLowPrices();
    const closes = this.getClosingPrices();

    const currentClose = closes[closes.length - 1];
    const lowestLow = Math.min(...lows);
    const highestHigh = Math.max(...highs);

    if (highestHigh === lowestLow) {
      return null; // Avoid division by zero
    }

    // Calculate raw %K
    const rawK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // Add to K values for smoothing
    this.kValues.push(rawK);
    if (this.kValues.length > Math.max(this.smoothK, this.smoothD) + 10) {
      this.kValues = this.kValues.slice(-Math.max(this.smoothK, this.smoothD) - 10);
    }

    // Calculate smoothed %K
    const smoothedK = this.calculateSMA(
      this.kValues.slice(-this.smoothK), 
      this.smoothK
    );

    // Calculate %D (SMA of smoothed %K)
    const kForD = this.kValues.slice(-this.smoothD);
    const smoothedD = this.calculateSMA(kForD, Math.min(this.smoothD, kForD.length));

    const signal = this.generateSignal([smoothedK, smoothedD]);
    const strength = this.calculateStrength([smoothedK, smoothedD]);

    return {
      name: this.name,
      value: [smoothedK, smoothedD],
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        smoothK: this.smoothK,
        smoothD: this.smoothD,
        overbought: 80,
        oversold: 20
      }
    };
  }

  protected generateSignal(values: number[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    const [kValue, dValue] = values;
    
    // Primary signals based on overbought/oversold levels
    if (kValue < 20 && dValue < 20) {
      return 'BUY'; // Both %K and %D in oversold territory
    } else if (kValue > 80 && dValue > 80) {
      return 'SELL'; // Both %K and %D in overbought territory
    }

    // Secondary signals based on %K and %D crossover
    if (this.kValues.length >= 2) {
      const prevK = this.kValues[this.kValues.length - 2];
      
      // Bullish crossover: %K crosses above %D in oversold area
      if (prevK <= dValue && kValue > dValue && kValue < 50) {
        return 'BUY';
      }
      
      // Bearish crossover: %K crosses below %D in overbought area
      if (prevK >= dValue && kValue < dValue && kValue > 50) {
        return 'SELL';
      }
    }

    return 'NEUTRAL';
  }

  protected calculateStrength(values: number[]): number {
    const [kValue, dValue] = values;
    
    // Strength increases at extreme levels
    const avgValue = (kValue + dValue) / 2;
    
    if (avgValue <= 20) {
      return 100 - (avgValue / 20) * 30; // 70-100 strength when oversold
    } else if (avgValue >= 80) {
      return 70 + ((avgValue - 80) / 20) * 30; // 70-100 strength when overbought
    }
    
    // Consider convergence/divergence between %K and %D
    const convergence = Math.abs(kValue - dValue);
    return Math.max(20, 60 - convergence); // 20-60 strength in neutral zone
  }

  public reset(): void {
    super.reset();
    this.kValues = [];
  }
}

/**
 * Williams %R
 * 
 * Why Williams %R?
 * - Similar to Stochastic but with inverted scale (-100 to 0)
 * - More sensitive and provides earlier signals
 * - Excellent for momentum-based strategies
 * - Shows market sentiment extremes
 * 
 * Formula: %R = (HighestHigh - Close) / (HighestHigh - LowestLow) * -100
 * 
 * Best Use Cases:
 * - Early momentum change detection
 * - Short-term overbought/oversold conditions
 * - Confirmation with other oscillators
 * - High-frequency trading signals
 */
export class WilliamsR extends BaseIndicator {
  constructor(period: number = 14) {
    super(`WILLIAMS_R_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const highs = this.getHighPrices();
    const lows = this.getLowPrices();
    const closes = this.getClosingPrices();

    const currentClose = closes[closes.length - 1];
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    if (highestHigh === lowestLow) {
      return null; // Avoid division by zero
    }

    const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;

    const signal = this.generateSignal(williamsR);
    const strength = this.calculateStrength(williamsR);

    return {
      name: this.name,
      value: williamsR,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        overbought: -20,
        oversold: -80
      }
    };
  }

  protected generateSignal(williamsR: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (williamsR < -80) {
      return 'BUY'; // Oversold condition
    } else if (williamsR > -20) {
      return 'SELL'; // Overbought condition
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(williamsR: number): number {
    // Strength increases as Williams %R approaches extreme levels
    if (williamsR <= -80) {
      return 100 + (williamsR + 80) * 2.5; // 50-100 strength when oversold
    } else if (williamsR >= -20) {
      return 50 + (20 + williamsR) * 2.5; // 50-100 strength when overbought
    }
    
    // Neutral zone - lower strength
    const distanceFromMiddle = Math.abs(williamsR + 50);
    return Math.max(0, 50 - distanceFromMiddle);
  }
}

/**
 * Commodity Channel Index (CCI)
 * 
 * Why CCI?
 * - Measures deviation from statistical mean
 * - Identifies cyclical trends and reversal points
 * - Works well in both trending and ranging markets
 * - Unbounded oscillator (can go beyond ±100)
 * 
 * Formula: CCI = (Typical Price - SMA) / (0.015 * Mean Deviation)
 * Where Typical Price = (High + Low + Close) / 3
 * 
 * Best Use Cases:
 * - Cycle analysis and timing
 * - Trend strength measurement
 * - Divergence identification
 * - Breakout confirmation
 */
export class CommodityChannelIndex extends BaseIndicator {
  constructor(period: number = 20) {
    super(`CCI_${period}`, period);
  }

  public calculate(): TechnicalIndicator | null {
    if (!this.hasEnoughData()) {
      return null;
    }

    const typicalPrices = this.getTypicalPrices();
    const sma = this.calculateSMA(typicalPrices, this.period);
    const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];

    // Calculate mean deviation
    const recentTypicalPrices = typicalPrices.slice(-this.period);
    const deviations = recentTypicalPrices.map(price => Math.abs(price - sma));
    const meanDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / this.period;

    if (meanDeviation === 0) {
      return null; // Avoid division by zero
    }

    const cci = (currentTypicalPrice - sma) / (0.015 * meanDeviation);

    const signal = this.generateSignal(cci);
    const strength = this.calculateStrength(cci);

    return {
      name: this.name,
      value: cci,
      signal,
      strength,
      timestamp: new Date(),
      parameters: { 
        period: this.period,
        overbought: 100,
        oversold: -100
      }
    };
  }

  protected generateSignal(cci: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (cci < -100) {
      return 'BUY'; // Oversold condition
    } else if (cci > 100) {
      return 'SELL'; // Overbought condition
    }
    return 'NEUTRAL';
  }

  protected calculateStrength(cci: number): number {
    // CCI can go beyond ±100, so we need to scale appropriately
    const absValue = Math.abs(cci);
    
    if (absValue >= 100) {
      return Math.min(100, 50 + (absValue - 100) / 4); // 50-100 strength beyond ±100
    }
    
    return Math.max(0, absValue / 2); // 0-50 strength within ±100
  }
}