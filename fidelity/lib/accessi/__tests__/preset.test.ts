import { describe, expect, it } from 'vitest';
import { AREE, applicaRegoleArea, PERMESSI as P, voceDi } from '../catalogo';
import { PERMESSI_FUORI_DA_AGENZIA, presetDi, PRESET } from '../preset';
import { SEZIONI } from '../sezioni';

describe('aree dei permessi e aree del menu', () => {
  it('ogni area di permessi sta in un\'area del menu; le aree di consultazione in Visualizzazione', () => {
    const sezioni = SEZIONI.map(s => s.sezione);
    for (const area of AREE) expect(sezioni).toContain(area.sezione);
    const sezioneDi = (id: string) => AREE.find(a => a.id === id)?.sezione;
    expect(['materiali', 'volantini', 'analisi', 'strumenti'].map(sezioneDi)).toEqual(Array(4).fill('visualizzazione'));
    expect(['promo', 'kit_runtime', 'ordini_stampa', 'file'].map(sezioneDi)).toEqual(Array(4).fill('produzione'));
    expect(sezioneDi('whatsapp')).toBe('comunicazione');
    expect(['gdo', 'utenti', 'api', 'webhook'].map(sezioneDi)).toEqual(Array(4).fill('gestione'));
    expect(sezioneDi('sistema')).toBe('sistema');
  });

  it('scaricare dalla consultazione e il report sono permessi di Visualizzazione, non di produzione', () => {
    expect(voceDi(P.MATERIALI.SCARICA)?.area.id).toBe('materiali');
    expect(applicaRegoleArea([P.MATERIALI.SCARICA])).toEqual([]);
    expect(voceDi(P.ANALISI.VISUALIZZA)).toMatchObject({ accesso: true, area: { id: 'analisi', sezione: 'visualizzazione' } });
  });
});

describe('preset', () => {
  it('ogni preset rispetta la regola d\'area e non contiene permessi di sistema', () => {
    for (const preset of PRESET) {
      expect(new Set(applicaRegoleArea(preset.permessi))).toEqual(new Set(preset.permessi));
      expect(preset.permessi.some(codice => voceDi(codice)?.sistema)).toBe(false);
    }
  });

  it('Solo visualizzazione consulta e scarica i volantini senza promozioni, kit né file di produzione', () => {
    const { permessi } = presetDi('solo-visualizzazione');
    expect(permessi).toEqual(expect.arrayContaining([
      P.MATERIALI.VISUALIZZA, P.MATERIALI.SCARICA, P.VOLANTINI.VISUALIZZA, P.ANALISI.VISUALIZZA, P.GDO.VISUALIZZA,
    ]));
    for (const codice of [P.PROMO.VISUALIZZA, P.PROMO.CREA, P.KIT_RUNTIME.VISUALIZZA, P.FILE.DOWNLOAD, P.ORDINI_STAMPA.VISUALIZZA, P.GDO.GESTISCI_PUNTI_VENDITA]) {
      expect(permessi).not.toContain(codice);
    }
  });

  it('Agenzia ha Produzione e Gestione interna, senza Visualizzazione né Comunicazione', () => {
    const { permessi } = presetDi('agenzia');
    expect(permessi).toEqual(expect.arrayContaining([
      P.PROMO.CREA, P.PROMO.GESTISCI_MOMENTI, P.PROMO.GESTISCI_SCHEMI, P.KIT_RUNTIME.PUBBLICA, P.ORDINI_STAMPA.AVVIA_FTP, P.FILE.DOWNLOAD,
      P.GDO.VISUALIZZA, P.GDO.GESTISCI_AREE_CANALI, P.UTENTI.CREA, P.WEBPLIANT.CONFIGURA,
    ]));
    for (const codice of PERMESSI_FUORI_DA_AGENZIA) expect(permessi).not.toContain(codice);
    expect([...PERMESSI_FUORI_DA_AGENZIA].sort()).toEqual([
      P.ANALISI.DASHBOARD_CATEGORY, P.ANALISI.DASHBOARD_MARKETING, P.ANALISI.VISUALIZZA, P.MATERIALI.SCARICA, P.MATERIALI.VISUALIZZA, P.STRUMENTI.VISUALIZZA, P.VOLANTINI.VISUALIZZA,
      P.WHATSAPP.ANNULLA_CAMPAGNA, P.WHATSAPP.GESTISCI_PRESETS, P.WHATSAPP.GESTISCI_TEMPLATES,
      P.WHATSAPP.INVIA_CAMPAGNA, P.WHATSAPP.VISUALIZZA_CAMPAGNE,
    ].sort());
  });
});
