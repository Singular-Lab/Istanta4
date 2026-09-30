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
   restituisce `{candidate, obstacles}`. Per ogni box scrive in console una riga
   `refineRects <codice gruppo>: N ostacoli, N iterazioni, N rettangoli, N ms`, e avvisa
   l'operatore con `CSF-18` se il raffinamento è stato fermato dalla guardia.

Chi chiama passa poi **entrambi** a `fixFoto`. È sempre questa la coppia: `indexNew.js`,
`schedaRef.js`, `custom.js` in radice e l'agenzia Edro21 fanno tutti così.

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
| `obstacles.length + 1` | `refineRects` | la guardia del ciclo di raffinamento: il numero di giri oltre il quale la convergenza è impossibile — vedi sotto |
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
- `refineRects(..., esito)` → il raffinamento iterativo. Se gli si passa `esito`, lo riempie con
  `{ iterazioni, rettangoli, ostacoli, interrotto }`: `rettangoli` è il massimo raggiunto in un
  giro, `interrotto` è vero solo se il ciclo l'ha fermato la guardia e non la convergenza.
- `codiceGruppoDelBox(box)` → il codice gruppo dal DNA del box, per i messaggi; `sconosciuto` se
  non si legge.
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

## Una cosa segnalata e non corretta

È aperta come task a sé.

**Il presupposto della base.** Sia `getObstacles` sia `getSpazioImpaginazione` danno per scontato che
nel box esista un elemento la cui label comincia per `base`, e ne usano i `geometricBounds` senza
verificare di averlo trovato. In pratica ogni box ha la sua base, quindi non capita; se capitasse —
un box malformato, una base rinominata, un livello cancellato — l'errore sarebbe un `TypeError`
grezzo in due punti diversi, e chi lo legge nei log non capirebbe che manca la base.

## Il ciclo di `refineRects` finisce sempre — I20-1011

Il ciclo **converge sempre, in al più tanti giri quanti sono gli ostacoli più uno**:

- ogni pezzo nato da una spezzatura porta in `obstacleRefs` l'ostacolo che l'ha spezzato, e su
  quello non viene più spezzato;
- un rettangolo che a un giro non collide con niente non collide più, perché gli ostacoli non
  cambiano;
- quindi a ogni giro chi resta da spezzare ha un ostacolo in più nei suoi `obstacleRefs`, e gli
  ostacoli sono finiti.

La guardia è quel numero, `obstacles.length + 1`. Se scatta, la regola qui sopra è stata rotta da
un difetto: i candidati restituiti sono quelli parziali dell'ultimo giro, e
`getSpazioImpaginazione` lo dice in console col codice gruppo del box e all'operatore con `CSF-18`.

Fino a I20-1011 la guardia era a **mille giri**, e un secondo limite a **dieci milioni di
rettangoli** si controllava solo all'inizio di ogni giro. Non potevano scattare, e se l'avessero
fatto la funzione avrebbe restituito i candidati parziali come se fossero il risultato buono, senza
avvisare nessuno.

### Il rischio vero è il numero di rettangoli

Misurato su configurazioni casuali, base 100 × 80, sul codice vero sotto Node:

| ostacoli | giri massimi | rettangoli massimi in un giro | tempo massimo |
|---|---|---|---|
| 4 | 4 | 180 | 1 ms |
| 8 | 8 | 2.435 | 14 ms |
| 10 | 10 | 5.811 | 73 ms |
| 12 | 12 | 14.236 | 337 ms |
| 14 | 14 | 23.126 | 833 ms |

I giri non sono mai stati più degli ostacoli. **I rettangoli invece crescono in fretta**, e
`removeDuplicateRects` confronta ognuno con tutti gli altri: con molti ostacoli il costo sale, e in
UXP più che in Node. Quanti ostacoli abbia un box reale dipende da quanti suoi elementi non sono
foto, etichette o sfondi. La riga in console di `getSpazioImpaginazione` serve a misurarlo sui
volantini veri; **è un punto aperto**, non corretto.

Coperto da `tests/plugin/raffinamentoSpazio.test.js`, che carica il vero `CssFramework.js`
sostituendo il modulo `indesign` con un oggetto vuoto.

## Cosa è stato rimosso

`coloraResults(page, res)` disegnava i candidati sulla pagina come rettangoli pieni di «Rosso
prezzi», per guardare con gli occhi cosa l'algoritmo aveva calcolato. Non la chiamava nessuno —
l'unica chiamata, dentro `refineRects`, era commentata — ed è stata cancellata in I20-1002 su
decisione dell'operatore.
