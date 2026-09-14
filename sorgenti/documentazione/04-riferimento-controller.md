# Riferimento dei controller e delle rotte

> **Questo documento e generato**, non scritto a mano. Lo produce
> `strumenti/genera-riferimento.sh` leggendo `Istanta/Controllers/`.
> Non modificarlo: rilancia lo script.
>
> Generato il 14/09/2026 alle 19:21.

## Indice

| controller | righe | azioni | contesti db | AgenziaLib | servizi esterni |
|---|---:|---:|---|---|---|
| [MenaboController](#menabocontroller) | 12919 | 64 | ctx, ctx2 | 5 | — |
| [FicoProcessController](#ficoprocesscontroller) | 5837 | 53 | ctx, ctx2 | 2 | correggoServerUrl, fpUrl, olUrl |
| [RevisoreController](#revisorecontroller) | 4188 | 19 | ctx, ctx2 | 13 | olympusServerUrl |
| [SyncFotoController](#syncfotocontroller) | 3242 | 29 | ctx, ctx2 | — | olympusServerUrl |
| [TracciatiController](#tracciaticontroller) | 2125 | 32 | ctx, ctx2 | 1 | — |
| [OperationsController](#operationscontroller) | 1855 | 3 | ctx | — | — |
| [ConfrontiController](#confronticontroller) | 1631 | 7 | ctx, ctx2 | 1 | — |
| [ChangePasswordAction](#changepasswordaction) | 1356 | 24 | ctx | — | olympusServerUrl |
| [AreeController](#areecontroller) | 1069 | 16 | ctx | — | — |
| [ArchivioController](#archiviocontroller) | 876 | 9 | ctx | — | olympusServerUrl |
| [MenaboSettingsController](#menabosettingscontroller) | 667 | 20 | ctx2 | — | — |
| [DeclinazioniMeccanicheController](#declinazionimeccanichecontroller) | 522 | 15 | — | — | — |
| [FrameworkCssController](#frameworkcsscontroller) | 411 | 15 | ctx | — | — |
| [ApiController](#apicontroller) | 328 | 7 | ctx, ctx2 | — | — |
| [RegisterController](#registercontroller) | 325 | 5 | ctx, ctx2 | — | — |
| [IstantaController](#istantacontroller) | 322 | 7 | — | 1 | — |
| [DiagnosticaController](#diagnosticacontroller) | 197 | 3 | — | — | — |
| [SchedaArticoloController](#schedaarticolocontroller) | 195 | 6 | ctx | — | olympusServerUrl |
| [EtichetteController](#etichettecontroller) | 193 | 8 | — | — | — |
| [MastroController](#mastrocontroller) | 181 | 4 | ctx | — | — |
| [MeccanicheController](#meccanichecontroller) | 114 | 4 | — | — | — |
| [NoExternalValidator](#noexternalvalidator) | 95 | 5 | — | — | — |
| [CustomPlugin](#customplugin) | 81 | 3 | — | — | — |
| [HomeController](#homecontroller) | 78 | 3 | — | — | — |
| [TaskManagerController](#taskmanagercontroller) | 31 | 1 | — | — | — |

**Totale: 25 controller, 362 azioni pubbliche, 38838 righe.**

Legenda delle colonne:

- **contesti db**: `ctx` e il contesto anagrafico (`edro21_dbContext`), `ctx2` quello delle promozioni (`Edro21_DbContext2`)
- **AgenziaLib**: quante chiamate per riflessione partono da questo controller
- **servizi esterni**: quali indirizzi configurati usa

---

## ApiController

`Istanta/Controllers/ApiController.cs` — 328 righe, 7 azioni pubbliche.
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
| **confermaAttivitaByUtente** | 71 | 34 | `[HttpGet]`<br>`[Route("attivita/confermaAttivitaByUtente/{id}/{persistenza}/{report}")]` | `Task<IActionResult>` | — | — | ctx |
| **ConfermaAttivitaDellaPromoByUtente** | 108 | 54 | `[HttpGet]`<br>`[Route("attivita/confermaAttivitaDellaPromoByUtente/{id}/{persistenza}/{report}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **scartaAttivitaByUtente** | 165 | 38 | `[HttpGet]`<br>`[Route("attivita/scartaAttivitaByUtente/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **getStatoAttivitaByID** | 206 | 23 | `[HttpGet]`<br>`[Route("attivita/getStato/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **getAttivitaByTimeRange** | 232 | 70 | `[HttpGet]`<br>`[Route("attivita/getAttivitaByTimeRange/{minutiDaSottrarre}/{includeAllPending}/{includeAllOngoing}")]` | `Task<IActionResult>` | — | — | ctx |
| **getLogErrorAttivita** | 317 | 5 | `[HttpGet]`<br>`[Route("attivita/getLogErrorAttivita/{id_attivita}")]` | `Task<IActionResult>` | — | — | ctx |


## ArchivioController

`Istanta/Controllers/ArchivioController.cs` — 876 righe, 9 azioni pubbliche.
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
| **Index** | 148 | 8 | — | `Task<IActionResult>` | — | — | — |
| **Index** | 158 | 7 | `[HttpPost]` | `Task<IActionResult>` | — | — | — |
| **Index** | 385 | 28 | `[HttpPut]`<br>`[Route("Archivio/Update")]` | `Task<IActionResult>` | — | — | ctx |
| **salvaArticoloByCodice** | 416 | 109 | `[HttpPut]`<br>`[Route("Archivio/salvaArticoloByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **GetDescrizioneByCodice** | 528 | 15 | `[HttpPut]`<br>`[Route("Archivio/GetDescrizioneByCodice")]` | `Task<IActionResult>` | — | — | ctx |
| **GetDescrizioneByAreaCanale** | 546 | 15 | `[HttpPut]`<br>`[Route("Archivio/GetDescrizioneByAreaCanale")]` | `Task<IActionResult>` | — | — | ctx |
| **downloadFotoByIdArticolo** | 564 | 80 | `[HttpGet]`<br>`[Route("Archivio/downloadFoto/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **caricaFotoManuale** | 657 | 87 | `[HttpPost]`<br>`[Route("Archivio/caricaFotoManuale")]` | `Task<IActionResult>` | — | — | ctx |
| **caricaDump** | 776 | 98 | `[HttpPost]`<br>`[Route("Archivio/caricaDump")]` | `Task<IActionResult>` | — | — | ctx |


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


## ChangePasswordAction

`Istanta/Controllers/LoginController.cs` — 1356 righe, 24 azioni pubbliche.

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 97 | 28 | — | `IActionResult` | (omonima) | — | — |
| **Index** | 129 | 245 | `[HttpPost]`<br>`[Route("LoginController/login")]` | `IActionResult` | — | — | ctx |
| **Start** | 378 | 15 | `[HttpGet]`<br>`[Route("LoginController/auth/entra")]` | `IActionResult` | — | — | — |
| **Complete** | 395 | 100 | `[HttpGet("/LoginController/oauth/complete")]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **OAuthLanded** | 497 | 131 | `[HttpGet("/LoginController/oauth/landed")]` | `Task<IActionResult>` | — | — | ctx |
| **ChangePassword** | 632 | 51 | `[HttpPost]`<br>`[Route("LoginController/ChangePassword")]` | `Task<IActionResult>` | — | — | ctx |
| **ResetPassword** | 687 | 56 | `[HttpPost]`<br>`[Route("LoginController/ResetPassword")]` | `Task<IActionResult>` | — | — | ctx |
| **InviaEmailPerRecuperaPassword** | 747 | 53 | `[HttpPost]`<br>`[Route("LoginController/InviaEmailPerRecuperaPassword")]` | `Task<IActionResult>` | — | — | ctx |
| **RecuperoPassword** | 804 | 47 | `[HttpGet]`<br>`[Route("LoginController/recuperoPassword/{codifica}")]` | `IActionResult` | (omonima) | — | ctx |
| **getTokenDiAccesso** | 854 | 70 | `[HttpGet]`<br>`[Route("LoginController/getTokenDiAccesso")]` | `Task<IActionResult>` | — | — | ctx |
| **getSession** | 937 | 40 | `[HttpGet]`<br>`[Route("LoginController/getSession")]` | `Task<IActionResult>` | — | — | ctx |
| **setSession** | 980 | 5 | — | `Task<IActionResult>` | — | — | — |
| **setSessionName** | 986 | 5 | — | `Task<IActionResult>` | — | — | — |
| **setRecoverySession** | 992 | 5 | — | `Task<IActionResult>` | — | — | — |
| **logoutFromPage** | 1000 | 5 | `[HttpGet]`<br>`[Route("LoginController/logoutFromPage")]` | `Task<IActionResult>` | — | — | — |
| **logout** | 1008 | 10 | `[HttpGet]`<br>`[Route("LoginController/logout")]` | `Task<IActionResult>` | — | — | — |
| **register** | 1021 | 64 | `[HttpPost]`<br>`[Route("LoginController/register")]` | `Task<IActionResult>` | — | — | ctx |
| **IsConsecutive** | 1087 | 17 | — | `bool` | — | — | — |
| **ping** | 1107 | 4 | `[HttpGet]`<br>`[Route("LoginController/ping")]` | `Task<IActionResult>` | — | — | — |
| **Upgrade** | 1116 | 49 | `[HttpPost]`<br>`[Route("LoginController/Upgrade")]` | `Task<IActionResult>` | — | — | — |
| **UpgradeCheck** | 1168 | 50 | `[HttpGet]`<br>`[Route("LoginController/UpgradeCheck/{sessionId}")]` | `Task<IActionResult>` | — | — | — |
| **getVersion** | 1221 | 8 | `[HttpGet]`<br>`[Route("LoginController/getVersion")]` | `Task<IActionResult>` | — | — | — |
| **getAgenziaLibVersion** | 1254 | 5 | `[HttpGet]`<br>`[Route("LoginController/getAgenziaLibVersion")]` | `Task<IActionResult>` | — | — | — |
| **getDownloadLinkOfPlugin** | 1293 | 58 | `[HttpGet]`<br>`[Route("LoginController/getDownloadLinkOfPlugin")]` | `Task<IActionResult>` | — | — | — |


## ConfrontiController

`Istanta/Controllers/ConfrontiController.cs` — 1631 righe, 7 azioni pubbliche.
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
| **Index** | 64 | 4 | — | `IActionResult` | (omonima) | — | — |
| **CheckCombinazioni** | 71 | 54 | `[HttpGet]`<br>`[Route("Confronti/CheckCombinazioni/{idPromo1}/{idPromo2}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ConfrontaListe2** | 128 | 986 | `[HttpPut]`<br>`[Route("Confronti/ConfrontaListe2")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **leggiDatoExcel** | 1115 | 286 | — | `ImportResult` | — | `importaTracciato` | ctx, ctx2 |
| **esportaComeListaDiImportazione** | 1404 | 194 | `[HttpPut]`<br>`[Route("Confronti/esportaComeListaDiImportazione")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **Settings** | 1600 | 4 | — | `IActionResult` | Settings | — | — |
| **salvaSourceJsonCode** | 1607 | 19 | `[HttpPut]`<br>`[Route("Confronti/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |


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

`Istanta/Controllers/FicoProcessController.cs` — 5837 righe, 53 azioni pubbliche.
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
| **Index** | 124 | 4 | — | `IActionResult` | (omonima) | — | — |
| **getTracciatiFromIdkitLavorazione** | 129 | 33 | — | `List<int>` | — | — | ctx2 |
| **getFormContext** | 192 | 51 | `[HttpGet]`<br>`[Route("FicoProcess/getFormContext/{type}")]` | `Task<IActionResult>` | — | — | — |
| **getSchemasContext** | 246 | 55 | `[HttpGet]`<br>`[Route("FicoProcess/getSchemasContext")]` | `Task<IActionResult>` | — | — | — |
| **getSourceFields_deprecata** | 304 | 93 | `[HttpGet]`<br>`[Route("FicoProcess/getSourceFields/{guidId}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getSourceFields** | 399 | 93 | `[HttpGet]`<br>`[Route("FicoProcess/getSourceFields/{guidId}/{scope}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getCombinazioniLavorazioneByPromo** | 499 | 67 | `[HttpGet]`<br>`[Route("FicoProcess/getCombinazioniLavorazioneByPromo/{guidId}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getLabels** | 569 | 47 | `[HttpGet]`<br>`[Route("FicoProcess/getLabels")]` | `Task<IActionResult>` | — | — | — |
| **getAddestramenti** | 619 | 127 | `[HttpGet]`<br>`[Route("FicoProcess/getAddestramenti/{all}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getFormati** | 749 | 32 | `[HttpGet]`<br>`[Route("FicoProcess/getFormati")]` | `Task<IActionResult>` | — | — | — |
| **salvaFormato** | 784 | 32 | `[HttpPut]`<br>`[Route("FicoProcess/salvaFormato")]` | `Task<IActionResult>` | — | — | — |
| **eliminaFormato** | 819 | 30 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaFormato/{idFormato}")]` | `Task<IActionResult>` | — | — | — |
| **inizioNuovaLavorazione** | 898 | 53 | `[HttpPut]`<br>`[Route("FicoProcess/inizioNuovaLavorazione")]` | `Task<IActionResult>` | — | — | ctx2 |
| **aggiornaPromo** | 954 | 76 | `[HttpPut]`<br>`[Route("FicoProcess/aggiornaPromo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **eliminaPromo** | 1033 | 64 | `[HttpDelete]`<br>`[Route("FicoProcess/eliminaPromo/{guidPromo}/{eliminazioneTotale}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **restorePromo** | 1100 | 51 | `[HttpGet]`<br>`[Route("FicoProcess/restore/{guidPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **Upload** | 1154 | 166 | `[HttpPost]`<br>`[Route("FicoProcess/uploadTracciato")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getStatoImportazione** | 1323 | 63 | `[HttpGet]`<br>`[Route("FicoProcess/getStatoImportazione/{guidID}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getTipiDiExport** | 1394 | 30 | `[HttpGet]`<br>`[Route("FicoProcess/getTipiDiExport")]` | `Task<IActionResult>` | — | — | — |
| **salvaTipoDiExport** | 1427 | 33 | `[HttpPut]`<br>`[Route("FicoProcess/salvaTipoDiExport")]` | `Task<IActionResult>` | — | — | — |
| **eliminaTipoDiExport** | 1463 | 31 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaTipoDiExport/{guidId}")]` | `Task<IActionResult>` | — | — | — |
| **getAllNamingConventionComponents** | 1543 | 27 | `[HttpGet]`<br>`[Route("FicoProcess/getAllNamingConventionComponents")]` | `Task<IActionResult>` | — | — | — |
| **salvaNamingConvention** | 1573 | 36 | `[HttpPut]`<br>`[Route("FicoProcess/salvaNamingConvention")]` | `Task<IActionResult>` | — | — | — |
| **eliminaNamingConvention** | 1612 | 33 | `[HttpPut]`<br>`[Route("FicoProcess/eliminaNamingConvention/{guidId}")]` | `Task<IActionResult>` | — | — | — |
| **getSchemaAddestramentoById** | 1693 | 48 | `[HttpGet]`<br>`[Route("FicoProcess/getSchemaAddestramentoById/{id}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAllDeclinazioniKit** | 1745 | 28 | `[HttpGet]`<br>`[Route("FicoProcess/getAllDeclinazioniKit")]` | `Task<IActionResult>` | — | — | — |
| **getCombinazioniByPromo** | 1777 | 140 | `[HttpGet]`<br>`[Route("FicoProcess/getCombinazioniByPromo/{guidPromo}/{guidFormato}/{guidCanale}/{guidArea}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **iniziaLavorazione** | 1921 | 126 | `[HttpGet]`<br>`[Route("FicoProcess/iniziaLavorazione/{guidPromo}/{guidId}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **processaKit** | 2051 | 230 | `[HttpGet]`<br>`[Route("FicoProcess/processaKit/{id}/{mode}/{noCache}")]//{guidId}/{guidRaccoglitore}/{guidPromo}/{guidArea}/{guidCanale}/{guidFormato}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getTracciatiDelKit** | 2282 | 67 | — | `List<PromoTracciati>` | — | — | ctx2 |
| **svuotaMaterialeKitFP** | 2352 | 77 | `[HttpGet]`<br>`[Route("FicoProcess/svuotaMaterialeKitFP/{idKit}/{guidIdTipoExport}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **esportaMateriale** | 2468 | 202 | `[HttpPost]`<br>`[Route("FicoProcess/esportaMateriale")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **impacchettaInfoRecord** | 3403 | 212 | — | `ArticoloInRevisione` | — | — | ctx |
| **getDescrizione** | 3616 | 258 | — | `ArticoloInRevisione` | — | — | — |
| **getFoto** | 3875 | 158 | — | `ArticoloInRevisione` | — | — | — |
| **etichettaRecords** | 4035 | 57 | — | `List<ArticoloInRevisione>` | — | — | — |
| **esportaConLogicheDiAgenzia** | 4094 | 26 | — | `TracciatoResultKit` | — | `{agenziaFunc}` | — |
| **updateDatiFromMetaPromoLavorazioni** | 4121 | 199 | — | `List<ArticoloInKit>` | — | — | ctx |
| **downloadKitRuntimeFromFP** | 4323 | 75 | `[HttpPut]`<br>`[Route("FicoProcess/downloadKitRuntimeFromFP")]` | `Task<IActionResult>` | — | — | ctx2 |
| **componiInformazioniPerKitRuntimeFromFP** | 4399 | 264 | — | `downloadFromFPResult` | — | — | — |
| **checkFiltro** | 4664 | 239 | — | `bool` | — | — | — |
| **getLoghiBolli** | 5065 | 32 | `[HttpGet]`<br>`[Route("FicoProcess/getLoghiBolli")]` | `Task<IActionResult>` | — | — | — |
| **getAuthUrlSchedaPromoLavorazioneToFP** | 5102 | 56 | `[HttpPut]`<br>`[Route("FicoProcess/getAuthUrlSchedaPromoLavorazioneToFP")]` | `Task<IActionResult>` | — | — | ctx |
| **getAuthUrlAD** | 5161 | 81 | `[HttpGet]`<br>`[Route("FicoProcess/getAuthUrlAD/{dest}")]` | `Task<IActionResult>` | — | — | ctx |
| **Auth** | 5245 | 5 | `[HttpGet]`<br>`[Route("FicoProcess/Auth/{authUrl}")]` | `Task<IActionResult>` | — | — | — |
| **AuthLanded** | 5253 | 9 | `[HttpGet]`<br>`[Route("FicoProcess/AuthLanded")]` | `Task<IActionResult>` | — | — | — |
| **AuthADLanded** | 5265 | 44 | `[HttpGet]`<br>`[Route("FicoProcess/AuthADLanded")]` | `Task<IActionResult>` | — | — | ctx |
| **getSchedaRef** | 5320 | 54 | `[HttpPut]`<br>`[Route("FicoProcess/getSchedaRef")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAllFotoDByCodice** | 5377 | 46 | `[HttpGet]`<br>`[Route("FicoProcess/getAllFotoByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **correggiFotoESelezioniFromCorreggo** | 5427 | 154 | `[HttpPut]`<br>`[Route("FicoProcess/correggiFotoESelezioniFromCorreggo")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getAllFotoExtra** | 5584 | 55 | `[HttpGet]`<br>`[Route("FicoProcess/getAllFotoExtra/{filter}")]` | `Task<IActionResult>` | — | — | — |
| **analisiMomento** | 5644 | 153 | `[HttpPost("FicoProcess/analisiMomento")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **analisiConfronto** | 5799 | 33 | `[HttpPost("FicoProcess/analisiConfronto")]` | `Task<IActionResult>` | — | `confrontaListe` | — |


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

`Istanta/Controllers/IstantaController.cs` — 322 righe, 7 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `string connString`
- `string path_external_lib=""`
- `string path_external_source=""`
- `IDbContextFactory<edro21_dbContext> dbContextFactory=null`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **getJsonObject** | 22 | 16 | — | `Dictionary<string, object>` | — | — | — |
| **getValueOfJsonObject** | 39 | 12 | — | `object` | — | — | — |
| **FindIn** | 51 | 45 | — | `bool` | — | — | — |
| **addLog** | 117 | 9 | — | `AttivitaLog` | — | — | — |
| **parseAddesttramentoValue** | 127 | 116 | — | `object` | — | — | — |
| **getParameterInfo** | 244 | 21 | — | `ParameterInfo[]` | — | — | — |
| **execLibFunction** | 267 | 52 | — | `object` | — | 1 a runtime | — |


## MastroController

`Istanta/Controllers/MastroController.cs` — 181 righe, 4 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<MastroController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 28 | 5 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 37 | 36 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 77 | 16 | `[HttpPost]`<br>`[Route("Mastro/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Index** | 97 | 41 | `[HttpGet]`<br>`[Route("Mastro/Delete/{id}")]` | `Task<IActionResult>` | — | — | ctx |


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

`Istanta/Controllers/MenaboController.cs` — 12919 righe, 64 azioni pubbliche.
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
| **Index** | 106 | 51 | — | `Task<IActionResult>` | (omonima) | — | ctx2 |
| **getFormato** | 162 | 5 | `[HttpGet]`<br>`[Route("Menabo/getFormato/{meccanica}")]` | `Task<IActionResult>` | — | — | — |
| **getMastro** | 168 | 6 | — | `DbMastro` | — | — | — |
| **getMeccaniche** | 175 | 6 | — | `DbMeccaniche` | — | — | — |
| **Index** | 185 | 137 | `[HttpGet]`<br>`[Route("Menabo/salvaPagina/{id_tracciato}/{id}/{id_mastro}/{formato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getListaTracciatoNew** | 325 | 55 | `[HttpGet]`<br>`[Route("Menabo/getListaTracciatoNew2/{idLavorazione}/{noCache}")]` | `Task<IActionResult>` | — | — | — |
| **Etichettatura** | 381 | 339 | — | `List<ArticoloInRevisione>` | — | — | — |
| **Etichettatura** | 721 | 325 | — | `ArticoloInRevisione` | — | — | — |
| **GetMastroAssociate** | 1047 | 58 | — | `List<ArticoloInRevisione>` | — | — | — |
| **GetMastroAssociate** | 1105 | 46 | — | `ArticoloInRevisione` | — | — | — |
| **getDbRegoleMastro** | 1154 | 13 | `[HttpGet]`<br>`[Route("Menabo/getDbRegoleMastro")]` | `Task<IActionResult>` | — | — | — |
| **AllInMenabo** | 1616 | 302 | `[HttpPost]`<br>`[Route("Menabo/AllInMenabo")]` | `Task<IActionResult>` | — | 1 a runtime | ctx2 |
| **inMenabo** | 1934 | 675 | `[HttpPut]`<br>`[Route("Menabo/inMenabo/{onoff}/{indice}/{idTracciato}/{areaTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **IdentificaArticoloInRevisione** | 2611 | 70 | — | `ArticoloInRevisione` | — | — | ctx, ctx2 |
| **IdentificaMeccanicaRecord** | 2683 | 581 | — | `RecordPostControlloMeccaniche` | — | — | ctx, ctx2 |
| **IdentificaMeccanicaRecord** | 3265 | 301 | — | `RecordPostControlloMeccaniche` | — | — | ctx, ctx2 |
| **IdentificaMeccanicaRecord** | 3567 | 563 | — | `RecordPostControlloMeccaniche` | — | — | — |
| **IdentificaCodiceBox** | 4131 | 527 | — | `string` | — | — | — |
| **CalcolaSpazi** | 5166 | 25 | — | `List<int>` | — | — | — |
| **esporta** | 5235 | 50 | `[HttpPut]`<br>`[Route("Menabo/esporta")]` | `Task<IActionResult>` | — | — | ctx2 |
| **downloadPacchettoFoto** | 5288 | 82 | `[HttpGet]`<br>`[Route("Menabo/donwloadPacchettoFoto/{id_tracciato}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **esportaPoP** | 5379 | 50 | `[HttpPut]`<br>`[Route("Menabo/esportaPoP")]` | `Task<IActionResult>` | — | — | ctx2 |
| **SvuotaPagina** | 5448 | 22 | `[HttpGet]`<br>`[Route("Menabo/SvuotaPagina/{idKit}/{pagSelected}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **svuotaMenabo** | 5473 | 21 | `[HttpGet]`<br>`[Route("Menabo/svuotaMenabo/{idKit}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **cambiaFormato** | 5498 | 33 | `[HttpGet]`<br>`[Route("Menabo/cambiaFormato/{idPagina}/{idorCodice}/{meccanica}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **cambiaFormato** | 5534 | 33 | `[HttpPut]`<br>`[Route("Menabo/cambiaFormatoNew/{idPagina}/{idorCodice}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **RimuoviMultiplex** | 5568 | 246 | — | `Task<IActionResult>` | — | — | ctx2 |
| **AggiungiMultiplex** | 5815 | 185 | — | `Task<string>` | — | — | ctx2 |
| **getEditDistance** | 6037 | 33 | — | `int` | — | — | — |
| **findSimilarity** | 6071 | 15 | — | `double` | — | — | — |
| **leggiCsv** | 6139 | 99 | `[HttpGet]`<br>`[Route("Menabo/leggiCsv/{id_tracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **AutoImpaginazione** | 6242 | 139 | `[HttpGet]`<br>`[Route("Menabo/AutoImpaginazione/{idTracciato}/{areaTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **CheckCorrispondenzaRegole** | 6433 | 33 | — | `List<listaSetRegole>` | — | — | — |
| **getElementLastVersion** | 6540 | 9 | — | `List<PromoTracciatiRecord>` | — | — | — |
| **getElementPreviousVersion** | 6550 | 8 | — | `List<PromoTracciatiRecord>` | — | — | — |
| **ScambiaRef** | 6561 | 165 | `[HttpPut]`<br>`[Route("Menabo/ScambiaRef/{idTracciato}/{pagId}/{newInx}/{idOrCodGruppo}/{areaTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getListaImpaginati** | 6746 | 15 | `[HttpGet]`<br>`[Route("Menabo/getListaImpaginati/{idLavorazione}")]` | `List<elementoImpaginato>` | — | — | ctx2 |
| **RestoreCacheConfronto** | 6765 | 64 | `[HttpPost]`<br>`[Route("Menabo/restoreCacheConfronto")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ImpaginaFromInDesignNew** | 6990 | 1621 | `[HttpPut]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}")]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}/{confronto}")]`<br>`[Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{noCache}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **CalcolaEspressione** | 8694 | 26 | — | `int` | — | — | — |
| **GetBoxDisponibile** | 8721 | 11 | — | `int` | — | — | — |
| **OttieniListaImpaginazione** | 8733 | 43 | — | `OkResultGruppi` | — | — | — |
| **consecutivePagesAutoImpaginazione** | 8784 | 40 | — | `int` | — | — | — |
| **findGriglia** | 8824 | 113 | — | `Griglia` | — | — | — |
| **findGrigliaNew** | 8938 | 84 | — | `Griglia` | — | — | — |
| **getFormatiValidiGriglie** | 9023 | 4 | — | `List<string>` | — | — | — |
| **LeggiTracciatoRecord** | 9031 | 187 | `[HttpPut]`<br>`[Route("Menabo/LeggiTracciatoRecord/{idTracciato}/{importa}/{isPop}/{getMastro}/{getOnlyMeta}/{leggiDaOgniTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getTracciatoByCodice** | 9219 | 42 | — | `int` | — | — | ctx2 |
| **getSchedeRefs** | 9265 | 88 | `[HttpPut]`<br>`[Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}")]`<br>`[Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]` | `Task<IActionResult>` | — | — | — |
| **getSchedaRef** | 9358 | 658 | `[HttpPut]`<br>`[Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}")]`<br>`[Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **impaginaSingolo** | 10019 | 130 | `[HttpPut]`<br>`[Route("Menabo/impaginaSingolo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **PreAnalisiMismatch** | 10153 | 276 | `[HttpPut]`<br>`[Route("Menabo/PreAnalisiMismatch/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **syncImpaginatoConServer** | 10432 | 256 | `[HttpPut]`<br>`[Route("Menabo/syncImpaginatoConServer/{id_lavorazione}/{impaginaETogliDaImpaginato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **inserisciBoxInPromoLavorazioniRecord** | 10691 | 48 | `[HttpPut]`<br>`[Route("Menabo/inserisciBoxInPromoLavorazioniRecord/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | — |
| **ricollegaBox** | 10742 | 364 | `[HttpPut]`<br>`[Route("Menabo/ricollegaBox")]` | `Task<IActionResult>` | — | — | ctx2 |
| **modificaPrimarieSecondarie** | 11159 | 115 | `[HttpPut]`<br>`[Route("Menabo/modificaPrimarieSecondarie/{idOperazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **Sgruppa** | 11319 | 306 | `[HttpPut]`<br>`[Route("Menabo/Sgruppa/{idKitLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | `elaboraTracciatiRecords` | ctx2 |
| **Raggruppa** | 11629 | 321 | `[HttpPut]`<br>`[Route("Menabo/Raggruppa/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | `elaboraTracciatiRecords` | ctx2 |
| **setArtwork** | 12045 | 85 | `[HttpPut]`<br>`[Route("Menabo/setArtwork/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **setCambioStrutturale** | 12133 | 98 | `[HttpPut]`<br>`[Route("Menabo/setCambioStrutturale/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | — |
| **cambioMetaRecordInLavorazione** | 12235 | 259 | `[HttpPut]`<br>`[Route("Menabo/cambiaMetaRecordInLavorazione/{idLavorazione}/{idOperazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **rimuoviRefImpaginata** | 12498 | 138 | `[HttpPut]`<br>`[Route("Menabo/rimuoviRefImpaginata/{idLavorazione}/{eliminaDaTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ClonaRecordRicollegato** | 12639 | 265 | `[HttpPut]`<br>`[Route("Menabo/ClonaRecordRicollegato/{idKitLavorazione}")]` | `Task<IActionResult>` | — | `elaboraRecordDaClonare` | ctx2 |
| **getCambioStrutturale** | 12908 | 8 | `[HttpGet]`<br>`[Route("Menabo/getCambioStrutturale")]` | `Task<IActionResult>` | — | `GetCambioStrutturalePath` | — |


## MenaboSettingsController

`Istanta/Controllers/MenaboSettingsController.cs` — 667 righe, 20 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (4):

- `ILogger<MastroController> logger`
- `IConfiguration configuration`
- `IOptions<PathExternal> external_lib`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 33 | 7 | — | `Task<IActionResult>` | (omonima) | — | — |
| **Index** | 43 | 14 | `[HttpPost]`<br>`[Route("MenaboSettings/Update/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Index** | 60 | 11 | `[HttpGet]`<br>`[Route("MenaboSettings/Delete/{id}")]` | `Task<IActionResult>` | — | — | — |
| **Insert** | 74 | 11 | `[HttpPost]`<br>`[Route("MenaboSettings/Insert")]` | `Task<IActionResult>` | — | — | — |
| **salvaPaginaSchema** | 88 | 32 | `[HttpPut]`<br>`[Route("MenaboSettings/salvaPaginaSchema/{id_schema}")]` | `Task<IActionResult>` | — | — | — |
| **eliminaPaginaSchema** | 123 | 24 | `[HttpPut]`<br>`[Route("MenaboSettings/eliminaPaginaSchema/{id_schema}")]` | `Task<IActionResult>` | — | — | — |
| **Ordinamento** | 169 | 4 | — | `IActionResult` | Ordinamento | — | — |
| **salvaSchemaOrdinamento** | 177 | 28 | `[HttpPost]`<br>`[Route("MenaboSettings/salvaSchemaOrdinamento")]` | `Task<IActionResult>` | — | — | — |
| **addRuleToClassificatoreUniversale** | 208 | 20 | `[HttpPut]`<br>`[Route("MenaboSettings/addRuleToClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **editRuleOfClassificatoreUniversale** | 231 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/editRuleOfClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **deleteRuleOfClassificatoreUniversale** | 253 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/deleteRuleOfClassificatoreUniversale")]` | `Task<IActionResult>` | — | — | — |
| **addOrdinamento** | 275 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/addOrdinamento")]` | `Task<IActionResult>` | — | — | — |
| **editOrdinamentoUniversale** | 297 | 19 | `[HttpPut]`<br>`[Route("MenaboSettings/editOrdinamentoUniversale")]` | `Task<IActionResult>` | — | — | — |
| **editOrdinamentoUniversale** | 319 | 47 | `[HttpPut]`<br>`[Route("MenaboSettings/multiEditOrdinamentoUniversale")]` | `Task<IActionResult>` | — | — | — |
| **salvaFormatiPagine** | 370 | 18 | `[HttpGet]`<br>`[Route("MenaboSettings/salvaFormatiPagine/{formatiPagine}")]` | `Task<IActionResult>` | — | — | — |
| **creaOrdinamentoAutomatico** | 391 | 226 | `[HttpGet]`<br>`[Route("MenaboSettings/creaOrdinamentoAutomatico")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSourceJsonCodeForOrdinamentoLista** | 620 | 32 | `[HttpPut]`<br>`[Route("MenaboSettings/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |
| **Formati** | 653 | 4 | — | `IActionResult` | Formati | — | — |
| **TipiDiExport** | 657 | 4 | — | `IActionResult` | TipiDiExport | — | — |
| **NamingConventions** | 661 | 4 | — | `IActionResult` | NamingConventions | — | — |


## NoExternalValidator

`Istanta/Controllers/AuthController.cs` — 95 righe, 5 azioni pubbliche.
 Eredita da `IExternalUserValidator`.

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **ExternalValidationResult** | 13 | 7 | — | `record` | — | — | — |
| **ValidateAsync** | 17 | 6 | — | `Task<ExternalValidationResult>` | — | — | — |
| **ValidateAsync** | 30 | 13 | — | `Task<ExternalValidationResult>` | — | — | — |
| **GetGraphTokenAsync** | 47 | 47 | — | `Task<string>` | — | — | — |
| **IsUserEnabledInEntraAsync** | 64 | 29 | — | `Task<bool>` | — | — | — |


## OperationsController

`Istanta/Controllers/OperationsController.cs` — 1855 righe, 3 azioni pubbliche.
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


## RegisterController

`Istanta/Controllers/RegisterController.cs` — 325 righe, 5 azioni pubbliche.
 Eredita da `Controller`.

**Dipendenze iniettate** (3):

- `IConfiguration configuration`
- `IDbContextFactory<edro21_dbContext> dbContextFactory`
- `IDbContextFactory<Edro21_DbContext2> dbContextFactory2`

| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |
|---|---:|---:|---|---|---|---|---|
| **Index** | 29 | 61 | — | `IActionResult` | (omonima) | — | ctx |
| **autorizzaOperazioneDaSync** | 100 | 135 | `[HttpPut]`<br>`[Route("RegisterController/autorizzaOperazioneDaSync")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **readLogFilesDiSistema** | 238 | 22 | `[HttpGet]`<br>`[Route("RegisterController/getLogFiles")]` | `Task<IActionResult>` | — | — | — |
| **readLogsDiSistema** | 263 | 17 | `[HttpGet]`<br>`[Route("RegisterController/ricercaLogs/{file}/{nLines}")]` | `Task<IActionResult>` | — | — | — |
| **ricercaAudits** | 283 | 40 | `[HttpPost]`<br>`[Route("RegisterController/ricercaAudits")]` | `Task<IActionResult>` | — | — | ctx |


## RevisoreController

`Istanta/Controllers/RevisoreController.cs` — 4188 righe, 19 azioni pubbliche.
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
| **getConteggioListaRevisione** | 216 | 648 | `[HttpPost]`<br>`[Route("Revisore/getConteggio")]` | `Task<IActionResult>` | — | `FiltraRecordsPerConteggioRevisione`, `GetMetaPerRevisioneDaGruppiMultipliBatch`, 2 a runtime | ctx, ctx2 |
| **getListaRevisione2** | 1176 | 1138 | `[HttpPost]`<br>`[Route("Revisore/getListaRevisione2")]` | `Task<IActionResult>` | — | `GetMetaPerRevisioneDaGruppiMultipliBatch`, `specificaInOutVol`, 1 a runtime | ctx, ctx2 |
| **convertiDaArticoliDescrizioniARevisioneRegionale** | 2315 | 30 | — | `List<RevisioneRegionale>` | — | — | — |
| **getArticoliDescrizioniSottogruppi** | 2348 | 46 | `[HttpPut]`<br>`[Route("Revisore/getArticoliDescrizioniSottogruppi/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **salva** | 2397 | 609 | `[HttpPut]`<br>`[Route("Revisore/salva/{idTracciato}/{idOperazione}/{sender}")]` | `Task<IActionResult>` | — | `GetMetaPerRevisioneDaGruppiMultipli`, `MetaPerRevisione`, 4 a runtime | ctx, ctx2 |
| **componiExtraAutoFields** | 3062 | 48 | — | `string` | — | — | — |
| **elimina** | 3113 | 107 | `[HttpPut]`<br>`[Route("Revisore/elimina/{idTracciato}/{idOperazione}/{sender}")]` | `Task<IActionResult>` | — | — | ctx |
| **Sync** | 3222 | 6 | — | `IActionResult` | Sync | — | ctx2 |
| **searchTracciatoByTitle** | 3231 | 17 | `[HttpPut]`<br>`[Route("Revisore/searchTracciatoByTitle")]` | `Task<IActionResult>` | — | — | ctx2 |
| **searchTracciatoByPromo** | 3251 | 16 | `[HttpGet]`<br>`[Route("Revisore/searchTracciatoByPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **AggiungiSottogruppo** | 3271 | 169 | `[HttpGet]`<br>`[Route("Revisore/AggiungiASottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **RimuoviDaSottogruppo** | 3445 | 171 | `[HttpGet]`<br>`[Route("Revisore/RimuoviDaSottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ControllaRevisioniPromo** | 3620 | 89 | `[HttpGet]`<br>`[Route("Revisore/ControllaRevisioniPromo/{idpromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **salvaRefFromIndd** | 3712 | 253 | `[HttpPut]`<br>`[Route("Revisore/salvaRefFromIndd")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **checkLastModifica** | 4000 | 87 | `[HttpPost]` | `CheckLastModificaResult` | — | — | ctx |
| **salvaCampoInDatoTracciato** | 4091 | 94 | `[HttpPut]`<br>`[Route("Revisore/salvaCampoInDatoTracciato/{idTracciato}/{idPromo}")]` | `BoolResult` | — | — | ctx2 |


## SchedaArticoloController

`Istanta/Controllers/SchedaArticoloController.cs` — 195 righe, 6 azioni pubbliche.
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
| **Index** | 39 | 4 | — | `IActionResult` | (omonima) | — | — |
| **Index** | 46 | 33 | `[HttpGet]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **getAllFotoDByCodice** | 82 | 27 | `[HttpGet]`<br>`[Route("SchedaArticolo/getAllFotoByCodice/{codice}")]` | `Task<IActionResult>` | — | — | ctx |
| **Index** | 113 | 44 | `[HttpPost]` | `Task<IActionResult>` | (omonima) | — | ctx |
| **DeleteFoto** | 160 | 14 | `[HttpPost]`<br>`[Route("SchedaArticolo/DeleteFoto/{id}")]` | `Task<IActionResult>` | — | — | ctx |
| **AggiornaPrimario** | 178 | 15 | `[HttpPut]`<br>`[Route("SchedaArticolo/AggiornaPrimario")]` | `Task<IActionResult>` | — | — | ctx |


## SyncFotoController

`Istanta/Controllers/SyncFotoController.cs` — 3242 righe, 29 azioni pubbliche.
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
| **Index** | 91 | 6 | — | `IActionResult` | (omonima) | — | — |
| **LoghiBolli** | 98 | 5 | — | `IActionResult` | (omonima) | — | — |
| **Registro** | 104 | 4 | — | `IActionResult` | (omonima) | — | — |
| **UploadFileZip** | 132 | 34 | `[HttpPost]`<br>`[Route("SyncFoto/UploadFileZip")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFoto** | 172 | 12 | `[HttpPut]//[HttpPost]`<br>`[Route("SyncFoto/ScanPacchettoFoto")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFotoCheck** | 884 | 14 | `[HttpGet]`<br>`[Route("SyncFoto/ScanPacchettoFotoCheck/{guidid}")]` | `Task<IActionResult>` | — | — | — |
| **ScanPacchettoFotoByFotoUri** | 901 | 104 | `[HttpGet]//[HttpPost]`<br>`[Route("SyncFoto/ScanPacchettoFotoByFotoUri/{idPromo}/{idTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **downloadPacchettoFoto** | 1010 | 100 | `[HttpPut]`<br>`[Route("SyncFoto/downloadPacchettoFoto")]` | `Task<IActionResult>` | — | — | — |
| **SyncPacchettoFoto** | 1113 | 305 | `[HttpPut]`<br>`[Route("SyncFoto/SyncPacchettoFoto/{overwriteOption}")]` | `Task<IActionResult>` | — | — | ctx |
| **attivaDisattivaFotoExtra** | 1421 | 28 | `[HttpGet]`<br>`[Route("SyncFoto/attivaDisattivaFotoExtra/{guidId}/{attiva}")]` | `Task<IActionResult>` | — | — | ctx |
| **scanSyncFromDb** | 1453 | 39 | `[HttpGet]`<br>`[Route("SyncFoto/scanSyncFromDb")]` | `Task<IActionResult>` | — | — | ctx |
| **updateFotoFromIndd** | 1506 | 379 | `[Route("SyncFoto/updateFotoFromIndd/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **updateImmagineEsistente** | 1906 | 142 | `[Route("SyncFoto/updateImmagineEsistente/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **linkLogoBollo** | 2096 | 50 | `[HttpPut]`<br>`[Route("SyncFoto/linkLogoBollo")]` | `Task<IActionResult>` | — | — | ctx |
| **RimuoviFotoDaMeta** | 2150 | 60 | `[HttpGet]`<br>`[Route("SyncFoto/RimuoviFotoDaMeta/{codice}/{tipo}/{idLavorazione}/{idRec}/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **RimuoviFoto** | 2213 | 51 | `[HttpPut]`<br>`[Route("SyncFoto/RimuoviFoto/{id_operazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **escludiIncludiFotoExtraAuto** | 2267 | 62 | `[HttpPut]`<br>`[Route("SyncFoto/escludiIncludiFotoExtraAuto/{escludi}")]` | `Task<IActionResult>` | — | — | ctx |
| **caricamentoFotoMassivoOld** | 2332 | 56 | `[HttpGet]`<br>`[Route("SyncFoto/caricamentoFotoMassivoOld/{elementiPagine}/{pagina}")]` | `Task<IActionResult>` | — | — | ctx |
| **getPacchettoFotoAsContract** | 2391 | 133 | `[HttpGet]`<br>`[Route("SyncFoto/getPacchettoFotoTracciatoAsContract/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx |
| **getFotosAsContractNew** | 2529 | 94 | `[HttpPut]`<br>`[Route("SyncFoto/getFotosAsContractNew/{id_lavorazione}")]`<br>`[Route("SyncFoto/getFotosAsContract/{id_lavorazione}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getFoto** | 2624 | 62 | — | `ArticoliFoto` | — | — | — |
| **getPacchettoLoghiBolliAsContract** | 2692 | 53 | `[HttpGet]`<br>`[Route("SyncFoto/getPacchettoLoghiBolliAsContract")]` | `Task<IActionResult>` | — | — | — |
| **getInfoFoto** | 2748 | 40 | `[HttpGet]`<br>`[Route("SyncFoto/getInfoFoto/{guid}")]` | `Task<IActionResult>` | — | — | ctx |
| **getLoghiBolli** | 2793 | 11 | `[HttpGet]`<br>`[Route("LoghiBolli/get")]` | `Task<IActionResult>` | — | — | — |
| **getLogoBolloBySigla** | 2807 | 23 | `[HttpGet]`<br>`[Route("LoghiBolli/getBySigla/{codice}")]` | `Task<IActionResult>` | — | — | — |
| **getLogoBolloByGuidId** | 2831 | 23 | — | `LogoBolloOperationResult` | — | — | — |
| **salvaLogoBollo** | 2857 | 102 | `[HttpPost]`<br>`[Route("LoghiBolli/salva")]` | `Task<IActionResult>` | — | — | — |
| **eliminaLogoBollo** | 3039 | 31 | `[HttpGet]`<br>`[Route("LoghiBolli/elimina/{id}")]` | `Task<IActionResult>` | — | — | — |
| **ricercaNelRegistro** | 3078 | 55 | `[HttpPost]`<br>`[Route("SyncFoto/ricercaNelRegistro")]` | `Task<IActionResult>` | — | — | ctx |


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

`Istanta/Controllers/TracciatiController.cs` — 2125 righe, 32 azioni pubbliche.
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
| **GetTracciatiPromo** | 266 | 19 | `[HttpGet]`<br>`[Route("Tracciati/GetTracciatiPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getPromoAperte** | 292 | 16 | `[HttpGet]`<br>`[Route("Tracciati/getPromoAperte")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAreeDellaPromo** | 312 | 19 | `[HttpGet]`<br>`[Route("Tracciati/getAreeDellaPromo/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **creaPromo** | 334 | 38 | `[HttpPut]`<br>`[Route("Tracciati/creaPromo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getImportazioni** | 375 | 14 | `[HttpGet]`<br>`[Route("Tracciati/getImportazioni/{id_promo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getImportazioniPending** | 392 | 27 | `[HttpGet]`<br>`[Route("Tracciati/getImportazioniPending/{id_promo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **CaricaAddestramento** | 426 | 101 | `[HttpPut]`<br>`[Route("Tracciati/CaricaAddestramento")]` | `Task<IActionResult>` | — | — | ctx2 |
| **ProvaAddestramento** | 530 | 346 | `[HttpPut]`<br>`[Route("Tracciati/ProvaAddestramento")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **getAddestramenti** | 880 | 15 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramenti")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAddestramentoById** | 898 | 17 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramentoById/{id}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getAddestramentoByIdRecordLavorazione** | 917 | 21 | `[HttpGet]`<br>`[Route("Tracciati/getAddestramentoByIdRecordLavorazione/{idRecLavorazione}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSchema** | 941 | 62 | `[HttpPut]`<br>`[Route("Tracciati/salvaSchema")]` | `Task<IActionResult>` | — | — | ctx2 |
| **salvaSchemaCampo** | 1006 | 59 | `[HttpPut]`<br>`[Route("Tracciati/salvaSchemaCampo")]` | `Task<IActionResult>` | — | — | ctx2 |
| **eliminaSchemaCampo** | 1068 | 42 | `[HttpGet]`<br>`[Route("Tracciati/eliminaSchemaCampo/{idCampo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **getLibItemInfo** | 1113 | 42 | `[HttpGet]`<br>`[Route("Tracciati/getLibItemInfo/{id}")]` | `Task<IActionResult>` | — | — | — |
| **scriviRegolaMenabo** | 1158 | 83 | `[HttpPut]`<br>`[Route("Tracciati/scriviRegolaMenabo/{remove}")]` | `Task<IActionResult>` | — | — | — |
| **getRegoleMenabo** | 1244 | 13 | `[HttpGet]`<br>`[Route("Tracciati/getRegoleMenaboByIdAddestramento/{idAddestramento}")]` | `Task<IActionResult>` | — | — | — |
| **getAllRegoleMenabo** | 1260 | 13 | `[HttpGet]`<br>`[Route("Tracciati/getAllRegoleMenabo")]` | `Task<IActionResult>` | — | — | — |
| **getAllFormatiPaginaMenabo** | 1276 | 13 | `[HttpGet]`<br>`[Route("Tracciati/getAllFormatiPaginaMenabo")]` | `Task<IActionResult>` | — | — | — |
| **getAllMeccaniche** | 1293 | 13 | `[HttpGet]`<br>`[Route("Tracciati/getAllMeccaniche")]` | `Task<IActionResult>` | — | — | — |
| **controllaIntegritaGruppo** | 1313 | 38 | `[HttpGet]`<br>`[Route("Tracciati/controllaIntegritaGruppo/{idTracciato}/{codGruppo}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **controlloIntegrità** | 1352 | 28 | — | `string` | — | — | — |
| **importaManualmente** | 1384 | 284 | `[HttpPut]`<br>`[Route("Tracciati/importaManualmente/{idAddestramento}/{label}/{idTracciato}/{codGruppo}")]` | `Task<IActionResult>` | — | 1 a runtime | ctx, ctx2 |
| **getTracciatoById** | 1672 | 5 | `[HttpGet]`<br>`[Route("Tracciati/getTracciatoById/{idTracciato}")]` | `Task<IActionResult>` | — | — | ctx2 |
| **esporta** | 1699 | 50 | `[HttpPut]`<br>`[Route("Tracciati/esporta")]` | `Task<IActionResult>` | — | — | ctx2 |
| **downloadForDump** | 1756 | 67 | `[HttpGet]`<br>`[Route("Tracciati/downloadForDump/{idPromo}")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **integrazioneMirataInTracciato** | 1831 | 247 | `[HttpPut]`<br>`[Route("Tracciati/integrazioneMirataInTracciato")]` | `Task<IActionResult>` | — | — | ctx, ctx2 |
| **FicoContexts** | 2082 | 4 | — | `IActionResult` | FicoContexts | — | — |
| **salvaSourceJsonCode** | 2089 | 32 | `[HttpPut]`<br>`[Route("Tracciati/salvaSourceJsonCode")]` | `Task<IActionResult>` | — | — | — |

