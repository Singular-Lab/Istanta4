# cssComposizioneBox.js

**Cosa è:** duplicazione di elementi e ordine di sovrapposizione dentro un box. Nasce con I20-970.

Il CssFramework sa spostare, ridimensionare e allineare quello che **già esiste** nel box, ma non sa
crearne di nuovi né decidere chi sta davanti a chi. Questo modulo aggiunge le due decisioni
tenendole fuori da `custom.js` e fuori da InDesign: qui si calcola soltanto **il piano** — cosa
duplicare, con che etichetta, con che bounds, cosa mandare dietro a cosa — mentre
[CssFramework](cssFramework/README.md) lo esegue sul documento.

I bounds seguono la convenzione InDesign: `[y1, x1, y2, x2]`, con `y1` in alto e `y2` in basso.

## Il piano è rieseguibile

Il box viene ricomposto più volte — prima gli allineamenti, poi la sistemazione delle foto — e ogni
passaggio deve poter ripartire da dove si era. Perciò:

- le copie già presenti **si aggiornano** invece di ricrearle;
- la sorgente non è l'unico modello possibile: se è stata rimossa si duplica da una copia;
- spariscono **solo** le copie il cui bersaglio non esiste più.

## Variabili globali

| nome | valore | cos'è |
|---|---|---|
| `separatoreSuffisso` | `"$"` | rende univoca l'etichetta di una copia: `sy_ombra$3150596` per la foto `immagine$3150596` |

**Perché questo carattere conta più di quanto sembri:** altrove nel Plugin l'etichetta viene
normalizzata **tagliando quello che segue il `$`**. Per le copie quel taglio le renderebbe tutte
omonime, e due ombre diventerebbero un elemento solo. È la ragione per cui esistono
`prefissiDerivati` ed `etichettaDerivata`.

## Funzioni

- `etichettaCopia(sorgente, bersaglio, indice)` → l'etichetta della copia è quella della sorgente
  più il suffisso del bersaglio, cioè ciò che nel bersaglio segue il primo `$`. Senza suffisso si
  usa l'indice, così due copie non collidono mai.
- `boundsCopia(boundsSorgente, boundsBersaglio, adatta)` → i bounds della copia a partire dal
  bersaglio. Le opzioni di `adatta`:

  | opzione | valori |
  |---|---|
  | `larghezza` / `altezza` | `"bersaglio"` per prenderne la misura, altrimenti resta quella della sorgente |
  | `ancoraX` | `"centro"` (default), `"sinistra"`, `"destra"` |
  | `ancoraY` | `"centro"` (default), `"alto"`, `"basso"`, `"centroSuLatoBasso"`, `"centroSuLatoAlto"` |
  | `offsetX` / `offsetY` | scostamento finale in millimetri |
  | `fitContenuto` | `"riquadro"` per far seguire il grafico al riquadro, `"proporzionale"` per adattarlo senza deformarlo; assente lascia il contenuto com'è |

  Con `centroSuLatoBasso` metà della copia resta sotto il bersaglio e metà finisce dietro di esso.

- `pianificaDuplicazioni(regole, elementi, corrisponde)` → restituisce
  `{ copie, aggiornamenti, rimozioni }`. **Le misure si calcolano sempre dal modello, mai dalla
  copia già adattata**: ripartire da quella accumulerebbe gli adattamenti a ogni passaggio. La
  sorgente se ne va quando le copie ci sono — resterebbe un elemento spaiato — salvo
  `mantieniSorgente`.

  `corrisponde(etichetta, spec)` è la stessa corrispondenza per etichetta usata dal resto del
  framework, **iniettata per non averne due versioni divergenti**.

- `prefissiDerivati(regole)` → i prefissi delle etichette che nascono da una duplicazione
  (`"sy_ombra$"`).
- `etichettaDerivata(etichetta, prefissi)` → se un'etichetta è quella di una copia. Il suffisso deve
  esserci davvero: `"sy_ombra$"` da solo non è una copia.
- `pianificaOrdineZ(regole, elementi, corrisponde)` → chi va dietro e chi davanti. **Un elemento non
  può essere spostato rispetto a sé stesso**, e le etichette senza riferimento vanno in fondo o in
  cima al box.

**Test:** `node --test tests/plugin/cssComposizioneBox.test.js`
