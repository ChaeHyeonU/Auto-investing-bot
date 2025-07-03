# 🚀 Auto Trading System WebApp

An advanced cryptocurrency auto-trading system built with TypeScript, React, and AI integration. This system combines technical analysis, artificial intelligence, and risk management to execute automated trading strategies on Binance.

## ✨ Features

### 🎯 Core Trading Features
- **Real-time Trading Engine**: Event-driven architecture for live trading execution
- **18+ Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, Williams %R, CCI, VWAP, ATR, and more
- **AI-Powered Analysis**: OpenAI GPT-4 integration for market analysis and decision making
- **6 Pre-built Strategies**: From trend following to mean reversion and scalping
- **Advanced Risk Management**: Position sizing, stop-loss, take-profit, circuit breakers
- **Comprehensive Backtesting**: Historical strategy validation with performance analytics

### 🛡️ Risk Management
- **Portfolio Heat Monitoring**: Real-time risk exposure tracking
- **Dynamic Position Sizing**: Kelly Criterion and volatility-based sizing
- **Circuit Breaker Protection**: Automatic trading halt on consecutive losses
- **Multi-layer Risk Checks**: 8 different risk validation systems
- **Drawdown Management**: Maximum drawdown limits and monitoring

### 📊 Analytics & Performance
- **Performance Metrics**: Sharpe ratio, win rate, profit factor, maximum drawdown
- **Real-time Monitoring**: Live portfolio and position tracking
- **Strategy Comparison**: Performance analysis across multiple strategies
- **Market Condition Detection**: Trending, ranging, and volatile market identification

### 📝 Automated Trading Journal
- **Notion Integration**: Automated trade documentation with rich formatting
- **AI-Powered Analysis**: Intelligent trade reasoning and lessons learned
- **Daily Summaries**: Comprehensive performance reports with insights
- **Trade Documentation**: Automatic logging of all trading decisions and outcomes
- **Performance Tracking**: Historical analysis and pattern recognition

### 🌐 RESTful API & Backend
- **Express.js Backend**: Comprehensive API for all trading operations
- **WebSocket Support**: Real-time data streaming for live updates
- **Trading Endpoints**: Complete CRUD operations for strategies, trades, and portfolio
- **Analytics API**: Advanced performance and risk analysis endpoints
- **Notion API**: Automated journal creation and management

### 🔧 Technical Architecture
- **TypeScript**: Full type safety across the entire codebase
- **Next.js 15**: Modern React framework with server-side rendering
- **Event-driven Design**: Scalable and responsive trading engine
- **Modular Architecture**: Clean separation of concerns and easy extensibility

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ 
- npm or yarn
- Binance account with API access
- OpenAI API key (optional, for AI features)
- Notion workspace and API key (optional, for trading journal)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/auto-trading-system.git
   cd auto-trading-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Binance API (use testnet for development)
   BINANCE_API_KEY=your_testnet_api_key
   BINANCE_API_SECRET=your_testnet_secret
   BINANCE_TESTNET=true
   
   # OpenAI (optional)
   OPENAI_API_KEY=your_openai_key
   OPENAI_MODEL=gpt-4
   
   # Notion Integration (optional)
   NOTION_API_KEY=your_notion_api_key
   NOTION_DATABASE_ID=your_database_id
   
   # Trading Configuration
   TRADING_MODE=paper
   MAX_TRADE_AMOUNT=100
   RISK_PERCENTAGE=2
   DEFAULT_SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT
   
   # Server Configuration
   PORT=3001
   LOG_LEVEL=info
   ```

4. **Run Tests**
   ```bash
   # Quick functionality test
   npm run test:quick
   
   # Individual component tests
   npm run test:indicators
   npm run test:strategies
   ```

5. **Start Development Server**
   ```bash
   # Frontend development server
   npm run dev
   
   # Backend API server
   npm run backend:dev
   ```

## 🌐 API Usage

### Backend Server
The system includes a comprehensive RESTful API server built with Express.js:

```bash
# Start the backend server
npm run backend:dev
```

### API Endpoints

#### Trading Operations
- `POST /api/trading/start` - Start trading engine
- `POST /api/trading/stop` - Stop trading engine
- `GET /api/trading/status` - Get trading status
- `POST /api/trading/emergency-stop` - Emergency stop all trading

#### Portfolio Management
- `GET /api/portfolio` - Get portfolio summary
- `GET /api/portfolio/positions` - Get active positions
- `GET /api/portfolio/balance` - Get account balance
- `GET /api/portfolio/history` - Get portfolio history

#### Strategy Management
- `GET /api/strategy` - List available strategies
- `POST /api/strategy/create` - Create new strategy
- `PUT /api/strategy/:id` - Update strategy
- `DELETE /api/strategy/:id` - Remove strategy

#### Backtesting
- `POST /api/backtest/run` - Run backtest
- `GET /api/backtest/status/:jobId` - Get backtest status
- `GET /api/backtest/result/:jobId` - Get backtest results

#### Analytics
- `GET /api/analytics/dashboard` - Get dashboard data
- `GET /api/analytics/performance/summary` - Performance metrics
- `GET /api/analytics/risk/assessment` - Risk analysis

#### Notion Integration
- `POST /api/notion/journal-entry` - Create journal entry
- `POST /api/notion/daily-summary` - Create daily summary
- `POST /api/notion/test-connection` - Test Notion connection

### WebSocket Real-time Data
Connect to `ws://localhost:3001` for real-time updates:

```javascript
const socket = io('http://localhost:3001');

socket.on('priceUpdate', (data) => {
  console.log('Price update:', data);
});

socket.on('tradeExecuted', (data) => {
  console.log('Trade executed:', data);
});
```

## 🧪 Testing System

The project includes comprehensive testing capabilities:

### Quick Test Suite
```bash
npm run test:quick
```
Tests all core functionality without requiring API keys:
- ✅ Technical indicator calculations
- ✅ Strategy validation and factory
- ✅ Indicator manager aggregation
- ✅ Performance metrics (43,478+ candles/second)
- ✅ System health checks

### Individual Tests
```bash
npm run test:indicators    # Test technical indicators
npm run test:strategies    # Test strategy factory
```

### API Integration Tests
After configuring API keys, test live connections:
```bash
npm run test:binance      # Test Binance API connection
npm run test:ai          # Test OpenAI integration
```

## 📈 Trading Strategies

### 1. Moving Average Crossover (Trend Following)
- **Indicators**: EMA(12), EMA(26), MACD
- **Best For**: Trending markets
- **Risk**: 3% stop-loss, 9% take-profit

### 2. RSI Bollinger Bands Mean Reversion
- **Indicators**: RSI(14), Bollinger Bands(20), ATR
- **Best For**: Ranging markets
- **Risk**: 2% stop-loss, 4% take-profit

### 3. Keltner Channel Momentum Breakout
- **Indicators**: Keltner Channels, Volume, ATR, RSI
- **Best For**: Volatile breakout markets
- **Risk**: 4% stop-loss, 12% take-profit

### 4. Volume-Price Analysis Strategy
- **Indicators**: VWAP, OBV, MFI, A/D Line
- **Best For**: Institutional-style trading
- **Risk**: 2.5% stop-loss, 6% take-profit

### 5. Multi-Timeframe Confluence Strategy
- **Indicators**: SMA, EMA, RSI, MACD, Stochastic
- **Best For**: High-probability setups
- **Risk**: 3% stop-loss, 9% take-profit

### 6. High-Frequency Scalping Strategy
- **Indicators**: Williams %R, CCI, Short-term EMAs, Volume
- **Best For**: Quick scalping opportunities
- **Risk**: 0.5% stop-loss, 1.5% take-profit

## 🤖 AI Integration

### Market Analysis
- **GPT-4 Integration**: Advanced market sentiment and technical analysis
- **Confidence Scoring**: AI provides confidence levels for recommendations
- **Risk Assessment**: Automatic risk level classification (LOW/MEDIUM/HIGH)
- **Reasoning Explanation**: Detailed explanations for AI decisions

### Strategy Optimization
- **Parameter Tuning**: AI-assisted strategy parameter optimization
- **Market Adaptation**: Dynamic strategy selection based on market conditions
- **Performance Feedback**: Continuous learning from trading results

## 📊 Performance Monitoring

### Real-time Metrics
- **Portfolio Value**: Live portfolio tracking
- **Active Positions**: Real-time P&L monitoring
- **Daily Statistics**: Trade count, win rate, profit/loss
- **Risk Metrics**: Portfolio heat, drawdown, leverage

### Health Monitoring
- **System Health**: Automatic health checks every 30 seconds
- **Connection Status**: Binance WebSocket connection monitoring
- **Performance Alerts**: Automated alerts for unusual conditions
- **Emergency Stops**: Automatic trading halt mechanisms

## 🔧 Configuration

### Risk Management Settings
```typescript
// Default risk limits (configurable)
const riskLimits = {
  maxPositionSizePercent: 10,    // 10% of portfolio per position
  maxPortfolioHeat: 20,          // 20% total risk exposure
  maxDailyLoss: 5,               // 5% daily loss limit
  maxDrawdown: 15,               // 15% maximum drawdown
  maxLeverage: 3,                // 3x maximum leverage
  maxConsecutiveLosses: 5        // Circuit breaker threshold
};
```

### Trading Parameters
```typescript
// Trading engine configuration
const tradingConfig = {
  maxDailyTrades: 50,            // Maximum trades per day
  maxActivePositions: 5,         // Maximum concurrent positions
  defaultTimeframe: '1h',        // Primary timeframe
  symbols: ['BTCUSDT', 'ETHUSDT'] // Trading pairs
};
```

## 📁 Project Structure

```
auto-trading-system/
├── 📁 backend/
│   ├── 📁 config/              # Configuration management
│   ├── 📁 services/
│   │   ├── 📁 indicators/      # Technical indicators
│   │   ├── 📁 backtest/        # Backtesting engine
│   │   ├── 📁 ai/              # AI integration
│   │   └── 📁 trading/         # Trading engine & risk management
│   └── 📁 utils/               # Utilities and helpers
├── 📁 src/
│   ├── 📁 components/          # React components
│   ├── 📁 pages/               # Next.js pages
│   └── 📁 types/               # TypeScript definitions
├── 📁 tests/                   # Test suites
├── 📄 TESTING_GUIDE.md         # Comprehensive testing guide
├── 📄 CLAUDE.md               # Development documentation
└── 📄 TODO.md                 # Project roadmap
```

## 🎯 Current Development Status

### ✅ Completed Features
- ✅ TypeScript React project setup
- ✅ Binance API integration with WebSocket support
- ✅ 18+ technical indicators with advanced calculations
- ✅ Comprehensive backtesting system
- ✅ AI-powered market analysis (OpenAI GPT-4)
- ✅ Real-time trading engine with event-driven architecture
- ✅ Advanced risk management system
- ✅ Performance testing (43,478+ candles/second)
- ✅ Comprehensive test suite

### 🚧 In Progress
- 🔄 Notion API integration for trading journal
- 🔄 Web dashboard UI components

### 📋 Upcoming Features
- 📱 React Native mobile app
- 🌐 Multi-asset support (stocks, forex)
- 👥 Social trading features
- 📊 Advanced visualization dashboard

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes only. Cryptocurrency trading involves substantial risk of loss. The authors and contributors are not responsible for any financial losses incurred while using this software. Always trade responsibly and never invest more than you can afford to lose.

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Bug Reports](https://github.com/your-username/auto-trading-system/issues)
- 💬 [Discussions](https://github.com/your-username/auto-trading-system/discussions)
- 📧 Email: support@yourproject.com

---

Built with ❤️ by the Auto Trading System Team