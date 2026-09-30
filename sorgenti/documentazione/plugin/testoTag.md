# testoTag.js

**Cosa è:** l'oggetto `TestoTag`, nove membri: il testo dei campi con i suoi stili. Uscito da
`utility.js` in I20-1012. È un file solo, e perciò non ha una cartella.

**I tag sono i nomi degli stili di carattere scritti nel testo**, `<StileA>ciao</StileA>`. Devono
chiamarsi esattamente come gli stili di InDesign.

`indexNew.js` lo dichiara come globale; lo usano `indexNew.js`, la scheda, `InputEditController`,
`confronti`, `ficoProcess`, `griglia` e `utility.js`.

## Funzioni

**Il testo con i tag**

- `parseContent(content)` → scompone il testo in `[{ stile, content }]`. Senza un tag in testa è un
  pezzo solo, senza stile; un tag non chiuso ferma la lettura e lascia un pezzo che lo dice. **È
  pura**, e il test la chiama.
- `componiStringTagFromInndTextFrame(tf)` → legge un campo e ne scrive il testo coi tag, un tag a
  ogni cambio di stile di carattere.
- `applicaTagStringToInndTextFrame(tf, taggedString, boxBounds)` → il contrario: scrive il testo
  nel campo e applica a ogni pezzo il suo stile.

**Gli stili**

- `parseStile(stile, paragraph)` → lo stile di paragrafo o di carattere del documento: `"Nome"` in
  radice, `"Gruppo.Nome"` dentro il gruppo. `null` se non c'è.
- `parseObjStile(stile)` → lo stesso per gli stili oggetto.
- `applyNeastedStyles(ctrl, paragraph)` → applica al campo, carattere per carattere, gli stili
  annidati dello stile di paragrafo.
- `trattiDiStileDelCampo(item)` → i tratti di stile di un campo, letti in un colpo solo (I20-995).
  Il calcolo sta in [trattiDescrizione.js](trattiDescrizione.md), che è puro.

**Il resto**

- `trimDescrizione(val)` → una descrizione ridotta per il confronto: **senza a capo e senza spazi,
  nemmeno in mezzo**. Non è un trim: «Pasta di semola» diventa «Pastadisemola». È pura.
- `getDefaultOverflowDirection(tf)` → da che parte può crescere un campo quando il testo non ci sta:
  la descrizione in verticale, ogni altro campo in orizzontale. Da non confondere con il membro
  omonimo di `pluginMiddleware`, che è un'altra cosa.

## Si carica sotto Node, anche se parla con InDesign

Delle costanti di InDesign servono solo `FitOptions` e `NestedStyleDelimiters`, e si chiedono con
`indesign()` **dentro le due funzioni che le usano**, non in testa al file. Così il file si carica
sotto Node e le funzioni pure si provano chiamandole (`divisioneUtility.test.js`): `parseContent`,
`trimDescrizione`, e `parseStile`/`parseObjStile` con un documento finto. Le altre si provano in collaudo.

**Usa `Utility` come globale**, per `parseLabel` e `replaceAllSpecialCharacters`: `utility.js`
importa questo file, e un `require` al contrario creerebbe un ciclo.

## Due difetti corretti in I20-1012

- **`parseContent` scriveva nel log una riga per ogni carattere del testo**, su ogni campo
  impaginato. Tolta; un test controlla che non scriva niente.
- **`parseStile` e `parseObjStile` scrivevano una variabile globale**, `stileSplitted`, senza
  dichiararla. Ora è locale; nessun altro file la leggeva, e un test controlla che non ricompaia.

Restano i messaggi di `applyNeastedStyles`, uno per ogni stile annidato: sono pochi, e non erano nel
perimetro.
