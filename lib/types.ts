export type AppLanguage = "en" | "or" | "hi";
export type AppRole = "student" | "parent" | "teacher" | "admin";
export type Medium = "english" | "odia" | "hindi";

export type Citation = {
  chunkId: string;
  documentTitle: string;
  sourceUrl?: string | null;
  page?: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  createdAt: string;
};
