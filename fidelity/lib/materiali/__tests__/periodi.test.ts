import { describe, expect, it } from 'vitest';
import { STATO_PROMO } from '../../enums';
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  PERIODI_MATERIALI,
  percorsoDettaglioVolantino,
  percorsoKit,
  percorsoPromo,
  soloKitPubblicati,
  STATI_PROMO_PER_PERIODO,
} from '../periodi';

describe('periodi delle API /api/materiali', () => {
  it('ogni stato di una promo non eliminata sta in uno e un solo periodo', () => {
    for (const stato of Object.values(STATO_PROMO).filter(s => s !== STATO_PROMO.ELIMINATA)) {
      expect(PERIODI_MATERIALI.filter(p => STATI_PROMO_PER_PERIODO[p].includes(stato)), stato).toHaveLength(1);
    }
    expect(PERIODI_MATERIALI.some(p => STATI_PROMO_PER_PERIODO[p].includes(STATO_PROMO.ELIMINATA))).toBe(false);
  });

  it('riconosce solo i periodi validi', () => {
    for (const periodo of PERIODI_MATERIALI) expect(isPeriodoMateriali(periodo)).toBe(true);
    for (const valore of ['', 'tutti', 'In-Corso', 1, null, undefined, ['attivi']]) {
      expect(isPeriodoMateriali(valore), String(valore)).toBe(false);
    }
  });

  it('ogni periodo ha la sua etichetta', () => {
    expect(Object.keys(ETICHETTA_PERIODO).sort()).toEqual([...PERIODI_MATERIALI].sort());
  });

  it('nei periodi attivi e storico compaiono solo i kit pubblicati, in corso anche gli altri', () => {
    expect(soloKitPubblicati('in-corso')).toBe(false);
    expect(soloKitPubblicati('attivi')).toBe(true);
    expect(soloKitPubblicati('storico')).toBe(true);
  });
});

describe('percorsi dei kit', () => {
  it('il dettaglio di una promo archiviata sta sotto lo storico, le altre sotto in corso', () => {
    expect(percorsoPromo('p1', STATO_PROMO.ARCHIVIATA)).toBe('/promozioni/storico/dettagli/p1');
    expect(percorsoPromo('p1', STATO_PROMO.VALIDA)).toBe('/promozioni/in-corso/dettagli/p1');
    expect(percorsoPromo('p1', STATO_PROMO.PIANIFICATA)).toBe('/promozioni/in-corso/dettagli/p1');
    expect(percorsoPromo('p1', null)).toBe('/promozioni/in-corso/dettagli/p1');
  });

  it('il kit avviato apre il suo dettaglio, quello non avviato i kit della promo', () => {
    expect(percorsoKit('p1', STATO_PROMO.IN_LAVORAZIONE, 'k1')).toBe('/promozioni/in-corso/dettagli/p1/kits/k1');
    expect(percorsoKit('p1', STATO_PROMO.ARCHIVIATA, 'k1')).toBe('/promozioni/storico/dettagli/p1/kits/k1');
    expect(percorsoKit('p1', STATO_PROMO.PIANIFICATA, null)).toBe('/promozioni/in-corso/dettagli/p1/kits');
    expect(percorsoKit('p1', STATO_PROMO.ARCHIVIATA, null)).toBe('/promozioni/storico/dettagli/p1/kits');
  });

  it('il dettaglio di consultazione del volantino non contiene il contesto produttivo', () => {
    expect(percorsoDettaglioVolantino('k 1')).toBe('/volantini/tutti_i_volantini?kit=k+1');
    expect(percorsoDettaglioVolantino('k1', 3, 'Mozzarella Granarolo')).toBe(
      '/volantini/tutti_i_volantini?kit=k1&pagina=3&referenza=Mozzarella+Granarolo'
    );
  });
});
