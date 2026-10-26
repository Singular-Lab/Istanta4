# sistemazioneFoto/ — far stare le foto nel box

**Cosa è:** trovare dove c'è posto nel box e farci stare le foto senza che si sovrappongano agli
altri elementi né fra loro. È il primo concetto del Plugin ad avere **una cartella sua**
(I20-1009): prima stava dentro `CssFramework.js`, mescolato a ridimensionamenti, allineamenti e
segnalazioni conflitti.

Da non confondere con **procurarsi la foto giusta** — quale foto va su una referenza, chiederla al
server, scaricarla — che è un altro concetto e ha la sua cartella, [reperimentoFoto/](../reperimentoFoto/README.md).

---

## I tre file

| file | cosa fa | InDesign | test |
|---|---|---|---|
| `plugin/sistemazioneFoto/sistemazioneFoto.js` | gli ingressi, gli ostacoli, il fit dei testi, la disposizione e l'applicazione delle foto | **sì**, non si carica sotto Node | `spazioFotoRobusto.test.js`, con uno stub di `indesign` |
| `plugin/sistemazioneFoto/spazioLibero.js` | il calcolo dei rettangoli liberi, dati gli ostacoli | no | `raffinamentoSpazio.test.js` |
| `plugin/sistemazioneFoto/sceltaSpazio.js` | quale rettangolo vince | no | `sceltaSpazio.test.js` |

La divisione è quella che il Plugin usa ovunque sia possibile: **la parte pura calcola, la parte
InDesign legge il documento e ci scrive.** La prima si prova sotto Node, la seconda solo in
collaudo.

Le pagine:

- [01-spazio-libero.md](01-spazio-libero.md) — gli ostacoli, i candidati, il raffinamento, la base
  mancante, il ripristino dei fit;
- [02-sistemazione-foto.md](02-sistemazione-foto.md) — `fixFoto`: raggruppare, scegliere,
  ridimensionare, applicare;
- [sceltaSpazio.md](sceltaSpazio.md) — la scelta fra i candidati e la taratura del cliente.

---

## Come si usa

Sempre in coppia:

```js
var res = SistemazioneFoto.getSpazioImpaginazione(box);
SistemazioneFoto.fixFoto(box, res.candidate, res.obstacles);
```

`indexNew.js` dichiara `SistemazioneFoto` e `schedaRef.js` la usa da lì, come fa con
`CssFramework`.

## I tre rimandi in CssFramework

`CssFramework` tiene ancora **`getSpazioImpaginazione`, `fixFoto` e `safeFitToContent`**, come
rimandi di una riga a `SistemazioneFoto`. Esistono perché:

- le agenzie chiamano `CssFramework.fixFoto` e `CssFramework.getSpazioImpaginazione` — Edro21 e
  `custom.js` in radice, che è la copia montata di un'agenzia — e fanno `require('./CssFramework')`;
- `CssFramework.getRealBounds` usa `safeFitToContent`.

**Il codice nuovo del core chiama `SistemazioneFoto` direttamente.** Un test,
`sistemazioneFoto.test.js`, controlla che nessun file del core fuori da `custom.js` passi dai
rimandi.

## Cosa prende da CssFramework

Cinque cose restano di `CssFramework` e `sistemazioneFoto.js` le usa:

| membro | perché resta in CssFramework |
|---|---|
| `makeRegexFromGroupName` | la sintassi delle etichette del motore CSS: la usa mezzo file |
| `getSceltaSpazioFoto`, `getEstensioniFoto` | leggono la configurazione CSS del box tramite `contestoCss` e la mappa del box |
| `controllaSegnalazioniConflittiPendenti` | le segnalazioni conflitti sono un concetto del motore CSS |
| `sospendiControlloSegnalazioniConflitti` | l'interruttore di quelle segnalazioni, che `indexNew.js` accende durante l'impaginazione |

**Le chiede al momento della chiamata**, con una funzione `cssFramework()` che fa
`require('../CssFramework')`. Non si può fare in testa al file: `CssFramework` carica
`sistemazioneFoto` in testa, e un `require` reciproco a quel punto troverebbe `CssFramework` ancora
vuoto. Lo controlla `sistemazioneFoto.test.js`.

## Le globali

`sistemazioneFoto.js` usa, come il resto del Plugin, `Utility`, `messaggioUtente`,
`addSegnalazione`, `customAgenzia` e `pluginMiddleware`, e da `indesign` importa `FitOptions` e
`ClippingPathType`. `spazioLibero.js` e `sceltaSpazio.js` non usano nessuna globale e non importano
niente.

## Cosa non si è portato

Le 189 righe di codice commentato che stavano fra i membri del gruppo in `CssFramework.js` — vecchie
versioni di `intersectRect`, `findFreeRectangles`, `getIntersection` e simili — non sono state
copiate nei file nuovi. Restano nella storia git, nel commit prima di I20-1009.

## I codici messaggio

| codice | dove | quando |
|---|---|---|
| `CSF-000`, `CSF-001` | `safeFitToContent` | non si risale al box; il testo è in overflow e il fit non si fa |
| `CSF-12` | `eseguiFixFoto` | non c'è una configurazione di distanziamento per quel numero di foto |
| `CSF-18` | `calcolaSpazioLibero` | il raffinamento è stato fermato dalla guardia |
| `CSF-19` | `segnalaBaseMancante` | il box non ha la base |
