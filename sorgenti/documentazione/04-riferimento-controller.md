# Riferimento dei controller e delle rotte

> **Questo documento e generato**, non scritto a mano. Lo produce
> `strumenti/genera-riferimento.sh` leggendo `Istanta/Controllers/`.
> Non modificarlo: rilancia lo script.
>
> Generato il 12/11/2026 alle 14:42.

## Indice

| controller | righe | azioni | contesti db | AgenziaLib | servizi esterni |
|---|---:|---:|---|---|---|
| [MenaboController](#menabocontroller) | 10102 | 53 | ctx, ctx2 | 4 | — |
| [FicoProcessController](#ficoprocesscontroller) | 6855 | 76 | ctx, ctx2 | 2 | correggoServerUrl, fpUrl, olUrl |
| [RevisoreController](#revisorecontroller) | 4458 | 21 | ctx, ctx2 | 9 | olympusServerUrl |
| [SyncFotoController](#syncfotocontroller) | 3865 | 47 | ctx, ctx2 | — | olympusServerUrl |
| [ConfrontiController](#confronticontroller) | 2061 | 12 | ctx, ctx2 | 1 | — |
| [TracciatiController](#tracciaticontroller) | 2016 | 29 | ctx, ctx2 | 1 | — |
| [OperationsController](#operationscontroller) | 1908 | 3 | ctx | — | — |
| [LoginController](#logincontroller) | 1395 | 25 | ctx | — | olympusServerUrl |
| [AreeController](#areecontroller) | 1069 | 16 | ctx | — | — |
| [ArchivioController](#archiviocontroller) | 822 | 9 | ctx | — | olympusServerUrl |
| [DeclinazioniMeccanicheController](#declinazionimeccanichecontroller) | 522 | 15 | — | — | — |
| [MenaboSettingsController](#menabosettingscontroller) | 510 | 13 | ctx2 | — | — |
| [FrameworkCssController](#frameworkcsscontroller) | 411 | 15 | ctx | — | — |
| [IstantaController](#istantacontroller) | 384 | 9 | — | 3 | — |
| [ApiController](#apicontroller) | 350 | 7 | ctx, ctx2 | — | — |
| [RegisterController](#registercontroller) | 329 | 5 | ctx, ctx2 | — | — |
| [PromoBackupController](#promobackupcontroller) | 304 | 5 | — | — | — |
| [SchedaArticoloController](#schedaarticolocontroller) | 272 | 7 | ctx | — | olympusServerUrl |
| [DiagnosticaController](#diagnosticacontroller) | 197 | 3 | — | — | — |
| [EtichetteController](#etichettecontroller) | 193 | 8 | — | — | — |
| [MeccanicheController](#meccanichecontroller) | 114 | 4 | — | — | — |
| [NoExternalValidator *(non e un controller)*](#noexternalvalidator) | 95 | 5 | — | — | — |
| [CustomPlugin](#customplugin) | 81 | 3 | — | — | — |
| [HomeController](#homecontroller) | 78 | 3 | — | — | — |
| [AgenziaScriptController](#agenziascriptcontroller) | 76 | 1 | — | — | — |
| [TaskManagerController](#taskmanagercontroller) | 31 | 1 | — | — | — |

**Totale: 26 controller, 395 azioni pubbliche, 38498 righe.**

Legenda delle colonne:

- **contesti db**: `ctx` e il contesto anagrafico (`edro21_dbContext`), `ctx2` quello delle promozioni (`Edro21_DbContext2`)
- **AgenziaLib**: quante chiamate per riflessione partono da questo controller
- **servizi esterni**: quali indirizzi configurati usa

---

## AgenziaScriptController

`Istanta/Controllers/AgenziaScriptController.cs` — 76 righe, 1 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (1):

- `IWebHostEnvironment ambiente`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Script** | 22 | 52 | `[HttpGet]`<br>`[Route("Agenzia/script.js")]` | `IActionResult` | — | — | — |


## ApiController

`Istanta/Controllers/ApiController.cs` — 350 righe, 7 azioni pubbliche.
 Eredita da `Controller`.

Attributo di classe: `[ApiController]`
Attributo di classe: `[Route("[controller]/")]`

**Dipendenze iniettate** (8):

- `ILogger<ApiController> logger`
- `IConfiguration configuration`
- `IOptions<PathOperationExport> option_export`
- `IOptions<PathOperationImport> option_import`
- `IOptions<PathExternal> external_paths`
- `IOptions<FicoConfig> ficoConfig`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **doAttivitaByID** | 61 | 7 | `[HttpGet]`<br>`[Route("attivita/doById/{id}")]` | `Task<IActionResult>` | — | — | — |
| **confermaAttivitaByUtente** | 71 | 40 | `[HttpGet]`<br>`[Route("attivita/confermaAttivitaByUtente/{id}/{persistenza}/{report}")]` | `Task<IActionResult>` | — | — | ctx |
| **ConfermaAttivitaDellaPromoByUtente** | 114 | 54 | `[HttpGet]`<br>`[Route("attivita/confermaAttivitaDellaPromoByUtente/{id}/{persistenza}/{report}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **scartaAttivitaByUtente** | 171 | 38 | `[HttpGet]`<br>`[Route("attivita/scartaAttivitaByUtente/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **getStatoAttivitaByID** | 212 | 39 | `[HttpGet]`<br>`[Route("attivita/getStato/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **getAttivitaByTimeRange** | 254 | 70 | `[HttpGet]`<br>`[Route("attivita/getAttivitaByTimeRange/{minutiDaSottrarre}/{includeAllPending}/{includeAllOngoing}")]` | `Task<IActionResult>` | — | — | ctx |
| **getLogErrorAttivita** | 339 | 5 | `[HttpGet]`<br>`[Route("attivita/getLogErrorAttivita/{id_attivita}")]` | `Task<IActionResult>` | — | — | ctx |


## ArchivioController

`Istanta/Controllers/ArchivioController.cs` — 822 righe, 9 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (7):

- `ILogger<ArchivioController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> olConfig`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IHttpClientFactory httpClientFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 133 | 8 | — | `Task<IActionResult>` | — | — | — |
| **Index** | 143 | 7 | `[HttpPost]` | `Task<IActionResult>` | — | — | — |
| **Index** | 319 | 28 | `[HttpPut]`<br>`[Route("Archivio/Update")]` | `Task<IActionResult>` | — | — | ctx |
| **salvaArticoloByCodice** | 350 | 109 | `[HttpPut]`<br>`[Route("Archivio/salvaArticoloByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **GetDescrizioneByCodice** | 462 | 15 | `[HttpPut]`<br>`[Route("Archivio/GetDescrizioneByCodice")]` | `Task<IActionResult>` | — | — | ctx |
| **GetDescrizioneByAreaCanale** | 480 | 15 | `[HttpPut]`<br>`[Route("Archivio/GetDescrizioneByAreaCanale")]` | `Task<IActionResult>` | — | — | ctx |
| **downloadFotoByIdArticolo** | 498 | 80 | `[HttpGet]`<br>`[Route("Archivio/downloadFoto/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **caricaFotoManuale** | 591 | 99 | `[HttpPost]`<br>`[Route("Archivio/caricaFotoManuale")]` | `Task<IActionResult>` | — | — | ctx |
| **caricaDump** | 722 | 98 | `[HttpPost]`<br>`[Route("Archivio/caricaDump")]` | `Task<IActionResult>` | — | — | ctx |


## AreeController

`Istanta/Controllers/AreeController.cs` — 1069 righe, 16 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (6):

- `ILogger<AreeController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> ficoConf`
- `IHttpClientFactory httpClientFactory`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 48 | 6 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 56 | 25 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 85 | 19 | `[HttpPost]`<br>`[Route("Aree/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Index** | 108 | 14 | `[HttpPost]`<br>`[Route("Aree/Setting")]` | `Task<IActionResult>` | — | — | ctx |
| **Index** | 126 | 14 | `[HttpGet]`<br>`[Route("Aree/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **getAree** | 190 | 4 | `[HttpGet]`<br>`[Route("ACPV/getAree")]` | `Task<IActionResult>` | — | — | — |
| **getCanali** | 198 | 4 | `[HttpGet]`<br>`[Route("ACPV/getCanali")]` | `Task<IActionResult>` | — | — | — |
| **salvaCanale** | 205 | 74 | `[HttpPut]`<br>`[Route("ACPV/salvaCanale")]` | `Task<IActionResult>` | — | — | — |
| **eliminaCanale** | 282 | 72 | `[HttpDelete]`<br>`[Route("ACPV/eliminaCanale/{guidID}")]` | `Task<IActionResult>` | — | — | — |
| **salvaArea** | 357 | 82 | `[HttpPut]`<br>`[Route("ACPV/salvaArea")]` | `Task<IActionResult>` | — | — | — |
| **eliminaArea** | 442 | 72 | `[HttpDelete]`<br>`[Route("ACPV/eliminaArea/{guidID}")]` | `Task<IActionResult>` | — | — | — |
| **setCombinazione** | 517 | 70 | `[HttpPut]`<br>`[Route("ACPV/setCombinazione")]` | `Task<IActionResult>` | — | — | — |
| **eliminaCombinazione** | 590 | 72 | `[HttpDelete]`<br>`[Route("ACPV/eliminaCombinazione/{guidID}")]` | `Task<IActionResult>` | — | — | — |
| **salvaPV** | 665 | 70 | `[HttpPut]`<br>`[Route("ACPV/salvaPV")]` | `Task<IActionResult>` | — | — | — |
| **eliminaPV** | 738 | 72 | `[HttpDelete]`<br>`[Route("ACPV/eliminaPV/{guidID}")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCode** | 1040 | 25 | `[HttpPut]`<br>`[Route("ACPV/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


## ConfrontiController

`Istanta/Controllers/ConfrontiController.cs` — 2061 righe, 12 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (8):

- `ILogger<ArchivioController> logger`
- `IConfiguration configuration`
- `IOptions<PathOperationImport> option_import`
- `IOptions<PathOperationExport> option_export`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> ficoConf`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 67 | 4 | — | `IActionResult` | (omonima) | — | — |
| **CheckCombinazioni** | 74 | 54 | `[HttpGet]`<br>`[Route("Confronti/CheckCombinazioni/{idPromo1}/{idPromo2}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ConfrontaListe2** | 131 | 986 | `[HttpPut]`<br>`[Route("Confronti/ConfrontaListe2")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **leggiDatoExcel** | 1118 | 284 | — | `ImportResult` | — | `importaTracciato` | ctx, ctx2 |
| **esportaComeListaDiImportazione** | 1405 | 194 | `[HttpPut]`<br>`[Route("Confronti/esportaComeListaDiImportazione")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **Settings** | 1601 | 4 | — | `IActionResult` | Settings | — | — |
| **salvaSourceJsonCode** | 1608 | 29 | `[HttpPut]`<br>`[Route("Confronti/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |
| **PaginaPuliziaListe** | 1646 | 4 | `[HttpGet]`<br>`[Route("Confronti/PuliziaListe")]` | `IActionResult` | PuliziaListe | — | — |
| **listeDellaPromo** | 1654 | 39 | `[HttpGet]`<br>`[Route("Confronti/listeDellaPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **puliziaListeReport** | 1702 | 46 | `[HttpPut]`<br>`[Route("Confronti/puliziaListeReport")]` | `Task<IActionResult>` | — | — | ctx2 |
| **puliziaListeElimina** | 1755 | 53 | `[HttpPut]`<br>`[Route("Confronti/puliziaListeElimina")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **canaliAreeDellaPromo** | 1904 | 31 | `[HttpGet]`<br>`[Route("Confronti/canaliAreeDellaPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |


## CustomPlugin

`Istanta/Controllers/CustomPlugin.cs` — 81 righe, 3 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (6):

- `ILogger<CustomPlugin> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> ficoConf`
- `IHttpClientFactory httpClientFactory`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 48 | 6 | — | `Task<IActionResult>` | (omonima) | — | — |
| **getCustomPlugin** | 63 | 5 | `[HttpGet]`<br>`[Route("CustomPlugin/getCustomPlugin")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCode** | 71 | 8 | `[HttpPut]`<br>`[Route("CustomPlugin/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


## DeclinazioniMeccanicheController

`Istanta/Controllers/DeclinazioniMeccanicheController.cs` — 522 righe, 15 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<DeclinazioniMeccanicheController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 27 | 7 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 36 | 49 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | — |
| **AddDeclinazioneAvanzata** | 88 | 49 | `[HttpGet]`<br>`[Route("DeclinazioniMeccanicheAvanzate/AddDeclinazioneAvanzata/{Nome}/{LivelloMeccanica}/{LivelloEsternoMeccanicaAvanzata}/{Formato}")]` | `Task<IActionResult>` | (omonima) | — | — |
| **AddRimozioneDeclinazioneAvanzata** | 140 | 26 | `[HttpGet]`<br>`[Route("RimozioneMeccanicheAvanzate/AddRimozioneDeclinazioneAvanzata/{Nome}/{LivelloMeccanica}/{LivelloEsternoMeccanicaAvanzata}/{timeToApplyEnum}")]` | `Task<IActionResult>` | (omonima) | — | — |
| **AddCombinazioneMeccanica** | 169 | 46 | `[HttpGet]`<br>`[Route("CombinazioneMeccanica/AddCombinazione/{Nome}/{Formato}")]` | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 218 | 52 | `[HttpPost]`<br>`[Route("DeclinazioniMeccaniche/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **CombinazioniMeccanicheUpdate** | 273 | 35 | `[HttpPost]`<br>`[Route("CombinazioneMeccanica/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **MeccanicaAvanzataUpdate** | 311 | 53 | `[HttpPost]`<br>`[Route("DeclinazioniMeccanicheAvanzate/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **RimozioneMeccanicaAvanzataUpdate** | 367 | 30 | `[HttpPost]`<br>`[Route("RimozioneMeccanicheAvanzate/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Index** | 400 | 23 | `[HttpGet]`<br>`[Route("DeclinazioniMeccaniche/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **CombinazioniMeccanicheDelete** | 426 | 10 | `[HttpGet]`<br>`[Route("CombinazioneMeccanica/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **MeccanicaAvanzataDelete** | 439 | 24 | `[HttpGet]`<br>`[Route("DeclinazioniMeccanicheAvanzate/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **RimozioneMeccanicaAvanzataDelete** | 466 | 24 | `[HttpGet]`<br>`[Route("RimozioneMeccanicheAvanzate/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **scaricaDeclinazioniMeccaniche** | 502 | 6 | `[HttpGet]`<br>`[Route("DeclinazioniMeccaniche/scaricaDeclinazioniMeccaniche")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCode** | 511 | 8 | `[HttpPut]`<br>`[Route("DeclinazioniMeccaniche/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


## DiagnosticaController

`Istanta/Controllers/DiagnosticaController.cs` — 197 righe, 3 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (5):

- `IConfiguration configuration`
- `IOptions<PathExternal> ext`
- `IOptions<FicoConfig> fico`
- `IDbContextFactory<edro21_dbContext> factory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Propaga** | 40 | 12 | `[Route("Diagnostica/Propaga")]` | `IActionResult` | — | — | — |
| **Ctx2** | 57 | 23 | `[Route("Diagnostica/Ctx2")]` | `IActionResult` | — | — | — |
| **ArchivioTempi** | 86 | 108 | `[Route("Diagnostica/Archivio")]` | `Task<IActionResult>` | — | — | — |


## EtichetteController

`Istanta/Controllers/EtichetteController.cs` — 193 righe, 8 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<MeccanicheController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 31 | 8 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 41 | 27 | `[HttpPost]` | `Task<IActionResult>` | — | — | — |
| **Update** | 72 | 22 | `[HttpPost]`<br>`[Route("Etichette/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **UpdateRegole** | 97 | 15 | `[HttpPost]`<br>`[Route("Etichette/UpdateRegole/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Add** | 115 | 29 | `[HttpPost]`<br>`[Route("Etichette/Add")]` | `Task<IActionResult>` | — | — | — |
| **Delete** | 147 | 14 | `[HttpGet]`<br>`[Route("Etichette/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **scaricaEtichette** | 164 | 6 | `[HttpGet]`<br>`[Route("Etichette/scaricaEtichette")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCode** | 181 | 8 | `[HttpPut]`<br>`[Route("Etichette/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


## FicoProcessController

`Istanta/Controllers/FicoProcessController.cs` — 6855 righe, 76 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (9):

- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> ficoConf`
- `IOptions<PathOperationImport>? option_import`
- `IHttpClientFactory httpClientFactory`
- `IMemoryCache? memoryCache`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IOptions<AuthADOptions> authAD_options`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2 = null`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 133 | 4 | — | `IActionResult` | (omonima) | — | — |
| **getTracciatiFromIdkitLavorazione** | 138 | 33 | — | `List<int>` | — | — | ctx2 |
| **getFormContext** | 201 | 51 | `[HttpGet]`<br>`[Route("FicoProcess/getFormContext/{type}")]` | `Task<IActionResult>` | — | — | — |
| **getSchemasContext** | 255 | 55 | `[HttpGet]`<br>`[Route("FicoProcess/getSchemasContext")]` | `Task<IActionResult>` | — | — | — |
| **getSourceFields_deprecata** | 313 | 93 | `[HttpGet]`<br>`[Route("FicoProcess/getSourceFields/{guidId}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getSourceFields** | 408 | 93 | `[HttpGet]`<br>`[Route("FicoProcess/getSourceFields/{guidId}/{scope}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getCombinazioniLavorazioneByPromo** | 508 | 67 | `[HttpGet]`<br>`[Route("FicoProcess/getCombinazioniLavorazioneByPromo/{guidId}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getLabels** | 578 | 47 | `[HttpGet]`<br>`[Route("FicoProcess/getLabels")]` | `Task<IActionResult>` | — | — | — |
| **getAddestramenti** | 628 | 127 | `[HttpGet]`<br>`[Route("FicoProcess/getAddestramenti/{all}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getFormati** | 758 | 32 | `[HttpGet]`<br>`[Route("FicoProcess/getFormati")]` | `Task<IActionResult>` | — | — | — |
| **salvaFormato** | 793 | 32 | `[HttpPut]`<br>`[Route("FicoProcess/salvaFormato")]` | `Task<IActionResult>` | — | — | — |
| **eliminaFormato** | 828 | 30 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaFormato/{idFormato}")]` | `Task<IActionResult>` | — | — | — |
| **inizioNuovaLavorazione** | 907 | 53 | `[HttpPut]`<br>`[Route("FicoProcess/inizioNuovaLavorazione")]` | `Task<IActionResult>` | — | — | ctx2 |
| **aggiornaPromo** | 963 | 76 | `[HttpPut]`<br>`[Route("FicoProcess/aggiornaPromo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **eliminaPromo** | 1042 | 64 | `[HttpDelete]`<br>`[Route("FicoProcess/eliminaPromo/{guidPromo}/{eliminazioneTotale}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **restorePromo** | 1109 | 51 | `[HttpGet]`<br>`[Route("FicoProcess/restore/{guidPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **Upload** | 1163 | 166 | `[HttpPost]`<br>`[Route("FicoProcess/uploadTracciato")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getStatoImportazione** | 1332 | 63 | `[HttpGet]`<br>`[Route("FicoProcess/getStatoImportazione/{guidID}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getTipiDiExport** | 1403 | 30 | `[HttpGet]`<br>`[Route("FicoProcess/getTipiDiExport")]` | `Task<IActionResult>` | — | — | — |
| **salvaTipoDiExport** | 1436 | 33 | `[HttpPut]`<br>`[Route("FicoProcess/salvaTipoDiExport")]` | `Task<IActionResult>` | — | — | — |
| **eliminaTipoDiExport** | 1472 | 31 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaTipoDiExport/{guidId}")]` | `Task<IActionResult>` | — | — | — |
| **getAllNamingConventionComponents** | 1552 | 27 | `[HttpGet]`<br>`[Route("FicoProcess/getAllNamingConventionComponents")]` | `Task<IActionResult>` | — | — | — |
| **salvaNamingConvention** | 1582 | 36 | `[HttpPut]`<br>`[Route("FicoProcess/salvaNamingConvention")]` | `Task<IActionResult>` | — | — | — |
| **eliminaNamingConvention** | 1621 | 33 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaNamingConvention/{guidId}")]` | `Task<IActionResult>` | — | — | — |
| **getSchemaAddestramentoById** | 1702 | 48 | `[HttpGet]`<br>`[Route("FicoProcess/getSchemaAddestramentoById/{id}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAllDeclinazioniKit** | 1754 | 28 | `[HttpGet]`<br>`[Route("FicoProcess/getAllDeclinazioniKit")]` | `Task<IActionResult>` | — | — | — |
| **getCombinazioniByPromo** | 1786 | 140 | `[HttpGet]`<br>`[Route("FicoProcess/getCombinazioniByPromo/{guidPromo}/{guidFormato}/{guidCanale}/{guidArea}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **iniziaLavorazione** | 1930 | 126 | `[HttpGet]`<br>`[Route("FicoProcess/iniziaLavorazione/{guidPromo}/{guidId}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **AvvisoRecordNonCompletati** | 2060 | 7 | — | `string` | — | — | — |
| **AvvisoRecordNonCompletato** | 2070 | 5 | — | `string` | — | — | — |
| **processaKit** | 2079 | 252 | `[HttpGet]`<br>`[Route("FicoProcess/processaKit/{id}/{mode}/{noCache}")]//{guidId}/{guidRaccoglitore}/{guidPromo}/{guidArea}/{guidCanale}/{guidFormato}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getTracciatiDelKit** | 2332 | 67 | — | `List<PromoTracciati>` | — | — | ctx2 |
| **svuotaMaterialeKitFP** | 2402 | 77 | `[HttpGet]`<br>`[Route("FicoProcess/svuotaMaterialeKitFP/{idKit}/{guidIdTipoExport}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **esportaMateriale** | 2518 | 202 | `[HttpPost]`<br>`[Route("FicoProcess/esportaMateriale")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **GruppiMisti** | 3000 | 12 | — | `List<string>` | — | — | — |
| **TuttoFuoriVolantino** | 3015 | 44 | — | `bool` | — | — | — |
| **impacchettaInfoRecord** | 3556 | 255 | — | `ArticoloInRevisione` | — | — | ctx |
| **getDescrizione** | 3812 | 264 | — | `ArticoloInRevisione` | — | — | — |
| **getFoto** | 4077 | 158 | — | `ArticoloInRevisione` | — | — | — |
| **etichettaRecords** | 4237 | 57 | — | `List<ArticoloInRevisione>` | — | — | — |
| **esportaConLogicheDiAgenzia** | 4296 | 44 | — | `TracciatoResultKit` | — | 1 a runtime | — |
| **chiaveDellImpaginazione** | 4356 | 4 | — | `string` | — | — | — |
| **annotaSostituzioneFoto** | 4367 | 16 | — | `void` | — | — | — |
| **applicaNoRenderAiMembriGruppoFoto** | 4430 | 30 | — | `void` | — | — | — |
| **applicaNoRenderAgliElementiDelBox** | 4482 | 23 | — | `void` | — | — | — |
| **applicaTestiDalBox** | 4515 | 41 | — | `Dictionary<string, HashSet<string>>` | — | — | — |
| **versioniDeiRecordConTesti** | 4590 | 21 | — | `Dictionary<long, byte>` | — | — | ctx2 |
| **togliTestiDalBoxAllineati** | 4616 | 20 | — | `void` | — | — | ctx2 |
| **applicaExtraDellaLavorazione** | 4644 | 66 | — | `void` | — | — | — |
| **stessaExtraManuale** | 4715 | 8 | — | `bool` | — | — | — |
| **corrispettivoNelVolantino** | 4749 | 18 | — | `MetaDelVolantino?` | — | — | — |
| **metaPerIlPop** | 4772 | 15 | — | `RevisioneMetaPromoLavorazioni` | — | — | — |
| **metaDelVolantinoPerIlPop** | 4794 | 31 | — | `Dictionary<string, RevisioneMetaPromoLav` | — | — | — |
| **sostituisciConIMetaDelVolantino** | 4833 | 41 | — | `HashSet<string>` | — | — | — |
| **descrizioneDelGruppoAlSoloCartello** | 4889 | 32 | — | `Dictionary<string, List<TestoDalBox>>` | — | — | — |
| **applicaDescrizioniAiCartelliDiGruppo** | 4927 | 17 | — | `void` | — | — | — |
| **togliStatoDeiTestiEreditati** | 4945 | 17 | — | `void` | — | — | — |
| **metaDeiVolantiniDellaPromo** | 4968 | 31 | — | `List<MetaDelVolantino>` | — | — | ctx2 |
| **updateDatiFromMetaPromoLavorazioni** | 5024 | 243 | — | `List<ArticoloInKit>` | — | — | — |
| **downloadKitRuntimeFromFP** | 5270 | 75 | `[HttpPut]`<br>`[Route("FicoProcess/downloadKitRuntimeFromFP")]` | `Task<IActionResult>` | — | — | ctx2 |
| **componiInformazioniPerKitRuntimeFromFP** | 5346 | 264 | — | `downloadFromFPResult` | — | — | — |
| **checkFiltro** | 5611 | 239 | — | `bool` | — | — | — |
| **getLoghiBolli** | 6012 | 32 | `[HttpGet]`<br>`[Route("FicoProcess/getLoghiBolli")]` | `Task<IActionResult>` | — | — | — |
| **getOrdinamentoMerceologico** | 6052 | 26 | `[HttpGet]`<br>`[Route("FicoProcess/getOrdinamentoMerceologico")]` | `Task<IActionResult>` | — | — | — |
| **CostruisciOrdinamentoMerceologico** | 6081 | 30 | — | `FicoOrdinamentoMerceologicoResult` | — | — | — |
| **getAuthUrlSchedaPromoLavorazioneToFP** | 6116 | 56 | `[HttpPut]`<br>`[Route("FicoProcess/getAuthUrlSchedaPromoLavorazioneToFP")]` | `Task<IActionResult>` | — | — | ctx |
| **getAuthUrlAD** | 6175 | 81 | `[HttpGet]`<br>`[Route("FicoProcess/getAuthUrlAD/{dest}")]` | `Task<IActionResult>` | — | — | ctx |
| **Auth** | 6259 | 5 | `[HttpGet]`<br>`[Route("FicoProcess/Auth/{authUrl}")]` | `Task<IActionResult>` | — | — | — |
| **AuthLanded** | 6267 | 9 | `[HttpGet]`<br>`[Route("FicoProcess/AuthLanded")]` | `Task<IActionResult>` | — | — | — |
| **AuthADLanded** | 6279 | 44 | `[HttpGet]`<br>`[Route("FicoProcess/AuthADLanded")]` | `Task<IActionResult>` | — | — | ctx |
| **getSchedaRef** | 6334 | 54 | `[HttpPut]`<br>`[Route("FicoProcess/getSchedaRef")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAllFotoDByCodice** | 6391 | 46 | `[HttpGet]`<br>`[Route("FicoProcess/getAllFotoByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **correggiFotoESelezioniFromCorreggo** | 6441 | 158 | `[HttpPut]`<br>`[Route("FicoProcess/correggiFotoESelezioniFromCorreggo")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getAllFotoExtra** | 6602 | 55 | `[HttpGet]`<br>`[Route("FicoProcess/getAllFotoExtra/{filter}")]` | `Task<IActionResult>` | — | — | — |
| **analisiMomento** | 6662 | 153 | `[HttpPost("FicoProcess/analisiMomento")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **analisiConfronto** | 6817 | 33 | `[HttpPost("FicoProcess/analisiConfronto")]` | `Task<IActionResult>` | — | `confrontaListe` | — |


## FrameworkCssController

`Istanta/Controllers/FrameworkCssController.cs` — 411 righe, 15 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<FrameworkCssController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 28 | 7 | — | `Task<IActionResult>` | (omonima) | — | — |
| **MappaStili** | 36 | 5 | — | `Task<IActionResult>` | MappaStili | — | — |
| **AllineamentiBox** | 42 | 5 | — | `Task<IActionResult>` | AllineamentiBox | — | — |
| **Index** | 49 | 27 | `[HttpPost]` | `Task<IActionResult>` | — | — | — |
| **AddLivello** | 80 | 25 | `[HttpGet]`<br>`[Route("FrameworkCssController/AddLivello/{ordine}")]` | `Task<IActionResult>` | — | — | — |
| **EditOrdineLivello** | 108 | 23 | `[HttpGet]`<br>`[Route("FrameworkCssController/EditOrdineLivello/{idLiv}/{nuovoOrdine}")]` | `Task<IActionResult>` | — | — | — |
| **AddDefinizione** | 134 | 27 | `[HttpPost]`<br>`[Route("FrameworkCssController/AddDefinizione/{idLiv}")]` | `Task<IActionResult>` | — | — | — |
| **UpdateDefinizione** | 164 | 51 | `[HttpPut]`<br>`[Route("FrameworkCssController/UpdateDefinizione")]` | `Task<IActionResult>` | — | — | — |
| **UpdateRegoleDefinizione** | 218 | 30 | `[HttpPost]`<br>`[Route("FrameworkCssController/UpdateRegoleDefinizione/{percorso}")]` | `Task<IActionResult>` | — | — | ctx |
| **DeleteLivello** | 251 | 23 | `[HttpGet]`<br>`[Route("FrameworkCssController/DeleteLivello/{idLivello}")]` | `Task<IActionResult>` | — | — | — |
| **DeleteDefenizione** | 277 | 23 | `[HttpGet]`<br>`[Route("FrameworkCssController/DeleteDefenizione/{idDefinizione}")]` | `Task<IActionResult>` | — | — | — |
| **scaricaFramework** | 305 | 6 | `[HttpGet]`<br>`[Route("FrameworkCssController/scaricaFramework")]` | `Task<IActionResult>` | — | — | — |
| **scaricaAllineamenti** | 314 | 6 | `[HttpGet]`<br>`[Route("FrameworkCssController/scaricaAllineamenti")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCode** | 352 | 14 | `[HttpPut]`<br>`[Route("FrameworkCssController/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCodeForMappaStile** | 369 | 17 | `[HttpPut]`<br>`[Route("MappaStili/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


## HomeController

`Istanta/Controllers/HomeController.cs` — 78 righe, 3 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (1):

- `ILogger<HomeController> logger`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 21 | 45 | — | `IActionResult` | (omonima) | — | — |
| **Privacy** | 67 | 4 | — | `IActionResult` | (omonima) | — | — |
| **Error** | 73 | 4 | — | `IActionResult` | — | — | — |


## IstantaController

`Istanta/Controllers/IstantaController.cs` — 384 righe, 9 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `string connString`
- `string path_external_lib=""`
- `string path_external_source=""`
- `IDbContextFactory<edro21_dbContext> dbContextFactory=null`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **getJsonObject** | 23 | 16 | — | `Dictionary<string, object>` | — | — | — |
| **getValueOfJsonObject** | 40 | 12 | — | `object` | — | — | — |
| **FindIn** | 52 | 45 | — | `bool` | — | — | — |
| **addLog** | 118 | 9 | — | `AttivitaLog` | — | — | — |
| **parseAddesttramentoValue** | 128 | 116 | — | `object` | — | — | — |
| **getParameterInfo** | 245 | 20 | — | `ParameterInfo[]` | — | — | — |
| **execLibFunctionRichiesta** | 305 | 4 | — | `object` | — | 1 a runtime | — |
| **execLibFunction** | 310 | 4 | — | `object` | — | 2 a runtime | — |
| **ErroreDiMetodoMancante** | 377 | 4 | — | `string` | — | — | — |


## LoginController

`Istanta/Controllers/LoginController.cs` — 1395 righe, 25 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (8):

- `IConfiguration configuration`
- `ILogger<LoginController> logger`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IOptions<PathExternal> external_lib`
- `IOptions<AuthADOptions> authAD_options`
- `IOptions<FicoConfig>fico_config`
- `IHttpClientFactory httpClientFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 99 | 28 | — | `IActionResult` | (omonima) | — | — |
| **Index** | 131 | 245 | `[HttpPost]`<br>`[Route("LoginController/login")]` | `IActionResult` | — | — | ctx |
| **Start** | 380 | 15 | `[HttpGet]`<br>`[Route("LoginController/auth/entra")]` | `IActionResult` | — | — | — |
| **Complete** | 397 | 100 | `[HttpGet("/LoginController/oauth/complete")]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **OAuthLanded** | 499 | 131 | `[HttpGet("/LoginController/oauth/landed")]` | `Task<IActionResult>` | — | — | ctx |
| **ChangePassword** | 634 | 51 | `[HttpPost]`<br>`[Route("LoginController/ChangePassword")]` | `Task<IActionResult>` | — | — | ctx |
| **ResetPassword** | 689 | 56 | `[HttpPost]`<br>`[Route("LoginController/ResetPassword")]` | `Task<IActionResult>` | — | — | ctx |
| **InviaEmailPerRecuperaPassword** | 749 | 53 | `[HttpPost]`<br>`[Route("LoginController/InviaEmailPerRecuperaPassword")]` | `Task<IActionResult>` | — | — | ctx |
| **RecuperoPassword** | 806 | 47 | `[HttpGet]`<br>`[Route("LoginController/recuperoPassword/{codifica}")]` | `IActionResult` | (omonima) | — | ctx |
| **getTokenDiAccesso** | 856 | 70 | `[HttpGet]`<br>`[Route("LoginController/getTokenDiAccesso")]` | `Task<IActionResult>` | — | — | ctx |
| **getSession** | 939 | 40 | `[HttpGet]`<br>`[Route("LoginController/getSession")]` | `Task<IActionResult>` | — | — | ctx |
| **setSession** | 982 | 5 | — | `Task<IActionResult>` | — | — | — |
| **setSessionName** | 988 | 5 | — | `Task<IActionResult>` | — | — | — |
| **setRecoverySession** | 994 | 5 | — | `Task<IActionResult>` | — | — | — |
| **logoutFromPage** | 1002 | 5 | `[HttpGet]`<br>`[Route("LoginController/logoutFromPage")]` | `Task<IActionResult>` | — | — | — |
| **logout** | 1010 | 10 | `[HttpGet]`<br>`[Route("LoginController/logout")]` | `Task<IActionResult>` | — | — | — |
| **register** | 1023 | 64 | `[HttpPost]`<br>`[Route("LoginController/register")]` | `Task<IActionResult>` | — | — | ctx |
| **IsConsecutive** | 1089 | 17 | — | `bool` | — | — | — |
| **ping** | 1109 | 4 | `[HttpGet]`<br>`[Route("LoginController/ping")]` | `Task<IActionResult>` | — | — | — |
| **Upgrade** | 1118 | 49 | `[HttpPost]`<br>`[Route("LoginController/Upgrade")]` | `Task<IActionResult>` | — | — | — |
| **UpgradeCheck** | 1170 | 50 | `[HttpGet]`<br>`[Route("LoginController/UpgradeCheck/{sessionId}")]` | `Task<IActionResult>` | — | — | — |
| **getVersion** | 1223 | 8 | `[HttpGet]`<br>`[Route("LoginController/getVersion")]` | `Task<IActionResult>` | — | — | — |
| **getAgenziaLibVersion** | 1256 | 5 | `[HttpGet]`<br>`[Route("LoginController/getAgenziaLibVersion")]` | `Task<IActionResult>` | — | — | — |
| **getVersionePluginPubblicata** | 1311 | 24 | `[HttpGet]`<br>`[Route("LoginController/getVersionePluginPubblicata")]` | `Task<IActionResult>` | — | — | — |
| **getDownloadLinkOfPlugin** | 1338 | 52 | `[HttpGet]`<br>`[Route("LoginController/getDownloadLinkOfPlugin")]` | `Task<IActionResult>` | — | — | — |


## MeccanicheController

`Istanta/Controllers/MeccanicheController.cs` — 114 righe, 4 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<MeccanicheController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 28 | 8 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 38 | 27 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 69 | 18 | `[HttpPost]`<br>`[Route("Meccaniche/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Index** | 90 | 15 | `[HttpGet]`<br>`[Route("Meccaniche/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |


## MenaboController

`Istanta/Controllers/MenaboController.cs` — 10102 righe, 53 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (10):

- `ILogger<MenaboController>? logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<PathOperationExport>? option_export`
- `IHttpClientFactory? httpClientFactory`
- `IMemoryCache? memoryCache`
- `IOptions<PathOperationImport>? option_import`
- `IOptions<FicoConfig> ficoConf`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **getListaTracciatoNew** | 105 | 66 | `[HttpGet]`<br>`[Route("Menabo/getListaTracciatoNew2/{idLavorazione}/{noCache}")]` | `Task<IActionResult>` | — | — | — |
| **Etichettatura** | 172 | 339 | — | `List<ArticoloInRevisione>` | — | — | — |
| **Etichettatura** | 512 | 325 | — | `ArticoloInRevisione` | — | — | — |
| **GetMastroAssociate** | 838 | 58 | — | `List<ArticoloInRevisione>` | — | — | — |
| **GetMastroAssociate** | 896 | 46 | — | `ArticoloInRevisione` | — | — | — |
| **getDbRegoleMastro** | 945 | 13 | `[HttpGet]`<br>`[Route("Menabo/getDbRegoleMastro")]` | `Task<IActionResult>` | — | — | — |
| **IdentificaMeccanicaRecord** | 1391 | 563 | — | `RecordPostControlloMeccaniche` | — | — | — |
| **IdentificaCodiceBox** | 1955 | 527 | — | `string` | — | — | — |
| **esporta** | 3032 | 50 | `[HttpPut]`<br>`[Route("Menabo/esporta")]` | `Task<IActionResult>` | — | — | ctx2 |
| **downloadPacchettoFoto** | 3085 | 82 | `[HttpGet]`<br>`[Route("Menabo/donwloadPacchettoFoto/{id_tracciato}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **esportaPoP** | 3176 | 50 | `[HttpPut]`<br>`[Route("Menabo/esportaPoP")]` | `Task<IActionResult>` | — | — | ctx2 |
| **SvuotaPagina** | 3229 | 22 | `[HttpGet]`<br>`[Route("Menabo/SvuotaPagina/{idKit}/{pagSelected}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **svuotaMenabo** | 3254 | 21 | `[HttpGet]`<br>`[Route("Menabo/svuotaMenabo/{idKit}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getListaImpaginati** | 3290 | 21 | `[HttpGet]`<br>`[Route("Menabo/getListaImpaginati/{idLavorazione}")]` | `List<elementoImpaginato>` | — | — | ctx, ctx2 |
| **ElementiImpaginati** | 3316 | 12 | — | `List<elementoImpaginato>` | — | — | — |
| **AutoreDelReport** | 3332 | 4 | — | `short` | — | — | — |
| **PortaAPagina** | 3341 | 10 | — | `bool` | — | — | — |
| **getLavorazioniDellaPromo** | 3367 | 18 | `[Route("Menabo/getLavorazioniDellaPromo/{idLavorazione}")]` | `IActionResult` | — | — | ctx2 |
| **RestoreCacheConfronto** | 3389 | 64 | `[HttpPost]`<br>`[Route("Menabo/restoreCacheConfronto")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ImpaginaFromInDesignNew** | 3614 | 1621 | `[HttpPut]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}")]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}/{confronto}")]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{noCache}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **CalcolaEspressione** | 5319 | 33 | — | `int` | — | — | — |
| **GetBoxDisponibile** | 5353 | 11 | — | `int` | — | — | — |
| **OttieniListaImpaginazione** | 5365 | 48 | — | `OkResultGruppi` | — | — | — |
| **consecutivePagesAutoImpaginazione** | 5421 | 40 | — | `int` | — | — | — |
| **findGriglia** | 5461 | 116 | — | `Griglia` | — | — | — |
| **findGrigliaNew** | 5578 | 86 | — | `Griglia` | — | — | — |
| **getFormatiValidiGriglie** | 5665 | 4 | — | `List<string>` | — | — | — |
| **LeggiTracciatoRecord** | 5673 | 187 | `[HttpPut]`<br>`[Route("Menabo/LeggiTracciatoRecord/{idTracciato}/{importa}/{isPop}/{getMastro}/{getOnlyMeta}/{leggiDaOgniTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getTracciatoByCodice** | 5861 | 42 | — | `int` | — | — | ctx2 |
| **getSchedeRefs** | 5907 | 48 | `[HttpPut]`<br>`[Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}")]`<br>`[Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]` | `Task<IActionResult>` | — | — | — |
| **RisultatoDellaSchedaNelMassivo** | 5964 | 39 | — | `ArticoloInRevisioneKitResult` | — | — | — |
| **getSchedaRef** | 6008 | 763 | `[HttpPut]`<br>`[Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}")]`<br>`[Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **impaginaSingolo** | 6774 | 143 | `[HttpPut]`<br>`[Route("Menabo/impaginaSingolo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **PreAnalisiMismatch** | 6921 | 281 | `[HttpPut]`<br>`[Route("Menabo/PreAnalisiMismatch/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **syncImpaginatoConServer** | 7205 | 269 | `[HttpPut]`<br>`[Route("Menabo/syncImpaginatoConServer/{id_lavorazione}/{impaginaETogliDaImpaginato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **inserisciBoxInPromoLavorazioniRecord** | 7477 | 48 | `[HttpPut]`<br>`[Route("Menabo/inserisciBoxInPromoLavorazioniRecord/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | — |
| **PagineDellIntervallo** | 7528 | 24 | — | `List<Byte>` | — | — | — |
| **ricollegaBox** | 7555 | 408 | `[HttpPut]`<br>`[Route("Menabo/ricollegaBox")]` | `Task<IActionResult>` | — | — | ctx2 |
| **modificaPrimarieSecondarie** | 8016 | 41 | `[HttpPut]`<br>`[Route("Menabo/modificaPrimarieSecondarie/{idOperazione}")]` | `Task<IActionResult>` | — | — | — |
| **modificaNoRender** | 8074 | 39 | `[HttpPut]`<br>`[Route("Menabo/modificaNoRender/{idOperazione}")]` | `Task<IActionResult>` | — | — | — |
| **modificaExtraLavorazione** | 8133 | 30 | `[HttpPut]`<br>`[Route("Menabo/modificaExtraLavorazione/{idOperazione}")]` | `IActionResult` | — | — | — |
| **modificaTestiDalBox** | 8182 | 35 | `[HttpPut]`<br>`[Route("Menabo/modificaTestiDalBox/{idOperazione}")]` | `IActionResult` | — | — | ctx2 |
| **Sgruppa** | 8300 | 308 | `[HttpPut]`<br>`[Route("Menabo/Sgruppa/{idKitLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | `elaboraTracciatiRecords` | ctx2 |
| **Raggruppa** | 8612 | 323 | `[HttpPut]`<br>`[Route("Menabo/Raggruppa/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | `elaboraTracciatiRecords` | ctx2 |
| **rimettiInVolantino** | 9035 | 83 | `[HttpPut]`<br>`[Route("Menabo/rimettiInVolantino/{idLavorazione}")]` | `IActionResult` | — | — | ctx2 |
| **setArtwork** | 9121 | 85 | `[HttpPut]`<br>`[Route("Menabo/setArtwork/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **setCambioStrutturale** | 9209 | 113 | `[HttpPut]`<br>`[Route("Menabo/setCambioStrutturale/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | — |
| **cambioMetaRecordInLavorazione** | 9326 | 4 | `[HttpPut]`<br>`[Route("Menabo/cambiaMetaRecordInLavorazione/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | — |
| **TestoCambioNonRiuscito** | 9629 | 9 | — | `string` | — | — | — |
| **RipristinaDecimaliDelClone** | 9645 | 24 | — | `void` | — | — | — |
| **rimuoviRefImpaginata** | 9673 | 138 | `[HttpPut]`<br>`[Route("Menabo/rimuoviRefImpaginata/{idLavorazione}/{eliminaDaTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ClonaRecordRicollegato** | 9814 | 273 | `[HttpPut]`<br>`[Route("Menabo/ClonaRecordRicollegato/{idKitLavorazione}")]` | `Task<IActionResult>` | — | `elaboraRecordDaClonare` | ctx2 |
| **getCambioStrutturale** | 10091 | 8 | `[HttpGet]`<br>`[Route("Menabo/getCambioStrutturale")]` | `Task<IActionResult>` | — | `GetCambioStrutturalePath` | — |


## MenaboSettingsController

`Istanta/Controllers/MenaboSettingsController.cs` — 510 righe, 13 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<MenaboSettingsController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Ordinamento** | 33 | 4 | — | `IActionResult` | Ordinamento | — | — |
| **salvaSchemaOrdinamento** | 41 | 28 | `[HttpPost]`<br>`[Route("MenaboSettings/salvaSchemaOrdinamento")]` | `Task<IActionResult>` | — | — | — |
| **addRuleToClassificatoreUniversale** | 72 | 20 | `[HttpPut]`<br>`[Route("MenaboSettings/addRuleToClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **editRuleOfClassificatoreUniversale** | 95 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/editRuleOfClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **deleteRuleOfClassificatoreUniversale** | 117 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/deleteRuleOfClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **addOrdinamento** | 139 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/addOrdinamento")]` | `Task<IActionResult>` | — | — | — |
| **editOrdinamentoUniversale** | 161 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/editOrdinamentoUniversale")]` | `Task<IActionResult>` | — | — | — |
| **editOrdinamentoUniversale** | 183 | 47 | `[HttpPut]`<br>`[Route("MenaboSettings/multiEditOrdinamentoUniversale")]` | `Task<IActionResult>` | — | — | — |
| **creaOrdinamentoAutomatico** | 234 | 226 | `[HttpGet]`<br>`[Route("MenaboSettings/creaOrdinamentoAutomatico")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSourceJsonCodeForOrdinamentoLista** | 463 | 32 | `[HttpPut]`<br>`[Route("MenaboSettings/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |
| **Formati** | 496 | 4 | — | `IActionResult` | Formati | — | — |
| **TipiDiExport** | 500 | 4 | — | `IActionResult` | TipiDiExport | — | — |
| **NamingConventions** | 504 | 4 | — | `IActionResult` | NamingConventions | — | — |


## NoExternalValidator

`Istanta/Controllers/AuthController.cs` — 95 righe, 5 azioni pubbliche.
 Eredita da `IExternalUserValidator`.

> **Questo file non contiene un controller.** La classe qui sopra e la prima
> dichiarata nel file, ma non eredita da `Controller` e non si chiama come il
> file. Le "azioni" elencate sono metodi pubblici ordinari, non rotte HTTP.

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **ExternalValidationResult** | 13 | 7 | — | `record` | — | — | — |
| **ValidateAsync** | 17 | 6 | — | `Task<ExternalValidationResult>` | — | — | — |
| **ValidateAsync** | 30 | 13 | — | `Task<ExternalValidationResult>` | — | — | — |
| **GetGraphTokenAsync** | 47 | 47 | — | `Task<string>` | — | — | — |
| **IsUserEnabledInEntraAsync** | 64 | 29 | — | `Task<bool>` | — | — | — |


## OperationsController

`Istanta/Controllers/OperationsController.cs` — 1908 righe, 3 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (8):

- `string conn_string`
- `string path_to_import`
- `string path_to_export`
- `string external_lib = ""`
- `string external_source = ""`
- `string ficoClientName=""`
- `IDbContextFactory<edro21_dbContext> dbContextFactory=null`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2 = null`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 79 | 4 | — | `IActionResult` | (omonima) | — | — |
| **Add** | 84 | 146 | — | `Task<IActionResult>` | — | — | ctx |
| **EseguiByID** | 231 | 82 | — | `Task<IActionResult>` | — | — | ctx |


## PromoBackupController

`Istanta/Controllers/PromoBackupController.cs` — 304 righe, 5 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (2):

- `ILogger<PromoBackupController> logger`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 26 | 4 | — | `IActionResult` | (omonima) | — | — |
| **lista** | 33 | 30 | `[HttpGet]`<br>`[Route("PromoBackup/lista/{idPromo}")]` | `Task<IActionResult>` | — | — | — |
| **crea** | 66 | 27 | `[HttpPut]`<br>`[Route("PromoBackup/crea")]` | `Task<IActionResult>` | — | — | — |
| **ripristina** | 96 | 56 | `[HttpPut]`<br>`[Route("PromoBackup/ripristina")]` | `Task<IActionResult>` | — | — | — |
| **elimina** | 159 | 20 | `[HttpDelete]`<br>`[Route("PromoBackup/elimina/{idBackup}")]` | `Task<IActionResult>` | — | — | — |


## RegisterController

`Istanta/Controllers/RegisterController.cs` — 329 righe, 5 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (3):

- `IConfiguration configuration`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 29 | 65 | — | `IActionResult` | (omonima) | — | ctx |
| **autorizzaOperazioneDaSync** | 104 | 135 | `[HttpPut]`<br>`[Route("RegisterController/autorizzaOperazioneDaSync")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **readLogFilesDiSistema** | 242 | 22 | `[HttpGet]`<br>`[Route("RegisterController/getLogFiles")]` | `Task<IActionResult>` | — | — | — |
| **readLogsDiSistema** | 267 | 17 | `[HttpGet]`<br>`[Route("RegisterController/ricercaLogs/{file}/{nLines}")]` | `Task<IActionResult>` | — | — | — |
| **ricercaAudits** | 287 | 40 | `[HttpPost]`<br>`[Route("RegisterController/ricercaAudits")]` | `Task<IActionResult>` | — | — | ctx |


## RevisoreController

`Istanta/Controllers/RevisoreController.cs` — 4458 righe, 21 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (9):

- `ILogger<RevisoreController> logger`
- `IConfiguration configuration`
- `IOptions<PathOperationImport> option_import`
- `IOptions<PathExternal> external_paths`
- `IOptions<FicoConfig> olConfig`
- `IOptions<AntlrOptions> antlr_options`
- `IOptions<FicoConfig> ficoConf`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 80 | 50 | `[HttpGet]` | `Task<IActionResult>` | (omonima) | — | ctx2 |
| **viewOlimpoIp** | 153 | 5 | — | `void` | — | — | — |
| **recSemplificato** | 159 | 54 | — | `record` | — | — | — |
| **ChiaveSingoloRevisione** | 219 | 4 | — | `string` | — | — | — |
| **getConteggioListaRevisione** | 226 | 660 | `[HttpPost]`<br>`[Route("Revisore/getConteggio")]` | `Task<IActionResult>` | — | `FiltraRecordsPerConteggioRevisione`, `GetMetaPerRevisioneDaGruppiMultipliBatch`, 2 a runtime | ctx, ctx2 |
| **getListaRevisione2** | 1198 | 1252 | `[HttpPost]`<br>`[Route("Revisore/getListaRevisione2")]` | `Task<IActionResult>` | — | `GetMetaPerRevisioneDaGruppiMultipliBatch`, 1 a runtime | ctx, ctx2 |
| **convertiDaArticoliDescrizioniARevisioneRegionale** | 2451 | 30 | — | `List<RevisioneRegionale>` | — | — | — |
| **getArticoliDescrizioniSottogruppi** | 2484 | 48 | `[HttpPut]`<br>`[Route("Revisore/getArticoliDescrizioniSottogruppi/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **salva** | 2535 | 659 | `[HttpPut]`<br>`[Route("Revisore/salva/{idTracciato}/{idOperazione}/{sender}")]` | `Task<IActionResult>` | — | `MetaPerRevisione`, 2 a runtime | ctx, ctx2 |
| **TestoSalvataggioInterrotto** | 3198 | 4 | — | `string` | — | — | — |
| **componiExtraAutoFields** | 3258 | 48 | — | `string` | — | — | — |
| **elimina** | 3309 | 122 | `[HttpPut]`<br>`[Route("Revisore/elimina/{idTracciato}/{idOperazione}/{sender}")]` | `Task<IActionResult>` | — | — | ctx |
| **Sync** | 3433 | 6 | — | `IActionResult` | Sync | — | ctx2 |
| **searchTracciatoByTitle** | 3442 | 17 | `[HttpPut]`<br>`[Route("Revisore/searchTracciatoByTitle")]` | `Task<IActionResult>` | — | — | ctx2 |
| **searchTracciatoByPromo** | 3462 | 16 | `[HttpGet]`<br>`[Route("Revisore/searchTracciatoByPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **AggiungiSottogruppo** | 3482 | 169 | `[HttpGet]`<br>`[Route("Revisore/AggiungiASottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **RimuoviDaSottogruppo** | 3656 | 171 | `[HttpGet]`<br>`[Route("Revisore/RimuoviDaSottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ControllaRevisioniPromo** | 3831 | 89 | `[HttpGet]`<br>`[Route("Revisore/ControllaRevisioniPromo/{idpromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **salvaRefFromIndd** | 3923 | 312 | `[HttpPut]`<br>`[Route("Revisore/salvaRefFromIndd")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **checkLastModifica** | 4270 | 87 | `[HttpPost]` | `CheckLastModificaResult` | — | — | ctx |
| **salvaCampoInDatoTracciato** | 4361 | 94 | `[HttpPut]`<br>`[Route("Revisore/salvaCampoInDatoTracciato/{idTracciato}/{idPromo}")]` | `BoolResult` | — | — | ctx2 |


## SchedaArticoloController

`Istanta/Controllers/SchedaArticoloController.cs` — 272 righe, 7 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (6):

- `ILogger<MeccanicheController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IOptions<FicoConfig> olConfig`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IOptions<SyncOptions> sync_options`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 40 | 4 | — | `IActionResult` | (omonima) | — | — |
| **Index** | 47 | 34 | `[HttpGet]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **getAllFotoDByCodice** | 120 | 31 | `[HttpGet]`<br>`[Route("SchedaArticolo/getAllFotoByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **Index** | 155 | 44 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **DeleteFoto** | 202 | 14 | `[HttpPost]`<br>`[Route("SchedaArticolo/DeleteFoto/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **AggiornaPrimario** | 220 | 15 | `[HttpPut]`<br>`[Route("SchedaArticolo/AggiornaPrimario")]` | `Task<IActionResult>` | — | — | ctx |
| **AggiornaDestinazioneFoto** | 245 | 25 | `[HttpPut]`<br>`[Route("SchedaArticolo/AggiornaDestinazioneFoto")]` | `Task<IActionResult>` | — | — | ctx |


## SyncFotoController

`Istanta/Controllers/SyncFotoController.cs` — 3865 righe, 47 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (11):

- `ILogger<SyncFotoController> logger`
- `IConfiguration configuration`
- `IOptions<PathOperationExport> option_export`
- `IOptions<PathExternal> external_lib`
- `IOptions<SyncOptions> sync_options`
- `IOptions<FicoConfig> olConfig`
- `IHttpClientFactory httpClientFactory`
- `IMemoryCache memoryCache`
- `IOptions<AntlrOptions> antlr_options`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 92 | 6 | — | `IActionResult` | (omonima) | — | — |
| **LoghiBolli** | 99 | 5 | — | `IActionResult` | (omonima) | — | — |
| **Registro** | 105 | 4 | — | `IActionResult` | (omonima) | — | — |
| **UploadFileZip** | 133 | 37 | `[HttpPost]`<br>`[Route("SyncFoto/UploadFileZip")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFoto** | 176 | 15 | `[HttpPut]//[HttpPost]`<br>`[Route("SyncFoto/ScanPacchettoFoto")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFotoCheck** | 891 | 19 | `[HttpGet]`<br>`[Route("SyncFoto/ScanPacchettoFotoCheck/{guidid}")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFotoByFotoUri** | 913 | 104 | `[HttpGet]//[HttpPost]`<br>`[Route("SyncFoto/ScanPacchettoFotoByFotoUri/{idPromo}/{idTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **PacchettoScaduto** | 1025 | 10 | — | `bool` | — | — | — |
| **downloadPacchettoFoto** | 1040 | 108 | `[HttpPut]`<br>`[Route("SyncFoto/downloadPacchettoFoto")]` | `Task<IActionResult>` | — | — | — |
| **SyncPacchettoFoto** | 1151 | 324 | `[HttpPut]`<br>`[Route("SyncFoto/SyncPacchettoFoto/{overwriteOption}")]` | `Task<IActionResult>` | — | — | ctx |
| **EstensioniPostProduzione** | 1482 | 9 | — | `string[]` | — | — | — |
| **OrdineDiRegistrazione** | 1499 | 12 | — | `List<FileOlympoSync>` | — | — | — |
| **FotoCheDevonoPrevalere** | 1520 | 26 | — | `List<SyncFile>` | — | — | — |
| **OrarioDiRegistrazione** | 1552 | 4 | — | `DateTime` | — | — | — |
| **RegistraScansioneNonRiuscita** | 1563 | 12 | — | `void` | — | — | — |
| **ScansioneNonRiuscita** | 1576 | 4 | — | `string?` | — | — | — |
| **EsitiDopoSync** | 1588 | 52 | — | `List<string>` | — | — | — |
| **AnteprimaSync** | 1649 | 4 | `[HttpPut]`<br>`[Route("SyncFoto/AnteprimaSync")]` | `IActionResult` | — | — | — |
| **ConsolidaSelezione** | 1664 | 37 | `[HttpPut]`<br>`[Route("SyncFoto/ConsolidaSelezione")]` | `Task<IActionResult>` | — | — | ctx |
| **PacchettoFotoPerOlimpo** | 1708 | 11 | — | `MultipartFormDataContent` | — | — | — |
| **FotoExtraDaScaricare** | 1725 | 17 | — | `List<FileOlympoSync>` | — | — | — |
| **FotoExtraDellaRef** | 1745 | 23 | — | `List<LogoBollo_ExtraNoAuto>` | — | — | — |
| **LeggiFotoExtra** | 1771 | 16 | — | `List<LogoBollo_ExtraNoAuto>?` | — | — | — |
| **RecordConFotoNelPacchetto** | 1792 | 9 | — | `List<ArticoloInKit>` | — | — | — |
| **FotoExtraDeiRecord** | 1819 | 18 | — | `List<FileOlympoSync>` | — | — | — |
| **ConTipoDelleRichieste** | 1840 | 21 | — | `List<FileOlympoSync>` | — | — | — |
| **attivaDisattivaFotoExtra** | 1864 | 28 | `[HttpGet]`<br>`[Route("SyncFoto/attivaDisattivaFotoExtra/{guidId}/{attiva}")]` | `Task<IActionResult>` | — | — | ctx |
| **scanSyncFromDb** | 1896 | 39 | `[HttpGet]`<br>`[Route("SyncFoto/scanSyncFromDb")]` | `Task<IActionResult>` | — | — | ctx |
| **updateFotoFromIndd** | 1949 | 387 | `[Route("SyncFoto/updateFotoFromIndd/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **updateImmagineEsistente** | 2357 | 144 | `[Route("SyncFoto/updateImmagineEsistente/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **linkLogoBollo** | 2581 | 51 | `[HttpPut]`<br>`[Route("SyncFoto/linkLogoBollo")]` | `Task<IActionResult>` | — | — | ctx |
| **RimuoviFotoDaMeta** | 2636 | 61 | `[HttpGet]`<br>`[Route("SyncFoto/RimuoviFotoDaMeta/{codice}/{tipo}/{idLavorazione}/{idRec}/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **RimuoviFoto** | 2700 | 52 | `[HttpPut]`<br>`[Route("SyncFoto/RimuoviFoto/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **escludiIncludiFotoExtraAuto** | 2755 | 62 | `[HttpPut]`<br>`[Route("SyncFoto/escludiIncludiFotoExtraAuto/{escludi}")]` | `Task<IActionResult>` | — | — | ctx |
| **caricamentoFotoMassivoOld** | 2820 | 56 | `[HttpGet]`<br>`[Route("SyncFoto/caricamentoFotoMassivoOld/{elementiPagine}/{pagina}")]` | `Task<IActionResult>` | — | — | ctx |
| **getPacchettoFotoAsContract** | 2879 | 140 | `[HttpGet]`<br>`[Route("SyncFoto/getPacchettoFotoTracciatoAsContract/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx |
| **getFotosAsContractNew** | 3024 | 97 | `[HttpPut]`<br>`[Route("SyncFoto/getFotosAsContractNew/{id_lavorazione}")]`<br>`[Route("SyncFoto/getFotosAsContract/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getFoto** | 3122 | 62 | — | `ArticoliFoto` | — | — | — |
| **getPacchettoLoghiBolliAsContract** | 3193 | 58 | `[HttpGet]`<br>`[Route("SyncFoto/getPacchettoLoghiBolliAsContract")]` | `Task<IActionResult>` | — | — | — |
| **getInfoFoto** | 3276 | 57 | `[HttpGet]`<br>`[Route("SyncFoto/getInfoFoto/{guid}")]` | `Task<IActionResult>` | — | — | ctx |
| **getLoghiBolli** | 3338 | 11 | `[HttpGet]`<br>`[Route("LoghiBolli/get")]` | `Task<IActionResult>` | — | — | — |
| **salvaSourceJsonCodeLoghiBolli** | 3355 | 5 | `[HttpPut]`<br>`[Route("LoghiBolli/salvaSourceJsonCode")]` | `IActionResult` | — | — | — |
| **getLogoBolloBySigla** | 3363 | 23 | `[HttpGet]`<br>`[Route("LoghiBolli/getBySigla/{codice}")]` | `Task<IActionResult>` | — | — | — |
| **getLogoBolloByGuidId** | 3387 | 23 | — | `LogoBolloOperationResult` | — | — | — |
| **salvaLogoBollo** | 3448 | 131 | `[HttpPost]`<br>`[Route("LoghiBolli/salva")]` | `Task<IActionResult>` | — | — | — |
| **eliminaLogoBollo** | 3660 | 31 | `[HttpGet]`<br>`[Route("LoghiBolli/elimina/{id}")]` | `Task<IActionResult>` | — | — | — |
| **ricercaNelRegistro** | 3699 | 57 | `[HttpPost]`<br>`[Route("SyncFoto/ricercaNelRegistro")]` | `Task<IActionResult>` | — | — | ctx |


## TaskManagerController

`Istanta/Controllers/TaskManagerController.cs` — 31 righe, 1 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (3):

- `ILogger<RevisoreController> logger`
- `IConfiguration configuration`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 24 | 5 | `[HttpGet]` | `Task<IActionResult>` | (omonima) | — | — |


## TracciatiController

`Istanta/Controllers/TracciatiController.cs` — 2016 righe, 29 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (8):

- `ILogger<TracciatiController> logger`
- `IConfiguration configuration`
- `IOptions<PathOperationExport> option_export`
- `IOptions<PathOperationImport> option_import`
- `IOptions<PathExternal> external_lib`
- `IOptions<SyncOptions> sync_options`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 134 | 30 | — | `IActionResult` | (omonima) | — | — |
| **Training** | 165 | 50 | — | `IActionResult` | Training | — | — |
| **GetTracciatiPromoByIdTracc** | 239 | 22 | `[HttpGet]`<br>`[Route("Tracciati/GetTracciatiPromoByIdTracc/{idTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **reportAttivita** | 266 | 10 | `[HttpGet]`<br>`[Route("Tracciati/reportAttivita/{idAttivita:int}")]` | `Task<IActionResult>` | — | — | — |
| **codiciDoppiAttivita** | 283 | 4 | `[HttpGet]`<br>`[Route("Tracciati/codiciDoppiAttivita/{idAttivita:long}")]` | `Task<IActionResult>` | — | — | — |
| **GetTracciatiPromo** | 290 | 19 | `[HttpGet]`<br>`[Route("Tracciati/GetTracciatiPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getPromoAperte** | 316 | 16 | `[HttpGet]`<br>`[Route("Tracciati/getPromoAperte")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAreeDellaPromo** | 336 | 19 | `[HttpGet]`<br>`[Route("Tracciati/getAreeDellaPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **creaPromo** | 358 | 38 | `[HttpPut]`<br>`[Route("Tracciati/creaPromo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getImportazioni** | 399 | 14 | `[HttpGet]`<br>`[Route("Tracciati/getImportazioni/{id_promo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getImportazioniPending** | 416 | 30 | `[HttpGet]`<br>`[Route("Tracciati/getImportazioniPending/{id_promo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **CaricaAddestramento** | 453 | 101 | `[HttpPut]`<br>`[Route("Tracciati/CaricaAddestramento")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ProvaAddestramento** | 557 | 346 | `[HttpPut]`<br>`[Route("Tracciati/ProvaAddestramento")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getAddestramenti** | 907 | 15 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramenti")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAddestramentoById** | 925 | 17 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramentoById/{id}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAddestramentoByIdRecordLavorazione** | 944 | 21 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramentoByIdRecordLavorazione/{idRecLavorazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSchema** | 968 | 62 | `[HttpPut]`<br>`[Route("Tracciati/salvaSchema")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSchemaCampo** | 1033 | 59 | `[HttpPut]`<br>`[Route("Tracciati/salvaSchemaCampo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **eliminaSchemaCampo** | 1095 | 42 | `[HttpGet]`<br>`[Route("Tracciati/eliminaSchemaCampo/{idCampo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getLibItemInfo** | 1140 | 42 | `[HttpGet]`<br>`[Route("Tracciati/getLibItemInfo/{id}")]` | `Task<IActionResult>` | — | — | — |
| **controllaIntegritaGruppo** | 1189 | 38 | `[HttpGet]`<br>`[Route("Tracciati/controllaIntegritaGruppo/{idTracciato}/{codGruppo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **controlloIntegrità** | 1228 | 28 | — | `string` | — | — | — |
| **importaManualmente** | 1260 | 297 | `[HttpPut]`<br>`[Route("Tracciati/importaManualmente/{idAddestramento}/{label}/{idTracciato}/{codGruppo}")]` | `Task<IActionResult>` | — | 1 a runtime | ctx, ctx2 |
| **getTracciatoById** | 1561 | 5 | `[HttpGet]`<br>`[Route("Tracciati/getTracciatoById/{idTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **esporta** | 1588 | 50 | `[HttpPut]`<br>`[Route("Tracciati/esporta")]` | `Task<IActionResult>` | — | — | ctx2 |
| **downloadForDump** | 1645 | 67 | `[HttpGet]`<br>`[Route("Tracciati/downloadForDump/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **integrazioneMirataInTracciato** | 1720 | 249 | `[HttpPut]`<br>`[Route("Tracciati/integrazioneMirataInTracciato")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **FicoContexts** | 1973 | 4 | — | `IActionResult` | FicoContexts | — | — |
| **salvaSourceJsonCode** | 1980 | 32 | `[HttpPut]`<br>`[Route("Tracciati/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |

