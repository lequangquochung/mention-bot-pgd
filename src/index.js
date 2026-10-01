// index.js — local polling launcher (keeps polling for dev). Handlers are
// implemented in `src/bot.js` so the same bot instance can be used by serverless
// webhook handler `api/telegram.js`.

require('dotenv').config();
const bot = require('./bot');

if (process.env.USE_WEBHOOK !== '1') {
  bot.launch().then(() => console.log('Bot (polling) running...'));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
