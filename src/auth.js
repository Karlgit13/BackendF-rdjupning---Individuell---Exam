// Hanterar registrering (signup) och inloggning (login) av användare.
// Allt sker via DynamoDB, och lösenorden sparas hashade med bcrypt.
// När en användare loggar in eller registrerar sig får de tillbaka en JWT-token.

import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpCors from "@middy/http-cors";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./lib/db.js";
import { v4 as uuid } from "uuid";
import { json } from "./lib/http.js";
import { hashPassword, comparePassword, signJwt } from "./lib/authUtil.js";

// Signup – skapar en ny användare.
// 1. Tar emot email och password från body.
// 2. Kollar om e-posten redan finns i databasen via sekundärindexet EmailIndex.
// 3. Om den inte finns, skapas en ny användare med hashat lösenord.
// 4. Returnerar en JWT-token tillsammans med användarens info.
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
})
    // Body-parser för JSON och CORS så frontend kan nå API:t.
    .use(httpJsonBodyParser())
    .use(httpCors());

// Login – autentiserar befintlig användare.
// 1. Tar emot email och password.
// 2. Hämtar användaren via EmailIndex.
// 3. Jämför lösenordet med hash i databasen.
// 4. Returnerar JWT-token om allt stämmer, annars 401.
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
})
    .use(httpJsonBodyParser())
    .use(httpCors());
