import { StyleSheet } from "@react-pdf/renderer";
import type { PaletteReport } from "../../../../lib/insightVolantino/report";
import { CELLA, CORPO, INTERLINEA, MARGINE, MARGINE_ALTO, MARGINE_BASSO } from "./misure";

/**
 * Stili del report PDF del volantino, dai colori del cliente (PaletteReport, decisa dalla libreria
 * agenzia lato server). Registro da studio di consulenza: griglia fissa, molto bianco, filetti
 * sottili, gerarchia tipografica netta e un solo colore d'accento per il dato chiave.
 *
 * L'interlinea si scrive su ogni stile di testo: @react-pdf la eredita gia' convertita in punti, e un
 * titolo che ereditasse quella del corpo avrebbe le righe sovrapposte.
 */

export function creaStili(p: PaletteReport, famiglia: string) {
  const etichetta = {
    fontSize: CORPO.etichetta,
    lineHeight: INTERLINEA.stretta,
    fontWeight: 600,
    color: p.inchiostroTenue,
    textTransform: "uppercase" as const,
    letterSpacing: 0.7,
  };

  return StyleSheet.create({
    // ─── Pagina, testata e piè di pagina ─────────────────────────────
    pagina: {
      paddingTop: MARGINE_ALTO,
      paddingBottom: MARGINE_BASSO,
      paddingHorizontal: MARGINE,
      backgroundColor: p.carta,
      color: p.inchiostro,
      fontFamily: famiglia,
      fontSize: CORPO.corpo,
    },
    testata: {
      position: "absolute",
      top: 34,
      left: MARGINE,
      right: MARGINE,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingBottom: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: p.linee,
    },
    testataSinistra: { flexDirection: "row", alignItems: "flex-end", flexShrink: 1, paddingRight: 12 },
    testataCliente: { ...etichetta, color: p.primario, letterSpacing: 0.9 },
    testataTitolo: {
      flexShrink: 1,
      fontSize: CORPO.etichetta + 0.5,
      lineHeight: INTERLINEA.stretta,
      color: p.inchiostroTenue,
      maxLines: 1,
      textOverflow: "ellipsis",
    },
    testataSezione: {
      maxWidth: 190,
      fontSize: CORPO.etichetta + 0.5,
      lineHeight: INTERLINEA.stretta,
      color: p.inchiostroTenue,
      textAlign: "right",
      maxLines: 1,
      textOverflow: "ellipsis",
    },
    piede: {
      position: "absolute",
      bottom: 30,
      left: MARGINE,
      right: MARGINE,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 6,
      borderTopWidth: 0.5,
      borderTopColor: p.linee,
    },
    piedeTesto: { fontSize: CORPO.etichetta, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue },
    piedeNumero: { fontSize: CORPO.etichetta, lineHeight: INTERLINEA.stretta, color: p.inchiostro, fontWeight: 600 },

    // ─── Intestazione di sezione ─────────────────────────────────────
    sezione: { marginBottom: 18 },
    sezioneNumero: { fontSize: 8, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.primario, letterSpacing: 1.2, marginBottom: 6 },
    sezioneTitolo: { fontSize: CORPO.titoloSezione, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro },
    sezioneFiletto: { width: 28, height: 1.5, backgroundColor: p.primario, marginTop: 10 },
    sezioneIntroduzione: {
      fontSize: CORPO.corpo,
      lineHeight: INTERLINEA.normale,
      color: p.inchiostroTenue,
      marginTop: 10,
      maxWidth: 400,
    },
    segue: { flexDirection: "row", alignItems: "flex-end", marginBottom: 16 },
    segueNumero: { fontSize: 8, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.primario, letterSpacing: 1.2, marginRight: 8 },
    segueTitolo: { fontSize: 9, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro },
    segueNota: { fontSize: CORPO.nota, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, fontStyle: "italic", marginLeft: 6 },

    // ─── Testi comuni ────────────────────────────────────────────────
    etichetta,
    corpo: { fontSize: CORPO.corpo, lineHeight: INTERLINEA.normale, color: p.inchiostro },
    nota: { fontSize: CORPO.nota, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue },
    notaCorsivo: { fontSize: CORPO.nota, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, fontStyle: "italic" },
    grassetto: { fontWeight: 600, color: p.inchiostro },
    filetto: { height: 0.5, backgroundColor: p.linee },

    // ─── Copertina ───────────────────────────────────────────────────
    copertina: { backgroundColor: p.carta, color: p.inchiostro, fontFamily: famiglia, fontSize: CORPO.corpo },
    copertinaBanda: { position: "absolute", top: 0, bottom: 0, left: 0, width: 10, backgroundColor: p.primario },
    copertinaTesta: {
      position: "absolute",
      top: MARGINE,
      left: MARGINE,
      right: MARGINE,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    copertinaLogo: { height: 30, maxWidth: 150, objectFit: "contain" },
    copertinaCliente: { fontSize: 11, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.primario, letterSpacing: 1, textTransform: "uppercase" },
    copertinaGenere: { ...etichetta, letterSpacing: 1.1 },
    copertinaCorpo: { position: "absolute", top: 196, left: MARGINE, right: MARGINE, flexDirection: "row", justifyContent: "space-between" },
    copertinaTesti: { flexGrow: 1, flexShrink: 1, paddingRight: 28 },
    copertinaOcchiello: { ...etichetta, color: p.primario, letterSpacing: 1.4, marginBottom: 14 },
    copertinaTitolo: { fontSize: CORPO.titoloCopertina, lineHeight: 1.15, fontWeight: 600, color: p.inchiostro },
    copertinaFiletto: { width: 36, height: 2, backgroundColor: p.primario, marginTop: 18, marginBottom: 16 },
    copertinaSottotitolo: { fontSize: 11.5, lineHeight: INTERLINEA.normale, color: p.inchiostro },
    copertinaSottotitoloCliente: { fontSize: CORPO.corpo, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, marginTop: 6 },
    copertinaDati: { marginTop: 26, flexDirection: "row" },
    copertinaDato: { marginRight: 26 },
    copertinaDatoValore: { fontSize: 13, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, marginTop: 3 },
    copertinaImmagine: { alignItems: "flex-end" },
    copertinaDidascalia: { fontSize: CORPO.etichetta, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, marginTop: 6 },
    copertinaPiede: { position: "absolute", left: MARGINE, right: MARGINE, bottom: MARGINE },
    copertinaIndice: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginBottom: 22 },
    copertinaVoceIndice: { width: "50%", flexDirection: "row", paddingVertical: 3, paddingRight: 12 },
    copertinaVoceNumero: { width: 22, fontSize: 8.5, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.primario },
    copertinaVoceTitolo: { flex: 1, fontSize: 8.5, lineHeight: INTERLINEA.stretta, color: p.inchiostro },
    copertinaRiservatezza: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 0.5,
      borderTopColor: p.linee,
    },

    // ─── Sintesi ─────────────────────────────────────────────────────
    indicatori: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -7, marginBottom: 10 },
    indicatore: { paddingHorizontal: 7, marginBottom: 18 },
    indicatoreCorpo: { borderTopWidth: 1.5, borderTopColor: p.primario, paddingTop: 8 },
    indicatoreCorpoChiave: { borderTopWidth: 1.5, borderTopColor: p.accento, paddingTop: 8 },
    indicatoreValore: { fontSize: CORPO.valoreIndicatore, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, marginTop: 6 },
    indicatoreValoreChiave: { fontSize: CORPO.valoreIndicatore, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.accento, marginTop: 6 },
    indicatoreDettaglio: { fontSize: CORPO.nota, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, marginTop: 3 },
    variazione: { flexDirection: "row", alignItems: "center", marginTop: 5 },
    variazioneTesto: { fontSize: CORPO.nota, lineHeight: INTERLINEA.stretta, fontWeight: 600, marginLeft: 4 },
    frasi: { marginTop: 4, maxWidth: 440 },
    frase: { flexDirection: "row", marginBottom: 8 },
    fraseSegno: { width: 4, height: 4, backgroundColor: p.primario, marginTop: 6, marginRight: 10 },
    fraseTesto: { flex: 1, fontSize: CORPO.frase, lineHeight: INTERLINEA.ampia, color: p.inchiostro },

    // ─── Grafici ─────────────────────────────────────────────────────
    grafico: { marginBottom: 26 },
    graficoTitolo: { fontSize: CORPO.titoloGrafico, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, marginBottom: 10 },
    graficoNota: { fontSize: CORPO.nota, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, fontStyle: "italic", marginTop: 8 },
    rigaBarra: { flexDirection: "row", alignItems: "center" },
    etichettaBarra: { fontSize: 8.5, lineHeight: INTERLINEA.stretta, color: p.inchiostro, paddingRight: 10, textAlign: "right", maxLines: 1, textOverflow: "ellipsis" },
    valoreBarra: { fontSize: 8, lineHeight: INTERLINEA.stretta, color: p.inchiostro, fontWeight: 600, marginLeft: 5 },
    taccaTesto: { fontSize: 6.5, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, textAlign: "center" },
    legenda: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
    legendaVoce: { flexDirection: "row", alignItems: "center", marginRight: 16 },
    legendaSegno: { width: 8, height: 8, marginRight: 5 },
    legendaTesto: { fontSize: CORPO.nota, lineHeight: INTERLINEA.stretta, color: p.inchiostro },
    ciambella: { flexDirection: "row", alignItems: "center" },
    ciambellaCentro: { position: "absolute", left: 0, top: 0, justifyContent: "center", alignItems: "center" },
    ciambellaValore: { fontSize: 15, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, textAlign: "center" },
    ciambellaEtichetta: { fontSize: CORPO.etichetta, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, textAlign: "center", marginTop: 2 },
    ciambellaLegenda: { flex: 1, marginLeft: 28 },
    ciambellaVoce: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: p.linee },
    ciambellaVoceEtichetta: { flex: 1, fontSize: 8.5, lineHeight: INTERLINEA.stretta, color: p.inchiostro, maxLines: 1, textOverflow: "ellipsis" },
    ciambellaVoceValore: { width: 70, fontSize: 8.5, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, textAlign: "right" },
    ciambellaVoceQuota: { width: 44, fontSize: 8, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, textAlign: "right" },

    // ─── Pagine del volantino ────────────────────────────────────────
    paginaTitolo: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
    paginaNumero: { fontSize: 13, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro },
    paginaDi: { fontSize: CORPO.corpo, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue },
    paginaCorpo: { flexDirection: "row", justifyContent: "space-between" },
    paginaCorpoOrizzontale: { flexDirection: "column" },
    paginaFoglio: { position: "relative", backgroundColor: p.carta, overflow: "hidden" },
    paginaRiempi: { position: "absolute", left: 0, top: 0 },
    paginaDidascalia: { fontSize: CORPO.etichetta, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, marginTop: 6 },
    paginaLaterale: { flexDirection: "column" },
    paginaLateraleOrizzontale: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
    misuraTitolo: { fontSize: CORPO.titoloGrafico, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, marginTop: 4 },
    misuraDescrizione: { fontSize: CORPO.nota, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, marginTop: 4 },
    scalaTacche: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
    evidenzaVoce: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: p.linee },
    evidenzaTesti: { flex: 1, marginLeft: 7, marginRight: 6 },
    evidenzaNome: { fontSize: 8, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, maxLines: 1, textOverflow: "ellipsis" },
    evidenzaDettaglio: { fontSize: 6.8, lineHeight: INTERLINEA.stretta, color: p.inchiostroTenue, marginTop: 1.5, maxLines: 1, textOverflow: "ellipsis" },
    evidenzaValore: { fontSize: 8, lineHeight: INTERLINEA.stretta, fontWeight: 600, color: p.inchiostro, textAlign: "right" },
    numeroBox: { width: 13, height: 13, borderRadius: 6.5, justifyContent: "center", alignItems: "center" },
    numeroBoxTesto: { fontSize: 6.5, lineHeight: 1, fontWeight: 600, color: "#ffffff", textAlign: "center" },

    // ─── Tabella ─────────────────────────────────────────────────────
    tabellaTesta: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: p.inchiostro },
    tabellaTestaCella: {
      ...etichetta,
      fontSize: CORPO.etichetta,
      paddingVertical: CELLA.paddingVerticale,
      paddingHorizontal: CELLA.paddingOrizzontale,
    },
    tabellaRiga: { flexDirection: "row" },
    tabellaRigaAlterna: { flexDirection: "row", backgroundColor: p.superficie },
    tabellaCella: {
      fontSize: CORPO.tabella,
      lineHeight: INTERLINEA.stretta,
      color: p.inchiostro,
      paddingVertical: CELLA.paddingVerticale,
      paddingHorizontal: CELLA.paddingOrizzontale,
    },
    tabellaChiusura: { height: 0.75, backgroundColor: p.inchiostro },
    tabellaVuota: { fontSize: CORPO.tabella, lineHeight: INTERLINEA.normale, color: p.inchiostroTenue, fontStyle: "italic", paddingVertical: 8 },

    // ─── Metodo ──────────────────────────────────────────────────────
    metodo: { width: 340 },
    metodoParagrafo: { fontSize: 9, lineHeight: INTERLINEA.ampia, color: p.inchiostro, marginBottom: 9 },
  });
}

export type StiliReport = ReturnType<typeof creaStili>;

/** Quello che serve a ogni componente del documento: i colori del cliente e gli stili. */
export interface TemaReport {
  palette: PaletteReport;
  s: StiliReport;
}

export const creaTema = (palette: PaletteReport, famiglia: string): TemaReport => ({ palette, s: creaStili(palette, famiglia) });
