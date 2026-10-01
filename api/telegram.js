const bot = require('../src/bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) return res.status(401).send('invalid secret');
  }

  try {
    // Telegraf's handleUpdate can accept the raw update object
    await bot.handleUpdate(req.body, res);
    if (!res.writableEnded) res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('error');
  }
};
