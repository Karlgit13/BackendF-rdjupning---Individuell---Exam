// Här sätter jag upp en återanvändbar DynamoDB-klient för hela projektet.
// Poängen är att alla handlers kan importera samma `ddb` och `tables`
// istället för att varje fil skapar egna klienter eller hårdkodar tabellnamn.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Skapar en låg-nivåklient mot DynamoDB.
// Region hämtas från env men faller tillbaka till eu-north-1 för att funka lokalt.
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-north-1" });

// Wrappar med DocumentClient för att slippa manuellt marshall/unmarshall.
// removeUndefinedValues: true rensar bort undefined så DynamoDB inte gnäller.
export const ddb = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

// Samlar alla tabellnamn från environment-variabler på ett ställe.
// Det gör koden renare i handlers: tables.users / tables.quizzes osv.
export const tables = {
    users: process.env.USERS_TABLE,
    quizzes: process.env.QUIZZES_TABLE,
    questions: process.env.QUESTIONS_TABLE,
    scores: process.env.SCORES_TABLE,
};
