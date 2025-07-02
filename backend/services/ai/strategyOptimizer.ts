import { OpenAIService } from './openaiService';
import { IndicatorManager } from '../indicators/indicatorManager';
import { BacktestEngine } from '../backtest/backtestEngine';
import { PerformanceAnalyzer } from '../backtest/performanceAnalyzer';
import { StrategyFactory } from '../backtest/strategyFactory';
import { 
  TradingStrategy, 
  BacktestConfig, 
  BacktestResult, 
  CandlestickData, 
  AIAnalysis,
  IndicatorConfig
} from '@/types';
import logger from '../../utils/logger';

/**
 * AI-Powered Strategy Optimizer
 * 
 * Why AI for Strategy Optimization?
 * - Explores complex parameter combinations humans might miss
 * - Learns from market patterns and adapts strategies accordingly
 * - Balances multiple objectives (returns, risk, drawdown) simultaneously
 * - Provides natural language explanations for optimization decisions
 * - Prevents overfitting through intelligent parameter selection
 * - Adapts to changing market conditions automatically
 */
export class StrategyOptimizer {
  private openaiService: OpenAIService;
  private maxOptimizationIterations: number = 20;
  private convergenceThreshold: number = 0.01; // 1% improvement threshold

  constructor() {
    this.openaiService = new OpenAIService();
    
    logger.info('Strategy Optimizer initialized', {
      maxIterations: this.maxOptimizationIterations,
      service: 'StrategyOptimizer'
    });
  }

  /**
   * Optimize strategy parameters using AI-guided search
   */
  public async optimizeStrategy(
    baseStrategy: TradingStrategy,
    historicalData: CandlestickData[],
    optimizationConfig: OptimizationConfig
  ): Promise<OptimizationResult> {
    logger.info('Starting AI-powered strategy optimization', {
      strategy: baseStrategy.name,
      dataPoints: historicalData.length,
      target: optimizationConfig.objective,
      service: 'StrategyOptimizer'
    });

    const results: StrategyTestResult[] = [];
    let bestStrategy = baseStrategy;
    let bestScore = 0;
    let iteration = 0;

    try {
      // Initial baseline test
      const baselineResult = await this.testStrategy(baseStrategy, historicalData, optimizationConfig);
      results.push(baselineResult);
      bestScore = this.calculateObjectiveScore(baselineResult.backtestResult, optimizationConfig);
      
      logger.info('Baseline strategy performance', {
        score: bestScore,
        returns: baselineResult.backtestResult.totalReturnPercentage,
        maxDrawdown: baselineResult.backtestResult.maxDrawdownPercentage,
        service: 'StrategyOptimizer'
      });

      // AI-guided optimization loop
      while (iteration < this.maxOptimizationIterations) {
        iteration++;
        
        // Get AI suggestions for next optimization step
        const aiSuggestions = await this.getAIOptimizationSuggestions(
          baseStrategy,
          results,
          optimizationConfig
        );

        // Test AI-suggested parameter modifications
        const candidateStrategies = this.generateCandidateStrategies(
          bestStrategy,
          aiSuggestions
        );

        let iterationBestScore = bestScore;
        let iterationBestStrategy = bestStrategy;

        // Test all candidate strategies
        for (const candidate of candidateStrategies) {
          const testResult = await this.testStrategy(candidate, historicalData, optimizationConfig);
          results.push(testResult);

          const score = this.calculateObjectiveScore(testResult.backtestResult, optimizationConfig);
          
          if (score > iterationBestScore) {
            iterationBestScore = score;
            iterationBestStrategy = candidate;
          }
        }

        // Check for convergence
        const improvement = (iterationBestScore - bestScore) / bestScore;
        
        logger.debug('Optimization iteration completed', {
          iteration,
          bestScore: iterationBestScore,
          improvement: improvement * 100,
          candidatestested: candidateStrategies.length,
          service: 'StrategyOptimizer'
        });

        if (improvement < this.convergenceThreshold) {
          logger.info('Optimization converged', {
            iteration,
            finalImprovement: improvement * 100,
            service: 'StrategyOptimizer'
          });
          break;
        }

        bestScore = iterationBestScore;
        bestStrategy = iterationBestStrategy;
      }

      // Generate final analysis
      const optimizationAnalysis = await this.generateOptimizationAnalysis(
        baseStrategy,
        bestStrategy,
        results,
        optimizationConfig
      );

      const result: OptimizationResult = {
        originalStrategy: baseStrategy,
        optimizedStrategy: bestStrategy,
        improvementPercentage: ((bestScore - this.calculateObjectiveScore(results[0].backtestResult, optimizationConfig)) / 
                               this.calculateObjectiveScore(results[0].backtestResult, optimizationConfig)) * 100,
        iterationsTested: iteration,
        allResults: results,
        aiAnalysis: optimizationAnalysis,
        optimizationConfig,
        completedAt: new Date()
      };

      logger.info('Strategy optimization completed', {
        improvement: result.improvementPercentage,
        iterations: result.iterationsTested,
        finalScore: bestScore,
        service: 'StrategyOptimizer'
      });

      return result;
    } catch (error) {
      logger.error('Strategy optimization failed', {
        error,
        iteration,
        service: 'StrategyOptimizer'
      });
      throw error;
    }
  }

  /**
   * Get AI suggestions for strategy optimization
   */
  private async getAIOptimizationSuggestions(
    baseStrategy: TradingStrategy,
    previousResults: StrategyTestResult[],
    config: OptimizationConfig
  ): Promise<OptimizationSuggestion[]> {
    try {
      const prompt = this.buildOptimizationPrompt(baseStrategy, previousResults, config);
      
      // Use OpenAI to get optimization suggestions
      const completion = await this.openaiService['openai'].chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.getOptimizationSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.4
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No optimization suggestions from AI');
      }

      return this.parseOptimizationSuggestions(response);
    } catch (error) {
      logger.error('Failed to get AI optimization suggestions', {
        error,
        service: 'StrategyOptimizer'
      });
      
      // Fallback to random optimization
      return this.generateRandomOptimizationSuggestions(baseStrategy);
    }
  }

  /**
   * Generate optimization system prompt
   */
  private getOptimizationSystemPrompt(): string {
    return `You are an expert quantitative trading strategist specializing in algorithmic strategy optimization. Your role is to analyze trading strategy performance data and suggest intelligent parameter modifications to improve performance while managing risk.

OPTIMIZATION PRINCIPLES:
1. Risk-Adjusted Returns: Prioritize strategies that balance returns with acceptable risk levels
2. Robustness: Avoid overfitting by suggesting parameter changes that work across different market conditions
3. Practical Constraints: Keep parameters within realistic trading ranges
4. Multi-Objective: Balance returns, drawdown, win rate, and other metrics
5. Market Adaptation: Consider how strategies perform in different market regimes

RESPONSE FORMAT:
Provide your suggestions as a JSON array of optimization suggestions:
[
  {
    "parameterType": "indicator_period" | "risk_management" | "signal_threshold" | "position_sizing",
    "specificParameter": "parameter_name",
    "currentValue": current_value,
    "suggestedValue": suggested_value,
    "reasoning": "Why this change should improve performance",
    "expectedImpact": "What metric this should improve",
    "riskAssessment": "Potential downside of this change"
  }
]

PARAMETER CATEGORIES:
- indicator_period: Periods for technical indicators (SMA, EMA, RSI, etc.)
- risk_management: Stop loss, take profit, position sizing rules
- signal_threshold: Confidence thresholds for trade signals
- position_sizing: How much capital to allocate per trade

Focus on 3-5 high-impact suggestions that address the main weaknesses in the current strategy performance.`;
  }

  /**
   * Build optimization prompt with performance data
   */
  private buildOptimizationPrompt(
    strategy: TradingStrategy,
    results: StrategyTestResult[],
    config: OptimizationConfig
  ): string {
    const latestResult = results[results.length - 1];
    const baselineResult = results[0];
    
    return `
STRATEGY OPTIMIZATION REQUEST

CURRENT STRATEGY: ${strategy.name}
OBJECTIVE: ${config.objective}
TARGET METRIC: ${config.targetMetric}

CURRENT PERFORMANCE:
- Total Return: ${latestResult.backtestResult.totalReturnPercentage.toFixed(2)}%
- Max Drawdown: ${latestResult.backtestResult.maxDrawdownPercentage.toFixed(2)}%
- Win Rate: ${latestResult.backtestResult.winRate.toFixed(2)}%
- Sharpe Ratio: ${latestResult.backtestResult.sharpeRatio.toFixed(3)}
- Profit Factor: ${latestResult.backtestResult.profitFactor.toFixed(3)}
- Total Trades: ${latestResult.backtestResult.totalTrades}

BASELINE COMPARISON:
- Return Improvement: ${((latestResult.backtestResult.totalReturnPercentage - baselineResult.backtestResult.totalReturnPercentage)).toFixed(2)}%
- Drawdown Change: ${((latestResult.backtestResult.maxDrawdownPercentage - baselineResult.backtestResult.maxDrawdownPercentage)).toFixed(2)}%

CURRENT PARAMETERS:
${this.formatStrategyParameters(strategy)}

OPTIMIZATION HISTORY:
${this.formatOptimizationHistory(results.slice(-5))} // Last 5 results

CONSTRAINTS:
- Maximum acceptable drawdown: ${config.maxDrawdown}%
- Minimum trade frequency: ${config.minTrades} trades
- Risk tolerance: ${config.riskTolerance}

Please analyze the current performance and suggest 3-5 specific parameter modifications that could improve the strategy while respecting the constraints. Focus on addressing the main weaknesses you identify.`;
  }

  /**
   * Parse AI optimization suggestions
   */
  private parseOptimizationSuggestions(response: string): OptimizationSuggestion[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const suggestions = JSON.parse(jsonStr);
      
      return suggestions.map((suggestion: any) => ({
        parameterType: suggestion.parameterType || 'indicator_period',
        specificParameter: suggestion.specificParameter || '',
        currentValue: suggestion.currentValue || 0,
        suggestedValue: suggestion.suggestedValue || 0,
        reasoning: suggestion.reasoning || '',
        expectedImpact: suggestion.expectedImpact || '',
        riskAssessment: suggestion.riskAssessment || ''
      }));
    } catch (error) {
      logger.error('Failed to parse optimization suggestions', { error, response });
      return this.generateRandomOptimizationSuggestions();
    }
  }

  /**
   * Generate candidate strategies based on AI suggestions
   */
  private generateCandidateStrategies(
    baseStrategy: TradingStrategy,
    suggestions: OptimizationSuggestion[]
  ): TradingStrategy[] {
    const candidates: TradingStrategy[] = [];

    // Generate one candidate per suggestion
    suggestions.forEach((suggestion, index) => {
      const candidate = JSON.parse(JSON.stringify(baseStrategy)); // Deep clone
      candidate.id = `${baseStrategy.id}_opt_${Date.now()}_${index}`;
      candidate.name = `${baseStrategy.name} (Optimized ${index + 1})`;

      // Apply the suggestion
      this.applySuggestionToStrategy(candidate, suggestion);
      candidates.push(candidate);
    });

    // Generate combination candidates (top 2-3 suggestions combined)
    if (suggestions.length >= 2) {
      const combinedCandidate = JSON.parse(JSON.stringify(baseStrategy));
      combinedCandidate.id = `${baseStrategy.id}_combined_${Date.now()}`;
      combinedCandidate.name = `${baseStrategy.name} (Combined Optimization)`;

      // Apply top suggestions
      suggestions.slice(0, Math.min(3, suggestions.length)).forEach(suggestion => {
        this.applySuggestionToStrategy(combinedCandidate, suggestion);
      });

      candidates.push(combinedCandidate);
    }

    return candidates;
  }

  /**
   * Apply optimization suggestion to strategy
   */
  private applySuggestionToStrategy(strategy: TradingStrategy, suggestion: OptimizationSuggestion): void {
    switch (suggestion.parameterType) {
      case 'indicator_period':
        this.updateIndicatorParameter(strategy, suggestion);
        break;
      case 'risk_management':
        this.updateRiskManagementParameter(strategy, suggestion);
        break;
      case 'signal_threshold':
        this.updateSignalThreshold(strategy, suggestion);
        break;
      case 'position_sizing':
        this.updatePositionSizing(strategy, suggestion);
        break;
    }
  }

  /**
   * Update indicator parameters
   */
  private updateIndicatorParameter(strategy: TradingStrategy, suggestion: OptimizationSuggestion): void {
    const indicator = strategy.indicators.find(ind => 
      ind.name.includes(suggestion.specificParameter) ||
      suggestion.specificParameter.includes(ind.type)
    );

    if (indicator && indicator.parameters) {
      if (suggestion.specificParameter.includes('period')) {
        indicator.parameters.period = suggestion.suggestedValue;
      }
      // Add other parameter updates as needed
    }
  }

  /**
   * Update risk management parameters
   */
  private updateRiskManagementParameter(strategy: TradingStrategy, suggestion: OptimizationSuggestion): void {
    const param = suggestion.specificParameter;
    
    if (param.includes('stopLoss')) {
      strategy.riskManagement.stopLossPercentage = suggestion.suggestedValue;
    } else if (param.includes('takeProfit')) {
      strategy.riskManagement.takeProfitPercentage = suggestion.suggestedValue;
    } else if (param.includes('maxPosition')) {
      strategy.riskManagement.maxPositionSize = suggestion.suggestedValue;
    } else if (param.includes('riskPerTrade')) {
      strategy.riskManagement.riskPerTrade = suggestion.suggestedValue;
    }
  }

  /**
   * Test strategy with backtesting
   */
  private async testStrategy(
    strategy: TradingStrategy,
    historicalData: CandlestickData[],
    config: OptimizationConfig
  ): Promise<StrategyTestResult> {
    const backtestConfig: BacktestConfig = {
      strategyId: strategy.id,
      symbol: 'BTCUSDT', // Could be parameterized
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      endDate: new Date(),
      initialBalance: 10000,
      timeframe: '1h',
      commission: 0.001,
      slippage: 0.0005
    };

    const backtestEngine = new BacktestEngine(backtestConfig);
    const backtestResult = await backtestEngine.runBacktest(historicalData, strategy);
    const performanceAnalysis = PerformanceAnalyzer.analyzeBacktestResult(backtestResult);

    return {
      strategy,
      backtestResult,
      performanceAnalysis,
      objectiveScore: this.calculateObjectiveScore(backtestResult, config)
    };
  }

  /**
   * Calculate objective score based on optimization config
   */
  private calculateObjectiveScore(result: BacktestResult, config: OptimizationConfig): number {
    let score = 0;

    switch (config.objective) {
      case 'maximize_returns':
        score = result.totalReturnPercentage;
        break;
      case 'maximize_sharpe':
        score = result.sharpeRatio * 100; // Scale for comparison
        break;
      case 'minimize_drawdown':
        score = Math.max(0, 100 - result.maxDrawdownPercentage);
        break;
      case 'balance_risk_return':
        // Custom formula balancing returns and risk
        score = (result.totalReturnPercentage * 0.6) + 
                (Math.max(0, 100 - result.maxDrawdownPercentage) * 0.4);
        break;
    }

    // Apply penalties for constraint violations
    if (result.maxDrawdownPercentage > config.maxDrawdown) {
      score *= 0.5; // Heavy penalty for exceeding drawdown limit
    }
    
    if (result.totalTrades < config.minTrades) {
      score *= 0.7; // Penalty for insufficient trading frequency
    }

    return score;
  }

  /**
   * Generate final optimization analysis
   */
  private async generateOptimizationAnalysis(
    originalStrategy: TradingStrategy,
    optimizedStrategy: TradingStrategy,
    allResults: StrategyTestResult[],
    config: OptimizationConfig
  ): Promise<string> {
    const originalResult = allResults[0];
    const optimizedResult = allResults.find(r => r.strategy.id === optimizedStrategy.id);
    
    if (!optimizedResult) {
      return 'Optimization analysis unavailable';
    }

    const prompt = `
STRATEGY OPTIMIZATION ANALYSIS

ORIGINAL STRATEGY PERFORMANCE:
- Returns: ${originalResult.backtestResult.totalReturnPercentage.toFixed(2)}%
- Max Drawdown: ${originalResult.backtestResult.maxDrawdownPercentage.toFixed(2)}%
- Sharpe Ratio: ${originalResult.backtestResult.sharpeRatio.toFixed(3)}
- Win Rate: ${originalResult.backtestResult.winRate.toFixed(2)}%

OPTIMIZED STRATEGY PERFORMANCE:
- Returns: ${optimizedResult.backtestResult.totalReturnPercentage.toFixed(2)}%
- Max Drawdown: ${optimizedResult.backtestResult.maxDrawdownPercentage.toFixed(2)}%
- Sharpe Ratio: ${optimizedResult.backtestResult.sharpeRatio.toFixed(3)}
- Win Rate: ${optimizedResult.backtestResult.winRate.toFixed(2)}%

OPTIMIZATION OBJECTIVE: ${config.objective}
ITERATIONS TESTED: ${allResults.length}

Please provide:
1. Summary of key improvements achieved
2. Analysis of what changed and why it worked
3. Risk assessment of the optimized strategy
4. Recommendations for further improvements
5. Market conditions where this strategy should/shouldn't be used

Keep the analysis practical and actionable for traders.`;

    try {
      const completion = await this.openaiService['openai'].chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a quantitative trading analyst. Provide clear, actionable analysis of strategy optimization results.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      return completion.choices[0]?.message?.content || 'Analysis unavailable';
    } catch (error) {
      logger.error('Failed to generate optimization analysis', { error });
      return 'AI analysis unavailable due to service error';
    }
  }

  // Helper methods
  private formatStrategyParameters(strategy: TradingStrategy): string {
    return strategy.indicators.map(ind => 
      `${ind.name}: ${JSON.stringify(ind.parameters)}`
    ).join('\n');
  }

  private formatOptimizationHistory(results: StrategyTestResult[]): string {
    return results.map((result, index) => 
      `Iteration ${index}: Returns ${result.backtestResult.totalReturnPercentage.toFixed(2)}%, Drawdown ${result.backtestResult.maxDrawdownPercentage.toFixed(2)}%`
    ).join('\n');
  }

  private generateRandomOptimizationSuggestions(strategy?: TradingStrategy): OptimizationSuggestion[] {
    // Fallback random suggestions
    return [
      {
        parameterType: 'indicator_period',
        specificParameter: 'RSI_period',
        currentValue: 14,
        suggestedValue: 12,
        reasoning: 'Random optimization fallback',
        expectedImpact: 'Unknown',
        riskAssessment: 'Low'
      }
    ];
  }

  private updateSignalThreshold(strategy: TradingStrategy, suggestion: OptimizationSuggestion): void {
    // Update signal thresholds in rules
    strategy.rules.forEach(rule => {
      if (suggestion.specificParameter.includes('confidence')) {
        rule.confidence = suggestion.suggestedValue;
      }
    });
  }

  private updatePositionSizing(strategy: TradingStrategy, suggestion: OptimizationSuggestion): void {
    // Update position sizing parameters
    if (suggestion.specificParameter.includes('maxPosition')) {
      strategy.riskManagement.maxPositionSize = suggestion.suggestedValue;
    }
  }
}

// Type definitions
export interface OptimizationConfig {
  objective: 'maximize_returns' | 'maximize_sharpe' | 'minimize_drawdown' | 'balance_risk_return';
  targetMetric: string;
  maxDrawdown: number;
  minTrades: number;
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OptimizationSuggestion {
  parameterType: 'indicator_period' | 'risk_management' | 'signal_threshold' | 'position_sizing';
  specificParameter: string;
  currentValue: number;
  suggestedValue: number;
  reasoning: string;
  expectedImpact: string;
  riskAssessment: string;
}

export interface StrategyTestResult {
  strategy: TradingStrategy;
  backtestResult: BacktestResult;
  performanceAnalysis: any;
  objectiveScore: number;
}

export interface OptimizationResult {
  originalStrategy: TradingStrategy;
  optimizedStrategy: TradingStrategy;
  improvementPercentage: number;
  iterationsTested: number;
  allResults: StrategyTestResult[];
  aiAnalysis: string;
  optimizationConfig: OptimizationConfig;
  completedAt: Date;
}