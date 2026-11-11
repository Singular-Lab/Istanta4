/*
 * I20-1225: la riga gialla di Foto P/S quando la foto nella cartella Links ha lo stesso nome di quella
 * del server ma un contenuto diverso (l'impronta non coincide). L'operatore ha chiesto la dicitura
 * "Mancata corrispondenza fra foto in Links e server. Riscaricare e sostituire da archivio.", al posto di
 * "Errore: la foto nei link non corrisponde al server, aggiornare l'immagine". Il pulsante accanto resta
 * quello che riscarica la foto.
 *
 * schedaFoto.js vive dentro InDesign: si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const sorgente = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "reperimentoFoto", "schedaFoto.js"), "utf8");

test("I20-1225: la foto in Links diversa dal server ha la dicitura nuova, con il pulsante che la riscarica", () => {
    const testo = "Mancata corrispondenza fra foto in Links e server. Riscaricare e sostituire da archivio.";
    const posizione = sorgente.indexOf("<span>" + testo + "</span>");
    assert.ok(posizione > 0, "dicitura nuova non trovata");

    //Nello stesso ramo: l'icona per scaricare prima, e al clic lo scaricamento dei codici della ref.
    const prima = sorgente.lastIndexOf("images/download.png", posizione);
    assert.ok(prima > 0 && posizione - prima < 400);
    const dopo = sorgente.slice(posizione, posizione + 600);
    assert.match(dopo, /ReperimentoFoto\.avviaSyncPacchettoFoto\(2,/);
});

test("I20-1225: la dicitura vecchia non c'e' piu'", () => {
    assert.ok(!sorgente.includes("la foto nei link non corrisponde al server"));
});
