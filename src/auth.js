import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpCors from "@middy/http-cors";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { hashPassword, comparePassword, signJwt } from "./lib/authUtil.js";

export const signup = middy(async (event) => {
    const { email, password } = event.body || {};
    if (!email || !password) return json(400, { error: "email and password required" });

    const exists = await ddb.send(new QueryCommand({
        TableName: tables.users,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email },
        Limit: 1
    }));
    if (exists.Items?.length) return json(409, { error: "email taken" });

    const userId = uuid();
    const passwordHash = await hashPassword(password);
    await ddb.send(new PutCommand({
        TableName: tables.users,
        Item: { userId, email, passwordHash, createdAt: new Date().toISOString() }
    }));
    const token = await signJwt({ sub: userId, email });
    return json(201, { token, userId, email });
}).use(httpJsonBodyParser()).use(httpCors());

export const login = middy(async (event) => {
    const { email, password } = event.body || {};
    if (!email || !password) return json(400, { error: "email and password required" });

    const found = await ddb.send(new QueryCommand({
        TableName: tables.users,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email },
        Limit: 1
    }));
    const user = found.Items?.[0];
    if (!user) return json(401, { error: "invalid credentials" });

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return json(401, { error: "invalid credentials" });

    const token = await signJwt({ sub: user.userId, email: user.email });
    return json(200, { token, userId: user.userId, email: user.email });
}).use(httpJsonBodyParser()).use(httpCors());
