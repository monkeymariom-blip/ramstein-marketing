import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

interface JwkEntry {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: JwkEntry[];
  expiresAt: number;
}

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwksCache: JwksCache | null = null;

function getFirebaseProjectId(): string {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) {
    return envProjectId;
  }

  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed.projectId) {
        return parsed.projectId;
      }
    }
  } catch {
    // Ignore file read errors and rely on env check below
  }

  throw new Error(
    "FIREBASE_PROJECT_ID introuvable. Vérifiez firebase-applet-config.json ou la variable FIREBASE_PROJECT_ID."
  );
}

async function fetchJwks(forceRefresh = false): Promise<JwkEntry[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new Error("Impossible de récupérer les clés publiques Firebase.");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;

  const data = (await response.json()) as { keys?: JwkEntry[] };
  if (!Array.isArray(data.keys) || data.keys.length === 0) {
    throw new Error("Format JWKS Firebase invalide.");
  }

  jwksCache = {
    keys: data.keys,
    expiresAt: now + maxAgeMs,
  };
  return data.keys;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, "base64url").toString("utf-8");
  return JSON.parse(json) as T;
}

export class AuthVerificationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function verifyFirebaseBearerToken(
  authorizationHeader: string | string[] | undefined
): Promise<VerifiedFirebaseUser> {
  const headerValue = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    throw new AuthVerificationError(
      401,
      "Authentification requise. Veuillez vous connecter."
    );
  }

  const token = headerValue.slice("Bearer ".length).trim();
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new AuthVerificationError(401, "Jeton d'authentification invalide.");
  }

  const [headerB64, payloadB64, signatureB64] = segments;

  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: unknown;
    iss?: unknown;
    sub?: unknown;
    exp?: unknown;
    iat?: unknown;
    auth_time?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  };

  try {
    header = decodeBase64UrlJson(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    throw new AuthVerificationError(401, "Jeton d'authentification illisible.");
  }

  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new AuthVerificationError(401, "Signature de jeton non supportée.");
  }

  let keys = await fetchJwks(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }

  if (!jwk) {
    throw new AuthVerificationError(401, "Clé de signature Firebase inconnue.");
  }

  const publicKey = crypto.createPublicKey({
    key: jwk as unknown as crypto.JsonWebKey,
    format: "jwk",
  });

  const isSignatureValid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, "base64url")
  );

  if (!isSignatureValid) {
    throw new AuthVerificationError(401, "Signature du jeton invalide.");
  }

  const projectId = getFirebaseProjectId();
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new AuthVerificationError(401, "Audience du jeton invalide.");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthVerificationError(401, "Émetteur du jeton invalide.");
  }
  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    throw new AuthVerificationError(401, "Identifiant utilisateur invalide.");
  }
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new AuthVerificationError(
      401,
      "Votre session a expiré. Veuillez vous reconnecter."
    );
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) {
    throw new AuthVerificationError(401, "Horodatage du jeton invalide.");
  }
  if (
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.email
  ) {
    throw new AuthVerificationError(
      403,
      "Votre adresse e-mail doit être vérifiée pour accéder à l'application."
    );
  }

  const allowedEmailsRaw = process.env.ALLOWED_EMAILS?.trim();
  if (allowedEmailsRaw) {
    const allowedEmails = allowedEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (
      allowedEmails.length > 0 &&
      !allowedEmails.includes(payload.email.toLowerCase())
    ) {
      throw new AuthVerificationError(
        403,
        "Accès refusé : votre adresse e-mail n'est pas autorisée à utiliser cette application."
      );
    }
  }

  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: true,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}
