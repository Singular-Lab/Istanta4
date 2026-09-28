# logger.js

**Cosa è:** scrive una riga datata in un file di log nella cartella di lavorazione, uno al giorno
per tipo (`[warn]-log_28-9-2026.log`). È l'unico modulo del Plugin che scrive log su disco invece
che in console.

## Da sapere

- **Non ha un percorso suo:** usa la globale `percorsoLogs`, definita in `indexNew.js:82` come
  `"/Logs/"`. È la ragione per cui questo modulo non gira sotto Node da solo: fuori dal Plugin
  quella globale non esiste e `append` fallisce nel `catch`, restituendo `false` in silenzio.
- **Riscrive l'intero file a ogni riga** — lo legge tutto, concatena, riscrive. Regge finché i log
  restano corti.
- **Un solo chiamante oggi:** `events.js:355`, per segnalare che è stato selezionato un elemento non
  autorizzato.

## Variabili globali

| nome | cos'è |
|---|---|
| `fs` | il modulo filesystem di UXP |
| `Logger` | l'oggetto esportato, con `log` e `append` |

Dipende inoltre dalla globale esterna `percorsoLogs`, che **non definisce**.

## Funzioni

- `Logger.log(message, type)` → antepone l'orario ISO al messaggio e lo passa ad `append`. Non
  ritorna niente: chi chiama non sa se ha scritto.
- `Logger.append(message, type)` → compone il nome del file (`[<type>]-log_<g>-<m>-<aaaa>.log` sotto
  `percorsoLogs`), legge quello che c'è, concatena la riga e riscrive il file intero. Torna `true`
  se è riuscita, `false` se qualcosa è andato storto. Il file mancante non è un errore: il `catch`
  interno lo tratta come contenuto vuoto e lo crea.
