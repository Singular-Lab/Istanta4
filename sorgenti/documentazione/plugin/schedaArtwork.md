# schedaArtwork.js

**Cosa è:** la scheda dell'artwork, cioè di un gruppo di referenze trattate come un'unica immagine.

Fa tre cose: **mostrare** un artwork esistente o uno potenziale nato dalle referenze selezionate,
**raggruppare** le referenze sotto un artwork, ed **esportarne** la foto.

## Variabili

| nome | cos'è |
|---|---|
| `existingArtwork` | l'artwork già formato, quando è quello a essere selezionato |
| `potentialArtwork` | l'artwork che potrebbe nascere dalle referenze selezionate |
| `codici`, `idRecs`, `refs` | le referenze in gioco |
| `schedeRefDati` | i dati delle schede, chiesti al server |
| `job` | le operazioni in corso |

**È stato di schermata, non di dominio:** vive quanto la scheda aperta, ed è normale che si azzeri
quando si cambia.

## Funzioni

- `showSchermataArtworkMultiRef(refs, artwork)` → l'ingresso quando l'operatore ha selezionato più
  referenze che potrebbero diventare un artwork.
- `showSchermataArtworkEsistente(artworkEl)` → l'ingresso quando l'artwork esiste già ed è stato
  selezionato nel documento.
- `bindDati(indice)` → riempie la schermata coi dati della referenza all'indice dato.
- `getSchedaRef(codiceGruppo, callback, idRec)` → chiede al server i dati di una referenza.
- `raggruppaSottoArtwork()` → l'operazione vera: mette le referenze selezionate sotto un artwork.
- `etichettaturaRef(azione)` → le etichette delle referenze raggruppate.
- `esportaFotoArtwork(idArtwork, cbk)` → l'esportazione della foto.
- `getIdRecByCodice(codice)`.

## Chi lo chiama

`indexNew.js`, sugli eventi `EVENT_NEW_ARTWORK_SELECTED` e
`EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED` emessi da [events.js](events.md).
