import { graphql } from "./gql";

export const APPLY_RUN_FIELDS = graphql(`
  fragment ApplyRunFields on ApplyRun {
    id
    jobId
    status
    message
    createdAt
    updatedAt
    screenshotUrl
    outcomes {
      key
      label
      required
      state
      note
    }
    log {
      at
      text
    }
  }
`);

export const APPLY_RUN_QUERY = graphql(`
  query ApplyRun($jobId: ID!) {
    applyRun(jobId: $jobId) {
      ...ApplyRunFields
    }
  }
`);

export const START_APPLY_MUTATION = graphql(`
  mutation StartApply($jobId: ID!) {
    startApply(jobId: $jobId) {
      ...ApplyRunFields
    }
  }
`);
