import { describe, expect, it } from 'vitest';
import { CodicePermesso, PERMESSI } from '../catalogo';
import { PAGINE, VOCI_DI_MENU, normalizzaPercorso, paginaPer, puoAprirePagina, sezioneDiPercorso, voceDiMenuPer } from '../pagine';
import { SEZIONI } from '../sezioni';

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

  it('punti vendita: la consultazione chiede gdo.visualizza, la gestione gdo.gestisci_punti_vendita', () => {
    const consulta = con(PERMESSI.GDO.VISUALIZZA);
    expect(puoAprirePagina('/punti-vendita', consulta)).toBe(true);
    expect(puoAprirePagina('/punti-vendita/42', consulta)).toBe(true);
    expect(puoAprirePagina('/gestione-interna/punti-vendita', consulta)).toBe(false);
    expect(puoAprirePagina('/gestione-interna/punti-vendita/42', consulta)).toBe(false);

    const gestisce = con(PERMESSI.GDO.VISUALIZZA, PERMESSI.GDO.GESTISCI_PUNTI_VENDITA);
    expect(puoAprirePagina('/gestione-interna/punti-vendita', gestisce)).toBe(true);
    expect(puoAprirePagina('/gestione-interna/punti-vendita/42', gestisce)).toBe(true);
    expect(puoAprirePagina('/punti-vendita/42', gestisce)).toBe(true);

    expect(puoAprirePagina('/punti-vendita', con(PERMESSI.PROMO.VISUALIZZA))).toBe(false);
  });

  it('Impostazioni GDO chiede di modificare le impostazioni generali, non solo di consultarle', () => {
    expect(puoAprirePagina('/impostazioni-gdo', con(PERMESSI.IMPOSTAZIONI.VISUALIZZA))).toBe(false);
    expect(puoAprirePagina('/impostazioni-gdo', con(PERMESSI.IMPOSTAZIONI.VISUALIZZA, PERMESSI.IMPOSTAZIONI.MODIFICA_GENERALI))).toBe(true);
  });

  it('Workspace WebPliant e il suo editor chiedono di configurare WebPliant; la vecchia pagina non c\'è più', () => {
    const configura = con(PERMESSI.WEBPLIANT.VISUALIZZA, PERMESSI.WEBPLIANT.CONFIGURA);
    expect(puoAprirePagina('/webliant/workspace', configura)).toBe(true);
    expect(puoAprirePagina('/webliant/workspace/editor', configura)).toBe(true);
    expect(puoAprirePagina('/webliant/workspace', con(PERMESSI.WEBPLIANT.VISUALIZZA))).toBe(false);
    expect(paginaPer('/webliant/impostazioni-webpliant')).toBeUndefined();
    expect(paginaPer('/webliant/impostazioni-webpliant/configurazione-webpliant')).toBeUndefined();
  });

  it('le pagine di sistema richiedono il permesso di sistema', () => {
    expect(puoAprirePagina('/gestione-interna/gestione-permessi', con(PERMESSI.UTENTI.VISUALIZZA))).toBe(false);
    expect(puoAprirePagina('/gestione-interna/gestione-permessi', con(PERMESSI.SISTEMA.GESTISCI_ACCESSI))).toBe(true);
  });
});

describe('sezione delle pagine', () => {
  it('ogni pagina del catalogo dichiara una sezione del menu valida', () => {
    const valide = new Set(SEZIONI.map(s => s.sezione));
    expect(PAGINE.filter(p => !valide.has(p.sezione)).map(p => p.percorso)).toEqual([]);
  });

  it('le pagine operative stanno in Produzione', () => {
    for (const percorso of ['/promozioni/nuova', '/promozioni/in-corso/dettagli/x/kits/y', '/nuovo-ods', '/ods-in-corso', '/impostazioni-di-produzione', '/webliant/workspace', '/webliant/workspace/editor', '/gestione-ricette'])
      expect(sezioneDiPercorso(percorso), percorso).toBe('produzione');
  });

  it('le Impostazioni GDO stanno in Gestione interna, con aree, canali e punti vendita', () => {
    expect(sezioneDiPercorso('/impostazioni-gdo')).toBe('gestione');
  });

  it('le pagine di consultazione stanno in Visualizzazione', () => {
    for (const percorso of ['/volantini/attivi', '/pop/storico', '/volantini/tutti_i_volantini', '/storico-volantini', '/category/dashboard', '/marketing/dashboard', '/punti-vendita/x/referenze/y', '/report/tracciati'])
      expect(sezioneDiPercorso(percorso), percorso).toBe('visualizzazione');
  });

  it('WhatsApp sta in Comunicazione, anagrafiche e integrazioni in Gestione interna, il resto riservato in Sistema', () => {
    expect(sezioneDiPercorso('/whatsapp/campagne-whatsapp')).toBe('comunicazione');
    expect(sezioneDiPercorso('/whatsapp/gestione-whatsapp-superadmin/templates')).toBe('comunicazione');
    expect(sezioneDiPercorso('/gestione-whatsapp-admin')).toBe('comunicazione');
    expect(sezioneDiPercorso('/gestione-interna/punti-vendita/x')).toBe('gestione');
    expect(sezioneDiPercorso('/gestione-api/keys')).toBe('gestione');
    expect(sezioneDiPercorso('/gestione-interna/gestione-permessi')).toBe('sistema');
    expect(sezioneDiPercorso('/superadmin/dashboard')).toBe('sistema');
  });

  it('una pagina senza rotta non è nel catalogo e non ha sezione', () => {
    expect(paginaPer('/gestione-pagine-singular')).toBeUndefined();
    expect(sezioneDiPercorso('/dashboard-overview-8')).toBeUndefined();
  });
});

describe('pagine che si possono mettere nel menu', () => {
  it('ogni voce apre una pagina del catalogo, di una sezione del menu', () => {
    const senzaPagina = VOCI_DI_MENU.filter(v => !paginaPer(v.percorso)).map(v => v.percorso);
    expect(senzaPagina).toEqual([]);
    expect(VOCI_DI_MENU.filter(v => sezioneDiPercorso(v.percorso) === 'account').map(v => v.percorso)).toEqual([]);
  });

  it('percorsi e titoli sono unici, così l\'editor non propone due volte la stessa pagina', () => {
    expect(new Set(VOCI_DI_MENU.map(v => v.percorso)).size).toBe(VOCI_DI_MENU.length);
    expect(new Set(VOCI_DI_MENU.map(v => v.titolo)).size).toBe(VOCI_DI_MENU.length);
  });

  it('Impostazioni GDO e Workspace WebPliant si possono mettere nel menu, l\'editor a schermo intero no', () => {
    expect(voceDiMenuPer('/impostazioni-gdo')).toEqual({ percorso: '/impostazioni-gdo', titolo: 'Impostazioni GDO', icona: 'Building2' });
    expect(voceDiMenuPer('/webliant/workspace')).toEqual({ percorso: '/webliant/workspace', titolo: 'Workspace WebPliant', icona: 'LayoutTemplate' });
    expect(voceDiMenuPer('/webliant/workspace/editor')).toBeUndefined();
  });

  it('i redirect e i vecchi indirizzi non si possono scegliere', () => {
    for (const percorso of ['/dashboard', '/materiali-attivi', '/nuova-promozione', '/promozioni', '/webliant/impostazioni-webpliant'])
      expect(voceDiMenuPer(percorso), percorso).toBeUndefined();
    expect(voceDiMenuPer('promozioni/in-corso/')?.titolo).toBe('Promozioni in corso');
  });
});
