import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// Polyfill per structuredClone se non disponibile
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const browserGlobals = Object.fromEntries(
  Object.entries(globals.browser).map(([key, value]) => [key.trim(), value])
);

export default [
  // Ignora le cartelle dist e node_modules
  {
    ignores: ["node_modules/**", "dist/**", "server/**", "coverage/**", ".github/**"],
  },
  
  // Configurazione per tutti i file JavaScript/TypeScript
  {
    files: ["**/*.{js,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": typescriptEslint
    },

    languageOptions: {
      globals: {
        ...browserGlobals,
      },
      parser: tsParser,
      ecmaVersion: 12,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    rules: {
      // Regole base semplificate
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "warn",
      "no-eval": "error",
      
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-var-requires": "error",
      
      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // Sicurezza
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      
      // Qualità codice
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "warn",
      "prefer-template": "warn",
    },
  },
  
  // Configurazione specifica per file React/TSX
  {
    files: ["src/**/*.{tsx,ts}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: "./src/tsconfig.json",
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // Regole specifiche per React
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // TypeScript specifico per React
      "@typescript-eslint/no-explicit-any": "warn",

      // Stile unificato: niente misure, raggi e spaziature arbitrarie, colori esadecimali o gray nelle classi
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(^|[\\s:])text-\\[\\d+(\\.\\d+)?(px|rem|em)\\]/]",
          message: "Usa text-3xs, text-2xs, text-xs, text-sm… invece di text-[N].",
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|[\\s:])text-\\[\\d+(\\.\\d+)?(px|rem|em)\\]/]",
          message: "Usa text-3xs, text-2xs, text-xs, text-sm… invece di text-[N].",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(^|[\\s:])(rounded(-[a-z]{1,2})?|tracking)-\\[/]",
          message: "Niente raggi o spaziature arbitrarie: usa rounded-card, rounded-control, rounded-full, title-eyebrow o tracking-*.",
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|[\\s:])(rounded(-[a-z]{1,2})?|tracking)-\\[/]",
          message: "Niente raggi o spaziature arbitrarie: usa rounded-card, rounded-control, rounded-full, title-eyebrow o tracking-*.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(^|[\\s:])[a-z-]+-gray-\\d/]",
          message: "Usa la scala slate-* invece di gray-*.",
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|[\\s:])[a-z-]+-gray-\\d/]",
          message: "Usa la scala slate-* invece di gray-*.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Niente colori esadecimali in className: usa i token del tema (primary, slate-*, …).",
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Niente colori esadecimali in className: usa i token del tema (primary, slate-*, …).",
        },
      ],
    }
  }
];
