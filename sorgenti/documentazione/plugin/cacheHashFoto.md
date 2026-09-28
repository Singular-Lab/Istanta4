# cacheHashFoto.js

**Cosa è:** la memoria degli hash md5 delle foto collegate. Nasce con I20-981 (Lotto 1).

`Utility.getLinkHash` legge da disco l'intero file dell'immagine e ne calcola l'md5 in JavaScript.
Il Report Integrità lo fa per ogni foto di ogni box in pagina, e su un volantino sono centinaia di
file da qualche MB: **è il costo dominante del report**, e si ripaga solo la prima volta, perché al
secondo report della stessa sessione i file sono gli stessi.

## Da sapere

- La chiave è **percorso + impronta del file** (dimensione e data di modifica). Se il file cambia,
  cambia la chiave e l'hash viene ricalcolato: la cache non può mentire su una foto sostituita.
- Lo stato del link — mancante, non aggiornato — **non viene mai messo in cache**: si rilegge
  sempre da InDesign.
- La memoria dura quanto il codice del Plugin: un reload di UXP la azzera.

## Variabili globali

| nome | cos'è |
|---|---|
| `voci` | la mappa chiave → hash. È lo stato vero del modulo |
| `richieste`, `risposte` | contatori, per capire dai log se la cache sta servendo davvero |

## Funzioni

- `chiave(percorso, metadata)` → la chiave di una foto. Senza un'impronta valida — metadati non
  leggibili — torna `null`, e chi chiama calcola l'hash **senza** cache.
- `ottieni(chiave)` → l'hash memorizzato, o `null`. Incrementa i contatori.
- `memorizza(chiave, hash)` → ignora chiave o hash vuoti.
- `svuota()` → azzera voci e contatori.
- `statistiche()` → quante voci, quante richieste, quante risposte.

**Test:** `node --test tests/plugin/cacheHashFoto.test.js`
