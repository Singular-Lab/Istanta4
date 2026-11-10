import { describe, expect, it } from 'vitest';
import { chiaviDelPercorso, espressioneCampo, repartiSalvatiDa } from '../ImpostazioniGdoRepository';

// I percorsi della config degli insight tradotti in SQL per i reparti delle Impostazioni GDO: le
// stesse alternative di campiInsights.valoreCampo, con ogni chiave nelle sostituzioni.

describe('chiaviDelPercorso', () => {
  it('prima la chiave piu\' lunga, come valoreCampo: "Referenza.Codice" intera, poi le parti', () => {
    expect(chiaviDelPercorso(['reparto'])).toEqual([['reparto']]);
    expect(chiaviDelPercorso(['Referenza', 'Codice'])).toEqual([['Referenza.Codice'], ['Referenza', 'Codice']]);
    expect(chiaviDelPercorso(['a', 'b', 'c'])).toEqual([['a.b.c'], ['a.b', 'c'], ['a', 'b.c'], ['a', 'b', 'c']]);
  });
});

describe('espressioneCampo', () => {
  it('un percorso nei data_fields: le chiavi nelle sostituzioni, solo testi e numeri, vuoto come null', () => {
    const sostituzioni: Record<string, unknown> = {};

    const sql = espressioneCampo('data_fields.reparto', sostituzioni, 'codice');

    expect(sostituzioni).toEqual({ codice0: 'reparto' });
    expect(sql).toBe("COALESCE(NULLIF(btrim(CASE WHEN jsonb_typeof(r.data_fields -> :codice0) IN ('string', 'number') THEN r.data_fields -> :codice0 #>> '{}' END), ''))");
  });

  it('piu\' alternative in ordine, anche dataFields e colonne note; le altre si ignorano', () => {
    const sostituzioni: Record<string, unknown> = {};

    const sql = espressioneCampo(['meccanica', 'dataFields.Referenza.Reparto', 'colonna_ignota', 'altro.campo', ''], sostituzioni, 'p');

    expect(sostituzioni).toEqual({ p0: 'Referenza.Reparto', p1: 'Referenza', p2: 'Reparto' });
    expect(sql?.startsWith("COALESCE(NULLIF(btrim(r.meccanica::text), ''), ")).toBe(true);
    expect(sql).toContain('r.data_fields -> :p0)');
    expect(sql).toContain('r.data_fields -> :p1 -> :p2)');
    // Nessun nome di colonna o chiave dalla config finisce nel testo SQL
    expect(sql).not.toContain('colonna_ignota');
    expect(sql).not.toContain('Referenza');
  });

  it('nessuna alternativa utilizzabile: null', () => {
    expect(espressioneCampo(null, {}, 'p')).toBeNull();
    expect(espressioneCampo(['colonna_ignota', 'data_fields'], {}, 'p')).toBeNull();
    expect(espressioneCampo('data_fields.a.b.c.d.e', {}, 'p')).toBeNull();
  });
});

describe('repartiSalvatiDa', () => {
  it('le voci con un codice, ripulite; il resto si scarta', () => {
    expect(repartiSalvatiDa([
      { codice: ' 01 ', nomeDati: 'DROGHERIA', nomeMarketing: ' Dispensa ', colore: '#f97316' },
      { codice: '05', nomeMarketing: '', colore: 3 },
      { codice: '' },
      'testo',
      null,
    ])).toEqual([
      { codice: '01', nomeDati: 'DROGHERIA', nomeMarketing: 'Dispensa', colore: '#f97316' },
      { codice: '05', nomeDati: '', nomeMarketing: null, colore: null },
    ]);
    expect(repartiSalvatiDa(null)).toEqual([]);
  });
});
