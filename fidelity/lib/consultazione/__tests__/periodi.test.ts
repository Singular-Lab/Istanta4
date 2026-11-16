import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../../accessi/catalogo';
import { paginaPer } from '../../accessi/pagine';
import { STATO_PROMO } from '../../enums';
import {
  ETICHETTA_PERIODO_CONSULTAZIONE,
  isPeriodoConsultazione,
  PERIODI_CONSULTAZIONE,
  percorsoPop,
  percorsoPromozioneVolantini,
  percorsoVolantini,
  periodoConsultazioneDellaPromo,
  STATI_PROMO_CONSULTABILI,
  STATI_PROMO_CONSULTAZIONE,
} from '../periodi';

describe('periodi delle viste Volantini e POP', () => {
  it('ogni stato di una promo non eliminata sta in uno e un solo periodo', () => {
    for (const stato of Object.values(STATO_PROMO).filter(s => s !== STATO_PROMO.ELIMINATA)) {
      const periodi = PERIODI_CONSULTAZIONE.filter(p => STATI_PROMO_CONSULTAZIONE[p].includes(stato));
      expect(periodi, stato).toHaveLength(1);
      expect(periodoConsultazioneDellaPromo(stato), stato).toBe(periodi[0]);
    }
  });

  it('le promo che non sono ancora valide stanno fra i Prossimi', () => {
    for (const stato of [
      STATO_PROMO.PIANIFICATA,
      STATO_PROMO.IN_LAVORAZIONE,
      STATO_PROMO.IN_ATTESA_DI_VALIDITA,
      STATO_PROMO.IN_SCADENZA,
      STATO_PROMO.IN_RITARDO,
    ]) expect(periodoConsultazioneDellaPromo(stato), stato).toBe('prossimi');
    expect(periodoConsultazioneDellaPromo(STATO_PROMO.VALIDA)).toBe('attivi');
    expect(periodoConsultazioneDellaPromo(STATO_PROMO.VALIDA_CON_ERRORI)).toBe('attivi');
    expect(periodoConsultazioneDellaPromo(STATO_PROMO.ARCHIVIATA)).toBe('storico');
  });

  it('una promo eliminata, senza stato o con uno stato sconosciuto non sta in nessun periodo', () => {
    expect(STATI_PROMO_CONSULTABILI).not.toContain(STATO_PROMO.ELIMINATA);
    for (const stato of [STATO_PROMO.ELIMINATA, 'SCONOSCIUTO', '', null, undefined]) {
      expect(periodoConsultazioneDellaPromo(stato), String(stato)).toBeUndefined();
    }
  });

  it('riconosce solo i periodi validi: "in-corso" non lo è più', () => {
    for (const periodo of PERIODI_CONSULTAZIONE) expect(isPeriodoConsultazione(periodo)).toBe(true);
    for (const valore of ['', 'in-corso', 'Prossimi', 1, null, undefined, ['attivi']]) {
      expect(isPeriodoConsultazione(valore), String(valore)).toBe(false);
    }
  });

  it('ogni periodo ha il nome con cui compare nei titoli delle viste', () => {
    expect(ETICHETTA_PERIODO_CONSULTAZIONE).toEqual({ attivi: 'Attivi', prossimi: 'Prossimi', storico: 'Storico' });
  });
});

describe('percorsi delle viste', () => {
  it('compone i percorsi Volantini e POP, con la promo nella query codificata', () => {
    expect(percorsoVolantini('prossimi')).toBe('/volantini/prossimi');
    expect(percorsoVolantini('attivi', 'p1')).toBe('/volantini/attivi?promo=p1');
    expect(percorsoPop('storico')).toBe('/pop/storico');
    expect(percorsoPop('attivi', 'a b/c&d=e')).toBe('/pop/attivi?promo=a%20b%2Fc%26d%3De');
  });

  it('senza promo, o con un id vuoto, non aggiunge la query', () => {
    expect(percorsoVolantini('storico', '')).toBe('/volantini/storico');
    expect(percorsoPop('prossimi', undefined)).toBe('/pop/prossimi');
  });

  it('il dettaglio della promozione senza filtri non ha query', () => {
    expect(percorsoPromozioneVolantini('p1')).toBe('/volantini/promozioni/p1');
    expect(percorsoPromozioneVolantini('p1', {})).toBe('/volantini/promozioni/p1');
    expect(percorsoPromozioneVolantini('p1', { idCanale: '', idArea: undefined })).toBe('/volantini/promozioni/p1');
  });

  it('il dettaglio della promozione si apre con i filtri insegna (canale) e area, come li legge la pagina', () => {
    expect(percorsoPromozioneVolantini('p1', { idCanale: 'c1', idArea: 'a1' })).toBe(
      '/volantini/promozioni/p1?canale=c1&area=a1'
    );
    expect(percorsoPromozioneVolantini('p1', { idArea: 'a1' })).toBe('/volantini/promozioni/p1?area=a1');
    expect(percorsoPromozioneVolantini('p1', { idCanale: 'c1' })).toBe('/volantini/promozioni/p1?canale=c1');
  });

  it('nel dettaglio della promozione id e filtri sono codificati', () => {
    const percorso = percorsoPromozioneVolantini('a b/c', { idCanale: 'x&y=z', idArea: 'n o' });
    expect(percorso.split('?')[0]).toBe('/volantini/promozioni/a%20b%2Fc');
    const query = new URLSearchParams(percorso.split('?')[1]);
    expect(query.get('canale')).toBe('x&y=z');
    expect(query.get('area')).toBe('n o');
  });

  it('il dettaglio della promozione, anche filtrato, chiede il permesso dei materiali', () => {
    for (const percorso of [
      percorsoPromozioneVolantini('p1'),
      percorsoPromozioneVolantini('p1', { idCanale: 'c1', idArea: 'a1' }),
    ]) {
      expect(paginaPer(percorso)?.permesso, percorso).toBe(PERMESSI.MATERIALI.VISUALIZZA);
    }
  });

  it('ogni vista ha la sua voce nel catalogo delle pagine, con il permesso dei materiali', () => {
    for (const periodo of PERIODI_CONSULTAZIONE) {
      for (const percorso of [percorsoVolantini(periodo), percorsoPop(periodo), percorsoPop(periodo, 'p1')]) {
        expect(paginaPer(percorso)?.permesso, percorso).toBe(PERMESSI.MATERIALI.VISUALIZZA);
      }
    }
  });
});
