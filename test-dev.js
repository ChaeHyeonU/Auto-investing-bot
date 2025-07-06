// Test development server startup
const { spawn } = require('child_process');

console.log('🚀 Testing Next.js Development Server...');
console.log('=========================================\n');

const dev = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let hasStarted = false;
let startTime = Date.now();
const TIMEOUT = 30000; // 30 seconds

dev.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  if (output.includes('Ready') || output.includes('localhost:3000')) {
    console.log('✅ Development server started successfully!');
    console.log('🎉 Frontend is working!');
    hasStarted = true;
    dev.kill();
  }
});

dev.stderr.on('data', (data) => {
  const error = data.toString();
  console.log('Error output:', error);
  
  if (error.includes('Error') && !error.includes('warn')) {
    console.log('❌ Development server failed to start');
    console.log('Error details:', error);
    dev.kill();
  }
});

dev.on('close', (code) => {
  if (hasStarted) {
    console.log('\n🎯 Test Result: SUCCESS');
    console.log('✅ Next.js development server is working correctly!');
  } else {
    console.log('\n🎯 Test Result: NEEDS ATTENTION');
    console.log('⚠️ Check the error output above for details.');
  }
  process.exit(hasStarted ? 0 : 1);
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!hasStarted) {
    console.log('\n⏰ Test timed out after 30 seconds');
    console.log('⚠️ Development server may have issues starting');
    dev.kill();
  }
}, TIMEOUT);