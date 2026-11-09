// Run on the deployment host using node:22-alpine and a /config directory mount.
// Only fills missing demo settings; existing credentials are never rotated.
const fs = require('node:fs');
const crypto = require('node:crypto');

const domain = process.argv[2];
if (!domain || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
  throw new Error('Pass the base domain, without https:// or a path.');
}
const file = process.env.SSO_CONFIG_FILE || '/config/production.env';
let config = fs.readFileSync(file, 'utf8');
const get = (key) => {
  const value = config.match(new RegExp('^' + key + '=(.*)$', 'm'))?.[1].trim() || '';
  return value.replace(/^(['"])(.*)\1$/, '$2');
};
const fill = (key, value) => {
  if (get(key)) return;
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  const line = key + '=' + value;
  config = pattern.test(config) ? config.replace(pattern, () => line) : config + '\n' + line + '\n';
};
for (const letter of ['A', 'B']) {
  const prefix = 'DEMO_APP_' + letter;
  fill(prefix + '_HOST', 'app-' + letter.toLowerCase() + '.' + domain);
  fill(prefix + '_CLIENT_ID', 'staging-demo-' + letter.toLowerCase() + '-' + crypto.randomBytes(8).toString('hex'));
  fill(prefix + '_CLIENT_SECRET', crypto.randomBytes(32).toString('hex'));
  fill(prefix + '_SESSION_SECRET', crypto.randomBytes(32).toString('base64'));
}
const temporary = file + '.' + crypto.randomUUID() + '.tmp';
fs.writeFileSync(temporary, config, { mode: 0o600, flag: 'wx' });
fs.renameSync(temporary, file);
console.log('Demo settings saved; existing configuration and secrets preserved.');
