# credenzialiSalvate.js

**Cosa è:** ricordare le credenziali di accesso al Plugin. Nasce con I20-956.

Le credenziali non finiscono in un file né in `localStorage`, che sono leggibili da chiunque apra
la cartella: vanno nell'**archivio cifrato del sistema operativo** — il Portachiavi su Mac,
Gestione credenziali su Windows — tramite `secureStorage` di UXP.

## Da sapere

**Il limite della protezione:** vale per l'utente del sistema. Chi ha accesso a un profilo già
sbloccato può comunque usare il Plugin.

**Nessuna di queste operazioni può far fallire il login.** Se l'archivio non c'è o risponde male,
il Plugin continua a funzionare come prima, chiedendo le credenziali a mano. Per questo le funzioni
tornano `false` o `null` invece di sollevare, e il `catch` del salvataggio è volutamente senza
dettagli: di lì passano le credenziali.

## Variabili globali

| nome | valore |
|---|---|
| `CHIAVE_UTENTE` | `"istanta.plugin.username"` |
| `CHIAVE_PASSWORD` | `"istanta.plugin.password"` |

Esportate perché il test deve poter guardare nello stesso posto dove scrive il codice.

**L'archivio non è una variabile globale:** si passa da fuori a `crea(archivio)`. È la scelta che
rende questa logica verificabile sotto Node senza UXP, e va mantenuta.

## Funzioni

- `aTesto(valore)` → `secureStorage` restituisce i valori come sequenza di byte; qui si torna al
  testo, accettando anche il caso in cui l'archivio restituisca già una stringa.
- `coppiaUtilizzabile(username, password)` → una coppia vale solo se ci sono **entrambe** le parti:
  mezza credenziale farebbe partire un tentativo di accesso destinato a fallire.
- `crea(archivio)` → costruisce le quattro operazioni sull'archivio passato:
  - `disponibile()` → se l'archivio c'è ed espone i tre metodi che servono. Tutto il resto si
    appoggia a questo controllo.
  - `salva(username, password)` → torna `false` invece di sollevare.
  - `leggi()` → la coppia salvata, o `null`.
  - `dimentica()` → come `salva`: non solleva mai.

**Test:** `node --test tests/plugin/credenziali-salvate.test.js`
