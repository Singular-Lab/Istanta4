# indexNew.js — il file che tiene insieme il Plugin

**Cosa è:** non è «la schermata principale». È **il punto in cui tutto si incontra**.

Fa quattro cose che nessun altro file fa:

1. **Carica tutto il resto.** Le prime 33 righe sono i `require` di ogni modulo del Plugin.
2. **Definisce le globali** che tutti gli altri usano senza dichiararle.
3. **Ascolta gli eventi** emessi da [events.js](../events.md) e decide cosa succede.
4. **Contiene le operazioni grosse**: impaginazione, esportazione, sincronizzazione foto.

**135 funzioni globali, 228 membri di oggetti, 85 variabili globali, 11.316 righe** — e prima di
I20-1002 aveva quindici commenti in tutto.

---

## Come è fatto dentro

| famiglia | funzioni globali |
|---|---|
| **senza famiglia riconoscibile** | **73** |
| impaginazione | 15 |
| tracciato | 11 |
| foto | 10 |
| messaggi e avvisi | 9 |
| accesso e ruoli | 4 |
| libro, esportazione, report | 3 ciascuna |
| rimozioni differite | 3 |
| griglia | 1 |

**Settantatré funzioni su centotrentacinque non appartengono a nessuna famiglia.** È la misura di
quello che l'operatore intende quando dice che qui «c'è stato messo di tutto».

### Le funzioni più grandi

| funzione | righe |
|---|---|
| `_conteggiaImpaginaConContesto` | **1.798** |
| `impaginaBox` | 751 |
| `setFinestrePerRuolo` | 643 |
| `ricollegaFotoMassivo` | 445 |
| `applicaConfronto` | 358 |
| `avviaSyncPacchettoFoto` | 348 |

`_conteggiaImpaginaConContesto` da sola è più grande di nove dei tredici file del Lotto 5.

---

## Le pagine

| pagina | contenuto |
|---|---|
| [01-globali-e-ossatura.md](01-globali-e-ossatura.md) | le variabili globali, l'avvio, il documento in lavorazione, accesso e ruoli |
| [02-impaginazione.md](02-impaginazione.md) | il flusso, il libro, e l eliminazione dal tracciato |
| [03-foto-report-esportazione.md](03-foto-report-esportazione.md) | i pezzi di due concetti che vivono altrove |
| tracciato, messaggi e il resto | da scrivere |
