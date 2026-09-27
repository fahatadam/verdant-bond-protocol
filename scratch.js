const ts = require('typescript');
const fs = require('fs');
const file = 'api/src/bonds/bonds.service.spec.ts';
const content = fs.readFileSync(file, 'utf8');
const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
sourceFile.parseDiagnostics.forEach(d => {
  const pos = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Error at ${pos.line + 1}:${pos.character + 1}: ${d.messageText}`);
});
