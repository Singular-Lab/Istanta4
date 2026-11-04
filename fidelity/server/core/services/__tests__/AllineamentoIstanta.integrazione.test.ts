import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { Tracciati } from '../../models/tracciati';
import { TracciatiInvioIstanta } from '../../models/tracciati_invio_istanta';
import { ServerUtils } from '../../utils/ServerUtils';
import {
  accodaPerIstanta,
  aggiornaContestoInAttesa,
  allineaUna,
  inviaPrenotata,
  pausaDopoErrore,
  prenotaProssima,
  prenotaTracciato,
  salvaListeArchivio,
  statoIstantaTracciati,
} from '../AllineamentoIstanta';

// Coda dei tracciati salvati in FP e non ancora in Istanta (TASK-3dfe3302), su PostgreSQL vero:
// salvataggio in blocco dell'archivio, prenotazioni che non si sovrappongono, invio con esito e
// riprova, contesto modificato prima dell'invio. Istanta e' finto.

async function creaPromo(idGdo: string, stato: STATO_PROMO = STATO_PROMO.ARCHIVIATA): Promise<string> {
  const id = randomUUID();
  await sequelize.query(
    `INSERT INTO "promo" ("id_promo", "nome_promo", "data_registrazione", "validita_dal", "validita_al", "offset_visibilita", "stato", "context", "gdo", "createdat", "updatedat")
     VALUES (:id, :nome, now(), now(), now(), 0, :stato, '[]', :gdo, now(), now())`,
    { replacements: { id, nome: `Promo ${id.slice(0, 4)}`, stato, gdo: idGdo } }
  );
  return id;
}

const xlsx = (testo: string) => Buffer.from(`PK ${testo}`);
const lista = (idPromo: string, nomeFile: string, context: unknown = [{ nome_field: 'idLabel', user_value: 'main' }]) =>
  ({ idPromo, nomeFile, context, contenuto: xlsx(nomeFile) });

/** Istanta finto: risponde come vuole il test e ricorda cosa ha ricevuto. */
function istanta(risposte: Array<{ data: unknown; status: number }>) {
  const ricevuti: Array<{ guid: string; idPromo: string; fileName: string; context: unknown; utente: string }> = [];
  vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUploadTracciato').mockImplementation(async (req: { session: { id_utente?: string } }, form: FormData) => {
    ricevuti.push({
      guid: String(form.get('guid_id')),
      idPromo: String(form.get('idPromo')),
      fileName: String(form.get('fileName')),
      context: JSON.parse(String(form.get('context'))),
      utente: String(req.session.id_utente),
    });
    const risposta = risposte.shift() ?? { data: { esito: true }, status: 200 };
    return { ...risposta, statusText: risposta.status ? 'OK' : 'timeout' } as never;
  });
  vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as never);
  return ricevuti;
}

describeConDatabase('allineamento con Istanta su PostgreSQL', () => {
  usaDatabase();

  beforeEach(async () => {
    vi.restoreAllMocks();
    await svuotaTabelle('gdo', 'promo', 'tracciati', 'tracciati_invio_istanta');
  });

  it('il lotto dell archivio: caricate in FP e in coda, presenti e scartate con il motivo', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    const eliminata = await creaPromo(idGdo, STATO_PROMO.ELIMINATA);
    await sequelize.query(
      `INSERT INTO "tracciati" ("id_tracciati", "id_promo_tracciati", "context_tracciati", "filename_tracciati", "blobfile_tracciati", "createdat", "updatedat")
       VALUES (:id, :promo, '[]', '01_SSCN.xlsx', :blob, now(), now())`,
      { replacements: { id: randomUUID(), promo, blob: xlsx('vecchio') } }
    );

    const esiti = await salvaListeArchivio([
      lista(promo, '01_SSCN.xlsx'),
      lista(promo, '01_CY.xlsx'),
      lista(promo, '01_CY.xlsx'),
      lista(promo, 'note.csv'),
      lista(eliminata, '01_SS.xlsx'),
      lista(randomUUID(), '01_SS.xlsx'),
      lista(promo, '02_MC.xlsx', 'non un elenco'),
    ], 'u-caricatore');

    expect(esiti.map((e) => (e.esito === 'scartata' ? `${e.esito}: ${e.motivo}` : e.esito))).toEqual([
      'presente',
      'caricata',
      'presente',
      'scartata: formato non valido: serve un file .xls o .xlsx',
      'scartata: promo eliminata',
      'scartata: promo inesistente',
      'scartata: contesto non valido',
    ]);
    const caricata = esiti[1] as { id: string };
    const salvata = await Tracciati.findByPk(caricata.id, { raw: true });
    expect(salvata).toMatchObject({ id_promo_tracciati: promo, filename_tracciati: '01_CY.xlsx' });
    expect(Buffer.from(salvata!.blobfile_tracciati).equals(xlsx('01_CY.xlsx'))).toBe(true);
    const coda = await TracciatiInvioIstanta.findAll({ raw: true });
    expect(coda).toEqual([expect.objectContaining({ id_tracciato: caricata.id, id_utente: 'u-caricatore', tentativi: 0, ultimo_errore: null })]);
    expect((await statoIstantaTracciati([caricata.id])).get(caricata.id)).toEqual({ stato: 'in_attesa', errore: null, tentativi: 0 });
  });

  it('due prenotazioni insieme non prendono mai lo stesso tracciato', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    await salvaListeArchivio([lista(promo, 'a.xlsx'), lista(promo, 'b.xlsx')], 'u1');

    const [prima, seconda, terza] = await Promise.all([prenotaProssima(), prenotaProssima(), prenotaProssima()]);

    const prese = [prima, seconda, terza].filter(Boolean).map((p) => p!.id_tracciato);
    expect(prese).toHaveLength(2);
    expect(new Set(prese).size).toBe(2);
    // Prenotati: ne' il giro ne' "Rimanda a Istanta" li riprendono finche' la prenotazione vale
    expect(await prenotaProssima()).toBeNull();
    expect(await prenotaTracciato(prese[0])).toBeNull();
  });

  it('Istanta accetta: il tracciato esce dalla coda, inviato a nome di chi l ha caricato', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    const [esito] = await salvaListeArchivio([lista(promo, 'a.xlsx')], 'u-caricatore');
    const ricevuti = istanta([{ data: { esito: true }, status: 200 }]);

    expect(await allineaUna()).toBe(true);

    expect(ricevuti).toEqual([{ guid: (esito as { id: string }).id, idPromo: promo, fileName: 'a.xlsx', context: [{ nome_field: 'idLabel', user_value: 'main' }], utente: 'u-caricatore' }]);
    expect(await TracciatiInvioIstanta.count()).toBe(0);
    expect(ServerUtils.CREA_ATTIVITA).toHaveBeenCalledTimes(1);
    expect(await allineaUna()).toBe(false);
  });

  it('Istanta rifiuta: resta in coda col motivo e si riprova dopo una pausa crescente', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    const [esito] = await salvaListeArchivio([lista(promo, 'a.xlsx')], 'u1');
    const id = (esito as { id: string }).id;
    istanta([{ data: { esito: false, error: 'label non valida' }, status: 200 }, { data: null, status: 0 }]);

    const primo = await inviaPrenotata((await prenotaProssima())!);
    expect(primo).toMatchObject({ esito: 'errore', tentativi: 1 });
    const riga = await TracciatiInvioIstanta.findByPk(id, { raw: true });
    expect(riga).toMatchObject({ tentativi: 1, inviando_dal: null });
    expect(riga!.ultimo_errore).toMatch(/label non valida/);
    expect(riga!.prossimo_tentativo.getTime()).toBeGreaterThan(Date.now() + pausaDopoErrore(1) - 5_000);
    // In pausa: il giro non lo riprende, "Rimanda a Istanta" si'
    expect(await prenotaProssima()).toBeNull();
    const secondo = await inviaPrenotata((await prenotaTracciato(id))!);
    expect(secondo).toMatchObject({ esito: 'errore', tentativi: 2 });
    expect(pausaDopoErrore(2)).toBeGreaterThan(pausaDopoErrore(1));
    expect(pausaDopoErrore(99)).toBe(pausaDopoErrore(5));
    expect((await statoIstantaTracciati([id])).get(id)).toMatchObject({ stato: 'errore', tentativi: 2 });
  });

  it('il contesto si cambia solo in coda, e Istanta riceve quello nuovo', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    const [esito] = await salvaListeArchivio([lista(promo, 'a.xlsx')], 'u1');
    const id = (esito as { id: string }).id;
    const nuovo = [{ nome_field: 'idLabel', user_value: 'tecnica' }];

    expect(await aggiornaContestoInAttesa(id, nuovo)).toBe('aggiornato');
    const prenotata = (await prenotaProssima())!;
    expect(await aggiornaContestoInAttesa(id, [])).toBe('in_invio');
    const ricevuti = istanta([]);
    await inviaPrenotata(prenotata);

    expect(ricevuti[0].context).toEqual(nuovo);
    expect(await aggiornaContestoInAttesa(id, [])).toBe('inviato');
    expect(await aggiornaContestoInAttesa(randomUUID(), [])).toBe('inesistente');
  });

  it('un tracciato rifiutato nel flusso normale parte in pausa con il primo motivo', async () => {
    const idGdo = await creaGdo();
    const promo = await creaPromo(idGdo);
    const id = randomUUID();
    await Tracciati.create({ id_tracciati: id, id_promo_tracciati: promo, filename_tracciati: 'a.xlsx', blobfile_tracciati: xlsx('a'), context_tracciati: [], createdat: new Date(), updatedat: new Date() });

    await accodaPerIstanta([{ idTracciato: id, idUtente: 'u1', motivo: 'Istanta non risponde' }]);

    expect(await TracciatiInvioIstanta.findByPk(id, { raw: true })).toMatchObject({ tentativi: 1, ultimo_errore: 'Istanta non risponde' });
    expect(await prenotaProssima()).toBeNull();
    // Eliminato il tracciato se ne va anche dalla coda
    await Tracciati.destroy({ where: { id_tracciati: id } });
    expect(await TracciatiInvioIstanta.count()).toBe(0);
  });
});

describe('pause dopo un errore', () => {
  it('crescono fino a un massimo', () => {
    const pause = [1, 2, 3, 4, 5, 6].map(pausaDopoErrore);
    expect(pause).toEqual([...pause].sort((a, b) => a - b));
    expect(pause[5]).toBe(pause[4]);
  });
});
