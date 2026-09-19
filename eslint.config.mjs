import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";
import { defineConfig } from 'eslint/config';

export default defineConfig(
  // 1. Base TypeScript rules (no type information required)
  ...tseslint.configs.recommended,

  // 2. TypeScript overrides
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "import-x": importX,
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/consistent-type-imports": "error",

      // Code style
      "curly": "error",

      // Imports
      "import-x/no-cycle": "error",
    },
  },

  // 3. Test file overrides
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 4. Ignore patterns
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  }
);