import type { MenuElement, MenuItem, MenuSezione } from '../types';

/**
 * Sezioni di primo livello del menu. Ogni pagina del catalogo (lib/accessi/pagine.ts) ne dichiara
 * una, secondo la sua funzione principale:
 *
 * - produzione: avvia, gestisce o fa avanzare le lavorazioni (promo, kit, ordini di stampa...);
 * - visualizzazione: consulta i dati prodotti (volantini, POP, dashboard, punti vendita...);
 * - comunicazione: campagne e configurazione WhatsApp;
 * - gestione: anagrafica di aree, canali, punti vendita e utenti, integrazioni (API, webhook);
 * - sistema: funzioni riservate al Superadmin;
 * - account: pagine personali o di servizio che di norma non stanno nel menu.
 */
export type SezionePagina = 'produzione' | 'visualizzazione' | 'comunicazione' | 'gestione' | 'sistema' | 'account';

/** Una sezione del menu: titolo, icona Lucide, descrizione breve e se è un'area di amministrazione. */
export interface DescrizioneSezione {
  sezione: SezionePagina;
  titolo: string;
  icona: string;
  descrizione: string;
  /** Gestione interna e Sistema: nel selettore dell'area stanno dopo le aree di lavoro. */
  amministrazione: boolean;
}

/** Ordine delle sezioni nel menu, con titolo, icona e descrizione mostrati nel selettore dell'area. */
export const SEZIONI: ReadonlyArray<DescrizioneSezione> = [
  { sezione: 'produzione', titolo: 'Produzione', icona: 'Factory', descrizione: 'Promozioni, stampa e impostazioni dei kit', amministrazione: false },
  { sezione: 'visualizzazione', titolo: 'Visualizzazione', icona: 'Eye', descrizione: 'Volantini, POP e punti vendita pubblicati', amministrazione: false },
  { sezione: 'comunicazione', titolo: 'Comunicazione', icona: 'MessageCircle', descrizione: 'Campagne e canali WhatsApp', amministrazione: false },
  { sezione: 'gestione', titolo: 'Gestione interna', icona: 'Building2', descrizione: 'Aree, canali, punti vendita e utenti', amministrazione: true },
  { sezione: 'sistema', titolo: 'Sistema', icona: 'Shield', descrizione: 'Accessi, hub e metodi di accesso', amministrazione: true },
  { sezione: 'account', titolo: 'Account', icona: 'CircleUser', descrizione: 'Profilo e pagine personali', amministrazione: true },
];

/** Vero se il valore è una delle sezioni del menu (per esempio l'area salvata in una voce). */
export const eSezionePagina = (valore: unknown): valore is SezionePagina =>
  typeof valore === 'string' && SEZIONI.some(s => s.sezione === valore);

export const descrizioneSezione = (sezione: SezionePagina): DescrizioneSezione =>
  SEZIONI.find(s => s.sezione === sezione) ?? SEZIONI[0];

export const titoloSezione = (sezione: SezionePagina): string => descrizioneSezione(sezione).titolo;

export const eSezioneMenu = (elemento: unknown): elemento is MenuSezione =>
  typeof elemento === 'object' && elemento !== null && 'sezione' in elemento;

const normalizza = (testo: string) => testo.trim().toLowerCase();

/** Un gruppo che si chiama come una sezione non ripete l'intestazione: farebbe da doppione. */
const TITOLI_SEZIONE = new Set(SEZIONI.map(s => normalizza(s.titolo)));

type Collocata = { sezione: SezionePagina; gruppo: number; voce: MenuItem };

/**
 * Divide una voce fra le sezioni delle pagine che apre. Una voce con sottovoci compare in ogni
 * sezione delle sue sottovoci, con le sole sottovoci di quella sezione; il suo indirizzo resta
 * solo nella sezione della sua pagina. Una voce o sottovoce senza pagina nel catalogo sparisce.
 *
 * Una voce con l'area scelta dall'amministratore (`area`) sta tutta in quell'area, sottovoci
 * comprese: l'area del catalogo vale solo per le voci senza un'area scelta.
 */
const collocaVoce = (
  voce: MenuItem,
  sezioneDi: (percorso: string) => SezionePagina | undefined
): Array<{ sezione: SezionePagina; voce: MenuItem }> => {
  const propria = voce.pathname ? sezioneDi(voce.pathname) : undefined;
  const sottovoci = Array.isArray(voce.subMenu) ? voce.subMenu : [];

  if (eSezionePagina(voce.area)) {
    const conPagina = sottovoci.filter(sottovoce => !!sottovoce.pathname && sezioneDi(sottovoce.pathname) !== undefined);
    if (propria) return [{ sezione: voce.area, voce: { ...voce, subMenu: conPagina } }];
    if (conPagina.length === 0) return [];
    const { pathname: _senzaPagina, ...gruppo } = voce;
    return [{ sezione: voce.area, voce: { ...gruppo, subMenu: conPagina } }];
  }

  if (sottovoci.length === 0) {
    return propria ? [{ sezione: propria, voce: { ...voce, subMenu: [] } }] : [];
  }

  const perSezione = new Map<SezionePagina, MenuItem[]>();
  for (const sottovoce of sottovoci) {
    const sezione = sottovoce.pathname ? sezioneDi(sottovoce.pathname) : undefined;
    if (!sezione) continue;
    perSezione.set(sezione, [...(perSezione.get(sezione) ?? []), sottovoce]);
  }
  if (propria && !perSezione.has(propria)) perSezione.set(propria, []);

  const { pathname: _percorso, ...senzaPercorso } = voce;
  return [...perSezione.entries()].map(([sezione, figli]) => ({
    sezione,
    voce: sezione === propria ? { ...voce, subMenu: figli } : { ...senzaPercorso, subMenu: figli },
  }));
};

/**
 * Raggruppa un menu nelle sezioni di primo livello, nell'ordine di SEZIONI. La sezione di una voce
 * è l'area scelta dall'amministratore (`area`), se c'è; altrimenti quella della pagina che apre
 * (`sezioneDi`), non del gruppo in cui l'amministratore l'ha messa. La stessa pagina può comparire
 * in più sezioni. Un gruppo con voci di sezioni diverse compare, col suo titolo, in ciascuna di
 * quelle sezioni con le sole voci che le appartengono. Dentro una sezione voci e gruppi restano nell'ordine del menu.
 * Sezioni e gruppi senza voci non compaiono; un gruppo che si chiama come una sezione non ripete
 * l'intestazione; una voce senza pagina nel catalogo non compare.
 */
export const sezionaMenu = (
  menu: readonly MenuElement[],
  sezioneDi: (percorso: string) => SezionePagina | undefined
): MenuElement[] => {
  const titoliGruppi: Array<string | null> = [null];
  const collocate: Collocata[] = [];

  for (const elemento of menu) {
    if (eSezioneMenu(elemento)) continue;
    if (typeof elemento === 'string') {
      titoliGruppi.push(elemento);
      continue;
    }
    const gruppo = titoliGruppi.length - 1;
    for (const { sezione, voce } of collocaVoce(elemento, sezioneDi)) collocate.push({ sezione, gruppo, voce });
  }

  const risultato: MenuElement[] = [];
  for (const { sezione, titolo } of SEZIONI) {
    const voci = collocate.filter(c => c.sezione === sezione);
    if (voci.length === 0) continue;
    risultato.push({ sezione, title: titolo });
    let gruppoCorrente: number | undefined;
    for (const { gruppo, voce } of voci) {
      if (gruppo !== gruppoCorrente) {
        gruppoCorrente = gruppo;
        const titoloGruppo = titoliGruppi[gruppo];
        if (titoloGruppo && !TITOLI_SEZIONE.has(normalizza(titoloGruppo))) risultato.push(titoloGruppo);
      }
      risultato.push(voce);
    }
  }
  return risultato;
};
