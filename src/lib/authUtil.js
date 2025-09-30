import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getJwtSecret } from "./ssm.js";

export async function signJwt(payload) {
    const secret = await getJwtSecret();
    return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "7d" });
}
export async function verifyJwt(token) {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret);
}
export async function hashPassword(pw) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(pw, salt);
}
export async function comparePassword(pw, hash) {
    return bcrypt.compare(pw, hash);
}
