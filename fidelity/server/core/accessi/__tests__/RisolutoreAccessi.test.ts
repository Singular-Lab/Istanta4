import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { PERMESSI } from '../../../../lib/accessi/catalogo';

vi.mock('../../repositories/PermessiRepository', () => ({ PermessiRepository: class { } }));
vi.mock('../versionePermessi', () => ({ leggiVersionePermessi: vi.fn(async () => 1) }));

import { combinaLivelli, RisolutoreAccessi } from '../RisolutoreAccessi';
import type { ContestoAccesso } from '../contestoAccesso';

type Riga = { codice: string; abilitato: boolean };
const righe = (valori: Record<string, boolean>): Riga[] => Object.entries(valori).map(([codice, abilitato]) => ({ codice, abilitato }));

/** Fonte finta: livelli per (tipo, sotto-ruolo) e per (gdo, tipo, sotto-ruolo). */
const creaFonte = (dati: {
  tipo?: Record<string, boolean>;
  sottoRuolo?: Record<string, boolean>;
  gdo?: Record<string, boolean>;
  gdoSottoRuolo?: Record<string, boolean>;
}) => ({
  findPermessiPerRuolo: vi.fn(async (_tipo: TIPO_UTENTI, idRuolo?: string) => righe(idRuolo ? dati.sottoRuolo ?? {} : dati.tipo ?? {})),
  findPermessiOverrideGdo: vi.fn(async (_gdo: string, _tipo: TIPO_UTENTI, idRuolo?: string) => righe(idRuolo ? dati.gdoSottoRuolo ?? {} : dati.gdo ?? {})),
});

const contesto = (parziale: Partial<ContestoAccesso> = {}): ContestoAccesso => ({
  idUtente: 'u1',
  tipo: TIPO_UTENTI.GDO,
  idGdo: 'coop-firenze',
  idRuoloGdo: 'admin',
  superadmin: false,
  ...parziale,
});

describe('RisolutoreAccessi', () => {
  it('applica i livelli dal tipo al sotto-ruolo con override della GDO: vince il più specifico', async () => {
    const fonte = creaFonte({
      tipo: { [PERMESSI.PROMO.VISUALIZZA]: true, [PERMESSI.PROMO.ELIMINA]: true, [PERMESSI.WHATSAPP.VISUALIZZA_CAMPAGNE]: true, [PERMESSI.WHATSAPP.INVIA_CAMPAGNA]: true },
      gdo: { [PERMESSI.PROMO.ELIMINA]: false, [PERMESSI.WHATSAPP.INVIA_CAMPAGNA]: false },
      gdoSottoRuolo: { [PERMESSI.PROMO.ELIMINA]: true },
    });
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    const permessi = await risolutore.permessiDi(contesto());

    expect(permessi.has(PERMESSI.PROMO.ELIMINA)).toBe(true); // override GDO + sotto-ruolo
    expect(permessi.has(PERMESSI.WHATSAPP.INVIA_CAMPAGNA)).toBe(false); // override GDO
  });

  it('senza GDO l\'override non conta: un utente di un\'altra GDO può avviare la campagna', async () => {
    const fonte = creaFonte({
      tipo: { [PERMESSI.WHATSAPP.VISUALIZZA_CAMPAGNE]: true, [PERMESSI.WHATSAPP.INVIA_CAMPAGNA]: true },
      gdo: { [PERMESSI.WHATSAPP.INVIA_CAMPAGNA]: false },
    });
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    expect(await risolutore.puo(contesto({ idGdo: null, idRuoloGdo: null }), PERMESSI.WHATSAPP.INVIA_CAMPAGNA)).toBe(true);
  });

  it('un\'azione senza l\'accesso all\'area è negata', async () => {
    const fonte = creaFonte({ tipo: { [PERMESSI.KIT_RUNTIME.PUBBLICA]: true } });
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    expect(await risolutore.puo(contesto({ idRuoloGdo: null }), PERMESSI.KIT_RUNTIME.PUBBLICA)).toBe(false);
  });

  it('un permesso di sistema salvato per un ruolo non vale', async () => {
    const fonte = creaFonte({ tipo: { [PERMESSI.SISTEMA.GESTISCI_ACCESSI]: true } });
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    expect(await risolutore.puo(contesto({ tipo: TIPO_UTENTI.AGENZIA, idRuoloGdo: null }), PERMESSI.SISTEMA.GESTISCI_ACCESSI)).toBe(false);
  });

  it('il Superadmin ha tutti i permessi, compresi quelli di sistema, senza leggere il database', async () => {
    const fonte = creaFonte({});
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    const superadmin = contesto({ tipo: TIPO_UTENTI.SUPERADMIN, superadmin: true });
    expect(await risolutore.puo(superadmin, PERMESSI.SISTEMA.LOG)).toBe(true);
    expect(await risolutore.puoAprire(superadmin, '/gestione-hub')).toBe(true);
    expect(fonte.findPermessiPerRuolo).not.toHaveBeenCalled();
  });

  it('ricalcola quando la versione dei permessi cambia, altrimenti usa la cache', async () => {
    const dati = { tipo: { [PERMESSI.PROMO.VISUALIZZA]: true } as Record<string, boolean> };
    const fonte = creaFonte(dati);
    let versione = 1;
    const risolutore = new RisolutoreAccessi(fonte as any, async () => versione);
    const utente = contesto({ idGdo: null, idRuoloGdo: null });

    expect(await risolutore.puo(utente, PERMESSI.PROMO.VISUALIZZA)).toBe(true);
    dati.tipo[PERMESSI.PROMO.VISUALIZZA] = false;
    expect(await risolutore.puo(utente, PERMESSI.PROMO.VISUALIZZA)).toBe(true); // stessa versione: cache
    versione = 2;
    expect(await risolutore.puo(utente, PERMESSI.PROMO.VISUALIZZA)).toBe(false);
  });

  it('decide le pagine con lo stesso calcolo delle azioni', async () => {
    const fonte = creaFonte({ tipo: { [PERMESSI.PROMO.VISUALIZZA]: true } });
    const risolutore = new RisolutoreAccessi(fonte as any, async () => 1);
    const utente = contesto({ idGdo: null, idRuoloGdo: null });
    expect(await risolutore.puoAprire(utente, '/promozioni/in-corso')).toBe(true);
    expect(await risolutore.puoAprire(utente, '/promozioni/nuova')).toBe(false);
    expect(await risolutore.puoAprire(utente, '/ods-in-corso')).toBe(false);
  });
});

describe('combinaLivelli', () => {
  it('scarta codici sconosciuti rimasti nel database', () => {
    const vuoto = new Map<string, boolean>();
    expect(combinaLivelli({
      tipo: new Map([['pagina.dashboard', true], [PERMESSI.FILE.DOWNLOAD, true]]),
      sottoRuolo: vuoto, gdo: vuoto, gdoSottoRuolo: vuoto,
    })).toEqual([PERMESSI.FILE.DOWNLOAD]);
  });
});
