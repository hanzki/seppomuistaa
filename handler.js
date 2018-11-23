'use strict';
const rp = require('request-promise');
const dynamoDb = require('./dynamodb');

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

module.exports.hello = async (event, context, callback) => {

    try{
        const data = JSON.parse(event.body);
        const message = data.message.text;
        const chatId = data.message.chat.id;
        const firstName = data.message.chat.first_name;

        let response = `Please /start, ${firstName}`;

        if (message.startsWith("/start")) {
            response = `Hello ${firstName}`;
        }

        if (message.startsWith("/remember")) {
            const params = {
                TableName: process.env.DYNAMODB_TABLE,
                Item: {
                    chat_id: chatId,
                    text: message.split(" ").slice(1).join(" ")
                }
            };
            try {
                await dynamoDb.put(params).promise();
                response = `Alright, I'll keep that in mind.`
            } catch (error) {
                console.error(error);
                callback(null, {
                    statusCode: error.statusCode || 501,
                    headers: { 'Content-Type': 'text/plain' },
                    body: 'Couldn\'t create the todo item.'
                });
            }
        }

        if (message.startsWith("/recall")) {
            const params = {
                TableName: process.env.DYNAMODB_TABLE,
                Key: {
                    chat_id: chatId
                },
                AttributesToGet: [
                    'text'
                ]
            };
            try {
                const data = await dynamoDb.get(params).promise();
                if (data.Item) {
                    response = `You asked me to remember "${data.Item.text}"`;
                } else {
                    response = "Sorry I don't remember anything. Can you remind me with /remember";
                }
            } catch (error) {
                console.error(error);
                callback(null, {
                    statusCode: error.statusCode || 501,
                    headers: { 'Content-Type': 'text/plain' },
                    body: 'Couldn\'t create the todo item.'
                });
            }
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
