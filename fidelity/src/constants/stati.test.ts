import { describe, expect, it } from "vitest";
import {
  GDOWhatsappQueueJobStatus,
  STATO_GDO_WHATSAPP_NUMBER,
  STATO_GDO_WHATSAPP_TEMPLATE,
  STATO_LAVORAZIONE_KIT_RUNTIME,
  STATO_LOG_FILE,
  STATO_ORDINI_STAMPA,
  STATO_PROMO,
  STATO_UTENTI,
  STATO_WEBHOOK,
} from "../../lib/enums";
import { DominioStato, descriviStato, STATI_CAMPAGNA_WHATSAPP, STATO_KIT_NON_AVVIATO, STATO_SCONOSCIUTO } from "./stati";

const ENUM_PER_DOMINIO: Record<DominioStato, Record<string, string>> = {
  promo: STATO_PROMO,
  kitRuntime: { ...STATO_LAVORAZIONE_KIT_RUNTIME, NON_AVVIATO: STATO_KIT_NON_AVVIATO },
  fileKit: STATO_LOG_FILE,
  ordineStampa: STATO_ORDINI_STAMPA,
  utente: STATO_UTENTI,
  webhook: STATO_WEBHOOK,
  waCampagna: Object.fromEntries(STATI_CAMPAGNA_WHATSAPP.map((stato) => [stato, stato])),
  waMessaggio: GDOWhatsappQueueJobStatus,
  waTemplate: STATO_GDO_WHATSAPP_TEMPLATE,
  waNumero: STATO_GDO_WHATSAPP_NUMBER,
};

describe("catalogo degli stati", () => {
  it.each(Object.entries(ENUM_PER_DOMINIO))("ogni stato di %s ha etichetta e tono propri", (dominio, valori) => {
    Object.values(valori).forEach((stato) => {
      const descrizione = descriviStato(dominio as DominioStato, stato);

      expect(descrizione).not.toBe(STATO_SCONOSCIUTO);
      expect(descrizione.etichetta.trim()).not.toBe("");
    });
  });

  it("una promo VALIDA si mostra come Valida, mai come Attiva", () => {
    expect(descriviStato("promo", STATO_PROMO.VALIDA)).toEqual({ etichetta: "Valida", tono: "success" });
  });

  it("un kit previsto ma senza runtime si mostra come Non avviato, con tono neutro", () => {
    expect(descriviStato("kitRuntime", "NON_AVVIATO")).toEqual({ etichetta: "Non avviato", tono: "neutral" });
  });

  it("lo stato di un file distingue il proprio esito da quello di Correggo", () => {
    expect(descriviStato("fileKit", STATO_LOG_FILE.ERRORE)).toEqual({ etichetta: "Errore", tono: "danger" });
    expect(descriviStato("fileKit", STATO_LOG_FILE.CORREGGO_ERRORE)).toEqual({ etichetta: "Errore Correggo", tono: "danger" });
    expect(descriviStato("fileKit", STATO_LOG_FILE.IN_REVISIONE).etichetta).toBe("In revisione");
    expect(descriviStato("fileKit", null)).toBe(STATO_SCONOSCIUTO);
  });

  it("un template mai inviato a Meta si mostra come bozza locale, in revisione come revisione Meta", () => {
    expect(descriviStato("waTemplate", STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED)).toEqual({ etichetta: "Bozza locale", tono: "warning" });
    expect(descriviStato("waTemplate", STATO_GDO_WHATSAPP_TEMPLATE.PENDING).etichetta).toBe("In revisione Meta");
  });

  it("uno stato WhatsApp sconosciuto non diventa una bozza", () => {
    expect(descriviStato("waTemplate", "NUOVO_STATO_META")).toBe(STATO_SCONOSCIUTO);
    expect(descriviStato("waCampagna", undefined)).toBe(STATO_SCONOSCIUTO);
  });

  it("uno stato non riconosciuto resta riconoscibile come tale", () => {
    expect(descriviStato("promo", "STATO_INVENTATO")).toEqual({ etichetta: "Stato sconosciuto", tono: "neutral" });
    expect(descriviStato("kitRuntime", undefined)).toBe(STATO_SCONOSCIUTO);
    expect(descriviStato("ordineStampa", null)).toBe(STATO_SCONOSCIUTO);
    expect(descriviStato("utente", "toString")).toBe(STATO_SCONOSCIUTO);
  });
});
