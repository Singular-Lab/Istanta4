import { COLONNE_TRACCIATO_GENERICO } from '../../../lib/vendite/tipi';
import type { ImportVenditeAgenzia } from '../agenzia_lib/types';
import {
  cellaVendite,
  cellaVuota,
  colonnaVendite,
  leggiDataVendita,
  mostraValore,
  numeroVendita,
  testoCella,
  validaRigaVendita,
  type RigaFileVendite,
} from './valori';

// Le librerie agenzia possono costruire il proprio tracciato con gli stessi strumenti di lettura
export {
  cellaVendite,
  cellaVuota,
  colonnaVendite,
  leggiDataVendita,
  mostraValore,
  normalizzaIntestazione,
  numeroVendita,
  testoCella,
  validaRigaVendita,
  type RigaFileVendite,
} from './valori';

/**
 * Intestazioni accettate per ogni colonna del tracciato generico, confrontate senza maiuscole,
 * accenti, spazi e punteggiatura: "Punto vendita", "punto_vendita" e "PUNTOVENDITA" sono uguali.
 */
export const COLONNE_VENDITE_GENERICHE = {
  codice: ['codice', 'codice prodotto', 'codice articolo'],
  punto_vendita: ['punto vendita', 'pv', 'negozio'],
  dal: ['dal', 'data inizio', 'inizio'],
  al: ['al', 'data fine', 'fine'],
  pezzi: ['pezzi', 'quantita'],
  valore: ['valore', 'importo'],
} as const;

type Colonna = keyof typeof COLONNE_VENDITE_GENERICHE;

const OBBLIGATORIE: Colonna[] = ['codice', 'punto_vendita', 'dal', 'al', 'pezzi'];

const cella = (riga: RigaFileVendite, colonna: Colonna) => cellaVendite(riga, ...COLONNE_VENDITE_GENERICHE[colonna]);

/**
 * Il tracciato per le GDO senza un tracciato proprio nella libreria agenzia: un foglio (o un CSV)
 * con le colonne codice, punto_vendita, dal, al, pezzi e, facoltativa, valore. Il punto vendita e'
 * quello del cliente: la chiave dei meta dichiarata dalla libreria agenzia o, senza, il nome.
 * Date: seriale di Excel, "YYYY-MM-DD", "DD/MM/YYYY". Numeri anche con la virgola decimale.
 */
export const TRACCIATO_VENDITE_GENERICO: ImportVenditeAgenzia = {
  nome: 'Tracciato generico',
  // Le stesse intestazioni che la pagina Vendite mostra e mette nel file d'esempio
  colonne: [...COLONNE_TRACCIATO_GENERICO],
  leggiRiga(riga) {
    const assenti = OBBLIGATORIE.filter(colonna => colonnaVendite(riga, ...COLONNE_VENDITE_GENERICHE[colonna]) === undefined);
    if (assenti.length > 0) return `Colonne mancanti nel file: ${assenti.join(', ')}`;

    const codice = cella(riga, 'codice');
    if (cellaVuota(codice)) return 'Codice prodotto mancante';
    const puntoVendita = cella(riga, 'punto_vendita');
    if (cellaVuota(puntoVendita)) return 'Punto vendita mancante';

    const inizio = cella(riga, 'dal');
    const fine = cella(riga, 'al');
    if (cellaVuota(inizio)) return 'Periodo non valido: data di inizio (dal) mancante';
    if (cellaVuota(fine)) return 'Periodo non valido: data di fine (al) mancante';
    const dal = leggiDataVendita(inizio);
    if (!dal) return `Periodo non valido: data di inizio "${mostraValore(inizio)}" non riconosciuta`;
    const al = leggiDataVendita(fine);
    if (!al) return `Periodo non valido: data di fine "${mostraValore(fine)}" non riconosciuta`;

    const cellaPezzi = cella(riga, 'pezzi');
    const pezzi = numeroVendita(cellaPezzi);
    if (pezzi === null) return 'Pezzi mancanti';
    if (Number.isNaN(pezzi)) return `Pezzi non numerici: ${mostraValore(cellaPezzi)}`;

    // La colonna valore e' facoltativa: senza, o vuota, la vendita e' solo in pezzi
    const cellaValore = cella(riga, 'valore');
    const valore = numeroVendita(cellaValore);
    if (valore !== null && Number.isNaN(valore)) return `Valore non numerico: ${mostraValore(cellaValore)}`;

    // Codice normalizzato, periodo ordinato, numeri nei limiti: gli stessi controlli di ogni tracciato
    return validaRigaVendita({ codiceProdotto: testoCella(codice), puntoVendita: testoCella(puntoVendita), dal, al, pezzi, valore });
  },
};
