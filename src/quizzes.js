// src/quizzes.js
import {
    PutCommand,
    GetCommand,
    ScanCommand,
    DeleteCommand,
    QueryCommand,
    BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

/* LISTA ALLA QUIZ */
export const list = async () => {
    const res = await ddb.send(
        new ScanCommand({
            TableName: tables.quizzes,
            ProjectionExpression: "quizId, #n, ownerId",
            ExpressionAttributeNames: { "#n": "name" },
        })
    );
    return json(200, res.Items || []);
};

/* HÄMTA QUIZ + FRÅGOR */
export const get = async (event) => {
    const quizId = event.pathParameters?.quizId;
    if (!quizId) return json(400, { error: "quizId required" });

    const quiz = await ddb.send(
        new GetCommand({ TableName: tables.quizzes, Key: { quizId } })
    );

    const questions = await ddb.send(
        new QueryCommand({
            TableName: tables.questions,
            KeyConditionExpression: "quizId = :q",
            ExpressionAttributeValues: { ":q": quizId },
        })
    );

    return json(200, {
        quiz: quiz.Item || null,
        questions: questions.Items || [],
    });
};

/* SKAPA QUIZ */
export const create = withAuth(async (event) => {
    const { name } = event.body || {};
    if (!name) return json(400, { error: "name required" });

    const quizId = uuid();
    await ddb.send(
        new PutCommand({
            TableName: tables.quizzes,
            Item: {
                quizId,
                name,
                ownerId: event.user.sub,
                createdAt: new Date().toISOString(),
            },
        })
    );
    return json(201, { quizId, name });
});

/* intern helper: batch delete med retry av UnprocessedItems */
async function batchDelete(tableName, keys) {
    for (let i = 0; i < keys.length; i += 25) {
        const chunk = keys.slice(i, i + 25).map((Key) => ({
            DeleteRequest: { Key },
        }));

        let resp = await ddb.send(
            new BatchWriteCommand({ RequestItems: { [tableName]: chunk } })
        );
        let un = resp.UnprocessedItems?.[tableName] || [];

        while (un.length) {
            await new Promise((r) => setTimeout(r, 120)); // backoff kort
            resp = await ddb.send(
                new BatchWriteCommand({ RequestItems: { [tableName]: un } })
            );
            un = resp.UnprocessedItems?.[tableName] || [];
        }
    }
}

/* TA BORT QUIZ + relaterade frågor och poäng */
export const remove = withAuth(async (event) => {
    const quizId = event.pathParameters?.quizId;
    if (!quizId) return json(400, { error: "quizId required" });

    const q = await ddb.send(
        new GetCommand({ TableName: tables.quizzes, Key: { quizId } })
    );
    if (!q.Item) return json(404, { error: "not found" });
    if (q.Item.ownerId !== event.user.sub) return json(403, { error: "forbidden" });

    // 1) radera frågor
    let deletedQuestions = 0;
    let lastKeyQ;
    do {
        const page = await ddb.send(
            new QueryCommand({
                TableName: tables.questions,
                KeyConditionExpression: "quizId = :q",
                ExpressionAttributeValues: { ":q": quizId },
                ProjectionExpression: "quizId, questionId",
                ExclusiveStartKey: lastKeyQ,
            })
        );
        const items = page.Items || [];
        if (items.length) {
            await batchDelete(
                tables.questions,
                items.map((it) => ({ quizId: it.quizId, questionId: it.questionId }))
            );
            deletedQuestions += items.length;
        }
        lastKeyQ = page.LastEvaluatedKey;
    } while (lastKeyQ);

    // 2) radera scores
    let deletedScores = 0;
    let lastKeyS;
    do {
        const page = await ddb.send(
            new QueryCommand({
                TableName: tables.scores,
                KeyConditionExpression: "quizId = :q",
                ExpressionAttributeValues: { ":q": quizId },
                ProjectionExpression: "quizId, scoreSort",
                ExclusiveStartKey: lastKeyS,
            })
        );
        const items = page.Items || [];
        if (items.length) {
            await batchDelete(
                tables.scores,
                items.map((it) => ({ quizId: it.quizId, scoreSort: it.scoreSort }))
            );
            deletedScores += items.length;
        }
        lastKeyS = page.LastEvaluatedKey;
    } while (lastKeyS);

    // 3) radera quizet
    await ddb.send(
        new DeleteCommand({ TableName: tables.quizzes, Key: { quizId } })
    );

    return json(200, {
        ok: true,
        quizId,
        deleted: { quiz: 1, questions: deletedQuestions, scores: deletedScores },
    });
});
