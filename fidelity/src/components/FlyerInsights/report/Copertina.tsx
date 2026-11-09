import { Image, Page, View } from "@react-pdf/renderer";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import { boxPerPagina } from "../volantino/geometria";
import { Testo } from "./componenti";
import { FoglioVolantino } from "./FoglioVolantino";
import { misuraNelRiquadro } from "./impaginazione";
import { pagineDelReport, proporzioniPagine } from "./pagineVolantino";
import type { TemaReport } from "./stili";
import { dataEstesa, numeroSezione } from "./testi";

const NUMERI = new Intl.NumberFormat("it-IT");

/** Riquadro della prima pagina del volantino in copertina. */
const FOGLIO = { larghezza: 196, altezza: 290 };

interface ProprietaCopertina {
  tema: TemaReport;
  report: ReportVolantino;
  /** JPEG della prima pagina; null: pagina bianca con i riquadri. */
  immagine: string | null;
}

function Dato({ tema, etichetta, valore }: { tema: TemaReport; etichetta: string; valore: string }) {
  const { s } = tema;
  return (
    <View style={s.copertinaDato}>
      <Testo style={s.etichetta}>{etichetta}</Testo>
      <Testo style={s.copertinaDatoValore}>{valore}</Testo>
    </View>
  );
}

/**
 * Copertina: cliente (logo o nome) in alto, titolo e sottotitolo (area · canale · periodo), i numeri
 * del volantino, la prima pagina a destra, l'indice delle sezioni e la dicitura di riservatezza.
 * Niente testata ne' numero di pagina.
 */
export function Copertina({ tema, report, immagine }: ProprietaCopertina) {
  const { s } = tema;
  const { intestazione } = report;
  const foglio = misuraNelRiquadro(proporzioniPagine(report.box)(1), FOGLIO.larghezza, FOGLIO.altezza);
  const prodotti = report.box.reduce((somma, box) => somma + Math.max(1, box.prodotti || 0), 0);

  return (
    <Page size="A4" style={s.copertina}>
      <View style={s.copertinaBanda} />

      <View style={s.copertinaTesta}>
        {intestazione.logo ? (
          <Image src={intestazione.logo} style={s.copertinaLogo} />
        ) : (
          <Testo style={s.copertinaCliente}>{intestazione.cliente}</Testo>
        )}
        <Testo style={s.copertinaGenere}>{`Generato il ${dataEstesa(report.generatoIl)}`}</Testo>
      </View>

      <View style={s.copertinaCorpo}>
        <View style={s.copertinaTesti}>
          <Testo style={s.copertinaOcchiello}>Report del volantino</Testo>
          <Testo style={s.copertinaTitolo}>{report.titolo}</Testo>
          <View style={s.copertinaFiletto} />
          {report.sottotitolo ? <Testo style={s.copertinaSottotitolo}>{report.sottotitolo}</Testo> : null}
          {intestazione.sottotitolo ? <Testo style={s.copertinaSottotitoloCliente}>{intestazione.sottotitolo}</Testo> : null}
          <View style={s.copertinaDati}>
            <Dato tema={tema} etichetta="Pagine" valore={NUMERI.format(pagineDelReport(report).length)} />
            <Dato tema={tema} etichetta="Box" valore={NUMERI.format(report.box.length)} />
            <Dato tema={tema} etichetta="Prodotti" valore={NUMERI.format(prodotti)} />
          </View>
        </View>
        <View style={s.copertinaImmagine}>
          <FoglioVolantino
            tema={tema}
            larghezza={foglio.larghezza}
            altezza={foglio.altezza}
            immagine={immagine}
            box={boxPerPagina(report.box).get(1) ?? []}
          />
          <Testo style={s.copertinaDidascalia}>{immagine ? "Prima pagina del volantino" : "Prima pagina: immagine non disponibile"}</Testo>
        </View>
      </View>

      <View style={s.copertinaPiede}>
        {report.sezioni.length > 0 ? (
          <>
            <Testo style={s.etichetta}>In questo report</Testo>
            <View style={s.copertinaIndice}>
              {report.sezioni.map((sezione, indice) => (
                <View key={`${indice}-${sezione.titolo}`} style={s.copertinaVoceIndice}>
                  <Testo style={s.copertinaVoceNumero}>{numeroSezione(indice)}</Testo>
                  <Testo style={s.copertinaVoceTitolo}>{sezione.titolo}</Testo>
                </View>
              ))}
            </View>
          </>
        ) : null}
        <View style={s.copertinaRiservatezza}>
          <Testo style={s.piedeTesto}>{intestazione.riservatezza}</Testo>
          <Testo style={s.piedeTesto}>{intestazione.cliente}</Testo>
        </View>
      </View>
    </Page>
  );
}
