const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const axios = require('axios');

// ያቀረብከው አዲሱ ቦት ቶከን
const token = '8263214428:AAGTU_nJon1yoj_Nkd1gOtF4CidqCT6PFW0';
const bot = new TelegramBot(token, { polling: true });

// HTTP Injector ፋይሎችን ለመስበር የሚያገለግል ስታንዳርድ የደህንነት ቁልፍ (Salt Key)
const EHI_SECRET_KEY = "662ede816988e58fb6d057d9d85605e0"; 

// ============================================
// /START COMMAND
// ============================================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const welcomeMessage = 
    '🔓 **እንኳን ወደ VPN Decryptor Bot በሰላም መጡ!**\n\n' +
    'የተቆለፉ የ `.ehi` (HTTP Injector) ፋይሎችን ሰብሬ Payload እና መረጃዎችን ለማውጣት ዝግጁ ነኝ።\n\n' +
    '📥 **አጠቃቀም:**\n' +
    'ማንኛውንም የተቆለፈ የ `.ehi` ፋይል እዚህ ቻት ላይ ይላኩ ወይም Forward ያድርጉልኝ።';
    
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  console.log(`🚀 Bot started by user: ${chatId}`);
});

// ============================================
// EHI FILE DECRYPTION HANDLER
// ============================================
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  // ፋይሉ .ehi መሆኑን ማረጋገጥ
  if (!fileName.endsWith('.ehi')) {
    bot.sendMessage(chatId, '⚠️ ይቅርታ፣ ይህ ቦት የ `.ehi` (HTTP Injector) ፋይሎችን ብቻ ነው የሚቀበለው። እባክዎ ትክክለኛ ፋይል ይላኩ።');
    return;
  }

  try {
    bot.sendMessage(chatId, '⚡ ፋይሉን በመቀበል ላይ... እባክዎ ጥቂት ሰከንዶች ይጠብቁ።');
    bot.sendChatAction(chatId, 'typing');

    // ፋይሉን ከቴሌግራም ሰርቨር ማውረድ
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'text' });
    const rawFileData = response.data;

    let decryptedData = "";
    
    // የዲክሪፕሽን ስራ (Decryption Logic)
    try {
      const parsedJson = JSON.parse(rawFileData);
      
      // የ .ehi ፋይል ዋናው የተቆለፈ ክፍል "config" ይባላል
      if (parsedJson.config) {
        const bytes = CryptoJS.AES.decrypt(parsedJson.config, EHI_SECRET_KEY);
        decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      } else {
        decryptedData = rawFileData;
      }
    } catch (e) {
      // በ JSON ፎርማት ካልመጣ በቀጥታ በ AES ለመፍታት መሞከር
      try {
        const bytes = CryptoJS.AES.decrypt(rawFileData, EHI_SECRET_KEY);
        decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      } catch (err) {
        throw new Error("ኢንክሪፕሽኑን መስበር አልተቻለም።");
      }
    }

    if (!decryptedData) {
      throw new Error("የተሰበረው መረጃ ባዶ ነው።");
    }

    // የተሰበረውን መረጃ መለየት (Parsing)
    let configObj = {};
    try {
      configObj = JSON.parse(decryptedData);
    } catch(e) {
      configObj = { rawConfig: decryptedData };
    }

    // ውጤቱን ለተጠቃሚው ማዘጋጀት
    let resultMessage = `✅ **ፋይሉ በተሳካ ሁኔታ ተሰብሯል!**\n`;
    resultMessage += `📂 **የፋይል ስም:** \`${fileName}\`\n`;
    resultMessage += `───────────────────\n\n`;

    // Payload መኖር አለመኖሩን ማረጋገጥ
    if (configObj.payload || configObj.configPayload) {
      resultMessage += `📡 **Payload:**\n\`${configObj.payload || configObj.configPayload}\`\n\n`;
    }
    
    // SNI / Host (Bug) መኖር አለመኖሩን ማረጋገጥ
    if (configObj.sni || configObj.configHost) {
      resultMessage += `🌐 **SNI / Bug Host:** \`${configObj.sni || configObj.configHost}\`\n\n`;
    }
    
    // Proxy መኖር አለመኖሩን ማረጋገጥ
    if (configObj.remoteProxy || configObj.configRemoteProxy) {
      resultMessage += `⚙️ **Remote Proxy:** \`${configObj.remoteProxy || configObj.configRemoteProxy}\`\n\n`;
    }
    
    // የውስጥ ይዘት (Raw Data) ካለው ለይቶ ማሳየት
    if (configObj.rawConfig) {
      resultMessage += `📝 **የውስጥ ይዘት (Raw Data):**\n\`${configObj.rawConfig.substring(0, 800)}\`\n`;
    }

    resultMessage += `───────────────────\n`;
    resultMessage += `🤖 **VPN Decryptor Bot**`;

    bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
    console.log(`🎯 File ${fileName} decrypted successfully for user ${chatId}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    bot.sendMessage(chatId, '❌ ይቅርታ፣ ይህንን ፋይል መስበር አልቻልኩም! ፋይሉ በከፍተኛ አዲስ ስሪት የተቆለፈ ሊሆን ይችላል ወይም አልጎሪዝሙ አልሰራም።');
  }
});

// ============================================
// STARTUP LOG
// ============================================
console.log('====================================');
console.log('🔓 VPN Decryptor Bot Is Online...');
console.log('📡 Listening for .ehi files...');
console.log('====================================');
