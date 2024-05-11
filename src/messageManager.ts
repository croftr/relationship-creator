import { log } from "console";
import { MPMessage } from "./models/mps";

// Load the AWS SDK for Node.js
var AWS = require("aws-sdk");
// Set region
AWS.config.update({ region: "eu-north-1" });

export const readMessage = async () => {

    console.log("read message ");

    let mps: Array<MPMessage> = [];

    const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

    const queueURL = "https://sqs.eu-north-1.amazonaws.com/905418468533/mpsQueue";

    var params = {
        AttributeNames: ["SentTimestamp"],
        MaxNumberOfMessages: 2,
        MessageAttributeNames: ["All"],
        QueueUrl: queueURL,
        VisibilityTimeout: 20,
        WaitTimeSeconds: 0,
    };

    const data = await sqs.receiveMessage(params).promise();

    if (data.Messages) {
        for (const message of data.Messages) {
            console.log("Message Body:", message.Body);            
            const mp= JSON.parse(message.Body)
            // @ts-ignore
            mps.push(mp)
                                    
            await sqs.deleteMessage({
                QueueUrl: queueURL,
                ReceiptHandle: message.ReceiptHandle
            }).promise();
        }
    }

    // @ts-ignore
    return mps;
}