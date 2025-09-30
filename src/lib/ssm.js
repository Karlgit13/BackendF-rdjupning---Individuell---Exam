import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
const ssm = new SSMClient({});
let cached;
export async function getJwtSecret() {
    if (cached) return cached;
    const name = process.env.JWT_PARAM_NAME;
    const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    cached = out.Parameter.Value;
    return cached;
}
