require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const GUILD_ID = '827131885653983263';
const CHANNEL_ID = '1382740172688330794';
const BASE_URL = 'https://www.photos18.com';
const VISITED_FILE = './visitedLinks.json';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const http = axios.create({
  timeout: 15000,
  withCredentials: true,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

let BASE_DELAY = 15000;      // delay mặc định
let CURRENT_DELAY = BASE_DELAY;
const MAX_DELAY = 120000;   // 2 phút

const delay = ms => new Promise(r => setTimeout(r, ms));

function backoff() {
  CURRENT_DELAY = Math.min(CURRENT_DELAY * 2, MAX_DELAY);
  console.log(`🐢 Backoff → delay = ${CURRENT_DELAY / 1000}s`);
}

function recoverSpeed() {
  CURRENT_DELAY = Math.max(BASE_DELAY, CURRENT_DELAY * 0.8);
}

let visited = [];
if (fs.existsSync(VISITED_FILE)) {
  try {
    visited = JSON.parse(fs.readFileSync(VISITED_FILE, 'utf8'));
  } catch {
    visited = [];
  }
}

function saveVisited() {
  fs.writeFileSync(VISITED_FILE, JSON.stringify(visited, null, 2));
}

async function crawlAndSend() {
  console.log('🔍 Quét trang chủ...');

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  let pages = [];

  /* ===== STEP 1: HOMEPAGE ===== */
  try {
    const home = await http.get(BASE_URL + '/');
    const $ = cheerio.load(home.data);

    $('div.card-body.p-2 a[href^="/v/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) pages.push(BASE_URL + href);
    });

    pages = [...new Set(pages)].slice(0, 3); // ⚠️ giới hạn an toàn
    console.log(`➡️ Tìm thấy ${pages.length} trang con`);
    recoverSpeed();

  } catch (err) {
    if (err.response?.status === 403) backoff();
    console.log('❌ Lỗi trang chủ:', err.response?.status || err.message);
    return;
  }

  /* ===== STEP 2: SUB PAGES ===== */
  for (const pageUrl of pages) {
    if (visited.includes(pageUrl)) {
      console.log(`⏭️ Đã xử lý: ${pageUrl}`);
      continue;
    }

    console.log(`📄 Vào: ${pageUrl}`);

    try {
      const res = await http.get(pageUrl);
      const $ = cheerio.load(res.data);

      let images = [];
      $('img[src*="img.photos18.com"]').each((_, img) => {
        let src = $(img).attr('src');
        if (src) images.push(src.split('?')[0]);
      });

      if (!images.length) {
        console.log('⚠️ Không có ảnh');
        visited.push(pageUrl);
        saveVisited();
        continue;
      }

      console.log(`🖼️ ${images.length} ảnh`);

      /* ===== SEND TO DISCORD ===== */
      for (let i = 0; i < images.length; i += 10) {
        await channel.send({ files: images.slice(i, i + 10) });
        await delay(60000);   // 1 phút
      }

      visited.push(pageUrl);
      saveVisited();
      recoverSpeed();

    } catch (err) {
      if (err.response?.status === 403) {
        console.log('🚫 403 → nghỉ lâu');
        backoff();
        await delay(CURRENT_DELAY);
        break;
      } else {
        console.log('❌ Lỗi trang con:', err.message);
      }
    }

    console.log(`⏳ Nghỉ ${CURRENT_DELAY * 1000}s`);
    await delay(CURRENT_DELAY);
  }
}

client.once('clientReady', () => {
  console.log(`🤖 Bot online: ${client.user.tag}`);
  crawlAndSend();
  setInterval(crawlAndSend, 15 * 60 * 1000); // 15 phút
});

client.login(process.env.DISCORD_TOKEN);
