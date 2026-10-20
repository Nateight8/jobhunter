import type { CodegenConfig } from "@graphql-codegen/cli";

// Reads the API's generated schema file, so the API doesn't need to be running.
const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: [
    "lib/queries.ts",
    "lib/profile-queries.ts",
    "lib/board-queries.ts",
    "lib/application-queries.ts",
    "lib/memory-queries.ts",
    "lib/form-queries.ts",
    "lib/apply-run-queries.ts",
    "lib/form-queries.ts",
    "lib/form-queries.ts",
    "lib/form-queries.ts",
  ],
  generates: {
    "./lib/gql/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: { enumsAsTypes: true },
    },
  },
};

export default config;
