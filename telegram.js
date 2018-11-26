'use strict';
const rp = require('request-promise');

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

module.exports.sendMessage = async (chatId, message) => {
    const messageData = { text: message, chat_id: chatId };
    const url = BASE_URL + "/sendMessage";
    const options = {method: 'POST', url: url, body: messageData, json: true};

    console.log(`Sending message to ${chatId}: "${message}"`);

    await rp(options);
};