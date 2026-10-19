import { graphql } from "./gql";

export const MEMORY_FIELDS = graphql(`
  fragment MemoryFields on MemoryEntry {
    id
    question
    answerType
    answer
    updatedAt
  }
`);

export const MEMORY_QUERY = graphql(`
  query Memory {
    memory {
      ...MemoryFields
    }
  }
`);

export const SAVE_MEMORY_MUTATION = graphql(`
  mutation SaveMemoryEntry($id: ID, $question: String!, $answerType: AnswerType!, $answer: String!) {
    saveMemoryEntry(id: $id, question: $question, answerType: $answerType, answer: $answer) {
      ...MemoryFields
    }
  }
`);

export const DELETE_MEMORY_MUTATION = graphql(`
  mutation DeleteMemoryEntry($id: ID!) {
    deleteMemoryEntry(id: $id) {
      ...MemoryFields
    }
  }
`);
