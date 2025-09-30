import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-north-1" });
export const ddb = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

export const tables = {
    users: process.env.USERS_TABLE,
    quizzes: process.env.QUIZZES_TABLE,
    questions: process.env.QUESTIONS_TABLE,
    scores: process.env.SCORES_TABLE,
};
