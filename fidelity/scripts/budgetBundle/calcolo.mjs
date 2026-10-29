// Calcolo del budget del bundle client: quanto codice (JS e CSS, compresso) scarica ogni rotta.
// Modulo puro: legge solo il manifest di Vite e una funzione che misura i file, così si testa
// con un manifest finto. Lo usa scripts/budgetBundle.mjs dopo la build.

/**
 * @typedef {{ file: string, src?: string, isEntry?: boolean, isDynamicEntry?: boolean,
 *   imports?: string[], dynamicImports?: string[], css?: string[] }} VoceManifest
 * @typedef {Record<string, VoceManifest>} Manifest
 * @typedef {{ gzip: number, brotli: number }} Dimensioni
 * @typedef {{ js: Dimensioni, css: Dimensioni }} MisuraRotta
 * @typedef {{ moduli: string[], js: Dimensioni, css: Dimensioni }} BudgetRotta
 * @typedef {{ unita?: string, tolleranza: number, rotte: Record<string, BudgetRotta> }} Budget
 */

/** Chiave del manifest dell'HTML d'ingresso: il suo codice statico lo scarica ogni pagina. */
export const CHIAVE_INGRESSO = "index.html"

/**
 * File JS e CSS che il browser scarica per eseguire i moduli indicati: il loro chunk e,
 * ricorsivamente, i chunk importati staticamente (gli import dinamici restano fuori, si
 * scaricano solo quando servono). Ogni rotta include sempre il codice dell'ingresso.
 *
 * @param {Manifest} manifest
 * @param {string[]} moduli chiavi del manifest (percorsi sorgente, es. "src/pages/HubLogin/index.tsx")
 * @returns {{ js: string[], css: string[] }}
 */
export function fileNecessari(manifest, moduli) {
  const visitati = new Set()
  const js = new Set()
  const css = new Set()
  const daVisitare = [CHIAVE_INGRESSO, ...moduli]

  while (daVisitare.length > 0) {
    const chiave = daVisitare.pop()
    if (visitati.has(chiave)) continue
    visitati.add(chiave)
    const voce = manifest[chiave]
    if (!voce) {
      throw new Error(
        `Il modulo "${chiave}" non è nel manifest di Vite: è stato rinominato o non è più un chunk ` +
          "a sé (import dinamico diventato statico?). Aggiorna i moduli della rotta in budget.json."
      )
    }
    if (voce.file.endsWith(".js")) js.add(voce.file)
    for (const fileCss of voce.css ?? []) css.add(fileCss)
    for (const importato of voce.imports ?? []) daVisitare.push(importato)
  }

  return { js: [...js].sort(), css: [...css].sort() }
}

/**
 * @param {string[]} file
 * @param {(file: string) => Dimensioni} misura
 * @returns {Dimensioni}
 */
function somma(file, misura) {
  return file.reduce(
    (totale, nome) => {
      const { gzip, brotli } = misura(nome)
      return { gzip: totale.gzip + gzip, brotli: totale.brotli + brotli }
    },
    { gzip: 0, brotli: 0 }
  )
}

/**
 * Dimensioni compresse (byte) del codice necessario a ogni rotta.
 *
 * @param {Manifest} manifest
 * @param {Record<string, string[]>} rotte nome della rotta -> moduli d'ingresso della rotta
 * @param {(file: string) => Dimensioni} misura dimensioni gzip e brotli di un file della build
 * @returns {Record<string, MisuraRotta>}
 */
export function misuraRotte(manifest, rotte, misura) {
  /** @type {Record<string, MisuraRotta>} */
  const misure = {}
  for (const [nome, moduli] of Object.entries(rotte)) {
    const { js, css } = fileNecessari(manifest, moduli)
    misure[nome] = { js: somma(js, misura), css: somma(css, misura) }
  }
  return misure
}

const KIB = 1024
const COMPRESSIONI = /** @type {const} */ (["gzip", "brotli"])
const TIPI = /** @type {const} */ (["js", "css"])

/**
 * Confronta le misure (byte) con il budget (KiB): una voce sfora quando supera il budget
 * maggiorato della tolleranza. Una rotta del budget senza misura è un errore.
 *
 * @param {Record<string, MisuraRotta>} misure
 * @param {Budget} budget
 * @returns {{ righe: Array<{ rotta: string, tipo: "js" | "css", compressione: "gzip" | "brotli",
 *   misuraKiB: number, budgetKiB: number, limiteKiB: number, variazione: number, sfora: boolean }>,
 *   sforamenti: string[] }}
 */
export function confrontaBudget(misure, budget) {
  const tolleranza = budget.tolleranza ?? 0
  const righe = []
  const sforamenti = []

  for (const [rotta, limiti] of Object.entries(budget.rotte)) {
    const misura = misure[rotta]
    if (!misura) {
      sforamenti.push(`${rotta}: nessuna misura per la rotta`)
      continue
    }
    for (const tipo of TIPI) {
      for (const compressione of COMPRESSIONI) {
        const budgetKiB = limiti[tipo][compressione]
        const misuraKiB = misura[tipo][compressione] / KIB
        const limiteKiB = budgetKiB * (1 + tolleranza)
        const sfora = misuraKiB > limiteKiB
        const variazione = budgetKiB > 0 ? misuraKiB / budgetKiB - 1 : misuraKiB > 0 ? Infinity : 0
        righe.push({ rotta, tipo, compressione, misuraKiB, budgetKiB, limiteKiB, variazione, sfora })
        if (sfora) {
          sforamenti.push(
            `${rotta} ${tipo} ${compressione}: ${misuraKiB.toFixed(1)} KiB oltre il limite di ` +
              `${limiteKiB.toFixed(1)} KiB (budget ${budgetKiB} KiB + ${(tolleranza * 100).toFixed(0)}%)`
          )
        }
      }
    }
  }

  return { righe, sforamenti }
}

/**
 * Budget con i valori misurati arrotondati per eccesso al KiB: serve per aggiornare budget.json
 * dopo una variazione voluta del bundle (`node scripts/budgetBundle.mjs --aggiorna`).
 *
 * @param {Record<string, MisuraRotta>} misure
 * @param {Budget} budget
 * @returns {Budget}
 */
export function budgetDaMisure(misure, budget) {
  /** @type {Record<string, BudgetRotta>} */
  const rotte = {}
  for (const [rotta, limiti] of Object.entries(budget.rotte)) {
    const misura = misure[rotta]
    if (!misura) throw new Error(`Nessuna misura per la rotta "${rotta}"`)
    const arrotonda = (/** @type {Dimensioni} */ d) => ({
      gzip: Math.ceil(d.gzip / KIB),
      brotli: Math.ceil(d.brotli / KIB)
    })
    rotte[rotta] = { moduli: limiti.moduli, js: arrotonda(misura.js), css: arrotonda(misura.css) }
  }
  return { ...budget, rotte }
}
