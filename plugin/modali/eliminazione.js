/// I20-1012: le conferme dell'eliminazione di una referenza, uscite da utility.js con le modali.
///
/// La conferma della rimozione dall'impaginato, quella della referenza non trovata, e la seconda
/// conferma con la parola da scrivere (I20-1013) prima di cancellare dal tracciato del server.
///
/// Non e' un modulo a se': modali.js lo mescola nel proprio oggetto con Object.assign, e da fuori
/// questi membri si chiamano Modali.X come gli altri. Qui dentro il nome Modali non c'e', e le
/// chiamate passano da modali(): si chiede il modulo al momento, perche' e' modali.js a caricare
/// questo file mentre si carica, e un require in testa leggerebbe un oggetto ancora vuoto. Vale
/// anche dentro le callback, dove this non e' l'oggetto.
function modali() { return require('./modali'); }

const Eliminazione = {
    /// La conferma della rimozione di una o piu' referenze impaginate. Restituisce
    /// { confermato, eliminaDaTracciato, codici }. Con la spunta dell'eliminazione dal tracciato
    /// alzata si passa dalla seconda conferma, quella con la parola (I20-1013).
    async confirmRimozioneRef(codiciGruppo) {
        try {
            modali().nascondiHidebleElements();

            var result = null;

            var codici = [];
            if (codiciGruppo != null && codiciGruppo.length > 0 && codiciGruppo[0] != null) {
                codici = codiciGruppo[0]
                    .split(",")
                    .map(x => x.trim())
                    .filter(x => x !== "");
            }

            var modal = $(`
            <div id="confirmModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                z-index: 5000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10px;
            "></div>
        `);

            var dialog = $(`
            <div style="
                width: 60%;
                height: 45%;
                background-color: white;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                padding: 12px;
                box-sizing: border-box;
            "></div>
        `);

            var messaggio = $(`
            <div style="
                height: 75%;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            ">
                <h3>Sei sicuro di voler rimuovere la ref impaginata?</h3>

                <label style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    cursor:pointer;
                ">
                    <input type="checkbox" id="chkEliminaDaTracciato">
                    <span>Eliminare dal tracciato l'elemento</span>
                </label>

                <div id="boxCodiciDaEliminare" style="display:none;">
                    <div style="
                        font-weight:bold;
                        color:red;
                        margin-bottom:6px;
                    ">I seguenti elementi verranno eliminati:</div>

                    <div id="listaCodiciDaEliminare" style="
                        font-size:12px;
                        line-height:18px;
                    "></div>
                </div>
            </div>
        `);

            var pulsanti = $(`
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                height:20%;
                width:100%;
            "></div>
        `);

            var conferma = $(`
            <button id="btnConfirmRimozioneRef" style="
                width:140px;
                height:24px;
                background-color:#007bff;
                color:white;
                border:none;
                border-radius:5px;
                cursor:pointer;
            ">Rimuovi ref</button>
        `);

            var annulla = $(`
            <button style="
                width:100px;
                height:24px;
                background-color:#dc3545;
                color:white;
                border:none;
                border-radius:5px;
                cursor:pointer;
            ">Annulla</button>
        `);

            messaggio.find("#listaCodiciDaEliminare").html(
                codici.map(c => `<div>${c}</div>`).join("")
            );

            messaggio.find("#chkEliminaDaTracciato").on("change", function () {
                if ($(this).prop("checked")) {
                    $("#boxCodiciDaEliminare").show();
                    $("#btnConfirmRimozioneRef").text("Elimina da tracciato");
                } else {
                    $("#boxCodiciDaEliminare").hide();
                    $("#btnConfirmRimozioneRef").text("Rimuovi ref");
                }
            });

            conferma.on("click", async function () {
                var eliminare = $("#chkEliminaDaTracciato").prop("checked") === true;
                $("#confirmModal").remove();

                if (!eliminare) {
                    //Solo la rimozione dall'impaginato: resta com'era.
                    result = {
                        confermato: true,
                        eliminaDaTracciato: false,
                        codici: codici
                    };
                    return;
                }

                //I20-1013: eliminare dal tracciato cancella il dato sul server, e una spunta sola
                //non basta. Serve la parola ELIMINA scritta a mano. Nel dubbio non si elimina:
                //vale solo un true esplicito, e annullare, sbagliare o un errore annullano TUTTO,
                //anche la rimozione dall'impaginato.
                var parolaConfermata = false;
                try {
                    parolaConfermata = (await modali().confirmParolaEliminazione(codici)) === true;
                }
                catch (e) {
                    console.error("Errore nella conferma con la parola ELIMINA:", e);
                    parolaConfermata = false;
                }

                result = parolaConfermata
                    ? { confermato: true, eliminaDaTracciato: true, codici: codici }
                    : { confermato: false, eliminaDaTracciato: false, codici: [] };
            });

            annulla.on("click", function () {
                result = {
                    confermato: false,
                    eliminaDaTracciato: false,
                    codici: []
                };

                $("#confirmModal").remove();
            });

            modal.on("click", function (e) {
                e.stopPropagation();
            });

            pulsanti.append(conferma);
            pulsanti.append(annulla);

            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);

            $("body").append(modal);

            while (result == null) {
                await delay(100);
            }

            modali().mostraHidebleElements();

            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm rimozione ref:", e);
            modali().mostraHidebleElements();

            return {
                confermato: false,
                eliminaDaTracciato: false,
                codici: []
            };
        }
    },

    //I20-1013: la parola da scrivere per eliminare dal tracciato. Esatta e in maiuscolo: la fatica
    //di scriverla e' parte della difesa.
    PAROLA_ELIMINAZIONE: "ELIMINA",

    /// I20-1013: se il testo e' la parola di conferma. Si tolgono solo gli spazi ai bordi; le
    /// minuscole non valgono.
    parolaEliminazioneCorretta(testo) {
        return typeof testo === "string" && testo.trim() === modali().PAROLA_ELIMINAZIONE;
    },

    /// I20-1013: i testi della seconda conferma. Dice cosa sparisce e da dove: quanti codici, quali,
    /// e che si cancella il dato sul tracciato del server, non solo l'impaginato.
    riepilogoEliminazione(codici) {
        var elenco = Array.isArray(codici)
            ? codici.filter(c => c != null && String(c).trim() !== "").map(c => String(c).trim())
            : [];
        var quanti = elenco.length === 1 ? "1 codice gruppo" : elenco.length + " codici gruppo";

        return {
            titolo: "Eliminazione dal tracciato sul server",
            avviso: "Stai per eliminare " + quanti + " dal tracciato sul server. Il dato viene cancellato, " +
                "non solo tolto dall'impaginato, e l'operazione non si puo' annullare.",
            codici: elenco,
            istruzione: "Per confermare scrivi " + modali().PAROLA_ELIMINAZIONE + " e premi Invio o il pulsante."
        };
    },

    /// I20-1013: la seconda conferma dell'eliminazione dal tracciato, come quella di Jira quando si
    /// cancella un task. Restituisce true solo se la parola e' stata scritta esatta e confermata;
    /// false in ogni altro caso, errori compresi. Non chiama il server: si puo' provare da sola
    /// dalla console, con await Modali.confirmParolaEliminazione(["CODICE"]).
    async confirmParolaEliminazione(codici) {
        var esito = null;
        try {
            var testi = modali().riepilogoEliminazione(codici);

            //Senza codici non si sa cosa si sta per cancellare: non si chiede nemmeno.
            if (testi.codici.length === 0) {
                console.error("Conferma ELIMINA: nessun codice gruppo, eliminazione annullata");
                return false;
            }

            modali().nascondiHidebleElements();

            var modal = $(`
            <div id="confirmEliminaModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                z-index: 5001;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10px;
            "></div>
        `);

            var dialog = $(`
            <div style="
                width: 60%;
                min-height: 45%;
                background-color: white;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                padding: 12px;
                box-sizing: border-box;
                gap: 10px;
            "></div>
        `);

            var messaggio = $(`
            <div style="
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
            ">
                <h3 id="titoloElimina"></h3>
                <div id="avvisoElimina" style="font-weight:bold; color:red;"></div>
                <div id="codiciElimina" style="font-size:12px; line-height:18px;"></div>
                <div id="istruzioneElimina"></div>
                <input type="text" id="txtParolaElimina" autocomplete="off" style="width: 90%; color: black;">
            </div>
        `);

            messaggio.find("#titoloElimina").text(testi.titolo);
            messaggio.find("#avvisoElimina").text(testi.avviso);
            messaggio.find("#istruzioneElimina").text(testi.istruzione);
            var listaCodici = messaggio.find("#codiciElimina");
            testi.codici.forEach(c => listaCodici.append($("<div>").text(c)));

            var pulsanti = $(`
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                width:100%;
            "></div>
        `);

            var elimina = $(`
            <button id="btnConfermaElimina" style="
                width:160px;
                height:24px;
                color:white;
                border:none;
                border-radius:5px;
            ">Elimina dal tracciato</button>
        `);

            var annulla = $(`
            <button style="
                width:100px;
                height:24px;
                background-color:#6c757d;
                color:white;
                border:none;
                border-radius:5px;
                cursor:pointer;
            ">Annulla</button>
        `);

            //Il pulsante sembra spento finche' la parola non corrisponde. Non ci si affida a
            //disabled, che in UXP non e' certo: il clic ricontrolla la parola comunque.
            var aggiornaPulsante = function () {
                var valida = modali().parolaEliminazioneCorretta(messaggio.find("#txtParolaElimina").val());
                elimina.css("background-color", valida ? "#dc3545" : "#c8c8c8");
                elimina.css("cursor", valida ? "pointer" : "default");
            };
            aggiornaPulsante();

            var confermaSeValida = function () {
                if (!modali().parolaEliminazioneCorretta(messaggio.find("#txtParolaElimina").val())) {
                    return;
                }
                esito = true;
                $("#confirmEliminaModal").remove();
            };

            messaggio.find("#txtParolaElimina").on("input", aggiornaPulsante);
            messaggio.find("#txtParolaElimina").on("keydown", function (e) {
                if (e.key === "Enter" || e.keyCode === 13) {
                    confermaSeValida();
                }
            });
            elimina.on("click", confermaSeValida);

            annulla.on("click", function () {
                esito = false;
                $("#confirmEliminaModal").remove();
            });

            modal.on("click", function (e) {
                e.stopPropagation();
            });

            pulsanti.append(elimina);
            pulsanti.append(annulla);

            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);

            $("body").append(modal);

            while (esito == null) {
                await delay(100);
            }

            modali().mostraHidebleElements();

            return esito === true;
        }
        catch (e) {
            console.error("Errore durante la conferma con la parola ELIMINA:", e);
            $("#confirmEliminaModal").remove();
            modali().mostraHidebleElements();
            return false;
        }
    },

    /// La conferma per un elemento che il server ha ma che nell'impaginato non si trova: mostra
    /// codice, id record e pagina attesa, e chiede se tenerlo (Mantieni) o toglierlo dal server
    /// (Rimuovi dal server). true vuol dire rimuovere.
    async confirmRimozioneRefNonTrovata(datiRef) {
        try {
            modali().nascondiHidebleElements();

            var result = null;
            var codice = datiRef != null && datiRef.codice != null ? datiRef.codice.toString() : "";
            var idRec = datiRef != null && datiRef.idRec != null && !isNaN(parseInt(datiRef.idRec))
                ? parseInt(datiRef.idRec)
                : 0;
            var paginaAttesa = datiRef != null && datiRef.paginaAttesa != null && datiRef.paginaAttesa.toString() !== ""
                ? datiRef.paginaAttesa.toString()
                : "non disponibile";

            var modal = $(`
            <div id="confirmModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                z-index: 5000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10px;
                box-sizing: border-box;
            "></div>
        `);

            var dialog = $(`
            <div style="
                width: 620px;
                max-width: 90%;
                max-height: 80%;
                background-color: white;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                padding: 16px;
                box-sizing: border-box;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            "></div>
        `);

            var messaggio = $(`
            <div style="
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                color: #222;
            ">
                <div style="
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                ">
                    <div style="
                        width: 34px;
                        min-width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background-color: #fff3cd;
                        color: #8a5a00;
                        border: 1px solid #ffdf7e;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 22px;
                        line-height: 34px;
                    ">!</div>
                    <div>
                        <h3 style="margin: 0 0 6px 0; font-size: 18px;">Elemento non trovato nell'impaginato</h3>
                        <div style="font-size: 13px; line-height: 18px;">
                            La referenza cercata non è presente nel documento. Prima di rimuoverla dal server verifica i dati della ricerca.
                        </div>
                    </div>
                </div>

                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background-color: #f7f7f7;
                    border: 1px solid #dedede;
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 13px;
                    line-height: 18px;
                ">
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Codice</div>
                        <div id="refNonTrovataCodice" style="word-break: break-word;"></div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Id record</div>
                        <div id="refNonTrovataIdRec" style="word-break: break-word;"></div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Pagina attesa</div>
                        <div id="refNonTrovataPagina" style="word-break: break-word;"></div>
                    </div>
                </div>

                <div style="
                    border-left: 4px solid #dc3545;
                    background-color: #fff5f5;
                    padding: 10px;
                    font-size: 13px;
                    line-height: 18px;
                ">
                    Confermando, l'elemento verrà rimosso dall'impaginato sul server. Il documento InDesign non verrà modificato perché l'elemento non è stato trovato in pagina.
                </div>
            </div>
        `);

            messaggio.find("#refNonTrovataCodice").text(codice);
            messaggio.find("#refNonTrovataIdRec").text(idRec);
            messaggio.find("#refNonTrovataPagina").text(paginaAttesa);

            var pulsanti = $(`
            <div style="
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 10px;
                width: 100%;
                margin-top: 16px;
            "></div>
        `);

            var annulla = $(`
            <button style="
                min-width: 110px;
                height: 28px;
                background-color: #f1f1f1;
                color: #222;
                border: 1px solid #cfcfcf;
                border-radius: 5px;
                cursor: pointer;
            ">Mantieni</button>
        `);

            var conferma = $(`
            <button style="
                min-width: 150px;
                height: 28px;
                background-color: #dc3545;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Rimuovi dal server</button>
        `);

            conferma.on("click", function () {
                result = true;
                $("#confirmModal").remove();
            });

            annulla.on("click", function () {
                result = false;
                $("#confirmModal").remove();
            });

            modal.on("click", function (e) {
                e.stopPropagation();
            });

            pulsanti.append(annulla);
            pulsanti.append(conferma);

            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);

            $("body").append(modal);

            while (result == null) {
                await delay(100);
            }

            modali().mostraHidebleElements();

            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm rimozione ref non trovata:", e);
            modali().mostraHidebleElements();
            return false;
        }
    },
};

module.exports = Eliminazione;
