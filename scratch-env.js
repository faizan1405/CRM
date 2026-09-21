const fs = require('fs');
let env = fs.readFileSync('.env.prod', 'utf8');
const testUrlMatch = env.match(/^TEST_DATABASE_URL="(.*)"/m);
if (testUrlMatch) {
  env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${testUrlMatch[1]}"`);
  fs.writeFileSync('.env', env);
  console.log('Switched .env to test DB.');
} else {
  console.log('TEST_DATABASE_URL not found.');
}
