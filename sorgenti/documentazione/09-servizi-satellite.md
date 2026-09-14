# I servizi satellite

Istanta non è sola. Attorno a lei girano quattro cose, e tre sono indispensabili.

> **Perimetro di questa pagina.** Di questi quattro servizi descrivo **quello che si vede
> dall'esterno**: tecnologia, struttura, punti di ingresso, e — soprattutto — **come Istanta li
> chiama**. La loro logica interna **non è verificata**. Se devi lavorarci dentro, questa pagina ti
> dice da dove entrare, non cosa troverai.

---

## Olimpo — foto e identità

`soluzione/olimpo/`, **9.607 righe TypeScript**, NestJS su Fastify, front-end React/Vite in `ui/`.

- Servizio: `istanta4-olimpo`, `node dist/src/main.js`, porta **3005**.
- Istanta lo chiama a `http://192.168.1.240:3005/olimpo` — **per IP di LAN, non su localhost**.
- Si costruisce con `npm run build` (che fa prima `build:ui`, poi `nest build`).
- C'è un `deploy.sh` nella cartella.

**È il pezzo più critico dell'insieme**, perché fa due cose che senza di lui non si fanno:

### 1. L'identità (SSO)

`LoginMiddleWare` di Istanta chiama `GET {olUrl}/auth/checkIdentity` con un bearer. **Se Olimpo non
risponde, in Istanta non si entra.** Istanta non ha password proprie: ha una tabella `Utentis` che si
popola dalle risposte di Olimpo.

### 2. L'archivio foto

| endpoint | chi lo usa |
|---|---|
| `GET /foto/getThumbNailOnDemand?width=N&guidId=…` | tutte le miniature, in viste e javascript |
| `POST /foto/uploadFoto` | `ArchivioController:678`, `SyncFotoController:1538`, `:2974` |
| `POST /foto/uploadPacchettoFoto` | `SyncFotoController:1234` |
| `GET /foto/getInfoMassivo` | `SyncFotoController:2494`, `:2600`, `:2715`, `:2764` |

L'indirizzo arriva alle viste come `ViewBag.ipOlympus` e al javascript leggendo `#ipOlympus`.

> Storicamente le miniature le faceva Istanta con `ThumbController` e `System.Drawing`. Su Linux non
> funziona. Il 14/09 `ThumbController` è stato tolto e l'ultimo chiamante è passato a Olimpo: 42
> warning `CA1416` scesi a zero. **Da allora, senza Olimpo non si vedono le foto.**

C'è anche un `ICC/sRGB2014.icc`: Olimpo fa conversioni di profilo colore
(`lib/ConversionService.ts`).

---

## fidelity — promozioni e kit di design

`soluzione/fidelity/`, **101.097 righe TypeScript**: di gran lunga il più grande dell'insieme.
Express 5 + React, workspace npm con `src/` (client) e `server/`.

- Servizio: `istanta4-fidelity`, `npx tsx server/index.ts`, porta **3010**.
- Istanta lo chiama a `http://127.0.0.1:3010/api` (`fico/fpServerUrl`).
- Versione dichiarata nel `package.json`: **2.17.007**.

Come Istanta ci entra: **il passaporto**. `FICOMiddleware.login` costruisce un
`FICOPassportCredentials` con la `secretKey` condivisa e lo manda in `PUT`. È così che un utente già
autenticato in Istanta entra in fidelity senza autenticarsi di nuovo. `fico/userDataPolicy` in
`appsettings.json` dice quali campi mappare.

`AreeController` usa `fpUrl` per la configurazione dei punti vendita (ACPV), e
`FicoProcessController:5216` costruisce il link di ingresso sostituendo `/api` con `/login`.

Dalla struttura dei controller si capisce cosa gestisce: `DesignKitController`,
`RaccoglitoreKitController`, `TipoExportController`, `NamingConventionController`,
`PuntoVenditaController` (con dispositivi, token e heartbeat), `PermessiController`,
`AuditLogController`, `LogController`. Diverse rotte hanno nomi come
`get_all_naming_convention_from_istanta`, `getFiltroContestoDaIstanta`,
`getAllDeclinazioniKitDaIstanta`: **fidelity legge anche da Istanta**, non solo il contrario.

Ha `mongoose` e `mongodb` fra le dipendenze: **è la spiegazione più probabile del container Mongo**,
ma non è verificato.

---

## correggo4 — la revisione dei volantini impaginati

`soluzione/correggo4/`, **7.500 righe C# + 3.952 cshtml**, ASP.NET Core MVC su net10.

- Servizio: `istanta4-correggo4`, porta **5080**, con un `EnvironmentFile=/etc/istanta4-correggo4.env`
  che contiene `Fico__Secret` (il segreto condiviso con Olimpo per il passaporto di foto e loghi).
- La sua configurazione punta a `Fico/OlimpoUrl = http://127.0.0.1:3005/olimpo` e
  `Fico/IstantaUrl = http://127.0.0.1:5076`: **correggo4 chiama Istanta**, non viceversa.
- Storage dei volantini in `correggo4/storage/volantini`.
- Schema del database in `correggo4/db/correggo4_schema.sql`.

I suoi controller, dalle rotte: `VolantiniController`, `CorrezioniController` (note, timbri,
accettazione, propagazione, modifica di offerta e descrizione, foto, loghi), `PromoController`
(finestre, date, blocchi, revoca), `StoricoController` (pdf, zip, report), `IngestioneController`
(`/Ingestione/pack`, `/Ingestione/materiale`, e un `UploadVolFromFP.ashx` che tradisce l'origine
ASP.NET classica), `FotoController`, `AccountController`, `LegendaController`.

> ### correggo4 è lavoro di un altro flusso
>
> **Vive nella stessa cartella e nello stesso repository di Istanta, ma è un flusso di lavoro
> parallelo.** Durante la pulizia del 14/09 le sue modifiche sono rimaste **non committate** per
> scelta: chi tocca Istanta committa `Istanta/`, `AgenziaLib/`, `IstantaLib/` e basta.
>
> `git status` in `soluzione/` mostrerà sempre parecchie righe di `correggo4/` modificate o non
> tracciate. **Non è sporcizia da pulire**: è lavoro in corso di qualcun altro. Usa sempre
> `git add` e `git commit` **con il percorso esplicito**.
>
> Un fatto che conta: nel fine settimana precedente al 14/09, correggo4 ha **adottato due rotte di
> Istanta** che il venerdì risultavano orfane. Su un'API in evoluzione, una lista di «rotte morte»
> scade in giorni.

---

## plugin — il pannello dentro InDesign

`soluzione/plugin/`, **71.085 righe JavaScript**. È il pannello che i grafici vedono dentro Adobe
InDesign: le immagini nella cartella (`SubMenu_Impaginazione`, `SubMenu_Revisiona`,
`SubMenu_Confrontoliste`, `header_menabo_button`, `SubMenu_SyncFoto`…) sono i pulsanti della sua
interfaccia.

Parla con un **agente locale sulla porta 59999**, in HTTP e websocket:

```
fico/correggoServerUrl   http://127.0.0.1:59999
fico/agent               ws://127.0.0.1:59999/ws
sync_options/ipUploadGate  http://127.0.0.1:59999
```

> **`correggoServerUrl` non punta a correggo4.** Punta all'agente sulla 59999. Il nome è fuorviante
> e va ricordato: correggo4 sta sulla 5080.

Da qui passano l'impaginazione automatica, il ritorno delle alterazioni fatte a mano
(`getAlterazioniTracciatoFromIndd`), e l'aggiornamento delle foto
(`SyncFoto/updateFotoFromIndd`). Lato Istanta, `site.js` ha una
`scaricaUltimaVersioneDelPlugin()`.

File principali: `custom.js`, `schedaArtwork.js`, `InputEditController.js`, `garbageCollector.js`.

---

## strumenti/AnalisiChiamate

`soluzione/strumenti/AnalisiChiamate/`, 235 righe C# con **Roslyn** (`MSBuildWorkspace`,
`Microsoft.CodeAnalysis.CSharp.Workspaces 4.11.0`). Scritto il 14/09 per trovare i metodi senza
entry point.

Ha avuto **quattro difetti**, tutti trovati guardando i risultati e non il codice — e sono descritti
in [12-trappole.md](12-trappole.md), perché chiunque riscriva uno strumento simile li rifarà:

1. non seguiva le istruzioni di livello superiore di `Program.cs`;
2. i metodi di estensione risolvono al simbolo *ridotto* → serve `ReducedFrom`;
3. gli handler delle pagine Razor sono entry point;
4. **non attraversava gli accessori delle proprietà** — il più pericoloso: rendeva morto qualunque
   metodo chiamato solo da un getter o un setter.

93 → 59 → 31 → **22** metodi senza entry point. L'esito è in
`/srv/istanta4/backup/metodi-senza-entrypoint.csv` (sul server, non in git).

---

## Cosa succede se un satellite non risponde

| se manca | conseguenza |
|---|---|
| **Olimpo** | **non si entra in Istanta** (l'identità passa da lui) e non si vedono le foto |
| **fidelity** | non funziona il passaggio a FICO, né la configurazione ACPV in `AreeController` |
| **correggo4** | Istanta funziona; non si revisionano i volantini impaginati |
| **l'agente 59999** | Istanta funziona; non si impagina e non tornano le modifiche da InDesign |
| **Redis** | la sessione non si salva → **non si resta autenticati** |
| **PostgreSQL** | niente |

Per lavorare in locale solo su Istanta, i due indispensabili sono **PostgreSQL e Redis**; Olimpo
serve appena provi ad entrare.
