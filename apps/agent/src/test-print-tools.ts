// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dotenv.config({ path: path.resolve(__dirname, "../../../.env") });


import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({
    path: localEnvPath,
  });
} else {
  dotenv.config();
}

const { bootstrap } = await import("./bootstrap/index.js");
const { registry } = await import("@cossie/mcp-registry");

await bootstrap();

console.log("REGISTERED TOOLS:");
console.log(JSON.stringify(registry.getTools(), null, 2));
