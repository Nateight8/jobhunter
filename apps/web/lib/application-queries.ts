import { graphql } from "./gql";

export const APPLICATION_FIELDS = graphql(`
  fragment ApplicationFields on Application {
    id
    status
    appliedAt
    notes
    updatedAt
    job {
      id
      title
      companyName
      location
      source
      url
      applyUrl
      applicationStatus
      application {
        id
        status
        appliedAt
        notes
      }
    }
  }
`);

export const APPLICATIONS_QUERY = graphql(`
  query Applications($status: ApplicationStatus) {
    applications(status: $status) {
      ...ApplicationFields
    }
  }
`);

export const APPLICATION_COUNTS_QUERY = graphql(`
  query ApplicationCounts {
    applicationCounts {
      status
      count
    }
  }
`);

export const SET_STATUS_MUTATION = graphql(`
  mutation SetApplicationStatus($jobId: ID!, $status: ApplicationStatus!, $notes: String) {
    setApplicationStatus(jobId: $jobId, status: $status, notes: $notes) {
      ...ApplicationFields
    }
  }
`);

export const SET_NOTES_MUTATION = graphql(`
  mutation SetApplicationNotes($jobId: ID!, $notes: String) {
    setApplicationNotes(jobId: $jobId, notes: $notes) {
      ...ApplicationFields
    }
  }
`);

export const REMOVE_APPLICATION_MUTATION = graphql(`
  mutation RemoveApplication($jobId: ID!) {
    removeApplication(jobId: $jobId) {
      id
      applicationStatus
      application {
        id
      }
    }
  }
`);

// A light read of just what the apply panel needs.
export const APPLY_PROFILE_QUERY = graphql(`
  query ApplyProfile {
    profile {
      id
      fullName
      email
      phone
      linkedinUrl
      githubUrl
      portfolioUrl
      documents {
        id
        kind
        filename
        isDefault
        downloadUrl
      }
    }
  }
`);
