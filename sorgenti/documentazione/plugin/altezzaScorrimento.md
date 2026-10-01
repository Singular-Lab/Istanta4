# altezzaScorrimento.js

*Nasce con I20-1030. Lo usa `onResizeTab1Tracciato` in `indexNew.js`, per la lista dei tracciati
della Home.*

**Cosa è:** l'altezza in pixel di un contenitore scorrevole, calcolata dallo spazio che resta
libero nel suo contenitore.

## Perché serve

In UXP la rotella del mouse fa scorrere un contenitore **solo se ha un'altezza vera**. Se l'altezza
la decide il flex, il contenitore cresce quanto il suo contenuto e non ha niente da scorrere; la
rotella va a lui, e UXP non la passa al contenitore esterno.

Nella Home succedeva esattamente questo. Le prove in console sul pannello, durante I20-1030:

| prova | esito |
|---|---|
| un ascoltatore `wheel` su `#Tab1Viewport`, poi sul `document` | nessun evento: la rotella non arriva al codice, quindi non la si può intercettare |
| `overflow: visible` sulle celle | non scorre: le celle non c'entrano |
| `overflow-y: scroll` sulla lista, `overflow: hidden` sul contenitore esterno | non scorre |
| `height: 250px` su `#Tab1Viewport` | **scorre** |
| l'altezza che il flex dà a `#Tab1Viewport` | **17263 px**: la lista era lunga quanto tutte le righe |

La barra che l'operatore trascinava era quella di `#contenitoreTab`, il contenitore esterno, a cui
`onresizeWindow` dà un'altezza in pixel.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `MARGINE` | `10` | lo spazio lasciato sotto la lista, perché non tocchi il fondo del pannello |
| `MINIMO` | `120` | se i filtri occupano quasi tutto il pannello la lista resta usabile; in quel caso scorre anche il contenitore esterno, come prima |

## Funzioni

- `altezzaDisponibile(contenitore, elemento, opzioni)` → lo spazio dall'inizio di `elemento` al
  fondo di `contenitore`, meno il margine e mai sotto il minimo. Tiene conto di quanto il
  contenitore è già scorso **senza spostarlo**. Restituisce `null` se uno dei due manca, se non è
  visibile (scheda nascosta: le misure sono zero) o se le misure non si leggono.
- `fissaAltezza(contenitore, elemento, opzioni)` → scrive quell'altezza in `elemento.style.height`.
  Con `null` non tocca niente.

## Dove si applica

`onResizeTab1Tracciato` la chiama **per prima cosa**, su `#contenitoreTab` e `#Tab1Viewport`, prima
delle sue uscite anticipate. Quella funzione gira dopo ogni ricostruzione della lista, a ogni
cambio dei criteri dei filtri e a ogni ridimensionamento del pannello (attraverso
`onresizeWindow`): l'altezza segue lo spazio libero, **non il numero di righe**. Con poche righe
sotto resta spazio vuoto; con tante la lista scorre, e l'intestazione resta ferma.

Lo scorrimento orizzontale della lista non è toccato da I20-1030.

**Test:** `node --test tests/plugin/altezzaScorrimento.test.js`
