# noRenderElementi.js

**Cosa è:** la logica dell'opzione noRender, con cui l'operatore rende invisibili singoli elementi
di un box. Nasce con I20-968.

Non tocca InDesign: ragiona solo su label, meta e liste. I consumatori sono `schedaRef`,
`confronti` e `indexNew`.

## Come si identifica un elemento

Un elemento del box è identificato da **tipo + chiave logica**: la sigla per loghi e foto extra, il
nome del campo per campi ed etichette, il codice referenza per le foto.

**La label InDesign non serve da identificativo:** incorpora il codice della ref e viene ricostruita
a ogni impaginazione.

## Il noRender dell'operatore e la regola disattiva del framework

Dal I20-1026 un logo automatico può mancare dal box per due ragioni diverse, e non vanno confuse:

- **l'operatore lo ha nascosto**, con questo modulo: resta nel box con `visible = false`, e la scelta
  si salva sul server, nel meta della lavorazione;
- **il framework CSS lo ha disattivato**, con la regola `disattiva` (vedi
  [sovrastrutture](cssFramework/sovrastrutture.md)): non sta nel box, non si salva, e torna quando il
  box cambia forma.

Il Report Integrità segnala solo gli elementi marcati dall'operatore, e non conta come mancante un
logo disattivato per la forma.

## Variabili globali

| nome | valore | cos'è |
|---|---|---|
| `TIPO` | `{campo:1, logo:2, fotoExtra:3, etichetta:4, foto:5, altro:99}` | il tipo di un elemento del box |
| `TIPO_FOTO` | `TIPO.foto`, cioè `5` | le foto primarie e secondarie, che stanno nella stessa struttura degli altri elementi |
| `TIPO_FOTO_LOGO` | `3` | **non è un `TIPO`**: è il `tipo_N` scritto nella label, e rimanda a `TipoFoto` di IstantaLib |

**Due contratti con il server, scritti in due posti:**

1. `TIPO` deve restare allineato a `TipoElementoBox` di `Istanta.Models`;
2. `TIPO_FOTO_LOGO` deve restare allineato a `TipoFoto` di `IstantaLib`.

Sono il genere di cosa che si disallinea in silenzio.

**Attenzione al valore `3`, che compare due volte con significati diversi:** è `TIPO.fotoExtra`
nella prima scala ed è `TIPO_FOTO_LOGO` nella seconda. Non è un errore — sono due scale diverse, una
nostra e una di IstantaLib — ma in `classificaLabel` le due compaiono nella stessa riga, ed è
esattamente il tipo di coincidenza che fa sbagliare chi legge di fretta.

## Funzioni

### Riconoscere un elemento

- `classificaLabel(label, nomeFotoPrimaria, nomeFotoSecondaria)` → tipo e chiave logica dalla label.
- `descriviElemento(elemento)` → il nome mostrato nel modal: per i loghi nome e sigla, per le
  immagini il nome della foto.
- `stessoElemento(a, b)` → si confronta tipo più chiave logica, **mai la label**.
- `inNoRender(elementiMarcati, tipo, chiave)` → la domanda che fa l'impaginazione, una volta per
  ogni elemento del box.

### Costruire la lista del modal

- `componiLista(elementiVivi, elementiMarcati)` → agli elementi presenti nel box unisce **quelli
  marcati nei meta che dal documento sono spariti**: senza questa unione un elemento cancellato dai
  livelli non sarebbe più togglabile dal Plugin.
- `conNascostiInCima(lista)` → porta in cima i nascosti conservando l'ordine relativo. **Si usa solo
  quando la lista si costruisce**, cioè all'apertura: durante l'uso una riga appena nascosta deve
  restare dov'è, non saltare via da sotto il cursore. La partizione è esplicita per non dipendere
  dalla stabilità di `sort`.
- `datiRiga(elemento, indirizzoBase)` → descrizione e i due indirizzi della miniatura, piccola per
  la riga e grande per l'ingrandimento. Stanno qui e non nel disegno della lista **perché ogni riga
  deve portarsi i propri**: un indirizzo condiviso fra le righe mostrava sempre l'ultima immagine.
- `urlMiniatura(elemento, indirizzoBase, larghezza)` → immagini e loghi hanno un guid in archivio,
  campi ed etichette no. L'indirizzo di base è quello di Olimpo.
- `datiExtraDiSigla(sigla, fotoExtra, fotoExtraAuto)` → gli extra del box stanno in **due**
  collezioni del record, `Foto.Extra` gestita dall'operatore e `Foto.ExtraAuto` piazzata
  dall'automatismo del cliente. Vanno cercate entrambe, altrimenti gli extra automatici restano
  senza nome e senza guid, quindi senza miniatura.
- `riepilogo(lista)` → quanti elementi del box sono nascosti.

### Salvare

- `elementiDaSalvare(lista)` → **solo** gli elementi effettivamente in noRender, foto comprese,
  senza flag né stato di presenza. Se non ce n'è nessuno l'elenco è vuoto, e il server in quel caso
  toglie del tutto la chiave dai meta.

### Segnalazioni

- `elencoPerSegnalazioni(elementiNoRender, membriGruppoFoto)` → agli elementi del box unisce le foto
  in noRender, indicizzate **per nome file**, perché è così che compaiono nei report di confronto.
- `daSegnalareComeMancante(...)` → un elemento assente **non è un difetto** se l'operatore lo ha
  messo in noRender e poi cancellato dai livelli: quella mancanza è voluta e non va segnalata.
- `daSegnalareComeRiattivato(...)` → il caso opposto, dove la segnalazione serve: l'elemento è in
  noRender ma nel documento qualcuno lo ha rimesso visibile, e il documento non rispetta più la
  scelta.
- `segnalazioneElementoRiattivato(descrizione)` → il testo della segnalazione.

### Dopo il salvataggio

- `statoDelleFoto(lista)` → lo stato delle sole foto, per chiave: serve a confrontare com'era il box
  all'apertura del modal con com'è dopo il salvataggio.
- `fotoAncoraVisibili(lista)`, `fotoCambiate(prima, dopo)` → le foto sparite dal box non contano: se
  non c'è più, non c'è niente da reimpaginare.
- `proporreFixFoto(...)` → I20-978: il fix foto si propone **solo quando serve davvero**, cioè
  quando una foto ha cambiato stato e nel box ne resta almeno una da mostrare. Se sono cambiati solo
  loghi o campi il fix foto non c'entra.

**Test:** `node --test tests/plugin/norender-elementi.test.js`
