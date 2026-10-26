# Le catene di chiamate

I flussi veri dell'applicazione, con i nomi dei metodi e i numeri di riga al 14/09/2026. I numeri di
riga invecchiano: i **nomi** no, e sono quelli la chiave per ritrovare le cose.

> **Un avviso metodologico.** I numeri di riga qui sotto vengono da un'estrazione automatica fatta
> sul codice del 14/09. Se cerchi un metodo e alla riga indicata trovi altro, cerca per nome: non
> fidarti del numero. Vedi [12-trappole.md](12-trappole.md), voce «ancorarsi al numero di riga».

---

## 0. L'accesso

```
browser
  → LoginController.Index()                     Views/Login/Index.cshtml, layout _LayoutLogin
  → LoginMiddleWare.Invoke()                    MiddleWare/LoginMiddleWare.cs:50, 203 righe
      ├─ SessionIstantaObject.GetSession(context)
      │     se c'è già una sessione → await _next(context) e finisce qui
      ├─ context.Request.Headers["Authorization"]  → il bearer
      ├─ GET {olympusServerUrl}/auth/checkIdentity   ← OLIMPO decide chi sei
      ├─ ctx.Utentis.FirstOrDefaultAsync(u => u.Email == utente.username)
      │     se non c'è, crea un Utenti nuovo e ctx.SaveChangesAsync()
      └─ context.Session.SetString("id", id_utente)
```

Il middleware ha una **lista bianca di pagine** (`private string[] pagine`) che comprende `""`,
`"/"`, `/Tracciati`, `/Confronti`, `/SyncFoto`, `/Archivio`, `/Aree`, `/MenaboSettings`,
`/Etichette`, `/DeclinazioniMeccaniche`… Se non c'è sessione e la richiesta è per una di quelle,
redirige a `/Login`; se è una chiamata API risponde `{login:false, error:"no_login"}` in JSON.

**Il punto da ricordare: chi decide l'identità è Olimpo.** Istanta non ha una tabella di password
propria; ha una tabella `Utentis` che si popola dalle risposte di Olimpo.

Esiste anche una strada con **Entra ID** (`AddOpenIdConnect` in `Program.cs:215`, classe
`AuthADOptions`, `AuthController` con `IExternalUserValidator`). **Se e quando sia attiva non è
verificato.**

Il **passaporto verso fidelity** è un percorso separato:
`FICOMiddleware.login(olUrl, user, secretKey, policy, ctx, httpClient)` costruisce un
`FICOPassportCredentials`, lo serializza e lo manda in `PUT`; la risposta viene salvata sull'utente
con `ctx.SaveChanges()`. `fico/userDataPolicy` in `appsettings.json` dice quali campi dell'utente
mappare (`nome → NomeUtente`, `cognome → email`).

---

## 1. L'importazione di un tracciato

È il flusso più lungo del progetto: **`OperationsController.importaVolantino`, 1.486 righe**
(righe 314-1799).

```
TracciatiController.Index()                      la pagina, Views/Tracciati/Index.cshtml
  → this.Bind()                                  carica le tendine (promo, tracciati, addestramenti)

l'utente carica un Excel
  → OperationsController.importaVolantino(id_attivita, pkg, context, persistent, report)
      ├─ ctx_1 = _dbContextFactory.CreateDbContext()     anagrafiche
      ├─ ctx_2 = _dbContextFactory2.CreateDbContext()    promozioni
      ├─ CultureInfo("it-IT")                            i decimali all'italiana
      ├─ pkg.getFieldByKey("idAddestramento")            quale addestramento interpreta le colonne
      ├─ ... lettura dell'Excel, riga per riga, con i ruoli delle colonne
      │     (Enum AddestramentoRuoli: Referenza, Scatto, Tracciato, ...)
      ├─ execLibFunction($"AgenziaLib.{cliente}.importaTracciato", …)     riga 820
      │     ← qui il cliente rimaneggia il tracciato a modo suo
      ├─ new Register(conn, factory, factory2)           il registro delle operazioni
      └─ ctx_1.SaveChangesAsync() × 12, ctx_2.SaveChangesAsync() × 1
```

Due varianti:

- **`TracciatiController.importaManualmente`** (284 righe, `PUT
  Tracciati/importaManualmente/{idAddestramento}/{label}/{idTracciato}/{codGruppo}`) per inserire
  referenze a mano. Alla riga 1515 chiama `execLibFunction(addestramento.externalCallPerImport!, …)`:
  **il nome del metodo viene dal database**.
- **`TracciatiController.ProvaAddestramento`** (346 righe, `PUT Tracciati/ProvaAddestramento`) prova
  un addestramento senza salvare. Scrive l'Excel su file
  (`File.WriteAllBytes(file_xls, Convert.FromBase64String(...))`) e alla riga 798-821 fa la sua
  riflessione per conto proprio — `Assembly.Load`, `GetMethod`, `Invoke` — invece di passare da
  `execLibFunction`.

Le classi di AgenziaLib che rispondono: `Edro21.importaTracciato` (1.387 righe),
`Coopfi.importaTracciato` (996).

---

## 2. La revisione

La schermata dove gli operatori sistemano descrizioni, prezzi e foto, referenza per referenza.

```
RevisoreController.Index(id_promo, id_tracciati)         righe 80-129
  ├─ ctx2.PromoTracciatis.Where(i => listIdTracciati.Contains(i.Id))
  ├─ ctx2.Promos.Include(f => f.PromoTracciatis)
  ├─ viewOlimpoIp()                                       ViewBag.ipOlympus, per le miniature
  └─ View()                                               Views/Revisore/Index.cshtml, 1.151 righe

il javascript chiede la lista
  → POST Revisore/getListaRevisione2                      RevisoreController.getListaRevisione2
                                                          righe 1176-2313, 1.138 righe
  → POST Revisore/getConteggio                            getConteggioListaRevisione
                                                          righe 216-863, 648 righe
      ├─ execLibFunction(… .FiltraRecordsPerConteggioRevisione)   riga 304
      └─ execLibFunction(… .MetaPerRevisione / GetMetaPerRevisioneDaGruppiMultipli)   riga 792
```

Il salvataggio è **`PUT Revisore/salva/{idTracciato}/{idOperazione}/{sender}`**, righe 2397-3005,
**609 righe**:

```
RevisoreController.salva(acts, idTracciato, idOperazione, sender)
  ├─ new IstantaController(conn)                          serve solo per execLibFunction
  ├─ SessionIstantaObject.GetSession(HttpContext)
  ├─ ctx.Articolis.Include(f => f.ArticoliDescrizionis)    l'articolo da revisionare
  ├─ ctx2.Promos.Include(...).ThenInclude(...)             il contesto promozionale
  ├─ Utility.Main.getFirmaTracciatoGruppoDaRecords(...)    la "firma" del gruppo
  ├─ execLibFunction(… .GetMetaPerRevisioneDaGruppiMultipli)   righe 2538, 2768
  ├─ execLibFunction(… .MetaPerRevisione)                      righe 2593, 2822
  ├─ new ArticoliDescrizioni() / aggiornamento
  ├─ componiExtraAutoFields(act.Extra, descrItem.Extra)
  ├─ ctx.SaveChanges()                                     righe 2668, 2947
  ├─ new Register(...) → addOperazione(...) → updateOperazione(idOperazione, risolta)
  └─ in caso di errore: StatusCode(500, new { error, tipo })
```

> ### I due bug del 14/09, e cosa insegnano
>
> Il salvataggio restituiva `200 OK` con una lista vuota e nessun messaggio. Le cause erano due,
> **indipendenti e preesistenti** — `Revisore/salva` era identico alla versione in git, 504 righe
> non commentate, zero differenze:
>
> **Primo.** `AgenziaLib.Famila` non implementava `MetaPerRevisione` e
> `GetMetaPerRevisioneDaGruppiMultipli`: lanciavano `NotImplementedException`. Attraverso la
> riflessione quella diventa `TargetInvocationException`, che il `catch` metteva in `result.error` —
> **una variabile mai restituita**, perché il metodo restituisce `descrItemList`. L'eccezione
> spariva. Risolto copiando Coopfi, che per quei metodi fa `return null`.
>
> **Secondo.** `IAgenzia.specificaInOutVol` chiama il primo parametro `tracciatoSingoli`; il
> chiamante era stato rinominato e metteva nel dizionario la chiave `tracciatoRevisione`. Siccome
> `execLibFunction` lega **per nome**, ne usciva un `KeyNotFoundException` a ogni caricamento del
> Revisore.
>
> **La lezione strutturale**: un `catch` che scrive in una variabile che il metodo non restituisce è
> un errore invisibile. Adesso `salva` restituisce `StatusCode(500)` con il messaggio dell'eccezione
> radice, e `revisore.js` lo mostra invece di ciclare su una lista vuota.

---

## 3. Il menabò

Decidere quale referenza va in quale pagina e in quale box.

```
MenaboController.Index(id_tracciato)                     righe 106-156
  ├─ this.Bind()
  ├─ ctx2.MenaboPagines.Include(i => i.MenaboRefs)
  └─ ctx2.PromoTracciatis.Where(m => m.Id == id_tracciato)

mettere una referenza nel menabò
  → PUT Menabo/inMenabo/{onoff}/{indice}/{idTracciato}/{areaTracciato}
     MenaboController.inMenabo(...)                      righe 1934-2608, 675 righe
     → ctx2.SaveChanges() × 5

metterne molte in un colpo
  → POST Menabo/AllInMenabo                              righe 1616-1917, 302 righe
     └─ execLibFunction(funcAutoImpaginazione, _pass)     riga 1724
        il nome viene da "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppoMassiva"

la scheda di una referenza
  → PUT Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}/{mode}
     righe 9358-10015, 658 righe
```

E il ritorno da InDesign, il metodo più lungo di tutta Istanta:
**`ImpaginaFromInDesignNew`, 1.621 righe** (6990-8610), con tre `[Route]` diverse sulla stessa
azione — segno di un'API che è cresciuta per accumulo:

```
PUT Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{noCache}
PUT Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}…
```

Altri metodi grossi dello stesso controller, tutti sopra le 250 righe: `IdentificaMeccanicaRecord`
(dichiarato **tre volte** con firme diverse: righe 2683, 3567, 3265), `IdentificaCodiceBox` (527),
`leggiRegoleRicorsive` (475), `ricollegaBox` (364), `Etichettatura` (due volte: 339 e 325),
`Raggruppa` (321), `Sgruppa` (306), `AllInMenabo` (302), `PreAnalisiMismatch` (276),
`ClonaRecordRicollegato` (265), `cambioMetaRecordInLavorazione` (259).

`MenaboController` è **12.919 righe**: da solo un terzo di tutto il codice dei controller.

---

## 4. L'esportazione

```
PUT Menabo/esportaPoP                                    MenaboController.esportaPoP, 50 righe
  ├─ ctx2.PromoTracciatis.Where(t => t.Id == id_tracciato)
  ├─ req.fields["Titolo"] = meta["NomeEsportazione"]
  └─ new OperationsController(...)                        delega all'esportazione vera
```

L'esportazione vera è in AgenziaLib, ed è dove si concentra la massa del progetto:

| metodo | righe |
|---|---|
| `Edro21.esportaVolantino` | **2.817** |
| `Edro21.esportaPoP` | **2.576** |
| `Coopfi.esportaPoP` | 2.058 |
| `Coopfi.esportaVolantino` | 1.592 |
| `Edro21.esportaPOPOld` | 1.024 |
| `Pac.esportaPoP` | 625 |
| `Trea.esportaPoP` | 560 |
| `Trea.esportaVolantino` | 553 |
| `Pac.esportaVolantino` | 546 |
| `Famila.esportaVolantino` | 465 |
| `Gross.esportaPOP` | 260 |

Il contratto è `TracciatoResultKit esportaVolantino(promoContext, tracciatoContext, tracciato, kit,
pathNamingConvention, pathACPV, pathTipiDiExport, pathOrdinamentoLista, pathMeccaniche,
pathLoghiBolli, pathMappaStili, readMode)` — dodici parametri, di cui **sette sono percorsi a file
json di configurazione**. È la firma che spiega meglio di qualunque discorso quanto la logica di
esportazione dipenda dalle configurazioni per cliente.

Lato FICO, `FicoProcessController.impacchettaTracciato` (479 righe) prepara il pacchetto e chiama
`execLibFunction(… .CheckFirmaPluginGarantitaBatch)` alla riga 3293.

---

## 5. I confronti

Confrontare il volantino impaginato con il listato di partenza, per trovare gli scostamenti.

```
ConfrontiController.Index()                              4 righe, solo la vista
  → PUT Confronti/ConfrontaListe2
     ConfrontaListe2(InputForConfronto2 req)             righe 128-1113, 986 righe
     └─ StreamWriter(nome_file_csv)                       riga 901: il risultato esce anche in CSV
```

`ConfrontiController.leggiDatoExcel` (286 righe) legge il file di confronto.
Il cliente interviene con `confrontaListe` e `confrontaListatoVolantino`
(`Trea.confrontaListatoVolantino` è 1.018 righe, `Edro21.confrontaListeCustom` 899).

---

## 6. La sincronizzazione delle foto

```
POST SyncFoto/ScanPacchettoFoto                          12 righe: parte e basta
  └─ ScanPacchettoFoto_do(req, guid)                     righe 185-880, 696 righe
        gira in fire-and-forget con .ContinueWith(t => _logger.LogError(...))
        e scrive il risultato in un json:  File.WriteAllText(jsonFilePath, ...)

PUT SyncFoto/SyncPacchettoFoto/{overwriteOption}         righe 1113-1417, 305 righe
  ├─ httpClient.PostAsync({olympusServerUrl}/foto/uploadPacchettoFoto)     riga 1252
  └─ ctx.SaveChanges()

PUT SyncFoto/updateFotoFromIndd/{id_operazione}          righe 1506-1884, 379 righe
  ├─ httpClient.PostAsync({olympusServerUrl}/foto/uploadFoto)              riga 1572
  └─ ctx.SaveChanges()
```

Le interrogazioni massive a Olimpo (`/foto/getInfoMassivo`) sono alle righe 2494, 2600, 2715, 2764.

`ScanPacchettoFoto` è uno dei tre casi `CS4014` corretti il 14/09: il fire-and-forget resta, ma
adesso è **dichiarato**, e l'eccezione finisce nel logger invece di sparire.

---

## 7. La propagazione

Quando una modifica fatta su una lavorazione deve riflettersi sulle altre.

```
Propagatore.ElaboraRegistro()                            righe 68-366, 299 righe
  ├─ ctx  = _dbContextFactory.CreateDbContext()
  ├─ ctx2 = _dbContextFactory2.CreateDbContext()
  ├─ ... legge il registro delle operazioni ...
  ├─ execLibFunction($"AgenziaLib.{cliente}.analizzaPropagazionePer…")     riga 305
  │     una delle tre: PerCambioMeta, PerModificaCampiOfferta, PerRevisione
  └─ ctx.SaveChanges()
```

Il registro è gestito da `Istanta/Utility/Register.cs`: `addOperazione` (122 righe, scrive su
**entrambi** i contesti) e `updateOperazione` (19 righe).

---

## 8. Il servizio in background

`BackgroundCodeService.ExecuteAsync` (289 righe), registrato in `Program.cs:144`. Apre il contesto
con `CreateDbContextAsync`, cicla, e salva due volte. **Cosa faccia nel dettaglio non è verificato.**

---

## Dove si concentra la complessità

I venti metodi più lunghi del progetto, che sono anche i venti posti dove è più facile rompere
qualcosa:

| righe | dove |
|---|---|
| 2.817 | `AgenziaLib/Edro21.cs` — `esportaVolantino` |
| 2.576 | `AgenziaLib/Edro21.cs` — `esportaPoP` |
| 2.058 | `AgenziaLib/Coopfi.cs` — `esportaPoP` |
| 1.621 | `Istanta/Controllers/MenaboController.cs` — `ImpaginaFromInDesignNew` |
| 1.592 | `AgenziaLib/Coopfi.cs` — `esportaVolantino` |
| 1.486 | `Istanta/Controllers/OperationsController.cs` — `importaVolantino` |
| 1.387 | `AgenziaLib/Edro21.cs` — `importaTracciato` |
| 1.138 | `Istanta/Controllers/RevisoreController.cs` — `getListaRevisione2` |
| 1.024 | `AgenziaLib/Edro21.cs` — `esportaPOPOld` |
| 1.018 | `AgenziaLib/Trea.cs` — `confrontaListatoVolantino` |
| 996 | `AgenziaLib/Coopfi.cs` — `importaTracciato` |
| 986 | `Istanta/Controllers/ConfrontiController.cs` — `ConfrontaListe2` |
| 899 | `AgenziaLib/Edro21.cs` — `getLoghiEBolliNew` |
| 899 | `AgenziaLib/Edro21.cs` — `confrontaListeCustom` |
| 809 | `AgenziaLib/Class1.cs` — `importaVolantino` |
| 768 | `AgenziaLib/Edro21.cs` — `interpretaMeccanica` |
| 710 | `AgenziaLib/Coopfi.cs` — `elaboraTracciatiRecords_do` |
| 696 | `Istanta/Controllers/SyncFotoController.cs` — `ScanPacchettoFoto_do` |
| 675 | `Istanta/Controllers/MenaboController.cs` — `inMenabo` |
| 658 | `Istanta/Controllers/MenaboController.cs` — `getSchedaRef` |
