import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpCors from "@middy/http-cors";
import { verifyJwt } from "./authUtil.js";
import { json } from "./http.js";

export const withAuth = (handler) =>
    middy(async (event) => {
        const auth = event.headers?.authorization || event.headers?.Authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return json(401, { error: "Missing token" });
        try {
            const payload = await verifyJwt(token);
            event.user = payload;
            return handler(event);
        } catch {
            return json(401, { error: "Invalid token" });
        }
    }).use(httpJsonBodyParser()).use(httpCors());
