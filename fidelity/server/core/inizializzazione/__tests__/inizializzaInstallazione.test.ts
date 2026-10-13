import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUOLO_UTENTE_GDO, TIPO_UTENTI } from '../../../../lib/enums';
import { sequelize } from '../../db/SequelizeConnector';
import { AuthProvider } from '../../models/auth_provider';
import { GDO } from '../../models/gdo';
import { HubService } from '../../models/hub_service';
import { MenuItem } from '../../models/menu_item';
import { RuoloUtenteGDO } from '../../models/ruolo_gdo';
import { Utente } from '../../models/utenti';
import { UtentiGDO } from '../../models/utenti_gdo';
import { MENU_SUPERADMIN, SERVIZI_GESTITI, SERVIZI_HUB_PREDEFINITI } from '../datiPredefiniti';
import {
  amministratoreDaAmbiente,
  inizializzaInstallazione,
  VISTE_DA_AGGIORNARE,
  type OpzioniInizializzazione,
} from '../inizializzaInstallazione';

/**
 * L'inizializzazione automatica dell'installazione, che ha preso il posto di seed-fidelity.sh.
 * Il database e' simulato da un piccolo stato in memoria dietro i metodi dei modelli.
 */

interface Stato {
  provider: any[];
  utenti: any[];
  gdo: any[];
  utentiGdo: any[];
  menu: any[];
  hub: any[];
  query: string[];
}

let stato: Stato;

// Generata a ogni esecuzione: nessuna password, nemmeno finta, scritta nel repository.
const ADMIN = { email: 'admin@esempio.it', password: randomUUID(), nome: 'Anna', cognome: 'Rossi' };
const OPZIONI: OpzioniInizializzazione = { amministratore: ADMIN, clientId: 'Coop Prova' };

/** Il valore di una condizione semplice del where (gli operatori non servono qui). */
const corrisponde = (riga: any, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => (riga[k] ?? null) === (v ?? null));

beforeEach(() => {
  vi.restoreAllMocks();
  stato = { provider: [], utenti: [], gdo: [], utentiGdo: [], menu: [], hub: [], query: [] };

  vi.spyOn(AuthProvider, 'findOne').mockImplementation(async (o: any) =>
    stato.provider.find(p => corrisponde(p, o.where)) ?? null);
  vi.spyOn(AuthProvider, 'create').mockImplementation(async (d: any) => { stato.provider.push(d); return d; });

  vi.spyOn(Utente, 'findOne').mockImplementation(async (o: any) =>
    stato.utenti.find(u => corrisponde(u, o.where)) ?? null);
  vi.spyOn(Utente, 'create').mockImplementation(async (d: any) => {
    const u = { ...d, id_utenti: `u${stato.utenti.length + 1}` };
    stato.utenti.push(u);
    return u;
  });

  // GDO.findOne riceve un sequelize.where(lower(nome_gdo), valore): si confronta senza maiuscole.
  vi.spyOn(GDO, 'findOne').mockImplementation(async (o: any) => {
    const valore = String(o.where.logic ?? '').toLowerCase();
    return stato.gdo.find(g => g.nome_gdo.toLowerCase() === valore) ?? null;
  });
  vi.spyOn(GDO, 'create').mockImplementation(async (d: any) => {
    const g = { ...d, id_gdo: `g${stato.gdo.length + 1}` };
    stato.gdo.push(g);
    return g;
  });

  vi.spyOn(UtentiGDO, 'findOne').mockImplementation(async (o: any) =>
    stato.utentiGdo.find(c => corrisponde(c, o.where)) ?? null);
  vi.spyOn(UtentiGDO, 'create').mockImplementation(async (d: any) => { stato.utentiGdo.push(d); return d; });
  vi.spyOn(RuoloUtenteGDO, 'findOne').mockImplementation(async (o: any) =>
    o.where.ruolo_ruolo_utente_gdo === RUOLO_UTENTE_GDO.ADMIN
      ? ({ id_ruolo_utente_gdo: 'ruolo-admin', ruolo_ruolo_utente_gdo: RUOLO_UTENTE_GDO.ADMIN } as any)
      : null);

  vi.spyOn(MenuItem, 'count').mockImplementation(async (o: any) =>
    stato.menu.filter(m => corrisponde(m, o.where)).length as any);
  vi.spyOn(MenuItem, 'bulkCreate').mockImplementation(async (righe: any) => { stato.menu.push(...righe); return righe; });

  vi.spyOn(HubService, 'count').mockImplementation(async () => stato.hub.length as any);
  vi.spyOn(HubService, 'bulkCreate').mockImplementation(async (righe: any) => { stato.hub.push(...righe); return righe; });
  vi.spyOn(HubService, 'findOne').mockImplementation(async (o: any) =>
    stato.hub.find(s => corrisponde(s, o.where)) ?? null);
  vi.spyOn(HubService, 'create').mockImplementation(async (d: any) => { stato.hub.push(d); return d; });

  vi.spyOn(sequelize, 'query').mockImplementation(async (sql: any) => {
    stato.query.push(String(sql));
    return [[{ esiste: true }], {}] as any;
  });
});

const esito = (esiti: Awaited<ReturnType<typeof inizializzaInstallazione>>, passo: string) =>
  esiti.find(e => e.passo === passo)?.esito;

describe('inizializzazione di un database vuoto', () => {
  it('crea tutto cio che serve per entrare, senza errori', async () => {
    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(esiti.filter(e => e.esito === 'errore')).toEqual([]);
    expect(stato.provider.map(p => p.codice)).toEqual(['email_password']);

    expect(stato.utenti).toHaveLength(1);
    const admin = stato.utenti[0];
    expect(admin.tipo_utenti).toBe(TIPO_UTENTI.SUPERADMIN);
    expect(admin.email_utenti).toBe(ADMIN.email);
    expect(admin.privatekey_utenti).toBe('');
    expect(await bcrypt.compare(ADMIN.password, admin.password_utenti)).toBe(true);

    expect(stato.gdo.map(g => g.nome_gdo)).toEqual(['Coop Prova']);
    expect(stato.utentiGdo).toEqual([
      expect.objectContaining({ id_utente_utentegdo: admin.id_utenti, id_gdo_utentegdo: 'g1', id_ruolo_utente_gdo: 'ruolo-admin' }),
    ]);

    expect(stato.menu).toHaveLength(MENU_SUPERADMIN.length);
    expect(stato.menu.every(m => m.tipo_utente === TIPO_UTENTI.SUPERADMIN && m.ruolo_gdo === null)).toBe(true);
  });

  it('crea nell hub i servizi predefiniti e Istanta e Correggo per i tipi di utente concordati', async () => {
    await inizializzaInstallazione(OPZIONI);

    const gestiti = stato.hub.filter(s => s.meta?.gestito);
    const tipiPer = (codice: string) => gestiti.filter(s => s.codice === codice).map(s => s.tipo_utente).sort();
    expect(tipiPer('istanta')).toEqual([TIPO_UTENTI.AGENZIA, TIPO_UTENTI.SUPERADMIN].sort());
    expect(tipiPer('correggo')).toEqual(
      [TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA, TIPO_UTENTI.GDO, TIPO_UTENTI.CATEGORY, TIPO_UTENTI.MARKETING].sort());
    expect(gestiti.every(s => s.tipo_url === 'external_fico' && s.ruolo_gdo === null)).toBe(true);
    expect(stato.hub.filter(s => s.codice === 'fidelity_promotion')).toHaveLength(SERVIZI_HUB_PREDEFINITI.length);
  });

  it('aggiorna le materialized view dopo aver inserito i dati', async () => {
    await inizializzaInstallazione(OPZIONI);

    for (const vista of VISTE_DA_AGGIORNARE)
      expect(stato.query).toContain(`REFRESH MATERIALIZED VIEW public.${vista}`);
  });
});

describe('inizializzazione ripetuta e installazioni gia in uso', () => {
  it('la seconda esecuzione non crea nulla', async () => {
    await inizializzaInstallazione(OPZIONI);
    const prima = JSON.stringify({ ...stato, query: [] });

    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(JSON.stringify({ ...stato, query: [] })).toBe(prima);
    expect(esiti.filter(e => e.esito === 'creato').map(e => e.passo)).toEqual(['materialized view']);
  });

  it('con un Superadmin gia presente non crea un secondo amministratore, anche con un altra email', async () => {
    stato.utenti.push({ id_utenti: 'u-vecchio', email_utenti: 'vecchio@esempio.it', tipo_utenti: TIPO_UTENTI.SUPERADMIN });

    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(stato.utenti).toHaveLength(1);
    expect(esito(esiti, 'amministratore')).toBe('invariato');
    // Il collegamento alla GDO va comunque al Superadmin esistente.
    expect(stato.utentiGdo[0].id_utente_utentegdo).toBe('u-vecchio');
  });

  it('non tocca un collegamento alla GDO gia presente', async () => {
    stato.utenti.push({ id_utenti: 'u1', email_utenti: ADMIN.email, tipo_utenti: TIPO_UTENTI.SUPERADMIN });
    stato.utentiGdo.push({ id_utente_utentegdo: 'u1', id_gdo_utentegdo: 'altra-gdo' });

    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(stato.utentiGdo).toEqual([{ id_utente_utentegdo: 'u1', id_gdo_utentegdo: 'altra-gdo' }]);
    expect(esito(esiti, 'amministratore collegato alla gdo')).toBe('invariato');
  });

  it('riconosce la GDO del cliente senza badare alle maiuscole', async () => {
    stato.gdo.push({ id_gdo: 'g-esistente', nome_gdo: 'COOP PROVA' });

    await inizializzaInstallazione(OPZIONI);

    expect(stato.gdo).toHaveLength(1);
    expect(stato.utentiGdo[0].id_gdo_utentegdo).toBe('g-esistente');
  });

  it('non tocca il menu del Superadmin gia presente', async () => {
    stato.menu.push({ tipo_utente: TIPO_UTENTI.SUPERADMIN, ruolo_gdo: null, titolo: 'Personalizzata' });

    await inizializzaInstallazione(OPZIONI);

    expect(stato.menu).toEqual([{ tipo_utente: TIPO_UTENTI.SUPERADMIN, ruolo_gdo: null, titolo: 'Personalizzata' }]);
  });

  it('con un hub gia configurato aggiunge solo i servizi gestiti mancanti', async () => {
    stato.hub.push({ codice: 'mio_servizio', tipo_utente: TIPO_UTENTI.AGENZIA, ruolo_gdo: null });
    stato.hub.push({ codice: 'correggo', tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: null, meta: { gestito: 'correggo' } });

    await inizializzaInstallazione(OPZIONI);

    expect(stato.hub.some(s => s.codice === 'fidelity_promotion')).toBe(false);
    const attesi = SERVIZI_GESTITI.reduce((n, s) => n + s.tipiUtente.length, 0);
    expect(stato.hub.filter(s => s.meta?.gestito)).toHaveLength(attesi);
  });
});

describe('configurazione mancante', () => {
  it('senza credenziali dell amministratore salta solo amministratore e collegamento', async () => {
    const esiti = await inizializzaInstallazione({ amministratore: null, clientId: 'Coop Prova' });

    expect(stato.utenti).toEqual([]);
    expect(esito(esiti, 'amministratore')).toBe('saltato');
    expect(esito(esiti, 'amministratore collegato alla gdo')).toBe('saltato');
    expect(stato.gdo).toHaveLength(1);
    expect(stato.menu).toHaveLength(MENU_SUPERADMIN.length);
  });

  it.each(['', 'default', 'DEFAULT'])('con CLIENT_ID "%s" non crea GDO ne collegamento', async (clientId) => {
    const esiti = await inizializzaInstallazione({ amministratore: ADMIN, clientId });

    expect(stato.gdo).toEqual([]);
    expect(stato.utentiGdo).toEqual([]);
    expect(esito(esiti, 'gdo del cliente')).toBe('saltato');
  });

  it('un passo che fallisce non ferma gli altri e viene segnalato', async () => {
    vi.spyOn(MenuItem, 'bulkCreate').mockRejectedValue(new Error('tabella menu_items assente'));

    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(esiti.find(e => e.passo === 'menu del superadmin')).toEqual(
      expect.objectContaining({ esito: 'errore', dettaglio: 'tabella menu_items assente' }));
    expect(stato.hub.length).toBeGreaterThan(0);
  });

  it('segnala come errore una materialized view mancante', async () => {
    vi.spyOn(sequelize, 'query').mockResolvedValue([[{ esiste: false }], {}] as any);

    const esiti = await inizializzaInstallazione(OPZIONI);

    expect(esito(esiti, 'materialized view')).toBe('errore');
  });
});

describe('amministratoreDaAmbiente', () => {
  it('legge FIDELITY_ADMIN_* con i valori predefiniti di nome e cognome', () => {
    expect(amministratoreDaAmbiente({ FIDELITY_ADMIN_EMAIL: ' a@b.it ', FIDELITY_ADMIN_PASSWORD: 'x' })).toEqual(
      { email: 'a@b.it', password: 'x', nome: 'Amministratore', cognome: 'Sistema' });
  });

  it('senza email o password restituisce null', () => {
    expect(amministratoreDaAmbiente({ FIDELITY_ADMIN_EMAIL: 'a@b.it' })).toBeNull();
    expect(amministratoreDaAmbiente({ FIDELITY_ADMIN_PASSWORD: 'x' })).toBeNull();
  });
});
