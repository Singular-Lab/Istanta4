import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../catalogo';
import { PERCORSI_SPOSTATI, percorsoSpostato } from '../gestioneInterna';
import { paginaPer } from '../pagine';

describe('pagine spostate sotto /gestione-interna', () => {
  it('sposta la pagina e le sue sottopagine', () => {
    expect(percorsoSpostato('/aree-e-canali')).toBe('/gestione-interna/aree-e-canali');
    expect(percorsoSpostato('/aree-e-canali/42')).toBe('/gestione-interna/aree-e-canali/42');
    expect(percorsoSpostato('/gestione-permessi')).toBe('/gestione-interna/gestione-permessi');
  });

  it('non tocca i percorsi già nuovi, quelli simili e le altre pagine', () => {
    expect(percorsoSpostato('/gestione-interna/aree-e-canali')).toBeUndefined();
    expect(percorsoSpostato('/aree-e-canali-bis')).toBeUndefined();
    expect(percorsoSpostato('/promozioni/in-corso')).toBeUndefined();
  });

  it('/punti-vendita non è più spostato: è la consultazione dei punti vendita', () => {
    expect(PERCORSI_SPOSTATI['/punti-vendita']).toBeUndefined();
    expect(percorsoSpostato('/punti-vendita')).toBeUndefined();
    expect(percorsoSpostato('/punti-vendita/42')).toBeUndefined();
    expect(paginaPer('/punti-vendita')?.permesso).toBe(PERMESSI.GDO.VISUALIZZA);
  });

  it('ogni nuovo percorso ha la sua voce nel catalogo, i vecchi no', () => {
    for (const [vecchio, nuovo] of Object.entries(PERCORSI_SPOSTATI)) {
      expect(paginaPer(nuovo)?.percorso).toBe(nuovo);
      expect(paginaPer(vecchio)).toBeUndefined();
    }
  });
});

describe('pagine WebPliant spostate', () => {
  it('l\'elenco dei workspace diventa Workspace WebPliant, l\'editor sta sotto di essa', () => {
    expect(percorsoSpostato('/webliant/impostazioni-webpliant')).toBe('/webliant/workspace');
    expect(percorsoSpostato('/webliant/impostazioni-webpliant/workspace')).toBe('/webliant/workspace/editor');
  });

  it('la configurazione WebPliant porta alle Impostazioni GDO, non a una sottopagina dei workspace', () => {
    expect(percorsoSpostato('/webliant/impostazioni-webpliant/configurazione-webpliant')).toBe('/impostazioni-gdo');
  });

  it('vince il vecchio percorso più lungo, qualunque sia l\'ordine delle voci', () => {
    expect(percorsoSpostato('/webliant/impostazioni-webpliant/workspace/altro')).toBe('/webliant/workspace/editor/altro');
    expect(percorsoSpostato('/webliant/impostazioni-webpliant/altro')).toBe('/webliant/workspace/altro');
    expect(percorsoSpostato('/webliant/impostazioni-webpliant-bis')).toBeUndefined();
  });

  it('i nuovi percorsi chiedono gli stessi permessi di prima', () => {
    expect(paginaPer('/webliant/workspace')?.permesso).toBe(PERMESSI.WEBPLIANT.CONFIGURA);
    expect(paginaPer('/webliant/workspace/editor')?.permesso).toBe(PERMESSI.WEBPLIANT.CONFIGURA);
    expect(paginaPer('/impostazioni-gdo')?.permesso).toBe(PERMESSI.IMPOSTAZIONI.MODIFICA_GENERALI);
  });
});
