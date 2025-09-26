import jsdoc from "eslint-plugin-jsdoc";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import stylisticTs from "@stylistic/eslint-plugin-ts";

export default [{
    files: ["**/*.ts"],
}, {
    ...reactHooksPlugin.configs.recommended,
    ...reactPlugin.configs.flat.recommended,
    ...prettierConfig,
    settings: {
        react: {
            version: "detect",
        },
    },
    plugins: {
        jsdoc,
        "@typescript-eslint": tsPlugin,
        "react-hooks": reactHooksPlugin,
        "@stylistic/ts": stylisticTs,
    },
    languageOptions: {
        parser: typescriptParser,
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    rules: {
        curly: "error",
        "dot-notation": "off",
        "eol-last": "error",
        eqeqeq: ["error", "always", { null: "ignore" }],
        "guard-for-in": "off",
        "jsdoc/check-alignment": "error",
        "new-parens": "error",
        "no-array-constructor": "error",
        "no-bitwise": "off",
        "no-caller": "error",
        "no-cond-assign": "error",
        "no-console": ["error", { allow: ["error", "log", "warn", "info"] }],
        "no-debugger": "error",
        "no-empty": "off",
        "no-eval": "error",
        "no-fallthrough": "off",
        "no-new-wrappers": "error",
        "no-redeclare": "error",
        "no-restricted-imports": ["error", "moment"],
        "no-shadow": "off",
        "no-unused-expressions": "off",
        "no-unused-labels": "error",
        "no-var": "error",
        "semi": "error",
        "sort-keys": "off",
        "spaced-comment": ["off", "always"],
        "use-isnan": "error",
        "no-duplicate-imports": "error",
        "@typescript-eslint/no-unused-expressions": [
            "error",
            { allowShortCircuit: true, allowTernary: true },
        ],
        "@typescript-eslint/array-type": "off",
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],
        "@typescript-eslint/consistent-type-assertions": "error",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-namespace": ["error", { allowDeclarations: false }],
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/triple-slash-reference": "error",
        "@stylistic/ts/type-annotation-spacing": [
            "error",
            {
                after: true,
                before: false,
                overrides: {
                    arrow: { after: true, before: true },
                },
            },
        ],
        "react-hooks/exhaustive-deps": "error",

        curly: "warn",
        eqeqeq: "warn",
    }
}];
