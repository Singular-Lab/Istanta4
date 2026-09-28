# indexNew.js — il file che tiene insieme il Plugin

**Cosa è:** non è «la schermata principale». È **il punto in cui tutto si incontra**.

Fa quattro cose che nessun altro file fa:

1. **Carica tutto il resto.** Le prime 33 righe sono i `require` di ogni modulo del Plugin.
2. **Definisce le globali** che tutti gli altri usano senza dichiararle.
3. **Ascolta gli eventi** emessi da [events.js](../events.md) e decide cosa succede.
4. **Contiene le operazioni grosse**: impaginazione, esportazione, sincronizzazione foto.

**133 funzioni globali, 228 membri di oggetti, 85 variabili globali, 11.148 righe di codice** — e
prima di I20-1002 aveva quindici commenti in tutto. Oggi sono documentate tutte.

Le funzioni erano 135: in I20-1002 sono state rimosse `sincronizzaBoxGriglia` (142 righe morte) e
la copia locale di `replaceAll`. Col commento su ognuna il file arriva a 12.208 righe.

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

**Settantatré funzioni su centotrentatré non appartengono a nessuna famiglia.** È la misura di
quello che l'operatore intende quando dice che qui «c'è stato messo di tutto».

### Le funzioni più grandi

| funzione | righe |
|---|---|
| `_conteggiaImpaginaConContesto` | **1.793** |
| `impaginaBox` | 750 |
| `ricollegaFotoMassivo` | 444 |
| `applicaConfronto` | 355 |
| `avviaSyncPacchettoFoto` | 347 |
| `fixRefImpaginata` | 255 |

`_conteggiaImpaginaConContesto` da sola è più grande di nove dei tredici file del Lotto 5.

---

## Le pagine

| pagina | contenuto |
|---|---|
| [01-globali-e-ossatura.md](01-globali-e-ossatura.md) | le variabili globali, l'avvio, il documento in lavorazione, accesso e ruoli |
| [02-impaginazione.md](02-impaginazione.md) | il flusso, il libro, e l eliminazione dal tracciato |
| [03-foto-report-esportazione.md](03-foto-report-esportazione.md) | i pezzi di due concetti che vivono altrove |
| [04-tracciato-messaggi-e-il-resto.md](04-tracciato-messaggi-e-il-resto.md) | le altre 118 funzioni, e i sette difetti che nascondevano |
