# Architettura

## Cos'è Istanta

Istanta è il sistema con cui un'agenzia grafica e un'insegna della grande distribuzione costruiscono
insieme un **volantino promozionale**, dal listino di prodotti fino ai file pronti per la stampa.

Il percorso, in parole povere:

1. Il cliente manda un **listato** (un Excel) con i prodotti in promozione.
2. Istanta lo **importa** in un *tracciato*, interpretandone le colonne secondo un *addestramento*.
3. Gli operatori **revisionano** le referenze: descrizioni, prezzi, meccaniche, foto.
4. Si costruisce il **menabò**: quale referenza va in quale pagina, in quale box, con quale formato.
5. Si **esporta** verso InDesign, che impagina davvero.
6. Si **confronta** il risultato con il listato, si correggono gli scostamenti, si ricicla.

Attorno a questo ciclo ci sono le foto dei prodotti, i loghi e i bollini, le regole di ordinamento,
i formati dei box, le convenzioni di nomenclatura dei file, e una quantità considerevole di
**logica specifica del singolo cliente** — che è la ragione per cui esiste `AgenziaLib`.

---

## I pezzi

La soluzione vive in `/srv/istanta4/soluzione` sul server demo e nel repository
`https://github.com/rapidmind/Istanta4.git`, ramo `main`.

| cartella | cos'è | tecnologia | righe |
|---|---|---|---|
| `Istanta/` | **l'applicazione web principale** | ASP.NET Core MVC, net10.0 | 52.161 righe .cs + 8.775 .cshtml + 26.804 .js |
| `AgenziaLib/` | la logica specifica di ogni cliente | libreria .NET caricata **per riflessione** | 29.734 |
| `IstantaLib/` | tipi condivisi e utilità di basso livello | libreria .NET referenziata da Istanta | 2.168 |
| `correggo4/` | revisione e correzione dei volantini impaginati | ASP.NET Core MVC, net10.0 | 7.500 .cs + 3.952 .cshtml |
| `olimpo/` | **archivio foto e identità (SSO)** | NestJS + Fastify, front-end React/Vite | 9.607 .ts |
| `fidelity/` | piattaforma promozioni e kit di design | Express + React, workspace npm | 101.097 .ts |
| `plugin/` | il pannello dentro Adobe InDesign | JavaScript (CEP/ExtendScript) | 71.085 .js |
| `strumenti/` | l'analizzatore di chiamate scritto per la pulizia | .NET + Roslyn | 235 |
| `pubblicato/` | l'applicazione compilata **e il suo stato** | — | (non in git) |
| `sorgenti/` | registro delle rimozioni e questa documentazione | — | — |
| `docker/` | i compose dei servizi di appoggio | — | — |

> **Nota sui perimetri.** Di `Istanta`, `AgenziaLib` e `IstantaLib` conosco il codice nel dettaglio,
> perché è quello su cui abbiamo lavorato. Di `correggo4`, `olimpo`, `fidelity` e `plugin` descrivo
> **quello che si vede dall'esterno**: struttura, tecnologia, punti di ingresso, come Istanta li
> chiama. La logica interna di quei tre **non è verificata** in questa documentazione.

---

## Chi gira dove, e su quale porta

Sul server demo (Dell OptiPlex in LAN), tutto in `systemd`:

| servizio | porta | cosa esegue | utente |
|---|---|---|---|
| `istanta4-pgtest` | **5076** | `dotnet /srv/istanta4/soluzione/pubblicato/Istanta.dll` | `serverpop` |
| `istanta4-correggo4` | **5080** | `dotnet .../correggo4/pubblicato/Correggo4.dll` | `serverpop` |
| `istanta4-fidelity` | **3010** | `npx tsx server/index.ts` | `serverpop` |
| `istanta4-olimpo` | **3005** | `node dist/src/main.js` | `serverpop` |
| `istanta4-agente.timer` | — | ogni 30 s esegue gli script della coda Dropbox | `root` |

E in Docker:

| container | immagine | porta |
|---|---|---|
| `istanta4-postgres` | `postgis/postgis:16-3.4` | 5432 |
| `istanta4-redis` | `redis:7-alpine` | 6379 |
| `istanta4-mongo` | `mongo:7` | 27017 |
| `istanta4-adminer` | `adminer:latest` | 8081 |

**nginx sulla :80 non fa da proxy all'applicazione.** Serve soltanto un sito statico da
`/var/www/istanta4`. Istanta si raggiunge direttamente sulla `:5076`. Questo sorprende: se cerchi il
reverse proxy, non c'è.

> Redis serve alla sessione (`AddStackExchangeRedisCache` + `AddSession`, stringa di connessione
> `IstantaSession`). **Mongo gira ma chi lo usa non è verificato**: Istanta non lo nomina; è
> plausibile che appartenga a fidelity, che ha `mongoose` fra le dipendenze.

---

## Come i pezzi si parlano

Gli indirizzi stanno in `appsettings.json`, sezione `fico`:

```
fico/olympusServerUrl   http://192.168.1.240:3005/olimpo    <- Olimpo, per IP di LAN
fico/fpServerUrl        http://127.0.0.1:3010/api           <- fidelity
fico/correggoServerUrl  http://127.0.0.1:59999              <- l'agente locale (NON correggo4)
fico/agent              ws://127.0.0.1:59999/ws             <- lo stesso agente, via websocket
sync_options/ipUploadGate  http://127.0.0.1:59999
```

**Attenzione a `correggoServerUrl`**: punta alla **59999**, non alla 5080. La 59999 è l'agente che
gira sulla macchina del grafico e fa da ponte verso InDesign; `correggo4` sulla 5080 è un'altra
cosa. Il nome della chiave è fuorviante e va letto con questa avvertenza.

### Istanta → Olimpo

Due usi, entrambi essenziali:

- **Identità.** `LoginMiddleWare.Invoke` (`Istanta/MiddleWare/LoginMiddleWare.cs`, 203 righe) legge
  l'header `Authorization`, e se non c'è sessione chiama `GET {olUrl}/auth/checkIdentity` con il
  bearer. Se Olimpo risponde bene, Istanta crea o ritrova l'utente in `Utentis` e mette
  `context.Session["id"]`. **Senza Olimpo raggiungibile non si entra in Istanta.**
- **Foto.** Ogni miniatura del prodotto è un `GET {olimpoIp}/foto/getThumbNailOnDemand?width=N&guidId=…`.
  Il caricamento passa da `/foto/uploadFoto`, `/foto/uploadPacchettoFoto`, `/foto/getInfoMassivo`.
  L'indirizzo arriva alla vista come `ViewBag.ipOlympus` e al javascript come `#ipOlympus`.

> Storicamente le miniature le generava Istanta stessa, con `ThumbController` e `System.Drawing`.
> Su Linux non funziona (`System.Drawing.Common` è supportato solo su Windows da net7 in poi:
> `TypeInitializationException` su `Gdip`). Il 14/09 `ThumbController` è stato tolto e l'ultimo
> chiamante vivo è passato a Olimpo. I 42 warning `CA1416` sono scesi a zero.

### Istanta → fidelity

`FICOMiddleware.login` (`Istanta/MiddleWare/FICOMiddleware.cs`) costruisce un
`FICOPassportCredentials` e lo manda in `PUT` a fidelity. È il **passaporto**: il modo in cui un
utente autenticato in Istanta entra in fidelity senza autenticarsi di nuovo.
`AreeController` usa `fpUrl` per la configurazione dei punti vendita (ACPV).

### Istanta → l'agente su 59999 → InDesign

Il `plugin/` è un pannello dentro InDesign, 71.085 righe di JavaScript. Parla con un agente locale
sulla porta **59999**, in HTTP e in websocket. Da lì partono l'impaginazione automatica, il
ritorno delle alterazioni fatte a mano sul documento, e l'aggiornamento delle foto.

### Il websocket di Istanta

`app.MapSockets("/ws", …)` in `Program.cs` monta `WebSocketMessageHandler`. Il codice è in
`Istanta/SocketsManager/` (`ConnectionManager`, `SocketHandler`, `SocketMiddleware`,
`SocketExtension`): un dizionario concorrente di socket per id, e messaggi singoli o broadcast.
Lato browser `js/mySocket.js` (classe `Messages`) si collega e si riconnette da solo.

---

## La pipeline di avvio, in ordine

Da `Istanta/Program.cs`, 436 righe. Le righe indicate sono quelle del 14/09.

**Configurazione (`builder`)**

| riga | cosa |
|---|---|
| 89-90 | `AddDbContextFactory<edro21_dbContext>` e `AddDbContextFactory<Edro21_DbContext2>`, **entrambi su `IstandaConnectionDb`** |
| 91-115 | `AddControllersWithViews` (chiamata **tre volte**: 91, 103, 198) |
| 117 | `AddStackExchangeRedisCache` |
| 123 | `AddSession` |
| 144 | `AddHostedService<BackgroundCodeService>` |
| 151-173 | `Configure<T>` delle opzioni (vedi tabella sotto) |
| 183 | `AddWebSocketManager` |
| 186 | `FormOptions.MultipartBodyLengthLimit = 10 GB` |
| 200 | `options.Filters.Add<CustomViewBagFilter>()` |
| 209-236 | `AddAuthentication` + `AddCookie` + `AddOpenIdConnect` (Entra ID) |
| 239-252 | compressione Brotli e Gzip |

**Pipeline (`app`)**

| riga | cosa |
|---|---|
| 271 | `UseRequestLocalization` |
| 276 | `UseExceptionHandler("/Home/Error")` |
| 283 | `UseHttpsRedirection` |
| 289 | `UseRouting` |
| 291 | `UseStaticFiles` (con un handler che aggiunge `Content-Encoding: gzip`) |
| 308 | `UseAuthorization` |
| 309 | `UseAuthentication` |
| 311 | `MapControllerRoute` |
| 316 | `UseCors(AllowAnyOrigin)` |
| 319-320 | `UseWebSockets` e `MapSockets("/ws")` |
| 322 | `MapGet("/ping")` |
| 328 | `UseSession().UseMiddleware<LoginMiddleWare>()` |
| 340 | un `app.Use` finale che redirige in base all'host (`navcovesviluppo`) |
| 430-431 | `Console.SetOut(new LogAssistent())` — **è qui che i log vanno in Serilog** |

> ### Due cose nella pipeline che vanno guardate
>
> **`UseAuthorization()` sta prima di `UseAuthentication()`.** È l'ordine invertito rispetto a
> quello corretto: l'autorizzazione dovrebbe valutare un'identità che l'autenticazione ha già
> costruito. In pratica l'applicazione funziona perché l'autenticazione vera la fa `LoginMiddleWare`
> con la sessione, non il middleware di ASP.NET — ma se un giorno si usasse `[Authorize]` sul serio,
> non funzionerebbe. **Non ho invertito le due righe**: è un cambiamento che va provato, non fatto
> di notte.
>
> **`app.UseResponseCompression()` è commentato** (riga 287) benché la compressione sia configurata
> alle righe 239-252. Al suo posto c'è un handler su `UseStaticFiles` che mette a mano
> `Content-Encoding: gzip` sui file statici. Da qui i `.gz` e `.br` che si trovano accanto ai file
> in `pubblicato/wwwroot`.

**Le sezioni di configurazione e le classi che le ricevono**

| sezione di `appsettings.json` | classe | dove |
|---|---|---|
| `jpg_path_foto` | `PathFotoJpg` | `Models/IstantaCore.cs:218` |
| `path_to_export` | `PathOperationExport` | `:225` |
| `path_to_import` | `PathOperationImport` | `:232` |
| `external_paths` | `PathExternal` (`pathLib`, `pathSource`) | `:239` |
| `sync_options` | `SyncOptions` | `:245` |
| `fico` | `FicoConfig` | `:307` |
| `antlr_options` | `AntlrOptions` | `:266` |
| `auth_ad_options` | `AuthADOptions` | `:288` |

---

## I due contesti Entity Framework

Istanta ha **due** `DbContext`, registrati entrambi come *factory* e **sulla stessa stringa di
connessione**:

- **`edro21_dbContext`** (`Istanta/Models/`) — nel codice si chiama `ctx`. Anagrafiche e utenti:
  `Articolis`, `ArticoliDescrizionis`, `ArticoliFotos`, `Utentis`, `RegistroOperazioni`.
- **`Edro21_DbContext2`** (`Istanta/Models_2/`) — nel codice si chiama `ctx2`. Il mondo delle
  promozioni: `Promos`, `PromoTracciatis`, `PromoTracciatiRecords`, `PromoLavorazionis`,
  `MenaboPagines`, `MenaboRefs`.

**Il nome `edro21` è storico** e non significa che il contesto sia legato al cliente Edro21: è il
nome che è rimasto da quando il primo cliente era quello. Vale per tutti i clienti.

Sapere in quale contesto sta una tabella è la prima cosa da capire quando una query "non trova
niente": più di una volta una ricerca su `PromoTracciatiRecords` è fallita perché fatta su `ctx`
invece che su `ctx2`.

Il `OnModelCreating` del secondo contesto è lungo **557 righe**, il primo 527.

---

## Il servizio in background

`Istanta/BackgroundCodeService.cs` è un `IHostedService` registrato alla riga 144 di `Program.cs`.
Il suo `ExecuteAsync` è lungo 289 righe, apre il proprio contesto con
`_dbContextFactory.CreateDbContextAsync` e lavora in ciclo. **Cosa faccia esattamente non è
verificato**: è uno dei punti da guardare (vedi [13-da-fare.md](13-da-fare.md)).

Accanto a lui, `Istanta/Utility/Propagatore.cs::ElaboraRegistro` (299 righe) legge il registro delle
operazioni e propaga le modifiche fra lavorazioni, chiamando
`AgenziaLib.{cliente}.analizzaPropagazionePer…` per decidere cosa propagare.
