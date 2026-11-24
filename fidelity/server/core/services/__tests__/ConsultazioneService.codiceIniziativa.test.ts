import { describe, expect, it } from "vitest";
import { promozioniConVarianti } from "../ConsultazioneService.js";

const riga = (nome: string) => ({
  id_promo: `id-${nome}`,
  nome_promo: nome,
  stato_promo: "IN_CORSO",
  validita_dal: "2026-10-16",
  validita_al: "2026-10-29",
});

const prefisso = (nome: string): string | null => {
  const posizione = nome.indexOf("_");
  return posizione > 0 ? nome.slice(0, posizione) : null;
};

describe("promozioni della consultazione con il codice iniziativa (task 1f340bec)", () => {
  it("con la libreria del cliente la promo porta il codice dell'iniziativa", () => {
    const [promozione] = promozioniConVarianti([riga("P2620_KIT_TOSCANA")], [], [], prefisso);

    expect(promozione.promo.codiceIniziativa).toBe("P2620");
    expect(promozione.promo.nome).toBe("P2620_KIT_TOSCANA");
  });

  it("per ogni promo il suo codice", () => {
    const promozioni = promozioniConVarianti([riga("P2620_A"), riga("P2621_B")], [], [], prefisso);

    expect(promozioni.map(p => p.promo.codiceIniziativa)).toEqual(["P2620", "P2621"]);
  });

  it("un nome senza codice non ha il campo", () => {
    const [promozione] = promozioniConVarianti([riga("PASQUA")], [], [], prefisso);

    expect(promozione.promo).not.toHaveProperty("codiceIniziativa");
  });

  it("senza la libreria del cliente la promo resta com'era, senza il campo", () => {
    const [promozione] = promozioniConVarianti([riga("P2620_KIT_TOSCANA")], []);

    expect(promozione.promo).not.toHaveProperty("codiceIniziativa");
    expect(promozione.promo).toEqual({
      id: "id-P2620_KIT_TOSCANA",
      nome: "P2620_KIT_TOSCANA",
      validitaDal: "2026-10-16",
      validitaAl: "2026-10-29",
    });
  });
});
