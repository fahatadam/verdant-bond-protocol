const fs = require('fs');
const code = fs.readFileSync('api/src/bonds/bonds.service.spec.ts', 'utf8');
try {
  new Function(code);
} catch (e) {
  console.error(e);
}
