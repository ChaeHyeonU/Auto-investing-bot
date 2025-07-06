const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Auto Trading System - Full Integration Test');
console.log('================================================');

async function runTest(command, description) {
  console.log(`\n🔧 Testing: ${description}`);
  console.log('-'.repeat(50));
  
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', command], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} - SUCCESS`);
      } else {
        console.log(`❌ ${description} - FAILED (code: ${code})`);
      }
      resolve(code === 0);
    });
    
    child.on('error', (error) => {
      console.log(`❌ ${description} - ERROR: ${error.message}`);
      resolve(false);
    });
  });
}

async function main() {
  const tests = [
    ['type-check', 'TypeScript Type Checking'],
    ['test:quick', 'Quick System Tests'],
    ['test:indicators', 'Technical Indicators'],
    ['test:strategies', 'Trading Strategies']
  ];
  
  const results = [];
  
  for (const [command, description] of tests) {
    const result = await runTest(command, description);
    results.push({ command, description, success: result });
  }
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  
  results.forEach(({ description, success }) => {
    console.log(`${success ? '✅' : '❌'} ${description}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Overall: ${successCount}/${results.length} tests passed`);
  
  if (successCount === results.length) {
    console.log('\n🎉 All systems are working perfectly!');
    console.log('Ready to start trading! 🚀');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

main().catch(console.error);