import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local development (.env at repo root)
const localEnvPath = path.resolve(__dirname, "../../../.env");

// Load local .env if it exists.
// On Render/Vercel, no .env file exists, so dotenv simply leaves
// the already-injected process.env untouched.
if (fs.existsSync(localEnvPath)) {
  dotenv.config({
    path: localEnvPath,
  });
} else {
  dotenv.config();
}

import { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dns from "node:dns";

// The Neon serverless driver connects over WebSocket (wss). Node's default
// "verbatim" DNS ordering may return AAAA (IPv6) records first; on hosts
// without an IPv6 route (WSL, some VMs/VPNs) those attempts fail. Prefer
// IPv4 so the connection lands on a working A record first.
dns.setDefaultResultOrder("ipv4first");

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({
  connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});

export * from "../../../generated/prisma/enums.js";