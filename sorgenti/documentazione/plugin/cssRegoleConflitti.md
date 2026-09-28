# cssRegoleConflitti.js

**Cosa è:** la lettura delle regole di segnalazione conflitti, senza toccare InDesign. Nasce con
I20-974.

Una regola dice quali elementi non devono toccarsi, in due forme:

- **un solo lato** → gli elementi che corrispondono non devono toccarsi fra loro;
- **due lati** → nessun elemento del primo lato deve toccare un elemento del secondo.

## Il punto che conta: `useTextBounds`

Sceglie su cosa si misura il contatto: il riquadro dell'oggetto oppure **il testo che contiene
davvero**. Per un campo di testo i due valori sono molto diversi, ed è la ragione per cui nascevano
segnalazioni che l'occhio non vedeva.

## Variabili globali

Nessuna, e nessuna globale esterna: è una IIFE che espone sette funzioni.

L'unica costante implicita è la **convenzione dei bounds InDesign**, `[alto, sinistra, basso,
destra]`, che vale per tutto il modulo e che sarebbe un errore dimenticare leggendo
`rettangoliInContatto`.

## Funzioni

- `splitSpec(spec)` → `"descrizione, prezzo"` diventa `["descrizione", "prezzo"]`.
- `normalizzaRegola(regola)` → porta una regola alla forma con cui il controllo lavora: i due lati e
  la scelta dei bounds. **Un solo lato valorizzato vale come «questi elementi non si tocchino fra
  loro», qualunque dei due sia stato scritto.** Torna `null` quando non c'è nulla da controllare.
- `getListaRegole(segnalazioniConflitti)` → accetta sia l'elenco di regole sia la scorciatoia di una
  regola sola scritta come coppia di stringhe.
- `rettangoliInContatto(a, b)` → **il contatto è sovrapposizione vera**: due elementi che si
  sfiorano al bordo, con un lato che finisce dove l'altro comincia, non si toccano.
- `rettangoloDiRiga(baseline, ascent, descent, sinistra, destra)` → il rettangolo occupato da una
  riga di testo. L'altezza va dalla cima dei caratteri alla coda di quelli che scendono sotto la
  linea di base: **`ascent` e `descent` bastano**, perché l'ascent già misura quanto il carattere
  sale sopra la base. Sommarci anche il corpo del carattere allungherebbe la riga verso l'alto di
  circa un'interlinea, prendendosi lo spazio bianco sopra il testo e facendolo passare per testo.
- `contattoConLeRighe(rettangolo, righe, rettangoloIntero)` → conta quello che il testo occupa
  davvero, riga per riga, non il rettangolo che le ingloba tutte: una riga corta non deve ereditare
  la larghezza di una riga lunga che sta da un'altra parte del campo. **Senza righe si ricade sul
  rettangolo intero**, così il comportamento resta quello di prima.
- `chiaveRegola(regola)` → la chiave con cui si riconosce una regola già raccolta. Comprende la
  scelta dei bounds: la stessa coppia di lati misurata in due modi diversi è un controllo diverso.

**Test:** `node --test tests/plugin/cssRegoleConflitti.test.js`
