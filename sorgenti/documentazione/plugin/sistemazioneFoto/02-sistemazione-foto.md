# Sistemazione foto — far stare le foto nel box

**A cosa serve questa parte: far stare le foto nello spazio trovato, senza che si sovrappongano.**

Riceve i candidati prodotti da [01-spazio-libero](01-spazio-libero.md), dispone le foto in gruppo,
sceglie il candidato migliore tramite [sceltaSpazio](sceltaSpazio.md), ridimensiona il gruppo
perché ci stia e lo applica al documento. Sta in `plugin/sistemazioneFoto/sistemazioneFoto.js`;
fino a I20-1009 era in `CssFramework.js`.

Panoramica del concetto: [README.md](README.md).

---

## L'ingresso

`fixFoto(box, candidateRects, obstacles, projection = false)`.

Con **`projection = true` calcola soltanto l'area occupata senza toccare il documento**: serve a
sapere quanto spazio servirebbe, prima di decidere.

Dal I20-1025 c'è anche **`proiezioneFixFoto(box, candidateRects, obstacles)`**: la stessa prova, che
restituisce `{ area, distanzaDalCentro }` (la distanza del gruppo dal centro della base, sull'asse
della preferenza del box), oppure `null` se le foto non trovano posto. `fixFoto` in prova, senza
posto, restituisce `undefined`: chi confrontava due prove con `Math.floor` otteneva `NaN`. Con
**`preferisciDisposizione(box, prima, seconda)`** si sceglie fra due prove con la preferenza del box
(vedi [sceltaSpazio](sceltaSpazio.md)). Le usa Edro21, attraverso i rimandi di `CssFramework`.

Lo chiamano `indexNew.js` e `schedaRef.js` su `SistemazioneFoto`, `custom.js` in radice e
l'agenzia Edro21 su `CssFramework`, attraverso il rimando: sempre dopo `getSpazioImpaginazione` e
passandogli entrambi i risultati.

`fixFoto` è una busta: il lavoro lo fa `eseguiFixFoto`, e `fixFoto` garantisce in un `finally` che
gli ostacoli tornino alle misure di prima del fit, qualunque cosa succeda (I20-1010).

## Come lavora, in ordine

1. **Raccoglie le foto** del box: la primaria per prima, poi le secondarie. **Le foto invisibili non
   partecipano** — I20-978: una foto in noRender è impaginata ma nascosta, e contarla faceva
   scegliere la disposizione per una foto in più, spostando quella visibile e lasciando un buco.
2. **Cerca la configurazione di distanziamento** per quel numero di foto. Se non c'è si ferma e lo
   dice (`CSF-12`), senza toccare niente.
3. **Riporta le foto alla stessa scala** — I20-978: senza, un fix girato su un gruppo ridotto
   lasciava ingrandite le foto rimaste, e quella riattivata dopo restava più piccola per sempre.
4. **Dispone le foto in gruppo** con `getRaggruppamentoFoto` e ne calcola l'ingombro complessivo.
5. **Restringe i candidati** di quanto sporge dalle foto (`getEstensioniFoto`, vedi
   [01-infrastruttura-e-mappa](../cssFramework/01-infrastruttura-e-mappa.md)) e **sceglie** con
   `sceltaSpazio.scegli`. Se nessun candidato va bene, ripristina gli ostacoli e si ferma.
6. **Ridimensiona il gruppo** perché entri nel candidato, lo centra, e applica i bounds alle foto
   vere con `CONTENT_TO_FRAME`.
7. **Ripristina la dimensione originale degli ostacoli** — che `getObstacles` aveva alterato col fit
   — e fa scattare il controllo delle segnalazioni conflitti.

---

## Variabili

| nome | cos'è |
|---|---|
| `calcoloDistanziamentoFoto` | per ogni numero di foto, le percentuali di distanziamento fra una e l'altra, con soglie sul rapporto altezza/larghezza |

È **l'unico dato di questa parte**. Il cliente lo sovrascrive da `custom.js` con la chiave
omonima, e con `paddingFoto` aggiunge un margine attorno a ogni foto.

## Funzioni

- `fixFoto(...)` → l'ingresso, descritto sopra.
- `eseguiFixFoto(...)` → il corpo di `fixFoto`. Si chiama solo da lì.
- `getRaggruppamentoFoto(fotos, distanzFoto)` → dispone le foto **a cascata**: ognuna centrata
  rispetto alla precedente e scostata delle percentuali configurate. Il set di percentuali si
  sceglie sul rapporto altezza/larghezza della **prima** foto. Torna l'ingombro del gruppo e le foto
  con i nuovi bounds, normalizzati con l'angolo in `0,0`.
- `approachOne(x, k = 1.2)` → avvicina un valore a 1 con un decadimento esponenziale. Serve a
  **smorzare l'effetto del rapporto d'aspetto** sul distanziamento: una foto molto allungata non
  deve allontanarsi dalle altre in proporzione alla sua stranezza.
- `scalaDellaFoto(rect)` → la scala a cui è inserita l'immagine, o `null` se la foto è vuota. Una
  scala illeggibile non ferma il fix: quella foto resta com'è.
- `normalizzaScalaDelleFoto(fotos)` → riporta tutte alla scala della prima, che è la primaria. La
  regola vive in `sceltaSpazio.fattoriDiNormalizzazione`, fuori da InDesign e quindi verificabile.
- `getRealBoundsOfFoto(img, offset)` → l'ingombro **reale** dell'immagine dentro il riquadro, che
  non coincide col riquadro: è quello che conta per disporre le foto senza spazi vuoti fra l'una e
  l'altra.
- `getVertex(img, offset)` → i vertici dell'immagine, usata da `getRealBoundsOfFoto`.

**Dove non si è spostato tutto.** `getSceltaSpazioFoto` e `getEstensioniFoto`, che leggono dalla
configurazione CSS del box come scegliere lo spazio e quanto sporge dalle foto, sono rimasti in
`CssFramework`: lavorano sul contesto e sulla mappa del box, che sono suoi. `eseguiFixFoto` li
chiede a `CssFramework` al momento della chiamata. Lo stesso vale per `applicaOperazioniDopoFixFoto`,
che è composizione del box.

---

## Cosa è stato rimosso in I20-1002, e perché

Documentando è emerso che la catena `MAIN_fixFoto` **non poteva funzionare**.

`MAIN_fixFoto` chiamava `analisiModello`, `startFix`, `fixIterazione` e `test` **senza `this.`**, e
assegnava `img1`, `img2`, `img3`, `inddItemImg1-3`, `confini` e `modelloDiFix` **senza `this.`**. In
un metodo, `analisiModello(...)` cerca una funzione globale che non esiste: il risultato è un
`ReferenceError`. Verificato riproducendo la struttura sotto Node:

```
ReferenceError: analisiModello is not defined
il membro img1 è stato toccato? {}
esiste una globale img1? object
```

Le assegnazioni creavano **globali implicite** lasciando intatti i membri dell'oggetto: i valori
scritti in `confini`, `offsetScale`, `modelloDiFix` e nei sei `modello*` non venivano mai letti.

Era codice ExtendScript trapiantato dentro l'oggetto dal vecchio `fotoFix.js` — lo stesso file
svuotato e cancellato nel Lotto 1 — senza adattare le chiamate interne, che lì erano corrette perché
quelle funzioni erano globali del file.

**Nessuno se n'era accorto** perché le uniche a chiamarla erano le agenzie Doc ed Etruria,
deprecate. Cancellate quelle, la catena è rimasta senza un solo chiamante vivo — l'unico riferimento
residuo, in `Agenzie/Trea/custom.js:1516`, era commentato — ed è stata rimossa.

**28 membri, 627 righe:** `MAIN_fixFoto`, `analisiModello`, `startFix`, `fixIterazione`, `test`,
`checkOverflow`, `getRect`, `calcolaAreaPoligono`, `getAreaSovrapposizione`,
`getAreaSovrapposizione2`, `checkHittedArea`, `intersec`, più `confini`, `offsetScale`, `img1-3`,
`inddItemImg1-3`, `cacheBoundaries`, `modelloDiFix` e i sei `modello*`.

**Sono restati** `getVertex`, perché lo usa `getRealBoundsOfFoto`, e `approachOne`, perché lo usa
`getRaggruppamentoFoto`; dal I20-1009 stanno in `sistemazioneFoto.js`. La verifica è stata fatta a punto fisso, controllando i tre modi in cui un
membro può essere chiamato — `nome(`, `this.nome`, `CssFramework.nome` — perché il terzo era
proprio il caso di `getVertex` e la prima passata lo aveva mancato.
