import type { IncomingMessage, ServerResponse } from "http";
import {
  AuthVerificationError,
  verifyFirebaseBearerToken,
} from "../../lib/firebase-token.ts";
import { handleGeminiGenerate } from "../../lib/gemini-server.ts";

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return JSON.parse(req.body);
    }
    return req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Méthode non autorisée." });
  }

  try {
    await verifyFirebaseBearerToken(req.headers.authorization);
  } catch (err: unknown) {
    if (err instanceof AuthVerificationError) {
      return sendJson(res, err.status, { error: err.message });
    }
    const message =
      err instanceof Error ? err.message : "Erreur d'authentification.";
    return sendJson(res, 401, { error: message });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Corps JSON invalide." });
  }

  const result = await handleGeminiGenerate(body);
  return sendJson(res, result.status, result.body);
}
