import { DefaultAgenziaLib } from "../default/index.js";
import { storicoVolantinoDB1 } from "./storico-db1.js";

/**
 * CONAD CNO. Per tutto il resto vale il comportamento di default, che e quello
 * che il loader usava gia per questo cliente; in piu ha lo storico dei volantini su DB1.
 */
export class ConadcnoAgenziaLib extends DefaultAgenziaLib {
  storicoVolantino = storicoVolantinoDB1;
}
