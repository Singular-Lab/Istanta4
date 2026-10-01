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
  "operazioni": { "allineamenti": [ ... ], "nascondi": [ ... ] }
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

## 3. La regola nascondi

Un elenco nuovo nelle regole di un box (e quindi anche di una sovrastruttura):

```json
"nascondi": [{ "nomeGruppo": "testoVerticale", "elementi": ["*parmigiano_testo_2mod_verticale*"],
               "listSetCondizioni": [{ "setCondizioni": [{ "formaBoxCondition": [{ "forme": ["largo", "standard"] }] }] }] }]
```

- **Condizioni vere: gli elementi si nascondono. Condizioni false: si mostrano.**
- Un elemento che nessuna regola nomina resta com'è.
- **Un elemento che l'operatore ha messo in noRender non si mostra mai**: la sua scelta vince.
- Nascondere è `visible = false`, come il [noRender](../noRenderElementi.md): niente si cancella, e
  quando il box cambia forma l'elemento torna.
- **Per le regole, un elemento nascosto non c'è**: resta fuori dalla mappa del box, quindi nessun
  allineamento si appoggia a un logo che non si vede.

Si applica in `applicaRidimensionamentoCss`, prima che si faccia la mappa. Le regole si cercano
nelle quattro voci del motore, e quella più specifica sostituisce l'omonima.

**Il modal noRender della scheda** rimostra ogni elemento che l'operatore non ha marcato: subito
dopo, `CssFramework.riapplicaNascondi` ripete la sola regola nascondi con la scelta appena salvata.

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
- `regoleNascondi(voci)` → le regole nascondi di un box, con la precedenza.
- `esitoNascondi(condizioni, nascostoDallOperatore)` → `nascondi`, `mostra` o `null`.

**Il modello C#** sta in `Istanta/Models/ExternalSourceClass.cs` (`SovrastrutturaObj`,
`NascondiObj`, `RefCondition`, `FormaBoxCondition`, `distancePercentuale`): il JSON delle regole
passa dalle classi sia quando il Plugin lo scarica sia quando lo si salva dall'editor, e una
proprietà non dichiarata sparirebbe.

**Test:** `tests/plugin/sovrastrutture.test.js` — il modulo, e i membri nuovi di `CssFramework.js`
estratti dal sorgente ed eseguiti su un box finto — e
`tests/Istanta.Suite.Tests/SovrastruttureFrameworkCssTests.cs` per il modello.

## Limiti noti

- **L'export verso Fidelity** segna `attiva = true` tutti i loghi automatici: un logo nascosto dalla
  regola nascondi, come uno nascosto dall'operatore, risulta attivo nei metadati. È il comportamento
  di prima, non introdotto qui.
- La forma è quella del box come gruppo: un elemento che sporge molto ne allarga i bounds.
