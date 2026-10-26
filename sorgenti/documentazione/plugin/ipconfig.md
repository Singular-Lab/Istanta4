# ipconfig.json

**Cosa è:** dove il Plugin va a cercare Istanta e Olimpo, e quale `custom.js` di cliente usa. Due
indirizzi in due versioni, produzione e prova, l'interruttore che sceglie quale coppia vale, e il
percorso dell'archivio del cliente.

- `testMode` → `true` usa gli indirizzi `*TestMode`.
- `istantaIp` / `istantaIpTestMode` → il server Istanta; diventa la globale `istantaIp`, base di
  ogni chiamata di [XMLHttpRequestClient](XMLHttpRequestClient.md).
- `olimpoIp` / `olimpoIpTestMode` → da dove arrivano le foto.
- `custom` → il `custom.js` del cliente, relativo a `plugin/`: `"Agenzie/Edro21/custom.js"`.

## Da sapere

Dal I20-1064 **c'è un ipconfig per cliente**, `plugin/Agenzie/<Cliente>/ipconfig.json`, e il Plugin
sa quale usare da `plugin/clienteAttivo.json`:

```json
{ "ipconfig": "Agenzie/Edro21/ipconfig.json" }
```

Lo scrive `./monta-cliente.sh <Cliente>`, come `launchSettings.json` per Istanta. Né il puntatore né
gli ipconfig stanno in git (`plugin/clienteAttivo.json`, `**/ipconfig*.json`). Se l'ipconfig del
cliente manca, lo script lo crea dal modello neutro `plugin/Agenzie/ipconfig.template.json`, che è in
git, e gli indirizzi vanno scritti a mano. Il vecchio `plugin/ipconfig.json` in radice non è più letto.

La catena la segue `configurazioneCliente.js` all'avvio: se il puntatore, l'ipconfig o il custom
mancano, o l'ipconfig non ha `custom`, il Plugin **non parte** e il riquadro di avvio dice quale file
manca.

`testMode` lasciato a `true` in una copia distribuita fa lavorare il Plugin contro la macchina di
sviluppo. **Si vede dalla scritta `(testmode)`** nella barra in basso al pannello, accanto al numero
di versione: è l'unico segnale, e chi non sa che c'è non lo nota.

> **Pacchetto .ccx.** Il pacchetto si crea dalla cartella del Plugin di una macchina montata sul
> cliente giusto, e contiene tutto quello che c'è in `plugin/Agenzie/`, compresi gli ipconfig degli
> altri clienti eventualmente presenti su quella macchina. Vanno tolti prima di creare il pacchetto.

## Variabili globali

Non ne definisce, ma è il punto in cui un file di configurazione si trasforma in stato globale del
programma: `indexNew.js` lo riceve da `configurazioneCliente.js` come `ipconfig`, e le sue chiavi
diventano le globali `testMode`, `olimpoIp` e `istantaIp`, che da lì usa tutto il Plugin.

## Funzioni

Nessuna.

> **Nota:** il file non contiene e non può contenere commenti — è JSON e si carica con `require`.
> Questa pagina è l'unico posto dove documentarlo.
