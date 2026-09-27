const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('api/src/bonds/bonds.service.spec.ts', 'utf8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript']
  });
} catch (e) {
  // Parsing failed, but maybe we can use tolerant parsing?
  // Babel parser does not have robust error recovery.
  // We can try acorn-loose if it was JS, but it's TS.
  // Instead, let's just iteratively slice the file to see where it breaks.
  for (let i = code.length - 1; i >= 0; i--) {
     if (code[i] === '}') {
        let sliced = code.slice(0, i + 1);
        try {
           parser.parse(sliced, { sourceType: 'module', plugins: ['typescript'] });
           console.log('Successfully parsed when sliced at index ' + i);
           console.log('Last few lines: ' + sliced.slice(sliced.length - 100));
           break;
        } catch(e2) {
           // ignore
        }
     }
  }
}
