import { graphql } from "./gql";

export const JOB_FORM_FIELDS = graphql(`
  fragment JobFormFields on JobForm {
    id
    supported
    reason
    fetchedAt
    hasSurvey
    files {
      key
      label
      required
    }
    questions {
      key
      label
      required
      description
      kind
      options
      resolution {
        source
        value
      }
    }
  }
`);

export const JOB_FORM_QUERY = graphql(`
  query JobForm($jobId: ID!, $refresh: Boolean) {
    jobForm(jobId: $jobId, refresh: $refresh) {
      ...JobFormFields
    }
  }
`);

export const SAVE_JOB_ANSWER_MUTATION = graphql(`
  mutation SaveJobAnswer($jobId: ID!, $key: String!, $answer: String!, $remember: Boolean) {
    saveJobAnswer(jobId: $jobId, key: $key, answer: $answer, remember: $remember) {
      ...JobFormFields
    }
  }
`);

export const CLEAR_JOB_ANSWER_MUTATION = graphql(`
  mutation ClearJobAnswer($jobId: ID!, $key: String!) {
    clearJobAnswer(jobId: $jobId, key: $key) {
      ...JobFormFields
    }
  }
`);
