import { describe, expect, it } from 'vitest';
import { CodicePermesso, PERMESSI } from '../catalogo';
import { normalizzaPercorso, paginaPer, puoAprirePagina } from '../pagine';

const con = (...codici: CodicePermesso[]) => {
  const insieme = new Set<string>(codici);
  return (codice: CodicePermesso) => insieme.has(codice);
};

describe('catalogo delle pagine', () => {
  it('normalizza i percorsi arrivati dal client', () => {
    expect(normalizzaPercorso('promozioni/in-corso/')).toBe('/promozioni/in-corso');
    expect(normalizzaPercorso('/ods-in-corso?tab=2')).toBe('/ods-in-corso');
  });

  it('la pagina più specifica vince sulle sottopagine dell\'area', () => {
    expect(paginaPer('/promozioni/nuova')?.permesso).toBe(PERMESSI.PROMO.CREA);
    expect(paginaPer('/promozioni/in-corso/dettagli/abc/kits/xyz')?.permesso).toBe(PERMESSI.PROMO.VISUALIZZA);
  });

  it('confronta segmenti interi: un prefisso di testo non basta', () => {
    expect(paginaPer('/promozioni-in-corso')?.percorso).toBe('/promozioni-in-corso');
    expect(paginaPer('/gestione-interna/gestione-utenti-bis')).toBeUndefined();
  });

  it('una pagina senza sottopagine non copre i percorsi figli', () => {
    expect(paginaPer('/gestione-interna/gestione-utenti/qualcosa')).toBeUndefined();
  });
});

describe('puoAprirePagina', () => {
  it('area non consentita: pagina negata', () => {
    expect(puoAprirePagina('/ods-in-corso', con(PERMESSI.PROMO.VISUALIZZA))).toBe(false);
  });

  it('con promo.visualizza ma senza promo.crea la creazione è negata', () => {
    const permessi = con(PERMESSI.PROMO.VISUALIZZA);
    expect(puoAprirePagina('/promozioni/in-corso', permessi)).toBe(true);
    expect(puoAprirePagina('/promozioni/nuova', permessi)).toBe(false);
  });

  it('le pagine per tutti gli autenticati non chiedono permessi', () => {
    expect(puoAprirePagina('/profilo-utente', con())).toBe(true);
    expect(puoAprirePagina('/documentazione/api', con())).toBe(true);
  });

  it('le pagine non censite sono negate, salvo al Superadmin', () => {
    expect(puoAprirePagina('/pagina-che-non-esiste', con(PERMESSI.PROMO.VISUALIZZA))).toBe(false);
    expect(puoAprirePagina('/pagina-che-non-esiste', con(), true)).toBe(true);
  });

  it('le pagine di sistema richiedono il permesso di sistema', () => {
    expect(puoAprirePagina('/gestione-interna/gestione-permessi', con(PERMESSI.UTENTI.VISUALIZZA))).toBe(false);
    expect(puoAprirePagina('/gestione-interna/gestione-permessi', con(PERMESSI.SISTEMA.GESTISCI_ACCESSI))).toBe(true);
  });
});
