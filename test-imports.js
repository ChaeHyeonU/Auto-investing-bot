// Simple test to check if we can run type checking
const { spawn } = require('child_process');

console.log('🔍 Testing TypeScript compilation...');

const tsc = spawn('npx', ['tsc', '--noEmit'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let output = '';
let errorOutput = '';

tsc.stdout.on('data', (data) => {
  output += data.toString();
});

tsc.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

tsc.on('close', (code) => {
  console.log(`\n📊 TypeScript Check Results:`);
  console.log('============================');
  
  if (code === 0) {
    console.log('✅ No TypeScript errors found!');
    console.log('🎉 All types are correct!');
  } else {
    console.log('❌ TypeScript errors found:');
    console.log('---------------------------');
    if (errorOutput) {
      console.log('STDERR:', errorOutput);
    }
    if (output) {
      console.log('STDOUT:', output);
    }
  }
  
  process.exit(code);
});