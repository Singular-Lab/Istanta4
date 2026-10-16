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

describe("storicoVolantinoDB1.confronta: fantasmi presenti in un altro tracciato", () => {
  afterEach(() => vi.restoreAllMocks());

  const record = { codice: "4969665", descrizione1: "POLPA POMODORO CONAD 400G", codice_scatto: "2718130", prezzo_offerta: 0.79 };
  const box = {
    groupId: 8, pag: 4, x: 10, y: 20, w: 60, h: 40, dna: "$dna{\n5\n4969665\n}",
    compiledFields: [{ labelName: "descrizione", content: "Polpa di pomodoro" }],
    foto: ["polpa.psd"],
  };
  const confronta = async (fantasmi: unknown[]) => {
    vi.spyOn(ServerUtils, "sendToFICOApi").mockResolvedValue({
      data: { esito: true, error: "", lista: [], orfanelli: [], fantasmi }, status: 200, statusText: "OK",
    } as any);
    return storicoVolantinoDB1.confronta({} as Request, {
      refs: [{ groupId: 8, dna: box.dna, foto: [{ nome: "polpa.psd", guidId: "g-polpa" }] }],
    } as unknown as PayloadConfrontoStorico);
  };

  it("col record di DB1 il box diventa una referenza di lista: testi, foto e posizione del box, dato del record", async () => {
    const esito = await confronta([{ ...box, resolution: JSON.stringify({ warningCode: "02_codref_guest", codice: "4969665", record }) }]);
    expect(esito.fuoriListino).toEqual([]);
    expect(esito.lista).toHaveLength(1);
    const [ospite] = esito.lista;
    expect(ospite).toMatchObject({ groupId: 8, pag: 4, x: 10, compiledFields: box.compiledFields, foto: [{ nome: "polpa.psd", guidId: "g-polpa" }] });
    expect(ospite.dataFields).toMatchObject({ codice: "4969665", codice_referenza: "4969665", descrizione_uno: "POLPA POMODORO CONAD 400G", prezzo: 0.79 });
    expect(ospite).not.toHaveProperty("resolution");
  });

  it("accetta il warning anche gia oggetto", async () => {
    const esito = await confronta([{ ...box, resolution: { warningCode: "02_codref_guest", record } }]);
    expect(esito.lista).toHaveLength(1);
  });

  it("senza record, con un altro warning o illeggibile resta un fantasma da decidere", async () => {
    const esito = await confronta([
      { ...box, groupId: 1, resolution: JSON.stringify({ warningCode: "02_codref_guest", codice: "4969665" }) },
      { ...box, groupId: 2, resolution: JSON.stringify({ warningCode: "01_codscatto_same", codiceScatto: "5", codiceGruppoAtteso: "6" }) },
      { ...box, groupId: 3, resolution: "{rotto" },
      { ...box, groupId: 4 },
    ]);
    expect(esito.lista).toEqual([]);
    expect(esito.fuoriListino.map((fantasma) => fantasma.groupId)).toEqual([1, 2, 3, 4]);
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
