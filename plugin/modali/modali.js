/// I20-1012: le modali del Plugin, uscite da utility.js.
///
/// Aprire e chiudere una finestra di dialogo, chiedere una conferma, mostrare un avviso. Gli altri
/// file le chiamano Modali.X, come globale dichiarata da indexNew.js; index.html anche dai suoi
/// pulsanti.
///
/// Qui ci sono anche isElementVisible, nascondiHidebleElements e mostraHidebleElements: mentre una
/// modale e' aperta gli elementi .hideble del pannello spariscono, perche' in UXP i controlli
/// nativi restano sopra a qualunque cosa. Le usano le modali e il calendario di menu.js.
///
/// Non fa require('indesign'): si carica sotto Node, e i test la chiamano. In InDesign il DOM e'
/// quello di UXP, e il risultato finale si prova solo in collaudo.
const Modali = {
    /// Se un elemento jQuery si vede davvero: lui e tutti i suoi genitori, fino al body. Serve a
    /// nascondiHidebleElements, che deve ricordarsi solo di quelli che erano visibili.
    isElementVisible(elem) {
        try{
            if (elem[0].localName === document.body.localName || elem.parent() == null) return true; // Se l'elemento è il body, è considerato visibile
            if (!elem || elem.css("display") === 'none' || elem.css("visibility") === 'none' || elem.css("visibility") === 'hidden') return false; // Controlla se l'elemento è nascosto
            return this.isElementVisible(elem.parent()); // Ricorsione per controllare i genitori
        }
        catch (e) {
            console.error("Errore durante il controllo della visibilità dell'elemento: ", e);
            return false; // In caso di errore, consideriamo l'elemento non visibile
        }
    },

    /// Nasconde gli elementi .hideble del pannello mentre una modale e' aperta. In UXP i controlli
    /// nativi (i picker, i campi sp-*) restano disegnati sopra a qualunque cosa, anche sopra
    /// l'overlay: vanno spenti. Si segnano con hidden, per riaccendere solo quelli spenti qui.
    nascondiHidebleElements() {
        let me = this;
        $(".hideble").each(function() {
            if (me.isElementVisible($(this))) {
                $(this).css("visibility","hidden");
                $(this).attr("hidden", true);
            }
        });
    },

    /// Riaccende gli elementi .hideble spenti da nascondiHidebleElements, e solo quelli.
    mostraHidebleElements() {
        $(".hideble[hidden]").each(function () {
            $(this).css("visibility", "visible");
            //rimuoviamo la prop nascosta
            $(this).removeAttr("hidden");                
        });
    },

    /// Chiede una conferma: Conferma da' true, Annulla false, e un errore vale come Annulla.
    /// message puo' essere un testo (va in un titolo) o un elemento. Attende con delay, la globale
    /// di indexNew.
    async confirm (message){
        //creiamo un confirm con un messaggio di conferma e due pulsanti, uno per confermare e uno per annullare
        //se il pulsante conferma viene premuto allora la funzione torna true, sennò false
        //la funzione è asincrona
        try{
            this.nascondiHidebleElements();
            var result = null;
            var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
            //I20-981: il riquadro si adatta al messaggio invece di avere un'altezza fissa, e
            //il testo scorre se e' lungo. Prima, con height 40% e il messaggio in un blocco
            //all'80% senza scorrimento, un testo lungo usciva dal riquadro bianco.
            var dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
            
            let messaggio = $('<div style="display: block; flex: 1 1 auto; min-height: 0; overflow: auto;"></div>');
    
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
        
            while(result == null){
                await delay(100);
            }
            this.mostraHidebleElements();
            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm: ", e);
            this.mostraHidebleElements();
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
    async popup(title, message, taglia = "md", alChiudi = null, contenutoIntestazione = null) {
        try {
            let me = this;
            me.nascondiHidebleElements();
    
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
                me.mostraHidebleElements();
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
            titleBar.append(titleText).append(gruppoDestro);
    
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
        this.nascondiHidebleElements();
        var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        var dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        var messaggio = $('<div style="display: block; flex: 1 1 auto; min-height: 0; overflow: auto;"><h3 style="margin-top:0;">'+message+'</h3></div>');
        var pulsanti = $('<div style="display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; flex: 0 0 auto; padding-top: 12px;"></div>');
        var conferma1 = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm1Text +'</button>');
        if(bottoneConfirm2Text != null){
            var conferma2 = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm2Text +'</button>');
        }
        var annulla = $('<button style="min-width: 88px; height: 26px; padding: 0 10px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Annulla</button>');
    
        var objRes = {
            result: false,
            hiddenVal: null,
        }
    
        modal.click(function(e) {
            e.stopPropagation();
        });
    
        conferma1.click(function(){
            objRes.result = true;
            objRes.hiddenVal = hiddenVal1;
            $("#confirmModal").remove();
        });
    
        if(bottoneConfirm2Text != null){
            conferma2.click(function(){
                objRes.result = true;
                objRes.hiddenVal = hiddenVal2;
                $("#confirmModal").remove();
            });
        }
    
        annulla.click(function(){
            objRes.result = false;
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
    
        while(objRes.hiddenVal == null){
            await delay(100);
        }
    
        this.mostraHidebleElements();
    
        return objRes;
    },

    /// Apre la modale principale di index.html (#overlayModal) con dentro una copia dell'elemento
    /// modalId, eventi compresi (cloneElementWithEvents, globale di indexNew). idElementiInTestata
    /// sono altri elementi da copiare nella barra del titolo; hideBehind nasconde il pannello sotto;
    /// scrollRules si ricorda dove tornare a scorrere quando la modale si chiude.
    apriModal(modalId, titolo, bottoneChiusura = true, idElementiInTestata = [], hideBehind = true, scrollRules = null){

        console.log("Apro modale!");
    
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

    /// Chiude la modale principale, rimette il pannello e, se apriModal aveva delle scrollRules,
    /// riporta il contenitore dove l'operatore l'aveva lasciato.
    chiudiModal(){
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
