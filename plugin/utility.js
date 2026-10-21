const { app, LocationOptions, Justification, VerticalJustification } = require('indesign');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
//I20-1015: FotoPlacer sta in reperimentoFoto/, e da qui si riesporta com'era.
const FotoPlacer = require('./reperimentoFoto/fotoPlacer');
//I20-1012: i tratti di stile di un campo ora stanno in testoTag.js.
const TestoTag = require('./testoTag');
const cssComposizioneBox = require('./cssFramework/composizioneBox');

/// I20-1002: il file in cui era finito tutto quello che non aveva un posto.
///
/// I20-1012 l'ha diviso. Ne sono uscite quattro famiglie, ciascuna con un oggetto suo che
/// indexNew.js dichiara come globale:
///   - Modali (modali/): confirm, popup, apriModal, chiudiModal e le conferme di eliminazione;
///   - Tooltip (tooltip/): i suggerimenti al passaggio del mouse;
///   - Menu (menu.js): il menu flottante, i picker, il calendario;
///   - TestoTag (testoTag.js): il testo dei campi con i suoi tag e i suoi stili.
/// Prima ancora, I20-1015 aveva portato via i bolli, getLinkHash e FotoPlacer.
///
/// Qui resta quello che le agenzie chiamano per nome, Utility.X, da Agenzie/*/custom.js e da
/// custom.js: le etichette e il DNA del box (parseLabel, getFieldByLabel, setCampoDNA,
/// getDnaOfBox...), le utilita' vere (sleep, generateId, replaceAll, cercaChiaveContesto,
/// applyObjectStyle...) e un resto che non ha ancora una casa: il bollino custom, la lista dei
/// codici impaginati, il pasteboard. getLetturaFacilitataDellaParola e' andata in filtri.js.
///
/// Le ricollocazioni che I20-1002 aveva annotato - normalize, isIn, getValueByPath e toFitOptions
/// da pluginMiddleware, calcolaDistanza da griglia - non si sono fatte: hanno chiamanti solo nel
/// proprio file, e portarle qui aggiungerebbe una dipendenza senza motivo.
const Utility=
{
    /// Il campo di un box, cercato per etichetta. E' una delle funzioni piu' chiamate del
    /// Plugin.
    getFieldByLabel:function(label, box, parseLabel = true)
    {
        let result=null;

        if (!box.isValid)
        {
            return result;
        }

        //I20-995: gli elementi si chiedono una volta. Scritto nella condizione del for, il
        //conto tornava a InDesign a ogni giro.
        let elementi=box.allPageItems;

        for (let i=0; i<elementi.length; i++)
        {
            let campo=elementi[i];
            if (!campo.isValid)
            {
                return null;
            }

            if ((parseLabel ? Utility.parseLabel(campo.label) : campo.label) == label)
                return campo;
        }

        return result;
    },
    /// Tutti i campi dentro un box, scendendo nei gruppi annidati.
    getAllFieldsInGroup:function(box)
    {
        let result=[];

        if (!box.isValid)
        {
            return result;
        }

        //I20-995: come sopra, la collection si chiede una volta sola.
        let elementi=box.allPageItems;

        for (let i=0; i<elementi.length; i++)
        {
            let campo=elementi[i];
            if (campo.label!="")
            {
                result.push({ label: Utility.parseLabel(campo.label), item: campo });
                if (Utility.parseLabel(campo.label)=="descrizione")
                {
                    //Estrapolo tutti gli stili coinvolti
                    //
                    //I20-995: a tratti e non a caratteri. Prima ogni carattere costava la sua
                    //lettura da InDesign, un filtro sulla lista degli stili universali e un
                    //console.log: su una descrizione lunga era il passaggio piu' caro
                    //dell'apertura della scheda, e serviva solo a dire quali stili ci sono.
                    let stileAnomalo = {label:""};
                    let tratti = TestoTag.trattiDiStileDelCampo(campo);
                    //La lista si chiede solo se c'e' qualcosa da confrontarci, come quando la
                    //si chiedeva dentro il ciclo: un campo vuoto non la chiedeva mai.
                    let stiliUniversali = tratti.length > 0 ? pluginMiddleware.getCampo("listaStiliUniversali") : null;

                    for (var ich = 0; ich < tratti.length; ich++) {

                        let styName = tratti[ich].nome;

                        if (stiliUniversali.filter(s=>styName.startsWith(s.nome)).length<=0)
                        {
                            let lab="descrizione#" +  styName;
                            if (stileAnomalo.label!=lab)
                            {
                                if (stileAnomalo.label!="")
                                {
                                    result.push(stileAnomalo);
                                }
                                
                                //Trovato uno stile anomalo
                                stileAnomalo.label= lab;
                            }
                            //La linea dell'ultimo carattere del tratto, che e' quella a cui
                            //arrivava il ciclo per carattere quando lo stile finiva.
                            stileAnomalo.item = tratti[ich].ultimaOrigine.characters.item(-1).lines.item(0);//La linea
                            
                        }
                        
                    }

                    if (stileAnomalo.label!="")
                    {
                        result.push(stileAnomalo);
                    }

                }



            }
        }

        return result;
    },

    getMasterSpreadByName(label, doc = docInLavorazione) {
        try {
            //var myDocument = app.documents.item(0);
            for (var $za = 0; $za < doc.masterSpreads.length; $za++) {
                //console.error(doc.masterSpreads.item($za).name + "=="+label);
                if (doc.masterSpreads.item($za).name == label)
                    return doc.masterSpreads.item($za);
            }
        }
        catch (error) {
            //console.error("Mastro " + label + " non trovata");
        }
    
        return null;
    },
    sleep:function(ms)
    {        
        return new Promise(resolve=>setTimeout(resolve, ms));        
    },
    getDirSeparator:function()
    {
        let sep="/";
        let platform=require('os').platform().toLowerCase();
        platform.indexOf("win") == 0 ? sep="\\" : sep="/";
        return sep;        
    },
    /// I20-1029: etichettaBollino, facoltativa, va sull'ovale: e' dove le segnalazioni di
    /// impaginazione scrivono tutte le loro voci (segnalazioni/etichetta.js). Senza, come prima.
    addBollinoCustom(box, text, colorString, colorGradient, positionEnum = 1, customBoundsRelativeToBox = null, overflowControls = true, etichettaBollino = null){
    
        //position enum{0:topLeft, 1:topRight, 2:bottomLeft, 3:bottomRight, 4 center}
        //creiamo un nuovo oval (circolare) e lo posizioniamo in base al positionEnum nella posizione corrispondente del box, la grandezza è di 10px
        //i colorString validi sono solo Red, Green, Yellow, Orange, Blue, White
        let size = 10;
        //controlliamo che positionEnum sia un int
        if (isNaN(positionEnum)) {
            if(customBoundsRelativeToBox == null){
                console.warn("PositionEnum non valido, inserire un intero tra 0 e 4");
                return;
            }
        }

        //calcoliamo i bounds del bollino
        if (!isNaN(positionEnum) && customBoundsRelativeToBox == null) {
            switch (positionEnum) {
                case 0:
                    bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + size, box.geometricBounds[1] + size];
                    break;
                case 1:
                    bounds_rect = [box.geometricBounds[0], box.geometricBounds[3] - size, box.geometricBounds[0] + size, box.geometricBounds[3]];
                    break;
                case 2:
                    bounds_rect = [box.geometricBounds[2] - size, box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[1] + size];
                    break;
                case 3:
                    bounds_rect = [box.geometricBounds[2] - size, box.geometricBounds[3] - size, box.geometricBounds[2], box.geometricBounds[3]];
                    break;
                case 4:
                    bounds_rect = [box.geometricBounds[0] + (box.geometricBounds[2] - box.geometricBounds[0]) / 2 - size / 2,
                    box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1]) / 2 - size / 2,
                    box.geometricBounds[0] + (box.geometricBounds[2] - box.geometricBounds[0]) / 2 + size / 2,
                    box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1]) / 2 + size / 2];
                    break;
                default:
                    bounds_rect = [box.geometricBounds[0], box.geometricBounds[3] - size, box.geometricBounds[0] + size, box.geometricBounds[3]];
                    break;
            }
        }
        else if (customBoundsRelativeToBox != null) {
            bounds_rect = customBoundsRelativeToBox;
        }
        else{
            console.warn("Bounds non validi, inserire un array di 4 elementi [top, left, bottom, right] oppure usare il parametro positionEnum");
            return;
        }
        var parentPage = box.parentPage;

        let bollino = parentPage.ovals.add(box.itemLayer, LocationOptions.UNKNOWN, box, { geometricBounds: bounds_rect });
        if (etichettaBollino != null) {
            bollino.label = etichettaBollino;
        }


        //adesso se color string non è null o vuoto applichiamo il colore
        if (colorString != null && colorString != "") {
            colorString = colorString.toLowerCase();
            switch (colorString) {
                case "red":
                    var myColor = docInLavorazione.colors.itemByName("Red");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Red", model: ColorModel.process, colorValue: [0, 100, 20, 20] });
                    }
                    bollino.fillColor = myColor;
                    break;
                case "green":
                    var myColor = docInLavorazione.colors.itemByName("Green");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Green", model: ColorModel.process, colorValue: [100, 0, 100, 0] });
                    }
                    bollino.fillColor = myColor;
                    break;
                case "yellow":
                    var myColor = docInLavorazione.colors.itemByName("Yellow");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Yellow", model: ColorModel.process, colorValue: [0, 0, 100, 0] });
                    }
                    bollino.fillColor = myColor;
                    break;
                case "orange":
                    var myColor = docInLavorazione.colors.itemByName("Orange");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Orange", model: ColorModel.process, colorValue: [0, 50, 100, 0] });
                    }
                    bollino.fillColor = myColor;
                    break;
                case "blue":
                    var myColor = docInLavorazione.colors.itemByName("Blue");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Blue", model: ColorModel.process, colorValue: [100, 100, 0, 0] });
                    }
                    bollino.fillColor = myColor;
                    break;
                case "white":
                    bollino.fillColor = "White";
                    break;
                default:
                    console.warn("ColorString non valida, inserire un colore valido tra Red, Green, Yellow, Orange, Blue, White. O usare il parametro colorGradient");
                    break;
            }
        }

        if(colorGradient != null && colorGradient.length == 3){
            var myColor = docInLavorazione.colors.itemByName("CustomColor"+colorGradient[0]+"-"+colorGradient[1]+"-"+colorGradient[2]);
            //color gradient è un array [x,y,z] in cui i 3 valori rappresentano RGB (0-100), alpha è sempre 100
            if (myColor == null|| myColor.isValid == false) {
                myColor = docInLavorazione.colors.add({ name: "CustomColor"+colorGradient[0]+"-"+colorGradient[1]+"-"+colorGradient[2], model: ColorModel.process, colorValue: colorGradient });
            }
            bollino.fillColor = myColor;
        }

        //adesso se text non è null o vuoto creiamo un textFrame con il testo
        if (text != null && text != "") {
            var textFrame = bollino.textFrames.add();
            textFrame.contents = text;
            textFrame.geometricBounds = bounds_rect;
            textFrame.parentStory.justification = VerticalJustification.CENTER_ALIGN;
            textFrame.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;
            //aumentiamo il fonto size
            textFrame.texts.item(0).pointSize = 12;
            //controlliamo se il testo è in overflow, se lo è riduciamo il fontSize di 1 finchè non lo è più o il fontSize è minore di 1
            while (textFrame.overflows && textFrame.texts.item(0).pointSize > 1 && overflowControls) {
                textFrame.texts.item(0).pointSize -= 1;
            }
        }

        var oldLabel = box.label;

        try {
            var newItems = [box, bollino];   
            var newGroup = parentPage.groups.add(newItems);
            box.ungroup();
            newGroup.label = oldLabel;
            //base.sendToBack();
            return newGroup;
        }
        catch(e){
            console.error("Errore durante la creazione del bollino: ", e);
            try{
                //gruppiamo di nuovo solo il gruppo originale
                // var newGroup = parentPage.groups.add(oldItems);
                // newGroup.label = oldLabel;
                return box;
            }
            catch(e2){
                console.error("Errore durante il rollback del bollino: ", e2);
                messaggioUtente("Code TLY-06: Errore durante la creazione del bollino: " + e, "error");
                //se siamo qui vuol dire che si è ripresentato l'errore di indesin che fallisce a creare il gruppo, cose da provare sono:
                //testare se gruppare il bollino con il box (non i singoli elementi) funziona 
                //vedere se altri processi che fanno group e poi ungroup danno lo stesso problema
                return null;
            }
        }

        // var newBox = parentPage.groups.add([box, bollino]);
        // return newBox;

    },

    moveToPasteBoard(el){
        el.move([-1000, el.geometricBounds[0]]);
    },


    replaceAllSpecialCharacters(str){
        // {chiave: "\r\n", valore: "\n"} abbiamo visto che /r/n da problemi creando una doppia interlinea, quindi lo sostituiamo con /n. Warning
        let listSpecialCharacters = [ {chiave: "\r\n", valore: "\n"},{chiave: "$br", valore: "\n"},{chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "SINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "SINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "\u2019", valore: "'"}, {chiave: "\u2018", valore: "'"}, {chiave: "\u02BC", valore: "'"}, {chiave: "\uFF07", valore: "'"}, {chiave: "\u00B4", valore: "'"}, {chiave:"BULLET_CHARACTER", valore:"\u2022"}, {chiave:"DEGREE_SYMBOL", valore:"°"}   ];
        let me = this;
        listSpecialCharacters.forEach(function(specialCharacter){
            str = me.replaceAll(str, specialCharacter.chiave, specialCharacter.valore);
        });

        return str;
    },
    replaceAll(str, strOrigin, newStr){
        if (str==strOrigin)
            return newStr;

        var splitted = str.split(strOrigin);
        str = splitted.join(newStr);
        return str;
    },

    async getGrigliaFromPage(pageName){
        //restituisce la griglia della pagina specificata
        //se la pagina non ha una griglia, restituisce null
        //var page = docInLavorazione.pages.item(pageNumber);
        var page = docInLavorazione.pages.itemByName(pageName);
        if (page == null || !page.isValid) {
            return null;
        }
        //scorriamo gli elementi nel livello "Griglia" della pagina e cerchiamo uno la cui etichetta inizia con griglia_
        var griglia = null;

        var items = page.pageItems.everyItem().getElements();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.visible && item.label != null && item.label.startsWith("griglia_")) {
                griglia = item;
                break;
            }
        }

        return griglia;

    },
        
    impostaValHiddenVal(element, nomeVal, valore) {
        if (element == null) return;
        element.attr(nomeVal, valore);
    },

    /// I20-1031: con { nullSeFallisce: true } restituisce null invece di [] se la chiamata non
    /// riesce, cosi' chi mostra un conteggio sa distinguere "nessuno" da "non lo so". Senza
    /// opzioni si comporta come prima.
    /// I20-1034: il nome del file della lista del kit, con le sigle di canale e area della
    /// lavorazione davanti al nome di sempre - "CN_TO_listaKit302.json" -, cosi' nella cartella
    /// si riconosce a colpo d'occhio. Solo le sigle che ci sono; senza nessuna, "listaKit302.json".
    nomeFileListaKit(idKit, siglaCanale, siglaArea) {
        const sigle = [siglaCanale, siglaArea]
            .filter(s => s != null && s !== 0 && String(s).trim() !== "")
            .map(s => String(s).trim());
        return (sigle.length > 0 ? sigle.join("_") + "_" : "") + "listaKit" + idKit + ".json";
    },

    /// I20-1034: se un nome di file e' la lista del kit idKit, con o senza sigle davanti: finisce
    /// con "listaKit<idKit>.json", e prima c'e' l'inizio del nome o un "_". Cosi' "listaKit1302"
    /// non passa per "listaKit302".
    eFileListaKit(nome, idKit) {
        const fine = "listaKit" + idKit + ".json";
        const n = String(nome == null ? "" : nome);
        if (!n.endsWith(fine)) {
            return false;
        }
        const prima = n.length - fine.length;
        return prima === 0 || n.charAt(prima - 1) === "_";
    },

    /// Le sigle di canale e area per la lista del kit idKit: quelle della lavorazione aperta, se
    /// il kit e' il suo; altrimenti nessuna.
    _sigleListaKit(idKit) {
        try {
            if (typeof idKitLavorazione === "undefined" || typeof ficoProcess === "undefined" || ficoProcess == null
                || String(idKit) !== String(idKitLavorazione)) {
                return [null, null];
            }
            const canale = ficoProcess.getCanaleLavorazioneCorrente();
            const area = ficoProcess.getAreaLavorazioneCorrente();
            return [canale != null ? canale.sigla : null, area != null ? area.sigla : null];
        }
        catch (e) {
            return [null, null];
        }
    },

    /// I20-1034: dove scrivere la lista del kit appena scaricata: il nome con le sigle. I file con
    /// un altro nome per lo stesso kit (per esempio il vecchio senza sigle) restano dove sono.
    /// I20-1065: nella cartella dei dati di questa postazione (Utility.cartellaDati).
    percorsoNuovaListaKit(idKit) {
        const sigle = Utility._sigleListaKit(idKit);
        return Utility.percorsoDati(Utility.nomeFileListaKit(idKit, sigle[0], sigle[1]));
    },

    /// I20-1034: da dove leggere la lista del kit. Il file col nome atteso, se c'e'; altrimenti
    /// un altro file della cartella che finisce con listaKit<idKit>.json, con sigle diverse o
    /// senza (le liste scaricate prima); altrimenti il nome atteso, che dira' "non trovato".
    /// I20-1065: la cartella e' quella dei dati di questa postazione.
    percorsoListaKit(idKit) {
        const sigle = Utility._sigleListaKit(idKit);
        const atteso = Utility.nomeFileListaKit(idKit, sigle[0], sigle[1]);
        const cartella = Utility.cartellaDati();
        const nomi = Utility._vociDellaCartella(cartella);
        if (nomi.indexOf(atteso) >= 0) {
            return cartella + "/" + atteso;
        }
        const altro = nomi.find(n => Utility.eFileListaKit(n, idKit));
        return cartella + "/" + (altro != null ? altro : atteso);
    },

    /// I20-1057: i nomi della cartella delle lavorazioni, in ordine di preferenza. Vale il primo
    /// che c'e' sotto la cartella del documento, senza distinguere maiuscole e minuscole.
    /// I20-1065: la cartella delle lavorazioni non si usa piu' (al suo posto c'e' SingularData): si
    /// cerca solo per ritrovare i file delle lavorazioni scritti prima.
    nomiCartellaLavorazioni() {
        return [".lavorazioni", "lavorazioni", "lavorazione"];
    },

    _senzaBarraFinale(percorso) {
        return String(percorso ?? "").replace(/[\\/]+$/, "");
    },

    /// I20-1057: la cartella delle lavorazioni sotto base (la cartella del documento, o del libro),
    /// senza barra finale; null se non ce n'e' nessuna. Una voce con uno di quei nomi che non e' una
    /// cartella non conta: readdirSync riesce solo sulle cartelle.
    cartellaLavorazioni(base) {
        const fs = require('fs');
        const radice = Utility._senzaBarraFinale(base);
        let voci = [];
        try {
            voci = fs.readdirSync(radice) || [];
        }
        catch (e) {
            return null;
        }
        for (const nome of Utility.nomiCartellaLavorazioni()) {
            const trovata = voci.find(v => String(v).toLowerCase() === nome);
            if (trovata == null) {
                continue;
            }
            const percorso = radice + "/" + trovata;
            try {
                fs.readdirSync(percorso);
                return percorso;
            }
            catch (e) {
                //non e' una cartella: si prova il nome dopo
            }
        }
        return null;
    },

    /// I20-1061: il nome del file delle lavorazioni di una macchina prima di I20-1065,
    /// <idMacchina>_Lavorazioni.json, in .lavorazioni o nella cartella del documento. Ora si legge
    /// soltanto, per ritrovare le lavorazioni avviate prima.
    nomeFileLavorazioniMacchina(idMacchina) {
        return idMacchina + "_Lavorazioni.json";
    },

    /// Le cartelle in cui possono stare i file delle lavorazioni di prima di I20-1065: quella
    /// delle lavorazioni, se c'e', poi quella del documento (dove stava lavorazioni.json prima).
    _cartelleFileLavorazioni(base) {
        const radice = Utility._senzaBarraFinale(base);
        const cartella = Utility.cartellaLavorazioni(radice);
        return cartella != null ? [cartella, radice] : [radice];
    },

    _vociDellaCartella(percorso) {
        try {
            return require('fs').readdirSync(percorso) || [];
        }
        catch (e) {
            return [];
        }
    },

    /// I20-1065: le cartelle che il Plugin crea da solo sotto la cartella del documento (o del
    /// libro), senza chiederle all'operatore: i log, i file esportati e i dati del Plugin. Dentro
    /// SingularData ogni postazione ha una cartella sua, col suo identificativo (idMacchina): due
    /// postazioni sulla stessa cartella condivisa non si riscrivono i file a vicenda.
    CARTELLA_LOGS: "logs",
    CARTELLA_EXPORT: "export",
    CARTELLA_DATI: "SingularData",
    NOME_FILE_LAVORAZIONI: "lavorazioni.json",

    /// I20-1065: la cartella dei dati di una postazione sotto base, senza barra finale.
    cartellaDatiMacchina(base, idMacchina) {
        return Utility._senzaBarraFinale(base) + "/" + Utility.CARTELLA_DATI + "/" + idMacchina;
    },

    /// I20-1065: la cartella dei dati di questa postazione per la lavorazione aperta: SingularPath,
    /// fissato all'apertura del documento; prima che lo sia, quella che sara'.
    cartellaDati() {
        if (typeof SingularPath !== "undefined" && SingularPath) {
            return Utility._senzaBarraFinale(SingularPath);
        }
        return Utility.cartellaDatiMacchina(pathLavorazione, typeof idMacchina === "function" ? idMacchina() : "");
    },

    /// I20-1065: dove sta un file di lavoro del documento - lista del kit, filtri, allineamenti,
    /// conteggio, report integrita' -: nella cartella dei dati di questa postazione. Non si scrivono
    /// piu' nella cartella del documento.
    percorsoDati(nomeFile) {
        return Utility.cartellaDati() + "/" + nomeFile;
    },

    /// I20-1065: crea sotto base, se mancano, logs, export, SingularData e la cartella di questa
    /// postazione, senza chiedere niente all'operatore. Con fullAccess il Plugin crea cartelle
    /// partendo da quella del documento (getEntryWithUrl e createFolder, provato in console
    /// dall'operatore); fs.mkdirSync in UXP invece non crea niente (vedi idMacchina). Una cartella
    /// che c'e' gia' si riusa, anche se ha le maiuscole diverse (Logs, Export).
    /// Restituisce logPath ed exportPath con la barra finale, come li usano log ed esportazione, e
    /// SingularPath senza. Se una cartella non si crea, lancia l'errore.
    async preparaCartelleDiSistema(base, idMacchina, fileSystem = null) {
        const lfs = fileSystem || require('uxp').storage.localFileSystem;
        const radice = await lfs.getEntryWithUrl("file://" + Utility._senzaBarraFinale(base));
        const logs = await Utility._cartellaFiglia(radice, Utility.CARTELLA_LOGS);
        const esportazione = await Utility._cartellaFiglia(radice, Utility.CARTELLA_EXPORT);
        const dati = await Utility._cartellaFiglia(radice, Utility.CARTELLA_DATI);
        const postazione = await Utility._cartellaFiglia(dati, idMacchina);
        return {
            logPath: Utility._senzaBarraFinale(logs.nativePath) + "/",
            exportPath: Utility._senzaBarraFinale(esportazione.nativePath) + "/",
            SingularPath: Utility._senzaBarraFinale(postazione.nativePath)
        };
    },

    /// La sottocartella nome di cartella: quella che c'e', o una nuova.
    async _cartellaFiglia(cartella, nome) {
        try {
            const esistente = await cartella.getEntry(nome);
            if (esistente != null && esistente.isFolder) {
                return esistente;
            }
        }
        catch (e) {
            //non c'e': si crea
        }
        return await cartella.createFolder(nome);
    },

    /// I20-1065: il file delle lavorazioni di questa postazione, lavorazioni.json nella sua
    /// cartella dei dati.
    percorsoFileLavorazioniMacchina(base, idMacchina) {
        return Utility.cartellaDatiMacchina(base, idMacchina) + "/" + Utility.NOME_FILE_LAVORAZIONI;
    },

    /// I20-1065: dove cercare la voce di un documento che nel file di questa postazione non c'e', in
    /// quest'ordine: il file di questa postazione di prima di I20-1065, quelli delle altre postazioni
    /// in SingularData, poi i file delle altre macchine e i lavorazioni.json di prima. Si leggono
    /// soltanto, non si scrivono mai.
    /// Per ognuno: il percorso, la cartella da cui copiare i file di lavoro del documento (quella
    /// della postazione, o quella del documento per i file di prima) e l'origine: "mia" (il file di
    /// prima di questa postazione), "postazione" (un'altra postazione), "vecchia" (gli altri di prima).
    fileLavorazioniAltri(base, idMacchina) {
        const radice = Utility._senzaBarraFinale(base);
        const cartellaDati = radice + "/" + Utility.CARTELLA_DATI;
        const mioDiPrima = Utility.nomeFileLavorazioniMacchina(idMacchina).toLowerCase();
        const mie = [];
        const postazioni = [];
        const altreDiPrima = [];
        const vecchi = [];
        for (const voce of Utility._vociDellaCartella(cartellaDati).slice().sort()) {
            if (String(voce) === String(idMacchina)) {
                continue;
            }
            const cartella = cartellaDati + "/" + voce;
            const file = Utility._vociDellaCartella(cartella).find(n => String(n).toLowerCase() === Utility.NOME_FILE_LAVORAZIONI);
            if (file != null) {
                postazioni.push({ percorso: cartella + "/" + file, cartella: cartella, origine: "postazione" });
            }
        }
        for (const cartella of Utility._cartelleFileLavorazioni(radice)) {
            for (const voce of Utility._vociDellaCartella(cartella).slice().sort()) {
                const nome = String(voce).toLowerCase();
                const sorgente = { percorso: cartella + "/" + voce, cartella: radice };
                if (nome === mioDiPrima) {
                    mie.push(Object.assign(sorgente, { origine: "mia" }));
                }
                else if (nome.endsWith("_lavorazioni.json")) {
                    altreDiPrima.push(Object.assign(sorgente, { origine: "vecchia" }));
                }
                else if (nome === Utility.NOME_FILE_LAVORAZIONI) {
                    vecchi.push(Object.assign(sorgente, { origine: "vecchia" }));
                }
            }
        }
        return mie.concat(postazioni, altreDiPrima, vecchi);
    },

    /// Le voci di un file delle lavorazioni; un elenco vuoto se il file manca o non si legge.
    leggiFileLavorazioni(percorso) {
        try {
            const voci = JSON.parse(require('fs').readFileSync(percorso, 'utf8'));
            return Array.isArray(voci) ? voci : [];
        }
        catch (e) {
            return [];
        }
    },

    /// La voce di un documento in un elenco: se il documento e' in un libro, prima quella di quel
    /// libro, poi quella col solo nome del file (le voci scritte prima avevano solo quello).
    _voceNellElenco(voci, nomeFile, nomeLibro) {
        if (nomeLibro) {
            const delLibro = voci.find(v => v != null && v.file == nomeFile && v.libro == nomeLibro);
            if (delLibro != null) {
                return delLibro;
            }
        }
        return voci.find(v => v != null && v.file == nomeFile) || null;
    },

    /// I20-1065: i nomi dei file del report integrita' e della sua whitelist per un kit, scritti qui
    /// soltanto: li usano il report (percorsoFileReport) e la copia dei file di lavoro.
    nomeFileReportIntegrita(idKit) {
        return "reportIntegrita_" + idKit + ".json";
    },

    nomeFileWhitelistIntegrita(idKit) {
        return "whitelistIntegrita_" + idKit + ".json";
    },

    /// I20-1065: i file di lavoro di un documento presenti in una cartella: la lista del suo kit, gli
    /// allineamenti, il conteggio con le referenze escluse e i filtri (della cartella o del
    /// documento). Con tutti anche il report integrita', la whitelist e la lista impaginata del kit
    /// e lo stato del libro: si copiano cosi' dai file di prima, per non perdere lo storico; da
    /// un'altra postazione no.
    fileDiLavoro(cartella, idKit, nomeFile, nomeLibro = null, tutti = false) {
        const nomi = ["allineamenti.json", "listaRefConteggio.json", "listaRefEscluse.json", "Filtri.json"];
        const senzaEstensione = String(nomeFile == null ? "" : nomeFile).replace(/\.[^/.]+$/, "");
        if (senzaEstensione !== "") {
            nomi.push("Filtri" + senzaEstensione + ".json");
        }
        if (tutti) {
            nomi.push(Utility.nomeFileReportIntegrita(idKit), Utility.nomeFileWhitelistIntegrita(idKit),
                "listaImpaginata" + idKit + ".json");
            if (nomeLibro) {
                nomi.push(nomeLibro + "_register.json");
            }
        }
        return Utility._vociDellaCartella(cartella).filter(n => nomi.indexOf(String(n)) >= 0
            || (idKit != null && Utility.eFileListaKit(n, idKit)));
    },

    /// I20-1065: copia i file nomi dalla cartella da alla cartella a, solo quelli che in a mancano:
    /// quello che la postazione ha gia' e' piu' recente. Gli originali non si toccano. Restituisce i
    /// nomi copiati; un file che non si copia si segnala in console e non ferma gli altri.
    copiaFileDiLavoro(da, a, nomi) {
        const fs = require('fs');
        const presenti = Utility._vociDellaCartella(a);
        const copiati = [];
        (Array.isArray(nomi) ? nomi : []).forEach(nome => {
            if (presenti.indexOf(nome) >= 0) {
                return;
            }
            try {
                fs.writeFileSync(a + "/" + nome, fs.readFileSync(da + "/" + nome, 'utf8'));
                copiati.push(nome);
            }
            catch (e) {
                console.error("I20-1065: " + nome + " non copiato da " + da + " in " + a + ": " + e);
            }
        });
        return copiati;
    },

    /// I20-1061: la voce della lavorazione di un documento, per questa macchina.
    /// Si cerca nel file della postazione, poi negli altri (fileLavorazioniAltri). Se c'e' solo
    /// altrove, se ne copiano nel file della postazione i riferimenti - file, id, dettagli e libro -
    /// ma non i percorsi di Links e Loghi, che sono di chi li ha scritti: sulla macchina si ritrovano
    /// da soli o li chiede la finestra delle cartelle. I20-1065: tranne quando vengono dal file di
    /// prima di questa stessa postazione, che li aveva scelti qui.
    /// I20-1065: con la voce si copiano nella cartella della postazione i file di lavoro del
    /// documento (fileDiLavoro), cosi' il lavoro prosegue senza richiedere il kit.
    /// null vuol dire che la lavorazione e' da iniziare.
    voceLavorazione(base, idMacchina, nomeFile, nomeLibro = null) {
        const percorsoMio = Utility.percorsoFileLavorazioniMacchina(base, idMacchina);
        const mie = Utility.leggiFileLavorazioni(percorsoMio);
        const mia = Utility._voceNellElenco(mie, nomeFile, nomeLibro);
        if (mia != null) {
            return mia;
        }
        for (const sorgente of Utility.fileLavorazioniAltri(base, idMacchina)) {
            const trovata = Utility._voceNellElenco(Utility.leggiFileLavorazioni(sorgente.percorso), nomeFile, nomeLibro);
            if (trovata == null) {
                continue;
            }
            const copia = { file: trovata.file, id: trovata.id, details: trovata.details };
            const libro = nomeLibro || trovata.libro;
            if (libro) {
                copia.libro = libro;
            }
            if (sorgente.origine === "mia") {
                ["pathLinks", "pathLoghi"].forEach(campo => {
                    if (trovata[campo]) {
                        copia[campo] = trovata[campo];
                    }
                });
            }
            mie.push(copia);
            try {
                require('fs').writeFileSync(percorsoMio, JSON.stringify(mie));
            }
            catch (e) {
                //la lavorazione si carica lo stesso; alla prossima apertura si ritenta la copia
                console.error("I20-1061: copia della lavorazione in " + percorsoMio + " non riuscita: " + e);
            }
            Utility.copiaFileDiLavoro(sorgente.cartella, Utility.cartellaDatiMacchina(base, idMacchina),
                Utility.fileDiLavoro(sorgente.cartella, copia.id, nomeFile, libro || null, sorgente.origine !== "postazione"));
            return copia;
        }
        return null;
    },

    /// I20-1061: scrive la voce di un documento nel file di questa macchina, aggiornando quella che
    /// c'e' gia' (la stessa che troverebbe voceLavorazione) invece di aggiungerne un'altra. Gli altri
    /// file non si toccano. Restituisce la voce salvata.
    salvaVoceLavorazione(base, idMacchina, voce) {
        const percorso = Utility.percorsoFileLavorazioniMacchina(base, idMacchina);
        const voci = Utility.leggiFileLavorazioni(percorso);
        const esistente = Utility._voceNellElenco(voci, voce.file, voce.libro);
        let salvata = voce;
        if (esistente != null) {
            salvata = Object.assign(esistente, voce);
        }
        else {
            voci.push(voce);
        }
        require('fs').writeFileSync(percorso, JSON.stringify(voci));
        return salvata;
    },

    /// I20-1061: il libro di un documento: il .indb nella cartella del documento. Se ce n'e' piu' di
    /// uno vale quello aperto che contiene il documento; se nessuno di quelli aperti lo contiene,
    /// nessun libro (si cerca per il solo nome del file). libriAperti: [{nome, files: [nomi]}].
    libroDelDocumento(cartella, nomeFile, libriAperti = []) {
        const nellaCartella = Utility._vociDellaCartella(Utility._senzaBarraFinale(cartella))
            .filter(v => String(v).toLowerCase().endsWith(".indb"));
        if (nellaCartella.length === 0) {
            return null;
        }
        const aperto = (libriAperti || []).find(l => l != null && nellaCartella.indexOf(l.nome) >= 0 && (l.files || []).indexOf(nomeFile) >= 0);
        if (aperto != null) {
            return aperto.nome;
        }
        return nellaCartella.length === 1 ? nellaCartella[0] : null;
    },

    async getListaCodiciImpaginati(opzioni = {}){
        var result = null;
        var error = null;
        xhrInProcess = new XMLHttpRequestClient();
        xhrInProcess.descrizione = "Scaricamento degli impaginati";
        xhrInProcess.onload = (objResult, parsed) => {
            result = objResult;
        }

        xhrInProcess.onreadystatechange = function () {
            if (xhrInProcess.readyState == 4) {
                if (xhrInProcess.status == 200) {
                    //messaggioUtente("Richiesta completata con successo", "success");
                } else {
                    //messaggioUtente("Errore durante la richiesta: " + xhrInProcess.statusText, "error");
                    error = xhrInProcess.statusText;
                }
            }
        };
    
        xhrInProcess.onerror = function () {
            //messaggioUtente("Errore di rete durante la richiesta", "error");
            error = "Errore di rete durante la richiesta";
        }

        //I20-1004: annullata, non arrivera' piu' niente. Inutile aspettare la scadenza.
        xhrInProcess.onabort = function (motivo) {
            error = "annullato a causa di: " + motivo;
        }
    
        console.log("Menabo/getListaImpaginati/" + idKitLavorazione);
        xhrInProcess.send("Menabo/getListaImpaginati/" + idKitLavorazione, null, "GET");

        let i = 0;

        while (result == null && error == null && i < 100) {
            await this.sleep(100);          
            i++;
        }

        if (error != null) {
            messaggioUtente("Code TLY-07: Errore durante lo scaricamento dei codici impaginati: " + error, "error");
            console.error("Code TLY-07: Errore durante lo scaricamento dei codici impaginati: " + error);
            return opzioni.nullSeFallisce ? null : [];
        }

        if (i == 100) {
            messaggioUtente("Code TLY-08: Tempo massimo per lo scaricamento del dato superato", "error");
            console.warn("Code TLY-08: Tempo massimo per lo scaricamento del dato superato");
            return opzioni.nullSeFallisce ? null : [];
        }

        if (result != null ) {
            return result;
        }
        else {
            return [];
        }


    },

    duplicaFile(percorsoOrigine, nuovoNome) {
        const destinazione = nuovoNome;
        fs.copyFile(percorsoOrigine, destinazione);
        console.log(`Copiato ${percorsoOrigine} in ${destinazione}`);
    },

    _findBoxInExpectedPage(refId, numeroPagina) {
        if (numeroPagina == null) return null;

        try {
            const doc = app.activeDocument;
            const pageIndex = Number(numeroPagina) - 1;

            if (Number.isNaN(pageIndex) || pageIndex < 0 || pageIndex >= doc.pages.length) {
                return null;
            }

            const page = doc.pages.item(pageIndex);
            const items = page.allPageItems;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                try {
                    if (item && item.isValid && item.id === refId) {
                        return item;
                    }
                } catch (e) { }
            }
        } catch (err) {
            console.error("Errore ricerca in pagina:", err);
        }

        return null;
    },


    _findBoxInDocument(refId) {
        try {
            const doc = app.activeDocument;
            const items = doc.allPageItems;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                try {
                    if (item && item.isValid && item.id === refId) {
                        return item;
                    }
                } catch (e) { }
            }
        } catch (err) {
            console.error("Errore ricerca globale:", err);
        }

        return null;
    },

    generateId(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);

        let id = '';
        for (let i = 0; i < length; i++) {
            id += chars[array[i] % chars.length];
        }
        return id;
    },

    cercaChiaveContesto(key, array) {
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i].nome_field != undefined && array[i].nome_field == key) {
                return array[i].user_value;
            }
        }
        return null;
    },


    applyObjectStyle(doc, ctrl, style) {
        try {
            //ctrl.appliedObjectStyle = doc.objectStyles.itemByName(style);
            for (var o = 0; o < doc.allObjectStyles.length; o++) {
                //console.error("> " + doc.allObjectStyles[o].name);
                if (doc.allObjectStyles[o].name == style) {
                    //console.error("Applico davvero " + style);
                    ctrl.appliedObjectStyle = doc.allObjectStyles[o];
                    return;
                }
            }

        } catch (error) {
            console.error("Stile di oggetto non trovato " + style);
            ctrl.appliedObjectStyle = doc.objectStyles.itemByName(style);
        }
    },

    setCampoDNA(listCampiDNA, box, itemRef) {
        //listaCampiDNA è un array di stringhe con i campi papabili per inserire il DNA, il primo che trova lo restituisce, altrimenti null
        //listCampiDNA se non contiene base viene aggiunto in coda
        if (listCampiDNA == null ) {
            listCampiDNA = ["base"];
        }
        else if (!listCampiDNA.includes("base")) {
            listCampiDNA.push("base");
        }

        for (var i = 0; i < listCampiDNA.length; i++) {
            var campo = listCampiDNA[i];
            var field = this.getFieldByLabel(campo, box, false);
            if (field != null && field.isValid && field.visible) {
                field.label += "$DNA$" + box.label + "$" + itemRef["Referenza.Codice"] + "$" + itemRef["Scatto.CodiceGruppo"] + "$" + itemRef["idRec"];
                break;
            }
        }
        return null;
    },

    /// Il DNA di un box: i dati della referenza che contiene, letti dalle sue label.
    getDnaOfBox: function (box) {
        if (!box.isValid)
            return null;

        if (box.parent.constructor.name != "Spread") {
            return null;
        }

        var result = null;
        var baseOld = null;
        var partiBase = null;
        //I20-1056: in UXP ogni lettura di allPageItems interroga di nuovo InDesign e rifa'
        //l'elenco: letto nella condizione del ciclo, costava un elenco nuovo a ogni giro. Lo
        //stesso per la label, letta fino a tre volte per elemento.
        var elementi = box.allPageItems;
        for (var i = 0; i < elementi.length; i++) {
            var item = elementi[i];
            var etichetta = item.label;
            if (etichetta && etichetta.includes("$DNA$")) {
                var parts = etichetta.split("$");
                result = {
                    label: parts[0], //la parte 1 ora è DNA
                    item: item,
                    boxLabel: parts[2],
                    codice: parts[3],
                    codice_gruppo: parts[4],
                    idRec: parts[5],
                    oldBoxFormat: false
                };
                break;
            }
            else if (etichetta && etichetta.startsWith("base$")) {
                baseOld = item;
                partiBase = etichetta.split("$");
            }
        }
        var res = result != null ? result : (baseOld != null ? {
            label: "base",
            item: baseOld,
            boxLabel: partiBase[1],
            codice: partiBase[2],
            codice_gruppo: partiBase[3],
            idRec: partiBase[4],
            oldBoxFormat: true
        } : null);

        // if (!res) {
        //     messaggioUtente("Code TLY-09: Nessun campo DNA trovato nel box " + box.label, "error");
        // }

        // let baseField = this.getFieldByLabel("base", box);
        // if (baseField != null) {
        //     //Leggo il dna
        //     let dnaParams = baseField.label.split('$');
        //     //console.log("___getDnaOfBox: " + dnaParams);
        //     let objReturn = { label: dnaParams[0], boxLabel: dnaParams[1], codice: dnaParams[2], codice_gruppo: dnaParams[3], idRec: dnaParams[4] };
        //     //console.log(objReturn);
        //     return objReturn;
        // }
        return res;
    },

    getBoxFromElementOfBox(element){
        var box = element;
        var securityCounter = 0;
        while (box.parent.constructor.name != "Spread" && securityCounter < 1000) {
            box = box.parent;
            securityCounter++;
        }

        if(securityCounter >= 1000){
            console.error("Code TLY-10: l'elemento passato per la ricerca del box non è contenuto nel box stesso:" + element.label);
            return null;
        }

        return box;
    },

    // getDNAFromBox(box) {
    //     //cerchiamo un campo che contenga la dicitura $DNA e costruiamo un oggetto con i valori:
    //     //{boxLabel: box.label, codice: codice, gruppo: gruppo, idRec: idRec}
    //     //se non troviamo nessun campo con $DNA cerchiamo un campo la cui label inizia con base$ (per retrocompatibilità) e costruiamo lo stesso oggetto
    //     var result = null;
    //     var baseOld = null;
    //     for (var i = 0; i < box.allPageItems.length; i++) {
    //         var item = box.allPageItems[i];
    //         if (item.label && item.label.includes("$DNA$")) {
    //             var parts = item.label.split("$");
    //             result = {
    //                 boxLabel: parts[2],
    //                 codice: parts[3],
    //                 gruppo: parts[4],
    //                 idRec: parts[5]
    //             };
    //             break;
    //         }
    //         else if (item.label && item.label.startsWith("base$")) {
    //             baseOld = item.label;
    //         }
    //     }
    //     var res = result != null ? result : (baseOld != null ? {
    //         boxLabel: "base",
    //         codice: null,
    //         gruppo: null,
    //         idRec: null
    //     } : null);

    //     if(!res){
    //         messaggioUtente("Code TLY-09: Nessun campo DNA trovato nel box " + box.label, "error");
    //     }

    //     return res;
    // },



    /// I20-1022: se l'elemento e' un clone nato da una duplicazione del CssFramework, come la copia
    /// della primaria nei box BIS (foto_secondaria$617632$clone). Le segnalazioni lo ignorano:
    /// e' voluto, e sovrapposto alla foto da cui nasce.
    eUnClone(label) {
        return cssComposizioneBox.eUnClone(label);
    },

    /// L'etichetta normalizzata: taglia quello che segue il primo $, che nelle label del
    /// Plugin porta il codice della referenza. Chi lavora sulle copie da duplicazione NON deve
    /// usarla, perche' taglierebbe il suffisso che le distingue - vedi cssComposizioneBox.
    parseLabel(label){
        //cerchiamo $ e torniamo la label prima del $
        if (label == null || label == "" || label.startsWith("foto_extra") ||
            label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") ?? "immagine") ||
            label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") ?? "foto_secondaria") ||
            label.startsWith("sfondo$")
        ) return label;
        var index = label.indexOf("$");
        if(index == -1) return label;
        var labelParsed = label.substring(0, index);
        return labelParsed;
    }

}


module.exports.Utility = Utility;
module.exports.FotoPlacer = FotoPlacer;
