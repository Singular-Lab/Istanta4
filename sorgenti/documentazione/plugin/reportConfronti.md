# reportConfronti.js

**Cosa è:** la sezione Confronti del Report Integrità, nella modalità che si apre per prima — il
confronto della lista con sé stessa. Nasce con I20-981 (Lotto 4a).

## Da dove vengono i dati

Istanta, quando importa una nuova versione del tracciato, **tiene da parte il valore che un campo
aveva prima**: è la chiave `Alterazioni` del record, nella forma campo → valore precedente.

Qui si guardano **solo i campi che l'agenzia dichiara di tenere d'occhio**. Non cambiano l'aspetto
del box, quindi l'analisi di integrità non li considera, ma l'operatore li usa per decidere a che
pagina va la referenza: e se cambiano, la pagina può cambiare.

**Il confronto evidenzia e basta: non propone correzioni.**

## Le due modalità

- `confrontoConSeStessa(...)` → la lista con la propria versione precedente. È quella che si apre
  per prima.
- `confrontoConAltraLista(...)` → due liste diverse a confronto.

## Variabili globali

| costante | valori |
|---|---|
| `CHIAVE_ALTERAZIONI` | `"Alterazioni"`, la chiave nel record |
| `CANALE` | `osservato`, `compilato` |
| `PRESENZA` | `entrambe`, `soloCorrente`, `soloAltra` |
| `FILTRO_PRESENZA` | `tutte`, `comuni`, `soloUna` |

Le ultime tre sono `Object.freeze`: sono insiemi chiusi di valori, e congelarli impedisce che
qualcuno ci aggiunga un caso senza passare dalle funzioni che lo sanno trattare.

## Funzioni

Ventiquattro membri esportati, che si raggruppano in quattro mestieri.

### Confrontare

- `valoreLeggibile(valore)` → come si scrive un valore nel confronto.
- `sonoUguali(a, b)` → il confronto vero fra due valori.
- `differenzeDelRecord(record, campi)` → cosa è cambiato in un record, guardando le `Alterazioni`.

### Indicizzare

- `idRecDelRecord(record)`, `chiavePresenza(...)`, `indicizzaPerPresenza(...)` → come si riconosce
  lo stesso record fra due liste.
- `primariPerCodiceGruppo(...)` → i primari raccolti per codice gruppo.
- `recordsDellaLista(lista)`.

### Filtrare

- `campiDisponibili(...)` → quali campi si possono mostrare.
- `filtraVociConfronto(...)` → applica il filtro di presenza scelto dall'operatore.
- `differenzePerPresenza(...)`, `differenzeOsservate(...)`, `differenzeCompilate(...)`.
- `identitaTracciato(...)`.

### Descrivere all'operatore

- `descriviPresenza(...)`, `descriviCanale(...)`, `descriviFiltro(...)` → i testi dei filtri.
- `testoDifferenze(differenze, separatore)` → la riga che l'operatore legge.

**Test:** `node --test tests/plugin/reportConfronti.test.js`
