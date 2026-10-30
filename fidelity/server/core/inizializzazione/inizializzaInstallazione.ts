import bcrypt from 'bcrypt';
import { convertiMenuMateriali } from '../../../lib/accessi/menuMateriali';
import { RUOLO_UTENTE_GDO, STATO_UTENTI, TIPO_UTENTI } from '../../../lib/enums';
import type { PeriodoMateriali } from '../../../lib/materiali/periodi';
import { sequelize } from '../db/SequelizeConnector';
import { AuthProvider } from '../models/auth_provider';
import { GDO } from '../models/gdo';
import { HubService } from '../models/hub_service';
import { MenuItem } from '../models/menu_item';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import { Utente } from '../models/utenti';
import { UtentiGDO } from '../models/utenti_gdo';
import {
  INGRESSO_SERVIZIO_GESTITO,
  MENU_SUPERADMIN,
  PROVIDER_EMAIL_PASSWORD,
  SERVIZI_GESTITI,
  SERVIZI_HUB_PREDEFINITI,
} from './datiPredefiniti';

/**
 * La prima inizializzazione di un'installazione, automatica: la esegue il deploy Docker a ogni avvio
 * del container, dopo models:sync e prima del server (server/core/scripts/inizializza.ts). Fa lo
 * stesso lavoro di docker/fidelity-olimpo/seed-fidelity.sh, che resta per l'uso a mano.
 *
 * Ogni passo crea solo cio' che manca e non modifica mai quello che c'e' gia': rilanciarla non
 * cambia nulla, e dopo un ripristino da dump utenti, menu e hub restano quelli ripristinati.
 */

export interface AmministratoreIniziale {
  email: string;
  password: string;
  nome: string;
  cognome: string;
}

export interface OpzioniInizializzazione {
  /** Da FIDELITY_ADMIN_* del deploy; null se mancano email o password. */
  amministratore: AmministratoreIniziale | null;
  /** CLIENT_ID: il nome della GDO dell'installazione ("default" o vuoto = nessun cliente). */
  clientId: string;
}

export interface EsitoPasso {
  passo: string;
  esito: 'creato' | 'invariato' | 'saltato' | 'errore';
  dettaglio: string;
}

/** Le materialized view create dagli script SQL all'avvio, da riallineare ai dati appena inseriti. */
export const VISTE_DA_AGGIORNARE = [
  'mv_utenti_completi',
  'mv_aree_ottimizzata',
  'mv_canali_ottimizzata',
  'mv_combinazioni_ottimizzata',
] as const;

/**
 * Identificativi fissi delle voci POP del menu predefinito del Superadmin: come quelli di
 * MENU_SUPERADMIN sono dati di riferimento, uguali su tutte le installazioni.
 */
export const ID_VOCI_POP_SUPERADMIN: Readonly<Record<PeriodoMateriali, string>> = {
  'in-corso': '34d3d518-132b-455b-ab99-0ca9a1543582',
  attivi: 'd0a71ecc-9478-4897-9985-72e2da21c6bf',
  storico: '5451e8a5-9613-4b22-909b-16c951b7c46c',
};

/** Identificativo fisso dell'intestazione 'MATERIALI POP' del menu predefinito del Superadmin. */
export const ID_INTESTAZIONE_POP_SUPERADMIN = '48bf27f7-ddb5-4fe8-873c-65506fadd405';

/**
 * Le voci del menu predefinito del Superadmin, pronte per bulkCreate. MENU_SUPERADMIN resta
 * allineato a seed-fidelity.sh, con le pagine Materiali e l'intestazione 'MATERIALI': qui si
 * converte nelle sezioni 'MATERIALI VOLANTINO' e 'MATERIALI POP' come i menu salvati
 * (lib/accessi/menuMateriali.ts), così un'installazione nuova e il ripristino del menu nascono
 * già convertiti.
 */
export function vociMenuSuperadmin(adesso = new Date()) {
  const { voci } = convertiMenuMateriali(MENU_SUPERADMIN, voce =>
    voce === 'intestazione-pop' ? ID_INTESTAZIONE_POP_SUPERADMIN : ID_VOCI_POP_SUPERADMIN[voce]
  );
  return voci.map(voce => ({
    ...voce,
    tipo_utente: TIPO_UTENTI.SUPERADMIN,
    ruolo_gdo: null,
    id_parent: null,
    createdat: adesso,
    updatedat: adesso,
  }));
}

/** L'amministratore iniziale dalle variabili del deploy, o null se manca email o password. */
export function amministratoreDaAmbiente(env: NodeJS.ProcessEnv = process.env): AmministratoreIniziale | null {
  const email = (env.FIDELITY_ADMIN_EMAIL ?? '').trim();
  const password = env.FIDELITY_ADMIN_PASSWORD ?? '';
  if (!email || !password) return null;
  return {
    email,
    password,
    nome: (env.FIDELITY_ADMIN_NOME ?? '').trim() || 'Amministratore',
    cognome: (env.FIDELITY_ADMIN_COGNOME ?? '').trim() || 'Sistema',
  };
}

export async function inizializzaInstallazione(opzioni: OpzioniInizializzazione): Promise<EsitoPasso[]> {
  const esiti: EsitoPasso[] = [];
  const passo = async (nome: string, azione: () => Promise<Omit<EsitoPasso, 'passo'>>) => {
    try {
      esiti.push({ passo: nome, ...(await azione()) });
    } catch (errore) {
      esiti.push({ passo: nome, esito: 'errore', dettaglio: errore instanceof Error ? errore.message : String(errore) });
    }
  };

  await passo('provider email_password', async () => {
    if (await AuthProvider.findOne({ where: { codice: PROVIDER_EMAIL_PASSWORD.codice } }))
      return { esito: 'invariato', dettaglio: 'gia presente' };
    await AuthProvider.create(PROVIDER_EMAIL_PASSWORD);
    return { esito: 'creato', dettaglio: 'metodo di accesso con email e password' };
  });

  // Un amministratore si crea solo se l'installazione non ne ha nessuno: cambiare l'email
  // dall'interfaccia non deve far nascere un secondo Superadmin al deploy successivo.
  let amministratore: Utente | null = null;
  await passo('amministratore', async () => {
    const esistente = await Utente.findOne({
      where: { tipo_utenti: TIPO_UTENTI.SUPERADMIN },
      order: [['createdat', 'ASC']],
    });
    if (esistente) {
      const perEmail = opzioni.amministratore
        ? await Utente.findOne({
            where: { email_utenti: opzioni.amministratore.email.toLowerCase(), tipo_utenti: TIPO_UTENTI.SUPERADMIN },
          })
        : null;
      amministratore = perEmail ?? esistente;
      return { esito: 'invariato', dettaglio: `Superadmin gia presente (${amministratore.email_utenti})` };
    }
    if (!opzioni.amministratore)
      return { esito: 'saltato', dettaglio: 'FIDELITY_ADMIN_EMAIL o FIDELITY_ADMIN_PASSWORD non impostate' };

    const a = opzioni.amministratore;
    amministratore = await Utente.create({
      nome_utenti: a.nome,
      cognome_utenti: a.cognome,
      email_utenti: a.email,
      password_utenti: await bcrypt.hash(a.password, 10),
      tipo_utenti: TIPO_UTENTI.SUPERADMIN,
      stato_utenti: STATO_UTENTI.ATTIVO,
      // Vuota: al primo passaporto Fidelity si registra su Olimpo con fico-secret e salva la chiave vera.
      privatekey_utenti: '',
      outsider_utenti: false,
    } as any);
    return { esito: 'creato', dettaglio: a.email };
  });

  let gdo: any = null;
  const cliente = opzioni.clientId.trim();
  await passo('gdo del cliente', async () => {
    if (!cliente || cliente.toLowerCase() === 'default')
      return { esito: 'saltato', dettaglio: "CLIENT_ID vuoto o 'default'" };
    gdo = await GDO.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('nome_gdo')), cliente.toLowerCase()),
    });
    if (gdo) return { esito: 'invariato', dettaglio: gdo.nome_gdo };
    gdo = await GDO.create({ nome_gdo: cliente, createdat: new Date(), updatedat: new Date() } as any);
    return { esito: 'creato', dettaglio: cliente };
  });

  await passo('amministratore collegato alla gdo', async () => {
    const admin = amministratore as Utente | null;
    if (!admin || !gdo) return { esito: 'saltato', dettaglio: 'manca l amministratore o la GDO del cliente' };
    const collegamento = await UtentiGDO.findOne({ where: { id_utente_utentegdo: admin.id_utenti } });
    if (collegamento) return { esito: 'invariato', dettaglio: 'collegamento gia presente' };
    const ruolo = await RuoloUtenteGDO.findOne({ where: { ruolo_ruolo_utente_gdo: RUOLO_UTENTE_GDO.ADMIN } });
    await UtentiGDO.create({
      id_utente_utentegdo: admin.id_utenti,
      id_gdo_utentegdo: gdo.id_gdo,
      id_ruolo_utente_gdo: ruolo?.id_ruolo_utente_gdo,
      createdat: new Date(),
      updatedat: new Date(),
    } as any);
    return { esito: 'creato', dettaglio: `${admin.email_utenti} -> ${gdo.nome_gdo} (ADMIN)` };
  });

  await passo('menu del superadmin', async () => {
    if (await MenuItem.count({ where: { tipo_utente: TIPO_UTENTI.SUPERADMIN } }) > 0)
      return { esito: 'invariato', dettaglio: 'il Superadmin ha gia un menu' };
    const voci = vociMenuSuperadmin();
    await MenuItem.bulkCreate(voci as any[]);
    return { esito: 'creato', dettaglio: `${voci.length} voci` };
  });

  // Prima dei servizi gestiti: l'hub vuoto e' quello di un'installazione nuova.
  await passo('servizi predefiniti dell hub', async () => {
    if (await HubService.count() > 0) return { esito: 'invariato', dettaglio: "l'hub ha gia dei servizi" };
    await HubService.bulkCreate(SERVIZI_HUB_PREDEFINITI.map(s => ({ ...s, attivo: true, in_manutenzione: false })) as any[]);
    return { esito: 'creato', dettaglio: `${SERVIZI_HUB_PREDEFINITI.length} servizi` };
  });

  await passo('servizi gestiti istanta e correggo', async () => {
    const creati: string[] = [];
    for (const servizio of SERVIZI_GESTITI) {
      for (const tipoUtente of servizio.tipiUtente) {
        const esistente = await HubService.findOne({
          where: { codice: servizio.codice, tipo_utente: tipoUtente, ruolo_gdo: null },
        });
        if (esistente) continue;
        await HubService.create({
          codice: servizio.codice,
          nome: servizio.nome,
          descrizione: servizio.descrizione,
          icona: servizio.icona,
          colore: servizio.colore,
          // L'indirizzo vero lo calcola HubServiceService dalla configurazione.
          url: INGRESSO_SERVIZIO_GESTITO[servizio.codice],
          tipo_url: 'external_fico',
          attivo: true,
          in_manutenzione: false,
          in_evidenza: false,
          ordine: servizio.ordine,
          tipo_utente: tipoUtente,
          ruolo_gdo: null,
          meta: { gestito: servizio.codice },
        } as any);
        creati.push(`${servizio.codice}/${tipoUtente}`);
      }
    }
    return creati.length > 0
      ? { esito: 'creato', dettaglio: creati.join(', ') }
      : { esito: 'invariato', dettaglio: 'gia presenti' };
  });

  // Le viste nascono all'avvio, con le tabelle ancora vuote: senza questo l'amministratore appena
  // creato non comparirebbe nella gestione utenti.
  await passo('materialized view', async () => {
    const aggiornate: string[] = [];
    for (const vista of VISTE_DA_AGGIORNARE) {
      const [righe] = await sequelize.query(`SELECT to_regclass('public.${vista}') IS NOT NULL AS esiste`);
      if (!(righe as any[])[0]?.esiste) throw new Error(`${vista} non esiste: controlla gli script SQL dell'avvio`);
      await sequelize.query(`REFRESH MATERIALIZED VIEW public.${vista}`);
      aggiornate.push(vista);
    }
    return { esito: 'creato', dettaglio: `aggiornate ${aggiornate.join(', ')}` };
  });

  return esiti;
}
