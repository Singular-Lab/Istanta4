/// <reference types="node" />

import react from "@vitejs/plugin-react"
import browserslist from "browserslist"
import { config as loadEnv } from "dotenv"
import { browserslistToTargets } from "lightningcss"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import viteCompression from "vite-plugin-compression"
//@ts-ignore
import sri from 'vite-plugin-sri'

loadEnv({ path: ".env" })

const chunkRules: Array<{ name: string; test: RegExp }> = [
  { name: "c0", test: /^(react|react-dom|scheduler)(\/|$)/ },
  { name: "c1", test: /^(react-router|react-router-dom|@tanstack\/react-query)(\/|$)/ },
  { name: "c2", test: /^(@headlessui\/react|@radix-ui\/|framer-motion|react-transition-group|tippy\.js|@tippyjs\/react)(\/|$)/ },
  { name: "c3", test: /^(@lucide\/|lucide|lucide-react)(\/|$)/ },
  { name: "c4", test: /^(@ckeditor\/|ckeditor|lexical|@lexical\/|@monaco-editor\/react|monaco-editor)(\/|$)/ },
  { name: "c5", test: /^(leaflet|leaflet\.markercluster|react-leaflet|react-leaflet-cluster)(\/|$)/ },
  { name: "c6", test: /^(chart\.js)(\/|$)/ },
  { name: "c7", test: /^(tabulator-tables)(\/|$)/ },
  { name: "c8", test: /^(xlsx)(\/|$)/ },
  { name: "c9", test: /^(exceljs)(\/|$)/ },
  { name: "cA", test: /^(jspdf|jspdf-autotable)(\/|$)/ },
  { name: "cB", test: /^(@dnd-kit\/|react-dnd|react-dnd-html5-backend|react-grid-layout|react-rnd)(\/|$)/ },
  { name: "cC", test: /^(swiper|zoom-vanilla\.js|tiny-slider|tom-select|litepicker)(\/|$)/ },
  { name: "cD", test: /^(i18next|react-i18next|i18next-browser-languagedetector)(\/|$)/ }
]

function getModuleIdFromNodeModulesPath(id: string): string | null {
  const match = id.match(/node_modules[\\/](.*)$/)
  return match?.[1] ?? null
}

const codeSplittingGroups = chunkRules.map((rule) => ({
  name: rule.name,
  test(id: string) {
    const moduleId = getModuleIdFromNodeModulesPath(id)
    if (!moduleId) return false
    return rule.test.test(moduleId)
  }
}))

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
      __APP_VERSION__: JSON.stringify("v1.2.5"),
      __API_URL__: JSON.stringify(API_URL),
      __WS_URL__: JSON.stringify(WS_URL),
      __DEV__: JSON.stringify(isDevelopment)
    },

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "tailwind-config": fileURLToPath(
          new URL("./tailwind.config.js", import.meta.url)
        )
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
      react(),
      viteCompression({
        threshold: 1024,
        algorithm: "gzip",
        ext: ".gz",
        filter: /\.(js|css|html|svg|json)$/
      }),
      sri({
        algorithms: ['sha384']
      }),
      viteCompression({
        threshold: 1024,
        algorithm: "brotliCompress",
        ext: ".br",
        filter: /\.(js|css|html|svg|json)$/
      })
    ].filter(Boolean),

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
        "leaflet",
        "leaflet.markercluster"
      ],
      rolldownOptions: {}
    },

    build: {
      target: "es2020",
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
      compress: {
        dropConsole: true,
      },
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
    },

    esbuild: {
      drop: ["console", "debugger"]
    }
  }
})
