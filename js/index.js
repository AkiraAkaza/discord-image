const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
}) 
const GUILD_ID = '827131885653983263';
const CHANNEL_ID = '827138910416011264';
const BASE_URL = 'https://1sex.maulon.vip/';
const VISITED_LINKS_FILE = './visitedLinks.json';

// Đọc file visitedLinks.json
let visitedLinks = [];
if (fs.existsSync(VISITED_LINKS_FILE)) {
  try {
    const data = fs.readFileSync(VISITED_LINKS_FILE, 'utf8');
    visitedLinks = data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Lỗi đọc visitedLinks.json:', err.message);
    visitedLinks = [];
  }
}

// Hàm lưu visitedLinks
function saveVisitedLinks() {
  fs.writeFileSync(VISITED_LINKS_FILE, JSON.stringify(visitedLinks, null, 2));
}

// Hàm chính
async function scanAndSendImages() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.error('Không tìm thấy server!');

  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return console.error('Không tìm thấy kênh!');

  // B1: Truy cập trang chủ
  let htmlLinks = [];
  try {
    const response = await axios.get(BASE_URL);
    const $ = cheerio.load(response.data);
    $('a[href$=".html"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && !htmlLinks.includes(href)) {
        htmlLinks.push(href.startsWith('http') ? href : BASE_URL + href);
      }
    });
    console.log(`Tìm thấy ${htmlLinks.length} link HTML`);
  } catch (err) {
    console.error('Lỗi khi lấy trang chủ:', err.message);
    return;
  }

  // B2: Duyệt từng link
  for (const htmlLink of htmlLinks) {
    if (visitedLinks.includes(htmlLink)) {
      console.log(`Đã ghé thăm: ${htmlLink}, bỏ qua.`);
      continue;
    }

    console.log(`Đang vào: ${htmlLink}`);
    try {
      const response = await axios.get(htmlLink);
      const $ = cheerio.load(response.data);

      let foundImage = false;
      const imgElements = $('img[src$=".jpg"]').toArray();
      for (const el of imgElements) {
        const imgSrc = $(el).attr('src');
        if (imgSrc) {
          const fullImgUrl = imgSrc.startsWith('http') ? imgSrc : BASE_URL + imgSrc;
          console.log(`Gửi hình: ${fullImgUrl}`);
          await channel.send({ files: [fullImgUrl] }); // Gửi ảnh thay vì chỉ link
          foundImage = true;
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      if (!foundImage) {
        console.log(`Không tìm thấy ảnh ở ${htmlLink}, lưu vào visited.`);
      }

      // B3: Đánh dấu link đã duyệt
      visitedLinks.push(htmlLink);
      saveVisitedLinks();
      
    } catch (err) {
      console.error(`Lỗi khi tải ${htmlLink}:`, err.message);
    }
  }
}

// Đăng nhập bot
client.once('ready', () => {
  console.log(`Bot ${client.user.tag} đã online!`);
  // Bắt đầu quét mỗi 5 phút
  setInterval(scanAndSendImages, 5 * 60 * 1000);
});

// Đăng nhập
client.login('');
