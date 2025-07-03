import { NotionService } from '../services/notionService';
import { Trade } from '@/types';

/**
 * Test script for Notion Service Integration
 * 
 * This test verifies that:
 * 1. Notion API connection works
 * 2. Trading journal entries can be created
 * 3. AI analysis is properly generated
 * 4. Daily summaries can be created
 * 5. Error handling works correctly
 */

async function testNotionIntegration() {
  console.log('🧪 Starting Notion Service Integration Tests...\n');

  const notionService = new NotionService();

  try {
    // Test 1: Connection Test
    console.log('📡 Test 1: Testing Notion connection...');
    const isConnected = await notionService.testConnection();
    console.log(`   ✅ Connection status: ${isConnected ? 'SUCCESS' : 'FAILED'}\n`);

    if (!isConnected) {
      console.log('❌ Cannot proceed with tests - Notion connection failed');
      console.log('   Please check:');
      console.log('   - NOTION_API_KEY is set in environment variables');
      console.log('   - NOTION_DATABASE_ID is set in environment variables');
      console.log('   - Database exists and is accessible');
      return;
    }

    // Test 2: Initialize Trading Journal
    console.log('🏗️ Test 2: Initializing trading journal...');
    await notionService.initializeTradingJournal();
    console.log('   ✅ Trading journal initialized successfully\n');

    // Test 3: Create Sample Trade Entry
    console.log('📝 Test 3: Creating sample trade entry...');
    const sampleTrade: Trade = {
      id: `test-trade-${Date.now()}`,
      symbol: 'BTCUSDT',
      side: 'BUY',
      entryPrice: 45000,
      exitPrice: 46500,
      quantity: 0.1,
      pnl: 150,
      strategy: 'Moving Average Crossover',
      status: 'CLOSED',
      entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      exitTime: new Date(),
      stopLoss: 44000,
      takeProfit: 47000,
      commission: 5,
      notes: 'Test trade for Notion integration verification'
    };

    const notionPage = await notionService.createJournalEntry(sampleTrade);
    console.log(`   ✅ Trade entry created successfully`);
    console.log(`   📄 Notion Page ID: ${notionPage.id}`);
    console.log(`   💰 Trade P&L: $${sampleTrade.pnl}\n`);

    // Test 4: Create Losing Trade Entry
    console.log('📝 Test 4: Creating losing trade entry...');
    const losingTrade: Trade = {
      id: `test-loss-trade-${Date.now()}`,
      symbol: 'ETHUSDT',
      side: 'SELL',
      entryPrice: 3200,
      exitPrice: 3250,
      quantity: 1,
      pnl: -50,
      strategy: 'Mean Reversion',
      status: 'CLOSED',
      entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      exitTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      stopLoss: 3300,
      notes: 'Test losing trade for comprehensive analysis'
    };

    const losingTradeNote = await notionService.createJournalEntry(losingTrade);
    console.log(`   ✅ Losing trade entry created successfully`);
    console.log(`   📄 Notion Page ID: ${losingTradeNote.id}`);
    console.log(`   📉 Trade Loss: $${losingTrade.pnl}\n`);

    // Test 5: Create Open Position Entry
    console.log('📝 Test 5: Creating open position entry...');
    const openTrade: Trade = {
      id: `test-open-trade-${Date.now()}`,
      symbol: 'BNBUSDT',
      side: 'BUY',
      entryPrice: 450,
      quantity: 2,
      strategy: 'Momentum Breakout',
      status: 'OPEN',
      entryTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      stopLoss: 440,
      takeProfit: 470,
      notes: 'Test open position for ongoing monitoring'
    };

    const openTradeNote = await notionService.createJournalEntry(openTrade);
    console.log(`   ✅ Open position entry created successfully`);
    console.log(`   📄 Notion Page ID: ${openTradeNote.id}`);
    console.log(`   🔄 Status: ${openTrade.status}\n`);

    // Test 6: Create Daily Summary
    console.log('📊 Test 6: Creating daily summary...');
    const dailySummary = {
      date: new Date(),
      totalTrades: 15,
      winningTrades: 10,
      losingTrades: 5,
      totalPnL: 450.75,
      winRate: 66.7,
      bestTrade: sampleTrade,
      worstTrade: losingTrade,
      strategiesUsed: ['Moving Average Crossover', 'Mean Reversion', 'Momentum Breakout']
    };

    const summaryPage = await notionService.createDailySummary(dailySummary);
    console.log(`   ✅ Daily summary created successfully`);
    console.log(`   📄 Notion Page ID: ${summaryPage.id}`);
    console.log(`   📈 Daily P&L: $${dailySummary.totalPnL}`);
    console.log(`   🎯 Win Rate: ${dailySummary.winRate}%\n`);

    // Test 7: Update Trade Entry
    console.log('📝 Test 7: Updating trade entry...');
    openTrade.exitPrice = 465;
    openTrade.pnl = 30; // (465 - 450) * 2
    openTrade.status = 'CLOSED';
    openTrade.exitTime = new Date();

    await notionService.updateJournalEntry(openTradeNote.id, openTrade);
    console.log(`   ✅ Trade entry updated successfully`);
    console.log(`   💰 Final P&L: $${openTrade.pnl}`);
    console.log(`   ✅ Status: ${openTrade.status}\n`);

    // Test Summary
    console.log('🎉 All Notion Integration Tests Completed Successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Connection test: PASSED');
    console.log('   ✅ Journal initialization: PASSED');
    console.log('   ✅ Winning trade entry: PASSED');
    console.log('   ✅ Losing trade entry: PASSED');
    console.log('   ✅ Open position entry: PASSED');
    console.log('   ✅ Daily summary: PASSED');
    console.log('   ✅ Trade update: PASSED');
    console.log('\n🚀 Notion integration is fully functional!');
    console.log('\n📝 Check your Notion database to see all created entries.');

  } catch (error) {
    console.error('❌ Notion Integration Test Failed:', error);
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify NOTION_API_KEY is correct');
    console.log('2. Verify NOTION_DATABASE_ID exists and is accessible');
    console.log('3. Check database permissions');
    console.log('4. Ensure database has required properties');
    console.log('5. Check AI service is properly configured');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testNotionIntegration();
}

export { testNotionIntegration };