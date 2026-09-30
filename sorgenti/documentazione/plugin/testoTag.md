# testoTag.js

**Cosa è:** l'oggetto `TestoTag`, tredici membri: il testo dei campi con i suoi stili. Uscito da
`utility.js` in I20-1012; in I20-1007 ha assorbito `trattiDescrizione.js`. È un file solo, e
perciò non ha una cartella.

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
- `trattiDiStileDelCampo(item)` → i tratti di stile di un campo, letti in un colpo solo (I20-995):
  vedi [I tratti di stile](#i-tratti-di-stile) qui sotto.

**Il resto**

- `trimDescrizione(val)` → una descrizione ridotta per il confronto: **senza a capo e senza spazi,
  nemmeno in mezzo**. Non è un trim: «Pasta di semola» diventa «Pastadisemola». È pura.
- `getDefaultOverflowDirection(tf)` → da che parte può crescere un campo quando il testo non ci sta:
  la descrizione in verticale, ogni altro campo in orizzontale. Da non confondere con il membro
  omonimo di `pluginMiddleware`, che è un'altra cosa.

## I tratti di stile

Nascono con I20-995. La schermata di edit leggeva il campo descrizione **un carattere alla volta**, e
per ogni carattere chiedeva a InDesign l'oggetto, il suo stile, il nome dello stile e il gruppo: su
una descrizione di duecento caratteri erano migliaia di passaggi verso InDesign, ed è lì che se ne
andavano i secondi di attesa fra primarie/secondarie ed edit.

InDesign sa già dire dove cambia lo stile — `textStyleRanges` restituisce i tratti omogenei, che
sono pochi. `trattiDiStileDelCampo` li legge; da lì in poi il lavoro è su stringhe, e lo fanno
quattro funzioni pure. Fino a I20-1007 stavano in `trattiDescrizione.js`, nato a parte perché
`schedaRef.js` e `utility.js` non si caricavano sotto Node; ora che `testoTag.js` si carica, il
file a parte non serviva più. **Non cambiano il risultato:** il testo delle textarea si compone
carattere per carattere esattamente come prima, comprese le asimmetrie del codice vecchio.

- `nomeCompletoStile(nomeStile, nomeGruppo)` → `"gruppo.nome"` se lo stile sta dentro un gruppo,
  altrimenti il nome e basta.
- `accorpa(tratti)` → unisce i tratti consecutivi che portano lo stesso stile. InDesign spezza i
  tratti anche dove cambia solo un attributo locale — un corpo, un colore — mentre la scheda
  ragiona per nome di stile: **senza questo passaggio lo stesso stile aprirebbe due textarea**.
- `stiliInOrdine(tratti)` → gli stili nell'ordine in cui compaiono; uno stile ripetuto più avanti
  compare di nuovo. È la lista con cui si riconosce lo schema della descrizione.
- `testiDelTratto(contenuto, normalizzaCarattere)` → i due testi di un tratto: quello che si vede
  nella textarea e quello che serve a confrontare il tratto con il contenuto del server. Si
  differenziano sull'a capo, che nella textarea è `\n` e nel confronto resta `\r`, e la differenza
  vale **dal secondo carattere in poi** — sul primo il codice vecchio non guardava l'a capo, e
  cambiarlo adesso vorrebbe dire cambiare di nascosto il contenuto di un campo. La normalizzazione
  passa carattere per carattere perché applicarla al tratto intero riconoscerebbe sequenze lunghe
  (`<br>`, `\r\n`) che carattere per carattere non si vedono mai.

La scheda le chiama `TestoTag.stiliInOrdine` e `TestoTag.testiDelTratto`, e **importa
`testoTag.js`** invece di usare la globale di `indexNew.js`: la scheda si carica sotto Node, e lì
la globale non c'è. **Test:** `trattiDescrizione.test.js`, che ha cambiato solo il `require`.

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
