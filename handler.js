'use strict';
const rp = require('request-promise');

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

module.exports.hello = async (event, context) => {

    try{
        const data = JSON.parse(event.body);
        const message = data.message.text;
        const chatId = data.message.chat.id;
        const firstName = data.message.chat.first_name;

        let response = `Please /start, ${firstName}`;

        if (message.includes("start")) {
            response = `Hello ${firstName}`;
        }

        const responseData = { text: response, chat_id: chatId };
        const url = BASE_URL + "/sendMessage";
        const options = {method: 'POST', url: url, body: responseData, json: true};

        console.log("options", options);
        await rp(options);
        console.log("all sent!");

    } catch (e) {
        console.error(e);
        console.log("Horrible things happenend!", e)
    }

    return {statusCode: 200};
};
