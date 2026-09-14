# Cosa resta da fare

Ordinato per quanto è chiaro cosa fare, non per importanza. In cima le cose definite; in fondo
quelle che richiedono una decisione.

---

## Definite — si possono fare subito

### 1. Famila: due metodi che lanciano `NotImplementedException` e hanno un chiamante

Dei dieci metodi non implementati di `AgenziaLib/Famila.cs`, due sono usati davvero:

- **`confrontaListe`** — `Coopfi` ne ha una versione generica di **8 righe**, riusabile quasi così
  com'è.
- **`elaboraRecordDaClonare`** — lo usa il plugin per `ClonaRecordRicollegato`
  (`MenaboController:12639`). `Coopfi` copia sette chiavi del depliant, fra cui `Codice_PdvRif`,
  che **sanno di Coop**. Per Famila va deciso guardando i campi veri del suo tracciato.

Ricorda: una `NotImplementedException` attraverso la riflessione diventa
`TargetInvocationException`, e se il chiamante la mette in una variabile che non restituisce,
**sparisce**. È già successo con il salvataggio del Revisore.

### 2. I due `CS0162` in `FicoProcessController`

Righe **1492** e **1643**: due `return Ok(bRes)` dopo un `return`, quindi irraggiungibili. Sono
stati lasciati perché i confini di ciò che va tolto vanno guardati a mano — probabilmente c'è un
ramo morto sopra, e la domanda vera è perché.

### 3. `Magick.NET-Q8-AnyCPU 13.9.1` in IstantaLib

Vulnerabilità note: `NU1902` ×4 (gravità moderata), `NU1901` (bassa), `NU1903`. Non aggiornato per
la regola «i pacchetti non si toccano». Merita un momento dedicato — anche perché correggo4 usa già
la **14.16.0** dello stesso pacchetto, quindi la versione nuova è già in casa e funziona.

### 4. `#warning VULNERABILITA'` in `MenaboController`

Da guardare e decidere. Non è stato toccato apposta.

### 5. Le tracce `[EXPMAT]` in `FicoProcessController`

Residui di una sessione di debug. Da capire se servono ancora.

### 6. `ADMINER.txt` e `ACCESSI.txt`

In `soluzione/`, entrambi ignorati da git, entrambi di inizio settembre. **Contengono credenziali e
vanno considerati vecchi.** Da verificare e, se superati, eliminare: un file di credenziali
obsoleto è peggio di nessun file, perché qualcuno ci proverà.

---

## Da decidere

### 7. I metodi che il database può chiamare per nome

Questo è il nodo più importante rimasto sulla pulizia, e **non si scioglie con l'analisi del
codice**.

`execLibFunction` viene chiamato anche con stringhe prese dal database:

```csharp
// TracciatiController.cs:1515
icCtrl.execLibFunction(addestramento.externalCallPerImport!, _pass)
```

Le colonne sono `addestramento_excel.externalCallPerImport`, `.externalCallPerExport`,
`.externalCallPerExportPoP` e `addestramento_excel_relazioni.algoritmo`. **Nel database demo sono
tutte vuote**, su una tabella che ha **una riga sola**.

Per sapere quali metodi di AgenziaLib sono davvero usati serve interrogare il **database di
produzione** di ogni cliente:

```sql
select distinct "externalCallPerImport"    from public.addestramento_excel where "externalCallPerImport"    <> '';
select distinct "externalCallPerExport"    from public.addestramento_excel where "externalCallPerExport"    <> '';
select distinct "externalCallPerExportPoP" from public.addestramento_excel where "externalCallPerExportPoP" <> '';
select distinct "algoritmo"                from public.addestramento_excel_relazioni where "algoritmo"      <> '';
```

Finché quella risposta non c'è, in AgenziaLib **non si toglie nient'altro**.

### 8. L'ordine di `UseAuthorization` e `UseAuthentication`

In `Program.cs`, `UseAuthorization()` (riga 308) sta **prima** di `UseAuthentication()` (riga 309).
È l'ordine invertito rispetto a quello corretto. L'applicazione funziona perché l'autenticazione
vera la fa `LoginMiddleWare` con la sessione, non il middleware di ASP.NET — ma se un giorno si
usasse `[Authorize]` sul serio, non funzionerebbe.

**Non l'ho invertito**: è un cambiamento che va provato con l'autenticazione vera, non fatto di
notte. Ma va sistemato prima che qualcuno ci costruisca sopra.

### 9. `app.UseResponseCompression()` è commentato

La compressione è configurata (Brotli + Gzip, righe 239-252) ma il middleware non è attivo (riga
287 commentata). Al suo posto c'è un handler su `UseStaticFiles` che mette a mano
`Content-Encoding: gzip`. Da qui i `.gz` e `.br` accanto ai file in `pubblicato/wwwroot`.

Funziona, ma è una soluzione parallela a una configurazione inerte. O si attiva il middleware o si
toglie la configurazione: tenerle entrambe confonde chi legge.

### 10. La persistenza delle chiavi di DataProtection

Nel log compaiono `Error unprotecting the session cookie`. Il sintomo tipico è che a ogni riavvio le
sessioni esistenti diventano illeggibili, perché le chiavi sono rigenerate. Con Redis già in casa,
persistere lì le chiavi è la strada naturale.

### 11. Il javascript dentro le viste

**1.629 righe, il 21% delle viste.** `Register/Index.cshtml` è per il 54% javascript,
`_Layout.cshtml` per il 55%. Non è sporcizia — funziona — ma è codice che nessuno strumento
javascript vede, che non si può riutilizzare, e che si trova solo cercando nelle viste.

Spostarlo in `wwwroot/js` renderebbe le viste leggibili. È un lavoro di ore, non di minuti, e va
fatto con qualcuno che possa provare le schermate.

### 12. `Maiora`, `craiOvest`, `navcove`

Hanno una cartella `wwwroot/js/<cliente>/` ma **nessuna classe in AgenziaLib** e nessuna
`external_source/<Cliente>/`. Sono clienti che non hanno mai avuto bisogno di logica lato server, o
la cui classe è stata tolta in passato? La risposta la sa solo chi conosce la storia commerciale, e
decide se quelle tre cartelle restano o vanno.

### 13. Trea è dismesso

La classe (3.165 righe), la cartella js e `external_source/Trea/` restano dove sono per scelta.
A `external_source/Trea/` manca `SourceMeccaniche.json` e **non lo aggiungiamo**. Se un giorno si
decide di chiudere davvero quel cliente, sono 3.165 righe più una cartella.

---

## Il lavoro grosso, se un giorno si vuole affrontare

### 14. I metodi da duemila righe

| righe | dove |
|---|---|
| 2.817 | `AgenziaLib/Edro21.cs` — `esportaVolantino` |
| 2.576 | `AgenziaLib/Edro21.cs` — `esportaPoP` |
| 2.058 | `AgenziaLib/Coopfi.cs` — `esportaPoP` |
| 1.621 | `MenaboController.cs` — `ImpaginaFromInDesignNew` |
| 1.592 | `AgenziaLib/Coopfi.cs` — `esportaVolantino` |
| 1.486 | `OperationsController.cs` — `importaVolantino` |

Sono il cuore del prodotto e il posto dove è più facile rompere qualcosa. Non si toccano senza un
modo per provare il risultato: cioè senza un volantino vero da esportare e con cosa confrontarlo.

**Prima di rifattorizzare, servirebbe un modo di provare.** Oggi non c'è: nessun test automatico in
tutto il progetto.

### 15. `MenaboController`, 12.919 righe

Da solo è un terzo di tutto il codice dei controller. Ha `IdentificaMeccanicaRecord` dichiarato
**tre volte** con firme diverse (righe 2683, 3567, 3265), `Etichettatura` **due volte** (339 e 325
righe), e `ImpaginaFromInDesignNew` con **tre `[Route]`** sulla stessa azione. È cresciuto per
accumulo, e si vede.

### 16. Il workflow GHCR con i Dockerfile per servizio

Rimasto in sospeso da prima del 14/09.

---

## Una cosa da non fare

**Non rifare la pulizia con un analizzatore nuovo senza aver letto
[12-trappole.md](12-trappole.md).** Quattro difetti dell'analizzatore Roslyn hanno portato il conto
dei metodi «morti» da 93 a 22 mentre li si correggeva, e il quarto — gli accessori delle proprietà —
ha quasi fatto cancellare quattro metodi vivi.

Quando uno strumento ti dice che c'è molto codice morto, il sospetto giusto è che sia rotto lui.
