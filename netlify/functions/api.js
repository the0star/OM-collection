import serverless from "serverless-http";
import app from "../../app";

console.log("Hello from api.js");

export const handler = serverless(app);
