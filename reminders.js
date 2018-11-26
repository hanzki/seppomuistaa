'use strict';
const moment = require('moment');
const dynamoDb = require('./dynamodb');

module.exports.getUpcoming = async (chatId) => {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        KeyConditionExpression: 'chat_id = :cid and #time > :now',
        ExpressionAttributeValues: {
            ':cid': chatId,
            ':now': moment().toISOString()
        },
        ExpressionAttributeNames: {
            '#text': 'text',
            '#time': 'time'
        },
        ProjectionExpression: '#text, #time, sent'
    };
    try {
        const data = await dynamoDb.query(params).promise();
        return data.Items;

    } catch (error) {
        console.error("DynamoDB error: " + error);
        throw error;
    }
};

module.exports.createReminder = async (chatId, time, message) => {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Item: {
            chat_id: chatId,
            text: message,
            time: time.toISOString(),
            sent: false
        }
    };
    try {
        await dynamoDb.put(params).promise();
    } catch (error) {
        console.error("DynamoDB error: " + error);
        throw error;
    }
};

module.exports.getDueMessages = async () => {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        FilterExpression: '#time <= :now and (attribute_not_exists(sent) or sent = :not_sent)',
        ExpressionAttributeValues: {
            ':now': moment().toISOString(),
            ':not_sent': false
        },
        ExpressionAttributeNames: {
            '#text': 'text',
            '#time': 'time'
        },
        ProjectionExpression: 'chat_id, #text, #time, sent'
    };
    try {
        const data = await dynamoDb.scan(params).promise();
        return data.Items;

    } catch (error) {
        console.error("DynamoDB error: " + error);
        throw error;
    }
};

module.exports.markReminderSent = async (chatId, time) => {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: { chat_id : chatId, time: time },
        UpdateExpression: 'set sent = :sent',
        ExpressionAttributeValues: {
            ':sent' : true
        }
    };
    try {
        await dynamoDb.update(params).promise();
    } catch (error) {
        console.error("DynamoDB error: " + error);
        throw error;
    }
};