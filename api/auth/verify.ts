import type { IncomingMessage, ServerResponse } from "http";
import {
  AuthVerificationError,
  verifyFirebaseBearerToken,
} from "../../lib/firebase-token.ts";

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Méthode non autorisée." });
  }

  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    return sendJson(res, 200, { ok: true, user });
  } catch (err: unknown) {
    if (err instanceof AuthVerificationError) {
      return sendJson(res, err.status, { error: err.message });
    }
    const message =
      err instanceof Error ? err.message : "Erreur de vérification.";
    return sendJson(res, 500, { error: message });
  }
}
