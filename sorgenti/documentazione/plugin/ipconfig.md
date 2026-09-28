# ipconfig.json

**Cosa è:** dove il Plugin va a cercare Istanta e Olimpo. Due indirizzi in due versioni, produzione
e prova, più l'interruttore che sceglie quale coppia vale.

- `testMode` → `true` usa gli indirizzi `*TestMode`. Letto in `indexNew.js:128`.
- `istantaIp` / `istantaIpTestMode` → il server Istanta; diventa la globale `istantaIp`, base di
  ogni chiamata di [XMLHttpRequestClient](XMLHttpRequestClient.md).
- `olimpoIp` / `olimpoIpTestMode` → da dove arrivano le foto.

## Da sapere

Il file **cambia per cliente**: `monta-cliente.sh` lo riscrive al montaggio, insieme a
`appsettings.<cliente>.json`. Quello che trovi nel repository è l'ultimo cliente montato su quella
macchina, non una costante del prodotto.

`testMode` lasciato a `true` in una copia distribuita fa lavorare il Plugin contro la macchina di
sviluppo. **Si vede dalla scritta `(testmode)`** nella barra in basso al pannello, accanto al numero
di versione: è l'unico segnale, e chi non sa che c'è non lo nota.

## Variabili globali

Non ne definisce, ma è il punto in cui un file di configurazione si trasforma in stato globale del
programma: le sue tre chiavi diventano le globali `testMode`, `olimpoIp` e `istantaIp` in
`indexNew.js:128-132`, e da lì le usa tutto il Plugin.

## Funzioni

Nessuna.

> **Nota:** il file non contiene e non può contenere commenti — è JSON e `indexNew.js` lo carica con
> `require`. Questa pagina è l'unico posto dove documentarlo.
