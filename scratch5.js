const fs = require('fs');
const ts = require('typescript');
const code = fs.readFileSync('api/src/bonds/bonds.service.spec.ts', 'utf8');
const sourceFile = ts.createSourceFile('file.ts', code, ts.ScriptTarget.Latest, true);
sourceFile.parseDiagnostics.forEach(d => {
  const start = ts.getLineAndCharacterOfPosition(sourceFile, d.start);
  console.log(`Error at line ${start.line + 1}, col ${start.character + 1}: ${d.messageText}`);
});
