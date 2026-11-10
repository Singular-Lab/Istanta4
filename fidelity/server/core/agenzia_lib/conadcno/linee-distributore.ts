import type { LineeDistributoreAgenzia, TestiPerLinea } from "../types.js";

/*
 * Linee di marca CONAD e bolli negli insight del volantino (spec insight-volantino, "Linee del
 * distributore con loghi e bolli"). Le sigle sono quelle del catalogo loghi e bolli di Istanta
 * (FicoProcess/getLoghiBolli): il logo di ogni linea e bollo si chiede li', senza distinguere le
 * maiuscole (il catalogo ha conad_11P, le regole conad_11p).
 *
 * La linea di un box e' quella assegnata da Istanta alla referenza (foto_extra); per i volantini
 * dello storico, che non l'hanno, si ricava dai testi stampati con lineaDaTesti, la stessa cascata
 * di prodotto_conad nella libreria agenzia di Istanta (AgenziaLib/Edro21.cs, getLoghiEBolliNew).
 */

/** Nell'ordine in cui si mostrano. Colori sobri e distinti, uno per linea. */
const LINEE: LineeDistributoreAgenzia["linee"] = [
  { sigla: "conad_logo", nome: "Conad", colore: "#d52b1e" },
  { sigla: "conad_saporidintorni", nome: "Sapori & Dintorni", colore: "#8c5a2b" },
  { sigla: "conad_saporidintorniPQ", nome: "Sapori & Dintorni Percorso Qualità", colore: "#6b4423" },
  { sigla: "conad_cpq", nome: "Percorso Qualità", colore: "#1f4e79" },
  { sigla: "conad_saporiidee", nome: "Sapori & Idee", colore: "#b8860b" },
  { sigla: "conad_saporiideePQ", nome: "Sapori & Idee Percorso Qualità", colore: "#8a6d1f" },
  { sigla: "conad_vn", nome: "Verso Natura", colore: "#2e7d32" },
  { sigla: "conad_bio", nome: "Il Biologico", colore: "#558b2f" },
  { sigla: "conad_piacersi", nome: "Piacersi", colore: "#ad1457" },
  { sigla: "conad_armomia", nome: "Armomia", colore: "#6a1b9a" },
  { sigla: "conad_aslattosio", nome: "Alimentum senza lattosio", colore: "#0277bd" },
  { sigla: "conad_asglutine", nome: "Alimentum senza glutine", colore: "#00838f" },
  { sigla: "conad_parafarmacia", nome: "Parafarmacia", colore: "#00695c" },
  { sigla: "conad_11p", nome: "11 Paralleli", colore: "#4e342e" },
  { sigla: "conad_baby", nome: "Baby", colore: "#f9a825" },
  { sigla: "conad_essentiae", nome: "Essentiae", colore: "#5d4037" },
  { sigla: "conad_essentiae_LAB", nome: "Essentiae Lab", colore: "#37474f" },
  { sigla: "conad_petfrplus", nome: "PetFriends Plus", colore: "#283593" },
  { sigla: "conad_PetFr", nome: "PetFriends", colore: "#3949ab" },
];

const BOLLI: NonNullable<LineeDistributoreAgenzia["bolli"]> = [
  { sigla: "dop", nome: "DOP" },
  { sigla: "igp", nome: "IGP" },
  { sigla: "LOGO_filiera", nome: "Filiera controllata" },
  { sigla: "logo_BassieFissi", nome: "Bassi e Fissi" },
  { sigla: "Logo_SDB", nome: "Scelte di Benessere" },
  { sigla: "Logo_BDP", nome: "Buono del Paese" },
  { sigla: "LOGO_bandiera_italiana", nome: "Prodotto italiano" },
  { sigla: "LOGO_carneS_USOdiANTIBIOTICI", nome: "Senza antibiotici" },
  { sigla: "LOGO_Carne_Chianina", nome: "Chianina" },
  { sigla: "Logo_VistoinTV", nome: "Visto in TV" },
  { sigla: "Logo_Agriqualità", nome: "Agriqualità" },
  { sigla: "logo_selezione", nome: "Selezione Conad" },
];

/** ToLower() di C#: i testi si confrontano in minuscolo. */
const minuscolo = (testo: string | null | undefined): string => (testo ?? "").toLowerCase();

/** ToNoSpacing() di Istanta (Utility.cs): senza a capo e senza spazi. */
const senzaSpazi = (testo: string): string => testo.replace(/\r\n|\n/g, "").replace(/ /g, "");

/** LogoArmomiaEdro21.ConLogo: brand con CONAD e "armomia" in brand, descrizione 1 o gusto. */
function conLogoArmomia(brand: string, desc1: string, gusto: string): boolean {
  if (!brand.includes("conad")) return false;
  return brand.includes("armomia") || desc1.includes("armomia") || gusto.includes("armomia");
}

/**
 * SceltaDiBenessereEdro21.LogoPiacersiAmmesso: in Istanta il logo Piacersi non va alle referenze di
 * un tema focus (tipo tema o sezione con "focus"), salvo il box normale nella sezione Scelte di
 * Benessere. Tipo tema e sezione non arrivano a Fidelity con le referenze del volantino: qui il
 * logo e' sempre ammesso.
 */
const logoPiacersiAmmesso = (): boolean => true;

/**
 * La sigla della linea CONAD dai testi stampati: la cascata di prodotto_conad in
 * AgenziaLib/Edro21.cs (getLoghiEBolliNew), nello stesso ordine e con le stesse sottostringhe.
 * brand = Descrizione2 (marca), desc1 = Descrizione1, gusto = Descrizione3, tutti in minuscolo.
 * null se la marca non contiene "conad" (o se nomina Piacersi e il logo non e' ammesso).
 */
export function lineaConadDaTesti(testi: TestiPerLinea): string | null {
  const brand = minuscolo(testi.marca);
  const desc1 = minuscolo(testi.descrizione);
  const gusto = minuscolo(testi.gusto);
  if (!brand.includes("conad")) return null;

  const inUno = (parola: string): boolean => gusto.includes(parola) || desc1.includes(parola) || brand.includes(parola);
  const inUnoSenzaSpazi = (parola: string): boolean =>
    senzaSpazi(gusto).includes(parola) || senzaSpazi(desc1).includes(parola) || senzaSpazi(brand).includes(parola);

  // I20-1209: Armomia per primo, anche se la ref nomina un'altra linea
  if (conLogoArmomia(brand, desc1, gusto)) return "conad_armomia";
  if (inUnoSenzaSpazi("ilbiologico")) return "conad_bio";
  if (inUno("sapori&dintorni") && inUno("percorso qualità")) return "conad_saporidintorniPQ";
  if (inUno("sapori&idee") && inUno("percorso qualità")) return "conad_saporiideePQ";
  if (inUnoSenzaSpazi("percorsoqualità")) return "conad_cpq";
  if (inUno("sapori&dintorni")) return "conad_saporidintorni";
  if (inUno("sapori&idee")) return "conad_saporiidee";
  if (inUno("piacersi")) return logoPiacersiAmmesso() ? "conad_piacersi" : null;
  if (inUno("alimentum") && inUnoSenzaSpazi("senzalattosio")) {
    // Come in Istanta: vince la parola che compare prima, confrontando le posizioni nei tre testi;
    // senza "senzaglutine" e' senza lattosio
    const posizioni = (parola: string): number[] =>
      [senzaSpazi(gusto).indexOf(parola), senzaSpazi(desc1).indexOf(parola), senzaSpazi(brand).indexOf(parola)].filter(indice => indice >= 0);
    const lattosio = posizioni("senzalattosio");
    const glutine = posizioni("senzaglutine");
    const primaLattosio = lattosio.length > 0 ? Math.min(...lattosio) : 0;
    const primaGlutine = glutine.length > 0 ? Math.min(...glutine) : 0;
    return glutine.length === 0 || primaLattosio < primaGlutine ? "conad_aslattosio" : "conad_asglutine";
  }
  if (inUno("alimentum") && inUnoSenzaSpazi("senzaglutine")) return "conad_asglutine";
  if (inUnoSenzaSpazi("versonatura") && senzaSpazi(brand).includes("conad")) return "conad_vn";
  if (brand.includes("conad") && inUno("parafarmacia")) return "conad_parafarmacia";
  if (inUno("11 paralleli")) return "conad_11p";
  if (inUno("baby")) return "conad_baby";
  if (inUno("essentiae lab")) return "conad_essentiae_LAB";
  if (inUno("essentiae")) return "conad_essentiae";
  if (inUno("petfriends plus")) return "conad_petfrplus";
  if (inUno("petfriends")) return "conad_PetFr";
  return "conad_logo";
}

export const lineeDistributoreConadCno: LineeDistributoreAgenzia = {
  linee: LINEE,
  bolli: BOLLI,
  lineaDaTesti: lineaConadDaTesti,
};
