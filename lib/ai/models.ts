export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // {
  //   id: "chat-model",
  //   name: "Grok Vision",
  //   description: "Advanced multimodal model with vision and text capabilities",
  // },
  {
    id: "chat-model-reasoning",
    name: "Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
  {
    id: "chat-model",
    name: "Chat Model",
    description: "Advanced multimodal model with vision and text capabilities",
  },
];
