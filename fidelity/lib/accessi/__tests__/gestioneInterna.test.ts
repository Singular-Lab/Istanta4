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
