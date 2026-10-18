import { graphql } from "./gql";

export const JOBS_QUERY = graphql(`
  query Jobs($filter: JobFilter, $first: Int, $after: String) {
    jobs(filter: $filter, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          id
          title
          companyName
          location
          remoteType
          source
          boardSize
          firstSeenAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const JOB_QUERY = graphql(`
  query Job($id: ID!) {
    job(id: $id) {
      id
      title
      companyName
      location
      remoteType
      source
      url
      applyUrl
      firstSeenAt
      closedAt
      description
    }
  }
`);
