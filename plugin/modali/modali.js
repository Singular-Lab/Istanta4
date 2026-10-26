/// I20-1012: le modali del Plugin, uscite da utility.js.
///
/// Aprire e chiudere una finestra di dialogo, chiedere una conferma, mostrare un avviso. Gli altri
/// file le chiamano Modali.X, come globale dichiarata da indexNew.js; index.html anche dai suoi
/// pulsanti.
///
/// I20-1123: i campi di testo nativi di UXP stanno sopra a qualunque cosa, e fino a I20-1123 le
/// modali li spegnevano uno per uno (.hideble). Ora i campi stanno a riposo come testo HTML
/// (campiARiposo.js) e le finestre li coprono come tutto il resto: aprendosi, mettono a riposo il
/// campo in cui l'operatore sta scrivendo, che e' l'unico nativo a schermo.
///
/// Non fa require('indesign'): si carica sotto Node, e i test la chiamano. In InDesign il DOM e'
/// quello di UXP, e il risultato finale si prova solo in collaudo.
const CampiARiposo = require('../campiARiposo');

const Modali = {
    /// I20-1085: il livello delle domande all'operatore (confirm, confirmCustom). Sta davanti a ogni
    /// finestra del Plugin - il popup delle differenze (9000), i dialoghi a tutto schermo (fino a
    /// 9999999) - e sotto soltanto i suggerimenti (.jq-tooltip, 2147483647). Prima era 5000, e la
    /// domanda "Solo volantino / Tutto" nasceva dietro la finestra delle differenze.
    LIVELLO_CONFERMA: 2147483000,

    /// TASK-19c18841: il piede dei pulsanti di confirmCustom, alto quanto misurato (26/10/2026: 50 px,
    /// margine di sopra compreso). Fisso, perche' lo spazio del messaggio si calcola senza misurarlo.
    ALTEZZA_PIEDE_CONFERMA: 50,

    /// TASK-19c18841: un id nuovo per il messaggio di una conferma, cosi' lo si ritrova nella pagina.
    _contatoreMessaggi: 0,
    nuovoIdMessaggio() {
        Modali._contatoreMessaggi++;
        return "messaggioConferma" + Modali._contatoreMessaggi;
    },

    /// TASK-19c18841: l'altezza massima del messaggio di confirmCustom in un pannello alto
    /// altezzaPannello: quella del riquadro (l'88% del pannello meno i 10 px di margine sopra e
    /// sotto), meno i suoi 14 px di margine sopra e sotto, il piede e 4 px per gli arrotondamenti.
    /// Pannello di 628 px: 453.
    altezzaMassimaMessaggio(altezzaPannello) {
        var altezza = Number(altezzaPannello);
        if (!(altezza > 0)) {
            altezza = 600;
        }
        return Math.max(60, Math.floor((altezza - 20) * 0.88) - 28 - Modali.ALTEZZA_PIEDE_CONFERMA - 4);
    },

    /// Chiede una conferma: Conferma da' true, Annulla false, e un errore vale come Annulla.
    /// message puo' essere un testo (va in un titolo) o un elemento. Attende con delay, la globale
    /// di indexNew.
    async confirm (message){
        //creiamo un confirm con un messaggio di conferma e due pulsanti, uno per confermare e uno per annullare
        //se il pulsante conferma viene premuto allora la funzione torna true, sennò false
        //la funzione è asincrona
        try{
            CampiARiposo.tuttiARiposo();
            var result = null;
            var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: ' + Modali.LIVELLO_CONFERMA + '; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
            //I20-981: il riquadro si adatta al messaggio invece di avere un'altezza fissa, e
            //il testo scorre se e' lungo. Prima, con height 40% e il messaggio in un blocco
            //all'80% senza scorrimento, un testo lungo usciva dal riquadro bianco.
            var dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
            
            //TASK-19c18841: un id unico, per ritrovare il messaggio nella pagina (Modali.nuovoIdMessaggio).
            var idMessaggio = Modali.nuovoIdMessaggio();
            let messaggio = $('<div id="' + idMessaggio + '" style="display: block; flex: 1 1 auto; min-height: 0; overflow: auto;"></div>');
    
            if (typeof message === "string") {
                messaggio.html(`<h3>${message}</h3>`);
            } else if (message instanceof jQuery || message instanceof Element) {
                messaggio.append(message);
            } else {
                messaggio.text(String(message));
            }
            
            //var messaggio = $('<div style="display: flex; height: 80%;"><h3>'+message+'</h3></div>');
            //I pulsanti vanno a capo invece di uscire: su un pannello stretto due pulsanti da
            //cento pixel non stavano in un riquadro largo il 60%.
            var pulsanti = $('<div style="display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; flex: 0 0 auto; padding-top: 12px;"></div>');
            var conferma = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Conferma</button>');
            var annulla = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Annulla</button>');
        
            modal.click(function(e) {
                e.stopPropagation();
            });
        
            conferma.click(function(){
                result = true;
                $("#confirmModal").remove();
            });
        
            annulla.click(function(){
                result = false;
                $("#confirmModal").remove();
            });
        
            pulsanti.append(annulla);
            pulsanti.append(conferma);
            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);
            $("body").append(modal);
        
            //TASK-19c18841: tolta da qualcun altro (Modali.closeAllModal), vale come Annulla, come
            //in confirmCustom: altrimenti l'attesa non finirebbe mai. Si guarda nella pagina, per id.
            while(result == null){
                if (document.getElementById(idMessaggio) == null) {
                    return false;
                }
                await delay(100);
            }
            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm: ", e);
            return false; // In caso di errore, consideriamo l'azione annullata
        }
    },

    /// Chiude tutto quello che puo' essere aperto: il popup, il confirm e la modale principale.
    closeAllModal(){
        $("#popup").remove();
        $("#confirmModal").remove();
        this.chiudiModal();
    },

    /// I20-992: alChiudi, facoltativo, viene chiamato quando l'operatore chiude il popup.
    /// Serve a chi deve rimettere a posto qualcosa fuori dal popup una volta che sparisce -
    /// per esempio il pulsante delle segnalazioni della scheda ref, che dopo un refresh
    /// andato a buon fine non ha piu' ragione di stare li'. Chi non lo passa non cambia
    /// comportamento.
    /// contenutoIntestazione, facoltativo, si mette nella barra del titolo accanto alla X:
    /// e' il posto delle scelte che si leggono quando il popup si chiude, non delle azioni.
    /// Mostra un popup e attende. ATTENZIONE al contratto: rimuove il popup PRIMA di chiamare
    /// alChiudi, e il suo ciclo di attesa non finisce da solo.
    /// accantoAlTitolo (I20-1056): un elemento da mostrare subito dopo il titolo, per esempio un
    /// conteggio che deve restare sotto gli occhi mentre il contenuto scorre.
    async popup(title, message, taglia = "md", alChiudi = null, contenutoIntestazione = null, accantoAlTitolo = null) {
        try {
            let me = this;
            CampiARiposo.tuttiARiposo();
    
            // Dimensioni in base alla taglia
            switch (taglia.toLowerCase()) {
                case "sm":
                    taglia = "width: 30%; height: 20%;";
                    break;
                case "md":
                    taglia = "width: 60%; height: 40%;";
                    break;
                case "lg":
                    taglia = "width: 80%; height: 60%;";
                    break;
                case "xl":
                    taglia = "width: 100%; height: 80%;";
                    break;
                default:
                    taglia = "width: 60%; height: 40%;";
                    break;
            }
    
            let result = null;
    
            // Contenitore modale a schermo intero
            let modal = $(`
                <div id="popup" style="
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: rgba(0,0,0,0.5); z-index: 9000;
                    display: flex; justify-content: center; align-items: center; padding: 10px;
                "></div>
            `);
    
            // Barra del titolo
            let titleBar = $(`
                <div style="
                    display: flex; justify-content: space-between; align-items: center;
                    width: 100%; min-height: 10%; flex: 0 0 auto; background-color: #f1f1f1;
                    padding: 5px; box-sizing: border-box;
                "></div>
            `);
    
            let titleText = $(`<span style="font-size: 16px; font-weight: bold;">${title}</span>`);
            //I20-992: l'id serve a chi deve chiudere il popup da dentro il contenuto, senza
            //rifare a mano la pulizia che fa questo handler.
            let closeButton = $('<button id="popupCloseButton" style="background-color: transparent; border: none; font-size: 18px; cursor: pointer;">&times;</button>');
    
            closeButton.click(function () {
                $("#popup").remove();

                //Il popup e' gia' sparito quando si avvisa: chi ascolta puo' riaprirne un
                //altro senza trovarsi il vecchio ancora attaccato. Un errore qui non deve
                //lasciare il popup a meta'.
                if (typeof alChiudi === "function") {
                    try {
                        alChiudi();
                    }
                    catch (err) {
                        console.error("Errore nel callback di chiusura del popup: ", err);
                    }
                }
            });
    
            //A destra convivono cio' che il chiamante vuole far leggere alla chiusura e la X.
            let gruppoDestro = $('<div style="display: flex; align-items: center; gap: 10px;"></div>');

            if (contenutoIntestazione != null) {
                gruppoDestro.append(contenutoIntestazione);
            }

            gruppoDestro.append(closeButton);
            if (accantoAlTitolo != null) {
                let gruppoSinistro = $('<div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; min-width: 0;"></div>');
                gruppoSinistro.append(titleText).append(accantoAlTitolo);
                titleBar.append(gruppoSinistro).append(gruppoDestro);
            }
            else {
                titleBar.append(titleText).append(gruppoDestro);
            }
    
            // Finestra centrale
            let dialog = $(`
                <div style="${taglia} background-color: white;
                    overflow-y: auto; display: flex; flex-direction: column;
                    justify-content: flex-start; align-items: flex-start; padding: 10px;
                "></div>
            `);
    
            // Corpo del messaggio
            let messaggio = $('<div style="flex: 1; width: 100%; overflow-y: auto;"></div>');
    
            if (typeof message === "string") {
                messaggio.html(`<h3>${message}</h3>`);
            } else if (message instanceof jQuery || message instanceof Element) {
                messaggio.append(message);
            } else {
                messaggio.text(String(message));
            }
    
            modal.click(function (e) {
                e.stopPropagation();
            });
    
            dialog.prepend(titleBar);
            dialog.append(messaggio);
            modal.append(dialog);
            $("body").append(modal);
    
            while (result == null) {
                await delay(100);
            }
    
        } catch (e) {
            console.error("Errore durante la creazione del popup: ", e);
        }
    
        return result;
    },
    
    
    /// Una conferma con uno o due pulsanti dal testo scelto, piu' Annulla. Restituisce
    /// { result, hiddenVal }: result dice se si e' confermato, hiddenVal quale dei due pulsanti,
    /// col valore passato insieme al suo testo.
    async confirmCustom (message, bottoneConfirm1Text, hiddenVal1=null, bottoneConfirm2Text = null, hiddenVal2 = null){
        //creiamo un confirm con un messaggio di conferma e due pulsanti, uno per confermare e uno per annullare
        //se il pulsante conferma viene premuto allora la funzione torna true, sennò false
        //la funzione è asincrona
    
        var result = null;
        CampiARiposo.tuttiARiposo();
        var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: ' + Modali.LIVELLO_CONFERMA + '; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        var dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        //TASK-19c18841: un id unico, per ritrovare il messaggio nella pagina (Modali.nuovoIdMessaggio).
        var idMessaggio = Modali.nuovoIdMessaggio();
        var messaggio = $('<div id="' + idMessaggio + '" style="display: block; flex: 1 1 auto; min-height: 0; overflow: auto;"></div>');
        //I20-1040: come confirm, il messaggio puo' essere un elemento, inserito com'e'; un testo
        //resta in un titolo come prima.
        if (message instanceof jQuery || message instanceof Element) {
            messaggio.append(message);
        } else {
            messaggio.html('<h3 style="margin-top:0;">' + message + '</h3>');
        }
        //TASK-19c18841: il piede dei pulsanti ha un'altezza fissa, cosi' lo spazio del messaggio si
        //calcola senza misurarlo.
        var pulsanti = $('<div style="display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; flex: 0 0 auto; padding-top: 12px; height: ' + Modali.ALTEZZA_PIEDE_CONFERMA + 'px; box-sizing: border-box;"></div>');
        var conferma1 = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm1Text +'</button>');
        if(bottoneConfirm2Text != null){
            var conferma2 = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm2Text +'</button>');
        }
        var annulla = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Annulla</button>');
    
        var objRes = {
            result: false,
            hiddenVal: null,
        }
        //I20-1040: si aspetta la risposta, non hiddenVal: Annulla non lo imposta, e prima
        //l'attesa con Annulla non finiva mai.
        var risposto = false;
    
        modal.click(function(e) {
            e.stopPropagation();
        });
    
        conferma1.click(function(){
            objRes.result = true;
            objRes.hiddenVal = hiddenVal1;
            risposto = true;
            $("#confirmModal").remove();
        });
    
        if(bottoneConfirm2Text != null){
            conferma2.click(function(){
                objRes.result = true;
                objRes.hiddenVal = hiddenVal2;
                risposto = true;
                $("#confirmModal").remove();
            });
        }
    
        annulla.click(function(){
            objRes.result = false;
            risposto = true;
            $("#confirmModal").remove();
        });
    
        pulsanti.append(conferma1);
        if(bottoneConfirm2Text != null){
            pulsanti.append(conferma2);
        }
    
        pulsanti.append(annulla);
        dialog.append(messaggio);
        dialog.append(pulsanti);
        modal.append(dialog);
        $("body").append(modal);

        //I20-1040: in UXP un contenitore scorre solo se ha un'altezza in pixel. Col solo
        //max-height del riquadro un messaggio lungo veniva tagliato, senza modo di leggerlo.
        //TASK-19c18841: il piede dei pulsanti sta fermo in fondo e il messaggio scorre sopra di lui.
        //Il messaggio prende subito un'altezza massima in pixel, dal pannello meno margini e piede:
        //niente misure del contenuto appena inserito, che in UXP possono essere vecchie. E si scrive
        //sullo stile, non con .css di jQuery: per l'altezza jQuery passa da un suo calcolo che in UXP
        //non arriva allo stile. Misurato il 26/10/2026: lo stile restava vuoto, il messaggio (485 px)
        //non si restringeva dentro il riquadro (535) e spingeva i pulsanti 15 px fuori; scritta sullo
        //stile, l'altezza massima teneva il messaggio e lo faceva scorrere.
        //Lo stile e' quello dell'elemento nella pagina, preso per id: messaggio[0] puo' non esserlo.
        //Un elemento jQuery creato da un testo con attributi nasce da un frammento HTML, e in UXP il
        //primo del gruppo non e' sempre il div che finisce nella pagina (misurato il 26/10/2026: le
        //scritture su messaggio[0] non arrivavano, quelle sull'elemento preso dalla pagina si').
        //Se l'altezza massima non bastasse a fermarlo, appena il contenuto la supera il messaggio
        //prende un'altezza fissa uguale: quella in pixel UXP la rispetta di sicuro.
        var massimo = Modali.altezzaMassimaMessaggio(600);
        var altezzaFissata = false;
        try {
            var wrapper = document.getElementById("wrapper");
            var altezzaPannello = wrapper != null && wrapper.clientHeight > 0 ? wrapper.clientHeight
                : (document.body != null ? document.body.clientHeight : 0);
            massimo = Modali.altezzaMassimaMessaggio(altezzaPannello);
            var elMessaggio = document.getElementById(idMessaggio);
            if (elMessaggio != null) {
                elMessaggio.style.flex = "0 0 auto";
                elMessaggio.style.overflowY = "auto";
                elMessaggio.style.maxHeight = massimo + "px";
            }
        }
        catch (e) {
            console.warn("confirmCustom: altezza del messaggio non calcolata", e);
        }
        var fissaSeServe = function () {
            if (altezzaFissata) {
                return;
            }
            var el = document.getElementById(idMessaggio);
            if (el != null && el.scrollHeight > massimo) {
                el.style.height = massimo + "px";
                altezzaFissata = true;
            }
        };
    
        //TASK-19c18841: se la finestra la toglie qualcun altro - Modali.closeAllModal, che parte
        //quando in InDesign si seleziona un box - la risposta non arriverebbe piu' e chi aspetta
        //resterebbe fermo per sempre, in silenzio. Vale come Annulla. Si guarda nella pagina, per id.
        while(!risposto){
            if (document.getElementById(idMessaggio) == null) {
                objRes.result = false;
                objRes.hiddenVal = null;
                break;
            }
            fissaSeServe();
            await delay(100);
        }
    
        return objRes;
    },

    /// Apre la modale principale di index.html (#overlayModal) con dentro una copia dell'elemento
    /// modalId, eventi compresi (cloneElementWithEvents, globale di indexNew). idElementiInTestata
    /// sono altri elementi da copiare nella barra del titolo; hideBehind nasconde il pannello sotto;
    /// scrollRules si ricorda dove tornare a scorrere quando la modale si chiude.
    apriModal(modalId, titolo, bottoneChiusura = true, idElementiInTestata = [], hideBehind = true, scrollRules = null){

        console.log("Apro modale!");
        //I20-1123: il campo in cui si sta scrivendo non resta nativo sopra la finestra.
        CampiARiposo.tuttiARiposo();
        //I20-1105: il controllo della X e' della finestra che lo registra, non passa alla successiva.
        this.controlloPrimaDiChiudere = null;

        //var dialog = $("#"+modalId).clone();
        var dialog = cloneElementWithEvents($("#"+modalId));
        console.log(dialog);
        dialog.css("display", "block");
        //impostiamo un attr che ricordi il val di scrollTop
        $("#bodyModal").attr("scrollTop", scrollRules ? scrollRules.scrollTop : 0);
        $("#bodyModal").attr("scrollIdContainer", scrollRules ? scrollRules.scrollIdContainer : "");
        $("#bodyModal").empty();
        $("#modalTitle").text((titolo != null ? titolo : ""));
        $("#bodyModal").append(dialog);
        $("#overlayModal").css("display", "flex");
        if(!bottoneChiusura){
            $("#closeModal").hide();
        }
        else if (bottoneChiusura){
            $("#closeModal").show();
        }
        
        //rimuoviamo tutti gli elementi aggiunti in precedenza
        $(".elementoAggiunto").remove();
    
        //per ogni id in idElementiInTestata cloniamo con eventi l'elemento e lo appendiamo prima del bottone di chiusura, assegnandogli una classe che indica che è un elemento aggiunto
        for(var i = 0; i < idElementiInTestata.length; i++){
            var element = cloneElementWithEvents($("#"+idElementiInTestata[i]));
            element.addClass("elementoAggiunto");
            //mettiamo a display flex
            element.css("display", "flex");
            $("#closeModal").before(element);
        }
    
        if(hideBehind){
            //prima era commentato
            $("#mainContent").hide();
        }

    },

    /// Come apriModal, ma in un overlay diverso da quello principale, #overlayModal piu' il
    /// suffisso: serve quando una modale si apre sopra un'altra, come il sync del pacchetto foto.
    apriModalCustom(modalId, titolo, suffissoOverlayModal, bottoneChiusura = true, idElementiInTestata = [], hideBehind = true){

        console.log("Apro modale!");
        //I20-1123: il campo in cui si sta scrivendo non resta nativo sopra la finestra.
        CampiARiposo.tuttiARiposo();
    
        var dialog = cloneElementWithEvents($("#"+modalId));
        console.log(dialog);
        dialog.css("display", "block");
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").empty();
        $("#overlayModal"+suffissoOverlayModal).find("#modalTitle").text((titolo != null ? titolo : ""));
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").append(dialog);
        $("#overlayModal"+suffissoOverlayModal).css("display", "flex");
        if(!bottoneChiusura){
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").hide();
        }
        else if (bottoneChiusura){
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").show();
        }
        
        //rimuoviamo tutti gli elementi aggiunti in precedenza
        $("#overlayModal"+suffissoOverlayModal).find(".elementoAggiunto").remove();
    
        //per ogni id in idElementiInTestata cloniamo con eventi l'elemento e lo appendiamo prima del bottone di chiusura, assegnandogli una classe che indica che è un elemento aggiunto
        for(var i = 0; i < idElementiInTestata.length; i++){
            var element = cloneElementWithEvents($("#"+idElementiInTestata[i]));
            element.addClass("elementoAggiunto");
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").before(element);
        }
    
        if(hideBehind){
            //$("#mainContent").hide();
        }

    },
    
    /// Chiude l'overlay aperto da apriModalCustom con lo stesso suffisso.
    chiudiModalCustom(suffissoOverlayModal){
        $("#overlayModal"+suffissoOverlayModal).hide();
        $("#mainContent").show();
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").empty();
    },

    /// I20-1105: chi apre la modale principale puo' registrare un controllo per la X: una funzione
    /// che restituisce il testo dell'avviso se chiudere adesso farebbe perdere qualcosa (modifiche
    /// non salvate), oppure null. Vale fino alla chiusura o all'apertura di un'altra modale.
    controlloPrimaDiChiudere: null,

    impostaControlloPrimaDiChiudere(controllo) {
        this.controlloPrimaDiChiudere = typeof controllo === "function" ? controllo : null;
    },

    /// I20-1105: la X della modale principale. Se il controllo registrato ha un avviso, chiede
    /// "Esci senza salvare" o "Annulla", e chiude solo nel primo caso; senza controllo, o senza
    /// niente da perdere, chiude come prima. Le chiusure fatte dal codice passano da chiudiModal e
    /// non chiedono: chi chiude dopo aver salvato non deve ricevere domande. Torna true se ha chiuso.
    async chiudiModalDallaX() {
        var controllo = this.controlloPrimaDiChiudere;
        if (typeof controllo === "function") {
            var avviso = null;
            try {
                avviso = controllo();
            }
            catch (e) {
                //Un controllo rotto non deve impedire di chiudere: si dice in console e si chiude.
                console.error("Controllo prima di chiudere la finestra non riuscito", e);
            }
            if (avviso) {
                var risposta = await this.confirmCustom(avviso, "Esci senza salvare");
                if (risposta == null || !risposta.result) {
                    return false;
                }
            }
        }
        this.chiudiModal();
        return true;
    },

    /// Chiude la modale principale, rimette il pannello e, se apriModal aveva delle scrollRules,
    /// riporta il contenitore dove l'operatore l'aveva lasciato.
    chiudiModal(){
        //I20-1105: chiusa la finestra, il suo controllo della X non serve piu'.
        this.controlloPrimaDiChiudere = null;
        $("#overlayModal").hide();
        $("#mainContent").show();
        $("#overlayModal").find("#bodyModal").empty();
        //cerchiamo se ci sono scroll rules attive e in caso scrolliamo il container alla posizione scrollTop
        let scrollTop = $("#overlayModal").find("#bodyModal").attr("scrollTop");
        let scrollIdContainer = $("#overlayModal").find("#bodyModal").attr("scrollIdContainer");
        if(scrollIdContainer != null && scrollIdContainer != "" && scrollTop != null && scrollTop != ""){
            $("#" + scrollIdContainer).scrollTop(scrollTop);
        }
    },
};

//Le conferme dell'eliminazione stanno in un file loro, ma sono lo stesso oggetto: un solo this.
Object.assign(Modali, require('./eliminazione'));

module.exports = Modali;
