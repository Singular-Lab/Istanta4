import JavaScriptObfuscator from "javascript-obfuscator";
import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const DIST = path.resolve("dist", pkg.version);

// OBFUSCHIAMO SOLO IL BUNDLE IIFE REALE
const TARGET_FILES = [
    path.join(DIST, "index.global.js")
];

const OBFUSCATION_OPTIONS = {
    compact: true,

    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.8,

    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,

    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,

    splitStrings: true,
    shuffleStringArray: true,
    numbersToExpressions: true,
    simplify: true,

    // 🔴 NON rinominare i global
    renameGlobals: false,

    // 🔴 Proteggi API pubblica
    reservedNames: ["FP"],

    identifierNamesGenerator: "hexadecimal",
    transformObjectKeys: true,

    unicodeEscapeSequence: false,

    selfDefending: true,
    debugProtection: true,
    debugProtectionInterval: 4000
};

for (const file of TARGET_FILES) {
    if (!fs.existsSync(file)) {
        console.warn(`[obfuscate] File non trovato: ${file}`);
        continue;
    }

    const source = fs.readFileSync(file, "utf8");

    const obfuscated = JavaScriptObfuscator
        .obfuscate(source, OBFUSCATION_OPTIONS)
        .getObfuscatedCode();

    fs.writeFileSync(file, obfuscated, "utf8");

    console.log(`[obfuscate] ${path.basename(file)} obfuscated`);
}
