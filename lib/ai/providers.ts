import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { customProvider, gateway } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // Use the gateway for everything in Demo mode or as a flexible fallback
  const isDemo = process.env.IS_DEMO === "1";
  if (isDemo) {
    return gateway.languageModel(modelId);
  }

  if (modelId.startsWith("google/")) {
    const googleId = modelId.replace("google/", "");
    // Using exact model IDs from Google
    return google(googleId);
  }

  if (modelId.startsWith("groq/")) {
    const groqId = modelId.replace("groq/", "");
    return groq(groqId);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  const modelId = titleModel.id;
  if (modelId.startsWith("google/")) {
    let googleId = modelId.replace("google/", "");
    if (googleId.endsWith("-latest")) {
      googleId = googleId.replace("-latest", "");
    }
    return google(googleId);
  }

  return gateway.languageModel(modelId);
}
