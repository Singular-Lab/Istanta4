import type { DataFields } from '../../../../../lib/types';
import { Config } from '../../../models';
import { TraduttoreReferenze } from '../../../utils/Translator';
import { getCodiceKeyCoopfi, resolveRepartoCoopfi } from './coopfi-reparto-map';

export const COOPFI_TRACKED_FIELD_MAP: Record<string, string> = {
  'tipo_evento': 'tipoEvento',
  'Descrizioni.Peso': 'peso',
  'prestazione': 'prestazione',
  'Format_PdvRif': 'formatPdvRif',
  'format_1': 'format1',
  'format_2': 'format2',
  'txt_sconto': 'txtSconto',
  'N_Punti': 'nPunti',
  'N_pezzi_soci': 'nPezziSoci',
  'prezzo_continuo': 'prezzoContinuo',
  'prezzo': 'prezzoPromo',
  'prezzo_promo_kgl': 'prezzoPromoKgl',
};

function extractCodice(record: Record<string, unknown>): string {
  const direct = record['Referenza.Codice'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const ref = record.Referenza as Record<string, unknown> | undefined;
  const nested = ref?.Codice;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  return '—';
}

function composeDescrizione(fields: DataFields): string {
  const d1 = typeof fields.descrizione_uno === 'string' ? fields.descrizione_uno.trim() : '';
  const d2 = typeof fields.descrizione_due === 'string' ? fields.descrizione_due.trim() : '';
  return [d1, d2].filter(Boolean).join(' ').trim();
}

type CreateCoopfiNormalizerOptions = {
  lookupRecords?: DataFields[];
};

/**
 * Factory: carica config una volta sola, restituisce un normalizzatore sincrono.
 * Ogni record ISTANTA (AnalisiMomentoRecord) viene tradotto nei campi rinominati
 * via TraduttoreReferenze, con tipo/subCodici/reparto/codiceKey aggiunti esplicitamente.
 */
export async function createCoopfiNormalizer(
  options?: CreateCoopfiNormalizerOptions
): Promise<(record: DataFields) => DataFields> {
  const config = await Config.findOne();
  const dataFieldsRefs: { expected_input: string; expected_output: string }[] =
    Array.isArray(config?.webpliant?.data_fields_refs)
      ? config!.webpliant.data_fields_refs.filter(
        (m): m is { expected_input: string; expected_output: string } =>
          typeof m.expected_input === 'string' && typeof m.expected_output === 'string'
      )
      : [];

  // config mappings take priority; COOPFI_TRACKED_FIELD_MAP fills remaining keys
  const mergedMap = [
    ...dataFieldsRefs,
    ...Object.entries(COOPFI_TRACKED_FIELD_MAP)
      .filter(([inp]) => !dataFieldsRefs.some(m => m.expected_input === inp))
      .map(([expected_input, expected_output]) => ({ expected_input, expected_output })),
  ];

  const descrizioneByCodice = new Map<string, string>();
  for (const raw of options?.lookupRecords ?? []) {
    const codice = extractCodice(raw);
    if (codice === '—') continue;
    const translated = TraduttoreReferenze.traduci_data_fields(raw as unknown as DataFields, mergedMap);
    const descrizione = composeDescrizione(translated);
    if (descrizione && !descrizioneByCodice.has(codice)) {
      descrizioneByCodice.set(codice, descrizione);
    }
  }

  return (record: DataFields): DataFields => {
    const codice = extractCodice(record);
    const scattoRaw = typeof record['Scatto.CodiceGruppo'] === 'string'
      ? (record['Scatto.CodiceGruppo'] as string).trim() : '';
    const scattoCodice = scattoRaw || codice;
    const tipo: 'singolo' | 'gruppo' = (scattoRaw && scattoRaw !== codice) ? 'gruppo' : 'singolo';
    const subCodici = tipo === 'gruppo' && scattoRaw
      ? scattoRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((subCodice) => ({ codice: subCodice, descrizione: descrizioneByCodice.get(subCodice) ?? '' }))
      : undefined;

    const translated = TraduttoreReferenze.traduci_data_fields(record as unknown as DataFields, mergedMap);
    translated['codice_referenza'] = codice;
    translated['scatto_codice'] = scattoCodice;
    translated['tipo'] = tipo;
    if (subCodici !== undefined) translated['subCodici'] = subCodici;
    translated['reparto_business'] = resolveRepartoCoopfi(record);
    translated['codiceKey'] = getCodiceKeyCoopfi(record);
    return translated;
  };
}
