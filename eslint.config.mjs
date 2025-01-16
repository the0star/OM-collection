import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

import eslintConfigPrettier from "eslint-config-prettier";
import nodePlugin from "eslint-plugin-n";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [
    ...compat.extends("eslint-config-jquery"),
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
