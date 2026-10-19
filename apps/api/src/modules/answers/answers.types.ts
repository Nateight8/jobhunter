import type { Answer } from "@workspace/db";
import { builder } from "../../builder";

export const AnswerType = builder.enumType("AnswerType", {
  values: {
    TEXT: { value: "text" },
    YES_NO: { value: "yesno" },
  } as const,
});

export const AnswerRef = builder.objectRef<Answer>("Answer");
AnswerRef.implement({
  description: "A reusable answer to a question that recurs in application forms. Empty means never guessed.",
  fields: (t) => ({
    id: t.exposeID("id"),
    key: t.exposeString("key", { nullable: true, description: "Set for starter questions, null for your own" }),
    question: t.exposeString("question"),
    answerType: t.field({ type: AnswerType, resolve: (a) => a.answerType as "text" | "yesno" }),
    answer: t.exposeString("answer", { nullable: true }),
  }),
});

export const AnswerInput = builder.inputType("AnswerInput", {
  fields: (t) => ({
    key: t.string(),
    question: t.string({ required: true }),
    answerType: t.field({ type: AnswerType, required: true }),
    answer: t.string(),
  }),
});
