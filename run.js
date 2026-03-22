const fs = require('fs');
const path = require('path');

function resolveCliEntry() {
  const distEntry = path.join(__dirname, 'dist', 'src', 'cli', 'entry.js');
  if (fs.existsSync(distEntry)) {
    return distEntry;
  }

  // Local dev fallback: allow JS CLI files to require TS modules from src/.
  // eslint-disable-next-line global-require
  require('ts-node/register/transpile-only');
  return path.join(__dirname, 'src', 'cli', 'entry.js');
}

const { main } = require(resolveCliEntry());
main();
