const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters } = require('indesign');
//const MAIN_fixFoto = require('./fotoFix');
const CssFramework = require('../../CssFramework');
var countRef = 0;
const customAgenzia={
    
    mappaStili : null,
    labelModifcabili : ["prezzo_offerta<CPREZ_Sconto_Euro_SC>","prezzo_offerta<CPREZ_Sconto_Virgola_SC>","prezzo_offerta<CPREZ_Sconto_Cent_SC>"/*,"prezzo_promo", "prezzo", "prezzo_promo_kgl", "sconto_alla_cassa", "prezzo_info_pack"*/],
    tipiFotoExtra : [{val: 2, nome: "Bollini"},{val: 3, nome: "Loghi"},{val: 4, nome: "Foto ambientate"}],
    filtroRicerca : [{tree: "recordInTracciato", field: "speciale", label: "Speciale", tipoValori:"string"},{tree: "recordInTracciato", field: "reparto", label: "Reparto", tipoValori:"string"}],
    // listMeccanicheIngombranti : ["2x2_sc", "2x3_sc","2x4_sc","3x3_sc","3x4_sc","3x5_sc","4x3_sc", "4x4_sc", "4x5_sc", "5x4_sc","5x5_sc", "6x6_sc"],
    // listCampiNonEditabili : ["idTracciato", "tracciato", "Referenza.Codice", "Referenza", "Referenza" , "Referenza.Ean", "Scatto.Codice", "Tracciato.Firma", "bollini", "Scatto.CodiceGruppo", "Descrizioni.Descrizione1", "Descrizioni", "Tracciato.Firma", "rm", "rp", "rv", "isInArea", "Descrizioni.Um", "Descrizioni.Peso"],
    // listCampiEditabiliPrioritari : ["artwork", "note", "prezzo", "prezzo_kgl", "prezzo_kgl_oro", "prezzo_oro", "prezzo_promo", "prezzo_promo_oro", "speciale"],
    //schemiDescrizioni: [["DESCRIZIONE TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE TIPO", "DESCRIZIONE GRAMMATURA"]],
    schemiDescrizioni: [{
        schema: ["START$DESCRIZIONE_TITOLO_SG", "START$DESCRIZIONE_BRAND_SG", "START$DESCRIZIONE_TIPO_SG", "START$DESCRIZIONE_GRAMMATURA_SG"],
        setRegole: [[]],
    },{
        schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_TIPO", "START$DESCRIZIONE_GRAMMATURA"],
        setRegole: [[]],
    }
    ],
    nomeFotoPrimaria: "immagine",
    nomeFotoSecondarie: "foto_secondaria",
    listaStiliUniversali:[
        {nome:"DESCRIZIONE_TITOLO_SG", rule:"IN$DESCRIZIONE_TITOLO_SG", fondamentale:"descrizione1"},
        {nome:"DESCRIZIONE_BRAND_SG", rule:"IN$DESCRIZIONE_BRAND_SG", fondamentale:"descrizione2"},
        {nome:"DESCRIZIONE_TIPO_SG", rule:"IN$DESCRIZIONE_TIPO_SG", fondamentale:"descrizione3"},
        {nome:"DESCRIZIONE_GRAMMATURA_SG", rule:"IN$DESCRIZIONE_GRAMMATURA_SG", fondamentale:"descrizione4"},
        {nome:"DESCRIZIONE_TITOLO", rule:"IN$DESCRIZIONE_TITOLO", fondamentale:"descrizione1"},
        {nome:"DESCRIZIONE_BRAND", rule:"IN$DESCRIZIONE_BRAND", fondamentale:"descrizione2"},
        {nome:"DESCRIZIONE_TIPO", rule:"IN$DESCRIZIONE_TIPO", fondamentale:"descrizione3"},
        {nome:"DESCRIZIONE_GRAMMATURA", rule:"IN$DESCRIZIONE_GRAMMATURA", fondamentale:"descrizione4"}],
    // {
    //     schema: ["DESCRIZIONE TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE TIPO", "DESCRIZIONE GRAMMATURA","DESCRIZIONE CARTA"],
    //     setRegole: [[{campo: "speciale", operatore: "IN", valore: "titolari"}]],
    // }],

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

        return box;

        // console.log(app.activeDocument.filePath);
        // console.log(app.activeDocument.filePath.then(function(value){console.log(value.nativePath)}));   
        app.activeDocument.activeLayer = app.activeDocument.layers.itemByName("InPagina");
        box.itemLayer = app.activeDocument.layers.item("InPagina");
        countRef++;     
        console.log(countRef);
        var listaTracciato = readFile(pathLavorazione + "/listaKit"+idKitLavorazione+".json");
        try{
            var objToDelete = [];
            var objDeleted = [];
            //tracciati = app.activeDocument.name.split("_")[0].toLowerCase();
            var daRevisionareStatica = false;
            for (var $box = 0; $box < box.allPageItems.length; $box++) {
                if (this.mappaStili == null) {
                    this.mappaStili = readFile(pathLavorazione + "/mappaStili.json");
                }  
                var item = box.allPageItems[$box];
                if (item.label == "base") {
                    item.label += "$" + box.label + "$" + oggetto["Referenza.Codice"] + "$" + oggetto["Scatto.CodiceGruppo"] + "$Nessuna Mastro";
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
                                if(oggetto["reparto"] != null && oggetto["descrizione_reparto"] != null && oggetto["codiceBox"] != "BOX20" && oggetto["codiceBox"] != "BOX21"){
                                    let sty = null;
                                    if (this.mappaStili != null){
                                        sty = this.mappaStili.find(f=>f.meccanica == oggetto["combinazioneAssegnata"]+"_SC" && f.nome_campo.includes("Reparto_"+oggetto["reparto"]));
                                        // var sty = customAgenzia.getStileForField(oggetto.meccanica /*+ suffix_plus*/, nome_proprieta, oggetto["codiceBox"]);
                                    }
                                    if (sty != null) {
                                        var caratteriGiàInseriti = item.contents.length;
                                        oggetto["descrizione_reparto"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_reparto"]);
                                        //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                        for (var i = 0; i < oggetto["descrizione_reparto"].length; i++) {
                                            item.contents = item.contents + oggetto["descrizione_reparto"][i];
                                            lastCharachter = item.contents + oggetto["descrizione_reparto"][i];
                                            if (item.overflows) {
                                                //applichiamo la sillabazione al paragraph
                                                item.paragraphs.item(0).hyphenation = true;
                                            }

                                            try {

                                                var rp_parag = app.activeDocument.paragraphStyles.itemByName(sty.stile);
                                                item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = rp_parag.nestedStyles.item(0).appliedCharacterStyle;
                                            } catch (e) { }
                                        }
                                        insertedDescription = true;
                                    }
                                }

                                if (item.contents != "") {
                                    item.contents += "\n";
                                }

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
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_nome_SC");
                                    }

                                    insertedDescription = true;
                                }

                                if (item.contents != "") {
                                    item.contents += "\n";
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
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_marca_SC");
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
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_tipo_SC");
                                    }

                                    insertedDescription = true;
                                }

                                if (item.contents != "") {
                                    item.contents += "\n";
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
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_gr_SC");
                                    }
                                }
                            }
                        }
                        else{
                            if(oggetto["reparto"] != null && oggetto["descrizione_reparto"] != null && oggetto["codiceBox"] != "BOX20" && oggetto["codiceBox"] != "BOX21"){
                                let sty = null;
                                if (this.mappaStili != null){
                                    sty = this.mappaStili.find(f=>f.meccanica == oggetto["combinazioneAssegnata"]+"_SC" && f.nome_campo.includes("Reparto_"+oggetto["reparto"]));
                                    // var sty = customAgenzia.getStileForField(oggetto.meccanica /*+ suffix_plus*/, nome_proprieta, oggetto["codiceBox"]);
                                }

                                //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                if (sty != null) 
                                {
                                    var caratteriGiàInseriti = item.contents.length;
                                    oggetto["descrizione_reparto"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_reparto"]);

                                    for (var i = 0; i < oggetto["descrizione_reparto"].length; i++) {
                                    item.contents = item.contents + oggetto["descrizione_reparto"][i];
                                    lastCharachter = item.contents + oggetto["descrizione_reparto"][i];
                                    if (item.overflows) {
                                        //applichiamo la sillabazione al paragraph
                                        item.paragraphs.item(0).hyphenation = true;
                                    }
                                        var rp_parag = app.activeDocument.paragraphStyles.itemByName(sty.stile);
                                        item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = rp_parag.nestedStyles.item(0).appliedCharacterStyle;
                                    }
                                }
                                    
                                insertedDescription = true;
                            }

                            if (item.contents != "") {
                                item.contents += "\n";
                            }

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
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_nome_SC");
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

                            if(oggetto["reparto"] != null && oggetto["descrizione_reparto"] != null && oggetto["codiceBox"] != "BOX20" && oggetto["codiceBox"] != "BOX21"){
                                let sty = null;
                                if (this.mappaStili != null){
                                    sty = this.mappaStili.find(f=>f.meccanica == oggetto["combinazioneAssegnata"]+"_SC" && f.nome_campo.includes("Reparto_"+oggetto["reparto"]));
                                    // var sty = customAgenzia.getStileForField(oggetto.meccanica /*+ suffix_plus*/, nome_proprieta, oggetto["codiceBox"]);
                                }

                                if (sty != null) {
                                    var caratteriGiaInseriti = item.contents.length;
                                    oggetto["descrizione_reparto"] = customAgenzia.replaceAllSpecialCharacters(oggetto["descrizione_reparto"]);
                                    //item.contents = oggetto["Descrizioni.Descrizione1"] + "\n";
                                    for (var i = 0; i < oggetto["descrizione_reparto"].length; i++) {
                                        item.contents = item.contents + oggetto["descrizione_reparto"][i];
                                        lastCharachter = item.contents + oggetto["descrizione_reparto"][i];
                                        if (item.overflows) {
                                            //applichiamo la sillabazione al paragraph
                                            item.paragraphs.item(0).hyphenation = true;
                                        }
                                        try {

                                            var rp_parag = app.activeDocument.paragraphStyles.itemByName(sty.stile);
                                            item.characters.item(i + caratteriGiaInseriti).appliedCharacterStyle = rp_parag.nestedStyles.item(0).appliedCharacterStyle;

                                        }
                                        catch (e) {
                                            //console.log(e);
                                        }
                                    }

                                    insertedDescription = true;
                                }
                            }

                            if (item.contents != "") {
                                item.contents += "\n";
                            }

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
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_nome_SC");
                                }
                                insertedDescription = true;
                            }
                            if (item.contents != "") {
                                item.contents += "\n";
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
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_marca_SC");
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
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_tipo_SC");
                                }
                                insertedDescription = true;
                            }
                            if (item.contents != "") {
                                item.contents += "\n";
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
                                    item.characters.item(i + caratteriGiàInseriti).appliedCharacterStyle = app.activeDocument.characterStyles.item("DES_descr_gr_SC");
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
                else if (item.label == "da_revisionare") {
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
                else if (item.label.toLowerCase().includes("reparto")) {
                    objToDelete.push(item);
                }
                else if (item.constructor.name == "TextFrame" && !item.label.startsWith("base")) {
                    var nome_proprieta=item.label.replace("X_","");
                    if(nome_proprieta == "prezzo_offerta"){
                        console.log("prezzo_offerta");
                    }
                    if(oggetto[nome_proprieta] != null && oggetto[nome_proprieta] != "")
                    {
                        if (item.label == "prezzo_offerta2" ||
                            (item.label.indexOf("EURprima") > 0 && nome_proprieta == "prezzo_offerta")) {
                                oggetto[nome_proprieta] = "€ " + oggetto[nome_proprieta];
                        }
                        
                        item.contents = oggetto[nome_proprieta].toString();
                        //leggiamo il file /Users/sm1/Documents/GitHub/InddUXPPluginVol/stili/mappaStili.json 
                        
                        if (this.mappaStili == null) {
                            this.mappaStili = readFile(pathLavorazione + "/mappaStili.json");
                        }
                        if (this.mappaStili != null){
                            var sty = this.mappaStili.filter(f=>f.meccanica == oggetto["combinazioneAssegnata"]+"_SC" && f.nome_campo == nome_proprieta);
                            // var sty = customAgenzia.getStileForField(oggetto.meccanica /*+ suffix_plus*/, nome_proprieta, oggetto["codiceBox"]);
                            if (sty.length>0) {
                                console.log(sty);
                                console.log("applyNeastedStyles -> " + sty[0].stile + " MECC " + (oggetto["combinazioneAssegnata"]+"_SC") + " NOME CAMPO: " + nome_proprieta);
                                customAgenzia.applyNeastedStyles(item, app.activeDocument.paragraphStyles.itemByName(sty[0].stile));
                            }
                        }
                    }
                }
                

                // //se l'item è di tipo textarea, il content è vuoto e la lista già non contiene un oggetto con la stessa label aggiungiamolo ai rimossi
                 if(item.constructor.name == "TextFrame" && !item.label.startsWith("base") && item.contents == "" && objToDelete.find(f=> f.label == item.label) == null){
                    objToDelete.push(item);
                }
            }

            for (var $box = 0; $box < box.allPageItems.length; $box++) {
                var item = box.allPageItems[$box];
                if (item.label == "immagine") {
                    var secondarie = 0;
                    var listFoto = [];
                    var elementiGruppo = listaTracciato.records.filter(f=>f.recordInTracciato["Scatto.CodiceGruppo"] == oggetto["Scatto.CodiceGruppo"]);
                    for (var i = 0; i < elementiGruppo.length; i++) {
                        var elemento = elementiGruppo[i];
                        if (elemento.recordInTracciato["StatoSelezione"] == 2) {
                            var path = pathLavorazione + "/Links/" + elemento.recordInTracciato["Foto.Nome"];
                            var offset = 0;//10 * (secondarie+1);
                            var g_new = [item.geometricBounds[0] + offset, item.geometricBounds[1] + offset, item.geometricBounds[2] + offset, item.geometricBounds[3] + offset];
                            var photo = item.parentPage.rectangles.add(item.itemLayer, LocationOptions.UNKNOWN, { geometricBounds: g_new });
                            listFoto.push(photo);
                            try {
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
                            catch (err) {
                                //eliminiamo la foto secondaria
                                photo.remove();
                                console.log(err);
                                messaggioUtente("Foto secondaria " + elemento.recordInTracciato["Foto.Nome"] + " non posizionata, errore:" + err, "error")
                            }
                        }
                    }
    
                    for (var i = 0; i < elementiGruppo.length; i++) {
                        var elemento = elementiGruppo[i];
                        console.log(elemento);
                        if (elemento.recordInTracciato["StatoSelezione"] == 1 || elemento.recordInTracciato["Referenza.Codice"] == elemento.recordInTracciato["Scatto.CodiceGruppo"]) {
                            try {
                                listFoto.unshift(item);
                                var path = pathLavorazione + "/Links/" + elemento.recordInTracciato["Foto.Nome"]
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
    
                    if (elementiGruppo.length > 0) {
                        //cicliamo adesso tutti gli elementi del box cercando quelo che inizia per base e che con lo split[0] sia uguale a base
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

            // if(!daRevisionareStatica){
            //     //creiamo la banda da revisionare e la appendiamo al box, dobbiamo creare un rettangolo con altezza 10mm e larghezza uguale a quella del box, al suo interno dobbiamo piazzare una text area con la scritta "da revisionare" e ragruppiamo tutto in un gruppo con label da_revisionare che poi appendiamo al box e lo portiamo in primo piano
            //     var larghezzaBox = box.geometricBounds[3] - box.geometricBounds[1];
            //     var altezzaBox = box.geometricBounds[2] - box.geometricBounds[0];
            //     var g_new = [box.geometricBounds[0]+((altezzaBox/10)*3), box.geometricBounds[1]+(larghezzaBox/50), box.geometricBounds[0]+((altezzaBox/10)*3)+10, box.geometricBounds[3]-(larghezzaBox/50)];
            //     var g_new_text = [box.geometricBounds[0]+((altezzaBox/10)*3)+0.88, box.geometricBounds[1]+(larghezzaBox/50)+0.88, box.geometricBounds[0]+((altezzaBox/10)*3)+9.12, box.geometricBounds[3]-(larghezzaBox/50)-0.88];
            //     var rect = box.parentPage.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: g_new});
            //     rect.fillColor = "c37m96y76k10";
            //     //mettiamo il bordo CONAD_Rosso
            //     rect.strokeWeight = 5;
            //     rect.strokeColor = "CONAD_Rosso";
            //     var text = rect.parentPage.textFrames.add();
            //     text.geometricBounds = g_new_text;
            //     text.texts.item(0).appliedCharacterStyle = app.activeDocument.characterStyles.item("EURO WHITE");
            //     text.contents = "Da revisionare";
            //     //centriamo il testo sia verticalmente che orizzontalmente
            //     text.parentStory.justification = Justification.CENTER_ALIGN;
            //     text.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;

            //     //usiamo lo stile EURO WHITE
            //     //creiamo un gruppo in pagina 
            //     var items = [rect, text];
            //     var group = box.parentPage.groups.add(items);
            //     //var group = box.parentPage.groups.add([rect, text]);
            //     group.label = "da_revisionare";
            //     //appendiamo il gruppo al box e lo spostiamo in primo piano rispetto agli altri elementi del box usando il bring to front

            //     var oldGroup = box;
            //     var oldLabel = box.label;
            //     var oldItems = box.pageItems.everyItem().getElements();
            //     oldGroup.ungroup();
            //     group.bringToFront();
            //     var newItems = oldItems.concat(group);
            //     var newGroup = item.parentPage.groups.add(newItems);
            //     newGroup.label = oldLabel;
            //     box = newGroup;
            //     app.selection = [box];
                

            //     if (oggetto["Scatto.CodiceGruppo"] != oggetto["Referenza.Codice"]) {
            //         switch (oggetto["statoRevisioneGruppo"]) {
            //             case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
            //                 group.visible = true;
            //                 for (var i = 0; i < group.allPageItems.length; i++) {
            //                     var item2 = group.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Non trovato";
            //                     }
            //                 }
            //                 break;
            //             case 1: //l'oggetto è revisionato
            //             group.visible = false;
            //                 break;
            //             case 2: //l'oggetto è da revisionare
            //             group.visible = true;
            //                 break;
            //             case 3: //l'oggetto è da confermare
            //             group.visible = true;
            //                 for (var i = 0; i < group.allPageItems.length; i++) {
            //                     var item2 = group.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Da confermare";
            //                     }
            //                     //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
            //                     if (item2.constructor.name == "Rectangle") {
            //                         //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
            //                         var colore = null;
            //                         for (var j = 0; j < app.activeDocument.swatches.length; j++) {
            //                             if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
            //                                 colore = app.activeDocument.swatches.item(j);
            //                             }
            //                         }
            //                         if (colore == null) {
            //                             colore = app.activeDocument.colors.add();
            //                             colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
            //                             colore.name = "c16m13y86k1";
            //                         }
            //                         item2.fillColor = colore;
            //                     }
            //                 }
            //                 break;
            //             default:
            //                 group.visible = true;
            //                 for (var i = 0; i < group.allPageItems.length; i++) {
            //                     var item2 = group.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Stato non valido: "+oggetto["statoRevisioneGruppo"];
            //                     }
            //                 }
            //                 break;
            //         }
            //     }
            //     else{
            //         switch (oggetto["statoRevisioneSingolo"]) {
            //             case 0://0 è non assegnato, c'è stato un errore nell'operazione di revisione, scorriamo gli elementi di item in cerca di un textframe e cambiamo il suo content in "Non trovato"
            //             group.visible = true;
            //                 for (var i = 0; i < group.allPageItems.length; i++) {
            //                     var item2 = group.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Non trovato";
            //                     }
            //                 }
            //                 break;
            //             case 1: //l'oggetto è revisionato
            //             group.visible = false;
            //                 break;
            //             case 2: //l'oggetto è da revisionare
            //             group.visible = true;
            //                 break;
            //             case 3: //l'oggetto è da confermare
            //             group.visible = true;
            //                 for (var i = 0; i < group.allPageItems.length; i++) {
            //                     var item2 = group.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Da confermare";
            //                     }
            //                     //se item2 è un rettangolo impostiamo il suo colore di riempimento a c16m13y86k1
            //                     if (item2.constructor.name == "Rectangle") {
            //                         //cerchiamo il campione di colore, se c'è lo assegnamo, sennò lo creiamo prima di assegnarlo
            //                         var colore = null;
            //                         for (var j = 0; j < app.activeDocument.swatches.length; j++) {
            //                             if (app.activeDocument.swatches.item(j).name == "c16m13y86k1") {
            //                                 colore = app.activeDocument.swatches.item(j);
            //                             }
            //                         }
            //                         if (colore == null) {
            //                             colore = app.activeDocument.colors.add();
            //                             colore.properties = { model: ColorModel.PROCESS, colorValue: [16, 13, 86, 1] };
            //                             colore.name = "c16m13y86k1";
            //                         }
            //                         item2.fillColor = colore;
            //                     }
            //                 }
            //                 break;
            //             default:
            //                 item.visible = true;
            //                 for (var i = 0; i < item.allPageItems.length; i++) {
            //                     var item2 = item.allPageItems[i];
            //                     //guardiamo se item2 è un textframe
            //                     if (item2.constructor.name == "TextFrame") {
            //                         item2.contents = "Stato non valido :"+oggetto["statoRevisioneSingolo"];
            //                     }
            //                 }
            //                 break;
            //         }
            //     }
            // }

            // for(var $box = 0; $box < box.allPageItems.length; $box++){
            //     var listFoto = [];
            //     var item = box.allPageItems[$box];
            //     if(item.label=="foto"){
            //         var secondarie = 0;

            //         for (var i = 0; i < oggetto["ElementiGruppo"].length; i++) {
            //             var elemento = oggetto["ElementiGruppo"][i];
            //             if(elemento["StatoSelezione"] == 2){
            //                 var path = pathLavorazione+ "/Links/" + elemento["Foto.Nome"];
            //                 var offset = 0;//10 * (secondarie+1);
            //                 var g_new = [item.geometricBounds[0]+offset, item.geometricBounds[1]+offset, item.geometricBounds[2]+offset, item.geometricBounds[3]+offset];
            //                 var photo = item.parentPage.rectangles.add(item.itemLayer, LocationOptions.UNKNOWN, {geometricBounds: g_new});
            //                 listFoto.push(photo);
            //                 try{
            //                     photo.label = "foto_secondaria";
            //                     photo.place(path);
            //                     photo.fillColor = "None";
            //                     photo.fit(FitOptions.PROPORTIONALLY); 
            //                     photo.fit(FitOptions.FRAME_TO_CONTENT);
            //                     secondarie++;
            //                     //mettiamo foto sul livello InPagina
            //                     photo.itemLayer = app.activeDocument.layers.item("InPagina");

            //                     if (item.parent.constructor.name == "Group") {
            //                         var oldGroup = item.parent;
            //                         var oldLabel = oldGroup.label; 
            //                         var oldItems = oldGroup.pageItems.everyItem().getElements();
            //                         oldGroup.ungroup();
            //                         var newItems = oldItems.concat(photo);
            //                         var newGroup = item.parentPage.groups.add(newItems);
            //                         photo.sendToBack();
            //                         newGroup.label = oldLabel;
            //                         box = newGroup;
            //                     }                      
            //                 }
            //                 catch(err){
            //                     //eliminiamo la foto secondaria
            //                     photo.remove();
            //                     console.log(err);
            //                     messaggioUtente("Foto secondaria "+elemento["Foto.Nome"]+" non posizionata, errore:" + err, "error")
            //                 }
            //             }
            //         }

            //         for (var i = 0; i < oggetto["ElementiGruppo"].length; i++) {
            //             var elemento = oggetto["ElementiGruppo"][i];
            //             console.log(elemento);
            //             if (elemento["StatoSelezione"] == 1 || elemento["Referenza.Codice"] == elemento["Scatto.CodiceGruppo"]) {
            //                 try {
            //                     listFoto.unshift(item);
            //                     var path = pathLavorazione+ "/Links/" + elemento["Foto.Nome"]
            //                     item.place(path);
            //                     item.fillColor = "None";
            //                     item.fit(FitOptions.PROPORTIONALLY); 
            //                     item.fit(FitOptions.FRAME_TO_CONTENT); 
            //                     item.sendToBack();
            //                 } catch (err) {
            //                     console.log(err);
            //                 }
            //             }
            //         }        

            //         if (oggetto["ElementiGruppo"].length > 0) {
            //             //cicliamo adesso tutti gli elementi del bocx cercando quelo che inizia per base e che con lo split[0] sia uguale a base
            //             for (var j = 0; j < item.parent.allPageItems.length; j++) {
            //                 var item2 = item.parent.allPageItems[j];
            //                 if (item2.label != null && item2.label != "" && item2.label.startsWith("base") && item2.label.split("$")[0] == "base") {
            //                     item2.sendToBack();
            //                 }
            //             }
            //         }

            //         if (listFoto.length > 0) {
            //             MAIN_fixFoto(listFoto, listFoto[0].geometricBounds);
            //         }
            //         break;
            //     }
            // }

            // if (oggetto["Foto.Extra"] != undefined) {
            //     for (var i = 0; i < oggetto["Foto.Extra"].length; i++) {
            //         var fotoExtra = oggetto["Foto.Extra"][i];
            //         this.impaginaFotoExtra(fotoExtra["NomeReale"], fotoExtra["Tipo"], box, pathLavorazione);
            //     }
            // }

            // if (oggetto["FotoExtraAuto"] != undefined) {
            //     for (var i = 0; i < oggetto["FotoExtraAuto"].length; i++) {
            //         var fotoExtraAuto = oggetto["FotoExtraAuto"][i];
            //         if (fotoExtraAuto.escluso == false) {
            //             this.impaginaFotoExtra(fotoExtraAuto.nomeFoto, 2, box, pathLavorazione, true);
            //         }
            //     }
            // }
            
            //customAgenzia.spostaLabelsFix(box, objDeleted, "auto");
        }
        catch(e){
            console.log(e);
            //alert(e);
        }
        return box;        
    },

    getNameCampoUniversale(label) {
        //abbiamo una lista campiUniversali che associa ad ogni nome campo una lista di label
        var listaCampiUniversali = [
            // {
            //     nome_campo: "",
            //     labels: []
            // }
        ];

        //cerchiamo label tra le labels di campiUniversali e se la troviamo ritorniamo il nome_campo
        for (var i = 0; i < listaCampiUniversali.length; i++) {
            var campoUniversale = listaCampiUniversali[i];
            if (campoUniversale.labels.find(f => f == label) != null) {
                return campoUniversale.nome_campo;
            }
        }

        return label;

    },
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

    },

    getStileForField(mastro_p, nome_field, codiceBox) {

        var mastro = mastro_p;
        // var isMZLOC = (nome_origine_xml.indexOf("MZ_LOC")==0);    
        // if (titolo_promo.indexOf("_SC_") > 0 && codiceBox!="BOX40" && !isMZLOC)
            mastro = mastro_p + "_SC";
    
        //alert("analizzo cod " + mastro);
        if (myStyles[mastro + "_" + nome_field] != null) {
            //alert("ritorno " + mastro + "_" + nome_field);
            var res = myStyles[mastro + "_" + nome_field];
            return res ;
        }
        // else if (res == null && mastro.indexOf("_SC_") > 0) {
        //     mastro = mastro_p;
        //     if (myStyles[mastro + "_" + nome_field] != null) {
        //         return myStyles[mastro + "_" + nome_field];
        //     }
        //     else {
        //         mastro = mastro_p + "_SC";
        //     }
        // }
    
        if ((mastro.indexOf("_ofalkg") >= 0 || mastro.indexOf("_ofaconf") >= 0 || mastro.indexOf("_boxetto") >= 0)
            && (mastro.indexOf("_evento") >= 0 /*|| mastro.indexOf("_inostriori") >= 0*/)) {
            var inx = mastro.indexOf("_ofalkg");
            if (inx < 0)
                inx = mastro.indexOf("_ofaconf");
            if (inx < 0)
                inx = mastro.indexOf("_boxetto");
    
            var inx_ev = mastro.indexOf("_evento");
            if (inx_ev > inx) {
                var new_mecc = mastro.replace("_evento", "");
                new_mecc = new_mecc.substr(0, inx) + "_evento" + new_mecc.substr(inx);
                //alert(new_mecc+"_" + nome_field);
                //alert("ritorno 2 " + new_mecc + "_" + nome_field);
                var res = myStyles[new_mecc + "_" + nome_field];
                if (res==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    res = myStyles[new_mecc + "_" + nome_field];
                }
    
                return res;
            }
            var inx_territorio = mastro.indexOf("_territorio");
            if (inx_territorio > inx) {
                var new_mecc = mastro.replace("_territorio", "");
                new_mecc = new_mecc.substr(0, inx) + "_territorio" + new_mecc.substr(inx);
                //alert(new_mecc+"_" + nome_field);
                //alert("ritorno 2 " + new_mecc + "_" + nome_field);
                var res = myStyles[new_mecc + "_" + nome_field];
                if (res==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    res = myStyles[new_mecc + "_" + nome_field];
                }
    
                return res;
            }
            var inx_nori = mastro.indexOf("_inostriori");
            if (inx_nori > inx) {
                var new_mecc = mastro.replace("_inostriori", "");
                new_mecc = new_mecc.substr(0, inx) + "_inostriori" + new_mecc.substr(inx);
                //alert(new_mecc+"_" + nome_field);
                //alert("ritorno 2 " + new_mecc + "_" + nome_field);
                var res = myStyles[new_mecc + "_" + nome_field];
                if (res==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    res = myStyles[new_mecc + "_" + nome_field];
                }
    
                return res;
            }
        }
    
    
        //Non ho trovato lo stile, disosso la meccanica e la sostituisco con TP_MM
        var dict = ["_KgL", "_mercato", "_123", "_focus", "_regionale", "_bdp", "_sdb", "_evento", "_inostriori", "_territorio", "_minicoll", "_bonus", "_ricorrenza", "_sapori", "_parafarmacia", "_boxetto", "_ofalkg", "_ofaconf", "_LOC"];
    
        var leader = -1;
    
        for (var $d in dict) {
    
            var inx = mastro.indexOf(dict[$d]);
            if (inx > 0 && (leader > inx || leader == -1)) {
                leader = inx;
            }
        }
        //alert(leader);
        if (leader > 0) {
            var disoss = mastro.substring(0, leader);
            var res = mastro.replace(disoss, "TP_MM");
            var new_mecc = myStyles[res + "_" + nome_field];
            if (new_mecc != null) {
                //alert("ritorno 3 " + new_mecc + "_" + nome_field);
                return new_mecc;
            }
    
        }
    
    
        /*
         for (var i=0; i<myStyles.length; i++)
         {
             if (myStyles[i][0]==mastro)
             {
                 if (myStyles[i][1]==nome_field)
                     return myStyles[i][2];
             }	
         }
         */
    
    
        return "null";
    },
    
    applyNeastedStyles(ctrl, paragraph) {
        try {
            var step = paragraph.nestedStyles;
    
            var current_indice = -1;
    
            //alert(paragraph.name);
            //if (paragraph.name == "PREZ_Fidelity_EV_EURprima")
            //alert(ctrl.label + " steps:"+step.length);
    
            for (var $va = 0; $va < step.length; $va++) {
                //alert(ctrl.label + " step " + $va);
                var flag = step.item($va).delimiter;
    
    
                /* if (paragraph.name == "PREZ_Fidelity_EV_EURprima")
                 {
                     alert("..." + step[$va].appliedCharacterStyle.name);
                 }*/
    
                //alert("..." + flag);
                //alert(typeof(flag));		
                if (flag == NestedStyleDelimiters.ANY_WORD || flag == NestedStyleDelimiters.ANY_CHARACTER) {
                    current_indice++;
    
                    //ctrl.characters[current_indice].appliedCharacterStyle=step[$va].appliedCharacterStyle;
                    // alert("any word");
    
    
                    // if (paragraph.name == "PREZ_Sconto_boxetto_EURprima")
                    //alert("entro qui 1 da " + current_indice + " a " + ctrl.contents.length + " - char? " + (flag==NestedStyleDelimiters.ANY_CHARACTER) + " rep " + step[$va].repetition);
    
                    var rep = 0;
                    for (var ich = current_indice; ich < ctrl.contents.length; ich++) {
    
                        //EXT
                        if (flag == NestedStyleDelimiters.ANY_WORD && ctrl.characters.item(ich).contents == " ")
                            break;
    
                        if (flag == NestedStyleDelimiters.ANY_CHARACTER && rep >= step.item($va).repetition)
                            break;
    
                        rep++;
                        //EXT
    
                        ctrl.characters.item(ich).appliedCharacterStyle = step.item($va).appliedCharacterStyle;
                        current_indice = ich;
    
                        if (color != null && color != "") {
                            //applico anche il colore
                            ctrl.characters.item(current_indice).fillColor = color;
                        }
    
                    }
    
                }
                else if (flag == NestedStyleDelimiters.TABS) {
                    current_indice++;
    
                    //if (paragraph.name == "PREZ_Sconto_boxetto_EURprima")
                    //alert("entro qui 2 da " + current_indice + " a " + ctrl.contents.length);
    
                    for (var ich = current_indice; ich < ctrl.contents.length; ich++) {
    
                        ctrl.characters.item(ich).appliedCharacterStyle = step.item($va).appliedCharacterStyle;
                        current_indice = ich;
                    }
                }
                else {
                    if (!step.item($va).inclusive) {
                        current_indice++;
                        //alert(ctrl.label + " inclusive : cerco delimiter");
                        var indice_delimiter = ctrl.contents.indexOf(flag, current_indice);
                        //alert(ctrl.label + " delimiter " + indice_delimiter);
    
                        // if (paragraph.name == "PREZ_Sconto_boxetto_EURprima")
                        //alert("entro qui 3 da " + current_indice + " a " + indice_delimiter + " delimiter " + flag + " in "  + ctrl.contents);
    
                        for (var ich = current_indice; ich < indice_delimiter; ich++) {
                            //alert(ctrl.characters[ich]);
                            ctrl.characters.item(ich).appliedCharacterStyle = step.item($va).appliedCharacterStyle;
                            current_indice = ich;
                        }
                        // alert(ctrl.label + " fine");
                    }
                    else {
                        current_indice++;
                        ctrl.characters.item(current_indice).appliedCharacterStyle = step.item($va).appliedCharacterStyle;
                    }
                }
    
    
            }
    
            //alert(ctrl.label + " set parag to " + paragraph.name + " " + ctrl.paragraphs.length);
            if (paragraph != null && ctrl.paragraphs.length > 0) {
                ctrl.paragraphs.item(0).appliedParagraphStyle = paragraph;
            }
    
        }
        catch (error) {
            console.log(error);            
        }
    
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
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name.includes("DES_descr_nome")){
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
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name.includes("DES_descr_marca")){
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
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name.includes("DES_descr_tipo")){
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
            if(descrizioneItem.characters.item(i).appliedCharacterStyle.name.includes("DES_descr_gr")){
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

        descrizioniObj.DescrizioneIndd = this.formaDescrizioneIndd(descrizioneItem);

        return descrizioniObj;
    },

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
    },

    replaceAll(str, stringToReplace, replacement){
        var splitted = str.split(stringToReplace);
        str = splitted.join(replacement);
        return str;
    },

    replaceAllSpecialCharacters(str){
        listSpecialCharacters = [ {chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "SINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "SINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}   ];

        listSpecialCharacters.forEach(function(specialCharacter){
            str = customAgenzia.replaceAll(str, specialCharacter.chiave, specialCharacter.valore);
        });

        return str;
    },

    aggiungiInformazioniCustom(objResult){
        try{
            return;
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

    applyCustomFilter(pItem, rootPath, $f, inxCriterio){
        //var stringPath = rootPath + ".listFiltri[" + $f + "].Criteri[" + inxCriterio + "]";
        return "";//stringPath + ".Chiave=tipo_volantino&" + stringPath + ".Operatore=0&" + stringPath + ".Valore=V - volantino&";
    },

    requiresIngombro(itemRef)
    {
        // console.log("#requiresIngombro -> ");
        // console.log(itemRef);
        // if (itemRef["ruolo"].toLowerCase().indexOf("vedette")>=0)
        // {
        //     return "vedette";
        // }
        // else if (itemRef["ruolo"].toLowerCase().indexOf("star")>=0)
        // {
        //     return "star";
        // }
        // else
        // {
        //     return "";
        // }
        return "";
    },

    getInfoExtra(itemRef)
    {
        return "Reparto: " + itemRef["reparto"]+ "\n";
    },

    componiEsportazioneMateriale(element, elementiGruppo, pageItem, pageGroup, label){
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
            codice:"",
            codice_gruppo:"",
            mastro: "",
            customData: {},
            errors: [],
        }

        resObj.customData.settore=element.recordInTracciato.descrizione_settore;

        //cerchiamo nel gruppo il textFrame con label "descrizione"
        for (var i = 0; i < pageGroup.allPageItems.length; i++) {
            var item = pageGroup.allPageItems[i];
            if (item.label != null && item.label != "") {

                console.log("Elaboro " + item.label);

                if (item.label == "descrizione") {
                    //scorriamo la descrizione la prendiamo specificando in formato html lo stile di carattere
                    resObj.descrizione = customAgenzia.formaDescrizioneIndd(item);
                    continue;
                }

                // if (item.label == "prezzo_offerta") { //corrisponde a prezzo_promo
                //     resObj.prezzo_promo = item.contents;
                //     continue;
                // }

                // if (item.label == "campo_offerta") { //corrisponde a prezzo_origine
                //     resObj.prezzo_origine = item.contents;
                //     continue;
                // }

                // if (item.label == "sconto_effettivo_grande") {
                //     resObj.sconto = item.contents;
                //     continue;
                // }
                
                if (item.label == "foto" || item.label == "foto_secondaria") {
                    //leggiamo il nome dell'immagine
                    var imgName = item.images.item(0).itemLink.name
                    //cerchiamo nel gruppo l'elemento con "Foto.nome" = imgName e mettiamo il guidid in resObj.foto
                    var el = elementiGruppo.find(f=>f.recordInTracciato["Foto.Nome"] == imgName);
                    if(el != null){
                        resObj.foto.push(el.recordInTracciato["Foto.guidid"]);
                    }
                    else{
                        resObj.errors.push("L'immagine " + imgName + " non è stata trovata negli elementi del gruppo");
                    }
                    continue;
                }

                if(item.constructor.name == "TextFrame"){
                    resObj.customData[item.label] = {content:item.contents, contentHtml:""};//"";//item.contents;
                    let _html="";

                    //Controllo se ho il paragrafo
                    let parag = "";
                    if (item.paragraphs.length>0)
                    {
                        parag = item.paragraphs.item(0).appliedParagraphStyle.name;
                        if (parag.toLocaleLowerCase()!="[paragrafo base]")
                            resObj.customData[item.label].contentHtml = "<"+parag+">"+item.contents+"</"+ parag + ">";
                    }
                    
                    if (parag=="" || parag.toLocaleLowerCase()=="[paragrafo base]")
                    {
                        let lastStyle="";
                        for (let c=0; c<item.characters.length; c++){
                            let nomeStyle=item.characters.item(c).appliedCharacterStyle.name;

                            if (nomeStyle != lastStyle){
                                if (lastStyle != ""){
                                    _html += "</" + lastStyle + ">";
                                }

                
                                _html += "<" + nomeStyle + ">";
                                

                                lastStyle = nomeStyle;
                            }

                            _html += item.characters.item(c).contents;
                        }

                        if (lastStyle!=""){
                            _html += "</" + lastStyle + ">";
                        }

                        resObj.customData[item.label].contentHtml = _html;
                    }

                }
                else if(item.constructor.name == "Rectangle"){
                    if (item.images.length > 0) {
                        var imgName = item.images.item(0).itemLink.name
                        resObj.errors.push("Foto extra non ancora implementate. Nome " + imgName);
                        // var el = element.recordInTracciato["Foto.Extra"].find(f=>f.n == imgName);
                    }
                }
                
                continue;
            }
        }

        resObj.meccanica = label.split("$")[1];
        resObj.customData["descrizione_reparto"] = element.recordInTracciato["descrizione_reparto"];

        resObj.codice=element.recordInTracciato["Referenza.Codice"];
        resObj.codice_gruppo=element.recordInTracciato["Scatto.CodiceGruppo"];

        //controlliamo l'appledMaster della pagina di indesign
        var appliedMaster = pageItem.appliedMaster;
        if (appliedMaster != null) {
            resObj.mastro = appliedMaster.name;
        }

        return resObj;
    },




    ///////////////////////////////////////////////////////////////CANTIERE/////////////////////////////////////////////////////////////

    getRefInBox_provvisorio(objItem, contesto_promo = [], pathLavorazione = "", sourceAree = [], sourceCanali = []) {
        //var obj = new Object();
        var livelli_meccanica = new Array();
        recInTrac = objItem.recordInTracciato;
      
        mecc_cache[recInTrac.combinazioneAssegnata] = "ok"; //???

        //var meta_meccanica = parseMeccanica(obj.meccanica, filtro0_0.selection.text, obj.tema, filtro0.selection.text, obj.tipo_tema, obj.nota_category, obj.ruolo, obj.grafica_50al50);           
        var meta_meccanica = this.parseMeccanica_provvisorio(objItem.recordInTracciato, objItem.allEtichette, contesto_promo, pathLavorazione, sourceAree, sourceCanali);


        //Analisi differenze
        var dna = obj.dna.substring(obj.dna.indexOf(",") + 1);
        var flag_diff = false;
        var error_confronto = "";

        var isMZLOC = (nome_origine_xml.indexOf("MZ_LOC") == 0);


        //Analisi differenze

        //alert(flag_diff);

        var mecc_filtro = obj.meccanica;
        if (obj.meccanica_stili != null && obj.meccanica_stili != "")
            mecc_filtro = obj.meccanica_stili;

        var ch_filtro = checkFiltroPer(mecc_filtro, obj.tema, obj.tipo_tema, obj.gruppo, obj.grafica_50al50, obj.sezione);
        //alert(ch_filtro);
        if (ch_filtro > 0 && !flag_diff) {
            var doc = myDocument;

            if (process == "confronto") {
                //Si tratta di confronto e se è presente il file separato dei grezzi devew andare ad aggiungere le ref su quello
                if (doc_grezzi != null) {
                    doc = doc_grezzi;
                }
                //ref_effettivamente_uscite_nel_grezzo[dna]="ok";
            }

            //alert("Accodo a grezzi " + obj.dna);
            pag_mastro = getMasterSpreadByName(obj.mastro, doc);

            if (n_item_mastro_corrente == -1 || i_prog_mastro > n_item_mastro_corrente) {
                if (i_prog_pag >= 0) {
                    doc.pages.add();
                }

                i_prog_pag++;


                if (pag_mastro == null) {
                    alert("La mastro " + obj.mastro + " non è stata trovata");
                    return;
                }

                obj.spazi_mastro = pag_mastro.textFrames.length / 2;


                if (pag_mastro == null) {
                    //Stop al processo di importazione
                    alert("'" + obj.mastro + "' non trovata. Il processo di importazione verrà interrotto.");
                    return;
                }

                n_item_mastro_corrente = obj.spazi_mastro;
                i_prog_mastro = 1;

            }



            //Dispongo l'oggetto        
            var myPage = doc.pages.item(i_prog_pag);
            //alert("get pag at " + i_prog_pag + " of " + myPage.parent.parent.name);

            //alert("cerco meccanica " + obj.meccanica);
            var g = getMasterItemByLabel(meta_meccanica.codice, doc);//obj.meccanica);       
            if (g == null) {
                var nosc = "";

                if (meta_meccanica.codice.indexOf("_SC_") > 0) {
                    nosc = meta_meccanica.codice.replace("_SC", "");
                    g = getMasterItemByLabel(nosc, doc);
                }
                if (g == null) {
                    //memorizzo le meccaniche non trovate
                    lista_meccaniche_non_trovate.push(meta_meccanica.codice);
                    g = getMasterItemByLabel("standard", doc);
                }
                else {
                    meta_meccanica.codice = nosc;
                }
            }

            var g_new = g.duplicate(myPage);

            g_new.label = obj.meccanica + "####" + meta_meccanica.codice;

            var string_error = "";

            var offset = 0;
            if ((i_prog_pag + 1) % 2 != 0 && i_prog_pag > 0)
                offset = doc.documentPreferences.pageWidth;

            var item_pos = getItemByLabel(i_prog_mastro + "_agenzia", pag_mastro);

            if (item_pos == null) {
                alert("ERRORE: Spazio di impaginazione non trovato. Verifica che la mastro sia giusta e che tutti i box agenzia siano presenti e nominati correttamente");
                return;
            }

            var agenzia_pos = [offset + item_pos.visibleBounds[1], item_pos.visibleBounds[0]];

            if (item_pos == null)
                alert("non trovato " + i_prog_mastro + "_agenzia in mastro " + obj.mastro);

            //alert(obj.meccanica + "####" + meta_meccanica.codice);
            g_new.move([offset + item_pos.visibleBounds[1], item_pos.visibleBounds[0]]);


            var wBOX_mastro = item_pos.visibleBounds[3] - item_pos.visibleBounds[1];
            var hBOX_mastro = item_pos.visibleBounds[2] - item_pos.visibleBounds[0];

            //alert(item_pos.visibleBounds[1]);

            var wBOX = g_new.visibleBounds[3] - g_new.visibleBounds[1];
            var hBOX = g_new.visibleBounds[2] - g_new.visibleBounds[0];

            //alert(hBox);

            g_new.itemLayer = doc.layers.itemByName("InPagina");

            var obj_da_cestinare = new Array();
            var cimitero = new Object();
            var str_da_cestinare = "";

            var y_allineamento_descr = 0;
            var y_allineamento_sx = 0;
            var y_allineamento_top = 0;

            var gd = null;
            var pz_kgl_scontopz_offerta = null;
            var pz_offerta = null;
            var pz_prezzo_offerta = null;
            var pz_prezzo_offerta_etto = null;
            var pz_sconto_piccolo = null;
            var pz_anziche = null;
            var pz_sy_euro = null;
            var pz_m_mm = null;
            var pz_2_pezzi = null;
            var pz_sconto_grande = null;
            var pz_sconto_meno = null;
            var pz_sconto_norm_fid = null;
            var pz_rect_regionale = null;
            var pz_rect_DescrPrezziORI = null;
            var pz_reparto = null;
            var pz_base = null;
            var pz_base_territorio = null;
            var pz_kgl_sconto = null;
            var pz_alletto = null;
            var pz_NOofferta_EURprima = null;
            var diff_50sulsec = 0;
            var pz_rect_validita = null;
            var rp1 = null;
            var logo_dop_igp = null;
            var pz_descrizione = null;
            var pz_lbl_titolari = null;
            var pz_blocco_allineamenti = null;
            var pz_boxDescrPrezzi_ORI_TERRITORIO = null;
            var pzImg = null;
            var pzLogoOri = null;

            var eurPrima_eliminato = false;
            var y_allineamento_eliminazioni = 0;

            var g_new_all = new Array();

            //var origin_test=g_new.geometricBounds[0];
            var loghiPerPosizionamentoInBoxOri = [];

            for (var $xa = 0; $xa < g_new.allPageItems.length; $xa++) {
                var pItem = g_new.allPageItems[$xa];
                var nome_proprieta = pItem.label.replace("X_", "");

                var cestinato = false;

                /*if (g_new.geometricBounds[0]!=origin_test)
                {
                    alert("Error prima di " + nome_proprieta) ;
                    return;
                }*/

                //if (nome_proprieta == "LBL_Reparto" )
                //continue;

                //alert(y_allineamento_eliminazioni + " -> " + nome_proprieta);
                //alert(nome_proprieta);

                if (nome_proprieta.indexOf("base") == 0 /*|| nome_proprieta=="boxDescrPrezzi_ORI_TERRITORIO"*/) {
                    if (nome_proprieta == "base_inostriori_territorio") {
                        pz_base_territorio = pItem;
                    }
                    else {
                        pz_base = pItem;
                    }

                    //alert(pItem);
                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                        var mItem = meta_meccanica.azioni[a];


                        if ((mItem.tipo == "color" || mItem.tipo == "colorBkg") && mItem.campo_indd == nome_proprieta) {


                            if (mItem.colore != "transparent") {
                                if (mItem.tipo == "color") {

                                    pItem.strokeColor = mItem.colore;
                                    if (mItem.bkg != null) {
                                        if (mItem.bkg == "transparent")
                                            pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                                    }
                                }
                                else if (mItem.tipo == "colorBkg") {
                                    pItem.fillColor = mItem.colore;
                                    pItem.fillTransparencySettings.blendingSettings.opacity = 100;
                                    //alert("cambio BKG in " + mItem.colore);
                                }


                            }
                            else {
                                pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                                //alert("Opacity 0!");
                            }

                            //break;
                        }
                        else if (mItem.tipo == "border" && mItem.campo_indd == nome_proprieta) {
                            //alert("border " + mItem.borderWidth + " on " + pItem.strokeWeight);

                            if (mItem.radius == 0) {
                                pItem.topLeftCornerOption = CornerOptions.NONE;
                                pItem.topRightCornerOption = CornerOptions.NONE;
                                pItem.bottomLeftCornerOption = CornerOptions.NONE;
                                pItem.bottomRightCornerOption = CornerOptions.NONE;
                            }
                            else {
                                pItem.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                                pItem.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
                                pItem.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                                pItem.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
                                pItem.topLeftCornerRadius = mItem.radius;
                                pItem.topRightCornerRadius = mItem.radius;
                                pItem.bottomLeftCornerRadius = mItem.radius;
                                pItem.bottomRightCornerRadius = mItem.radius;
                            }

                            if (mItem.borderWidth != pItem.strokeWeight)
                                pItem.strokeWeight = mItem.borderWidth;

                        }
                        else if (mItem.tipo == "effect" && mItem.campo_indd == nome_proprieta) {

                            //if (mItem.name=="bagliore_base")
                            //{   
                            //alert("Applico nessuno");                        
                            //applyObjectStyle(doc, pItem, "[Nessuno]"); 
                            //alert("Applico " + mItem.name + " a " + pItem.label);
                            applyObjectStyle(doc, pItem, mItem.name);
                            //}
                        }
                    }

                    if (obj.meccanica == "solo_descr") {
                        obj_da_cestinare.push(pItem);
                    }
                }
                else if (nome_proprieta == "immagine") {

                    pzImg = pItem;

                    if (obj.meccanica != "solo_descr") {
                        try {
                            if (obj[nome_proprieta] != null) {
                                var obj_file = File(doc.filePath + "/foto/" + obj[nome_proprieta].href);
                                pItem.place(obj_file);
                                pItem.fit(FitOptions.PROPORTIONALLY);
                                pItem.fit(FitOptions.FRAME_TO_CONTENT);
                            }
                        }
                        catch (error) {
                            string_error += "errore caricamento foto principale " + obj[nome_proprieta].href + "\n";
                        }

                        if (xml_immagine != null) {
                            //immagini raggruppamento
                            var lista_immagini_raggruppate = xml_immagine.children();
                            if (lista_immagini_raggruppate.length() > 0) {
                                for (var i_ragg = 0; i_ragg < lista_immagini_raggruppate.length(); i_ragg++) {
                                    try {
                                        var path_img = lista_immagini_raggruppate[i_ragg].attribute("href");//.toString().replace(".jpg",".psd");
                                        var path_assoluto = doc.filePath + "/foto/" + path_img;


                                        var myY1 = g_new.visibleBounds[0] - (10 * (i_ragg + 1));
                                        var myX1 = g_new.visibleBounds[1] + (10 * (i_ragg + 1));

                                        var offset_pos = 5;//(i_ragg+1)*5;
                                        var bounds_rect = [pItem.geometricBounds[0] + offset_pos, pItem.geometricBounds[1] + offset_pos, pItem.geometricBounds[2] + offset_pos, pItem.geometricBounds[3] + offset_pos];
                                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                                        g_new_all.push(rect);
                                        rect.label = "immagine_secondaria"
                                        var obj_temp = rect.place(File(path_assoluto));
                                        rect.fit(FitOptions.PROPORTIONALLY);
                                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                                        rect.fillColor = "None";

                                        var img = obj_temp[0];
                                        var _h = img.visibleBounds[2] - img.visibleBounds[0];
                                        var _w = img.visibleBounds[3] - img.visibleBounds[1];
                                    }
                                    catch (error) {
                                        string_error += "errore caricamento foto selezionata : " + error.message + "\n";
                                    }

                                }
                            }
                        }

                        if (meta_meccanica.codice.indexOf("BOX40") < 0) {
                            if (obj.logo_bandiera_it != "" && filtro0_0.selection.text != "ISTITUZIONALE") {

                                try {
                                    //var bounds_rect=[g_new.geometricBounds[0], g_new.geometricBounds[3]-14.969, g_new.geometricBounds[2], g_new.geometricBounds[3]];
                                    var bounds_rect = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                    var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                                    g_new_all.push(rect);
                                    rect.label = "logo";

                                    var obj_file = File(doc.filePath + "/foto/" + obj.logo_bandiera_it + ".psd");
                                    rect.place(obj_file);
                                    rect.fillColor = "None";
                                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                                } catch (error) { }
                            }

                            if (meta_meccanica.codice.indexOf("BOX41") < 0) {
                                //Metto il logo se esiste
                                if ((obj.tipo_logo == "dop" || obj.tipo_logo == "igp") && filtro0_0.selection.text != "ISTITUZIONALE") {
                                    try {
                                        var h_dop_igp = 13.039;
                                        var w_dop_igp = 13.039;

                                        var bounds_rect = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                                        g_new_all.push(rect);
                                        rect.label = "logo";

                                        var obj_file = File(doc.filePath + "/foto/logo_" + obj.tipo_logo + ".psd");
                                        rect.place(obj_file);
                                        rect.fillColor = "None";
                                        rect.fit(FitOptions.FRAME_TO_CONTENT);

                                        logo_dop_igp = rect;


                                        if (meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX62") {
                                            loghiPerPosizionamentoInBoxOri.push(rect);
                                        }

                                    }
                                    catch (error) {
                                        //Dovrei mettere no_foto
                                    }

                                }

                                //Metto il logo focus se esiste
                                if (obj.logo_focus != null && obj.logo_focus != "" && filtro0_0.selection.text != "ISTITUZIONALE") {
                                    try {

                                        //var bounds_rect=[g_new.pageItems[$xa].geometricBounds[0], g_new.pageItems[$xa].geometricBounds[1] + 43.878, g_new.pageItems[$xa].geometricBounds[0]+11.599, g_new.pageItems[$xa].geometricBounds[1]+ 43.878+20.997];

                                        //var bounds_rect=[g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0]+9.9, g_new.geometricBounds[1]+12.02];                    
                                        var bounds_rect = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[0] + 9.9, pItem.geometricBounds[1] + 12.02];
                                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                                        g_new_all.push(rect);
                                        rect.label = "logo";
                                        //alert("logo agriqualità");

                                        var obj_file = File(doc.filePath + "/foto/Logo_" + obj.logo_focus + ".psd");
                                        rect.place(obj_file);
                                        rect.fillColor = "None";
                                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                                    }
                                    catch (error) {
                                        //Dovrei mettere no_foto
                                    }

                                }
                            }
                        }
                    }
                    else {
                        obj_da_cestinare.push(pItem);
                    }
                }
                else if (nome_proprieta == "descrizione") {

                    pz_descrizione = pItem;
                    /*if (obj.nota_category.indexOf("###")>=0)
                    {
                        pz_descrizione=pItem;
                    }
                    else
                    {*/

                    var suffix_plus = "";
                    if (filtro0_0.selection.text == "EV" && obj.meccanica != "validita")
                        suffix_plus = "_evento";
                    //if (filtro0_0.selection.text.indexOf("LOC") >= 0 && obj.meccanica != "validita")//Effetto placebo
                    //suffix_plus = "_LOC";
                    if (filtro0_0.selection.text == "ISTITUZIONALE" && obj.meccanica != "validita")
                        suffix_plus = "_BFist";

                    if (obj.meccanica == "validita") {
                        //data_validita=obj[nome_proprieta].descr_nome;
                    }

                    //ATTENZIONE
                    //posizionare la descirizionme allineandola a prezzo offerta TOP o 
                    //SCONTO TOP se si tratta di meccanica percentuale o sir

                    //alert(obj[nome_proprieta].descrizione_1);
                    var desc_1 = obj[nome_proprieta].descr_nome;//.replace("<br>","\n");
                    while (desc_1.search("<br>") >= 0) {
                        desc_1 = desc_1.replace("<br>", "\n");
                    }

                    var desc_2 = obj[nome_proprieta].descr_tipo;//.replace("<br>","\n");
                    while (desc_2.search("<br>") >= 0) {
                        desc_2 = desc_2.replace("<br>", "\n");
                    }

                    var desc_3 = obj[nome_proprieta].descr_gr;//.replace("<br>","\n");
                    while (desc_3.search("<br>") >= 0) {
                        desc_3 = desc_3.replace("<br>", "\n");
                    }

                    //var desc_3=obj[nome_proprieta].descrizione_3.replace("<br>","\n");
                    var desc_4 = obj[nome_proprieta].descr_marca.replace("<br>", "\n");
                    while (desc_4.search("<br>") >= 0) {
                        desc_4 = desc_4.replace("<br>", "\n");
                    }

                    //alert("descr test 1");

                    //alert(desc_1 + ","+desc_2+","+desc_3+","+desc_4);

                    var no_str_etto = (obj.meccanica.indexOf("_boxetto") < 0 || (titolo_promo.indexOf("_SC_") > 0 && obj.meccanica.indexOf("PERCENTO_MM") >= 0 && obj.meccanica.indexOf("ALL") < 0));

                    try {

                        //g_new.pageItems[$xa].contents=desc_1;
                        var bounds = pItem.geometricBounds;
                        var new_bound = bounds[2] + 100;
                        pItem.geometricBounds = [bounds[0], bounds[1], new_bound, bounds[3]];

                        var indice_desc = 0;
                        var desc_prog = "";

                        pItem.contents = "";

                        var mecc_stili = obj.meccanica;
                        if (obj.meccanica_stili != null && obj.meccanica_stili != "")
                            mecc_stili = obj.meccanica_stili;

                        //alert("descr test 2");

                        //PRIMA IL REPARTO SE C'è
                        if (pz_reparto != null && meta_meccanica.codice != "BOX20" && meta_meccanica.codice != "BOX21" /*&& meta_meccanica.codice != "BOX2"  && meta_meccanica.codice != "BOX2_SC"*/) {
                            pItem.contents = pz_reparto.contents += "\n";

                            try {

                                //Prendo questo e lo metto come prima riga della descrizione
                                //alert("Cerco stile paragrafo Reparto_" + obj.descrizione.reparto + suffix_mxLOC);
                                var rp_parag = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "Reparto_" + obj.descrizione.reparto + suffix_mxLOC, meta_meccanica);

                                //alert(obj.meccanica+suffix_plus+", " + "Reparto_"+obj.descrizione.reparto + " == " + rp_parag);

                                var pab = pz_reparto.contents.toLowerCase().indexOf("prodotti al banco");
                                if (pab >= 0) {
                                    var inx_pab = pab + "prodotti al banco".length;
                                    pItem.contents = pz_reparto.contents.substring(0, inx_pab) + "\n" + pz_reparto.contents.substring(inx_pab + 1);
                                }

                                for (var r = 0; r < pItem.contents.length; r++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                {
                                    //alert(pItem.characters[r].appliedCharacterStyle.name);
                                    pItem.characters[r].appliedCharacterStyle = pz_reparto.characters[r].appliedCharacterStyle.name;
                                    pItem.characters[r].fillColor = pz_reparto.characters[r].fillColor.name;
                                    indice_desc = pItem.characters.length;
                                }
                                desc_prog = pItem.contents;

                                pItem.paragraphs[0].appliedParagraphStyle = rp_parag;

                            } catch (error) {

                                //alert(error);
                            }
                        }

                        //DESCRIZIONE
                        if (desc_1 != "") {
                            if (desc_prog != "" && pz_reparto == null) {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }

                            pItem.contents += desc_1;
                            desc_prog += desc_1;
                            if (desc_4 != "" || desc_2 != "" || (desc_3 != "" || !no_str_etto)) {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }
                            //var n_lines=pItem.lines.length;
                            //APPLICATO STILE ALLA DESCRIZIONE

                            var nome_stile = "";

                            /*if (obj.meccanica == "solo_descr") 
                                nome_stile = "x_Visione_soloDescr";
                            else*/
                            nome_stile = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_nome", meta_meccanica);
                            //alert("Cerco nome stile in " + obj.meccanica+suffix_plus + " = "  + nome_stile);

                            try {
                                for (var iz = indice_desc; iz < pItem.characters.length; iz++) {
                                    //alert(getStileForField(obj.meccanica,"descrizione_1"));                                
                                    pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                    //alert(pItem.characters[iz] + " -> " +nome_stile );
                                    indice_desc = pItem.characters.length;
                                }
                            }
                            catch (error_d1) {
                                //alert(error_d1);
                                string_error += "1. Non trovato lo stile descr_nome della meccanica " + obj.meccanica + "\n";
                            }
                        }
                        //alert(indice_desc);

                        //BRAND
                        if (obj[nome_proprieta].descr_marca != "") {

                            pItem.contents += desc_4;
                            desc_prog += desc_4;

                            if (desc_2 != "" || (desc_3 != "" || !no_str_etto)) {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }


                            var nome_stile = "";

                            /*if (obj.meccanica == "solo_descr")
                                nome_stile = "x_Visione_soloDescr";
                            else*/
                            nome_stile = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_marca", meta_meccanica);

                            try {

                                for (var iz = indice_desc; iz < pItem.characters.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                {
                                    pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                }
                            }
                            catch (error_d2) {
                                string_error += "2. Non trovato lo stile descr_marca della meccanica " + obj.meccanica + "\n";
                            }

                            indice_desc = pItem.characters.length;
                        }

                        //TIPO
                        if (obj[nome_proprieta].descr_tipo != "") {
                            pItem.contents += desc_2;
                            desc_prog += desc_2;

                            if ((desc_3 != "" || !no_str_etto)) {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }

                            var nome_stile = "";

                            /*if (obj.meccanica == "solo_descr")
                                nome_stile = "x_Visione_soloDescr";
                            else*/
                            nome_stile = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_tipo", meta_meccanica);

                            try {

                                for (var iz = indice_desc; iz < pItem.characters.length; iz++)//for (var iz=desc_1.length+1; iz<desc_1.length+desc_2.length; iz++)
                                {
                                    pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                    indice_desc = pItem.characters.length;
                                }
                            }
                            catch (error_d3) {
                                string_error += "3. Non trovato lo stile descr_tipo della meccanica " + meta_meccanica.codice + "\n";
                            }

                            //alert("Dopo dec 2 : " + g_new.pageItems[$xa].contents);

                        }

                        //alert(no_str_etto + " || " + desc_3);
                        //GRAMMATURA
                        var first_gramm_char_inx = -1;

                        //alert(no_str_etto);

                        if (no_str_etto) {
                            //alert("caso 1");

                            if (obj[nome_proprieta].descr_gr != "") {

                                //alert("Entro qui dentro");

                                var desc_3_copy = desc_3;

                                /*if (desc_prog != "") {
                                    pItem.contents += "\n";
                                    desc_prog += "\n";
                                }*/

                                var coeff_indice = 0;
                                if (desc_3.toLowerCase().indexOf("-<br2>al kg") == 0) {
                                    pItem.contents += desc_3.replace("-<br2>", "");
                                }
                                else {
                                    coeff_indice = 1;
                                    pItem.contents += desc_3.replace("-<br2>", "\n");
                                }


                                desc_prog += desc_3;

                                var sty_error = "";
                                try {



                                    var nome_stile = "";
                                    var nome_stile_alkg = "";

                                    /*if (obj.meccanica == "solo_descr")
                                        nome_stile = "x_Visione_soloDescr";
                                    else {*/
                                    nome_stile = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_gr", meta_meccanica);
                                    nome_stile_alkg = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_alkg", meta_meccanica);
                                    //}

                                    sty_error = nome_stile;

                                    first_gramm_char_inx = indice_desc;

                                    var split_alkg = desc_3_copy.split("<br2>");
                                    var prima_parte = split_alkg[0];
                                    for (var iz = indice_desc; iz < pItem.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                    {
                                        pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                    }

                                    if (split_alkg.length > 1 && nome_stile_alkg != "null") {
                                        sty_error = nome_stile_alkg;
                                        var seconda_parte = split_alkg[1];
                                        for (var iz = indice_desc + prima_parte.length + coeff_indice; iz < pItem.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                        {
                                            pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile_alkg);
                                        }
                                    }


                                }
                                catch (error_d4) {
                                    //alert(error_d4);
                                    string_error += "4. Non trovato lo stile " + sty_error + " della meccanica " + obj.meccanica + "\n";
                                }
                            }
                        }
                        else {
                            //alert("caso 2");

                            var s_etto = obj.stringa_etto;
                            var m_etto = "stringa_etto";
                            for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                                var mItem = meta_meccanica.azioni[a];

                                if (mItem.tipo == "binding" && mItem.campo_indd == "stringa_etto") {
                                    //cambio del nome di proprietà
                                    s_etto = obj[mItem.campo_dato];
                                    //alert("cambio mappa stile per " + nome_proprieta + " in " + mItem.mappa_stile);
                                    m_etto = mItem.mappa_stile;
                                    break;
                                }

                            }


                            /*if (desc_prog != "") {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }*/

                            first_gramm_char_inx = indice_desc;

                            desc_prog += s_etto;
                            //alert(indice_desc + " -> " + pItem.contents.length);
                            pItem.contents += s_etto;
                            //alert(indice_desc + " -> " + pItem.contents.length);

                            //alert("cerco descr_gr come" + m_etto + " contenuto " + s_etto);
                            var nome_stile = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, m_etto, meta_meccanica);

                            try {



                                for (var iz = indice_desc; iz < pItem.contents.length; iz++) {

                                    if (pItem.characters[iz].contents == "€" && obj.meccanica.indexOf("_evento") < 0 && obj.meccanica.indexOf("_inostriori") < 0 && obj.meccanica.indexOf("_territorio") < 0) {
                                        //alert("€ " + meta_meccanica.codice);
                                        if (titolo_promo.indexOf("_SC_") < 0)
                                            pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName("EURO piccolo_Descr2_boxetto" + suffix_plus);
                                        else
                                            pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName("EURO piccolo_Descr2_boxetto_SC");
                                    }
                                    else
                                        pItem.characters[iz].appliedCharacterStyle = doc.characterStyles.itemByName("C" + nome_stile);

                                }


                            }
                            catch (error_d4) {
                                string_error += "5. Non trovato lo stile " + nome_stile + " della meccanica " + obj.meccanica + "\n";
                            }


                        }

                        //alert("Step 1");

                        if (pz_reparto == null) {
                            try {

                                var pg_descr = getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descrizione", meta_meccanica);
                                //alert("applico " + pg_descr);
                                pItem.paragraphs[0].appliedParagraphStyle = pg_descr;
                            } catch (error) { }
                        }

                        if (first_gramm_char_inx > 0 && titolo_promo.indexOf("_SC_") > 0 && meta_meccanica.codice != "BOX14_SC") {
                            pItem.characters[first_gramm_char_inx].leading = 10;

                        }

                        if (meta_meccanica.codice.indexOf("BOX9") >= 0 /*|| meta_meccanica.codice=="BOX2"*/) {
                            if (pz_reparto == null) {

                                bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                                y_allineamento_eliminazioni += 1;
                            }
                            else {
                                //alert("set to -> " + bounds);
                                bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                                y_allineamento_eliminazioni += 1;
                            }
                        }


                        pItem.geometricBounds = bounds;

                        //alert("descr test 3");
                        //alert("real " + pItem.geometricBounds);

                        //alert("Step 2");

                        for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                            var mItem = meta_meccanica.azioni[a];

                            if (mItem.tipo == "pos" && mItem.campo_indd == "descrizione") {
                                pItem.paragraphs[0].justification = mItem.align;
                                var w = pItem.geometricBounds[3] - pItem.geometricBounds[1];
                                var newX = g_new.geometricBounds[1] + mItem.absoluteX;

                                pItem.geometricBounds = [pItem.geometricBounds[0], newX, pItem.geometricBounds[2], newX + w];
                                gd = pItem.parent;
                                //alert(gd);
                                break;
                            }

                        }



                        if (meta_meccanica.codice.indexOf("BOX14") >= 0) {
                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] + y_allineamento_eliminazioni, pItem.geometricBounds[3]];
                            if (obj.meccanica == "PUNTI_KgL_minicoll" || obj.meccanica == "PUNTI_minicoll") {
                                var countchar = pItem.characters.length;
                                //alert(tf.characters[countchar-1].baseline);
                                var offset = pItem.characters[countchar - 1].baseline - pItem.geometricBounds[0];
                                pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[0] + offset + 4, pItem.geometricBounds[3]];
                                //alert(pItem.characters[countchar-1].baseline + " -> " + offset);
                            }
                        }
                        else if (meta_meccanica.codice == "BOX41_SC") {
                            try {
                                var limit_x_off = getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                                if (limit_x_off != 0) {
                                    var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                    pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                                }
                            } catch (err) {
                                alert("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                            }
                        }



                        //Per mettere il testo tutto visibile qualora fosse in overflow
                        //alert("start from " + y_allineamento_eliminazioni);
                        var antiloop = 0;
                        while (pItem.overflows) {
                            var bound = pItem.geometricBounds;
                            if (meta_meccanica.codice.indexOf("BOX9") < 0 /*&& meta_meccanica.codice!="BOX2" && meta_meccanica.codice!="BOX2_SC"*/)
                                pItem.geometricBounds = [bound[0] - 1, bound[1], bound[2], bound[3]];
                            else {
                                pItem.geometricBounds = [bound[0], bound[1], bound[2] + 1, bound[3]];
                                y_allineamento_eliminazioni += 1;
                            }

                            antiloop++;
                            if (antiloop > 30)
                                break;
                        }


                        //alert("end to " + y_allineamento_eliminazioni);

                        //alert("fine bounding descrizione...");

                        if (titolo_promo.indexOf("_SC_") > 0 && meta_meccanica.codice != "BOX41_SC" && meta_meccanica.codice.indexOf("BOX14") < 0) {
                            var offset = 0;
                            if (pz_anziche != null) {
                                offset = pz_anziche.geometricBounds[0] - pItem.geometricBounds[2];

                            }
                            else if (pz_sconto_grande != null) {
                                offset = pz_sconto_grande.geometricBounds[0] - pItem.geometricBounds[2];

                            }
                            else if (pz_m_mm != null) {
                                offset = pz_m_mm.geometricBounds[0] - pItem.geometricBounds[2];

                            }
                            else if (pz_offerta != null) {
                                offset = pz_offerta.geometricBounds[0] - pItem.geometricBounds[2];

                            }

                            pItem.geometricBounds = [pItem.geometricBounds[0] + offset, pItem.geometricBounds[1], pItem.geometricBounds[2] + offset, pItem.geometricBounds[3]];

                            gd = pItem;

                        }

                    }
                    catch (error) {
                        //alert(error.message);
                        string_error += "errore caricamento font descrizioni : " + error.message + "\n";
                    }
                    //}

                    //Inserimento NOTE al campo descrizione per la segnalazione delel rispettive righe AVV
                    if (obj.nota_category.indexOf("###") >= 0) {
                        var riga_avv = obj.nota_category.substring(obj.nota_category.indexOf("###") + 3);
                        inserisciNota(pItem, "rigaAVV", riga_avv);
                    }

                }
                else if (nome_proprieta == "Triangolo_VAL_txt") {
                    var data_validita = obj.sez_data;

                    var analyz = data_validita.toLowerCase();
                    var inx_br = 0;
                    for (var $me in mesi) {
                        if (analyz.indexOf(mesi[$me]) > 0) {
                            inx_br = analyz.indexOf(mesi[$me]);
                            break;
                        }
                    }

                    if (inx_br > 0)
                        pItem.contents = data_validita.toUpperCase().substring(0, inx_br - 1) + "\n" + data_validita.toUpperCase().substring(inx_br);
                    else
                        pItem.contents = data_validita.toUpperCase()

                }
                else if (nome_proprieta == "Triangolo_VAL") {
                    if (filtro0_0.selection.text.indexOf("LOC 1a") >= 0) {
                        pItem.fillColor = "Localismo 1a DATA";
                    }
                    else if (filtro0_0.selection.text.indexOf("LOC 2a") >= 0) {
                        pItem.fillColor = "Localismo 2a DATA";
                    }
                }
                else if (nome_proprieta == "Fascia_VAL") {
                    var data_validita = obj.sez_data;

                    pz_rect_validita = pItem;

                    if (filtro0_0.selection.text != "LOC Mensile") {
                        pItem.contents = "";

                        if (filtro0_0.selection.text.indexOf("LOC 1a") >= 0) {
                            pItem.fillColor = "Localismo 1a DATA";
                        }
                        else if (filtro0_0.selection.text.indexOf("LOC 2a") >= 0) {
                            pItem.fillColor = "Localismo 2a DATA";
                        }
                    }
                    else {
                        pItem.contents = "VALIDO " + data_validita.toUpperCase();
                    }

                }
                else if (nome_proprieta == "Range_Punti_1_cornice" || nome_proprieta == "Range_Punti_2_cornice") {

                    if (nome_proprieta == "Range_Punti_1_cornice") {
                        for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                            var mItem = meta_meccanica.azioni[a];
                            if (mItem.tipo == "resize" && mItem.campo_indd == "Range_Punti_1_cornice") {
                                //alert("resize!");
                                var h = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                                var offY = h - mItem.size[1];
                                pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] - offY, pItem.geometricBounds[3]];

                                break;
                            }
                        }
                    }
                    //pItem.fit(FitOptions.CONTENT_TO_FRAME);
                }
                else {
                    try {


                        //alert(y_allineamento_eliminazioni);

                        color = "";
                        //Da vedere in funzione di eventuali opzioni binding nei meta della meccanica
                        var flag_del = false;


                        //alert("cerco azioni per " + nome_proprieta);
                        var mappa_stile = nome_proprieta;

                        //alert("analisi " + obj.codice);

                        var nome_binding = "";
                        for (var a = 0; a < meta_meccanica.azioni.length; a++) {

                            var mItem = meta_meccanica.azioni[a];

                            //alert(mItem.campo_indd  + " - "  + mItem.tipo);

                            //if (obj.meccanica=="TP_MM_mercato_boxetto" && nome_proprieta=="stringa_etto")
                            //alert("cerco binding x stringa_etto -> " + mItem.campo_indd +  " >>>> "  + mItem.campo_dato);
                            if (mItem.tipo != "del" && mItem.campo_indd == nome_proprieta) {
                                //alert("Azione per " + nome_proprieta + " = " + mItem.tipo);
                                if (mItem.tipo == "binding") {
                                    //cambio del nome di proprietà
                                    nome_binding = mItem.campo_dato;
                                    //alert("binding da " + mItem.campo_indd + "a " + mItem.campo_dato);
                                    mappa_stile = mItem.mappa_stile;
                                }
                                else if (mItem.tipo == "color" || mItem.tipo == "colorBkg") {
                                    color = mItem.colore;

                                    //alert (mItem.tipo + " " + color);
                                    try {
                                        //alert(nome_proprieta + " cambia colore in " + color);
                                        if (nome_proprieta.indexOf("rect_") >= 0) {
                                            //Si tratta di rectangle
                                            pItem.fillColor = color;
                                        }
                                        else if (nome_proprieta == "linee" || nome_proprieta == "base") {
                                            //alert("linee " + color);
                                            if (color != "transparent")
                                                pItem.strokeColor = color;
                                            else
                                                pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                                        }
                                        else {
                                            //alert(nome_proprieta + " di " + color);
                                            //si tratta di textframe
                                            for (var $c = 0; $c < pItem.contents.length; $c++) {
                                                //alert(pItem.characters[$c].contents + " -> " + color);
                                                pItem.characters[$c].fillColor = color;
                                            }
                                        }
                                    } catch (error) {

                                    }
                                }
                                else if (mItem.tipo == "stroke") {
                                    pItem.strokeWeight = mItem.border;
                                }
                                else if (mItem.tipo == "pos") {
                                    if (mItem.offset != null) {
                                        pItem.geometricBounds = [pItem.geometricBounds[0] + mItem.offset[1], pItem.geometricBounds[1] + mItem.offset[0],
                                        pItem.geometricBounds[2] + mItem.offset[1], pItem.geometricBounds[3] + mItem.offset[0]];
                                    }


                                }
                                else if (mItem.tipo == "rect") {
                                    //alert(pItem.label);
                                    //alert(pItem.geometricBounds);
                                    pItem.geometricBounds = [pItem.geometricBounds[0] + mItem.offset[1], pItem.geometricBounds[1] + mItem.offset[0],
                                    pItem.geometricBounds[2] + mItem.offset[3], pItem.geometricBounds[3] + mItem.offset[2]];
                                    //alert(pItem.geometricBounds);                              
                                }
                                else if (mItem.tipo == "resize") {
                                    var w = mItem.size[0];
                                    var h = mItem.size[1];
                                    if (w == 0) {
                                        //Aumentare altezza bloccando parte bassa
                                        var h_elem = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                                        var offset = h - h_elem;

                                        //alert(nome_proprieta + " h=" + offset );
                                        if (pItem.geometricBounds[0] - offset < g_new.geometricBounds[0])
                                            offset -= (g_new.geometricBounds[0] - (pItem.geometricBounds[0] - offset));

                                        pItem.geometricBounds = [
                                            pItem.geometricBounds[0] - offset,
                                            pItem.geometricBounds[1],
                                            pItem.geometricBounds[2],
                                            pItem.geometricBounds[3]
                                        ];
                                    }
                                }
                                else if (mItem.tipo == "file") {
                                    var f = File(doc.filePath + "/foto/" + mItem.filename);
                                    if (f.exists)
                                        pItem.place(f);
                                }
                                else if (mItem.tipo == "effect" && mItem.campo_indd == nome_proprieta) {
                                    applyObjectStyle(doc, pItem, mItem.name);
                                }
                            }
                            else if (mItem.tipo == "del") {
                                var del_rep = new Object();

                                for (var $c in mItem.campi) {
                                    if (mItem.campi[$c] == nome_proprieta && del_rep[nome_proprieta] == null) {
                                        del_rep[nome_proprieta] = "ok";

                                        if (nome_proprieta == "prezzo_offerta_EURprima")
                                            eurPrima_eliminato = true;

                                        //alert("del " + nome_proprieta + " " + eurPrima_eliminato);
                                        flag_del = true;
                                        if (pItem.label == "campo_offerta" || pItem.label == "campo_offerta_etto" || pItem.label == "sconto_effettivo" || pItem.label == "sconto_effettivo_grande" ||
                                            pItem.label == "campo_offerta_KgL" || pItem.label == "campo_offerta_KgL_sconto" || pItem.label == "LBL_Carte" || (pItem.label == "Range_Punti_2" && (meta_meccanica.codice == "BOX30" /*MCPOINT v1.0 ||  meta_meccanica.codice.indexOf("BOX14") >= 0 MCPOINT v1.0*/)) ||/*pItem.label=="prezzo_offerta_EURprima" ||*/
                                            (pItem.label == "PezzConf" && meta_meccanica.codice == "BOX30") || (pItem.label == "gruppo_sconto" && (meta_meccanica.codice.indexOf("BOX9") >= 0 || meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC")) || (pItem.label == "sy_etto" && (meta_meccanica.codice.indexOf("BOX9") >= 0 || meta_meccanica.codice == "BOX20" || meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC")) || pItem.label == "PIEDE_Titolari" || (pItem.label == "prezzo_offerta_gruppo" && !eurPrima_eliminato)) {

                                            //alert("eliminazione " + pItem.label + " è " + (pItem.geometricBounds[2] - pItem.geometricBounds[0]));
                                            if (meta_meccanica.codice.indexOf("BOX9") >= 0 /*|| meta_meccanica.codice=="BOX2" || meta_meccanica.codice=="BOX2_SC"*/) {
                                                y_allineamento_eliminazioni -= (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                            }
                                            else {
                                                y_allineamento_eliminazioni += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                            }
                                            //alert("elimino " + pItem.label + " -> " + y_allineamento_eliminazioni);
                                        }
                                        else if (pItem.label == "Range_Punti_2") {
                                            y_allineamento_sx += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                        }
                                        else if (pItem.label == "LBL_Titolari") {
                                            y_allineamento_top += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                        }

                                        //alert(y_allineamento_eliminazioni);
                                    }
                                }
                            }
                        }


                        //if (obj.meccanica.indexOf("sottocosto")>=0 && !flag_del )
                        //alert(flag_del " considero nello spostamento " + pItem.label);
                        var vecchio_nome_proprieta = "";

                        // alert(pItem.label);

                        if (nome_binding != "" && nome_binding != nome_proprieta) {
                            vecchio_nome_proprieta = nome_proprieta;
                            nome_proprieta = nome_binding;
                        }

                        if (pItem.label == "gruppo_sconto" && !flag_del) {
                            y_allineamento_descr = pItem.geometricBounds[0];
                            pz_sconto_grande = pItem;

                            pz_sconto_meno = pItem.textFrames[1];

                            livelli_meccanica.push(pItem);
                        }
                        if ((pItem.label == "sconto_norm" || pItem.label == "sconto_fid") && !flag_del) {
                            pz_sconto_norm_fid = pItem;
                        }
                        else if ((pItem.label == "prezzo_offerta_gruppo" || pItem.label == "prezzo_offerta_EURprima"
                            || pItem.label == "prezzo_offerta_etto_EURprima" || pItem.label == "prezzo_offerta_secondo_EURprima") && !flag_del) {
                            pz_offerta = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if ((pItem.label == "campo_offerta" || pItem.label == "campo_offerta_etto") && !flag_del) {
                            //alert("campo offerta NON da eliminare");
                            pz_anziche = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if ((pItem.label == "sconto_effettivo" || pItem.label == "sconto_effettivo_grande") && !flag_del) {
                            pz_sconto_piccolo = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "M_MM" && !flag_del) {
                            pz_m_mm = pItem;
                            y_allineamento_descr = pItem.geometricBounds[0];
                            livelli_meccanica.push(pItem);
                        }
                        else if ((pItem.label == "PezzConf_NM" && obj.meccanica.indexOf("50sulSecondo") < 0) && !flag_del) {
                            pz_2_pezzi = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "BIS_grafica") {
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "campo_offerta_KgL_sconto" && !flag_del) {
                            livelli_meccanica.push(pItem);
                            pz_kgl_sconto = pItem;
                        }
                        else if (pItem.label == "gruppo_descrizione" && meta_meccanica.codice != "BOX20" && meta_meccanica.codice != "BOX21" && meta_meccanica.codice.indexOf("BOX14") < 0) {
                            gd = pItem;
                            if (meta_meccanica.codice.indexOf("BOX41") < 0)
                                livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "rect_regionale" || pItem.label == "rect_tipico" || pItem.label == "rect_etto") {
                            pz_rect_regionale = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "sy_etto" && !flag_del) {

                            pz_alletto = pItem;
                            if (meta_meccanica.codice == "BOX9" || meta_meccanica.codice == "BOX20" /*|| meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC"*/)
                                livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "sy_2x1") {
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "boxDescrPrezziORI") {
                            pz_rect_DescrPrezziORI = pItem;
                        }
                        else if (nome_proprieta == "boxDescrPrezzi_ORI_TERRITORIO") {
                            if (obj.meccanica != "solo_descr")
                                pz_boxDescrPrezzi_ORI_TERRITORIO = pItem;
                        }


                        if (pItem.label == "PezzConf" && meta_meccanica.codice == "BOX30" && !flag_del) {
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "PezzConf" || pItem.label == "PezzConf_NM") {
                            if (pz_NOofferta_EURprima != null) {
                                var gb = pItem.geometricBounds;
                                var gb_dest = pz_NOofferta_EURprima.geometricBounds;
                                var diff = gb_dest[0] - gb[0];

                                if (diff_50sulsec > 0)
                                    diff = diff_50sulsec;

                                var ox = 0;
                                if (pItem.label == "PezzConf") {
                                    var hor = pz_NOofferta_EURprima.characters[0].horizontalOffset;
                                    ox = hor - gb[3];
                                }
                                else if (pItem.label == "PezzConf_NM") {
                                    var hor = pz_offerta.characters[0].horizontalOffset;
                                    ox = hor - gb[3];
                                }

                                pItem.geometricBounds = [gb[0] + diff, gb[1] + ox, gb[2] + diff, gb[3] + ox];

                                if (diff_50sulsec == 0)
                                    diff_50sulsec = diff;

                            }
                        }
                        else if (pItem.label == "prezzo_NOofferta_1pezzo_EURprima") {
                            pz_NOofferta_EURprima = pItem;
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "LBL_Carte" && !flag_del) {
                            livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "Range_Punti_1" && !flag_del) {
                            rp1 = pItem;
                            if (meta_meccanica.codice == "BOX30" /* MCPOINT v1.0 || meta_meccanica.codice.indexOf("BOX14")>=0  MCPOINT v1.0*/)
                                livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "Range_Punti_2" && !flag_del) {
                            if (meta_meccanica.codice == "BOX30")
                                livelli_meccanica.push(pItem);
                        }
                        else if (pItem.label == "prezzo_offerta" && !flag_del) {
                            pz_prezzo_offerta = pItem;
                        }
                        else if (pItem.label == "prezzo_offerta_etto" && !flag_del) {
                            pz_prezzo_offerta_etto = pItem;
                        }
                        else if (pItem.label == "LBL_Titolari" && !flag_del) {
                            pz_lbl_titolari = pItem;
                        }
                        else if (pItem.label == "Etto_BDP_SDB") {
                            pz_blocco_allineamenti = pItem;
                        }
                        else if (pItem.label == "sy_euro") {
                            pz_sy_euro = pItem;
                        }
                        else if (pItem.label == "gruppo_reparto") {
                            //Solo se il reparto è di un certo valore
                            if (obj.descrizione.reparto == 33 ||
                                obj.descrizione.reparto == 31 ||
                                obj.descrizione.reparto == 29 ||
                                obj.descrizione.reparto == 27 ||
                                obj.descrizione.reparto == 25 ||
                                obj.descrizione.reparto == 21) {
                                livelli_meccanica.push(pItem);
                            }
                        }


                        // if (obj.codice=="2339273")
                        //alert(pItem.label + " y del " + y_allineamento_eliminazioni);


                        //alert(pItem.label + "  lvls" + livelli_meccanica.length + " -> " + y_allineamento_eliminazioni);

                        if (livelli_meccanica.length > 1 && meta_meccanica.codice.indexOf("BOX9") < 0 /*&& meta_meccanica.codice!="BOX2" && meta_meccanica.codice!="BOX2_SC"*/) {
                            if (/*pItem.label=="sy_euro" ||*/
                                pItem.label == "prezzo_offerta_gruppo" ||
                                pItem.label == "prezzo_offerta_EURprima" ||
                                pItem.label == "prezzo_offerta_etto_EURprima" ||
                                pItem.label == "prezzo_offerta_secondo_EURprima" ||
                                pItem.label == "prezzo_NOofferta_1pezzo_EURprima" ||
                                pItem.label == "campo_offerta" ||
                                pItem.label == "campo_offerta_KgL_sconto" ||
                                pItem.label == "campo_offerta_etto" ||
                                pItem.label == "sconto_effettivo_grande" ||
                                pItem.label == "sconto_effettivo" ||
                                pItem.label == "M_MM" ||
                                (pItem.label == "PezzConf_NM" && obj.meccanica.indexOf("50sulSecondo") < 0) ||
                                pItem.label == "BIS_grafica" ||
                                pItem.label == "gruppo_sconto" ||
                                (pItem.label == "gruppo_descrizione" && meta_meccanica.codice != "BOX20" && meta_meccanica.codice != "BOX9" && meta_meccanica.codice != "BOX5"/*&& meta_meccanica.codice != "BOX2" && meta_meccanica.codice != "BOX2_SC"*/
                                    && meta_meccanica.codice != "BOX21" && meta_meccanica.codice.indexOf("BOX14") < 0 && meta_meccanica.codice.indexOf("BOX41") < 0) ||
                                (pItem.label == "LBL_Carte" /* MCPOINT v1.0*/ && meta_meccanica.codice.indexOf("BOX14") < 0 /*MCPOINT v1.0*/) ||
                                pItem.label == "sy_2x1" ||
                                (pItem.label == "Range_Punti_1" && (meta_meccanica.codice == "BOX30" || meta_meccanica.codice.indexOf("BOX14") >= 0)) ||
                                (pItem.label == "Range_Punti_2" && (meta_meccanica.codice == "BOX30" /*MCPOINT v1.0  || meta_meccanica.codice.indexOf("BOX14") >= 0  MCPOINT v1.0*/)) ||
                                (pItem.label == "PezzConf" && meta_meccanica.codice == "BOX30") ||
                                (pItem.label == "sy_etto" && (meta_meccanica.codice == "BOX9" || meta_meccanica.codice == "BOX20" /*|| meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC"*/))
                            ) {

                                //alert(pItem.label);

                                // if (pItem.label == "gruppo_descrizione")
                                // {
                                //     alert("test 1");
                                // }

                                //E' da riposizionare
                                var lastItem = livelli_meccanica[livelli_meccanica.length - 2];

                                //alert("posiziono " + pItem.label + " a partire da " + lastItem.label);

                                var align = lastItem.geometricBounds;
                                var myH = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                                var newY = align[0] - myH;

                                /*if (pItem.label == "prezzo_offerta_gruppo" && obj.meccanica.indexOf("regionale") > 0) {
                                    alert("1. y=" + newY + " last item " + lastItem.label + " = " + align[0]);
                                    newY -= 0.8;
                                }*/

                                if (pItem.label == "gruppo_sconto" && obj.meccanica.indexOf("_boxetto") > 0 && meta_meccanica.codice == "BOX6")
                                    newY -= 1;


                                pItem.geometricBounds = [newY, pItem.geometricBounds[1], newY + myH, pItem.geometricBounds[3]];

                                /*if (pItem.label == "LBL_Carte")
                                {
                                    //alert("2. LBL_Carte si sposta a " + (pItem.label == "LBL_Carte" && meta_meccanica.codice.indexOf("BOX14") < 0 ));
                                }
    
                                if (pItem.label=="descrizione" || pItem.label=="descrizione_gruppo")
                                {
                                    alert(pItem.label + " da risposizionare");
                                }*/



                                if (pItem.label == "LBL_Carte") {
                                    // try{pItem.fit(FitOptions.CONTENT_TO_FRAME);}catch(error){alert(error);}
                                    try {
                                        var gb = pItem.groups[0].geometricBounds;
                                        pItem.groups[0].geometricBounds = [newY, gb[1], newY + myH, gb[3]];
                                        for (var f = 0; f < pItem.groups[0].pageItems.length; f++) {
                                            pItem.groups[0].pageItems[f].fit(FitOptions.PROPORTIONALLY);
                                            pItem.groups[0].pageItems[f].fit(FitOptions.FRAME_TO_CONTENT);
                                        }
                                    } catch (error) { }
                                }

                                // if (pItem.label == "gruppo_descrizione")
                                // {
                                //     alert("test 2");
                                // }



                            }
                        }
                        else if (y_allineamento_eliminazioni != 0) {

                            //Sistemo i campi 
                            if (/*pItem.label=="sy_euro" ||*/
                                pItem.label == "prezzo_offerta_gruppo" ||
                                pItem.label == "prezzo_offerta_EURprima" ||
                                pItem.label == "prezzo_offerta_etto_EURprima" ||
                                pItem.label == "prezzo_NOofferta_1pezzo_EURprima" ||
                                pItem.label == "prezzo_offerta_secondo_EURprima" ||
                                pItem.label == "campo_offerta" ||
                                pItem.label == "campo_offerta_etto" ||
                                pItem.label == "sconto_effettivo_grande" ||
                                pItem.label == "campo_offerta_KgL_sconto" ||
                                pItem.label == "sconto_effettivo" ||
                                pItem.label == "M_MM" ||
                                (pItem.label == "PezzConf_NM" && obj.meccanica.indexOf("50sulSecondo") < 0) ||
                                pItem.label == "BIS_grafica" ||
                                pItem.label == "gruppo_sconto" ||
                                pItem.label == "gruppo_reparto" ||
                                (pItem.label == "LBL_Carte" && meta_meccanica.codice.indexOf("BOX14") < 0) ||
                                (pItem.label == "gruppo_descrizione" && meta_meccanica.codice != "BOX20"
                                    && meta_meccanica.codice != "BOX21" && meta_meccanica.codice.indexOf("BOX14") < 0 && meta_meccanica.codice.indexOf("BOX41") < 0) ||
                                pItem.label == "sy_2x1" ||
                                (pItem.label == "Range_Punti_1" && (meta_meccanica.codice == "BOX30"  /* MCPOINT v1.0 || meta_meccanica.codice.indexOf("BOX14") >= 0 MCPOINT v1.0*/)) ||
                                (pItem.label == "PezzConf" && meta_meccanica.codice == "BOX30") ||
                                (pItem.label == "sy_etto" && (meta_meccanica.codice.indexOf("BOX9") >= 0 || meta_meccanica.codice == "BOX20" /*|| meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC"*/)) ||
                                pItem.label == "boxDescrPrezziORI"
                            ) {



                                if (pItem.label != "gruppo_descrizione") {
                                    //if (obj.codice=="2339273")
                                    //alert(pItem.label + " offset " + y_allineamento_eliminazioni);

                                    //if  (pItem.label=="prezzo_offerta_etto_EURprima" && (filtro0_0.selection.text=="INT") ) 
                                    // y_allineamento_eliminazioni -=1;

                                    var offset = 0;

                                    if (pItem.label == "gruppo_sconto" && obj.meccanica.indexOf("PERCENTO") >= 0 && obj.meccanica.indexOf("_ALL") < 0) {
                                        if (meta_meccanica.codice == "BOX12")
                                            offset += 3;//6.75;
                                        else if (meta_meccanica.codice == "BOX6")
                                            offset += 5.202;
                                        else if (meta_meccanica.codice == "BOX1")
                                            offset += 6.575;
                                        else if (meta_meccanica.codice == "BOX9" /*|| meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX2_SC"*/)
                                            offset += 0;

                                        //alert(meta_meccanica.codice + " -> " + offset);
                                    }

                                    /*if (pItem.label == "prezzo_offerta_gruppo" && obj.meccanica.indexOf("regionale") > 0) {
                                        alert("2. y=" + y_allineamento_eliminazioni + " offset = " + offset);
                                        offset = -0.8;
                                    }*/

                                    /*
                                    if (pItem.label == "LBL_Carte" )
                                        alert("2. LBL_Carte si sposta di " + y_allineamento_eliminazioni +"+"+ offset);
    
                                    if (pItem.label=="descrizione" || pItem.label=="descrizione_gruppo")
                                    {
                                        alert("2. " + pItem.label + " da risposizionare");
                                    }
                                    */

                                    if ((meta_meccanica.codice.indexOf("BOX9") >= 0 /*|| meta_meccanica.codice=="BOX2" || meta_meccanica.codice=="BOX2_SC"*/) && pItem.label == "boxDescrPrezziORI") {
                                        //if (pItem.geometricBounds[3])
                                        pItem.geometricBounds = [
                                            pItem.geometricBounds[0],
                                            pItem.geometricBounds[1],
                                            pItem.geometricBounds[2] + y_allineamento_eliminazioni + offset + 2,
                                            pItem.geometricBounds[3]
                                        ];
                                    }
                                    else {
                                        pItem.geometricBounds = [
                                            pItem.geometricBounds[0] + y_allineamento_eliminazioni + offset,
                                            pItem.geometricBounds[1],
                                            pItem.geometricBounds[2] + y_allineamento_eliminazioni + offset,
                                            pItem.geometricBounds[3]
                                        ];
                                    }



                                    /*
                                    //MCPOINT v1.0
                                    if (pItem.label == "LBL_Carte" && meta_meccanica.codice.indexOf("BOX14") >= 0) {
                                        try {
                                            pItem.groups[0].geometricBounds = [pItem.groups[0].geometricBounds[0] + y_allineamento_eliminazioni + offset, pItem.groups[0].geometricBounds[1], pItem.groups[0].geometricBounds[2] + y_allineamento_eliminazioni + offset, pItem.groups[0].geometricBounds[3]];
                                        } catch (error) { }
                                    }
                                    //MCPOINT v1.0*/

                                    /*if (pItem.label == "LBL_Carte" && meta_meccanica.codice=="BOX9") {
                                        // try{pItem.fit(FitOptions.CONTENT_TO_FRAME);}catch(error){alert(error);}
                                        try {
                                            var gb = pItem.groups[0].geometricBounds;
                                            pItem.groups[0].geometricBounds = [newY, gb[1], newY + myH, gb[3]];
                                            for (var f = 0; f < pItem.groups[0].pageItems.length; f++) {
                                                pItem.groups[0].pageItems[f].fit(FitOptions.PROPORTIONALLY);
                                                pItem.groups[0].pageItems[f].fit(FitOptions.FRAME_TO_CONTENT);
                                            }
                                        } catch (error) {
                                            alert(error);
                                         }
                                    }*/
                                }
                                else if (meta_meccanica.codice != "BOX20" && meta_meccanica.codice != "BOX21" && meta_meccanica.codice.indexOf("BOX14") < 0) {

                                    var offset = 0;
                                    if (pz_sconto_grande != null) {
                                        offset = pz_sconto_grande.geometricBounds[0] - pItem.geometricBounds[2];

                                    }
                                    else if (pz_m_mm != null) {
                                        offset = pz_m_mm.geometricBounds[0] - pItem.geometricBounds[2];

                                    }
                                    else if (pz_offerta != null) {

                                        offset = pz_offerta.geometricBounds[0] - pItem.geometricBounds[2];

                                    }


                                    if (offset > 0) {
                                        pItem.geometricBounds = [
                                            pItem.geometricBounds[0] + offset,
                                            pItem.geometricBounds[1],
                                            pItem.geometricBounds[2] + offset,
                                            pItem.geometricBounds[3]
                                        ];
                                    }


                                }

                                //if (obj.meccanica.indexOf("sottocosto")>=0)
                                //alert("prezzo_offerta " + y_allineamento_eliminazioni);
                            }


                        }
                        else if (y_allineamento_sx > 0) {
                            if (pItem.label == "Range_Punti_1" && meta_meccanica.codice.indexOf("BOX14") >= 0) {

                                //alert(y_allineamento_sx);
                                pItem.geometricBounds = [
                                    pItem.geometricBounds[0] + y_allineamento_sx,
                                    pItem.geometricBounds[1],
                                    pItem.geometricBounds[2] + y_allineamento_sx,
                                    pItem.geometricBounds[3]
                                ];
                            }
                        }



                        if (y_allineamento_top > 0) {
                            if (pItem.label == "logo_SDB" || pItem.label == "logo_BDP") {
                                pItem.geometricBounds = [pItem.geometricBounds[0] - y_allineamento_top, pItem.geometricBounds[1], pItem.geometricBounds[2] - y_allineamento_top, pItem.geometricBounds[3]];
                            }
                        }

                        if (obj[nome_proprieta] != null && obj[nome_proprieta] != "") {
                            try {
                                if (pItem.label == "prezzo_offerta_gruppo") {
                                    y_allineamento_descr = pItem.geometricBounds[0];

                                    //alert("nuovo allineamento a prezzo_offerta " + pItem.geometricBounds);
                                }
                                else if (pItem.label == "M_MM") {
                                    //alert("nuovo allineamento a M_MM " + pItem.geometricBounds);
                                    y_allineamento_descr = pItem.geometricBounds[0];
                                }

                                var contenuto = obj[nome_proprieta];


                                if (pItem.label != "prezzo_offerta" && pItem.label != "prezzo_offerta_etto") {
                                    pItem.contents = "";
                                }
                                else if (pItem.label != "prezzo_offerta_etto") {
                                    if (meta_meccanica.codice.indexOf("BOX9") < 0 /*&& meta_meccanica.codice!="BOX2" && meta_meccanica.codice!="BOX2_SC"*/) {
                                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] - 10, pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                    }
                                    else {
                                        //pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2], pItem.geometricBounds[3]+10];
                                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                        if (pItem.label == "prezzo_offerta") {
                                            if (pz_sy_euro != null) {
                                                if (contenuto.length > 4) {
                                                    //Numero supreiore a 9.99
                                                    pz_sy_euro.geometricBounds = [pz_sy_euro.geometricBounds[0], pz_sy_euro.geometricBounds[1] + 6, pz_sy_euro.geometricBounds[2], pz_sy_euro.geometricBounds[3] + 6];
                                                }
                                            }
                                        }
                                    }

                                }
                                else {
                                    if (contenuto.length >= 6) {
                                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] - 6, pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                    }
                                }


                                if (pItem.label == "prezzo_offerta2" ||
                                    (pItem.label.indexOf("EURprima") > 0 && nome_proprieta == "prezzo_offerta")) {
                                    contenuto = "€ " + contenuto;
                                }

                                pItem.contents = contenuto;
                                //alert(nome_proprieta + "=" + contenuto);

                                var suffix_plus = "";
                                if (filtro0_0.selection.text == "INT"/* && nome_proprieta=="prezzo_offerta"*/)
                                    suffix_plus = "_INT";
                                if (filtro0_0.selection.text == "RIL")
                                    suffix_plus = "_RIL";
                                if (filtro0_0.selection.text == "EV")
                                    suffix_plus = "_evento";
                                //if (filtro0_0.selection.text.indexOf("LOC") >= 0)//Effetto placebo
                                //suffix_plus = "_LOC";
                                if (filtro0_0.selection.text == "ISTITUZIONALE")
                                    suffix_plus = "_BFist";

                                //alert(mappa_stile+  " -> " + obj.meccanica+suffix_plus);
                                var sty = getStileForField(obj.meccanica + suffix_plus, mappa_stile, meta_meccanica);
                                //alert("getStileForField(" + obj.meccanica+suffix_plus+","+mappa_stile+ ") = "+ sty);
                                if (sty != "null") {
                                    applyNeastedStyles(pItem, doc.paragraphStyles.itemByName(sty), color);
                                }

                            }
                            catch (error) {
                                //alert("errore su " + nome_proprieta + " = " + error.message);
                                string_error += "errore caricamento font " + nome_proprieta + " : " + error.message + "\n";
                            }
                        }
                        else {

                            if (pItem.label != "" && pItem.label.indexOf("Reparto") < 0) {
                                //obj_da_cestinare.push(pItem.label);
                                //cestinato=true;
                                if (pItem.label == "gruppo_descrizione" && meta_meccanica.codice.indexOf("BOX41") >= 0) {
                                    //alert("gruppo_descrizione");
                                    try {
                                        var limit_x_off = getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                                        if (limit_x_off != 0) {
                                            var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                                        }
                                        //alert(newx);
                                    } catch (err) {
                                        alert("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                                    }
                                }
                            }
                            else if (pItem.label.indexOf("Reparto") >= 0) {
                                if (obj.reparto != null) {
                                    pItem.contents = obj.reparto;

                                    var suffix_plus = "";
                                    //if (filtro0_0.selection.text.indexOf("LOC") >= 0)//Effetto placebo
                                    //suffix_plus = "_LOC";
                                    if (filtro0_0.selection.text == "ISTITUZIONALE")
                                        suffix_plus = "_BFist";
                                    if (filtro0_0.selection.text == "EV" && obj.meccanica != "validita")
                                        suffix_plus = "_evento";

                                    try {

                                        var suffix_mxLOC = "";
                                        if (isMZLOC) {
                                            suffix_mxLOC = "_LOC";
                                        }

                                        //alert(getStileForField(obj.meccanica + suffix_plus, "Reparto_" + obj.descrizione.reparto, meta_meccanica)+suffix_mxLOC);
                                        var rp_parag = doc.paragraphStyles.itemByName(getStileForField(obj.meccanica + suffix_plus, "Reparto_" + obj.descrizione.reparto, meta_meccanica) + suffix_mxLOC);
                                        //alert(getStileForField(obj.meccanica+suffix_plus,"Reparto_"+obj.descrizione.reparto));                                     
                                        var rp_char = rp_parag.nestedStyles[0].appliedCharacterStyle;
                                        //alert(rp_char.name);
                                        for (var r = 0; r < pItem.contents.length; r++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                        {
                                            //pItem.characters[r].fillColor=obj.reparto_colore;
                                            pItem.characters[r].appliedCharacterStyle = rp_char;
                                        }

                                        pItem.paragraphs[0].appliedParagraphStyle = rp_parag;


                                        if (pz_rect_validita != null) {
                                            try {
                                                var str = pItem.contents + "\n";
                                                if (pz_rect_validita.contents == "")
                                                    str = pItem.contents;

                                                var inx = str.length;
                                                pz_rect_validita.contents = str + pz_rect_validita.contents;

                                                var charVSty = pz_rect_validita.characters[0].appliedCharacterStyle;

                                                for (var $v = 0; $v < pz_rect_validita.contents.length; $v++) {
                                                    if ($v < inx)
                                                        pz_rect_validita.characters[$v].appliedCharacterStyle = rp_char;
                                                    else
                                                        pz_rect_validita.characters[$v].appliedCharacterStyle = charVSty;
                                                }
                                            } catch (error) { alert(error); }
                                        }

                                        pz_reparto = pItem;

                                        //if (obj.meccanica.indexOf("_inostriori")<0)
                                        //{
                                        obj_da_cestinare.push(pItem);
                                        cimitero[pItem.label] = "ko";
                                        //}

                                    } catch (error) { alert("Error 1608 -  Stile  carattere " + rp_char + " o stile paragrafo " + rp_parag + " non trovato (" + (obj.meccanica + suffix_plus) + "  Reparto_" + obj.descrizione.reparto + ")"); }
                                }
                                else {
                                    obj_da_cestinare.push(pItem);
                                    cimitero[pItem.label] = "ko";
                                    cestinato = true;
                                }
                            }

                        }


                        //Da togliere. Serve solo per facilitare il controllo del dato
                        if (vecchio_nome_proprieta != "")
                            pItem.label = vecchio_nome_proprieta + "###" + nome_proprieta;

                    } catch (error) {
                        alert("1624. " + error + " su " + nome_proprieta);
                    }

                }


                if (!cestinato) {
                    for (var d = 0; d < meta_meccanica.azioni.length; d++) {
                        var item = meta_meccanica.azioni[d];
                        if (item.tipo == "del") {

                            for (var $d2 = 0; $d2 < item.campi.length; $d2++) {
                                var campo = item.campi[$d2];

                                var lab = pItem.label;
                                if (pItem.label.indexOf("###") > 0) {
                                    lab = lab.substring(0, pItem.label.indexOf("###"));
                                }

                                if (/*nome_proprieta*/lab == campo) {
                                    //alert("cestino " + pItem.label);
                                    obj_da_cestinare.push(pItem);
                                    cimitero[pItem.label] = "ko";
                                }
                            }
                            break;
                        }
                    }
                }

            }


            var logo_sed_bound = [0, 0, 0, 0];

            if (meta_meccanica.codice.indexOf("BOX40") < 0) {

                if (obj.logo_bassi_fissi != "" && filtro0_0.selection.text != "ISTITUZIONALE") {

                    try {
                        var bounds_rect = [g_new.geometricBounds[0] + 1, g_new.geometricBounds[1] + 1, g_new.geometricBounds[2] + 1, g_new.geometricBounds[3] + 1];
                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "margherita_BeF";
                        g_new_all.push(rect);

                        var obj_file = File(doc.filePath + "/foto/" + obj.logo_bassi_fissi);
                        rect.place(obj_file);
                        rect.fillColor = "None";
                        //rect.label="boll";
                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                if (obj.logo_attributo_it != null && obj.logo_attributo_it != "") {
                    try {

                        //var bounds_rect=[g_new.pageItems[$xa].geometricBounds[0], g_new.pageItems[$xa].geometricBounds[1] + 43.878, g_new.pageItems[$xa].geometricBounds[0]+11.599, g_new.pageItems[$xa].geometricBounds[1]+ 43.878+20.997];
                        var pos = [g_new.geometricBounds[1] + 10, g_new.geometricBounds[0] + 10];


                        if (sy_attributo_it != null) {
                            //var sy = sy_attributo_it.duplicate(pos);
                            var sy = sy_attributo_it.duplicate(myPage);
                            sy.move(doc.layers.itemByName("InPagina"));
                            sy.move(pos);
                            sy.label = "logo";
                            sy.textFrames[0].contents = obj.logo_attributo_it.replace("<br>", "\n");
                            g_new_all.push(sy);

                            sy.bringToFront();
                        }

                    }
                    catch (error) {
                        //Dovrei mettere no_foto   
                        alert("IDMS ERROR " + error.message);
                    }

                }

                //Metto la testata CONAD se è un prodotto conad
                if (obj.prodotto_conad != null && obj.prodotto_conad != "" && filtro0_0.selection.text != "ISTITUZIONALE") {
                    try {
                        //Le misure sono da considerarsi in millimetri

                        var x_offset = 0;
                        var y_offset = 0;
                        var w_offset = 20.997;
                        var h_offset = 11.599;

                        if (obj.prodotto_conad == "logo" /*|| obj.prodotto_conad=="bio"*/) {
                            w_offset = 21.378;
                            h_offset = 4.487;
                        }
                        else if (obj.prodotto_conad == "cpq") {
                            w_offset = 38.566;
                            h_offset = 6.562;
                        }
                        else if (obj.prodotto_conad == "kids") {
                            w_offset = 16.087;
                            h_offset = 14.647;

                        }
                        else if (obj.prodotto_conad == "piacersi") {
                            //w_offset = 20.997;//27.263;
                            h_offset = 10.245;//13.293;

                        }
                        else if (obj.prodotto_conad == "aslattosio") {
                            w_offset = 21.421;
                            h_offset = 9.779;
                        }
                        else if (obj.prodotto_conad.indexOf("saporidintorni") >= 0 || obj.prodotto_conad.indexOf("saporiidee") >= 0) {
                            w_offset = 14.139;
                            h_offset = 16.764;//11.599;
                        }
                        /*else if (obj.prodotto_conad == "vnbio") {
                            w_offset = 18.711;
                            h_offset = 12.446;
                        }
                        else if (obj.prodotto_conad == "vneco") {
                            w_offset = 18.881;
                            h_offset = 12.446;
                        }
                        else if (obj.prodotto_conad == "vnequo") {
                            w_offset = 21.59;
                            h_offset = 12.446;                    
                        }
                        else if (obj.prodotto_conad == "vnveg") {
                            w_offset = 19.219;
                            h_offset = 12.446;
                        }*/
                        else if (obj.prodotto_conad == "vn") {
                            w_offset = 18.542;
                            h_offset = 12.446;
                        }
                        else if (obj.prodotto_conad == "parafarmacia") {
                            w_offset = 22.987;
                            h_offset = 5.165;
                        }
                        else if (obj.prodotto_conad == "11p") {
                            w_offset = 12.615;
                            h_offset = 13.547;
                        }
                        else if (obj.prodotto_conad == "baby") {
                            w_offset = 12.192;
                            h_offset = 9.737;
                        }
                        else if (obj.prodotto_conad == "essentiae") {
                            w_offset = 22.987;
                            h_offset = 8.467;
                        }
                        else if (obj.prodotto_conad.indexOf("petfr") >= 0) {
                            w_offset = 21.421;
                            h_offset = 10.837;
                        }




                        var y = g_new.geometricBounds[0] + 1;//(obj.meccanica.indexOf("_FID") < 0 ? 1 : 10);
                        var x = g_new.geometricBounds[1] + (g_new.geometricBounds[3] - g_new.geometricBounds[1] - w_offset - 1);
                        var h = y + h_offset;
                        var w = x + w_offset

                        bounds_rect2 = [y, x, h, w];


                        if (pz_lbl_titolari != null) {

                            if (titolo_promo.indexOf("_SC_") > 0) {
                                if (obj.prodotto_conad == "cpq") {
                                    w_offset = 22.987;
                                    h_offset = 3.911;

                                    y = g_new.geometricBounds[0] + 1;//(obj.meccanica.indexOf("_FID") < 0 ? 1 : 10);
                                    x = g_new.geometricBounds[1] + (g_new.geometricBounds[3] - g_new.geometricBounds[1] - w_offset - 1);
                                    h = y + h_offset;
                                    w = x + w_offset;

                                    bounds_rect2 = [y, x, h, w];
                                    //alert(bounds_rect2);
                                }

                                //alert(pz_lbl_titolari.groups.length);
                                var carte_titolo = pz_lbl_titolari.pageItems[0];
                                var rect = pz_lbl_titolari.pageItems[1];
                                if (carte_titolo.label == "Titolari_fascia") {
                                    carte_titolo = pz_lbl_titolari.pageItems[1];
                                    rect = pz_lbl_titolari.pageItems[0];
                                }



                                //alert("Muovo " + rect.label + " da " + [rect.geometricBounds[1], rect.geometricBounds[0]] + " a " + [rect.geometricBounds[1] - w_offset - 3, rect.geometricBounds[0]] + " w_offset="+w_offset );
                                rect.move([rect.geometricBounds[1] - 25, rect.geometricBounds[0]]);


                                var w_lbl = (g_new.geometricBounds[3] - g_new.geometricBounds[1]) - 25;
                                var w_carte = carte_titolo.geometricBounds[3] - carte_titolo.geometricBounds[1];

                                //alert("Muovo " + carte_titolo.label + " da " + [carte_titolo.geometricBounds[1], carte_titolo.geometricBounds[0]] + " a " + [g_new.geometricBounds[1] + ((w_lbl - w_carte) / 2), carte_titolo.geometricBounds[0]]);
                                carte_titolo.move([g_new.geometricBounds[1] + ((w_lbl - w_carte) / 2), carte_titolo.geometricBounds[0]]);
                            }
                            else {
                                y = g_new.geometricBounds[0] + (obj.meccanica.indexOf("_FID") < 0 ? 1 : 10);
                                x = g_new.geometricBounds[1] + (g_new.geometricBounds[3] - g_new.geometricBounds[1] - w_offset - 1);
                                h = y + h_offset;
                                w = x + w_offset;

                                bounds_rect2 = [y, x, h, w];
                                //alert(bounds_rect2);

                            }

                        }

                        var rect2 = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect2 })
                        rect2.label = "logo";

                        if (obj.prodotto_conad == "saporidintorni" || obj.prodotto_conad == "saporiidee")
                            logo_sed_bound = rect2.geometricBounds;

                        g_new_all.push(rect2);

                        var obj_file_conad = File(doc.filePath + "/foto/conad_" + obj.prodotto_conad + ".psd");
                        rect2.place(obj_file_conad);
                        rect2.fillColor = "None";
                        //rect2.label="boll";
                        if (obj.prodotto_conad != "cpq" || pz_lbl_titolari == null)
                            rect2.fit(FitOptions.FRAME_TO_CONTENT);
                        else
                            rect2.fit(FitOptions.CONTENT_TO_FRAME);

                        if (meta_meccanica.codice == "BOX2" || meta_meccanica.codice == "BOX62") {
                            loghiPerPosizionamentoInBoxOri.push(rect2);
                        }


                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                    //rect2.fit(FitOptions.PROPORTIONALLY);                        
                }

                if (obj.logo_carne != "" && filtro0_0.selection.text != "ISTITUZIONALE") {
                    var loghi_carne = obj.logo_carne.split(",");
                    var xy_off = 0;
                    for (var $lc = 0; $lc < loghi_carne.length; $lc++) {
                        try {
                            var bounds_rect = [g_new.geometricBounds[0] + xy_off, g_new.geometricBounds[1] + xy_off, g_new.geometricBounds[2] + xy_off, g_new.geometricBounds[3] + xy_off];

                            if (loghi_carne[$lc].indexOf("Chianina") >= 0)
                                bounds_rect = [logo_sed_bound[0], logo_sed_bound[1] - 14.986 - 1, logo_sed_bound[0] + 14.647, logo_sed_bound[1] - 1];

                            //if (loghi_carne[$lc].indexOf("filiera")>=0)
                            //bounds_rect = [bounds_rect[0], bounds_rect[1]-37.592-1, bounds_rect[0]+4.995, bounds_rect[1]-1];

                            var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                            rect.label = "logo";
                            g_new_all.push(rect);

                            var obj_file = File(doc.filePath + "/foto/" + loghi_carne[$lc] + ".psd");
                            rect.place(obj_file);
                            rect.fillColor = "None";
                            rect.fit(FitOptions.FRAME_TO_CONTENT);

                            xy_off += 2;

                        } catch (error) { }
                    }
                }

                //if ((obj.distintivita.toLowerCase().indexOf("inostriori")>=0 || isMZLOC) && obj.meccanica!="solo_descr")
                if ((obj.distintivita.toLowerCase().indexOf("inostriori") >= 0 || obj.distintivita.toLowerCase().indexOf("territorio") >= 0) && obj.meccanica != "solo_descr") {

                    var bounds_rect = [g_new.geometricBounds[0] + 1, g_new.geometricBounds[3] - 1 - 14.5, g_new.geometricBounds[0] + 1 + 14.5, g_new.geometricBounds[3] - 1];


                    if (isMZLOC) {
                        bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[3] - 14.5, g_new.geometricBounds[0] + 14.5, g_new.geometricBounds[3]];
                        //alert(bounds_rect);
                    }
                    else {
                        //Dobbiamo piazzare il logo INOSTRIORI
                        if (pz_lbl_titolari != null) {
                            bounds_rect = [bounds_rect[0] + (obj.meccanica.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[1], bounds_rect[2] + (obj.meccanica.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[3]];
                        }
                    }

                    //alert(bounds_rect);

                    var potenziale_dettaglio_errore = "";
                    try {

                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "logo_ori";
                        g_new_all.push(rect);

                        var obj_file = null;
                        if (obj.distintivita.toLowerCase().indexOf("inostriori") >= 0) {
                            //alert(nome_origine_xml);
                            obj_file = File(doc.filePath + "/foto/" + obj.distintivita + ".psd");

                        }
                        else {
                            //?????
                            //obj_file = File(doc.filePath + "/foto/" + obj.distintivita+ ".psd");
                        }



                        //alert(isMZLOC);
                        if (obj.distintivita.toLowerCase().indexOf("inostriori") < 0) {
                            //if (obj.prodotto_conad == "")
                            if (obj.distintivita.toLowerCase().indexOf("territorio") >= 0) {
                                //Logo Territorio / No inostriori


                                // if (nome_origine_xml.indexOf("_SP_")>=0)
                                // {

                                // }
                                // else
                                // {

                                var suffix_LOC = "LOC_";
                                var suffix_LOC_default = "LOC_";
                                if (!isMZLOC) {
                                    suffix_LOC = "VOL_";
                                    suffix_LOC_default = "VOL_";
                                }

                                obj_file = File(doc.filePath + "/foto/TERRITORIO.psd");
                                rect.place(obj_file);
                                rect.fillColor = "None";
                                rect.fit(FitOptions.FRAME_TO_CONTENT);

                                // rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default+"territorio_GENERICO").currentVisibility=false;
                                // rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC+).currentVisibility=true;

                                //alert(nome_origine_xml);

                                if (/*nome_origine_xml.indexOf("_TO_")>=0 && */nome_origine_xml.indexOf("_SP_") >= 0) {
                                    //Rimane default
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_generico").currentVisibility = true;
                                }
                                else if (/*nome_origine_xml.indexOf("_PI_")>=0 &&*/ nome_origine_xml.indexOf("_AO_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_AOSTA").currentVisibility = true;
                                }
                                else if (nome_origine_xml.indexOf("_TO_") >= 0) {
                                    //alert("Abilito " + suffix_LOC+"territorio_TO");
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_TO").currentVisibility = true;
                                    //alert(rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC+"territorio_TO"));
                                }
                                else if (nome_origine_xml.indexOf("_PI_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_PI").currentVisibility = true;
                                }
                                else if (nome_origine_xml.indexOf("_SA_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_SA").currentVisibility = true;
                                }
                                else if (nome_origine_xml.indexOf("_LA_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LA").currentVisibility = true;
                                }
                                else if (nome_origine_xml.indexOf("_EM_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_EM").currentVisibility = true;
                                }
                                else if (nome_origine_xml.indexOf("_LI_") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LI").currentVisibility = true;
                                }
                                //}
                            }
                        }
                        else {
                            //alert(doc.filePath + "/foto/" + obj.distintivita+ ".psd");
                            obj_file = File(doc.filePath + "/foto/" + obj.distintivita + ".psd");
                            if (nome_origine_xml.indexOf("_SP.") >= 0 || nome_origine_xml.indexOf("_SP_") >= 0) {
                                obj_file = File(doc.filePath + "/foto/INOSTRIORI_generico.psd");
                            }
                            else if (nome_origine_xml.indexOf("_AOSTA.") >= 0 || nome_origine_xml.indexOf("_AOSTA_") >= 0) {
                                obj_file = File(doc.filePath + "/foto/INOSTRIORI_AOSTA.psd");
                            }

                            rect.place(obj_file);
                            rect.fillColor = "None";
                            rect.fit(FitOptions.FRAME_TO_CONTENT);

                            if (isMZLOC) {
                                if (nome_origine_xml.indexOf("_TO_") >= 0 && (nome_origine_xml.indexOf("_SP_") >= 0 || nome_origine_xml.indexOf("_SP.") >= 0)) {
                                    obj_file = File(doc.filePath + "/foto/INOSTRIORI_generico.psd");

                                    //alert("Metto il generico?");

                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico").currentVisibility = false;
                                    if (obj.descrizione.reparto == "31") {
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico_PESCE").currentVisibility = true;
                                    }
                                    else {
                                        //alert("Metto " + "LOC_" + obj.distintivita);
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = true;
                                    }

                                }
                                else if (nome_origine_xml.indexOf("_PI_") >= 0 && nome_origine_xml.indexOf("_AOSTA") >= 0) {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = false;
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_AOSTA").currentVisibility = true;
                                }
                                else {
                                    rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_" + obj.distintivita).currentVisibility = false;
                                    if (obj.descrizione.reparto == "31") {
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_" + obj.distintivita + "_PESCE").currentVisibility = true;
                                    }
                                    else {
                                        //alert("Metto " + "LOC_" + obj.distintivita);
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("LOC_" + obj.distintivita).currentVisibility = true;
                                    }
                                }
                            }
                            else {
                                if (obj.descrizione.reparto == "31") {

                                    if (nome_origine_xml.indexOf("_TO_") >= 0 && (nome_origine_xml.indexOf("_SP_") >= 0 || nome_origine_xml.indexOf("_SP.") >= 0)) {

                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico_PESCE").currentVisibility = true;
                                    }
                                    else if (nome_origine_xml.indexOf("_PI_") >= 0 && nome_origine_xml.indexOf("_AOSTA") >= 0) {
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_AOSTA").currentVisibility = true;
                                    }
                                    else {
                                        potenziale_dettaglio_errore = "LAYER VOL_" + obj.distintivita + "_PESCE non trovato nel logo " + obj.distintivita + ".psd";

                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_" + obj.distintivita).currentVisibility = false;
                                        rect.graphics[0].graphicLayerOptions.graphicLayers.itemByName("VOL_" + obj.distintivita + "_PESCE").currentVisibility = true;
                                    }


                                }




                            }


                        }

                        pzLogoOri = rect;

                    }
                    catch (error) {
                        if (potenziale_dettaglio_errore != "") {
                            alert(potenziale_dettaglio_errore);
                        }
                        else {
                            alert(error);
                        }
                    }
                }

                //alert("post logo ORI");

                // if (meta_meccanica.codice.indexOf("BOX41")<0)
                // {                

                if (obj.da_controllare == "True") {

                    try {
                        var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "logo";
                        g_new_all.push(rect);

                        var obj_file = File(doc.filePath + "/foto/da_controllare.psd");
                        rect.place(obj_file);
                        rect.fillColor = "None";
                        //rect.label="boll";
                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                if (obj.selezione_conad == "True" && filtro0_0.selection.text != "ISTITUZIONALE") {

                    try {
                        var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "logo";
                        g_new_all.push(rect);

                        var obj_file = File(doc.filePath + "/foto/logo_selezione.psd");
                        rect.place(obj_file);
                        rect.fillColor = "None";
                        //rect.label="boll";
                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                if (obj.logo_ori != "" && filtro0_0.selection.text != "ISTITUZIONALE") {

                    try {
                        var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "logo";
                        g_new_all.push(rect);

                        var obj_file = File(doc.filePath + "/foto/Logo_ORI" + obj.logo_ori + ".psd");
                        rect.place(obj_file);
                        rect.fillColor = "None";
                        //rect.label="boll";
                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                if (obj.logo_intv != "" && filtro0_0.selection.text != "ISTITUZIONALE") {

                    try {
                        var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                        rect.label = "logo";
                        g_new_all.push(rect);

                        var obj_file = File(doc.filePath + "/foto/" + obj.logo_intv + ".psd");
                        rect.place(obj_file);
                        rect.fillColor = "None";
                        rect.fit(FitOptions.FRAME_TO_CONTENT);
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                        //alert("in tv error: " + error);
                    }
                }

                if (obj.logo_pesce != "" && filtro0_0.selection.text != "ISTITUZIONALE") {

                    var loghi_pesce = obj.logo_pesce.split(",");
                    var xy_off = 0;
                    for (var $lp = 0; $lp < loghi_pesce.length; $lp++) {
                        try {
                            var bounds_rect = [g_new.geometricBounds[0] + xy_off, g_new.geometricBounds[1] + xy_off, g_new.geometricBounds[2] + xy_off, g_new.geometricBounds[3] + xy_off];
                            var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
                            rect.label = "logo";
                            g_new_all.push(rect);

                            var obj_file = File(doc.filePath + "/foto/" + loghi_pesce[$lp] + ".psd");
                            rect.place(obj_file);
                            rect.fillColor = "None";
                            rect.fit(FitOptions.FRAME_TO_CONTENT);

                            xy_off += 2;

                        } catch (error) { }
                    }
                }
                // }
            }

            if (obj.note != null && obj.note != "") {
                var gb = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0] + hBOX_mastro, g_new.geometricBounds[1] + wBOX_mastro];

                var txt_note = myPage.textFrames.add(doc.layers.itemByName("NOTE"), LocationOptions.UNKNOWN, g_new, { geometricBounds: gb });

                var str_note = obj.note.toString();

                while (true) {
                    if (str_note.indexOf("<br>") >= 0) {
                        str_note = str_note.replace("<br>", "\n");
                    }
                    else {
                        break;
                    }

                }

                txt_note.contents = str_note;//obj.note.toString().replace("<br>","\n");
            }

            if (obj.nota_category != null && obj.nota_category != "") {

                var diff_x = wBOX - wBOX_mastro;
                var diff_y = hBOX - hBOX_mastro;

                var myh = hBOX_mastro;//g_new.geometricBounds[2] - g_new.geometricBounds[0];
                //var mycoord = [g_new.geometricBounds[0]+(myh/2), g_new.geometricBounds[1], g_new.geometricBounds[2]-diff_y, g_new.geometricBounds[3]-diff_x];
                var mycoord = [g_new.geometricBounds[0] + (myh / 2), g_new.geometricBounds[1], g_new.geometricBounds[0] + (myh / 2) + (hBOX_mastro / 2), g_new.geometricBounds[1] + wBOX_mastro];

                var txt_nota_category = myPage.textFrames.add(doc.layers.itemByName("NOTE_CATEGORY"), LocationOptions.UNKNOWN, g_new, { geometricBounds: mycoord });

                var str_note = obj.nota_category.toString();
                while (true) {
                    if (str_note.indexOf("<br>") >= 0) {
                        str_note = str_note.replace("<br>", "\n");
                    }
                    else {
                        break;
                    }

                }

                txt_nota_category.contents = str_note;//obj.note.toString().replace("<br>","\n");
            }

            if (obj.sez_data != null && obj.sez_data != "") {
                var gb = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0] + hBOX_mastro, g_new.geometricBounds[1] + wBOX_mastro];
                var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZ_DATA"), LocationOptions.UNKNOWN, g_new, { geometricBounds: gb });
                txt_data.contents = obj.sez_data;
                try {
                    for (var $c = 0; $c < txt_data.contents.length; $c++)
                        txt_data.characters[$c].appliedCharacterStyle = "SEZ_DATA";
                } catch (error) { }
            }

            //alert(obj.sezione);
            if (obj.sezione != null && obj.sezione != "") {

                if (doc.layers.itemByName("SEZIONE_VOL") == null) {
                    //alert("creo layer");
                    doc.layers.add({ name: "SEZIONE_VOL" });
                    doc.layers.itemByName("SEZIONE_VOL").move(LocationOptions.AFTER, doc.layers.itemByName("NOTE_CATEGORY"));
                }
                else {
                    //alert(doc.layers.itemByName("SEZIONE_VOL"));
                }

                var gb = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0] + hBOX_mastro, g_new.geometricBounds[1] + wBOX_mastro];
                var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZIONE_VOL"), LocationOptions.UNKNOWN, g_new, { geometricBounds: gb });
                txt_data.contents = obj.sezione;
                try {
                    for (var $c = 0; $c < txt_data.contents.length; $c++)
                        txt_data.characters[$c].appliedCharacterStyle = "SEZIONE_VOL";
                } catch (error) { }
            }

            var offset_boll = [0, 0];

            if (obj.corretto_edro21 == "true") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_CORRETTO_EDRO21.psd");
                    rect.place(obj_file);
                    rect.fillColor = "None";
                    rect.label = "boll";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                }
                catch (error) {
                    //Dovrei mettere no_foto
                    //alert("errore corretto da edro " + error);
                }
            }

            if (meta_meccanica.isInvalida && obj.meccanica != "solo_descr") {
                //metto il logo
                try {
                    var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                    if (obj.corretto_edro21 == "true")
                        bounds_rect = [g_new.geometricBounds[0] + 14.99, g_new.geometricBounds[1], g_new.geometricBounds[2] + 14.99, g_new.geometricBounds[3]];

                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_Vedi_Lista.psd");
                    rect.place(obj_file);
                    rect.fillColor = "None";
                    rect.label = "boll";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                }
                catch (error) {
                    //Dovrei mettere no_foto
                }
            }

            if (obj.boll_distintivita != "") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/" + obj.boll_distintivita + ".psd");
                    rect.place(obj_file);
                    rect.label = "boll";
                    rect.fillColor = "None";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                }
                catch (error) { }
            }

            if (obj.boll_ruolo != "") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];

                    //STAR , VEDETTE
                    var lay = doc.layers.itemByName("bollini");
                    if (obj.boll_ruolo.indexOf("STAR") >= 0 || obj.boll_ruolo.indexOf("VEDETTE") >= 0)
                        lay = doc.layers.itemByName("Bollini IMP");

                    var rect = myPage.rectangles.add(lay, LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/" + obj.boll_ruolo + ".psd");
                    rect.place(obj_file);
                    rect.label = "boll";
                    rect.fillColor = "None";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                }
                catch (error) { }
            }

            if (obj.noPunti_daConad == "true") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_NOPUNTI_DACONAD.psd");
                    rect.place(obj_file);
                    rect.label = "boll";
                    rect.fillColor = "None";

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                }
                catch (error) {
                    //Dovrei mettere no_foto
                }
            }

            if (obj.etto_lista_diverso == "true") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_ETTO_lista_DIVERSO.psd");
                    rect.place(obj_file);
                    rect.label = "boll";
                    rect.fillColor = "None";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                }
                catch (error) {
                    //Dovrei mettere no_foto
                }
            }

            if (obj.no_esempio == "true") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_ESEMPIO_NONnecessario.psd");
                    rect.place(obj_file);
                    rect.label = "boll";
                    rect.fillColor = "None";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                }
                catch (error) {
                    //Dovrei mettere no_foto
                }
            }

            if (obj.mg_nofidelity == "true") {
                try {
                    var bounds_rect = [g_new.geometricBounds[0] + offset_boll[0], g_new.geometricBounds[1] + offset_boll[1], g_new.geometricBounds[2] + offset_boll[0], g_new.geometricBounds[3] + offset_boll[1]];
                    var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })

                    var obj_file = File(doc.filePath + "/foto/boll_MG_NoFIDELITY.psd");
                    rect.place(obj_file);
                    rect.fillColor = "None";
                    rect.label = "boll";
                    rect.fit(FitOptions.FRAME_TO_CONTENT);

                    offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                }
                catch (error) {
                    //Dovrei mettere no_foto
                }
            }

            //Inserisco il testo di errore se ci sono stati errori
            if (string_error != "") {
                var gb = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0] + hBOX_mastro, g_new.geometricBounds[1] + wBOX_mastro];

                //alert("ho trovato degli errori : " + string_error);
                var txt_error = myPage.textFrames.add(doc.layers.itemByName("InPagina - Errori"), LocationOptions.UNKNOWN, g_new, { geometricBounds: gb });
                txt_error.contents = string_error;
                var sty_error = getStileForField(obj.meccanica, "errore", meta_meccanica);
            }


            try {
                //alert("COD.");
                //Scrivo la nota con codice referenza
                var gb = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[0] + hBOX_mastro, g_new.geometricBounds[1] + wBOX_mastro];

                var txt_cod_ref = myPage.textFrames.add(doc.layers.itemByName("CODICE REF"), LocationOptions.UNKNOWN, g_new, { geometricBounds: gb });
                txt_cod_ref.contents = obj.codice;
            }
            catch (error) {
                //Dovrei mettere no_foto
            }

            var tot_da_cestinare = obj_da_cestinare.length;
            for (var $d = (tot_da_cestinare - 1); $d >= 0; $d--) {
                try {
                    if (obj_da_cestinare[$d].label == "prezzo_offerta_gruppo") {
                        pz_prezzo_offerta = null;
                        pz_prezzo_offerta_etto = null;
                    }
                    else if (obj_da_cestinare[$d].label == "boxDescrPrezzi_ORI_TERRITORIO") {
                        pz_boxDescrPrezzi_ORI_TERRITORIO = null;
                    }
                    obj_da_cestinare[$d].remove();

                } catch (error) { }
            }

            //alert("Post cestino");

            if (pz_rect_regionale != null) {
                try {

                    //alert("PRIMA");
                    var newy = pz_rect_regionale.geometricBounds[0];

                    if (titolo_promo.indexOf("_SC_") > 0 && cimitero["PIEDE_Titolari"] != null) {
                        if (pz_offerta != null && meta_meccanica.codice == "BOX12_SC") {
                            pz_offerta.geometricBounds = [pz_offerta.geometricBounds[0] - 2, pz_offerta.geometricBounds[1], pz_offerta.geometricBounds[2] - 2, pz_offerta.geometricBounds[3]];
                        }
                        if (pz_kgl_sconto != null && meta_meccanica.codice == "BOX12_SC") {
                            pz_kgl_sconto.geometricBounds = [pz_kgl_sconto.geometricBounds[0] - 2, pz_kgl_sconto.geometricBounds[1], pz_kgl_sconto.geometricBounds[2] - 2, pz_kgl_sconto.geometricBounds[3]];
                        }
                        if (pz_sconto_piccolo != null && meta_meccanica.codice == "BOX12_SC") {
                            pz_sconto_piccolo.geometricBounds = [pz_sconto_piccolo.geometricBounds[0] - 2, pz_sconto_piccolo.geometricBounds[1], pz_sconto_piccolo.geometricBounds[2] - 2, pz_sconto_piccolo.geometricBounds[3]];
                        }
                    }

                    //alert("step1");

                    if (pz_offerta != null) {
                        newy = pz_offerta.geometricBounds[0];
                    }
                    if (titolo_promo.indexOf("_SC_") < 0) {
                        if (pz_anziche != null) {
                            //alert("pronto????? " + pz_anziche.label);
                            //if (pz_anziche.label.indexOf("campo_offerta")=>0)
                            newy = pz_anziche.geometricBounds[0];
                            //alert(newy);
                        }
                        else if (pz_sconto_grande != null &&
                            (pz_alletto != null || obj.meccanica.indexOf("_regionale") > 0 || obj.meccanica.indexOf("_bdp") > 0 || obj.meccanica.indexOf("_sdb") > 0)) {
                            newy = pz_sconto_grande.geometricBounds[0];

                        }
                    }
                    else if (isMZLOC && titolo_promo.indexOf("_SC_") >= 0) {
                        //Il box deve coprire anche il campo sconto se presente
                        if (pz_anziche != null) {
                            newy = pz_anziche.geometricBounds[0];
                        }
                        else if (pz_sconto_grande != null) {
                            newy = pz_sconto_grande.geometricBounds[0];
                        }
                    }


                    if (titolo_promo.indexOf("_SC_") > 0 && meta_meccanica.codice != "BOX12_SC") {
                        //newy -= 2;
                    }


                    //Devo sistemare anche l'allinemaneto a sinistra
                    var leader_offset = 1000000;
                    if (pz_kgl_sconto != null && pz_kgl_sconto.visible) {
                        leader_offset = pz_kgl_sconto.characters[0].horizontalOffset;
                    }
                    if (pz_offerta != null && pz_offerta.visible) {
                        var score = 0;
                        if (pz_offerta.label == "prezzo_offerta_gruppo") {
                            if (pz_offerta.allPageItems.length > 1)
                                score = pz_offerta.allPageItems[1].characters[0].horizontalOffset;
                            else
                                score = pz_offerta.allPageItems[0].characters[0].horizontalOffset;
                        }
                        else {
                            score = pz_offerta.characters[0].horizontalOffset;
                        }

                        if (leader_offset > score) {
                            leader_offset = score;
                        }
                    }

                    if (pz_sconto_meno != null) {
                        if (leader_offset > pz_sconto_meno.characters[0].horizontalOffset) {
                            leader_offset = pz_sconto_meno.characters[0].horizontalOffset;
                        }
                    }


                    if (pz_alletto != null) {

                        var offset = newy - pz_rect_regionale.geometricBounds[0];

                        var adj = 0;
                        if ((pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) > (pz_rect_regionale.geometricBounds[2] - newy))
                            adj = (pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) - (pz_rect_regionale.geometricBounds[2] - newy);

                        pz_alletto.geometricBounds = [
                            pz_alletto.geometricBounds[0] + offset,
                            pz_alletto.geometricBounds[1],
                            pz_alletto.geometricBounds[2] + offset - adj,
                            pz_alletto.geometricBounds[3]
                        ];

                        //if (pz_sconto_grande!=null && 
                        //(obj.meccanica.indexOf("_regionale")>0 || obj.meccanica.indexOf("_bdp")>0 || obj.meccanica.indexOf("_sdb")>0))
                        //{
                        if (pz_sconto_grande != null) {
                            var offset_sconto_grande = (pz_sconto_grande.geometricBounds[2] - pz_sconto_grande.geometricBounds[0]);
                            offset += offset_sconto_grande;
                        }

                        pz_alletto.geometricBounds = [
                            newy,
                            pz_alletto.geometricBounds[1],
                            g_new.geometricBounds[2],
                            pz_alletto.geometricBounds[3]
                        ];


                        if (pz_alletto.overflows) {
                            pz_alletto.textFramePreferences.insetSpacing = [pz_alletto.textFramePreferences.insetSpacing[0],
                                0.5,
                            pz_alletto.textFramePreferences.insetSpacing[2],
                            pz_alletto.textFramePreferences.insetSpacing[3]];

                            //alert(pz_alletto.textFramePreferences.insetSpacing);
                        }
                        //}

                    }

                    //alert("step2");

                    var off_x = pz_rect_regionale.geometricBounds[1];
                    if (leader_offset != 1000000) {
                        off_x = leader_offset - 1.5;
                    }

                    var newy_bottom = pz_rect_regionale.geometricBounds[2];
                    if (cimitero["PIEDE_Titolari"] != null)
                        newy_bottom = pz_base.geometricBounds[2] - 2;

                    pz_rect_regionale.geometricBounds = [
                        newy,
                        off_x,
                        newy_bottom,
                        pz_rect_regionale.geometricBounds[3]
                    ];

                    //alert("step3");

                    if (titolo_promo.indexOf("_SC_") > 0 && (cimitero["PIEDE_Titolari"] != null || meta_meccanica.codice != "BOX12_SC")) {
                        if (meta_meccanica.codice == "BOX12_SC") {
                            if (gd != null) {
                                gd.geometricBounds = [gd.geometricBounds[0] - 2, gd.geometricBounds[1], gd.geometricBounds[2] - 2, gd.geometricBounds[3]];
                            }
                            if (pz_sconto_grande != null) {
                                pz_sconto_grande.geometricBounds = [pz_sconto_grande.geometricBounds[0] - 2, pz_sconto_grande.geometricBounds[1], pz_sconto_grande.geometricBounds[2] - 2, pz_sconto_grande.geometricBounds[3]];
                            }
                            if (pz_anziche != null) {
                                pz_anziche.geometricBounds = [pz_anziche.geometricBounds[0] - 2, pz_anziche.geometricBounds[1], pz_anziche.geometricBounds[2] - 2, pz_anziche.geometricBounds[3]];
                            }
                        }
                        //alert("step4");

                        if (pz_blocco_allineamenti != null && meta_meccanica.codice == "BOX6_SC") {
                            if (obj.meccanica.indexOf("bdp") > 0 || obj.meccanica.indexOf("sdb") > 0) {
                                pz_blocco_allineamenti.move([pz_blocco_allineamenti.geometricBounds[1], pz_blocco_allineamenti.geometricBounds[0] - 2]);
                            }
                        }
                    }



                } catch (error) {

                }
            }




            if (pz_rect_DescrPrezziORI != null) {
                if (livelli_meccanica.length > 0) {
                    var lastItem = livelli_meccanica[livelli_meccanica.length - 1];
                    var bLast = lastItem.geometricBounds;
                    pz_rect_DescrPrezziORI.geometricBounds = [pz_rect_DescrPrezziORI.geometricBounds[0], pz_rect_DescrPrezziORI.geometricBounds[1], lastItem.geometricBounds[2] + 1, pz_rect_DescrPrezziORI.geometricBounds[3]];
                }

            }

            var masterGroup = g_new;

            if (g_new_all.length > 0) {
                g_new_all.push(g_new);
                masterGroup = myPage.groups.add(g_new_all);
                masterGroup.name = g_new.name;
                masterGroup.label = g_new.label;

                g_new.label = "";
            }

            //alert(obj.meccanica + ","+meta_meccanica);

            //alert("post gruppo");

            /*if (obj.codice=="5902815")
            {
                alert("Dim\n" + "H " + hBOX_mastro + "-"+ hBOX + "\n" + "W " + wBOX_mastro + "-"+ wBOX + "\nmastro=" + obj.mastro);
            }*/
            //Adesso avviene il ridimensionamento

            // 
            // var wBOXCheck =   g_new.visibleBounds[3]-g_new.visibleBounds[1];
            // alert(wBOXCheck);

            //alert(pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds);

            //alert((masterGroup.geometricBounds[3]-masterGroup.geometricBounds[1]));

            //alert("pre redim");

            //
            var gap_y_descrTerr_baseTerr = 0;
            if (pz_boxDescrPrezzi_ORI_TERRITORIO != null) {
                if (pzLogoOri == null) {
                    if (pz_base_territorio != null && pz_base_territorio.isValid) {
                        gap_y_descrTerr_baseTerr = pz_base_territorio.geometricBounds[0] - pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0];
                    }
                }
            }

            //alert("gap: " + gap_y_descrTerr_baseTerr);


            var forceNO_RESIZE = false;
            if ((Math.abs(hBOX_mastro - hBOX) >= 0.5 || Math.abs(wBOX_mastro - wBOX) >= 0.5) && !forceNO_RESIZE)//hBOX_mastro<hBOX || wBOX_mastro<wBOX)
            {
                //alert("pre redim");
                //alert("STOP");
                //alert("ridimensionamento " + [Math.abs(hBOX_mastro - hBOX),Math.abs(wBOX_mastro - wBOX)])
                //alert("rid");
                //alert([hBOX,hBOX_mastro]);
                var diff_x = wBOX - wBOX_mastro;
                var diff_y = hBOX - hBOX_mastro;

                //alert(wBOX + " -  " + wBOX_mastro + " = " + diff_x);

                //alert([wBOX,wBOX_mastro]);
                //alert(diff_x);

                //alert([wBOX_mastro, hBOX_mastro, diff_x,diff_y]);
                //var is_nostriORI=obj.meccanica.indexOf("_inostriori")>=0;
                var is_nostriORI = (obj.meccanica.indexOf("_inostriori") >= 0 || obj.meccanica.indexOf("_territorio") >= 0);

                var anchor = "R";//Right
                if (gd != null) {
                    //alert([gd.geometricBounds[1],masterGroup.geometricBounds[1]]);
                    if (gd.geometricBounds[1] - masterGroup.geometricBounds[1] < 2) {
                        anchor = "L";//Left
                    }
                }
                if (is_nostriORI) {
                    anchor = "R";//Right
                }

                //alert(anchor);
                //alert(obj.meccanica);

                var startY = masterGroup.geometricBounds[0];
                var endY = masterGroup.geometricBounds[2];
                var startX = masterGroup.geometricBounds[1];
                var endX = masterGroup.geometricBounds[3];


                var pz_LBLCarte = null;

                for (var $gn = 0; $gn < masterGroup.allPageItems.length; $gn++) {
                    var it = masterGroup.allPageItems[$gn];
                    var bkpB = it.geometricBounds;



                    //alert(it.label);
                    // if (it.label=="boxDescrPrezzi_ORI_TERRITORIO")
                    // {
                    //     continue;
                    // }

                    // if (it.label=="logo_ori")
                    //     alert(it.geometricBounds);

                    if (it.label.indexOf("base") == 0 || (it.label == "descrizione" && (masterGroup.label.indexOf("validita") >= 0 || meta_meccanica.codice.indexOf("BOX14") >= 0 || meta_meccanica.codice.indexOf("BOX5") >= 0))) {

                        //alert(it.label);

                        if (it.label.indexOf("base") == 0) {
                            if (anchor == "R" && pz_boxDescrPrezzi_ORI_TERRITORIO == null)
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2], it.geometricBounds[3]];
                            else {
                                //alert((it.geometricBounds[3]-it.geometricBounds[1]));
                                //alert(diff_y);

                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2], it.geometricBounds[3] - diff_x];
                                //alert(it.geometricBounds);
                            }
                        }
                        else {
                            if (anchor == "R")
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2], it.geometricBounds[3]];
                            else {
                                if (meta_meccanica.codice.indexOf("BOX5") >= 0 && pz_kgl_sconto == null && pz_offerta != null) {
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2], pz_offerta.characters[0].horizontalOffset];
                                }
                                else if (meta_meccanica.codice.indexOf("BOX5") >= 0 && pz_kgl_sconto != null && pz_kgl_sconto.characters[0].horizontalOffset < it.geometricBounds[3]) {
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2], pz_kgl_sconto.characters[0].horizontalOffset];
                                }
                                else {
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2], it.geometricBounds[3] - diff_x];
                                }
                            }
                        }
                        if (it.label.indexOf("base") == 0) {
                            //alert(diff_y);
                            //alert("Base -> " + (it.geometricBounds[2]-it.geometricBounds[0]));
                        }
                    }
                    else if (it.label == "LBL_Titolari") {
                        if (anchor == "R")
                            it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1]/*+diff_x*/, it.geometricBounds[2] + diff_y, it.geometricBounds[3]];
                        else {
                            if (meta_meccanica.codice.indexOf("BOX5") >= 0) {
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] - diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];
                            }
                            else {
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2] + diff_y, it.geometricBounds[3]/*-diff_x*/];
                            }
                        }

                        it.groups[0].pageItems[0].fit(FitOptions.PROPORTIONALLY);
                        it.groups[0].pageItems[1].fit(FitOptions.PROPORTIONALLY);

                    }
                    else if (it.label == "logo_SDB" || it.label == "logo_BDP") {
                        var h = it.geometricBounds[2] - it.geometricBounds[0];
                        var w = it.geometricBounds[3] - it.geometricBounds[1];

                        if (anchor == "R")
                            it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3]];
                        else
                            it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];

                        var new_w = it.geometricBounds[3] - it.geometricBounds[1];
                        var new_h = (new_w * h) / w;
                        //alert(new_w+";"+new_h);
                        if (new_h != h) {
                            it.geometricBounds = [it.geometricBounds[0], it.geometricBounds[1], it.geometricBounds[2] - (h - new_h), it.geometricBounds[3]];
                        }


                    }
                    else if (it.label.indexOf("logo_inostriori") >= 0 || it.label == "boxDescrPrezziORI" || it.label == "logo_ori"/* || 
                (is_nostriORI && it.label.indexOf("descrizione")==0) || 
                (is_nostriORI && it.label.indexOf("campo_offerta")==0) || 
                (is_nostriORI && it.label.indexOf("sy_etto")==0) || 
                (is_nostriORI && it.label.indexOf("gruppo_sconto")==0) || 
                //(is_nostriORI && it.label.indexOf("sy_euro")==0) || 
                //(is_nostriORI && it.label=="prezzo_offerta") || 
                (is_nostriORI && it.label.indexOf("sconto_effettivo_grande")==0) || 
                (is_nostriORI && it.label.indexOf("campo_offerta_KgL_sconto")==0) ||
                (is_nostriORI && it.label.indexOf("gruppo_reparto")==0) ||
                (is_nostriORI && it.label.indexOf("prezzo_offerta_gruppo")==0) ||
                (is_nostriORI && it.label.indexOf("campo_offerta_KgL_sconto")==0)*/
                    ) {
                        //alert(it.label + " -> " + [diff_x,diff_y]);



                        if (it.label == "logo_ori") {
                            if (pz_boxDescrPrezzi_ORI_TERRITORIO != null) {
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] - diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];
                            }
                            else {
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2] + diff_y, it.geometricBounds[3]];
                            }

                            it.fit(FitOptions.PROPORTIONALLY);
                        }
                        else {
                            if (anchor == "R"/*&& it.label!="logo_ori"*/)
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] + diff_x];
                            else
                                it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] - diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];
                        }
                    }
                    else {
                        if (it.label == "immagine" || it.label == "immagine_secondaria") {
                            var diff_y_img = 0;
                            if (startY + diff_y > it.geometricBounds[0])
                                diff_y_img = (startY + diff_y) - it.geometricBounds[0];

                            //alert(diff_y_img);

                            //alert(anchor);

                            //alert(diff_x);

                            if (anchor == "R" && pz_boxDescrPrezzi_ORI_TERRITORIO == null)
                                it.geometricBounds = [it.geometricBounds[0] + diff_y_img, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y_img, it.geometricBounds[3] + diff_x];
                            else
                                it.geometricBounds = [it.geometricBounds[0] + diff_y_img, it.geometricBounds[1], it.geometricBounds[2] + diff_y_img, it.geometricBounds[3]];

                            it.fit(FitOptions.PROPORTIONALLY);

                            //alert("immagine spostata");
                            if (meta_meccanica.codice == "BOX14") {

                            }
                        }
                        else if (it.label == "logo" || it.label == "Logo" || it.label == "margherita_BeF") {
                            var offset_x = 0;
                            var offset_y = diff_y;

                            //alert("ridim logo");

                            if (it.geometricBounds[1] - startX < 5) {
                                if (anchor == "R") {
                                    //logo che parte dalla sinistra
                                    offset_x = diff_x;
                                }
                            }
                            if (endX - it.geometricBounds[3] < 5) {
                                if (anchor == "L") {
                                    //logo che parte dalla destra
                                    offset_x = diff_x * -1;
                                }
                            }

                            //alert("Ridmensiono logo " + [offset_x,offset_y]);
                            if (pz_boxDescrPrezzi_ORI_TERRITORIO != null && offset_x < 0) {
                                offset_x = 0;
                            }

                            //offset_y *= -1; 


                            it.geometricBounds = [it.geometricBounds[0] + offset_y, it.geometricBounds[1] + offset_x, it.geometricBounds[2] + offset_y, it.geometricBounds[3] + offset_x];
                            it.fit(FitOptions.PROPORTIONALLY);

                        }
                        else if (it.label.indexOf("parentesi") >= 0) {
                            if (it.label == "parentesi_BeF") {
                                //alert("diff x " + diff_x + " -> " + it.geometricBounds);
                                if (anchor == "R")
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3]];
                                else
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];

                                //alert("= " + it.geometricBounds);
                            }
                            it.fit(FitOptions.CONTENT_TO_FRAME);
                        }
                        else if (it.label.indexOf("Range_Punti_1_cornice_") >= 0) {
                            var h_rp = rp1.geometricBounds[2] - rp1.geometricBounds[0];
                            it.geometricBounds = [rp1.geometricBounds[0], it.geometricBounds[1], rp1.geometricBounds[2], it.geometricBounds[3]];
                        }
                        else if ((it.label.indexOf("range") >= 0 || it.label.indexOf("punti") >= 0)/*it.label.indexOf("Range_Punti_") >= 0*/ && meta_meccanica.codice.indexOf("BOX14") >= 0) {
                            //alert("Qui entro: " + it.label)
                            var my_diff_y = 0;
                            if (startY + diff_y > it.geometricBounds[0])
                                my_diff_y = (startY + diff_y) - it.geometricBounds[0];

                            //alert([my_diff_y,diff_x]);

                            if (anchor == "L") {
                                //it.geometricBounds = [it.geometricBounds[0] + my_diff_y, it.geometricBounds[1], it.geometricBounds[2] + my_diff_y, it.geometricBounds[3] - diff_x];
                                //it.fit(FitOptions.PROPORTIONALLY);
                            }
                            else {
                                it.geometricBounds = [it.geometricBounds[0] + my_diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + my_diff_y, it.geometricBounds[3] + diff_x];
                                it.fit(FitOptions.PROPORTIONALLY);
                            }
                            //alert("w: " + (it.geometricBounds[3]-it.geometricBounds[1]) + "Spostato");
                        }
                        else {

                            if (it.label == "descrizione" || it.label == "linee") {

                                //it.geometricBounds = [it.geometricBounds[0]-diff_y, it.geometricBounds[1],it.geometricBounds[2]-diff_y, it.geometricBounds[3]];
                                if (startY + diff_y > it.geometricBounds[0]) {
                                    var offs = (startY + diff_y) - it.geometricBounds[0];
                                    it.geometricBounds = [it.geometricBounds[0] + offs, it.geometricBounds[1], it.geometricBounds[2], it.geometricBounds[3]];


                                    if (it.label == "descrizione") {
                                        //Per mettere il testo tutto visibile qualora fosse in overflow//possimao solo agire sulla sua larghezza, dato che in altezza è già al limite                                                  
                                        var antiloop = 0;
                                        while (it.overflows) {
                                            //alert(meta_meccanica.codice +  "   " + it.geometricBounds);
                                            var bound = it.geometricBounds;
                                            if (meta_meccanica.codice.indexOf("BOX14") < 0)
                                                it.geometricBounds = [bound[0] - 2, bound[1], bound[2], bound[3]];
                                            else
                                                it.geometricBounds = [bound[0], bound[1], bound[2] + 2, bound[3]];

                                            //alert(it.geometricBounds);

                                            antiloop++;
                                            if (antiloop > 30)
                                                break;
                                        }
                                    }

                                }

                                // if (pz_boxDescrPrezzi_ORI_TERRITORIO!=null)
                                // {
                                //     it.geometricBounds = [it.geometricBounds[0], it.geometricBounds[1]-diff_x, it.geometricBounds[2], it.geometricBounds[3]-diff_x];
                                // }
                            }
                            else if (it.label == "LBL_Carte") {
                                //it.groups[0].pageItems[0].fit(FitOptions.PROPORTIONALLY);
                                //it.groups[0].pageItems[0].fit(FitOptions.FRAME_TO_CONTENT);
                                if (is_nostriORI) {
                                    if (pz_boxDescrPrezzi_ORI_TERRITORIO == null) {
                                        if (anchor == "R")
                                            it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] + diff_x];
                                        else
                                            it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] - diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] - diff_x];

                                        it.groups[0].pageItems[0].fit(FitOptions.PROPORTIONALLY);
                                        it.groups[0].pageItems[0].fit(FitOptions.FRAME_TO_CONTENT);
                                    }
                                    else {
                                    }
                                }

                                pz_LBLCarte = it;


                            }
                            else if (it.label == "quantitativi") {
                                if (anchor == "R") {
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1] + diff_x, it.geometricBounds[2] + diff_y, it.geometricBounds[3] + diff_x];
                                }
                                else {
                                    it.geometricBounds = [it.geometricBounds[0] + diff_y, it.geometricBounds[1], it.geometricBounds[2] + diff_y, it.geometricBounds[3]];
                                }
                            }
                            else {
                                if (meta_meccanica.codice.indexOf("BOX5") >= 0) {
                                    if (it.label == "campo_offerta" || it.label == "prezzo_offerta_EURprima" || it.label == "campo_offerta_KgL_sconto" || it.label == "sconto_crescente") {
                                        //alert(it.label);
                                        if (it.label == "sconto_crescente") {
                                            //alert(it.geometricBounds);
                                            //it.geometricBounds = [it.geometricBounds[0], it.geometricBounds[1] - diff_x, it.geometricBounds[2], it.geometricBounds[3] - diff_x];
                                            it.move([it.geometricBounds[1] - diff_x, it.geometricBounds[0]]);
                                            //alert(it.geometricBounds);
                                        }
                                        else {
                                            it.geometricBounds = [it.geometricBounds[0], it.geometricBounds[1], it.geometricBounds[2], it.geometricBounds[3] - diff_x];
                                        }
                                    }

                                }
                                // if (it.label.indexOf("base")<0 && it.label.indexOf("gruppo")<0 && it.label!="")
                                // {
                                //     alert("extra " + it.label);
                                //     if (pz_boxDescrPrezzi_ORI_TERRITORIO!=null)
                                //     {
                                //         it.geometricBounds = [it.geometricBounds[0], it.geometricBounds[1]-diff_x, it.geometricBounds[2], it.geometricBounds[3]-diff_x];
                                //     }
                                // }
                            }
                        }
                    }

                    if (it.label == "descrizione") {
                        //alert("overflow");
                        var antiloop = 0;

                        while (it.overflows) {
                            //alert(meta_meccanica.codice +  "   " + it.geometricBounds);
                            var bound = it.geometricBounds;
                            if (meta_meccanica.codice.indexOf("BOX14") < 0)
                                it.geometricBounds = [bound[0] - 2, bound[1], bound[2], bound[3]];
                            else
                                it.geometricBounds = [bound[0], bound[1], bound[2] + 2, bound[3]];

                            //alert(it.geometricBounds);

                            antiloop++;
                            if (antiloop > 30)
                                break;
                        }
                    }

                    // if (it.label=="logo_ori")
                    //     alert(it.geometricBounds);

                    if (it.label != "") {
                        //alert(it.label + ": " + bkpB + " ------->  " + it.geometricBounds);
                    }


                }

                //alert("post redim");
                //return null;

            }

            //alert("step 1" + (masterGroup.geometricBounds[2]-masterGroup.geometricBounds[0]));

            if (pz_boxDescrPrezzi_ORI_TERRITORIO != null) {
                // pz_boxDescrPrezzi_ORI_TERRITORIO.move([item_pos.visibleBounds[1], pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0]]);


                if (pzLogoOri != null) {
                    //Allora mi assicuro che i due cmponenti siano allineati
                    //pz_boxDescrPrezzi_ORI_TERRITORIO.move([item_pos.visibleBounds[1], pzLogoOri.geometricBounds[0]]);
                    pz_boxDescrPrezzi_ORI_TERRITORIO.move([pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1], pzLogoOri.geometricBounds[0]]);
                }
                else {
                    //Caso mai trovato
                    if (pz_base_territorio != null) {
                        //alert("base trovata");
                        //alert(pz_base_territorio.label);
                        if (pz_base_territorio.isValid) {
                            pz_boxDescrPrezzi_ORI_TERRITORIO.move([pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1], pz_base_territorio.geometricBounds[0] - gap_y_descrTerr_baseTerr]);
                        }
                    }
                    //alert("adesso dovrei spostare di blocco tutto il tassello");
                }
            }

            //alert("step 2 " + (masterGroup.geometricBounds[2]-masterGroup.geometricBounds[0]));

            // var wBOXCheck =   g_new.visibleBounds[3]-g_new.visibleBounds[1];
            // alert(wBOXCheck);

            //alert("stop");

            if (pzImg != null && pzImg != undefined) {
                try {
                    var containerG = pzImg.parent;

                    if (/*obj.meccanica.indexOf("_inostriori")>=0 || */isMZLOC) {
                        //alert("Spostiamo tutto " + livelli_meccanica.length);
                        //Spostamento di tutti i campi descrittivi dentro il BOX ORI - Caso VOl MZ inostriori

                        //Endx Endy
                        var endy = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[2];
                        var endx = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3];
                        var stepy = endy - 1;
                        var offsetEtto = 15.977;

                        var diffx1 = containerG.geometricBounds[3] - endx;
                        //var diffy1 = containerG.geometricBounds[2] - endy + (obj.meccanica.indexOf("_boxetto")>=0?0:1);
                        var diffy1 = containerG.geometricBounds[2] - endy + (obj.meccanica.indexOf("_boxetto") >= 0 ? 0 : -1);

                        //pz_descrizione
                        //Offsedt che c'è tra la descrizione e il margine destro del box
                        //Mi basta avere quella come campione per mandare tutti avanti di questo offset una volta messi nel box ori a sinistra
                        var diffx2 = containerG.geometricBounds[3] - pz_descrizione.geometricBounds[3];

                        for (var i = 0; i < livelli_meccanica.length; i++) {
                            var item = livelli_meccanica[i];


                            var hItem = item.geometricBounds[2] - item.geometricBounds[0];
                            var wItem = item.geometricBounds[3] - item.geometricBounds[1];

                            //var diffx2 = containerG.geometricBounds[3] - item.geometricBounds[3];
                            var diffy2 = containerG.geometricBounds[2] - item.geometricBounds[2];

                            var move_x = item.geometricBounds[1] - diffx1;// (diffx1-diffx2);
                            var move_y = item.geometricBounds[0] - diffy1;// ( diffy1-diffy2); 

                            if (item.label == "LBL_Carte") {
                                move_x += diffx1;
                            }
                            else {
                                //if (pz_alletto==null)
                                move_x += diffx2;
                                // else
                                // {
                                //     //campo_offerta_etto
                                //     //sconto_norm
                                //     //sy_%
                                //     //sy_-
                                //     //prezzo
                                //     //sconto_effettivo_grande

                                //     if (item.label.indexOf("descrizione")>=0)
                                //     {
                                //         alert("entro " + item.label);
                                //         move_x +=diffx2;
                                //     }
                                // }

                                /*else if (item.label=="rect_etto") 
                                {
                                    alert("muovo rect etto");
                                    item = item.parent;
                                    move_x +=diffx2;
                                }*/

                            }

                            //alert(move_y);

                            //item.move([item.geometricBounds[1] - diff_x, item.geometricBounds[0] - diff_y]);                        
                            item.move([move_x, move_y]);


                            //alert(item.label + "\nstep iter " + (masterGroup.geometricBounds[2]-masterGroup.geometricBounds[0]));

                        }


                        if (pz_alletto != null) {
                            //alert(pz_alletto.geometricBounds);
                            var move_x = pz_alletto.geometricBounds[1] - diffx1;// (diffx1-diffx2);
                            var move_y = pz_alletto.geometricBounds[2] - diffy1;// ( diffy1-diffy2); 

                            //alert(item.label);
                            //alert(move_y);
                            //alert([move_x,move_y]);
                            //item.move([item.geometricBounds[1] - diff_x, item.geometricBounds[0] - diff_y]);
                            pz_alletto.move([move_x, move_y]);

                        }

                        //alert((masterGroup.geometricBounds[3]-masterGroup.geometricBounds[1]));

                        if (pz_prezzo_offerta != null) {
                            var wDescr = pz_descrizione.geometricBounds[3] - pz_descrizione.geometricBounds[1];
                            var wPoff = pz_prezzo_offerta.geometricBounds[3] - pz_prezzo_offerta.geometricBounds[1];
                            if (wPoff > wDescr) {
                                pz_prezzo_offerta.geometricBounds = [pz_prezzo_offerta.geometricBounds[0],
                                pz_prezzo_offerta.geometricBounds[1] + (wPoff - wDescr),
                                pz_prezzo_offerta.geometricBounds[2],
                                pz_prezzo_offerta.geometricBounds[3]];
                            }
                        }



                    }

                    //alert((masterGroup.geometricBounds[3]-masterGroup.geometricBounds[1]));

                    //alert("stop!");
                    if (/*obj.meccanica.indexOf("_inostriori")>=0 && */isMZLOC) {

                        var hIItem = pzImg.geometricBounds[2] - pzImg.geometricBounds[0];
                        var wIItem = pzImg.geometricBounds[3] - pzImg.geometricBounds[1];
                        pzImg.move([containerG.geometricBounds[3] - wIItem, containerG.geometricBounds[2] - hIItem]);
                    }

                    //alert((masterGroup.geometricBounds[3]-masterGroup.geometricBounds[1]));

                }
                catch (errMZori) {

                }
            }

            //alert((masterGroup.geometricBounds[2]-masterGroup.geometricBounds[0]));
            //alert("pre finalize");


            //alert("post finalize");

            //alert("pre redim boxrezzi Territorio");

            if (pz_boxDescrPrezzi_ORI_TERRITORIO != null && isMZLOC) {
                //Esiste il box ori territorio e quindi lo devo mettere sullo 0,0

                var lastMovXOffset = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1] - masterGroup.geometricBounds[1];
                var lastMovYOffset = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0] - masterGroup.geometricBounds[0];

                var guadagnoH_boxDdescrPrezzi = 0;
                if (lastMovYOffset > 0) {
                    guadagnoH_boxDdescrPrezzi = lastMovYOffset;
                    lastMovYOffset *= -1;
                }

                if (pz_alletto == null)
                    pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds = [pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0], pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1], pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[2] + 1 + guadagnoH_boxDdescrPrezzi, pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3]];
                //pz_boxDescrPrezzi_ORI_TERRITORIO.move([masterGroup.geometricBounds[1],masterGroup.geometricBounds[0]]); 


                //alert("Qui non è ok");

                var minY = 99999999;
                var tolleranza = 1;//Tolleranza di spazio vuoto sopra

                //alert("inizio "+ [lastMovXOffset, lastMovYOffset]);
                for (var i = 0; i < livelli_meccanica.length; i++) {
                    var item = livelli_meccanica[i];

                    var move_x = item.geometricBounds[1] - lastMovXOffset;
                    var move_y = item.geometricBounds[0] - lastMovYOffset;

                    //alert(item.label);

                    item.move([move_x, move_y]);
                    if (minY > move_y && item.label != "LBL_Carte") {
                        if (item.label == "gruppo_descrizione") {
                            //alert("devo cambiare gruppo descrizione");
                            //alert(item.geometricBounds[0]);
                            minY = item.textFrames[0].characters[0].baseline - (item.textFrames[0].characters[0].pointSize * 0.352); //Prendo il vero offset descrizione
                            tolleranza += 1.5;

                            //alert("passo di qui?");
                            //alert(minY);
                            //Visto che ci sono ridimensiono il bound decrizione per evitare lo spreco sopra
                            //alert([item.geometricBounds[0], minY]);

                            item.geometricBounds = [minY - 1.5, item.geometricBounds[1], item.geometricBounds[2], item.geometricBounds[3]];


                            //alert((item.textFrames[0].characters[0].pointSize*0.352));
                            //alert("cambiato");
                        }
                        else {
                            minY = move_y;
                        }
                        //alert("leader min y " + item.label);
                    }

                }

                //alert("fine");
                //alert("ste test 1");

                if (pz_alletto != null) {
                    //alert(pz_alletto.geometricBounds);
                    var move_x = pz_alletto.geometricBounds[1];
                    var move_y = pz_alletto.geometricBounds[2] - lastMovYOffset;
                    pz_alletto.move([move_x, move_y]);

                }

                //alert("ste test 2");


                var offestLoghiY = 0
                var offsetVerticale = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0];

                //alert("offsetV " + offsetVerticale);
                if (pz_LBLCarte != null) {
                    //alert("Le carte ingombrano");

                    var wLBLCarte = pz_LBLCarte.geometricBounds[3] - pz_LBLCarte.geometricBounds[1];
                    offestLoghiY += pz_LBLCarte.geometricBounds[2] - pz_LBLCarte.geometricBounds[0];


                    //alert(offsetVerticale);

                    pz_LBLCarte.move([pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3] - wLBLCarte, pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0]]);
                    offsetVerticale = pz_LBLCarte.geometricBounds[2];
                    //alert("offsetV v1 " + offsetVerticale);
                }



                var offsetLoghi = 1;//parte con u offset di 1 dal bordo di destra
                var lastLogoH = 0;
                for (var l = loghiPerPosizionamentoInBoxOri.length - 1; l >= 0; l--) {
                    var logoItem = loghiPerPosizionamentoInBoxOri[l];
                    var wLogo = logoItem.geometricBounds[3] - logoItem.geometricBounds[1];
                    lastLogoH = logoItem.geometricBounds[2] - logoItem.geometricBounds[0];
                    logoItem.move([pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3] - wLogo - offsetLoghi, pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0] + offestLoghiY + 1]);
                    offsetLoghi += wLogo + 1;

                    //alert(logoItem.label);
                    offsetVerticale = logoItem.geometricBounds[2];
                    //alert("offsetV v2" + offsetVerticale);

                }

                //alert(offsetVerticale);

                //alert("step..." + (minY<offsetVerticale));

                //Assegno l'ingobro finale dei loghi aggiungendo l'altezza dell'ultimo riposizioato
                //offestLoghiY += lastLogoH;

                //Adesso dobbiamo vedere se l'ingombro dei loghi risposizionati va o meno ad ostacolare gli altri campi già messi in ordine
                //alert([minY,offsetVerticale]);
                if (minY < offsetVerticale) {
                    //Casistica di ALLARGAMENTO box ORI per farci entrare tutto
                    //alert("Devo allungare il box");
                    for (var i = 0; i < livelli_meccanica.length; i++) {
                        var item = livelli_meccanica[i];
                        if (item.label == "LBL_Carte") {
                            continue;
                        }
                        var move_x = item.geometricBounds[1];
                        var move_y = item.geometricBounds[0] + (offsetVerticale - minY);

                        //alert(item.label);
                        item.move([move_x, move_y]);

                        //alert("next...");
                    }

                    //alert(pz_alletto);
                    if (pz_alletto != null) {
                        //alert("Sposto all'etto");
                        //alert(pz_alletto.geometricBounds);
                        var move_x = pz_alletto.geometricBounds[1];
                        var move_y = pz_alletto.geometricBounds[2] + (offsetVerticale - minY);

                        pz_alletto.move([move_x, move_y]);


                    }

                    pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds = [
                        pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0],
                        pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1],
                        pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[2] + (offsetVerticale - minY),
                        pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3]];

                }
                else {
                    //Analizziamo se invece avanza troppo spazio sopra
                    //Partiamo però dall'escludere gemelli e raggruppa
                    //alert(dna.split(",").length);
                    if (objItem["Scatto.CodiceGruppo"].split(",").length <= 1)//obj.note.indexOf("gemelli")<0 && obj.note.indexOf("raggruppa")<0)
                    {

                        //alert("eccoci qua");

                        //Controlliamo l'avanzo
                        var startY = pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0];
                        //alert(startY);
                        if (offsetVerticale > 0) {
                            startY = offsetVerticale;
                            //alert(offestLoghiY);
                        }

                        if (pz_LBLCarte != null) {
                            //alert([startY,pz_LBLCarte.geometricBounds[2]]);
                            if (startY < pz_LBLCarte.geometricBounds[2]) {
                                //alert(pz_LBLCarte.geometricBounds[2]-pz_LBLCarte.geometricBounds[0]);

                                startY = pz_LBLCarte.geometricBounds[2];
                            }
                        }

                        //alert(startY);


                        //alert(startY + " - " + pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0] + " - " + offestLoghiY);

                        //alert([minY,startY]);

                        //return;

                        if (minY - startY > tolleranza || minY < startY) {
                            //alert(startY);
                            //Devo comprimere i campi perchè avanza troppo spazio sopra
                            //alert([minY,startY,tolleranza]);

                            var fixOffsetYCopressione = minY - startY - tolleranza;

                            //alert(fixOffsetYCopressione);

                            //alert("Fix compressione di " + fixOffsetYCopressione);
                            for (var i = 0; i < livelli_meccanica.length; i++) {

                                //alert("next...");

                                var item = livelli_meccanica[i];
                                //alert(item.label);
                                if (item.label == "LBL_Carte") {
                                    continue;
                                }
                                var move_x = item.geometricBounds[1];
                                var move_y = item.geometricBounds[0] - fixOffsetYCopressione;

                                item.move([move_x, move_y]);
                            }

                            //alert("step finale 1");

                            if (pz_alletto != null) {
                                //alert(pz_alletto.geometricBounds);
                                var move_x = pz_alletto.geometricBounds[1];
                                var move_y = pz_alletto.geometricBounds[2] - fixOffsetYCopressione;
                                pz_alletto.move([move_x, move_y]);

                            }

                            //alert("step finale 2");

                            pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds = [
                                pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0],
                                pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[1],
                                pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[2] - fixOffsetYCopressione,
                                pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[3]];

                            //alert(item.label);
                        }
                    }
                }
                //alert("Adesso sposterò box ori al master gruop");
                pz_boxDescrPrezzi_ORI_TERRITORIO.move([masterGroup.geometricBounds[1], masterGroup.geometricBounds[0]]);

            }


            //alert("post redim boxrezzi Territorio");

            if (rp1 != null)
                rp1.fit(FitOptions.CONTENT_TO_FRAME);



            if (pz_base != null) {
                try {
                    pz_base.contentType = ContentType.UNASSIGNED;
                } catch (error) { }

            }

            masterGroup.move(agenzia_pos);

            

            return ["new", obj, masterGroup];
        }

        return null;

    },


    parseMeccanica_provvisorio(objRef, allEtichette, contesto_promo, pathLavorazione, sourceAree, sourceCanali) {

        var filePath = pathLavorazione + "/lavorazioni.json";
        let lavorazioni = readFile(filePath);
        //lavorazione è una lista di oggetti noi dobbiamo trovare qullo con la chiave file = al nome del file aperto di indesign
        var lavorazione = lavorazioni.find(lavorazione => lavorazione.file == app.activeDocument.name);
        if(lavorazione == null){
            console.error("Lavorazione non trovata");
            return;
        }
        //lavorazione.details è un oggetto che contiene le informazioni della lavorazione, li cerchiamo
        var guidCanale = lavorazione.details.guidCanale;
        var guidArea = lavorazione.details.guidArea;

        var canaleObj = sourceCanali.find(f=>f.guidID == guidCanale);
        if(canaleObj == null){
            console.error("Canale non trovato");
            return;
        }

        var canale = canaleObj.sigla;

        var areaObj = sourceAree.find(f=>f.guidID == guidArea);
        if(areaObj == null){
            console.error("Area non trovata");
            return;
        }

        var area = areaObj.sigla;

        if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0) {
            //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
            contesto_promo = this.assegnaNuovoValore("materiale", "VOL", contesto_promo);
        }

        var meccanica = objRef.combinazioneAssegnata;
        var tema = objRef.tema;
        var tipo_tema = objRef.tipo_tema;
        var note = objRef.nota_category;
        var ruolo = objRef.ruolo;
        var grafica_50al50 = allEtichette.contains("SEZ. 50 AL 50");
        var reparto = objRef.reparto;
        var settore = objRef.settore;

        //var isMZLOC = (nome_origine_xml.indexOf("MZ_LOC") == 0);
        var isMZLOC = this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0 && this.cercaChiaveValore("materiale", "MZ", contesto_promo);
        var obj = new Object();
        obj.azioni = new Array();
        obj.isInvalida = false;

        //leggiamo il file lavorazioni.json

        // for (var $va = 0; $va < FILTRO_MECCANICHE.length; $va++) {
        //     if (meccanica.indexOf(FILTRO_MECCANICHE[$va]) >= 0) {
        //         obj.codice = meccanica;
        //         return obj;
        //     }
        // }

        if (this.cercaChiaveValore("materiale", "INT", contesto_promo)) {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int3);
        }

        if(this.cercaChiaveValore("materiale", "RIL", contesto_promo)) {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int3);
        }

        if (meccanica.indexOf("PERCENTO_FID_ALL") >= 0 && tema == "m50prodsc50%" && canale == "SC") {
            var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color);
            var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color2);
        }

        var a_del = { tipo: "del", campi: new Array() };

        if (meccanica.indexOf("sottocosto") >= 0) {

            if (canale == "SC" > 0) {
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("VAL_MM") >= 0) {
            a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "sconto"] };
        }
        else if (meccanica.indexOf("VAL_FID") >= 0) {
            a_del = { tipo: "del", campi: ["PezzConf_NM", "sconto"] };
        }
        else if (meccanica.indexOf("50al50") >= 0) {
            if (canale != "SC")
            {
                a_del.campi.push("PezzConf_NM");
                a_del.campi.push("sconto_effettivo_grande");
            }

            if (meccanica.indexOf("50al50Norm") >= 0) {
                a_del.campi.push("LBL_Carte");
                a_del.campi.push("sconto_fid");
            }
            else {
                a_del.campi.push("sconto_norm");
            }

            if (tema == "m50prodsc50%") {
                var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie VERDE" };
                obj.azioni.push(a_color);
                var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie VERDE" };
                obj.azioni.push(a_color2);
            }
        }
        else if (meccanica.indexOf("_minicoll") > 0) {
            a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "sconto", "00", "scritta_xx", "prezzo", "anzichè", "linee"] };

            if (meccanica.indexOf("PUNTI_TP") < 0 && meccanica.indexOf("PERCENTO") < 0) {
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("gruppo_sconto");

                var a_p = { tipo: "pos", campo_indd: "descrizione", align: Justification.LEFT_ALIGN, absoluteX: 0 };
                obj.azioni.push(a_p);


                a_del.campi.push("campo_offerta");
                a_del.campi.push("campo_offerta_KgL");
                a_del.campi.push("campo_offerta_KgL_sconto");
                a_del.campi.push("sconto_effettivo_grande");


                if (meccanica.indexOf("PUNTI_MULTI") < 0) {
                    a_del.campi.push("Range_Punti_2");
                    a_del.campi.push("LBL_Carte");
                }

            }
            else if (meccanica.indexOf("PUNTI_TP") >= 0) {
                a_del.campi.push("gruppo_sconto");
                a_del.campi.push("Range_Punti_2");
                //alert("gs 2");

            }
            else if (meccanica.indexOf("PERCENTO") >= 0) {
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("Range_Punti_2");
            }
        }
        else if (meccanica.indexOf("_bonus") > 0) {
            a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "sconto", "00", "scritta_xx", "prezzo", "anzichè"] };
            if (meccanica.indexOf("MULTI_PERCENTO") > 0) {
                a_del.campi.push("sconto_effettivo_grande");
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("MULTI_TP") > 0) {
                a_del.campi.push("gruppo_sconto");
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("MULTI") > 0) {
                a_del.campi.push("campo_offerta");
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("gruppo_sconto");
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("PezzConf");
                a_del.campi.push("campo_offerta_KgL_sconto");
                a_del.campi.push("linee");
            }
            else if (meccanica.indexOf("PERCENTO") > 0) {
                a_del.campi.push("Range_Punti_2");
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("PezzConf");
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("TP") > 0) {
                a_del.campi.push("gruppo_sconto");
                a_del.campi.push("PezzConf");

                a_del.campi.push("Range_Punti_2");
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else {
                a_del.campi.push("campo_offerta");
                a_del.campi.push("campo_offerta_KgL");
                a_del.campi.push("campo_offerta_KgL_sconto");
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("gruppo_sconto");
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("PezzConf");
                a_del.campi.push("Range_Punti_2");
                a_del.campi.push("linee");
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }

            if (materiale.indexOf("1a DATA") >= 0) {
                var a1_eff = { tipo: "effect", campo_indd: "base", name: "Punti/Bonus 1a DATA" };
                obj.azioni.push(a1_eff);

            }
            else if (materiale.indexOf("2a DATA") >= 0) {
                var a2_eff = { tipo: "effect", campo_indd: "base", name: "Punti/Bonus 2a DATA" };
                obj.azioni.push(a2_eff);
            }

        }
        else if (meccanica.indexOf("ALTRO") >= 0) {
            a_del = { tipo: "del", campi: ["carta"] };
            a_del.campi.push("LBL_Carte");
            a_del.campi.push("LBL_Titolari");

            if (canale == "SC") {
                a_del.campi.push("PIEDE_Titolari");
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("OA_") == 0) {
            a_del = { tipo: "del", campi: ["carta"] };
            a_del.campi.push("LBL_Carte");
            a_del.campi.push("LBL_Titolari");

            if (canale == "SC") {
                a_del.campi.push("PIEDE_Titolari");
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("TP_MM") >= 0) {
            if (meccanica.indexOf("_123") >= 0) {
                a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "sconto", "00", "scritta_xx", "anzichè"] };
                var a_color = { tipo: "color", campo_indd: "prezzo_offerta", colore: "Nero_Prezzi" };
                obj.azioni.push(a_color);
            }

            if (meccanica.indexOf("_KgL") > 0) {
                if (cercaChiave("tema", contesto_promo).indexOf("LOC") < 0) {
                    var a_ch2 = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                    obj.azioni.push(a_ch2);
                }
                else {
                    a_del.campi.push("campo_offerta_KgL_sconto");//Tanto va avanti campo:offerta_KgL
                }

            }


            var suff = "_KgL";
            var stile = "";
            if (meccanica.indexOf("_regionale") > 0) {
                suff = "_KgL_sconto";
            }

            if (meccanica.indexOf("_ofalkg") >= 0) {
                if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") < 0) {

                    var a_ch = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_conf", mappa_stile: "campo_offerta_conf" };
                    obj.azioni.push(a_ch);
                }
                else {
                    a_del.campi.push("campo_offerta_KgL_sconto");//Tanto va avanti campo:offerta_KgL

                    var a_ch = { tipo: "binding", campo_indd: "campo_offerta_KgL", campo_dato: "campo_offerta_conf", mappa_stile: "campo_offerta_conf" };
                    obj.azioni.push(a_ch);

                }

                if (materiale != "EV") {
                    var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_KgL", mappa_stile: "prezzo_offerta_KgL" };
                    obj.azioni.push(a_ch2);
                }
                else {
                    var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_KgL_EURprima", mappa_stile: "prezzo_offerta_KgL_EURprima" };
                    obj.azioni.push(a_ch2);
                }
            }
            else if (meccanica.indexOf("_ofaconf") >= 0) {
                if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") < 0) {
                    var a_ch = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                    obj.azioni.push(a_ch);
                }
                else {
                    a_del.campi.push("campo_offerta_KgL_sconto");//Tanto va avanti campo:offerta_KgL
                }

                var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("_regionale") >= 0) {
                if (meccanica.indexOf("_KgL") > 0) {
                    var a_ch = { tipo: "binding", campo_indd: "campo_offerta" + suff, campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                    obj.azioni.push(a_ch);
                }

                if (meccanica.indexOf("_boxetto") >= 0 && meccanica.indexOf("_evento") < 0 /*&&  meccanica.indexOf("_inostriori")<0 */ && materiale != "EV") {
                    a_del.campi.push("campo_offerta_etto");

                }
            }

            a_del.campi.push("sconto_effettivo_grande");
            a_del.campi.push("sconto_effettivo");

            a_del.campi.push("sconto_fid");
            a_del.campi.push("scritta_xx");
            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("LBL_Carte");
        }
        else if (meccanica.indexOf("sir_sconto") >= 0) {
            if (meccanica.indexOf("_123") >= 0) {
                a_del = { tipo: "del", campi: ["carta"] };
            }

            var a_color2 = { tipo: "color", campo_indd: "prezzo_offerta", colore: "Rosso prezzi" };
            obj.azioni.push(a_color2);

            if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") < 0) {
                var a_color3 = { tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" };
                obj.azioni.push(a_color3);
                if (materiale == "EV") {
                    a_del.campi.push("LBL_Carte");
                }
            }
            else {
                a_del.campi.push("campo_offerta_KgL");
                a_del.campi.push("LBL_Carte");
            }

            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("gruppo_sconto");

            //if ((materiale != "INT" && materiale != "RIL") && meccanica.indexOf("_evento") < 0 /*&& meccanica.indexOf("_inostriori")<0  */ && materiale != "EV") {
            if(!this.cercaChiaveValore("materiale", "INT", contesto_promo) && !this.cercaChiaveValore("materiale", "RIL", contesto_promo) && meccanica.indexOf("_evento") < 0 && !this.cercaChiaveValore("materiale", "EV", contesto_promo))
                a_del.campi.push("prezzo_offerta_EURprima");
            else
                a_del.campi.push("prezzo_offerta_gruppo");
        }
        else if (meccanica.indexOf("TP_FID") >= 0) {
            if (meccanica.indexOf("_123") >= 0) {
                a_del = { tipo: "del", campi: [] };
            }

            if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }

            if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") < 0 && canale == "SC") {
                if (meccanica.indexOf("_evento") < 0 && meccanica.indexOf("_evento") < 0/*&& meccanica.indexOf("_inostriori")<0*/) {
                    var a_color3 = { tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" };
                    obj.azioni.push(a_color3);
                }
            }
            else if (canale == "SC" && isMZLOC) {
                obj.azioni.push({ tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" });
            }

            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("gruppo_sconto");
            //alert("gs 8");

            if (!this.cercaChiaveValore("materiale", "INT", contesto_promo) && meccanica.indexOf("_evento") < 0 && !this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                a_del.campi.push("prezzo_offerta_EURprima");
            }
            else {
                if (meccanica.indexOf("_evento") < 0 ) {
                    a_del.campi.push("prezzo_offerta_gruppo");
                }
            }

            if (meccanica.indexOf("_ofalkg") >= 0) {
                var a_ch = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_conf_sconto", mappa_stile: "campo_offerta_conf_sconto" };
                obj.azioni.push(a_ch);

                var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_KgL", mappa_stile: "prezzo_offerta_KgL" };
                obj.azioni.push(a_ch2);

                var a_ch3 = { tipo: "binding", campo_indd: "campo_offerta", campo_dato: "campo_offerta_ofalkg", mappa_stile: "campo_offerta_ofalkg" };
                obj.azioni.push(a_ch3);

                if (this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                    var a_ch4 = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_KgL_EURprima", mappa_stile: "prezzo_offerta_KgL_EURprima" };
                    obj.azioni.push(a_ch4);
                }
            }

            if (meccanica.indexOf("_ofaconf") >= 0) {
                var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                obj.azioni.push(a_r);
            }



        }
        else if (meccanica.indexOf("MM_ALL") >= 0) {
            if (meccanica.indexOf("_123") >= 0)
                a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "00", "scritta_xx", "anzichè"] };


            if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }

            a_del.campi.push("sconto_fid");
            a_del.campi.push("scritta_xx");
            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("LBL_Carte");
        }
        else if (meccanica.indexOf("FID_ALL") >= 0) {
            a_del = { tipo: "del", campi: ["PezzConf_NM", "00", "scritta_xx", "anzichè", "sconto_norm"] };

            if (this.cercaChiave("tema",contesto_promo).indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }
        }
        else if (meccanica.indexOf("NM_MM") >= 0 || meccanica.indexOf("NM_MIX") >= 0 || meccanica.indexOf("NM_FID") >= 0) {
            if (meccanica.indexOf("FID") > 0) {
                //codice="BOX0";
                //la label M_MM veicola verso M_fid
                var a_ch2 = { tipo: "binding", campo_indd: "M_MM", campo_dato: "M_fid", mappa_stile: "M_fid" };
                obj.azioni.push(a_ch2);
            }
            else if (meccanica.indexOf("_123") > 0) {
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("campo_offerta");
                a_del.campi.push("prezzo_offerta_EURprima");
                a_del.campi.push("gruppo_sconto");
                //alert("gs 9");
                if (meccanica.indexOf("_KgL") > 0) {
                    var a_ch2 = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                    obj.azioni.push(a_ch2);
                }
            }



        }
        else if (meccanica.indexOf("MM") >= 0) {
            if (meccanica.indexOf("_123") >= 0)
                a_del = { tipo: "del", campi: ["carta", "PezzConf_NM", "00", "scritta_xx"] };

            if (meccanica.indexOf("PERCENTO") >= 0) {
                a_del.campi.push("sconto_fid");
                a_del.campi.push("scritta_xx");
                a_del.campi.push("PezzConf_NM");
                a_del.campi.push("LBL_Carte");
            }

        }
        else if (meccanica.indexOf("_FID") >= 0) {
            if (meccanica.indexOf("_123") >= 0)
                a_del = { tipo: "del", campi: ["PezzConf_NM", "00", "scritta_xx"] };

            if (meccanica.indexOf("PERCENTO") >= 0) {
                a_del.campi.push("sconto_norm");
                a_del.campi.push("scritta_xx");
                a_del.campi.push("PezzConf_NM");
            }

            if (this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }
        }
        else if (meccanica.indexOf("VEDERE_NOTE") >= 0) {

            a_del.campi.push("LBL_Carte");
            a_del.campi.push("LBL_Titolari");

            if (canale == "SC") {
                a_del.campi.push("PIEDE_Titolari");
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }

            if (meccanica.indexOf("_evento") >= 0 || this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                a_del.campi.push("linee");
            }


        }
        else if (meccanica.indexOf("VUOTA") >= 0) { }


        if (meccanica.indexOf("_sdb") >= 0 || meccanica.indexOf("_bdp") >= 0) {

            if (meccanica.indexOf("50al50") < 0 ) {
                if (canale != "SC") {
                    var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                    obj.azioni.push(a_color4);
                }
            }

            if (meccanica.indexOf("_bdp") >= 0) {
                a_del.campi.push("logo_SDB");
            }
            else {
                a_del.campi.push("logo_BDP");
            }

            if (meccanica.indexOf("_boxetto") >= 0 && meccanica.indexOf("_evento") < 0 && !this.cercaChiaveValore("materiale", "EV", contesto_promo)) {

                if (canale == "SC") {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                    obj.azioni.push(a_border);
                }

                if (meccanica.indexOf("TP_MM") >= 0) {
                    a_del.campi.push("campo_offerta_etto");
                }

                if (meccanica.indexOf("TP_MM") >= 0) {
                    var a_ch = { tipo: "binding", campo_indd: "stringa_etto", campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                    obj.azioni.push(a_ch);
                }

                if (meccanica.indexOf("_bdp") >= 0) {


                    if (canale != "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbia Buono del paese" };
                        obj.azioni.push(a_color);

                        var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                        obj.azioni.push(a_color4);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 1 };
                        obj.azioni.push(a_border);
                    }

                }
                else if (meccanica.indexOf("_sdb") >= 0) {
                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbie SCELTE di BENESSERE" };
                        obj.azioni.push(a_color);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 1 };
                        obj.azioni.push(a_border);
                    }
                }

                if (meccanica.indexOf("PERCENTO") < 0 && !this.cercaChiaveValore("materiale", "INT", contesto_promo) && !this.cercaChiaveValore("materiale", "RIL", contesto_promo))//Da ritestare
                    a_del.campi.push("prezzo_offerta_etto_EURprima");
                else {
                    if (meccanica.indexOf("PERCENTO") >= 0 && canale == "SC") 
                        a_del.campi.push("prezzo_offerta_gruppo");
                }

                a_del.campi.push("stringa_etto");

            }
            else {
                a_del.campi.push("alletto");
            }



        }
        else if (meccanica.indexOf("_boxetto") >= 0) {
            a_del.campi = new Array();
            obj.azioni = new Array();

            //alert("metto box6_2");
            if (isMZLOC) {
                a_del.campi.push("base");

                if (meccanica.indexOf("_inostriori") < 0 && meccanica.indexOf("_territorio") < 0) {
                    if (reparto == 31) {
                        var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio_PESCE" };
                        obj.azioni.push(a1_eff);

                        var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio_PESCE" };
                        obj.azioni.push(a2_eff);

                    }
                    else if (settore == "307") {
                        var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio_CANTINA" };
                        obj.azioni.push(a1_eff);

                        var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio_CANTINA" };
                        obj.azioni.push(a2_eff);
                    }
                    else {
                        var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio" };
                        obj.azioni.push(a1_eff);

                        var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio" };
                        obj.azioni.push(a2_eff);
                        //alert("dai su!");

                    }
                }

            }

            if (canale == "SC") {
                if (tipo_tema.indexOf("focus") >= 0) {
                    a_del.campi.push("logo_SDB");
                    a_del.campi.push("logo_BDP");
                    a_del.campi.push("fondo_distintivita");
                }
                else if (meccanica.indexOf("_sdb") >= 0) {
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "SC_fondo_Scelte di benessere_box.psd" };
                    obj.azioni.push(a_file);
                }
                else (meccanica.indexOf("_bdp") >= 0)
                {
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "SC_fondo_Buono del Paese_box.psd" };
                    obj.azioni.push(a_file);
                }

                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);

            }
            else {
                a_del.campi.push("logo_SDB");
                a_del.campi.push("logo_BDP");
                a_del.campi.push("fondo_distintivita");
            }


            if (this.cercaChiaveValore("materiale", "INT", contesto_promo)) {
                var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int2);

                var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int3);
            }

            if (this.cercaChiaveValore("materiale", "RIL", contesto_promo)) {
                var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-13.294, -3.112, 0, 0] };
                obj.azioni.push(int2);

                var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-13.294, -3.112, 0, 0] };
                obj.azioni.push(int3);
            }

            a_del.campi.push("stringa_etto");
            a_del.campi.push("LBL_Carte");


            if (meccanica.indexOf("TP_MM") >= 0) {
                var a_ch2 = { tipo: "binding", campo_indd: "stringa_etto", campo_dato: "campo_offerta_KgL", mappa_stile: "campo_offerta_KgL" };
                obj.azioni.push(a_ch2);
                //alert("binding stringa etto");
            }

            if ((meccanica.indexOf("_evento") >= 0 || this.cercaChiaveValore("materiale", "EV", contesto_promo)) &&
                (meccanica.indexOf("TP_MM") >= 0 || meccanica.indexOf("PERCENTO_MM") >= 0 || meccanica.indexOf("sir_sconto") >= 0)) {
                var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_etto_EURprima", mappa_stile: "prezzo_offerta_etto_EURprima" };
                obj.azioni.push(a_ch2);

                var a_ch3 = { tipo: "binding", campo_indd: "campo_offerta", campo_dato: "campo_offerta_etto", mappa_stile: "campo_offerta_etto" };
                obj.azioni.push(a_ch3);
            }

            if (meccanica.indexOf("PERCENTO") >= 0  /*|| meccanica.indexOf("sir_sconto")>=0*/) {
                if (titolo_promo.indexOf("_SC_") < 0)
                    a_del.campi.push("prezzo_offerta_etto");

                a_del.campi.push("sconto_effettivo_grande");
                if (this.cercaChiave("materiale", contesto_promo).includes("MZ") && meccanica.indexOf("_evento") < 0 && canale != "SC") {
                    a_del.campi.push("sy_euro");
                }
                else {
                    a_del.campi.push("gruppo_sconto");

                    if ((!this.cercaChiaveValore("materiale", "INT", contesto_promo) && !this.cercaChiaveValore("materiale", "RIL", contesto_promo)) && meccanica.indexOf("PERCENTO") < 0)//Da ritestare
                        a_del.campi.push("prezzo_offerta_etto_EURprima");
                    else {
                        a_del.campi.push("prezzo_offerta_gruppo");
                    }

                    if (meccanica.indexOf("sir_sconto") < 0) {
                        a_del.campi.push("sconto_effettivo_grande");
                    }

                    if (meccanica.indexOf("TP_MM") >= 0) {
                        a_del.campi.push("campo_offerta_etto");
                    }

                }
            }
        }
        else if (meccanica.indexOf("_inostriori") >= 0 || meccanica.indexOf("_territorio") >= 0) {

            if (meccanica.indexOf("_boxetto") >= 0) {
                a_del.campi.push("base");
            }

            if (!isMZLOC) {
                a_del.campi.push("boxDescrPrezzi_ORI_TERRITORIO");
                a_del.campi.push("base_inostriori_territorio");
            }
            else {
                a_del.campi.push("base");

                if (reparto == 31) {
                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_inostriori_PESCE" };
                    obj.azioni.push(a2_eff);

                }
                else if (settore == "307") {

                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_inostriori_CANTINA" };
                    obj.azioni.push(a2_eff);
                }
                else {
                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_inostriori" };
                    obj.azioni.push(a2_eff);
                }
            }

            if (reparto != 33 &&
                reparto != 31 &&
                reparto != 29 &&
                reparto != 27 &&
                reparto != 25 &&
                reparto != 21) {
                a_del.campi.push("gruppo_reparto");
            }

        }
        else if (isMZLOC) {
            //Siamo in caso meccanica Territorio NON _inostriori
            a_del.campi.push("base");
            if (meccanica.indexOf("_inostriori") < 0 && meccanica.indexOf("_territorio") < 0) {
                if (reparto == 31) {
                    var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio_PESCE" };
                    obj.azioni.push(a1_eff);

                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio_PESCE" };
                    obj.azioni.push(a2_eff);
                }
                else if (settore == "307") {
                    var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio_CANTINA" };
                    obj.azioni.push(a1_eff);

                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio_CANTINA" };
                    obj.azioni.push(a2_eff);
                }
                else {
                    var a1_eff = { tipo: "effect", campo_indd: "boxDescrPrezzi_ORI_TERRITORIO", name: "boxDescrPrezzi_territorio" };
                    obj.azioni.push(a1_eff);

                    var a2_eff = { tipo: "effect", campo_indd: "base_inostriori_territorio", name: "base_territorio" };
                    obj.azioni.push(a2_eff);
                }
            }

        }

        if (meccanica.indexOf("_KgL") < 0) {
            if (a_del.campi != null) {
                a_del.campi.push("campo_offerta_KgL");
                a_del.campi.push("campo_offerta_KgL_sconto");
            }

            if (meccanica.indexOf("PERCENTO") >= 0 || meccanica.indexOf("sir_sconto") >= 0 || meccanica.indexOf("TP_FID") >= 0) {
                //No Kgl e percentuale = 23mm
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 23.25] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("NM_MM") >= 0 || meccanica.indexOf("NM_MIX") >= 0) {
                //No Kgl e 2x1 = 27mm
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 27] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("sottocosto") >= 0) {
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 23.5] };
                obj.azioni.push(a_r);
            }
            else {
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 15.5] };
                obj.azioni.push(a_r);
            }

        }
        else {
            if (meccanica.indexOf("PERCENTO") >= 0 || meccanica.indexOf("sir_sconto") >= 0 || meccanica.indexOf("TP_FID") >= 0) {
                //Kgl e percentuale = 26mm
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 26.25] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("NM_MM") >= 0 || meccanica.indexOf("NM_MIX") >= 0) {
                //Kgl e 2x1 = 30mm
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 30] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("sottocosto") >= 0) {
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 26.5] };
                obj.azioni.push(a_r);
            }
            else {
                //19 mm
                var a_r = { tipo: "resize", campo_indd: "linee", size: [0, 19.5] };
                obj.azioni.push(a_r);
            }

        }


        a_del.campi.push("sconto");

        if (meccanica.indexOf("NM_MM") < 0 && meccanica.indexOf("NM_MIX") < 0 && meccanica.indexOf("50al50") < 0) {
            if (meccanica.indexOf("PERCENTO") < 0 &&
                meccanica.indexOf("TP_FID") < 0 &&
                meccanica.indexOf("sir_sconto") < 0 &&
                meccanica.indexOf("PUNTI") < 0 &&
                meccanica.indexOf("sottocosto") < 0 &&
                meccanica.indexOf("50sulSecondo") < 0) {
                a_del.campi.push("campo_offerta");

                if ((!this.cercaChiaveValore("materiale", "INT", contesto_promo) && !this.cercaChiaveValore("materiale", "RIL", contesto_promo)) && meccanica.indexOf("_evento") < 0 && !this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                    a_del.campi.push("prezzo_offerta_EURprima");
                }
                else if (meccanica.indexOf("_evento") >= 0 || this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                    a_del.campi.push("sconto_effettivo");
                }

                a_del.campi.push("gruppo_sconto");

            }
            else if (meccanica.indexOf("PERCENTO") >= 0 && meccanica.indexOf("_minicoll") < 0 && meccanica.indexOf("_bonus") < 0 && meccanica.indexOf("_evento") < 0) {

                if ((this.cercaChiave("tema", contesto_promo).indexOf("LOC") < 0 && canale == "SC") || isMZLOC) {
                    a_del.campi.push("prezzo_offerta_gruppo");
                }

                a_del.campi.push("sconto_effettivo_grande");

                if (meccanica.indexOf("_evento") >= 0 || this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                    a_del.campi.push("sconto_effettivo");
                }


                if (meccanica.indexOf("_ofalkg") >= 0) {
                    var a_ch = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_KgL_EURprima", mappa_stile: "prezzo_offerta_KgL_EURprima" };
                    obj.azioni.push(a_ch);

                    if (canale == "SC") {
                        var a_ch4 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_KgL", mappa_stile: "prezzo_offerta_KgL" };
                        obj.azioni.push(a_ch4);
                    }

                    var a_ch2 = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_conf_sconto", mappa_stile: "campo_offerta_conf_sconto" };
                    obj.azioni.push(a_ch2);

                    var a_ch3 = { tipo: "binding", campo_indd: "campo_offerta", campo_dato: "campo_offerta_ofalkg", mappa_stile: "campo_offerta_ofalkg" };
                    obj.azioni.push(a_ch3);
                }

                if (meccanica.indexOf("_ofaconf") >= 0) {
                    var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                    obj.azioni.push(a_r);

                }
            }
        }


        if (meccanica.indexOf("_sdb") >= 0) {

            if (meccanica.indexOf("_FID") < 0)
                a_del.campi.push("sconto_fid");

            a_del.campi.push("scritta_xx");
            a_del.campi.push("PezzConf_NM");

            a_del.campi.push("alletto");//Da capire quando serve


            var a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 2.6] };
            var a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 2.6] };
            if (meccanica.indexOf("_KgL") < 0) {
                a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 6] };
                a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 6] };
            }

            if (meccanica.indexOf("PERCENTO") >= 0) {

                a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 4] };
                a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 4] };

                var a_color4 = { tipo: "color", campo_indd: "sconto_norm", colore: "Bianco" };
                obj.azioni.push(a_color4);
                var a_color5 = { tipo: "color", campo_indd: "sconto_fid", colore: "Bianco" };
                obj.azioni.push(a_color5);
                

                if (meccanica.indexOf("_boxetto") > 0 && meccanica.indexOf("_evento") < 0 && !this.cercaChiaveValore("materiale", "EV", contesto_promo)) {
                    a_del.campi.push("linee");
                }

                a_del.campi.push("sconto_effettivo_grande");
            }
            else {
                a_del.campi.push("gruppo_sconto");
                a_del.campi.push("prezzo_offerta_EURprima");
            }

            if (meccanica.indexOf("_sdb") > 0) {
                var a_color = { tipo: "color", campo_indd: "rect_tipico", colore: "righine-gabbie SCELTE di BENESSERE" };
                obj.azioni.push(a_color);

                var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie SCELTE di BENESSERE" };
                obj.azioni.push(a_color2);
            }

            if (canale == "SC") {
                var a_color = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                obj.azioni.push(a_color);
            }
        }
        else {
            a_del.campi.push("rect_regionale");
        }

        if (meccanica.indexOf("_bdp") >= 0 || meccanica.indexOf("_sdb") >= 0 ) {
            var a_color5 = { tipo: "colorBkg", campo_indd: "base", colore: "transparent" };
            obj.azioni.push(a_color5);

            if (meccanica.indexOf("_sdb") >= 0) {
                var a_color = { tipo: "color", campo_indd: "base", colore: "righine-gabbie SCELTE di BENESSERE", bkg: "transparent" };
                obj.azioni.push(a_color);
            }

            if (meccanica.indexOf("_bdp") >= 0) {
                var a_color = { tipo: "color", campo_indd: "base", colore: "righine-gabbia Buono del paese", bkg: "transparent" };
                obj.azioni.push(a_color);
            }

            if (tipo_tema.indexOf("focus") >= 0) {
                if (canale == "SC") {
                    if (meccanica.indexOf("FID") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                        obj.azioni.push(a_border);

                        var a_color5 = { tipo: "colorBkg", campo_indd: "base", colore: "Bianco" };
                        obj.azioni.push(a_color5);
                    }
                    else {
                        var a_color = { tipo: "color", campo_indd: "base", colore: "righine-gabbie_SC" };
                        obj.azioni.push(a_color);
                    }

                    a_del.campi.push("logo_SDB");
                    a_del.campi.push("logo_BDP");
                    a_del.campi.push("fondo_distintivita");
                }
                else {
                    a_del.campi.push("logo_SDB");
                    a_del.campi.push("logo_BDP");
                    a_del.campi.push("fondo_distintivita");
                }
            }
            else {
                if (meccanica.indexOf("_sdb") >= 0) {
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Scelte di benessere_box.psd" };
                    obj.azioni.push(a_file);
                }
                else if (meccanica.indexOf("_bdp") >= 0) {
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Buono del Paese_box.psd" };
                    obj.azioni.push(a_file);
                }

                if (canale != "SC") {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 2 };
                    obj.azioni.push(a_border);
                }

            }

        }
        else {
            a_del.campi.push("logo_SDB");
            a_del.campi.push("logo_BDP");
        }

        if (meccanica.indexOf("_mercato") > 0 && codice != "BOX7") {

            if (meccanica.indexOf("PERCENTO") < 0 && meccanica.indexOf("sir_sconto") < 0) {
                var a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 6] };
                var a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 6] };

                if (meccanica.indexOf("_KgL") >= 0) {
                    a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 3] };
                    a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 3] };
                }

            }
            else if (meccanica == "PERCENTO_MM_mercato_boxetto" && titolo_promo.indexOf("_SC_") > 0) {
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("sy_etto");
                a_del.campi.push("rect_etto");
            }

        }

        if ((objRef.codiceBox == "BOX6" && meccanica.indexOf("PERCENTO") < 0) || this.cercaChiave("tema", contesto_promo).indexOf("LOC") >= 0) {
            a_del.campi.push("linee");
        }

        if (meccanica.indexOf("_evento") > 0 || (this.cercaChiaveValore("materiale", "EV", contesto_promo) && meccanica != "validita")) {

            a_del.campi.push("linea");

            if (meccanica.indexOf("_boxetto") < 0)
                a_del.campi.push("sy_etto");
            else {
                var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_etto", mappa_stile: "prezzo_offerta_etto" };
                obj.azioni.push(a_ch2);
            }

            if (meccanica.indexOf("NM_") < 0) {
                if (meccanica.indexOf("FID") < 0)
                    a_del.campi.push("sconto_fid");
            }
        }

        if (meccanica.indexOf("PERCENTO_MM") >= 0 || meccanica.indexOf("PERCENTO_FID") >= 0) {
            if (meccanica.indexOf("PERCENTO_MM_ALL") < 0 && meccanica.indexOf("PERCENTO_FID_ALL") < 0) {
                a_del.campi.push("PezzConf_NM");
                if (canale == "SC") {
                    a_del.campi.push("rect_tipico");
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("prezzo_offerta_EURprima");
                a_del.campi.push("campo_offerta");
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("campo_offerta_KgL_sconto");
                a_del.campi.push("campo_offerta_KgL");
                a_del.campi.push("stringa_etto");
                a_del.campi.push("prezzo_offerta_etto_EURprima");
                a_del.campi.push("campo_offerta_etto");
                a_del.campi.push("quantitativi");
                a_del.campi.push("M_MM");
                a_del.campi.push("gruppo_PezzConf");
                a_del.campi.push("prezzo_NOofferta_1pezzo_EURprima");
                a_del.campi.push("prezzo_offerta_secondo_EURprima");
                a_del.campi.push("sy_2x1");
            }
            else if (meccanica.indexOf("_evento") >= 0) {
                a_del.campi.push("sconto_effettivo_grande");
                if (meccanica.indexOf("_ofalkg") >= 0) {
                    var a_ch = { tipo: "binding", campo_indd: "campo_offerta_KgL_sconto", campo_dato: "campo_offerta_conf_sconto", mappa_stile: "campo_offerta_conf_sconto" };
                    obj.azioni.push(a_ch);

                    var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_KgL", mappa_stile: "prezzo_offerta_KgL" };
                    obj.azioni.push(a_ch2);
                }

            }
        }

        if ((this.cercaChiaveValore("materiale", "INT", contesto_promo) || this.cercaChiaveValore("materiale", "RIL", contesto_promo)) && (meccanica.indexOf("_ofalkg") >= 0)) {
            var a_ch = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_KgL_EURprima", mappa_stile: "prezzo_offerta_KgL_EURprima" };
            obj.azioni.push(a_ch);
        }

        if ((this.cercaChiave("tema", contesto_promo).includes("LOC Mensile") || this.cercaChiave("tema", contesto_promo).includes("LOC 1a DATA") || this.cercaChiave("tema", contesto_promo).includes("LOC 2a DATA")) && meccanica != "validita") {
            if (meccanica.indexOf("_boxetto") < 0) {
                a_del.campi.push("sy_etto");
            }
            else {
                a_del.campi.push("sconto_fid");

                if (meccanica.indexOf("TP_MM") >= 0 || meccanica.indexOf("PERCENTO_MM") >= 0 || meccanica.indexOf("sir_sconto") >= 0) {
                    var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_etto", mappa_stile: "prezzo_offerta_etto" };
                    obj.azioni.push(a_ch2);

                    var a_ch3 = { tipo: "binding", campo_indd: "campo_offerta", campo_dato: "campo_offerta_etto", mappa_stile: "campo_offerta_etto" };
                    obj.azioni.push(a_ch3);
                }
            }

            if (meccanica.indexOf("NM_") >= 0) {
                if (meccanica.indexOf("_FID") < 0) {
                    a_del.campi.push("LBL_Carte");
                }
            }
            else {
                if (meccanica.indexOf("TP_FID") < 0 && meccanica.indexOf("sir_sconto") < 0) {
                    a_del.campi.push("sconto_effettivo");
                }
            }

            if (this.cercaChiave("tema", contesto_promo).includes("LOC Mensile")) {
                a_del.campi.push("Triangolo_VAL");
            }
        }

        if ((this.cercaChiave("materiale", contesto_promo).includes("BASSI&FISSI") && meccanica != "validita") || allEtichette.includes("IS BASSI E FISSI") >= 0) {
            
            if (this.cercaChiave("materiale", contesto_promo).includes("ISTITUZIONALE"))

                if (meccanica.indexOf("TP_MM") >= 0) {
                    var a_color2 = { tipo: "color", campo_indd: "sy_euro", colore: "Nero_Prezzi" };
                    obj.azioni.push(a_color2);
                }
                else if (meccanica.indexOf("sir_sconto") >= 0) {
                    var a_color2 = { tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" };
                    obj.azioni.push(a_color2);
                    var a_color3 = { tipo: "color", campo_indd: "prezzo_offerta", colore: "Rosso prezzi" };
                    obj.azioni.push(a_color3);
                }

                if (meccanica.indexOf("_boxetto") < 0) {
                    a_del.campi.push("gruppo_etto");

                }
                else {
                    var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta", campo_dato: "prezzo_offerta_etto", mappa_stile: "prezzo_offerta_etto" };
                    obj.azioni.push(a_ch2);

                    var int2 = { tipo: "pos", campo_indd: "prezzo_offerta_gruppo", offset: [-3, 0] };
                    obj.azioni.push(int2);

                    var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                    obj.azioni.push(a_color4);
                }

                if (canale == "SC") {
                    var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_B&F_SC" };
                    obj.azioni.push(a_eff);
                }
                else {
                    var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_B&F" };
                    obj.azioni.push(a_eff);
                }

            }
        }

        if (meccanica.indexOf("_FID") < 0 && meccanica.indexOf("PUNTI") < 0) {
            a_del.campi.push("LBL_Titolari");

            if (canale == "SC" && objRef.codiceBox != "BOX41") {
                a_del.campi.push("PIEDE_Titolari");
                if (meccanica.indexOf("sdb") < 0 && meccanica.indexOf("bdp") < 0) {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                    obj.azioni.push(a_border);
                }
            }
        }

        if ((this.cercaChiaveValore("materiale", "INT", contesto_promo) || this.cercaChiaveValore("materiale", "RIL", contesto_promo)) && meccanica.indexOf("TP_MM") >= 0 && objRef.codiceBox != "BOX41") {
            a_del.campi.push("prezzo_offerta_gruppo");
        }

        //Eccezzione 50al50
        if (grafica_50al50  && meccanica.indexOf("PERCENTO_FID_ALL_KgL") >= 0) {
            var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie 50al50FID" };
            obj.azioni.push(a_color);
            var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie 50al50FID" };
            obj.azioni.push(a_color2);
        }

        //Modifica del 11/05/2021 - spariscono tutte le linee e le tracce base
        var bdp_sdb_distintivita = (tipo_tema.indexOf("_focus") < 0 && (meccanica.indexOf("_sdb") >= 0 || meccanica.indexOf("_bdp") >= 0));

        if (objRef.codiceBox != "BOX41" && canale != "SC" && meccanica.indexOf("_minicoll") < 0 && meccanica.indexOf("_bonus") < 0 && !bdp_sdb_distintivita) {
            a_del.campi.push("linee");
            var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
            obj.azioni.push(a_border);
        }

        //Modifica del 11/05/2021 - spariscono tutte le linee e le tracce base

        //Modifica 27/05/2021 - Aggiungo l'effetto bagliore a tutte le basi NO SC
        if (canale != "SC" && meccanica.indexOf("_bonus") < 0 && meccanica.indexOf("_minicoll") < 0 && !bdp_sdb_distintivita) {
            a_del.campi.push("linee");
            if (objRef.codiceBox != "BOX41") {
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base" };
                obj.azioni.push(a_eff);
            }
        }
        else if (canale != "SC" && meccanica.indexOf("_bonus") < 0 && bdp_sdb_distintivita) {
            if (meccanica.indexOf("_sdb") >= 0) {
                //alert("bagliore_base_SDB");
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_SDB" };
                obj.azioni.push(a_eff);
            }
            else if (meccanica.indexOf("_bdp") >= 0) {
                //alert("bagliore_base_BDP");
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_BDP" };
                obj.azioni.push(a_eff);
            }
        }

        if (isMeccanicaIncompleta(meccanica)) {
            a_del.campi.push("linea");
            a_del.campi.push("gruppo_sconto");
            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("prezzo_offerta_gruppo");
            a_del.campi.push("prezzo_offerta_EURprima");
            a_del.campi.push("campo_offerta");
            a_del.campi.push("sconto_effettivo_grande");
            a_del.campi.push("campo_offerta_KgL_sconto");
            a_del.campi.push("campo_offerta_KgL");
            a_del.campi.push("rect_tipico");
            a_del.campi.push("rect_etto");
            a_del.campi.push("stringa_etto");
            a_del.campi.push("prezzo_offerta_etto_EURprima");
            a_del.campi.push("campo_offerta_etto");
            a_del.campi.push("quantitativi");
            a_del.campi.push("M_MM");
            a_del.campi.push("gruppo_PezzConf");
            a_del.campi.push("prezzo_NOofferta_1pezzo_EURprima");
            a_del.campi.push("prezzo_offerta_secondo_EURprima");
            a_del.campi.push("sy_2x1");
            if (meccanica == "solo_descr") {
                a_del.campi.push("parentesi_BeF");
                a_del.campi.push("sy_ombra");
                a_del.campi.push("boxDescrPrezzi_ORI_TERRITORIO");
            }


            obj.isInvalida = true;

        }

        //cerco se c'è un veicolamento da campo_offerta_kgL_sconto a campo_offerta_KgL
        for (var $va in obj.azioni) {
            if (obj.azioni[$va].tipo == "binding" &&
                obj.azioni[$va].campo_indd == "campo_offerta_KgL_sconto" &&
                obj.azioni[$va].campo_dato == "campo_offerta_KgL"
            ) {
                if (objRef.codiceBox == "BOX9" || objRef.codiceBox == "BOX2") {
                    var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.537, 0, 0] };
                    obj.azioni.push(int3);
                }
                else {
                    var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.791, 0, 0] };
                    obj.azioni.push(int3);
                }
                break;
            }

        }
        obj.azioni.push(a_del);

        return obj;

    },

    cercaChiaveValore(key, value, array){
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] != undefined && array[i][key] == value) {
                return true;
            }
        }
        return false;
    },

    cercaChiave(key, array){
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i][key] != undefined) {
                return array[i][key];
            }
        }
        return null;
    },   
    
    assegnaNuovoValore(key, value, array){
        for (var i = 0; i < array.length; i++) {

            if (array[i][key] != undefined) {
                array[i][key] = value;
                return array;
            }
        }
        return array;
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

function readFile(filePath) {
    try {
        // Leggi il contenuto del file
        let content = fs.readFileSync(filePath, 'utf8');
        // Deserializza i dati JSON
        let data = JSON.parse(content);
        console.log(data);

        return data;
    }
    catch {
        return null;
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