import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

export const register = withAuth(async (event) => {
    const quizId = event.pathParameters?.quizId;
    const { score } = event.body || {};
    if (!quizId || typeof score !== "number") return json(400, { error: "quizId and numeric score required" });

    const now = new Date().toISOString();
    const scoreSort = 999999 - Math.max(0, Math.floor(score));
    await ddb.send(new PutCommand({
        TableName: tables.scores,
        Item: { quizId, scoreSort, userId: event.user.sub, score, createdAt: now }
    }));
    return json(201, { ok: true });
});

export const leaderboard = async (event) => {
    const quizId = event.pathParameters?.quizId;
    const limit = Number(event.queryStringParameters?.limit || 10);
    const out = await ddb.send(new QueryCommand({
        TableName: tables.scores,
        IndexName: "ScoresByQuiz",
        KeyConditionExpression: "quizId = :q",
        ExpressionAttributeValues: { ":q": quizId },
        Limit: limit,
        ScanIndexForward: true
    }));
    return json(200, (out.Items || []).map(i => ({ userId: i.userId, score: i.score, at: i.createdAt })));
};
