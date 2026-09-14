# AgenziaLib — la logica di ogni cliente

**29.734 righe**, tredici file, una libreria .NET che Istanta **non referenzia**: la carica dal
disco per riflessione, a ogni chiamata.

---

## Come è fatta

| file | righe | cos'è |
|---|---|---|
| `Edro21.cs` | 14.279 | il cliente Edro21 — `internal class Edro21 : IAgenzia` |
| `Coopfi.cs` | 6.202 | il cliente Coop Firenze — `public class Coopfi : IAgenzia` |
| `Trea.cs` | 3.165 | il cliente Trea (**dismesso**) — `internal class Trea`, **non implementa IAgenzia** |
| `Pac.cs` | 1.567 | `internal class Pac : IAgenzia` |
| `Class1.cs` | 1.462 | `Interpreter` — l'interprete delle meccaniche promozionali, condiviso |
| `Famila.cs` | 1.000 | `public class Famila : IAgenzia` — **il cliente configurato sul demo** |
| `Gross.cs` | 910 | `internal class Gross`, **non implementa IAgenzia** |
| `Utility.cs` | 594 | utilità — **attenzione: omonima di `Istanta/Utility/Utility.cs`** |
| `Tipi.cs` | 349 | i tipi di AgenziaLib (`DbAree`, `DbACPV`, `DbFormati`, `Mastro`, `Tracciato`, …) |
| `CompiledFieldInterpreter.cs` | 107 | |
| `IAgenzia.cs` | 63 | **il contratto** |
| `Properties/AssemblyInfo.cs` | 36 | |

Il `csproj` è minimo e ha una particolarità che conta:

```xml
<ProjectReference Include="../Istanta/Istanta.csproj" />
```

**AgenziaLib referenzia Istanta, non il contrario.** Compilare AgenziaLib compila prima Istanta.
A runtime il rapporto si inverte: Istanta carica `AgenziaLib.dll` con `Assembly.Load`.

Pacchetti: `Newtonsoft.Json 13.0.1`, `Microsoft.AspNetCore.Mvc.NewtonsoftJson 6.0.10`,
`System.Drawing.Common 6.0.0`.

> **`System.Drawing.Common` è qui e non funziona su Linux.** Da net7 è supportato solo su Windows.
> Se un metodo di AgenziaLib lo usa davvero, su questo server esplode con
> `TypeInitializationException` su `Gdip`. **Quali metodi lo usino non è verificato**: quando
> qualcosa fallisce in esportazione con un errore incomprensibile, questa è la prima cosa da
> guardare.

---

## Il contratto `IAgenzia` — 24 metodi

Da `AgenziaLib/IAgenzia.cs`. Li raggruppo per quello che fanno; le firme complete sono nel file.

### Importazione ed esportazione

| metodo | a cosa serve |
|---|---|
| `importaTracciato` | interpreta il listato importato e lo rimaneggia secondo le regole del cliente |
| `esportaVolantino` | produce il pacchetto per InDesign. **Dodici parametri, sette dei quali percorsi a json di configurazione** |
| `esportaPoP` | come sopra, per i materiali da punto vendita |
| `getColonneReportImportaziones` | le colonne del report di importazione |
| `callbackNamingConventionDynamicField` | campi dinamici nella convenzione di nomenclatura dei file |

### Revisione e firme

| metodo | a cosa serve |
|---|---|
| `MetaPerRevisione` | i metadati da mostrare in revisione per un gruppo di record |
| `GetMetaPerRevisioneDaGruppiMultipli` | idem, per più gruppi (prende un `WrapperPerGetGarante`) |
| `GetMetaPerRevisioneDaGruppiMultipliBatch` | idem, a lotti (`WrapperBatchPerGetGarante`) |
| `FiltraRecordsPerConteggioRevisione` | quali record contare nella revisione |
| `CheckFirmaGarantita` | verifica la «firma» di un gruppo |
| `CheckFirmaPluginGarantitaBatch` | idem, a lotti, dal plugin |
| `specificaInOutVol` | **il metodo del bug del 14/09**: il primo parametro si chiama `tracciatoSingoli` |

### Menabò e impaginazione

| metodo | a cosa serve |
|---|---|
| `eseguiAutoSelezioneGruppo` | sceglie automaticamente quale referenza di un gruppo impaginare |
| `eseguiAutoSelezioneGruppoMassiva` | idem, su molti gruppi |
| `getAlterazioniTracciatoFromIndd` | legge le modifiche fatte a mano dentro InDesign |
| `elaboraTracciatiRecords` | rimaneggia i record prima dell'impaginazione |
| `elaboraRecordDaClonare` | cosa copiare quando si clona una referenza in un altro box |
| `GetCambioStrutturalePath` | le regole di cambio strutturale (in Coopfi sono **379 righe**) |

### Confronti e propagazione

| metodo | a cosa serve |
|---|---|
| `confrontaListe` | confronto fra due tracciati |
| `confrontaListatoVolantino` | confronto fra il volantino impaginato e il listato |
| `ordinaLista` | l'ordinamento della lista secondo le regole del cliente |
| `analizzaPropagazionePerCambioMeta` | cosa propagare quando cambia un metadato |
| `analizzaPropagazionePerModificaCampiOfferta` | idem, quando cambiano i campi dell'offerta |
| `analizzaPropagazionePerRevisione` | idem, dopo una revisione |

---

## Le trentatré chiamate per riflessione

Tutti i punti di Istanta che chiamano AgenziaLib, e con quale metodo. **Questa tabella è la mappa
di dipendenza che il compilatore non può darti.**

| chiamante | metodo di AgenziaLib |
|---|---|
| `Utility/Utility.cs:710` | `ordinaLista` |
| `Utility/Utility.cs:849`, `1028` | `eseguiAutoSelezioneGruppoMassiva` |
| `Utility/Utility.cs:1146` | `eseguiAutoSelezioneGruppo` |
| `Utility/Propagatore.cs:305` | `analizzaPropagazionePer…` |
| `Controllers/OperationsController.cs:820` | `importaTracciato` |
| `Controllers/TracciatiController.cs:1515` | **dal database**: `addestramento.externalCallPerImport` |
| `Controllers/RevisoreController.cs:305` | `FiltraRecordsPerConteggioRevisione` |
| `Controllers/RevisoreController.cs:793`, `2086`, `2542`, `2772` | `GetMetaPerRevisioneDaGruppiMultipli` |
| `Controllers/RevisoreController.cs:2267` | `specificaInOutVol` |
| `Controllers/RevisoreController.cs:2597`, `2826` | `MetaPerRevisione` |
| `Controllers/FicoProcessController.cs:3294` | `CheckFirmaPluginGarantitaBatch` |
| `Controllers/FicoProcessController.cs:4111`, `5819` | (nome costruito a runtime) |
| `Controllers/MenaboController.cs:11442`, `11797`, `12830` | (nome costruito a runtime) |
| `Controllers/MenaboController.cs:12913` | `GetCambioStrutturalePath` |
| `Controllers/ConfrontiController.cs:1395` | `confrontaListe` / `confrontaListatoVolantino` |
| `Controllers/TracciatiController.cs:800-821` | riflessione **fatta a mano**, non via `execLibFunction` |

E la dll viene caricata anche in `Controllers/LoginController.cs:1266`:
`Path.Combine(AppContext.BaseDirectory, "wwwroot", "external_lib", "AgenziaLib.dll")` — per leggerne
la versione e mostrarla nella pagina di login (`ViewBag.versioneAgenziaLib`).

---

## Lo stato di Famila

Famila è il cliente configurato sul server demo, ed è anche il meno completo. Il 14/09 sono stati
implementati **sei** metodi copiando Coopfi:

| metodo | implementazione data |
|---|---|
| `MetaPerRevisione` | `return null;` |
| `GetMetaPerRevisioneDaGruppiMultipli` | `return null;` |
| `GetMetaPerRevisioneDaGruppiMultipliBatch` | `return null;` |
| `FiltraRecordsPerConteggioRevisione` | `return records;` |
| `CheckFirmaPluginGarantitaBatch` | `return null;` |
| `GetCambioStrutturalePath` | `return new List<CambioStrutturale>();` |

Per `GetCambioStrutturalePath` la versione di Coopfi è di 379 righe, ma è il **catalogo di regole di
Coop**: per Famila quelle regole non esistono, e copiarle sarebbe stato peggio che restituire vuoto.

**Dieci metodi lanciano ancora `NotImplementedException`.** Di questi, due hanno un chiamante vero:

- **`confrontaListe`** — Coopfi ne ha una versione generica di 8 righe, riusabile.
- **`elaboraRecordDaClonare`** — usato dal plugin per `ClonaRecordRicollegato`. Coopfi copia sette
  chiavi del depliant, fra cui `Codice_PdvRif`, che **sanno di Coop**. Per Famila va deciso guardando
  i campi veri del suo tracciato.

Ricorda il meccanismo: una `NotImplementedException` attraverso la riflessione diventa una
`TargetInvocationException`, e se il chiamante la mette in una variabile che non restituisce,
**sparisce**. È già successo.

---

## Modificare AgenziaLib: la procedura

1. Modifica il `.cs` del cliente.
2. `cd /srv/istanta4/soluzione/AgenziaLib && dotnet build AgenziaLib.csproj -c Release`
   (compila prima Istanta, per via del `ProjectReference`).
3. **`cp bin/Release/net10.0/AgenziaLib.dll ../pubblicato/wwwroot/external_lib/`** ← il passo che si
   dimentica.
4. `chown serverpop:serverpop` sul file copiato.
5. `systemctl restart istanta4-pgtest`.

Se salti il passo 3, tutto compila e a runtime continua a girare il codice vecchio. Non c'è nessun
messaggio che te lo dica.

> **L'md5 della dll non è un buon controllo di freschezza.** Due build consecutive degli stessi
> sorgenti producono md5 diversi (cambia il MVID). Guarda data e dimensione.

---

## Il codice tolto il 14/09

| cosa | righe | perché |
|---|---|---|
| `_duplicati/OperationsController.cs` | 3.637 | esclusa dalla build con `<Compile Remove="_duplicati/**" />`: non entrava nemmeno nella dll |
| `_duplicati/RevisoreController.cs` | 2.070 | idem |
| `_duplicati/MeccanicheController.cs` | 121 | idem |
| 21 blocchi commentati ≥30 righe | 2.320 | vecchie versioni di metodi, fra cui `esportaVolantinoOld` (687 righe) |
| `DocRoma.cs` | 2.292 | nessuna delle tre tracce di un cliente vivo |
| `Etruria.cs` | 477 | solo la classe, niente front-end né configurazione |

Da 41.098 a 29.734 righe. I commenti sono scesi dal 17,8% al 10,8%.

**Quello che resta è logica di business per cliente**: lì dentro non c'è più niente di
meccanicamente sicuro da togliere. Ogni ulteriore rimozione richiede di sapere cosa fa quel cliente.
