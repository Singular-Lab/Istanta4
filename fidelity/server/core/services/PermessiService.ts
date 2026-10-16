import { TIPO_UTENTI } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { CodicePermesso, ePermessoDiSistema, esistePermesso, TUTTI_I_PERMESSI } from '../../../lib/accessi/catalogo';
import { sequelize } from '../db/SequelizeConnector';
import type { ContestoAccesso } from '../accessi/contestoAccesso';
import { combinaLivelli, LivelliRuolo, RisolutoreAccessi } from '../accessi/RisolutoreAccessi';
import { incrementaVersionePermessi } from '../accessi/versionePermessi';
import type {
  AmbitoPermessi,
  ConfigurazionePermessi,
  ConfrontoRuoli,
  IPermessiService,
  ModificaPermesso,
  RuoliGestibili,
  StatoPermesso,
} from '../interfaces/IPermessiService';
import { log } from '../logger';
import { GDO } from '../models';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import { PermessiRepository } from '../repositories/PermessiRepository';

/** Tipi i cui permessi si gestiscono: il Superadmin li ha sempre tutti. */
export const TIPI_GESTIBILI: TIPO_UTENTI[] = (Object.keys(TIPO_UTENTI) as Array<keyof typeof TIPO_UTENTI>)
  .map(k => TIPO_UTENTI[k])
  .filter(t => t !== TIPO_UTENTI.SUPERADMIN);

const VUOTO = new Map<string, boolean>();

/**
 * Livelli da cui un ambito eredita e livello che scrive.
 * Ordine di risoluzione: tipo → sotto-ruolo → override GDO → override GDO e sotto-ruolo.
 */
export const livelliDiAmbito = (ambito: AmbitoPermessi, livelli: LivelliRuolo) => {
  const conRuolo = !!ambito.idRuoloGdo;
  const conGdo = !!ambito.idGdo;
  if (!conGdo && !conRuolo) return { proprio: livelli.tipo, ereditati: [] as Map<string, boolean>[] };
  if (!conGdo) return { proprio: livelli.sottoRuolo, ereditati: [livelli.tipo] };
  if (!conRuolo) return { proprio: livelli.gdo, ereditati: [livelli.tipo] };
  return { proprio: livelli.gdoSottoRuolo, ereditati: [livelli.tipo, livelli.sottoRuolo, livelli.gdo] };
};

/** Stato di ogni permesso del catalogo in un ambito. Funzione pura: la usano servizio e test. */
export const statoPermessi = (ambito: AmbitoPermessi, livelli: LivelliRuolo): StatoPermesso[] => {
  const { proprio, ereditati } = livelliDiAmbito(ambito, livelli);
  const conGdo = !!ambito.idGdo;
  const conRuolo = !!ambito.idRuoloGdo;
  // Effetto reale per un utente di questo ambito: si considerano solo i livelli fino a qui.
  const efficaci = new Set(combinaLivelli({
    tipo: livelli.tipo,
    sottoRuolo: conRuolo ? livelli.sottoRuolo : VUOTO,
    gdo: conGdo ? livelli.gdo : VUOTO,
    gdoSottoRuolo: conGdo && conRuolo ? livelli.gdoSottoRuolo : VUOTO,
  }));

  return TUTTI_I_PERMESSI.map(voce => {
    let ereditato = false;
    for (const livello of ereditati) {
      if (livello.has(voce.codice)) ereditato = livello.get(voce.codice)!;
    }
    const impostato = !voce.sistema && proprio.has(voce.codice);
    const abilitato = voce.sistema ? false : (impostato ? proprio.get(voce.codice)! : ereditato);
    return {
      codice: voce.codice,
      abilitato,
      impostato,
      ereditato,
      efficace: efficaci.has(voce.codice),
    };
  });
};

export class PermessiService implements IPermessiService {
  constructor(
    private readonly repository: PermessiRepository,
    private readonly risolutore: RisolutoreAccessi = RisolutoreAccessi.get()
  ) { }

  async getRuoliGestibili(): Promise<RuoliGestibili> {
    const [ruoli, gdo] = await Promise.all([
      RuoloUtenteGDO.findAll({ order: [['ruolo_ruolo_utente_gdo', 'ASC']] }),
      GDO.findAll({ attributes: ['id_gdo', 'nome_gdo'], order: [['nome_gdo', 'ASC']] }),
    ]);
    return {
      tipi: TIPI_GESTIBILI,
      ruoliGdo: ruoli.map(r => ({ id: r.id_ruolo_utente_gdo, nome: r.ruolo_ruolo_utente_gdo })),
      gdo: gdo.map(g => ({ id: g.id_gdo, nome: g.nome_gdo })),
    };
  }

  private async validaAmbito(ambito: AmbitoPermessi): Promise<void> {
    if (TIPI_GESTIBILI.indexOf(ambito.tipo) < 0) {
      throw new BadRequestError({ message: 'Tipo utente non gestibile', details: { tipo: ambito.tipo } });
    }
    if (ambito.idRuoloGdo && !(await RuoloUtenteGDO.findByPk(ambito.idRuoloGdo))) {
      throw new BadRequestError({ message: 'Sotto-ruolo GDO inesistente', details: { idRuoloGdo: ambito.idRuoloGdo } });
    }
    if (ambito.idGdo && !(await GDO.findByPk(ambito.idGdo))) {
      throw new BadRequestError({ message: 'GDO inesistente', details: { idGdo: ambito.idGdo } });
    }
  }

  async getConfigurazione(ambito: AmbitoPermessi): Promise<ConfigurazionePermessi> {
    await this.validaAmbito(ambito);
    const livelli = await this.risolutore.leggiLivelli(ambito);
    return {
      ambito,
      eredita: !!(ambito.idGdo || ambito.idRuoloGdo),
      permessi: statoPermessi(ambito, livelli),
    };
  }

  async salvaConfigurazione(ambito: AmbitoPermessi, modifiche: ModificaPermesso[]): Promise<ConfigurazionePermessi> {
    await this.validaAmbito(ambito);

    const sconosciuti = modifiche.filter(m => !esistePermesso(m.codice)).map(m => m.codice);
    if (sconosciuti.length > 0) {
      throw new BadRequestError({ message: 'Permessi sconosciuti', details: { codici: sconosciuti } });
    }
    const diSistema = modifiche.filter(m => ePermessoDiSistema(m.codice)).map(m => m.codice);
    if (diSistema.length > 0) {
      throw new BadRequestError({
        message: 'I permessi di sistema appartengono solo al Superadmin e non si possono assegnare',
        details: { codici: diSistema },
      });
    }

    const idPerCodice = new Map<string, string>();
    for (const p of await this.repository.findAllPermessi()) {
      idPerCodice.set(p.getDataValue('codice'), p.getDataValue('id_permesso'));
    }
    const eredita = !!(ambito.idGdo || ambito.idRuoloGdo);
    const valori = new Map<string, boolean | null>();
    for (const m of modifiche) {
      const id = idPerCodice.get(m.codice);
      if (!id) throw new BadRequestError({ message: 'Permesso non presente nel catalogo', details: { codice: m.codice } });
      // Il livello del tipo non eredita da nulla: "togliere il valore" significa disabilitare.
      valori.set(id, m.abilitato === null ? (eredita ? null : false) : !!m.abilitato);
    }

    await sequelize.transaction(async (transaction) => {
      await this.repository.scriviLivello(ambito, valori, transaction);
      await incrementaVersionePermessi(transaction);
    });
    log.info(`Permessi aggiornati per ${descriviAmbito(ambito)}: ${modifiche.length} modifiche`);
    return this.getConfigurazione(ambito);
  }

  async ripristinaOverride(ambito: AmbitoPermessi & { idGdo: string }): Promise<number> {
    await this.validaAmbito(ambito);
    let rimossi = 0;
    await sequelize.transaction(async (transaction) => {
      rimossi = await this.repository.svuotaOverride(ambito, transaction);
      await incrementaVersionePermessi(transaction);
    });
    log.info(`Override rimossi per ${descriviAmbito(ambito)}: ${rimossi}`);
    return rimossi;
  }

  async getConfronto(idGdo?: string | null): Promise<ConfrontoRuoli> {
    const ruoli = await RuoloUtenteGDO.findAll({ order: [['ruolo_ruolo_utente_gdo', 'ASC']] });
    const colonne: ConfrontoRuoli['colonne'] = [];
    for (const tipo of TIPI_GESTIBILI) {
      colonne.push({
        chiave: tipo,
        tipo,
        idRuoloGdo: null,
        etichetta: tipo,
        permessi: Array.from(await this.risolutore.permessiDelRuolo({ tipo, idGdo })),
      });
      if (tipo !== TIPO_UTENTI.GDO) continue;
      for (const r of ruoli) {
        colonne.push({
          chiave: `${tipo}:${r.id_ruolo_utente_gdo}`,
          tipo,
          idRuoloGdo: r.id_ruolo_utente_gdo,
          etichetta: `${tipo} · ${r.ruolo_ruolo_utente_gdo}`,
          permessi: Array.from(await this.risolutore.permessiDelRuolo({ tipo, idRuoloGdo: r.id_ruolo_utente_gdo, idGdo })),
        });
      }
    }
    return { colonne };
  }

  async getPermessiEffettivi(contesto: ContestoAccesso): Promise<CodicePermesso[]> {
    return Array.from(await this.risolutore.permessiDi(contesto));
  }
}

const descriviAmbito = (ambito: AmbitoPermessi) =>
  `${ambito.tipo}${ambito.idRuoloGdo ? ` (sotto-ruolo ${ambito.idRuoloGdo})` : ''}${ambito.idGdo ? ` in GDO ${ambito.idGdo}` : ''}`;
