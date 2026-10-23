import { cella, numero } from "../../services/importPuntiVendita.js";
import { normalizePuntoVenditaText } from "../../utils/puntoVenditaNormalization.js";
import type { AvvisoImportPuntoVenditaDTO } from "../../dto/PuntoVenditaDTO.js";
import type { ImportPuntiVenditaAgenzia } from "../types.js";

/*
 * Tracciato del file punti vendita di CONAD CNO ("Elenco Muri"):
 * - il foglio dei muri attivi (Muro, Nome, Via, Nr, Citta, cap, Prov, Regione, Insegna, Tel., Fax., Tipo Pdv)
 *   e quello da importare, una riga per muro;
 * - il foglio dei muri GOLD con ANACAN da l'id ANACAN di ciascun muro.
 * Il PV si riconosce dall'id ANACAN e, quando manca, dal codice Muro.
 * Insegne (decisione del cliente): alcune non sono punti vendita da importare, sei corrispondono
 * a un canale di FP, tutte le altre le inserisce l'utente a mano scegliendo canale e area.
 * Le intestazioni si confrontano senza maiuscole, accenti, punteggiatura e spazi ("Cod. ANACAN" = "cod anacan").
 */
const COLONNE = {
  muro: ["muro", "codice muro"],
  idAnacan: ["id anacan", "anacan", "cod anacan", "codice anacan"],
  nome: ["nome pdv", "denominazione", "nome", "descrizione"],
  ragioneSociale: ["ragione sociale"],
  indirizzo: ["indirizzo"],
  via: ["via"],
  civico: ["nr", "civico", "numero civico"],
  cap: ["cap"],
  citta: ["comune", "localita", "citta"],
  provincia: ["provincia", "prov"],
  regione: ["regione"],
  telefono: ["telefono", "tel"],
  canale: ["insegna", "canale"],
  area: ["area", "zona"],
  tipoPdv: ["tipo pdv", "tipo punto vendita"],
  lat: ["latitudine", "lat"],
  lon: ["longitudine", "lon"],
};

/** Insegne che non si importano affatto. */
const INSEGNE_ESCLUSE = ["E_Commerce", "No insegna - altri", "Bistrot", "Distributore", "Ottica", "Bar"];

/** Insegna CONAD CNO → codice del canale in FP (il confronto ignora le maiuscole). */
const INSEGNE: Record<string, string> = {
  "CONAD Ins.": "cn",
  "TuDay Conad": "tuday",
  "CONAD City": "cy",
  "Margherita": "margherita",
  "Spazio Conad": "sc",
  "SuperStore": "ss",
};

/** Lettera del "Tipo Pdv" che ci si aspetta per ogni canale: se non coincide, il dato e dubbio. */
const TIPO_PDV_ATTESO: Record<string, string> = { cn: "A", tuday: "L", cy: "L", margherita: "B", sc: "I", ss: "S" };

/** Regione del file → codice dell'area in FP. */
const REGIONI: Record<string, string> = {
  "Emilia-Romagna": "EM",
  "Lazio": "LA",
  "Liguria": "LI",
  "Piemonte": "PI",
  "Sardegna": "SA",
  "Toscana": "TO",
  "Valle d'Aosta": "AO",
  // Nel file la regione compare anche senza apostrofo
  "Valle d Aosta": "AO",
};

/** Provincia per esteso → sigla, comprese le denominazioni soppresse ancora presenti nei dati. */
const PROVINCE: Record<string, string> = {
  "Agrigento": "AG", "Alessandria": "AL", "Ancona": "AN", "Aosta": "AO", "Arezzo": "AR", "Ascoli Piceno": "AP",
  "Asti": "AT", "Avellino": "AV", "Bari": "BA", "Barletta-Andria-Trani": "BT", "Belluno": "BL", "Benevento": "BN",
  "Bergamo": "BG", "Biella": "BI", "Bologna": "BO", "Bolzano": "BZ", "Brescia": "BS", "Brindisi": "BR",
  "Cagliari": "CA", "Caltanissetta": "CL", "Campobasso": "CB", "Caserta": "CE", "Catania": "CT", "Catanzaro": "CZ",
  "Chieti": "CH", "Como": "CO", "Cosenza": "CS", "Cremona": "CR", "Crotone": "KR", "Cuneo": "CN", "Enna": "EN",
  "Fermo": "FM", "Ferrara": "FE", "Firenze": "FI", "Foggia": "FG", "Forli-Cesena": "FC", "Frosinone": "FR",
  "Genova": "GE", "Gorizia": "GO", "Grosseto": "GR", "Imperia": "IM", "Isernia": "IS", "La Spezia": "SP",
  "L'Aquila": "AQ", "Latina": "LT", "Lecce": "LE", "Lecco": "LC", "Livorno": "LI", "Lodi": "LO", "Lucca": "LU",
  "Macerata": "MC", "Mantova": "MN", "Massa Carrara": "MS", "Matera": "MT", "Messina": "ME", "Milano": "MI",
  "Modena": "MO", "Monza e Brianza": "MB", "Napoli": "NA", "Novara": "NO", "Nuoro": "NU", "Oristano": "OR",
  "Padova": "PD", "Palermo": "PA", "Parma": "PR", "Pavia": "PV", "Perugia": "PG", "Pesaro e Urbino": "PU",
  "Pescara": "PE", "Piacenza": "PC", "Pisa": "PI", "Pistoia": "PT", "Pordenone": "PN", "Potenza": "PZ",
  "Prato": "PO", "Ragusa": "RG", "Ravenna": "RA", "Reggio Calabria": "RC", "Reggio Emilia": "RE", "Rieti": "RI",
  "Rimini": "RN", "Roma": "RM", "Rovigo": "RO", "Salerno": "SA", "Sassari": "SS", "Savona": "SV", "Siena": "SI",
  "Siracusa": "SR", "Sondrio": "SO", "Sud Sardegna": "SU", "Taranto": "TA", "Teramo": "TE", "Terni": "TR",
  "Torino": "TO", "Trapani": "TP", "Trento": "TN", "Treviso": "TV", "Trieste": "TS", "Udine": "UD", "Varese": "VA",
  "Venezia": "VE", "Verbano-Cusio-Ossola": "VB", "Vercelli": "VC", "Verona": "VR", "Vibo Valentia": "VV",
  "Vicenza": "VI", "Viterbo": "VT",
};

/** Denominazioni che non sono una provincia attuale: si riconducono, ma il dato va guardato. */
const PROVINCE_DA_CORREGGERE: Record<string, string> = {
  "Olbia-Tempio": "SS",
  "Carbonia - Iglesias": "SU",
  "Medio Campidano": "SU",
  "Ogliastra": "NU",
  "Civitavecchia": "RM",
};

// Stessa regola del modello punti_vendita: un telefono non valido farebbe scartare tutto il PV
const TELEFONO = /^[\+]?[0-9\s\-\(\)]{8,20}$/;

const n = normalizePuntoVenditaText;
const cerca = (tabella: Record<string, string>, valore: string) =>
  Object.entries(tabella).find(([voce]) => n(voce) === n(valore))?.[1];
/** "3 - Sardegna" (codici GOLD) e "Sardegna" sono la stessa regione/insegna. */
const senzaCodice = (valore: string) => valore.replace(/^\s*\d+\s*-\s*/, "").trim();

/** Id ANACAN validi di un valore di cella: 0, vuoti e non numerici non sono id. */
function idAnacan(valore: unknown): string | undefined {
  const testo = String(valore ?? "").trim();
  return /^\d+$/.test(testo) && Number(testo) > 0 ? String(Number(testo)) : undefined;
}

const intestazioni = (righe: Record<string, unknown>[]) => new Set(Object.keys(righe[0] ?? {}).map(n));
const haColonne = (righe: Record<string, unknown>[], ...colonne: string[][]) =>
  colonne.every(alias => alias.some(a => intestazioni(righe).has(n(a))));

/**
 * Foglio dei muri da importare (quello con Muro, Insegna e indirizzo; il primo, se piu d'uno) e
 * id ANACAN per muro dal foglio GOLD. Un muro con piu id ANACAN prende il piu alto, segnalando gli altri.
 */
function leggiFileConadCno(fogli: Record<string, Record<string, unknown>[]>): Record<string, unknown>[] {
  const elenchi = Object.values(fogli).filter(righe => righe.length > 0);
  const daImportare =
    elenchi.find(r => haColonne(r, COLONNE.muro, COLONNE.canale, COLONNE.via)) ??
    elenchi.find(r => haColonne(r, COLONNE.muro, COLONNE.canale)) ??
    elenchi[0] ??
    [];
  const anacanPerMuro = new Map<string, Set<string>>();
  for (const righe of elenchi) {
    if (righe === daImportare || !haColonne(righe, COLONNE.muro, COLONNE.idAnacan)) continue;
    for (const riga of righe) {
      const muro = cella(riga, ...COLONNE.muro);
      const id = idAnacan(cella(riga, ...COLONNE.idAnacan));
      if (!muro || !id) continue;
      anacanPerMuro.set(muro, (anacanPerMuro.get(muro) ?? new Set()).add(id));
    }
  }
  return daImportare.map(riga => {
    const muro = cella(riga, ...COLONNE.muro);
    const proprio = idAnacan(cella(riga, ...COLONNE.idAnacan));
    const daGold = [...(anacanPerMuro.get(muro) ?? [])].sort((a, b) => Number(b) - Number(a));
    const tutti = [...new Set([...(proprio ? [proprio] : []), ...daGold])];
    // __rowNum__ di SheetJS non e enumerabile: va ricopiato perche l'anteprima mostri la riga giusta
    return { ...riga, __rowNum__: riga.__rowNum__, "id anacan": tutti[0] ?? "", __anacanAlternativi: tutti.slice(1) };
  });
}

/** Il PV CONAD CNO si riconosce dall'id ANACAN o, se manca, dal codice Muro; entrambi restano nei meta del PV. */
export const importPuntiVenditaConadCno: ImportPuntiVenditaAgenzia = {
  chiaveMeta: "id_anacan",
  chiaveMetaRiserva: "id_muro",
  canaleEAreaPerCodice: true,
  leggiFile: leggiFileConadCno,
  leggiRiga: riga => {
    const valore = (campo: keyof typeof COLONNE) => cella(riga, ...COLONNE[campo]);
    const avvisi: AvvisoImportPuntoVenditaDTO[] = [];
    const nome = valore("nome");
    if (/\btest\b|non usare/i.test(nome)) return `Muro di test o da non usare: ${nome}`;

    const insegna = senzaCodice(valore("canale"));
    if (INSEGNE_ESCLUSE.some(esclusa => n(esclusa) === n(insegna))) return `Insegna esclusa dall'import: ${insegna}`;
    const canale = cerca(INSEGNE, insegna);
    if (canale) {
      const tipoPdv = valore("tipoPdv");
      const tipo = tipoPdv.split("-")[0]?.trim();
      if (tipo && tipo !== TIPO_PDV_ATTESO[canale]) avvisi.push({ motivo: `Insegna ${insegna} ma tipo punto vendita ${tipoPdv}`, penalita: 15 });
    } else {
      avvisi.push({ motivo: `Insegna ${insegna || "assente"}: canale da scegliere a mano`, penalita: 100 });
    }

    const regione = senzaCodice(valore("regione"));
    const area = valore("area") ? cerca(REGIONI, valore("area")) ?? valore("area") : cerca(REGIONI, regione);
    if (!area) avvisi.push({ motivo: `Area da decidere: nessuna area per la regione ${regione || "assente"}`, penalita: 100 });

    const via = valore("via");
    const civico = valore("civico");
    const senzaCivico = /^(s\.?\s?n\.?\s?c?\.?|0+)$/i.test(civico);
    const indirizzo = valore("indirizzo") || [via, senzaCivico ? "" : civico].filter(Boolean).join(" ");

    let cap = valore("cap");
    if (/^0\d{5,}$/.test(cap)) {
      avvisi.push({ motivo: `CAP corretto da ${cap}`, penalita: 15 });
      cap = cap.slice(-5);
    }

    const provinciaLetta = valore("provincia");
    let provincia: string | undefined = cerca(PROVINCE, provinciaLetta);
    if (!provincia && provinciaLetta) {
      provincia = cerca(PROVINCE_DA_CORREGGERE, provinciaLetta);
      if (provincia) avvisi.push({ motivo: `Provincia ${provinciaLetta} ricondotta a ${provincia}`, penalita: 10 });
      else if (/^[A-Za-z]{2}$/.test(provinciaLetta)) provincia = provinciaLetta.toUpperCase();
      else avvisi.push({ motivo: `Provincia non riconosciuta: ${provinciaLetta}`, penalita: 20 });
    }

    const telefonoLetto = valore("telefono").replace(/[/.]/g, " ").trim();
    let telefono: string | undefined = telefonoLetto || undefined;
    if (telefono && !TELEFONO.test(telefono)) {
      avvisi.push({ motivo: `Telefono non valido ignorato: ${telefonoLetto}`, penalita: 5 });
      telefono = undefined;
    }

    const alternativi = Array.isArray(riga.__anacanAlternativi) ? (riga.__anacanAlternativi as string[]) : [];
    const anacan = valore("idAnacan");
    if (alternativi.length) {
      avvisi.push({ motivo: `Muro con piu id ANACAN (${[anacan, ...alternativi].join(", ")}): usato ${anacan}`, penalita: 35 });
    }
    const muro = valore("muro");
    return {
      nome,
      indirizzo,
      citta: valore("citta"),
      cap,
      canale: canale ?? "",
      area: area ?? "",
      ragioneSociale: valore("ragioneSociale") || undefined,
      provincia,
      regione: regione || undefined,
      telefono,
      lat: numero(valore("lat")),
      lon: numero(valore("lon")),
      // Senza id ANACAN la chiave non si scrive: un aggiornamento non deve cancellare quella gia nota
      meta: {
        ...(anacan ? { id_anacan: anacan } : {}),
        id_muro: muro,
        ...(insegna ? { insegna } : {}),
        ...(alternativi.length ? { id_anacan_alternativi: alternativi } : {}),
      },
      avvisi,
    };
  },
};
