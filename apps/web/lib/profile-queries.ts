import { graphql } from "./gql";

export const PROFILE_FIELDS = graphql(`
  fragment ProfileFields on Profile {
    id
    fullName
    email
    phone
    headline
    summary
    city
    country
    timezone
    linkedinUrl
    githubUrl
    portfolioUrl
    links {
      label
      url
    }
    yearsExperience
    authorizedRegions
    confirmedAt
    experiences {
      id
      company
      title
      location
      startDate
      endDate
      isCurrent
      bullets
      technologies
    }
    education {
      id
      school
      degree
      field
      startDate
      endDate
    }
    projects {
      id
      name
      url
      description
      bullets
      technologies
    }
    skills {
      id
      name
      category
    }
    readiness {
      ready
      missing
    }
    documents {
      id
      kind
      filename
      sizeBytes
      isDefault
      createdAt
      downloadUrl
    }
    draft {
      id
      status
      error
      model
      documentId
      createdAt
      data {
        fullName
        email
        phone
        headline
        summary
        city
        country
        linkedinUrl
        githubUrl
        portfolioUrl
        otherLinks {
          label
          url
        }
        experiences {
          company
          title
          location
          startDate
          endDate
          isCurrent
          bullets
          technologies
        }
        education {
          school
          degree
          field
          startDate
          endDate
        }
        projects {
          name
          url
          description
          bullets
          technologies
        }
        skills {
          name
          category
        }
      }
    }
  }
`);

export const PROFILE_QUERY = graphql(`
  query Profile {
    profile {
      ...ProfileFields
    }
  }
`);

export const EXTRACT_MUTATION = graphql(`
  mutation ExtractProfile($documentId: ID!) {
    extractProfile(documentId: $documentId) {
      ...ProfileFields
    }
  }
`);

export const CONFIRM_MUTATION = graphql(`
  mutation ConfirmProfile($input: ConfirmProfileInput!, $draftId: ID) {
    confirmProfile(input: $input, draftId: $draftId) {
      ...ProfileFields
    }
  }
`);

export const DISCARD_MUTATION = graphql(`
  mutation DiscardDraft($id: ID!) {
    discardDraft(id: $id) {
      ...ProfileFields
    }
  }
`);
