# sistemazioneFoto/sceltaSpazio.js

**Cosa è:** la scelta dello spazio in cui finiscono le foto del box. Fa parte del concetto
[sistemazione foto](README.md): lo usa `fixFoto`. Fino a I20-1009 si chiamava `cssSpazioFoto.js` e
stava in `plugin/`.

Il criterio storico è uno solo: fra gli spazi liberi vince quello che permette al gruppo di foto di
venire **più grande**. In box come il BOX41, però, le foto stanno dentro un disegno fisso — le
parentesi — e una foto spostata di lato per guadagnare pochi millimetri risulta vistosamente
scentrata: meglio qualche millimetro in meno e restare al centro.

I candidati arrivano in coordinate relative alla base del box: `x` e `y` sono l'angolo in alto a
sinistra, il centro della base è quindi `(larghezzaBase / 2, altezzaBase / 2)`.

## Dove il cliente specifica la taratura

**«Quanto in meno» è una taratura del cliente, non una decisione del codice.** Si scrive nel file di
configurazione CSS del cliente, sul singolo box:

```
Istanta/wwwroot/external_source/<Cliente>/SourceFrameworkCss.json
```

nella chiave `sceltaSpazioFoto`:

| campo | cosa fa |
|---|---|
| `modo` | `"areaMassima"` (predefinito, il criterio di sempre) oppure `"centrato"` |
| `tolleranzaArea` | quanta area si è disposti a perdere per stare più al centro, **come frazione dell'area migliore**: `0.7` accetta uno spazio che valga almeno il 70% del migliore |
| `asseCentratura` | su quale asse si misura: `"x"`, `"y"` o `"xy"` (predefinito) |

Il tipo lato server è `SceltaSpazioFotoObj` in `Istanta/Models/ExternalSourceClass.cs`. Il percorso
completo del valore:

1. l'operatore configura il box nel `SourceFrameworkCss.json` del cliente — file **per cliente**,
   montato da `monta-cliente.sh` come `ipconfig.json` e `custom.js`;
2. il Plugin scarica tutto con `CssFramework.getAllineamentiDB()`, che chiama
   `FrameworkCssController/scaricaAllineamenti` e ne salva una copia in `allineamenti.json` nella
   cartella di lavorazione;
3. `CssFramework.getSceltaSpazioFoto(box)` pesca `elementoBox.sceltaSpazioFoto` cercando il box per
   meccanica;
4. `normalizzaPreferenza` lo mette in sicurezza.

Se una foto è davvero molto più grande di lato, lo scarto viene superato e **vince di nuovo l'area**.

**Oggi lo usa Edro21 sul BOX41**, con `modo: "centrato"`, `tolleranzaArea: 0.7` e
`asseCentratura: "x"`: centrate in orizzontale, dove stanno le parentesi, mentre in verticale
continua a comandare l'area.

## Variabili globali

| nome | valore | cos'è |
|---|---|---|
| `areaMassima` | `"areaMassima"` | il criterio storico |
| `centrato` | `"centrato"` | si accetta qualche millimetro in meno per restare al centro |
| `tolleranzaPredefinita` | `0.7` | lo scarto accettato quando la regola del cliente non dice altro |

`tolleranzaPredefinita` **coincide con il default del modello lato server**,
`SceltaSpazioFotoObj.tolleranzaArea = 0.7`. Sono due valori scritti in due posti che devono restare
uguali: se cambia uno solo, un box senza configurazione esplicita si comporta diversamente a seconda
di chi risponde.

## Funzioni

- `normalizzaPreferenza(preferenza)` → la configurazione del cliente messa in sicurezza: modo
  sconosciuto vale `areaMassima`, e **una tolleranza sopra 1 torna a 1**, perché oltre quella soglia
  nessun candidato sarebbe ammesso e le foto non si muoverebbero più. Un refuso in configurazione
  fermerebbe il fixFoto in silenzio.
- `valutaCandidato(candidato, boundsGruppo)` → quanto verrebbe grande il gruppo dentro questo
  spazio. Il gruppo si ridimensiona in proporzione: **comanda il lato che si esaurisce per primo**.
  `null` se il candidato non può contenerlo.
- `distanzaDalCentro(candidato, larghezzaBase, altezzaBase, asse)` → quanto è scentrato. Si misura
  dal **centro** del candidato, non dal suo angolo: due spazi di larghezza diversa attorno allo
  stesso centro devono risultare ugualmente centrati.
- `parteCentrata(candidato, larghezzaBase, altezzaBase, asse)` → la porzione centrata di un
  candidato.
- `normalizzaEstensioni(estensioni)` e `restringiCandidati(candidati, estensioni)` → lo spazio da
  riservare attorno alle foto, che restringe i candidati prima della scelta.
- `scegli(candidati, boundsGruppo, preferenza, larghezzaBase, altezzaBase)` → la decisione finale.
- `descriviScelta(...)` e `fattoriDiNormalizzazione(...)`.

**Test:** `node --test tests/plugin/sceltaSpazio.test.js`
