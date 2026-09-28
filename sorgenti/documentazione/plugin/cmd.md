# cmd.js

**Cosa è:** lo scaricamento delle immagini dal server nella cartella Links di InDesign.

**Il nome non dice cosa fa.** «cmd» non significa niente, e chi cerca lo scaricamento delle foto qui
dentro non ci guarda. **Rinomina proposta: `scaricaImmagini.js`** — è il genere di cosa che costa
quanto un file mal diviso, perché nasconde il contenuto a chi lo cerca.

## Come lavora

Il lavoro vero **non è scaricare: è non riscaricare quello che c'è già.** Per ogni immagine
richiesta si confronta l'md5 del file locale con quello atteso, e si scarica solo ciò che manca o è
cambiato.

**L'ottimizzazione di I20-967** è nella soglia: sotto i **25 file** i presenti si cercano **per
nome**, invece di elencare l'intera cartella. Su una cartella Links con migliaia di immagini,
elencare tutto per scaricarne una sola — il caso tipico del cambio foto dalla scheda referenza —
costava moltissimo.

## Variabili

| nome | valore | cos'è |
|---|---|---|
| `SOGLIA_LETTURA_MIRATA` | 25 | sotto questa soglia si cerca per nome invece di elencare la cartella |

## Funzioni

- `downloadImages(listImagesRequired, objProcess, cartella, idOperazione)` → il cuore del file.
  Lo chiama `indexNew` per il cambio foto della scheda e per la sincronizzazione massiva.
  `objProcess.onProgress` riceve l'avanzamento.
- `md5ArrayBuffer(arrayBuffer)` → l'md5 di un file letto in memoria. Lo usano anche `utility.js` e
  `schedaRef.js` per sapere se una foto locale è ancora quella del server.
- `delay(ms)` → pausa fra un tentativo di scaricamento e il successivo.

## Cosa è stato rimosso in I20-1002

**`requestImages()`, 1.280 righe** — il 74% del file. Nessun chiamante in tutto il repository.

Non era un abbozzo: era codice **scritto e completo**, una via alternativa per chiedere le immagini
al server, rimasta indietro quando `downloadImages` ha preso quella strada. Insieme a lei sono
spariti due script sciolti che appartenevano allo stesso lavoro: `requestImages.py` e
`requesImages.command` — quest'ultimo col refuso nel nome.

Dopo la rimozione il file passa da **1.722 a 442 righe**, e i quattro membri vivi restano tutti
serviti: `downloadImages` per `indexNew`, `md5ArrayBuffer` per `utility` e `schedaRef`.
