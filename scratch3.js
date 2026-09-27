const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('api/src/bonds/bonds.service.spec.ts', 'utf8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript']
  });
  console.log('No parse error found by babel!');
} catch (e) {
  console.error(e);
}
