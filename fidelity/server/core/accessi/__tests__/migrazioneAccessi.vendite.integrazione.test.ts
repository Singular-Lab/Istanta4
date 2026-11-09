import { QueryTypes } from 'sequelize';
import { beforeEach, expect, it } from 'vitest';
import { PERMESSI as P, TUTTI_I_PERMESSI } from '../../../../lib/accessi/catalogo';
import { CATEGORIA_PERMESSO, RUOLO_UTENTE_GDO, TIPO_UTENTI } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { sequelize } from '../../db/SequelizeConnector';
import { PermessiRepository } from '../../repositories/PermessiRepository';
import { preparaAccessiAllAvvio, SCHEMA_ACCESSI, SCHEMA_VENDITE } from '../migrazioneAccessi';
import { creaTabellaStatoAccessi, leggiSchemaAccessi, scriviSchemaAccessi } from '../versionePermessi';

// L'import delle vendite ("analisi.importa_vendite") all'ADMIN della GDO su PostgreSQL: con i
// predefiniti di un'installazione nuova e, una volta sola, su un'installazione esistente (schema 3).
describeConDatabase('preparazione degli accessi: import delle vendite all\'ADMIN della GDO', () => {
  usaDatabase();
  const repository = new PermessiRepository();

  /** Id del sotto-ruolo GDO creato dal seed dei ruoli dopo le migrazioni. */
  const idSottoRuolo = async (ruolo: RUOLO_UTENTE_GDO): Promise<string> => {
    const righe = await sequelize.query<{ id: string }>(
      `SELECT id_ruolo_utente_gdo::text AS id FROM ruolo_utente_gdo WHERE ruolo_ruolo_utente_gdo = :ruolo`,
      { type: QueryTypes.SELECT, replacements: { ruolo } }
    );
    if (!righe[0]) throw new Error(`Sotto-ruolo GDO "${ruolo}" assente: lo crea il seed dei ruoli dopo le migrazioni`);
    return righe[0].id;
  };

  /** Il valore scritto per un livello (tipo GDO, sotto-ruolo o base); null se il livello eredita. */
  const valore = async (idRuolo: string | null, codice: string): Promise<boolean | null> => {
    const righe = await sequelize.query<{ abilitato: boolean }>(
      `SELECT pr.abilitato FROM permessi_ruolo pr JOIN permessi p USING (id_permesso)
        WHERE pr.tipo_utente = :tipo AND pr.id_ruolo_utente_gdo IS NOT DISTINCT FROM CAST(:idRuolo AS uuid) AND p.codice = :codice`,
      { type: QueryTypes.SELECT, replacements: { tipo: TIPO_UTENTI.GDO, idRuolo, codice } }
    );
    return righe.length > 0 ? righe[0].abilitato : null;
  };

  const scrivi = async (scope: { tipo: TIPO_UTENTI; idRuoloGdo?: string | null }, valori: Record<string, boolean>) => {
    const idPerCodice = await repository.allineaCatalogo([]);
    await sequelize.transaction(async (transaction) => {
      await repository.scriviLivello(
        scope,
        new Map(Object.keys(valori).map(codice => [idPerCodice.get(codice)!, valori[codice]])),
        transaction
      );
    });
  };

  beforeEach(async () => {
    await svuotaTabelle('permessi_ruolo', 'permessi_ruolo_gdo', 'permessi', 'menu_items', 'script_dati_eseguiti');
    await creaTabellaStatoAccessi();
  });

  it('installazione nuova: l\'ADMIN della GDO nasce con l\'import delle vendite, gli altri no', async () => {
    await preparaAccessiAllAvvio();

    expect(await leggiSchemaAccessi()).toBe(SCHEMA_ACCESSI);
    const admin = await idSottoRuolo(RUOLO_UTENTE_GDO.ADMIN);
    const impiegato = await idSottoRuolo(RUOLO_UTENTE_GDO.IMPIEGATO);
    expect(await valore(admin, P.ANALISI.IMPORTA_VENDITE)).toBe(true);
    // L'azione vale con l'accesso all'area, che l'ADMIN ha come ogni ruolo GDO
    expect(await valore(admin, P.ANALISI.VISUALIZZA)).toBe(true);
    expect(await valore(impiegato, P.ANALISI.IMPORTA_VENDITE)).toBe(false);
    expect(await valore(null, P.ANALISI.IMPORTA_VENDITE)).toBe(false);
  });

  it('installazione esistente allo schema 2: concede l\'import all\'ADMIN, una volta sola', async () => {
    await repository.allineaCatalogo(TUTTI_I_PERMESSI.map(p => ({
      codice: p.codice, nome: p.nome, descrizione: p.descrizione,
      categoria: p.accesso ? CATEGORIA_PERMESSO.PAGINA : CATEGORIA_PERMESSO.AZIONE, risorsa: p.area.id,
    })));
    await scriviSchemaAccessi(2);
    await scrivi({ tipo: TIPO_UTENTI.GDO }, { [P.ANALISI.VISUALIZZA]: true, [P.PROMO.VISUALIZZA]: true });
    const admin = await idSottoRuolo(RUOLO_UTENTE_GDO.ADMIN);
    const impiegato = await idSottoRuolo(RUOLO_UTENTE_GDO.IMPIEGATO);

    await preparaAccessiAllAvvio();

    expect(await leggiSchemaAccessi()).toBe(SCHEMA_VENDITE);
    expect(await valore(admin, P.ANALISI.IMPORTA_VENDITE)).toBe(true);
    expect(await valore(impiegato, P.ANALISI.IMPORTA_VENDITE)).toBeNull();
    expect(await valore(null, P.ANALISI.IMPORTA_VENDITE)).toBeNull();

    // L'amministratore lo toglie: ai riavvii resta tolto
    await scrivi({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: admin }, { [P.ANALISI.IMPORTA_VENDITE]: false });
    await preparaAccessiAllAvvio();
    expect(await valore(admin, P.ANALISI.IMPORTA_VENDITE)).toBe(false);
  });

  it('un valore deciso prima dello schema 3 resta', async () => {
    await repository.allineaCatalogo(TUTTI_I_PERMESSI.map(p => ({
      codice: p.codice, nome: p.nome, descrizione: p.descrizione,
      categoria: p.accesso ? CATEGORIA_PERMESSO.PAGINA : CATEGORIA_PERMESSO.AZIONE, risorsa: p.area.id,
    })));
    await scriviSchemaAccessi(2);
    const admin = await idSottoRuolo(RUOLO_UTENTE_GDO.ADMIN);
    await scrivi({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: admin }, { [P.ANALISI.IMPORTA_VENDITE]: false });

    await preparaAccessiAllAvvio();

    expect(await valore(admin, P.ANALISI.IMPORTA_VENDITE)).toBe(false);
  });
});
