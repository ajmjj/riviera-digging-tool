// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      "reports/**",
      "test-results/**",
      "playwright-report/**",
      ".stryker-tmp/**",
      "packages/*/src/generated/**",
      ".specify/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    linterOptions: {
      // Disabling a rule inline is not allowed at all; the suppression guard also blocks it.
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // No unchecked casts: `as` is banned except `as const`. Narrow with type guards.
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["apps/web/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // CLI scripts report to the console by design.
    files: ["ci/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
);
