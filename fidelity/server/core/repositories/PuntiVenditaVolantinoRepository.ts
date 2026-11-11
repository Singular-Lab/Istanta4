import { QueryTypes, type Transaction } from 'sequelize';
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from '../../../lib/enums';
import type { TipoAbbinamento, VolantinoNellaStoria } from '../../../lib/puntiVendita/storia';
import { sequelize } from '../db';
import { AbbinamentoManualePvVolantino } from '../models/punto_vendita/abbinamenti_manuali_pv_volantino';
import { PuntoVenditaVolantino, type PuntoVenditaVolantinoAttributes } from '../models/punto_vendita/punti_vendita_volantino';
import type { PuntoVenditaAnagrafica } from '../utils/abbinamentoPuntiVendita';
import type { RegolaCollegamento } from '../utils/chiaviRigheVolantino';
import { chiaveCombinazione } from '../utils/confrontoPuntiVendita';
import type { ApparizioneStoria, VolantinoSenzaPuntoVendita } from '../utils/storiaPuntoVendita';

/**
 * Letture e scritture della tabella punti_vendita_volantino (i PV stampati nelle liste dei
 * volantini), in SQL come le viste Volantini e POP: ogni valore passa dalle sostituzioni.
 *
 * Nella storia di un PV contano solo i kit non eliminati di promo non eliminate. La data di un
 * volantino e' il giorno d'inizio della promo nel calendario italiano (o, se manca, la fine o la
 * creazione del kit).
 */

/** Il kit a cui appartiene una lista, con la GDO della sua combinazione canale/area. */
export interface KitVolantino {
  id: string;
  titolo: string;
  statoLavorazione: string;
  idPromo: string;
  nomePromo: string | null;
  idCanale: string;
  idArea: string;
  /** Dalla combinazione canale/area del kit, o dal canale; null se non si trova. */
  idGdo: string | null;
}

export type NuovaRigaVolantino = Omit<PuntoVenditaVolantinoAttributes, 'id' | 'createdat' | 'id_punto_vendita' | 'abbinamento'>;

export interface RigaDaRiabbinare {
  id: string;
  /** Il testo stampato: chiave di una riga senza telefono ne' indirizzo. */
  riga: string;
  localita: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  id_punto_vendita: string | null;
  abbinamento: TipoAbbinamento | null;
  /** Canale e area del kit: un collegamento fatto a mano vale solo per la combinazione del suo PV. */
  id_canale: string | null;
  id_area: string | null;
}

export interface CambioAbbinamento {
  id: string;
  idPuntoVendita: string | null;
  abbinamento: TipoAbbinamento | null;
}

export interface PuntoVenditaDellaStoria extends PuntoVenditaAnagrafica {
  idGdo: string;
  nome?: string;
  /** La combinazione canale/area del PV, con i nomi: si collega solo a righe dei suoi volantini. */
  idCanale?: string | null;
  nomeCanale?: string | null;
  idArea?: string | null;
  nomeArea?: string | null;
}

/** Un collegamento fatto a mano (abbinamenti_manuali_pv_volantino), con il nome del suo PV. */
export interface CollegamentoSalvato extends RegolaCollegamento {
  idGdo: string;
  riga: string;
  puntoVendita: { id: string; nome: string; indirizzo: string | null; citta: string | null };
  creatoIl: string;
}

export interface NuovoCollegamento {
  idGdo: string;
  idPuntoVendita: string;
  chiavi: readonly string[];
  riga: string;
  creatoDa: string | null;
}

/** Una riga collegata a mano: per contarla sotto il suo collegamento o per scollegarla. */
export interface RigaCollegataAMano {
  id: string;
  idPuntoVendita: string;
  riga: string;
  localita: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
  /** "<idCanale>|<idArea>" del kit della riga, null se ne manca uno. */
  combinazione: string | null;
}

/** Una riga collegata a un PV, a mano o automaticamente: per cambiarne il collegamento. */
export interface RigaDelPuntoVendita extends RigaCollegataAMano {
  idCanale: string | null;
  idArea: string | null;
  abbinamento: TipoAbbinamento | null;
}

/** Il cambio di collegamento, in una transazione: il collegamento fatto a mano e le righe. */
export interface CambioCollegamento {
  /** Il collegamento da aggiornare; null per crearne uno nuovo. */
  idCollegamento: string | null;
  /** Collegamenti dello stesso gruppo assorbiti da quello aggiornato. */
  daEliminare: readonly string[];
  idGdo: string;
  idPuntoVendita: string;
  chiavi: readonly string[];
  riga: string;
  creatoDa: string | null;
  cambi: readonly CambioAbbinamento[];
}

/** I nomi dei canali e delle aree della GDO, per i messaggi. */
export interface NomiCanaliAree {
  canali: ReadonlyMap<string, string>;
  aree: ReadonlyMap<string, string>;
}

export interface IPuntiVenditaVolantinoRepository {
  trovaKit(idKit: string): Promise<KitVolantino | null>;
  /** Toglie le righe del kit e scrive quelle nuove, in una transazione. */
  sostituisciRigheKit(idKit: string, righe: readonly NuovaRigaVolantino[]): Promise<void>;
  contaRigheKit(idKit: string): Promise<{ righe: number; abbinate: number }>;
  puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaAnagrafica[]>;
  /**
   * Righe della GDO senza PV; con soloKit, solo quelle di quei kit. Le righe collegate a un PV non si
   * riabbinano mai: perdono il collegamento solo se il PV si elimina (ON DELETE SET NULL).
   */
  righeDaRiabbinare(idGdo: string, soloKit?: readonly string[]): Promise<RigaDaRiabbinare[]>;
  aggiornaAbbinamenti(cambi: readonly CambioAbbinamento[]): Promise<void>;
  /** I collegamenti fatti a mano della GDO: le regole che il riabbinamento applica per prime. */
  regoleCollegamento(idGdo: string): Promise<RegolaCollegamento[]>;
  /** Salva un collegamento fatto a mano e ne restituisce l'id. */
  creaCollegamento(collegamento: NuovoCollegamento): Promise<string>;
  /** I collegamenti della GDO, dal piu' recente. */
  paginaCollegamenti(idGdo: string, limite: number, scarto: number): Promise<{ collegamenti: CollegamentoSalvato[]; totale: number }>;
  trovaCollegamento(id: string): Promise<CollegamentoSalvato | null>;
  eliminaCollegamento(id: string): Promise<void>;
  /** Aggiunge al collegamento le chiavi imparate dalle righe che ha collegato, senza doppioni. */
  aggiungiChiaviCollegamento(id: string, chiavi: readonly string[]): Promise<void>;
  /** Le righe della GDO collegate a mano; con idPuntoVendita, solo quelle di quel PV. */
  righeCollegateAMano(idGdo: string, idPuntoVendita?: string): Promise<RigaCollegataAMano[]>;
  /** Tutte le righe della GDO collegate al PV, a mano o automaticamente. */
  righeDelPuntoVendita(idGdo: string, idPuntoVendita: string): Promise<RigaDelPuntoVendita[]>;
  /** Aggiorna (o crea) il collegamento fatto a mano e sposta le righe, tutto o niente; restituisce l'id del collegamento. */
  cambiaCollegamento(cambio: CambioCollegamento): Promise<string>;
  nomiCanaliAree(idGdo: string): Promise<NomiCanaliAree>;
  trovaPuntoVendita(id: string): Promise<PuntoVenditaDellaStoria | null>;
  /** Le apparizioni del PV nei volantini, dalla piu' vecchia. */
  apparizioni(idPuntoVendita: string): Promise<ApparizioneStoria[]>;
  /** Volantini con la lista registrata della stessa insegna e area, dopo la data indicata, in cui il PV non c'e'. */
  volantiniSenzaPuntoVendita(criteri: {
    idPuntoVendita: string;
    idGdo: string;
    idCanale: string;
    idArea: string;
    dopo: string;
  }): Promise<VolantinoSenzaPuntoVendita[]>;
  /** I volantini in cui compare il PV, dal piu' recente, una volta per kit. */
  paginaVolantini(idPuntoVendita: string, limite: number, scarto: number): Promise<{ volantini: VolantinoNellaStoria[]; totale: number }>;
}

type Sostituzioni = Record<string, unknown>;

/** La combinazione del PV come chiave "<idCanale>|<idArea>" (confrontoPuntiVendita.chiaveCombinazione), dall'alias cca. */
const CHIAVE_COMBINAZIONE_PV = `LOWER(cca.id_canale_combinazione_canale_area::text || '|' || cca.id_area_combinazione_canale_area::text)`;

interface RigaCollegataSql {
  id: string;
  id_punto_vendita: string;
  riga: string;
  localita: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  id_canale: string | null;
  id_area: string | null;
  abbinamento: TipoAbbinamento | null;
}

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso della connessione. */
const FUSO_PROMO = 'Europe/Rome';
// Righe per istruzione nelle scritture a blocchi
const BLOCCO = 1000;

/** Sostituzioni dei frammenti qui sotto: le usano anche le letture dell'analisi dei punti vendita. */
export const SOSTITUZIONI_FISSE: Sostituzioni = {
  fuso: FUSO_PROMO,
  kitEliminato: STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO,
  promoEliminata: STATO_PROMO.ELIMINATA,
  codiceVolantino: EXPORT_DI_SISTEMA.VOL,
};

const giorno = (colonna: string) => `to_char(${colonna} AT TIME ZONE :fuso, 'YYYY-MM-DD')`;
export const DATA_EDIZIONE = giorno('COALESCE(p.validita_dal, p.validita_al, k."createdAt")');

/** Kit e promo che contano nella storia: non eliminati. */
export const KIT_VALIDI = `k.stato_lavorazione::text <> :kitEliminato AND p.stato::text <> :promoEliminata`;

const COLONNE_APPARIZIONE = `
  k.id::text AS id_kit, k.titolo AS titolo_kit,
  p.id_promo, p.nome_promo, p.stato::text AS stato_promo,
  ${giorno('p.validita_dal')} AS validita_dal, ${giorno('p.validita_al')} AS validita_al,
  ${DATA_EDIZIONE} AS data_edizione,
  k.id_canale::text AS id_canale, COALESCE(c.nome_canali, k.nome_canale, '') AS nome_canale,
  k.id_area::text AS id_area, COALESCE(a.nome_aree, k.nome_area, '') AS nome_area`;

const DA_KIT = `
  JOIN runtime_kit k ON k.id = r.id_kit_runtime
  JOIN promo p ON p.id_promo = k.id_promo
  LEFT JOIN canali c ON c.id_canali = k.id_canale
  LEFT JOIN aree a ON a.id_aree = k.id_area`;

const COMBINAZIONE_PV = `
  JOIN punti_vendita pv ON pv.id_puntivendita = r.id_punto_vendita
  JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = pv.id_combinazione_canale_area_puntivendita`;
const KIT_COMBINAZIONE_PV = `
  k.id_canale = cca.id_canale_combinazione_canale_area
  AND k.id_area = cca.id_area_combinazione_canale_area`;

/** Il PDF del volantino: il primo file dell'export VOL che sta su Olimpo, meglio se PDF (come la copertina dei Volantini). */
export const PDF_VOLANTINO = `
  LEFT JOIN LATERAL (
    SELECT f.id::text AS id, f.id_olimpo_cloud, f.nome, f.pages
    FROM files_runtime f
    WHERE f.id_runtime = k.id
      AND COALESCE(f.id_olimpo_cloud, '') <> ''
      AND (
        COALESCE(f.tipo_export_codice, '') = :codiceVolantino
        OR EXISTS (
          SELECT 1 FROM tipi_export te
          WHERE te.codice_tipiexport = :codiceVolantino AND te.id_tipiexport::text = f.tipo_export
        )
      )
    ORDER BY (COALESCE(f.mime, '') ILIKE '%pdf%') DESC, f.nome, f."createdAt"
    LIMIT 1
  ) vol ON TRUE`;

interface RigaApparizione {
  id_kit: string;
  titolo_kit: string;
  id_promo: string;
  nome_promo: string;
  stato_promo: string;
  validita_dal: string | null;
  validita_al: string | null;
  data_edizione: string;
  id_canale: string;
  nome_canale: string;
  id_area: string;
  nome_area: string;
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  abbinamento: TipoAbbinamento;
}

interface RigaVolantino extends RigaApparizione {
  numero_referenze: number | null;
  pdf_id: string | null;
  pdf_id_olimpo: string | null;
  pdf_nome: string | null;
  pdf_pagine: number | null;
}

const apparizioneDa = (riga: RigaApparizione): ApparizioneStoria => ({
  idKit: riga.id_kit,
  titoloKit: riga.titolo_kit,
  promo: {
    id: riga.id_promo,
    nome: riga.nome_promo,
    stato: riga.stato_promo as STATO_PROMO,
    validitaDal: riga.validita_dal,
    validitaAl: riga.validita_al,
  },
  canale: { id: riga.id_canale, nome: riga.nome_canale },
  area: { id: riga.id_area, nome: riga.nome_area },
  data: riga.data_edizione,
  rigaStampata: riga.riga,
  localita: riga.localita,
  indirizzo: riga.indirizzo,
  telefono: riga.telefono,
  chiaveIndirizzo: riga.chiave_indirizzo,
  chiaveTelefono: riga.chiave_telefono,
  abbinamento: riga.abbinamento,
});

const volantinoDa = (riga: RigaVolantino): VolantinoNellaStoria => {
  const { idKit, titoloKit, promo, canale, area, rigaStampata, localita, indirizzo, telefono, abbinamento } = apparizioneDa(riga);
  return {
    idKit, titoloKit, promo, canale, area, rigaStampata, localita, indirizzo, telefono, abbinamento,
    numeroReferenze: riga.numero_referenze === null ? null : Number(riga.numero_referenze),
    pdf: riga.pdf_id && riga.pdf_id_olimpo
      ? { idFile: riga.pdf_id, idOlimpoCloud: riga.pdf_id_olimpo, nome: riga.pdf_nome ?? '', pagine: riga.pdf_pagine ?? null }
      : null,
  };
};

interface RigaCollegamento {
  id: string;
  id_gdo: string;
  id_punto_vendita: string;
  chiavi: string[] | null;
  riga: string;
  creato_il: Date | string;
  nome: string | null;
  indirizzo: string | null;
  citta: string | null;
  combinazione: string | null;
}

const blocchi = <T>(elenco: readonly T[]): T[][] => {
  const risultato: T[][] = [];
  for (let inizio = 0; inizio < elenco.length; inizio += BLOCCO) risultato.push(elenco.slice(inizio, inizio + BLOCCO));
  return risultato;
};

export class PuntiVenditaVolantinoRepository implements IPuntiVenditaVolantinoRepository {
  private async seleziona<T extends object>(sql: string, sostituzioni: Sostituzioni = {}): Promise<T[]> {
    return sequelize.query<T>(sql, {
      replacements: { ...SOSTITUZIONI_FISSE, ...sostituzioni },
      type: QueryTypes.SELECT,
    });
  }

  async trovaKit(idKit: string): Promise<KitVolantino | null> {
    const [riga] = await this.seleziona<{
      id: string; titolo: string; stato_lavorazione: string; id_promo: string; nome_promo: string | null;
      id_canale: string; id_area: string; id_gdo: string | null;
    }>(
      `SELECT k.id::text AS id, k.titolo, k.stato_lavorazione::text AS stato_lavorazione, k.id_promo, p.nome_promo,
              k.id_canale::text AS id_canale, k.id_area::text AS id_area,
              COALESCE(
                (SELECT cca.id_gdo_combinazione_canale_area::text
                 FROM combinazione_canale_area cca
                 WHERE cca.id_canale_combinazione_canale_area = k.id_canale
                   AND cca.id_area_combinazione_canale_area = k.id_area
                 LIMIT 1),
                c.id_gdo_canali::text
              ) AS id_gdo
       FROM runtime_kit k
       LEFT JOIN promo p ON p.id_promo = k.id_promo
       LEFT JOIN canali c ON c.id_canali = k.id_canale
       WHERE k.id = :idKit`,
      { idKit }
    );
    if (!riga) return null;
    return {
      id: riga.id,
      titolo: riga.titolo,
      statoLavorazione: riga.stato_lavorazione,
      idPromo: riga.id_promo,
      nomePromo: riga.nome_promo,
      idCanale: riga.id_canale,
      idArea: riga.id_area,
      idGdo: riga.id_gdo,
    };
  }

  async sostituisciRigheKit(idKit: string, righe: readonly NuovaRigaVolantino[]): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await PuntoVenditaVolantino.destroy({ where: { id_kit_runtime: idKit }, transaction });
      for (const blocco of blocchi(righe)) {
        await PuntoVenditaVolantino.bulkCreate(blocco.map(riga => ({ ...riga })), { transaction });
      }
    });
  }

  async contaRigheKit(idKit: string): Promise<{ righe: number; abbinate: number }> {
    const [riga] = await this.seleziona<{ righe: number; abbinate: number }>(
      `SELECT COUNT(*)::int AS righe, COUNT(id_punto_vendita)::int AS abbinate
       FROM punti_vendita_volantino
       WHERE id_kit_runtime = :idKit`,
      { idKit }
    );
    return { righe: Number(riga?.righe ?? 0), abbinate: Number(riga?.abbinate ?? 0) };
  }

  async puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaAnagrafica[]> {
    return this.seleziona<PuntoVenditaAnagrafica>(
      `SELECT id_puntivendita::text AS id, citta_puntivendita AS citta,
              indirizzo_puntivendita AS indirizzo, telefono_puntivendita AS telefono
       FROM punti_vendita
       WHERE id_gdo_puntivendita = :idGdo`,
      { idGdo }
    );
  }

  async righeDaRiabbinare(idGdo: string, soloKit?: readonly string[]): Promise<RigaDaRiabbinare[]> {
    if (soloKit && soloKit.length === 0) return [];
    const deiKit = soloKit ? 'AND r.id_kit_runtime IN (:soloKit)' : '';
    // Dall'indice parziale delle righe senza PV della GDO. Il tipo di abbinamento di una riga il cui
    // PV è stato eliminato (la chiave esterna azzera solo id_punto_vendita) non vale più: niente PV, niente abbinamento.
    return this.seleziona<RigaDaRiabbinare>(
      `SELECT r.id::text AS id, r.riga, r.localita, r.chiave_indirizzo, r.chiave_telefono,
              r.id_punto_vendita::text AS id_punto_vendita, NULL::text AS abbinamento,
              r.id_canale::text AS id_canale, r.id_area::text AS id_area
       FROM punti_vendita_volantino r
       WHERE r.id_gdo = :idGdo AND r.id_punto_vendita IS NULL
         ${deiKit}
       ORDER BY r.id_kit_runtime, r.posizione`,
      { idGdo, soloKit: [...(soloKit ?? [])] }
    );
  }

  async aggiornaAbbinamenti(cambi: readonly CambioAbbinamento[]): Promise<void> {
    if (cambi.length === 0) return;
    await sequelize.transaction(transaction => PuntiVenditaVolantinoRepository.scriviAbbinamenti(cambi, transaction));
  }

  private static async scriviAbbinamenti(cambi: readonly CambioAbbinamento[], transaction: Transaction): Promise<void> {
    // Un UPDATE per ogni coppia (PV, tipo): le righe che finiscono allo stesso modo vanno insieme
    const gruppi = new Map<string, CambioAbbinamento[]>();
    for (const cambio of cambi) {
      const chiave = `${cambio.idPuntoVendita ?? ''}|${cambio.abbinamento ?? ''}`;
      gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), cambio]);
    }
    for (const gruppo of gruppi.values()) {
      const { idPuntoVendita, abbinamento } = gruppo[0];
      for (const blocco of blocchi(gruppo)) {
        await PuntoVenditaVolantino.update(
          { id_punto_vendita: idPuntoVendita, abbinamento },
          { where: { id: blocco.map(cambio => cambio.id) }, transaction }
        );
      }
    }
  }

  async regoleCollegamento(idGdo: string): Promise<RegolaCollegamento[]> {
    const righe = await this.seleziona<{ id: string; id_punto_vendita: string; chiavi: string[] | null; creato_il: Date | string; combinazione: string | null }>(
      `SELECT a.id::text AS id, a.id_punto_vendita::text AS id_punto_vendita, a.chiavi, a.creato_il, ${CHIAVE_COMBINAZIONE_PV} AS combinazione
       FROM abbinamenti_manuali_pv_volantino a
       LEFT JOIN punti_vendita p ON p.id_puntivendita = a.id_punto_vendita
       LEFT JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = p.id_combinazione_canale_area_puntivendita
       WHERE a.id_gdo = :idGdo`,
      { idGdo }
    );
    return righe.map(riga => ({
      id: riga.id, idPuntoVendita: riga.id_punto_vendita, chiavi: riga.chiavi ?? [], creatoIl: riga.creato_il, combinazione: riga.combinazione,
    }));
  }

  async creaCollegamento(collegamento: NuovoCollegamento): Promise<string> {
    const creato = await AbbinamentoManualePvVolantino.create({
      id_gdo: collegamento.idGdo,
      id_punto_vendita: collegamento.idPuntoVendita,
      chiavi: [...collegamento.chiavi],
      riga: collegamento.riga,
      creato_da: collegamento.creatoDa,
    });
    return creato.id;
  }

  private static readonly COLONNE_COLLEGAMENTO = `a.id::text AS id, a.id_gdo::text AS id_gdo, a.id_punto_vendita::text AS id_punto_vendita,
              a.chiavi, a.riga, a.creato_il, p.nome_puntivendita AS nome, p.indirizzo_puntivendita AS indirizzo,
              p.citta_puntivendita AS citta, ${CHIAVE_COMBINAZIONE_PV} AS combinazione`;

  private static readonly DA_COLLEGAMENTO = `FROM abbinamenti_manuali_pv_volantino a
         JOIN punti_vendita p ON p.id_puntivendita = a.id_punto_vendita
         LEFT JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = p.id_combinazione_canale_area_puntivendita`;

  private static collegamentoDa(riga: RigaCollegamento): CollegamentoSalvato {
    return {
      id: riga.id,
      idGdo: riga.id_gdo,
      idPuntoVendita: riga.id_punto_vendita,
      chiavi: riga.chiavi ?? [],
      combinazione: riga.combinazione,
      riga: riga.riga,
      puntoVendita: { id: riga.id_punto_vendita, nome: riga.nome ?? '', indirizzo: riga.indirizzo, citta: riga.citta },
      creatoIl: new Date(riga.creato_il).toISOString(),
    };
  }

  async paginaCollegamenti(idGdo: string, limite: number, scarto: number): Promise<{ collegamenti: CollegamentoSalvato[]; totale: number }> {
    const [righe, [conteggio]] = await Promise.all([
      this.seleziona<RigaCollegamento>(
        `SELECT ${PuntiVenditaVolantinoRepository.COLONNE_COLLEGAMENTO}
         ${PuntiVenditaVolantinoRepository.DA_COLLEGAMENTO}
         WHERE a.id_gdo = :idGdo
         ORDER BY a.creato_il DESC, a.id
         LIMIT :limite OFFSET :scarto`,
        { idGdo, limite, scarto }
      ),
      this.seleziona<{ totale: number }>(
        `SELECT COUNT(*)::int AS totale FROM abbinamenti_manuali_pv_volantino WHERE id_gdo = :idGdo`,
        { idGdo }
      ),
    ]);
    return { collegamenti: righe.map(PuntiVenditaVolantinoRepository.collegamentoDa), totale: Number(conteggio?.totale ?? 0) };
  }

  async trovaCollegamento(id: string): Promise<CollegamentoSalvato | null> {
    const [riga] = await this.seleziona<RigaCollegamento>(
      `SELECT ${PuntiVenditaVolantinoRepository.COLONNE_COLLEGAMENTO}
       ${PuntiVenditaVolantinoRepository.DA_COLLEGAMENTO}
       WHERE a.id = :id`,
      { id }
    );
    return riga ? PuntiVenditaVolantinoRepository.collegamentoDa(riga) : null;
  }

  async eliminaCollegamento(id: string): Promise<void> {
    await AbbinamentoManualePvVolantino.destroy({ where: { id } });
  }

  async aggiungiChiaviCollegamento(id: string, chiavi: readonly string[]): Promise<void> {
    if (chiavi.length === 0) return;
    await sequelize.query(
      `UPDATE abbinamenti_manuali_pv_volantino
       SET chiavi = ARRAY(SELECT DISTINCT unnest(chiavi || ARRAY[:chiavi]::text[]) ORDER BY 1)
       WHERE id = :id`,
      { replacements: { id, chiavi: [...chiavi] }, type: QueryTypes.UPDATE }
    );
  }

  async righeCollegateAMano(idGdo: string, idPuntoVendita?: string): Promise<RigaCollegataAMano[]> {
    const delPuntoVendita = idPuntoVendita ? 'AND r.id_punto_vendita = :idPuntoVendita' : '';
    const righe = await this.seleziona<RigaCollegataSql>(
      `SELECT ${PuntiVenditaVolantinoRepository.COLONNE_RIGA_COLLEGATA}
       FROM punti_vendita_volantino r
       WHERE r.id_gdo = :idGdo AND r.abbinamento = :manuale AND r.id_punto_vendita IS NOT NULL
         ${delPuntoVendita}`,
      { idGdo, idPuntoVendita: idPuntoVendita ?? null, manuale: 'manuale' }
    );
    return righe.map(PuntiVenditaVolantinoRepository.rigaCollegataDa);
  }

  private static readonly COLONNE_RIGA_COLLEGATA = `r.id::text AS id, r.id_punto_vendita::text AS id_punto_vendita, r.riga, r.localita,
              r.chiave_indirizzo, r.chiave_telefono, r.id_canale::text AS id_canale, r.id_area::text AS id_area, r.abbinamento`;

  private static rigaCollegataDa(riga: RigaCollegataSql): RigaDelPuntoVendita {
    return {
      id: riga.id,
      idPuntoVendita: riga.id_punto_vendita,
      riga: riga.riga,
      localita: riga.localita,
      chiaveIndirizzo: riga.chiave_indirizzo,
      chiaveTelefono: riga.chiave_telefono,
      combinazione: chiaveCombinazione(riga.id_canale, riga.id_area),
      idCanale: riga.id_canale,
      idArea: riga.id_area,
      abbinamento: riga.abbinamento,
    };
  }

  async righeDelPuntoVendita(idGdo: string, idPuntoVendita: string): Promise<RigaDelPuntoVendita[]> {
    const righe = await this.seleziona<RigaCollegataSql>(
      `SELECT ${PuntiVenditaVolantinoRepository.COLONNE_RIGA_COLLEGATA}
       FROM punti_vendita_volantino r
       WHERE r.id_gdo = :idGdo AND r.id_punto_vendita = :idPuntoVendita
       ORDER BY r.id_kit_runtime, r.posizione`,
      { idGdo, idPuntoVendita }
    );
    return righe.map(PuntiVenditaVolantinoRepository.rigaCollegataDa);
  }

  async cambiaCollegamento(cambio: CambioCollegamento): Promise<string> {
    return sequelize.transaction(async (transaction) => {
      let idCollegamento = cambio.idCollegamento;
      if (idCollegamento) {
        // Il collegamento resta uno: cambia il PV, con tutte le chiavi del gruppo
        await AbbinamentoManualePvVolantino.update(
          { id_punto_vendita: cambio.idPuntoVendita, chiavi: [...cambio.chiavi], creato_da: cambio.creatoDa, creato_il: new Date() },
          { where: { id: idCollegamento, id_gdo: cambio.idGdo }, transaction }
        );
      } else {
        const creato = await AbbinamentoManualePvVolantino.create({
          id_gdo: cambio.idGdo,
          id_punto_vendita: cambio.idPuntoVendita,
          chiavi: [...cambio.chiavi],
          riga: cambio.riga,
          creato_da: cambio.creatoDa,
        }, { transaction });
        idCollegamento = creato.id;
      }
      if (cambio.daEliminare.length > 0) {
        await AbbinamentoManualePvVolantino.destroy({ where: { id: [...cambio.daEliminare], id_gdo: cambio.idGdo }, transaction });
      }
      await PuntiVenditaVolantinoRepository.scriviAbbinamenti(cambio.cambi, transaction);
      return idCollegamento;
    });
  }

  async nomiCanaliAree(idGdo: string): Promise<NomiCanaliAree> {
    const [canali, aree] = await Promise.all([
      this.seleziona<{ id: string; nome: string }>(`SELECT id_canali::text AS id, nome_canali AS nome FROM canali WHERE id_gdo_canali = :idGdo`, { idGdo }),
      this.seleziona<{ id: string; nome: string }>(`SELECT id_aree::text AS id, nome_aree AS nome FROM aree WHERE id_gdo_aree = :idGdo`, { idGdo }),
    ]);
    return {
      canali: new Map(canali.map(canale => [canale.id.toLowerCase(), canale.nome])),
      aree: new Map(aree.map(area => [area.id.toLowerCase(), area.nome])),
    };
  }

  async trovaPuntoVendita(id: string): Promise<PuntoVenditaDellaStoria | null> {
    const [riga] = await this.seleziona<PuntoVenditaDellaStoria>(
      `SELECT p.id_puntivendita::text AS id, p.id_gdo_puntivendita::text AS "idGdo", p.nome_puntivendita AS nome,
              p.citta_puntivendita AS citta, p.indirizzo_puntivendita AS indirizzo, p.telefono_puntivendita AS telefono,
              cca.id_canale_combinazione_canale_area::text AS "idCanale", c.nome_canali AS "nomeCanale",
              cca.id_area_combinazione_canale_area::text AS "idArea", ar.nome_aree AS "nomeArea"
       FROM punti_vendita p
       LEFT JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = p.id_combinazione_canale_area_puntivendita
       LEFT JOIN canali c ON c.id_canali = cca.id_canale_combinazione_canale_area
       LEFT JOIN aree ar ON ar.id_aree = cca.id_area_combinazione_canale_area
       WHERE p.id_puntivendita = :id`,
      { id }
    );
    return riga ?? null;
  }

  async apparizioni(idPuntoVendita: string): Promise<ApparizioneStoria[]> {
    const righe = await this.seleziona<RigaApparizione>(
      `SELECT ${COLONNE_APPARIZIONE},
              r.riga, r.localita, r.indirizzo, r.telefono, r.chiave_indirizzo, r.chiave_telefono, r.abbinamento
       FROM punti_vendita_volantino r
       ${COMBINAZIONE_PV}
       ${DA_KIT}
       WHERE r.id_punto_vendita = :idPuntoVendita AND ${KIT_VALIDI}
         AND ${KIT_COMBINAZIONE_PV}
       ORDER BY data_edizione, k.id, r.posizione`,
      { idPuntoVendita }
    );
    return righe.map(apparizioneDa);
  }

  async volantiniSenzaPuntoVendita(criteri: {
    idPuntoVendita: string;
    idGdo: string;
    idCanale: string;
    idArea: string;
    dopo: string;
  }): Promise<VolantinoSenzaPuntoVendita[]> {
    const righe = await this.seleziona<{ id_kit: string; data: string }>(
      `SELECT k.id::text AS id_kit, ${DATA_EDIZIONE} AS data
       FROM runtime_kit k
       JOIN promo p ON p.id_promo = k.id_promo
       WHERE k.id_canale = :idCanale AND k.id_area = :idArea AND ${KIT_VALIDI}
         AND ${DATA_EDIZIONE} > :dopo
         AND EXISTS (SELECT 1 FROM punti_vendita_volantino r WHERE r.id_kit_runtime = k.id AND r.id_gdo = :idGdo)
         AND NOT EXISTS (
           SELECT 1 FROM punti_vendita_volantino r WHERE r.id_kit_runtime = k.id AND r.id_punto_vendita = :idPuntoVendita
         )
       ORDER BY data, k.id`,
      criteri
    );
    return righe.map(riga => ({ idKit: riga.id_kit, data: riga.data }));
  }

  async paginaVolantini(idPuntoVendita: string, limite: number, scarto: number): Promise<{ volantini: VolantinoNellaStoria[]; totale: number }> {
    // Una riga per kit: se il PV compare due volte nella stessa lista conta la prima
    const apparizioni = `
      WITH ap AS (
        SELECT DISTINCT ON (r.id_kit_runtime) r.*
        FROM punti_vendita_volantino r
        ${COMBINAZIONE_PV}
        JOIN runtime_kit k ON k.id = r.id_kit_runtime
        WHERE r.id_punto_vendita = :idPuntoVendita
          AND ${KIT_COMBINAZIONE_PV}
        ORDER BY r.id_kit_runtime, r.posizione
      )`;
    const [righe, [conteggio]] = await Promise.all([
      this.seleziona<RigaVolantino>(
        `${apparizioni}
         SELECT ${COLONNE_APPARIZIONE},
                r.riga, r.localita, r.indirizzo, r.telefono, r.chiave_indirizzo, r.chiave_telefono, r.abbinamento,
                (SELECT COUNT(*) FROM referenze rf WHERE rf.id_runtime_kit = k.id)::int AS numero_referenze,
                vol.id AS pdf_id, vol.id_olimpo_cloud AS pdf_id_olimpo, vol.nome AS pdf_nome, vol.pages AS pdf_pagine
         FROM ap r
         ${DA_KIT}
         ${PDF_VOLANTINO}
         WHERE ${KIT_VALIDI}
         ORDER BY data_edizione DESC, p.validita_al DESC NULLS LAST, k.titolo, k.id
         LIMIT :limite OFFSET :scarto`,
        { idPuntoVendita, limite, scarto }
      ),
      this.seleziona<{ totale: number }>(
        `${apparizioni}
         SELECT COUNT(*)::int AS totale
         FROM ap r
         JOIN runtime_kit k ON k.id = r.id_kit_runtime
         JOIN promo p ON p.id_promo = k.id_promo
         WHERE ${KIT_VALIDI}`,
        { idPuntoVendita }
      ),
    ]);
    return { volantini: righe.map(volantinoDa), totale: Number(conteggio?.totale ?? 0) };
  }
}
