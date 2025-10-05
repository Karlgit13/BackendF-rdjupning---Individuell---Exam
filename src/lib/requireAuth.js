// Den här funktionen används som ett "middleware-skydd" för alla endpoints som kräver inloggning.
// Jag använder Middy för att enkelt kunna koppla på flera funktioner (som body-parser och CORS) runt mina handlers.
// withAuth tar emot en handler, verifierar JWT-token och skickar vidare eventet om allt stämmer.

import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpCors from "@middy/http-cors";
import { verifyJwt } from "./authUtil.js";
import { json } from "./http.js";

// Kollar om det finns en "Authorization"-header med en Bearer-token.
// Om token saknas eller är ogiltig svarar funktionen med 401 (Unauthorized).
// Om token är giltig sparas användarens data i event.user och handlern körs.
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
    })
        // Parserar inkommande JSON automatiskt så jag slipper JSON.parse själv.
        .use(httpJsonBodyParser())
        // Aktiverar CORS så frontend kan anropa API:t utan problem.
        .use(httpCors());
