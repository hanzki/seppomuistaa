'use strict';
// Create the telegram api client
const Telegram = require('telegram-bot-api');
const api = new Telegram({
  token: process.env.TELEGRAM_TOKEN
});

const moment = require("moment");
const storage = require('./storage');

module.exports.hello = async (event, context) => {
  try {
    // Read data from the incoming message
    const data = JSON.parse(event.body);
    const chatId = data.message.chat.id;
    const message = data.message.text;
    const firstName = data.message.chat.first_name;

    // The first message sent to a Telegram bot is always "/start"
    if (message === "/start") {
      await api.sendMessage({
        chat_id: chatId,
        text: `Nice to meet you, ${firstName}!`
      });
    }
    else if (message.startsWith("/remember")) {
      const delay = Number(message.split(" ")[1]);
      const reminder = message.split(" ").slice(2).join(" ");

      const time = moment().add(delay, "minute");
      await storage.createReminder(chatId, time, reminder);
      await api.sendMessage({
        chat_id: chatId,
        text: `Reminder saved.`
      });
    }
    else if (message.startsWith("/recall")) {
      const reminders = await storage.getReminders(chatId);
      const reminderStrings = reminders.map(r =>
        moment(r.reminder_time).utcOffset(2).format("ddd, MMM Do, H:mm") + ": " + r.reminder_text
      );

      await api.sendMessage({
        chat_id: chatId,
        text: "Your upcoming reminders:\n" + reminderStrings.join("\n")
      });
    }
    // Let's respond with a different response for other messages
    else {
      await api.sendMessage({
        chat_id: chatId,
        text: `Very interesting, ${firstName}`
      });
    }

  } catch (e) {
    // Something went wrong. Let's write it to the log
    console.error(e);
  }

  // For telegram bots it is good to always respond with success code 200 as otherwise the Telegram server will resend the message to our bot
  return {statusCode: 200};
};
