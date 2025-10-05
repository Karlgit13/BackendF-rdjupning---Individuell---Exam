// En enkel "health check"-funktion som visar att API:t lever.
// Den här endpointen kan användas för att testa att deployment och API Gateway fungerar som de ska.
// Returnerar status 200 med lite grundläggande info, bland annat aktuell tid.

import { json } from "./lib/http.js";

export const root = async () =>
    json(200, {
        ok: true,
        service: "quiztopia-api",
        time: new Date().toISOString(),
    });
