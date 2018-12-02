'use strict';
const AWS = require('aws-sdk');
const client = new AWS.DynamoDB.DocumentClient();

/**
 * Creates a new reminder and saves it to the database.
 *
 * @param chatId User's chatId
 * @param time Time at which the reminder should be sent
 * @param message Reminder's message
 */
module.exports.createReminder = async (chatId, time, message) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      chat_id: chatId,
      reminder_text: message,
      reminder_time: time.toISOString()
    }
  };

  await client.put(params).promise();
};

/**
 * Retrieves all reminders ofr given chatId from the database.
 *
 * @param chatId User's chatId
 * @returns List of reminders with `reminder_text` and `reminder_time`
 */
module.exports.getReminders = async (chatId) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    KeyConditionExpression: 'chat_id = :cid',
    ExpressionAttributeValues: {
      ':cid': chatId
    },
    ProjectionExpression: 'reminder_text, reminder_time'
  };

  const reminders = await client.query(params).promise();
  return reminders.Items;
};