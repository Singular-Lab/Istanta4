import { z } from 'zod';
import type { EsitoVerificaConfigurazione } from '../impostazioniGdo/tipi';
import { DATI_PRODOTTO_SCHEDA, DATI_TECNICI_SCHEDA } from './scheda';

/**
 * Verifica della configurazione degli insight del volantino (flyerInsightsConfig.json, o quella
 * salvata per la GDO nelle Impostazioni GDO), condivisa fra server e client. Il modello e' il tipo
 * FlyerInsightsConfig del client (src/types/flyerInsights.ts).
 *
 * Tollerante: le chiavi sconosciute restano, quasi tutto e' facoltativo (la scheda degli insight
 * ha i suoi valori predefiniti). Severa sui tipi di cio' che il codice usa davvero: i percorsi dei
 * campi (testo o elenco di testi), l'anagrafica dei reparti (codice e descrizione), i groupBy, il
 * tipo e i colori delle strategie di colore, le marche del distributore, i dati della scheda del
 * volantino (scheda.ts). Serve almeno la mappatura
 * dei campi delle referenze (dataMapping.referenzaFields).
 *
 * I messaggi sono in italiano, con il percorso puntato del campo ("reparti.colorStrategy.type").
 */

/** Le sezioni che la configurazione puo' avere, nell'ordine in cui si elencano. */
export const SEZIONI_CONFIGURAZIONE_INSIGHT = ['dataMapping', 'reparti', 'meccaniche', 'pagine', 'mappa', 'marche', 'volantino'] as const;

const COLORE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const testo = z.string();
const testoNonVuoto = z.string().trim().min(1, { error: 'non puo\' essere vuoto' });
const colore = z.string().regex(COLORE, { error: 'deve essere un colore esadecimale come #1a2b3c' });
const elencoDiTesti = z.array(testo);

const voceColore = z.looseObject({ hex: colore, tw: testo.optional() });

const strategiaStatica = z.looseObject({
  type: z.literal('static'),
  map: z.record(z.string(), voceColore),
  default: voceColore.optional(),
});

const strategiaPerSchema = z.looseObject({
  type: z.literal('pattern'),
  matchers: z.array(z.looseObject({ patterns: z.array(testoNonVuoto), hex: colore, tw: testo.optional() })),
  default: voceColore.optional(),
});

const strategiaColore = z.discriminatedUnion('type', [strategiaStatica, strategiaPerSchema], {
  error: 'deve essere "static" o "pattern"',
});

const raggruppamento = z.looseObject({
  field: testoNonVuoto,
  descriptionField: testo.optional(),
});

const sezioneRiepilogo = z.looseObject({
  enabled: z.boolean().optional(),
  title: testo.optional(),
  groupBy: raggruppamento.optional(),
  chart: z.looseObject({ type: testo.optional() }).optional(),
  colorStrategy: strategiaColore.optional(),
  fields: z.looseObject({
    labelField: testo.optional(),
    labelFallback: testo.optional(),
    labelPrefix: testo.optional(),
    valueField: testo.optional(),
    valueLabel: testo.optional(),
    secondaryValueField: testo.optional(),
    secondaryValueLabel: testo.optional(),
    badgeField: testo.optional(),
    colorField: testo.optional(),
  }).optional(),
  display: z.looseObject({ showLegend: z.boolean().optional() }).optional(),
  emptyState: z.looseObject({ icon: testo.optional(), message: testo.optional() }).optional(),
});

const voceColoreMappa = z.looseObject({ hex: colore, label: testo.optional() });

const mappa = z.looseObject({
  enabled: z.boolean().optional(),
  title: testo.optional(),
  colorSource: testo.optional(),
  colorField: testo.optional(),
  colorStrategy: z.looseObject({
    type: z.literal('static'),
    map: z.record(z.string(), voceColoreMappa),
    default: voceColoreMappa.optional(),
  }).optional(),
  display: z.looseObject({ showLegend: z.boolean().optional() }).optional(),
  infoPanel: z.looseObject({}).optional(),
  emptyState: z.looseObject({ icon: testo.optional(), message: testo.optional() }).optional(),
});

const percorsoCampo = z.union([testoNonVuoto, z.array(testoNonVuoto).min(1)], {
  error: 'deve essere un percorso (testo) o un elenco di percorsi',
});

const sceltaFra = (valori: readonly string[]) =>
  z.enum(valori as [string, ...string[]], { error: `deve essere uno di: ${valori.join(', ')}` });

const schedaVolantino = z
  .looseObject({
    datiProdotto: z.array(sceltaFra(DATI_PRODOTTO_SCHEDA)).optional(),
    dettagliTecnici: z.array(sceltaFra(DATI_TECNICI_SCHEDA)).optional(),
  })
  .superRefine((scheda, contesto) => {
    // Un dato sta in vista o nei dettagli tecnici, non in tutti e due
    const inVista = new Set<string>(scheda.datiProdotto ?? []);
    (scheda.dettagliTecnici ?? []).forEach((dato, posto) => {
      if (inVista.has(dato)) {
        contesto.addIssue({
          code: 'custom',
          path: ['dettagliTecnici', posto],
          message: `"${dato}" e' gia' fra i dati in vista (datiProdotto): un dato sta in una lista sola`,
        });
      }
    });
  });

const volantino = z.looseObject({ scheda: schedaVolantino.optional() });

const mappaturaDati = z.looseObject({
  referenzaFields: z.record(z.string(), percorsoCampo),
  referenzaDescriptionFields: elencoDiTesti.optional(),
  reparti: z.array(z.looseObject({ codice: testoNonVuoto, descrizione: testoNonVuoto })).optional(),
});

export const schemaConfigurazioneInsight = z.looseObject({
  dataMapping: mappaturaDati,
  reparti: sezioneRiepilogo.optional(),
  meccaniche: sezioneRiepilogo.optional(),
  pagine: sezioneRiepilogo.optional(),
  mappa: mappa.optional(),
  marche: z.looseObject({ distributore: z.array(testoNonVuoto).optional() }).optional(),
  volantino: volantino.optional(),
});

const NOMI_TIPI: Readonly<Record<string, string>> = {
  string: 'un testo',
  number: 'un numero',
  boolean: 'vero o falso (true/false)',
  object: 'un oggetto',
  array: 'un elenco',
  record: 'un oggetto',
};

/** I messaggi di zod in italiano; quelli scritti nello schema hanno la precedenza. */
function messaggioItaliano(problema: z.core.$ZodRawIssue): string {
  switch (problema.code) {
    case 'invalid_type':
      return problema.input === undefined
        ? 'manca: e\' obbligatorio'
        : `deve essere ${NOMI_TIPI[problema.expected] ?? problema.expected}`;
    case 'invalid_value':
      return `deve essere ${problema.values.map(valore => JSON.stringify(valore)).join(' o ')}`;
    case 'too_small':
      return problema.origin === 'array' ? 'non puo\' essere un elenco vuoto' : 'non puo\' essere vuoto';
    case 'invalid_format':
      return 'formato non valido';
    default:
      return 'valore non valido';
  }
}

const percorsoDi = (percorso: readonly PropertyKey[]): string => percorso.map(parte => String(parte)).join('.');

/**
 * Verifica una configurazione degli insight. Valida: errori vuoti e le sezioni riconosciute che ha.
 * Non valida: un errore per problema, con il percorso puntato ("" per la radice).
 */
export function verificaConfigurazioneInsight(json: unknown): EsitoVerificaConfigurazione {
  const esito = schemaConfigurazioneInsight.safeParse(json, { error: messaggioItaliano });
  if (!esito.success) {
    return {
      valida: false,
      errori: esito.error.issues.map(problema => ({ percorso: percorsoDi(problema.path), messaggio: problema.message })),
      sezioni: [],
    };
  }
  const radice = esito.data as Record<string, unknown>;
  return {
    valida: true,
    errori: [],
    sezioni: SEZIONI_CONFIGURAZIONE_INSIGHT.filter(sezione => radice[sezione] !== undefined),
  };
}
