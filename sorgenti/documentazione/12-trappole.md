# Le trappole

Questa pagina è un elenco di errori **realmente commessi** il 14 settembre 2026, quasi tutti miei.
Ognuno è costato tempo e alcuni hanno quasi fatto danno. Sono qui perché chiunque riscriva uno
strumento di analisi del codice, o faccia una pulizia simile, li rifarà.

Se hai dieci minuti prima di scrivere uno script che tocca il codice, spendili qui.

---

## Trappole del linguaggio e del progetto

### Le stringhe verbatim di C# possono contenere righe che iniziano con `//`

Cancellarle come se fossero commenti **cambia la stringa senza rompere la compilazione**: il
compilatore non dice niente e il bug esce a runtime, chissà quando.

Per AgenziaLib è servito un piccolo analizzatore lessicale che percorre il file carattere per
carattere distinguendo sei stati — codice, commento di riga, commento a blocco, stringa, stringa
verbatim, carattere — e toglie un blocco **solo se ogni sua riga è commento vero**. Su 23 blocchi
candidati contati a occhio, ne ha salvati **due**.

### Togliere i commenti a blocco cancellando anche i ritorni a capo

```python
re.sub(r'/\*.*?\*/', '', testo, flags=re.S)     # SBAGLIATO
```

Questo **sposta tutti i numeri di riga successivi**. Un'analisi che lo fa produce un elenco di righe
a caso che sembra perfettamente plausibile: file giusti, numeri verosimili, contenuto arbitrario. Ho
prodotto un intero rapporto così prima di accorgermene.

```python
def vuota(m): return re.sub(r'[^\n]', '', m.group(0))
re.sub(r'/\*.*?\*/', vuota, testo, flags=re.S)  # giusto: svuota ma conserva i \n
```

### Le graffe nei template di rotta

`[Route("x/{id}")]` contiene una `{`. Un rilevatore di confini di metodo che conta le graffe **senza
prima azzerare il contenuto delle stringhe** sbaglia i confini, e li sbaglia in modo silenzioso.

### `CS0219` non dice «mai riferita», dice «il valore non viene mai LETTO»

Una variabile può essere **riassegnata** più avanti. Togliere la dichiarazione rompe la
compilazione:

```csharp
bool foundPP = false;                       // CS0219: assegnata ma mai usata
foreach (string ppExt in ext_post_lavorazione) {
    ...
    foundPP = true;                         // ← eccola, otto righe più sotto
}
```

Prima di cancellarla, verifica che il nome non ricompaia nel resto del file. La build ha fermato
questa esatta rimozione.

### Le righe che sembrano uniche non lo sono

Un rilevatore ancorato su `let infoEsempio = pilota.recordInTracciato.nota_esempio` si è annullato
da solo perché quella riga compare **due volte** nel file: la prima commentata. Filtra le occorrenze
commentate **prima** di contare.

### Ancorarsi al numero di riga di un'analisi precedente

Se quei numeri puntano alla riga **vuota prima** della dichiarazione, l'unico «chiamante» che trovi
per ogni metodo è la dichiarazione stessa, e il risultato sembra un elenco di metodi vivi. Riancora
sulla dichiarazione vera con una regex, e **stampa a quale riga ti sei agganciato**.

---

## Trappole dell'analisi statica

### Un DTO annidato non viene mai nominato dal consumatore

Chi deserializza il tipo padre non scrive **mai** il nome del figlio. Cercare il nome di una classe
nei file consumatori non dice niente sulle classi usate come tipo di proprietà.

In IstantaLib questo produceva «51 tipi pubblici che nessuno nomina», di cui **ventidue** erano le
`AgenziaCustomPlugin_*`, cioè la forma di `SourceCustomPlugin.json`. Vivissime, tutte.

### Una classe di metodi di estensione non viene mai nominata

`StringExtensions` si usa scrivendo `"ciao".ToNoSpacing()`. Il nome della classe non compare da
nessuna parte. È la stessa trappola per cui l'analizzatore Roslyn aveva bisogno di `ReducedFrom`:
i metodi di estensione risolvono al simbolo **ridotto**, non a quello dichiarato.

### Il grep di un file contro sé stesso

Un metodo chiamato solo da altri metodi morti risulta vivo. Serve un passaggio **iterativo** che
tolga dai candidati quelli chiamati soltanto da codice che a sua volta sta per sparire. In
`MenaboController` ha salvato 5 metodi su 27.

### Gli omonimi

`NetworkConnection` esiste in `Istanta.Utility` **e** in `IstantaLib`. `Utility` esiste in
`Istanta/Utility/Utility.cs` **e** in `AgenziaLib/Utility.cs`, e dichiarano gli stessi metodi;
i chiamanti in AgenziaLib usano la propria copia. `SaveChanges` e `SetExternalPath` compaiono in
decine di punti su oggetti di tipo diverso.

**La prova non è il grep del nome: sono gli `using` del file chiamante, e il tipo dell'oggetto su
cui il metodo è invocato.** La domanda giusta è *su quale oggetto* è chiamato, non *se il nome
compare*.

### I quattro difetti dell'analizzatore Roslyn

`strumenti/AnalisiChiamate/` ne ha avuti quattro, tutti trovati guardando i **risultati** e non il
codice:

1. non seguiva le istruzioni di livello superiore di `Program.cs` (top-level statements);
2. i metodi di estensione risolvono al simbolo ridotto → serve `ReducedFrom`;
3. gli handler delle pagine Razor sono entry point;
4. **non attraversava gli accessori delle proprietà** — il più pericoloso: rendeva morto qualunque
   metodo chiamato solo da un getter o un setter. Ha quasi fatto cancellare quattro metodi vivi,
   chiamati dal setter di `SingletonConfiguration.ExternalSourcePath`.

93 → 59 → 31 → 22. **Ogni correzione ha dimezzato il risultato.** Quando un analizzatore ti dà un
numero grande di codice morto, il sospetto giusto è che sia rotto lui.

### La riflessione rende invisibile mezza dipendenza

Nessun analizzatore statico vedrà mai:

```csharp
icCtrl.execLibFunction($"AgenziaLib.{nomeCliente}.specificaInOutVol", _pass)
```

E ancora meno questo, dove il nome **viene dal database**:

```csharp
icCtrl.execLibFunction(addestramento.externalCallPerImport!, _pass)
```

**Prima di dichiarare morto un metodo di AgenziaLib, guarda nel database del cliente vero.** Il
database demo ha una riga in `addestramento_excel` e tutte le colonne vuote: non prova niente.

---

## Trappole degli strumenti

### Una build incrementale non emette avvisi

Due `dotnet build` di fila: il secondo non ricompila niente e **stampa zero warning**. Un passo che
legge gli avvisi da lì ne trova zero, non corregge niente, e il controllo finale — che conta gli
avvisi rimasti — conta zero e **sembra una conferma**.

Usa `-t:Rebuild`, e leggi l'output **da un file, una volta sola**.

### `git status --cached` non esiste

Non è un'opzione valida. Un `if` costruito sul suo output vuoto salta il commit **in silenzio**, e
il commit successivo racconta una cosa che non è mai avvenuta. La forma giusta è:

```bash
git diff --cached --quiet -- percorso/   # ritorna 1 se c'è qualcosa in staging
```

### `strings` non vede i nomi dei metodi .NET

Cercare un metodo nei simboli di una dll con `strings` dà **zero anche per un metodo vivo**: i
metadati .NET non sono stringhe in chiaro. Una controprova su un metodo che sicuramente c'è lo
dimostra in dieci secondi. Fai sempre la controprova.

### L'md5 di una dll .NET non è un controllo di freschezza

Due build consecutive degli stessi sorgenti producono md5 diversi: cambia il MVID. Guarda data e
dimensione.

### Razor mette su ogni tag l'attributo del css con ambito

Nell'HTML renderizzato trovi `<strong b-u2ezc1h3x5>`, non `<strong>`. Un
`grep '<strong>'` non trova nulla e sembra che il valore sia vuoto. È successo due volte nello
stesso pomeriggio.

### Attento a quale pagina stai provando

`/Login` usa `_LayoutLogin.cshtml`, non `_Layout.cshtml`. Una prova con `curl` sulla pagina di login
non dice **niente** su quello che c'è in `_Layout`, e tutte le pagine che usano `_Layout` stanno
dietro l'autenticazione.

### I fine riga

Scrivere con `open(p, "w")` normalizza CRLF→LF e gonfia un diff da 11 righe a **1.606**. Leggi in
binario, ricorda se il file aveva CRLF e il BOM, e riscrivi come l'hai trovato.

### Le «inserzioni» fantasma

Togliendo copie **commentate** di metodi vivi, git ri-appaia le righe e presenta il metodo vivo come
aggiunto. Il diff sembra dire che hai inserito codice che non hai toccato. Verifica confrontando gli
insiemi di righe, non leggendo il diff.

### `/usr/bin/psql` può essere solo il wrapper di Debian

`command -v psql` riesce, ma `psql --version` fallisce con *"You must install at least one
postgresql-client-\<version\> package"*. Serve un `postgresql-client-N` vero. Sul demo è stato
installato il 14, contro un server 16 in container: funziona.

### Su Dropbox sincronizzano solo le cartelle che già esistevano

Una `canale/doc/` creata dal server non è mai arrivata sul Mac. I **log** invece sincronizzano
sempre: per leggere un file grosso, fai un job che ne stampa una fetta.

---

## Trappole operative

### `pubblicato/` non si pulisce per differenza con i sorgenti

Non è output di build: contiene anche **stato**. `imported_files/` (i file caricati dagli utenti),
`external_source/` e `external_lib/` (configurazioni e dll), le varianti `.gz`/`.br` generate a
runtime.

Un job del 14/09 ha applicato la regola «non è nei sorgenti, quindi è una copia vecchia» e ha
cancellato **974 file**. Recuperati da un tar fatto poco prima. **Il tar è stato la differenza fra
un inconveniente e un disastro.**

### L'agente gira come root, il servizio come `serverpop`

Ogni file rimesso a mano va riportato a `serverpop:serverpop`, altrimenti l'applicazione non lo
legge e muore all'avvio con `UnauthorizedAccessException`. Sette minuti di servizio giù.

### I log dell'applicazione non sono nel journal

`Program.cs:430` dirotta la Console su Serilog: `pubblicato/logs/log-AAAAMMGG.txt`. Mezza giornata
persa a cercare nel journal, dove non c'è mai stato niente.

### `AgenziaLib.dll` va copiata a mano

`dotnet publish` non la aggiorna. Il sintomo, se lo dimentichi, è sconcertante: il codice nuovo c'è
nei sorgenti, la build è pulita, e a runtime gira quello vecchio.

---

## E una trappola che non è tecnica

**Non scrivere nel messaggio di commit una cosa che il codice non ha ancora fatto.**

È successo due volte nello stesso pomeriggio. Nel primo caso il passo che portava una guardia in
`edro21/agenzia.js` si era annullato da solo, ma il messaggio era già scritto e diceva di averla
portata. Nel secondo, i warning non erano stati corretti perché la build era incrementale, e il
messaggio diceva di averli corretti.

Entrambe le volte la riparazione è stata un **commit di rettifica che lo dice apertamente**, non una
riscrittura della storia. Il git è la memoria: se la memoria mente, non serve più a niente.
