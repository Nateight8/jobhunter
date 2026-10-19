import { graphql } from "./gql";

export const ANSWER_FIELDS = graphql(`
  fragment AnswerFields on Answer {
    id
    key
    question
    answerType
    answer
  }
`);

export const ANSWERS_QUERY = graphql(`
  query Answers {
    answers {
      ...AnswerFields
    }
  }
`);

export const SAVE_ANSWERS_MUTATION = graphql(`
  mutation SaveAnswers($items: [AnswerInput!]!) {
    saveAnswers(items: $items) {
      ...AnswerFields
    }
  }
`);
