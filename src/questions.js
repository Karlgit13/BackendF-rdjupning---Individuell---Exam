// Den här funktionen används för att lägga till frågor till ett specifikt quiz.
// Endast den användare som äger quizet får lägga till frågor, därför är den skyddad med withAuth.
// Varje fråga får ett eget unikt questionId och sparas i Questions-tabellen i DynamoDB.

import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

// add – lägger till en ny fråga i ett befintligt quiz.
// 1. Hämtar quizId från URL-parametern och frågedata från body.
// 2. Kollar att quizet existerar i databasen.
// 3. Säkerställer att den inloggade användaren äger quizet.
// 4. Skapar en ny fråga med unikt questionId och sparar i Questions-tabellen.
export const add = withAuth(async (event) => {
    const quizId = event.pathParameters?.quizId;
    const { question, answer, lat, lng } = event.body || {};
    if (!quizId || !question || !answer) return json(400, { error: "quizId, question, answer required" });

    const q = await ddb.send(new GetCommand({ TableName: tables.quizzes, Key: { quizId } }));
    if (!q.Item) return json(404, { error: "quiz not found" });
    if (q.Item.ownerId !== event.user.sub) return json(403, { error: "forbidden" });

    const questionId = uuid();
    await ddb.send(new PutCommand({
        TableName: tables.questions,
        Item: { quizId, questionId, question, answer, lat, lng, createdAt: new Date().toISOString() }
    }));

    return json(201, { quizId, questionId });
});
