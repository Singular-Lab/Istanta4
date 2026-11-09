import { describe, expect, it } from "vitest";
import { inCorso, messaggioErrore, motivoErrore, testoAvanzamento } from "./avanzamento";

describe("avanzamento del report PDF", () => {
  it("dice a che punto e' la preparazione", () => {
    expect(testoAvanzamento({ fase: "dati" })).toBe("Dati del volantino");
    expect(testoAvanzamento({ fase: "pagine", fatte: 3, totale: 12 })).toBe("Pagine del volantino: 3 di 12");
    expect(testoAvanzamento({ fase: "pagine", fatte: 0, totale: 0 })).toBe("Pagine del volantino");
    expect(testoAvanzamento({ fase: "impaginazione" })).toBe("Impaginazione del PDF");
    expect(testoAvanzamento({ fase: "inattivo" })).toBeNull();
    expect(testoAvanzamento({ fase: "errore", messaggio: "x" })).toBeNull();
  });

  it("e' in corso solo fra il click e il download", () => {
    expect(inCorso({ fase: "inattivo" })).toBe(false);
    expect(inCorso({ fase: "errore", messaggio: "x" })).toBe(false);
    expect(inCorso({ fase: "generatore" })).toBe(true);
  });
});

describe("messaggi d'errore", () => {
  it("preferisce il messaggio per l'utente del server", () => {
    const errore = Object.assign(new Error("HTTP 404"), { getUserMessage: () => "Volantino non trovato" });
    expect(motivoErrore(errore)).toBe("Volantino non trovato");
    expect(messaggioErrore("dati", errore)).toBe("Dati del report non disponibili: Volantino non trovato");
  });

  it("senza un motivo dice solo cosa non e' riuscito", () => {
    expect(messaggioErrore("impaginazione", {})).toBe("Impaginazione del PDF non riuscita.");
    expect(messaggioErrore("impaginazione", new Error("Font non valido"))).toBe("Impaginazione del PDF non riuscita: Font non valido");
  });

  it("se il generatore non si carica chiede di controllare la connessione, senza il messaggio tecnico", () => {
    expect(messaggioErrore("generatore", new TypeError("Failed to fetch dynamically imported module: /assets/js/x.js"))).toBe(
      "Generatore del PDF non caricato: controlla la connessione."
    );
  });
});
