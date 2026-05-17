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
    'ማንኛውንም የተቆለፈ የ `.ehi` ፋይል (v6.5.0 ጭምር) እዚህ ቻት ላይ ይላኩ ወይም Forward ያድርጉልኝ።'
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

    // 1. ፋይሉን በ ArrayBuffer (Binary) መልክ ማውረድ
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // ባይናሪውን ወደ ፅሁፍ እና ወደ ሄክስ (Hex) መቀየር
    const rawFileData = buffer.toString('utf-8');
    const hexData = buffer.toString('hex');

    let decryptedData = "";
    let isSuccess = false;

    // 2. በ AES ቁልፎች ለመፍታት መሞከር
    for (let key of KEYS) {
      try {
        let cleanData = rawFileData;
        if (rawFileData.startsWith('{')) {
          const parsed = JSON.parse(rawFileData);
          cleanData = parsed.config || rawFileData;
        }
        const bytes = CryptoJS.AES.decrypt(cleanData, key);
        const trialDecrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (trialDecrypted && (trialDecrypted.includes('{') || trialDecrypted.includes('payload'))) {
          decryptedData = trialDecrypted;
          isSuccess = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // 3. አዲሱን v6.5.0 ባይናሪ ለመበርበሪያ የሚሆን Advanced Regex Scan
    let payload = "";
    let sni = "";
    let proxy = "Direct (ባዶ)";

    if (isSuccess && decryptedData) {
      try {
        const configObj = JSON.parse(decryptedData);
        payload = configObj.payload || configObj.configPayload || "";
        sni = configObj.sni || configObj.configHost || "";
        proxy = configObj.remoteProxy || configObj.configRemoteProxy || proxy;
      } catch (e) {
        const pMatch = decryptedData.match(/payload["\s:]["]?([^"\n,]+)/i);
        const sMatch = decryptedData.match(/(sni|host|bug)["\s:]["]?([^"\n,]+)/i);
        if (pMatch) payload = pMatch[1];
        if (sMatch) sni = sMatch[1];
      }
    } else {
      // ፋይሉ በ AES ባይፈታ እንኳ ከባይናሪው ውስጥ የ HTTP ፅሁፎችን ፈልቅቆ ማውጣት
      // የ Payload መደበኛ አጻጻፍ (CONNECT, GET, [netData] ወዘተ) ይፈልጋል
      const payloadRegex = /(CONNECT\s[^]+?\[protocol\]|GET\shttp[^]+?\[crlf\]|CONNECT\s\[host_port\][^]+?\[crlf\])/i;
      const rawPayloadMatch = rawFileData.match(payloadRegex);
      
      if (rawPayloadMatch) {
        payload = rawPayloadMatch[0];
      } else {
        // ሁለተኛ አማራጭ የፓይሎድ ፍለጋ
        const altPayload = rawFileData.match(/[A-Z]+\s.+?HTTP\/1\.[01]/g);
        if (altPayload) payload = altPayload.join('\n');
      }

      // ከባይናሪው ውስጥ የ SNI/Bug (ዌብሳይት) ስሞችን ፈልጎ ማውጫ Regex
      const sniRegex = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|edu|gov|mil|int|info|et|xyz|co|me|live|tk|ml|ga|cf|gq)/gi;
      const domains = rawFileData.match(sniRegex);
      if (domains) {
        // አፕሊኬሽኑ የሚጠቀማቸውን የራሱን ሰርቨሮች ማጽዳት (Filter out)
        const filteredSni = domains.filter(d => 
          !d.includes('github') && 
          !d.includes('google') && 
          !d.includes('injector') && 
          !d.includes('crashlytics') &&
          !d.includes('asbdata')
        );
        if (filteredSni.length > 0) {
          sni = filteredSni[0]; // ትክክለኛውን የመጀመሪያ SNI መውሰድ
        }
      }
    }

    // ጽዳት (ካስፈለገ)
    if (!payload) payload = "ያልተገኘ ወይም በከፍተኛ ሁኔታ የተደበቀ";
    if (!sni) sni = "ያልተገኘ";

    // የመጨረሻውን ውጤት ለተጠቃሚው መላክ
    let resultMessage = `✅ **ፋይሉ በተሳካ ሁኔታ ተሰብሯል!**\n`;
    resultMessage += `📂 **የፋይል ስም:** \`${fileName}\`\n`;
    resultMessage += `───────────────────\n\n`;

    resultMessage += `📡 **Payload:**\n\`${payload}\`\n\n`;
    resultMessage += `🌐 **SNI / Bug Host:** \`${sni}\`\n\n`;
    resultMessage += `⚙️ **Remote Proxy:** \`${proxy}\`\n\n`;

    resultMessage += `───────────────────\n`;
    resultMessage += `🤖 **VPN Decryptor Bot v2.5**`;

    bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
    console.log(`🎯 File ${fileName} parsed successfully.`);

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, '❌ ይቅርታ፣ ይህንን ፋይል መስበር አልቻልኩም! ፋይሉ በአዲስ ጠንካራ ስሪት የተቆለፈ በመሆኑ የደህንነት አልጎሪዝሙን ማለፍ አልተቻለም።');
  }
});

console.log('🔓 Upgraded VPN Decryptor Bot v2.5 Is Online...');
