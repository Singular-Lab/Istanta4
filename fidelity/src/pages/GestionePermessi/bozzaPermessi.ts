import { AREE, CodicePermesso, DefinizioneArea, voceDi } from '../../../lib/accessi/catalogo';

/**
 * Logica delle modifiche in sospeso nella gestione accessi, senza React.
 *
 * La configurazione arriva dal server (GET /permessi/configurazione); la bozza
 * tiene solo ciò che l'amministratore ha cambiato: codice → true/false, oppure
 * null per "torna a ereditare" (solo negli ambiti che ereditano). Una modifica
 * riportata al valore iniziale sparisce dalla bozza.
 */

export type StatoPermessoServer = {
  codice: CodicePermesso;
  abilitato: boolean;
  impostato: boolean;
  ereditato: boolean;
  efficace: boolean;
};

export type ConfigurazioneServer = {
  ambito: { tipo: string; idRuoloGdo?: string | null; idGdo?: string | null };
  eredita: boolean;
  permessi: StatoPermessoServer[];
};

export type Bozza = Readonly<Record<string, boolean | null>>;

export type ValoreVisto = { abilitato: boolean; impostato: boolean; inSospeso: boolean };

export type Differenza = {
  codice: CodicePermesso;
  nome: string;
  area: string;
  prima: boolean;
  dopo: boolean;
  /** true se il permesso torna a ereditare dal livello sopra. */
  eredita: boolean;
};

const indicizza = (config: ConfigurazioneServer) => {
  const mappa: Record<string, StatoPermessoServer> = {};
  for (const p of config.permessi) mappa[p.codice] = p;
  return mappa;
};

const valoreDa = (stato: StatoPermessoServer, inBozza: boolean | null | undefined) => {
  if (inBozza === undefined) return { abilitato: stato.abilitato, impostato: stato.impostato };
  if (inBozza === null) return { abilitato: stato.ereditato, impostato: false };
  return { abilitato: inBozza, impostato: true };
};

/** Valore mostrato per un permesso, tenendo conto della bozza. */
export const valoreVisto = (config: ConfigurazioneServer, bozza: Bozza, codice: string): ValoreVisto => {
  const stato = indicizza(config)[codice];
  if (!stato) return { abilitato: false, impostato: false, inSospeso: false };
  const v = valoreDa(stato, bozza[codice]);
  return { ...v, inSospeso: codice in bozza };
};

/** Toglie dalla bozza le voci tornate uguali al valore iniziale. */
const ripulisci = (config: ConfigurazioneServer, bozza: Record<string, boolean | null>): Bozza => {
  const stati = indicizza(config);
  const pulita: Record<string, boolean | null> = {};
  for (const codice of Object.keys(bozza)) {
    const stato = stati[codice];
    if (!stato) continue;
    const dopo = valoreDa(stato, bozza[codice]);
    const uguale = config.eredita
      ? dopo.abilitato === stato.abilitato && dopo.impostato === stato.impostato
      : dopo.abilitato === stato.abilitato;
    if (!uguale) pulita[codice] = bozza[codice];
  }
  return pulita;
};

const codiciDiArea = (area: DefinizioneArea): CodicePermesso[] => [
  ...(area.accesso ? [area.accesso.codice] : []),
  ...area.azioni.map(a => a.codice),
];

/** Azioni dell'area abilitate (con la bozza) quando si vuole togliere l'accesso. */
export const azioniCheSiSpengono = (config: ConfigurazioneServer, bozza: Bozza, codiceAccesso: string): CodicePermesso[] => {
  const voce = voceDi(codiceAccesso);
  if (!voce || !voce.accesso) return [];
  return voce.area.azioni
    .map(a => a.codice)
    .filter(c => valoreVisto(config, bozza, c).abilitato);
};

/**
 * Accende o spegne un permesso rispettando le regole d'area:
 * - accendere un'azione accende anche l'accesso alla sua area;
 * - spegnere l'accesso spegne anche le azioni dell'area.
 */
export const impostaPermesso = (config: ConfigurazioneServer, bozza: Bozza, codice: CodicePermesso, abilitato: boolean): Bozza => {
  const voce = voceDi(codice);
  if (!voce || voce.sistema) return bozza;
  const prossima: Record<string, boolean | null> = { ...bozza, [codice]: abilitato };
  if (abilitato && !voce.accesso && voce.area.accesso) {
    if (!valoreVisto(config, bozza, voce.area.accesso.codice).abilitato) prossima[voce.area.accesso.codice] = true;
  }
  if (!abilitato && voce.accesso) {
    for (const azione of azioniCheSiSpengono(config, bozza, codice)) prossima[azione] = false;
  }
  return ripulisci(config, prossima);
};

/** Accende o spegne tutta l'area (accesso compreso). */
export const impostaArea = (config: ConfigurazioneServer, bozza: Bozza, area: DefinizioneArea, abilitato: boolean): Bozza => {
  if (area.sistema) return bozza;
  const prossima: Record<string, boolean | null> = { ...bozza };
  for (const codice of codiciDiArea(area)) prossima[codice] = abilitato;
  return ripulisci(config, prossima);
};

/** Riporta un permesso al valore ereditato (solo negli ambiti che ereditano). */
export const ripristinaEreditato = (config: ConfigurazioneServer, bozza: Bozza, codice: CodicePermesso): Bozza => {
  if (!config.eredita) return bozza;
  return ripulisci(config, { ...bozza, [codice]: null });
};

export type StatoArea = 'tutti' | 'nessuno' | 'misto';

export const statoArea = (config: ConfigurazioneServer, bozza: Bozza, area: DefinizioneArea): { stato: StatoArea; abilitati: number; totale: number } => {
  const codici = codiciDiArea(area);
  const abilitati = codici.filter(c => valoreVisto(config, bozza, c).abilitato).length;
  const stato: StatoArea = abilitati === 0 ? 'nessuno' : abilitati === codici.length ? 'tutti' : 'misto';
  return { stato, abilitati, totale: codici.length };
};

/** Elenco leggibile delle modifiche, nell'ordine del catalogo. */
export const differenze = (config: ConfigurazioneServer, bozza: Bozza): Differenza[] => {
  const stati = indicizza(config);
  const elenco: Differenza[] = [];
  for (const area of AREE) {
    for (const codice of codiciDiArea(area)) {
      if (!(codice in bozza) || !stati[codice]) continue;
      const voce = voceDi(codice)!;
      const dopo = valoreDa(stati[codice], bozza[codice]);
      elenco.push({
        codice,
        nome: voce.nome,
        area: area.nome,
        prima: stati[codice].abilitato,
        dopo: dopo.abilitato,
        eredita: bozza[codice] === null,
      });
    }
  }
  return elenco;
};

export const modificheDaInviare = (bozza: Bozza): Array<{ codice: string; abilitato: boolean | null }> =>
  Object.keys(bozza).map(codice => ({ codice, abilitato: bozza[codice] }));

export type FiltroPermessi = 'tutti' | 'abilitati' | 'disabilitati' | 'modificati';

/** Decide se un permesso passa ricerca e filtro. "Modificati": personalizzati in questo ambito o con modifiche in sospeso. */
export const passaFiltro = (
  config: ConfigurazioneServer,
  bozza: Bozza,
  codice: CodicePermesso,
  filtro: FiltroPermessi,
  ricerca: string
): boolean => {
  const voce = voceDi(codice);
  if (!voce) return false;
  const q = ricerca.trim().toLowerCase();
  if (q) {
    const testo = `${voce.nome} ${voce.descrizione} ${voce.codice} ${voce.area.nome}`.toLowerCase();
    if (testo.indexOf(q) < 0) return false;
  }
  const visto = valoreVisto(config, bozza, codice);
  switch (filtro) {
    case 'abilitati': return visto.abilitato;
    case 'disabilitati': return !visto.abilitato;
    case 'modificati': return visto.inSospeso || (config.eredita && visto.impostato);
    default: return true;
  }
};
