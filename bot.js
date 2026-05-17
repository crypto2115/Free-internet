const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const axios = require('axios');

const token = '8263214428:AAGTU_nJon1yoj_Nkd1gOtF4CidqCT6PFW0';
const bot = new TelegramBot(token, { polling: true });

// በብዛት ጥቅም ላይ የሚውሉ የኢንጀክተር መፍቻ ቁልፎች (Salt Keys)
const KEYS = [
  "662ede816988e58fb6d057d9d85605e0", // የድሮው ስታንዳርድ ቁልፍ
  "12345678901234567890123456789012",
  "662ede816988e58fb6d057d9d856"
];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '🔓 **እንኳን ወደ VPN Decryptor Bot በሰላም መጡ!**\n\n' +
    'ይህ ቦት አዲሶቹን የ v6.5.0 ስሪቶች ጨምሮ የ `.ehi` ፋይሎችን ለመስበር የተዘጋጀ ነው።\n\n' +
    '📥 **አጠቃቀም:**\n' +
    'ማንኛውንም የተቆለፈ የ `.ehi` ፋይል እዚህ ቻት ላይ ይላኩ ወይም Forward ያድርጉልኝ።'
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

    // ፋይሉን ማውረድ
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'text' });
    const rawFileData = response.data;

    let decryptedData = "";
    let isSuccess = false;

    // 1. መጀመሪያ ፋይሉ ውስጥ የጽሑፍ መረጃዎች ካሉ በቀጥታ ለመፈተሽ መሞከር
    if (rawFileData.includes("payload") || rawFileData.includes("configPayload")) {
      decryptedData = rawFileData;
      isSuccess = true;
    }

    // 2. የ AES ቁልፎችን በየተራ በመጠቀም ለመስበር መሞከር
    if (!isSuccess) {
      for (let key of KEYS) {
        try {
          let cleanData = rawFileData;
          if (rawFileData.startsWith('{')) {
            const parsed = JSON.parse(rawFileData);
            cleanData = parsed.config || rawFileData;
          }
          
          const bytes = CryptoJS.AES.decrypt(cleanData, key);
          const trialDecrypted = bytes.toString(CryptoJS.enc.Utf8);
          
          if (
