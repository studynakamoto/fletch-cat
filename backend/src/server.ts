import cors from "@fastify/cors";
import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { healthRoutes } from "./routes/health.js";
import { statsRoutes } from "./routes/stats.js";
import { tokenRoutes } from "./routes/tokens.js";

export async function buildServer() {
  getDb();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });

  await app.register(healthRoutes);
  await app.register(tokenRoutes);
  await app.register(statsRoutes);

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  return app;
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
