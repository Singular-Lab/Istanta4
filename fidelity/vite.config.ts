/// <reference types="node" />

import react from "@vitejs/plugin-react"
import browserslist from "browserslist"
import { config as loadEnv } from "dotenv"
import { browserslistToTargets } from "lightningcss"
import { readFileSync } from "node:fs"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, URL } from "node:url"
import { promisify } from "node:util"
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib"
import { defineConfig, type Plugin } from "vite"
//@ts-ignore
import sri from 'vite-plugin-sri'

loadEnv({ path: ".env" })

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)

// Target della build: es2020 per i vecchi iPhone che aprono il volantino pubblico. Lo usano anche
// il minificatore e la trasformazione: i campi di classe diventano chiamate all'helper defineProperty.
const TARGET_BUILD = "es2020"

// Gruppi di chunk manuali. Ogni gruppo raccoglie una libreria (o librerie che si usano sempre
// insieme): una pagina scarica un gruppo solo se usa quella libreria, mai librerie estranee.
// Con includeDependenciesRecursively (predefinito) un gruppo cattura anche le dipendenze dei suoi
// moduli: per questo la base condivisa (vendor-core) ha priorità più alta e si prende per prima
// React, lo shim useSyncExternalStore (usato da react-redux nel codice comune) e gli helper del
// transpiler (moduli virtuali @oxc-project/runtime, usati da librerie e codice applicativo).
// Altrimenti finirebbero nel primo gruppo che li usa (chart.js, headlessui...) e il codice comune,
// importandoli da lì, trascinerebbe quel gruppo in ogni pagina.
// lucide-react non ha un gruppo: le icone usate stanno nei chunk di chi le usa e la mappa completa
// si carica a parte, solo quando serve (src/components/Base/Lucide/risolviIconaLucide.ts; vedi
// anche importDiretteLucide più sotto).
const PRIORITA_BASE = 100

const chunkRules: Array<{ name: string; test: RegExp; testId?: RegExp; priority?: number }> = [
  {
    name: "vendor-core",
    test: /^(react|react-dom|scheduler|use-sync-external-store)(\/|$)/,
    testId: /@oxc-project[+/]runtime/,
    priority: PRIORITA_BASE
  },
  { name: "vendor-router", test: /^(react-router|react-router-dom|@tanstack\/react-query)(\/|$)/ },
  { name: "headlessui", test: /^@headlessui\/react(\/|$)/ },
  { name: "radix", test: /^@radix-ui\// },
  { name: "framer-motion", test: /^framer-motion(\/|$)/ },
  { name: "tippy", test: /^(tippy\.js|@tippyjs\/react)(\/|$)/ },
  { name: "lexical", test: /^(lexical|@lexical\/)/ },
  { name: "monaco", test: /^@monaco-editor\/react(\/|$)/ },
  { name: "leaflet", test: /^(leaflet|react-leaflet)(\/|$)/ },
  { name: "chartjs", test: /^chart\.js(\/|$)/ },
  { name: "xlsx", test: /^xlsx(\/|$)/ },
  { name: "react-dnd", test: /^(react-dnd|react-dnd-html5-backend)(\/|$)/ },
  { name: "swiper", test: /^swiper(\/|$)/ },
  { name: "tom-select", test: /^tom-select(\/|$)/ },
  { name: "litepicker", test: /^litepicker(\/|$)/ },
  { name: "i18n", test: /^(i18next|react-i18next|i18next-browser-languagedetector)(\/|$)/ }
]

function getModuleIdFromNodeModulesPath(id: string): string | null {
  const match = id.replace(/\\/g, "/").match(/node_modules\/(.*)$/)
  return match?.[1] ?? null
}

const codeSplittingGroups = chunkRules.map((rule) => ({
  name: rule.name,
  priority: rule.priority,
  test(id: string) {
    if (rule.testId?.test(id)) return true
    const moduleId = getModuleIdFromNodeModulesPath(id)
    if (!moduleId) return false
    return rule.test.test(moduleId)
  }
}))

// lucide-react: nella build gli import nominali dal pacchetto (import { Check } from "lucide-react",
// export { Check } from "lucide-react") diventano import del singolo file dell'icona. Così il modulo
// principale di lucide-react, che esporta tutte le ~1900 icone, non è raggiungibile staticamente
// dal codice comune e la mappa completa caricata con import("lucide-react") finisce davvero in un
// chunk a parte: altrimenti il bundler la metterebbe insieme alle icone usate, nel codice comune.
// Restano sul pacchetto gli import di namespace (import * as) e i nomi che non sono icone
// (icons, createLucideIcon, tipi): quelli usati solo come tipo spariscono con la compilazione TS.
const IMPORT_NOMINALI_LUCIDE = /\b(import|export)(\s+type)?\s*\{([^}]*)\}\s*from\s*(["'])lucide-react\4;?/g

function importDiretteLucide(): Plugin {
  const radiceLucide = path.dirname(createRequire(import.meta.url).resolve("lucide-react/package.json"))
  // Nome esportato (anche alias legacy, es. AlertTriangle) -> file dell'icona
  const fileIcona = new Map<string, string>()
  const barile = readFileSync(path.join(radiceLucide, "dist/esm/lucide-react.mjs"), "utf8")
  for (const [, nomi, file] of barile.matchAll(/export \{([^}]*)\} from '\.\/icons\/([\w-]+\.mjs)';/g)) {
    for (const [, nome] of nomi.matchAll(/default as (\w+)/g)) {
      fileIcona.set(nome, `lucide-react/dist/esm/icons/${file}`)
    }
  }

  return {
    name: "fidelity:import-dirette-lucide",
    apply: "build",
    enforce: "pre",
    transform(codice, id) {
      if (id.includes("node_modules") || !/\.[jt]sx?$/.test(id) || !codice.includes("lucide-react")) return null
      let modificato = false
      const risultato = codice.replace(IMPORT_NOMINALI_LUCIDE, (dichiarazione, tipo, soloTipi, elenco) => {
        if (soloTipi) return dichiarazione
        const diretti: string[] = []
        const restanti: string[] = []
        for (const voce of elenco.split(",").map((v: string) => v.trim()).filter(Boolean)) {
          const [importato, locale = importato] = voce.split(/\s+as\s+/)
          const file = voce.startsWith("type ") ? undefined : fileIcona.get(importato)
          if (!file) {
            restanti.push(voce)
          } else if (tipo === "import") {
            diretti.push(`import ${locale} from "${file}";`)
          } else {
            diretti.push(`export { default as ${locale} } from "${file}";`)
          }
        }
        if (diretti.length === 0) return dichiarazione
        modificato = true
        if (restanti.length > 0) diretti.push(`${tipo} { ${restanti.join(", ")} } from "lucide-react";`)
        // Stesso numero di righe: i numeri di riga del resto del file non cambiano
        return diretti.join(" ") + "\n".repeat(dichiarazione.split("\n").length - 1)
      })
      return modificato ? { code: risultato, map: null } : null
    }
  }
}

// Console in produzione: via console.log/info/debug (e i debugger), restano console.warn/error.
// esbuild.drop non vale più (Vite 8 minifica con oxc): il minificatore tratta queste chiamate
// come pure e, poiché il loro risultato non è usato, le elimina.
const CONSOLE_DA_RIMUOVERE = ["console.log", "console.info", "console.debug"]

// Compressione statica: per ogni JS/CSS/HTML/SVG/JSON della build scrive accanto .gz e .br, che il
// server può inviare al posto dell'originale. Sostituisce vite-plugin-compression, che con due
// istanze (gzip e brotli) non scriveva i .br: la cache dei file già compressi è condivisa fra le
// istanze e la seconda saltava tutto. Gira alla fine, dopo che vite-plugin-sri ha riscritto l'HTML.
const ESTENSIONI_COMPRIMIBILI = /\.(js|css|html|svg|json)$/
const SOGLIA_COMPRESSIONE = 1024

function compressioneStatica(): Plugin {
  let cartellaOutput = ""
  return {
    name: "fidelity:compressione-statica",
    apply: "build",
    configResolved(config) {
      cartellaOutput = path.resolve(config.root, config.build.outDir)
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        const voci = await readdir(cartellaOutput, { recursive: true, withFileTypes: true })
        const file = voci
          .filter((voce) => voce.isFile() && ESTENSIONI_COMPRIMIBILI.test(voce.name))
          .map((voce) => path.join(voce.parentPath, voce.name))
          // Il manifest serve solo alla build e agli script, non al browser
          .filter((percorso) => !path.relative(cartellaOutput, percorso).startsWith(".vite"))
        await Promise.all(
          file.map(async (percorso) => {
            const contenuto = await readFile(percorso)
            if (contenuto.length < SOGLIA_COMPRESSIONE) return
            const [gz, br] = await Promise.all([
              gzipAsync(contenuto, { level: zlibConstants.Z_BEST_COMPRESSION }),
              brotliAsync(contenuto, {
                params: {
                  [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY,
                  [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
                  [zlibConstants.BROTLI_PARAM_SIZE_HINT]: contenuto.length
                }
              })
            ])
            await Promise.all([writeFile(`${percorso}.gz`, gz), writeFile(`${percorso}.br`, br)])
          })
        )
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production"
  const isDevelopment = mode === "development"
  const enableLazyBarrel = process.env.VITE_EXPERIMENTAL_LAZY_BARREL === "true"

  const BASE_URL = process.env.BASE_URL || "/"
  const API_URL = process.env.API_URL || ""
  const WS_URL = process.env.WS_URL || ""
  const PORT = process.env.PORTA_VITE
    ? parseInt(process.env.PORTA_VITE, 10)
    : 3000
  const HMR_HOST = process.env.HMR_HOST || "localhost"

  return {
    base: BASE_URL,

    publicDir: "public",

    assetsInclude: ["**/*.lottie"],

    define: {
      __WS_URL__: JSON.stringify(WS_URL)
    },

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },

    css: {
      devSourcemap: isDevelopment,
      postcss: "./postcss.config.cjs",
      lightningcss: {
        targets: browserslistToTargets(browserslist()),
        drafts: {
          customMedia: true
        }
      }
    },

    plugins: [
      importDiretteLucide(),
      react(),
      sri({
        algorithms: ['sha384']
      }),
      compressioneStatica()
    ],

    server: {
      host: "0.0.0.0",
      port: PORT,
      strictPort: true,
      hmr: {
        host: HMR_HOST,
        protocol: "ws",
        overlay: true
      },
      warmup: {
        clientFiles: [
          "./src/router/index.tsx",
          "./src/main.tsx",
          "./src/components/**/*.tsx",
          "./src/stores/**/*.ts"
        ]
      },
      proxy: {
        "/api": {
          target: API_URL,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, "")
        },
        // Materiali Olimpo: passano dal proxy di sola lettura del server Fidelity
        "/olimpo": {
          target: process.env.FIDELITY_SERVER_URL || `http://localhost:${process.env.NODE_PORT || 3001}`,
          changeOrigin: true
        }
      },
    },

    envPrefix: ["VITE_", "PUBLIC_"],

    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@tanstack/react-query",
        "leaflet"
      ],
      rolldownOptions: {}
    },

    build: {
      target: TARGET_BUILD,
      outDir: "dist/client",
      emptyOutDir: true,
      manifest: true,
      sourcemap: isDevelopment,
      minify: "oxc",
      cssMinify: isProduction ? "lightningcss" : false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      assetsInlineLimit: 4096,
      reportCompressedSize: false,
      modulePreload: {
        polyfill: true
      },

      rolldownOptions: {
        experimental: enableLazyBarrel
          ? {
            lazyBarrel: true
          }
          : undefined,
        input: {
          main: "./index.html"
        },
        output: {
          minify: {
            compress: {
              target: TARGET_BUILD,
              dropDebugger: true,
              treeshake: { manualPureFunctions: CONSOLE_DA_RIMUOVERE }
            },
            mangle: true,
            codegen: true
          },
          entryFileNames: "assets/js/[hash].js",
          chunkFileNames: "assets/js/[hash].js",
          assetFileNames: (assetInfo: { name?: string }) => {
            const name = assetInfo.name || ""
            if (/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(name)) {
              return "assets/images/[hash][extname]"
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
              return "assets/fonts/[hash][extname]"
            }
            if (/\.css$/i.test(name)) {
              return "assets/css/[hash][extname]"
            }
            return "assets/[hash][extname]"
          },
          codeSplitting: {
            groups: codeSplittingGroups
          }
        }
      }
    }
  }
})
