# versionePlugin.js

**Cosa è:** la regola che confronta la versione installata con quella pubblicata per il cliente.
Lavorare con un Plugin diverso da quello pubblicato vuol dire lavorare con regole diverse da quelle
del server, e i difetti che ne nascono si scoprono a impaginato fatto.

Nasce con I20-987.

## Da sapere

Gli esiti sono **tre e non due** di proposito. Se il server non risponde la versione è **non
verificabile**, non disallineata: il controllo gira a ogni avvio, e bloccare tutti per un guasto che
non è loro fermerebbe il lavoro senza motivo. Si blocca solo su una differenza vera.

Il modulo non tocca né InDesign né il DOM: è una regola, non un pezzo di interfaccia, e per questo
si prova sotto Node da solo.

## Variabili globali

| nome | cos'è |
|---|---|
| `VersionePlugin` | l'oggetto esportato |
| `VersionePlugin.ESITO` | le tre costanti: `allineata`, `disallineata`, `nonVerificabile` |

Le costanti stanno qui e non sparse come stringhe perché chi chiama confronti l'esito con queste, non
con un letterale.

**Nessuna dipendenza esterna:** non usa globali del Plugin.

## Funzioni

- `confronta(installata, pubblicata)` → torna uno dei tre `ESITO`. Se **una delle due** versioni
  manca è `nonVerificabile`, non `disallineata`.
- `ripulisci(versione)` → toglie gli spazi e tratta come vuoto tutto ciò che non è stringa. È la
  ragione per cui `confronta` non esplode su `null` o su un numero.
- `siPuoLavorare(esito)` → `false` **solo** su `disallineata`. Col server che non risponde si
  continua a lavorare.
- `messaggioDisallineamento(installata, pubblicata)` → titolo e dettaglio per l'operatore. Dice
  tutte e due le versioni, perché senza non si capisce se si deve aggiornare o se si è andati avanti
  troppo, e dice cosa fare: il messaggio lo legge chi impagina, non chi ha scritto il codice.
