import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  AuthVerificationError,
  verifyFirebaseBearerToken,
} from "./lib/firebase-token.ts";
import { handleGeminiGenerate } from "./lib/gemini-server.ts";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.get("/api/auth/verify", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const user = await verifyFirebaseBearerToken(req.headers.authorization);
      return res.json({ ok: true, user });
    } catch (err: unknown) {
      if (err instanceof AuthVerificationError) {
        return res.status(err.status).json({ error: err.message });
      }
      const message =
        err instanceof Error ? err.message : "Erreur de vérification.";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/gemini/generate", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
    } catch (err: unknown) {
      if (err instanceof AuthVerificationError) {
        return res.status(err.status).json({ error: err.message });
      }
      const message =
        err instanceof Error ? err.message : "Erreur d'authentification.";
      return res.status(401).json({ error: message });
    }

    const result = await handleGeminiGenerate(req.body);
    return res.status(result.status).json(result.body);
  });

  const distDir = path.resolve(process.cwd(), "dist");
  const distIndex = path.join(distDir, "index.html");
  const isDev =
    process.env.NODE_ENV === "development" || !fs.existsSync(distIndex);

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
