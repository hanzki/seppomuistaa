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



