# CssFramework — ridimensionamento, overflow, collisioni e reflow

**A cosa serve questo gruppo: far entrare il contenuto del box nelle misure che la griglia gli ha
assegnato.**

Il box impaginato ha quasi sempre dimensioni diverse da quelle del modello. Questo gruppo
ridimensiona e sposta gli elementi di conseguenza, poi rimedia a quello che ne consegue — testo che
esce dai bordi, elementi che si toccano, descrizioni che si sovrappongono.

È il gruppo più pesante del file: **17 membri, 3.465 righe**, e quattro funzioni da sole ne fanno
2.500.

Panoramica del file: [README.md](README.md).

---

## I quattro atti

1. **Ridimensionare.** `applicaRidimensionamento` calcola di quanto il box è cambiato e applica le
   regole. **Non misura il box sui suoi bounds dichiarati**, ma sull'ingombro dei suoi elementi
   visibili, prendendo il più stretto fra i due: un box il cui riquadro è più grande del contenuto
   non deve ingrandire tutto in proporzione al vuoto.
2. **Post-ridimensionare.** `applicaPostRidimensionamento` e `applicaPostRidimensionamenti` applicano
   le regole che devono girare **dopo** che le dimensioni si sono assestate. È qui che vive
   `calcolaValoreDimensione`, l'interprete delle espressioni.
3. **Rimediare.** `fixOverflowFromBox` riporta dentro chi è uscito, `fixCollisioneTracciaBase`
   allontana gli elementi dalla traccia del bordo, `finalFit` applica i fit richiesti.
4. **Il reflow della descrizione.** `reflowTextFrameAvoidConflicts`, 1.230 righe.

---

## L'interprete delle espressioni

`calcolaValoreDimensione(espressione, asse, mappaBoxOriginale, box)` è il pezzo che vale la pena
conoscere, perché è **la sintassi che un cliente scrive nella configurazione**:

| forma | significato |
|---|---|
| `40` | quaranta millimetri |
| `20%` | il 20% della dimensione del box sull'asse richiesto |
| `sy_ombra` | la dimensione di quell'elemento |
| `sy_ombra[W]` / `sy_ombra[H]` | forzando l'asse, invece di usare quello richiesto |
| `sy_ombra[text]` | i bounds del **testo**, non del riquadro |
| `sy_ombra[presente]` | il termine vale solo se l'elemento c'è e non è stato eliminato |
| `sy_ombra[H][50%]` | metà dell'altezza dell'ombra |

I termini si sommano e si sottraggono — `+prezzo[W]-10` è legittimo. Le virgole diventano punti, gli
spazi si ignorano, e le sequenze `+-` o `--` si normalizzano.

È la stessa sintassi usata da `getEstensioniFoto`, vedi
[01-infrastruttura-e-mappa](01-infrastruttura-e-mappa.md).

---

## Variabili

| nome | cos'è |
|---|---|
| `etichetteSegnalate` | le etichette già segnalate in questo box, per non ripetere la stessa segnalazione |

**Ha una particolarità da conoscere.** Viene azzerata in `applicaRidimensionamento` e letta in
`fixOverflowFromBox`, ma **tutti e tre gli accessi sono senza `this.`**: lavorano su una globale
implicita, e il membro `etichetteSegnalate: []` dell'oggetto non viene mai usato.

Funziona, perché tutti sbagliano allo stesso modo. Ma il giorno che qualcuno scrivesse
`this.etichetteSegnalate` leggerebbe l'array vuoto del membro, e le segnalazioni sparirebbero in
silenzio. Vanno corretti tutti e tre insieme o nessuno.

Le costanti del reflow stanno dentro la funzione: `MIN_POINT_SIZE` 3, `MAX_MAIN_ITERS` 200,
`MAX_LOCAL_ITERS` 50, `EXPAND_STEP` 1. Tre sono guardie anti-ciclo, come quella di `refineRects`.

---

## Funzioni

- `applicaRidimensionamento(box, boxInGrigliaBounds, mappa, itemRef, DBallineamenti, DBDef)` →
  l'ingresso del ridimensionamento.
- `applicaPostRidimensionamento(...)` → le regole successive, per tutto il box.
- `applicaPostRidimensionamenti(elemento, ..., isItemLink)` → quelle di un singolo elemento; con
  `isItemLink` agisce sulla grafica dentro il riquadro invece che sul riquadro.
- `calcolaValoreDimensione(...)` → l'interprete descritto sopra.
- `fixOverflowFromBox(boxInGrigliaBounds, box, mappa)` → chi esce rientra. **Su una casella di testo
  prova prima a stringerla**, e solo se andrebbe in overflow la sposta.
- `isTextFrame(item)` → il controllo di tipo usato lì.
- `fixCollisioneTracciaBase(box, gruppoElementi, impostazioni)` e
  `fixCollisioneTracciaBaseSingolo(...)` → allontanano dalla traccia del bordo della base, di uno
  spessore più la distanza configurata. **Entrambe controllano che la base ci sia e sia valida**, come
  dal I20-1010 fanno anche `getObstacles` e `getSpazioImpaginazione` — vedi
  [sistemazioneFoto/01-spazio-libero](../sistemazioneFoto/01-spazio-libero.md).
- `righeDiTesto(item)` → i rettangoli delle singole righe, costruiti con
  `cssRegoleConflitti.rettangoloDiRiga`.
- `elementsTouching(item1, item2, useTextBounds)` → se due elementi si toccano. Con `useTextBounds`
  il confronto è **riga per riga**: il rettangolo unico ingloba tutte le righe, quindi una riga
  lunga presterebbe la sua larghezza alla fascia dove c'è solo una riga corta.
- `checkCollision(boundsA, boundsB)` → sovrapposizione fra due rettangoli, in forma diretta.
- `finalFit(mappa, fitRichiesti)` → applica in ordine i fit dichiarati per ogni etichetta:
  `FRAME_TO_CONTENT`, `CONTENT_TO_FRAME`, `PROPORTIONALLY`.
- `getBoundsLine`, `getBoundsLineByIndex`, `getSubstringBoundsAndWidth` → la geometria del testo su
  cui lavora il reflow.

---

## `reflowTextFrameAvoidConflicts`

Manda a capo la descrizione perché non si sovrapponga agli altri elementi del box. **Tre leve, in
quest'ordine:**

1. **inserire a capo** nei punti consentiti;
2. **espandere il frame** verso il basso o l'alto, secondo `expandVericalToFindSpace`;
3. come ultima risorsa, **ridurre il corpo del carattere** un punto alla volta, fino a un minimo
   di 3.

Tiene traccia degli a capo che inserisce lei, per poterli togliere se cambia strada. Contiene una
trentina di funzioni locali e tre guardie anti-ciclo: 200 giri principali, 50 per conflitto singolo,
50 nel fallback sul corpo.

### Il difetto corretto in I20-1002

Nel preambolo chiamava `makeRegexFromGroupName(...)` **senza `this.`**. Quel nome è un membro
dell'oggetto, non una funzione globale, e in tutto il resto del file viene chiamato con `this.` in
una ventina di punti.

Ogni singola volta, quindi: `ReferenceError` prima di fare qualsiasi lavoro, catturato dal
`try/catch` che avvolge la funzione, `console.error` e `return false`. **Il reflow non è mai
avvenuto.**

L'unico chiamante è `indexNew.js:4942`, attivo solo per `tipoLavorazione == 2` — il PoP — e **ignora
il valore di ritorno**: nessuna assegnazione, nessun controllo. L'unica traccia era una riga in
console.

La correzione è una parola, ma fa partire per la prima volta un algoritmo che nessuno ha mai visto
girare. Gli effetti si vedranno alla prima impaginazione PoP, e sono evidenti a occhio.

**Il test `tests/plugin/cssFrameworkChiamateMembri.test.js`** impedisce che il difetto si ripeta:
legge il sorgente come testo — il file non si carica sotto Node — e fallisce se un membro viene
chiamato senza `this.`, indicando riga e nome.
