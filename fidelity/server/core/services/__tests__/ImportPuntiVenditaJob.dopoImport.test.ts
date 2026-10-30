import { describe, expect, it, vi } from 'vitest';
import type { CreatePuntoVenditaDTO, EsitoRigaImportPuntoVenditaDTO, StatoImportPuntiVenditaDTO } from '../../dto';
import { RegistroLavoriInMemoria } from '../../../__tests__/registroLavoriInMemoria';
import { GestoreImportPuntiVendita, type OperazioniImportPuntiVendita } from '../ImportPuntiVenditaJob';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Storia del punto vendita: a fine import Excel le righe dei volantini della GDO si riabbinano una
// volta sola; durante l'import chi salva un PV lo sa (inCorsoQui) e lascia fare all'import

const dati = (nome: string): CreatePuntoVenditaDTO => ({
  nome, indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100', id_combinazione_canale_area: 'comb1', id_gdo: 'g1',
});
const crea = (riga: number): EsitoRigaImportPuntoVenditaDTO =>
  ({ riga, azione: 'crea', letto: { nome: `PV ${riga}`, indirizzo: '', citta: '', cap: '' }, dati: dati(`PV ${riga}`), punteggio: 100, motivi: [] });
const scarta = (riga: number): EsitoRigaImportPuntoVenditaDTO => ({ riga, azione: 'scarta', errore: 'CAP non valido' });

const operazioni = (scrivi: OperazioniImportPuntiVendita['scrivi'] = vi.fn(async () => undefined)): OperazioniImportPuntiVendita => ({
  scrivi,
  notifica: vi.fn((_evento: 'progress' | 'complete', _stato: StatoImportPuntiVenditaDTO) => undefined),
});

describe('GestoreImportPuntiVendita: dopo l\'import', () => {
  it('con almeno un PV scritto riabbina i volantini della GDO, una volta, prima di concludere', async () => {
    const dopoImport = vi.fn(async (_idGdo: string) => undefined);
    const gestore = new GestoreImportPuntiVendita(new RegistroLavoriInMemoria(), { dopoImport });

    const { fine } = await gestore.avvia('g1', 'u1', [crea(2), crea(3)], operazioni());
    const finale = await fine;

    expect(finale.stato).toBe('completato');
    expect(dopoImport).toHaveBeenCalledOnce();
    expect(dopoImport).toHaveBeenCalledWith('g1');
  });

  it('senza PV scritti non riabbina', async () => {
    const dopoImport = vi.fn(async (_idGdo: string) => undefined);
    const gestore = new GestoreImportPuntiVendita(new RegistroLavoriInMemoria(), { dopoImport });

    const { fine } = await gestore.avvia('g1', 'u1', [scarta(2)], operazioni());
    await fine;

    expect(dopoImport).not.toHaveBeenCalled();
  });

  it('un riabbinamento che fallisce non cambia l\'esito dell\'import', async () => {
    const dopoImport = vi.fn(async (_idGdo: string) => { throw new Error('database giu'); });
    const gestore = new GestoreImportPuntiVendita(new RegistroLavoriInMemoria(), { dopoImport });

    const { fine } = await gestore.avvia('g1', 'u1', [crea(2)], operazioni());

    expect(await fine).toMatchObject({ stato: 'completato', creati: 1 });
  });

  it('inCorsoQui: vero mentre l\'import della GDO gira in questo processo, falso dopo e per le altre GDO', async () => {
    const gestore = new GestoreImportPuntiVendita(new RegistroLavoriInMemoria());
    const visto: boolean[] = [];
    const scrivi = vi.fn(async () => {
      visto.push(gestore.inCorsoQui('g1'), gestore.inCorsoQui('g2'));
    });

    const { fine } = await gestore.avvia('g1', 'u1', [crea(2)], operazioni(scrivi));
    await fine;

    expect(visto).toEqual([true, false]);
    expect(gestore.inCorsoQui('g1')).toBe(false);
  });
});
