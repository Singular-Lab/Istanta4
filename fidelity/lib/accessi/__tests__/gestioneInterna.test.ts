import { describe, expect, it } from 'vitest';
import { PERCORSI_SPOSTATI, percorsoSpostato } from '../gestioneInterna';
import { paginaPer } from '../pagine';

describe('pagine spostate sotto /gestione-interna', () => {
  it('sposta la pagina e le sue sottopagine', () => {
    expect(percorsoSpostato('/punti-vendita')).toBe('/gestione-interna/punti-vendita');
    expect(percorsoSpostato('/punti-vendita/42')).toBe('/gestione-interna/punti-vendita/42');
    expect(percorsoSpostato('/gestione-permessi')).toBe('/gestione-interna/gestione-permessi');
  });

  it('non tocca i percorsi già nuovi, quelli simili e le altre pagine', () => {
    expect(percorsoSpostato('/gestione-interna/punti-vendita')).toBeUndefined();
    expect(percorsoSpostato('/punti-vendita-bis')).toBeUndefined();
    expect(percorsoSpostato('/promozioni/in-corso')).toBeUndefined();
  });

  it('ogni nuovo percorso ha la sua voce nel catalogo, i vecchi no', () => {
    for (const [vecchio, nuovo] of Object.entries(PERCORSI_SPOSTATI)) {
      expect(paginaPer(nuovo)?.percorso).toBe(nuovo);
      expect(paginaPer(vecchio)).toBeUndefined();
    }
  });
});
