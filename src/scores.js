// Poäng- och leaderboard-logik.
// Här kan en inloggad spelare registrera sin poäng för ett quiz,
// samt hämta topplistor antingen för ett specifikt quiz eller för alla quiz.

import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

// register – sparar en spelares poäng på ett quiz.
// Kräver inloggning. Jag använder ett "inverterat" sorteringsvärde (scoreSort)
// = 999999 - score (avrundad nedåt). Det gör att lägsta scoreSort motsvarar högsta poäng,
// så jag kan fråga (Query) med stigande sortering och ändå få högsta poängen först.
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

// leaderboard – två lägen:
// 1) Standard: top N för ett givet quiz (via GSI "ScoresByQuiz").
// 2) all=true: för varje quiz hämtas top N och returneras som en lista.
// Jag förlitar mig på att indexet sorterar på scoreSort och att vi läser i stigande ordning,
// vilket ger högsta poängen först tack vare inversionstricket ovan.
export const leaderboard = async (event) => {
    const qs = event.queryStringParameters || {};
    const limit = Number(qs.limit || 10);
    const all = String(qs.all || "").toLowerCase() === "true";

    // Topplista för ett specifikt quiz
    if (!all) {
        const quizId = qs.quizId || event.pathParameters?.quizId;
        if (!quizId) return json(400, { error: "quizId required" });

        const out = await ddb.send(new QueryCommand({
            TableName: tables.scores,
            IndexName: "ScoresByQuiz",
            KeyConditionExpression: "quizId = :q",
            ExpressionAttributeValues: { ":q": quizId },
            Limit: limit,
            ScanIndexForward: true    // högsta poäng först pga inverterad scoreSort
        }));

        return json(200, (out.Items || []).map(i => ({
            quizId: i.quizId, userId: i.userId, score: i.score, at: i.createdAt
        })));
    }

    // Topplistor för alla quiz (varje quiz får sina top N)
    const quizzes = [];
    let last;
    do {
        const page = await ddb.send(new ScanCommand({
            TableName: tables.quizzes,
            ProjectionExpression: "quizId, #n",
            ExpressionAttributeNames: { "#n": "name" },
            ExclusiveStartKey: last
        }));
        quizzes.push(...(page.Items || []));
        last = page.LastEvaluatedKey;
    } while (last);

    const tops = await Promise.all(quizzes.map(async q => {
        const res = await ddb.send(new QueryCommand({
            TableName: tables.scores,
            IndexName: "ScoresByQuiz",
            KeyConditionExpression: "quizId = :q",
            ExpressionAttributeValues: { ":q": q.quizId },
            Limit: limit,
            ScanIndexForward: true
        }));
        return {
            quizId: q.quizId,
            name: q.name,
            top: (res.Items || []).map(i => ({ userId: i.userId, score: i.score, at: i.createdAt }))
        };
    }));

    return json(200, tops);
};
