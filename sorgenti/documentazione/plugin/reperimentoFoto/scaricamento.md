# reperimentoFoto/scaricamento.js

**Cosa è:** lo scaricamento delle immagini dal server nella cartella Links di InDesign. Fa parte del
concetto [procurarsi la foto giusta](README.md).

**Fino a I20-1015 si chiamava `cmd.js`**, un nome che non diceva cosa fa: chi cercava lo
scaricamento delle foto lì dentro non ci guardava. I20-1002 aveva proposto `scaricaImmagini.js`; la
rinomina è stata assorbita in I20-1015, e ora chi lo usa lo chiama `scaricamentoFoto`, la globale che
`indexNew.js` dichiara. Non lo importa nessuno col `require`: al caricamento legge `uxp`, e sotto
Node non si carica — vedi [README.md](README.md).

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
  Lo chiamano [ReperimentoFoto](operazioni.md) per la foto singola e per la sincronizzazione massiva.
  `objProcess.onProgress` riceve l'avanzamento.
- `md5ArrayBuffer(arrayBuffer)` → l'md5 di un file letto in memoria. Lo usano anche `getLinkHash`
  e la [parte foto della scheda](schedaFoto.md) per sapere se una foto locale è ancora quella del
  server.
- `delay(ms)` → pausa fra un tentativo di scaricamento e il successivo.

## Cosa è stato rimosso in I20-1002

**`requestImages()`, 1.280 righe** — il 74% del file. Nessun chiamante in tutto il repository.

Non era un abbozzo: era codice **scritto e completo**, una via alternativa per chiedere le immagini
al server, rimasta indietro quando `downloadImages` ha preso quella strada. Insieme a lei sono
spariti due script sciolti che appartenevano allo stesso lavoro: `requestImages.py` e
`requesImages.command` — quest'ultimo col refuso nel nome.

Dopo la rimozione il file passa da **1.722 a 442 righe**, e i quattro membri vivi restano tutti
serviti: `downloadImages` per `indexNew`, `md5ArrayBuffer` per `utility` e `schedaRef`.
