import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

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
