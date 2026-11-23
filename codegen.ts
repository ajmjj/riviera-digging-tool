import type { CodegenConfig } from "@graphql-codegen/cli";

// Typed Common Ground clients are generated from the committed schemas in
// contracts/common-ground/. Every operation under packages/common-ground/operations/<api>/
// is validated against its schema, so a mismatch fails `pnpm codegen` and the build.
// CI also fails if the committed output is stale.
const shared = {
  plugins: ["typescript", "typescript-operations"],
  config: {
    strictScalars: true,
    // Every custom scalar in the schemas must be mapped here, or generation fails.
    scalars: {
      Date: "string",
      JSON: "unknown",
      Long: "number",
      Upload: "never",
    },
    useTypeImports: true,
    enumsAsTypes: true,
    avoidOptionals: { field: true, inputValue: false, object: true },
  },
};

const config: CodegenConfig = {
  overwrite: true,
  ignoreNoDocuments: true,
  generates: {
    "packages/common-ground/src/generated/admin.ts": {
      schema: "contracts/common-ground/admin.graphql",
      documents: "packages/common-ground/operations/admin/**/*.graphql",
      ...shared,
    },
    "packages/common-ground/src/generated/client.ts": {
      schema: "contracts/common-ground/client.graphql",
      documents: "packages/common-ground/operations/client/**/*.graphql",
      ...shared,
    },
  },
};

export default config;
