import type { Answer } from "@workspace/db";
import { builder } from "../../builder";

export const AnswerType = builder.enumType("AnswerType", {
  values: {
    TEXT: { value: "text" },
    YES_NO: { value: "yesno" },
  } as const,
});

export const MemoryEntryRef = builder.objectRef<Answer>("MemoryEntry");
MemoryEntryRef.implement({
  description:
    "Something the user approved to be reused when applying. Starts empty and only grows with the user's approval.",
  fields: (t) => ({
    id: t.exposeID("id"),
    question: t.exposeString("question"),
    answerType: t.field({ type: AnswerType, resolve: (a) => a.answerType as "text" | "yesno" }),
    answer: t.string({ resolve: (a) => a.answer ?? "" }),
    createdAt: t.string({ resolve: (a) => a.createdAt.toISOString() }),
    updatedAt: t.string({ resolve: (a) => a.updatedAt.toISOString() }),
  }),
});
