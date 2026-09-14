# Istanta4 — documentazione del progetto

Questa cartella è la memoria del progetto. È stata scritta il **14 settembre 2026** al termine di
una giornata di pulizia del codice, con lo scopo preciso di permettere a chi arriva dopo — persona
o assistente — di **riprendere il lavoro senza doverlo ricalcolare da zero**.

Tutto quello che c'è scritto qui è stato verificato sul codice e sul server il giorno in cui è stato
scritto. Dove non ho potuto verificare, lo dico esplicitamente: cercare la parola **«non verificato»**.

---

## Da dove partire

Se hai appena clonato il repository e non sai niente del progetto, leggi in quest'ordine:

1. **[01-architettura.md](01-architettura.md)** — cos'è Istanta, da quali pezzi è fatta, chi parla
   con chi, su quali porte. Venti minuti e hai il quadro.
2. **[02-modello-multicliente.md](02-modello-multicliente.md)** — la cosa più importante e meno
   ovvia di tutto il progetto: **un solo codice serve N clienti**, e il cliente si sceglie con la
   configurazione. Se non capisci questo, non capisci perché il codice è fatto così.
3. **[10-runbook.md](10-runbook.md)** — come si compila, come si pubblica, come si fa partire in
   locale. **Attenzione: `appsettings.json` non è in git.** Senza leggere questo non parti.
4. **[03-catene-di-chiamate.md](03-catene-di-chiamate.md)** — i flussi veri dell'applicazione,
   dall'importazione del tracciato all'esportazione del volantino.

Poi, quando ti serve:

| documento | quando leggerlo |
|---|---|
| [04-riferimento-controller.md](04-riferimento-controller.md) | devi trovare una rotta o capire cosa fa un'azione. **Generato dal codice**, non scritto a mano |
| [05-agenzialib.md](05-agenzialib.md) | devi aggiungere o modificare la logica di un cliente |
| [06-istantalib.md](06-istantalib.md) | devi toccare i tipi condivisi o le utilità di basso livello |
| [07-front-end.md](07-front-end.md) | lavori sulle viste o sul javascript |
| [08-dati.md](08-dati.md) | devi capire il database o i json di configurazione |
| [08b-schema-database.md](08b-schema-database.md) | ti serve lo schema esatto: tabelle, colonne, chiavi, indici. **Generato dal database** |
| [09-servizi-satellite.md](09-servizi-satellite.md) | devi capire olimpo, fidelity, correggo4 o il plugin di InDesign |
| [11-rimozioni.md](11-rimozioni.md) | cerchi qualcosa che c'era e non c'è più |
| [12-trappole.md](12-trappole.md) | **leggilo prima di scrivere uno strumento di analisi del codice.** Costa dieci minuti e ne fa risparmiare molte ore |
| [13-da-fare.md](13-da-fare.md) | cerchi il prossimo lavoro |

---

## Le dieci cose da sapere prima di toccare qualsiasi cosa

1. **`appsettings.json` NON è in git** (`.gitignore` riga `appsettings*.json`). Chi clona deve
   crearselo. Il modello è in `soluzione/appsettings.pgtest.json`, e la spiegazione campo per campo
   è in [10-runbook.md](10-runbook.md).
2. **`pubblicato/` NON è in git** e **non è solo output di build**: contiene anche stato vivo —
   `imported_files/` (file caricati dagli utenti), `external_source/` (configurazioni per cliente),
   `external_lib/` (la dll di AgenziaLib). **Non si pulisce per differenza con i sorgenti.**
3. **Si compila con `dotnet build Istanta.csproj`**, o con `Istanta.sln` dal 14/09 in poi. AgenziaLib
   referenzia Istanta, non il contrario.
4. **`AgenziaLib.dll` va copiata a mano** in `pubblicato/wwwroot/external_lib/`: `dotnet publish`
   non la aggiorna.
5. **I log dell'applicazione non sono nel journal di systemd.** `Program.cs` dirotta la Console su
   Serilog: tutto finisce in `pubblicato/logs/log-AAAAMMGG.txt`.
6. **Il cliente si sceglie in `appsettings.json`** (`fico/nomeCliente` + `external_paths/pathSource`)
   e quella scelta si propaga per riflessione fino a AgenziaLib. Vedi
   [02-modello-multicliente.md](02-modello-multicliente.md).
7. **`execLibFunction` lega gli argomenti per NOME del parametro, non per posizione.** Rinominare un
   parametro in `IAgenzia` rompe i chiamanti in silenzio, a runtime.
8. **L'autenticazione passa da Olimpo**, non da Istanta: `LoginMiddleWare` chiama
   `{olympusServerUrl}/auth/checkIdentity`. Senza Olimpo raggiungibile non si entra.
9. **Il codice morto si cancella, non si marca DEPRECATO.** È una scelta esplicita: il git è la
   memoria. Ogni rimozione è registrata in `sorgenti/backup/RIMOZIONI.md` (che però **non è in
   git**: sta solo sul server demo).
10. **Nessuna password è in questo repository, e non deve entrarci.** Le stringhe di connessione
    stanno in `/etc/istanta4-*.env` sul server (permessi `600 root:root`).

---

## Cosa è successo il 14 settembre 2026

Una giornata intera di pulizia: **38.858 righe rimosse** in sedici commit, dal `b377adc` al
`c5e6aae`, con la build sempre a zero errori e i servizi sempre attivi.

Non è stata solo potatura. Sono emersi tre difetti veri che nessuno aveva visto:

- Il **salvataggio del Revisore** non funzionava per Famila, per due bug indipendenti e
  preesistenti (vedi [03-catene-di-chiamate.md](03-catene-di-chiamate.md)).
- **`DbLabels.SetExternalPath` puntava al file di un'altra classe**: avrebbe sovrascritto
  `SourceACPV.json` con il contenuto delle label. Non era mai esploso solo perché quel metodo non
  aveva un chiamante.
- **Un cliente nuovo a cui manca un `Source*.json`** o si vedeva fabbricare un file vuoto in
  silenzio, o mandava l'applicazione in errore. Adesso c'è una fascia gialla in cima a ogni pagina
  che lo dice.

Il dettaglio è in [11-rimozioni.md](11-rimozioni.md).

---

## Come mantenere viva questa documentazione

Questi file invecchiano appena si tocca il codice. Due regole per non farli diventare bugie:

- **Il riferimento dei controller è generato**, non scritto. Lo script che lo produce è in
  `sorgenti/documentazione/strumenti/genera-riferimento.sh`: rilanciarlo dopo una modifica
  strutturale è questione di secondi. Lo stesso vale per lo schema del database.
- **Le altre pagine sono scritte a mano.** Quando cambi qualcosa che contraddice quello che c'è
  scritto qui, correggi la pagina nello stesso commit. Una documentazione sbagliata è peggio di una
  documentazione assente, perché fa perdere tempo invece di farne risparmiare.
