import { PutCommand, GetCommand, ScanCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { withAuth } from "./lib/requireAuth.js";

export const list = async () => {
    const res = await ddb.send(new ScanCommand({
        TableName: tables.quizzes,
        ProjectionExpression: "quizId, #n, ownerId",
        ExpressionAttributeNames: { "#n": "name" }
    }));
    return json(200, res.Items || []);
};

export const get = async (event) => {
    const quizId = event.pathParameters?.quizId;
    if (!quizId) return json(400, { error: "quizId required" });

    const quiz = await ddb.send(new GetCommand({ TableName: tables.quizzes, Key: { quizId } }));
    const questions = await ddb.send(new QueryCommand({
        TableName: tables.questions,
        KeyConditionExpression: "quizId = :q",
        ExpressionAttributeValues: { ":q": quizId }
    }));
    return json(200, { quiz: quiz.Item || null, questions: questions.Items || [] });
};

export const create = withAuth(async (event) => {
    const { name } = event.body || {};
    if (!name) return json(400, { error: "name required" });
    const quizId = uuid();
    await ddb.send(new PutCommand({
        TableName: tables.quizzes,
        Item: { quizId, name, ownerId: event.user.sub, createdAt: new Date().toISOString() }
    }));
    return json(201, { quizId, name });
});

export const remove = withAuth(async (event) => {
    const quizId = event.pathParameters?.quizId;
    if (!quizId) return json(400, { error: "quizId required" });

    const q = await ddb.send(new GetCommand({ TableName: tables.quizzes, Key: { quizId } }));
    if (!q.Item) return json(404, { error: "not found" });
    if (q.Item.ownerId !== event.user.sub) return json(403, { error: "forbidden" });

    await ddb.send(new DeleteCommand({ TableName: tables.quizzes, Key: { quizId } }));
    return json(204, {});
});
