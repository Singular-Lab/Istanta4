import type { Request } from 'express';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_LAVORAZIONE } from '../../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import { STATI_KIT_MATERIALI } from '../../../../lib/materiali/tipi';
import type { IMaterialiRepository, RigaFile, RigaFormato, RigaKit, RigaPromo } from '../../repositories/MaterialiRepository';
import {
  CHIAMATE_ISTANTA_IN_PARALLELO,
  criteriDelPeriodo,
  type FonteKitNonAvviati,
  MaterialiService,
  MOTIVO_NON_AVVIATI_NON_DISPONIBILI,
  nomeArchivioPop,
  type ScrittoreZipOlimpo,
  vociZipPop,
} from '../MaterialiService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Viste Volantini e POP al posto delle pagine Materiali: periodi, kit non avviati da Istanta,
// riepilogo POP per formato, pagine dei file e ZIP. Il database qui e' finto; le regole scritte
// in SQL le verificano i test MaterialiService.*.integrazione.test.ts

const AREA = '0a000000-0000-4000-8000-000000000001';
const CANALE = '0c000000-0000-4000-8000-000000000001';
const FORMATO_VOLANTINO = '0f000000-0000-4000-8000-000000000001';
const FORMATO_ESPOSITORI = '0f000000-0000-4000-8000-000000000002';
const FORMATO_LOCANDINE = '0f000000-0000-4000-8000-000000000003';
const FORMATO_CARTELLI = '0f000000-0000-4000-8000-000000000004';
const FORMATO_SENZA_TIPO = '0f000000-0000-4000-8000-000000000005';
const FILE_1 = 'f1000000-0000-4000-8000-000000000001';
const FILE_2 = 'f1000000-0000-4000-8000-000000000002';

const req = {} as Request;

const FORMATI: RigaFormato[] = [
  { id_formati: FORMATO_VOLANTINO, nome_formati: 'Volantino', tipo_lavorazione_formati: TIPO_LAVORAZIONE.VOLANTINO },
  { id_formati: FORMATO_ESPOSITORI, nome_formati: 'Espositori', tipo_lavorazione_formati: TIPO_LAVORAZIONE.POP },
  { id_formati: FORMATO_LOCANDINE, nome_formati: 'Locandine', tipo_lavorazione_formati: TIPO_LAVORAZIONE.POP },
  { id_formati: FORMATO_CARTELLI, nome_formati: 'Cartelli', tipo_lavorazione_formati: TIPO_LAVORAZIONE.POP },
  { id_formati: FORMATO_SENZA_TIPO, nome_formati: 'Senza tipo', tipo_lavorazione_formati: 0 },
];

const promo = (id: string, stato: STATO_PROMO, dal = '2026-10-01T00:00:00+02:00'): RigaPromo => ({
  id_promo: id,
  nome_promo: `Promo ${id}`,
  stato_promo: stato,
  validita_dal: new Date(dal),
  validita_al: new Date('2026-10-31T00:00:00+01:00'),
});

const kit = (id: string, dati: Partial<RigaKit> = {}): RigaKit => ({
  ...promo('p1', STATO_PROMO.IN_LAVORAZIONE),
  id,
  id_design: `design-${id}`,
  titolo: `Kit ${id}`,
  stato_kit: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
  tipo: 'AUTOMATICO',
  id_area: AREA,
  nome_area: 'Toscana',
  id_canale: CANALE,
  nome_canale: 'Superstore',
  id_formato: FORMATO_VOLANTINO,
  nome_formato: 'Volantino',
  numero_file: 0,
  copertina_id_olimpo: null,
  copertina_nome: null,
  copertina_mime: null,
  copertina_pagine: null,
  ...dati,
});

const file = (id: string, dati: Partial<RigaFile> = {}): RigaFile => ({
  id,
  nome: `${id}.pdf`,
  id_olimpo_cloud: `olimpo-${id}`,
  mime: 'application/pdf',
  id_kit: 'k1',
  titolo_kit: 'Kit 1',
  stato_kit: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
  id_area: AREA,
  nome_area: 'Toscana',
  id_canale: CANALE,
  nome_canale: 'Superstore',
  codice_referenza: null,
  descrizione_referenza: null,
  reparto: null,
  stato_log: null,
  versione_log: null,
  ...dati,
});

/** Voce di getAllKitPerGestioneLavorazione per un kit design non ancora avviato. */
const daAvviare = (idDesign: string, idFormato: string, altro: Record<string, unknown> = {}) => ({
  isDesignKit: true,
  lavorazioneStarted: false,
  guidId: idDesign,
  titolo: `Design ${idDesign}`,
  tipo: 'AUTOMATICO',
  guidArea: AREA,
  nomeArea: 'Toscana',
  guidCanale: CANALE,
  nomeCanale: 'Superstore',
  guidFormato: idFormato,
  ...altro,
});

function repositoryFinto(dati: Partial<IMaterialiRepository> = {}): IMaterialiRepository {
  return {
    trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => null),
    elencaPromo: vi.fn<IMaterialiRepository['elencaPromo']>(async () => []),
    trovaFormati: vi.fn<IMaterialiRepository['trovaFormati']>(async (ids) => FORMATI.filter(f => ids.includes(f.id_formati))),
    elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => []),
    contaKit: vi.fn<IMaterialiRepository['contaKit']>(async () => 0),
    elencaCombinazioniKit: vi.fn<IMaterialiRepository['elencaCombinazioniKit']>(async () => []),
    elencaPromoConKit: vi.fn<IMaterialiRepository['elencaPromoConKit']>(async () => []),
    elencaFile: vi.fn<IMaterialiRepository['elencaFile']>(async () => []),
    contaFile: vi.fn<IMaterialiRepository['contaFile']>(async () => 0),
    elencaOpzioniFile: vi.fn<IMaterialiRepository['elencaOpzioniFile']>(async () => []),
    ...dati,
  };
}

type Lavorazioni = Awaited<ReturnType<FonteKitNonAvviati['getAllKitPerGestioneLavorazione']>>;
const risposta = (lavorazioni: unknown[]): Lavorazioni => ({ lavorazioni, volantini: [] });

function istantaFinta(perPromo: Record<string, unknown[] | Error> = {}) {
  return {
    getAllKitPerGestioneLavorazione: vi.fn<FonteKitNonAvviati['getAllKitPerGestioneLavorazione']>(async (idPromo) => {
      const esito = perPromo[idPromo] ?? [];
      if (esito instanceof Error) throw esito;
      return risposta(esito);
    }),
  };
}

const zipFinto = (): ScrittoreZipOlimpo => ({ scriviZipDaOlimpo: vi.fn<ScrittoreZipOlimpo['scriviZipDaOlimpo']>() });

describe('periodi: stati delle promo e dei kit', () => {
  it('In corso: le promo in lavorazione e ogni kit non eliminato', () => {
    const criteri = criteriDelPeriodo('in-corso', TIPO_LAVORAZIONE.VOLANTINO);

    expect([...criteri.statiPromo].sort()).toEqual([
      STATO_PROMO.IN_ATTESA_DI_VALIDITA, STATO_PROMO.IN_LAVORAZIONE, STATO_PROMO.IN_RITARDO, STATO_PROMO.IN_SCADENZA, STATO_PROMO.PIANIFICATA,
    ]);
    expect([...criteri.statiKit].sort()).toEqual([
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
      STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
      STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
    ]);
    expect(criteri.tipoLavorazione).toBe(TIPO_LAVORAZIONE.VOLANTINO);
  });

  it('Attivi e Storico: le promo valide o archiviate e solo i kit pubblicati', () => {
    expect(criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.POP)).toEqual({
      statiPromo: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI],
      statiKit: [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO],
      tipoLavorazione: TIPO_LAVORAZIONE.POP,
    });
    expect(criteriDelPeriodo('storico', TIPO_LAVORAZIONE.VOLANTINO)).toEqual({
      statiPromo: [STATO_PROMO.ARCHIVIATA],
      statiKit: [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO],
      tipoLavorazione: TIPO_LAVORAZIONE.VOLANTINO,
    });
  });

  it('Volantini attivi: kit pubblicati dei formati volantino letti a pagine dal database, senza chiedere niente a Istanta', async () => {
    const repository = repositoryFinto({
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [kit('k1', {
        ...promo('p1', STATO_PROMO.VALIDA),
        numero_file: 3,
        copertina_id_olimpo: 'olimpo-copertina',
        copertina_nome: 'pagina-1.pdf',
        copertina_mime: 'application/pdf',
        copertina_pagine: 12,
      })]),
      contaKit: vi.fn<IMaterialiRepository['contaKit']>(async () => 1),
    });
    const istanta = istantaFinta();
    const service = new MaterialiService(repository, istanta, zipFinto());

    const pagina = await service.getVolantini({ periodo: 'attivi' }, req);

    expect(repository.elencaKit).toHaveBeenCalledWith(
      criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.VOLANTINO),
      expect.objectContaining({ limite: 24, scarto: 0, conCopertina: true })
    );
    expect(istanta.getAllKitPerGestioneLavorazione).not.toHaveBeenCalled();
    expect(pagina).toMatchObject({ totale: 1, totaleSenzaFiltri: 1, pagina: 1, dimensione: 24, avvisi: [] });
    expect(pagina.kit[0]).toMatchObject({
      id: 'k1',
      stato: 'PUBBLICATO',
      numeroFile: 3,
      formato: { id: FORMATO_VOLANTINO, nome: 'Volantino' },
      promo: { id: 'p1', stato: STATO_PROMO.VALIDA, validitaDal: '2026-10-01', validitaAl: '2026-10-31' },
      copertina: { idOlimpoCloud: 'olimpo-copertina', nome: 'pagina-1.pdf', mime: 'application/pdf', pagine: 12 },
    });
  });

  it('Volantini attivi con filtri: il totale senza filtri si conta a parte', async () => {
    const repository = repositoryFinto({
      contaKit: vi.fn<IMaterialiRepository['contaKit']>(async (_criteri, filtri) => (filtri ? 2 : 40)),
    });
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    const pagina = await service.getVolantini({ periodo: 'storico', cerca: '  ottobre ', idArea: AREA, pagina: 3, dimensione: 500 }, req);

    expect(pagina).toMatchObject({ totale: 2, totaleSenzaFiltri: 40, pagina: 3, dimensione: 96 });
    expect(repository.elencaKit).toHaveBeenCalledWith(
      criteriDelPeriodo('storico', TIPO_LAVORAZIONE.VOLANTINO),
      expect.objectContaining({ filtri: expect.objectContaining({ cerca: 'ottobre', idArea: AREA }), limite: 96, scarto: 192 })
    );
  });

  it('POP: in Attivi e Storico solo le promo con kit pubblicati, In corso tutte le promo del periodo', async () => {
    const repository = repositoryFinto({
      elencaPromoConKit: vi.fn<IMaterialiRepository['elencaPromoConKit']>(async () => [
        { ...promo('vecchia', STATO_PROMO.VALIDA, '2026-09-01T00:00:00+02:00'), numero_file: 4, numero_formati: 1 },
        { ...promo('nuova', STATO_PROMO.VALIDA, '2026-10-15T00:00:00+02:00'), numero_file: 9, numero_formati: 2 },
      ]),
    });
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    const attivi = await service.getPromozioniPop('attivi');
    await service.getPromozioniPop('in-corso');

    expect(repository.elencaPromoConKit).toHaveBeenNthCalledWith(1, criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.POP), true);
    expect(repository.elencaPromoConKit).toHaveBeenNthCalledWith(2, criteriDelPeriodo('in-corso', TIPO_LAVORAZIONE.POP), false);
    expect(attivi.promozioni.map(p => [p.id, p.numeroFile, p.numeroFormati])).toEqual([['nuova', 9, 2], ['vecchia', 4, 1]]);
  });

  it('periodo non valido: 400', async () => {
    const service = new MaterialiService(repositoryFinto(), istantaFinta(), zipFinto());

    await expect(service.getVolantini({ periodo: 'futuro' as never }, req)).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.getPromozioniPop('' as never)).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('Volantini In corso: kit non avviati', () => {
  it('ai kit del database aggiunge i kit non avviati dei formati volantino, con stato NON_AVVIATO e senza id', async () => {
    const repository = repositoryFinto({
      elencaPromo: vi.fn<IMaterialiRepository['elencaPromo']>(async () => [promo('p1', STATO_PROMO.IN_LAVORAZIONE)]),
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [kit('k1', { id_design: 'd-avviato', numero_file: 5 })]),
    });
    const istanta = istantaFinta({
      p1: [
        daAvviare('d-nuovo', FORMATO_VOLANTINO),
        daAvviare('d-pop', FORMATO_ESPOSITORI), // POP: non e' un volantino
        daAvviare('d-manuale', FORMATO_VOLANTINO, { tipo: 'MANUALE' }), // resta nei contenuti digitali
        daAvviare('d-senza-tipo', FORMATO_SENZA_TIPO), // formato senza tipo: nessuna vista
        daAvviare('d-avviato', FORMATO_VOLANTINO), // ha gia' il suo runtime: non si ripete
        { isDesignKit: false, lavorazioneStarted: true, guidId: 'k1', guidFormato: FORMATO_VOLANTINO, titolo: 'Kit k1' },
      ],
    });
    const service = new MaterialiService(repository, istanta, zipFinto());

    const pagina = await service.getVolantini({ periodo: 'in-corso' }, req);

    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledWith('p1', req);
    expect(repository.elencaKit).toHaveBeenCalledWith(criteriDelPeriodo('in-corso', TIPO_LAVORAZIONE.VOLANTINO), { conCopertina: true });
    expect(pagina.kit.map(k => k.idDesign).sort()).toEqual(['d-avviato', 'd-nuovo']);
    expect(pagina.kit.find(k => k.idDesign === 'd-nuovo')).toMatchObject({
      id: null,
      stato: 'NON_AVVIATO',
      numeroFile: 0,
      copertina: null,
      formato: { id: FORMATO_VOLANTINO, nome: 'Volantino' },
      promo: { id: 'p1' },
      area: { id: AREA, nome: 'Toscana' },
    });
    expect(pagina.kit.find(k => k.id === 'k1')).toMatchObject({ stato: 'PUBBLICATO', numeroFile: 5 });
    expect(pagina).toMatchObject({ totale: 2, totaleSenzaFiltri: 2, avvisi: [] });
  });

  it('se Istanta non risponde per una promo, la promo resta con i suoi kit del database e un avviso', async () => {
    const repository = repositoryFinto({
      elencaPromo: vi.fn<IMaterialiRepository['elencaPromo']>(async () => [
        promo('p1', STATO_PROMO.IN_LAVORAZIONE),
        promo('p2', STATO_PROMO.PIANIFICATA),
      ]),
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [
        kit('k1', { stato_kit: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE }),
        kit('k2', { ...promo('p2', STATO_PROMO.PIANIFICATA), stato_kit: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE }),
      ]),
    });
    const istanta = istantaFinta({ p1: new Error('Istanta non raggiungibile'), p2: [daAvviare('d-2', FORMATO_VOLANTINO)] });
    const service = new MaterialiService(repository, istanta, zipFinto());

    const pagina = await service.getVolantini({ periodo: 'in-corso' }, req);

    expect(pagina.kit.map(k => k.id ?? k.idDesign).sort()).toEqual(['d-2', 'k1', 'k2']);
    expect(pagina.avvisi).toEqual([{ promo: { id: 'p1', nome: 'Promo p1' }, motivo: MOTIVO_NON_AVVIATI_NON_DISPONIBILI }]);
    expect(pagina.avvisi[0].motivo).not.toContain('raggiungibile');
  });

  it(`chiede a Istanta al massimo ${CHIAMATE_ISTANTA_IN_PARALLELO} promo alla volta`, async () => {
    let inCorso = 0;
    let massimo = 0;
    const istanta = {
      getAllKitPerGestioneLavorazione: vi.fn<FonteKitNonAvviati['getAllKitPerGestioneLavorazione']>(async () => {
        inCorso++;
        massimo = Math.max(massimo, inCorso);
        await new Promise(resolve => setTimeout(resolve, 5));
        inCorso--;
        return risposta([]);
      }),
    };
    const promozioni = Array.from({ length: 10 }, (_, i) => promo(`p${i}`, STATO_PROMO.IN_LAVORAZIONE));
    const service = new MaterialiService(
      repositoryFinto({ elencaPromo: vi.fn<IMaterialiRepository['elencaPromo']>(async () => promozioni) }),
      istanta,
      zipFinto()
    );

    await service.getVolantini({ periodo: 'in-corso' }, req);

    expect(istanta.getAllKitPerGestioneLavorazione).toHaveBeenCalledTimes(10);
    expect(massimo).toBe(CHIAMATE_ISTANTA_IN_PARALLELO);
  });

  it('filtri e pagina in memoria: il totale senza filtri e le tendine valgono per tutto il periodo', async () => {
    const repository = repositoryFinto({
      elencaPromo: vi.fn<IMaterialiRepository['elencaPromo']>(async () => [
        promo('p1', STATO_PROMO.IN_LAVORAZIONE),
        promo('p2', STATO_PROMO.PIANIFICATA, '2026-11-01T00:00:00+01:00'),
      ]),
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [kit('k1'), kit('k2', { titolo: 'Ipermercati ottobre' })]),
    });
    // La promo p2 ha solo un kit non avviato
    const service = new MaterialiService(repository, istantaFinta({ p2: [daAvviare('d-2', FORMATO_VOLANTINO)] }), zipFinto());

    const nonAvviati = await service.getVolantini({ periodo: 'in-corso', stato: 'NON_AVVIATO' }, req);
    const cercati = await service.getVolantini({ periodo: 'in-corso', cerca: 'IPERMERCATI', dimensione: 1, pagina: 1 }, req);

    expect(nonAvviati.kit.map(k => k.idDesign)).toEqual(['d-2']);
    expect(nonAvviati).toMatchObject({ totale: 1, totaleSenzaFiltri: 3 });
    expect(nonAvviati.opzioni.promozioni).toEqual([{ id: 'p2', nome: 'Promo p2' }, { id: 'p1', nome: 'Promo p1' }]);
    expect(cercati.kit.map(k => k.id)).toEqual(['k2']);
    expect(cercati).toMatchObject({ totale: 1, dimensione: 1 });
  });
});

describe('Riepilogo POP di una promo', () => {
  const kitPop = (id: string, idFormato: string, nomeFormato: string, stato: STATO_LAVORAZIONE_KIT_RUNTIME, numeroFile: number) =>
    kit(id, { id_formato: idFormato, nome_formato: nomeFormato, stato_kit: stato, numero_file: numeroFile });

  it('kit raggruppati per formato, file per stato del kit (con tutti gli stati) e totali', async () => {
    const repository = repositoryFinto({
      trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => promo('p1', STATO_PROMO.IN_LAVORAZIONE)),
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [
        kitPop('k1', FORMATO_ESPOSITORI, 'Espositori', STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, 10),
        kitPop('k2', FORMATO_ESPOSITORI, 'Espositori', STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE, 4),
        kitPop('k3', FORMATO_LOCANDINE, 'Locandine', STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI, 3),
        kitPop('k4', FORMATO_LOCANDINE, 'Locandine', STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE, 2),
      ]),
    });
    const istanta = istantaFinta({ p1: [daAvviare('d-5', FORMATO_CARTELLI), daAvviare('d-vol', FORMATO_VOLANTINO)] });
    const service = new MaterialiService(repository, istanta, zipFinto());

    const riepilogo = await service.getRiepilogoPop('p1', 'in-corso', req);

    expect(repository.elencaKit).toHaveBeenCalledWith({ ...criteriDelPeriodo('in-corso', TIPO_LAVORAZIONE.POP), idPromo: 'p1' });
    expect(riepilogo.formati.map(f => f.nome)).toEqual(['Cartelli', 'Espositori', 'Locandine']);
    for (const formato of riepilogo.formati) {
      expect(Object.keys(formato.filePerStatoKit).sort()).toEqual([...STATI_KIT_MATERIALI].sort());
    }
    const [cartelli, espositori, locandine] = riepilogo.formati;
    expect(espositori).toMatchObject({
      id: FORMATO_ESPOSITORI,
      numeroFile: 14,
      filePerStatoKit: { NON_AVVIATO: 0, IN_LAVORAZIONE: 0, IN_LAVORAZIONE_CON_ERRORI: 0, IN_REVISIONE: 4, PUBBLICATO: 10 },
    });
    expect(locandine.filePerStatoKit).toMatchObject({ IN_LAVORAZIONE_CON_ERRORI: 3, IN_LAVORAZIONE: 2 });
    expect(cartelli).toMatchObject({ numeroFile: 0, kit: [{ id: null, idDesign: 'd-5', stato: 'NON_AVVIATO', numeroFile: 0 }] });
    expect(riepilogo.totali).toEqual({ file: 19, formati: 3, pubblicati: 10, inRevisione: 4, conErrori: 3 });
    expect(riepilogo.promo).toMatchObject({ id: 'p1', stato: STATO_PROMO.IN_LAVORAZIONE });
    expect(riepilogo.avvisi).toEqual([]);
  });

  it('Attivi: solo i kit pubblicati, senza chiamare Istanta', async () => {
    const repository = repositoryFinto({
      trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => promo('p1', STATO_PROMO.VALIDA_CON_ERRORI)),
    });
    const istanta = istantaFinta();
    const service = new MaterialiService(repository, istanta, zipFinto());

    const riepilogo = await service.getRiepilogoPop('p1', 'attivi', req);

    expect(repository.elencaKit).toHaveBeenCalledWith({ ...criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.POP), idPromo: 'p1' });
    expect(istanta.getAllKitPerGestioneLavorazione).not.toHaveBeenCalled();
    expect(riepilogo.totali).toEqual({ file: 0, formati: 0, pubblicati: 0, inRevisione: 0, conErrori: 0 });
  });

  it('Istanta non risponde: i formati dei kit avviati e un avviso', async () => {
    const repository = repositoryFinto({
      trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => promo('p1', STATO_PROMO.IN_RITARDO)),
      elencaKit: vi.fn<IMaterialiRepository['elencaKit']>(async () => [
        kitPop('k1', FORMATO_ESPOSITORI, 'Espositori', STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE, 2),
      ]),
    });
    const service = new MaterialiService(repository, istantaFinta({ p1: new Error('timeout') }), zipFinto());

    const riepilogo = await service.getRiepilogoPop('p1', 'in-corso', req);

    expect(riepilogo.formati.map(f => f.nome)).toEqual(['Espositori']);
    expect(riepilogo.avvisi).toHaveLength(1);
  });

  it('promo inesistente o fuori dal periodo: 404', async () => {
    const repository = repositoryFinto({
      trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async (id) => (id === 'valida' ? promo('valida', STATO_PROMO.VALIDA) : null)),
    });
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    await expect(service.getRiepilogoPop('valida', 'in-corso', req)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getRiepilogoPop('valida', 'storico', req)).rejects.toThrow(/Storico/);
    await expect(service.getRiepilogoPop('assente', 'attivi', req)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.elencaKit).not.toHaveBeenCalled();
  });
});

describe('File POP di un formato', () => {
  const repositoryConPromo = (dati: Partial<IMaterialiRepository> = {}) => repositoryFinto({
    trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => promo('p1', STATO_PROMO.VALIDA)),
    ...dati,
  });

  it('una dimensione diversa da 100, 250 e 500 vale 100', async () => {
    const repository = repositoryConPromo();
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    const fuoriElenco = await service.getFilePop('p1', { periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, pagina: 2, dimensione: 42 });
    const prevista = await service.getFilePop('p1', { periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, dimensione: 250 });

    expect(fuoriElenco).toMatchObject({ pagina: 2, dimensione: 100 });
    expect(prevista).toMatchObject({ pagina: 1, dimensione: 250 });
    expect(repository.elencaFile).toHaveBeenNthCalledWith(
      1,
      { ...criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.POP), idPromo: 'p1', idFormato: FORMATO_ESPOSITORI },
      expect.any(Object),
      { limite: 100, scarto: 100 }
    );
    expect(repository.elencaFile).toHaveBeenNthCalledWith(2, expect.any(Object), expect.any(Object), { limite: 250, scarto: 0 });
  });

  it('referenza, reparto e stato dall\'ultimo log; le tendine senza doppioni', async () => {
    const repository = repositoryConPromo({
      elencaFile: vi.fn<IMaterialiRepository['elencaFile']>(async () => [
        file(FILE_1, { codice_referenza: 'REF-1', descrizione_referenza: 'Pomodori', reparto: 'Ortofrutta', stato_log: 'ERRORE', versione_log: 3 }),
        file(FILE_2),
      ]),
      contaFile: vi.fn<IMaterialiRepository['contaFile']>(async () => 2),
      elencaOpzioniFile: vi.fn<IMaterialiRepository['elencaOpzioniFile']>(async () => [
        { id_area: AREA, nome_area: 'Toscana', id_canale: CANALE, nome_canale: 'Superstore', reparto: 'Ortofrutta' },
        { id_area: AREA, nome_area: 'Toscana', id_canale: CANALE, nome_canale: 'Superstore', reparto: 'Macelleria' },
        { id_area: AREA, nome_area: 'Toscana', id_canale: CANALE, nome_canale: 'Superstore', reparto: null },
      ]),
    });
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    const pagina = await service.getFilePop('p1', {
      periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, cerca: ' ref-1 ', stato: 'ERRORE' as never, reparto: 'Ortofrutta',
    });

    expect(repository.contaFile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ cerca: 'ref-1', stato: 'ERRORE', reparto: 'Ortofrutta' })
    );
    expect(pagina.totale).toBe(2);
    expect(pagina.file[0]).toMatchObject({
      id: FILE_1,
      referenza: { codice: 'REF-1', descrizione: 'Pomodori' },
      reparto: 'Ortofrutta',
      stato: 'ERRORE',
      versione: 3,
      kit: { id: 'k1', stato: 'PUBBLICATO' },
    });
    expect(pagina.file[1]).toMatchObject({ referenza: null, reparto: null, stato: null, versione: null });
    expect(pagina.opzioni).toEqual({
      aree: [{ id: AREA, nome: 'Toscana' }],
      canali: [{ id: CANALE, nome: 'Superstore' }],
      reparti: ['Macelleria', 'Ortofrutta'],
    });
  });

  it('formato mancante, stato o area non validi: 400', async () => {
    const service = new MaterialiService(repositoryConPromo(), istantaFinta(), zipFinto());

    await expect(service.getFilePop('p1', { periodo: 'attivi', idFormato: '' })).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.getFilePop('p1', { periodo: 'attivi', idFormato: 'non-un-uuid' })).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.getFilePop('p1', { periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, stato: 'BOH' as never }))
      .rejects.toBeInstanceOf(BadRequestError);
    await expect(service.getFilePop('p1', { periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, idArea: "1' OR '1'='1" }))
      .rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('ZIP dei file POP', () => {
  const repositoryConPromo = (dati: Partial<IMaterialiRepository> = {}) => repositoryFinto({
    trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => ({ ...promo('p1', STATO_PROMO.VALIDA), nome_promo: 'Promo: ottobre' })),
    ...dati,
  });

  it('con idFile chiede al database solo quei file, nella promo e nel formato indicati; gli id malformati si scartano', async () => {
    // Il database restituisce solo i file della promo e del formato: FILE_2 e' di un'altra promo
    const repository = repositoryConPromo({
      elencaFile: vi.fn<IMaterialiRepository['elencaFile']>(async () => [file(FILE_1, { titolo_kit: 'Kit A', nome: 'banco.pdf' })]),
    });
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    const zip = await service.preparaZipPop('p1', {
      periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, idFile: [FILE_1, 'non-un-uuid', FILE_1, FILE_2],
    });

    expect(repository.elencaFile).toHaveBeenCalledWith(
      { ...criteriDelPeriodo('attivi', TIPO_LAVORAZIONE.POP), idPromo: 'p1', idFormato: FORMATO_ESPOSITORI },
      { idFile: [FILE_1, FILE_2] }
    );
    expect(zip).toEqual({
      nomeFile: 'Promo_ ottobre - Espositori.zip',
      voci: [{ file: { id_olimpo_cloud: `olimpo-${FILE_1}` }, nome: 'Kit A/banco.pdf' }],
    });
  });

  it('senza idFile valgono i filtri; nessun file da scaricare: 404', async () => {
    const repository = repositoryConPromo();
    const service = new MaterialiService(repository, istantaFinta(), zipFinto());

    await expect(service.preparaZipPop('p1', {
      periodo: 'attivi', idFormato: FORMATO_ESPOSITORI, filtri: { reparto: 'Ortofrutta' },
    })).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.elencaFile).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ reparto: 'Ortofrutta' }));
  });

  it('scrive lo ZIP con il servizio dei file, nella destinazione indicata', async () => {
    const zip = zipFinto();
    const service = new MaterialiService(repositoryConPromo(), istantaFinta(), zip);
    const voci = [{ file: { id_olimpo_cloud: 'o1' }, nome: 'Kit/a.pdf' }];
    const destinazione = new PassThrough();

    await service.scriviZipPop({ nomeFile: 'x.zip', voci }, destinazione);

    expect(zip.scriviZipDaOlimpo).toHaveBeenCalledWith(voci, destinazione);
  });

  it('una cartella per kit; nomi senza suffisso della lavorazione, caratteri riservati e doppioni', () => {
    const voci = vociZipPop([
      file('a', { id_kit: 'k1', titolo_kit: 'Kit/banco', nome: 'locandina.pdf (Lavorazione: L1)' }),
      file('b', { id_kit: 'k1', titolo_kit: 'Kit/banco', nome: 'LOCANDINA.pdf' }),
      file('c', { id_kit: 'k2', titolo_kit: 'Kit/banco', nome: 'locandina.pdf' }),
      file('d', { id_kit: 'k3', titolo_kit: '', nome: null }),
    ]);

    expect(voci.map(v => v.nome)).toEqual([
      'Kit_banco/locandina.pdf',
      'Kit_banco/LOCANDINA (2).pdf',
      'Kit_banco (2)/locandina.pdf',
      'Kit senza nome/file-d',
    ]);
    expect(nomeArchivioPop('Promo <ottobre>', 'Espositori?')).toBe('Promo _ottobre_ - Espositori_.zip');
  });
});
