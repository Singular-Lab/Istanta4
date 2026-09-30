# CssFramework.js — il motore che sistema il contenuto di un box

**Cosa è:** ridimensiona, sposta, allinea, ancora un elemento a un altro, risolve le
sovrapposizioni e segnala quello che non si è potuto risolvere. È uno dei file più grandi del
Plugin — **7.283 righe, 69 membri** — ed è il cuore del motore CSS che **tocca davvero InDesign**.

**Le foto non le sistema più lui.** Trovare dove c'è posto nel box e farci stare le foto è uscito in
[sistemazioneFoto/](../sistemazioneFoto/README.md) con I20-1009. Qui restano tre rimandi —
`getSpazioImpaginazione`, `fixFoto`, `safeFitToContent` — perché le agenzie li chiamano da qui e
`getRealBounds` usa l'ultimo. Il codice nuovo del core chiama `SistemazioneFoto`.

Attorno a lui girano quattro moduli che non toccano InDesign:
[cssComposizioneBox](composizioneBox.md), [cssSequenzaOperazioni](sequenzaOperazioni.md),
[cssRegoleConflitti](regoleConflitti.md) e [noRenderElementi](../noRenderElementi.md). Sono
stati estratti uno alla volta, e dal I20-1007 i primi tre stanno in questa cartella anche nel
codice, `plugin/cssFramework/`, mentre `CssFramework.js` resta in radice perché le agenzie lo
richiedono da lì. La divisione è sempre la stessa: **loro calcolano il piano,
`CssFramework` lo esegue sul documento.** È il motivo per cui quei quattro hanno dei test e questo
no.

**Le regole non stanno nel codice.** Arrivano dal `SourceFrameworkCss.json` del cliente, scaricate
da `FrameworkCssController/scaricaAllineamenti`. Il codice qui è l'interprete, non la regola.

---

## Come si legge questo file

Non dall'inizio alla fine. I membri stanno in ordine sparso, e il modo utile di guardarli è per
gruppi:

| gruppo | righe, al I20-1009 | pagina |
|---|---|---|
| i tre rimandi a `SistemazioneFoto` | 11–28 | [sistemazioneFoto/](../sistemazioneFoto/README.md) |
| infrastruttura, contesto, mappa del box, enum | 29–332, 7184–7283 | [01-infrastruttura-e-mappa.md](01-infrastruttura-e-mappa.md) |
| ridimensionamento, overflow, collisioni, reflow | 333–2328, 4716–7183 | [04-ridimensionamento-e-overflow.md](04-ridimensionamento-e-overflow.md) |
| allineamenti, ancoraggi, condizioni, conflitti, composizione | 2329–4715 | [05-allineamenti-e-conflitti.md](05-allineamenti-e-conflitti.md) |

Le pagine 02 e 03 — lo spazio di impaginazione e la sistemazione delle foto — sono diventate
[sistemazioneFoto/01-spazio-libero.md](../sistemazioneFoto/01-spazio-libero.md) e
[sistemazioneFoto/02-sistemazione-foto.md](../sistemazioneFoto/02-sistemazione-foto.md). La
numerazione di queste è rimasta com'era, per non rompere i riferimenti da altre pagine.

---

## Lo stato del modulo

Su 69 membri **solo 6 sono dati**: il resto sono funzioni. `CssFramework` è un oggetto solo
— un singleton — e quei 6 membri sono **stato mutabile condiviso da tutte le sue funzioni**.

| gruppo | membri | dove si spiegano |
|---|---|---|
| infrastruttura e contesto | `semaforoDownloadFramework`, `contestoCss` | [01-infrastruttura-e-mappa.md](01-infrastruttura-e-mappa.md) |
| segnalazioni | `etichetteSegnalate`, `segnalazioniConflittiPendenti`, `sospendiControlloSegnalazioniConflitti` | 3f |

**La conseguenza che conta:** `CssFramework` lavora su **un box alla volta e non è rientrante**. Due
box in parallelo si sovrascriverebbero il contesto a vicenda. Chi un domani volesse parallelizzare
l'impaginazione deve partire da qui, non dalle funzioni.

## I quattro che sembrano globali e non lo sono

`DBallineamenti`, `DBDefault`, `mappaBoxOriginale` e `prefissiDerivati` compaiono nella firma di
decine di funzioni. **Non sono globali:** sono parametri, e viaggiano in parallelo al `contestoCss`
che contiene gli stessi valori. In alcune funzioni si usa il parametro, in altre il contesto, ed è
il genere di duplicazione che fa passare un'ora a chiedersi quale dei due comandi.

## Le globali esterne, nessuna importata

| globale | usi | a cosa serve |
|---|---|---|
| `Utility` | 120 | soprattutto `parseLabel` |
| `messaggioUtente` | 75 | tutte le segnalazioni all'operatore |
| `pathLavorazione` | 5 | la cartella di lavoro, per `allineamenti.json` |
| `readFile` | 4 | rilettura delle regole quando lo scaricamento fallisce |
| `fs`, `XMLHttpRequestClient`, `activateKeyForGarbage` | 1–2 | scrittura del file, chiamata al server, sblocco delle rimozioni differite |

Il file importa da `indesign`, dai tre moduli `css*` e da `sistemazioneFoto/sistemazioneFoto`, ma **queste sette arrivano dal contesto
globale del Plugin**. È il motivo per cui `CssFramework.js` non si carica sotto Node, e quindi il
motivo per cui esistono i cinque moduli puri.
