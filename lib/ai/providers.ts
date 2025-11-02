import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

// import { isTestEnvironment } from "../constants";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

// export const myProvider = isTestEnvironment
//   ? (() => {
//       const {
//         artifactModel,
//         chatModel,
//         reasoningModel,
//         titleModel,
//       } = require("./models.mock");
//       return customProvider({
//         languageModels: {
//           "chat-model": chatModel,
//           "chat-model-reasoning": reasoningModel,
//           "title-model": titleModel,
//           "artifact-model": artifactModel,
//         },
//       });
//     })()
//   : customProvider({
//       languageModels: {
//         "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
//         "chat-model-reasoning": wrapLanguageModel({
//           model: gateway.languageModel("xai/grok-3-mini"),
//           middleware: extractReasoningMiddleware({ tagName: "think" }),
//         }),
//         "title-model": gateway.languageModel("xai/grok-2-1212"),
//         "artifact-model": gateway.languageModel("xai/grok-2-1212"),
//       },
//     });

export const myProvider = customProvider({
  languageModels: {
    // Using Google Gemini Flash (free, supports tools)
    "chat-model": openrouter("nvidia/nemotron-nano-12b-v2-vl:free"),
    "chat-model-reasoning": wrapLanguageModel({
      model: openrouter("nvidia/nemotron-nano-12b-v2-vl:free"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": openrouter("nvidia/nemotron-nano-12b-v2-vl:free"),
    "artifact-model": openrouter("nvidia/nemotron-nano-12b-v2-vl:free"),
  },
});
