'use strict';
const moment = require('moment');
const remindersService = require('./reminders');
const telegramClient = require('./telegram');

const instructions = "You can ask me to remind you when you need it.\n" +
    "Available commands:\n" +
    "/remember [minutes] [message] - sends you a reminder with the [message] after [minutes] minutes. eg. /remember 5 Get back to work\n" +
    "/recall - gives you a list of upcoming reminders";

module.exports.hello = async (event, context) => {

    const data = JSON.parse(event.body);
    const chatId = data.message.chat.id;
    const message = data.message.text;
    const command = message.split(" ")[0];
    const params = message.split(" ").slice(1);

    try{
        if (command === "/start") {
            await telegramClient.sendMessage(chatId, `Hello ${data.message.chat.first_name}\n` + instructions);
        }
        else if (command === "/remember" && params.length >= 2 && Number.isFinite(Number(params[0]))) {
            const time = moment().add(Number(params[0]), "minute");
            const text = params.slice(1).join(" ");

            await remindersService.createReminder(chatId, time, text);
            await telegramClient.sendMessage(chatId, `Alright, I'll keep that in mind.`);
        }
        else if (command === "/recall") {
            const reminders = await remindersService.getUpcoming(chatId);
            let response;
            if (reminders.length) {
                response = "Your upcoming reminders:\n" +  reminders.map(i => moment(i.time).utcOffset(2).format("ddd, MMM Do, H:mm") + ": " + i.text).join("\n");
            } else {
                response = "There are no upcoming reminders. You can create one with /remember";
            }

            await telegramClient.sendMessage(chatId, response);
        }
        else {
            await telegramClient.sendMessage(chatId, instructions);
        }
    } catch (e) {
        console.error(e);
        await telegramClient.sendMessage(chatId, "An error occured");
    }

    return {statusCode: 200};
};

module.exports.checkReminders = async (event, context) => {
    try {
        const reminders = await remindersService.getDueMessages();

        await Promise.all(reminders.map(async reminder => {
            await telegramClient.sendMessage(reminder.chat_id, reminder.text);
            await remindersService.markReminderSent(reminder.chat_id, reminder.time)
        }));

    } catch (e) {
        console.error(e)
    }
};
