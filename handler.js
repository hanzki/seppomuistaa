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
    // Create new reminder when user send "/remind" command
    else if (message.startsWith("/remind")) {
      // first word after "/remind" should be the number of minutes
      const delay = Number(message.split(" ")[1]);
      // here split the message to words, drop first 2 words and then join them back together to get the reminder text
      const reminder = message.split(" ").slice(2).join(" ");

      // calculate when the reminder should be sent by adding delay minutes to current time
      const time = moment().add(delay, "minute");
      // save the reminder to database
      await storage.createReminder(chatId, time, reminder);

      // let the user know that the reminder was saved
      await api.sendMessage({
        chat_id: chatId,
        text: `Reminder saved.`
      });
    }
    // List existing reminders when user sends "/list" command
    else if (message.startsWith("/list")) {
      // fetch all reminders for this chat
      const reminders = await storage.getReminders(chatId);

      // convert reminders to strings (eg. "Sun, Dec 2nd, 12:24: Get up")
      const reminderStrings = reminders.map(r =>
        moment(r.reminder_time).utcOffset(2).format("ddd, MMM Do, H:mm") + ": " + r.reminder_text
      );

      // send user the list of reminders
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
