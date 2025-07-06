const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

console.log('🚀 Auto Trading System - Configuration Test');
console.log('============================================\n');

function testConfiguration() {
  const requiredEnvVars = [
    { name: 'Binance API Key', key: 'BINANCE_API_KEY' },
    { name: 'Binance API Secret', key: 'BINANCE_API_SECRET' },
    { name: 'Binance Testnet', key: 'BINANCE_TESTNET' },
    { name: 'OpenAI API Key', key: 'OPENAI_API_KEY' },
    { name: 'Notion API Key', key: 'NOTION_API_KEY' },
    { name: 'Notion Database ID', key: 'NOTION_DATABASE_ID' },
    { name: 'Supabase URL', key: 'NEXT_PUBLIC_SUPABASE_URL' },
    { name: 'Supabase Anon Key', key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' }
  ];

  let allConfigured = true;
  
  console.log('📋 Environment Variables Check:');
  console.log('-------------------------------');
  
  requiredEnvVars.forEach(({ name, key }) => {
    const value = process.env[key];
    const isConfigured = value && value.length > 0;
    const displayValue = isConfigured ? `${value.substring(0, 20)}...` : 'NOT SET';
    
    console.log(`${isConfigured ? '✅' : '❌'} ${name}: ${displayValue}`);
    
    if (!isConfigured) {
      allConfigured = false;
    }
  });

  console.log('\n📊 Configuration Summary');
  console.log('========================');
  
  if (allConfigured) {
    console.log('🎉 EXCELLENT! All API keys are properly configured!');
    console.log('🚀 Your AI Trading System is ready to start!');
    console.log('\n💡 Next steps to test the system:');
    console.log('   1. Frontend: npm run dev');
    console.log('   2. Backend: npm run backend:dev');
    console.log('   3. Open: http://localhost:3000');
    console.log('\n🔥 Ready for live testing!');
  } else {
    console.log('⚠️  Some API keys are missing or incomplete.');
    console.log('📝 Please check your .env.local file.');
  }
  
  console.log('\n🎯 Trading Configuration:');
  console.log(`   • Mode: ${process.env.TRADING_MODE || 'paper'}`);
  console.log(`   • Max Trade: $${process.env.MAX_TRADE_AMOUNT || '100'}`);
  console.log(`   • Risk: ${process.env.RISK_PERCENTAGE || '2'}%`);
  console.log(`   • Symbols: ${process.env.DEFAULT_SYMBOLS || 'BTCUSDT,ETHUSDT'}`);
  
  return allConfigured;
}

// Run the test
try {
  const result = testConfiguration();
  process.exit(result ? 0 : 1);
} catch (error) {
  console.error('💥 Configuration Test Failed:', error.message);
  process.exit(1);
}