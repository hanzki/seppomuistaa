'use strict';
const rp = require('request-promise');
const moment = require('moment');
const dynamoDb = require('./dynamodb');

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

module.exports.hello = async (event, context) => {

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
            let time, text;
            if(! isNaN(message.split(" ")[1])) {
                time = moment().add(Number(message.split(" ")[1]), "minute");
                text = message.split(" ").slice(2).join(" ");
            } else {
                time = moment().add(5, "minute");
                text = message.split(" ").slice(1).join(" ");
            }
            const params = {
                TableName: process.env.DYNAMODB_TABLE,
                Item: {
                    chat_id: chatId,
                    text: text,
                    time: time.toISOString()
                }
            };
            try {
                await dynamoDb.put(params).promise();
                response = `Alright, I'll keep that in mind.`
            } catch (error) {
                console.error(error);
            }
        }

        if (message.startsWith("/recall")) {
            const params = {
                TableName: process.env.DYNAMODB_TABLE,
                KeyConditionExpression: 'chat_id = :cid',
                ExpressionAttributeValues: {
                    ':cid': chatId
                },
                ExpressionAttributeNames: {
                    '#text': 'text',
                    '#time': 'time'
                },
                ProjectionExpression: '#text, #time'
            };
            try {
                const data = await dynamoDb.query(params).promise();
                if (data) {
                    response = "Your upcoming reminders:\n" +  data.Items.map(i => moment(i.time).format("ddd, MMM Do, H:mm") + ": " + i.text).join("\n");
                } else {
                    response = "Sorry I don't remember anything. Can you remind me with /remember";
                }
            } catch (error) {
                console.error(error);
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
