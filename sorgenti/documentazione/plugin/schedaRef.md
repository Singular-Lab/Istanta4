# schedaRef.js

**Cosa è:** la scheda della referenza — quello che l'operatore vede e modifica quando seleziona un
box nel documento.

**182 membri, 9.640 righe**, tutti sullo stesso piano: qui non c'è la distinzione fra pubblico e
privato che c'è in [confronti.js](confronti.md).

## Le famiglie

| famiglia | membri |
|---|---|
| clonazione | 26 |
| foto | 28 |
| schermate e pannelli | 9 |
| salvataggio | 6 |
| report | 5 |
| descrizione | 5 |
| ricollegamento | 2 |
| resto | 101 |

## Due funzioni enormi, il 23% del file

- **`attivaSchermateReferenza(meccanica, box, page)` — 1.194 righe.** L'apertura della scheda: legge
  il DNA del box, costruisce tutte le schermate, aggancia i controlli.
- **`openModalCambiaFoto(codice)` — 1.066 righe.** Il cambio foto: l'elenco delle disponibili,
  l'anteprima, la scelta, lo scaricamento.

Seguono `EditFotoPrimarieSecondarie` (565), `linkLogoBollo` (220), `updateImmagine` (211),
`ricollegaBoxImpaginato` (209), `salvaModifiche` (171), `FotoExtraPanel` (167).

## Lo stato: ventidue variabili

È il file con più stato del Plugin, e si capisce: la scheda è una schermata viva.

`refSelected` è **la variabile più letta del Plugin** — quasi ogni file che vuole sapere «su cosa
sta lavorando l'operatore» guarda lì. Con lei: `multiSelection`, `schedeRefDati`,
`elementiNoRenderDelBox`, `statoFotoAllApertura`, `multiSchedeRef`, `editRefFieldController`,
`idRecordLavorazione`, `isBusy`, `isInvalidated`, `segnalazioniDelBox`,
`refConSegnalazioniSilenziate`, `selezioneClonazioneCorrente`.

## Alcune funzioni che vale la pena conoscere

- `salvaModifiche(...)` → manda al server quello che l'operatore ha cambiato. **Cosa sia cambiato
  davvero lo dice [InputEditController](InputEditController.md)**, che tiene da parte i valori di
  partenza: senza quel confronto si riscriverebbe tutto a ogni conferma.
- `ricollegaBoxImpaginato(box, externalCall, codiceGruppo)` → riaggancia un box alla sua referenza.
  Gli esiti che il server manda indietro si leggono con [ricollegaEsiti](ricollegaEsiti.md), che è
  verificabile.
- `scegliCandidatoFoto`, `motivoPropostaFoto`, `fotoDaProporreDallaCartella` → la proposta
  automatica di una foto trovata nella cartella.
- `getRiscontriFotoConNome`, `buildMessaggioRiscontriFoto` → cosa dire quando più foto hanno lo
  stesso nome.

---

## Tre concetti dentro un file

Il file non li distingue, ma ci sono, e l'operatore ha deciso di separarli. Nel codice ogni membro
che appartiene a uno di essi è **marcato**, così i task li ritrovano con un grep.

### 1. Procurarsi la foto — 28 membri, circa 2.500 righe

Quale foto va su questa referenza, chiederla al server, scaricarla, sostituirla, gestire extra ed
extra auto.

**Non va confuso con il `fixFoto` di [sistemazioneFoto](sistemazioneFoto/02-sistemazione-foto.md)**, che
decide *dove* la foto sta dentro il box. Sono due concetti diversi e **due task distinti**:

| concetto | dove vive oggi | task |
|---|---|---|
| **procurarsi** la foto giusta | `schedaRef` (28), `indexNew` (10 funzioni globali), `cmd.downloadImages`, `FotoPlacer` in `utility`, più i moduli puri `cacheHashFoto`, `fotoAutoSync`, `dataCaricamentoFoto` | I20-1015, da fare |
| **collocarla** nel box | [`plugin/sistemazioneFoto/`](sistemazioneFoto/README.md), uscita da `CssFramework` | I20-1009, fatto |

### 2. La clonazione — 26 membri

Duplicare una referenza su più box è un'altra cosa rispetto al modificarne i campi.

### 3. Il Report Integrità — 5 membri

`DAL_REPORT_VOCI_BARRA_NASCOSTE`, `DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE`, `apertaDalReport`,
`refDalBoxPerReport`, `serveRiaggancioDalReport`: dicono come la scheda si comporta quando viene
aperta **dal report** invece che dal documento — la barra e i sottomenù si riducono, perché
l'operatore sta guardando una referenza segnalata, non navigando.

Vanno col resto del report, che è sparso su otto file: vedi [confronti.md](confronti.md).

## Cosa è stato rimosso in I20-1002

`ImpostaPSSottogruppi`, 84 righe: una sola occorrenza, la definizione.

`selezioneClonazioneCorrente` era segnalata nel preflight ma **è viva**: usata sei volte nel file.
Stesso falso positivo di [filtri.md](filtri.md) — il controllo non vedeva le chiamate sugli oggetti
con nome minuscolo.
