import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../../accessi/catalogo';
import { paginaPer } from '../../accessi/pagine';
import { STATO_PROMO } from '../../enums';
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  PERIODI_MATERIALI,
  percorsoKit,
  percorsoPop,
  percorsoPromo,
  percorsoVolantini,
  periodoDellaPromo,
  soloKitPubblicati,
  STATI_PROMO_PER_PERIODO,
} from '../periodi';

describe('periodi delle viste Volantini e POP', () => {
  it('ogni stato di una promo non eliminata sta in uno e un solo periodo', () => {
    for (const stato of Object.values(STATO_PROMO).filter(s => s !== STATO_PROMO.ELIMINATA)) {
      const periodi = PERIODI_MATERIALI.filter(p => STATI_PROMO_PER_PERIODO[p].includes(stato));
      expect(periodi, stato).toHaveLength(1);
      expect(periodoDellaPromo(stato), stato).toBe(periodi[0]);
    }
  });

  it('assegna gli stati al periodo giusto', () => {
    for (const stato of [
      STATO_PROMO.PIANIFICATA,
      STATO_PROMO.IN_LAVORAZIONE,
      STATO_PROMO.IN_ATTESA_DI_VALIDITA,
      STATO_PROMO.IN_SCADENZA,
      STATO_PROMO.IN_RITARDO,
    ]) expect(periodoDellaPromo(stato), stato).toBe('in-corso');
    expect(periodoDellaPromo(STATO_PROMO.VALIDA)).toBe('attivi');
    expect(periodoDellaPromo(STATO_PROMO.VALIDA_CON_ERRORI)).toBe('attivi');
    expect(periodoDellaPromo(STATO_PROMO.ARCHIVIATA)).toBe('storico');
  });

  it('una promo eliminata, senza stato o con uno stato sconosciuto non sta in nessun periodo', () => {
    expect(PERIODI_MATERIALI.some(p => STATI_PROMO_PER_PERIODO[p].includes(STATO_PROMO.ELIMINATA))).toBe(false);
    for (const stato of [STATO_PROMO.ELIMINATA, 'SCONOSCIUTO', '', null, undefined]) {
      expect(periodoDellaPromo(stato), String(stato)).toBeUndefined();
    }
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

describe('percorsi delle viste', () => {
  it('compone i percorsi Volantini e POP, con la promo nella query codificata', () => {
    expect(percorsoVolantini('in-corso')).toBe('/volantini/in-corso');
    expect(percorsoVolantini('attivi', 'p1')).toBe('/volantini/attivi?promo=p1');
    expect(percorsoPop('storico')).toBe('/pop/storico');
    expect(percorsoPop('attivi', 'a b/c&d=e')).toBe('/pop/attivi?promo=a%20b%2Fc%26d%3De');
  });

  it('senza promo, o con un id vuoto, non aggiunge la query', () => {
    expect(percorsoVolantini('storico', '')).toBe('/volantini/storico');
    expect(percorsoPop('in-corso', undefined)).toBe('/pop/in-corso');
  });

  it('ogni vista ha la sua voce nel catalogo delle pagine, con il permesso dei materiali', () => {
    for (const periodo of PERIODI_MATERIALI) {
      for (const percorso of [percorsoVolantini(periodo), percorsoPop(periodo), percorsoPop(periodo, 'p1')]) {
        expect(paginaPer(percorso)?.permesso, percorso).toBe(PERMESSI.MATERIALI.VISUALIZZA);
      }
    }
  });

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
});
