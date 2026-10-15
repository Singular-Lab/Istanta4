import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IUserService } from "../../../interfaces/IUserService";
import { ServerUtils } from "../../../utils/ServerUtils";
import { DefaultAgenziaLib } from "../../default/index.js";
import type { PayloadConfrontoStorico } from "../../types.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { mergePluginPhotoRefs, storicoVolantinoDB1 } from "../storico-db1.js";

describe("ConadcnoAgenziaLib", () => {
  it("ha lo storico dei volantini, il default no", () => {
    const userService = {} as IUserService;
    expect(new ConadcnoAgenziaLib(userService).storicoVolantino).toBe(storicoVolantinoDB1);
    expect(new DefaultAgenziaLib(userService).storicoVolantino).toBeUndefined();
  });
});

describe("storicoVolantinoDB1.confronta: timeout verso DB1", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const timeoutPassato = async () => {
    const invio = vi.spyOn(ServerUtils, "sendToFICOApi").mockResolvedValue({
      data: { esito: true, error: "", lista: [], orfanelli: [], fantasmi: [] }, status: 200, statusText: "OK",
    } as any);
    await storicoVolantinoDB1.confronta({} as Request, { refs: [] } as unknown as PayloadConfrontoStorico);
    return invio.mock.calls[0][5];
  };

  it("di default aspetta 30 minuti, non i 10 del timeout generico", async () => {
    vi.stubEnv("DB1_TIMEOUT_MS", "");
    expect(await timeoutPassato()).toBe(30 * 60_000);
  });

  it("DB1_TIMEOUT_MS lo regola senza deploy", async () => {
    vi.stubEnv("DB1_TIMEOUT_MS", "2700000");
    expect(await timeoutPassato()).toBe(2_700_000);
  });
});

describe("storicoVolantinoDB1.referenzaFuoriListino", () => {
  it("aggiunge i nomi FP letti dalle schede del kit senza togliere quelli DB1", () => {
    const { dataFields, meccanica } = storicoVolantinoDB1.referenzaFuoriListino({
      codice: "1714999", descrizione1: "Olive", prezzo_offerta: 1.99, anziche: 2.5, ean: "", meccanica: "2x1",
    });
    expect(dataFields).toMatchObject({
      codice: "1714999", codice_referenza: "1714999",
      descrizione1: "Olive", descrizione_uno: "Olive",
      prezzo_offerta: 1.99, prezzo: 1.99, prezzo_anziche: 2.5,
    });
    expect(dataFields).not.toHaveProperty("ean_referenza");
    expect(meccanica).toBe("2x1");
  });

  it("non sovrascrive un campo che ha gia lo stesso nome in DB1", () => {
    expect(storicoVolantinoDB1.referenzaFuoriListino({ prezzo: 3, prezzo_offerta: 1.99 }).dataFields.prezzo).toBe(3);
  });
});

describe("storicoVolantinoDB1.referenzaPerReport", () => {
  it("legge il record DB1 e tiene solo i campi valorizzati", () => {
    expect(storicoVolantinoDB1.referenzaPerReport({
      codice: "1714999", descrizione1: "Olive", descrizione2: " verdi ", ean: "8001",
      sigla_reparto: "DRO", prezzo_offerta: 1.9, tema: "", data_da: "2026-09-01T00:00:00", data_a: "2026-09-14T00:00:00",
    })).toEqual({
      codice: "1714999",
      descrizione: "Olive verdi",
      campi: [
        { label: "EAN", valore: "8001" },
        { label: "Reparto", valore: "DRO" },
        { label: "Prezzo", valore: "€ 1.90" },
        { label: "Validità", valore: "01/09/2026 - 14/09/2026" },
      ],
    });
  });
});

describe("mergePluginPhotoRefs", () => {
  it("recupera il guidId Olimpo quando DB1 rimanda le foto come semplici nomi", () => {
    const [ref] = mergePluginPhotoRefs(
      [{ groupId: 1, dna: "$dna{1}", foto: ["olive.jpg" as unknown as { nome: string }] }],
      [{ groupId: 1, dna: "$dna{1}", foto: [{ nome: "olive.jpg", guidId: "abc" }] }],
    );
    expect(ref.foto).toEqual([{ nome: "olive.jpg", guidId: "abc" }]);
  });
});
