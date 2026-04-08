import * as path from "node:path";
import { google } from "@ai-sdk/google";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

async function listModels() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in .env");
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    const data = await response.json();
    console.log(
      "Available models:",
      JSON.stringify(
        data.models.map((m: any) => m.name),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
