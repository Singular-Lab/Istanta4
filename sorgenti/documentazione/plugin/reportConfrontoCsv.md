# reportConfrontoCsv.js

**Cosa è:** come è fatto il csv del Report Integrità. Nasce con I20-981 (Lotto 2).

Stava tutto dentro `confronti.js`, che fa `require('indesign')` e sotto Node non si carica: **il nome
del file, l'ordine delle righe, la virgolettatura e la descrizione composta non erano
verificabili**. Qui restano le regole; in `confronti.js` resta ciò che tocca il disco.

## Variabili globali

Le costanti di formato esistono per una ragione sola: **Excel**.

| costante | valore | perché |
|---|---|---|
| `SEPARATORE_CAMPI` | `;` | Excel apre bene un csv col punto e virgola |
| `FINE_RIGA` | `\r\n` | idem |
| `BOM` | il carattere BOM | idem: senza, gli accenti si rompono |
| `SEPARATORE_DESCRIZIONE` | ` \| ` | fra i pezzi della descrizione composta |
| `PREFISSO_NOME` | `ConfR_` | il nome del file |
| `ESTENSIONE` | `.csv` | |
| `INTESTAZIONI`, `INTESTAZIONI_CONFRONTO` | | le righe di testata, diverse per i due tipi di report |
| `CAMPI_DESCRIZIONE` | | quali campi compongono la descrizione |

## Funzioni

Ventidue membri esportati, in tre mestieri.

### Il nome del file

- `nomeFileReport(...)` e `nomeFileConfronto(...)` → il nome secondo il tipo di report.
- `prossimoProgressivo(...)` → il numero che evita di sovrascrivere un file già lì.
- `nomeFileSicuro(nome)` → toglie dal nome quello che il filesystem non accetta.
- `conSuffissoConfronto(...)`.

### Comporre le righe

- `descrizioneComposta(...)` → mette insieme i campi della descrizione con `SEPARATORE_DESCRIZIONE`.
- `repartoDelRecord(record)`, `datiRecordPerCsv(...)`.
- `campoCsv(valore)` → la virgolettatura: è la funzione che decide quando un valore va fra virgolette
  e come si raddoppiano quelle che contiene.
- `ordinaPerPagina(righe)` → l'ordine con cui le righe compaiono nel file.
- `descriviLista(...)`, `righeIdentitaListe(...)` → le righe che dicono quali liste si stanno
  confrontando.

### Mettere insieme

- `componiCsv(...)` e `componiCsvConfronto(...)` → il file intero, testata compresa.
- `bytesUtf8(testo)` → i byte da scrivere.

## Una nota tecnica

`require('./reportConfronti')` sta **alla riga 278**, a metà file, invece che in testa. Non è un
difetto e non cambia niente a runtime, ma è insolito rispetto a tutto il resto del Plugin e chi
cerca le dipendenze del modulo guardando le prime righe non lo trova.

**Test:** `node --test tests/plugin/reportConfrontoCsv.test.js`
