import type { CodegenConfig } from "@graphql-codegen/cli";

// Reads the API's generated schema file, so the API doesn't need to be running.
const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["lib/queries.ts"],
  generates: {
    "./lib/gql/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: { enumsAsTypes: true },
    },
  },
};

export default config;
