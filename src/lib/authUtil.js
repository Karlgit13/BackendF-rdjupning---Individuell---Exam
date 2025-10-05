// Den här filen hanterar all logik kring inloggning och lösenord.
// Här skapas och verifieras JWT-tokens, samt hashning och jämförelse av lösenord.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getJwtSecret } from "./ssm.js";

// Skapar en JWT-token till användaren efter inloggning.
// Hämtar hemligheten (secret) från SSM och använder HS256 som algoritm.
// Token är giltig i 7 dagar och innehåller t.ex. userId i payload.
export async function signJwt(payload) {
    const secret = await getJwtSecret();
    return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "7d" });
}

// Verifierar att en inkommande token är äkta och inte har gått ut.
// Används för att skydda endpoints som kräver att man är inloggad.
export async function verifyJwt(token) {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret);
}

// Tar emot ett vanligt lösenord och skapar en hash med bcrypt.
// Det är den hashen som sparas i databasen, inte det riktiga lösenordet.
export async function hashPassword(pw) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(pw, salt);
}

// Jämför ett inmatat lösenord med den hash som finns lagrad i databasen.
// Returnerar true om det stämmer, annars false.
export async function comparePassword(pw, hash) {
    return bcrypt.compare(pw, hash);
}
