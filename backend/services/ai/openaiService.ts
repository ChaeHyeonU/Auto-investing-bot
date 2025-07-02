import OpenAI from 'openai';
import config from '../../config/config';
import logger from '../../utils/logger';
import { 
  AIAnalysisRequest, 
  AIAnalysis, 
  TechnicalIndicator, 
  MarketData, 
  CandlestickData 
} from '@/types';

/**
 * OpenAI Service for AI-Powered Trading Analysis
 * 
 * Why AI for Trading Analysis?
 * - Processes complex multi-indicator relationships that humans struggle with
 * - Identifies subtle patterns in large datasets
 * - Provides natural language reasoning for trading decisions
 * - Adapts to changing market conditions through continuous learning
 * - Combines quantitative analysis with qualitative market sentiment
 * - Reduces emotional bias in trading decisions
 */
export class OpenAIService {
  private openai: OpenAI;
  private readonly maxTokens: number = 2000;
  private readonly temperature: number = 0.3; // Lower temperature for more consistent analysis

  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });

    logger.info('OpenAI service initialized', {
      model: config.openai.model,
      service: 'OpenAIService'
    });
  }

  /**
   * Analyze market data and indicators to generate trading recommendations
   */
  public async analyzeMarketData(request: AIAnalysisRequest): Promise<AIAnalysis> {
    try {
      logger.debug('Starting AI market analysis', {
        symbol: request.symbol,
        timeframe: request.timeframe,
        indicatorCount: request.indicators.length,
        service: 'OpenAIService'
      });

      const prompt = this.buildAnalysisPrompt(request);
      
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const analysis = this.parseAIResponse(response, request);
      
      logger.info('AI market analysis completed', {
        symbol: request.symbol,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        riskLevel: analysis.riskLevel,
        service: 'OpenAIService'
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze market data with AI', {
        error,
        symbol: request.symbol,
        service: 'OpenAIService'
      });
      throw error;
    }
  }

  /**
   * Generate system prompt for trading analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert cryptocurrency trading analyst with deep knowledge of technical analysis, market psychology, and risk management. Your role is to analyze market data and provide actionable trading recommendations.

ANALYSIS FRAMEWORK:
1. Technical Analysis: Interpret indicator signals in context of market conditions
2. Risk Assessment: Evaluate potential risks and appropriate position sizing
3. Market Psychology: Consider sentiment and behavioral factors
4. Confluence Analysis: Look for multiple confirming signals
5. Risk-Reward Evaluation: Assess potential profit vs. loss scenarios

RESPONSE FORMAT:
Your response must be a valid JSON object with the following structure:
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": 0-100,
  "reasoning": "Detailed explanation of your analysis",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "targetPrice": number | null,
  "stopLoss": number | null,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "indicatorAnalysis": [
    {
      "name": "indicator_name",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "strength": 0-100,
      "interpretation": "Brief explanation"
    }
  ]
}

TRADING PRINCIPLES:
- Risk management is paramount - never recommend risking more than 2% per trade
- Multiple indicator confluence increases signal reliability
- Market context is crucial - trending vs. ranging markets require different approaches
- Volume confirmation strengthens price-based signals
- Consider broader market conditions and news events
- Be honest about uncertainty - markets are inherently unpredictable
- Focus on high-probability setups with favorable risk-reward ratios

Remember: You're providing analysis to help make informed decisions, not guaranteed predictions. Always emphasize proper risk management.`;
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(request: AIAnalysisRequest): string {
    const { symbol, timeframe, marketData, indicators, context } = request;
    
    const recentCandles = marketData.candlesticks.slice(-10); // Last 10 candles
    const currentPrice = recentCandles[recentCandles.length - 1]?.close || 0;
    
    const prompt = `
MARKET ANALYSIS REQUEST for ${symbol} (${timeframe} timeframe)

CURRENT MARKET DATA:
- Current Price: $${currentPrice}
- Recent Price Action: ${this.describePriceAction(recentCandles)}
- Volume Trend: ${this.describeVolumeTrend(recentCandles)}

TECHNICAL INDICATORS ANALYSIS:
${this.formatIndicatorsForPrompt(indicators)}

MARKET CONTEXT:
${context || 'Standard market conditions'}

SPECIFIC ANALYSIS REQUIREMENTS:
1. Evaluate the confluence of technical indicators
2. Assess the strength and reliability of current signals
3. Consider the risk-reward ratio for potential trades
4. Provide specific entry, target, and stop-loss levels if recommending a trade
5. Explain your reasoning in detail, considering both bullish and bearish scenarios
6. Rate your confidence level and explain factors that could invalidate your analysis

Please provide a comprehensive analysis following the specified JSON format.`;

    return prompt;
  }

  /**
   * Parse AI response and create structured analysis
   */
  private parseAIResponse(response: string, request: AIAnalysisRequest): AIAnalysis {
    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields and provide defaults
      const analysis: AIAnalysis = {
        id: `ai_analysis_${Date.now()}`,
        symbol: request.symbol,
        recommendation: parsed.recommendation || 'HOLD',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'AI analysis completed',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        targetPrice: parsed.targetPrice || null,
        stopLoss: parsed.stopLoss || null,
        riskLevel: parsed.riskLevel || 'MEDIUM',
        timeframe: request.timeframe,
        indicators: this.parseIndicatorAnalysis(parsed.indicatorAnalysis || []),
        marketSentiment: parsed.marketSentiment || 'NEUTRAL',
        timestamp: new Date()
      };

      // Validate recommendation values
      const validRecommendations = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
      if (!validRecommendations.includes(analysis.recommendation)) {
        analysis.recommendation = 'HOLD';
      }

      // Validate risk level
      const validRiskLevels = ['LOW', 'MEDIUM', 'HIGH'];
      if (!validRiskLevels.includes(analysis.riskLevel)) {
        analysis.riskLevel = 'MEDIUM';
      }

      return analysis;
    } catch (error) {
      logger.error('Failed to parse AI response', { error, response, service: 'OpenAIService' });
      
      // Return fallback analysis
      return {
        id: `ai_analysis_fallback_${Date.now()}`,
        symbol: request.symbol,
        recommendation: 'HOLD',
        confidence: 0,
        reasoning: 'AI analysis failed to parse response. Manual review required.',
        keyPoints: ['AI response parsing failed'],
        riskLevel: 'HIGH',
        timeframe: request.timeframe,
        indicators: [],
        marketSentiment: 'NEUTRAL',
        timestamp: new Date()
      };
    }
  }

  /**
   * Parse indicator analysis from AI response
   */
  private parseIndicatorAnalysis(indicatorData: any[]): Array<{
    name: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    strength: number;
    interpretation: string;
  }> {
    return indicatorData.map(indicator => ({
      name: indicator.name || 'Unknown',
      signal: ['BUY', 'SELL', 'NEUTRAL'].includes(indicator.signal) ? indicator.signal : 'NEUTRAL',
      strength: Math.min(100, Math.max(0, indicator.strength || 0)),
      interpretation: indicator.interpretation || 'No interpretation provided'
    }));
  }

  /**
   * Describe recent price action for AI context
   */
  private describePriceAction(candles: CandlestickData[]): string {
    if (candles.length < 2) return 'Insufficient data';

    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    const priceChange = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
    
    const trend = priceChange > 2 ? 'Strong uptrend' :
                  priceChange > 0.5 ? 'Uptrend' :
                  priceChange < -2 ? 'Strong downtrend' :
                  priceChange < -0.5 ? 'Downtrend' : 'Sideways';

    const volatility = this.calculateVolatility(candles);
    const volDescription = volatility > 5 ? 'High volatility' :
                          volatility > 2 ? 'Moderate volatility' : 'Low volatility';

    return `${trend} with ${volDescription} (${priceChange.toFixed(2)}% change over ${candles.length} periods)`;
  }

  /**
   * Describe volume trend for AI context
   */
  private describeVolumeTrend(candles: CandlestickData[]): string {
    if (candles.length < 3) return 'Insufficient data';

    const recentVolume = candles.slice(-3).reduce((sum, c) => sum + c.volume, 0) / 3;
    const earlierVolume = candles.slice(0, -3).reduce((sum, c) => sum + c.volume, 0) / (candles.length - 3);
    
    const volumeChange = ((recentVolume - earlierVolume) / earlierVolume) * 100;
    
    if (volumeChange > 20) return 'Increasing volume (bullish)';
    if (volumeChange < -20) return 'Decreasing volume (bearish)';
    return 'Stable volume';
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(candles: CandlestickData[]): number {
    if (candles.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const ret = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
      returns.push(ret);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Convert to percentage
  }

  /**
   * Format indicators for AI prompt
   */
  private formatIndicatorsForPrompt(indicators: TechnicalIndicator[]): string {
    if (indicators.length === 0) return 'No indicators provided';

    return indicators.map(indicator => {
      const value = Array.isArray(indicator.value) 
        ? indicator.value.map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')
        : typeof indicator.value === 'number' 
          ? indicator.value.toFixed(4)
          : indicator.value;

      return `- ${indicator.name}: ${value} (Signal: ${indicator.signal}, Strength: ${indicator.strength}%)`;
    }).join('\n');
  }

  /**
   * Analyze multiple timeframes for confluence
   */
  public async analyzeMultiTimeframe(
    symbol: string,
    timeframes: string[],
    marketDataByTimeframe: Map<string, MarketData>
  ): Promise<{
    overallRecommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number;
    timeframeAnalyses: Map<string, AIAnalysis>;
    confluenceScore: number;
  }> {
    const analyses = new Map<string, AIAnalysis>();
    
    // Analyze each timeframe
    for (const timeframe of timeframes) {
      const marketData = marketDataByTimeframe.get(timeframe);
      if (!marketData) continue;

      const request: AIAnalysisRequest = {
        symbol,
        timeframe,
        marketData,
        indicators: marketData.indicators,
        context: `Multi-timeframe analysis for ${timeframe} timeframe`
      };

      try {
        const analysis = await this.analyzeMarketData(request);
        analyses.set(timeframe, analysis);
      } catch (error) {
        logger.error(`Failed to analyze ${timeframe} timeframe`, { error, service: 'OpenAIService' });
      }
    }

    // Calculate confluence and overall recommendation
    const { overallRecommendation, confidence, confluenceScore } = this.calculateConfluence(analyses);

    return {
      overallRecommendation,
      confidence,
      timeframeAnalyses: analyses,
      confluenceScore
    };
  }

  /**
   * Calculate confluence across multiple timeframe analyses
   */
  private calculateConfluence(analyses: Map<string, AIAnalysis>): {
    overallRecommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number;
    confluenceScore: number;
  } {
    const analysisArray = Array.from(analyses.values());
    if (analysisArray.length === 0) {
      return { overallRecommendation: 'HOLD', confidence: 0, confluenceScore: 0 };
    }

    // Weight timeframes (longer timeframes get higher weights)
    const timeframeWeights: { [key: string]: number } = {
      '1m': 0.1, '5m': 0.15, '15m': 0.2, '1h': 0.3, '4h': 0.5, '1d': 1.0
    };

    let totalBuyScore = 0;
    let totalSellScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    analysisArray.forEach(analysis => {
      const weight = timeframeWeights[analysis.timeframe] || 0.5;
      const confidenceWeight = analysis.confidence / 100;
      const effectiveWeight = weight * confidenceWeight;

      totalWeight += effectiveWeight;
      totalConfidence += analysis.confidence * effectiveWeight;

      switch (analysis.recommendation) {
        case 'STRONG_BUY':
          totalBuyScore += 2 * effectiveWeight;
          break;
        case 'BUY':
          totalBuyScore += 1 * effectiveWeight;
          break;
        case 'SELL':
          totalSellScore += 1 * effectiveWeight;
          break;
        case 'STRONG_SELL':
          totalSellScore += 2 * effectiveWeight;
          break;
      }
    });

    if (totalWeight === 0) {
      return { overallRecommendation: 'HOLD', confidence: 0, confluenceScore: 0 };
    }

    const avgConfidence = totalConfidence / totalWeight;
    const netScore = (totalBuyScore - totalSellScore) / totalWeight;
    const confluenceScore = Math.min(100, Math.abs(netScore) * 50); // 0-100 scale

    let overallRecommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    if (netScore > 1.5) overallRecommendation = 'STRONG_BUY';
    else if (netScore > 0.5) overallRecommendation = 'BUY';
    else if (netScore < -1.5) overallRecommendation = 'STRONG_SELL';
    else if (netScore < -0.5) overallRecommendation = 'SELL';
    else overallRecommendation = 'HOLD';

    return {
      overallRecommendation,
      confidence: Math.round(avgConfidence),
      confluenceScore: Math.round(confluenceScore)
    };
  }

  /**
   * Get AI reasoning for a specific trading decision
   */
  public async explainTradingDecision(
    symbol: string,
    action: 'BUY' | 'SELL',
    analysis: AIAnalysis,
    marketContext: string
  ): Promise<string> {
    try {
      const prompt = `
Please provide a detailed explanation for the following trading decision:

TRADE DETAILS:
- Symbol: ${symbol}
- Action: ${action}
- AI Recommendation: ${analysis.recommendation}
- Confidence: ${analysis.confidence}%
- Risk Level: ${analysis.riskLevel}

MARKET CONTEXT:
${marketContext}

AI REASONING:
${analysis.reasoning}

KEY POINTS:
${analysis.keyPoints.join('\n')}

Please explain:
1. Why this trade makes sense from a technical analysis perspective
2. What specific indicators support this decision
3. What risks should be considered
4. How this fits into overall portfolio strategy
5. What market conditions could invalidate this analysis

Keep the explanation clear and educational, suitable for both novice and experienced traders.`;

      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are an experienced trading educator. Explain trading decisions clearly and comprehensively, focusing on education and risk awareness.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.4
      });

      return completion.choices[0]?.message?.content || 'Unable to generate explanation';
    } catch (error) {
      logger.error('Failed to explain trading decision', { error, service: 'OpenAIService' });
      return 'Unable to generate explanation due to AI service error';
    }
  }
}