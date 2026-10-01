require('dotenv').config();

// Setup WebSocket polyfill for Node.js v20+ (Supabase realtime needs it)
global.WebSocket = require('ws');

const { Telegraf } = require('telegraf');
const {
  upsertMember,
  setOptOut,
  getTaggableMembers,
  getCooldown,
  setCooldown
} = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ALL_COOLDOWN_SECONDS = Number(process.env.ALL_COOLDOWN_SECONDS || 300);
const MAX_MENTIONS_PER_MESSAGE = Number(process.env.MAX_MENTIONS_PER_MESSAGE || 35);

if (!BOT_TOKEN) {
  throw new Error('Missing BOT_TOKEN in .env');
}

const bot = new Telegraf(BOT_TOKEN);

function isGroupChat(ctx) {
  const type = ctx.chat?.type;
  return type === 'group' || type === 'supergroup';
}

function getFullName(user) {
  const first = user?.first_name || '';
  const last = user?.last_name || '';
  return `${first} ${last}`.trim() || user?.username || String(user?.id || 'Unknown');
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mentionHtml(userId, displayName) {
  return `<a href="tg://user?id=${userId}">${escapeHtml(displayName)}</a>`;
}

function buildMentionBatches(members, maxPerMessage) {
  const chunks = [];
  for (let i = 0; i < members.length; i += maxPerMessage) {
    chunks.push(members.slice(i, i + maxPerMessage));
  }

  return chunks.map((chunk, index) => {
    const mentions = chunk.map((m) => mentionHtml(m.user_id, m.full_name)).join(' • ');
    return `<b>@all (${index + 1}/${chunks.length})</b>\n${mentions}`;
  });
}

async function trackUser(ctx, user) {
  if (!ctx.chat?.id || !user?.id) return;
  await upsertMember({
    chatId: ctx.chat.id,
    userId: user.id,
    username: user.username,
    fullName: getFullName(user)
  });
}

// Debug middleware: log incoming updates for troubleshooting
bot.use((ctx, next) => {
  try {
    const from = ctx.from ? `${ctx.from.id} ${getFullName(ctx.from)}` : 'n/a';
    console.log(new Date().toISOString(), 'updateType=', ctx.updateType, 'chat=', ctx.chat?.id, 'from=', from);
  } catch (err) {
    console.error('Logging middleware error', err);
  }
  return next();
});

bot.start((ctx) => ctx.reply('Bot đã sẵn sàng. Thêm bot vào group và dùng /all.'));

bot.on('message', async (ctx, next) => {
  if (isGroupChat(ctx) && ctx.from) {
    trackUser(ctx, ctx.from);
  }

  if (ctx.message?.new_chat_members?.length) {
    for (const user of ctx.message.new_chat_members) {
      trackUser(ctx, user);
    }
  }

  return next();
});

bot.command('optout', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  if (!ctx.from) return;

  await trackUser(ctx, ctx.from);
  await setOptOut({ chatId: ctx.chat.id, userId: ctx.from.id, isOptedOut: false });
  await ctx.reply('Bạn đã tắt nhận tag từ /all trong group này.');
});

bot.command('optin', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  if (!ctx.from) return;

  await trackUser(ctx, ctx.from);
  await setOptOut({ chatId: ctx.chat.id, userId: ctx.from.id, isOptedOut: false });
  await ctx.reply('Bạn đã bật lại nhận tag từ /all trong group này.');
});

bot.command('all', async (ctx) => {
  if (!isGroupChat(ctx)) {
    await ctx.reply('Lệnh này chỉ dùng trong group.');
    return;
  }

  if (!ctx.from) return;

  trackUser(ctx, ctx.from);

  // Allow everyone to use /all. Cooldown still applies to prevent spam.

  const now = Date.now();
  const nextAvailableAt = await getCooldown(ctx.chat.id, 'all');
  if (now < nextAvailableAt) {
    const waitSec = Math.ceil((nextAvailableAt - now) / 1000);
    await ctx.reply(`Vui lòng đợi ${waitSec}s rồi thử lại /all.`);
    return;
  }

  const members = (await getTaggableMembers(ctx.chat.id)).filter((m) => m.user_id !== ctx.botInfo.id);
  if (members.length === 0) {
    await ctx.reply('Chưa có member nào trong danh sách. Mọi người hãy nhắn 1 tin để bot ghi nhận.');
    return;
  }

  await setCooldown(ctx.chat.id, 'all', now + ALL_COOLDOWN_SECONDS * 1000);

  const batches = buildMentionBatches(members, MAX_MENTIONS_PER_MESSAGE);
  for (const text of batches) {
    await ctx.reply(text, { parse_mode: 'HTML', disable_web_page_preview: true });
  }
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

module.exports = bot;
