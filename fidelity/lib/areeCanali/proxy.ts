import { v5 as uuidv5 } from 'uuid';

/**
 * Canali e aree proxy: un canale (o un'area) che raccoglie due o piu' canali (o aree) membri della
 * stessa GDO, per un volantino uguale fra insegne o fra aree. Esempio: il RIL Conad ha un volantino
 * solo per Superstore, Conad e City, disegnato una volta sul proxy SSCNCY.
 *
 * Istanta conosce il proxy come un canale (o un'area) qualsiasi, senza i membri. Quando chiede i kit
 * di un proxy riceve i kit dei membri e il design proxy diviso in pezzi, uno per combinazione membro
 * attiva (SS·LA, CN·LA, CY·LA): ogni pezzo trova le sue liste e diventa una lavorazione, con il suo
 * kit runtime sul canale e l'area del membro.
 *
 * Regole condivise fra server e pagina Aree e canali.
 */

/** Membri minimi perche' un canale o un'area sia un proxy. */
export const MEMBRI_MINIMI_PROXY = 2;

/** Una voce dell'anagrafica: un canale o un'area, con i suoi membri (vuoto se non e' un proxy). */
export interface VoceAnagrafica {
  id: string;
  codice: string;
  nome: string;
  membri: readonly string[];
}

export type TipoVoce = 'canale' | 'area';

export const eProxy = (membri: readonly string[] | null | undefined): boolean =>
  (membri?.length ?? 0) >= MEMBRI_MINIMI_PROXY;

/** Proxy noti, per id: l'elenco dei membri. */
export interface ProxyNoti {
  canali: ReadonlyMap<string, readonly string[]>;
  aree: ReadonlyMap<string, readonly string[]>;
}

export const NESSUN_PROXY: ProxyNoti = { canali: new Map(), aree: new Map() };

/** I proxy fra i canali e le aree dell'anagrafica. */
export const proxyDaVoci = (canali: readonly VoceAnagrafica[], aree: readonly VoceAnagrafica[]): ProxyNoti => ({
  canali: new Map(canali.filter(v => eProxy(v.membri)).map(v => [v.id, v.membri])),
  aree: new Map(aree.filter(v => eProxy(v.membri)).map(v => [v.id, v.membri])),
});

/**
 * Le voci di una richiesta di Istanta: un proxy vale per se' e per tutti i suoi membri, una voce
 * normale (anche se membro di un proxy) solo per se'.
 */
export const vociRichieste = (id: string, proxy: ReadonlyMap<string, readonly string[]>): string[] =>
  [id, ...(proxy.get(id) ?? []).filter(m => m !== id)];

/** Le voci che un canale o un'area copre: i membri per un proxy, la voce stessa altrimenti. */
const coperte = (id: string, proxy: ReadonlyMap<string, readonly string[]>): readonly string[] => {
  const membri = proxy.get(id);
  return membri && membri.length > 0 ? membri : [id];
};

/** Le coppie canale·area di una combinazione: per un proxy quelle dei suoi membri, nell'ordine dei membri. */
export function coppieMembro(idCanale: string, idArea: string, proxy: ProxyNoti): Array<[string, string]> {
  const coppie: Array<[string, string]> = [];
  for (const canale of coperte(idCanale, proxy.canali)) {
    for (const area of coperte(idArea, proxy.aree)) coppie.push([canale, area]);
  }
  return coppie;
}

export const chiaveCoppia = (idCanale: string | null | undefined, idArea: string | null | undefined): string =>
  `${idCanale ?? ''}|${idArea ?? ''}`;

/** Il kit (o la combinazione) usa un canale o un'area proxy? */
export const eSuProxy = (kit: { guidCanale?: string | null; guidArea?: string | null }, proxy: ProxyNoti): boolean =>
  proxy.canali.has(kit.guidCanale ?? '') || proxy.aree.has(kit.guidArea ?? '');

// Spazio dei nomi degli id dei pezzi: non cambiarlo, Istanta conserva gli id che ha ricevuto
const SPAZIO_ID_PEZZI = 'c5114a0c-eddf-4a05-9e30-f233f95e2527';

/** L'id di un pezzo: sempre lo stesso per design, canale e area, diverso da ogni altro id. */
export const idPezzo = (idDesign: string, idCanale: string, idArea: string): string =>
  uuidv5(`${idDesign}|${idCanale}|${idArea}`, SPAZIO_ID_PEZZI);

/** Un pezzo di un design proxy, come lo riceve Istanta. */
export type Pezzo<T> = Omit<T, 'guidId' | 'guidCanale' | 'guidArea'> & {
  guidId: string;
  guidIdDesign: string;
  guidCanale: string;
  guidArea: string;
  pezzo: true;
};

/**
 * Il design come lo vede Istanta: un design normale resta com'e'; un design su un canale o un'area
 * proxy si divide in un pezzo per coppia membro che e' fra le combinazioni attive (`attive`, chiavi di
 * `chiaveCoppia`). Nomi e codici del canale e dell'area del pezzo li aggiunge chi chiama.
 */
export function pezziDelDesign<T extends { guidId: string; guidCanale?: string | null; guidArea?: string | null }>(
  design: T,
  proxy: ProxyNoti,
  attive: ReadonlySet<string>
): Array<T | Pezzo<T>> {
  if (!eSuProxy(design, proxy)) return [design];
  return coppieMembro(design.guidCanale ?? '', design.guidArea ?? '', proxy)
    .filter(([canale, area]) => attive.has(chiaveCoppia(canale, area)))
    .map(([canale, area]) => ({
      ...design,
      guidId: idPezzo(design.guidId, canale, area),
      guidIdDesign: design.guidId,
      guidCanale: canale,
      guidArea: area,
      pezzo: true as const,
    }));
}

/** Le coppie membro di una combinazione proxy, con la combinazione dell'anagrafica se esiste. */
export function pezziDellaCombinazione<C extends { id_canale: string; id_area: string; stato: string }>(
  combinazione: { id_canale: string; id_area: string },
  proxy: ProxyNoti,
  combinazioni: readonly C[]
): Array<{ idCanale: string; idArea: string; combinazione?: C; attiva: boolean }> {
  const perCoppia = new Map(combinazioni.map(c => [chiaveCoppia(c.id_canale, c.id_area), c]));
  return coppieMembro(combinazione.id_canale, combinazione.id_area, proxy).map(([idCanale, idArea]) => {
    const trovata = perCoppia.get(chiaveCoppia(idCanale, idArea));
    return { idCanale, idArea, combinazione: trovata, attiva: trovata?.stato === 'ATTIVO' };
  });
}

export interface KitConfrontabile {
  guidId: string;
  titolo?: string | null;
  guidIdRaccoglitore?: string | null;
  guidFormato?: string | null;
  guidCanale?: string | null;
  guidArea?: string | null;
  /** Pezzo di un design proxy, o kit runtime nato da un pezzo. */
  pezzo?: boolean;
}

/**
 * Coppie di kit che Istanta unirebbe: Istanta tiene una lavorazione per promo, raccoglitore,
 * canale, area e formato. Un pezzo di un kit proxy e un kit della stessa combinazione, nello stesso
 * raccoglitore e formato, finirebbero sulla stessa lavorazione. Conta solo se almeno uno dei due e'
 * un pezzo: i doppioni fra kit normali non sono materia dei proxy.
 */
export function kitConfusiDaIstanta<T extends KitConfrontabile>(kit: readonly T[]): Array<[T, T]> {
  const chiave = (k: T) => [k.guidIdRaccoglitore, k.guidFormato, k.guidCanale, k.guidArea].join('|');
  const coppie: Array<[T, T]> = [];
  for (let i = 0; i < kit.length; i++) {
    for (let j = i + 1; j < kit.length; j++) {
      const a = kit[i];
      const b = kit[j];
      if (a.guidId === b.guidId || !(a.pezzo || b.pezzo)) continue;
      if (chiave(a) === chiave(b)) coppie.push([a, b]);
    }
  }
  return coppie;
}

/** Un design proxy non si avvia intero: si avvia un suo pezzo, dal plugin di produzione. */
export const MESSAGGIO_AVVIO_PROXY =
  'Un kit proxy si avvia dal plugin di produzione, un pezzo per canale e area: chiedi i kit del canale o '
  + "dell'area proxy e avvia uno dei pezzi.";

/** Messaggio per chi avvia la lavorazione: quali kit Istanta unirebbe e cosa fare. */
export function messaggioKitConfusi(coppie: ReadonlyArray<[KitConfrontabile, KitConfrontabile]>): string {
  const nome = (k: KitConfrontabile) => `"${k.titolo || k.guidId}"`;
  const elenco = coppie.map(([a, b]) => `${nome(a)} e ${nome(b)}`).join('; ');
  return `Istanta unirebbe in una sola lavorazione ${elenco}: hanno lo stesso raccoglitore, formato, canale e area, `
    + "e uno dei due è il pezzo di un kit proxy. Lascia nella promo uno solo dei due kit.";
}

const normalizza = (codice: string) => codice.trim().toLowerCase();

const daVoce = (tipo: TipoVoce) => (tipo === 'canale' ? 'dal canale' : "dall'area");

/**
 * Problemi di un salvataggio dall'anagrafica, in italiano; vuoto se si puo' salvare.
 * `voci` sono i canali (o le aree) della stessa GDO, `esistente` la voce prima della modifica.
 */
export function problemiVoce(
  tipo: TipoVoce,
  voce: { id: string; codice: string; membri: readonly string[] },
  voci: readonly VoceAnagrafica[],
  esistente?: VoceAnagrafica | null
): string[] {
  const problemi: string[] = [];
  const codice = normalizza(voce.codice);
  const codiceCambiato = !esistente || normalizza(esistente.codice) !== codice;
  if (codiceCambiato) {
    const doppione = voci.find(v => v.id !== voce.id && normalizza(v.codice) === codice);
    if (doppione) problemi.push(`Il codice ${voce.codice.trim()} è già usato ${daVoce(tipo)} ${doppione.nome}.`);
  }

  if (esistente && eProxy(esistente.membri) !== eProxy(voce.membri)) {
    problemi.push(eProxy(esistente.membri)
      ? 'Un proxy resta un proxy: per tornare a una voce normale eliminalo e creane una nuova.'
      : 'Una voce esistente non diventa un proxy: crea un proxy nuovo.');
  }
  if (voce.membri.length === 0) return problemi;

  if (voce.membri.length < MEMBRI_MINIMI_PROXY) problemi.push(`Un proxy ha almeno ${MEMBRI_MINIMI_PROXY} membri.`);
  if (new Set(voce.membri).size !== voce.membri.length) problemi.push('Un membro non può comparire due volte.');
  if (voce.membri.includes(voce.id)) problemi.push('Un proxy non può essere membro di sé stesso.');
  const perId = new Map(voci.map(v => [v.id, v]));
  for (const id of new Set(voce.membri)) {
    if (id === voce.id) continue;
    const membro = perId.get(id);
    if (!membro) problemi.push(`Un membro non è fra ${tipo === 'canale' ? 'i canali' : 'le aree'} della GDO.`);
    else if (eProxy(membro.membri)) problemi.push(`${membro.nome} è a sua volta un proxy: non può essere membro.`);
  }
  return problemi;
}

/** I membri inviati con un salvataggio: solo stringhe non vuote, nell'ordine dato; altro = nessun membro. */
export const membriDaRichiesta = (valore: unknown): string[] =>
  Array.isArray(valore) ? valore.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim()) : [];

/** Una voce dell'anagrafica da un DTO del server (membri assenti = nessuno). */
export const voceDa = (v: { id: string; codice: string; nome: string; membri?: readonly string[] | null }): VoceAnagrafica =>
  ({ id: v.id, codice: v.codice ?? '', nome: v.nome ?? '', membri: v.membri ?? [] });

/** I proxy di cui la voce e' membro: finche' ce ne sono, la voce non si elimina. */
export const proxyCheContengono = (id: string, voci: readonly VoceAnagrafica[]): VoceAnagrafica[] =>
  voci.filter(v => v.id !== id && eProxy(v.membri) && v.membri.includes(id));

/** Codici usati da piu' voci della stessa GDO (normalizzati), per l'avviso in pagina. */
export function codiciDoppi(voci: readonly Pick<VoceAnagrafica, 'codice'>[]): Set<string> {
  const conteggio = new Map<string, number>();
  for (const v of voci) {
    const c = normalizza(v.codice);
    conteggio.set(c, (conteggio.get(c) ?? 0) + 1);
  }
  return new Set([...conteggio].filter(([, n]) => n > 1).map(([c]) => c));
}

export const codiceDoppio = (codice: string, doppi: ReadonlySet<string>): boolean => doppi.has(normalizza(codice));
