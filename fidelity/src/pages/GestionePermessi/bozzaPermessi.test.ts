import { describe, expect, it } from 'vitest';
import { AREE, PERMESSI, TUTTI_I_PERMESSI } from '../../../lib/accessi/catalogo';
import {
  ConfigurazioneServer,
  differenze,
  impostaArea,
  impostaPermesso,
  modificheDaInviare,
  passaFiltro,
  ripristinaEreditato,
  statoArea,
  valoreVisto,
} from './bozzaPermessi';

/** Configurazione con i soli codici indicati abilitati; `impostati` per gli ambiti che ereditano. */
const configurazione = (abilitati: string[], opzioni: { eredita?: boolean; impostati?: string[]; ereditati?: string[] } = {}): ConfigurazioneServer => ({
  ambito: { tipo: 'GDO' },
  eredita: !!opzioni.eredita,
  permessi: TUTTI_I_PERMESSI.map(p => ({
    codice: p.codice,
    abilitato: abilitati.indexOf(p.codice) >= 0,
    impostato: (opzioni.impostati ?? []).indexOf(p.codice) >= 0,
    ereditato: (opzioni.ereditati ?? []).indexOf(p.codice) >= 0,
    efficace: false,
  })),
});

describe('bozza dei permessi', () => {
  it('riportare un permesso al valore iniziale annulla la modifica', () => {
    const config = configurazione([PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.CREA]);
    const spento = impostaPermesso(config, {}, PERMESSI.PROMO.CREA, false);
    expect(Object.keys(spento)).toEqual([PERMESSI.PROMO.CREA]);
    expect(impostaPermesso(config, spento, PERMESSI.PROMO.CREA, true)).toEqual({});
  });

  it('accendere un\'azione accende anche l\'accesso all\'area', () => {
    const config = configurazione([]);
    const bozza = impostaPermesso(config, {}, PERMESSI.KIT_RUNTIME.PUBBLICA, true);
    expect(bozza).toEqual({ [PERMESSI.KIT_RUNTIME.PUBBLICA]: true, [PERMESSI.KIT_RUNTIME.VISUALIZZA]: true });
  });

  it('spegnere l\'accesso spegne le azioni dell\'area', () => {
    const config = configurazione([PERMESSI.KIT_RUNTIME.VISUALIZZA, PERMESSI.KIT_RUNTIME.PUBBLICA]);
    const bozza = impostaPermesso(config, {}, PERMESSI.KIT_RUNTIME.VISUALIZZA, false);
    expect(bozza).toEqual({ [PERMESSI.KIT_RUNTIME.VISUALIZZA]: false, [PERMESSI.KIT_RUNTIME.PUBBLICA]: false });
  });

  it('i permessi di sistema non si modificano', () => {
    expect(impostaPermesso(configurazione([]), {}, PERMESSI.SISTEMA.LOG, true)).toEqual({});
    const sistema = AREE.find(a => a.sistema)!;
    expect(impostaArea(configurazione([]), {}, sistema, true)).toEqual({});
  });

  it('accende e spegne un\'area intera e ne riporta lo stato', () => {
    const config = configurazione([PERMESSI.WEBHOOK.VISUALIZZA]);
    const webhook = AREE.find(a => a.id === 'webhook')!;
    expect(statoArea(config, {}, webhook).stato).toBe('misto');
    const tutta = impostaArea(config, {}, webhook, true);
    expect(statoArea(config, tutta, webhook)).toEqual({ stato: 'tutti', abilitati: 2, totale: 2 });
    expect(statoArea(config, impostaArea(config, {}, webhook, false), webhook).stato).toBe('nessuno');
  });

  it('in un override di GDO si può tornare al valore ereditato', () => {
    const config = configurazione([], {
      eredita: true,
      impostati: [PERMESSI.PROMO.ELIMINA],
      ereditati: [PERMESSI.PROMO.ELIMINA],
    });
    const bozza = ripristinaEreditato(config, {}, PERMESSI.PROMO.ELIMINA);
    expect(bozza).toEqual({ [PERMESSI.PROMO.ELIMINA]: null });
    expect(valoreVisto(config, bozza, PERMESSI.PROMO.ELIMINA)).toEqual({ abilitato: true, impostato: false, inSospeso: true });
    expect(modificheDaInviare(bozza)).toEqual([{ codice: PERMESSI.PROMO.ELIMINA, abilitato: null }]);
    expect(differenze(config, bozza)).toEqual([
      expect.objectContaining({ codice: PERMESSI.PROMO.ELIMINA, prima: false, dopo: true, eredita: true }),
    ]);
  });

  it('il riepilogo elenca le modifiche con nome e area', () => {
    const config = configurazione([PERMESSI.PROMO.VISUALIZZA]);
    const bozza = impostaPermesso(config, {}, PERMESSI.PROMO.ELIMINA, true);
    expect(differenze(config, bozza)).toEqual([
      { codice: PERMESSI.PROMO.ELIMINA, nome: 'Eliminare promozioni', area: 'Promozioni', prima: false, dopo: true, eredita: false },
    ]);
  });

  it('il filtro "modificati" mostra i personalizzati e quelli in sospeso', () => {
    const config = configurazione([], { eredita: true, impostati: [PERMESSI.PROMO.CREA] });
    expect(passaFiltro(config, {}, PERMESSI.PROMO.CREA, 'modificati', '')).toBe(true);
    expect(passaFiltro(config, {}, PERMESSI.PROMO.ELIMINA, 'modificati', '')).toBe(false);
    const bozza = impostaPermesso(config, {}, PERMESSI.PROMO.ELIMINA, true);
    expect(passaFiltro(config, bozza, PERMESSI.PROMO.ELIMINA, 'modificati', '')).toBe(true);
  });

  it('la ricerca guarda nome, descrizione, codice e area', () => {
    const config = configurazione([]);
    expect(passaFiltro(config, {}, PERMESSI.ORDINI_STAMPA.AVVIA_FTP, 'tutti', 'tipografia')).toBe(true);
    expect(passaFiltro(config, {}, PERMESSI.ORDINI_STAMPA.AVVIA_FTP, 'tutti', 'webhook')).toBe(false);
  });
});
