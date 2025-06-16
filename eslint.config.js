const js = require('@eslint/js');

module.exports = [
    {
        ignores: ["out/**", "dist/**", "**/*.d.ts", "jest.config.js", "node_modules/**"]
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module"
            },
            globals: {
                // Node.js globals
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                global: "readonly",
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                // Node.js types
                NodeJS: "readonly"
            }
        },
        plugins: {
            "@typescript-eslint": require('@typescript-eslint/eslint-plugin')
        },
        rules: {
            ...js.configs.recommended.rules,
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
        }
    }
]; 