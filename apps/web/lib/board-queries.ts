import { graphql } from "./gql";

export const BOARD_FILTER_FIELDS = graphql(`
  fragment BoardFilterFields on BoardFilter {
    search
    stack
    remoteTypes
    sources
    startupOnly
    startupMaxBoardSize
    titleIncludes
    titleExcludes
    regions
  }
`);

export const BOARD_FIELDS = graphql(`
  fragment BoardFields on Board {
    id
    name
    position
    kind
    filter {
      ...BoardFilterFields
    }
  }
`);

export const BOARDS_QUERY = graphql(`
  query Boards {
    boards {
      ...BoardFields
    }
  }
`);

// Separate from the list on purpose: counts are slower and must not block the tab bar.
export const BOARD_COUNTS_QUERY = graphql(`
  query BoardCounts {
    boards {
      id
      count {
        value
        capped
      }
    }
  }
`);

export const BOARD_PRESETS_QUERY = graphql(`
  query BoardPresets {
    boardPresets {
      id
      name
      description
      filter {
        ...BoardFilterFields
      }
    }
  }
`);

export const REGION_OPTIONS_QUERY = graphql(`
  query RegionOptions {
    regionOptions {
      code
      name
      count
    }
  }
`);

export const CREATE_BOARD_MUTATION = graphql(`
  mutation CreateBoard($name: String!, $filter: BoardFilterInput) {
    createBoard(name: $name, filter: $filter) {
      ...BoardFields
    }
  }
`);

export const UPDATE_BOARD_MUTATION = graphql(`
  mutation UpdateBoard($id: ID!, $name: String, $filter: BoardFilterInput) {
    updateBoard(id: $id, name: $name, filter: $filter) {
      ...BoardFields
    }
  }
`);

export const DELETE_BOARD_MUTATION = graphql(`
  mutation DeleteBoard($id: ID!) {
    deleteBoard(id: $id) {
      id
    }
  }
`);

export const REORDER_BOARDS_MUTATION = graphql(`
  mutation ReorderBoards($ids: [ID!]!) {
    reorderBoards(ids: $ids) {
      id
    }
  }
`);

export const RESET_RECOMMENDED_MUTATION = graphql(`
  mutation ResetRecommended {
    resetRecommendedBoard {
      ...BoardFields
    }
  }
`);
