import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../catalogo';
import { aggiungiVoceAvanzamento } from '../menuAvanzamento';
import type { VoceMenuConvertibile } from '../menuMateriali';

type Voce = VoceMenuConvertibile & { id_parent: string | null; tipo_utente: string };

const voce = (id: string, titolo: string, pathname: string | null, ordinamento: number, altro: Partial<Voce> = {}): Voce => ({
  id_menu_item: id,
  id_parent: null,
  tipo_utente: 'Agenzia',
  tipo: pathname ? 'item' : 'separator',
  titolo,
  icona: pathname ? 'Circle' : null,
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento,
  ...altro,
});

const riassunto = (voci: Voce[]) => voci.map(v => [v.id_parent ? `${v.id_parent} > ${v.titolo}` : v.titolo, v.ordinamento]);

describe('voce Avanzamento produzione nei menu salvati', () => {
  it('entra subito prima di Promozioni in corso, con titolo, icona e permesso del catalogo; le voci seguenti scendono', () => {
    const menu = [
      voce('sep', 'PROMOZIONI', null, 0),
      voce('nuova', 'Nuova promozione', '/promozioni/nuova', 1),
      voce('in-corso', 'Le mie promo', '/promozioni/in-corso', 2, { start_page: true }),
      voce('storico', 'Storico promozioni', '/promozioni/storico', 3),
    ];

    const { voci, aggiornate, inserite } = aggiungiVoceAvanzamento(menu, () => 'nuova-voce');

    expect(riassunto(voci)).toEqual([
      ['PROMOZIONI', 0],
      ['Nuova promozione', 1],
      ['Avanzamento produzione', 2],
      ['Le mie promo', 3],
      ['Storico promozioni', 4],
    ]);
    expect(inserite).toEqual([expect.objectContaining({
      id_menu_item: 'nuova-voce',
      tipo_utente: 'Agenzia',
      tipo: 'item',
      pathname: '/avanzamento-produzione',
      icona: 'Gauge',
      codice_permesso: PERMESSI.KIT_RUNTIME.VISUALIZZA,
      start_page: false,
      disabilitato: false,
    })]);
    expect(aggiornate.map(v => v.id_menu_item)).toEqual(['in-corso', 'storico']);
    // Il titolo personalizzato e la pagina iniziale restano dove erano
    expect(voci.find(v => v.id_menu_item === 'in-corso')).toMatchObject({ titolo: 'Le mie promo', start_page: true });
    // Il menu ricevuto non cambia
    expect(menu.map(v => v.ordinamento)).toEqual([0, 1, 2, 3]);
  });

  it('sotto lo stesso padre: le voci degli altri gruppi non si spostano, e segue lo stato attivo della voce vicina', () => {
    const menu = [
      voce('gruppo', 'Promozioni', null, 0, { tipo: 'item' }),
      voce('in-corso', 'In corso', '/promozioni/in-corso/', 0, { id_parent: 'gruppo', disabilitato: true }),
      voce('storico', 'Storico', '/promozioni/storico', 1, { id_parent: 'gruppo' }),
      voce('ods', 'Ordini', '/ods-in-corso', 1),
    ];

    const { voci, aggiornate, inserite } = aggiungiVoceAvanzamento(menu, () => 'nuova-voce');

    expect(riassunto(voci)).toEqual([
      ['Promozioni', 0],
      ['gruppo > Avanzamento produzione', 0],
      ['gruppo > In corso', 1],
      ['gruppo > Storico', 2],
      ['Ordini', 1],
    ]);
    expect(inserite[0]).toMatchObject({ id_parent: 'gruppo', disabilitato: true });
    expect(aggiornate.map(v => v.id_menu_item)).toEqual(['in-corso', 'storico']);
  });

  it('un menu senza Promozioni in corso, o che ha già la voce, non cambia', () => {
    const senza = [voce('vol', 'Volantini attivi', '/volantini/attivi', 0)];
    const giaPresente = [
      voce('av', 'Avanzamento', '/avanzamento-produzione', 5),
      voce('in-corso', 'Promozioni in corso', '/promozioni/in-corso', 0),
    ];

    for (const menu of [senza, giaPresente]) {
      const esito = aggiungiVoceAvanzamento(menu, () => 'nuova-voce');
      expect(esito.inserite).toEqual([]);
      expect(esito.aggiornate).toEqual([]);
      expect(riassunto(esito.voci)).toEqual(riassunto(menu));
    }
  });
});
