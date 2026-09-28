# dataCaricamentoFoto.js

**Cosa è:** la data di caricamento mostrata sul badge delle foto nella schermata di cambio foto.
Nasce con I20-971.

Non tocca InDesign, così la formattazione è verificabile dal test runner di Node.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `ANNO_MINIMO_PLAUSIBILE` | `2000` | sotto questa soglia la data non è un caricamento reale ma un default lasciato in archivio: meglio nessun badge che un badge con scritto `01/01/0001` |

## Funzioni

- `formattaDataCaricamento(valore)` → `gg/mm/aaaa`. Torna stringa vuota quando la data manca o non
  è plausibile, e in quel caso il badge non viene disegnato affatto.
- `dataDaMostrare(foto)` → il caricamento è, per l'archivio, la data di inserimento della riga; se
  manca si ripiega sulla data di modifica, che è anche il criterio con cui l'elenco arriva
  ordinato.
- `istanteDiCaricamento(foto)` → il momento come numero confrontabile. Le foto senza data
  utilizzabile tornano `null` e vanno tenute in fondo: non si inventa loro una data.
- `ordinaDallaPiuNuova(lista)` → dalla più nuova alla più vecchia; quelle senza data finiscono in
  fondo nell'ordine in cui sono arrivate. A parità di data **si confrontano gli indici**, così
  l'esito non dipende dalla stabilità di `sort` del motore.
- `estraiAttuale(lista, idAttuale)` → separa la foto in uso, che va mostrata in cima. Estrarla,
  invece di lasciarla dov'è, evita che compaia due volte: due schede cliccabili per la stessa foto
  confonderebbero più del problema che stiamo risolvendo.

**Test:** `node --test tests/plugin/data-caricamento-foto.test.js`
