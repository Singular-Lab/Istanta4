# Il front-end

**39 viste** (8.775 righe) e **33 file javascript** (26.804 righe), più le librerie di terze parti in
`wwwroot/lib/`.

---

## Come vengono caricati gli script

`_Layout.cshtml` carica prima jQuery e Bootstrap con dei `<script>` normali, poi `js/system.js`, e
infine **carica il resto in sequenza garantita** con un piccolo caricatore a promesse:

```javascript
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload  = () => resolve();
        script.onerror = () => reject(new Error(`Errore nel caricamento: ${src}`));
        document.head.appendChild(script);
    });
}

async function loadScriptsInOrder() {
    const dynamicId = uuidv4();
    await loadScript(`${webRootFolder}/js/IAgenzia.js?id=${dynamicId}`);
    await loadScript(`${webRootFolder}/js/utility.js?id=${dynamicId}`);
    await loadScript(`${webRootFolder}/js/call.js?id=${dynamicId}`);
    await loadScript(`${webRootFolder}/js/agenzia.js?id=${dynamicId}`);
    await loadScript(`${webRootFolder}/js/revisore.js?id=${dynamicId}`);
    await loadScript(`${webRootFolder}/js/components.js?id=${dynamicId}`);
    ... e così via
}
```

**L'ordine conta ed è esplicito**: `IAgenzia.js` deve arrivare prima di `agenzia.js`, perché
`Agenzia extends IAgenzia`.

Ordine completo in `_Layout`: `IAgenzia`, `utility`, `call`, `agenzia`, `revisore`, `components`,
`archivio`, `ordinamento`, `taskManager`, `addestramento`, `promo`, `syncfoto`,
`declinazioneMeccaniche`, `etichette`, `frameworkCss`, `loghibolli`, `confronti`, e in coda `site`.

`_LayoutLogin.cshtml` ne carica solo quattro: `IAgenzia`, `utility`, `call`, `site`.

> **`?id=<uuid>` a ogni caricamento**: un guid nuovo per ogni pagina, quindi **nessuna cache del
> browser sui js**. Comodo mentre si sviluppa, meno in produzione: ogni pagina riscarica 26.000
> righe di javascript.
>
> **`system.js` è l'unico caricato in modo tradizionale** e definisce ciò che serve al caricatore
> stesso: `getWebAppRootFolder()`, `getWebAppRootUrl()`, `uuidv4()`.

Le librerie esterne arrivano da **cdnjs.cloudflare.com** con `integrity` e un `nonce` preso da
`@Context.Items["ScriptNonce"]` (font-awesome 4.7 e 5.15, bootstrap-datepicker 1.9). jQuery e
Bootstrap sono invece locali in `wwwroot/lib/`.

---

## I file, uno per uno

| file | righe | cosa contiene |
|---|---|---|
| `revisore.js` | 3.046 | **il più grande**. La schermata di revisione |
| `agenzia.js` | 1.356 | `class Agenzia extends IAgenzia` — **il cliente attuale** |
| `declinazioneMeccaniche.js` | 961 | |
| `syncfoto.js` | 922 | `class SyncFoto` — 19 metodi, dalla scansione al caricamento |
| `promo.js` | 892 | `class Promo` — 15 metodi, la gestione delle promo |
| `addestramento.js` | 729 | |
| `components.js` | 697 | `renderRecordRevisione`, `addMismatchKeyVisual`, `renderGruppiModalitaSottogruppo` |
| `cssFramework.js` | 636 | `class CssFramework` — 23 metodi, l'editor del framework css |
| `confronti.js` | 582 | |
| `visualSource.js` | 567 | `class VisualSource` — rende visibili i `Source*.json` |
| `frameworkCss.js` | 562 | |
| `archivio.js` | 386 | `class Archivio` — 21 metodi |
| `etichette.js` | 381 | |
| `ordinamento.js` | 331 | |
| `taskManager.js` | 247 | |
| `utility.js` | 209 | `SyncFileStato`, `TipoFoto`, conversioni di numeri fra culture |
| `IAgenzia.js` | 205 | **il contratto del front-end: 60 metodi** |
| `mySocket.js` | 163 | `class Messages` — il websocket |
| `loghibolli.js` | 131 | |
| `menaboSettings.js` | 120 | |
| `site.js` | 101 | `mostraMessaggio`, `showLoading`, `hideLoading`, `getStringFromDate`, `scaricaUltimaVersioneDelPlugin` |
| `call.js` | 83 | **`Call.do(...)`: il livello ajax**. Tutte le chiamate al server passano di qui |
| `sourceEditor.js` | 76 | l'editor dei json, usato da 8 viste |
| `system.js` | 30 | le tre funzioni base |

Più i nove `<cliente>/agenzia.js` d'archivio: `coop` (1.337), `edro21` (1.356), `famila` (1.360),
`gross` (831), `craiOvest` (707), `Maiora` (644), `navcove` (861), `pac` (887), `trea` (1.028).

> `cssFramework.js` (636) e `frameworkCss.js` (562) sono **due file diversi con il nome invertito**.
> Il primo definisce `class CssFramework` ed è caricato solo da `FrameworkCss/Index.cshtml`; il
> secondo è caricato da `_Layout` per tutti. È una trappola di lettura: quando cerchi «il framework
> css», guarda quale dei due.

---

## Il punto di estensione: `IAgenzia.js`

Sessanta metodi che di default fanno solo:

```javascript
compilaBoxAgenzia(item, callback) {
    console.error("Chiamata compila box agenzia non implementata");
    return null;
}
```

Il cliente ne implementa il sottoinsieme che gli serve. Quanti ne implementa ciascuno:

| cliente | metodi implementati |
|---|---|
| `famila`, `edro21`, radice | 43 |
| `coop` | 36 |
| `trea` | 28 |
| `gross` | 26 |
| `pac`, `Maiora` | 25 |
| `navcove` | 21 |
| `craiOvest` | 19 |

I gruppi di metodi, per capire dove si interviene:

- **il box in revisione** — `compilaBoxAgenzia`, `setRecord_revisioneArticolo`, `aggiungiCampiRevisione*`, `SetPrezzi`, `AggiungiInfo`, `AggiungiInfoPezzo`
- **i form** — `getForm_importazioneTracciato`, `getForm_ricercaTracciato`
- **il menabò** — `filterRecordsTracciatiOnMenabo`, `ordinaRecordsTracciatoInMenabo`, `onRenderRefInListaMenabo`, `onRenderFinestraEsportazionePoP`
- **l'ordinamento** — quattordici metodi `*Ordinamento*`, che sono l'editor dello schema di ordinamento
- **i segnaposto** — `customSegnaposti`, `AggiornaSegnapostiPostRicerca`, `contaSiblingSottoSegnaposto`, `ApplicaSegnaposto`
- **i confronti** — `getCustomConfronti`, `confrontaLocandine`, `confrontiSetTipoMateriali`, `controllaCambioPromoCustomConfronti*`
- **l'etichettatura** — `customCampiEtichettaturaPromo`, `…PromoTracciati`, `…Tracciato`
- **navigazione nel DOM** — `findElementFromBottomUp`, `findElementFromUpBottom`

**Ricorda la regola della radice**: a runtime si carica solo `js/agenzia.js` nella radice, e le
cartelle per cliente sono l'archivio. Vedi [02-modello-multicliente.md](02-modello-multicliente.md).

---

## Le viste

39 file `.cshtml`. Il `_ViewStart.cshtml` imposta `Layout = "_Layout"` per tutti; le tre viste di
`Login/` lo sovrascrivono con `_LayoutLogin`.

Le più grandi:

| vista | righe | di cui javascript inline |
|---|---|---|
| `Revisore/Index.cshtml` | 1.220 | 77 |
| `DeclinazioniMeccaniche/Index.cshtml` | 914 | 151 |
| `Archivio/Index.cshtml` | 740 | 72 |
| `Tracciati/Training.cshtml` | 533 | 12 |
| `Register/Index.cshtml` | 519 | **216 (54%)** |
| `FrameworkCss/Index.cshtml` | 495 | 121 |
| `SchedaArticolo/Index.cshtml` | 482 | 25 |
| `Shared/_Layout.cshtml` | 391 | **191 (55%)** |

> **Il 21% delle viste è javascript scritto dentro il `.cshtml`**: 1.629 righe su 7.892. Non è
> sporcizia — funziona — ma è codice che nessuno strumento javascript vede, che non si può
> riutilizzare e che si trova solo cercando nelle viste. `Register/Index.cshtml` e `_Layout.cshtml`
> sono per più di metà javascript.

Un'avvertenza per chi cerca: **il controller di `CustomPlugin/Index.cshtml` si chiama
`CustomPlugin.cs`**, senza il suffisso `Controller`. Uno strumento che cerca i controller per nome
di file lo salta e dichiara orfana la vista. Non lo è.

---

## Il menu

Da `_Layout.cshtml`: Tracciati, Confronti (Esegui + Parametri), Addestramento lista,
Sincronizzazione (foto, loghi/bolli, registro), Archivio, Aree, MenaboSettings (Ordinamento,
Formati, TipiDiExport, NamingConventions), Etichette, DeclinazioniMeccaniche, FrameworkCss
(+ MappaStili), CustomPlugin, Register, e il logout su `~/LoginController/logoutFromPage`.

---

## La fascia dei sorgenti mancanti

Dal 14/09, in cima a `_Layout` e `_LayoutLogin`:

```html
@{
    var _sorgentiDaCompilare = ViewBag.SorgentiDaCompilare as List<string>;
}
@if (_sorgentiDaCompilare != null && _sorgentiDaCompilare.Count > 0)
{
    <div class="alert alert-warning border-0 rounded-0 mb-0 py-2 px-3" role="alert" ...>
        <strong>Sorgenti da compilare.</strong>
        Al cliente <strong>@ViewBag.NomeCliente</strong> mancano, o sono stati creati vuoti,
        @_sorgentiDaCompilare.Count file di configurazione:
        <strong>@string.Join(", ", _sorgentiDaCompilare)</strong>.
        Vanno copiati da <code>external_source/vergine/</code> e compilati con i dati del cliente
        prima di lavorare: contengono impostazioni che l'applicazione da per buone.
    </div>
}
```

Riempita da `CustomViewBagFilter` (`Istanta/Handlers/GlobalViewBagFilter.cs`), che gira su ogni
azione e imposta anche `ViewBag.ExternalSourceCustom` e `ViewBag.NomeCliente`.

> **Se provi questa fascia con `curl`, attenzione a due cose.** La prima: `/Login` usa
> `_LayoutLogin`, non `_Layout`, e tutte le pagine che usano `_Layout` stanno dietro
> l'autenticazione. La seconda: **Razor aggiunge a ogni tag l'attributo del css con ambito**, quindi
> nell'HTML renderizzato trovi `<strong b-u2ezc1h3x5>` e non `<strong>`. Un `grep '<strong>'` non
> trova nulla e sembra che il valore sia vuoto. Entrambi gli errori sono stati fatti il 14/09.
