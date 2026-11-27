/*
 * Le insegne di CONAD CNO che si trovano nella lista dei punti vendita stampata nei volantini
 * storici (spec import-storico-volantino, "Insegne nella lista dei punti vendita dichiarate dalla
 * libreria agenzia"): un'intestazione con una di queste parole e' un'insegna, non una citta'.
 * Comprende anche le parole generiche, perche' la dichiarazione sostituisce quella standard.
 */
export const insegneListaPuntiVenditaConadCno =
  /\b(?:CONAD|SUPERSTORE|SUPERMERCAT\w*|IPERMERCAT\w*|IPER|MARKET|MINIMARKET|DISCOUNT|CITY|SAPORI)\b/i;
