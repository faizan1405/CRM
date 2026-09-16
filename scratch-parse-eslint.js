const fs = require('fs');

const data = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

let errors = 0;
let warnings = 0;

data.forEach(file => {
  errors += file.errorCount;
  warnings += file.warningCount;
  
  if (file.warningCount > 0 || file.errorCount > 0) {
    file.messages.forEach(msg => {
      console.log(`[${msg.severity === 1 ? 'WARNING' : 'ERROR'}] ${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`);
    });
  }
});

console.log(`\nTotal Errors: ${errors}`);
console.log(`Total Warnings: ${warnings}`);
