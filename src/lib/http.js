export const json = (code, data) => ({
    statusCode: code,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
    },
    body: JSON.stringify(data),
});
