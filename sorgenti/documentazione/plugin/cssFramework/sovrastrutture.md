# cssFramework/sovrastrutture.js — regole che seguono la ref, non il box

**Cosa è:** il modulo puro che permette al motore CSS di dare regole a **qualunque box porti una
certa ref**, e di cambiarle con **la forma del box**. Nasce con I20-1026 per il formato Parmigiano
Reggiano di Edro21, ma non sa niente di parmigiano: le regole stanno nel `SourceFrameworkCss.json`
del cliente. Panoramica del motore: [README.md](README.md).

Prima di I20-1026 una regola si dava per un box (`nomiBox`) o per tutti i box (`nomiBox` vuoto).
Qui si aggiungono quattro cose.

---

## 1. Le sovrastrutture

Un elenco nuovo del kit, accanto a `operazioniPerBox`:

```json
"sovrastrutture": [{
  "nome": "Parmigiano",
  "listSetCondizioni": [{ "setCondizioni": [{ "refCondition": [{ "campo": "Descrizioni.Descrizione1", "contiene": "parmigiano reggiano" }] }] }],
  "operazioni": { "allineamenti": [ ... ], "disattiva": [ ... ] }
}]
```

Le `operazioni` hanno la stessa forma delle regole di un box (`nomiBox` non conta). **Una
sovrastruttura le cui condizioni sono vere si fonde nelle regole del box, come il livello più
alto:**

- una regola con un `nomeGruppo` nuovo **si aggiunge** — è il caso del Parmigiano;
- una regola con lo stesso `nomeGruppo` di una regola del box **la sostituisce**;
- i ridimensionamenti vanno **in testa**, perché il motore prende il primo che corrisponde
  all'etichetta;
- le segnalazioni dei conflitti si aggiungono; `sceltaSpazioFoto` ed `estensioniFoto`, se la
  sovrastruttura le dichiara, sostituiscono quelle del box.

Se il box non ha regole sue, ne nasce una voce, e **le regole generali continuano a valere** come
prima: il motore scende di livello quando la voce del box non ha la regola che cerca. Una
sovrastruttura senza condizioni vale per tutti i box del kit.

**Il motore non sa che le sovrastrutture esistono.** `CssFramework.applicaSovrastrutture` le fonde
nel DB nei quattro punti in cui le regole vengono lette (ridimensionamento e allineamento, con e
senza download), prima che il contesto venga memorizzato: le operazioni dopo il fix foto le
ereditano. Il DB del kit non viene mai modificato.

## 2. Due condizioni nuove

Si aggiungono a `elementiDaTrovare`, `touchCondition`, `kitCondition` e le altre, dentro
`checkCondition`. Come quelle a elenco, **basta che una voce sia vera**.

| condizione | forma | vera se |
|---|---|---|
| `refCondition` | `[{ campo, contiene }]` | il campo della ref contiene il testo, senza distinguere maiuscole e minuscole; a capo, `<br>` e spazi doppi valgono come uno spazio. Per i campi `Descrizioni.*` di un gruppo vale la descrizione del gruppo. **Senza ref** — il ritracciamento della griglia ne arriva senza — **è falsa** |
| `formaBoxCondition` | `[{ forme, rapporto }]` | il box ha una delle forme: `largo` se la larghezza è almeno `rapporto` volte l'altezza, `alto` il contrario, `standard` tutti gli altri casi. `rapporto` manca: 1.6 |

**La forma si misura sui bounds del passaggio in corso**: la cella della griglia all'impaginazione,
le misure attuali del box al fix. Così, se l'operatore ridimensiona il box e preme il fix della
scheda, la forma viene ricalcolata.

## 3. La regola disattiva

Un elenco nuovo nelle regole di un box (e quindi anche di una sovrastruttura). Vale per **i loghi
automatici della ref**, le voci di `Foto.ExtraAuto`: gli unici elementi che il Plugin sa ricreare dal
dato.

```json
"disattiva": [{ "nomeGruppo": "testoVerticale", "elementi": ["*parmigiano_testo_2mod_verticale*"],
                "listSetCondizioni": [{ "setCondizioni": [{ "formaBoxCondition": [{ "forme": ["largo", "standard"] }] }] }] }]
```

- **Condizioni vere: il logo è disattivato e non sta nel box.** Non si piazza, o si toglie.
- **Lo nominano solo regole con le condizioni false: è attivato**, e se manca si rimette.
- Un logo che nessuna regola nomina resta com'è.
- **Un logo escluso dall'operatore** (`escluso`, dal pannello delle foto extra della scheda) **non si
  rimette mai**: la sua scelta vince.
- Non si salva sul server: si ricalcola dalla forma del box ogni volta.

**Perché non nasconderlo.** La prima soluzione nascondeva gli elementi (`visible = false`): ma un
elemento invisibile resta nel gruppo e ne allarga l'ingombro, così il box selezionato sembrava più
grande di quello che era; e tenerlo fuori dalla mappa delle regole interrompeva il ridimensionamento
del fix. Un logo disattivato invece nel box non c'è proprio.

**Quando si applica.**

- **All'impaginazione**, in `impaginaBox`: prima di piazzare i loghi automatici,
  `CssFramework.disattivatiDallaForma(box, ref, bounds)` dice quali la forma della cella della griglia
  tiene fuori, e quelli non si piazzano. Un box che nasce alto o largo ha subito il suo formato.
- **Al fix**, in `applicaRidimensionamentoCss`, **subito dopo `applicaRidimensionamento`** e prima
  della mappa che usano post ridimensionamenti, allineamenti e fix foto (nei due rami, con e senza
  download): `CssFramework.applicaDisattivazioni(box, ref, bounds)` toglie i loghi che con le misure
  nuove non servono e rimette quelli che servono. Per aggiungere un elemento a un gruppo lo si
  scioglie e lo si rifà, come quando l'operatore include una foto extra dalla scheda: il box che
  torna è un gruppo nuovo, arriva a `callAllOperationFixBox` nel risultato, e da lì in poi si lavora
  su quello.
- **Perché dopo il ridimensionamento.** La scala si calcola dall'ingombro degli elementi visibili:
  un logo tolto o rimesso prima, alla sua misura nativa, ne cambierebbe la geometria di partenza, e
  la base e i campi scalerebbero male (in collaudo: base fuori posto allargando, campi sovrapposti
  restringendo). Così il ridimensionamento lavora sugli elementi com'erano, e i loghi entrano dopo,
  alla misura di impaginazione, come all'impaginazione. Il ridimensionamento dell'impaginazione
  (modalità 1, prima che i loghi siano piazzati) esce prima e non la applica.
- I loghi si piazzano con `FotoPlacer.piazzaFotoExtraAuto`, la stessa strada nei due momenti: un
  `.idms` una volta sola in alto a sinistra della prima pagina e poi copiato nel box, un'immagine in
  un riquadro grande quanto il box con il fit del cliente.
- Le regole si leggono dalla copia locale (`allineamenti.json`) con il kit della lavorazione
  (`kitDelleRegole`), e si cercano nelle quattro voci del motore: la più specifica sostituisce
  l'omonima.

**Il Report Integrità** non segnala come mancante un logo disattivato per la forma:
`confrontoBoxCompiledFieldPreAnalisi` riceve la ref e chiede anche lui `disattivatiDallaForma`.

**`fixOverflowFromBox` salta gli elementi invisibili** in tutti e due i suoi giri: un elemento che non
si vede, per esempio in noRender, non va costretto nel box, non si segnala con CSF-009 e non si
rimpicciolisce.

## 4. La distanza in percentuale dei followAnchor

`FollowOnX` e `FollowOnY` hanno `distancePercentuale`: si somma a `distance` (mm) una percentuale
della dimensione del gruppo seguito sull'asse dell'ancora — la larghezza per x, l'altezza per y.
«Il bollo a un quarto dell'altezza della foto» è un `yAnchor` che segue `immagine*` con
`distancePercentuale: 25`. Lo calcola `CssFramework.distanzaDellAncora`.

---

## Funzioni del modulo

- `formaDelBox(bounds, rapporto)` → `largo`, `alto` o `standard`. Bounds mancanti: `standard`.
- `valoreCampoRef(itemRef, campo)` → il valore di un campo, con la descrizione del gruppo.
- `refConditionVera(itemRef, refConditions)`, `formaBoxConditionVera(bounds, formaConditions)`.
- `fondiNelDB(DB, nomeBox, operazioniAttive)` → il DB con le sovrastrutture fuse; `fondiOperazioni`
  e `voceVuota` sono i suoi passi.
- `regoleDisattiva(voci)` → le regole disattiva di un box, con la precedenza.
- `esitoDisattiva(vociFotoExtraAuto, valutate)` → `{ disattivati, attivati }`, due insiemi di sigle.
- `labelFotoExtraAuto(voce)` → la label con cui il logo sta nel box, `foto_extra$<sigla>$tipo_<tipo>`.

**Il modello C#** sta in `Istanta/Models/ExternalSourceClass.cs` (`SovrastrutturaObj`,
`DisattivaObj`, `RefCondition`, `FormaBoxCondition`, `distancePercentuale`): il JSON delle regole
passa dalle classi sia quando il Plugin lo scarica sia quando lo si salva dall'editor, e una
proprietà non dichiarata sparirebbe.

**Test:** `tests/plugin/sovrastrutture.test.js` — il modulo, e i membri nuovi di `CssFramework.js`
estratti dal sorgente ed eseguiti su un box finto — e
`tests/Istanta.Suite.Tests/SovrastruttureFrameworkCssTests.cs` per il modello.

## Il primo uso: il formato Parmigiano Reggiano di Edro21

Nel `SourceFrameworkCss.json` di Edro21, nei due kit volantino (SC e SS/CN/CY), c'è la
sovrastruttura «Parmigiano Reggiano». Si attiva sulla descrizione1, come la regola del server
(`FormatoParmigianoEdro21`, vedi [05-agenzialib.md](../../05-agenzialib.md)), che alla ref ha già
dato tutti i loghi del formato.

| forma | nel box | la regola disattiva tiene fuori |
|---|---|---|
| standard | payoff | caratteristiche, testo verticale, testo orizzontale |
| alta | caratteristiche, testo verticale, payoff | testo orizzontale |
| larga | caratteristiche, testo orizzontale, payoff | testo verticale |

- **`Parmigiano_SX_BOTTOM`**: il testo (verticale o orizzontale) in basso a sinistra fuori dalla
  traccia, il payoff sopra di lui; nel box standard il payoff da solo.
  L'ancora sull'x vale **per livello** (`applyToSingleLevels`, come in `Loghi_SX`): altrimenti il
  gruppo si sposta del minimo fra i livelli, quello del testo gia' vicino al bordo, e il payoff resta
  dov'era in orizzontale. Sull'y si muovono insieme e restano impilati.
- **`Parmigiano_BolloMesi`**: il bollo dei mesi, in `dopoFixFoto`, segue la foto (`immagine*`) a un
  quarto della sua altezza dalla cima (`distancePercentuale: 25`), a filo del bordo destro. Le
  misure sono da tarare in collaudo.
- **Le caratteristiche** non stanno nella sovrastruttura: sono il livello 6 di ogni `Loghi_DX` dei
  kit volantino, sotto DOP e IGP, nelle due varianti (con e senza Conad) delle regole generali, di
  BOX7 e di BOX12. Il logo esiste solo nelle ref Parmigiano, quindi per le altre non cambia niente.
- **`Parmigiano_fondo`**, l'unico ridimensionamento: payoff e testi hanno lo spostamento lineare in
  verticale (`y: 2`) e niente in orizzontale, cosi' seguono il fondo del box senza cambiare misura.
  Senza, come gli altri loghi di Edro21, restavano alla distanza dall'alto del box di partenza: gli
  altri stanno tutti in alto, loro in basso. Restringendo un box alto il payoff finiva sotto il fondo
  nuovo, gli allineamenti ancorati in basso si appoggiavano li' e i campi si ammassavano; da alto a
  largo usciva dal tavolo di montaggio e `followStaticAnchor` si fermava con un errore di InDesign.
- Nessun post ridimensionamento: i loghi restano alla misura di impaginazione, come gli altri di
  Edro21.
- Lo stile della base (`base_P_Parmigiano`, `base_A_Parmigiano` per SC) lo applica il custom di
  Edro21, con lo stesso criterio (`refConditionVera` di questo modulo). Payoff e testi sono fra le
  eccezioni del fix foto (`exceptionElementsToIgnoreFixFoto`): la foto non ci finisce sopra.
- Il fix foto di Edro21 prova a spostare la descrizione in basso, a sinistra dei prezzi. Con
  `descrizioneTraLoghi` **non la sposta se il suo testo** (`getRealBounds`, non il riquadro) **tocca
  un logo visibile** fra quelli che fanno da ostacolo alla foto: il payoff, i testi, SDB, BDP, Conad.
  Prima finiva addosso al payoff.

**Test:** `tests/plugin/parmigianoEdro21.test.js`.

## Limiti noti

- **Gli export non sanno cosa si vede.** Un elemento nascosto dal noRender dell'operatore passa lo
  stesso, e verso Fidelity passa anche un logo disattivato per la forma, perché il record della ref
  li elenca tutti. È il comportamento di prima, non introdotto qui; per
  decisione dell'operatore va trattato in un task a parte (commento su I20-1026).
  - **Verso Fidelity** (`FicoProcess/esportaMateriale`): il Plugin manda per ogni box il record della
    ref da `listaKit`, con la sola geometria; Istanta ne ricava foto, `fotoExtra`, campi compilati e
    dati. I loghi automatici passano con `attiva = true`, le secondarie in noRender restano fra le
    foto, i campi nascosti passano con il loro contenuto.
  - **Verso Correggo** (`processCorreggoExport`): il Plugin legge dal documento contenuto e bounds
    degli elementi indicati dalle istruzioni, senza guardare se sono visibili.
- La forma è quella del box come gruppo: un elemento che sporge molto ne allarga i bounds.
