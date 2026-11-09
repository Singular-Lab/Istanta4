/**
 * Simulazione di un prodotto del volantino in un'altra pagina, zona, spazio o sconto (contratto in
 * lib/insightVolantino/rendimento.ts). Si carica a parte dalla pagina del volantino: pesa e serve a pochi.
 */
export { default, SimulatoreProdotto, type SimulatoreProdottoProps } from "./SimulatoreProdotto";
export { ZonaPagina, type ZonaPaginaProps } from "./ZonaPagina";
export {
  campiDelProdotto,
  centroBox,
  etichettaProdotto,
  filtraProdotti,
  nomeZona,
  prodottiSimulabili,
  riquadroSimulato,
  stessaRichiesta,
  validaSimulazione,
  ZONE_PAGINA,
  type CampiSimulazione,
  type ErroriSimulazione,
  type ProdottoSimulabile,
  type Zona,
} from "./supporto";
