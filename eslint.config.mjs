import globals from "globals";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import nodePlugin from "eslint-plugin-n";

// TODO: add jQuery rules
export default [
  js.configs.recommended,
  nodePlugin.configs["flat/recommended-script"],
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },
      ecmaVersion: 12,
      sourceType: "script",
    },
    rules: {
      quotes: ["error", "double"],
      semi: ["error", "always"],
    },
  },
];
