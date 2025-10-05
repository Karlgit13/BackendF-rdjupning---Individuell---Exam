// Den här filen innehåller all logik för att hantera quiz – att skapa, hämta, lista och ta bort.
// Här används flera DynamoDB-kommandon, och vissa funktioner är skyddade med withAuth
// för att bara tillåta ägaren att skapa eller ta bort sina egna quiz.

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

// Hämtar alla quiz i databasen. Jag använder Scan för att läsa ut allt från tabellen,
// men bara vissa fält (quizId, name, ownerId) för att hålla svaret lättviktigt.
// Den här funktionen kräver inte inloggning.
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

// Hämtar ett specifikt quiz samt alla dess frågor.
// Först läses själva quizet, sedan görs en Query på Questions-tabellen för att hämta alla frågor kopplade till quizId.
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

// Skapar ett nytt quiz som tillhör den inloggade användaren.
// Jag använder withAuth för att bara tillåta inloggade användare.
// Ett unikt quizId genereras med UUID, och quizet sparas i tabellen med namn och skapandedatum.
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
// Hjälpfunktion som används vid borttagning av quiz.
// DynamoDB kan ibland inte radera alla poster direkt (UnprocessedItems).
// Den här funktionen kör då om begäran tills alla poster är borttagna.
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
            await new Promise((r) => setTimeout(r, 120)); // liten paus mellan försöken
            resp = await ddb.send(
                new BatchWriteCommand({ RequestItems: { [tableName]: un } })
            );
            un = resp.UnprocessedItems?.[tableName] || [];
        }
    }
}

// Tar bort ett quiz, men också alla tillhörande frågor och poängposter.
// 1. Verifierar att quizet finns och att den inloggade användaren äger det.
// 2. Hämtar och raderar frågor i batches.
// 3. Hämtar och raderar poäng i batches.
// 4. Tar bort själva quizet.
// Returnerar hur många poster som raderats totalt.
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

    // 3) radera själva quizet
    await ddb.send(
        new DeleteCommand({ TableName: tables.quizzes, Key: { quizId } })
    );

    return json(200, {
        ok: true,
        quizId,
        deleted: { quiz: 1, questions: deletedQuestions, scores: deletedScores },
    });
});
