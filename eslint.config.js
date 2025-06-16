const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
    {
        ignores: [
            "**/out/**",
            "**/dist/**", 
            "**/*.d.ts",
            "**/node_modules/**",
            "**/.vscode/**",
            "**/coverage/**",
            "**/*.vsix"
        ]
    },
    
    {
        files: ["**/*.ts", "**/*.tsx"],
        
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
            ...tseslint.configs.stylistic,
        ],
        
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                project: "./tsconfig.json"
            }
        },
        
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-floating-promises": "warn",
            "@typescript-eslint/no-misused-promises": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/require-await": "warn",
            "@typescript-eslint/restrict-template-expressions": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "@typescript-eslint/consistent-type-imports": ["warn", { "prefer": "type-imports" }],
            
            "comma-dangle": ["warn", "always-multiline"],
            "object-curly-spacing": ["warn", "always"],
            "array-bracket-spacing": ["warn", "never"],
            "quote-props": ["warn", "as-needed"],
            "prefer-template": "warn",
            "object-shorthand": "warn",
        }
    },
    
    {
        files: ["**/*.test.ts", "**/tests/**/*.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        }
    }
); 