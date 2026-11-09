/**
 * Le regioni italiane e la lettura della regione di un punto vendita stampato in un volantino
 * (spec volantini-pop, "Dettaglio di consultazione della promozione").
 *
 * Nelle liste dei volantini regione e provincia arrivano come le stampa il cliente: "EMILIA ROMAGNA"
 * o "EMILIA-ROMAGNA", la provincia come sigla ("MO") o per esteso ("GROSSETO", "MEDIO CAMPIDANO"),
 * spesso vuote. regioneDa prova, nell'ordine, la regione stampata, la provincia stampata e poi
 * regione e provincia dell'anagrafica del punto vendita abbinato.
 */

export type CodiceRegione =
  | 'VDA' | 'PIE' | 'LOM' | 'TAA' | 'VEN' | 'FVG' | 'LIG' | 'EMR' | 'TOS' | 'UMB'
  | 'MAR' | 'LAZ' | 'ABR' | 'MOL' | 'CAM' | 'PUG' | 'BAS' | 'CAL' | 'SIC' | 'SAR';

export interface Regione {
  codice: CodiceRegione;
  nome: string;
}

/** Da nord a sud. */
export const REGIONI: readonly Regione[] = [
  { codice: 'VDA', nome: "Valle d'Aosta" },
  { codice: 'PIE', nome: 'Piemonte' },
  { codice: 'LOM', nome: 'Lombardia' },
  { codice: 'TAA', nome: 'Trentino-Alto Adige' },
  { codice: 'VEN', nome: 'Veneto' },
  { codice: 'FVG', nome: 'Friuli-Venezia Giulia' },
  { codice: 'LIG', nome: 'Liguria' },
  { codice: 'EMR', nome: 'Emilia-Romagna' },
  { codice: 'TOS', nome: 'Toscana' },
  { codice: 'UMB', nome: 'Umbria' },
  { codice: 'MAR', nome: 'Marche' },
  { codice: 'LAZ', nome: 'Lazio' },
  { codice: 'ABR', nome: 'Abruzzo' },
  { codice: 'MOL', nome: 'Molise' },
  { codice: 'CAM', nome: 'Campania' },
  { codice: 'PUG', nome: 'Puglia' },
  { codice: 'BAS', nome: 'Basilicata' },
  { codice: 'CAL', nome: 'Calabria' },
  { codice: 'SIC', nome: 'Sicilia' },
  { codice: 'SAR', nome: 'Sardegna' },
];

const PER_CODICE = new Map(REGIONI.map(regione => [regione.codice, regione]));

export const isCodiceRegione = (valore: unknown): valore is CodiceRegione =>
  typeof valore === 'string' && PER_CODICE.has(valore as CodiceRegione);

/** Nome della regione, o il codice stesso se non e' una regione nota. */
export const nomeRegione = (codice: string): string => PER_CODICE.get(codice as CodiceRegione)?.nome ?? codice;

/** Maiuscole, senza accenti, solo lettere separate da uno spazio: "Forlì-Cesena" -> "FORLI CESENA". */
export const testoNormalizzato = (testo: string | null | undefined): string =>
  (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();

const ALIAS_REGIONI: Readonly<Record<CodiceRegione, readonly string[]>> = {
  VDA: ['VALLE D AOSTA', 'VAL D AOSTA', 'VALLE AOSTA', 'VALLEE D AOSTE'],
  PIE: ['PIEMONTE'],
  LOM: ['LOMBARDIA'],
  TAA: ['TRENTINO ALTO ADIGE', 'TRENTINO', 'ALTO ADIGE', 'TRENTINO SUDTIROL', 'SUDTIROL'],
  VEN: ['VENETO'],
  FVG: ['FRIULI VENEZIA GIULIA', 'FRIULI', 'FRIULI V G', 'FVG'],
  LIG: ['LIGURIA'],
  EMR: ['EMILIA ROMAGNA', 'EMILIA', 'ROMAGNA'],
  TOS: ['TOSCANA'],
  UMB: ['UMBRIA'],
  MAR: ['MARCHE'],
  LAZ: ['LAZIO'],
  ABR: ['ABRUZZO', 'ABRUZZI'],
  MOL: ['MOLISE'],
  CAM: ['CAMPANIA'],
  PUG: ['PUGLIA', 'PUGLIE'],
  BAS: ['BASILICATA', 'LUCANIA'],
  CAL: ['CALABRIA'],
  SIC: ['SICILIA'],
  SAR: ['SARDEGNA'],
};

/** Sigla, nome e altri nomi di ogni provincia, comprese le province sarde soppresse. */
const PROVINCE: ReadonlyArray<readonly [CodiceRegione, string, ...string[]]> = [
  ['PIE', 'TO', 'TORINO'], ['PIE', 'VC', 'VERCELLI'], ['PIE', 'NO', 'NOVARA'], ['PIE', 'CN', 'CUNEO'],
  ['PIE', 'AT', 'ASTI'], ['PIE', 'AL', 'ALESSANDRIA'], ['PIE', 'BI', 'BIELLA'],
  ['PIE', 'VB', 'VERBANO CUSIO OSSOLA', 'VERBANIA'],
  ['VDA', 'AO', 'AOSTA'],
  ['LOM', 'VA', 'VARESE'], ['LOM', 'CO', 'COMO'], ['LOM', 'SO', 'SONDRIO'], ['LOM', 'MI', 'MILANO'],
  ['LOM', 'BG', 'BERGAMO'], ['LOM', 'BS', 'BRESCIA'], ['LOM', 'PV', 'PAVIA'], ['LOM', 'CR', 'CREMONA'],
  ['LOM', 'MN', 'MANTOVA'], ['LOM', 'LC', 'LECCO'], ['LOM', 'LO', 'LODI'], ['LOM', 'MB', 'MONZA E BRIANZA', 'MONZA BRIANZA', 'MONZA'],
  ['TAA', 'BZ', 'BOLZANO', 'BOLZANO BOZEN', 'BOZEN'], ['TAA', 'TN', 'TRENTO'],
  ['VEN', 'VR', 'VERONA'], ['VEN', 'VI', 'VICENZA'], ['VEN', 'BL', 'BELLUNO'], ['VEN', 'TV', 'TREVISO'],
  ['VEN', 'VE', 'VENEZIA'], ['VEN', 'PD', 'PADOVA'], ['VEN', 'RO', 'ROVIGO'],
  ['FVG', 'UD', 'UDINE'], ['FVG', 'GO', 'GORIZIA'], ['FVG', 'TS', 'TRIESTE'], ['FVG', 'PN', 'PORDENONE'],
  ['LIG', 'IM', 'IMPERIA'], ['LIG', 'SV', 'SAVONA'], ['LIG', 'GE', 'GENOVA'], ['LIG', 'SP', 'LA SPEZIA', 'SPEZIA'],
  ['EMR', 'PC', 'PIACENZA'], ['EMR', 'PR', 'PARMA'], ['EMR', 'RE', 'REGGIO EMILIA', 'REGGIO NELL EMILIA'],
  ['EMR', 'MO', 'MODENA'], ['EMR', 'BO', 'BOLOGNA'], ['EMR', 'FE', 'FERRARA'], ['EMR', 'RA', 'RAVENNA'],
  ['EMR', 'FC', 'FORLI CESENA', 'FORLI'], ['EMR', 'RN', 'RIMINI'],
  ['TOS', 'MS', 'MASSA CARRARA', 'MASSA'], ['TOS', 'LU', 'LUCCA'], ['TOS', 'PT', 'PISTOIA'], ['TOS', 'FI', 'FIRENZE'],
  ['TOS', 'LI', 'LIVORNO'], ['TOS', 'PI', 'PISA'], ['TOS', 'AR', 'AREZZO'], ['TOS', 'SI', 'SIENA'],
  ['TOS', 'GR', 'GROSSETO'], ['TOS', 'PO', 'PRATO'],
  ['UMB', 'PG', 'PERUGIA'], ['UMB', 'TR', 'TERNI'],
  ['MAR', 'PU', 'PESARO E URBINO', 'PESARO URBINO', 'PESARO'], ['MAR', 'AN', 'ANCONA'], ['MAR', 'MC', 'MACERATA'],
  ['MAR', 'AP', 'ASCOLI PICENO'], ['MAR', 'FM', 'FERMO'],
  ['LAZ', 'VT', 'VITERBO'], ['LAZ', 'RI', 'RIETI'], ['LAZ', 'RM', 'ROMA'], ['LAZ', 'LT', 'LATINA'], ['LAZ', 'FR', 'FROSINONE'],
  ['ABR', 'AQ', 'L AQUILA', 'AQUILA'], ['ABR', 'TE', 'TERAMO'], ['ABR', 'PE', 'PESCARA'], ['ABR', 'CH', 'CHIETI'],
  ['MOL', 'CB', 'CAMPOBASSO'], ['MOL', 'IS', 'ISERNIA'],
  ['CAM', 'CE', 'CASERTA'], ['CAM', 'BN', 'BENEVENTO'], ['CAM', 'NA', 'NAPOLI'], ['CAM', 'AV', 'AVELLINO'], ['CAM', 'SA', 'SALERNO'],
  ['PUG', 'FG', 'FOGGIA'], ['PUG', 'BA', 'BARI'], ['PUG', 'TA', 'TARANTO'], ['PUG', 'BR', 'BRINDISI'], ['PUG', 'LE', 'LECCE'],
  ['PUG', 'BT', 'BARLETTA ANDRIA TRANI'],
  ['BAS', 'PZ', 'POTENZA'], ['BAS', 'MT', 'MATERA'],
  ['CAL', 'CS', 'COSENZA'], ['CAL', 'CZ', 'CATANZARO'], ['CAL', 'RC', 'REGGIO CALABRIA', 'REGGIO DI CALABRIA'],
  ['CAL', 'KR', 'CROTONE'], ['CAL', 'VV', 'VIBO VALENTIA'],
  ['SIC', 'TP', 'TRAPANI'], ['SIC', 'PA', 'PALERMO'], ['SIC', 'ME', 'MESSINA'], ['SIC', 'AG', 'AGRIGENTO'],
  ['SIC', 'CL', 'CALTANISSETTA'], ['SIC', 'EN', 'ENNA'], ['SIC', 'CT', 'CATANIA'], ['SIC', 'RG', 'RAGUSA'], ['SIC', 'SR', 'SIRACUSA'],
  ['SAR', 'SS', 'SASSARI'], ['SAR', 'NU', 'NUORO'], ['SAR', 'CA', 'CAGLIARI'], ['SAR', 'OR', 'ORISTANO'],
  ['SAR', 'SU', 'SUD SARDEGNA'], ['SAR', 'OT', 'OLBIA TEMPIO'], ['SAR', 'OG', 'OGLIASTRA'],
  ['SAR', 'VS', 'MEDIO CAMPIDANO'], ['SAR', 'CI', 'CARBONIA IGLESIAS'],
];

const DA_REGIONE = new Map<string, CodiceRegione>(
  REGIONI.flatMap(({ codice }) => [
    [codice, codice] as const,
    ...ALIAS_REGIONI[codice].map(alias => [alias, codice] as const),
  ])
);

const DA_PROVINCIA = new Map<string, CodiceRegione>(
  PROVINCE.flatMap(([regione, ...nomi]) => nomi.map(nome => [nome, regione] as const))
);

/** Regione da un testo di regione ("EMILIA ROMAGNA", "Emilia-Romagna", "TOS"); null se non si riconosce. */
export const regioneDaTesto = (testo: string | null | undefined): CodiceRegione | null =>
  DA_REGIONE.get(testoNormalizzato(testo)) ?? null;

/** Regione da una provincia scritta come sigla ("MO") o per esteso ("GROSSETO"); null se non si riconosce. */
export const regioneDaProvincia = (provincia: string | null | undefined): CodiceRegione | null =>
  DA_PROVINCIA.get(testoNormalizzato(provincia)) ?? null;

export interface FontiRegione {
  regione?: string | null;
  provincia?: string | null;
  regioneAnagrafica?: string | null;
  provinciaAnagrafica?: string | null;
}

/**
 * La regione di una riga stampata: prima regione e provincia come le ha stampate il volantino,
 * poi quelle dell'anagrafica del punto vendita abbinato. null quando nessuna si riconosce.
 */
export const regioneDa = (fonti: FontiRegione): CodiceRegione | null =>
  regioneDaTesto(fonti.regione) ??
  regioneDaProvincia(fonti.provincia) ??
  regioneDaTesto(fonti.regioneAnagrafica) ??
  regioneDaProvincia(fonti.provinciaAnagrafica);
