import { describe, expect, it } from "vitest";
import { estensioneFile, estensioniAmmessePerTipi, motivoFileNonAmmesso } from "../formatiCaricamento";

// Stessa regola di FileManagementService.uploadMateriale: .pdf per i tipi diversi da WEB, .json o .webpliant per WEB
describe("formati del caricamento manuale dei materiali", () => {
  it("ammette il PDF per i tipi di stampa e JSON o WEBPLIANT per WEB", () => {
    expect(motivoFileNonAmmesso("pagina-1.pdf", "STAMPA")).toBeNull();
    expect(motivoFileNonAmmesso("referenze.json", "WEB")).toBeNull();
    expect(motivoFileNonAmmesso("referenze.webpliant", "WEB")).toBeNull();
  });

  it("rifiuta i formati che il server rifiuterebbe, con il motivo", () => {
    expect(motivoFileNonAmmesso("foto.jpg", "STAMPA")).toBe("Formato non ammesso per il tipo di export STAMPA: servono file .pdf.");
    expect(motivoFileNonAmmesso("pagina-1.pdf", "WEB")).toBe("Formato non ammesso per il tipo di export WEB: servono file .json o .webpliant.");
    expect(motivoFileNonAmmesso("referenze.json", "STAMPA")).not.toBeNull();
    expect(motivoFileNonAmmesso("senza-estensione", "STAMPA")).not.toBeNull();
  });

  it("l'estensione va in minuscolo come la confronta il server", () => {
    expect(motivoFileNonAmmesso("PAGINA-1.PDF", "STAMPA")).toBe(
      "Estensione non ammessa: per il tipo di export STAMPA serve .pdf in minuscolo. Rinomina il file."
    );
  });

  it("calcola l'estensione come path.extname", () => {
    expect(estensioneFile("archivio.tar.json")).toBe(".json");
    expect(estensioneFile(".json")).toBe("");
    expect(estensioneFile("volantino")).toBe("");
    expect(estensioneFile("cartella/volantino.pdf")).toBe(".pdf");
  });

  it("unisce senza doppioni le estensioni dei tipi di export del kit", () => {
    expect(estensioniAmmessePerTipi(["STAMPA", "VOL"])).toEqual([".pdf"]);
    expect(estensioniAmmessePerTipi(["STAMPA", "WEB"])).toEqual([".pdf", ".json", ".webpliant"]);
    expect(estensioniAmmessePerTipi([])).toEqual([]);
  });
});
