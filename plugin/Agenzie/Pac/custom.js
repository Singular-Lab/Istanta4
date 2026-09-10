//PAC
const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions } = require('indesign');
const MAIN_fixFoto = require('./fotoFix');
const { FotoPlacer, Utility } = require('./utility');
const GarbageCollector = require('./garbageCollector');
const ficoProcess = require('./ficoProcess');
const CssFramework = require('./CssFramework');

class Agenzia {

//#region VARIABILI FILTRO e VISUALIZZAZIONE TRACCIATO

    campiFiltro = [
        {
            nomeCampoVisualizzato: "Tema",
            campoAssociato: "tema",
            tendina: true
        },
        {
            nomeCampoVisualizzato: "Reparto",
            campoAssociato: "reparto",
            tendina: true
        },
        {
            nomeCampoVisualizzato: "Cod. Gruppo",
            campoAssociato: "Scatto.CodiceGruppo",
            tendina: true
        },
        {
            nomeCampoVisualizzato: "Note",
            campoAssociato: "note",
            tendina: false
        }
    ];

    filtroRicerca = [
        { tree: "recordInTracciato", field: "reparto", label: "Reparto", tipoValori: "string" },
        { tree: "recordInTracciato", field: "tema", label: "Tema", tipoValori: "string" },
        { tree: "recordInTracciato", field: "Scatto.CodiceGruppo", label: "Codice", tipoValori: "string" }
    ];

    colonneTracciato = [
        {
            nome: "Codice",
            chiaveDato: "codice",
            percColonna: 80
        },
        {
            nome: "Descrizione",
            chiaveDato: "descrizione",
            percColonna: 140
        },
        {
            nome: "Tema",
            chiaveDato: "tema",
            percColonna: 140
        }, {
            nome: "Note",
            chiaveDato: "note",
            percColonna: 140
        }
    ];

//#endregion

//#region VARIABILI IMPAGINAZIONE e FIX FOTO

    invalidareStileDiCarattere = false;

    customPadding = [
        { label: "box_sconto", padding: [-18.5, 0, 0, -21] }, //qui vanno messi i padding degli ostacoli per il fix foto se ce ne sono  [{label: "string", padding: [top, left, bottom, right]}]
    ];

    paddingBox = [0, 0, 0, 0]; // [top, left, bottom, right] padding da applicare ai box per il calcolo dei candidati
    paddingFoto = [0, 0]; // [top/bottom, left/right] padding da applicare alle foto

    ignoreElementsFixFoto = ["sconto", "txt_sconto", "sconto_base", "sfondo"];

    exceptionElementsToIgnoreFixFoto = []; //se un elemento è sia in ignoreElementsFixFoto che in exceptionElementsToIgnoreFixFoto non viene ignorato. Serve perchè si può fare cose come ignora loghi e specificare solo il logo che fa eccezione

    calcoloDistanziamentoFoto = [ //il ratio è calcolato Y/X
        {
            foto: 1,
            percDistFoto: [{
                percDistanceXFoto: [],
                percDistanceYFoto: [],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: Infinity,
            }],
        },
        {
            foto: 2,
            percDistFoto: [{
                percDistanceXFoto: [0.5],
                percDistanceYFoto: [-0.25],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: Infinity,
            }],
        },
        {
            foto: 3,
            percDistFoto: [{
                percDistanceXFoto: [0.5, -1.05],
                percDistanceYFoto: [-0.3, 0],
                startRangeRatioCondition: 0,
                endRangeRatioCondition: Infinity,
            },
            ],
        }
    ];

    simboli = {};

    campiSoggettiAOverflow = [{label:"descrizione",h:"top", w:""}];
//#endregion

//#region VARIABILI VISUALIZZAZIONE REFERENZA, SALVA REVISIONE ED ESPORTAZIONE

    schemiDescrizioni = [
        {
            schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_TIPO", "START$DESCRIZIONE_GRAMMATURA"],
            setRegole: [[]],
        },
        {
            schema: ["START$DESCRIZIONE_TITOLO_FG", "START$DESCRIZIONE_BRAND_FG", "START$DESCRIZIONE_TIPO_FG", "START$DESCRIZIONE_GRAMMATURA_FG"],
            setRegole: [[]],
        },
        {
            schema: ["START$DESCRIZIONE_TITOLO_COLLECTION", "START$DESCRIZIONE_BRAND_COLLECTION", "START$DESCRIZIONE_TIPO_COLLECTION", "START$DESCRIZIONE_GRAMMATURA_COLLECTION"],
            setRegole: [[]],
        },
        {
            schema: ["START$DESCRIZIONE_TITOLO_NOFOOD", "START$DESCRIZIONE_BRAND_NOFOOD", "START$DESCRIZIONE_TIPO_NOFOOD", "START$DESCRIZIONE_GRAMMATURA_NOFOOD"],
            setRegole: [[]],
        }
    ];

    listaStiliUniversali = [
        { nome: "DESCRIZIONE_TITOLO", rule: "IN$TITOLO", fondamentale: "descrizione1" },
        { nome: "DESCRIZIONE_BRAND", rule: "IN$BRAND", fondamentale: "descrizione2" },
        { nome: "DESCRIZIONE_GRAMMATURA", rule: "IN$GRAMMATURA", fondamentale: "descrizione4" },
        { nome: "DESCRIZIONE_TIPO", rule: "IN$TIPO", fondamentale: "descrizione3" }];

    grandezzeBox = {
        bigBoxWidth: 200,
        bigBoxHeight: "auto",
        smallBoxWidth: "auto",
        smallBoxHeight: 30,
        bigBoxPerRow: 2,
        smallBoxPerRow: 4,
        marginBetweenBigBox: 10,
        marginBetweenSmallBox: 0,
    };

    abilitaDescrizioniRegionali = false;
    abilitaDescrizioniCanale = false;

//#endregion

//#region VARIABILI CAMPI VARI E NOMENCLATURE

    listCampiNonEditabili = [];
    listCampiEditabiliPrioritari = [];

    nomeFotoPrimaria = "immagine";
    nomeFotoSecondarie = "foto_secondaria";
    fotoNotFound = "fotoNoFound.png";
    nomeNoFoto = "nofoto.png";

    area = null;
    canale = null;
    codiceFormato = null;
    tipoLavorazione = null;
    contesto_promo = [];

    listCampiConfrontoBypass = ["prezzo_promo", "prezzo_promo_kgl", "txt_sconto", "prezzo_continuo"];

//#endregion

//#region METODI IMPAGINAZIONE ed ESPORTAZIONE
    bindRefDataCompiled(box, oggetto, pathLavorazione, boxInGrigliaBounds) {

        if (oggetto["logo_toscana1"]=="X")
        {
            let areaLav = ficoProcess.getAreaLavorazioneCorrente();
            if (areaLav.nome=="B" || areaLav.nome=="B1")
            {
                if (oggetto.codiceBox=="BOX_STD" || oggetto.codiceBox=="BOX_LINEA" || oggetto.codiceBox=="BOX_1+1")
                {
                    //Cerchiamo il box sconto
                    for(let el=0; el<box.allPageItems.length; el++)
                    {
                        let elItem = box.allPageItems[el];
                        if (elItem.label=="sconto_base")
                        {
                            elItem.fillColor = "Speciale Toscana";
                            //break;
                        }
                        if (elItem.label=="txt_sconto")
                        {
                             //elItem.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.item("SCONTO_TOSCANA");
                            for (var j = 0; j < elItem.characters.length; j++) {
                                elItem.characters.item(j).strokeColor = "Speciale Toscana";
                            }
                        }
                    }
                }
            }
        }

        if (oggetto["colore_sconto_speciale"]!=null)
        {
            for(let el=0; el<box.allPageItems.length; el++)
            {
                let elItem = box.allPageItems[el];
                if (elItem.label=="sconto_base")
                {
                   try
                   {
                        elItem.fillColor = oggetto["colore_sconto_speciale"];
                   }
                   catch(err)
                   {
                    messaggioUtente(oggetto["colore_sconto_speciale"] + " stile non trovato", "warning");
                   }
                    //break;
                }
                if (elItem.label=="txt_sconto")
                {
                    try
                   {
                        //elItem.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.item("SCONTO_TOSCANA");
                        for (var j = 0; j < elItem.characters.length; j++) {
                            elItem.characters.item(j).strokeColor = oggetto["colore_sconto_speciale"];
                        }
                    }
                    catch (err)
                    {
                        messaggioUtente(oggetto["colore_sconto_speciale"] + " stile non trovato", "warning");
                    }
                }
            }
        }

        return box;     
    };

    replaceAll(str, stringToReplace, replacement){
        var splitted = str.split(stringToReplace);
        str = splitted.join(replacement);
        return str;
    };

    replaceAllSpecialCharacters(str){
        listSpecialCharacters = [ {chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "LSINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "LSINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}   ];

        listSpecialCharacters.forEach(function(specialCharacter){
            str = customAgenzia.replaceAll(str, specialCharacter.chiave, specialCharacter.valore);
        });

        return str;
    };

    componiEsportazioneMateriale(element, elementiGruppo, pageItem, pageGroup, label) {
        //element è un oggetto composto da 
        //"recordInTracciato": {}, è un dictionary che contiene i dati del record in tracciato
        //"names": [],
        //"groupNames": [],
        //"allEtichette": [],
        //"etichetteVisual": [],
        //"idRec": 0

        var resObj = {
            foto: [],
            descrizione: "",
            prezzo_promo: "",
            prezzo_origine: "",
            sconto: "",
            meccanica: "",
            mastro: "",
            customData: {},
            errors: [],
        }

        //cerchiamo nel gruppo il textFrame con label "descrizione"
        for (var i = 0; i < pageGroup.allPageItems.length; i++) {
            var item = pageGroup.allPageItems[i];
            if (item.label == "descrizione") {
                //scorriamo la descrizione la prendiamo specificando in formato html lo stile di carattere
                resObj.descrizione = customAgenzia.formaDescrizioneIndd(item);
                continue;
            }

            if (item.label == "prezzo_offerta") { //corrisponde a prezzo_promo
                resObj.prezzo_promo = item.contents;
                continue;
            }

            if (item.label == "campo_offerta") { //corrisponde a prezzo_origine
                resObj.prezzo_origine = item.contents;
                continue;
            }

            if (item.label == "sconto_effettivo_grande") {
                resObj.sconto = item.contents;
                continue;
            }

            if (item.label.startsWith("immagine") || item.label.startsWith("foto_secondaria")) {
                //leggiamo il nome dell'immagine
                try {
                    var imgName = item.images.item(0).itemLink.name
                    //cerchiamo nel gruppo l'elemento con "Foto.nome" = imgName e mettiamo il guidid in resObj.foto
                    var el = elementiGruppo.find(f => f.recordInTracciato["Foto.Nome"] == imgName);
                    if (el != null) {
                        resObj.foto.push(el.recordInTracciato["Foto.guidid"]);
                    }
                    else {
                        resObj.errors.push("L'immagine " + imgName + " non è stata trovata negli elementi del gruppo");
                    }
                }
                catch (e) {
                    console.error("ERROR " + item.label);
                    console.error(element);
                    console.error(e);
                }

                continue;
            }

            if (item.label != null && item.label != "") {

                if (item.constructor.name == "TextFrame") {
                    resObj.customData[item.label] = { content: item.contents, contentHtml: "" };//"";//item.contents;
                    let _html = "";

                    let lastStyle = "";


                    for (let c = 0; c < item.characters.length; c++) {
                        let ch = item.characters.item(c);
                        if (ch.appliedCharacterStyle != null) {

                            let nomeStyle = ch.appliedCharacterStyle.name;

                            if (nomeStyle != lastStyle) {
                                if (lastStyle != "") {
                                    _html += "</" + lastStyle + ">";
                                }


                                _html += "<" + nomeStyle + ">";


                                lastStyle = nomeStyle;
                            }
                        }
                        else {
                            //Carattere non valido!
                        }

                        _html += ch.contents;
                    }

                    if (lastStyle != "") {
                        _html += "</" + lastStyle + ">";
                    }

                    resObj.customData[item.label].contentHtml = _html;

                }
                else if (item.constructor.name == "Rectangle") {
                    if (item.images.length > 0) {
                        var imgName = item.images.item(0).itemLink.name
                        resObj.errors.push("Foto extra non ancora implementate. Nome " + imgName);
                        // var el = element.recordInTracciato["Foto.Extra"].find(f=>f.n == imgName);
                    }
                }

                continue;
            }
        }

        resObj.customData.settore = element.recordInTracciato.descrizione_settore
        resObj.customData["descrizione_reparto"] = element.recordInTracciato["descrizione_reparto"];
        resObj.codice = element.recordInTracciato["Referenza.Codice"];
        resObj.codice_gruppo = element.recordInTracciato["Scatto.CodiceGruppo"];

        resObj.codiceBox = label.split("$")[1];

        //controlliamo l'appledMaster della pagina di indesign
        var appliedMaster = pageItem.appliedMaster;
        if (appliedMaster != null) {
            resObj.mastro = appliedMaster.name;
        }

        return resObj;
    };

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
    };

    cercaChiaveValore(key, value, array) {
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] != undefined && array[i][key] == value) {
                return true;
            }
        }
        return false;
    };

    cercaChiaveContesto(key, array){
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i].nome_field != undefined && array[i].nome_field == key) {
                return array[i].user_value;
            }
        }
        return null;
    };  
    
    assegnaNuovoValoreContesto(key, value, array){
        var itemToAdd = {
            nome_field: key,
            user_value: value
        };
        
        for (var i = 0; i < array.length; i++) {

            if (array[i].nome_field != undefined && array[i].nome_field == key) {
                array[i].user_value = value;
                return array;
            }
        }
        array.push(itemToAdd);
        return array;
    };  

    setCustomFixFoto(box) {
        const getElements = ["prezzo_promo_kgl", "prezzo_promo", "2pezzi", "prezzo_promo_kgl_1pezzo", "prezzo_promo_1pezzo"];
        //duplichiamo il box
        var res1 = CssFramework.getSpazioImpaginazione(box);
        if (box.label == "BOX_COLLECTION" || box.label == "BOX_NOFOOD" || box.label == "BOX_FG") {
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
            return box;
        }

        var area1 = CssFramework.fixFoto(box, res1.candidate, res1.obstacles, true);

        var offsetY = 3.707;
        var offsetX = 1.85;




        var items = box.allPageItems;
        var minLeft = box.geometricBounds[3];
        var descrizione = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.label == "descrizione") {
                descrizione = item;
                continue;
            }

            if (!getElements.some(el => item.label == el) || item.label == "") {
                continue;
            }


            var bounds = item.geometricBounds;
            var left = null
            //se è un textframe controlliamo tutte le sue righe e prendiamo il left più piccolo
            if (item.constructor.name == "TextFrame" && item.lines.length > 0) {
                for (var j = 0; j < item.lines.length; j++) {
                    var line = item.lines.item(j);
                    if (left == null || line.horizontalOffset < left) {
                        left = line.horizontalOffset;
                    }
                }
            }
            else {
                left = bounds[1];
            }
            if (left < minLeft) {
                minLeft = left;
            }
        }

        var oldBounds = null;

        //spostiamo la descrizione di modo che il suo bounds[2] sia uguale alla base del box e il suo bounds[3] sia uguale a minLeft
        if (descrizione != null) {
            oldBounds = descrizione.geometricBounds;
            var altezzaDes = descrizione.geometricBounds[2] - descrizione.geometricBounds[0];
            var larghezzaDes = descrizione.geometricBounds[3] - descrizione.geometricBounds[1];
            var newBounds = [];

            newBounds = [box.geometricBounds[2] - altezzaDes - offsetY, minLeft - larghezzaDes - offsetX, box.geometricBounds[2] - offsetY, minLeft - offsetX];

            descrizione.geometricBounds = newBounds;
        }
        else {
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
            return box;
        }

        var res2 = CssFramework.getSpazioImpaginazione(box);
        var area2 = CssFramework.fixFoto(box, res2.candidate, res2.obstacles, true);

        //teniamo il box con area maggiore, eliminiamo l'altro e poi restituiamo il box tenuto
        if (Math.floor(area1) >= Math.floor(area2)) {
            descrizione.geometricBounds = oldBounds;
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
        }
        else {
            CssFramework.fixFoto(box, res2.candidate, res2.obstacles);
        }

        return box;
    };

//#endregion

//#region METODI SETTER, REMOVE e GETTER VARI
    rimuoviSimboli(){
        for (var key in this.simboli) {
            if (this.simboli[key] != null && this.simboli[key].isValid) {
                this.simboli[key].remove();
            }
        }

        this.simboli = {};
    };

    setBolloNOFOTO(name){
        this.nomeNoFoto = name;
    };

    setBolloFOTONOFOUND(name){
        this.fotoNotFound = name;
    };

    getNameStileUniversale(stile) {

        for (var i = 0; i < this.listaStiliUniversali.length; i++) {
            var stileUniversale = this.listaStiliUniversali[i];
            if (stileUniversale.rule.indexOf("IN$") >= 0) {
                if (stile.indexOf(stileUniversale.rule.replace("IN$",""))>=0)
                {
                    return stileUniversale;
                }
            }
        }
        return null;

    };

    formaDescrizioneIndd(descrizioneItem){
        var currentCharacterStyle = "";
        DescrizioneIndd = "";
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            
            if (currentCharacterStyle != descrizioneItem.characters.item(i).appliedCharacterStyle.name) {
                if (currentCharacterStyle != "") {
                    DescrizioneIndd += "</" + currentCharacterStyle + ">";
                }
                currentCharacterStyle = descrizioneItem.characters.item(i).appliedCharacterStyle.name;
                DescrizioneIndd += "<" + currentCharacterStyle + ">";
            }
            DescrizioneIndd += descrizioneItem.characters.item(i).contents;
            
        }
        if (currentCharacterStyle != ""){
            DescrizioneIndd += "</" + currentCharacterStyle + ">";
        }
        DescrizioneIndd = customAgenzia.replaceAllSpecialCharacters(DescrizioneIndd);
        return DescrizioneIndd;
    };


    getModeConfronto(){
        return 2; //modalità a riempimento
    };

    //Funzione che torna dei dettagli di impaginazione nel proceso di CONTEGGIO per poter suggerire decisioni
    getInfoExtra(itemRef)
    {
        var string = "\n";
        string += "Reparto: " + itemRef["reparto"]+ "\n";
        return string;
    };

    setLavorazione(){
        var filePath = pathLavorazione + "/lavorazioni.json";
        let lavorazioni = readFile(filePath);
        //lavorazione è una lista di oggetti noi dobbiamo trovare qullo con la chiave file = al nome del file aperto di indesign
        var lavorazione = lavorazioni.find(lavorazione => lavorazione.file == app.activeDocument.name);
        if(lavorazione == null){
            console.error("Lavorazione non trovata");
            return;
        }
        //lavorazione.details è un oggetto che contiene le informazioni della lavorazione, li cerchiamo

        var guidArea = lavorazione.details.guidArea;

        var areaObj = getSourceAree().find(f=>f.guidID == guidArea);
        if(areaObj == null){
            console.error("Area non trovata");
            return;
        }

        this.area = areaObj.sigla;
        
        var guidCanale = lavorazione.details.guidCanale;
        var canaleObj = getSourceCanali().find(f=>f.guidID == guidCanale);
        if(canaleObj == null){
            console.error("Canale non trovato");
            return;
        }

        this.canale = canaleObj.sigla;
        
        var guidFormato = lavorazione.details.guidFormato;
        var formatoObj = getSourceFormati().find(f=>f.guidID == guidFormato);
        if(formatoObj == null){
            console.error("Canale non trovato");
            return;
        }

        this.codiceFormato = formatoObj.codice;
        this.tipoLavorazione = formatoObj.tipo;

    };    

    getOverflowsInstruction(field)
    {
        let overflowInstruction = customAgenzia.campiSoggettiAOverflow.find(c=>c.label==field.label);
        let result=null;

        if (overflowInstruction!=null)
        {
            gbBKP=field.geometricBounds;
            result = [0,0,0,0];
            //Creo lo spazio per overflow
            if (overflowInstruction.w=="left")
            {
                result[1] = -1;
            }
            else if (overflowInstruction.w=="right")
            {
                result[3] = 1;
            }

            if (overflowInstruction.h=="top")
            {
                result[0] = -0.54;
            }
            else if (overflowInstruction.h=="bottom")
            {
                result[2] = 0.54;
            }
        }
        return result;
    };

    getMetaAggiuntiviPerEsportazioneCorreggo()
    {
        return ["codice_settore", "codice_reparto", "codice_categoria", "codice_sottocategoria"];
    };

    getColonneTracciatoIntestazione() {
        return this.colonneTracciato;
    };

//#endregion

};

const customAgenzia = new Agenzia();
module.exports = customAgenzia;