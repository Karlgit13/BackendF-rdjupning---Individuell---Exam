import { json } from "./lib/http.js";
export const root = async () =>
    json(200, { ok: true, service: "quiztopia-api", time: new Date().toISOString() });
