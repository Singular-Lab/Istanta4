// Genera src/components/Base/Lucide/iconeUsate.ts: le icone Lucide che il codice nomina come stringa
// (<Lucide icon="Check" />, { icona: "Megaphone" }, icon={cond ? "ChevronUp" : "ChevronDown"}...).
// Il componente <Lucide> le risolve subito da lì, senza portare nel codice comune tutte le ~1900
// icone di lucide-react; i nomi che non ci sono (es. il menu letto dal DB) li risolve caricando la
// mappa completa con un import dinamico.
//
//   node scripts/generaIconeLucide.mjs           rigenera il file (yarn build lo esegue sempre)
//   node scripts/generaIconeLucide.mjs --check   fallisce se il file non è aggiornato
//
// Si cercano le stringhe letterali in PascalCase nei sorgenti di src/ e lib/ (test esclusi) e si
// tengono quelle che lucide-react esporta come icona, compresi gli alias legacy (Trash2,
// AlertTriangle...). Un falso positivo (una stringa che coincide con un nome di icona) costa
// solo un'icona in più nel bundle.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CARTELLE = ["src", "lib"]
const FILE_GENERATO = path.join(radice, "src/components/Base/Lucide/iconeUsate.ts")
const SORGENTE = /\.(ts|tsx)$/
const ESCLUSI = /(\.test\.|\.spec\.|\.d\.ts$|[\\/]__tests__[\\/])/
const STRINGA_PASCAL = /(["'`])([A-Z][A-Za-z0-9]*)\1/g

function sorgenti(cartella) {
  return readdirSync(cartella, { recursive: true, withFileTypes: true })
    .filter((voce) => voce.isFile() && SORGENTE.test(voce.name))
    .map((voce) => path.join(voce.parentPath, voce.name))
    .filter((file) => !ESCLUSI.test(file) && file !== FILE_GENERATO)
}

const lucide = await import("lucide-react")
const componentiIcona = new Set(Object.values(lucide.icons))
const nomiIcona = new Set(Object.keys(lucide).filter((nome) => componentiIcona.has(lucide[nome])))

const usate = new Set()
for (const cartella of CARTELLE) {
  for (const file of sorgenti(path.join(radice, cartella))) {
    for (const [, , nome] of readFileSync(file, "utf8").matchAll(STRINGA_PASCAL)) {
      if (nomiIcona.has(nome)) usate.add(nome)
    }
  }
}

const nomi = [...usate].sort()
const contenuto = `// File generato da scripts/generaIconeLucide.mjs: non modificarlo a mano.
// Icone Lucide nominate come stringa nel codice (${nomi.length}): <Lucide> le risolve senza caricare la
// mappa completa di lucide-react. Rigenera con \`node scripts/generaIconeLucide.mjs\`.
export {
${nomi.map((nome) => `  ${nome},`).join("\n")}
} from "lucide-react";
`

const attuale = (() => {
  try {
    return readFileSync(FILE_GENERATO, "utf8")
  } catch {
    return ""
  }
})()
const relativo = path.relative(radice, FILE_GENERATO)

if (process.argv.includes("--check")) {
  if (attuale !== contenuto) {
    console.error(`[icone] ${relativo} non è aggiornato: esegui node scripts/generaIconeLucide.mjs`)
    process.exit(1)
  }
  console.log(`[icone] ${relativo} aggiornato (${nomi.length} icone).`)
} else if (attuale !== contenuto) {
  writeFileSync(FILE_GENERATO, contenuto)
  console.log(`[icone] ${relativo} rigenerato (${nomi.length} icone).`)
} else {
  console.log(`[icone] ${relativo} già aggiornato (${nomi.length} icone).`)
}
