export type Preferences = {
    chosenAi: "anthropic" | "openai" | "raycastai";
    creativity: string;
    model: string;
    openaiApiToken: string;
    anthropicApiToken: string;
    language: string;
  };