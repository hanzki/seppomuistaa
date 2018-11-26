'use strict';
const rp = require('request-promise');
const moment = require('moment');
const remindersService = require('./reminders');

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
            const time = moment().add(Number(message.split(" ")[1]), "minute");
            const text = message.split(" ").slice(2).join(" ");

            try {
                await remindersService.createReminder(chatId, time, text);
                response = `Alright, I'll keep that in mind.`
            } catch (error) {
                console.error(error);
            }
        }

        if (message.startsWith("/recall")) {
            try {
                const reminders = await remindersService.getUpcoming(chatId);
                if (reminders.length) {
                    response = "Your upcoming reminders:\n" +  reminders.map(i => moment(i.time).utcOffset(2).format("ddd, MMM Do, H:mm") + ": " + i.text).join("\n");
                } else {
                    response = "There are no upcoming reminders. You can create one with /remember";
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

module.exports.checkReminders = async (event, context) => {
    try {
        const reminders = await remindersService.getDueMessages();

        await Promise.all(reminders.map(async reminder => {
            const messageData = { text: reminder.text, chat_id: reminder.chat_id };
            const url = BASE_URL + "/sendMessage";
            const options = {method: 'POST', url: url, body: messageData, json: true};

            console.log(`Sending reminder to ${reminder.chat_id} with text "${reminder.text}"`);
            await rp(options);

            await remindersService.markReminderSent(reminder.chat_id, reminder.time)
        }));

    } catch (e) {
        console.error(e)
    }
};
