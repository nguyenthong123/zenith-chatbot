import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "./.env") });

async function test() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  console.log("Key:", key ? "PRESENT" : "MISSING");

  const modelNames = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"];
  const apiVersions = ["v1", "v1beta"];

  for (const apiVersion of apiVersions) {
    console.log(`--- Testing with API Version: ${apiVersion} ---`);
    const google = createGoogleGenerativeAI({
      apiKey: key,
      apiVersion: apiVersion as any,
    });

    for (const modelId of modelNames) {
      console.log(`Testing ${modelId}...`);
      try {
        const result = await generateText({
          model: google(modelId),
          prompt: "Hi",
        });
        console.log(`✅ ${modelId} works on ${apiVersion}: ${result.text}`);
        return; // Success!
      } catch (e: any) {
        console.log(`❌ ${modelId} failed: ${e.message}`);
      }
    }
  }
}

test();
