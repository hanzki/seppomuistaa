'use strict';
const AWS = require('aws-sdk');
const client = new AWS.DynamoDB.DocumentClient();

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