import { GoogleGenAI } from "@google/genai";

export interface GenerateRequestBody {
  prompt?: unknown;
  systemInstruction?: unknown;
  imageDataUrl?: unknown;
}

export interface GeminiHandlerResult {
  status: number;
  body: {
    text?: string;
    error?: string;
  };
}

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export async function handleGeminiGenerate(
  rawBody: unknown
): Promise<GeminiHandlerResult> {
  const ai = createAiClient();
  if (!ai) {
    return {
      status: 500,
      body: {
        error:
          "La variable d'environnement GEMINI_API_KEY n'est pas configurée sur le serveur.",
      },
    };
  }

  const body = (rawBody ?? {}) as GenerateRequestBody;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const systemInstruction =
    typeof body.systemInstruction === "string"
      ? body.systemInstruction.trim()
      : "";
  const imageDataUrl =
    typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";

  if (!prompt) {
    return {
      status: 400,
      body: { error: "Le champ 'prompt' est requis." },
    };
  }

  if (prompt.length > 20000 || systemInstruction.length > 10000) {
    return {
      status: 400,
      body: {
        error: "Le texte fourni dépasse la longueur maximale autorisée.",
      },
    };
  }

  let contents:
    | string
    | {
        parts: Array<
          { inlineData: { mimeType: string; data: string } } | { text: string }
        >;
      } = prompt;

  if (imageDataUrl) {
    const match = imageDataUrl.match(
      /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
    );
    if (!match) {
      return {
        status: 400,
        body: {
          error:
            "Format d'image invalide. Utilisez une image PNG, JPEG ou WebP.",
        },
      };
    }
    const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
    const data = match[2];
    contents = {
      parts: [{ inlineData: { mimeType, data } }, { text: prompt }],
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    const text = response.text?.trim();
    if (!text) {
      return {
        status: 502,
        body: { error: "Gemini n'a renvoyé aucun contenu textuel." },
      };
    }

    return {
      status: 200,
      body: { text },
    };
  } catch (err: unknown) {
    const errorObj = err as { status?: number; message?: string };
    const status =
      typeof errorObj?.status === "number" &&
      errorObj.status >= 400 &&
      errorObj.status < 600
        ? errorObj.status
        : 500;
    const message =
      errorObj?.message || "Erreur lors de l'appel à l'API Gemini.";
    console.error("[Gemini API Error]", message);
    return {
      status,
      body: { error: message },
    };
  }
}
