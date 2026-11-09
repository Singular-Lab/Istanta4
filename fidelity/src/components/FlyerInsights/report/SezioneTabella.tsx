import { View } from "@react-pdf/renderer";
import type { ReportVolantino, SezioneReport } from "../../../../lib/insightVolantino/report";
import { IntestazioneSegue, IntestazioneSezione, PaginaReport, Testo } from "./componenti";
import { altezzaRigaTabella, impaginaTabella, larghezzeColonne, spazioTabella, type ColonnaTabella } from "./impaginazione";
import { LARGHEZZA_UTILE } from "./misure";
import type { TemaReport } from "./stili";

type Tabella = Extract<SezioneReport, { tipo: "tabella" }>;

interface ProprietaSezione {
  tema: TemaReport;
  report: ReportVolantino;
  sezione: Tabella;
  indice: number;
}

const allineamento = (colonna: ColonnaTabella) => (colonna.allinea === "destra" ? ("right" as const) : ("left" as const));

function TestaTabella({ tema, colonne, larghezze }: { tema: TemaReport; colonne: readonly ColonnaTabella[]; larghezze: readonly number[] }) {
  const { s } = tema;
  return (
    <View style={s.tabellaTesta} wrap={false}>
      {colonne.map((colonna, indice) => (
        <Testo key={indice} style={[s.tabellaTestaCella, { width: larghezze[indice], textAlign: allineamento(colonna) }]}>
          {colonna.titolo}
        </Testo>
      ))}
    </View>
  );
}

/**
 * Tabella: l'intestazione si ripete in cima a ogni pagina (le pagine le decide impaginaTabella),
 * righe alterne sul colore di superficie, numeri allineati a destra, la nota dopo l'ultima riga.
 */
export function SezioneTabella({ tema, report, sezione, indice }: ProprietaSezione) {
  const { s } = tema;
  const larghezze = larghezzeColonne(sezione.colonne, sezione.righe, LARGHEZZA_UTILE);
  const altezze = sezione.righe.map((riga) => altezzaRigaTabella(riga, larghezze));
  const pagine = impaginaTabella(altezze, spazioTabella(sezione, larghezze, LARGHEZZA_UTILE));

  return (
    <>
      {pagine.map((pagina, posizione) => {
        const ultima = posizione === pagine.length - 1;
        return (
          <PaginaReport key={posizione} tema={tema} report={report} sezione={sezione.titolo}>
            {posizione === 0 ? (
              <IntestazioneSezione tema={tema} indice={indice} titolo={sezione.titolo} introduzione={sezione.introduzione} />
            ) : (
              <IntestazioneSegue tema={tema} indice={indice} titolo={sezione.titolo} />
            )}
            <TestaTabella tema={tema} colonne={sezione.colonne} larghezze={larghezze} />
            {sezione.righe.slice(pagina.inizio, pagina.fine).map((riga, numero) => {
              const assoluta = pagina.inizio + numero;
              return (
                <View key={assoluta} style={assoluta % 2 === 1 ? s.tabellaRigaAlterna : s.tabellaRiga} wrap={false}>
                  {sezione.colonne.map((colonna, colonnaIndice) => (
                    <Testo key={colonnaIndice} style={[s.tabellaCella, { width: larghezze[colonnaIndice], textAlign: allineamento(colonna) }]}>
                      {riga[colonnaIndice] ?? ""}
                    </Testo>
                  ))}
                </View>
              );
            })}
            {sezione.righe.length === 0 ? <Testo style={s.tabellaVuota}>Nessuna riga da mostrare.</Testo> : null}
            <View style={s.tabellaChiusura} />
            {ultima && sezione.nota ? <Testo style={s.graficoNota}>{sezione.nota}</Testo> : null}
            {!ultima ? <Testo style={[s.notaCorsivo, { marginTop: 6, textAlign: "right" }]}>Continua nella pagina seguente</Testo> : null}
          </PaginaReport>
        );
      })}
    </>
  );
}
