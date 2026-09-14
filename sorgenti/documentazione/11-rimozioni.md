# Le rimozioni e le correzioni del 14 settembre 2026

**38.858 righe rimosse** in sedici commit, con la build sempre a zero errori e i quattro servizi
sempre attivi.

## Le regole che erano state concordate

- **Si cancella, non si marca DEPRECATO.** È una deroga esplicita alla regola generale: qui il git
  è la memoria.
- Si procede **per categoria**, non file per file.
- **Prima di cancellare, si chiede**, spiegando il *perché* si ritiene morto e *cosa sembra fare*.
- Doppio registro in `soluzione/sorgenti/backup/`: **`RIMOZIONI.md`** (143 righe: data, file,
  elemento, righe, perché, come si recupera) e **`codice-rimosso.txt`** (40.318 righe con il codice
  integrale). **Non sono in git** — `**/backup*/` è ignorato — e per scelta restano locali sul
  server demo. *Se il server demo sparisce, spariscono con lui: l'unica copia rimasta sarebbe git.*
- **I pacchetti NuGet non si toccano.**
- La rete di sicurezza vera è la build.

## Come si recupera qualcosa

```bash
git log -S "nomeDelMetodo" --oneline        # in quale commit è sparito
git show <commit> -- percorso/del/file.cs   # il diff completo
git show <commit>^:percorso/del/file.cs     # il file com'era prima
```

E sul server demo, `sorgenti/backup/codice-rimosso.txt` ha il testo integrale di tutto, con
l'intestazione `file — righe N-M — rimosso il GG/MM/AAAA`.

---

## I sedici commit

| commit | cosa | righe |
|---|---|---|
| `b377adc` | la pulizia grossa di Istanta, 26 file | 20.209 |
| `32ccaee` | `wwwroot/js`: i due orfani, e una casa per il front-end di Famila | 2.705 |
| `94a9f46` | rettifica: la guardia su `infoEsempio` davvero in `edro21/agenzia.js` | — |
| `fb1125a` | `wwwroot/js`: i blocchi commentati lunghi e `attivaTolltips` | 2.374 |
| `87910d2` | 12 metodi di `ExternalSourceClass` senza entry point | 153 |
| `c2eadcf` | `TryConvertValue` e i due `doActionOnFP` | 107 |
| `6f73548` | **correzione**: `DbLabels.SetExternalPath` puntava al file di `DbACPV` | 1 |
| `c87556d` | **aggiunta**: la fascia dei sorgenti da compilare | +120 |
| `e2a751e` | la fascia anche in `_LayoutLogin` | +15 |
| `421e60b` | `AgenziaLib/_duplicati/`: non compilavano nemmeno | 5.829 |
| `4499227` | AgenziaLib: i blocchi commentati ≥30 righe | 2.767 |
| `76a8769` | le classi cliente `DocRoma` ed `Etruria` | 2.769 |
| `2e9a4ee` | i blocchi nelle viste, e `Istanta.sln` che puntava a un AgenziaLib inesistente | 193 |
| `bbc5e8f` | i warning minori: using duplicati e variabili mai lette | 6 |
| `4e37525` | IstantaLib: 771 righe di commento e tre file .NET Framework | 988 |
| `c5e6aae` | IstantaLib: `XmlInterpreter` intera e due metodi di `PhotoManager` | 758 |

---

## Il mattino — `b377adc`, 20.209 righe

| cosa | righe | perché |
|---|---|---|
| `wwwroot/js/menabo.js` | 7.643 | nessuna vista lo caricava più |
| 34 blocchi commentati ≥40 righe su 9 file | 5.836 | |
| `Views/Menabo/Index.cshtml` | 1.257 | la vista della UI web del menabò, sostituita dal plugin |
| 21 azioni della UI web del menabò in `MenaboController` | 2.214 | |
| `Utility/SuggeritoreDescrizioni.cs` | 963 | |
| `eseguiEsportazione` + `eseguiEsportazionePoP` | 628 | sostituite da `AgenziaLib.<Cliente>.esportaPoP` |
| `RegoleMastro` (controller, vista, code-behind, 5 CRUD) | 393 | |
| 8 blocchi di rotte commentate | 447 | |
| `Utility.cs`: 11 funzioni orfane + `NetworkConnection` + `LogonUser` | 314 | attenzione: **quella di `IstantaLib` resta** |
| `wwwroot/js/regoleMastro.js` | 237 | |
| `ThumbController.cs` | 145 | `System.Drawing` non funziona su Linux |
| `TestController.cs` | 103 | |
| `LoginController/secretDoor` | 65 | |

---

## Il pomeriggio — `wwwroot/js`

Da 34 file e 29.875 righe a **33 file e 26.804**.

- **`navcove.js`** (915) e **`trea/_agenzia.js`** (1.788): due copie vecchie di `class Agenzia`, in
  posti dove nessuna vista le carica, e con la versione buona già nella cartella del cliente.
- **44 blocchi commentati ≥20 righe**, 2.374 righe su 16 file: vecchie versioni di
  `aggiungiCampiRevisioneArchivio`, `calcolaAreaInAreaOutGruppi`, `getForm_importazioneTracciato`,
  `ordinaRecordsTracciato`, `onMessageRevisore`, `mostraOperazioniModal`, `scan`.
- **`attivaTolltips`** in `site.js`, 8 righe: inizializzava i tooltip di Bootstrap, non era nominata
  da nessuna parte, e aveva pure il nome scritto male.

**Funzioni morte trovate nei js: una sola su 26.804 righe.** Il front-end è molto più sano del C#.

È qui che è stata creata **`js/famila/agenzia.js`**: la radice conteneva la copia di Edro21 benché
il cliente configurato fosse Famila, e Famila non aveva una propria cartella d'archivio.

---

## Il pomeriggio — i 22 metodi senza entry point

L'analizzatore Roslyn ne aveva isolati 22, dopo essere passato per 93 → 59 → 31 mentre gli si
correggevano i difetti. Esito:

**5 falsi positivi riconoscibili, tenuti**: i costruttori statici generati da ANTLR
(`ExpressionLexer`, `ExpressionParser` — codice generato, li chiama il CLR) e `ValidateAsync`, che
era la *dichiarazione* nell'interfaccia `IExternalUserValidator` mentre le implementazioni sono
chiamate.

**12 rimossi da `ExternalSourceClass.cs`** (153 righe, il file da 3.663 a 3.510):

| gruppo | metodi |
|---|---|
| framework css | `getDefinizioneById`, `getDefinizioneByName`, `getLivelloyNameDefinizione`, `SetAllineamentiJsonSource` |
| schema menabò | `addSchemaMenabo`, `getIdMenaboProgressivo`, `getIdMenaboSchemaProgressivo` |
| ricerche | `getAreaByGruppoSiti`, `getMastroByName`, `getAreeMeccanica` |
| scritture | `saveRegoleMastro`, `TryMigrateLegacy` |

`getIdMenaboSchemaProgressivo` aveva un solo chiamante al mondo, `addSchemaMenabo`, tolto lì
accanto: **sono caduti insieme**. Le sorelle vive restano (`getLivelloById`,
`getMastroByNameAndFormato`, `addArea`).

**3 rimossi dopo verifica**: `TryConvertValue` (59 righe, `MenaboController` — l'unica occorrenza
del nome era la dichiarazione stessa) e i due `doActionOnFP` (48 righe, `AreeController`: `PUT` e
`GET` verso `{fpUrl}/ACPV/{callName}` con bearer token).

**2 tenuti per scelta**: `SocketHandler.SendMessage(string,string)` e
`ConnectionManager.GetSocketById`. Irraggiungibili anche loro, ma `SocketHandler` è una classe base
astratta e quell'overload è API pubblica.

---

## La sera — AgenziaLib, da 41.098 a 29.734

- **`_duplicati/`**, 5.828 righe: `OperationsController` (3.637), `RevisoreController` (2.070),
  `MeccanicheController` (121). Il csproj le escludeva con `<Compile Remove="_duplicati/**" />`:
  non entravano nella compilazione, non finivano nella dll, e nessuno poteva chiamarle nemmeno per
  riflessione, perché i tipi non esistevano nell'assembly.
- **21 blocchi commentati ≥30 righe**, 2.320 righe: `esportaVolantinoOld` in Edro21 da sola vale
  **687 righe**, `importaVolantino_OLD` in DocRoma 80, un intero ramo di confronto locandine in Trea
  302.
- **`DocRoma.cs`** (2.292) ed **`Etruria.cs`** (477): nessuna delle tre tracce di un cliente vivo.

> Sulla rimozione di `Etruria` una nota di onestà: il controllo sul database ha trovato che
> `promo_tracciati_records.dato` contiene la stringa «Etruria» in **4 righe**. Quasi certamente è il
> nome di un prodotto o di un punto vendita nei dati del tracciato, non un riferimento al codice —
> ma se così non fosse, si torna indietro con un `git revert`.

---

## La sera — le Views e IstantaLib

**Views**: da 8.967 a 8.775 righe. Il numerone conteneva pochissimo: i commenti erano **434 in
tutto**, e i blocchi ≥20 righe erano **tre** (`openModalAssociazioni` in `Mastro`, un modale in
`DeclinazioniMeccaniche`, un vecchio form in `SchedaArticolo`). **Nessuna vista orfana.**

**IstantaLib**: da 3.856 a 2.168 righe, in due commit. Il dettaglio è in
[06-istantalib.md](06-istantalib.md).

---

## Le correzioni — non solo rimozioni

### `System.Drawing` non funziona su questo server

Prova diretta su net10 / Ubuntu 22.04: `TypeInitializationException` su `Gdip`. Da net7
`System.Drawing.Common` è supportato solo su Windows. `ThumbController` è stato tolto e l'unico
chiamante vivo è passato a `olimpo/getThumbNailOnDemand`: **42 warning `CA1416` scesi a 0**.

### Una migrazione che si annullava da sé

In `components.js` le righe 256-272 mettevano l'URL di Olimpo, ma la riga 608 — **nella stessa
funzione `renderRecordRevisione`, dove `olimpoIp` è un parametro** — lo sovrascriveva con `/Thumb`.
Qualcuno aveva iniziato la migrazione e non l'aveva finita.

### Undici `catch` muti

Ora registrano l'eccezione. Zero rimasti.

### Tre `CS4014`

`await` su `logout()` e su `rimuoviRefImpaginata`; su `ScanPacchettoFoto_do` il fire-and-forget
resta ma è **dichiarato**, con l'eccezione che finisce nel logger.

### `DbLabels.SetExternalPath` puntava al file sbagliato

```csharp
this.pathExternalSource = pathExternalSource + "Source" + DbACPV.dbSourceName;
```

Su **dodici** classi `Db*` che costruiscono così il percorso del proprio file, `DbLabels` era
l'unica a nominarne un'altra. Se qualcuno avesse chiamato `DbLabels.SaveChanges()`, il contenuto
delle label sarebbe finito sopra `SourceACPV.json`, che esiste ed è letto da otto punti di
`AreeController`. Non è mai esploso perché `SaveChanges` e `SetExternalPath` di `DbLabels` non
avevano un solo chiamante — ed erano fra i candidati alla rimozione. **Sono stati tenuti e
corretti**, non tolti.

### La fascia dei sorgenti da compilare

Descritta in [02-modello-multicliente.md](02-modello-multicliente.md) e
[07-front-end.md](07-front-end.md). Nasce dalla constatazione che un cliente nuovo a cui manca un
`Source*.json` o se lo vedeva fabbricare vuoto in silenzio (5 getter su 21) o mandava
l'applicazione in errore (gli altri 16), e in nessuno dei due casi lo veniva a sapere.

### `Istanta.sln`

Puntava ancora a `..\IstantaLib\AgenziaLib\AgenziaLib.csproj`, percorso di prima che le cartelle
venissero unificate. `dotnet build` senza argomenti falliva con `MSB3202`. Corretto: adesso
`dotnet build Istanta.sln` funziona.

### I warning minori

Tolti gli `using` duplicati (`CS0105`) e le variabili inizializzate con un valore letterale e mai
lette (`CS0219`): sei righe. **Lasciati per scelta** i due `CS0162` (codice irraggiungibile in
`FicoProcessController` righe 1492 e 1643: due `return Ok(bRes)` dopo un `return` — i confini di
ciò che va tolto vanno guardati a mano) e la `CS0219` su `foundPP` in `SyncFotoController`, che
viene **riassegnata** otto righe più sotto.

---

## Il bug del Revisore

Merita una sezione sua perché è l'unico che si vedeva da fuori, e perché insegna qualcosa.

Il salvataggio dal Revisore restituiva `200 OK` con `[]` e nessun messaggio. **Nessuno dei due bug
dipendeva dalla pulizia**: `Revisore/salva` era identico alla versione in git, 504 righe non
commentate, zero differenze — verificato prima di cercare altrove.

1. **`AgenziaLib.Famila` non implementava `MetaPerRevisione` e
   `GetMetaPerRevisioneDaGruppiMultipli`.** Lanciavano `NotImplementedException`, che attraverso la
   riflessione diventa `TargetInvocationException`, che il `catch` metteva in `result.error` — **una
   variabile mai restituita**, perché il metodo restituisce `descrItemList`. L'eccezione spariva.
2. **`execLibFunction` lega gli argomenti per NOME del parametro.** `IAgenzia.specificaInOutVol`
   chiama il primo parametro `tracciatoSingoli`, il chiamante metteva nel dizionario
   `tracciatoRevisione`: `KeyNotFoundException` a ogni caricamento del Revisore.

Adesso `salva` restituisce `StatusCode(500)` con il messaggio dell'eccezione radice, e `revisore.js`
lo mostra invece di ciclare su una lista vuota.

---

## Cosa NON è stato toccato, e perché

- **Le 20 rotte vive senza chiamante.** Nel fine settimana precedente, correggo4 ne ha adottate due
  che il venerdì erano orfane: su un'API in evoluzione, una lista di «rotte morte» scade in giorni.
- **I metodi `importaVolantino*`** che erano in `DocRoma` sono usciti con la classe, ma il criterio
  resta aperto per gli altri: un nome di metodo può stare in
  `addestramento_excel.externalCallPerImport`, e **il database demo ha una riga sola**.
- **I pacchetti NuGet**, compreso `Magick.NET-Q8-AnyCPU 13.9.1` che ha vulnerabilità note.
- **`#warning VULNERABILITA'`** in `MenaboController`: da segnalare, non da toccare.
- **L'access log di nginx non serve a niente**: su 35.041 richieste in dieci giorni, 35.038 erano i
  `curl` di controllo dei job. nginx sta solo davanti alla `:80` e non fa da proxy.
