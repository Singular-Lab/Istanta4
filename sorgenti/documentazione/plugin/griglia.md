# griglia.js

**Cosa è:** la griglia è **la mappa dell'impaginato**.

Un documento InDesign in cui ogni box del volantino è un riquadro con dentro il codice della
referenza che ci andrà. Serve all'operatore per vedere cosa va dove **prima** di impaginare, e per
intervenire: escludere una referenza, includerne un'altra, scambiare due box di posto.

Trentasei membri, 2.678 righe.

## Dove sta la memoria

**Questo file non ricorda quasi niente fra una chiamata e l'altra.** Ha due sole variabili, e sono
entrambe del solo scambio:

| nome | cos'è |
|---|---|
| `terminatoSwap` | lo scambio è andato a termine |
| `annullatoSwap` | l'operatore l'ha annullato |

Esistono perché lo scambio passa da un dialogo, e chi lo ha avviato deve sapere com'è finito.

La memoria vera sta **nel documento**, nelle label dei riquadri, nel formato
`codice_associato$CODICE$IDREC`. È la differenza con [CssFramework](cssFramework/README.md), che
invece porta con sé un contesto in memoria.

## I sei mestieri

### 1. Compilare e mappare
- `compilaGriglia(griglia, mappaGriglia)` → riempie i riquadri. `GRD-01` se la griglia non è valida.
- `mappaturaGriglia(griglia)` → legge cosa c'è dentro.

### 2. Il conteggio
- `ricalcaConteggio(griglia)` → ridistribuisce le referenze sui box. **Due modalità**, scelte dalla
  spunta `#toggleMode`: **sequenziale** riempie in ordine, **magnetica** mette ogni referenza nel box
  più vicino a dove stava. `GRD-11` se la griglia non è valida.
- `ricalca(griglia)`, `svuotaConteggio(griglia)`.
- `calcolaDistanza(punto1, punto2)` → serve alla modalità magnetica.
- `parseListaConteggio(lista)` → legge la lista serializzata, tollerando che sia già un array.
  `GRD-39` se il JSON non si legge: in quel caso la lista è vuota, non si solleva.
- `trovaRecordInTracciatoDaListaConteggio(...)`.

### 3. Leggere e scrivere un box

Una dozzina di funzioni corte che nascondono il fatto che l'informazione sta nelle label:

- `getCodiceAssociato`, `getCodiceAssociatoConId`, `setCodiceAssociato`, `resetCodiceAssociato`.
- `parseCodiceAssociato(raw)` → **decide il significato di una label**, e regge due formati: quello
  attuale a tre parti e quello storico a due.
- `setInfo`, `setContent`, `setOpacityGriglia`.
- `getVisibilityLabelsBox`, `setVisibilityLabelsBox`.
- `getChildBoxByLabel`, `getBoxByNumber`, `getBoxListByRiga`, `getCodiceFiltroKey`.

### 4. Includere ed escludere
- `escludiElemento(...)` → toglie una referenza: il suo box resta, ma vuoto.
- `includiElemento(codiceFiltro, box)`, `rimuoviDaEsclusi(...)`.
- `modalSelezioneElementoIncludiEscludi(...)` → il dialogo con cui l'operatore sceglie. **382
  righe.**
- `confermatoIncludiEscludi(codiceEscluso, codiceIncluso)`.

### 5. Scambiare
- `swap(gruppo, mappaGriglia, griglia, pageName)` → mostra da quale box si parte e su quale si va.
- `setVariabiliSwap(terminato, annullato)`.

### 6. Navigare e ispezionare
- `scorri(avanti, griglia, i, mappaGriglia)` → muove la selezione fra i box.
- `creaPulsanteInfoIspezioneDato(...)`, `creaPulsanteInfoIspezioneDatoDaGruppo(...)`,
  `trovaRecordInTracciatoDaGruppo(...)`, `mostraElementiAvanzati(pagName)`.

## Ricollocazione

**Accolta:** `calcolaDistanza(punto1, punto2)` → `utility.js`. Sei righe di geometria pura, senza
niente di specifico della griglia.

**Due proposte valutate e scartate**, scritte qui perché non tornino senza sapere cosa si è già
deciso — e con quello che si perde, non solo con l'esito.

| proposta | esito | cosa resta così |
|---|---|---|
| un modulo per `parseCodiceAssociato`, `parseListaConteggio` e `getCodiceFiltroKey` | scartata: non si vuole un file nuovo | `parseCodiceAssociato` **resta non verificabile**, e decide il significato di una label sapendo di due formati diversi |
| una casa comune per le finestre modali, e con essa `modalSelezioneElementoIncludiEscludi` | scartata | `griglia.js` **resta con 382 righe di dialogo dentro** |

## Nessun membro morto

Verificati tutti e trentasei: ognuno ha almeno un chiamante.
