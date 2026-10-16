import { describe, expect, it } from 'vitest';
import {
  accessoRichiestoDa,
  applicaRegoleArea,
  AREE,
  ePermessoDiSistema,
  esistePermesso,
  PERMESSI,
  TUTTI_I_PERMESSI,
} from '../catalogo';

describe('catalogo dei permessi', () => {
  it('non ha codici duplicati e ogni codice inizia con l\'id della sua area', () => {
    const codici = TUTTI_I_PERMESSI.map(p => p.codice);
    expect(new Set(codici).size).toBe(codici.length);
    for (const p of TUTTI_I_PERMESSI) {
      expect(p.codice.startsWith(`${p.area.id}.`)).toBe(true);
    }
  });

  it('ogni costante di PERMESSI è nel catalogo e viceversa', () => {
    const costanti: string[] = [];
    const gruppi = PERMESSI as unknown as Record<string, Record<string, string>>;
    for (const g of Object.keys(gruppi)) {
      for (const k of Object.keys(gruppi[g])) costanti.push(gruppi[g][k]);
    }
    expect(new Set(costanti)).toEqual(new Set(TUTTI_I_PERMESSI.map(p => p.codice)));
  });

  it('ogni permesso ha nome e descrizione per la gestione accessi', () => {
    for (const p of TUTTI_I_PERMESSI) {
      expect(p.nome.trim().length).toBeGreaterThan(0);
      expect(p.descrizione.trim().length).toBeGreaterThan(0);
    }
  });

  it('i permessi dell\'area sistema sono di sistema, gli altri no', () => {
    expect(ePermessoDiSistema(PERMESSI.SISTEMA.GESTISCI_ACCESSI)).toBe(true);
    expect(ePermessoDiSistema(PERMESSI.PROMO.ELIMINA)).toBe(false);
    expect(AREE.filter(a => a.sistema).map(a => a.id)).toEqual(['sistema']);
  });

  it('i vecchi permessi di pagina e permessi.gestisci non esistono più', () => {
    expect(esistePermesso('pagina.dashboard')).toBe(false);
    expect(esistePermesso('permessi.gestisci')).toBe(false);
    expect(esistePermesso('promo.crea')).toBe(true);
  });

  it('un\'azione richiede l\'accesso alla sua area, l\'accesso non richiede nulla', () => {
    expect(accessoRichiestoDa(PERMESSI.KIT_RUNTIME.PUBBLICA)).toBe(PERMESSI.KIT_RUNTIME.VISUALIZZA);
    expect(accessoRichiestoDa(PERMESSI.KIT_RUNTIME.VISUALIZZA)).toBeNull();
    // Aree di sole azioni: nessun accesso richiesto
    expect(accessoRichiestoDa(PERMESSI.FILE.DOWNLOAD)).toBeNull();
  });
});

describe('applicaRegoleArea', () => {
  it('scarta le azioni senza l\'accesso alla loro area', () => {
    expect(applicaRegoleArea([PERMESSI.KIT_RUNTIME.PUBBLICA])).toEqual([]);
    expect(new Set(applicaRegoleArea([PERMESSI.KIT_RUNTIME.PUBBLICA, PERMESSI.KIT_RUNTIME.VISUALIZZA])))
      .toEqual(new Set([PERMESSI.KIT_RUNTIME.PUBBLICA, PERMESSI.KIT_RUNTIME.VISUALIZZA]));
  });

  it('tiene le azioni delle aree senza accesso e scarta i codici sconosciuti', () => {
    expect(applicaRegoleArea([PERMESSI.FILE.DOWNLOAD, 'pagina.dashboard'])).toEqual([PERMESSI.FILE.DOWNLOAD]);
  });

  it('accetta anche un Set e non duplica', () => {
    const risultato = applicaRegoleArea(new Set([PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.CREA]));
    expect(risultato).toHaveLength(2);
  });
});
