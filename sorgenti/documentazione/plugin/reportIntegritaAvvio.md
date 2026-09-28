# reportIntegritaAvvio.js

**Cosa è:** le regole con cui il Report Integrità decide **come partire e quando smettere di
valere**. Nasce con I20-981 (Lotto 1).

Stavano dentro il gestore del bottone «Avvia» in `indexNew.js` e dentro
`richiediAzioneReportIntegritaEsistente` in `confronti.js`, mescolate all'interfaccia. Nessuno dei
due file si carica sotto Node, quindi **le soglie non erano verificabili**: qui restano solo le
decisioni, senza InDesign e senza DOM.

## Variabili globali

| costante | valore | cosa decide |
|---|---|---|
| `MINUTI_LISTA_RECENTE` | 60 | sotto l'ora, la lista scaricata si riusa senza riscaricarla |
| `ORE_REPORT_DA_CHIEDERE` | 4 | oltre le quattro ore un report esistente è troppo vecchio: si rifà senza chiedere |
| `ORE_REPORT_VECCHIO` | 2 | oltre le due si chiede ancora, ma la data va mostrata in evidenza |

Sono esportate perché il test deve poter usare gli stessi numeri del codice, invece di ripeterli.

## Funzioni

### Partire

- `leggiDataItaliana(testo)` → legge `"21/09/2026, 09:20:33"` come lo scrive
  `toLocaleString('it-IT')`, tollerando la virgola, lo spazio o qualunque altro separatore. Torna
  `null` se il testo non è una data italiana completa con anno a quattro cifre.

  **Chi chiama tratta il `null` come «non recente», cioè riscarica:** meglio un download in più che
  un confronto fatto su una lista di cui non si sa l'età.

- `listaERecente(...)` → se la lista scaricata si può riusare.
- `decidiReportEsistente(...)` → cosa fare di un report già aperto: riusarlo, chiedere all'operatore
  o rifarlo, secondo le due soglie orarie.

### Lavorare

- `componiRangePagine(...)` → l'intervallo di pagine su cui il report lavora.
- `ciSonoDatiDaConfrontare(...)`, `differenzeDiConfronto(...)`.

### Chiudere

- `deveChiudereReport(...)` → quando il report smette di valere.
- `esitoChiusuraScheda(...)`, `categoriaRecordRicontrollato(...)`,
  `differenzeDopoRicontrollo(...)` → cosa resta da segnalare dopo che l'operatore ha ricontrollato
  una scheda.
- `sostituisciRecordNellaLista(...)`, `etichettaSegnalazione(...)`.

**Test:** `node --test tests/plugin/reportIntegritaAvvio.test.js`
