# CssFramework — lo spazio di impaginazione e i rettangoli candidati

**A cosa serve questo gruppo: trovare dove c'è posto nel box.**

Prima che le foto vengano collocate, qualcuno deve dire quali porzioni del box sono libere. Questo
gruppo prende gli elementi già presenti — prezzo, descrizione, loghi, bolli — li tratta come
**ostacoli**, e produce un elenco di **rettangoli candidati** in cui le foto potrebbero stare.

È la prima metà di una coppia: qui si producono i candidati, [cssSpazioFoto](../cssSpazioFoto.md) li
valuta e sceglie quale vince. La divisione è la solita del motore CSS: **qui si guarda InDesign, lì
si decide senza guardarlo.**

Panoramica del file: [README.md](README.md).

---

## Come funziona, in quattro passaggi

1. **`getObstacles(box)`** — scorre gli elementi del box e tiene solo quelli che sono davvero un
   ostacolo. Si ignorano `base*`, `immagine*`, `foto_secondaria*`, `etichetta*`, `foto_extra*`,
   `sfondo*`: le foto stesse, le loro etichette e gli sfondi. **Una foto non è un ostacolo per
   un'altra foto**, perché vengono collocate tutte insieme dal fixFoto. Le coordinate sono relative
   alla base, non al box.

2. **`generateCandidateRects(larghezza, altezza, ostacoli, tolleranza)`** — per ogni ostacolo
   genera fino a quattro rettangoli: tutto lo spazio sopra, sotto, a sinistra e a destra. Sono
   candidati **grossolani e sovrapposti**, che ignorano l'esistenza di tutti gli altri ostacoli.

3. **`refineRects(...)`** — il cuore. Confronta ogni candidato con tutti gli altri ostacoli e, dove
   ce n'è uno dentro, lo spezza con `intersectRect` nei pezzi che restano liberi. Ripete finché
   nessun candidato collide più. Poi toglie i duplicati, scarta i rettangoli più piccoli di **un
   quarto della base** per lato, ed elimina quelli interamente contenuti in un altro.

4. **`getSpazioImpaginazione(box)`** — l'unica porta d'ingresso: mette in fila i tre passi e
   restituisce `{candidate, obstacles}`.

Chi chiama passa poi **entrambi** a `fixFoto`. È sempre questa la coppia: `indexNew.js`,
`schedaRef.js`, `custom.js` in radice e le agenzie Edro21 e Pac fanno tutti così.

---

## Variabili

**Il gruppo non ha nessuna variabile di modulo.** Nessuno dei nove membri è un dato: sono tutte
funzioni, e tutto lo stato è locale. È una differenza netta rispetto al resto di `CssFramework`, e
vale la pena dirla: **questo gruppo è già quasi puro** — prende un box, restituisce rettangoli, non
ricorda niente fra una chiamata e l'altra.

### Le quattro manopole del cliente

Stanno in `custom.js`, non nella configurazione del server:

| opzione | dove si legge | cosa fa |
|---|---|---|
| `ignoreElementsFixFoto` | `getObstacles` | **aggiunge** elementi alla lista di quelli che non sono ostacoli |
| `exceptionElementsToIgnoreFixFoto` | `getObstacles` | eccezioni alla lista: un elemento che sarebbe ignorato torna a contare |
| `customPadding` | `getObstacles` | margine per etichetta, come `{label, padding:[top,left,bottom,right]}` |
| `paddingBox` | `generateCandidateRects` | margine applicato a **ogni candidato** |

**`paddingBox` di default è negativo — `[-2,-2,-2,-2]` — e non è un errore di segno.** Applicato come
`r.x -= paddingBox[1]` e `r.width += (paddingBox[1] + paddingBox[3])`, un valore negativo
**restringe** il candidato di 2 mm per lato: è un margine di sicurezza perché le foto non finiscano
a filo degli ostacoli. Chi lo mettesse positivo otterrebbe candidati più larghi degli spazi
realmente liberi, e foto sovrapposte a quello che c'è intorno.

### I numeri scritti nel codice

| valore | dove | cosa significa |
|---|---|---|
| `0.0001` | `removeDuplicateRects`, `removeRectsToSmall`, `intersectRect` | tolleranza sui confronti in virgola mobile |
| `boxWidth / 4`, `boxHeight / 4` | `refineRects` | sotto un quarto della base per lato non ci sta una foto utile |
| `1000` | `refineRects` | il massimo di iterazioni del ciclo di raffinamento |
| `10000000` | `refineRects` | il secondo limite, sul numero di rettangoli: non si raggiungerebbe mai prima di finire la memoria |
| `0` | `getSpazioImpaginazione` | la tolleranza passata agli altri due: il parametro esiste ma da qui è sempre zero |

**Il quarto della base è la soglia meno ovvia delle cinque**: decide quanti candidati sopravvivono,
e non è configurabile dal cliente. Se un box ha spazi liberi stretti ma utilizzabili, vengono
scartati senza che nessuno lo dica.

---

## Funzioni

- `getSpazioImpaginazione(box)` → l'ingresso del gruppo.
- `getObstacles(box)` → gli ostacoli, in coordinate relative alla base.
- `safeFitToContent(textFrame)` → chiamata da `getObstacles` su ogni casella di testo. Serve perché
  un campo di testo occupa il suo riquadro, non il testo che contiene: **senza il fit l'ostacolo
  sarebbe più grande del vero** e le foto verrebbero più piccole del necessario. Vedi sotto.
- `generateCandidateRects(...)` → i candidati grossolani.
- `refineRects(...)` → il raffinamento iterativo.
- `intersectRect(rect, obs, tolerance)` → cosa resta di un rettangolo tolto un ostacolo: fino a
  quattro pezzi. I pezzi laterali sono alti quanto la sola fascia dell'ostacolo, così non si
  sovrappongono a quelli sopra e sotto.
- `removeDuplicateRects`, `removeRectsToSmall`, `reduceResult` → le tre potature finali.

### Cosa porta con sé un candidato

Oltre a `x`, `y`, `width` e `height`, ogni candidato ha:

- `direction` → da quale lato dell'ostacolo è nato (`sopra`, `sotto`, `sinistra`, `destra`);
- `obstacleRefs` → l'elenco degli ostacoli già considerati. **Non è decorativo:** è quello che
  impedisce a `refineRects` di rispezzare un candidato sullo stesso ostacolo all'infinito.

### `safeFitToContent`, la funzione meno ovvia del gruppo

Fa tre cose diverse:

1. **Rimette il frame dove stava.** InDesign, con `FRAME_TO_CONTENT`, sposta anche il testo: qui si
   misura la baseline prima e dopo e si compensa, altrimenti ogni fit farebbe salire il testo.
2. **Stringe in orizzontale i frame di più righe**, sulla larghezza vera del testo riga per riga,
   tenendo conto di inset, indent e scala orizzontale, con un 3% di margine per starci larghi.
3. **Rifiuta di lavorare su un frame in overflow** e lo segnala (`CSF-001`): un fit su un testo che
   già non ci sta peggiorerebbe le cose. `CSF-000` se non si riesce a risalire al box.

È l'unica del gruppo che non riguarda i rettangoli: se un domani il file si spezza ancora,
probabilmente appartiene alle utilità sul testo.

---

## Due cose segnalate e non corrette

Sono aperte come task a sé.

**Il presupposto della base.** Sia `getObstacles` sia `getSpazioImpaginazione` danno per scontato che
nel box esista un elemento la cui label comincia per `base`, e ne usano i `geometricBounds` senza
verificare di averlo trovato. In pratica ogni box ha la sua base, quindi non capita; se capitasse —
un box malformato, una base rinominata, un livello cancellato — l'errore sarebbe un `TypeError`
grezzo in due punti diversi, e chi lo legge nei log non capirebbe che manca la base.

**La guardia silenziosa di `refineRects`.** Quando il ciclo si ferma per raggiunto limite di
iterazioni, la funzione restituisce i candidati parziali dell'ultimo giro **come se fossero il
risultato buono**: nessun avviso, nessun log. Le foto verrebbero collocate in uno spazio calcolato a
metà, e chi guarda l'impaginato vedrebbe solo che «le foto sono venute male».

## Cosa è stato rimosso

`coloraResults(page, res)` disegnava i candidati sulla pagina come rettangoli pieni di «Rosso
prezzi», per guardare con gli occhi cosa l'algoritmo aveva calcolato. Non la chiamava nessuno —
l'unica chiamata, dentro `refineRects`, era commentata — ed è stata cancellata in I20-1002 su
decisione dell'operatore.
