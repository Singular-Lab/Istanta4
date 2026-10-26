# manifest.json

**Cosa è:** la carta d'identità del Plugin per InDesign; tutte le informazioni di versione e
permessi si trovano qui.

- `id` / `name` → `IST-ge6ntl`, `IstantaImpaginazione`: identificano il Plugin per InDesign e per
  UDT.
- `version` → la versione del Plugin. [versionePlugin.md](versionePlugin.md) la legge per capire se
  il client è fuori sync rispetto all'ultima rilasciata. Alzarla senza ripubblicare blocca gli
  operatori all'avvio.
- `main` → `index.html`, il punto da cui parte tutto.
- `host` → solo InDesign (`ID`), da `19.0.0` in su.
- `entrypoints` → un pannello, `mainPanel`, etichetta «Istanta», minimo 524×628.

## Permessi

| permesso | senza di questo |
|---|---|
| `localFileSystem: fullAccess` | non legge la cartella di lavorazione |
| `network.domains: all` | non parla né con Istanta né con l'agente locale sulla 59999 |
| `webview` | niente WebView sul `127.0.0.1:7724`, niente message bridge |
| `clipboard: readAndWrite` | niente copia-incolla dei campi |

## Variabili globali

Nessuna: è un file di configurazione. La `version` però esce da qui e diventa stato del programma,
letta a runtime in `indexNew.js` e mostrata nella barra in basso al pannello.

## Funzioni

Nessuna.

> **Nota:** il file non contiene e non può contenere commenti — è JSON e `indexNew.js` lo carica con
> `require`. Questa pagina è l'unico posto dove documentarlo.
