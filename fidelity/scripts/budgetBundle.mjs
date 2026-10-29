// Budget del bundle client: dopo la build misura, per ogni rotta di budget.json, il codice JS e CSS
// che il browser scarica (gzip e brotli) e fallisce se una voce supera il budget oltre la tolleranza.
//
//   node scripts/budgetBundle.mjs              verifica (yarn build lo esegue dopo build:client)
//   node scripts/budgetBundle.mjs --aggiorna   riscrive budget.json con le misure attuali
//   opzioni: --dist <cartella build>  --budget <file budget>
//
// Le rotte sono elenchi di moduli sorgente (chiavi del manifest di Vite, build.manifest: true):
// a ogni rotta si aggiunge il codice statico dell'ingresso, comune a tutte le pagine.
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"
import { budgetDaMisure, confrontaBudget, misuraRotte } from "./budgetBundle/calcolo.mjs"

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function opzione(nome, predefinito) {
  const indice = process.argv.indexOf(nome)
  return indice >= 0 && process.argv[indice + 1] ? process.argv[indice + 1] : predefinito
}

const cartellaDist = path.resolve(radice, opzione("--dist", "dist/client"))
const fileBudget = path.resolve(radice, opzione("--budget", "budget.json"))
const aggiorna = process.argv.includes("--aggiorna")

const fileManifest = path.join(cartellaDist, ".vite", "manifest.json")
let manifest
try {
  manifest = JSON.parse(readFileSync(fileManifest, "utf8"))
} catch (errore) {
  console.error(`[budget] manifest di Vite non leggibile (${fileManifest}): esegui prima la build.`)
  console.error(errore instanceof Error ? errore.message : errore)
  process.exit(1)
}
const budget = JSON.parse(readFileSync(fileBudget, "utf8"))

// Stessi livelli dei file .gz/.br prodotti dalla build
const cache = new Map()
function misura(file) {
  let dimensioni = cache.get(file)
  if (!dimensioni) {
    const contenuto = readFileSync(path.join(cartellaDist, file))
    dimensioni = {
      gzip: zlib.gzipSync(contenuto, { level: zlib.constants.Z_BEST_COMPRESSION }).length,
      brotli: zlib.brotliCompressSync(contenuto, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
        }
      }).length
    }
    cache.set(file, dimensioni)
  }
  return dimensioni
}

const rotte = Object.fromEntries(Object.entries(budget.rotte).map(([nome, voce]) => [nome, voce.moduli]))
let misure
try {
  misure = misuraRotte(manifest, rotte, misura)
} catch (errore) {
  console.error(`[budget] ${errore instanceof Error ? errore.message : errore}`)
  process.exit(1)
}

if (aggiorna) {
  writeFileSync(fileBudget, JSON.stringify(budgetDaMisure(misure, budget), null, 2) + "\n")
  console.log(`[budget] ${path.relative(radice, fileBudget)} aggiornato con le misure attuali.`)
}

const { righe, sforamenti } = confrontaBudget(misure, aggiorna ? budgetDaMisure(misure, budget) : budget)
const kib = (n) => n.toFixed(1).padStart(7)
const percentuale = (n) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%` : "n/d").padStart(7)
console.log(`\n[budget] codice per rotta (KiB, tolleranza +${((budget.tolleranza ?? 0) * 100).toFixed(0)}%)`)
console.log(`${"rotta".padEnd(26)} ${"tipo".padEnd(4)} ${"compr.".padEnd(6)}  misura   budget  variaz.`)
for (const r of righe) {
  console.log(
    `${r.rotta.padEnd(26)} ${r.tipo.padEnd(4)} ${r.compressione.padEnd(6)} ${kib(r.misuraKiB)} ${kib(r.budgetKiB)} ${percentuale(r.variazione)}${r.sfora ? "  SFORA" : ""}`
  )
}

if (sforamenti.length > 0) {
  console.error(`\n[budget] budget superato:\n  - ${sforamenti.join("\n  - ")}`)
  console.error(
    "[budget] Riduci il codice caricato dalla rotta o, se l'aumento è voluto, aggiorna il budget con " +
      "`node scripts/budgetBundle.mjs --aggiorna` e motivalo nella pull request."
  )
  // Blocca la CI (e chi lo chiede con --rigoroso), non la build dell'immagine di produzione:
  // qualche KB in più non deve fermare un rilascio
  if (process.env.CI || process.argv.includes("--rigoroso")) process.exit(1)
  console.error("[budget] fuori dalla CI e senza --rigoroso: solo avviso.")
}
console.log("\n[budget] tutte le rotte rientrano nel budget.")
