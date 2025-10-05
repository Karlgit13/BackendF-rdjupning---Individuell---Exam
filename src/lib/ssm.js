// Hämtar JWT-hemligheten (secret) från AWS SSM Parameter Store.
// Denna används av auth-funktionerna för att signera och verifiera tokens.
// Jag cachar värdet i minnet efter första hämtningen för att slippa anropa SSM varje gång.

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Skapar en SSM-klient. AWS SDK känner själv av region från miljön.
const ssm = new SSMClient({});

// Sparar hemligheten i en variabel efter första anropet så att den inte behöver laddas om.
let cached;

// Hämtar parametern från SSM och dekrypterar den.
// Returnerar samma secret varje gång efter att den har cachats.
export async function getJwtSecret() {
    if (cached) return cached;
    const name = process.env.JWT_PARAM_NAME;
    const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    cached = out.Parameter.Value;
    return cached;
}
