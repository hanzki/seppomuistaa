'use strict';
// Create the telegram api client
const Telegram = require('telegram-bot-api');
const api = new Telegram({
  token: process.env.TELEGRAM_TOKEN
});

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

module.exports.checkReminders = async (event, context) => {
  try {
    const reminders = await remindersService.getDueMessages();

    await Promise.all(reminders.map(async reminder => {
      await api.sendMessage({
        chat_id: reminder.chat_id,
        text: reminder.text
      });
      await remindersService.markReminderSent(reminder.chat_id, reminder.time)
    }));

  } catch (e) {
    console.error(e)
  }
};
