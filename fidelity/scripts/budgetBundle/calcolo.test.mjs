import { describe, expect, it } from "vitest"
import { budgetDaMisure, confrontaBudget, fileNecessari, misuraRotte } from "./calcolo.mjs"

// Manifest finto: l'ingresso importa react e la base; il login importa la base (già comune) e un
// form; la dashboard importa chart.js e, solo dinamicamente, xlsx (che non va contato).
const manifest = {
  "index.html": {
    file: "assets/js/ingresso.js",
    isEntry: true,
    imports: ["_react.js", "_base.js"],
    css: ["assets/css/ingresso.css"]
  },
  "_react.js": { file: "assets/js/react.js" },
  "_base.js": { file: "assets/js/base.js", imports: ["_react.js"], css: ["assets/css/base.css"] },
  "_form.js": { file: "assets/js/form.js", imports: ["_base.js"] },
  "_chart.js": { file: "assets/js/chart.js" },
  "_xlsx.js": { file: "assets/js/xlsx.js", isDynamicEntry: true },
  "src/pages/Login/index.tsx": {
    file: "assets/js/login.js",
    isDynamicEntry: true,
    imports: ["_form.js", "_base.js"],
    css: ["assets/css/login.css"]
  },
  "src/pages/Dashboard/index.tsx": {
    file: "assets/js/dashboard.js",
    isDynamicEntry: true,
    imports: ["_chart.js", "_react.js"],
    dynamicImports: ["_xlsx.js"]
  }
}

// Dimensioni finte: gzip = lunghezza del nome * 1000, brotli = 80% del gzip
const misura = (file) => ({ gzip: file.length * 1000, brotli: file.length * 800 })

describe("fileNecessari", () => {
  it("il codice comune è la chiusura statica dell'ingresso, con il suo CSS", () => {
    expect(fileNecessari(manifest, [])).toEqual({
      js: ["assets/js/base.js", "assets/js/ingresso.js", "assets/js/react.js"],
      css: ["assets/css/base.css", "assets/css/ingresso.css"]
    })
  })

  it("una rotta aggiunge al codice comune i chunk statici dei suoi moduli, una volta sola", () => {
    expect(fileNecessari(manifest, ["src/pages/Login/index.tsx"])).toEqual({
      js: ["assets/js/base.js", "assets/js/form.js", "assets/js/ingresso.js", "assets/js/login.js", "assets/js/react.js"],
      css: ["assets/css/base.css", "assets/css/ingresso.css", "assets/css/login.css"]
    })
  })

  it("non conta gli import dinamici: si scaricano solo quando servono", () => {
    const { js } = fileNecessari(manifest, ["src/pages/Dashboard/index.tsx"])
    expect(js).toContain("assets/js/chart.js")
    expect(js).not.toContain("assets/js/xlsx.js")
  })

  it("fallisce con un messaggio chiaro se un modulo della rotta non è nel manifest", () => {
    expect(() => fileNecessari(manifest, ["src/pages/Rinominata/index.tsx"])).toThrow(
      /src\/pages\/Rinominata\/index\.tsx.*budget\.json/
    )
  })
})

describe("misuraRotte", () => {
  it("somma gzip e brotli dei file JS e CSS di ogni rotta", () => {
    const misure = misuraRotte(manifest, { comune: [], login: ["src/pages/Login/index.tsx"] }, misura)
    const lunghezza = (nomi) => nomi.reduce((totale, nome) => totale + nome.length, 0)
    const jsComune = lunghezza(["assets/js/base.js", "assets/js/ingresso.js", "assets/js/react.js"])
    expect(misure.comune.js).toEqual({ gzip: jsComune * 1000, brotli: jsComune * 800 })
    expect(misure.login.js.gzip).toBe((jsComune + lunghezza(["assets/js/form.js", "assets/js/login.js"])) * 1000)
    expect(misure.login.css.gzip).toBe(
      lunghezza(["assets/css/base.css", "assets/css/ingresso.css", "assets/css/login.css"]) * 1000
    )
  })
})

describe("confrontaBudget", () => {
  const misureKiB = (jsGzip) => ({
    comune: { js: { gzip: jsGzip * 1024, brotli: 80 * 1024 }, css: { gzip: 10 * 1024, brotli: 8 * 1024 } }
  })
  const budget = {
    unita: "KiB",
    tolleranza: 0.03,
    rotte: { comune: { moduli: [], js: { gzip: 100, brotli: 90 }, css: { gzip: 10, brotli: 8 } } }
  }

  it("accetta una misura entro la tolleranza", () => {
    const { sforamenti, righe } = confrontaBudget(misureKiB(102.9), budget)
    expect(sforamenti).toEqual([])
    expect(righe).toHaveLength(4)
    expect(righe.find((r) => r.tipo === "js" && r.compressione === "gzip")?.variazione).toBeCloseTo(0.029)
  })

  it("segnala la voce che supera il budget oltre la tolleranza", () => {
    const { sforamenti, righe } = confrontaBudget(misureKiB(103.5), budget)
    expect(sforamenti).toHaveLength(1)
    expect(sforamenti[0]).toMatch(/^comune js gzip: 103\.5 KiB oltre il limite di 103\.0 KiB/)
    expect(righe.filter((r) => r.sfora)).toHaveLength(1)
  })

  it("segnala una rotta del budget senza misura", () => {
    expect(confrontaBudget({}, budget).sforamenti).toEqual(["comune: nessuna misura per la rotta"])
  })
})

describe("budgetDaMisure", () => {
  it("arrotonda per eccesso al KiB e conserva i moduli delle rotte", () => {
    const budget = {
      unita: "KiB",
      tolleranza: 0.03,
      rotte: { login: { moduli: ["src/pages/Login/index.tsx"], js: { gzip: 1, brotli: 1 }, css: { gzip: 1, brotli: 1 } } }
    }
    const misure = { login: { js: { gzip: 100 * 1024 + 1, brotli: 90 * 1024 }, css: { gzip: 512, brotli: 0 } } }
    expect(budgetDaMisure(misure, budget)).toEqual({
      unita: "KiB",
      tolleranza: 0.03,
      rotte: { login: { moduli: ["src/pages/Login/index.tsx"], js: { gzip: 101, brotli: 90 }, css: { gzip: 1, brotli: 0 } } }
    })
  })
})
