import Link from 'next/link';

/**
 * Home Page
 * 
 * Landing page with navigation to the trading dashboard.
 */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-4xl mx-auto px-6">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
          Auto Trading System
        </h1>
        
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          AI-powered cryptocurrency trading platform with real-time analysis, 
          professional charts, and automated trading strategies.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
            <p className="text-gray-400 text-sm">
              Advanced AI analyzes market data and provides intelligent trading signals
            </p>
          </div>
          
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">Real-Time Charts</h3>
            <p className="text-gray-400 text-sm">
              Professional trading charts with technical indicators and live data
            </p>
          </div>
          
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold mb-2">Automated Trading</h3>
            <p className="text-gray-400 text-sm">
              Execute trades automatically based on proven strategies and risk management
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"
          >
            Open Trading Dashboard
          </Link>
          
          <div className="text-sm text-gray-500">
            <p>✅ Real-time portfolio tracking</p>
            <p>✅ Advanced technical indicators</p>
            <p>✅ AI-powered market analysis</p>
            <p>✅ Automated trading journal</p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">15+</div>
              <div className="text-sm text-gray-400">Technical Indicators</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">6</div>
              <div className="text-sm text-gray-400">Trading Strategies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">100%</div>
              <div className="text-sm text-gray-400">TypeScript</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">Real-time</div>
              <div className="text-sm text-gray-400">Market Data</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
