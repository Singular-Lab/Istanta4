import { TIPO_UTENTI } from '../../../lib/enums';
import {
  applicaRegoleArea,
  CodicePermesso,
  ePermessoDiSistema,
  TUTTI_I_PERMESSI,
} from '../../../lib/accessi/catalogo';
import { puoAprirePagina } from '../../../lib/accessi/pagine';
import { PermessiRepository } from '../repositories/PermessiRepository';
import type { ContestoAccesso } from './contestoAccesso';
import { leggiVersionePermessi } from './versionePermessi';

/** Ruolo di cui calcolare i permessi: tipo, sotto-ruolo GDO ed eventuale GDO degli override. */
export type ChiaveRuolo = {
  tipo: TIPO_UTENTI;
  idRuoloGdo?: string | null;
  idGdo?: string | null;
};

/** Valori registrati per ciascun livello: codice → abilitato. Un codice assente eredita. */
export type LivelliRuolo = {
  tipo: Map<string, boolean>;
  sottoRuolo: Map<string, boolean>;
  gdo: Map<string, boolean>;
  gdoSottoRuolo: Map<string, boolean>;
};

type FontePermessi = Pick<PermessiRepository, 'findPermessiPerRuolo' | 'findPermessiOverrideGdo'>;

const TUTTI_I_CODICI = TUTTI_I_PERMESSI.map(p => p.codice);

const mappaDa = (righe: Array<{ codice?: string; abilitato: boolean }>): Map<string, boolean> => {
  const mappa = new Map<string, boolean>();
  for (const riga of righe) {
    if (riga.codice) mappa.set(riga.codice, !!riga.abilitato);
  }
  return mappa;
};

/**
 * Combina i livelli dal meno al più specifico (tipo → sotto-ruolo → GDO → GDO e
 * sotto-ruolo) e applica le regole del catalogo: niente permessi di sistema,
 * niente azioni senza l'accesso alla loro area, niente codici sconosciuti.
 */
export const combinaLivelli = (livelli: LivelliRuolo): CodicePermesso[] => {
  const valori = new Map<string, boolean>();
  for (const livello of [livelli.tipo, livelli.sottoRuolo, livelli.gdo, livelli.gdoSottoRuolo]) {
    livello.forEach((abilitato, codice) => valori.set(codice, abilitato));
  }
  const abilitati: string[] = [];
  valori.forEach((abilitato, codice) => {
    if (abilitato && !ePermessoDiSistema(codice)) abilitati.push(codice);
  });
  return applicaRegoleArea(abilitati);
};

/**
 * Unico punto che decide i permessi effettivi. Lo usano permissionGuard, il
 * controllo delle pagine, il menu e /permessi/effettivi, così non possono
 * divergere. Il Superadmin ha tutti i permessi, compresi quelli di sistema.
 */
export class RisolutoreAccessi {
  private static istanza: RisolutoreAccessi | null = null;
  private cache = new Map<string, { versione: number; permessi: Set<CodicePermesso> }>();

  constructor(
    private readonly fonte: FontePermessi = new PermessiRepository(),
    private readonly versione: () => Promise<number> = leggiVersionePermessi
  ) { }

  static get(): RisolutoreAccessi {
    if (!RisolutoreAccessi.istanza) RisolutoreAccessi.istanza = new RisolutoreAccessi();
    return RisolutoreAccessi.istanza;
  }

  /** Solo per i test. */
  static imposta(istanza: RisolutoreAccessi | null): void {
    RisolutoreAccessi.istanza = istanza;
  }

  async leggiLivelli(chiave: ChiaveRuolo): Promise<LivelliRuolo> {
    const { tipo } = chiave;
    const idRuoloGdo = chiave.idRuoloGdo || undefined;
    const idGdo = chiave.idGdo || undefined;
    const [base, sottoRuolo, gdo, gdoSottoRuolo] = await Promise.all([
      this.fonte.findPermessiPerRuolo(tipo),
      idRuoloGdo ? this.fonte.findPermessiPerRuolo(tipo, idRuoloGdo) : Promise.resolve([]),
      idGdo ? this.fonte.findPermessiOverrideGdo(idGdo, tipo) : Promise.resolve([]),
      idGdo && idRuoloGdo ? this.fonte.findPermessiOverrideGdo(idGdo, tipo, idRuoloGdo) : Promise.resolve([]),
    ]);
    return {
      tipo: mappaDa(base),
      sottoRuolo: mappaDa(sottoRuolo),
      gdo: mappaDa(gdo),
      gdoSottoRuolo: mappaDa(gdoSottoRuolo),
    };
  }

  async permessiDelRuolo(chiave: ChiaveRuolo): Promise<Set<CodicePermesso>> {
    if (chiave.tipo === TIPO_UTENTI.SUPERADMIN) return new Set(TUTTI_I_CODICI);

    const versione = await this.versione();
    const chiaveCache = `${chiave.tipo}|${chiave.idRuoloGdo || ''}|${chiave.idGdo || ''}`;
    const inCache = this.cache.get(chiaveCache);
    if (inCache && inCache.versione === versione) return inCache.permessi;

    const permessi = new Set(combinaLivelli(await this.leggiLivelli(chiave)));
    // Una versione nuova rende inutili tutte le voci precedenti.
    if (inCache && inCache.versione !== versione) this.cache.clear();
    this.cache.set(chiaveCache, { versione, permessi });
    return permessi;
  }

  async permessiDi(contesto: ContestoAccesso): Promise<Set<CodicePermesso>> {
    return this.permessiDelRuolo({ tipo: contesto.tipo, idRuoloGdo: contesto.idRuoloGdo, idGdo: contesto.idGdo });
  }

  async puo(contesto: ContestoAccesso, codice: CodicePermesso): Promise<boolean> {
    if (contesto.superadmin) return true;
    return (await this.permessiDi(contesto)).has(codice);
  }

  async puoAprire(contesto: ContestoAccesso, percorso: string): Promise<boolean> {
    if (contesto.superadmin) return true;
    const permessi = await this.permessiDi(contesto);
    return puoAprirePagina(percorso, codice => permessi.has(codice));
  }

  svuotaCache(): void {
    this.cache.clear();
  }
}
