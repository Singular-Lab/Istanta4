const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification } = require('indesign');
//const MAIN_fixFoto = require('./fotoFix');
const CssFramework = require('../../CssFramework');
var countRef = 0;
const customAgenzia={
    
    labelModifcabili : ["txt_sconto<SCONTO_VALORE>","prezzo_promo", "prezzo", "prezzo_promo_kgl", "sconto_alla_cassa", "prezzo_info_pack"],
    tipiFotoExtra : [{val: 2, nome: "Bollini"},{val: 3, nome: "Loghi"},{val: 4, nome: "Foto ambientate"}],
    filtroRicerca : [{tree: "recordInTracciato", field: "speciale", label: "Speciale", tipoValori:"string"},{tree: "recordInTracciato", field: "reparto", label: "Reparto", tipoValori:"string"}],
    listMeccanicheIngombranti : ["2x2_sc", "2x3_sc","2x4_sc","3x3_sc","3x4_sc","3x5_sc","4x3_sc", "4x4_sc", "4x5_sc", "5x4_sc","5x5_sc", "6x6_sc"],
    listCampiNonEditabili : ["idTracciato", "tracciato", "Referenza.Codice", "Referenza", "Referenza" , "Referenza.Ean", "Scatto.Codice", "Tracciato.Firma", "bollini", "Scatto.CodiceGruppo", "Descrizioni.Descrizione1", "Descrizioni", "Tracciato.Firma", "rm", "rp", "rv", "isInArea", "Descrizioni.Um", "Descrizioni.Peso"],
    listCampiEditabiliPrioritari : ["artwork", "note", "prezzo", "prezzo_kgl", "prezzo_kgl_oro", "prezzo_oro", "prezzo_promo", "prezzo_promo_oro", "speciale"],
    //schemiDescrizioni: [["DESCRIZIONE TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE TIPO", "DESCRIZIONE GRAMMATURA"]],
    schemiDescrizioni: [{
        schema: ["DESCRIZIONE TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE TIPO", "DESCRIZIONE GRAMMATURA"],
        setRegole: [[{campo: "speciale", operatore: "!IN", valore: "titolari"}]],
    },
    {
        schema: ["DESCRIZIONE TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE TIPO", "DESCRIZIONE GRAMMATURA","DESCRIZIONE CARTA"],
        setRegole: [[{campo: "speciale", operatore: "IN", valore: "titolari"}]],
    }],

    grandezzeBox:{
        bigBoxWidth: 200,
        bigBoxHeight: "auto",
        smallBoxWidth: "auto",
        smallBoxHeight: 30,
        bigBoxPerRow: 2,
        smallBoxPerRow: 4,
        marginBetweenBigBox: 10,
        marginBetweenSmallBox: 0,
    },
    
    schemiSpostamentoLabels: [{
        startingElement: ["prezzo_promo"], //l'elemento da cui si prende la posizione di partenza oer iniziare a collare gli altri elementi
        startingDistance: 5, //la distanza da mantenere tra l'elemento di partenza e il primo elemento da collocare
        orientamento: "alto-basso", //gli orientamenti possibili sono: alto-basso, basso-alto, sinistra-destra, destra-sinistra
        meccaniche: [], //[] indica tutte le meccaniche incluse
        meccanicheEscluse: [], //[] indica nessuna meccanica esclusa
        orderedElements: [{label:"prezzo_promo_kgl", distance:0}, {label:"prezzo", distance:0}] //gli elementi da collocare e la distanza da mantenere tra un elemento e l'altro
    }],

    abilitaDescrizioniRegionali : true,
    abilitaDescrizioniCanale : true,


    bindRefData: function(box, oggetto, pathLavorazione) {
        // console.log(app.activeDocument.filePath);
        // console.log(app.activeDocument.filePath.then(function(value){console.log(value.nativePath)}));   
        app.activeDocument.activeLayer = app.activeDocument.layers.itemByName("InPagina");
        box.itemLayer = app.activeDocument.layers.item("InPagina");
        countRef++;     
        console.log(countRef);
        
        try{
            var objToDelete = [];
            var objDeleted = [];
            tracciati = app.activeDocument.name.split("_")[0].toLowerCase();
            var daRevisionareStatica = false;
            for (var $box = 0; $box < box.allPageItems.length; $box++) {
                var item = box.allPageItems[$box];
                if (item.label == "txt_sconto") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["txt_sconto"] == null) {

                        if (oggetto["meccanica_" + tracciati] != null && oggetto["meccanica_" + tracciati].toLowerCase().indexOf("prezzo netto") == -1) {
                            item.contents = "";
                            var stringa = oggetto["meccanica_" + tracciati].toLowerCase().toString().replace("sconto ", "-");
                            var originalBound = item.geometricBounds;
                            item.geometricBounds = [originalBound[0], originalBound[1], originalBound[2], originalBound[3] + 100];
                            for (var i = 0; i < stringa.length; i++) {
                                //alert("stop");
                                if (stringa[i] == "-") {
                                    item.contents = item.contents + stringa[i];
                                    item.characters.item(i).appliedCharacterStyle = app.activeDocument.characterStyles.item("SCONTO_MENO");
                                } else if (stringa[i] == "%") {
                                    item.contents = item.contents + stringa[i];
                                    // console.log("= " + item.contents);
                                    // console.log("count " + item.contents.length);
                                    // console.log(item.characters.item(i));
                                    // console.log("char " + item.characters.item(i).contents);
                                    item.characters.item(i).appliedCharacterStyle = app.activeDocument.characterStyles.item("SCONTO_%");
                                }
                                else {
                                    item.contents = item.contents + stringa[i];
                                    item.characters.item(i).appliedCharacterStyle = app.activeDocument.characterStyles.item("SCONTO_VALORE");
                                }
                            }
                            item.geometricBounds = originalBound;
                        }
                    }
                    else{
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["txt_sconto"].toString());
                    }
                } else if (item.label=="box_sconto"){
                        if (oggetto["meccanica_"+tracciati] != null && oggetto["meccanica_"+tracciati] != "" && oggetto["meccanica_"+tracciati].toLowerCase().indexOf("prezzo netto") != -1) {
                            objToDelete.push(item);
                        }                
                    
                }else if (item.label == "prezzo") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["prezzo"] == null) {
                        if (oggetto["meccanica_" + tracciati] != null && oggetto["meccanica_" + tracciati] != "" && oggetto["meccanica_" + tracciati].toLowerCase().indexOf("prezzo netto") == -1) {
                            if (tracciati == "market") {
                                item.contents = "";
                                item.contents = "invece di " + oggetto["prezzo"] + "€";
                            }
                            else if (tracciati == "oro") {
                                item.contents = "";
                                item.contents = "invece di " + oggetto["prezzo_oro"] + "€";
                            }
                        }
                        else {
                            objToDelete.push(item);
                        }
                    }
                    else {
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["prezzo"].toString());
                    }
                }else if (item.label == "prezzo_promo") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["prezzo_promo"] == null) {
                        if (tracciati == "market") {
                            item.contents = "";
                            item.contents = "€ " + oggetto["prezzo_promo"];
                        }
                        else if (tracciati == "oro") {
                            item.contents = "";
                            item.contents = "€ " + oggetto["prezzo_promo_oro"];
                        }
                    }
                    else {
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["prezzo_promo"].toString());
                    }
                } else if (item.label == "base") {
                    item.label += "$" + box.label + "$" + oggetto["Referenza.Codice"] + "$" + oggetto["Scatto.CodiceGruppo"] + "$Nessuna Mastro";
                } else if (item.label == "sconto_alla_cassa") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["sconto_alla_cassa"] == null) {

                        // var prezzo_kgl = oggetto["prezzo_kgl"].toString().replace(",", ".");
                        // prezzo_kgl = parseFloat(prezzo_kgl);
                        // if (oggetto["prezzo_kgl"] != undefined && oggetto["prezzo_kgl"] != "" && prezzo_kgl != 0) {
                        //     objToDelete.push(item);
                        // }
                        if (oggetto["meccanica_" + tracciati] != null && oggetto["meccanica_" + tracciati].toString().toLowerCase().indexOf("alla cassa") >= 0) {
                            //niente
                        }
                        else {
                            objToDelete.push(item);
                        }
                    } else {
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["sconto_alla_cassa"].toString());
                    }
                } else if (item.label == "prezzo_info_pack") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["prezzo_info_pack"] == null) {

                        var prezzo_kgl = oggetto["prezzo_kgl"].toString().replace(",", ".");
                        prezzo_kgl = parseFloat(prezzo_kgl);
                        var reparti = ["gastronomia", "macelleria", "pescheria"];
                        if (oggetto["meccanica_" + tracciati] != null && oggetto["meccanica_" + tracciati].toString().toLowerCase().indexOf("alla cassa") >= 0) {
                            //niente
                        }
                        else {
                            if (reparti.includes(oggetto["reparto"].toLowerCase())) {
                                // if (prezzo_kgl != 0 && 
                                //     !(oggetto["prezzo_kgl"] != oggetto["prezzo_promo" + (tracciati == "market" ? "" : "_oro")] || 
                                //     oggetto["Descrizioni.Peso"] != 1)) {
                                //     objToDelete.push(item);
                                // }
                                var descrizione4 = oggetto["Descrizioni.Descrizione4"].toLowerCase() != null ? oggetto["Descrizioni.Descrizione4"].toLowerCase() : oggetto["Descrizioni.Descrizione4Tracciato"].toLowerCase();
                                if (descrizione4.indexOf("circa") >= 0 ||
                                    ((oggetto["settore"].toLowerCase() == "freschi" || oggetto["settore"].toLowerCase() == "freschissimi") && descrizione4 == "")) {

                                    if (oggetto["Descrizioni.Peso"].toString() == "1") {
                                        //niente
                                    }
                                    else {
                                        objToDelete.push(item);
                                    }
                                }
                                else{
                                    objToDelete.push(item);
                                }
    
                            }
                            else {
                                objToDelete.push(item);
                            }
                        }

                    } else {
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["prezzo_info_pack"].toString());
                    }
                }           

                if (item.label == "prezzo_promo_kgl") {
                    if (oggetto["SyncFromIndd"] == null || oggetto["SyncFromIndd"]["prezzo_promo_kgl"] == null) {

                        var prezzo_kgl = oggetto["prezzo_kgl"].toString().replace(",", ".");
                        prezzo_kgl = parseFloat(prezzo_kgl);
                        if (oggetto["prezzo_kgl"] != undefined && oggetto["prezzo_kgl"] != "" && prezzo_kgl != 0 &&
                            !oggetto['settore'].toString().toLowerCase().includes("chimica")) {
                            {
                                if (oggetto["meccanica_" + tracciati] != null && oggetto["meccanica_" + tracciati].toString().toLowerCase().indexOf("alla cassa") >= 0) {
                                    objToDelete.push(item);
                                }
                                else {
                                    var reparti = ["gastronomia", "macelleria", "pescheria"];
                                    if (reparti.includes(oggetto["reparto"].toLowerCase())) {
                                        // if (oggetto["Descrizioni.Peso"] != 1 && oggetto["prezzo_kgl"] != oggetto["prezzo_promo" + (tracciati == "market" ? "" : "_oro")]) {
                                        //     if (tracciati == "market") {
                                        //         item.contents = "";
                                        //         item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl"] + "€";
                                        //     }
                                        //     else if (tracciati == "oro") {
                                        //         item.contents = "";
                                        //         item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl_oro"] + "€";
                                        //     }
                                        // }
                                        // descrizione4
                                        var descrizione4 = oggetto["Descrizioni.Descrizione4"].toLowerCase() != null ? oggetto["Descrizioni.Descrizione4"].toLowerCase() : oggetto["Descrizioni.Descrizione4Tracciato"].toLowerCase();
                                        if (descrizione4.indexOf("circa") >= 0 ||
                                            ((oggetto["settore"].toLowerCase() == "freschi" || oggetto["settore"].toLowerCase() == "freschissimi") && descrizione4 == "")) {

                                            if (oggetto["Descrizioni.Peso"].toString() == "1") {
                                                objToDelete.push(item);
                                            }
                                            else {
                                                if (tracciati == "market") {
                                                    item.contents = "";
                                                    item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl"] + "€";
                                                }
                                                else if (tracciati == "oro") {
                                                    item.contents = "";
                                                    item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl_oro"] + "€";
                                                }
                                            }
                                        }

                                        if (tracciati == "market") {
                                            item.contents = "";
                                            item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl"] + "€";
                                        }
                                        else if (tracciati == "oro") {
                                            item.contents = "";
                                            item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl_oro"] + "€";
                                        }
                                    }
                                    else {
                                        if (tracciati == "market") {
                                            item.contents = "";
                                            item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl"] + "€";
                                        }
                                        else if (tracciati == "oro") {
                                            item.contents = "";
                                            item.contents = "al " + oggetto["Descrizioni.Um"].toLowerCase() + " " + oggetto["prezzo_kgl_oro"] + "€";
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            objToDelete.push(item);
                        }
                    } else {
                        this.inserisciContenutiConStile(item, oggetto["SyncFromIndd"]["prezzo_promo_kgl"].toString());
                    }
                }

                if(item.label=="descrizione"){
    
                    //allarghiamo il box di testo in verticale per impedire l'overflow mettendolo al quintuplo della sua grandezza verticale attuale
                    var originalBound = item.geometricBounds;
                    item.geometricBounds = [item.geometricBounds[0], item.geometricBounds[1], item.geometricBounds[2] + (item.geometricBounds[2] - item.geometricBounds[0]) * 4, item.geometricBounds[3]];
                    item.contents = "";
                    var insertedDescription = false;
                    var lastCharachter = " ";
                    if (oggetto["descrizione_gruppo"] != null && oggetto["Scatto.CodiceGruppo"] != oggetto["Referenza.Codice"]) {
                        if (oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"] != "") {
                            if (oggetto["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"] != undefined && oggetto["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"] != "") {
                                oggetto["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"]);
                                var stringa = oggetto["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"];
                                var tag = "";
                                for (var i = 0; i < stringa.length; i++) {
                                    if (stringa[i] == "<") {
                                        if(tag != "" && tag[0] != "/" && lastCharachter != " " && lastCharachter != "\n"){
                                            item.contents += " ";
                                        }
                                        tag = identificaTag(stringa, i);
                                        i += tag.length + 1;
                                    }
                                    else {
                                        item.contents += stringa[i];
                                        lastCharachter = stringa[i];

                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        if (tag != "") {
                                            var characterStyle = app.activeDocument.characterStyles.item(tag);
                                            if (characterStyle.isValid && item.contents.length > 0) {
                                                try {
                                                    item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                                                }
                                                catch (e) {
                                                    console.log(e);
                                                }
                                            }
                                            else {
                                                tag = tryCharacterConversion(tag);
                                                if (tag != "") {
                                                    characterStyle = app.activeDocument.characterStyles.item(tag);
                                                    if (characterStyle.isValid && item.contents.length > 0) {
                                                        item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                                                    }
                                                    else {
                                                        //throw "Errore: lo stile " + tag + " non esiste, inserimento errato nel dizionario di conversione";
                                                    }
                                                }
                                                else {
                                                    //throw "Errore: lo stile " + tag + " non esiste, inserire lo stile di conversione nel dizionario di conversione";
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                if (oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"] != undefined && oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"] != "") {
                                    var caratteriGiàInseriti = item.contents.length;
                                    oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"]);
                                    //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                    for (var i = 0; i < oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"].length; i++) {
                                        item.contents = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"][i];
                                        lastCharachter = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione1"][i];
                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE TITOLO");
                                    }

                                    insertedDescription = true;
                                }

                                if (oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"] != undefined && oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"] != "") {
                                    if(insertedDescription && lastCharachter != " " && lastCharachter != "\n"){
                                        item.contents += " ";
                                    }
                                    var caratteriGiàInseriti = item.contents.length;
                                    oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"]);
                                    //oggetto["Descrizioni.Descrizione2"] += "\n";
                                    //item.contents = item.contents + oggetto["Descrizioni.Descrizione2"] + "\n";
                                    for (var i = 0; i < oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"].length; i++) {
                                        item.contents = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"][i];
                                        lastCharachter = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione2"][i];

                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE_BRAND");
                                    }
                                    insertedDescription = true;
                                }
                                if (item.contents != "") {
                                    item.contents += "\n";
                                }

                                if (oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"] != undefined && oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"] != "") {
                                    if(insertedDescription && lastCharachter != " " && lastCharachter != "\n"){
                                        item.contents += " ";
                                    }
                                    var caratteriGiàInseriti = item.contents.length;
                                    oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"]);
                                    //item.contents = item.contents + oggetto["Descrizioni.Descrizione3"] + "\n";
                                    for (var i = 0; i < oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"].length; i++) {
                                        item.contents = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"][i];
                                        lastCharachter = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione3"][i];
                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE TIPO");
                                    }

                                    insertedDescription = true;
                                }

                                if (oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"] != undefined && oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"] != "") {
                                    
                                    var caratteriGiàInseriti = item.contents.length;
                                    oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"]);
                                    //item.contents = item.contents + oggetto["Descrizioni.Descrizione4"] + "\n";
                                    for (var i = 0; i < oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"].length; i++) {
                                        item.contents = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"][i];
                                        lastCharachter = item.contents + oggetto["descrizione_gruppo"]["Descrizioni.Descrizione4"][i];

                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE GRAMMATURA");
                                    }
                                }
                            }
                        }
                        else{
                            var caratteriGiàInseriti = item.contents.length;
                            if (oggetto["Descrizioni.Descrizione1"] != undefined && oggetto["Descrizioni.Descrizione1"] != "") {                             
                                oggetto["Descrizioni.Descrizione1"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.Descrizione1"]);
                                //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                for (var i = 0; i < oggetto["Descrizioni.Descrizione1"].length; i++) {
                                    item.contents = item.contents + oggetto["Descrizioni.Descrizione1"][i];
                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE TITOLO");
                                }                                
                            }
                            
                        }
                    }
                    else{
                        if (oggetto["Descrizioni.DescrizioneIndd"] != undefined && oggetto["Descrizioni.DescrizioneIndd"] != "") {
                            oggetto["Descrizioni.DescrizioneIndd"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.DescrizioneIndd"]);
                            var stringa = oggetto["Descrizioni.DescrizioneIndd"];
                            var tag = "";
                            for (var i = 0; i < stringa.length; i++) {
                                if (stringa[i] == "<") {
                                    if(tag != "" && lastCharachter != " " && lastCharachter != "\n"){
                                        item.contents += " ";
                                    }
                                    tag = identificaTag(stringa, i);
                                    i += tag.length + 1;
                                }
                                else {
                                    item.contents += stringa[i];
                                    lastCharachter = stringa[i];

                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    if (tag != "") {
                                        var characterStyle = app.activeDocument.characterStyles.item(tag);
                                        if (characterStyle.isValid && item.contents.length > 0) {
                                            try {
                                                item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                                            }
                                            catch (e) {
                                                console.log(e);
                                            }
                                        }
                                        else {
                                            tag = tryCharacterConversion(tag);
                                            if (tag != "") {
                                                characterStyle = app.activeDocument.characterStyles.item(tag);
                                                if (characterStyle.isValid && item.contents.length > 0) {
                                                    item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                                                }
                                                else {
                                                    //throw "Errore: lo stile " + tag + " non esiste, inserimento errato nel dizionario di conversione";
                                                }
                                            }
                                            else {
                                                //throw "Errore: lo stile " + tag + " non esiste, inserire lo stile di conversione nel dizionario di conversione";
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            if (oggetto["Descrizioni.Descrizione1"] != undefined && oggetto["Descrizioni.Descrizione1"] != "") {
                                var caratteriGiàInseriti = item.contents.length;
                                oggetto["Descrizioni.Descrizione1"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.Descrizione1"]);
                                //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                for (var i = 0; i < oggetto["Descrizioni.Descrizione1"].length; i++) {
                                    item.contents = item.contents + oggetto["Descrizioni.Descrizione1"][i];
                                    lastCharachter = item.contents + oggetto["Descrizioni.Descrizione1"][i];

                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE TITOLO");
                                }
                                insertedDescription = true;
                            }

                            if (oggetto["Descrizioni.Descrizione2"] != undefined && oggetto["Descrizioni.Descrizione2"] != "") {
                                if(insertedDescription && lastCharachter != " " && lastCharachter != "\n"){
                                    item.contents += " ";
                                }
                                var caratteriGiàInseriti = item.contents.length;
                                oggetto["Descrizioni.Descrizione2"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.Descrizione2"]);
                                //oggetto["Descrizioni.Descrizione2"] += "\n";
                                //item.contents = item.contents + oggetto["Descrizioni.Descrizione2"] + "\n";
                                for (var i = 0; i < oggetto["Descrizioni.Descrizione2"].length; i++) {
                                    item.contents = item.contents + oggetto["Descrizioni.Descrizione2"][i];
                                    lastCharachter = item.contents + oggetto["Descrizioni.Descrizione2"][i];
                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE_BRAND");
                                }
                                insertedDescription = true;
                            }
                            if (item.contents != "") {
                                item.contents += "\n";
                            }

                            if (oggetto["Descrizioni.Descrizione3"] != undefined && oggetto["Descrizioni.Descrizione3"] != "") {
                                if(insertedDescription && lastCharachter != " " && lastCharachter != "\n"){
                                    item.contents += " ";
                                }
                                var caratteriGiàInseriti = item.contents.length;
                                oggetto["Descrizioni.Descrizione3"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.Descrizione3"]);
                                //item.contents = item.contents + oggetto["Descrizioni.Descrizione3"] + "\n";
                                for (var i = 0; i < oggetto["Descrizioni.Descrizione3"].length; i++) {
                                    item.contents = item.contents + oggetto["Descrizioni.Descrizione3"][i];
                                    lastCharachter = item.contents + oggetto["Descrizioni.Descrizione3"][i];
                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE TIPO");
                                }
                                insertedDescription = true;
                            }

                            if (oggetto["Descrizioni.Descrizione4"] != undefined && oggetto["Descrizioni.Descrizione4"] != "") {
                                if(insertedDescription && lastCharachter != " " && lastCharachter != "\n"){
                                    item.contents += " ";
                                }
                                var caratteriGiàInseriti = item.contents.length;
                                oggetto["Descrizioni.Descrizione4"] = customAgenzia.replaceAllSpecialCharacters(oggetto["Descrizioni.Descrizione4"]);
                                //item.contents = item.contents + oggetto["Descrizioni.Descrizione4"] + "\n";
                                for (var i = 0; i < oggetto["Descrizioni.Descrizione4"].length; i++) {
                                    item.contents = item.contents + oggetto["Descrizioni.Descrizione4"][i];
                                    lastCharachter = item.contents + oggetto["Descrizioni.Descrizione4"][i];
                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DESCRIZIONE GRAMMATURA");
                                }

                            }
                        }
                    }
                    item.geometricBounds = originalBound;
                    //controlliamo se è in overflow e se lo è entriamo in while finchè è in overflow e allarghiamo poco alla volta il box di testo in verticale finchè non è più in overflow (inserendo un controllo di sicurezza che dopo 100 cicli esce)
                    var i = 0;
                    while(item.overflows && i < 100){
                        item.geometricBounds = [item.geometricBounds[0], item.geometricBounds[1], item.geometricBounds[2] + 1, item.geometricBounds[3]];
                        i++;
                    }

                    if (item.overflows) {
                        console.log("Errore: il box di testo è ancora in overflow dopo 100 cicli, controllare la stringa di descrizione");
                    }
                }

                if (item.label == "da_revisionare") {
                    daRevisionareStatica = true;
                    //se è un singolo controlliamo il valore della chiave statoRevisioneSingolo altrimenti quello di statoRevisioneGruppo
                    if (oggetto["Scatto.CodiceGruppo"] != oggetto["Referenza.Codice"]) {
                        switch (oggetto["statoRevisioneGruppo"]) {
                            case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Non trovato";
                                    }
                                }
                                break;
                            case 1: //l'oggetto è revisionato
                                item.visible = false;
                                break;
                            case 2: //l'oggetto è da revisionare
                                item.visible = true;
                                break;
                            case 3: //l'oggetto è da confermare
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Da confermare";
                                    }
                                    //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
                                    if (item2.constructor.name == "Rectangle") {
                                        //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
                                        var colore = null;
                                        for (var j = 0; j < app.activeDocument.swatches.length; j++) {
                                            if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
                                                colore = app.activeDocument.swatches.item(j);
                                            }
                                        }
                                        if (colore == null) {
                                            colore = app.activeDocument.colors.add();
                                            colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
                                            colore.name = "c16m13y86k1";
                                        }
                                        item2.fillColor = colore;
                                    }
                                }
                                break;
                            default:
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Stato non valido: "+oggetto["statoRevisioneGruppo"];
                                    }
                                }
                                break;
                        }
                    }
                    else{
                        switch (oggetto["statoRevisioneSingolo"]) {
                            case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Non trovato";
                                    }
                                }
                                break;
                            case 1: //l'oggetto è revisionato
                                item.visible = false;
                                break;
                            case 2: //l'oggetto è da revisionare
                                item.visible = true;
                                break;
                            case 3: //l'oggetto è da confermare
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Da confermare";
                                    }
                                    //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
                                    if (item2.constructor.name == "Rectangle") {
                                        //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
                                        var colore = null;
                                        for (var j = 0; j < app.activeDocument.swatches.length; j++) {
                                            if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
                                                colore = app.activeDocument.swatches.item(j);
                                            }
                                        }
                                        if (colore == null) {
                                            colore = app.activeDocument.colors.add();
                                            colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
                                            colore.name = "c16m13y86k1";
                                        }
                                        item2.fillColor = colore;
                                    }
                                }
                                break;
                            default:
                                item.visible = true;
                                for (var i = 0; i < item.allPageItems.length; i++) {
                                    var item2 = item.allPageItems[i];
                                    //guardiamo se item2 è un textframe
                                    if (item2.constructor.name == "TextFrame") {
                                        item2.contents = "Stato non valido :"+oggetto["statoRevisioneSingolo"];
                                    }
                                }
                                break;
                        }
                    }
                }

                // //se l'item è di tipo textarea, il content è vuoto e la lista già non contiene un oggetto con la stessa label aggiungiamolo ai rimossi
                 if(item.constructor.name == "TextFrame" && !item.label.startsWith("base") && item.contents == "" && objToDelete.find(f=> f.label == item.label) == null){
                    objToDelete.push(item);
                }
            }

            for (var i=objToDelete.length-1; i>=0; i--){
                //salviamo in una lista di oggetto per ogni elemento un oggetto con label, altezza e larghezza
                var obj = {
                    label: objToDelete[i].label,
                    height: objToDelete[i].geometricBounds[2] - objToDelete[i].geometricBounds[0],
                    width: objToDelete[i].geometricBounds[3] - objToDelete[i].geometricBounds[1]
                }
                objDeleted.push(obj);
                //eliminiamo l'oggetto
                objToDelete[i].remove();
            }

            if(!daRevisionareStatica){
                //creiamo la banda da revisionare e la appendiamo al box, dobbiamo creare un rettangolo con altezza 10mm e larghezza uguale a quella del box, al suo interno dobbiamo piazzare una text area con la scritta "da revisionare" e ragruppiamo tutto in un gruppo con label da_revisionare che poi appendiamo al box e lo portiamo in primo piano
                var larghezzaBox = box.geometricBounds[3] - box.geometricBounds[1];
                var altezzaBox = box.geometricBounds[2] - box.geometricBounds[0];
                var g_new = [box.geometricBounds[0]+((altezzaBox/10)*3), box.geometricBounds[1]+(larghezzaBox/50), box.geometricBounds[0]+((altezzaBox/10)*3)+10, box.geometricBounds[3]-(larghezzaBox/50)];
                var g_new_text = [box.geometricBounds[0]+((altezzaBox/10)*3)+0.88, box.geometricBounds[1]+(larghezzaBox/50)+0.88, box.geometricBounds[0]+((altezzaBox/10)*3)+9.12, box.geometricBounds[3]-(larghezzaBox/50)-0.88];
                var rect = box.parentPage.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: g_new});
                rect.fillColor = "c37m96y76k10";
                //mettiamo il bordo CONAD_Rosso
                rect.strokeWeight = 5;
                rect.strokeColor = "CONAD_Rosso";
                var text = rect.parentPage.textFrames.add();
                text.geometricBounds = g_new_text;
                text.texts.item(0).appliedCharacterStyle = app.activeDocument.characterStyles.item("EURO WHITE");
                text.contents = "Da revisionare";
                //centriamo il testo sia verticalmente che orizzontalmente
                text.parentStory.justification = Justification.CENTER_ALIGN;
                text.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;

                //usiamo lo stile EURO WHITE
                //creiamo un gruppo in pagina 
                var items = [rect, text];
                var group = box.parentPage.groups.add(items);
                //var group = box.parentPage.groups.add([rect, text]);
                group.label = "da_revisionare";
                //appendiamo il gruppo al box e lo spostiamo in primo piano rispetto agli altri elementi del box usando il bring to front

                var oldGroup = box;
                var oldLabel = box.label;
                var oldItems = box.pageItems.everyItem().getElements();
                oldGroup.ungroup();
                group.bringToFront();
                var newItems = oldItems.concat(group);
                var newGroup = item.parentPage.groups.add(newItems);
                newGroup.label = oldLabel;
                box = newGroup;
                app.selection = [box];
                

                if (oggetto["Scatto.CodiceGruppo"] != oggetto["Referenza.Codice"]) {
                    switch (oggetto["statoRevisioneGruppo"]) {
                        case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
                            group.visible = true;
                            for (var i = 0; i < group.allPageItems.length; i++) {
                                var item2 = group.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Non trovato";
                                }
                            }
                            break;
                        case 1: //l'oggetto è revisionato
                        group.visible = false;
                            break;
                        case 2: //l'oggetto è da revisionare
                        group.visible = true;
                            break;
                        case 3: //l'oggetto è da confermare
                        group.visible = true;
                            for (var i = 0; i < group.allPageItems.length; i++) {
                                var item2 = group.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Da confermare";
                                }
                                //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
                                if (item2.constructor.name == "Rectangle") {
                                    //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
                                    var colore = null;
                                    for (var j = 0; j < app.activeDocument.swatches.length; j++) {
                                        if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
                                            colore = app.activeDocument.swatches.item(j);
                                        }
                                    }
                                    if (colore == null) {
                                        colore = app.activeDocument.colors.add();
                                        colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
                                        colore.name = "c16m13y86k1";
                                    }
                                    item2.fillColor = colore;
                                }
                            }
                            break;
                        default:
                            group.visible = true;
                            for (var i = 0; i < group.allPageItems.length; i++) {
                                var item2 = group.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Stato non valido: "+oggetto["statoRevisioneGruppo"];
                                }
                            }
                            break;
                    }
                }
                else{
                    switch (oggetto["statoRevisioneSingolo"]) {
                        case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
                        group.visible = true;
                            for (var i = 0; i < group.allPageItems.length; i++) {
                                var item2 = group.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Non trovato";
                                }
                            }
                            break;
                        case 1: //l'oggetto è revisionato
                        group.visible = false;
                            break;
                        case 2: //l'oggetto è da revisionare
                        group.visible = true;
                            break;
                        case 3: //l'oggetto è da confermare
                        group.visible = true;
                            for (var i = 0; i < group.allPageItems.length; i++) {
                                var item2 = group.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Da confermare";
                                }
                                //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
                                if (item2.constructor.name == "Rectangle") {
                                    //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
                                    var colore = null;
                                    for (var j = 0; j < app.activeDocument.swatches.length; j++) {
                                        if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
                                            colore = app.activeDocument.swatches.item(j);
                                        }
                                    }
                                    if (colore == null) {
                                        colore = app.activeDocument.colors.add();
                                        colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
                                        colore.name = "c16m13y86k1";
                                    }
                                    item2.fillColor = colore;
                                }
                            }
                            break;
                        default:
                            item.visible = true;
                            for (var i = 0; i < item.allPageItems.length; i++) {
                                var item2 = item.allPageItems[i];
                                //guardiamo se item2 è un textframe
                                if (item2.constructor.name == "TextFrame") {
                                    item2.contents = "Stato non valido :"+oggetto["statoRevisioneSingolo"];
                                }
                            }
                            break;
                    }
                }
            }

            for(var $box = 0; $box < box.allPageItems.length; $box++){
                var listFoto = [];
                var item = box.allPageItems[$box];
                if(item.label=="foto"){
                    var secondarie = 0;

                    for (var i = 0; i < oggetto["ElementiGruppo"].length; i++) {
                        var elemento = oggetto["ElementiGruppo"][i];
                        if(elemento["StatoSelezione"] == 2){
                            var path = pathLavorazione+ "/Links/" + elemento["Foto.Nome"];
                            var offset = 0;//10 * (secondarie+1);
                            var g_new = [item.geometricBounds[0]+offset, item.geometricBounds[1]+offset, item.geometricBounds[2]+offset, item.geometricBounds[3]+offset];
                            var photo = item.parentPage.rectangles.add(item.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: g_new});
                            listFoto.push(photo);
                            try{
                                photo.label = "foto_secondaria";
                                photo.place(path);
                                photo.fillColor = "None";
                                photo.fit(FitOptions.PROPORTIONALLY); 
                                photo.fit(FitOptions.FRAME_TO_CONTENT);
                                secondarie++;
                                //mettiamo foto sul livello InPagina
                                photo.itemLayer = app.activeDocument.layers.item("InPagina");

                                if (item.parent.constructor.name == "Group") {
                                    var oldGroup = item.parent;
                                    var oldLabel = oldGroup.label; 
                                    var oldItems = oldGroup.pageItems.everyItem().getElements();
                                    oldGroup.ungroup();
                                    var newItems = oldItems.concat(photo);
                                    var newGroup = item.parentPage.groups.add(newItems);
                                    photo.sendToBack();
                                    newGroup.label = oldLabel;
                                    box = newGroup;
                                }                      
                            }
                            catch(err){
                                //eliminiamo la foto secondaria
                                photo.remove();
                                console.log(err);
                                messaggioUtente("Foto secondaria "+elemento["Foto.Nome"]+" non posizionata, errore:" + err, "error")
                            }
                        }
                    }

                    for (var i = 0; i < oggetto["ElementiGruppo"].length; i++) {
                        var elemento = oggetto["ElementiGruppo"][i];
                        console.log(elemento);
                        if (elemento["StatoSelezione"] == 1 || elemento["Referenza.Codice"] == elemento["Scatto.CodiceGruppo"]) {
                            try {
                                listFoto.unshift(item);
                                var path = pathLavorazione+ "/Links/" + elemento["Foto.Nome"]
                                item.place(path);
                                item.fillColor = "None";
                                item.fit(FitOptions.PROPORTIONALLY); 
                                item.fit(FitOptions.FRAME_TO_CONTENT); 
                                item.sendToBack();
                            } catch (err) {
                                console.log(err);
                            }
                        }
                    }        

                    if (oggetto["ElementiGruppo"].length > 0) {
                        //cicliamo adesso tutti gli elementi del bocx cercando quelo che inizia per base e che con lo split[0] sia uguale a base
                        for (var j = 0; j < item.parent.allPageItems.length; j++) {
                            var item2 = item.parent.allPageItems[j];
                            if (item2.label != null && item2.label != "" && item2.label.startsWith("base") && item2.label.split("$")[0] == "base") {
                                item2.sendToBack();
                            }
                        }
                    }

                    if (listFoto.length > 0) {
                        CssFramework.MAIN_fixFoto(listFoto, listFoto[0].geometricBounds);
                    }
                    break;
                }
            }

            if (oggetto["Foto.Extra"] != undefined) {
                for (var i = 0; i < oggetto["Foto.Extra"].length; i++) {
                    var fotoExtra = oggetto["Foto.Extra"][i];
                    this.impaginaFotoExtra(fotoExtra["NomeReale"], fotoExtra["Tipo"], box, pathLavorazione);
                }
            }

            if (oggetto["FotoExtraAuto"] != undefined) {
                for (var i = 0; i < oggetto["FotoExtraAuto"].length; i++) {
                    var fotoExtraAuto = oggetto["FotoExtraAuto"][i];
                    if (fotoExtraAuto.escluso == false) {
                        this.impaginaFotoExtra(fotoExtraAuto.nomeFoto, 2, box, pathLavorazione, true);
                    }
                }
            }
            
            customAgenzia.spostaLabelsFix(box, objDeleted, "auto");
        }
        catch(e){
            console.log(e);
            //alert(e);
        }
        return box;        
    },

    spostaLabelsFix(box, objDeleted){
        //le modalità sono: auto, manuale

        //se box è nullo assegnamo a box l'elemento selezionato corrente
        if(box == null){
            box = app.selection[0];
        }

        //leggiamo customAgenzia.schemiSpostamentoLabels in cui ci sono tutte le informazioni da applicare, per ogni oggetto in lista seguiamo i seguenti passaggi
        //mappiamo il box di modo da prendere i riferimenti distinti a: l'oggetto con label uguale a startingElement e tutti gli oggetti che appaiono in lista orderedElements e per ogni oggetto cerchiamo la label

        for(var i = 0; i < customAgenzia.schemiSpostamentoLabels.length; i++){
            var schema = customAgenzia.schemiSpostamentoLabels[i];
            //leggiamo la label del box, se schema.meccaniche è != [] e box.label non è presente in schema.meccaniche passiamo al prossimo schema
            //se schema.meccanicheEscluse include box.label passiamo al prossimo schema
            if(schema.meccaniche.length > 0 && !schema.meccaniche.includes(box.label)){
                continue;
            }
            if(schema.meccanicheEscluse.length > 0 && schema.meccanicheEscluse.includes(box.label)){
                continue;
            }


            var item = box.pageItems.itemByRange(0, box.pageItems.length-1);
            //scorriamo tutti gli startingElement in cerca del primo che si trova nel box
            var startingElement = null;
            for ( var j = 0; j < schema.startingElement.length; j++){
                startingElement = item.getElements().find(function(item){return item.label == schema.startingElement[j]});
                if(startingElement != null){
                    break;
                }
            }
            if(startingElement == null){
                messaggioUtente("Lo startingElement "+schema.startingElement+" non è presente nel box, schema di spostamento non applicato", "warning");
                continue;
            }
            var orderedElements = [];
            for(var j = 0; j < schema.orderedElements.length; j++){
                var elementDeleted = box.pageItems.itemByRange(0, box.pageItems.length-1).getElements().filter(function(item){return item.label == schema.orderedElements[j].label});
                if(elementDeleted.length > 0){
                    orderedElements.push({
                        element: elementDeleted[0],
                        distance: schema.orderedElements[j].distance
                    });
                }
            }
            if(orderedElements.length == 0){
                continue;
            }
            console.log(orderedElements);
            //se boxMeccanicaOriginale è null e startingElement non è null prendiamo ora i bound dello starting element e li salviamo da parte
            //altrimenti calcoliamo i bound dello starting element rispetto a boxMeccanicaOriginale e poi troviamo il corrispettivo nel box
            var startingElementBounds = null;
            //startingElementBounds = startingElement.geometricBounds;
            startingElementBounds = customAgenzia.leggiBoundsTesto(startingElement);

            //ora abbiamo la posizione dell'elemento iniziale rispetto al box, è possibile però che lo starting element non sia presente nel box (è il caso in cui boxMeccanicaOriginale è != null)
            //ora posizioniamo gli elementi successivi facendo uno switch su schema.orientamento è spostando gli elementi come di dovere   

            if (objDeleted == null || objDeleted.length == 0) {
                for (var j = 0; j < orderedElements.length; j++) {
                    var orderedElement = orderedElements[j];                    
                    //var orderedElementBounds = orderedElement.element.geometricBounds;
                    var orderedElementBounds = customAgenzia.leggiBoundsTesto(orderedElement.element);
                    var altezza = orderedElementBounds[2] - orderedElementBounds[0];
                    var larghezza = orderedElementBounds[3] - orderedElementBounds[1];
                    switch (schema.orientamento) {
                        case "alto-basso":
                            //se boxMeccanicaOriginale è null spostiamo l'elemento ordinato in modo che sia sotto gli startingElementBounds muovendolo solo sulla y
                            if (j == 0) {
                                orderedElement.element.geometricBounds = [startingElementBounds[2] + schema.startingDistance, orderedElementBounds[1], startingElementBounds[2] + schema.startingDistance + altezza, orderedElementBounds[3]];
                            }
                            else {
                                //lo posizioniamo sotto l'elemento precedente
                                var previousElement = orderedElements[j - 1];
                                var previousElementBounds = previousElement.element.geometricBounds;

                                orderedElement.element.geometricBounds = [previousElementBounds[2] + previousElement.distance, orderedElementBounds[1], previousElementBounds[2] + previousElement.distance + altezza, orderedElementBounds[3]];
                            }
                            break;
                        case "basso-alto":
                            //se boxMeccanicaOriginale è null spostiamo l'elemento ordinato in modo che sia sopra gli startingElementBounds muovendolo solo sulla y
                            if (j == 0) {
                                orderedElement.element.geometricBounds = [startingElementBounds[0] - schema.startingDistance - altezza, orderedElementBounds[1], startingElementBounds[0] - schema.startingDistance, orderedElementBounds[3]];
                            }
                            else {
                                //lo posizioniamo sopra l'elemento precedente
                                var previousElement = orderedElements[j - 1];
                                var previousElementBounds = previousElement.element.geometricBounds;

                                orderedElement.element.geometricBounds = [previousElementBounds[0] - previousElement.distance - altezza, orderedElementBounds[1], previousElementBounds[0] - previousElement.distance, orderedElementBounds[3]];
                            }                     
                            break;
                        case "sinistra-destra":
                            //se boxMeccanicaOriginale è null spostiamo l'elemento ordinato in modo che sia a destra degli startingElementBounds muovendolo solo sulla x
                            if (j == 0) {
                                orderedElement.element.geometricBounds = [orderedElementBounds[0], startingElementBounds[3] + schema.startingDistance, orderedElementBounds[2], startingElementBounds[3] + schema.startingDistance + larghezza];
                            }
                            else {
                                //lo posizioniamo a destra dell'elemento precedente
                                var previousElement = orderedElements[j - 1];
                                var previousElementBounds = previousElement.element.geometricBounds;

                                orderedElement.element.geometricBounds = [orderedElementBounds[0], previousElementBounds[3] + previousElement.distance, orderedElementBounds[2], previousElementBounds[3] + previousElement.distance + larghezza];
                            }                          
                            break;
                        case "destra-sinistra":
                            //se boxMeccanicaOriginale è null spostiamo l'elemento ordinato in modo che sia a sinistra degli startingElementBounds muovendolo solo sulla x
                            if (j == 0) {
                                orderedElement.element.geometricBounds = [orderedElementBounds[0], startingElementBounds[1] - schema.startingDistance - larghezza, orderedElementBounds[2], startingElementBounds[1] - schema.startingDistance];
                            }
                            else {
                                //lo posizioniamo a sinistra dell'elemento precedente
                                var previousElement = orderedElements[j - 1];
                                var previousElementBounds = previousElement.element.geometricBounds;

                                orderedElement.element.geometricBounds = [orderedElementBounds[0], previousElementBounds[1] - previousElement.distance - larghezza, orderedElementBounds[2], previousElementBounds[1] - previousElement.distance];
                            }
                            break;
                        default:
                            messaggioUtente("Orientamento "+schema.orientamento+" non valido, schema di spostamento non applicato", "error");
                        break;
                    }
                }
            }
            else {
                //il comportamento è simile a quello di prima ma invece che usare le distance per spostare gli elementi sfruttiamo le grandezze degli elementi rimossi
                //scorriamo schema.orderedElements, per ogni elemento se esso appare in objDeleted prendiamo tuttu gli orderedElements ricavati e li spostiamo a seconda dell'orientamento pari all'altezza o alla larghezza dell'elemento eliminato
                for (var j = 0; j < schema.orderedElements.length; j++) {
                    var el = schema.orderedElements[j];
                    //cerchiamo el.label in objDeleted
                    var elementDeleted = objDeleted.find(function(item){return item.label == el.label});
                    //se element è stato trovato prendiamo tutti gli elementi di orderedElements e li spostiamo a seconda dell'orientamento
                    if (elementDeleted != null) {
                        var altezza = elementDeleted.height;
                        var larghezza = elementDeleted.width;
                        //prendiamo l'order element con etichetta successiva a schema.orderedElements[j], se non c'è cerchiamo il successivo fino a trovare o a terminare la lista
                        var nextElementInx = null;
                        for (var k = j + 1; k < schema.orderedElements.length; k++) {
                            var next = schema.orderedElements[k];
                            var nextElement = orderedElements.find(function(item){return item.element.label == next.label});
                            if (nextElement != null) {
                                nextElementInx = orderedElements.indexOf(nextElement);
                                break;
                            }
                        }

                        if (nextElementInx == null) {
                            continue;
                        }
                        //adesso spostiamo in base all'ordinamento tutti gli orderedElements con indice uguale e maggiore al nextElement pari all'altezza o alla larghezza dell'elemento eliminato
                        for (var k = nextElementInx; k < orderedElements.length; k++) {
                            var orderedElement = orderedElements[k];
                            var orderedElementBounds = orderedElement.element.geometricBounds;
                            switch (schema.orientamento) {
                                case "alto-basso":
                                    //spostiamo in alto di elementDeleted.height
                                    orderedElement.element.geometricBounds = [orderedElementBounds[0] - elementDeleted.height, orderedElementBounds[1], orderedElementBounds[2] - elementDeleted.height, orderedElementBounds[3]];
                                    break;
                                case "basso-alto":
                                    //spostiamo in basso di elementDeleted.height
                                    orderedElement.element.geometricBounds = [orderedElementBounds[0] + elementDeleted.height, orderedElementBounds[1], orderedElementBounds[2] + elementDeleted.height, orderedElementBounds[3]];
                                    break;
                                case "sinistra-destra":
                                    //spostiamo a sinistra di elementDeleted.width
                                    orderedElement.element.geometricBounds = [orderedElementBounds[0], orderedElementBounds[1] - elementDeleted.width, orderedElementBounds[2], orderedElementBounds[3] - elementDeleted.width];
                                    break;
                                case "destra-sinistra":
                                    //spostiamo a destra di elementDeleted.width
                                    orderedElement.element.geometricBounds = [orderedElementBounds[0], orderedElementBounds[1] + elementDeleted.width, orderedElementBounds[2], orderedElementBounds[3] + elementDeleted.width];
                                    break;
                                default:
                                    messaggioUtente("Orientamento " + schema.orientamento + " non valido, schema di spostamento non applicato", "error");
                                    break;
                            }
                        }
                    }
                }

                // //per ogni elemento ordinato cerchiamo l'elemento successivo e lo spostiamo in modo che sia sopra l'elemento ordinato
                // for(var j = 0; j < orderedElements.length; j++){
                //     var orderedElement = orderedElements[j];
                //     var nextElement = null;
                //     for(var k = 0; k < box.pageItems.length; k++){
                //         if(box.pageItems[k] == orderedElement){
                //             if(k+1 < box.pageItems.length){
                //                 nextElement = box.pageItems[k+1];
                //             }
                //             break;
                //         }
                //     }
                //     if(nextElement != null){
                //         nextElement.move(LocationOptions.AFTER, orderedElement);
                //     }
                // }
            }
        }
    },

    impaginaFotoExtra(fotoExtraNome, FotoExtraTipo, box, pathLavorazione, auto = false) {

        var possibleConflincts = [
            {
            label: "descrizione",
            labelMode: "==", //==, !=, startsWith, endsWith, contains
            movementType: "sposta", //sposta, manda a
            cordinate: [], // [x, y] a cui mandare l'elemento se movementType è manda a
            cordinateBox: "", // "alto-sinistra", "alto-centrale", "alto-destra", "basso-sinistra", "basso-centrale", "basso-destra", "centro-sinistra", "centro-centrale", "centro-destra" a cui mandare l'elemento se movementType è manda a e non sono state date coordinate specifiche
            offsetX: 0, //offset in x se movementType è sposta
            offsetY: -1, //offset in y se movementType è sposta
            direction: "alto", //nessuna, alto, basso, destra, sinistra, La direnzione in cui spostare l'elemento se movementType è sposta, lo spostamento viene applicato per evitare il conflitto e poi viene applicato l'offset
            }
        ];
        //se ci sono foto extra di Tipo 4 (Foto ambientate) in oggetto le inserisco nel box creandole ex novo, non devo cercare negli elementi del gruppo
        if (FotoExtraTipo == 4) {
            try {
                //controlliamo se esiste già la foto nel box con lo stesso nome, se esiste la cancelliamo
                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label == "foto_extra$" + fotoExtraNome+"$tipo_4") {
                        item.remove();
                    }
                }

                var path = pathLavorazione + "/Links/" +fotoExtraNome;
                //usiamo i geometric bouns del box
                var bounds = box.geometricBounds;
                var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, { geometricBounds: bounds });
                //var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: [0, 0, 0, 0]});
                //la label è foto_ambientata$nomefoto
                photo.label = "foto_extra$" + fotoExtraNome+"$tipo_4";
                photo.place(path);
                photo.fillColor = "None";
                photo.fit(FitOptions.PROPORTIONALLY);
                photo.fit(FitOptions.FRAME_TO_CONTENT);
                //mettiamo la foto sullo sfondo del box
                photo.sendToBack();

            }
            catch (err) {
                console.log(err);
                messaggioUtente("Foto ambientata "+fotoExtraNome+" non posizionata, errore:" + err, "error")

            }
        }
        if (FotoExtraTipo == 3) { //logo
            try {
                //controlliamo se esiste già la foto nel box con lo stesso nome, se esiste la cancelliamo
                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label == "foto_extra$" + fotoExtraNome +"$tipo_3") {
                        item.remove();
                    }
                }

                var path = pathLavorazione + "/Links/" +fotoExtraNome;
                //prendiamo i bounds di modo che indichino la parte alta del box
                var bounds = box.geometricBounds; // [y1, x1, y2, x2]
                var newY1 = bounds[0]; // y superiore del box
                //newY2 deve essere alta quanto il 15% del box
                var newy2 = bounds[0] + ((bounds[2] - bounds[0]) * 0.25);
                var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds:[newY1, bounds[1], newy2, bounds[3]]});
                //var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: [0, 0, 0, 0]});
                //la label è foto_ambientata$nomefoto
                photo.label = "foto_extra$" + fotoExtraNome+"$tipo_3";
                photo.place(path);
                photo.fillColor = "None";
                photo.fit(FitOptions.PROPORTIONALLY);
                photo.fit(FitOptions.FRAME_TO_CONTENT);
                //mettiamo la foto sullo sfondo del box
                photo.bringToFront();
            }
            catch (err) {
                console.log(err);
                messaggioUtente("Logo "+fotoExtraNome+" non posizionato, errore:" + err, "error")
            }
        }
        if (FotoExtraTipo == 2) { //bollino
            try {
                //controlliamo se esiste già la foto nel box con lo stesso nome, se esiste la cancelliamo
                var tipi2Trovati = 1;
                var boundsUltimoBollino = null;
                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label == "foto_extra$" + fotoExtraNome+"$tipo_2") {
                        item.remove();
                    }
                    else if (item.label.startsWith("foto_extra$") && item.label.includes("$tipo_2")) {
                        tipi2Trovati++;
                        if(boundsUltimoBollino == null){
                            boundsUltimoBollino = item.geometricBounds;
                        }
                        else{
                            var bounds = item.geometricBounds;
                            if(bounds[0] < boundsUltimoBollino[0]){
                                boundsUltimoBollino = bounds;
                            }
                        }
                    }
                }

                var path = "";
                if (!auto){
                    path = pathLavorazione + "/Links/" +fotoExtraNome;
                }
                else{
                    path = pathLavorazione + "/Links/bollini/" +fotoExtraNome;
                }

                var altezzaSeparatore = 12;
                //prendiamo i bounds di modo che indichino la parte alta del box
                var bounds = box.geometricBounds; // [y1, x1, y2, x2]
                var newY1 = (boundsUltimoBollino == null ? bounds[2] - (9 * (tipi2Trovati-1)) - 2 : boundsUltimoBollino[0] - altezzaSeparatore);
                //creiamo un rettangolo che occupi il 20% del box in altezza e in larghezza
                var newy2 = (boundsUltimoBollino == null ? bounds[2] - (9 * tipi2Trovati) - 2 : boundsUltimoBollino[0]);
                //facciamo lo stesso con la x ma partendo dal lato destro
                var newX1 = (boundsUltimoBollino == null ? bounds[3] - (9) - 4 : boundsUltimoBollino[1]);
                var newx2 = (boundsUltimoBollino == null ? bounds[3] : boundsUltimoBollino[3]);

                var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds:[newY1, newX1, newy2, newx2]});
                //var photo = box.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: [0, 0, 0, 0]});
                //la label è foto_ambientata$nomefoto
                photo.label = "foto_extra$" + fotoExtraNome+"$tipo_2";
                photo.place(path);
                photo.fillColor = "None";
                photo.fit(FitOptions.PROPORTIONALLY);
                photo.fit(FitOptions.FRAME_TO_CONTENT);
                photo.frameFittingOptions.autoFit = true;
                //mettiamo la foto sullo sfondo del box
                photo.bringToFront();

                //controlliamo i possibili conflitti per farlo dobbiamo vedere se nel box i bounds di photo si sovrappongono con elementi di possibleConflincts
                for (var i = 0; i < possibleConflincts.length; i++) {
                    var conflitto = possibleConflincts[i];
                    //cerchiamo nel box l'elemento con label corrispondente, se non c'è continuiamo
                    var element = box.pageItems.itemByRange(0, box.pageItems.length-1).getElements().find(function(item) {
                        switch (conflitto.labelMode) {
                            case "==":
                                return item.label == conflitto.label;
                            case "!=":
                                return item.label != conflitto.label;
                            case "startsWith":
                                return item.label.startsWith(conflitto.label);
                            case "endsWith":
                                return item.label.endsWith(conflitto.label);
                            case "contains":
                                return item.label.includes(conflitto.label);
                            default:
                                return false;
                        }
                    });
                    if (element == null) {
                        continue;
                    }
                    var elementIsTextFrame = element.constructor.name == "TextFrame";               

                    //ora leggiamo i bound di photo e di element e vediamo se si sovrappongono
                    var boundsPhoto = photo.geometricBounds;                   
                    var boundsElement = element.geometricBounds;
                    
                    if (elementIsTextFrame) {
                        //se è un textframe i bound che dobbiamo considerare sono quelli delle scritte, pertanto leggiamo le lines
                        //prendiamo la baseLine dell'ultima line e la baseline + ascent della prima line per i bounds 0 e 2
                        //prendiamo poi horizontalOffset e endHorizontalOffset per i bounds 1 e 3
                        var lines = element.lines;
                        if (lines.length > 0) {
                            var startLine = lines.item(0);
                            var endLine = lines.item(lines.length - 1);
                            var endHorizontalOffsetMax = null;
                            //troviamo l'endHorizontalOffset più lungo tra tutte le lines
                            for (var j = 0; j < lines.length; j++) {
                                var line = lines.item(j);
                                if (endHorizontalOffsetMax == null || line.endHorizontalOffset > endHorizontalOffsetMax) {
                                    endHorizontalOffsetMax = line.endHorizontalOffset;
                                }
                            }
                            boundsElement = [startLine.baseline - startLine.ascent, startLine.horizontalOffset, endLine.baseline, endHorizontalOffsetMax];
                        }
                    }
                    
                    if (boundsPhoto[0] < boundsElement[2] && boundsPhoto[2] > boundsElement[0] && boundsPhoto[1] < boundsElement[3] && boundsPhoto[3] > boundsElement[1]) {
                        //siccome si sovrappongono facciamo uno switch di movementype
                        switch (conflitto.movementType) {
                            case "sposta":
                                //spostiamo photo in base alla direzione
                                switch (conflitto.direction) {
                                    case "alto":
                                        photo.geometricBounds = [boundsElement[0] + (boundsPhoto[0] - boundsPhoto[2]), boundsPhoto[1], boundsElement[0], boundsPhoto[3]];
                                        break;
                                    case "basso":
                                        photo.geometricBounds = [boundsElement[2], boundsPhoto[1], boundsElement[2] + (boundsPhoto[0] - boundsPhoto[2]), boundsPhoto[3]];
                                        break;
                                    case "sinistra":
                                        photo.geometricBounds = [boundsPhoto[0], boundsElement[1] - (boundsPhoto[3] - boundsPhoto[1]), boundsPhoto[2], boundsElement[1]];
                                        break;
                                    case "destra":
                                        photo.geometricBounds = [boundsPhoto[0], boundsElement[3], boundsPhoto[2], boundsElement[3] + (boundsPhoto[3] - boundsPhoto[1])];
                                        break;
                                    default:
                                        break;
                                }
                                //spostiamo photo in base all'offset
                                boundsPhoto = photo.geometricBounds;
                                photo.geometricBounds = [boundsPhoto[0] + conflitto.offsetY, boundsPhoto[1] + conflitto.offsetX, boundsPhoto[2] + conflitto.offsetY, boundsPhoto[3] + conflitto.offsetX];
                                //adattiamo automaticamente spuntando il checkbox
                                
                            break;
                            case "manda a":
                                //spostiamo photo in base alle coordinate
                                if (conflitto.cordinate.length > 0) {
                                    photo.geometricBounds = [conflitto.cordinate[0], conflitto.cordinate[1], conflitto.cordinate[2], conflitto.cordinate[3]];
                                }
                                else {
                                    //spostiamo photo in base alle coordinateBox
                                    switch (conflitto.cordinateBox) {
                                        case "alto-sinistra":
                                            photo.geometricBounds = [bounds[0], bounds[1], bounds[0] + (boundsPhoto[2] - boundsPhoto[0]), bounds[1] + (boundsPhoto[3] - boundsPhoto[1])];
                                            break;
                                        case "alto-centrale":
                                            photo.geometricBounds = [bounds[0], bounds[1] + ((bounds[3] - bounds[1]) / 2) - ((boundsPhoto[3] - boundsPhoto[1]) / 2), bounds[0] + (boundsPhoto[2] - boundsPhoto[0]), bounds[1] + ((bounds[3] - bounds[1]) / 2) + ((boundsPhoto[3] - boundsPhoto[1]) / 2)];
                                            break;
                                        case "alto-destra":
                                            photo.geometricBounds = [bounds[0], bounds[3] - (boundsPhoto[3] - boundsPhoto[1]), bounds[0] + (boundsPhoto[2] - boundsPhoto[0]), bounds[3]];
                                            break;
                                        case "basso-sinistra":
                                            photo.geometricBounds = [bounds[2] - (boundsPhoto[2] - boundsPhoto[0]), bounds[1], bounds[2], bounds[1] + (boundsPhoto[3] - boundsPhoto[1])];
                                            break;
                                        case "basso-centrale":
                                            photo.geometricBounds = [bounds[2] - (boundsPhoto[2] - boundsPhoto[0]), bounds[1] + ((bounds[3] - bounds[1]) / 2) - ((boundsPhoto[3] - boundsPhoto[1]) / 2), bounds[2], bounds[1] + ((bounds[3] - bounds[1]) / 2) + ((boundsPhoto[3] - boundsPhoto[1]) / 2)];
                                            break;
                                        case "basso-destra":
                                            photo.geometricBounds = [bounds[2] - (boundsPhoto[2] - boundsPhoto[0]), bounds[3] - (boundsPhoto[3] - boundsPhoto[1]), bounds[2], bounds[3]];
                                            break;
                                        case "centro-sinistra":
                                            photo.geometricBounds = [bounds[0] + ((bounds[2] - bounds[0]) / 2) - ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[1], bounds[0] + ((bounds[2] - bounds[0]) / 2) + ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[1] + (boundsPhoto[3] - boundsPhoto[1])];
                                            break;
                                        case "centro-centrale":
                                            photo.geometricBounds = [bounds[0] + ((bounds[2] - bounds[0]) / 2) - ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[1] + ((bounds[3] - bounds[1]) / 2) - ((boundsPhoto[3] - boundsPhoto[1]) / 2), bounds[0] + ((bounds[2] - bounds[0]) / 2) + ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[1] + ((bounds[3] - bounds[1]) / 2) + ((boundsPhoto[3] - boundsPhoto[1]) / 2)];
                                            break;
                                        case "centro-destra":
                                            photo.geometricBounds = [bounds[0] + ((bounds[2] - bounds[0]) / 2) - ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[3] - (boundsPhoto[3] - boundsPhoto[1]), bounds[0] + ((bounds[2] - bounds[0]) / 2) + ((boundsPhoto[2] - boundsPhoto[0]) / 2), bounds[3]];
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            break;
                            default:
                                break;
                        }
                    }
                }
            }
            catch (err) {
                console.log(err);
                messaggioUtente("Bollino "+fotoExtraNome+" non posizionato, errore:" + err, "error")

            }
        }    
    },

    fixBollini(bollinoRimossoBounds, listBollini){
        //se ci sono altri bollini dobbiamo aggiustare le loro posizioni, confrontiamo i bounds di tutti i bollini con quello del bollino rimosso
        //se il bollino appariva sopra rispetto al bollino rimosso lo abbassiamo di uno spazio pari a quello del bollino rimosso
        for (var i = 0; i < listBollini.length; i++) {
            var bollino = listBollini[i];
            var altezza = bollinoRimossoBounds[2] - bollinoRimossoBounds[0];
            if (bollino.geometricBounds[0] < bollinoRimossoBounds[0]) {
                bollino.geometricBounds = [bollino.geometricBounds[0] + altezza, bollino.geometricBounds[1], bollino.geometricBounds[2] + altezza, bollino.geometricBounds[3]];
            }
        }
    },

    // placeFoto(nomeFoto, box, foto, pathLavorazione){
    //     if(foto == null){
    //         for(var $box = 0; $box < box.allPageItems.length; $box++){
    //             var item = box.allPageItems[$box];
    //             if(item.label=="foto"){
    //                 foto = item;
    //                 break;
    //             }
    //         }
    //     }   
    //     try {

    //         if (foto.images.length > 0) {
    //             // Remove the previous image
    //             foto.images.item(0).remove();
    //         }

    //         var path = pathLavorazione + "/Links/" + nomeFoto;
    //         foto.place(path);
    //         foto.fillColor = "None";
    //         foto.fit(FitOptions.PROPORTIONALLY);
    //         foto.fit(FitOptions.FRAME_TO_CONTENT);
    //         foto.frameFittingOptions.autoFit = true;

    //     } catch (err) {
    //         console.log(err);
    //     }

    // },

    leggiBoundsTesto(textFrame) {
        if (textFrame != null && textFrame.constructor.name == "TextFrame") {

            var lines = textFrame.lines;
            if (lines.length > 0) {
                var startLine = lines.item(0);
                var endLine = lines.item(lines.length - 1);
                var endHorizontalOffsetMax = null;
                //troviamo l'endHorizontalOffset più lungo tra tutte le lines
                for (var j = 0; j < lines.length; j++) {
                    var line = lines.item(j);
                    if (endHorizontalOffsetMax == null || line.endHorizontalOffset > endHorizontalOffsetMax) {
                        endHorizontalOffsetMax = line.endHorizontalOffset;
                    }
                }
                return [startLine.baseline - startLine.ascent, startLine.horizontalOffset, endLine.baseline, endHorizontalOffsetMax];
            }
        }
        else{
            return textFrame.geometricBounds;
        }
    },

    impostaTendinaTracciato(objResult){
        trac = app.activeDocument.name.split("_")[0].toLowerCase();
        $("#idTracciato sp-menu").empty();
        var option = document.createElement("sp-menu-item");
        option.textContent = "Seleziona tracciato...";
        option.value = 0;
        option.selected = true;
        $("#idTracciato sp-menu").append(option);
        objResult.forEach(function(item) {
            item.promoTracciatis.forEach(function(tracciato){
                var option = document.createElement("sp-menu-item");
                option.textContent = tracciato.sigla;
                option.value = tracciato.id;
                //riduciamo il font delle opzioni
                // if(tracciato.sigla.toLowerCase().indexOf(trac.toLowerCase()) != -1){
                //     option.selected = true;
                // }
                $("#idTracciato sp-menu").append(option);
            });
        });
    
    },

    restituisciSudivisioneDescrizioni(descrizioneItem){
        var descrizioniObj = {
            Descrizione1: "",
            Descrizione2: "",
            Descrizione3: "",
            Descrizione4: "",
            DescrizioneIndd: "",
        };

        var descrizione1Started = false;
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name == "DESCRIZIONE TITOLO"){
                descrizione1Started = true;
                descrizioniObj.Descrizione1 += descrizioneItem.characters.item(i).contents;
                descrizioniObj.Descrizione1 = customAgenzia.replaceAllSpecialCharacters(descrizioniObj.Descrizione1);
            }
            else{
                if (descrizione1Started)
                {
                    break;
                }
            }
        }

        var descrizione2Started = false;
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name == "DESCRIZIONE_BRAND"){
                descrizione2Started = true;
                descrizioniObj.Descrizione2 += descrizioneItem.characters.item(i).contents;
                descrizioniObj.Descrizione2 = customAgenzia.replaceAllSpecialCharacters(descrizioniObj.Descrizione2);
            }
            else{
                if (descrizione2Started)
                {
                    break;
                }
            }
        }

        var descrizione3Started = false;
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name == "DESCRIZIONE TIPO"){
                descrizione3Started = true;
                descrizioniObj.Descrizione3 += descrizioneItem.characters.item(i).contents;
                descrizioniObj.Descrizione3 = customAgenzia.replaceAllSpecialCharacters(descrizioniObj.Descrizione3);
            }
            else{
                if (descrizione3Started)
                {
                    break;
                }
            }
        }

        var descrizione4Started = false;
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name == "DESCRIZIONE GRAMMATURA"){
                descrizione4Started = true;
                descrizioniObj.Descrizione4 += descrizioneItem.characters.item(i).contents;
                descrizioniObj.Descrizione4 = replaceAll(descrizioniObj.Descrizione4);
            }
            else{
                if (descrizione4Started)
                {
                    break;
                }
            }
        }

        var currentCharacterStyle = "";
        for(var i = 0; i < descrizioneItem.characters.length; i++){
            
            if (currentCharacterStyle != descrizioneItem.characters.item(i).appliedCharacterStyle.name) {
                if (currentCharacterStyle != "") {
                    descrizioniObj.DescrizioneIndd += "</" + currentCharacterStyle + ">";
                }
                currentCharacterStyle = descrizioneItem.characters.item(i).appliedCharacterStyle.name;
                descrizioniObj.DescrizioneIndd += "<" + currentCharacterStyle + ">";
            }
            descrizioniObj.DescrizioneIndd += descrizioneItem.characters.item(i).contents;
            
        }
        if (currentCharacterStyle != ""){
            descrizioniObj.DescrizioneIndd += "</" + currentCharacterStyle + ">";
        }
        descrizioniObj.DescrizioneIndd = customAgenzia.replaceAllSpecialCharacters(descrizioniObj.DescrizioneIndd);

        return descrizioniObj;
    },

    replaceAll(str, stringToReplace, replacement){
        var splitted = str.split(stringToReplace);
        str = splitted.join(replacement);
        return str;
    },

    replaceAllSpecialCharacters(str){
        listSpecialCharacters = [ {chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "LSINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "LSINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}   ];

        listSpecialCharacters.forEach(function(specialCharacter){
            str = customAgenzia.replaceAll(str, specialCharacter.chiave, specialCharacter.valore);
        });

        return str;
    },

    aggiungiInformazioniCustom(objResult){
        try{
            var tracciati = app.activeDocument.name.split("_")[0].toLowerCase();
            //per ogni elemento di objResult controllo il prezzo_promo se il tracciato è market altrimenti controllo prezzo_promo_oro; e ci salviamo da parte il prezzo min e max
            var prezzoMin = 999999;
            var prezzoMax = 0;
            for (var i = 0; i < objResult.length; i++){
                var prezzo = 0;
                if (tracciati == "market"){
                    prezzo = objResult[i].prezzo_promo;
                }
                else if (tracciati == "oro"){
                    prezzo = objResult[i].prezzo_promo_oro;
                }
                prezzo = prezzo.toString().replace(",", ".");
                prezzo = parseFloat(prezzo);
                if (prezzo < prezzoMin){
                    prezzoMin = prezzo;
                }
                if (prezzo > prezzoMax){
                    prezzoMax = prezzo;
                }
            }
        
            //se il prezzo min e il prezzo max sono diversi aggiungo una riga in testata di editReferenza con i due valori altrimenti niente
            var prezzoMinString = prezzoMin.toFixed(2);
            var prezzoMaxString = prezzoMax.toFixed(2);
            if (prezzoMin != prezzoMax){
                var rigaPrezzo = "Prezzo minimo: " + prezzoMinString + "€ - Prezzo massimo: " + prezzoMaxString + "€";
                //creiamo una row con sfondo celeste chiaro e testo nero da appendere in testata a editReferenza
                var row = document.createElement("div");
                row.style.backgroundColor = "#e6f0ff";
                row.style.color = "black";
                row.style.padding = "5px";
                row.style.margin = "5px";
                row.textContent = rigaPrezzo;
                $("#editReferenza").prepend(row);
            }
        }
        catch(e){
            console.log(e);
        }
    },

    applySpecificaMastro(box, specifica){
        //nella specifica troviamo tre campi ad esempio:
        // etichetta: "box_sconto" -> il nome della label da cercare nel box
        // tipoElemento: 3 -> un enum che ci indica il tipo di modifica da applicare (0 = fillColor, 1 = textColor, 2 = characterStyle, 3 = paragraphStyle)
        // value: "sconto" -> il valore da applicare
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (item.label != null && item.label.toLowerCase() == specifica.etichetta.toLowerCase()) {
                switch (specifica.tipoElemento) {
                    case 0:
                        var color = null;
                        for (var c = 0; c < app.activeDocument.swatches.length; c++) {
                            if (app.activeDocument.swatches.item(c).name.toLowerCase() === specifica.value.toLowerCase()) {
                                color = app.activeDocument.swatches.item(c);
                                break;
                            }
                        }
                        if (color !== null) {
                            item.fillColor = color;
                        }
                        else{
                            messaggioUtente("Attenzione: il colore " + specifica.value + " non esiste nel documento", "error", false, 0, true);
                        }
                        break;
                    case 1:
                        //prendiamo i caratteri e mettiamo i loro fillcolor a specifica.value
                        var color = null;
                        for (var c = 0; c < app.activeDocument.swatches.length; c++) {
                            if (app.activeDocument.swatches.item(c).name.toLowerCase() === specifica.value.toLowerCase()) {
                                color = app.activeDocument.swatches.item(c);
                                break;
                            }
                        }
                        if (color !== null) {
                            for (var j = 0; j < item.characters.length; j++) {
                                item.characters.item(j).fillColor = color;
                            }
                        }
                        else{
                            messaggioUtente("Attenzione: il colore " + specifica.value + " non esiste nel documento", "error", false, 0, true);
                        }
                        break;
                    case 2:
                        var characterStyle = null;
                        for (var cs = 0; cs < app.activeDocument.characterStyles.length; cs++) {
                            if (app.activeDocument.characterStyles.item(cs).name.toLowerCase() === specifica.value.toLowerCase()) {
                                characterStyle = app.activeDocument.characterStyles.item(cs);
                                break;
                            }
                        }
                        if (characterStyle !== null) {
                            item.appliedCharacterStyle = characterStyle;
                        }
                        else{
                            messaggioUtente("Attenzione: lo stile di carattere" + specifica.value + " non esiste nel documento", "error", false, 0, true);
                        }
                        break;
                    case 3:
                        var paragraphStyle = null;
                        for (var ps = 0; ps < app.activeDocument.paragraphStyles.length; ps++) {
                            if (app.activeDocument.paragraphStyles.item(ps).name.toLowerCase() === specifica.value.toLowerCase()) {
                                paragraphStyle = app.activeDocument.paragraphStyles.item(ps);
                                break;
                            }
                        }
                        if (paragraphStyle !== null) {
                            item.appliedParagraphStyle = paragraphStyle;
                        }
                        else{
                            messaggioUtente("Attenzione: lo stile di paragrafo" + specifica.value + " non esiste nel documento", "error", false, 0, true);
                        }
                        break;
                    case 4:
                        var borderColor = null;
                        for (var c = 0; c < app.activeDocument.swatches.length; c++) {
                            if (app.activeDocument.swatches.item(c).name.toLowerCase() === specifica.value.toLowerCase()) {
                                borderColor = app.activeDocument.swatches.item(c);
                                break;
                            }
                        }
                        if (color !== null) {
                            if (item.constructorName != "TextFrame") {
                                item.strokeColor = borderColor;
                            } else {
                                for (var j = 0; j < item.characters.length; j++) {
                                    item.characters.item(j).strokeColor = borderColor;
                                }
                            }
                        }
                        else{
                            messaggioUtente("Attenzione: il colore " + specifica.value + " non esiste nel documento", "error", false, 0, true);
                        }
                        break;
                    default:
                        break;
                }
            }
        }
    },

    inserisciContenutiConStile(item, stringa){
        var tag = "";
        item.contents = "";
        var originalBounds = item.geometricBounds;
        item.geometricBounds = [item.geometricBounds[0], item.geometricBounds[1], item.geometricBounds[2]+100, item.geometricBounds[3]+100]; // Increase the height by 100 units
        // Your code here
        for (var i = 0; i < stringa.length; i++) {
            if (stringa[i] == "<") {
               tag = identificaTag(stringa, i); 
               i += tag.length + 1;                          
            }
            else{
                item.contents += stringa[i];
                if (tag != "")
                {
                    var characterStyle = app.activeDocument.characterStyles.item(tag);
                    if (characterStyle.isValid){
                        item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                    }
                    else{
                        tag = tryCharacterConversion(tag);
                        if (tag != ""){
                            characterStyle = app.activeDocument.characterStyles.item(tag);
                            if (characterStyle.isValid){
                                item.characters.item(item.contents.length - 1).appliedCharacterStyle = characterStyle;
                            }
                            else{
                                throw "Errore: lo stile " + tag + " non esiste, inserimento errato nel dizionario di conversione";
                            }
                        }
                        else{
                            throw "Errore: lo stile " + tag + " non esiste, inserire lo stile di conversione nel dizionario di conversione";
                        }
                    }
                }
            }
        }
        item.geometricBounds = originalBounds; // Reset the height to the original size
    },
};




function identificaTag(stringa, i){
    var tag = "";
    if (i+1 == stringa.length) {
        return tag;
    }

    for (var j = i+1; j < stringa.length; j++) {
        if (stringa[j] != ">") {
            tag += stringa[j];
        }
        else {
            break;
        }
    }
    return tag;
}

function tryCharacterConversion (tag){ //dizionario di conversione dei tag
    var dictionary = {
    }

    if (dictionary[tag] != undefined){
        return dictionary[tag];
    }
    else{
        return "";
    }
}

function messaggioUtente(msg, style, loading = false, tempo = 0, permanentMessage = false) {
    if (msg == null || msg == "") {
      return;
    }
  
    $("#messaggioUtenteComposto").remove();
    //appendiamo il messaggio a #messaggiUtente, se lo style è 'success' il colore di sfondo è verde, se è 'error' è rosso, se è 'warning' è giallo altrimenti è rosso, se loading è true mettiamo un'animazione di caricamento e se tempo è maggiore di 0 chiudiamo il messaggio dopo tempo secondi
    var color = "red";
    if (style == "success") {
      color = "green";
    }
    else if (style == "warning") {
      color = "darkorange";
    }
    var html = '<div class="row" permanentMessage="' + permanentMessage + '" id="messaggioUtente" style="background-color: ' + color + '; width:100%; display: flex; padding:2px;"> <div class="col" style="color: white; padding-left: 10px; font-size:12px; width:90%;"><h4 style="margin: 0; display: flex; align-items: center;height: 100%;">' + msg + '</h4></div>';
    $("#messaggiUtente").append(html);
    //usiamo uno spinner per il caricamento, poichè non supporta le gif dobbiamo creare noi un effetto che possa sembrare un caricamento
    if (loading) {
  
      //$("#messaggioUtente").append('<img class="col" src="images/spinner.gif" style="height: 20px; width: 20px;">');
      $("#messaggioUtente").append('<div class="loader"></div>');
    }
    //aggiungiamo un pulsante per chiudere il messaggio
    var closeButton = $('<button style="color: black; margin-left: 10px;">X</button>')
    closeButton.click(function () {
      $(this).parent().remove();
    });
    $("#messaggioUtente").append(closeButton);
    $("#messaggioUtente").attr("id", "messaggioUtenteComposto" + (permanentMessage ? "Permanente" : ""));
    if (tempo > 0) {
      setTimeout(function () {
        $("#messaggioUtenteComposto" + (permanentMessage ? "Permanente" : "")).remove();
      }, tempo * 1000);
    }
  }


// function testAlessio(){
//     alert("testAlessio");
// }

// function testAlessio2(){
//     alert("Polifemo!");
// }

module.exports = customAgenzia;
//module.exports = { testAlessio, testAlessio2  }