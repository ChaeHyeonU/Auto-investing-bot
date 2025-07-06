# Cursor AI Integration Guide for Auto Trading System

## 🎨 UI Component Development with 21st Century Developer MCP Server

This guide outlines how to use Cursor AI with the 21st Century Developer MCP Server to design and implement the trading dashboard components.

## 📋 Component Architecture Plan

### 1. Main Dashboard Layout
- **Header**: Navigation, user profile, system status
- **Sidebar**: Trading controls, strategy selection
- **Main Content**: Charts, portfolio overview, active trades
- **Footer**: Performance metrics, alerts

### 2. Core Components to Develop

#### Trading Dashboard Components:
1. `TradingDashboard` - Main container component
2. `PriceChart` - Real-time candlestick charts with indicators
3. `PortfolioOverview` - Account balance and P&L summary
4. `ActivePositions` - Current open positions table
5. `TradingControls` - Start/stop trading, emergency controls
6. `StrategyManager` - Strategy selection and configuration
7. `PerformanceMetrics` - Key performance indicators
8. `AlertCenter` - Real-time notifications and alerts

#### Supporting Components:
1. `LoadingSpinner` - Custom loading states
2. `ErrorBoundary` - Error handling wrapper
3. `Modal` - Reusable modal component
4. `Card` - Consistent card layout
5. `Button` - Styled button variations
6. `Table` - Data table with sorting/filtering

## 🔗 API Integration Points

All components will connect to our Express.js backend API:

- **Base URL**: `http://localhost:3001/api`
- **WebSocket**: `ws://localhost:3001` for real-time data
- **Authentication**: Token-based (when implemented)

### API Endpoints for Components:

```typescript
// Trading Dashboard Data
GET /api/analytics/dashboard
GET /api/trading/status
GET /api/portfolio

// Real-time WebSocket Events
- priceUpdate
- tradeExecuted
- positionChanged
- alertTriggered
```

## 🎨 Design System Requirements

### Color Scheme (Dark Trading Theme):
- **Primary**: `#10B981` (Green for profits)
- **Danger**: `#EF4444` (Red for losses)
- **Background**: `#0F172A` (Dark slate)
- **Surface**: `#1E293B` (Lighter slate)
- **Text**: `#F8FAFC` (White)
- **Muted**: `#64748B` (Gray)

### Typography:
- **Font Family**: Inter, system-ui, sans-serif
- **Heading**: Font weight 600-700
- **Body**: Font weight 400-500
- **Monospace**: JetBrains Mono (for numbers/prices)

### Spacing Scale:
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)

## 📱 Responsive Design Breakpoints

```css
/* Mobile First Approach */
sm: '640px',   // Mobile landscape
md: '768px',   // Tablet
lg: '1024px',  // Desktop
xl: '1280px',  // Large desktop
2xl: '1536px'  // Extra large
```

## 🛠 Component Development Workflow

### Step 1: Create Component Structure
```bash
src/
├── components/
│   ├── dashboard/
│   │   ├── TradingDashboard.tsx
│   │   ├── PriceChart.tsx
│   │   ├── PortfolioOverview.tsx
│   │   └── ActivePositions.tsx
│   ├── trading/
│   │   ├── TradingControls.tsx
│   │   ├── StrategyManager.tsx
│   │   └── PerformanceMetrics.tsx
│   ├── common/
│   │   ├── LoadingSpinner.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   └── Button.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
```

### Step 2: Implement with TypeScript Types
Each component should use our existing TypeScript interfaces:

```typescript
import { Portfolio, TradingStrategy, Order, PriceUpdate } from '@/types';
```

### Step 3: Real-time Data Integration
Use WebSocket hooks for live updates:

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
```

## 🎯 Cursor AI Prompts for Component Development

### For 21st Century Developer MCP Server:

1. **Trading Dashboard Layout**:
```
Create a modern trading dashboard layout with:
- Dark theme optimized for traders
- Real-time price charts section
- Portfolio overview cards
- Active positions table
- Trading controls sidebar
- Performance metrics footer
- Responsive design for desktop/tablet
```

2. **Price Chart Component**:
```
Design a cryptocurrency price chart component with:
- Candlestick chart display
- Technical indicators overlay (SMA, EMA, RSI)
- Volume bars at bottom
- Timeframe selector (1m, 5m, 1h, 4h, 1d)
- Zoom and pan functionality
- Real-time price updates
```

3. **Portfolio Overview Cards**:
```
Create portfolio overview cards showing:
- Total portfolio value with P&L
- Available balance
- Today's performance metrics
- Asset allocation pie chart
- Recent trade history
- Card-based responsive layout
```

## 🔧 Development Tools Integration

### Tailwind CSS Configuration:
```javascript
// tailwind.config.js - Trading theme colors
module.exports = {
  theme: {
    extend: {
      colors: {
        profit: '#10B981',
        loss: '#EF4444',
        dark: {
          bg: '#0F172A',
          surface: '#1E293B',
          border: '#334155',
        }
      }
    }
  }
}
```

### WebSocket Hook Example:
```typescript
// hooks/useWebSocket.ts
export const useWebSocket = (url: string) => {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => setData(JSON.parse(event.data));
    return () => ws.close();
  }, [url]);
  
  return { data, connected };
};
```

## ✅ Completed Components

### Core Dashboard Structure
- ✅ **DashboardLayout** - Main layout with header, sidebar, and content areas
- ✅ **TradingDashboard** - Primary dashboard component with real-time data
- ✅ **PortfolioOverview** - Comprehensive portfolio display with metrics
- ✅ **TradingControls** - Trading operation controls and strategy management
- ✅ **Card Components** - Reusable UI cards (Card, MetricCard, StatusCard)

### Chart Components (NEW!)
- ✅ **PriceChart** - Professional price chart with technical indicators
- ✅ **MiniChart** - Lightweight SVG charts for price visualization
- ✅ **MiniCandlestickChart** - Candlestick chart component
- ✅ **PriceSparkline** - Compact price trend display
- ✅ **TechnicalIndicators** - RSI, MACD, Bollinger Bands, Moving Averages
- ✅ **MarketOverview** - Multi-asset market data display

### API Integration
- ✅ **useApi Hook** - RESTful API integration with error handling
- ✅ **useWebSocket Hook** - Real-time WebSocket connections
- ✅ **Trading Actions** - Start/stop trading, emergency controls
- ✅ **Strategy Management** - Activate/deactivate strategies

## 📝 Next Steps with Cursor AI

1. **✅ Layout Components**: Completed with DashboardLayout and responsive grid
2. **✅ Chart Components**: Professional charts with technical indicators completed!
3. **✅ Data Tables**: Portfolio and trades display completed
4. **✅ Real-time Features**: WebSocket integration completed
5. **🟡 Responsive Design**: Basic responsive layout done, needs mobile optimization
6. **🟡 Performance Optimization**: Ready for lazy loading and memoization
7. **🟡 Advanced Charting**: Integration with TradingView or Chart.js for interactive charts

### Ready for Advanced Charting Libraries

The chart infrastructure is complete and ready for integration with professional charting libraries:

- **TradingView Widgets**: Drop-in professional charts
- **Chart.js**: Flexible charting with custom indicators
- **D3.js**: Custom interactive visualizations
- **Lightweight Charts**: High-performance financial charts

## 🎨 Example Cursor AI Prompt for Getting Started

```
I'm building a cryptocurrency trading dashboard with React, TypeScript, and Tailwind CSS. 

Current tech stack:
- Next.js 15 with React 18
- TypeScript for type safety
- Tailwind CSS for styling
- Express.js backend API at localhost:3001
- WebSocket for real-time data

Please create a modern trading dashboard layout component with:
1. Dark theme optimized for financial data
2. Header with navigation and system status
3. Sidebar with trading controls
4. Main content area for charts and data
5. Cards showing portfolio overview
6. Responsive design for desktop and tablet

The component should connect to our API endpoints and show loading states. Use professional trading platform design patterns.
```

This integration guide provides the foundation for using Cursor AI's MCP Server to design our trading dashboard components efficiently!