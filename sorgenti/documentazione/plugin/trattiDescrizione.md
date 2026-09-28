# trattiDescrizione.js

**Cosa è:** i tratti di stile di un campo descrizione. Nasce con I20-995.

La schermata di edit leggeva il campo **un carattere alla volta**, e per ogni carattere chiedeva a
InDesign l'oggetto, il suo stile, il nome dello stile e il gruppo a cui appartiene: su una
descrizione di duecento caratteri erano migliaia di passaggi verso InDesign, ed è lì che se ne
andavano i secondi di attesa fra primarie/secondarie ed edit.

InDesign sa già dire dove cambia lo stile — `textStyleRanges` restituisce i tratti omogenei, che
sono pochi. Da lì in poi il lavoro è su stringhe, e sta qui, fuori da `schedaRef.js` e `utility.js`
che richiedono InDesign e non si caricano sotto Node.

**Quello che questo modulo NON fa è cambiare il risultato:** il testo delle textarea si compone
carattere per carattere esattamente come prima, comprese le asimmetrie del codice vecchio.

## Variabili globali

Nessuna. Espone solo funzioni; lo stato vive in `schedaRef.js`.

## Funzioni

- `nomeCompletoStile(nomeStile, nomeGruppo)` → `"gruppo.nome"` se lo stile sta dentro un gruppo,
  altrimenti il nome e basta.
- `accorpa(tratti)` → unisce i tratti consecutivi che portano lo stesso stile. InDesign spezza i
  tratti anche dove cambia solo un attributo locale — un corpo, un colore — mentre la scheda
  ragiona per nome di stile: **senza questo passaggio lo stesso stile aprirebbe due textarea**.
- `stiliInOrdine(tratti)` → gli stili nell'ordine in cui compaiono; uno stile ripetuto più avanti
  compare di nuovo. È la lista con cui si riconosce lo schema della descrizione.
- `testiDelTratto(contenuto, normalizzaCarattere)` → i due testi di un tratto: quello che si vede
  nella textarea e quello che serve a confrontare il tratto con il contenuto del server. Si
  differenziano sull'a capo, che nella textarea è `\n` e nel confronto resta `\r`, e la differenza
  vale **dal secondo carattere in poi** — sul primo il codice vecchio non guardava l'a capo, e
  cambiarlo adesso vorrebbe dire cambiare di nascosto il contenuto di un campo. La normalizzazione
  passa carattere per carattere perché applicarla al tratto intero riconoscerebbe sequenze lunghe
  (`<br>`, `\r\n`) che carattere per carattere non si vedono mai.
