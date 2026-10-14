import { describe, expect, it } from 'vitest';
import { PuntoVenditaService } from '../PuntoVenditaService';

// Proposte anagrafica-punti-vendita: elenco e dettaglio mostrano ragione sociale,
// canale e area per nome e i codici del sistema della GDO

const pv = {
  id_puntivendita: 'pv1',
  nome_puntivendita: 'Conad City Lucca',
  citta_puntivendita: 'Lucca',
  cap_puntivendita: '55100',
  indirizzo_puntivendita: 'Via Fillungo 12',
  lat_puntivendita: null as unknown as number,
  lon_puntivendita: null as unknown as number,
  id_combinazione_canale_area_puntivendita: 'comb1',
  id_gdo_puntivendita: 'g1',
  ragionesociale_puntivendita: 'Lucca Market Srl',
  meta_puntivendita: { id_anacan: '004512' },
};

const mappa = () => (new PuntoVenditaService({} as any) as any).mapToDTO(
  pv,
  new Map([['comb1', { id_combinazione_canale_area: 'comb1', id_canale_combinazione_canale_area: 'c1', id_area_combinazione_canale_area: 'a1' }]]),
  new Map([['c1', { id: 'c1', codice: 'CC', nome: 'Conad City' }]]),
  new Map([['a1', { id: 'a1', codice: 'TO', nome: 'Toscana' }]]),
);

describe('PuntoVenditaService.mapToDTO', () => {
  it('restituisce ragione sociale, meta e nomi di canale e area', () => {
    expect(mappa()).toMatchObject({
      ragionesociale: 'Lucca Market Srl',
      meta: { id_anacan: '004512' },
      nome_canale: 'Conad City',
      nome_area: 'Toscana',
    });
  });

  it('senza coordinate il PV risulta senza coordinate', () => {
    expect(mappa().has_coordinate).toBe(false);
  });
});
