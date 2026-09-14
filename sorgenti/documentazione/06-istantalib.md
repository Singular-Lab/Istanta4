# IstantaLib — i tipi condivisi

**2.168 righe**, tre file più l'`AssemblyInfo`. È l'unica libreria che Istanta **referenzia
davvero** (`<ProjectReference Include="..\IstantaLib\IstantaLib\IstantaLib.csproj" />`), e trenta
file di Istanta la importano con `using IstantaLib`.

| file | righe | cosa contiene |
|---|---|---|
| `FicoTypes.cs` | 1.264 | **i tipi del mondo FICO**: contesti, kit, combinazioni, regole del plugin |
| `Class1.cs` | 853 | utilità: estensioni di stringa, matematica dei decimali, foto, sincronizzazione, connessioni di rete |
| `Logger.cs` | 16 | |
| `Properties/AssemblyInfo.cs` | 36 | |

Pacchetti: `System.Configuration.ConfigurationManager`, `System.Security.Cryptography.ProtectedData`,
`Newtonsoft.Json`, `System.Drawing.Common 6.0.0`, **`Magick.NET-Q8-AnyCPU 13.9.1`**.

> `Magick.NET-Q8-AnyCPU 13.9.1` ha **vulnerabilità note** (`NU1901`, `NU1902`, `NU1903` — quattro di
> gravità moderata, una bassa). Non è stato aggiornato: la regola concordata è che i pacchetti non
> si toccano finché non c'è un momento dedicato. È in [13-da-fare.md](13-da-fare.md).

---

## Cosa c'è dentro `Class1.cs`

Dopo la pulizia del 14/09 le classi rimaste sono queste:

| classe | cosa fa |
|---|---|
| `Canale`, `Area` | tipi elementari |
| `Extentions`, `StringExtensions` | **metodi di estensione** su stringa: `ToNoSpacing`, `countStringIn`, `ContainsWord` |
| `ResultSearchedPhoto`, `SearchedFoto` | risultati della ricerca foto |
| `Tag` | un tag di descrizione |
| `PhotoManager` | `scanSyncFotoFromDb` — la scansione delle foto |
| `returnFotoZip` | `generaPacchettoFoto` |
| `MathExt` | **la matematica dei prezzi**: `Round`, `DecimalRoundToString`, `DecimalRoundMidpoint`, `DecimalOrIntToString`, `generateComplexName` |
| `Dna`, `ExportingBox` | |
| `NetworkConnection`, `NetResource` | connessioni di rete SMB |
| `SyncResult`, `SyncFile`, `ShortSyncFile` | i risultati della sincronizzazione |
| `StatoSyncFileConverter` | un `JsonConverter` (`ReadJson` / `WriteJson`) |

> **`NetworkConnection` esiste due volte**, qui e in `Istanta.Utility`. Sono classi diverse con lo
> stesso nome. Quando cerchi chi la usa, la prova non è il grep del nome: sono gli `using` del file
> chiamante. Il 14/09 quella di `Istanta/Utility/Utility.cs` è stata rimossa perché morta; **questa
> resta**.
>
> **`MathExt` è dove si decide come si scrive un prezzo.** È piccola e sembra innocua: non lo è. Un
> cambiamento lì si vede su ogni volantino.

---

## Cosa contiene `FicoTypes.cs`

I tipi che descrivono il mondo «FICO» — contesti, kit di design, combinazioni, regole. Fra questi ci
sono **ventidue classi `AgenziaCustomPlugin_*`** che insieme descrivono la forma di
`SourceCustomPlugin.json`: `AgenziaCustomPlugin_OutputRulesSet`, `_OutputRule`, `_ContextKey`,
`_CampiFiltro`, `_ViewColonneTracciato`, `_SchemaDescrizioni`, `_StileUniversale`,
`_GrandezzaBoxRevisione`, `_RegoleIstruzioni`, `_RequireIngombriSetDiRegole`, `_InfoExtraCommand`,
`_EtichetteCommand`, `_FitTypeLogoRule`, `_KeyLabel`, `_SchemaOrdinamentoConPesi`,
`_EditSchedaRefRules`, `_DecodificaNomeFilePerRicercaKit` (+ `Rule`, `Levels`), `_LibreriaIndd`,
`_PolicyImpaginazioneMechanism`, `_CampiSoggettiAOverflow`.

> **Non cercare chi le nomina.** Sono proprietà annidate dentro un tipo padre: chi deserializza il
> padre non scrive mai il nome del figlio. Un'analisi che cerca il nome della classe nei file
> consumatori le dichiara tutte morte, e sbaglia. Vedi [12-trappole.md](12-trappole.md).

Altri tipi degni di nota: `FicoCombinazioneKit`, `FicoRuntimeKit`, `FicoContextField`,
`FicoContextSchemeFieldValue`, `FileDesignInKit`, `BoxIndd`, `Istruzione`,
`RegolaComparazioneContext` / `Formato` / `Warning`, `TemplateFiltro`, `CriterioFiltroTemplate`,
`DerivazioneDna`, `Correggo_Pagina`, `Correggo_AzioniSullaRef`, `Correggo_SchemaCampiDellaRef`,
`Correggo_IstruzioneCampoDellaRef`, `PacchettoCorreggoPerFPRequest`.

Le classi con prefisso `Correggo_` sono il **contratto verso correggo4**.

---

## Il codice tolto il 14/09

Da 3.856 a 2.168 righe, in due commit.

| cosa | righe | perché |
|---|---|---|
| 5 blocchi commentati ≥20 righe | 771 | vecchie versioni di `cercaFotoByName2` (298), `scan` (213), `cercaFoto` (172), più due `getExportingRef` marcate `//COOP.FI` e `//EDRO21` |
| `packages.config` | 9 | modello di progetto .NET Framework: un progetto SDK-style usa `PackageReference` e non lo legge |
| `App.Config` | 47 | idem; e il csproj ha `EnableDefaultNoneItems=false` |
| `IstantaLib.csproj.originale` | 98 | copia salvata durante la portabilità a net10 |
| `XmlInterpreter` (classe intera) | 588 | il suo nome compariva **una volta sola in tutto il progetto**: la propria dichiarazione |
| `PhotoManager.startExport` | 92 | nessun chiamante |
| `PhotoManager.exportFileFromAltaTo` | 78 | nessun chiamante |

`Class1.cs` era commentata al **40,1%**; adesso al 6,0%.

**Un effetto collaterale che vale la pena conoscere**: i quattro warning `CA2022` —
`FileStream.Read` che può restituire meno byte di quelli richiesti, cioè dati troncati in silenzio —
erano tutti e quattro dentro `startExport` ed `exportFileFromAltaTo`. Sono passati da quattro a zero
senza doverli correggere. Se un giorno quel codice torna, il problema torna con lui.

**`XmlInterpreter`** conteneva tre metodi pubblici (`getExportingRefPOP` 114 righe,
`getExportingRef` 142, `getExportingRefSub` 20) e sei privati che servivano solo loro
(`getPrezzoPromo`, `getPrezzo`, `getPrezzoPromoKgl`, `getPrimaDiPrezzo2`, `getDescrizioneHtmlTags`,
`getNextTag`). Era logica sui prezzi e sui tag delle descrizioni. È in git e in
`sorgenti/backup/codice-rimosso.txt`: se un giorno serve, si recupera con
`git log -S "XmlInterpreter"`.
