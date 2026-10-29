import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaTipoExport } from '../../../__tests__/integrazione/dati';
import type { FilterConditionDTO } from '../../dto';
import { ExternalApiService } from '../ExternalApiService';

// File restituiti al Plugin da POST /api/external/files, sul PostgreSQL vero: i filtri sui metadati
// diventano SQL su JSONB, e solo il database dice se quell'SQL seleziona i file giusti.
describeConDatabase('ExternalApiService.getFiles sul database', () => {
  usaDatabase();
  const service = new ExternalApiService();
  let vol = '';
  let web = '';

  const nomi = async (params: { filters?: FilterConditionDTO[][]; tipo_export?: string[] }) =>
    (await service.getFiles(params)).files.map(f => f.nome).sort();

  const filtro = (field: string, operator: FilterConditionDTO['operator'], value: string): FilterConditionDTO =>
    ({ field, operator, value });

  beforeEach(async () => {
    await svuotaTabelle('files_runtime', 'tipi_export');
    vol = await creaTipoExport('VOL');
    web = await creaTipoExport('WEB');
    const correggo = await creaTipoExport('CORREGGO');
    await creaFile({ nome: 'vol-orto', tipoExport: vol, meta: { reparto: 'Ortofrutta', pagina: '3' } });
    await creaFile({ nome: 'vol-carne', tipoExport: vol, meta: { reparto: 'Macelleria', pagina: '12' } });
    await creaFile({ nome: 'web-orto', tipoExport: web, meta: { reparto: 'Ortofrutta', pagina: '3' } });
    await creaFile({ nome: 'correggo-orto', tipoExport: correggo, meta: { reparto: 'Ortofrutta' } });
    await creaFile({ nome: 'vol-errore', tipoExport: vol, meta: { reparto: 'Ortofrutta' }, errore: 'conversione fallita' });
  });

  it('senza filtri restituisce i file senza errori, dal piu recente', async () => {
    const risposta = await service.getFiles({});

    expect(risposta.files.map(f => f.nome)).not.toContain('vol-errore');
    expect(risposta.conteggio).toBe(4);
  });

  it('con un tipo di export restituisce solo quel tipo', async () => {
    expect(await nomi({ tipo_export: ['VOL'] })).toEqual(['vol-carne', 'vol-orto']);
  });

  it('tipo di export e filtro sui metadati insieme', async () => {
    expect(await nomi({ tipo_export: ['VOL'], filters: [[filtro('reparto', 'equals', 'Ortofrutta')]] })).toEqual(['vol-orto']);
  });

  it('un tipo di export non riconosciuto non restituisce file, senza filtri sui metadati', async () => {
    expect(await nomi({ tipo_export: ['VOLX'] })).toEqual([]);
  });

  it('un tipo di export non riconosciuto non restituisce file, anche con filtri sui metadati', async () => {
    // Prima la clausola sul tipo spariva e arrivavano tutti i file che soddisfano il filtro
    expect(await nomi({ tipo_export: ['VOLX'], filters: [[filtro('reparto', 'equals', 'Ortofrutta')]] })).toEqual([]);
  });

  it('il tipo CORREGGO non si chiede: equivale a un tipo non riconosciuto', async () => {
    expect(await nomi({ tipo_export: ['CORREGGO'] })).toEqual([]);
    expect(await nomi({ tipo_export: ['CORREGGO'], filters: [[filtro('reparto', 'equals', 'Ortofrutta')]] })).toEqual([]);
  });

  it('not_equals tiene anche i file senza quel campo', async () => {
    await creaFile({ nome: 'vol-senza-reparto', tipoExport: vol, meta: { pagina: '1' } });

    expect(await nomi({ tipo_export: ['VOL'], filters: [[filtro('reparto', 'not_equals', 'Ortofrutta')]] }))
      .toEqual(['vol-carne', 'vol-senza-reparto']);
  });

  it('in e contains, quest\'ultimo senza distinguere maiuscole', async () => {
    expect(await nomi({ filters: [[filtro('reparto', 'in', 'Macelleria, Pescheria')]] })).toEqual(['vol-carne']);
    expect(await nomi({ tipo_export: ['VOL', 'WEB'], filters: [[filtro('reparto', 'contains', 'ORTO')]] })).toEqual(['vol-orto', 'web-orto']);
  });

  it('greater_than confronta come numeri, non come testo', async () => {
    // Come testo "3" > "12"; come numeri no
    expect(await nomi({ tipo_export: ['VOL'], filters: [[filtro('pagina', 'greater_than', '5')]] })).toEqual(['vol-carne']);
  });

  it('i gruppi sono in OR, le condizioni di un gruppo in AND', async () => {
    const filters = [
      [filtro('reparto', 'equals', 'Ortofrutta'), filtro('pagina', 'equals', '3')],
      [filtro('reparto', 'equals', 'Macelleria')],
    ];

    expect(await nomi({ tipo_export: ['VOL'], filters })).toEqual(['vol-carne', 'vol-orto']);
  });

  it('un valore numerico del Plugin si confronta come testo', async () => {
    const numerico = { field: 'pagina', operator: 'equals', value: 3 } as unknown as FilterConditionDTO;

    expect(await nomi({ tipo_export: ['VOL', 'WEB'], filters: [[numerico]] })).toEqual(['vol-orto', 'web-orto']);
  });

  it('getFilesFieldValues: valori distinti del campo, il piu frequente prima', async () => {
    expect(await service.getFilesFieldValues('reparto')).toEqual(['Ortofrutta', 'Macelleria']);
  });
});
