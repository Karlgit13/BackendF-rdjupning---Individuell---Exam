// En enkel hjälpfunktion för att skicka tillbaka JSON-svar från mina Lambda-funktioner.
// Istället för att upprepa samma headers överallt, kan jag bara skriva: return json(200, data)
// Den sätter statuskod, JSON-header och CORS-inställningar automatiskt.

export const json = (code, data) => ({
    statusCode: code,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
    },
    body: JSON.stringify(data),
});
