import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")

describe("identità predefinita della pagina applicativa", () => {
  it("mostra Istanta Web Platform come titolo del documento", () => {
    expect(html).toContain("<title>Istanta Web Platform</title>")
  })

  it("espone la descrizione della piattaforma nei metadati", () => {
    expect(html).toContain(
      '<meta name="description" content="Istanta Web Platform - Piattaforma di gestione promozioni" />'
    )
  })
})
