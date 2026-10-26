import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
    entry: {
        index: "src/index.ts"
    },

    // Build multipla: ESM, CJS e IIFE
    format: ["esm", "cjs", "iife"],

    // Nome globale per il bundle browser
    globalName: "FP",

    // Sourcemap utile in dev
    sourcemap: true,

    // Minify solo in produzione
    minify: process.env.NODE_ENV === "production",

    // Costante compile-time per disattivare i log runtime in build prod
    define: {
        __FP_IS_PROD__: JSON.stringify(process.env.NODE_ENV === "production")
    },

    // Pulizia output
    clean: true,

    // Genera index.d.ts
    dts: true,

    // Output versionato
    outDir: `dist/${pkg.version}`,

    // Footer per IIFE: espone direttamente la classe invece del modulo
    footer: {
        js: "if(typeof FP!=='undefined'&&FP.default)FP=FP.default;"
    }
});
