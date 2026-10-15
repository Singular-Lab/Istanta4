/*
 * I20-1106 (Lotto 1): la pagina Backup promo del menu Confronti.
 *
 * Qui si verificano le parti che decidono qualcosa senza pagina: la descrizione del tipo, la
 * data, l'ordine dell'elenco, i testi delle conferme e il riassunto dell'esito del ripristino.
 * Per il ripristino e l'eliminazione, che girano solo nella pagina, si controlla il sorgente nel
 * punto in cui decidono: le conferme vengono prima della chiamata al server.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const BackupPromo = require('../../Istanta/wwwroot/js/backupPromo.js');
const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'js', 'backupPromo.js'), 'utf8');

//Il corpo di un membro, isolato contando le graffe a partire dalla sua intestazione.
function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, `${intestazione} non trovata: il test va aggiornato`);

    let livello = 0;
    let aperta = false;
    for (let i = inizio; i < testo.length; i++) {
        if (testo[i] === '{') { livello++; aperta = true; }
        else if (testo[i] === '}') { livello--; }
        if (aperta && livello === 0) {
            return testo.substring(inizio, i + 1);
        }
    }
    assert.fail(`${intestazione}: corpo non chiuso`);
}

function backup(id, data, tipo, conteggio) {
    return { id: id, tipo: tipo || 1, dataBackup: data, origine: "Richiesta dell'operatore", conteggio: conteggio || 0 };
}

/* ---- descrizioni e date ---- */

test('il tipo si descrive, e uno sconosciuto non ferma la pagina', () => {
    assert.strictEqual(BackupPromo.descriviTipo(BackupPromo.TIPO_TRACCIATI), 'Record dei tracciati');
    assert.strictEqual(BackupPromo.descriviTipo(BackupPromo.TIPO_LAVORAZIONI), 'Record delle lavorazioni');
    assert.strictEqual(BackupPromo.descriviTipo(9), 'Tipo sconosciuto (9)');
});

test('la data del server esce in gg/mm/aaaa hh:mm, e una data illeggibile resta com\'e\'', () => {
    assert.strictEqual(BackupPromo.formattaData('2026-10-15T12:30:00'), '15/10/2026 12:30');
    assert.strictEqual(BackupPromo.formattaData('2026-01-05T08:05:59.123'), '05/01/2026 08:05');
    assert.strictEqual(BackupPromo.formattaData('boh'), 'boh');
    assert.strictEqual(BackupPromo.formattaData(null), '');
});

/* ---- l'elenco ---- */

test('l\'elenco e\' dal piu\' recente e a parita\' di data vince l\'ultimo creato, senza toccare l\'originale', () => {
    const ricevuti = [
        backup(1, '2026-10-14T10:00:00'),
        backup(3, '2026-10-15T10:00:00'),
        backup(2, '2026-10-15T10:00:00')
    ];
    const copia = ricevuti.slice();

    const ordinati = BackupPromo.ordina(ricevuti);

    assert.deepStrictEqual(ordinati.map(b => b.id), [3, 2, 1]);
    assert.deepStrictEqual(ricevuti, copia);
    assert.deepStrictEqual(BackupPromo.ordina(null), []);
});

/* ---- le conferme ---- */

test('la conferma del ripristino dice quale backup, cosa succede ai record e che prima si fa un backup di sicurezza', () => {
    const testo = BackupPromo.testoConfermaRipristino(backup(7, '2026-10-15T12:30:00', 1, 120));

    assert.ok(testo.includes('15/10/2026 12:30'));
    assert.ok(testo.includes('Record dei tracciati'));
    assert.ok(testo.includes('120 record'));
    assert.ok(testo.includes('rimossi'));
    assert.ok(testo.includes('reinseriti'));
    assert.ok(testo.includes('backup di sicurezza'));
    assert.ok(BackupPromo.testoSecondaConfermaRipristino().includes('definitivamente'));
});

test('la conferma dell\'eliminazione nomina il backup e dice che e\' definitiva', () => {
    const testo = BackupPromo.testoConfermaEliminazione(backup(7, '2026-10-15T12:30:00', 2, 3));

    assert.ok(testo.includes('15/10/2026 12:30'));
    assert.ok(testo.includes('Record delle lavorazioni'));
    assert.ok(testo.includes('definitivo'));
});

/* ---- il riassunto dell'esito ---- */

test('il riassunto riporta i conteggi, il backup di sicurezza e cio\' che e\' rimasto com\'era', () => {
    const righe = BackupPromo.riassuntoRipristino({
        esito: true, aggiornati: 2, inseriti: 10, rimossi: 1, invariati: 300, idBackupSicurezza: 55,
        nonRimovibili: [{ id: 9, codice: 'A1', motivo: 'impaginato in una lavorazione' }],
        nonInseribili: [{ id: 12, codice: '', motivo: 'il tracciato a cui apparteneva non esiste piu\'' }]
    });

    assert.strictEqual(righe[0], 'Ripristino eseguito: 2 record riscritti, 10 reinseriti, 1 rimossi, 300 invariati.');
    assert.strictEqual(righe[1], 'Backup di sicurezza dello stato precedente: n. 55.');
    assert.strictEqual(righe[2], 'Non rimosso A1: impaginato in una lavorazione.');
    //Senza codice si dice almeno l'id.
    assert.strictEqual(righe[3], 'Non reinserito id 12: il tracciato a cui apparteneva non esiste piu\'.');
    assert.strictEqual(righe.length, 4);
});

test('un esito senza conteggi ne\' segnalazioni da\' una riga sola, con gli zeri', () => {
    const righe = BackupPromo.riassuntoRipristino({ esito: true });

    assert.deepStrictEqual(righe, ['Ripristino eseguito: 0 record riscritti, 0 reinseriti, 0 rimossi, 0 invariati.']);
});

test('esc protegge il testo messo nella pagina', () => {
    assert.strictEqual(BackupPromo.esc('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
    assert.strictEqual(BackupPromo.esc(null), '');
});

/* ---- la pagina, nel sorgente ---- */

test('il ripristino chiede due conferme prima di chiamare il server, e l\'eliminazione una', () => {
    const ripristina = corpoMembro(sorgente, 'ripristina(idBackup) {');
    const chiamata = ripristina.indexOf('Call.doWithLargePayload("PromoBackup", "ripristina", "PUT"');
    assert.notStrictEqual(chiamata, -1);
    const conferme = ripristina.substring(0, chiamata).match(/if \(!confirm\(/g) || [];
    assert.strictEqual(conferme.length, 2);

    const elimina = corpoMembro(sorgente, 'elimina(idBackup) {');
    const cancellazione = elimina.indexOf('Call.do("PromoBackup", "elimina/" + idBackup, "DELETE"');
    assert.notStrictEqual(cancellazione, -1);
    assert.strictEqual((elimina.substring(0, cancellazione).match(/if \(!confirm\(/g) || []).length, 1);
});

test('il backup si chiede al server con la promo e il tipo scelti', () => {
    const crea = corpoMembro(sorgente, 'crea(tipo) {');

    assert.ok(crea.includes('Call.doWithLargePayload("PromoBackup", "crea", "PUT", { idPromo: me.idPromo, tipo: tipo }'));
});
