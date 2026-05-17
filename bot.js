const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const axios = require('axios');

const token = '8263214428:AAGTU_nJon1yoj_Nkd1gOtF4CidqCT6PFW0';
const bot = new TelegramBot(token, { polling: true });

const KEYS = [
  "662ede816988e58fb6d057d9d85605e0",
  "12345678901234567890123456789012"
];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '🔓 **እንኳን ወደ VPN Decryptor Bot በሰላም መጡ!**\n\n' +
    'ማንኛውንም የተቆለፈ የ `.ehi` ፋይል (አዲሱን v6.5.0 ጭምር) እዚህ ይላኩ ወይም Forward ያድርጉልኝ።'
  , { parse_mode: 'Markdown' });
});

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  if (!fileName.endsWith('.ehi')) {
    bot.sendMessage(chatId, '⚠️ እባክዎ የ `.ehi` ፋይል ብቻ ይላኩ።');
    return;
  }

  try {
    bot.sendMessage(chatId, '⚡ ፋይሉን በመቀበል ላይ... እባክዎ ጥቂት ሰከንዶች ይጠብቁ።');
    bot.sendChatAction(chatId, 'typing');

    // 1. ፋይሉን በ ArrayBuffer (ባይናሪ) መልክ ማውረድ
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // 2. ባይናሪውን ወደ ንጹህ ሊነበብ ወደሚችል ቴክስት መቀየር (የማይነበቡትን ምልክቶች ማጥፋት)
    let cleanText = "";
    for (let i = 0; i < buffer.length; i++) {
      const charCode = buffer[i];
      // ሊነበቡ የሚችሉ የ ASCII ቁምፊዎችን ብቻ መውሰድ (ፊደላት፣ ቁጥሮች እና ምልክቶች)
      if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
        cleanText += String.fromCharCode(charCode);
      } else {
        cleanText += " "; // የማይነበቡትን በባዶ ቦታ መተካት
      }
    }

    let payload = "";
    let sni = "";
    let proxy = "Direct (ባዶ)";

    // 3. የ Payload ፍለጋ (በጣም የተለመዱትን የቪፒኤን ፎርማቶች በሙሉ መፈለግ)
    const payloadRegex = /(CONNECT\s.+?\[crlf\]|GET\shttp.+?\[crlf\]|POST\shttp.+?\[crlf\]|[A-Z]+\s\[host_port\].+?\[crlf\])/i;
    const matchPayload = cleanText.match(payloadRegex);

    if (matchPayload) {
      payload = matchPayload[0].trim();
    } else {
      // ሁለተኛ አማራጭ ፍለጋ (በመስመር)
      const lines = cleanText.split('\n');
      for (let line of lines) {
        if (line.includes('CONNECT') || line.includes('[protocol]') || line.includes('[host_port]') || line.includes('HTTP/1.')) {
          payload += line.trim() + "\n";
        }
      }
    }

    // 4. የ SNI / Bug Host ፍለጋ (ዌብሳይቶችን መለየት)
    const urlRegex = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|edu|gov|et|xyz|co|me|live|info|tk|cf|gq)/gi;
    const domains = cleanText.match(urlRegex);
    
    if (domains) {
      // የአፕሊኬሽኑን የውስጥ ሰርቨሮች ማጣራት (Filter out)
      const filtered = domains.filter(d => 
        !d.includes('github') && 
        !d.includes('google') && 
        !d.includes('injector') && 
        !d.includes('crashlytics') && 
        !d.includes('asbdata') &&
        !d.includes('app-measurement')
      );
      if (filtered.length > 0) {
        sni = filtered[0]; // የመጀመሪያውን ትክክለኛ SNI መውሰድ
      }
    }

    // 5. ፕሮክሲ ፍለጋ (ቁጥሮች ከነ ፖርት ካሉ)
    const proxyRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b/g;
    const proxyMatch = cleanText.match(proxyRegex);
    if (proxyMatch) {
      proxy = proxyMatch[0];
    }

    // ጽዳት
    if (!payload) payload = "ያልተገኘ (ወይም በከፍተኛ ሁኔታ የተመሰጠረ)";
    if (!sni) sni = "ያልተገኘ";

    // 6. ውጤቱን ለተጠቃሚው መላክ
    let resultMessage = `✅ **ፋይሉ በተሳካ ሁኔታ ተሰብሯል!**\n`;
    resultMessage += `📂 **የፋይል ስም:** \`${fileName}\`\n`;
    resultMessage += `───────────────────\n\n`;

    resultMessage += `📡 **Payload:**\n\`${payload}\`\n\n`;
    resultMessage += `🌐 **SNI / Bug Host:** \`${sni}\`\n\n`;
    resultMessage += `⚙️ **Remote Proxy:** \`${proxy}\`\n\n`;

    resultMessage += `───────────────────\n`;
    resultMessage += `🤖 **VPN Decryptor Bot v3.0**`;

    bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
    console.log(`🎯 File ${fileName} parsed cleanly.`);

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, '❌ ይቅርታ፣ ይህንን ፋይል መስበር አልቻልኩም! ፋይሉ ላይ ስህተት ተከስቷል።');
  }
});

console.log('🔓 Upgraded VPN Decryptor Bot v3.0 Is Online...');
