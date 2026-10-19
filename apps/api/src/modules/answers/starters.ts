// Questions that recur in application forms and whose answer doesn't change per job.
// "Are you authorized to work in X?" is deliberately absent: the answer depends on the job's country.
export const STARTERS = [
  { key: "sponsorship", question: "Will you now or in the future require visa sponsorship?", answerType: "yesno" },
  { key: "relocation", question: "Are you willing to relocate?", answerType: "yesno" },
  { key: "over_18", question: "Are you at least 18 years old?", answerType: "yesno" },
  { key: "notice_period", question: "What is your notice period, or when can you start?", answerType: "text" },
  { key: "salary_expectation", question: "What are your salary expectations?", answerType: "text" },
  { key: "referral_source", question: "How did you hear about this job?", answerType: "text" },
] as const;
