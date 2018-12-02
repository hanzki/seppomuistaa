# Serverless Chatbot: Part Two

In this part we will modify our chatbot created in [Part 1](./part-1-instructions.md) to do something useful.

## Prerequisites

You should have completed the [Part 1](./part-1-instructions.md) of this tutorial and have the following:
* Serverless chatbot deployed to AWS
* The chatbot registered with Telegram

## Goal of part Two

Our goal here is make our chatbot into a virtual assistant that can remember things for us. We should also
be able to request our assistant to remind us at specified time.

## Instructions

### 1. Adding a place to store data

So far our chatbot uses only the AWS Lambda functions which cannot store any data from one invokation to another. So in
order to give our bot a memory we need to integrate it to some sort of external data store. Luckily AWS offers many
solutions for this. In this example we will be using AWS DynamoDB database.

DynamoDB is a serverless NoSQL database. What this means is that we can store all kinds of data there and don't need
to worry setting up or maintaining servers. Also the Free Tier limits for DynamoDB are quite high (up to 25GB of
data storage) so using DynamoDB is basically free until our application grows large.

We can create a new DynamoDB table by adding this cloudformation specification to the end of our `serverless.yml` file.
Cloudformation is the AWS infarstructure automation tool which Serverless Framework uses behind the scenes to create and
manage the resources in AWS.

```yaml
resources:
  Resources:
    usersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.DYNAMODB_TABLE}
        AttributeDefinitions:
          - AttributeName: chat_id
            AttributeType: N
          - AttributeName: reminder_time
            AttributeType: S
        KeySchema:
          - AttributeName: chat_id
            KeyType: HASH
          - AttributeName: reminder_time
            KeyType: RANGE
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
```

DynamoDB is a "schemaless" database. This means that we don't need to define what kind of data we are going to store
before saving data to the database. Exception to this is that every data item in DynamoDB has to have an unique identifier
which needs to be defined when creating the DynamoDB table.

Here we create a table for storing reminders we want our chatbot to remmeber. Each reminder is identified by the
Telegram chat id (main identifier which is called "HASH KEY") and reminder's time (secondary identifier called "RANGE KEY").
This design has the drawback that our assistant cannot remember two reminders for the same chat and exact time, but simplifies
this tutorial.

The name of the table comes from an environmental variable that we need to define in the `provider` section of `serverless.yml`.
Also as AWS works on the principle of "secure by default" we need to explicitly grant our lambda function access to the
DynamoDB table we created. This is done by defining a "IAM role" in the `provider` section which defines which actions
our lambda functions are allowed to take inside the AWS. Update the `provider` section to look like this:

```yaml
provider:
  name: aws
  runtime: nodejs8.10
  environment:
      TELEGRAM_TOKEN: ${env:TELEGRAM_TOKEN}
      DYNAMODB_TABLE: ${self:service}-${opt:stage, self:provider.stage}
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:Query
        - dynamodb:Scan
        - dynamodb:GetItem
        - dynamodb:PutItem
        - dynamodb:UpdateItem
        - dynamodb:DeleteItem
      Resource: "arn:aws:dynamodb:${opt:region, self:provider.region}:*:table/${self:provider.environment.DYNAMODB_TABLE}"
```

With this in place our DynamoDB table will be created the next time we run `serverless deploy`. However, an empty database
is no fun if our chatbot doesn't do anything with it. Next we'll see how to integrate the database into our chatbot.

### 2. Giving our chatbot a memory

Our chatbot running in the AWS Lambda needs to be able to talk with the DynamoDB database. This can be done with the
[AWS SDK for javascript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/index.html), conveniently it is already pre-installed in
the Lambda environment which nice.

In order to keep our code a bit more organised let's create a new file called `storage.js` for our DynamoDB related code.
In the new file let's first import and initialised the DynamoDB client:

```node
'use strict';
const AWS = require('aws-sdk');
const client = new AWS.DynamoDB.DocumentClient();
```

If you want to test running DynamoDB locally it is possible to provide a local DynamoDB endpoint
inside an object to the constructor method (example: `new AWS.DynamoDB.DOcumentClient({region: 'localhost', endpoint: 'http://localhost:8000'})`).
You can read more about local serverless development [here](https://medium.com/a-man-with-no-server/running-aws-lambda-and-api-gateway-locally-serverless-offline-3c64b3e54772),
but for now let's continue with the tutorial.

Next, let's add a method for creating a new reminder and saving it to the database:

```node
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
      reminder_time: time.toISOString(),
      reminder_text: message
    }
  };

  await client.put(params).promise();
};
```

**NOTE:** DynamoDB has a long list of "reserved words" which should be avoided in attribute names as using them needlessly
complicates the API calls. Here we chose to use `reminder_time` and `reminder_text` instead of `time` and `text` as the latter two
are both "reserved words" in DynamoDB.

Now that we have a way to save reminders to the database we also need a way to retrieve what we have saved. Let's add another method
to `storage.js`:

```node
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
```

Now that we have both a method for saving a new reminder to the database and for retrieving the previously saved reminders
we can add some new functionality to our bot.

So let's open up `handler.js` and get to work. First we'll be importing the `storage.js` module we wrote. We are also
adding a library called [Moment.js](https://momentjs.com/) which helps us in dealing with time values. Add these rows before
the start of `module.exports.hello = ...`:

```node
const moment = require("moment");
const storage = require('./storage');
```

We also need to download Moment.js from the NPM:

```bash
npm install moment
```

Then let's make our bot to respond to couple new commands. We want to add two new commands. Firstly, `/remind X message` which would
makes the bot create a new reminder for `X` minutes from now with the `message` as the reminder text (eg. `/remind 5 Get up` would make
the bot send a message "Get up" to us after 5 minutes). Secondly, we want a `/list` command which shows a list of upcoming reminders.

Currently our bot can distinquish only between the `/start` command and other messages. Let's change the logic to add our new messages:

```node
    // The first message sent to a Telegram bot is always "/start"
    if (message === "/start") {
      await api.sendMessage({
        chat_id: chatId,
        text: `Nice to meet you, ${firstName}!`
      });
    }
    // ##### NEW CODE STARTS HERE #####
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
    // ##### NEW CODE ENDS HERE #####
    // Let's respond with a different response for other messages
    else {
      await api.sendMessage({
        chat_id: chatId,
        text: `Very interesting, ${firstName}`
      });
    }
```

Now that's a bit more code. In the `/remind` command we do first a bit of parameter parsing, then calculate the time
for the reminder and save it to the database, and finally respond to the user. In the `/list` command we retrieve the list
of reminders, format them to a easily readable form, and display the list to the user. Note the use of `.utcOffset(2)` as
the times are saved in the UTC time zone but our users are in Finland (UTC+2:00) so we need to adjust the times before
displaying them. Sadly Telegram API doesn't share the user's time zone so it is basically impossible to automatically
localize times to the user's local time.

Now we are finally ready to update our chatbot. Run again:

```bash
serverless deploy
```

You can open Telegram and test the new `/remind` and `/list` commands. Great our bot can now remember things for us!
However, after a while you might notice that our virtual assistant seems to be sleeping on the wheel as he doesn't
send us the reminders no matter how long we wait. We'll be fixing this next.

### 3. Adding scheduled functions

So far our chatbot has been running with the power of just one lambda function. Our lambda has been also always triggered
directly by the user interacting with our bot. However, AWS Lambdas can do much more. There are many different kinds of
events that can be configured to trigger lambda functions which then can do all kinds of awesome things.

What we want here is a way for the lambda to run when a reminder needs to be sent to the user. For this the best choice
is to use Amazon CloudWatch schedules. We can create a schedule that activates a lambda function periodically or at
some specific time. We want our reminders to be sent accurately at the requested time so we can use a periodic schedule
with a short period like 1 minute.

Running our function once a minute even when there is no messages to be sent might sound wasteful. That means over 40000 requests
per month! However, when taking in account that AWS offers 1 million requests per month for free it is basically peanuts.

So let's get to work! Firstly, we need new functionalities for our storage module. So let's add these two methods to the
`storage.js`:

```node
/**
 * Retrieves all reminders that are ready to be sent (reminder_time < current time)
 * @returns List of reminders with `chat_id`, `reminder_text` and `reminder_time`
 */
module.exports.getDueReminders = async () => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    FilterExpression: 'reminder_time <= :now',
    ExpressionAttributeValues: {
      ':now': moment().toISOString()
    },
    ProjectionExpression: 'chat_id, reminder_text, reminder_time'
  };

  const data = await dynamoDb.scan(params).promise();
  return data.Items;
};

/**
 * Deletes the reminder for given chatId and time
 * @param chatId reminder chatId
 * @param time reminder time
 */
module.exports.deleteReminder = async (chatId, time) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: { chat_id : chatId, reminder_time: time }
  };

  await dynamoDb.delete(params).promise();
};
```

With these we can retrieve a list of all messages that need to be sent, and also we can delete reminders that we have
already sent and don't need anymore. Because the `getDueReminders` uses the `moment` library we need import it at the begining
of `storage.js`:

```node
const moment = require('moment');
```

Now we need to add another lambda handler to the `handler.js` file. We won't touch our existing `module.exports.hello`
function but instead at the bottom of the file we'll add another handler which will take care of checking for due reminders
and sending them to the users:

```node
module.exports.checkReminders = async (event, context) => {
  try {
    // get the list of reminders that are ready for sending
    const reminders = await storage.getDueReminders();

    // because all the methods in in telegram api and our storage module are asynchronous we need to map the list of
    // reminders into a list of promises and then process those with Promise.all in order to make sure that we make
    // sure all of the actions have time to complete before moving on
    await Promise.all(reminders.map(async reminder => {
      // send the user their reminder
      await api.sendMessage(reminder.chat_id, reminder.reminder_text);
      // delete the reminder that is not needed anymore
      await storage.deleteReminder(reminder.chat_id, reminder.reminder_time)
    }));

  } catch (e) {
    // Something went wrong. Let's write it to the log
    console.error(e)
  }
};
```

If you are unfamiliar with modern Javascript don't be alarmed with the complicated thing with `Promise.all` and `reminders.map`.
If you are interested you can read more about promises [here](https://scotch.io/tutorials/javascript-promises-for-dummies).

Now we have all the code that we need in place. The only thing now is to add another lambda function to `serverless.yml`.
Let's add the new function definition into the `functions` section:

```yaml
functions:
  hello:
    handler: handler.hello
    events:
      - http:
          path: my-custom-url
          method: post
          cors: true
  checkReminders:
    handler: handler.checkReminders
    events:
      - schedule: rate(1 minute)
```

**NOTE:** Be careful with the indentation here. The `hello:` and `checkReminders:` are both function definitions and should
be on the same indentation level.

Now if we deploy our chatbot our virtual assistent should be complete. In case you already added couple reminders after
finishing the section 2. you might already hear a notification from your chat window as our assistent just reminded us of
something important.

## Summary











