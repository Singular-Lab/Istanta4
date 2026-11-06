/// Le funzioni delle schede del pannello. Le chiamano sia il codice sia gli onclick del
/// markup di index.html.
///
/// I20-1005: fino ad allora index.html ne teneva una copia sua, gia' divergente, che
/// chiamavano i click. Le differenze servivano solo al click - ridisegnare il tracciato
/// entrando in home, caricare la home dei filtri entrando nel menabo' - e il codice non
/// deve farle: EVENT_NO_REF_SELECTED torna alla home a ogni deselezione, e ridisegnerebbe
/// il tracciato a ogni click nel vuoto. Ora quelle azioni le dichiara il markup, col
/// data-method dell'immagine, e changeSubMenu le esegue solo se gli si dice che il click
/// e' dell'operatore.
///
/// Usa come globali $, document, onresizeWindow, Modali (I20-1205, in clicVoce) e, dentro
/// metodiDaMarkup, filtriJs e mostraTracciato: le mette indexNew, e sotto Node le mette il test.

const jsIndexControls = {

    /// I nomi che il markup puo' scrivere in data-method, e la funzione che corrisponde a
    /// ciascuno. Un data-method non registrato qui non fa niente e non da' errore.
    /// Le globali si leggono al momento della chiamata: quando questo modulo si carica,
    /// indexNew non le ha ancora dichiarate.
    metodiDaMarkup: {
        "filtriJs.visualizzaHomePageFiltri": () => filtriJs.visualizzaHomePageFiltri(),
        "mostraTracciato": () => mostraTracciato()
    },

    /// La funzione registrata per quel data-method, o null.
    metodoDaMarkup(nome) {
        if (nome == null || !Object.prototype.hasOwnProperty.call(this.metodiDaMarkup, nome)) {
            return null;
        }
        return this.metodiDaMarkup[nome];
    },

    /// Nasconde tutti i sottomenu'.
    clearSubmenu() {
        $(".subMenuTabs").find('div[class*="subTab"]').each(function () {
            $(this).css('display', 'none');
        });
    },

    /// Mostra il sottomenu' della scheda e apre il primo elemento visibile: e' cosi' che
    /// entrando in una scheda si apre gia' la prima sottoscheda.
    ///
    /// daOperatore lo passano solo gli onclick della barra: allora, dopo aver aperto la
    /// sottoscheda, si esegue anche il suo data-method. Il codice non lo passa.
    changeSubMenu(tabName, daOperatore = false) {
        let me = this;
        console.warn('changeSubMenu ' + tabName);
        var subMenu = $(".sub" + tabName);

        me.clearSubmenu();

        //mostraimo il subMenu selezionato
        $(subMenu).css('display', 'flex');
        //troviamo tra i figli del subMenu il primo elemento che non sia a display none e lo apriamo
        $(subMenu).find('img').each(function () {
            if ($(this).css('display') != 'none') {
                //leggiamo il suo attributo tab
                var tab = $(this).attr('tab');
                var fn = daOperatore ? me.metodoDaMarkup($(this).data("method")) : null;
                me.openTab(null, tab, fn);
                console.warn('tab ' + tab);
                me.changeImage($(this));
                return false;
            }
        });
    },

    /// Nasconde tutte le schede e mostra quella chiesta, con le eccezioni dello switch:
    /// Tab5 mostra "Salva", Tab6 "Conferma", Tab7, Tab8 e Tab13 nascondono entrambi.
    /// functionToCall, se c'e', si esegue dopo che la scheda e' visibile.
    openTab(evt, tabName, functionToCall = null) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
            tabcontent[i].parentNode.style.display = "none";
        }
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        document.getElementById(tabName).parentNode.style.display = "block";
        //creiamo un eccezione per le tab della ref
        switch (tabName) {
            case 'Tab5':
                $("#salvaButton").css('display', 'block');
                $("#confermaButton").css('display', 'none');
                break;
            case 'Tab6':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'block');
                break;
            case 'Tab7':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
                break;
            case 'Tab8':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
                break;
            case 'Tab13':
                $("#salvaButton").css('display', 'none');
                $("#confermaButton").css('display', 'none');
                break;
            default:
                break;
        }

        console.warn("opentab " + tabName);

        if (functionToCall && typeof functionToCall === 'function') {
            functionToCall();
        }
        onresizeWindow();
    },

    /// Il pulsante e' un'immagine e "acceso" vuol dire un file diverso: spegne il fratello
    /// attivo togliendo _active dal nome e accende il cliccato aggiungendolo.
    changeImage(sender) {
        //il sender è un oggetto di tipo img, noi dobbiamo eseguire due passaggi, il primo tornare dal sender al padre e cercare l'oggetto con l'immagine il cui nome contiene _active e sostituire l'immagine con l'immagine che non contiene _active, poi sostituire l'immagine del sender con l'immagine che contiene _active, usiamo il jquery per fare questo
        var parent = $(sender).parent();
        var img = $(parent).find('img[src*="active"]');
        var src = $(img).attr('src');

        if (img.length > 0 && img.attr('src') != sender.attr('src')) {
            console.log('cambio immagine');
            console.log(img);
            console.log(sender);
            console.log(src);
            var newSrc = src.replace('_active', '');
            $(img).attr('src', newSrc);
            $(img).attr('active', "false");
        }

        if (img == null || img.attr('src') != sender.attr('src')) {
            src = $(sender).attr('src');
            console.log(src);
            var newSrc = src.replace('.png', '_active.png');
            $(sender).attr('src', newSrc);
            $(sender).attr('active', "true");
        }

    },

    /// I20-1205: chi puo' fermare un clic del menu': avviso() torna la domanda da fare prima di
    /// lasciare la schermata aperta, o null se non c'e' niente da perdere; scarta() butta via le
    /// modifiche quando l'operatore esce lo stesso. La registra indexNew (oggi la scheda Foto P/S).
    guardiaUscita: null,

    impostaGuardiaUscita(avviso, scarta = null) {
        this.guardiaUscita = typeof avviso === "function"
            ? { avviso: avviso, scarta: typeof scarta === "function" ? scarta : null }
            : null;
    },

    /// I20-1205: la domanda della guardia, o null. Un errore della guardia non blocca il menu'.
    avvisoDiUscita() {
        if (this.guardiaUscita == null) {
            return null;
        }
        try {
            return this.guardiaUscita.avviso() || null;
        }
        catch (e) {
            console.error("I20-1205: la guardia del menu' non ha risposto: " + e);
            return null;
        }
    },

    /// I20-1205: il clic dell'operatore su una voce del menu'; azione e' quello che l'onclick faceva
    /// prima. Se la schermata aperta ha modifiche non applicate, prima la domanda: restando non
    /// succede niente, uscendo le modifiche si scartano e il clic fa quello che doveva. Senza niente
    /// da chiedere l'azione parte subito, come prima. tabName, se c'e', e' la scheda che la voce
    /// apre: ricliccare la scheda gia' aperta non e' un'uscita.
    clicVoce(tabName, azione) {
        var aperta = tabName != null && typeof document !== "undefined" && document.getElementById(tabName) != null
            && document.getElementById(tabName).style.display == "block";
        var avviso = aperta ? null : this.avvisoDiUscita();
        if (avviso == null) {
            azione();
            return Promise.resolve(true);
        }
        let me = this;
        return Modali.confirm(avviso).then(function (esci) {
            if (!esci) {
                return false;
            }
            if (me.guardiaUscita != null && me.guardiaUscita.scarta != null) {
                me.guardiaUscita.scarta();
            }
            azione();
            return true;
        });
    },

    /// Quale scheda e' accesa, letta dall'attributo active delle immagini della barra.
    /// Null se non ce n'e' nessuna.
    findOpenedTab() {
        //cerchiamo in #barraTab il primo elemento il cui attr active è true
        var tab = $("#barraTab").find('img[active="true"]');
        if (tab.length > 0) {
            var tabName = $(tab).attr('id');
            console.warn('findOpenTab ' + tabName);
            return tabName;
        } else {
            return null;
        }
    }

};

module.exports = jsIndexControls;
