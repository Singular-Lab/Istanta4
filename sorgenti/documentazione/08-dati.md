# I dati

Istanta tiene i dati in tre posti diversi, e sapere quale usare per cosa è metà del lavoro.

| dove | cosa ci sta | chi lo legge |
|---|---|---|
| **PostgreSQL** | promozioni, tracciati, articoli, foto, utenti, registro operazioni | i due `DbContext` |
| **`external_source/<Cliente>/*.json`** | le configurazioni del cliente | `ExternalSourceClass` |
| **Redis** | la sessione | `AddSession` + `AddStackExchangeRedisCache` |

Più `pubblicato/wwwroot/imported_files/` (i file caricati dagli utenti) e le cartelle di scambio
sotto `/srv/istanta4/storage/`.

---

## I due contesti Entity Framework

Registrati **entrambi come factory** e **sulla stessa stringa di connessione**
(`IstandaConnectionDb`), righe 89-90 di `Program.cs`:

```csharp
builder.Services.AddDbContextFactory<edro21_dbContext>(o => o.UseNpgsql(...));
builder.Services.AddDbContextFactory<Edro21_DbContext2>(o => o.UseNpgsql(...));
```

### `edro21_dbContext` — nel codice si chiama `ctx`

`Istanta/Models/edro21_dbContext.cs`, `OnModelCreating` di 527 righe. Il mondo **anagrafico**:

- `Articolis` — le referenze
- `ArticoliDescrizionis` — le descrizioni, per codice e gruppo
- `ArticoliFotos` — il legame fra referenza e foto su Olimpo
- `Utentis` — gli utenti, popolati dalle risposte di Olimpo
- `RegistroOperazioni`, `AttivitaLogs`, `Attivita` — il registro di cosa è successo

### `Edro21_DbContext2` — nel codice si chiama `ctx2`

`Istanta/Models_2/edro21_dbContext2.cs`, `OnModelCreating` di **557 righe**. Il mondo delle
**promozioni**:

- `Promos` — la promozione
- `PromoTracciatis` — i tracciati di una promozione
- `PromoTracciatiRecords` — **le righe vere del listato**
- `PromoLavorazionis`, `PromoLavorazioniRecords` — le lavorazioni
- `MenaboPagines`, `MenaboRefs` — le pagine del menabò e cosa ci sta dentro
- `PromoImportazioni` — le importazioni fatte

> **Il nome `edro21` è storico.** Viene dal primo cliente e non ha più significato: entrambi i
> contesti valgono per tutti i clienti.
>
> **Sapere in quale contesto sta una tabella è la prima domanda da farsi** quando una query non
> trova niente. `PromoTracciatiRecords` sta in `ctx2`: cercarla su `ctx` non dà errore, dà zero
> risultati. È già costato tempo.

Molti metodi aprono i contesti **a mano** con `_dbContextFactory.CreateDbContext()` invece di
riceverli iniettati, soprattutto i più lunghi (`importaVolantino`, `ElaboraRegistro`,
`impacchettaTracciato`, `BackgroundCodeService`). È coerente con l'uso delle factory, ma significa
che il ciclo di vita del contesto è gestito a mano, caso per caso.

---

## Il database

Un container `postgis/postgis:16-3.4` sulla **5432**. Il database del server demo si chiama
**`istanta4_pg`**, utente `istanta`.

Lo **schema completo, tabella per tabella e colonna per colonna**, è in
[08b-schema-database.md](08b-schema-database.md), generato direttamente dal database.

### Il database demo è quasi vuoto

Questo va detto forte, perché cambia il valore di qualunque analisi fatta su di lui:

| tabella | righe |
|---|---|
| `articoli` | 51 |
| `articoli_descrizioni` | 51 |
| `registro_operazioni` | 51 |
| `promo_tracciati_records` | 51 |
| `promo_lavorazioni_records` | 51 |
| `articoli_foto` | 31 |
| `Attivita` | 3 |
| `utenti` | 3 |
| `promo` | 1 |
| `promo_tracciati` | 1 |
| `addestramento_excel` | **1** |
| `settings`, `menabo_pagine` | 0 |

**Conseguenza pratica**: il database demo non può dire se un metodo di AgenziaLib è usato. Le colonne
`addestramento_excel.externalCallPerImport`, `.externalCallPerExport`, `.externalCallPerExportPoP` e
`addestramento_excel_relazioni.algoritmo` esistono e sono **fatte apposta** per contenere nomi di
metodo da chiamare per riflessione — ma qui sono tutte vuote, su una tabella che ha una riga sola.
In produzione possono essere piene.

### Gli script dello schema

In `soluzione/` ci sono `pg-ctx1.sql` (18.864 byte) e `pg-ctx2.sql` (12.151 byte): gli schemi dei due
contesti. Sono **in git**.

---

## I json di configurazione per cliente

In `pubblicato/wwwroot/external_source/<Cliente>/`. Il modello è **`vergine/`**, che ne contiene
quattordici. Cosa contiene ciascuno, dal modello vuoto:

| file | forma | a cosa serve |
|---|---|---|
| `SourceACPV.json` | `{source: [...]}` | i punti vendita (Aree/Canali/PuntiVendita) |
| `SourceAree.json` * | | le aree commerciali |
| `SourceDeclinazioneMeccaniche.json` | | come si declina una meccanica promozionale |
| `SourceDeclinazioniKit.json` | | le declinazioni dei kit di design |
| `SourceEtichetteRef.json` | | le etichette delle referenze |
| `SourceFormati.json` | | i formati dei box |
| `SourceFrameworkCss.json` | `{defaultBox, livelli: [...]}` | **il framework css**: livelli, definizioni, box di default |
| `SourceLabels.json` | `{source: [{Id, Codice, Nome}]}` | le etichette dell'interfaccia. Per Famila: una voce, `{1, "main", "Lista Origine"}` |
| `SourceLoghiBolli.json` | | loghi e bollini |
| `SourceMeccaniche.json` | | le meccaniche promozionali |
| `SourceNamingConvention.json` | | **come si chiamano i file esportati** (959 byte anche nel modello: è già compilato) |
| `SourceOrdinamentoLista.json` | | lo schema di ordinamento della lista |
| `SourceRegoleMastro.json` | | le regole del mastro |
| `SourceTipiDiExport.json` | | i tipi di esportazione |
| `SourceTraduttoreAC.json` | | la traduzione area/canale |

\* alcuni clienti hanno file in più (`SourceConfronto.json`, `SourceCustomPlugin.json`,
`SourceMappaStili.json`, `SourceAllineamenti.json`, `SourceCampiConfronto.json`, cartelle `bkp/` e
`ficoContext/`). Avere file **in più** di `vergine` è normale; averne **in meno** no.

Stato al 14/09: Coopfi 20 file, Edro21 22, Famila 19, Pac 15, Trea 19 (**gli manca
`SourceMeccaniche.json`**, ed è dismesso: non lo aggiungiamo).

### Chi li legge: `ExternalSourceClass`

`Istanta/Models/ExternalSourceClass.cs`, 3.510 righe dopo la pulizia. Ventuno metodi `getXxx()`, uno
per sorgente. **Solo cinque creano il file se manca**: `getFormati`, `getLoghiBolli`,
`getTipiDiExport`, `getDeclinazioniKit`, `getNamingConvention`. Gli altri sedici vanno dritti a
`File.ReadAllText` e vanno in errore.

Il nome del file lo dichiara ogni classe `Db*`:

```csharp
public static readonly string dbSourceName = "Labels.json";   // → "Source" + dbSourceName
```

e il percorso lo costruisce `SetExternalPath`:

```csharp
public void SetExternalPath(string pathExternalSource) {
    this.pathExternalSource = pathExternalSource + "Source" + DbLabels.dbSourceName;
}
```

> **Il 14/09 `DbLabels` era l'unica su dodici a sbagliare**: usava `DbACPV.dbSourceName`. Se qualcuno
> avesse chiamato `DbLabels.SaveChanges()`, il contenuto delle label sarebbe finito **sopra
> `SourceACPV.json`**, che esiste ed è letto da otto punti di `AreeController`. Non è mai successo
> perché quei metodi non avevano un chiamante. Corretto nel commit `6f73548`.
>
> Se aggiungi una classe `Db*`, **controlla che `SetExternalPath` nomini sé stessa**. È un
> copia-incolla che si sbaglia in silenzio.

---

## Le altre cartelle di dati

| percorso | cosa |
|---|---|
| `pubblicato/wwwroot/imported_files/` | i file caricati dagli utenti. **Sono dati, non build** |
| `pubblicato/wwwroot/exported_files/` | i file prodotti dall'esportazione |
| `pubblicato/wwwroot/external_lib/` | **`AgenziaLib.dll`**, copiata a mano |
| `pubblicato/wwwroot/ficoContexts/<Cliente>/` | i contesti FICO per cliente |
| `pubblicato/logs/log-AAAAMMGG.txt` | **i log dell'applicazione** |
| `/srv/istanta4/storage/jpg/` | le foto |
| `/srv/istanta4/storage/estrazioni/` | `sync_options/extractPath` |
| `/srv/istanta4/backup/` | i backup dei job di pulizia |

> **`pubblicato/` non si pulisce per differenza con i sorgenti.** Un job del 14/09 l'ha fatto e ha
> cancellato **974 file**, fra cui gli `.xlsx` caricati dagli utenti e le configurazioni di
> `external_source`. Recuperati da un tar fatto poco prima. La regola è scritta anche in
> `sorgenti/backup/RIMOZIONI.md`.
