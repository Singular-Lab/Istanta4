//Trea
const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions } = require('indesign');
//const MAIN_fixFoto = require('./fotoFix');
const { FotoPlacer, Utility } = require('./utility');
const GarbageCollector = require('./garbageCollector');
const ficoProcess = require('./ficoProcess');
const CssFramework = require('../../CssFramework');

const customAgenzia={
    listaElementiCestinati : [],
    mappaStili : null,
    tipoMappaStili : 0, //1 vol 2 pop
    labelModifcabili : ["prezzo_offerta<CPREZ_Sconto_Euro_SC>","prezzo_offerta<CPREZ_Sconto_Virgola_SC>","prezzo_offerta<CPREZ_Sconto_Cent_SC>"],
    tipiFotoExtra : [{val: 2, nome: "Bollini"},{val: 3, nome: "Loghi"},{val: 4, nome: "Foto ambientate"}, {val: 5, nome: "Sfondo"}],
    filtroRicerca : [
        {tree: "recordInTracciato", field: "sigla_reparto", label: "Reparto", tipoValori:"string"},
        {tree: "recordInTracciato", field: "descrizione_reparto", label: "Des. reparto", tipoValori:"string"},
        {tree: "recordInTracciato", field: "tema", label: "Tema", tipoValori:"string"},
        {tree: "recordInTracciato", field: "fluff", label: "Fluff", tipoValori:"string"},
        {tree: "recordInTracciato", field: "descrizione_settore", label: "Descrizione settore", tipoValori:"string"}
    ],

    schemiDescrizioni: [{
        schema: ["START$DESCRIZIONE_TITOLO_SP", "START$DESCRIZIONE_BRAND_SP", "START$DESCRIZIONE_TIPO_SP", "START$DESCRIZIONE_GRAMMATURA_SP"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_TIPO", "START$DESCRIZIONE_GRAMMATURA"],
        setRegole: [[]],
    }
    ],

    nomeFotoPrimaria: "immagine",
    nomeFotoSecondarie: "foto_secondaria",
    fotoNotFound:"fotoNoFound.png",
    nomeNoFoto:"nofoto.png",
    pathLoghi:"/Links/Loghi",
    listaStiliUniversali: [
        { nome: "DESCRIZIONE_TITOLO", rule: "IN$TITOLO", fondamentale: "descrizione1" },
        { nome: "DESCRIZIONE_BRAND", rule: "IN$BRAND", fondamentale: "descrizione2" },
        { nome: "DESCRIZIONE_TIPO", rule: "IN$TIPO", fondamentale: "descrizione3" },
        { nome: "DESCRIZIONE_GRAMMATURA", rule: "IN$GRAMMATURA", fondamentale: "descrizione4" }],


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
    filtro_mecc_invalide: "",
    simboli : {},
    campiSoggettiAOverflow:[{label:"descrizione",h:"bottom", w:"right"}],

    area: null,
    canale: null,
    codiceFormato: null,
    campiFiltro:[
        {
            nomeCampoVisualizzato:"Categoria",
            campoAssociato:"categoria",
            tendina:true
        },
        {
            nomeCampoVisualizzato:"Area",
            campoAssociato:"area",
            tendina:true
        },
        {
            nomeCampoVisualizzato:"Codice",
            campoAssociato:"Scatto.CodiceGruppo",
            tendina:false
        },
        {
            nomeCampoVisualizzato:"EAN",
            campoAssociato:"Referenza.Ean",
            tendina:false
        },
        {
            nomeCampoVisualizzato:"In Copertina",
            campoAssociato:"copertina",
            tendina:true
        },
        {
            nomeCampoVisualizzato:"Note",
            campoAssociato:"note",
            tendina:false
        }
    ],
    listCampiConfrontoBypass: ["prezzo_promo", "prezzo_promo_kgl", "txt_sconto"],


    bindRefData: function(box, oggetto, pathLavorazione, boxInGrigliaBounds) {

        var wBOX_mastro = boxInGrigliaBounds[3] - boxInGrigliaBounds[1];
        var hBOX_mastro = boxInGrigliaBounds[2] - boxInGrigliaBounds[0];


        var wBOX = box.visibleBounds[3] - box.visibleBounds[1];
        var hBOX = box.visibleBounds[2] - box.visibleBounds[0];

        this.ridimensionamento(wBOX, hBOX, wBOX_mastro, hBOX_mastro, box);

        return box;

        try
        {
            if (this.mappaStili == null || this.tipoLavorazione != this.tipoMappaStili) {
                this.mappaStili = readFile(pathLavorazione + "/mappaStili"+ (this.tipoLavorazione == 1 ? "" : "PoP" )+".json");
                this.tipoMappaStili = this.tipoLavorazione;
            }  

            if(this.tipoLavorazione == 1){
                var res = this.getRefInBox_provvisorio(oggetto, box, boxInGrigliaBounds, pathLavorazione, []);
            }
            else{
                var res = this.getRefInBox_provvisorioPOP(oggetto, box, pathLavorazione, []);
            }
        }
        catch (error) {
            console.error(error);
            return null;
        }

        return res[2];      
    },

    bindRefDataCompiled: function(box, oggetto, pathLavorazione, boxInGrigliaBounds) {

        var wBOX_mastro = boxInGrigliaBounds[3] - boxInGrigliaBounds[1];
        var hBOX_mastro = boxInGrigliaBounds[2] - boxInGrigliaBounds[0];


        var wBOX = box.visibleBounds[3] - box.visibleBounds[1];
        var hBOX = box.visibleBounds[2] - box.visibleBounds[0];

        //this.ridimensionamento(wBOX, hBOX, wBOX_mastro, hBOX_mastro, box);

        return box;
        try
        {
            if(this.tipoLavorazione == 1){
                var res = this.getRefCompiledInBox_provvisorio(oggetto, box, boxInGrigliaBounds, pathLavorazione, []);
            }
            else{
                var res = this.getRefCompiledInBox_provvisorioPOP(oggetto, box, pathLavorazione, []);
            }
        }
        catch (error) {
            console.error(error);
            return null;
        }

        return res[2];      
    },

    impaginazioneFotoExtraCustom(imgName, tipo, box, pathLavorazione, objItem, sigla){
        return null;
        var doc = app.activeDocument;
        if (imgName.split(".")[1] == "idms") {
            var path = pathLavorazione + "/Links/Loghi/" + imgName;
            let syObj = null;
            if (this.simboli[sigla] == null || !this.simboli[sigla].isValid) {
                //Cerco in pagina 1 se ho già impaginato il simbolo
                var pag0 = doc.pages.item(0);
                for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                    var item = pag0.allPageItems[i2];
                    if (item.label == "simbolo$" + imgName + "$tipo_" + tipo) {
                        this.simboli[sigla] = item;
                        break;
                    }
                }

                if (this.simboli[sigla] == null || !this.simboli[sigla].isValid) {
                    let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                    objDms.label = "simbolo$" + imgName + "$tipo_" + tipo;
                    this.simboli[sigla] = objDms[0];
                }
            }
            syObj = this.simboli[sigla];
            var sy = syObj.duplicate(box.parentPage);
            sy.move(doc.layers.itemByName("InPagina"));
            //muoviamo sy nell'angolo in alto a sinistra del box
            sy.move([box.visibleBounds[1], box.visibleBounds[0]]);
            console.log("Ho aggiunto a g_new_all " + sy.label);
            sy.label = "foto_extra$" + imgName + "$tipo_" + tipo;
            sy.bringToFront();

            if (sigla == "logo_attributo_it") {
                try {

                    var pos = [box.geometricBounds[1] + 10, box.geometricBounds[0] + 10];


                    if (sy != null) {
                        
                        sy.move(pos);
                        
                        sy.textFrames.item(0).contents = objItem.logo_attributo_it.replace("<br>", "\n");
                    }

                }
                catch (error) {
                    //Dovrei mettere no_foto   
                    console.error("IDMS ERROR " + error.message);
                }

            }

            return sy;
        }

        return null;
    },

    rimuoviSimboli(){
        for (var key in this.simboli) {
            if (this.simboli[key] != null && this.simboli[key].isValid) {
                this.simboli[key].remove();
            }
        }

        this.simboli = {};
    },

    setBolloNOFOTO(name){
        this.nomeNoFoto = name;
    },

    setBolloFOTONOFOUND(name){
        this.fotoNotFound = name;
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

    getStileForField(mastro_p, nome_field, codiceBox, isMZLOC, canale) {

        var mastro = mastro_p; 
        if (canale == "SC" && codiceBox!="BOX40")
            mastro = mastro_p + "_SC";

        let sty = null;
        if (this.mappaStili != null){
            sty = this.mappaStili.find(f=>f.meccanica == mastro && f.nome_campo == nome_field);
            // var sty = customAgenzia.getStileForField(oggetto.meccanica /*+ suffix_plus*/, nome_proprieta, oggetto["codiceBox"]);
        }

        //console.error("analizzo cod " + mastro);
        if (sty != null) {
            //console.error("ritorno " + mastro + "_" + nome_field);
            var res = sty["stile"];
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
                //console.error(new_mecc+"_" + nome_field);
                //console.error("ritorno 2 " + new_mecc + "_" + nome_field);
                if (this.mappaStili != null){
                    sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                    
                }
                if (sty != null) {
                    //console.error("ritorno " + mastro + "_" + nome_field);
                    var res = sty["stile"];
                    return res ;
                }
                if (sty ==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                }
    
                if (sty != null) {
                    //console.error("ritorno " + mastro + "_" + nome_field);
                    var res = sty["stile"];
                    return res ;
                }
            }
            var inx_territorio = mastro.indexOf("_territorio");
            if (inx_territorio > inx) {
                var new_mecc = mastro.replace("_territorio", "");
                new_mecc = new_mecc.substr(0, inx) + "_territorio" + new_mecc.substr(inx);
                //console.error(new_mecc+"_" + nome_field);
                //console.error("ritorno 2 " + new_mecc + "_" + nome_field);
                sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                if (sty==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                }
    
                if (sty != null) {
                    //console.error("ritorno " + mastro + "_" + nome_field);
                    var res = sty["stile"];
                    return res ;
                }
            }
            var inx_nori = mastro.indexOf("_inostriori");
            if (inx_nori > inx) {
                var new_mecc = mastro.replace("_inostriori", "");
                new_mecc = new_mecc.substr(0, inx) + "_inostriori" + new_mecc.substr(inx);
                //console.error(new_mecc+"_" + nome_field);
                //console.error("ritorno 2 " + new_mecc + "_" + nome_field);
                sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                if (sty==null && new_mecc.indexOf("_SC_") > 0) {
                    new_mecc = new_mecc.replace("_SC", "");
                    sty = this.mappaStili.find(f=>f.meccanica == new_mecc && f.nome_campo == nome_field);
                }
    
                if (sty != null) {
                    //console.error("ritorno " + mastro + "_" + nome_field);
                    var res = sty["stile"];
                    return res ;
                }
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
        //console.error(leader);
        if (leader > 0) {
            var disoss = mastro.substring(0, leader);
            var res = mastro.replace(disoss, "TP_MM");
            sty = this.mappaStili.find(f=>f.meccanica == res && f.nome_campo == nome_field);
            if (sty != null) {
                //console.error("ritorno " + mastro + "_" + nome_field);
                var res = sty["stile"];
                return res ;
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
            //scorriamo ctrl e applichiamo ad ogni carattere lo stile nessuno
            for (var i = 0; i < ctrl.characters.length; i++) {
                ctrl.characters.item(i).appliedCharacterStyle = app.activeDocument.characterStyles.item("[Nessuno]");
            }

    
            //console.error(ctrl.label + " set parag to " + paragraph.name + " " + ctrl.paragraphs.length);
            if (paragraph != null && ctrl.paragraphs.length > 0) {
                ctrl.paragraphs.item(0).appliedParagraphStyle = paragraph;
            }
    
        }
        catch (error) {
            console.error(error);            
        }
    
    },

    customDeclinazioneMeccanica(itemRef){
        return "meccaniche";
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

    getBase(item, box) {
        var base = null;
        if (box.label == "BOX2" || box.label == "BOX62") {
            if (item.label == "gruppo_inostriori_territorio") {
                base = item;
            }
        }
        else {
            if (item.label.indexOf("base") == 0 || item.label.startsWith("base")) {
                base = item;
            }
        }

        return base;
    },

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
        listSpecialCharacters = [ {chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "LSINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "LSINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}   ];

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
            console.error(e);
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

    getModeConfronto(){
        return 2; //modalità a riempimento
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
        return "";

        var stringPath = rootPath + ".listFiltri[" + $f + "].Criteri[" + inxCriterio + "]";
        return stringPath + ".Chiave=tipo_volantino&" + stringPath + ".Operatore=0&" + stringPath + ".Valore=V - volantino&";
    },
    //Funzione che torna dei dettagli di impaginazione nel proceso di CONTEGGIO per poter destinare alcune ref in spazi ben precisi
    requiresIngombro(itemRef)
    {
        return "";
        console.log("#requiresIngombro -> ");
        console.log(itemRef);
        if (itemRef["ruolo"].toLowerCase().indexOf("vedette")>=0)
        {
            return "vedette";
        }
        else if (itemRef["ruolo"].toLowerCase().indexOf("star")>=0)
        {
            return "star";
        }
        else
        {
            return "";
        }
    },
    //Funzione che torna dei dettagli di impaginazione nel proceso di CONTEGGIO per poter suggerire decisioni
    getInfoExtra(itemRef)
    {
        var string = "\n";
        string += "Reparto: " + itemRef["categoria"]+ "\n";
        return string;
    },
    //Funzione che aggiunge etichette custom al processo core di etichettatura ref
    getEtichette(itemRef){

        return [];
        let etichetteCustom = [];   
        if (itemRef["ruolo"].toLowerCase().indexOf("vedette")>=0)
        {
            etichetteCustom.push("VEDETTE");
        }
        else if (itemRef["ruolo"].toLowerCase().indexOf("star")>=0)
        {
            etichetteCustom.push("STAR");            
        }

        return etichetteCustom;
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
                try
                {
                    var imgName = item.images.item(0).itemLink.name
                    //cerchiamo nel gruppo l'elemento con "Foto.nome" = imgName e mettiamo il guidid in resObj.foto
                    var el = elementiGruppo.find(f=>f.recordInTracciato["Foto.Nome"] == imgName);
                    if(el != null){
                        resObj.foto.push(el.recordInTracciato["Foto.guidid"]);
                    }
                    else{
                        resObj.errors.push("L'immagine " + imgName + " non è stata trovata negli elementi del gruppo");
                    }
                }
                catch(e){
                    console.error("ERROR " + item.label);
                    console.error(element);
                    console.error(e);
                }

                continue;
            }

            if (item.label != null && item.label != "") {

                if(item.constructor.name == "TextFrame"){
                    resObj.customData[item.label] = {content:item.contents, contentHtml:""};//"";//item.contents;
                    let _html="";

                    let lastStyle="";
                    

                    for (let c=0; c<item.characters.length; c++){
                        let ch = item.characters.item(c);
                        if (ch.appliedCharacterStyle != null)
                        {

                            let nomeStyle=ch.appliedCharacterStyle.name;

                            if (nomeStyle != lastStyle){
                                if (lastStyle != ""){
                                    _html += "</" + lastStyle + ">";
                                }

                
                                _html += "<" + nomeStyle + ">";
                                

                                lastStyle = nomeStyle;
                            }
                        }
                        else
                        {
                            //Carattere non valido!
                        }

                        _html += ch.contents;
                    }

                    if (lastStyle!=""){
                        _html += "</" + lastStyle + ">";
                    }

                    resObj.customData[item.label].contentHtml = _html;

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

        resObj.customData.settore=element.recordInTracciato.descrizione_settore
        resObj.customData["descrizione_reparto"] = element.recordInTracciato["descrizione_reparto"];
        resObj.codice=element.recordInTracciato["Referenza.Codice"];
        resObj.codice_gruppo=element.recordInTracciato["Scatto.CodiceGruppo"];

        resObj.codiceBox = label.split("$")[1];

        //controlliamo l'appledMaster della pagina di indesign
        var appliedMaster = pageItem.appliedMaster;
        if (appliedMaster != null) {
            resObj.mastro = appliedMaster.name;
        }

        return resObj;
    },




    ///////////////////////////////////////////////////////////////CANTIERE/////////////////////////////////////////////////////////////
    contesto_promo : [],

    // svuotaCestino(){
    //     //rimuoviamo tutti gli oggetti dalla pagina contenuti nella lista globale listaElementiCestinati
    //     for (var i = 0; i < this.listaElementiCestinati.length; i++) {
    //         var item = this.listaElementiCestinati[i];
    //         if(item.isValid){
    //             item.remove();
    //         }
    //     }
    // },

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

    },

    getRefInBox_provvisorio(objItem, box, box_griglia_bounds, pathLavorazione = "", context = []) {
        
        this.contesto_promo = context;
        let myPage = box.parentPage;
        // var filePath = pathLavorazione + "/lavorazioni.json";
        // let lavorazioni = readFile(filePath);
        // //lavorazione è una lista di oggetti noi dobbiamo trovare qullo con la chiave file = al nome del file aperto di indesign
        // var lavorazione = lavorazioni.find(lavorazione => lavorazione.file == app.activeDocument.name);
        // if(lavorazione == null){
        //     console.error("Lavorazione non trovata");
        //     return;
        // }
        // //lavorazione.details è un oggetto che contiene le informazioni della lavorazione, li cerchiamo

        // var guidArea = lavorazione.details.guidArea;

        // var areaObj = getSourceAree().find(f=>f.guidID == guidArea);
        // if(areaObj == null){
        //     console.error("Area non trovata");
        //     return;
        // }

        // var area = areaObj.sigla;
        
        // var guidCanale = lavorazione.details.guidCanale;
        // var canaleObj = getSourceCanali().find(f=>f.guidID == guidCanale);
        // if(canaleObj == null){
        //     console.error("Canale non trovato");
        //     return;
        // }

        // var canale = canaleObj.sigla;
        var area = this.area;
        var canale = this.canale;

        var livelli_meccanica = new Array();
        recInTrac = objItem.recordInTracciato;

        //var meta_meccanica = parseMeccanica(obj.meccanica, filtro0_0.selection.text, obj.tema, filtro0.selection.text, obj.tipo_tema, obj.nota_category, obj.ruolo, obj.grafica_50al50);           
        var meta_meccanica = this.parseMeccanica_provvisorio(objItem, objItem.allEtichette, pathLavorazione, area, canale);
        var tema = this.cercaChiaveContesto("tema", this.contesto_promo);
        var materiale = this.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        tema = tema == null ? "" : tema;
        var isMZLOC = ((tema.indexOf("LOC") >= 0 && materiale == "MZ") || objItem.allEtichette.includes("MZLOC"));

        var doc = app.activeDocument;
        
        

        var wBOX_mastro = box_griglia_bounds[3] - box_griglia_bounds[1];
        var hBOX_mastro = box_griglia_bounds[2] - box_griglia_bounds[0];


        var wBOX = box.visibleBounds[3] - box.visibleBounds[1];
        var hBOX = box.visibleBounds[2] - box.visibleBounds[0];

    
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
        var fondoDaPosizionare = objItem["Foto.ExtraAuto"].find(f=>f.tipo == 5);

        var g_new_all = new Array();

        var loghiPerPosizionamentoInBoxOri = [];
        var sez_data = "Dal " + objItem.data_da + " al " + objItem.data_a;

        if(objItem.territorialita == null){
            objItem.territorialita = obj.distintivita;
        }

        for (var $xa = 0; $xa < box.allPageItems.length; $xa++) {
            var pItem = box.allPageItems[$xa];
            var nome_proprieta = pItem.label.replace("X_", "");

            var cestinato = false;

            if (nome_proprieta.indexOf("base") == 0) {
                if (nome_proprieta.indexOf("base_inostriori_territorio") == 0) {
                    pz_base_territorio = pItem;
                }
                else {
                    pz_base = pItem;
                }

                for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                    var mItem = meta_meccanica.azioni[a];


                    if ((mItem.tipo == "color" || mItem.tipo == "colorBkg") && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {


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
                            }


                        }
                        else {
                            pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                        }
                    }
                    else if (mItem.tipo == "border" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
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
                    else if(mItem.tipo == "unplace"){
                        pItem.graphics.item(0).remove();
                    }
                    else if (mItem.tipo == "effect" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                        this.applyObjectStyle(doc, pItem, mItem.name);
                    }
                }

                if (objItem.codiceBox == "solo_descr") {
                    obj_da_cestinare.push(pItem);
                }

                //nuovo pezzo per gli sfondi
                if (fondoDaPosizionare != null){

                }
                
            }
            else if (nome_proprieta == "immagine") {

                pzImg = pItem;
                
                if (objItem.codiceBox != "solo_descr") {
                    //assegnazione primarie e secondarie
                    try {
                        //if (objItem["Foto.Nome"] != null && objItem["Foto.Nome"] != "") {

                            var nomeFoto = objItem["Foto.Nome"];
                            FotoPlacer.placeFoto(nomeFoto, pItem);
                            pItem.label = this.nomeFotoPrimaria + objItem["Referenza.Codice"];
                        //}
                    }
                    catch (error) {
                        console.error("errore caricamento foto principale " + objItem["Foto.Nome"]);
                        console.error(error);
                        console.error(path);
                    }


                    var secondarie = 0;
                    var listFoto = [];
                    if (objItem.membriGruppoFoto!=null)
                    {
                        for (var i = 0; i < objItem.membriGruppoFoto.length; i++) {
                            var elemento = objItem.membriGruppoFoto[i];
                            if (elemento.statoSelezione == 2) {
                                //var path = pathLavorazione + "/Links/" + elemento.nomeFoto;
                                var nomeFoto = elemento.nomeFoto;
                                var offset_pos = 5 * (secondarie + 1);//(i_ragg+1)*5;
                                var bounds_rect = [pItem.geometricBounds[0] + offset_pos, pItem.geometricBounds[1] + offset_pos, pItem.geometricBounds[2] + offset_pos, pItem.geometricBounds[3] + offset_pos];
                                var photo = pItem.parentPage.rectangles.add(pItem.itemLayer, LocationOptions.UNKNOWN, box, { geometricBounds: bounds_rect });
                                listFoto.push(photo);
                                g_new_all.push(photo);
                                console.log("Ho aggiunto a g_new_all " + photo.label);

                                try {
                                    photo.label = "foto_secondaria$" + elemento.codRef;
                                    FotoPlacer.placeFoto(nomeFoto, photo);
                                    secondarie++;
                                    photo.itemLayer = app.activeDocument.layers.item("InPagina");
                                }
                                catch (err) {
                                    //eliminiamo la foto secondaria
                                    //photo.remove();
                                    obj_da_cestinare.push(photo);
                                    console.error(err);
                                    messaggioUtente("Foto secondaria " + elemento.recordInTracciato["Foto.Nome"] + " non posizionata, errore:" + err, "error")
                                }
                            }
                        }
                    }

                    // if (listFoto.length > 0) {
                    //     MAIN_fixFoto(listFoto, listFoto[0].geometricBounds);
                    // }


                    // if (xml_immagine != null) {
                    //     //immagini raggruppamento
                    //     var lista_immagini_raggruppate = xml_immagine.children();
                    //     if (lista_immagini_raggruppate.length() > 0) {
                    //         for (var i_ragg = 0; i_ragg < lista_immagini_raggruppate.length(); i_ragg++) {
                    //             try {
                    //                 var path_img = lista_immagini_raggruppate[i_ragg].attribute("href");//.toString().replace(".jpg",".psd");
                    //                 var path_assoluto = pathLavorazione + "/Links/" + path_img;


                    //                 var myY1 = box.visibleBounds[0] - (10 * (i_ragg + 1));
                    //                 var myX1 = box.visibleBounds[1] + (10 * (i_ragg + 1));

                    //                 var offset_pos = 5;//(i_ragg+1)*5;
                    //                 var bounds_rect = [pItem.geometricBounds[0] + offset_pos, pItem.geometricBounds[1] + offset_pos, pItem.geometricBounds[2] + offset_pos, pItem.geometricBounds[3] + offset_pos];
                    //                 var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, box, { geometricBounds: bounds_rect })
                    //                 g_new_all.push(rect);
                    //                 rect.label = "immagine_secondaria"
                    //                 var obj_temp = rect.place(File(path_assoluto));
                    //                 rect.fit(FitOptions.PROPORTIONALLY);
                    //                 rect.fit(FitOptions.FRAME_TO_CONTENT);
                    //                 rect.fillColor = "None";

                    //                 var img = obj_temp[0];
                    //                 var _h = img.visibleBounds[2] - img.visibleBounds[0];
                    //                 var _w = img.visibleBounds[3] - img.visibleBounds[1];
                    //             }
                    //             catch (error) {
                    //                 string_error += "errore caricamento foto selezionata : " + error.message + "\n";
                    //             }

                    //         }
                    //     }
                    // }

                    try{
                        if (objItem["Foto.ExtraAuto"] != null) {
                            for (var i = 0; i < objItem["Foto.ExtraAuto"].length; i++) {

                                if (objItem["Foto.ExtraAuto"][i].escluso == true) {
                                    continue;
                                }

                                if(objItem["Foto.ExtraAuto"][i].tipo == 5){
                                    continue;
                                }
                                var imgName = objItem["Foto.ExtraAuto"][i].nome;
                                var sigla = objItem["Foto.ExtraAuto"][i].sigla;
                                var tipo = objItem["Foto.ExtraAuto"][i].tipo;
                                var path = pathLavorazione + "/Links/Loghi/" + imgName;
                                //Controllo esstensine
                                //idms rappresenta un eccezione
                                //Deve essere caricato SOLO 1 VOLTA ew piazzato nella prima pagina in alto a sx
                                if (imgName.split(".")[1] == "idms") {

                                    let syObj = null;
                                    if (this.simboli[sigla] == null || !this.simboli[sigla].isValid) {
                                        //Cerco in pagina 1 se ho già impaginato il simbolo
                                        var pag0 = doc.pages.item(0);
                                        for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                                            var item = pag0.allPageItems[i2];
                                            if (item.label == "simbolo$" + imgName + "$tipo_" + tipo) {
                                                this.simboli[sigla] = item;
                                                break;
                                            }
                                        }

                                        if (this.simboli[sigla] == null|| !this.simboli[sigla].isValid) {
                                            let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                                            objDms.label = "simbolo$" + imgName + "$tipo_" + tipo;
                                            this.simboli[sigla] = objDms[0];
                                        }
                                    }
                                    syObj = this.simboli[sigla];
                                    var sy = syObj.duplicate(box.parentPage);
                                    sy.move(doc.layers.itemByName("InPagina"));
                                    //muoviamo sy nell'angolo in alto a sinistra del box
                                    sy.move([box.visibleBounds[1], box.visibleBounds[0]]);
                                    objItem["Foto.ExtraAuto"][i].referenceTo = sy;
                                    g_new_all.push(sy);
                                    console.log("Ho aggiunto a g_new_all " + sy.label);
                                    sy.label = "foto_extra$" + imgName + "$tipo_" + tipo
                                    sy.bringToFront();
                                }
                                else {
                                    var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, box, { geometricBounds: pItem.geometricBounds })
                                    g_new_all.push(rect);
                                    rect.label = "foto_extra$" + imgName + "$tipo_" + tipo;
                                    console.log("Ho aggiunto a g_new_all " + rect.label);
                                    rect.place(path);
                                    //rect.fit(FitOptions.PROPORTIONALLY);
                                    rect.fit(FitOptions.FRAME_TO_CONTENT);
                                    rect.fillColor = "None";
                                    objItem["Foto.ExtraAuto"][i].referenceTo = rect;
                                }
                            }
                        }
                    }
                    catch(e){
                        console.error("Errore caricamento foto extra");
                        console.error(e);
                    }

                }
                else {
                    obj_da_cestinare.push(pItem);
                }
            }
            else if (nome_proprieta == "descrizione") {

                pz_descrizione = pItem;

                var suffix_plus = "";
                if (materiale == "EV" && objItem.combinazioneAssegnata != "validita")
                    suffix_plus = "_evento";

                if (materiale == "ISTITUZIONALE" && objItem.combinazioneAssegnata != "validita")
                    suffix_plus = "_BFist";


                //ATTENZIONE
                //posizionare la descirizione allineandola a prezzo offerta TOP o 
                //SCONTO TOP se si tratta di meccanica percentuale o sir
                var descrizioni = null;
                if (objItem.descrizione_gruppo != null){
                    descrizioni = {
                        Descrizione1 : objItem.descrizione_gruppo["Descrizioni.Descrizione1"],
                        Descrizione2 : objItem.descrizione_gruppo["Descrizioni.Descrizione2"],
                        Descrizione3 : objItem.descrizione_gruppo["Descrizioni.Descrizione3"],
                        Descrizione4 : objItem.descrizione_gruppo["Descrizioni.Descrizione4"],
                        Peso : objItem["Descrizioni.Peso"],
                        Um : objItem["Descrizioni.Um"],
                    }
                }
                else{
                    descrizioni = {
                        Descrizione1 : objItem["Descrizioni.Descrizione1"],
                        Descrizione2 : objItem["Descrizioni.Descrizione2"],
                        Descrizione3 : objItem["Descrizioni.Descrizione3"],
                        Descrizione4 : objItem["Descrizioni.Descrizione4"],
                        Peso : objItem["Descrizioni.Peso"],
                        Um : objItem["Descrizioni.Um"],
                    }
                }


                var desc_1 = descrizioni.Descrizione1;
                while (desc_1.search("<br>") >= 0) {
                    desc_1 = desc_1.replace("<br>", "\n");
                }

                var desc_2 = descrizioni.Descrizione2.replace("<br>", "\n");
                while (desc_2.search("<br>") >= 0) {
                    desc_2 = desc_2.replace("<br>", "\n");
                }

                var desc_3 = descrizioni.Descrizione3;
                while (desc_3.search("<br>") >= 0) {
                    desc_3 = desc_3.replace("<br>", "\n");
                }

                var desc_4 = descrizioni.Descrizione4;
                while (desc_4.search("<br>") >= 0) {
                    desc_4 = desc_4.replace("<br>", "\n");
                }
                

                var no_str_etto = (objItem.combinazioneAssegnata.indexOf("_boxetto") < 0 || (canale == "SC" && objItem.combinazioneAssegnata.indexOf("PERCENTO_MM") >= 0 && objItem.combinazioneAssegnata.indexOf("ALL") < 0));

                try {
                    var bounds = pItem.geometricBounds;
                    var new_bound = bounds[2] + 100;
                    pItem.geometricBounds = [bounds[0], bounds[1], new_bound, bounds[3]];

                    var indice_desc = 0;
                    var desc_prog = "";

                    pItem.contents = "";

                    var mecc_stili = objItem.combinazioneAssegnata;
                    // if (obj.meccanica_stili != null && obj.meccanica_stili != "")
                    //     mecc_stili = obj.meccanica_stili;


                    //PRIMA IL REPARTO SE C'è
                    listRepartiDaInserire = [
                        33,31,29,27,25,21
                    ]

                        
                    if (pz_reparto != null && objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX21" && listRepartiDaInserire.indexOf(objItem.numero_reparto) >= 0) {
                        pItem.contents = pz_reparto.contents += "\n";

                        try {
                            var rp_parag = this.getStileForField(mecc_stili + suffix_plus, "Reparto_" + objItem.reparto + suffix_mxLOC, objItem.codiceBox, isMZLOC, canale);
                            if (rp_parag != "null"){
                                var pab = pz_reparto.contents.toLowerCase().indexOf("prodotti al banco");
                                if (pab >= 0) {
                                    var inx_pab = pab + "prodotti al banco".length;
                                    pItem.contents = pz_reparto.contents.substring(0, inx_pab) + "\n" + pz_reparto.contents.substring(inx_pab + 1);
                                }
                                
                                for (var r = 0; r < pItem.contents.length; r++){
                                    var ch = pItem.characters.item(r);
                                    var chRep = pz_reparto.characters.item(r);
                                    ch.appliedCharacterStyle = chRep.appliedCharacterStyle.name;
                                    ch.fillColor = chRep.fillColor.name;
                                    indice_desc = pItem.characters.length;
                                }
                                desc_prog = pItem.contents;
    
                                pItem.paragraphs.item(0).appliedParagraphStyle = rp_parag;
                            }

                        } catch (error) {
                            console.error(error);
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
                        if (desc_2 != "" || desc_3 != "" || (desc_4 != "" || !no_str_etto)) {
                            pItem.contents += "\n";
                            desc_prog += "\n";
                        }
                        //APPLICATO STILE ALLA DESCRIZIONE

                        var nome_stile = "";

                        nome_stile = this.getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_nome", objItem.codiceBox, isMZLOC, canale);

                        try {
                            for (var iz = indice_desc; iz < pItem.characters.length; iz++) {
                                pItem.characters.item(iz).appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                indice_desc = pItem.characters.length;
                            }
                        }
                        catch (error_d1) {
                            console.error("1. Non trovato lo stile descr_nome della meccanica " + objItem.codiceBox);
                        }
                    }
                    //BRAND
                    if (desc_2 != "") {

                        pItem.contents += desc_2;
                        desc_prog += desc_2;

                        if (desc_3 != "" || (desc_4 != "" || !no_str_etto)) {
                            pItem.contents += "\n";
                            desc_prog += "\n";
                        }


                        var nome_stile = "";

                        /*if (objItem.codiceBox == "solo_descr")
                            nome_stile = "x_Visione_soloDescr";
                        else*/
                        nome_stile = this.getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_marca", objItem.codiceBox, isMZLOC, canale);

                        try {

                            for (var iz = indice_desc; iz < pItem.characters.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<box.pageItems[$xa].characters.length; iz++)
                            {
                                pItem.characters.item(iz).appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                            }
                        }
                        catch (error_d2) {
                            console.error("2. Non trovato lo stile descr_marca della meccanica " + objItem.codiceBox);
                        }

                        indice_desc = pItem.characters.length;
                    }

                    //TIPO
                    if (desc_3 != "") {
                        pItem.contents += desc_3;
                        desc_prog += desc_3;

                        if ((desc_4 != "" || !no_str_etto)) {
                            pItem.contents += "\n";
                            desc_prog += "\n";
                        }

                        var nome_stile = "";

                        /*if (objItem.codiceBox == "solo_descr")
                            nome_stile = "x_Visione_soloDescr";
                        else*/
                        nome_stile = this.getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descr_tipo", objItem.codiceBox, isMZLOC, canale);

                        try {

                            for (var iz = indice_desc; iz < pItem.characters.length; iz++)//for (var iz=desc_1.length+1; iz<desc_1.length+desc_2.length; iz++)
                            {
                                pItem.characters.item(iz).appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                indice_desc = pItem.characters.length;
                            }
                        }
                        catch (error_d3) {
                            console.error("3. Non trovato lo stile descr_tipo della meccanica " + objItem.codiceBox);
                        }
                    }

                    //GRAMMATURA
                    var first_gramm_char_inx = -1;

                    //console.error(no_str_etto);

                    if (no_str_etto) {
                        //console.error("caso 1");

                        if (desc_4 != "") {

                            //console.error("Entro qui dentro");

                            var desc_4_copy = desc_4;

                            /*if (desc_prog != "") {
                                pItem.contents += "\n";
                                desc_prog += "\n";
                            }*/

                            var coeff_indice = 0;
                            if (desc_4.toLowerCase().indexOf("-<br2>al kg") == 0) {
                                pItem.contents += desc_4.replace("-<br2>", "");
                            }
                            else {
                                coeff_indice = 1;
                                pItem.contents += desc_4.replace("-<br2>", "\n");
                            }


                            desc_prog += desc_4;

                            var sty_error = "";
                            try {



                                var nome_stile = "";
                                var nome_stile_alkg = "";

                                nome_stile = this.getStileForField(mecc_stili + suffix_plus, "descr_gr", objItem.codiceBox, isMZLOC, canale);
                                nome_stile_alkg = this.getStileForField(mecc_stili + suffix_plus, "descr_alkg", objItem.codiceBox, isMZLOC, canale);
                                

                                sty_error = nome_stile;

                                first_gramm_char_inx = indice_desc;

                                var split_alkg = desc_4_copy.split("<br2>");
                                var prima_parte = split_alkg[0];
                                for (var iz = indice_desc; iz < pItem.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<box.pageItems[$xa].characters.length; iz++)
                                {
                                    pItem.characters.item(iz).appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile);
                                }

                                if (split_alkg.length > 1 && nome_stile_alkg != "null") {
                                    sty_error = nome_stile_alkg;
                                    var seconda_parte = split_alkg[1];
                                    for (var iz = indice_desc + prima_parte.length + coeff_indice; iz < pItem.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<box.pageItems[$xa].characters.length; iz++)
                                    {
                                        pItem.characters.item(iz).appliedCharacterStyle = doc.characterStyles.itemByName(nome_stile_alkg);
                                    }
                                }


                            }
                            catch (error_d4) {
                                //console.error(error_d4);
                                console.error("4. Non trovato lo stile " + sty_error + " della meccanica " + objItem.codiceBox);
                            }
                        }
                    }
                    else {
                        //console.error("caso 2");

                        var s_etto = objItem.stringa_etto;
                        var m_etto = "stringa_etto";
                        for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                            var mItem = meta_meccanica.azioni[a];

                            if (mItem.tipo == "binding" && mItem.campo_indd == "stringa_etto") {
                                //cambio del nome di proprietà
                                s_etto = objItem[mItem.campo_dato];
                                //console.error("cambio mappa stile per " + nome_proprieta + " in " + mItem.mappa_stile);
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
                        //console.error(indice_desc + " -> " + pItem.contents.length);
                        pItem.contents += s_etto;
                        //console.error(indice_desc + " -> " + pItem.contents.length);

                        //console.error("cerco descr_gr come" + m_etto + " contenuto " + s_etto);
                        var nome_stile = this.getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, m_etto, objItem.codiceBox, isMZLOC, canale);

                        try {



                            for (var iz = indice_desc; iz < pItem.contents.length; iz++) {
                                var ch = pItem.characters.item(iz);
                                if (ch.contents == "€" && objItem.combinazioneAssegnata.indexOf("_evento") < 0 && objItem.combinazioneAssegnata.indexOf("_inostriori") < 0 && objItem.combinazioneAssegnata.indexOf("_territorio") < 0) {
                                    //console.error("€ " + objItem.codiceBox);
                                    if (canale != "SC")
                                        ch.appliedCharacterStyle = doc.characterStyles.itemByName("EURO piccolo_Descr2_boxetto" + suffix_plus);
                                    else
                                    ch.appliedCharacterStyle = doc.characterStyles.itemByName("EURO piccolo_Descr2_boxetto_SC");
                                }
                                else
                                ch.appliedCharacterStyle = doc.characterStyles.itemByName("C" + nome_stile);

                            }


                        }
                        catch (error_d4) {
                            console.error("5. Non trovato lo stile " + nome_stile + " della meccanica " + objItem.codiceBox);
                        }


                    }

                    //console.error("Step 1");

                    // if (pz_reparto == null) {
                    //     try {

                    //         var pg_descr = this.getStileForField(/*obj.meccanica*/mecc_stili + suffix_plus, "descrizione", objItem.codiceBox, isMZLOC, canale);
                    //         //console.error("applico " + pg_descr);
                    //         pItem.paragraphs.item(0).appliedParagraphStyle = pg_descr;
                    //     } catch (error) { }
                    // }

                    if (first_gramm_char_inx > 0 && canale == "SC" && objItem.codiceBox != "BOX14_SC") {
                        pItem.characters.item(first_gramm_char_inx).leading = 10;

                    }

                    if (objItem.codiceBox.indexOf("BOX9") >= 0 /*|| objItem.codiceBox=="BOX2"*/) {
                        if (pz_reparto == null) {

                            bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                            y_allineamento_eliminazioni += 1;
                        }
                        else {
                            //console.error("set to -> " + bounds);
                            bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                            y_allineamento_eliminazioni += 1;
                        }
                    }


                    pItem.geometricBounds = bounds;

                    //console.error("descr test 3");
                    //console.error("real " + pItem.geometricBounds);

                    //console.error("Step 2");

                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                        var mItem = meta_meccanica.azioni[a];

                        if (mItem.tipo == "pos" && mItem.campo_indd == "descrizione") {
                            pItem.paragraphs.item(0).justification = mItem.align;
                            var w = pItem.geometricBounds[3] - pItem.geometricBounds[1];
                            var newX = box.geometricBounds[1] + mItem.absoluteX;

                            pItem.geometricBounds = [pItem.geometricBounds[0], newX, pItem.geometricBounds[2], newX + w];
                            gd = pItem.parent;
                            //console.error(gd);
                            break;
                        }

                    }



                    if (objItem.codiceBox.indexOf("BOX14") >= 0) {
                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] + y_allineamento_eliminazioni, pItem.geometricBounds[3]];
                        if (objItem.combinazioneAssegnata == "PUNTI_KgL_minicoll" || objItem.combinazioneAssegnata == "PUNTI_minicoll") {
                            var countchar = pItem.characters.length;
                            //console.error(tf.characters[countchar-1].baseline);
                            var offset = pItem.characters.item(countchar - 1).baseline - pItem.geometricBounds[0];
                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[0] + offset + 4, pItem.geometricBounds[3]];
                            //console.error(pItem.characters[countchar-1].baseline + " -> " + offset);
                        }
                    }
                    else if (objItem.codiceBox == "BOX41") {
                        try {
                            var limit_x_off = this.getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                            if (limit_x_off != 0) {
                                var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                            }
                        } catch (err) {
                            console.error("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                        }
                    }



                    //Per mettere il testo tutto visibile qualora fosse in overflow
                    var antiloop = 0;
                    while (pItem.overflows) {
                        var bound = pItem.geometricBounds;
                        if (objItem.codiceBox.indexOf("BOX9") < 0 /*&& objItem.codiceBox!="BOX2" && objItem.codiceBox!="BOX2_SC"*/)
                            pItem.geometricBounds = [bound[0] - 1, bound[1], bound[2], bound[3]];
                        else {
                            pItem.geometricBounds = [bound[0], bound[1], bound[2] + 1, bound[3]];
                            y_allineamento_eliminazioni += 1;
                        }

                        antiloop++;
                        if (antiloop > 30)
                            break;
                    }

                    if (canale == "SC" && objItem.codiceBox != "BOX41" && objItem.codiceBox.indexOf("BOX14") < 0) {
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
                    console.error("errore caricamento font descrizioni : " + error.message);
                }
                //}

                //Inserimento NOTE al campo descrizione per la segnalazione delel rispettive righe AVV
                if (objItem.note_category.indexOf("###") >= 0) {
                    var riga_avv = objItem.note_category.substring(objItem.note_category.indexOf("###") + 3);
                    this.inserisciNota(pItem, "rigaAVV", riga_avv);
                }

            }
            else if (nome_proprieta == "Triangolo_VAL_txt") {
                var data_validita = sez_data;

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
                if (tema.indexOf("LOC 1a") >= 0) {
                    pItem.fillColor = "Localismo 1a DATA";
                }
                else if (tema.indexOf("LOC 2a") >= 0) {
                    pItem.fillColor = "Localismo 2a DATA";
                }
            }
            else if (nome_proprieta == "Fascia_VAL") {
                var data_validita = sez_data;

                pz_rect_validita = pItem;

                if (tema.indexOf("LOC Mensile") < 0) {
                    pItem.contents = "";

                    if (tema.indexOf("LOC 1a") >= 0) {
                        pItem.fillColor = "Localismo 1a DATA";
                    }
                    else if (tema.indexOf("LOC 2a") >= 0) {
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
                            var h = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                            var offY = h - mItem.size[1];
                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] - offY, pItem.geometricBounds[3]];

                            break;
                        }
                    }
                }
            }
            else if (nome_proprieta == "fondo_distintivita") {
                if (fondoDaPosizionare != null) {
                    var path = pathLavorazione + "/Links/Loghi/" + fondoDaPosizionare.nome;
                    pItem.place(path);
                    pItem.fit(FitOptions.PROPORTIONALLY);
                    pItem.fit(FitOptions.FRAME_TO_CONTENT);
                    pItem.fillColor = "None";

                    fondoDaPosizionare = null;
                }                
            }
            else {
                try {
                    color = "";
                    //Da vedere in funzione di eventuali opzioni binding nei meta della meccanica
                    var flag_del = false;

                    var mappa_stile = nome_proprieta;

                    var nome_binding = "";
                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {

                        var mItem = meta_meccanica.azioni[a];

                        if (mItem.tipo != "del" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                            if (mItem.tipo == "binding") {
                                //cambio del nome di proprietà
                                nome_binding = mItem.campo_dato;
                                mappa_stile = mItem.mappa_stile;
                            }
                            else if (mItem.tipo == "color" || mItem.tipo == "colorBkg") {
                                color = mItem.colore;

                                try {
                                    if (nome_proprieta.indexOf("rect_") >= 0) {
                                        //Si tratta di rectangle
                                        pItem.fillColor = color;
                                    }
                                    else if (nome_proprieta == "linee" || nome_proprieta == "base") {
                                        //console.error("linee " + color);
                                        if (color != "transparent")
                                            pItem.strokeColor = color;
                                        else
                                            pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                                    }
                                    else {
                                        //si tratta di textframe
                                        for (var $c = 0; $c < pItem.contents.length; $c++) {
                                            pItem.characters.item($c).fillColor = color;
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
                                pItem.geometricBounds = [pItem.geometricBounds[0] + mItem.offset[1], pItem.geometricBounds[1] + mItem.offset[0],
                                pItem.geometricBounds[2] + mItem.offset[3], pItem.geometricBounds[3] + mItem.offset[2]];
                            }
                            else if (mItem.tipo == "resize") {
                                var w = mItem.size[0];
                                var h = mItem.size[1];
                                if (w == 0) {
                                    //Aumentare altezza bloccando parte bassa
                                    var h_elem = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                                    var offset = h - h_elem;

                                    if (pItem.geometricBounds[0] - offset < box.geometricBounds[0])
                                        offset -= (box.geometricBounds[0] - (pItem.geometricBounds[0] - offset));

                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0] - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2],
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                            else if (mItem.tipo == "file") {
                                var path = pathLavorazione + "/Links/Loghi/" + mItem.filename;
                                // if (path.exists)
                                    pItem.place(path);
                            }
                            else if (mItem.tipo == "effect" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                                this.applyObjectStyle(doc, pItem, mItem.name);
                            }
                        }
                        else if (mItem.tipo == "del") {
                            var del_rep = new Object();

                            for (var $c in mItem.campi) {
                                if (mItem.campi[$c] == nome_proprieta && del_rep[nome_proprieta] == null) {
                                    del_rep[nome_proprieta] = "ok";

                                    if (nome_proprieta == "prezzo_offerta_EURprima")
                                        eurPrima_eliminato = true;

                                    //console.error("del " + nome_proprieta + " " + eurPrima_eliminato);
                                    flag_del = true;
                                    if (pItem.label == "campo_offerta" || pItem.label == "campo_offerta_etto" || pItem.label == "sconto_effettivo" || pItem.label == "sconto_effettivo_grande" ||
                                        pItem.label == "campo_offerta_KgL" || pItem.label == "campo_offerta_KgL_sconto" || pItem.label == "LBL_Carte" || (pItem.label == "Range_Punti_2" && (objItem.codiceBox == "BOX30" /*MCPOINT v1.0 ||  objItem.codiceBox.indexOf("BOX14") >= 0 MCPOINT v1.0*/)) ||/*pItem.label=="prezzo_offerta_EURprima" ||*/
                                        (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") || (pItem.label == "gruppo_sconto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC")) || (pItem.label == "sy_etto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX20" || objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC")) || pItem.label == "PIEDE_Titolari" || (pItem.label == "prezzo_offerta_gruppo" && !eurPrima_eliminato)) {

                                        //console.error("eliminazione " + pItem.label + " è " + (pItem.geometricBounds[2] - pItem.geometricBounds[0]));
                                        if (objItem.codiceBox.indexOf("BOX9") >= 0 /*|| objItem.codiceBox=="BOX2" || objItem.codiceBox=="BOX2_SC"*/) {
                                            y_allineamento_eliminazioni -= (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                        }
                                        else {
                                            y_allineamento_eliminazioni += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                        }
                                        //console.error("elimino " + pItem.label + " -> " + y_allineamento_eliminazioni);
                                    }
                                    else if (pItem.label == "Range_Punti_2") {
                                        y_allineamento_sx += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                    }
                                    else if (pItem.label == "LBL_Titolari") {
                                        y_allineamento_top += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                                    }

                                    //console.error(y_allineamento_eliminazioni);
                                }
                            }
                        }
                    }


                    //if (objItem.combinazioneAssegnata.indexOf("sottocosto")>=0 && !flag_del )
                    //console.error(flag_del " considero nello spostamento " + pItem.label);
                    var vecchio_nome_proprieta = "";

                    // console.error(pItem.label);

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
                        //console.error("campo offerta NON da eliminare");
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
                    else if ((pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) && !flag_del) {
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
                    else if (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0) {
                        gd = pItem;
                        if (objItem.codiceBox.indexOf("BOX41") < 0)
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "rect_regionale" || pItem.label == "rect_tipico" || pItem.label == "rect_etto") {
                        pz_rect_regionale = pItem;
                        livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "sy_etto" && !flag_del) {

                        pz_alletto = pItem;
                        if (objItem.codiceBox == "BOX9" || objItem.codiceBox == "BOX20" /*|| objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC"*/)
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "sy_2x1") {
                        livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "boxDescrPrezziORI") {
                        pz_rect_DescrPrezziORI = pItem;
                    }
                    else if (nome_proprieta == "boxDescrPrezzi_ORI_TERRITORIO") {
                        if (objItem.codiceBox != "solo_descr")
                            pz_boxDescrPrezzi_ORI_TERRITORIO = pItem;
                    }
                    else if(fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn" && nome_proprieta == "PIEDE_Titolari"){
                        var boundsPiede = pItem.geometricBounds;
                        boundsPiede[0] = boundsPiede[0] -0.5;
                        boundsPiede[1] = boundsPiede[1] +0.7;
                        boundsPiede[2] = boundsPiede[2] -0.5;
                        boundsPiede[3] = boundsPiede[3] -0.7;
                        pItem.geometricBounds = boundsPiede;
                    }


                    if (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30" && !flag_del) {
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
                                var hor = pz_NOofferta_EURprima.characters.item(0).horizontalOffset;
                                ox = hor - gb[3];
                            }
                            else if (pItem.label == "PezzConf_NM") {
                                var hor = pz_offerta.characters.item(0).horizontalOffset;
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
                        if (objItem.codiceBox == "BOX30" /* MCPOINT v1.0 || objItem.codiceBox.indexOf("BOX14")>=0  MCPOINT v1.0*/)
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "Range_Punti_2" && !flag_del) {
                        if (objItem.codiceBox == "BOX30")
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
                        if (objItem.reparto == 33 ||
                            objItem.reparto == 31 ||
                            objItem.reparto == 29 ||
                            objItem.reparto == 27 ||
                            objItem.reparto == 25 ||
                            objItem.reparto == 21) {
                            livelli_meccanica.push(pItem);
                        }
                    }


                    // if (obj.codice=="2339273")
                    //console.error(pItem.label + " y del " + y_allineamento_eliminazioni);


                    //console.error(pItem.label + "  lvls" + livelli_meccanica.length + " -> " + y_allineamento_eliminazioni);

                    if (livelli_meccanica.length > 1 && objItem.codiceBox.indexOf("BOX9") < 0 /*&& objItem.codiceBox!="BOX2" && objItem.codiceBox!="BOX2_SC"*/) {
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
                            (pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) ||
                            pItem.label == "BIS_grafica" ||
                            pItem.label == "gruppo_sconto" ||
                            (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX9" && objItem.codiceBox != "BOX5"/*&& objItem.codiceBox != "BOX2" && objItem.codiceBox != "BOX2_SC"*/
                                && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0 && objItem.codiceBox.indexOf("BOX41") < 0) ||
                            (pItem.label == "LBL_Carte" /* MCPOINT v1.0*/ && objItem.codiceBox.indexOf("BOX14") < 0 /*MCPOINT v1.0*/) ||
                            pItem.label == "sy_2x1" ||
                            (pItem.label == "Range_Punti_1" && (objItem.codiceBox == "BOX30" || objItem.codiceBox.indexOf("BOX14") >= 0)) ||
                            (pItem.label == "Range_Punti_2" && (objItem.codiceBox == "BOX30" /*MCPOINT v1.0  || objItem.codiceBox.indexOf("BOX14") >= 0  MCPOINT v1.0*/)) ||
                            (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") ||
                            (pItem.label == "sy_etto" && (objItem.codiceBox == "BOX9" || objItem.codiceBox == "BOX20" /*|| objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC"*/))
                        ) {

                            //E' da riposizionare
                            var lastItem = livelli_meccanica[livelli_meccanica.length - 2];


                            var align = lastItem.geometricBounds;
                            var myH = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                            var newY = align[0] - myH;


                            if (pItem.label == "gruppo_sconto" && objItem.combinazioneAssegnata.indexOf("_boxetto") > 0 && objItem.codiceBox == "BOX6")
                                newY -= 1;


                            pItem.geometricBounds = [newY, pItem.geometricBounds[1], newY + myH, pItem.geometricBounds[3]];



                            if (pItem.label == "LBL_Carte") {
                                try {
                                    var gb = pItem.groups[0].geometricBounds;
                                    pItem.groups[0].geometricBounds = [newY, gb[1], newY + myH, gb[3]];
                                    for (var f = 0; f < pItem.groups[0].pageItems.length; f++) {
                                        pItem.groups[0].pageItems.item(f).fit(FitOptions.PROPORTIONALLY);
                                        pItem.groups[0].pageItems.item(f).fit(FitOptions.FRAME_TO_CONTENT);
                                    }
                                } catch (error) { }
                            }

                        }
                    }
                    else if (y_allineamento_eliminazioni != 0) {

                        //Sistemo i campi 
                        if (pItem.label == "prezzo_offerta_gruppo" ||
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
                            (pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) ||
                            pItem.label == "BIS_grafica" ||
                            pItem.label == "gruppo_sconto" ||
                            pItem.label == "gruppo_reparto" ||
                            (pItem.label == "LBL_Carte" && objItem.codiceBox.indexOf("BOX14") < 0) ||
                            (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20"
                                && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0 && objItem.codiceBox.indexOf("BOX41") < 0) ||
                            pItem.label == "sy_2x1" ||
                            (pItem.label == "Range_Punti_1" && (objItem.codiceBox == "BOX30"  /* MCPOINT v1.0 || objItem.codiceBox.indexOf("BOX14") >= 0 MCPOINT v1.0*/)) ||
                            (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") ||
                            (pItem.label == "sy_etto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX20" /*|| objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC"*/)) ||
                            pItem.label == "boxDescrPrezziORI"
                        ) {



                            if (pItem.label != "gruppo_descrizione") {

                                var offset = 0;

                                if (pItem.label == "gruppo_sconto" && objItem.combinazioneAssegnata.indexOf("PERCENTO") >= 0 && objItem.combinazioneAssegnata.indexOf("_ALL") < 0) {
                                    if (objItem.codiceBox == "BOX12")
                                        offset += 3;//6.75;
                                    else if (objItem.codiceBox == "BOX6")
                                        offset += 5.202;
                                    else if (objItem.codiceBox == "BOX1")
                                        offset += 6.575;
                                    else if (objItem.codiceBox == "BOX9")
                                        offset += 0;

                                }

                                if ((objItem.codiceBox.indexOf("BOX9") >= 0) && pItem.label == "boxDescrPrezziORI") {
                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0],
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] + y_allineamento_eliminazioni - offset - 2,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                                else {
                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0] + y_allineamento_eliminazioni - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] + y_allineamento_eliminazioni - offset,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                            else if (objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0) {

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
                                        pItem.geometricBounds[0] - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] - offset,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                        }
                    }
                    else if (y_allineamento_sx > 0) {
                        if (pItem.label == "Range_Punti_1" && objItem.codiceBox.indexOf("BOX14") >= 0) {
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

                    if (objItem[nome_proprieta] != null && objItem[nome_proprieta] != "") {
                        try {
                            if (pItem.label == "prezzo_offerta_gruppo") {
                                y_allineamento_descr = pItem.geometricBounds[0];

                                //console.error("nuovo allineamento a prezzo_offerta " + pItem.geometricBounds);
                            }
                            else if (pItem.label == "M_MM") {
                                //console.error("nuovo allineamento a M_MM " + pItem.geometricBounds);
                                y_allineamento_descr = pItem.geometricBounds[0];
                            }

                            var contenuto = objItem[nome_proprieta].toString();


                            if (pItem.label != "prezzo_offerta" && pItem.label != "prezzo_offerta_etto") {
                                pItem.contents = "";
                            }
                            else if (pItem.label != "prezzo_offerta_etto") {
                                if (objItem.codiceBox.indexOf("BOX9") < 0 /*&& objItem.codiceBox!="BOX2" && objItem.codiceBox!="BOX2_SC"*/) {
                                    //pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] - 10, pItem.geometricBounds[2], pItem.geometricBounds[3]];
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
                            //console.error(nome_proprieta + "=" + contenuto);

                            var suffix_plus = "";
                            if (materiale == "INT")
                                suffix_plus = "_INT";
                            if (materiale == "RIL")
                                suffix_plus = "_RIL";
                            if (materiale == "EV")
                                suffix_plus = "_evento";

                            if (materiale == "ISTITUZIONALE")
                                suffix_plus = "_BFist";

                            var sty = this.getStileForField(objItem.combinazioneAssegnata + suffix_plus, mappa_stile, objItem.codiceBox, isMZLOC, canale);
                            if (sty != "null") {
                                pItem.paragraphs.item(0).appliedParagraphStyle = sty;
                                //this.applyNeastedStyles(pItem, doc.paragraphStyles.itemByName(sty), color);
                            }

                        }
                        catch (error) {
                            console.error("errore caricamento font " + nome_proprieta + " : " + error);
                        }
                    }
                    else {

                        if (pItem.label != "" && pItem.label.indexOf("Reparto") < 0) {
                            if (pItem.label == "gruppo_descrizione" && objItem.codiceBox.indexOf("BOX41") >= 0) {
                                try {
                                    var limit_x_off = this.getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                                    if (limit_x_off != 0) {
                                        var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                                    }
                                } catch (err) {
                                    console.error("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                                }
                            }
                        }
                        else if (pItem.label.indexOf("Reparto") >= 0) {
                            if (objItem.descrizione_reparto != null) {
                                pItem.contents = objItem.dicitura_reparto;

                                var suffix_plus = "";
                                if (materiale == "ISTITUZIONALE")
                                    suffix_plus = "_BFist";
                                if (materiale == "EV" && objItem.codiceBox != "validita")
                                    suffix_plus = "_evento";

                                try {

                                    var suffix_mxLOC = "";
                                    if (isMZLOC) {
                                        suffix_mxLOC = "_LOC";
                                    }

                                    var rp_parag = doc.paragraphStyles.itemByName(this.getStileForField(objItem.combinazioneAssegnata + suffix_plus, "Reparto_" + objItem.reparto, objItem.codiceBox, isMZLOC, canale) + suffix_mxLOC);
                                    if (rp_parag.isValid) {
                                        var rp_char = rp_parag.nestedStyles.item(0).appliedCharacterStyle;
                                        for (var r = 0; r < pItem.contents.length; r++) {
                                            pItem.characters.item(r).appliedCharacterStyle = rp_char;
                                        }

                                        pItem.paragraphs.item(0).appliedParagraphStyle = rp_parag;

                                        if (pz_rect_validita != null) {
                                            try {
                                                var str = pItem.contents + "\n";
                                                if (pz_rect_validita.contents == "")
                                                    str = pItem.contents;

                                                var inx = str.length;
                                                pz_rect_validita.contents = str + pz_rect_validita.contents;

                                                var charVSty = pz_rect_validita.characters.item(0).appliedCharacterStyle;

                                                for (var $v = 0; $v < pz_rect_validita.contents.length; $v++) {
                                                    if ($v < inx)
                                                        pz_rect_validita.characters.item($v).appliedCharacterStyle = rp_char;
                                                    else
                                                        pz_rect_validita.characters.item($v).appliedCharacterStyle = charVSty;
                                                }
                                            } catch (error) { console.error(error); }
                                        }
                                        pz_reparto = pItem;
                                    }


                                    obj_da_cestinare.push(pItem);
                                    cimitero[pItem.label] = "ko";

                                } catch (error) { 
                                    console.error(error);
                                    console.error("Error 1608 -  Stile  carattere " + rp_char + " o stile paragrafo " + rp_parag + " non trovato (" + (objItem.codiceBox + suffix_plus) + "  Reparto_" + objItem.reparto + ")"); }
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
                    console.error("1624. " + error + " su " + nome_proprieta);
                    console.error(error);
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

                            if (lab == campo) {
                                obj_da_cestinare.push(pItem);
                                cimitero[pItem.label] = "ko";
                            }
                        }
                        break;
                    }
                }
            }

        }

        var skipFondo = false;
        if (fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn") {
            if (objItem.combinazioneAssegnata.indexOf("focus") > 0) {
                skipFondo = true;
            }
        }

        //creazione fondo
        if(fondoDaPosizionare != null && !skipFondo)
        {
            //creiamo un rectangle con geometricBounds uguali a pz_base
            var bounds = pz_base != null ? pz_base.geometricBounds : pz_base_territorio.geometricBounds;
            var rect = box.rectangles.add();
            //assegnamo lo stesso stondamento ai bordi di base al rettangolo
            //fondo da posizionare contiene il nome del file da posizionare
            var path = pathLavorazione + "/Links/Loghi/" + fondoDaPosizionare.nome;
            rect.place(path);
            rect.label = "nuovo_fondo_distintivita";
            //fit contenuto a cornice
            rect.sendToBack();

            if (pz_base != null) {
                pz_base.fillColor = "None";
            }
            else{
                pz_base_territorio.fillColor = "None";
            }
            if (fondoDaPosizionare.sigla == "sfondo_vn") {
                // Controlliamo se esiste il colore versonatura
                var myColor = app.activeDocument.colors.itemByName("versonatura");
                if (myColor == null) {
                    myColor = app.activeDocument.colors.add({
                        name: "versonatura", 
                        model: ColorModel.process, 
                        colorValue: [95, 36, 98, 35]
                    });
                }
            
                var radius = 3;
                
                if (pz_base != null) {
                    // Diamo un bordo di colore myColor
                    pz_base.strokeWeight = 2;
                    pz_base.strokeColor = myColor;
                    
                    pz_base.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
            
                    pz_base.bottomLeftCornerRadius = radius;
                    pz_base.bottomRightCornerRadius = radius;
                    pz_base.topLeftCornerRadius = radius;
                    pz_base.topRightCornerRadius = radius;
                    
                    // Rimuoviamo il colore di sfondo alla base
                    //pz_base.fillColor = "None";
                } else {
                    pz_base_territorio.strokeWeight = 2;
                    pz_base_territorio.strokeColor = myColor;
                    
                    pz_base_territorio.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base_territorio.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base_territorio.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                    pz_base_territorio.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
            
                    pz_base_territorio.bottomLeftCornerRadius = radius;
                    pz_base_territorio.bottomRightCornerRadius = radius;
                    pz_base_territorio.topLeftCornerRadius = radius;
                    pz_base_territorio.topRightCornerRadius = radius;
                    
                    // Rimuoviamo il colore di sfondo alla base
                    //pz_base_territorio.fillColor = "None";
                }
                
                rect.bottomLeftCornerRadius = radius;
                rect.bottomRightCornerRadius = radius;
                rect.topLeftCornerRadius = radius;
                rect.topRightCornerRadius = radius;
            
                rect.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                rect.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
                rect.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
                rect.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
            }
            
            rect.geometricBounds = bounds;
            rect.fit(FitOptions.CONTENT_TO_FRAME);
        }


        //Loghi

        //this.posizionamentoLoghiBolli();
        if (objItem["Foto.ExtraAuto"] != null) {

           
            var y_off_left = 0;
            var y_off_right = 0;
            //cerchiamo LOGO_bandiera_italiana  se lo troviamo spostiamolo primo in lista
            objItem["Foto.ExtraAuto"].sort(function (a, b) {
                // Controlla se "a" o "b" sono "LOGO_bandiera_italiana"
                if (a.sigla == "LOGO_bandiera_italiana") return -1;
                if (b.sigla == "LOGO_bandiera_italiana") return 1;
            
                // Controlla se "a" o "b" sono "logo_BassieFissi"
                if (a.sigla == "logo") return -1;
                if (b.sigla == "logo") return 1;
            
                // Mantieni l'ordine originale per tutto il resto
                return 0;
            });
            for (var i = 0; i < objItem["Foto.ExtraAuto"].length; i++) {
                var extra = objItem["Foto.ExtraAuto"][i];
                if(extra.tipo == 5){
                    continue;
                }
                if(extra.referenceTo == null)
                {
                    continue;
                }

                if (objItem.codiceBox != "BOX40") {
                    if (extra.sigla == "LOGO_bandiera_italiana" && !materiale.includes("ISTITUZIONALE")) {

                        try {
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];

                            var bounds_rect = [box.geometricBounds[0]+y_off_left, box.geometricBounds[1], box.geometricBounds[0]+7.366+y_off_left, box.geometricBounds[1]+14.309];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_left += 2 + h_logo;
                        } catch (error) { }
                    }

                    if (objItem.codiceBox.indexOf("BOX41") < 0) {
                        //Metto il logo se esiste
                        if ((extra.sigla == "dop" || extra.sigla == "igp") && materiale != "ISTITUZIONALE") {
                            try {
                                var h_dop_igp = 13.039;
                                var w_dop_igp = 13.039;

                                var bounds_rect = [box.geometricBounds[0] + y_off_left, box.geometricBounds[1], box.geometricBounds[0] + h_dop_igp + y_off_left, box.geometricBounds[1] + w_dop_igp];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                                logo_dop_igp = extra.referenceTo;


                                if (objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX62") {
                                    loghiPerPosizionamentoInBoxOri.push(extra.referenceTo);
                                }

                                y_off_left += 2 + h_dop_igp;
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }

                        //Metto il logo focus se esiste
                        if (extra.sigla == "Agriqualità" && materiale != "ISTITUZIONALE") {
                            try {

                                var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + 9.9, box.geometricBounds[1] + 12.02];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }
                    }
                    else{
                        if ((extra.sigla == "dop" || extra.sigla == "igp") && materiale != "ISTITUZIONALE") {
                            try {
                                var h_dop_igp = 13.039;
                                var w_dop_igp = 13.039;

                                var bounds_rect = [box.geometricBounds[0] + y_off_right, box.geometricBounds[1], box.geometricBounds[0] + h_dop_igp + y_off_right, box.geometricBounds[1] + w_dop_igp];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                                logo_dop_igp = extra.referenceTo;

                                y_off_right += 2 + h_dop_igp;
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }
                    }
                }

                var logo_sed_bound = [0, 0, 0, 0];

                if (objItem.codiceBox != "BOX40") {
                    if (extra.sigla == "logo_BassieFissi" && materiale != "ISTITUZIONALE") {

                        try {
                            //mettiamo il bound all'angolo destro del box + y_off_right
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            var w_logo = extra.referenceTo.geometricBounds[3] - extra.referenceTo.geometricBounds[1];
                            var bounds_rect = [box.geometricBounds[0] + y_off_right, box.geometricBounds[3] - w_logo, box.geometricBounds[0] + h_logo + y_off_right, box.geometricBounds[3]];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_right += 2 + h_logo;
                        }
                        catch (error) {
                            //Dovrei mettere no_foto
                        }
                    }

                    if (extra.sigla == "logo_attributo_it" != null && extra.sigla == "logo_attributo_it") {
                        try {

                            var pos = [box.geometricBounds[1] + 10, box.geometricBounds[0] + 10];


                            if (extra.referenceTo != null) {
                                
                                extra.referenceTo.move(pos);
                                
                                extra.referenceTo.textFrames.item(0).contents = objItem.logo_attributo_it.replace("<br>", "\n");
                            }

                        }
                        catch (error) {
                            //Dovrei mettere no_foto   
                            console.error("IDMS ERROR " + error.message);
                        }

                    }

                    //Metto la testata CONAD se è un prodotto conad
                    var listaProdottiConad = ["bio",
                        "saporidintornipq",
                        "saporiideepq",
                        "cpq",
                        "saporidintorni",
                        "saporiidee",
                        "kids",
                        "piacersi",
                        "aslattosio",
                        "asglutine",
                        "vn",
                        "parafarmacia",
                        "11p",
                        "baby",
                        "essentiae",
                        "petfrplus",
                        "petfr",
                        "logo"];
                    if (listaProdottiConad.includes(extra.sigla) && materiale != "ISTITUZIONALE") {
                        try {
                            //Le misure sono da considerarsi in millimetri

                            var x_offset = 0;
                            var y_offset = 0;
                            var w_offset = 20.997;
                            var h_offset = 11.599;

                            if (extra.sigla == "logo") {
                                w_offset = 21.378;
                                h_offset = 4.487;
                            }
                            else if (extra.sigla == "cpq") {
                                w_offset = 38.566;
                                h_offset = 6.562;
                            }
                            else if (extra.sigla == "kids") {
                                w_offset = 16.087;
                                h_offset = 14.647;

                            }
                            else if (extra.sigla == "piacersi") {
                                //w_offset = 20.997;//27.263;
                                h_offset = 10.245;//13.293;

                            }
                            else if (extra.sigla == "aslattosio") {
                                w_offset = 21.421;
                                h_offset = 9.779;
                            }
                            else if (extra.sigla.indexOf("saporidintorni") >= 0 || extra.sigla.indexOf("saporiidee") >= 0) {
                                w_offset = 14.139;
                                h_offset = 16.764;//11.599;
                            }
                            else if (extra.sigla == "vn") {
                                w_offset = 18.542;
                                h_offset = 12.446;
                            }
                            else if (extra.sigla == "parafarmacia") {
                                w_offset = 22.987;
                                h_offset = 5.165;
                            }
                            else if (extra.sigla == "11p") {
                                w_offset = 12.615;
                                h_offset = 13.547;
                            }
                            else if (extra.sigla== "baby") {
                                w_offset = 12.192;
                                h_offset = 9.737;
                            }
                            else if (extra.sigla == "essentiae") {
                                w_offset = 22.987;
                                h_offset = 8.467;
                            }
                            else if (extra.sigla.indexOf("petfr") >= 0) {
                                w_offset = 21.421;
                                h_offset = 10.837;
                            }




                            var y = box.geometricBounds[0] + 1;
                            var x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                            var h = y + h_offset;
                            var w = x + w_offset

                            bounds_rect2 = [y, x, h, w];


                            if (pz_lbl_titolari != null) {

                                if (canale == "SC") {
                                    if (extra.sigla == "cpq") {
                                        w_offset = 22.987;
                                        h_offset = 3.911;

                                        y = box.geometricBounds[0] + 1;
                                        x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                                        h = y + h_offset;
                                        w = x + w_offset;

                                        bounds_rect2 = [y, x, h, w];
                                    }

                                    var carte_titolo = pz_lbl_titolari.pageItems.item(0);
                                    var rect = pz_lbl_titolari.pageItems.item(1);
                                    if (carte_titolo.label == "Titolari_fascia") {
                                        carte_titolo = pz_lbl_titolari.pageItems.item(1);
                                        rect = pz_lbl_titolari.pageItems.item(0);
                                    }



                                    rect.move([rect.geometricBounds[1] - 25, rect.geometricBounds[0]]);


                                    var w_lbl = (box.geometricBounds[3] - box.geometricBounds[1]) - 25;
                                    var w_carte = carte_titolo.geometricBounds[3] - carte_titolo.geometricBounds[1];

                                    carte_titolo.move([box.geometricBounds[1] + ((w_lbl - w_carte) / 2), carte_titolo.geometricBounds[0]]);
                                }
                                else {
                                    y = box.geometricBounds[0] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 1 : 10);
                                    x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                                    h = y + h_offset;
                                    w = x + w_offset;

                                    bounds_rect2 = [y, x, h, w];

                                }

                            }

                            extra.referenceTo.geometricBounds = bounds_rect2;
                            if (extra.sigla == "saporidintorni" || extra.sigla == "saporiidee")
                                logo_sed_bound = extra.referenceTo.geometricBounds;

                            //var obj_file_conad = File(pathLavorazione + "/Links/conad_" + obj.prodotto_conad + ".psd");
                            extra.referenceTo.fillColor = "None";
                            // if (extra.sigla != "cpq" || pz_lbl_titolari == null)
                            //     extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            // else
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                            if (objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX62") {
                                loghiPerPosizionamentoInBoxOri.push(extra.referenceTo);
                            }
                            var altezza_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            y_off_right += 2 + altezza_logo;

                        }
                        catch (error) {
                            //Dovrei mettere no_foto
                            console.error(error);
                        }
                    }

                    if ((extra.sigla.toLowerCase().startsWith("logo_carne") || extra.sigla == ("LOGO_filiera"))
                         && materiale != "ISTITUZIONALE") {
                        try {
                            //calcoliamo l'altezza di referenceTo
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            var w_logo = extra.referenceTo.geometricBounds[3] - extra.referenceTo.geometricBounds[1];
                            var bounds_rect = [box.geometricBounds[0] + y_off_left, box.geometricBounds[1], box.geometricBounds[0] + y_off_left+h_logo, box.geometricBounds[1] + w_logo];

                            if (extra.sigla.indexOf("Chianina") >= 0){
                                //????
                                bounds_rect = [logo_sed_bound[0], logo_sed_bound[1] - 14.986 - 1, logo_sed_bound[0] + 14.647, logo_sed_bound[1] - 1];
                            }
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_left += 2 + h_logo;

                        } catch (error) { 
                            console.error(error);
                        }
                        
                    }

                    if (((extra.sigla.startsWith("INOSTRIORI") && objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("inostriori") >= 0) || 
                        (extra.sigla.startsWith("TERRITORIO") && objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("territorio") >= 0)) && 
                        objItem.codiceBox != "solo_descr") {

                        var bounds_rect = [box.geometricBounds[0] + 1, box.geometricBounds[3] - 1 - 14.5, box.geometricBounds[0] + 1 + 14.5, box.geometricBounds[3] - 1];


                        if (isMZLOC) {
                            bounds_rect = [box.geometricBounds[0], box.geometricBounds[3] - 14.5, box.geometricBounds[0] + 14.5, box.geometricBounds[3]];
                        }
                        else {
                            //Dobbiamo piazzare il logo INOSTRIORI
                            if (pz_lbl_titolari != null) {
                                bounds_rect = [bounds_rect[0] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[1], bounds_rect[2] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[3]];
                            }
                        }

                        var potenziale_dettaglio_errore = "";
                        //var gr = extra.referenceTo.graphics.item(0);
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);


                        //let counterSecurity=0;
                        extra.referenceTo.geometricBounds = bounds_rect;

                        // while(true)
                        // {
                        //     try {

                        //         //console.log("Tentativo " + counterSecurity);
                        //         extra.referenceTo.geometricBounds = bounds_rect;
                                
                        //         if (gr.isValid) 
                        //         {

                        //             if (objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("inostriori") < 0) {
                        //                 if (objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("territorio") >= 0) {
                        //                     //Logo Territorio / No inostriori

                        //                     var suffix_LOC = "LOC_";
                        //                     var suffix_LOC_default = "LOC_";
                        //                     if (!isMZLOC) {
                        //                         suffix_LOC = "VOL_";
                        //                         suffix_LOC_default = "VOL_";
                        //                     }

                                            
                        //                     //console.warn(gr.isValid);
                        //                     gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_territorio_generico").currentVisibility = false;
                        //                     if (area == "SP") {
                        //                         //Rimane default
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_generico").currentVisibility = true;
                        //                     }
                        //                     else if (area == "AO") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_AOSTA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "TO") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_TO").currentVisibility = true;
                        //                     }
                        //                     else if (area == "PI") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_PI").currentVisibility = true;
                        //                     }
                        //                     else if (area == "SA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_SA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "LA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "EM") {
                        //                         //console.warn(gr.isValid);
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_EM").currentVisibility = true;
                        //                     }
                        //                     else if (area == "LI") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LI").currentVisibility = true;
                        //                     }
                        //                     //}
                        //                 }
                        //             }
                        //             else {
                                        

                        //                 if (isMZLOC) {
                        //                     if (area == "TO" >= 0 && area == "SP") {

                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico").currentVisibility = false;
                        //                         if (objItem.reparto == "31") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico_PESCE").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = true;
                        //                         }

                        //                     }
                        //                     else if (area == "PI" && area == "AOSTA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = false;
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_AOSTA").currentVisibility = true;
                        //                     }
                        //                     else {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita).currentVisibility = false;
                        //                         //graphicLayers.itemByName("VOL_" + objItem.distintivita).currentVisibility = false;
                        //                         if (objItem.reparto == "31") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_" + objItem.distintivita + "_PESCE").currentVisibility = true;
                        //                             //graphicLayers.itemByName("LOC_" + objItem.distintivita + "_PESCE").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_" + objItem.distintivita).currentVisibility = true;
                        //                             //graphicLayers.itemByName("LOC_" + objItem.distintivita).currentVisibility = true;
                        //                         }
                        //                     }
                        //                 }
                        //                 else {
                        //                     if (objItem.reparto == "31") {
                        //                         if ( area == "TO" && area == "SP") {

                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico_PESCE").currentVisibility = true;
                        //                         }
                        //                         else if (area == "PI" && area == "AOSTA") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_AOSTA").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             potenziale_dettaglio_errore = "LAYER VOL_" + objItem.distintivita + "_PESCE non trovato nel logo " + objItem.distintivita + ".psd";

                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita).currentVisibility = false;
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita + "_PESCE").currentVisibility = true;
                        //                         }


                        //                     }

                        //                 }


                        //             }
                        //         }
                        //         else
                        //         {
                        //             throw "Errore nel caricamento del logo TERRITORIO";
                        //         }
                                

                        //         pzLogoOri = rect;
                        //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        //         console.log("SUCCESS al " + counterSecurity);

                        //         break;
                        //     }
                        //     catch (error) {
                        //         if (potenziale_dettaglio_errore != "") {
                        //             console.error(potenziale_dettaglio_errore);
                        //         }
                        //         else {
                        //             console.error(error);
                        //         }
                        //     }
                        //     finally
                        //     {
                        //         counterSecurity++;
                        //         if (counterSecurity>=10)
                        //         {
                        //             break;
                        //         }
                        //     }
                        
                        // }
                        
                    }

                    // if (extra.sigla == "da_controllare") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if (extra.sigla == "logo_selezione" && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if ((extra.sigla == "toscana" ||
                    //     extra.sigla == "lazio" ||
                    //     extra.sigla == "sardegna" ||
                    //     extra.sigla == "piemonte" ||
                    //     extra.sigla == "emilia" ||
                    //     extra.sigla == "liguria" ||
                    //     extra.sigla == "valledaosta" ||
                    //     extra.sigla == "tirreno"
                    // )
                    //     && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if (extra.sigla == "Logo_VistoinTV" && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //         //console.error("in tv error: " + error);
                    //     }
                    // }

                    // if ((extra.sigla == "Logo_PE_PRONTIdaMangiare" ||
                    //     extra.sigla == "Logo_PE_PRONTIdaCuocere" ||
                    //     extra.sigla == "Logo_PE_CONFalNaturale" ||
                    //     extra.sigla == "Logo_Friend_of_the_Sea" ||
                    //     extra.sigla == "Logo_Marinou"
                    // )
                    //     && materiale != "ISTITUZIONALE") {

                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);


                    //     // var loghi_pesce = obj.logo_pesce.split(",");
                    //     // var xy_off = 0;
                    //     // for (var $lp = 0; $lp < loghi_pesce.length; $lp++) {
                    //     //     try {
                    //     //         var bounds_rect = [box.geometricBounds[0] + xy_off, box.geometricBounds[1] + xy_off, box.geometricBounds[2] + xy_off, box.geometricBounds[3] + xy_off];
                    //     //         extra.referenceTo.geometricBounds = bounds_rect;
                    //     //         extra.referenceTo.fillColor = "None";
                    //     //         extra.referenceTo.fit(FitOptions.FRAME_TO_CONTENT);

                    //     //         xy_off += 2;

                    //     //     } catch (error) { }
                    //     // }
                    // }
                }



                var offset_boll = [0, 0];

                // if (objItem.corretto_edro21 == "true") {
                //     try {
                //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                //         var rect = myPage.rectangles.add(doc.layers.itemByName("bollini"), LocationOptions.UNKNOWN, box, { geometricBounds: bounds_rect })

                //         var obj_file = File(pathLavorazione + "/Links/boll_CORRETTO_EDRO21.psd");
                //         rect.place(obj_file);
                //         rect.fillColor = "None";
                //         rect.label = "boll";
                //         rect.fit(FitOptions.FRAME_TO_CONTENT);

                //         offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                //     }
                //     catch (error) {
                //         //Dovrei mettere no_foto
                //     }
                // }

                if (extra.sigla == "boll_Vedi_Lista" /*meta_meccanica.isInvalida && objItem.codiceBox != "solo_descr"*/) {
                    //metto il logo
                    try {
                        var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                        if (objItem.corretto_edro21 == "true") //da fixare
                            bounds_rect = [box.geometricBounds[0] + 14.99, box.geometricBounds[1], box.geometricBounds[2] + 14.99, box.geometricBounds[3]];

                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                // if (objItem.boll_distintivita != "") {
                if(extra.sigla == "boll_TIPICO" || extra.sigla == "boll_BENESSERE")
                    {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) { }
                }

                //if (objItem.boll_ruolo != "") {
                if (extra.sigla == "boll_STAR" || 
                    extra.sigla == "boll_VEDETTE" ||
                    extra.sigla == "boll_PPAG" ||
                    extra.sigla == "boll_ARTWORK") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];

                        //STAR , VEDETTE
                        var lay = doc.layers.itemByName("bollini");
                        if (extra.sigla.indexOf("STAR") >= 0 || extra.sigla.indexOf("VEDETTE") >= 0)
                            lay = doc.layers.itemByName("Bollini IMP");

                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.layer = lay;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) { }
                }

                //if (objItem.noPunti_daConad == "true") {
                if (extra.sigla == "boll_NOPUNTI_DACONAD") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                //if (objItem.etto_lista_diverso == "true") {
                if (extra.sigla == "boll_ETTO_lista_DIVERSO") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                //if (objItem.NO_Esempio == "true") {
                if (extra.sigla == "boll_ESEMPIO_NONnecessario") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }

                //if (objItem.mg_nofidelity == "true") {
                if (extra.sigla == "boll_MG_NoFIDELITY") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) {
                        //Dovrei mettere no_foto
                    }
                }
            }
        }

        
        //fine loghi

        // if (objItem.note != null && objItem.note != "") {
        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];

        //     var txt_note = myPage.textFrames.add(doc.layers.itemByName("NOTE"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });

        //     var str_note = objItem.note.toString();

        //     while (true) {
        //         if (str_note.indexOf("<br>") >= 0) {
        //             str_note = str_note.replace("<br>", "\n");
        //         }
        //         else {
        //             break;
        //         }

        //     }

        //     txt_note.contents = str_note;//obj.note.toString().replace("<br>","\n");
        // }

        // if (objItem.note_category != null && objItem.note_category != "") {

        //     var diff_x = wBOX - wBOX_mastro;
        //     var diff_y = hBOX - hBOX_mastro;

        //     var myh = hBOX_mastro;
        //     var mycoord = [box.geometricBounds[0] + (myh / 2), box.geometricBounds[1], box.geometricBounds[0] + (myh / 2) + (hBOX_mastro / 2), box.geometricBounds[1] + wBOX_mastro];

        //     var txt_nota_category = myPage.textFrames.add(doc.layers.itemByName("NOTE_CATEGORY"), LocationOptions.UNKNOWN, box, { geometricBounds: mycoord });

        //     var str_note = objItem.note_category.toString();
        //     while (true) {
        //         if (str_note.indexOf("<br>") >= 0) {
        //             str_note = str_note.replace("<br>", "\n");
        //         }
        //         else {
        //             break;
        //         }

        //     }

        //     txt_nota_category.contents = str_note;
        // }

        if (sez_data != null && sez_data != "") {
            var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];
            var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZ_DATA"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
            txt_data.contents = sez_data;
            try {
                for (var $c = 0; $c < txt_data.contents.length; $c++)
                    txt_data.characters.item($c).appliedCharacterStyle = "SEZ_DATA";
            } catch (error) { }
        }

        // if (objItem.sezione != null && objItem.sezione != "") {

        //     if (doc.layers.itemByName("SEZIONE_VOL") == null || !doc.layers.itemByName("SEZIONE_VOL").isValid) {
        //         doc.layers.add({ name: "SEZIONE_VOL" });
        //         doc.layers.itemByName("SEZIONE_VOL").move(LocationOptions.AFTER, doc.layers.itemByName("NOTE_CATEGORY"));
        //     }

        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];
        //     var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZIONE_VOL"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
        //     txt_data.contents = objItem.sezione;
        //     try {
        //         for (var $c = 0; $c < txt_data.contents.length; $c++)
        //             txt_data.characters.item($c).appliedCharacterStyle = "SEZIONE_VOL";
        //     } catch (error) { }
        // }

        //Inserisco il testo di errore se ci sono stati errori
        // if (string_error != "") {
        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];

        //     var txt_error = myPage.textFrames.add(doc.layers.itemByName("InPagina - Errori"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
        //     txt_error.contents = string_error;
        //     var sty_error = getStileForField(obj.meccanica, "errore", meta_meccanica);
        // }


        // try {
        //     //Scrivo la nota con codice referenza
        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];

        //     var txt_cod_ref = myPage.textFrames.add(doc.layers.itemByName("CODICE REF"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
        //     txt_cod_ref.contents = objItem["Referenza.Codice"];
        // }
        // catch (error) {
        // }



        //console.error("Post cestino");

        if (pz_rect_regionale != null) {
            try {

                //console.error("PRIMA");
                var newy = pz_rect_regionale.geometricBounds[0];

                if (canale == "SC" && cimitero["PIEDE_Titolari"] != null) {
                    if (pz_offerta != null && objItem.codiceBox == "BOX12_SC") {
                        pz_offerta.geometricBounds = [pz_offerta.geometricBounds[0] - 2, pz_offerta.geometricBounds[1], pz_offerta.geometricBounds[2] - 2, pz_offerta.geometricBounds[3]];
                    }
                    if (pz_kgl_sconto != null && objItem.codiceBox == "BOX12_SC") {
                        pz_kgl_sconto.geometricBounds = [pz_kgl_sconto.geometricBounds[0] - 2, pz_kgl_sconto.geometricBounds[1], pz_kgl_sconto.geometricBounds[2] - 2, pz_kgl_sconto.geometricBounds[3]];
                    }
                    if (pz_sconto_piccolo != null && objItem.codiceBox == "BOX12_SC") {
                        pz_sconto_piccolo.geometricBounds = [pz_sconto_piccolo.geometricBounds[0] - 2, pz_sconto_piccolo.geometricBounds[1], pz_sconto_piccolo.geometricBounds[2] - 2, pz_sconto_piccolo.geometricBounds[3]];
                    }
                }

                if (pz_offerta != null) {
                    newy = pz_offerta.geometricBounds[0];
                }
                if (canale != "SC") {
                    if (pz_anziche != null) {
                        newy = pz_anziche.geometricBounds[0];
                    }
                    else if (pz_sconto_grande != null &&
                        (pz_alletto != null || objItem.combinazioneAssegnata.indexOf("_regionale") > 0 || objItem.combinazioneAssegnata.indexOf("_bdp") > 0 || objItem.combinazioneAssegnata.indexOf("_sdb") > 0)) {
                        newy = pz_sconto_grande.geometricBounds[0];

                    }
                }
                else if (isMZLOC && canale == "SC") {
                    //Il box deve coprire anche il campo sconto se presente
                    if (pz_anziche != null) {
                        newy = pz_anziche.geometricBounds[0];
                    }
                    else if (pz_sconto_grande != null) {
                        newy = pz_sconto_grande.geometricBounds[0];
                    }
                }

                //Devo sistemare anche l'allinemaneto a sinistra
                var leader_offset = 1000000;
                if (pz_kgl_sconto != null && pz_kgl_sconto.visible) {
                    leader_offset = pz_kgl_sconto.characters.item(0).horizontalOffset;
                }
                if (pz_offerta != null && pz_offerta.visible) {
                    var score = 0;
                    if (pz_offerta.label == "prezzo_offerta_gruppo") {
                        if (pz_offerta.allPageItems.length > 1)
                            score = pz_offerta.allPageItems[1].characters.item(0).horizontalOffset;
                        else
                            score = pz_offerta.allPageItems[0].characters.item(0).horizontalOffset;
                    }
                    else {
                        score = pz_offerta.characters.item(0).horizontalOffset;
                    }

                    if (leader_offset > score) {
                        leader_offset = score;
                    }
                }

                if (pz_sconto_meno != null) {
                    var ch = pz_sconto_meno.characters.item(0);
                    if (leader_offset > ch.horizontalOffset) {
                        leader_offset = ch.horizontalOffset;
                    }
                }


                if (pz_alletto != null) {

                    var offset = newy - pz_rect_regionale.geometricBounds[0];

                    var adj = 0;
                    if ((pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) > (pz_rect_regionale.geometricBounds[2] - newy))
                        adj = (pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) - (pz_rect_regionale.geometricBounds[2] - newy);

                    pz_alletto.geometricBounds = [
                        pz_alletto.geometricBounds[0] - offset,
                        pz_alletto.geometricBounds[1],
                        pz_alletto.geometricBounds[2] - offset + adj,
                        pz_alletto.geometricBounds[3]
                    ];

                    if (pz_sconto_grande != null) {
                        var offset_sconto_grande = (pz_sconto_grande.geometricBounds[2] - pz_sconto_grande.geometricBounds[0]);
                        offset += offset_sconto_grande;
                    }

                    pz_alletto.geometricBounds = [
                        newy,
                        pz_alletto.geometricBounds[1],
                        box.geometricBounds[2],
                        pz_alletto.geometricBounds[3]
                    ];

                    if (pz_alletto.overflows) {
                        pz_alletto.textFramePreferences.insetSpacing = [pz_alletto.textFramePreferences.insetSpacing[0],
                            0.5,
                        pz_alletto.textFramePreferences.insetSpacing[2],
                        pz_alletto.textFramePreferences.insetSpacing[3]];
                    }

                }

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

                if (canale == "SC" && (cimitero["PIEDE_Titolari"] != null || objItem.codiceBox != "BOX12_SC")) {
                    if (objItem.codiceBox == "BOX12_SC") {
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
                    if (pz_blocco_allineamenti != null && objItem.codiceBox == "BOX6_SC") {
                        if (objItem.combinazioneAssegnata.indexOf("bdp") > 0 || objItem.combinazioneAssegnata.indexOf("sdb") > 0) {
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

        // if (g_new_all.length > 0) {
        //     g_new_all.push(box);
        //     box = myPage.groups.add(g_new_all);
        //     box.name = box.name;
        //     box.label = box.label;

        //     box.label = "";
        // }


        //Adesso avviene il ridimensionamento

        var gap_y_descrTerr_baseTerr = 0;
        if (pz_boxDescrPrezzi_ORI_TERRITORIO != null) {
            if (pzLogoOri == null) {
                if (pz_base_territorio != null && pz_base_territorio.isValid) {
                    gap_y_descrTerr_baseTerr = pz_base_territorio.geometricBounds[0] - pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0];
                }
            }
        }

        var tot_da_cestinare = obj_da_cestinare.length;
        for (var $d = (tot_da_cestinare - 1); $d >= 0; $d--) {
            try {
                //se l'elemento è un gruppo saltiamolo
                // if (obj_da_cestinare[$d].constructor.name == "Group") {
                //     continue;
                // }
                if (obj_da_cestinare[$d].label == "prezzo_offerta_gruppo") {
                    pz_prezzo_offerta = null;
                    pz_prezzo_offerta_etto = null;
                }
                else if (obj_da_cestinare[$d].label == "boxDescrPrezzi_ORI_TERRITORIO") {
                    pz_boxDescrPrezzi_ORI_TERRITORIO = null;
                }
                //obj_da_cestinare[$d].remove();
                this.listaElementiCestinati.push(obj_da_cestinare[$d]);
                //disattiaviamo l'elemento
                obj_da_cestinare[$d].visible = false;


            } catch (error) { }
        }
    

        //box.move(agenzia_pos);
        if (g_new_all.length > 0)
        {
            //console.log("INIT sgruppamento");
            var oldGroup = box;
            var oldLabel = oldGroup.label;
            var oldItems = oldGroup.pageItems.everyItem().getElements();
            //console.log("Sgruppamento");
            oldGroup.ungroup();
            //console.log("Concat");

            var newItems = oldItems.concat(g_new_all);
            box = myPage.groups.add(newItems);
            box.label = oldLabel;

            //console.log("Scorriamo gli elementi");

            //scorriamo tutti gli oggetti in newGroup in cerca di label "immagine" e la portiamo in primo piano
            var fotoPrimaria = null;
            var base = null;
            var fondo = null;
            for (var i = 0; i < box.allPageItems.length; i++) {
                //console.log(box.allPageItems[i].label);
                if (box.allPageItems[i].label.startsWith("foto_secondaria")) {
                    box.allPageItems[i].sendToBack();
                }
                if(box.allPageItems[i].label.startsWith("immagine")){
                    fotoPrimaria = box.allPageItems[i];
                }
                if(box.allPageItems[i].label == "nuovo_fondo_distintivita"){
                    fondo = box.allPageItems[i];
                }
                if(box.label == "BOX2" || box.label == "BOX62"){
                    if(box.allPageItems[i].label == "gruppo_inostriori_territorio"){
                        base = box.allPageItems[i];
                    }
                }
                else{
                    if(box.allPageItems[i].label.indexOf("base") == 0){
                        base = box.allPageItems[i];
                    }
                }
            }

            if (fotoPrimaria != null) {
                fotoPrimaria.sendToBack();
            }
            if (base != null) {
                base.sendToBack();
            }
            if (fondo != null) {
                fondo.sendToBack();
            }

        }
        this.ridimensionamento(wBOX, hBOX, wBOX_mastro, hBOX_mastro, box);


        return ["new", objItem, box];

    },    
    
    getRefCompiledInBox_provvisorio(objItem, box, box_griglia_bounds, pathLavorazione = "", context = []) {
        
        this.contesto_promo = context;
        let myPage = box.parentPage;
        var area = this.area;
        var canale = this.canale;

        var livelli_meccanica = new Array();
        recInTrac = objItem.recordInTracciato;

        var meta_meccanica = this.parseMeccanica_provvisorioCompiled(objItem, objItem.allEtichette, canale);
        var tema = this.cercaChiaveContesto("tema", this.contesto_promo);
        var materiale = this.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        tema = tema == null ? "" : tema;
        var isMZLOC = ((tema.indexOf("LOC") >= 0 && materiale == "MZ") || objItem.allEtichette.includes("MZLOC"));

        var doc = app.activeDocument;
        
        

        var wBOX_mastro = box_griglia_bounds[3] - box_griglia_bounds[1];
        var hBOX_mastro = box_griglia_bounds[2] - box_griglia_bounds[0];


        var wBOX = box.visibleBounds[3] - box.visibleBounds[1];
        var hBOX = box.visibleBounds[2] - box.visibleBounds[0];

    
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
        var fondoDaPosizionare = objItem["Foto.ExtraAuto"].find(f=>f.tipo == 5);

        var g_new_all = new Array();

        var loghiPerPosizionamentoInBoxOri = [];
        var sez_data = "Dal " + objItem.data_da + " al " + objItem.data_a;
        for (var $xa = 0; $xa < box.allPageItems.length; $xa++) {
            var pItem = box.allPageItems[$xa];
            var nome_proprieta = pItem.label.replace("X_", "");

            if (nome_proprieta.indexOf("base") == 0) {
                if (nome_proprieta.indexOf("base_inostriori_territorio") == 0) {
                    pz_base_territorio = pItem;
                }
                else {
                    pz_base = pItem;
                }

                for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                    var mItem = meta_meccanica.azioni[a];


                    if ((mItem.tipo == "color" || mItem.tipo == "colorBkg") && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {


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
                            }


                        }
                        else {
                            pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                        }
                    }
                    else if (mItem.tipo == "border" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
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
                    else if(mItem.tipo == "unplace"){
                        pItem.graphics.item(0).remove();
                    }
                    else if (mItem.tipo == "effect" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                        this.applyObjectStyle(doc, pItem, mItem.name);
                    }
                }

                if (objItem.codiceBox == "solo_descr") {
                    obj_da_cestinare.push(pItem);
                }                
            }
            else if (nome_proprieta == "immagine") {

                pzImg = pItem;
                
                if (objItem.codiceBox == "solo_descr") {
                    obj_da_cestinare.push(pItem);
                }
            }
            else if (nome_proprieta == "descrizione") {

                pz_descrizione = pItem;


                try {
                    var bounds = pItem.geometricBounds;
                    var new_bound = bounds[2] + 100;
                    pItem.geometricBounds = [bounds[0], bounds[1], new_bound, bounds[3]];

                    var first_gramm_char_inx = -1;
                    var descr4Lengh = objItem["Descrizioni.Descrizione4"].length
                    var indice_desc = pItem.characters.length - descr4Lengh;


                    first_gramm_char_inx = indice_desc;
                    if (descr4Lengh > 0 && first_gramm_char_inx > 0 && canale == "SC" && objItem.codiceBox != "BOX14_SC") {
                        pItem.characters.item(first_gramm_char_inx).leading = 10;
                    }

                    if (objItem.codiceBox.indexOf("BOX9") >= 0) {
                        if (pz_reparto == null) {

                            bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                            y_allineamento_eliminazioni += 1;
                        }
                        else {
                            //console.error("set to -> " + bounds);
                            bounds = [bounds[0] + 1, bounds[1], bounds[2] + 1, bounds[3]];
                            y_allineamento_eliminazioni += 1;
                        }
                    }


                    pItem.geometricBounds = bounds;

                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                        var mItem = meta_meccanica.azioni[a];

                        if (mItem.tipo == "pos" && mItem.campo_indd == "descrizione") {
                            pItem.paragraphs.item(0).justification = mItem.align;
                            var w = pItem.geometricBounds[3] - pItem.geometricBounds[1];
                            var newX = box.geometricBounds[1] + mItem.absoluteX;

                            pItem.geometricBounds = [pItem.geometricBounds[0], newX, pItem.geometricBounds[2], newX + w];
                            gd = pItem.parent;
                            break;
                        }

                    }



                    if (objItem.codiceBox.indexOf("BOX14") >= 0) {
                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] + y_allineamento_eliminazioni, pItem.geometricBounds[3]];
                        if (objItem.combinazioneAssegnata == "PUNTI_KgL_minicoll" || objItem.combinazioneAssegnata == "PUNTI_minicoll") {
                            var countchar = pItem.characters.length;
                            var offset = pItem.characters.item(countchar - 1).baseline - pItem.geometricBounds[0];
                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[0] + offset + 4, pItem.geometricBounds[3]];
                        }
                    }
                    else if (objItem.codiceBox == "BOX41") {
                        try {
                            var limit_x_off = this.getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                            if (limit_x_off != 0) {
                                var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                            }
                        } catch (err) {
                            console.error("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                        }
                    }



                    //Per mettere il testo tutto visibile qualora fosse in overflow
                    var antiloop = 0;
                    while (pItem.overflows) {
                        var bound = pItem.geometricBounds;
                        if (objItem.codiceBox.indexOf("BOX9") < 0)
                            pItem.geometricBounds = [bound[0] - 1, bound[1], bound[2], bound[3]];
                        else {
                            pItem.geometricBounds = [bound[0], bound[1], bound[2] + 1, bound[3]];
                            y_allineamento_eliminazioni += 1;
                        }

                        antiloop++;
                        if (antiloop > 30)
                            break;
                    }

                    if (canale == "SC" && objItem.codiceBox != "BOX41" && objItem.codiceBox.indexOf("BOX14") < 0) {
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
                    console.error("errore caricamento font descrizioni : " + error.message);
                }

                //Inserimento NOTE al campo descrizione per la segnalazione delel rispettive righe AVV
                if (objItem.note_category.indexOf("###") >= 0) {
                    var riga_avv = objItem.note_category.substring(objItem.note_category.indexOf("###") + 3);
                    this.inserisciNota(pItem, "rigaAVV", riga_avv);
                }

            }
            // else if (nome_proprieta == "Triangolo_VAL_txt") {    //è ancora valido? Le meccaniche spazio non lo contengono
            //     var data_validita = sez_data;

            //     var analyz = data_validita.toLowerCase();
            //     var inx_br = 0;
            //     for (var $me in mesi) {
            //         if (analyz.indexOf(mesi[$me]) > 0) {
            //             inx_br = analyz.indexOf(mesi[$me]);
            //             break;
            //         }
            //     }

            //     if (inx_br > 0)
            //         pItem.contents = data_validita.toUpperCase().substring(0, inx_br - 1) + "\n" + data_validita.toUpperCase().substring(inx_br);
            //     else
            //         pItem.contents = data_validita.toUpperCase()

            // }
            // else if (nome_proprieta == "Triangolo_VAL") {
            //     if (tema.indexOf("LOC 1a") >= 0) {
            //         pItem.fillColor = "Localismo 1a DATA";
            //     }
            //     else if (tema.indexOf("LOC 2a") >= 0) {
            //         pItem.fillColor = "Localismo 2a DATA";
            //     }
            // }
            // else if (nome_proprieta == "Fascia_VAL") {
            //     var data_validita = sez_data;

            //     pz_rect_validita = pItem;

            //     if (tema.indexOf("LOC Mensile") < 0) {
            //         pItem.contents = "";

            //         if (tema.indexOf("LOC 1a") >= 0) {
            //             pItem.fillColor = "Localismo 1a DATA";
            //         }
            //         else if (tema.indexOf("LOC 2a") >= 0) {
            //             pItem.fillColor = "Localismo 2a DATA";
            //         }
            //     }
            //     else {
            //         pItem.contents = "VALIDO " + data_validita.toUpperCase();
            //     }

            // }
            else if (nome_proprieta == "Range_Punti_1_cornice" || nome_proprieta == "Range_Punti_2_cornice") {

                if (nome_proprieta == "Range_Punti_1_cornice") {
                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {
                        var mItem = meta_meccanica.azioni[a];
                        if (mItem.tipo == "resize" && mItem.campo_indd == "Range_Punti_1_cornice") {
                            var h = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                            var offY = h - mItem.size[1];
                            pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1], pItem.geometricBounds[2] - offY, pItem.geometricBounds[3]];

                            break;
                        }
                    }
                }
            }
            // else if (nome_proprieta == "fondo_distintivita") {
            //     if (fondoDaPosizionare != null) {
            //         var path = pathLavorazione + "/Links/Loghi/" + fondoDaPosizionare.nome;
            //         pItem.place(path);
            //         pItem.fit(FitOptions.PROPORTIONALLY);
            //         pItem.fit(FitOptions.FRAME_TO_CONTENT);
            //         pItem.fillColor = "None";

            //         fondoDaPosizionare = null;
            //     }                
            // }
            else {
                try {
                    color = "";
                    //Da vedere in funzione di eventuali opzioni binding nei meta della meccanica
                    var flag_del = false;
                    for (var a = 0; a < meta_meccanica.azioni.length; a++) {

                        var mItem = meta_meccanica.azioni[a];

                        if (nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                            if (mItem.tipo == "color" || mItem.tipo == "colorBkg") {
                                color = mItem.colore;

                                try {
                                    if (nome_proprieta.indexOf("rect_") >= 0) {
                                        //Si tratta di rectangle
                                        pItem.fillColor = color;
                                    }
                                    else if (nome_proprieta == "linee" || nome_proprieta == "base") {
                                        //console.error("linee " + color);
                                        if (color != "transparent")
                                            pItem.strokeColor = color;
                                        else
                                            pItem.fillTransparencySettings.blendingSettings.opacity = 0;
                                    }
                                    else {
                                        //si tratta di textframe
                                        for (var $c = 0; $c < pItem.contents.length; $c++) {
                                            pItem.characters.item($c).fillColor = color;
                                        }
                                    }
                                } catch (error) {
                                    console.error("Errore caricamento colore : " + error.message);
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
                                pItem.geometricBounds = [pItem.geometricBounds[0] + mItem.offset[1], pItem.geometricBounds[1] + mItem.offset[0],
                                pItem.geometricBounds[2] + mItem.offset[3], pItem.geometricBounds[3] + mItem.offset[2]];
                            }
                            else if (mItem.tipo == "resize") {
                                var w = mItem.size[0];
                                var h = mItem.size[1];
                                if (w == 0) {
                                    //Aumentare altezza bloccando parte bassa
                                    var h_elem = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                                    var offset = h - h_elem;

                                    if (pItem.geometricBounds[0] - offset < box.geometricBounds[0])
                                        offset -= (box.geometricBounds[0] - (pItem.geometricBounds[0] - offset));

                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0] - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2],
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                            else if (mItem.tipo == "effect" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                                this.applyObjectStyle(doc, pItem, mItem.name);
                            }
                        }
                    }

                    if (objItem.deletedFields != null && objItem.deletedFields.includes(nome_proprieta)) {

                        if (nome_proprieta == "prezzo_offerta_EURprima")
                            eurPrima_eliminato = true;

                        flag_del = true;
                        if (pItem.label == "campo_offerta" || pItem.label == "campo_offerta_etto" || pItem.label == "sconto_effettivo" || pItem.label == "sconto_effettivo_grande" ||
                            pItem.label == "campo_offerta_KgL" || pItem.label == "campo_offerta_KgL_sconto" || pItem.label == "LBL_Carte" || (pItem.label == "Range_Punti_2" && (objItem.codiceBox == "BOX30" /*MCPOINT v1.0 ||  objItem.codiceBox.indexOf("BOX14") >= 0 MCPOINT v1.0*/)) ||/*pItem.label=="prezzo_offerta_EURprima" ||*/
                            (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") || (pItem.label == "gruppo_sconto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC")) || (pItem.label == "sy_etto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX20" || objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX2_SC")) || pItem.label == "PIEDE_Titolari" || (pItem.label == "prezzo_offerta_gruppo" && !eurPrima_eliminato)) {

                            if (objItem.codiceBox.indexOf("BOX9") >= 0 /*|| objItem.codiceBox=="BOX2" || objItem.codiceBox=="BOX2_SC"*/) {
                                y_allineamento_eliminazioni -= (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                            }
                            else {
                                y_allineamento_eliminazioni += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                            }
                        }
                        else if (pItem.label == "Range_Punti_2") {
                            y_allineamento_sx += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                        }
                        else if (pItem.label == "LBL_Titolari") {
                            y_allineamento_top += (pItem.geometricBounds[2] - pItem.geometricBounds[0]);
                        }
                    }

                    var vecchio_nome_proprieta = "";

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
                        //console.error("campo offerta NON da eliminare");
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
                    else if ((pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) && !flag_del) {
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
                    else if (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0) {
                        gd = pItem;
                        if (objItem.codiceBox.indexOf("BOX41") < 0)
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "rect_regionale" || pItem.label == "rect_tipico" || pItem.label == "rect_etto") {
                        pz_rect_regionale = pItem;
                        livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "sy_etto" && !flag_del) {

                        pz_alletto = pItem;
                        if (objItem.codiceBox == "BOX9" || objItem.codiceBox == "BOX20")
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "sy_2x1") {
                        livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "boxDescrPrezziORI") {
                        pz_rect_DescrPrezziORI = pItem;
                    }
                    else if (nome_proprieta == "boxDescrPrezzi_ORI_TERRITORIO") {
                        if (objItem.codiceBox != "solo_descr")
                            pz_boxDescrPrezzi_ORI_TERRITORIO = pItem;
                    }
                    else if (fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn" && nome_proprieta == "PIEDE_Titolari") {
                        var boundsPiede = pItem.geometricBounds;
                        boundsPiede[0] = boundsPiede[0] - 0.5;
                        boundsPiede[1] = boundsPiede[1] + 0.7;
                        boundsPiede[2] = boundsPiede[2] - 0.5;
                        boundsPiede[3] = boundsPiede[3] - 0.7;
                        pItem.geometricBounds = boundsPiede;
                    }


                    if (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30" && !flag_del) {
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
                                var hor = pz_NOofferta_EURprima.characters.item(0).horizontalOffset;
                                ox = hor - gb[3];
                            }
                            else if (pItem.label == "PezzConf_NM") {
                                var hor = pz_offerta.characters.item(0).horizontalOffset;
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
                        if (objItem.codiceBox == "BOX30")
                            livelli_meccanica.push(pItem);
                    }
                    else if (pItem.label == "Range_Punti_2" && !flag_del) {
                        if (objItem.codiceBox == "BOX30")
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
                        if (objItem.reparto == 33 ||
                            objItem.reparto == 31 ||
                            objItem.reparto == 29 ||
                            objItem.reparto == 27 ||
                            objItem.reparto == 25 ||
                            objItem.reparto == 21) {
                            livelli_meccanica.push(pItem);
                        }
                    }

                    if (livelli_meccanica.length > 1 && objItem.codiceBox.indexOf("BOX9") < 0) {
                        if (
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
                            (pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) ||
                            pItem.label == "BIS_grafica" ||
                            pItem.label == "gruppo_sconto" ||
                            (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX9" && objItem.codiceBox != "BOX5"
                                && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0 && objItem.codiceBox.indexOf("BOX41") < 0) ||
                            (pItem.label == "LBL_Carte" && objItem.codiceBox.indexOf("BOX14") < 0) ||
                            pItem.label == "sy_2x1" ||
                            (pItem.label == "Range_Punti_1" && (objItem.codiceBox == "BOX30" || objItem.codiceBox.indexOf("BOX14") >= 0)) ||
                            (pItem.label == "Range_Punti_2" && (objItem.codiceBox == "BOX30")) ||
                            (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") ||
                            (pItem.label == "sy_etto" && (objItem.codiceBox == "BOX9" || objItem.codiceBox == "BOX20"))
                        ) {

                            //E' da riposizionare
                            var lastItem = livelli_meccanica[livelli_meccanica.length - 2];


                            var align = lastItem.geometricBounds;
                            var myH = pItem.geometricBounds[2] - pItem.geometricBounds[0];
                            var newY = align[0] - myH;


                            if (pItem.label == "gruppo_sconto" && objItem.combinazioneAssegnata.indexOf("_boxetto") > 0 && objItem.codiceBox == "BOX6")
                                newY -= 1;


                            pItem.geometricBounds = [newY, pItem.geometricBounds[1], newY + myH, pItem.geometricBounds[3]];



                            if (pItem.label == "LBL_Carte") {
                                try {
                                    var gb = pItem.groups[0].geometricBounds;
                                    pItem.groups[0].geometricBounds = [newY, gb[1], newY + myH, gb[3]];
                                    for (var f = 0; f < pItem.groups[0].pageItems.length; f++) {
                                        pItem.groups[0].pageItems.item(f).fit(FitOptions.PROPORTIONALLY);
                                        pItem.groups[0].pageItems.item(f).fit(FitOptions.FRAME_TO_CONTENT);
                                    }
                                } catch (error) { }
                            }

                        }
                    }
                    else if (y_allineamento_eliminazioni != 0) {

                        //Sistemo i campi 
                        if (pItem.label == "prezzo_offerta_gruppo" ||
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
                            (pItem.label == "PezzConf_NM" && objItem.combinazioneAssegnata.indexOf("50sulSecondo") < 0) ||
                            pItem.label == "BIS_grafica" ||
                            pItem.label == "gruppo_sconto" ||
                            pItem.label == "gruppo_reparto" ||
                            (pItem.label == "LBL_Carte" && objItem.codiceBox.indexOf("BOX14") < 0) ||
                            (pItem.label == "gruppo_descrizione" && objItem.codiceBox != "BOX20"
                                && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0 && objItem.codiceBox.indexOf("BOX41") < 0) ||
                            pItem.label == "sy_2x1" ||
                            (pItem.label == "Range_Punti_1" && (objItem.codiceBox == "BOX30")) ||
                            (pItem.label == "PezzConf" && objItem.codiceBox == "BOX30") ||
                            (pItem.label == "sy_etto" && (objItem.codiceBox.indexOf("BOX9") >= 0 || objItem.codiceBox == "BOX20")) ||
                            pItem.label == "boxDescrPrezziORI"
                        ) {



                            if (pItem.label != "gruppo_descrizione") {

                                var offset = 0;

                                if (pItem.label == "gruppo_sconto" && objItem.combinazioneAssegnata.indexOf("PERCENTO") >= 0 && objItem.combinazioneAssegnata.indexOf("_ALL") < 0) {
                                    if (objItem.codiceBox == "BOX12")
                                        offset += 3;//6.75;
                                    else if (objItem.codiceBox == "BOX6")
                                        offset += 5.202;
                                    else if (objItem.codiceBox == "BOX1")
                                        offset += 6.575;
                                    else if (objItem.codiceBox == "BOX9")
                                        offset += 0;

                                }

                                if ((objItem.codiceBox.indexOf("BOX9") >= 0) && pItem.label == "boxDescrPrezziORI") {
                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0],
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] + y_allineamento_eliminazioni - offset - 2,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                                else {
                                    pItem.geometricBounds = [
                                        pItem.geometricBounds[0] + y_allineamento_eliminazioni - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] + y_allineamento_eliminazioni - offset,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                            else if (objItem.codiceBox != "BOX20" && objItem.codiceBox != "BOX21" && objItem.codiceBox.indexOf("BOX14") < 0) {

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
                                        pItem.geometricBounds[0] - offset,
                                        pItem.geometricBounds[1],
                                        pItem.geometricBounds[2] - offset,
                                        pItem.geometricBounds[3]
                                    ];
                                }
                            }
                        }
                    }
                    else if (y_allineamento_sx > 0) {
                        if (pItem.label == "Range_Punti_1" && objItem.codiceBox.indexOf("BOX14") >= 0) {
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

                    if (objItem.compiledFields.find(f => f.labelName == nome_proprieta) != null) {
                        try {
                            if (pItem.label == "prezzo_offerta_gruppo") {
                                y_allineamento_descr = pItem.geometricBounds[0];
                            }
                            else if (pItem.label == "M_MM") {
                                y_allineamento_descr = pItem.geometricBounds[0];
                            }

                            var contenuto = objItem[nome_proprieta].toString();


                            if (pItem.label != "prezzo_offerta" && pItem.label != "prezzo_offerta_etto") {
                                //pItem.contents = "";
                            }
                            else if (pItem.label != "prezzo_offerta_etto") {
                                if (objItem.codiceBox.indexOf("BOX9") < 0) {
                                    //pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] - 10, pItem.geometricBounds[2], pItem.geometricBounds[3]];
                                }
                                else {
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


                            // if (pItem.label == "prezzo_offerta2" || (pItem.label.indexOf("EURprima") > 0 && nome_proprieta == "prezzo_offerta")) {
                            //     contenuto = "€ " + contenuto;
                            // }
                        }
                        catch (error) {
                            console.error("errore in: " + nome_proprieta + " : " + error);
                        }
                    }
                    else {
                        if (pItem.label != "" && pItem.label.indexOf("Reparto") < 0) {
                            if (pItem.label == "gruppo_descrizione" && objItem.codiceBox.indexOf("BOX41") >= 0) {
                                try {
                                    var limit_x_off = this.getMaggioreOffsetOrizzontaleTraICampi([pz_offerta, pz_kgl_sconto, pz_anziche, pz_sconto_piccolo]);
                                    if (limit_x_off != 0) {
                                        var newx = (limit_x_off - pItem.geometricBounds[3]) - 0.5;
                                        pItem.geometricBounds = [pItem.geometricBounds[0], pItem.geometricBounds[1] + newx, pItem.geometricBounds[2], pItem.geometricBounds[3] + newx];
                                    }
                                } catch (err) {
                                    console.error("Errore  getMaggioreOffsetOrizzontaleTraICampi -> " + err.message);
                                }
                            }
                        }
                    }

                } catch (error) {
                    console.error("1624. " + error + " su " + nome_proprieta);
                    console.error(error);
                }

            }
        }

        // var skipFondo = false;
        // if (fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn") {
        //     if (objItem.combinazioneAssegnata.indexOf("focus") > 0) {
        //         skipFondo = true;
        //     }
        // }

        // //creazione fondo
        // if(fondoDaPosizionare != null && !skipFondo)
        // {
        //     //creiamo un rectangle con geometricBounds uguali a pz_base
        //     var bounds = pz_base != null ? pz_base.geometricBounds : pz_base_territorio.geometricBounds;
        //     var rect = box.rectangles.add();
        //     //assegnamo lo stesso stondamento ai bordi di base al rettangolo
        //     //fondo da posizionare contiene il nome del file da posizionare
        //     var path = pathLavorazione + "/Links/Loghi/" + fondoDaPosizionare.nome;
        //     rect.place(path);
        //     rect.label = "nuovo_fondo_distintivita";
        //     //fit contenuto a cornice
        //     rect.sendToBack();

        //     if (pz_base != null) {
        //         pz_base.fillColor = "None";
        //     }
        //     else{
        //         pz_base_territorio.fillColor = "None";
        //     }
        //     if (fondoDaPosizionare.sigla == "sfondo_vn") {
        //         // Controlliamo se esiste il colore versonatura
        //         var myColor = app.activeDocument.colors.itemByName("versonatura");
        //         if (myColor == null) {
        //             myColor = app.activeDocument.colors.add({
        //                 name: "versonatura", 
        //                 model: ColorModel.process, 
        //                 colorValue: [95, 36, 98, 35]
        //             });
        //         }
            
        //         var radius = 3;
                
        //         if (pz_base != null) {
        //             // Diamo un bordo di colore myColor
        //             pz_base.strokeWeight = 2;
        //             pz_base.strokeColor = myColor;
                    
        //             pz_base.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
            
        //             pz_base.bottomLeftCornerRadius = radius;
        //             pz_base.bottomRightCornerRadius = radius;
        //             pz_base.topLeftCornerRadius = radius;
        //             pz_base.topRightCornerRadius = radius;
                    
        //             // Rimuoviamo il colore di sfondo alla base
        //             //pz_base.fillColor = "None";
        //         } else {
        //             pz_base_territorio.strokeWeight = 2;
        //             pz_base_territorio.strokeColor = myColor;
                    
        //             pz_base_territorio.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base_territorio.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base_territorio.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //             pz_base_territorio.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
            
        //             pz_base_territorio.bottomLeftCornerRadius = radius;
        //             pz_base_territorio.bottomRightCornerRadius = radius;
        //             pz_base_territorio.topLeftCornerRadius = radius;
        //             pz_base_territorio.topRightCornerRadius = radius;
                    
        //             // Rimuoviamo il colore di sfondo alla base
        //             //pz_base_territorio.fillColor = "None";
        //         }
                
        //         rect.bottomLeftCornerRadius = radius;
        //         rect.bottomRightCornerRadius = radius;
        //         rect.topLeftCornerRadius = radius;
        //         rect.topRightCornerRadius = radius;
            
        //         rect.bottomLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //         rect.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
        //         rect.topLeftCornerOption = CornerOptions.ROUNDED_CORNER;
        //         rect.topRightCornerOption = CornerOptions.ROUNDED_CORNER;
        //     }
            
        //     rect.geometricBounds = bounds;
        //     rect.fit(FitOptions.CONTENT_TO_FRAME);
        // }


        //Loghi

        //this.posizionamentoLoghiBolli();
        if (objItem["Foto.ExtraAuto"] != null) {

           
            var y_off_left = 0;
            var y_off_right = 0;
            //cerchiamo LOGO_bandiera_italiana  se lo troviamo spostiamolo primo in lista
            objItem["Foto.ExtraAuto"].sort(function (a, b) {
                // Controlla se "a" o "b" sono "LOGO_bandiera_italiana"
                if (a.sigla == "LOGO_bandiera_italiana") return -1;
                if (b.sigla == "LOGO_bandiera_italiana") return 1;
            
                // Controlla se "a" o "b" sono "logo_BassieFissi"
                if (a.sigla == "logo") return -1;
                if (b.sigla == "logo") return 1;
            
                // Mantieni l'ordine originale per tutto il resto
                return 0;
            });
            for (var i = 0; i < objItem["Foto.ExtraAuto"].length; i++) {
                var extra = objItem["Foto.ExtraAuto"][i];
                if(extra.tipo == 5){
                    continue;
                }
                if(extra.referenceTo == null)
                {
                    continue;
                }

                if (objItem.codiceBox != "BOX40") {
                    if (extra.sigla == "LOGO_bandiera_italiana" && !materiale.includes("ISTITUZIONALE")) {

                        try {
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];

                            var bounds_rect = [box.geometricBounds[0]+y_off_left, box.geometricBounds[1], box.geometricBounds[0]+7.366+y_off_left, box.geometricBounds[1]+14.309];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_left += 2 + h_logo;
                        } catch (error) { }
                    }

                    if (objItem.codiceBox.indexOf("BOX41") < 0) {
                        //Metto il logo se esiste
                        if ((extra.sigla == "dop" || extra.sigla == "igp") && materiale != "ISTITUZIONALE") {
                            try {
                                var h_dop_igp = 13.039;
                                var w_dop_igp = 13.039;

                                var bounds_rect = [box.geometricBounds[0] + y_off_left, box.geometricBounds[1], box.geometricBounds[0] + h_dop_igp + y_off_left, box.geometricBounds[1] + w_dop_igp];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                                logo_dop_igp = extra.referenceTo;


                                if (objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX62") {
                                    loghiPerPosizionamentoInBoxOri.push(extra.referenceTo);
                                }

                                y_off_left += 2 + h_dop_igp;
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }

                        //Metto il logo focus se esiste
                        if (extra.sigla == "Agriqualità" && materiale != "ISTITUZIONALE") {
                            try {

                                var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + 9.9, box.geometricBounds[1] + 12.02];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }
                    }
                    else{
                        if ((extra.sigla == "dop" || extra.sigla == "igp") && materiale != "ISTITUZIONALE") {
                            try {
                                var h_dop_igp = 13.039;
                                var w_dop_igp = 13.039;

                                var bounds_rect = [box.geometricBounds[0] + y_off_right, box.geometricBounds[1], box.geometricBounds[0] + h_dop_igp + y_off_right, box.geometricBounds[1] + w_dop_igp];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fillColor = "None";
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                                logo_dop_igp = extra.referenceTo;

                                y_off_right += 2 + h_dop_igp;
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                            }

                        }
                    }
                }

                var logo_sed_bound = [0, 0, 0, 0];

                if (objItem.codiceBox != "BOX40") {
                    if (extra.sigla == "logo_BassieFissi" && materiale != "ISTITUZIONALE") {

                        try {
                            //mettiamo il bound all'angolo destro del box + y_off_right
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            var w_logo = extra.referenceTo.geometricBounds[3] - extra.referenceTo.geometricBounds[1];
                            var bounds_rect = [box.geometricBounds[0] + y_off_right, box.geometricBounds[3] - w_logo, box.geometricBounds[0] + h_logo + y_off_right, box.geometricBounds[3]];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_right += 2 + h_logo;
                        }
                        catch (error) {
                            //Dovrei mettere no_foto
                        }
                    }

                    if (extra.sigla == "logo_attributo_it" != null && extra.sigla == "logo_attributo_it") {
                        try {

                            var pos = [box.geometricBounds[1] + 10, box.geometricBounds[0] + 10];


                            if (extra.referenceTo != null) {
                                
                                extra.referenceTo.move(pos);
                                
                                extra.referenceTo.textFrames.item(0).contents = objItem.logo_attributo_it.replace("<br>", "\n");
                            }

                        }
                        catch (error) {
                            //Dovrei mettere no_foto   
                            console.error("IDMS ERROR " + error.message);
                        }

                    }

                    //Metto la testata CONAD se è un prodotto conad
                    var listaProdottiConad = ["bio",
                        "saporidintornipq",
                        "saporiideepq",
                        "cpq",
                        "saporidintorni",
                        "saporiidee",
                        "kids",
                        "piacersi",
                        "aslattosio",
                        "asglutine",
                        "vn",
                        "parafarmacia",
                        "11p",
                        "baby",
                        "essentiae",
                        "petfrplus",
                        "petfr",
                        "logo"];
                    if (listaProdottiConad.includes(extra.sigla) && materiale != "ISTITUZIONALE") {
                        try {
                            //Le misure sono da considerarsi in millimetri

                            var x_offset = 0;
                            var y_offset = 0;
                            var w_offset = 20.997;
                            var h_offset = 11.599;

                            if (extra.sigla == "logo") {
                                w_offset = 21.378;
                                h_offset = 4.487;
                            }
                            else if (extra.sigla == "cpq") {
                                w_offset = 38.566;
                                h_offset = 6.562;
                            }
                            else if (extra.sigla == "kids") {
                                w_offset = 16.087;
                                h_offset = 14.647;

                            }
                            else if (extra.sigla == "piacersi") {
                                //w_offset = 20.997;//27.263;
                                h_offset = 10.245;//13.293;

                            }
                            else if (extra.sigla == "aslattosio") {
                                w_offset = 21.421;
                                h_offset = 9.779;
                            }
                            else if (extra.sigla.indexOf("saporidintorni") >= 0 || extra.sigla.indexOf("saporiidee") >= 0) {
                                w_offset = 14.139;
                                h_offset = 16.764;//11.599;
                            }
                            else if (extra.sigla == "vn") {
                                w_offset = 18.542;
                                h_offset = 12.446;
                            }
                            else if (extra.sigla == "parafarmacia") {
                                w_offset = 22.987;
                                h_offset = 5.165;
                            }
                            else if (extra.sigla == "11p") {
                                w_offset = 12.615;
                                h_offset = 13.547;
                            }
                            else if (extra.sigla== "baby") {
                                w_offset = 12.192;
                                h_offset = 9.737;
                            }
                            else if (extra.sigla == "essentiae") {
                                w_offset = 22.987;
                                h_offset = 8.467;
                            }
                            else if (extra.sigla.indexOf("petfr") >= 0) {
                                w_offset = 21.421;
                                h_offset = 10.837;
                            }




                            var y = box.geometricBounds[0] + 1;
                            var x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                            var h = y + h_offset;
                            var w = x + w_offset

                            bounds_rect2 = [y, x, h, w];


                            if (pz_lbl_titolari != null) {

                                if (canale == "SC") {
                                    if (extra.sigla == "cpq") {
                                        w_offset = 22.987;
                                        h_offset = 3.911;

                                        y = box.geometricBounds[0] + 1;
                                        x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                                        h = y + h_offset;
                                        w = x + w_offset;

                                        bounds_rect2 = [y, x, h, w];
                                    }

                                    var carte_titolo = pz_lbl_titolari.pageItems.item(0);
                                    var rect = pz_lbl_titolari.pageItems.item(1);
                                    if (carte_titolo.label == "Titolari_fascia") {
                                        carte_titolo = pz_lbl_titolari.pageItems.item(1);
                                        rect = pz_lbl_titolari.pageItems.item(0);
                                    }



                                    rect.move([rect.geometricBounds[1] - 25, rect.geometricBounds[0]]);


                                    var w_lbl = (box.geometricBounds[3] - box.geometricBounds[1]) - 25;
                                    var w_carte = carte_titolo.geometricBounds[3] - carte_titolo.geometricBounds[1];

                                    carte_titolo.move([box.geometricBounds[1] + ((w_lbl - w_carte) / 2), carte_titolo.geometricBounds[0]]);
                                }
                                else {
                                    y = box.geometricBounds[0] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 1 : 10);
                                    x = box.geometricBounds[1] + (box.geometricBounds[3] - box.geometricBounds[1] - w_offset - 1);
                                    h = y + h_offset;
                                    w = x + w_offset;

                                    bounds_rect2 = [y, x, h, w];

                                }

                            }

                            extra.referenceTo.geometricBounds = bounds_rect2;
                            if (extra.sigla == "saporidintorni" || extra.sigla == "saporiidee")
                                logo_sed_bound = extra.referenceTo.geometricBounds;

                            //var obj_file_conad = File(pathLavorazione + "/Links/conad_" + obj.prodotto_conad + ".psd");
                            extra.referenceTo.fillColor = "None";
                            // if (extra.sigla != "cpq" || pz_lbl_titolari == null)
                            //     extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            // else
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                            if (objItem.codiceBox == "BOX2" || objItem.codiceBox == "BOX62") {
                                loghiPerPosizionamentoInBoxOri.push(extra.referenceTo);
                            }
                            var altezza_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            y_off_right += 2 + altezza_logo;

                        }
                        catch (error) {
                            //Dovrei mettere no_foto
                            console.error(error);
                        }
                    }

                    if ((extra.sigla.toLowerCase().startsWith("logo_carne") || extra.sigla == ("LOGO_filiera"))
                         && materiale != "ISTITUZIONALE") {
                        try {
                            //calcoliamo l'altezza di referenceTo
                            var h_logo = extra.referenceTo.geometricBounds[2] - extra.referenceTo.geometricBounds[0];
                            var w_logo = extra.referenceTo.geometricBounds[3] - extra.referenceTo.geometricBounds[1];
                            var bounds_rect = [box.geometricBounds[0] + y_off_left, box.geometricBounds[1], box.geometricBounds[0] + y_off_left+h_logo, box.geometricBounds[1] + w_logo];

                            if (extra.sigla.indexOf("Chianina") >= 0){
                                //????
                                bounds_rect = [logo_sed_bound[0], logo_sed_bound[1] - 14.986 - 1, logo_sed_bound[0] + 14.647, logo_sed_bound[1] - 1];
                            }
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fillColor = "None";
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            y_off_left += 2 + h_logo;

                        } catch (error) { 
                            console.error(error);
                        }
                        
                    }

                    if (((extra.sigla.startsWith("INOSTRIORI") && objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("inostriori") >= 0) || 
                        (extra.sigla.startsWith("TERRITORIO") && objItem.territorialita != null && objItem.territorialita.toLowerCase().indexOf("territorio") >= 0)) && 
                        objItem.codiceBox != "solo_descr") {

                        var bounds_rect = [box.geometricBounds[0] + 1, box.geometricBounds[3] - 1 - 14.5, box.geometricBounds[0] + 1 + 14.5, box.geometricBounds[3] - 1];


                        if (isMZLOC) {
                            bounds_rect = [box.geometricBounds[0], box.geometricBounds[3] - 14.5, box.geometricBounds[0] + 14.5, box.geometricBounds[3]];
                        }
                        else {
                            //Dobbiamo piazzare il logo INOSTRIORI
                            if (pz_lbl_titolari != null) {
                                bounds_rect = [bounds_rect[0] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[1], bounds_rect[2] + (objItem.combinazioneAssegnata.indexOf("_FID") < 0 ? 0 : 10), bounds_rect[3]];
                            }
                        }

                        var potenziale_dettaglio_errore = "";
                        var gr = extra.referenceTo.graphics.item(0);
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                        extra.referenceTo.geometricBounds = bounds_rect;


                        // let counterSecurity=0;

                        // while(true)
                        // {
                        //     try {

                        //         //console.log("Tentativo " + counterSecurity);
                        //         extra.referenceTo.geometricBounds = bounds_rect;
                                
                        //         if (gr.isValid) 
                        //         {


                        //             //console.error(isMZLOC);
                        //             if (objItem.distintivita.toLowerCase().indexOf("inostriori") < 0) {
                        //                 if (objItem.distintivita.toLowerCase().indexOf("territorio") >= 0) {
                        //                     //Logo Territorio / No inostriori

                        //                     var suffix_LOC = "LOC_";
                        //                     if (!isMZLOC) {
                        //                         suffix_LOC = "VOL_";
                        //                     }

                                            
                        //                     //console.warn(gr.isValid);
                        //                     gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_territorio_generico").currentVisibility = false;
                        //                     if (area == "SP") {
                        //                         //Rimane default
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_generico").currentVisibility = true;
                        //                     }
                        //                     else if (area == "AO") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_AOSTA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "TO") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_TO").currentVisibility = true;
                        //                     }
                        //                     else if (area == "PI") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_PI").currentVisibility = true;
                        //                     }
                        //                     else if (area == "SA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_SA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "LA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LA").currentVisibility = true;
                        //                     }
                        //                     else if (area == "EM") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_EM").currentVisibility = true;
                        //                     }
                        //                     else if (area == "LI") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName(suffix_LOC + "territorio_LI").currentVisibility = true;
                        //                     }
                        //                 }
                        //             }
                        //             else {
                                        

                        //                 if (isMZLOC) {
                        //                     if (area == "TO" >= 0 && area == "SP") {

                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico").currentVisibility = false;
                        //                         if (objItem.reparto == "31") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico_PESCE").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = true;
                        //                         }

                        //                     }
                        //                     else if (area == "PI" && area == "AOSTA") {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_generico").currentVisibility = false;
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_inostriori_AOSTA").currentVisibility = true;
                        //                     }
                        //                     else {
                        //                         gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita).currentVisibility = false;
                        //                         if (objItem.reparto == "31") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_" + objItem.distintivita + "_PESCE").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("LOC_" + objItem.distintivita).currentVisibility = true;
                        //                         }
                        //                     }
                        //                 }
                        //                 else {
                        //                     if (objItem.reparto == "31") {
                        //                         if ( area == "TO" && area == "SP") {

                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_generico_PESCE").currentVisibility = true;
                        //                         }
                        //                         else if (area == "PI" && area == "AOSTA") {
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_inostriori_AOSTA").currentVisibility = true;
                        //                         }
                        //                         else {
                        //                             potenziale_dettaglio_errore = "LAYER VOL_" + objItem.distintivita + "_PESCE non trovato nel logo " + objItem.distintivita + ".psd";

                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita).currentVisibility = false;
                        //                             gr.properties.graphicLayerOptions.graphicLayers.itemByName("VOL_" + objItem.distintivita + "_PESCE").currentVisibility = true;
                        //                         }


                        //                     }

                        //                 }


                        //             }
                        //         }
                        //         else
                        //         {
                        //             throw "Errore nel caricamento del logo TERRITORIO";
                        //         }
                                

                        //         pzLogoOri = rect;
                        //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        //         console.log("SUCCESS al " + counterSecurity);

                        //         break;
                        //     }
                        //     catch (error) {
                        //         if (potenziale_dettaglio_errore != "") {
                        //             console.error(potenziale_dettaglio_errore);
                        //         }
                        //         else {
                        //             console.error(error);
                        //         }
                        //     }
                        //     finally
                        //     {
                        //         counterSecurity++;
                        //         if (counterSecurity>=10)
                        //         {
                        //             break;
                        //         }
                        //     }
                        
                        // }
                        
                    }

                    // if (extra.sigla == "da_controllare") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if (extra.sigla == "logo_selezione" && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if ((extra.sigla == "toscana" ||
                    //     extra.sigla == "lazio" ||
                    //     extra.sigla == "sardegna" ||
                    //     extra.sigla == "piemonte" ||
                    //     extra.sigla == "emilia" ||
                    //     extra.sigla == "liguria" ||
                    //     extra.sigla == "valledaosta" ||
                    //     extra.sigla == "tirreno"
                    // )
                    //     && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //     }
                    // }

                    // if (extra.sigla == "Logo_VistoinTV" && materiale != "ISTITUZIONALE") {

                    //     try {
                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                    //     }
                    //     catch (error) {
                    //         //Dovrei mettere no_foto
                    //         //console.error("in tv error: " + error);
                    //     }
                    // }

                    // if ((extra.sigla == "Logo_PE_PRONTIdaMangiare" ||
                    //     extra.sigla == "Logo_PE_PRONTIdaCuocere" ||
                    //     extra.sigla == "Logo_PE_CONFalNaturale" ||
                    //     extra.sigla == "Logo_Friend_of_the_Sea" ||
                    //     extra.sigla == "Logo_Marinou"
                    // )
                    //     && materiale != "ISTITUZIONALE") {

                    //         var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                    //         extra.referenceTo.geometricBounds = bounds_rect;
                    //         extra.referenceTo.fillColor = "None";
                    //         extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);


                    //     // var loghi_pesce = obj.logo_pesce.split(",");
                    //     // var xy_off = 0;
                    //     // for (var $lp = 0; $lp < loghi_pesce.length; $lp++) {
                    //     //     try {
                    //     //         var bounds_rect = [box.geometricBounds[0] + xy_off, box.geometricBounds[1] + xy_off, box.geometricBounds[2] + xy_off, box.geometricBounds[3] + xy_off];
                    //     //         extra.referenceTo.geometricBounds = bounds_rect;
                    //     //         extra.referenceTo.fillColor = "None";
                    //     //         extra.referenceTo.fit(FitOptions.FRAME_TO_CONTENT);

                    //     //         xy_off += 2;

                    //     //     } catch (error) { }
                    //     // }
                    // }
                }



                var offset_boll = [0, 0];

                if (extra.sigla == "boll_Vedi_Lista") {
                    //metto il logo
                    try {
                        var bounds_rect = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[2], box.geometricBounds[3]];
                        if (objItem.corretto_edro21 == "true") //da fixare
                            bounds_rect = [box.geometricBounds[0] + 14.99, box.geometricBounds[1], box.geometricBounds[2] + 14.99, box.geometricBounds[3]];

                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino Vedi Lista");
                        console.error(error);
                    }
                }

                // if (objItem.boll_distintivita != "") {
                if(extra.sigla == "boll_TIPICO" || extra.sigla == "boll_BENESSERE")
                    {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) { 
                        console.error(error);
                    }
                }

                //if (objItem.boll_ruolo != "") {
                if (extra.sigla == "boll_STAR" || 
                    extra.sigla == "boll_VEDETTE" ||
                    extra.sigla == "boll_PPAG" ||
                    extra.sigla == "boll_ARTWORK") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];

                        //STAR , VEDETTE
                        var lay = doc.layers.itemByName("bollini");
                        if (extra.sigla.indexOf("STAR") >= 0 || extra.sigla.indexOf("VEDETTE") >= 0)
                            lay = doc.layers.itemByName("Bollini IMP");

                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.layer = lay;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino STAR");
                        console.error(error);
                    }
                }

                //if (objItem.noPunti_daConad == "true") {
                if (extra.sigla == "boll_NOPUNTI_DACONAD") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino NO PUNTI DA CONAD");
                        console.error(error);
                    }
                }

                //if (objItem.etto_lista_diverso == "true") {
                if (extra.sigla == "boll_ETTO_lista_DIVERSO") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino ETTO LISTA DIVERSO");
                        console.error(error);
                    }
                }

                //if (objItem.NO_Esempio == "true") {
                if (extra.sigla == "boll_ESEMPIO_NONnecessario") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];

                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino ESEMPIO NON NECESSARIO");
                        console.error(error);
                    }
                }

                if (extra.sigla == "boll_MG_NoFIDELITY") {
                    try {
                        var bounds_rect = [box.geometricBounds[0] + offset_boll[0], box.geometricBounds[1] + offset_boll[1], box.geometricBounds[2] + offset_boll[0], box.geometricBounds[3] + offset_boll[1]];
                        extra.referenceTo.geometricBounds = bounds_rect;
                        extra.referenceTo.fillColor = "None";
                        extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);

                        offset_boll = [offset_boll[0] + 2, offset_boll[1] + 2];
                    }
                    catch (error) {
                        console.error("Errore nel posizionamento del bollino MG NO FIDELITY");
                    console.error(error);
                    }
                }
            }
        }

        
        //fine loghi

        // if (objItem.note != null && objItem.note != "") {
        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];

        //     var txt_note = myPage.textFrames.add(doc.layers.itemByName("NOTE"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });

        //     var str_note = objItem.note.toString();

        //     while (true) {
        //         if (str_note.indexOf("<br>") >= 0) {
        //             str_note = str_note.replace("<br>", "\n");
        //         }
        //         else {
        //             break;
        //         }

        //     }

        //     txt_note.contents = str_note;//obj.note.toString().replace("<br>","\n");
        // }

        // if (objItem.note_category != null && objItem.note_category != "") {

        //     var myh = hBOX_mastro;
        //     var mycoord = [box.geometricBounds[0] + (myh / 2), box.geometricBounds[1], box.geometricBounds[0] + (myh / 2) + (hBOX_mastro / 2), box.geometricBounds[1] + wBOX_mastro];

        //     var txt_nota_category = myPage.textFrames.add(doc.layers.itemByName("NOTE_CATEGORY"), LocationOptions.UNKNOWN, box, { geometricBounds: mycoord });

        //     var str_note = objItem.note_category.toString();
        //     while (true) {
        //         if (str_note.indexOf("<br>") >= 0) {
        //             str_note = str_note.replace("<br>", "\n");
        //         }
        //         else {
        //             break;
        //         }

        //     }

        //     txt_nota_category.contents = str_note;
        // }

        if (sez_data != null && sez_data != "") {
            var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];
            var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZ_DATA"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
            txt_data.contents = sez_data;
            try {
                for (var $c = 0; $c < txt_data.contents.length; $c++)
                    txt_data.characters.item($c).appliedCharacterStyle = "SEZ_DATA";
            } catch (error) { 
                console.error("Errore nello stile del testo SEZ_DATA");
                console.error(error);
            }
        }

        // if (objItem.sezione != null && objItem.sezione != "") {

        //     if (doc.layers.itemByName("SEZIONE_VOL") == null || !doc.layers.itemByName("SEZIONE_VOL").isValid) {
        //         doc.layers.add({ name: "SEZIONE_VOL" });
        //         doc.layers.itemByName("SEZIONE_VOL").move(LocationOptions.AFTER, doc.layers.itemByName("NOTE_CATEGORY"));
        //     }

        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];
        //     var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZIONE_VOL"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
        //     txt_data.contents = objItem.sezione;
        //     try {
        //         for (var $c = 0; $c < txt_data.contents.length; $c++)
        //             txt_data.characters.item($c).appliedCharacterStyle = "SEZIONE_VOL";
        //     } catch (error) {
        //         console.error("Errore nello stile del testo SEZIONE_VOL");
        //         console.error(error);
        //      }
        // }

        // try {
        //     //Scrivo la nota con codice referenza
        //     var gb = [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + hBOX_mastro, box.geometricBounds[1] + wBOX_mastro];

        //     var txt_cod_ref = myPage.textFrames.add(doc.layers.itemByName("CODICE REF"), LocationOptions.UNKNOWN, box, { geometricBounds: gb });
        //     txt_cod_ref.contents = objItem["Referenza.Codice"];
        // }
        // catch (error) {
        //     console.error("Errore nel posizionamento del codice referenza");
        //     console.error(error);
        // }

        if (pz_rect_regionale != null) {
            try {
                var newy = pz_rect_regionale.geometricBounds[0];

                if (canale == "SC" && cimitero["PIEDE_Titolari"] != null) {
                    if (pz_offerta != null && objItem.codiceBox == "BOX12_SC") {
                        pz_offerta.geometricBounds = [pz_offerta.geometricBounds[0] - 2, pz_offerta.geometricBounds[1], pz_offerta.geometricBounds[2] - 2, pz_offerta.geometricBounds[3]];
                    }
                    if (pz_kgl_sconto != null && objItem.codiceBox == "BOX12_SC") {
                        pz_kgl_sconto.geometricBounds = [pz_kgl_sconto.geometricBounds[0] - 2, pz_kgl_sconto.geometricBounds[1], pz_kgl_sconto.geometricBounds[2] - 2, pz_kgl_sconto.geometricBounds[3]];
                    }
                    if (pz_sconto_piccolo != null && objItem.codiceBox == "BOX12_SC") {
                        pz_sconto_piccolo.geometricBounds = [pz_sconto_piccolo.geometricBounds[0] - 2, pz_sconto_piccolo.geometricBounds[1], pz_sconto_piccolo.geometricBounds[2] - 2, pz_sconto_piccolo.geometricBounds[3]];
                    }
                }

                if (pz_offerta != null) {
                    newy = pz_offerta.geometricBounds[0];
                }
                if (canale != "SC") {
                    if (pz_anziche != null) {
                        newy = pz_anziche.geometricBounds[0];
                    }
                    else if (pz_sconto_grande != null &&
                        (pz_alletto != null || objItem.combinazioneAssegnata.indexOf("_regionale") > 0 || objItem.combinazioneAssegnata.indexOf("_bdp") > 0 || objItem.combinazioneAssegnata.indexOf("_sdb") > 0)) {
                        newy = pz_sconto_grande.geometricBounds[0];

                    }
                }
                else if (isMZLOC && canale == "SC") {
                    //Il box deve coprire anche il campo sconto se presente
                    if (pz_anziche != null) {
                        newy = pz_anziche.geometricBounds[0];
                    }
                    else if (pz_sconto_grande != null) {
                        newy = pz_sconto_grande.geometricBounds[0];
                    }
                }

                //Devo sistemare anche l'allinemaneto a sinistra
                var leader_offset = 1000000;
                if (pz_kgl_sconto != null && pz_kgl_sconto.visible) {
                    leader_offset = pz_kgl_sconto.characters.item(0).horizontalOffset;
                }
                if (pz_offerta != null && pz_offerta.visible) {
                    var score = 0;
                    if (pz_offerta.label == "prezzo_offerta_gruppo") {
                        if (pz_offerta.allPageItems.length > 1)
                            score = pz_offerta.allPageItems[1].characters.item(0).horizontalOffset;
                        else
                            score = pz_offerta.allPageItems[0].characters.item(0).horizontalOffset;
                    }
                    else {
                        score = pz_offerta.characters.item(0).horizontalOffset;
                    }

                    if (leader_offset > score) {
                        leader_offset = score;
                    }
                }

                if (pz_sconto_meno != null) {
                    var ch = pz_sconto_meno.characters.item(0);
                    if (leader_offset > ch.horizontalOffset) {
                        leader_offset = ch.horizontalOffset;
                    }
                }


                if (pz_alletto != null) {

                    var offset = newy - pz_rect_regionale.geometricBounds[0];

                    var adj = 0;
                    if ((pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) > (pz_rect_regionale.geometricBounds[2] - newy))
                        adj = (pz_alletto.geometricBounds[2] - pz_alletto.geometricBounds[0]) - (pz_rect_regionale.geometricBounds[2] - newy);

                    pz_alletto.geometricBounds = [
                        pz_alletto.geometricBounds[0] - offset,
                        pz_alletto.geometricBounds[1],
                        pz_alletto.geometricBounds[2] - offset + adj,
                        pz_alletto.geometricBounds[3]
                    ];

                    if (pz_sconto_grande != null) {
                        var offset_sconto_grande = (pz_sconto_grande.geometricBounds[2] - pz_sconto_grande.geometricBounds[0]);
                        offset += offset_sconto_grande;
                    }

                    pz_alletto.geometricBounds = [
                        newy,
                        pz_alletto.geometricBounds[1],
                        box.geometricBounds[2],
                        pz_alletto.geometricBounds[3]
                    ];

                    if (pz_alletto.overflows) {
                        pz_alletto.textFramePreferences.insetSpacing = [pz_alletto.textFramePreferences.insetSpacing[0],
                            0.5,
                        pz_alletto.textFramePreferences.insetSpacing[2],
                        pz_alletto.textFramePreferences.insetSpacing[3]];
                    }

                }

                var off_x = pz_rect_regionale.geometricBounds[1];
                if (leader_offset != 1000000) {
                    off_x = leader_offset - 1.5;
                }

                var newy_bottom = pz_rect_regionale.geometricBounds[2];
                if (objItem.deletedFields.find(f=>f.labelName == "PIEDE_Titolari") != null)
                    newy_bottom = pz_base.geometricBounds[2] - 2;

                pz_rect_regionale.geometricBounds = [
                    newy,
                    off_x,
                    newy_bottom,
                    pz_rect_regionale.geometricBounds[3]
                ];

                if (canale == "SC" && (objItem.deletedFields.find(f=>f.labelName == "PIEDE_Titolari") != null || objItem.codiceBox != "BOX12_SC")) {
                    if (objItem.codiceBox == "BOX12_SC") {
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
                    if (pz_blocco_allineamenti != null && objItem.codiceBox == "BOX6_SC") {
                        if (objItem.combinazioneAssegnata.indexOf("bdp") > 0 || objItem.combinazioneAssegnata.indexOf("sdb") > 0) {
                            pz_blocco_allineamenti.move([pz_blocco_allineamenti.geometricBounds[1], pz_blocco_allineamenti.geometricBounds[0] - 2]);
                        }
                    }
                }

            } catch (error) {
                console.error("Errore nel posizionamento del rettangolo regionale");
                console.error(error);
            }
        }




        if (pz_rect_DescrPrezziORI != null) {
            if (livelli_meccanica.length > 0) {
                var lastItem = livelli_meccanica[livelli_meccanica.length - 1];
                pz_rect_DescrPrezziORI.geometricBounds = [pz_rect_DescrPrezziORI.geometricBounds[0], pz_rect_DescrPrezziORI.geometricBounds[1], lastItem.geometricBounds[2] + 1, pz_rect_DescrPrezziORI.geometricBounds[3]];
            }
        }

        //Adesso avviene il ridimensionamento

        var gap_y_descrTerr_baseTerr = 0;
        if (pz_boxDescrPrezzi_ORI_TERRITORIO != null) {
            if (pzLogoOri == null) {
                if (pz_base_territorio != null && pz_base_territorio.isValid) {
                    gap_y_descrTerr_baseTerr = pz_base_territorio.geometricBounds[0] - pz_boxDescrPrezzi_ORI_TERRITORIO.geometricBounds[0];
                }
            }
        }    

        if (g_new_all.length > 0)
        {
            var oldGroup = box;
            var oldLabel = oldGroup.label;
            var oldItems = oldGroup.pageItems.everyItem().getElements();
            oldGroup.ungroup();

            var newItems = oldItems.concat(g_new_all);
            box = myPage.groups.add(newItems);
            box.label = oldLabel;

            //scorriamo tutti gli oggetti in newGroup in cerca di label "immagine" e la portiamo in primo piano
            var fotoPrimaria = null;
            var base = null;
            var fondo = null;
            for (var i = 0; i < box.allPageItems.length; i++) {
                if (box.allPageItems[i].label.startsWith("foto_secondaria")) {
                    box.allPageItems[i].sendToBack();
                }
                if(box.allPageItems[i].label.startsWith("immagine")){
                    fotoPrimaria = box.allPageItems[i];
                }
                if(box.allPageItems[i].label == "nuovo_fondo_distintivita"){
                    fondo = box.allPageItems[i];
                }
                if(box.label == "BOX2" || box.label == "BOX62"){
                    if(box.allPageItems[i].label == "gruppo_inostriori_territorio"){
                        base = box.allPageItems[i];
                    }
                }
                else{
                    if(box.allPageItems[i].label.indexOf("base") == 0){
                        base = box.allPageItems[i];
                    }
                }
            }

            if (fotoPrimaria != null) {
                fotoPrimaria.sendToBack();
            }
            if (base != null) {
                base.sendToBack();
            }
            if (fondo != null) {
                fondo.sendToBack();
            }

        }
        this.ridimensionamento(wBOX, hBOX, wBOX_mastro, hBOX_mastro, box);


        return ["new", objItem, box];

    },

    ridimensionamento(box, boxInGrigliaBounds){//wBOX, hBOX, wBOX_mastro, hBOX_mastro, box){

        let wBOX_mastro = boxInGrigliaBounds[3] - boxInGrigliaBounds[1];
        let hBOX_mastro = boxInGrigliaBounds[2] - boxInGrigliaBounds[0];


        let wBOX = box.visibleBounds[3] - box.visibleBounds[1];
        let hBOX = box.visibleBounds[2] - box.visibleBounds[0];


        let baseEl = Utility.getFieldByLabel("base",box);
        let diff_x = wBOX_mastro - wBOX;
        let diff_y = hBOX_mastro - hBOX;

        let wMin = wBOX_mastro/3;
        let hMin = hBOX_mastro/3;

        if (baseEl!=null)
        {
            //Il componente è ridimensionabile

            baseEl.geometricBounds = [
                baseEl.geometricBounds[0],
                baseEl.geometricBounds[1],
                baseEl.geometricBounds[2]+diff_y,
                baseEl.geometricBounds[3]+diff_x
            ];



            //Adesso il box ha ereditato l'ingombro del box griglia
            let prezzoPromoEl = null;
            let prezzoPromoKglEl = null;
            let scontolEl = null;
            let imgEl = null;
            let ico_prezzosuperEl= null;
            let prezzo_info_packEl = null;
            let cardEl = null;
            let descrEl=null;
            let boxPrezzoEl=null;
            let boxTastoEl=null;

            let secondarie = [];
            let foto_extra = [];
            for (let i=0; i<box.allPageItems.length; i++)
            {
                let item = box.allPageItems[i];
                let lab=item.label;
                if (lab=="prezzo_promo")
                {
                    prezzoPromoEl = item;
                }
                else if (lab=="prezzo_promo_kgl")
                {
                    prezzoPromoKglEl = item;
                }                
                else if (lab=="txt_sconto")
                {
                    scontolEl = item;
                }           
                else if (lab.startsWith("immagine"))
                {
                    imgEl = item;
                }
                else if (lab.indexOf("foto")>=0 && lab.indexOf("secondari")>=0)
                {
                    secondarie.push(item);
                }
                else if (lab.indexOf("foto_extra")>=0)
                {
                    foto_extra.push(item);
                }
                else if (lab=="ico_prezzosuper")
                {
                    ico_prezzosuperEl = item;
                }
                else if (lab=="prezzo_info_pack")
                {
                    prezzo_info_packEl = item;
                }
                else if (lab=="card")
                {
                    cardEl = item;
                }
                else if (lab=="descrizione")
                {
                    descrEl = item;
                }
                else if (lab=="box_prezzo")
                {
                    boxPrezzoEl = item;
                }
                else if (lab=="box_tasto")
                {
                    boxTastoEl = item;
                }

            }

            let ficoLav=ficoProcess.getFormatoLavorazioneCorrente();
            let tipo_lavorazione=ficoLav.tipo;
            let formato_lavorazione=ficoLav.codice;

            let marginPadding = 2;
            if (tipo_lavorazione==2)
            {
                marginPadding=10;
                if (formato_lavorazione == "115x75") {
                    marginPadding=2.8;
                }
            }

            if (tipo_lavorazione==1)
            {
                //Volantino ridimensionamento

                //BOTTOM - SX
                if (prezzoPromoEl!=null)
                {
                    prezzoPromoEl.geometricBounds=[
                        prezzoPromoEl.geometricBounds[0]+diff_y,
                        prezzoPromoEl.geometricBounds[1],
                        prezzoPromoEl.geometricBounds[2]+diff_y,
                        prezzoPromoEl.geometricBounds[3],
                    ];
                }
                if (prezzoPromoKglEl!=null)
                {
                    prezzoPromoKglEl.geometricBounds=[
                        prezzoPromoKglEl.geometricBounds[0]+diff_y,
                        prezzoPromoKglEl.geometricBounds[1],
                        prezzoPromoKglEl.geometricBounds[2]+diff_y,
                        prezzoPromoKglEl.geometricBounds[3],
                    ];
                }
                if (prezzo_info_packEl!=null)
                {
                    prezzo_info_packEl.geometricBounds=[
                        prezzo_info_packEl.geometricBounds[0]+diff_y,
                        prezzo_info_packEl.geometricBounds[1],
                        prezzo_info_packEl.geometricBounds[2]+diff_y,
                        prezzo_info_packEl.geometricBounds[3],
                    ];
                }
                if (boxPrezzoEl!=null)
                {
                    boxPrezzoEl.geometricBounds=[
                        boxPrezzoEl.geometricBounds[0]+diff_y,
                        boxPrezzoEl.geometricBounds[1],
                        boxPrezzoEl.geometricBounds[2]+diff_y,
                        boxPrezzoEl.geometricBounds[3],
                    ];
                }

                //TOP - DX
                if (scontolEl!=null)
                {
                    scontolEl.geometricBounds=[
                        scontolEl.geometricBounds[0],
                        scontolEl.geometricBounds[1]+diff_x,
                        scontolEl.geometricBounds[2],
                        scontolEl.geometricBounds[3]+diff_x,
                    ];
                }
                if (ico_prezzosuperEl!=null)
                {
                    ico_prezzosuperEl.geometricBounds=[
                        ico_prezzosuperEl.geometricBounds[0],
                        ico_prezzosuperEl.geometricBounds[1]+diff_x,
                        ico_prezzosuperEl.geometricBounds[2],
                        ico_prezzosuperEl.geometricBounds[3]+diff_x,
                    ];
                }

                if (cardEl!=null && diff_x<0)
                {
                    //Ridimensionamneto a restringere
                    //Le card devono subire il ridimensionamento (per forza PROPORZIONALE) e per come son fatte dovrebbero auto adattarsi al nuovo boundary
                    
                    let currW=(cardEl.geometricBounds[3]-cardEl.geometricBounds[1]);
                    let currH=(cardEl.geometricBounds[2]-cardEl.geometricBounds[0]);
                    let newW = currW + diff_x;
                    let newH = (newW*currH)/currW;

                    cardEl.geometricBounds = [
                        cardEl.geometricBounds[0],
                        cardEl.geometricBounds[1],
                        cardEl.geometricBounds[0]+newW,
                        cardEl.geometricBounds[1]+newH
                    ];

                }
            }


            //Intanto il limite minY ce lo impone la posizione di partenza della foto, sopra quello non si va
            let minY = imgEl.geometricBounds[0];
            let originMinY = minY; 
            let maxY = baseEl.geometricBounds[2];
            let limitYPrezzo = maxY;
            let limitXPrezzo = baseEl.geometricBounds[1];
            if (boxPrezzoEl!=null)
            {
                limitYPrezzo = boxPrezzoEl.geometricBounds[0];
                limitXPrezzo = boxPrezzoEl.geometricBounds[3];
            }
            else if (prezzoPromoEl!=null)
            {
                limitYPrezzo = prezzoPromoEl.geometricBounds[0];
                limitXPrezzo = prezzoPromoEl.lines.item(0).endHorizontalOffset;
            }
            
            if (box.label!="BOX_GASTRO" && box.label!="BOX_OF_SFUSI" && prezzoPromoKglEl!=null)
            {
                limitYPrezzo = prezzoPromoKglEl.geometricBounds[0];
                limitXPrezzo = prezzoPromoKglEl.lines.item(0).endHorizontalOffset;
            }

            if (tipo_lavorazione==2 && box.label=="BOX_GASTRO" || box.label=="BOX_OF_SFUSI")
            {
                if (prezzoPromoKglEl!=null)
                {
                    limitYPrezzo = prezzoPromoKglEl.geometricBounds[0];
                    limitXPrezzo = prezzoPromoKglEl.lines.item(0).endHorizontalOffset;
                }
                // if (prezzo_info_packEl!=null)
                // {
                //     limitYPrezzo = prezzo_info_packEl.geometricBounds[0];
                //     limitXPrezzo = prezzo_info_packEl.lines.item(0).endHorizontalOffset;
                // }
            }

            let boundsToFix = [];
            

            let marginBottomDescr=null;
          
            let descrIngombri=[];


            //Per PoP in alto abbiamo solo la descrizione
            //L'obiettivo è capire quante scalature di x ho in funzione delle righe
            let annullaBoundsDiDefault=false;
            let limitXDescrizione=0;
            if (descrEl!=null)
            {
                //devo ciclare le linee della descrizione
                let lines = descrEl.lines;
                //ciclo le linee
                if (lines.length>0)
                {
                    //Ciclo tutte le linee per analizzare gli ingombri
                    for(let l=0; l<lines.length; l++)
                    {
                        let line = lines.item(l);
                        marginBottomDescr = line.baseline;

                        if (limitXDescrizione<line.endHorizontalOffset)
                        {
                            limitXDescrizione = line.endHorizontalOffset;
                        }

                        descrIngombri.push([line.endHorizontalOffset, marginBottomDescr]);

                        if (line.baseline>minY)
                        {                            
                            //Si prende in considerazione la linea
                            let xOffset=line.endHorizontalOffset;
                            //let hVal = baseEl.geometricBounds[2]-minY;

                            //Scalatura valida
                            // if(xOffset<limitXPrezzo)
                            // {
                                let hVal=limitYPrezzo-minY;
                            //}
                            let wVal=baseEl.geometricBounds[3]-xOffset;

                            //Controllo idoneità dimensione
                            if (wVal>wMin && hVal>hMin)
                                boundsToFix.push({x:xOffset+marginPadding, y:minY+marginPadding, w:wVal-(marginPadding*2), h:hVal-(marginPadding*2)});

                            if (xOffset<imgEl.geometricBounds[1])
                            {

                            }
                            else
                            {
                                //La riga va sopra l'immagine per come è messa di default
                                //Dobbiamo resettare la posizione minima in top
                                minY = line.baseline;
                                //Si deve anche annullare l'inserimento (tra i bounds potenziali) del bounds di defualt
                                annullaBoundsDiDefault=true;
                            }
                        }
                    }
                }
            }

            //Sfruttate le scalature, si prova anche a vedere se c'è possibilità di un quadrante che sfrutti tutta l'altezza fino al bottomm box 
            //Accontentnadosi del margine destro lasciato dall'ingombro del prezzo
            let margineDestro = baseEl.geometricBounds[3]-limitXPrezzo;
            if (tipo_lavorazione==1)
            {
                margineDestro = baseEl.geometricBounds[3]-(limitXPrezzo>limitXDescrizione?limitXPrezzo:limitXDescrizione);
                if (margineDestro>wMin)
                {
                    boundsToFix.push({x:(limitXPrezzo>limitXDescrizione?limitXPrezzo:limitXDescrizione)+marginPadding, y:originMinY+marginPadding, w:margineDestro-(marginPadding*2), h:baseEl.geometricBounds[2]-originMinY-(marginPadding*2)});
                }
            }
            else if (tipo_lavorazione==2)
            {
                if (margineDestro>wMin)
                {
                    //prendo y più minima che posso
                    let yMinPerRightVertical = originMinY;
                    for (let _id=0; _id<descrIngombri.length; _id++)
                    {
                        if (descrIngombri[_id][0]>limitXPrezzo)
                        {
                            //Metto un nuovo limite perchè la descrizione mi attraversa lo spazio
                            yMinPerRightVertical = descrIngombri[_id][1];
                        }
                    }

                    let yMax=baseEl.geometricBounds[2];
                    if (prezzoPromoEl!=null)
                        yMax=prezzoPromoEl.lines.item(0).baseline;

                    if (yMax-yMinPerRightVertical>hMin)
                    {
                        boundsToFix.push({x:limitXPrezzo+marginPadding, y:yMinPerRightVertical+marginPadding, w:margineDestro-(marginPadding*2), h:yMax-yMinPerRightVertical-(marginPadding*2)});
                    }
                }
            }

            //Si guarda anche se c'è possibilità di allargare tutto a fine descr
            if (marginBottomDescr!=null)
            {
                let marginBetween = limitYPrezzo - marginBottomDescr;
                if (marginBetween>hMin)
                {
                    boundsToFix.push({x:baseEl.geometricBounds[1]+marginPadding, y:marginBottomDescr+marginPadding, w:baseEl.geometricBounds[3]-baseEl.geometricBounds[1]-(marginPadding*2), h:marginBetween-(marginPadding*2)});
                }
            }

            //Mettiamo anche quello attuale se non cozza con i bounds potenziali
            if (!annullaBoundsDiDefault)
                boundsToFix.push({x:imgEl.geometricBounds[1], y:imgEl.geometricBounds[0], w:imgEl.geometricBounds[3]-imgEl.geometricBounds[1], h:imgEl.geometricBounds[2]-imgEl.geometricBounds[0]});


            let realBounds = CssFramework.getRealBoundsOfFoto(imgEl,[0,0]);

            let wRealImg = realBounds[3]-realBounds[1];
            let hRealImg = realBounds[2]-realBounds[0];            

            let wRealImgPrimria=wRealImg;
            let hRealImgPrimaria=hRealImg;

            let wRealImgSecondaria1=0;
            let hRealImgSecondaria1=0;
            let wRealImgSecondaria2=0;
            let hRealImgSecondaria2=0;

            //Analisi foto secondarie
            let offsetSecondarie=[];
            
            let totalOffsetX=0;
            let totalOffsetY=0;
            let boundsOffset=[0,0,0,0];    
        

            if (secondarie.length>0)
            {
                let percentuale_superficie_2foto = 0.40;
                let percentuale_superficie_3foto = 0.30;



                function getOffsetSovrapposizione(w1, h1, velX, velY)
                {
                    let areaImg1 = w1 * h1;
                    const maxOverlapArea = areaImg1 * percentuale_superficie_2foto;

                    let bestOffset = { x: 0, y: 0 };

                    let tentativi = 0;
                    let offsetX=0;
                    let offsetY=0;
                    while (tentativi<100)
                    {
                        offsetX += velX;
                        offsetY += velY;

                        let areaX = offsetY * w1;
                        let areaY = offsetX * h1;

                        let areaOffset = (areaX+areaY) - (offsetX*offsetY);

                        // const xOverlap = Math.max(0, Math.min(w1, w2 + offsetX) - offsetX);
                        // const yOverlap = Math.max(0, Math.min(h1, h2 + offsetY) - offsetY);
                        // const overlapArea = xOverlap * yOverlap;

                        // if (overlapArea <= maxOverlapArea && overlapArea > bestOverlap) {
                        //     bestOverlap = overlapArea;
                        //     bestOffset = { x: offsetX, y: offsetY };
                        // }

                        //if (offsetX*offsetY>maxOverlapArea)
                        if (areaOffset>maxOverlapArea)
                        {
                            //Ok abbiamo sgomberato la superficie che ci serve
                            bestOffset = { x: offsetX, y: offsetY };
                            break;
                        }

                        tentativi++;
                    }


                    // for (let offsetX = 0; offsetX <= w1; offsetX+=velX) {
                    //     for (let offsetY = 0; offsetY <= hRealImg; offsetY+=velY) {
                    //         const xOverlap = Math.max(0, Math.min(w1, w2 + offsetX) - offsetX);
                    //         const yOverlap = Math.max(0, Math.min(h1, h2 + offsetY) - offsetY);
                    //         const overlapArea = xOverlap * yOverlap;

                    //         if (overlapArea <= maxOverlapArea && overlapArea > bestOverlap) {
                    //             bestOverlap = overlapArea;
                    //             bestOffset = { x: offsetX, y: offsetY };
                    //         }
                    //     }
                    // }

                    return bestOffset;
                }
                
                for (let fs=0; fs<secondarie.length; fs++)
                {
                     if (fs>1)
                        break;//Non riadattabili piu di tre foto complessive

                    let img = secondarie[fs];
                    
                    let realBoudsSec = CssFramework.getRealBoundsOfFoto(img,[0,0]);
                    let wRealSecImg = realBoudsSec[3]-realBoudsSec[1];
                    let hRealSecImg = realBoudsSec[2]-realBoudsSec[0];    
                    
                     if (fs==0) {   
                        wRealImgSecondaria1 = wRealSecImg;
                        hRealImgSecondaria1 = hRealSecImg;
                     }
                     else if (fs==1) {   
                        wRealImgSecondaria2 = wRealSecImg;
                        hRealImgSecondaria2 = hRealSecImg;
                     }



                    let stepX=4;
                    let stepY=2;
                    //stepY=stepX*(hRealImg/wRealImg);
                    let bestOffsetSecondaria =  getOffsetSovrapposizione(wRealImg, hRealImg,stepX,stepY);

                    // totalOffsetX += bestOffsetSecondaria.x;
                    // totalOffsetY += bestOffsetSecondaria.y;

                    if (fs==1)
                    {
                        bestOffsetSecondaria.y *=-1;
                    }

                    if (bestOffsetSecondaria.x>0)
                    {
                        if (bestOffsetSecondaria.x + wRealSecImg > wRealImg)
                        {
                            let avanzo = (bestOffsetSecondaria.x + wRealSecImg)-wRealImg;
                            //if (avanzo>boundsOffset[2])
                            boundsOffset[2] += avanzo;
                        }
                    }
                    else if (bestOffsetSecondaria.x<0 && bestOffsetSecondaria.x<boundsOffset[0])
                    {
                        
                        boundsOffset[0] = bestOffsetSecondaria.x;

                        let val=(wRealSecImg+bestOffsetSecondaria.x) - wRealImg;
                        if (wRealSecImg+bestOffsetSecondaria.x>wRealImg && boundsOffset[2]<val)
                            boundsOffset[2]=val;//Caso in cui pur essendoci un andamento ad andare verso sinistra, sporge la foto anche a destra
                    }

                    if (bestOffsetSecondaria.y>0)
                    {
                        if (bestOffsetSecondaria.y + hRealSecImg > hRealImg)
                        {
                            let avanzo = (bestOffsetSecondaria.y + hRealSecImg)-hRealImg;
                            //if (avanzo>boundsOffset[3])
                            boundsOffset[3] += avanzo;
                        }
                    }
                    else if (bestOffsetSecondaria.y<0 && bestOffsetSecondaria.y<boundsOffset[1])
                    {
                
                        boundsOffset[1] = bestOffsetSecondaria.y;

                        let val=(hRealSecImg+bestOffsetSecondaria.y) - hRealImg;

                        if (hRealSecImg+bestOffsetSecondaria.y>hRealImg && boundsOffset[3]<val)
                            boundsOffset[3]=val;

                        
                    }


                    offsetSecondarie.push(bestOffsetSecondaria);

                }
            }

            totalOffsetX=Math.abs(boundsOffset[0]) + boundsOffset[2];
            totalOffsetY=Math.abs(boundsOffset[1]) + boundsOffset[3];



            wRealImg += totalOffsetX;//totalOffsetX;
            hRealImg += totalOffsetY;//totalOffsetY;
            //Adesso l'ingombro delle foto  calcolato sulle dimensioni di default in cui ci troviamo 

            //Si procede con la scelta del bounds ideale

            let rapportoImg =  wRealImg/hRealImg

            let leader = 99999;
            let areaLeader = 0;
            let boundScelto = null;
            
            for(let i=0; i<boundsToFix.length; i++)
            {
                let bItem = boundsToFix[i];

                let destW=wRealImg;
                let destH=hRealImg;
                if (wRealImg>=bItem.w)
                {
                    destW = bItem.w;
                    destH = (hRealImg*destW)/wRealImg;// (destW*bItem.h)/bItem.w;
                    if (destH>bItem.h)
                    {
                        destH=bItem.h;
                        destW = (wRealImg*destH)/hRealImg;
                    }
                }   
                else if (hRealImg>=bItem.h)
                {
                    destH = bItem.h;
                    destW = (wRealImg*destH)/hRealImg;// (destW*bItem.h)/bItem.w;
                    if (destW>bItem.w)
                    {
                        destW=bItem.w;
                        destH = (hRealImg*destW)/wRealImg;
                    }

                }
                else
                {
                    //La img è contenuta nel bound
                    destW = bItem.w;
                    destH = (hRealImg*destW)/wRealImg;// (destW*bItem.h)/bItem.w;
                    if (destH>bItem.h)
                    {
                        destH=bItem.h;
                        destW = (wRealImg*destH)/hRealImg;
                    }

                }

                // let rapp=(bItem.w*bItem.h) - (destH*destW);
                // if (rapp<leader)
                // {
                //     boundScelto = bItem;
                //     leader=rapp;
                // }

                //Ricontrolliamo che questo bounds non invada la descrizione
                let isValid=true;
                for(let fb=0; fb<descrIngombri.length; fb++)
                {
                    let ing = descrIngombri[fb];
                    if (ing[0]>bItem.x && ing[1]>bItem.y)
                    {
                        isValid=false;
                        break;
                    }
                }

                if (isValid)
                {
                    let abs = Math.abs((bItem.w/bItem.h) - rapportoImg );

                    let areaTest = destW*destH;

                    //if (abs<leader && areaTest>areaLeader)
                    if (areaTest>areaLeader)
                    {
                        let diffBoundW = bItem.w-destW;
                        let diffBoundH = bItem.h-destH;

                        bItem.w=destW;
                        bItem.h=destH;
                        bItem.x += (diffBoundW/2);
                        bItem.y += (diffBoundH/2);


                        boundScelto = bItem;
                        areaLeader = areaTest;
                        leader=abs;
                    }
                }


            }

            if (boundScelto!=null)
            {

                //calcolo la percentuale di ridimensionamento x e y
                let globalPercW=boundScelto.w/wRealImg;
                let globalPercH=boundScelto.h/hRealImg;

                // let startW =  imgEl.geometricBounds[3]-imgEl.geometricBounds[1];
                // let startH = imgEl.geometricBounds[2]-imgEl.geometricBounds[0];
                // let percVariazioneW = (boundScelto.w-totalOffsetX)/startW;
                // let percVariazioneH = (boundScelto.h-totalOffsetY)/startH;


                //imgEl.geometricBounds=[boundScelto.y, boundScelto.x, boundScelto.y+boundScelto.h-totalOffsetY,boundScelto.x+boundScelto.w-totalOffsetX];
                imgEl.geometricBounds=[boundScelto.y, boundScelto.x, boundScelto.y+(hRealImgPrimaria*globalPercH),boundScelto.x+(wRealImgPrimria*globalPercW)];

                imgEl.fit(FitOptions.CONTENT_TO_FRAME);
                imgEl.fit(FitOptions.PROPORTIONALLY);
                let imgVicina = imgEl;
                for (let fs=0; fs<secondarie.length; fs++)
                {

                    if (fs>1)
                        break;//Non riadattabili piu di tre foto complessive

                    // let newH = (imgSec.geometricBounds[2]-imgSec.geometricBounds[0])*percVariazioneH;
                    // let newW = (imgSec.geometricBounds[3]-imgSec.geometricBounds[1])*percVariazioneW;

                    let imgSec = secondarie[fs];
                    let offset = offsetSecondarie[fs];
                    offset.y *= globalPercH;
                    offset.x *= globalPercW;

                    if (fs==0)
                    {
                        imgSec.geometricBounds=[imgVicina.geometricBounds[0]+offset.y,imgVicina.geometricBounds[1]+offset.x,imgVicina.geometricBounds[0]+(hRealImgSecondaria1*globalPercH)+offset.y,imgVicina.geometricBounds[1]+(wRealImgSecondaria1*globalPercW)+offset.x];
                    }
                    else if (fs==1)
                    {
                        imgSec.geometricBounds=[imgVicina.geometricBounds[0]+offset.y,imgVicina.geometricBounds[1]+offset.x,imgVicina.geometricBounds[0]+(hRealImgSecondaria2*globalPercH)+offset.y,imgVicina.geometricBounds[1]+(wRealImgSecondaria2*globalPercW)+offset.x];
                    }

                        imgSec.fit(FitOptions.CONTENT_TO_FRAME);
                        imgSec.fit(FitOptions.PROPORTIONALLY);

                        imgVicina=imgSec;
                    // }
                    // else if (fs==1)
                    // {  
                    //     //Sulla seconda l'offset y lo mando in alto
                    //     imgSec.geometricBounds=[imgVicina.geometricBounds[0]-offset.y,imgVicina.geometricBounds[1]+offset.x,imgVicina.geometricBounds[0]+(hRealImgSecondaria1*globalPercH)-offset.y,imgVicina.geometricBounds[1]+(wRealImgSecondaria1*globalPercW)+offset.x];
                    //     imgSec.fit(FitOptions.CONTENT_TO_FRAME);
                    //     imgSec.fit(FitOptions.PROPORTIONALLY);
                    // }
                }    
                
                
                //Adesso se sono due foto dovrei scambiare la foto priamria con quella secondaria
                if (secondarie.length==1)
                {
                    let imgSec;
                    for (let fs=0; fs<secondarie.length; fs++)
                    {
                        imgSec=secondarie[fs];
                    }


                    let geomBounds1 = imgEl.geometricBounds;
                    let geomBounds2 = imgSec.geometricBounds;

                    let wImg1 = geomBounds1[3]-geomBounds1[1];
                    let hImg1 = geomBounds1[2]-geomBounds1[0];

                    let wImg2 = geomBounds2[3]-geomBounds2[1];
                    let hImg2 = geomBounds2[2]-geomBounds2[0];

                    let diffX = wImg1-wImg2;
                    let diffY = hImg1-hImg2;

                    imgEl.geometricBounds = [geomBounds2[0]-diffY, geomBounds2[1]-diffX, geomBounds2[0]-diffY+hImg1, geomBounds2[1]-diffX+wImg1];
                    imgSec.geometricBounds = [geomBounds1[0], geomBounds1[1], geomBounds1[0]+hImg1, geomBounds1[1]+wImg2];

                    imgEl.fit(FitOptions.CONTENT_TO_FRAME);
                    imgEl.fit(FitOptions.PROPORTIONALLY);
                    imgSec.fit(FitOptions.CONTENT_TO_FRAME);
                    imgSec.fit(FitOptions.PROPORTIONALLY);

                    imgSec.sendToBack();


                }
            }


            let offsetX = 0;
            let offsetY = 0;
            for (let fs=0; fs<foto_extra.length; fs++)
            {
                let imgExtra = foto_extra[fs];
                let imgExtra_params = imgExtra.label.split('$');
                if (imgExtra_params.length>2)
                {

                    let nomeExtra = imgExtra_params[1];
                    let tipoStr = imgExtra_params[2].replace("tipo_","");

                    let isBollo = (tipoStr=="2");
                    let isLogo = (tipoStr=="3");

                    let wLogo = imgExtra.geometricBounds[3]-imgExtra.geometricBounds[1];
                    let hLogo = imgExtra.geometricBounds[2]-imgExtra.geometricBounds[0];
                    //In base al nome extra, impostare le dimensioni
                    //nomeExtra
                    if (nomeExtra.indexOf("Logo_BandieraItalia")>=0)
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=10.747;
                            hLogo=7.298;
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione=="115x75")
                            {
                                wLogo=12;
                                hLogo=10;
                            }
                            else
                            {
                                wLogo=45;
                                hLogo=32;
                            }
                        }
                    }
                    else if (nomeExtra.indexOf("Logo_PassoDopoPassoDespar")>=0)
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=15.164;
                            hLogo=10.298;
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione == "115x75") {
                                wLogo = 11;
                                hLogo = 11;
                            }
                            else {
                                wLogo = 69;
                                hLogo = 62;
                            }
                        }

                    }
                    else if (nomeExtra.indexOf("Grana_Padano_Logo_2015")>=0)
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=20.789;
                            hLogo=18.627;
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione == "115x75") {
                                wLogo = 11;
                                hLogo = 17;
                            }
                            else {
                                wLogo = 56;
                                hLogo = 191;
                            }
                        }

                    }
                    else if (nomeExtra.indexOf("Logo_scegli_despar")>=0)
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=15.051;
                            hLogo=13.485;
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione == "115x75") {
                                wLogo = 14;
                                hLogo = 18;
                            }
                            else {
                                wLogo = 56;
                                hLogo = 73;
                            }
                        }
                       
                    }
                    else if (
                        nomeExtra.indexOf("Logo_Selezione_Aperitivo_DESPAR")>=0 ||
                        nomeExtra.indexOf("Logo_Selezione_Birra_DESPAR")>=0 ||
                        nomeExtra.indexOf("Logo_Selezione_EnergyDrink_DESPAR")>=0 ||
                        nomeExtra.indexOf("Logo_Selezione_Vini_DESPAR")>=0
                    )
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=12.922;
                            hLogo=18.334;   
                        }
                        else if (tipo_lavorazione==2)
                        {                            
                            if (formato_lavorazione == "115x75") {
                                wLogo = 11;
                                hLogo = 15;
                            }
                            else {
                                wLogo = 50;
                                hLogo = 71;
                            }
                        }
                     
                    }
                    else if (nomeExtra.indexOf("Logo_Molly")>=0)
                    {
                        if (tipo_lavorazione==1)
                        {
                            wLogo=19.712;
                            hLogo=17.661;  
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione == "115x75") {
                                wLogo = 26;
                                hLogo = 14;
                            }
                            else {
                                wLogo = 96;
                                hLogo = 54;
                            }
                        }                       
                    }     
                    else if (nomeExtra.indexOf("Logo_Melinda") >= 0) {
                        if (tipo_lavorazione==1)
                        {
                            wLogo = 11.444;
                            hLogo = 7.772;
                        }
                        else if (tipo_lavorazione==2)
                        {
                            if (formato_lavorazione == "115x75") {
                                wLogo = 17;
                                hLogo = 10;
                            }
                            else {
                                wLogo = 75;
                                hLogo = 48;
                            }
                        }
                    }      
                    

                    if (formato_lavorazione == "A4") {
                        imgExtra.geometricBounds = [
                            imgExtra.geometricBounds[0] + offsetY,
                            imgExtra.geometricBounds[1],
                            imgExtra.geometricBounds[0] + offsetY + hLogo,
                            imgExtra.geometricBounds[1] + wLogo
                        ];
                    }
                    else {
                        imgExtra.geometricBounds = [
                            imgExtra.geometricBounds[0],
                            imgExtra.geometricBounds[1] + offsetX,
                            imgExtra.geometricBounds[0] + hLogo,
                            imgExtra.geometricBounds[1] + offsetX + wLogo
                        ];
                    }

                    offsetX += wLogo + 0.5;
                    offsetY += hLogo + 0.5;


                    // if (isBollo)
                    // {                                                
                    //     //Basso DX
                    //     imgExtra.geometricBounds=[
                    //         baseEl.geometricBounds[2]-wLogo,
                    //         baseEl.geometricBounds[3]-hLogo,
                    //         baseEl.geometricBounds[2],
                    //         baseEl.geometricBounds[3],
                    //     ];


                    // }
                    // else if (isLogo)
                    // {                        
                        //ALTO SX ma sotto la descr
                        if (descrEl!=null)
                        {
                            let lastLine = descrEl.lines.item(descrEl.lines.count()-1);
                            let baseCoord=lastLine.baseline;
                            let posDescrBottom = baseCoord+ (tipo_lavorazione==1?2:12);//descrEl.geometricBounds[2];
                            imgExtra.geometricBounds=[
                                posDescrBottom,
                                imgExtra.geometricBounds[1],
                                posDescrBottom+hLogo,
                                imgExtra.geometricBounds[3],
                            ];
                        }
                    // }

                    imgExtra.fit(FitOptions.CONTENT_TO_FRAME);
                    imgExtra.fit(FitOptions.PROPORTIONALLY);
                }
            }

            baseEl.sendToBack();

        }

     
        return;


        
    },
    // getRealBoundsOfFoto(img, offset)//Funione da spostare in Utility (ora è occupata)
    // {
    //     //img.graphics[0].clippingPath.clippingType = ClippingPathType.ALPHA_CHANNEL;
    //     let xmin=-1;
    //     let xmax=-1;
    //     let ymin=-1;
    //     let ymax=-1;

    //     var foto_vertex_list=CssFramework.getVertex(img, offset);
       
    //     for (var $vtx=0; $vtx<foto_vertex_list.length; $vtx++)
    //     {
    //         var foto_vertex=foto_vertex_list[$vtx];
    //         for (var $v=0; $v<foto_vertex.vertx.length; $v++)
    //         {

    //             var myx=foto_vertex.vertx[$v];
    //             var myy=foto_vertex.verty[$v];

    //             if (xmin==-1 || xmin>myx)
    //                 xmin=myx;
    //             if (xmax==-1 || xmax<myx)
    //                 xmax=myx;
    //             if (ymin==-1 || ymin>myy)
    //                 ymin=myy;
    //             if (ymax==-1 || ymax<myy)
    //                 ymax=myy;
    //         }
    //     } 

    //     return [ymin, xmin, ymax, xmax];
    // },
    getMaggioreOffsetOrizzontaleTraICampi(lista_campi) {
        var leader = 9999999;
        for (var $va in lista_campi) {
            try		
            {
                var score = 0;
                if (lista_campi[$va] != null) {
                    if (lista_campi[$va].label == "prezzo_offerta_gruppo") {
                        score = lista_campi[$va].textFrames.item(1).characters.item(0).horizontalOffset;
                    }
                    else {
                        score = lista_campi[$va].characters.item(0).horizontalOffset;
                    }
                    
                    //console.error(lista_campi[$va].label+"="+score);
    
                    if (leader > score && score > 0)
                        leader = score;
                }
            }
            catch(err){}
    
        }
    
        if (leader == 9999999)
            return 0;
    
        return leader - 1;
    
    },

    parseMeccanica_provvisorio(objRef, allEtichette, pathLavorazione, area, canale) {

        var materiale = this.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        var tema = this.cercaChiaveContesto("tema", this.contesto_promo);
        tema = tema == null ? "" : tema;

        if (tema.indexOf("LOC") >= 0) {
            //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
            this.contesto_promo = this.assegnaNuovoValoreContesto("materiale", "VOL", this.contesto_promo);
            materiale = "VOL";
        }

        var meccanica = objRef.combinazioneAssegnata;
        var temaRef = objRef.tema;
        var tipo_tema = objRef.tipo_tema;
        var note = objRef.note_category;
        var ruolo = objRef.ruolo;
        var grafica_50al50 = allEtichette.includes("SEZ. 50 AL 50");
        var reparto = objRef.reparto;
        var settore = objRef.settore;
        //var isMZLOC = (nome_origine_xml.indexOf("MZ_LOC") == 0);
        var isMZLOC = ((tema.indexOf("LOC") >= 0 && materiale == "MZ") || allEtichette.includes("MZLOC"));
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

        var M_mm={tipo:"binding", campo_indd:"M_MM", campo_dato:"M_MM_str", mappa_stile:"M_MM"};
        obj.azioni.push(M_mm);

        if (materiale == "INT") {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int3);
        }

        if(materiale == "RIL") {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int3);
        }

        if (meccanica.indexOf("PERCENTO_FID_ALL") >= 0 && temaRef == "m50prodsc50%" && canale == "SC") {
            var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color);
            var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color2);
        }

        var a_del = { tipo: "del", campi: new Array() };

        if (meccanica.indexOf("sottocosto") >= 0) {

            if (canale == "SC") {
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

            if (temaRef == "m50prodsc50%") {
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
                //console.error("gs 2");

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
                if (tema.indexOf("LOC") < 0) {
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
                if (tema.indexOf("LOC") < 0) {

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
                if (tema.indexOf("LOC") < 0) {
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

            if (tema.indexOf("LOC") < 0) {
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
            if(materiale != "INT" && materiale != "RIL" && meccanica.indexOf("_evento") < 0 && materiale != "EV")
                a_del.campi.push("prezzo_offerta_EURprima");
            else
                a_del.campi.push("prezzo_offerta_gruppo");
        }
        else if (meccanica.indexOf("TP_FID") >= 0) {
            if (meccanica.indexOf("_123") >= 0) {
                a_del = { tipo: "del", campi: [] };
            }

            if (tema.indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }

            if (tema.indexOf("LOC") < 0 && canale != "SC") {
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
            //console.error("gs 8");

            if (materiale != "INT" && meccanica.indexOf("_evento") < 0 && materiale != "EV") {
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

                if (materiale == "EV") {
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


            if (tema.indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }

            a_del.campi.push("sconto_fid");
            a_del.campi.push("scritta_xx");
            a_del.campi.push("PezzConf_NM");
            a_del.campi.push("LBL_Carte");
        }
        else if (meccanica.indexOf("FID_ALL") >= 0) {
            a_del = { tipo: "del", campi: ["PezzConf_NM", "00", "scritta_xx", "anzichè", "sconto_norm"] };

            if (tema.indexOf("LOC") >= 0) {
                a_del.campi.push("campo_offerta_KgL");
            }
        }
        else if (meccanica.indexOf("NM_MM") >= 0 || meccanica.indexOf("NM_MIX") >= 0 || meccanica.indexOf("NM_FID") >= 0) {
            if (meccanica.indexOf("FID") > 0) {
                //codice="BOX0";
                //la label M_MM veicola verso M_fid
                var a_ch2 = { tipo: "binding", campo_indd: "M_MM", campo_dato: "M_FID_str", mappa_stile: "M_fid" };
                obj.azioni.push(a_ch2);
            }
            else if (meccanica.indexOf("_123") > 0) {
                a_del.campi.push("sconto_effettivo_grande");
                a_del.campi.push("campo_offerta");
                a_del.campi.push("prezzo_offerta_EURprima");
                a_del.campi.push("gruppo_sconto");
                //console.error("gs 9");
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

            if (tema.indexOf("LOC") >= 0) {
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

            if (meccanica.indexOf("_evento") >= 0 || materiale == "EV") {
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

            if (meccanica.indexOf("_boxetto") >= 0 && meccanica.indexOf("_evento") < 0 && materiale != "EV") {

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


                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbia Buono del paese" };
                        obj.azioni.push(a_color);

                        var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                        obj.azioni.push(a_color4);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 5 };
                        obj.azioni.push(a_border);
                    }

                }
                else if (meccanica.indexOf("_sdb") >= 0) {
                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbie SCELTE di BENESSERE" };
                        obj.azioni.push(a_color);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 5 };
                        obj.azioni.push(a_border);
                    }
                }

                if (meccanica.indexOf("PERCENTO") < 0 && materiale != "INT" && materiale != "RIL")//Da ritestare
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
            if (a_del.campi == null){
                a_del.campi = new Array();
                obj.azioni = new Array();
            }

            //console.error("metto box6_2");
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
                        //console.error("dai su!");

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
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Scelte di benessere_box.psd" };
                    obj.azioni.push(a_file);
                }
                else if (meccanica.indexOf("_bdp") >= 0)
                {
                    var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Buono del Paese_box.psd" };
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


            if (materiale == "INT") {
                var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int2);

                var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int3);
            }

            if (materiale == "RIL") {
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
                //console.error("binding stringa etto");
            }

            if ((meccanica.indexOf("_evento") >= 0 || materiale == "EV") &&
                (meccanica.indexOf("TP_MM") >= 0 || meccanica.indexOf("PERCENTO_MM") >= 0 || meccanica.indexOf("sir_sconto") >= 0)) {
                var a_ch2 = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_etto_EURprima", mappa_stile: "prezzo_offerta_etto_EURprima" };
                obj.azioni.push(a_ch2);

                var a_ch3 = { tipo: "binding", campo_indd: "campo_offerta", campo_dato: "campo_offerta_etto", mappa_stile: "campo_offerta_etto" };
                obj.azioni.push(a_ch3);
            }

            if (meccanica.indexOf("PERCENTO") >= 0  /*|| meccanica.indexOf("sir_sconto")>=0*/) {
                if (canale != "SC")
                    a_del.campi.push("prezzo_offerta_etto");

                a_del.campi.push("sconto_effettivo_grande");
                if (materiale.includes("MZ") && meccanica.indexOf("_evento") < 0 && canale != "SC") {
                    a_del.campi.push("sy_euro");
                }
            }
            else {
                a_del.campi.push("gruppo_sconto");

                if ((materiale != "INT" && materiale != "RIL") && meccanica.indexOf("PERCENTO") < 0)//Da ritestare
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

                if ((materiale != "INT" && materiale != "RIL") && meccanica.indexOf("_evento") < 0 && materiale != "EV") {
                    a_del.campi.push("prezzo_offerta_EURprima");
                }
                else if (meccanica.indexOf("_evento") >= 0 || materiale == "EV") {
                    a_del.campi.push("sconto_effettivo");
                }

                a_del.campi.push("gruppo_sconto");

            }
            else if (meccanica.indexOf("PERCENTO") >= 0 && meccanica.indexOf("_minicoll") < 0 && meccanica.indexOf("_bonus") < 0 && meccanica.indexOf("_evento") < 0) {

                if ((tema.indexOf("LOC") < 0 && canale != "SC") || isMZLOC) {
                    a_del.campi.push("prezzo_offerta_gruppo");
                }

                a_del.campi.push("sconto_effettivo_grande");

                if (meccanica.indexOf("_evento") >= 0 || materiale == "EV") {
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
                

                if (meccanica.indexOf("_boxetto") > 0 && meccanica.indexOf("_evento") < 0 && materiale != "EV") {
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

        if (meccanica.indexOf("_mercato") > 0 && objRef.codiceBox != "BOX7") {

            if (meccanica.indexOf("PERCENTO") < 0 && meccanica.indexOf("sir_sconto") < 0) {
                var a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 6] };
                var a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 6] };

                if (meccanica.indexOf("_KgL") >= 0) {
                    a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 3] };
                    a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 3] };
                }

            }
            else if (meccanica == "PERCENTO_MM_mercato_boxetto" && canale == "SC") {
                a_del.campi.push("prezzo_offerta_gruppo");
                a_del.campi.push("sy_etto");
                a_del.campi.push("rect_etto");
            }

        }

        if ((objRef.codiceBox == "BOX6" && meccanica.indexOf("PERCENTO") < 0) || tema.indexOf("LOC") >= 0) {
            a_del.campi.push("linee");
        }

        if (meccanica.indexOf("_evento") > 0 || (materiale == "EV" && meccanica != "validita")) {

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
                }
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

            if(meccanica.indexOf("PERCENTO_MM_ALL") >= 0 || meccanica.indexOf("PERCENTO_FID_ALL") >= 0){
                if(objRef.numero_reparto == 9 && objRef.prezzo_offerta == ""){
                    a_del.campi.push("prezzo_offerta_gruppo");
                    a_del.campi.push("campo_offerta");
                }
            }
        }

        if ((materiale == "INT" || materiale == "RIL") && (meccanica.indexOf("_ofalkg") >= 0)) {
            var a_ch = { tipo: "binding", campo_indd: "prezzo_offerta_EURprima", campo_dato: "prezzo_offerta_KgL_EURprima", mappa_stile: "prezzo_offerta_KgL_EURprima" };
            obj.azioni.push(a_ch);
        }

        if ((tema.includes("LOC Mensile") || tema.includes("LOC 1a DATA") || tema.includes("LOC 2a DATA")) && meccanica != "validita") {
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

            if (tema.includes("LOC Mensile")) {
                a_del.campi.push("Triangolo_VAL");
            }
        }

        if ((materiale.includes("BASSI&FISSI") && meccanica != "validita") || allEtichette.includes("IS BASSI E FISSI")) {
            
            if (!materiale.includes("ISTITUZIONALE")){

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

        if (objRef.codiceBox == "BOX41" && (objRef.tipo_tema.toLowerCase() == "focus" || objRef.tipo_tema.toLowerCase() == "attivita di reparto")) {
            obj.azioni.push({ tipo: "unplace", campo_indd: "base"});
            obj.azioni.push({ tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 });
            a_del.campi.push("parentesi_BeF");
            a_del.campi.push("sy_ombra");
        }

        if(objRef.codiceBox != "BOX41" && (objRef.tipo_tema.toLowerCase() == "focus" || objRef.tipo_tema.toLowerCase() == "attivita di reparto")){
            a_del.campi.push("fondo_distintivita");
        }
 

        if ((materiale == "INT" || materiale == "RIL") && meccanica.indexOf("TP_MM") >= 0 && objRef.codiceBox != "BOX41") {
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
                //console.error("bagliore_base_SDB");
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_SDB" };
                obj.azioni.push(a_eff);
            }
            else if (meccanica.indexOf("_bdp") >= 0) {
                //console.error("bagliore_base_BDP");
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_BDP" };
                obj.azioni.push(a_eff);
            }
        }




        if (this.isMeccanicaIncompleta(meccanica)) {
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
    
    parseMeccanica_provvisorioCompiled(objRef, allEtichette,canale) {

        var materiale = this.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        var tema = this.cercaChiaveContesto("tema", this.contesto_promo);
        tema = tema == null ? "" : tema;

        if (tema.indexOf("LOC") >= 0) {
            //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
            this.contesto_promo = this.assegnaNuovoValoreContesto("materiale", "VOL", this.contesto_promo);
            materiale = "VOL";
        }

        var meccanica = objRef.combinazioneAssegnata;
        var temaRef = objRef.tema;
        var tipo_tema = objRef.tipo_tema;
        var grafica_50al50 = allEtichette.includes("SEZ. 50 AL 50");
        var reparto = objRef.reparto;
        var settore = objRef.settore;
        var isMZLOC = ((tema.indexOf("LOC") >= 0 && materiale == "MZ") || allEtichette.includes("MZLOC"));
        var obj = new Object();
        obj.azioni = new Array();
        obj.isInvalida = false;

        if (materiale == "INT") {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
            obj.azioni.push(int3);
        }

        if(materiale == "RIL") {
            var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int2);

            var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-13.294, -3.112, 0, 0] };
            obj.azioni.push(int3);
        }

        if (meccanica.indexOf("PERCENTO_FID_ALL") >= 0 && temaRef == "m50prodsc50%" && canale == "SC") {
            var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color);
            var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie VERDE" };
            obj.azioni.push(a_color2);
        }

        if (meccanica.indexOf("sottocosto") >= 0) {

            if (canale == "SC") {
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("50al50") >= 0) {
            if (temaRef == "m50prodsc50%") {
                var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie VERDE" };
                obj.azioni.push(a_color);
                var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie VERDE" };
                obj.azioni.push(a_color2);
            }
        }
        else if (meccanica.indexOf("_minicoll") > 0) {
            if (meccanica.indexOf("PUNTI_TP") < 0 && meccanica.indexOf("PERCENTO") < 0) {
                var a_p = { tipo: "pos", campo_indd: "descrizione", align: Justification.LEFT_ALIGN, absoluteX: 0 };
                obj.azioni.push(a_p);
            }
        }
        else if (meccanica.indexOf("_bonus") > 0) {
            if (meccanica.indexOf("MULTI_PERCENTO") > 0) {
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("MULTI_TP") > 0) {
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("PERCENTO") > 0) {
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else if (meccanica.indexOf("TP") > 0) {
                var a_r = { tipo: "resize", campo_indd: "Range_Punti_1_cornice", size: [0, 8.87] };
                obj.azioni.push(a_r);
            }
            else {
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
            if (canale == "SC") {
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("OA_") == 0) {
            if (canale == "SC") {
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }
        }
        else if (meccanica.indexOf("TP_MM") >= 0) {
            if (meccanica.indexOf("_123") >= 0) {
                var a_color = { tipo: "color", campo_indd: "prezzo_offerta", colore: "Nero_Prezzi" };
                obj.azioni.push(a_color);
            }

            if (meccanica.indexOf("_KgL") > 0) {
                if (tema.indexOf("LOC") < 0) {
                    if (objRef.codiceBox == "BOX9" || objRef.codiceBox == "BOX2") {
                        var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.537, 0, 0] };
                        obj.azioni.push(int3);
                    }
                    else {
                        var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.791, 0, 0] };
                        obj.azioni.push(int3);
                    }
                }

            }

            var suff = "_KgL";
            if (meccanica.indexOf("_regionale") > 0) {
                suff = "_KgL_sconto";
            }

            if (meccanica.indexOf("_ofaconf") >= 0) {
                var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                obj.azioni.push(a_r);
            }
        }
        else if (meccanica.indexOf("sir_sconto") >= 0) {

            var a_color2 = { tipo: "color", campo_indd: "prezzo_offerta", colore: "Rosso prezzi" };
            obj.azioni.push(a_color2);

            if (tema.indexOf("LOC") < 0) {
                var a_color3 = { tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" };
                obj.azioni.push(a_color3);
            }
        }
        else if (meccanica.indexOf("TP_FID") >= 0) {

            if (tema.indexOf("LOC") < 0 && canale != "SC") {
                if (meccanica.indexOf("_evento") < 0 && meccanica.indexOf("_evento") < 0/*&& meccanica.indexOf("_inostriori")<0*/) {
                    var a_color3 = { tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" };
                    obj.azioni.push(a_color3);
                }
            }
            else if (canale == "SC" && isMZLOC) {
                obj.azioni.push({ tipo: "color", campo_indd: "sy_euro", colore: "Rosso prezzi" });
            }

            if (meccanica.indexOf("_ofaconf") >= 0) {
                var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                obj.azioni.push(a_r);
            }



        }
        else if (meccanica.indexOf("NM_MM") >= 0 || meccanica.indexOf("NM_MIX") >= 0 || meccanica.indexOf("NM_FID") >= 0) {
            if (meccanica.indexOf("_123") > 0) {
                if (meccanica.indexOf("_KgL") > 0) {
                    if (objRef.codiceBox == "BOX9" || objRef.codiceBox == "BOX2") {
                        var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.537, 0, 0] };
                        obj.azioni.push(int3);
                    }
                    else {
                        var int3 = { tipo: "rect", campo_indd: "campo_offerta_KgL_sconto", offset: [0, -0.791, 0, 0] };
                        obj.azioni.push(int3);
                    }
                }
            }
        }
        else if (meccanica.indexOf("VEDERE_NOTE") >= 0) {
            if (canale == "SC") {
                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
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

            if (meccanica.indexOf("_boxetto") >= 0 && meccanica.indexOf("_evento") < 0 && materiale != "EV") {

                if (canale == "SC") {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                    obj.azioni.push(a_border);
                }

                if (meccanica.indexOf("_bdp") >= 0) {


                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbia Buono del paese" };
                        obj.azioni.push(a_color);

                        var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
                        obj.azioni.push(a_color4);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 5 };
                        obj.azioni.push(a_border);
                    }

                }
                else if (meccanica.indexOf("_sdb") >= 0) {
                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbie SCELTE di BENESSERE" };
                        obj.azioni.push(a_color);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 5 };
                        obj.azioni.push(a_border);
                    }
                }

            }
        }
        else if (meccanica.indexOf("_boxetto") >= 0) {

            if (isMZLOC) {
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

            if (canale == "SC") {
                // if (meccanica.indexOf("_sdb") >= 0) {
                //     var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Scelte di benessere_box.psd" };
                //     obj.azioni.push(a_file);
                // }
                // else if (meccanica.indexOf("_bdp") >= 0)
                // {
                //     var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Buono del Paese_box.psd" };
                //     obj.azioni.push(a_file);
                // }

                var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                obj.azioni.push(a_border);
            }

            if (materiale == "INT") {
                var int2 = { tipo: "rect", campo_indd: "prezzo_offerta_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int2);

                var int3 = { tipo: "rect", campo_indd: "prezzo_offerta_etto_EURprima", offset: [-28, -9.512, 0, 0] };
                obj.azioni.push(int3);
            }
            
        }
        else if (meccanica.indexOf("_inostriori") >= 0 || meccanica.indexOf("_territorio") >= 0) {

            if (isMZLOC) {
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
        }
        else if (isMZLOC) {
            //Siamo in caso meccanica Territorio NON _inostriori
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

        if (meccanica.indexOf("NM_MM") < 0 && meccanica.indexOf("NM_MIX") < 0 && meccanica.indexOf("50al50") < 0) {
            if (meccanica.indexOf("PERCENTO") >= 0 && meccanica.indexOf("_minicoll") < 0 && meccanica.indexOf("_bonus") < 0 && meccanica.indexOf("_evento") < 0) {
                if (meccanica.indexOf("_ofaconf") >= 0) {
                    var a_r = { tipo: "resize", campo_indd: "campo_offerta_KgL_sconto", size: [0, 4.5] };
                    obj.azioni.push(a_r);
                }
            }
        }


        if (meccanica.indexOf("_sdb") >= 0) {

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

                }
            }
            else {
                // if (meccanica.indexOf("_sdb") >= 0) {
                //     var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Scelte di benessere_box.psd" };
                //     obj.azioni.push(a_file);
                // }
                // else if (meccanica.indexOf("_bdp") >= 0) {
                //     var a_file = { tipo: "file", campo_indd: "fondo_distintivita", filename: "ATTR_PROS_fondo_Buono del Paese_box.psd" };
                //     obj.azioni.push(a_file);
                // }

                if (canale != "SC") {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 2 };
                    obj.azioni.push(a_border);
                }

            }

        }

        if (meccanica.indexOf("_mercato") > 0 && objRef.codiceBox != "BOX7") {

            if (meccanica.indexOf("PERCENTO") < 0 && meccanica.indexOf("sir_sconto") < 0) {
                var a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 6] };
                var a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 6] };

                if (meccanica.indexOf("_KgL") >= 0) {
                    a_p = { tipo: "pos", campo_indd: "prezzo_offerta", offset: [0, 3] };
                    a_p_euro = { tipo: "pos", campo_indd: "sy_euro", offset: [0, 3] };
                }

            }
        }

        if ((materiale.includes("BASSI&FISSI") && meccanica != "validita") || allEtichette.includes("IS BASSI E FISSI")) {
            
            if (!materiale.includes("ISTITUZIONALE")){

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

                if (meccanica.indexOf("_boxetto") >= 0) {
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
            if (canale == "SC" && objRef.codiceBox != "BOX41") {
                if (meccanica.indexOf("sdb") < 0 && meccanica.indexOf("bdp") < 0) {
                    var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
                    obj.azioni.push(a_border);
                }
            }
        }

        if (objRef.codiceBox == "BOX41" && (objRef.tipo_tema.toLowerCase() == "focus" || objRef.tipo_tema.toLowerCase() == "attivita di reparto")) {
            obj.azioni.push({ tipo: "unplace", campo_indd: "base"});
            obj.azioni.push({ tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 });
        } 
        if (grafica_50al50  && meccanica.indexOf("PERCENTO_FID_ALL_KgL") >= 0) {
            var a_color = { tipo: "color", campo_indd: "linee", colore: "righine-gabbie 50al50FID" };
            obj.azioni.push(a_color);
            var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie 50al50FID" };
            obj.azioni.push(a_color2);
        }

        var bdp_sdb_distintivita = (tipo_tema.indexOf("_focus") < 0 && (meccanica.indexOf("_sdb") >= 0 || meccanica.indexOf("_bdp") >= 0));

        if (objRef.codiceBox != "BOX41" && canale != "SC" && meccanica.indexOf("_minicoll") < 0 && meccanica.indexOf("_bonus") < 0 && !bdp_sdb_distintivita) {
            var a_border = { tipo: "border", campo_indd: "base", radius: 0, borderWidth: 0 };
            obj.azioni.push(a_border);
        }

        if (canale != "SC" && meccanica.indexOf("_bonus") < 0 && meccanica.indexOf("_minicoll") < 0 && !bdp_sdb_distintivita) {
            if (objRef.codiceBox != "BOX41") {
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base" };
                obj.azioni.push(a_eff);
            }
        }
        else if (canale != "SC" && meccanica.indexOf("_bonus") < 0 && bdp_sdb_distintivita) {
            if (meccanica.indexOf("_sdb") >= 0) {
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_SDB" };
                obj.azioni.push(a_eff);
            }
            else if (meccanica.indexOf("_bdp") >= 0) {
                var a_eff = { tipo: "effect", campo_indd: "base", name: "bagliore_base_BDP" };
                obj.azioni.push(a_eff);
            }
        }




        if (this.isMeccanicaIncompleta(meccanica)) {
            obj.isInvalida = true;
        }
        
        return obj;

    },

    applyObjectStyle(doc, ctrl, style) {
        try
        {
            //ctrl.appliedObjectStyle = doc.objectStyles.itemByName(style);
            for (var o=0; o<doc.allObjectStyles.length; o++)
            {
                //console.error("> " + doc.allObjectStyles[o].name);
                if (doc.allObjectStyles[o].name==style)
                {
                    //console.error("Applico davvero " + style);
                    ctrl.appliedObjectStyle = doc.allObjectStyles[o];
                    return;
                }
            }
    
        }catch(error)
        {
            console.error("Stile di oggetto non trovato " + style);
            ctrl.appliedObjectStyle = doc.objectStyles.itemByName(style);
        }
    },

    cercaChiaveValore(key, value, array){
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] != undefined && array[i][key] == value) {
                return true;
            }
        }
        return false;
    },

    cercaChiaveContesto(key, array){
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i].nome_field != undefined && array[i].nome_field == key) {
                return array[i].user_value;
            }
        }
        return null;
    },   
    
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
    },   

    cercaChiaveKit(key, array){
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i].chiaveCompilata != undefined && array[i].chiaveCompilata == key) {
                return array[i].valore;
            }
        }
        return null;
    },   
    
    assegnaNuovoValoreKit(key, value, array){
        var itemToAdd = {
            nome_field: key,
            user_value: value
        };
        
        for (var i = 0; i < array.length; i++) {

            if (array[i].chiave != undefined && array[i].chiave == key) {
                array[i].valore = value;
                return array;
            }
        }
        array.push(itemToAdd);
        return array;
    }, 

    getMasterSpreadByName(label, doc) {
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

    setupFiltroMeccanicheInvalide(doc) {
        var _d = doc;
        if (doc == null)
            _d = myDocument;

        var invalidM = getMasterItemByLabel("mecc_non_valide", _d);
        if (invalidM != null) {
            this.filtro_mecc_invalide = invalidM.textFrames[0].contents;
        }
    },

    isMeccanicaIncompleta(nome) {
        return (this.filtro_mecc_invalide.indexOf("," + nome + ",") >= 0);
    },

    getSuffisso(itemRef){
        //solo pop
        var materiale = this.cercaChiaveContesto("materiale", itemRef["Context.Promo"]);
        if (materiale != null) {
            return materiale + "_" + (this.canale == "SC" ? "A" : "P");
        }
        else {
            return "PROMO"+ "_" + (this.canale == "SC" ? "A" : "P");
        }       
    },


    inserisciNota(campo, titolo, nota) {
        return;
        var now = new Date();
        var dd = now.getDate();
        var MM = now.getMonth();
        var yyyy = now.getFullYear();
        var hh = now.getHours();
        var mm = now.getMinutes();

        dd = (dd < 10 ? "0" + dd : dd);
        MM = (MM < 10 ? "0" + MM : MM);
        hh = (hh < 10 ? "0" + hh : hh);
        mm = (mm < 10 ? "0" + mm : mm);
        var str_date = dd + "/" + MM + "/" + yyyy + " " + hh + ":" + mm;

        if (campo.notes.length > 0) {
            var esistente = campo.notes.item(0).texts.item(0).contents;
            if (esistente.indexOf("\n") > 0)
                esistente = esistente.substring(esistente.indexOf("\n") + 1);
            if (esistente.indexOf("\r") > 0)
                esistente = esistente.substring(esistente.indexOf("\r") + 1);

            if (esistente != nota) {
                //Cambio
                campo.notes.item(0).texts.item(0).contents = str_date + "\n" + nota;
            }
        }
    },

    globalGroupToRemove : null,

    getRealBoundsOfText(item) {
        var xmin = -1;
        var xmax = -1;
        var ymin = -1;
        var ymax = -1;
        var righe = new Array();

        try {
            //throw new Error("Qui è da aggiustare, ha fatto crashare indd");
            if (item.label.startsWith("descrizione") || item.label.startsWith("X_descrizione")) {
                //alert("::: creo path di " + item.label + " lines " + item.lines.length);

                //alert("MI VEDI?");
                righe = [];
                let gPoly=new Array();

                for (var $l = 0; $l < item.lines.length; $l++) {
                    var line = item.lines.item($l);
                    var poly = null;

                    try {

                        poly = line.createOutlines(false);
                    } catch (errPath) {
                        //alert("Path error on: " + line.contents);
                        continue;
                    }

                    //log("::: poly " + poly.length);
                    //alert($l + " -> " + line.contents + "\nPOLY: " + poly + " -> " + poly );
                    var isGroup = false;
                    var paths = [];
                    if (poly[0].constructor.name == "Group") {
                        //alert("Poligoni in gruppi di " + poly.polygons);
                        //alert("Poligoni in gruppi di " + poly[0].polygons.length);
                        for (var g = 0; g < poly[0].polygons.length; g++) {
                            //alert( "push " + poly[0].polygons[g]);
                            paths.push(poly[0].polygons[g]);
                        }
                        isGroup = true;
                    }
                    else {
                        paths = [poly[0]];
                    }

                    //alert($l + " -> " + line.contents + "\nPOLY: " + paths);


                    var newLine = true;

                    var xminLine = -1;
                    var xmaxLine = -1;
                    var yminLine = -1;
                    var ymaxLine = -1;


                    //log("::: paths " + paths.length);

                    for (var $p0 = 0; $p0 < paths.length; $p0++) {
                        var polygon = null;
                        if (isGroup)
                            polygon = paths.item($p0);
                        else
                            polygon = paths[$p0];
                        //alert($l + " -> " + line.contents + "\nCaratteri trovati: " + polygon.paths.length);

                        for (var $p = 0; $p < polygon.paths.length; $p++)//Sappiamo che creerà solo un path perchè sono tutte single lines a parte descrizione
                        {
                            var pitem = polygon.paths.item($p);
                            //alert(pitem.entirePath);
                            for (var $p2 = 0; $p2 < pitem.entirePath.length; $p2++) {
                                var myx = 0;
                                var myy = 0;

                                var vert = pitem.entirePath[$p2];
                                if (vert.constructor.name == "Array") {
                                    myx = vert[0][0];
                                    myy = vert[0][1];
                                    if (myx == null && myy == null) {
                                        myx = vert[0];
                                        myy = vert[1];
                                    }
                                }
                                else {
                                    myx = vert[0];
                                    myy = vert[1];

                                }

                                /*if ($l==2)
                                {
                                    alert([myx,myy]);
                                }*/

                                try {
                                    if (myx.toString() != "" && myy.toString() != "") {
                                        if (newLine) {
                                            righe.push([{ y: myy, x: myx }]);
                                            newLine = false;
                                        }
                                        else {
                                            righe[righe.length - 1].push({ y: myy, x: myx });
                                        }



                                        if (xmin == -1 || xmin > myx)
                                            xmin = myx;
                                        if (xmax == -1 || xmax < myx)
                                            xmax = myx;
                                        if (ymin == -1 || ymin > myy)
                                            ymin = myy;
                                        if (ymax == -1 || ymax < myy)
                                            ymax = myy;


                                        if (xminLine == -1 || xminLine > myx)
                                            xminLine = myx;
                                        if (xmaxLine == -1 || xmaxLine < myx)
                                            xmaxLine = myx;
                                        if (yminLine == -1 || yminLine > myy)
                                            yminLine = myy;
                                        if (ymaxLine == -1 || ymaxLine < myy)
                                            ymaxLine = myy;

                                    }
                                } catch (error2) { }
                            }
                        }

                        //polygon.remove();
                    }

                    righe[righe.length - 1].push([yminLine, xminLine, ymaxLine, xmaxLine]);

                    var rItem = righe[righe.length - 1];
                    //alert(rItem[rItem.length-1]);

                    var listToRemove = [];
                    for (var $p0 = paths.length - 1; $p0 >= 0; $p0--) {
                        var polygon = paths[$p0];
                        listToRemove.push(polygon);
                    }


                    //c'è stato un bug strano che sfortunatamente non è stato possibile risolvere
                    //nel ciclo a seguire si svolge la rimozione di tutti i poligoni creati
                    //ma per qualche motivo tale operazione provocava il crash di indd (nonostante il try catch)
                    //al momento della rimozione.
                    //Tra le prove fatte si è visto che rimuovendo i poligoni da console con lo stesso identico comando (.remove())
                    //non si verificava alcun crash.
                    //abbiamo effettuato dunque moooooolte prove di cui l'ultime lasciate a commento sotto.
                    //Però mentre si provava ad un certo punto il crash è smesso e non si è più ripresentato, nemmeno riabilitando lo stesso 
                    //codice che prima crashava.

                    //scorriamo la lista al contrario
                    for (var $p0 = listToRemove.length - 1; $p0 >= 0; $p0--) {
                        if (listToRemove[$p0].isValid)
                        {
                            //gPoly.push(listToRemove[$p0]);
                            addToGarbageCollector(listToRemove[$p0]);
                            //listToRemove[$p0].remove();
                            //onsole.log("ciao");
                        }
                    }


                }


                // let _globalGroupToRemove = item.parentPage.groups.add(gPoly);
                // let me=this;

                // if (_globalGroupToRemove != null) {
                //     _globalGroupToRemove.remove();
                //     _globalGroupToRemove = null;
                // }

                //funziona
                    // console.log("setTimeout _ " + me.globalGroupToRemove);
                    // me.removeGlobalFunction();

            }
            else {
                var poly = item.createOutlines(false);

                righe.push(new Array());
                //alert(item.label + " - " + poly[0].paths.length);
                var paths = null;
                var isGroup = false;
                if (poly[0].constructor.name == "Group")//item.label.indexOf("descrizione")==0)
                {
                    paths = poly[0].polygons;//[0].paths;
                    isGroup = true;
                    /*for (var $dp=1; $dp<poly[0].pageItems.length; $dp++)
                    {
                        paths = paths.concat(poly[0].pageItems[$dp].paths);
                    }*/
                    //alert("n paths descrizione " + poly.length);
                } else{
                    paths = [poly[0]];//[0].paths;
                }

                for (var $p0 = 0; $p0 < paths.length; $p0++) {
                    var polygon = null;
                    if (isGroup)
                        polygon = paths.item($p0);
                    else
                        polygon = paths[$p0];
                    for (var $p = 0; $p < polygon.paths.length; $p++)//Sappiamo che creerà solo un path perchè sono tutte single lines a parte descrizione
                    {
                        var pitem = polygon.paths.item($p);
                        //alert(pitem.entirePath);
                        for (var $p2 = 0; $p2 < pitem.entirePath.length; $p2++) {
                            var myx = 0;
                            var myy = 0;

                            var vert = pitem.entirePath[$p2];
                            if (vert.constructor.name == "Array") {
                                myx = vert[0][0];
                                myy = vert[0][1];
                                //righe[0].push({ y:vert[0][1], x:vert[0][0]});
                            }
                            else {
                                myx = vert[0];
                                myy = vert[1];

                            }

                            try {
                                if (myx.toString() != "" && myy.toString() != "") {
                                    righe[0].push({ y: myy, x: myx });
                                    //if (item.label.indexOf("descrizione")==0)
                                    //alert([myx,myy]);

                                    if (xmin == -1 || xmin > myx)
                                        xmin = myx;
                                    if (xmax == -1 || xmax < myx)
                                        xmax = myx;
                                    if (ymin == -1 || ymin > myy)
                                        ymin = myy;
                                    if (ymax == -1 || ymax < myy)
                                        ymax = myy;
                                }
                            } catch (error2) { }
                        }
                    }

                    //polygon.remove();
                }

                if (item.label == "sy_-") {
                    ymin -= 10;
                    ymax += 10;
                }

                // for (var $p0 = paths.length - 1; $p0 >= 0; $p0--) {
                //     var polygon = paths[$p0];
                //     polygon.remove();
                // }

                var listToRemove = [];
                var gPoly = new Array();

                for (var $p0 = paths.length - 1; $p0 >= 0; $p0--) {
                    if(paths.length>1)
                    {
                        console.log("ciao");
                    }
                    if(isGroup){
                        var polygon = paths.item($p0);
                        addToGarbageCollector(polygon);
                        //listToRemove.push(polygon);
                        //gPoly.push(polygon);
                    }
                    else{
                        var polygon = paths[$p0];
                        addToGarbageCollector(polygon);
                        //listToRemove.push(polygon);
                        //gPoly.push(polygon);
                    }
                }


                //c'è stato un bug strano che sfortunatamente non è stato possibile risolvere
                //nel ciclo a seguire si svolge la rimozione di tutti i poligoni creati
                //ma per qualche motivo tale operazione provocava il crash di indd (nonostante il try catch)
                //al momento della rimozione.
                //Tra le prove fatte si è visto che rimuovendo i poligoni da console con lo stesso identico comando (.remove())
                //non si verificava alcun crash.
                //abbiamo effettuato dunque moooooolte prove di cui l'ultime lasciate a commento sotto.
                //Però mentre si provava ad un certo punto il crash è smesso e non si è più ripresentato, nemmeno riabilitando lo stesso 
                //codice che prima crashava.
            }
            //scorriamo la lista al contrario
            // var valid = true;
            // for (var $p0 = gPoly.length - 1; $p0 >= 0; $p0--) {
            //     if (!gPoly[$p0].isValid) {
            //         valid = false;
            //         break;
            //     }
            // }
            // if(valid)
            // {
            //     if(gPoly.length>1)
            //     {
            //         if(isGroup){
            //             this.globalGroupToRemove = paths[0];
            //         }
            //         else{
            //             this.globalGroupToRemove = item.parentPage.groups.add(gPoly);
            //         }
            //     }
            //     else{
            //         this.globalGroupToRemove = gPoly[0];
            //     }
            // }

            // console.log("ciao");
            // setTimeout(() => {
            //     this.removeGlobalFunction();
            // }, 1000);
        } catch (err) {
            //alert(item.label + " isn't a text: " + err);
            console.error("botBoundaries - " + item.label + " isn't a text: ")
            console.error(err);
        }
        return [ymin, xmin, ymax, xmax, righe];
    },

    removeGlobalFunction(){
        if (this.globalGroupToRemove != null)
        {
            this.globalGroupToRemove.remove();
            this.globalGroupToRemove = null;
        }
    },


    //#region POP

    contatore_ordine: 0,
    curr_cat: "",
    

    getRefInBox_provvisorioPOP(obj, g_new, pathLavorazione, context = []) {

        try{

            var doc = app.activeDocument;
            let materiale = this.cercaChiaveContesto("materiale", this.contesto_promo);
            var sigla_main = this.cercaChiaveContesto("siglaMain", this.contesto_promo);
            sigla_main = sigla_main == null ? "" : sigla_main;
            var sottosigla = this.cercaChiaveContesto("sottoSigla", this.contesto_promo);
            sottosigla = sottosigla == null ? "" : sottosigla;
            var formato_file = this.codiceFormato;
    
            if (this.cercaChiaveContesto("sottoSottoSigla", this.contesto_promo) != null)
                sottosigla = this.cercaChiaveContesto("sottoSottoSigla", this.contesto_promo);//Prendo il nome specificato come regionale es. PROMO$REGIONALE$SARDEGNA
    
            var myPage =g_new.parentPage;
            var listNomeBaffi = [];
            //da trasferire
            // myPage.select();
    
    
    
    
            // if (str_validita != "") {
            //     try {
            //         for (var i = 0; i < myPage.appliedMaster.textFrames.length; i++) {
            //             if (myPage.appliedMaster.textFrames[i].label == "data_validita")
            //                 myPage.appliedMaster.textFrames[i].contents = str_validita;
            //         }
            //     } catch (errore_mastro) { }
            // }
    
    
            var selezione_conad = obj.selezione_conad;
            var tipo_logo = obj.tipo_logo;
            var prodotto_conad = obj.prodotto_conad;
            var logo_focus = obj.logo_focus;
            var logo_ori = obj.logo_ori;
            var logo_intv = obj.logo_intv;
            var logo_carne = obj.logo_carne;
            var logo_pesce = obj.logo_pesce;
            var logo_bandiera_it = obj.logo_bandiera_it;
            var codiceGruppo = obj["Scatto.CodiceSottogruppo"] != null ? obj["Scatto.CodiceSottogruppo"].toString() : obj["Scatto.CodiceGruppo"].toString();
            var currentSuffixSiglaStili = this.getSuffisso(obj);
            var loghi_x=0;
            var loghi_y=0;

            if(obj.territorialita == null){
                obj.territorialita = obj.distintivita;
            }
    
            if (formato_file == "stopper" || formato_file == "95x45") {
                loghi_x = 10;
                loghi_y = 48;//50//43;
            }
            else if (formato_file == "A4") {
                loghi_x = 10;
                loghi_y = 175;//135;
            }
            else if (formato_file == "A3" || formato_file == "70x100") {
                loghi_x = 10;
                loghi_y = 239;//180;
            }
            else if (formato_file == "70x50") {
                loghi_x = 31;
                loghi_y = 320;
            }
    
    
            var canaleInTitolo = this.canale;
    
    
            var siglaNome = ((codiceGruppo != obj["Referenza.Codice"].toString()) ? "A" : "G");
    
            if (obj.sigla_reparto != this.curr_cat)
                this.contatore_ordine = 0;
    
            this.contatore_ordine++;
            this.curr_cat = obj.sigla_reparto;
    
            let isFid= obj["Kit.Declinazioni"] != null && (this.cercaChiaveKit("isFidelity", obj["Kit.Declinazioni"]) != null);
            let isSed= obj["Kit.Declinazioni"] != null && (this.cercaChiaveKit("isSed", obj["Kit.Declinazioni"]) != null);
            if (obj.id_pop != "" && obj.id_pop != null) {
                g_new.label = JSON.stringify({
                    idPoP: obj.id_pop,
                    codiceGruppoPoP: codiceGruppo,
                    siglaNome: siglaNome/*((!conDescrGruppo && !cache_id_pop[obj.id_pop].singolo)?"A":"G")*/,
                    siglaPromozione: sottosigla == "" ? sigla_main : sottosigla /*(siglaPromozione=="BIRRA"?"GIORNATA"+siglaPromozione:(siglaPromozione!="PROMO"?siglaPromozione:"PROMO"))*/,
                    siglaCanale: this.canale,
                    siglaArea: this.area,
                    dataPop: obj.data_da != "",
                    siglaCategoria: obj.siglaCategoria_origine != "" ? obj.siglaCategoria_origine : obj.sigla_reparto,
                    contatoreOrdine: this.contatore_ordine,
                    codicePromo: obj.promotion_plan,
                    formato: this.codiceFormato,
                    codice: obj["Referenza.Codice"],
                    vv: (obj["Referenza.Codice"].indexOf("vv3") > 0 ? "003" : ((obj["Referenza.Codice"].indexOf("vv2") > 0) ? "002" : "001")),
                    isFidelity:  isFid,
                    isSed: isSed
                });
            }
            else {
                g_new.label = "";
            }
    
            var maxXTextOffsetLeft = -1;
            var rettangoloTesti = null;
    
            var descrMatrix = [];
            //var warningSovrapposizione=false;
            var descrObj = null;
            var realXDescr = 0;
            var string_error = "";
            var g_new_all = [];
            for (var $xa = 0; $xa < g_new.allPageItems.length; $xa++) {
                var el = g_new.allPageItems[$xa];
                var nome_proprieta = el.label.replace("X_", "");
    
                if (nome_proprieta == "sy_-" || nome_proprieta == "sy_%")
                    continue;
    
    
                if (nome_proprieta == "descrizione") {
    
                    var cod_art_pop = obj.codice_articolo_pop + "\n";
    
                    if (this.codiceFormato != "stopper" && this.codiceFormato != "95x45") {
                        if ((codiceGruppo.split(",").length > 2 && siglaNome != "A") || (siglaNome == "G" && codiceGruppo.split(",").length > 1))
                        {
                            cod_art_pop = "";
                        }
                    }
    
                    var descrizioni = {
                        Descrizione1: obj["Descrizioni.Descrizione1"],
                        Descrizione2: obj["Descrizioni.Descrizione2"],
                        Descrizione3: obj["Descrizioni.Descrizione3"],
                        Descrizione4: obj["Descrizioni.Descrizione4"],
                        Peso: obj["Descrizioni.Peso"],
                        Um: obj["Descrizioni.Um"],
                    }
                    
    
    
                    var desc_1 = descrizioni.Descrizione1;
    
                    while (desc_1.search("<br>") >= 0) {
                        desc_1 = desc_1.replace("<br>", "\n");
                    }
    
                    var desc_2 = descrizioni.Descrizione2;
    
                    while (desc_2.indexOf("<br><br>") >= 0) {
                        desc_2 = desc_2.replace("<br><br>", "<br>");
                    }
    
                    while (desc_2.search("<br>") >= 0) {
                        desc_2 = desc_2.replace("<br>", "\n");
                    }
    
                    //Workaround temporaneo per gestire la doppia interlinea per i casi ortofrutta Origine/Calibro
                    var desc_3 = descrizioni.Descrizione3;
                    while (desc_3.search("<br>") >= 0) {
                        desc_3 = desc_3.replace("<br>", "\n");
                    }
    
                    //var desc_3=obj[nome_proprieta].descrizione_3.replace("<br>","\n");
                    var desc_4 = descrizioni.Descrizione4;
    
                    while (desc_4.search("<br>") >= 0) {
                        desc_4 = desc_4.replace("<br>", "\n");
                    }
    
                    try {
    
    
                        var bounds = el.geometricBounds;
    
                        //Le meccaniche punti si devono lasciar stare
                        el.geometricBounds = [bounds[0], bounds[1], g_new.geometricBounds[2], bounds[3]];
                        
    
                        var indice_desc = 0;
                        var desc_prog = "";
    
                        el.contents = "";
    
                        if (cod_art_pop != "") {
                            var objStile = this.getStileForFieldPOP("", "P_cod_POP", currentSuffixSiglaStili);
    
                            try {
                                el.contents = cod_art_pop;
                                for (var iz = 0; iz < el.characters.length; iz++) {
    
                                    el.characters.item(iz).appliedCharacterStyle = objStile;
                                    if (el.overflows) {
                                        el.paragraphs.item(0).hyphenation = true;
                                    }
                                }
                            }
                            catch (errStileCodPop) {
                                console.error("Errore stile cod POP " + errStileCodPop);
                            }
    
    
    
                            if (el.characters.item(0).contents == "P" || el.characters.item(0).contents == "L")
                                el.characters.item(0).fontStyle = "Bold Condensed";
    
                            indice_desc = el.characters.length;
    
                            desc_prog += cod_art_pop;
                        }
    
    
                        if (desc_1 != "") {
                            el.contents += desc_1;
                            desc_prog += desc_1;
                            var n_lines = el.lines.length;
                            //APPLICATO STILE ALLA DESCRIZIONE
    
                            var objStile = this.getStileForFieldPOP(obj.combinazioneAssegnata, "descr_nome", currentSuffixSiglaStili);
    
                            try {
    
                                for (var iz = indice_desc; iz < el.characters.length; iz++) {                           
                                    el.characters.item(iz).appliedCharacterStyle = objStile;// myTemplate.characterStyles.itemByName(nome_stile);   
                                    if (el.overflows) {
                                        //Non puo accadere MA se accade allora impostiamo la sillabazione 
                                        //console.error("hypenation");
                                        el.paragraphs.item(0).hyphenation = true;
                                    }
                                }
    
                                indice_desc = el.characters.length;
                            }
                            catch (error_d1) {
                                console.error(error_d1);
                                string_error += "Non trovato lo stile " + objStile + error_d1 + "\n" + [obj.combinazioneAssegnata, sigla_main, sottosigla];
                            }
                        }
    
                        if (desc_4 != "") {
                            if (desc_1 != "") {
                                el.contents += "\n";
                                desc_prog += "\n";
                            }
    
                            el.contents += desc_4;
                            desc_prog += desc_4;
    
                            var objStile = this.getStileForFieldPOP(obj.combinazioneAssegnata, "descr_marca", currentSuffixSiglaStili);
    
                            try {
    
                                for (var iz = indice_desc; iz < el.characters.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                {
                                    el.characters.item(iz).appliedCharacterStyle = objStile;//myTemplate.characterStyles.itemByName(nome_stile);
                                    if (el.overflows) {
                                        //Non puo accadere MA se accade allora impostiamo la sillabazione 
                                        el.paragraphs.item(0).hyphenation = true;
                                    }
                                }
                            }
                            catch (error_d2) {
                                console.error(error_d2);
                                string_error += "Non trovato lo stile descr_marca della meccanica " + [obj.combinazioneAssegnata, sigla_main, sottosigla] + "\n";
                            }
    
    
                            indice_desc = el.characters.length;
                        }
    
                        if (desc_2 != "") {
                            if (desc_prog != "") {
                                el.contents += "\n";
                                desc_prog += "\n";
                            }
    
                            el.contents += desc_2;
                            desc_prog += desc_2;
    
                            try {
    
                                var objStile = this.getStileForFieldPOP(obj.combinazioneAssegnata, "descr_tipo", currentSuffixSiglaStili);
                                for (var iz = indice_desc; iz < el.characters.length; iz++)//for (var iz=desc_1.length+1; iz<desc_1.length+desc_2.length; iz++)
                                {
                                    el.characters.item(iz).appliedCharacterStyle = objStile;//myTemplate.characterStyles.itemByName(nome_stile);
    
                                    if (el.overflows) {
                                        //Non puo accadere MA se accade allora impostiamo la sillabazione 
                                        el.paragraphs.item(0).hyphenation = true;
                                    }
    
                                    indice_desc = el.characters.length;
                                }
                            }
                            catch (error_d3) {
                                console.error(error_d3);
                                string_error += "Non trovato lo stile descr_tipo della meccanica " + [obj.combinazioneAssegnata, sigla_main, sottosigla] + "\n";
                            }
    
                        }
    
                        if (obj.combinazioneAssegnata.indexOf("_boxetto") < 0) {
    
    
                            if (desc_3 != "") {
                                var desc_3_copy = desc_3;
    
                                if (desc_prog != "") {
                                    el.contents += "\n";
                                    desc_prog += "\n";
                                }
    
                                var coeff_indice = 0;
                                if (desc_3.toLowerCase().indexOf("-<br2>al kg") == 0) {
                                    el.contents += desc_3.replace("-<br2>", "");
                                }
                                else {
                                    coeff_indice = 1;
                                    el.contents += desc_3.replace("-<br2>", "\n");
                                }
    
                                desc_prog += desc_3;
    
                                try {
    
                                    var objStile = this.getStileForFieldPOP(obj.combinazioneAssegnata, "descr_gr", currentSuffixSiglaStili);
    
    
                                    var split_alkg = desc_3_copy.split("<br2>");
                                    var prima_parte = split_alkg[0];
                                    for (var iz = indice_desc; iz < el.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                    {
                                        el.characters.item(iz).appliedCharacterStyle = objStile;//myTemplate.characterStyles.itemByName(nome_stile);
                                    }
    
                                    if (split_alkg.length > 1) {
                                        var objStile_alkg = this.getStileForFieldPOP(obj.combinazioneAssegnata, "descr_alkg", currentSuffixSiglaStili);
                                        var seconda_parte = split_alkg[1];
                                        for (var iz = indice_desc + prima_parte.length + coeff_indice; iz < el.contents.length; iz++)//for (var iz=desc_1.length+desc_2.length; iz<g_new.pageItems[$xa].characters.length; iz++)
                                        {
                                            el.characters.item(iz).appliedCharacterStyle = objStile_alkg;//myTemplate.characterStyles.itemByName(nome_stile_alkg);
                                        }
                                    }
    
                                }
                                catch (error_d4) {
                                    console.error(error_d4);
                                    string_error += "Non trovato lo stile descr_gr della meccanica " + obj.combinazioneAssegnata + "\n";
                                }
                            }
    
    
    
    
                        }
                        else {
    
                            var s_etto = obj.stringa_etto; //???????????
                            var m_etto = "stringa_etto";  //???????????
    
                            if (obj.combinazioneAssegnata.indexOf("TP_MM") >= 0) {
                                s_etto = obj.campo_offerta_KgL;
                            }
    
                            if (desc_prog != "") {
                                el.contents += "\n";
                                desc_prog += "\n";
                            }
    
                            desc_prog += s_etto;
                            el.contents += s_etto;
    
                            //var nome_stile_boxetto = obj.combinazioneAssegnata + "_" + m_etto;
                            var objStileEuroBoxetto = this.getStileForFieldPOP("", "EURO piccolo_Descr2_boxetto", currentSuffixSiglaStili);
                            //var objStileCharBoxetto = this.getStileForFieldPOP("", "C" + nome_stile_boxetto, currentSuffixSiglaStili);
                            var objStileCharBoxetto = this.getStileForFieldPOP(obj.combinazioneAssegnata, "stringa_etto", currentSuffixSiglaStili, "C");
    
                            try {
                                // var euro_style=myTemplate.paragraphStyles.itemByName(nome_stile).nestedStyles[1].appliedCharacterStyle;
    
                                //ATTENZIONE questo caso lin un primo test era sospeso
    
                                for (var iz = indice_desc; iz < el.contents.length; iz++) {
                                    if (el.characters.item(iz).contents == "€")
                                        el.characters.item(iz).appliedCharacterStyle = objStileEuroBoxetto;//myTemplate.characterStyles.itemByName("EURO piccolo_Descr2_boxetto");
                                    else
                                        el.characters.item(iz).appliedCharacterStyle = objStileCharBoxetto;//myTemplate.characterStyles.itemByName("C"+nome_stile);
                                }
    
                            }
                            catch (error_d4) {
                                console.error(error_d4);
                                string_error += "Non trovato lo stile " + "C" + m_etto + " della meccanica " + obj.combinazioneAssegnata + "\n";
                            }
                        }
    
                        //el.geometricBounds=bounds;
    
                        if (this.canale == "SC" && sigla_main == "GIORNATA") {
                            //el.geometricBounds=[el.geometricBounds[0]+4,el.geometricBounds[1],el.geometricBounds[2]+4,el.geometricBounds[3]];
                        }
    
                        if (sigla_main.indexOf("SCUOLABUONO") >= 0) {
                            //Eccezione SPOSTO la descrizione a    
                            el.move([el.geometricBounds[1], 60]);
                        }
    
                    }
                    catch (error) {
                        console.error(error);
                        string_error += "errore generico : " + error.message + "\n";
                    }
    
                    if (obj.combinazioneAssegnata.indexOf("PUNTI") >= 0) {
                        el.geometricBounds = bounds;
                    }
    
                    if (el.overflows) {
                        var overflowApplied = 0;
                        var overflowStep = 1;
                        var maxTentativi = 30;
                        var nTentativi = 0;
                        while (true) {
                            //Allungo in basso finchè la descrizione non entra e mi salvo il dato di OVERFLOW                    
                            el.geometricBounds = [el.geometricBounds[0], el.geometricBounds[1], el.geometricBounds[2] + overflowStep, el.geometricBounds[3]];
                            overflowApplied += overflowStep;
                            nTentativi++;
    
                            if (nTentativi >= maxTentativi || !el.overflows) {
                                break;
                            }
                        }
    
                        var newDna = JSON.parse(g_new.label);
                        newDna.overflows = overflowApplied;
                        g_new.label = JSON.stringify(newDna);
    
                    }
    
                    //Descrizione compilata
                    //Adesso riucavo le matrici di posizionamento
                    descrObj = el;
    
                    for (var r = 0; r < descrObj.lines.count(); r++)
                        descrMatrix.push([descrObj.lines.item(r).baseline, descrObj.lines.item(r).horizontalOffset, descrObj.lines.item(r).endHorizontalOffset]);
    
    
                    realXDescr = el.characters.item(0).horizontalOffset;
    
                }
                else if (nome_proprieta == "spazio_loghi") {
                    spazio_loghi = el;
                }
                else if (nome_proprieta == "rect_etto") {
                    rettangoloTesti = el;
                }
                else {
                    var originGB = el.geometricBounds;
    
                    if (obj[nome_proprieta] != null && obj[nome_proprieta] != "") {
                        try {
                            var valore = obj[nome_proprieta];

                            var listProprietaStr = [
                                "M_FID",
                                "M_MM",
                                "N_FID",
                                "N_MM",
                            ]
                            if(listProprietaStr.indexOf(nome_proprieta) >= 0){
                                valore = obj[nome_proprieta+"_str"];
                            }

                            if (obj.combinazioneAssegnata.indexOf("_FID") > 0 || obj.combinazioneAssegnata.indexOf("50al50Fid") >= 0) {
                                if (nome_proprieta.indexOf("sconto_fid") >= 0 && obj.sconto_fid <= 0) {
                                    //Lo sconto fid veicola in sconto normale
                                    valore = obj.sconto_norm;
                                }
                                else if (nome_proprieta.indexOf("M_fid") >= 0 && (obj.M_FID.indexOf("0 pezzi") == 0 || obj.M_FID.indexOf("0 conf") == 0)) {
                                    valore = obj.M_MM_str;
                                }
                                else if (nome_proprieta.indexOf("PezzConf_NM") >= 0 && (obj.PezzConf_NM.indexOf("0 pezzi") == 0 || obj.PezzConf_NM.indexOf("0 conf") == 0)) {
                                    //Prendo il valore di M_fid o M_MM e ne estraggo solo le prime due parole incrementando di 1 il primo parametro
                                    /*var _param = obj.N_fid;
                                    if (obj.N_fid.indexOf("0 pezzi")==0 ||  obj.N_fid.indexOf("0 conf")==0)
                                    {
                                        _param = obj.N_MM;
                                    }*/
                                    //var _params = _param.split(" ");
                                    //var _totPzConf = Math.min(2,Number(_params[0])+1);
                                    valore = "2 " + (obj.PezzConf_NM.indexOf("0 pezzi") == 0 ? "PEZZI" : "CONF.");
                                }
    
                            }
    
    
    
                            //Espando la larghezza per assicurarmi di farci entrare il testo
    
    
                            var isPer100g = (obj['Descrizioni.Descrizione4'].indexOf("per 100 g") >= 0);
                            if (nome_proprieta.indexOf("prezzo_offerta") == 0 && isPer100g) {
                                //Metto prezzo all'etto
                                valore = obj.prezzo_offerta_etto;
                            }
                            else if (nome_proprieta.indexOf("campo_offerta") == 0 && isPer100g) {
                                valore = obj.campo_offerta_etto;
                            }
    
    
                            el.contents = valore.toString();//obj[nome_proprieta];		
                            if (el.overflows) {
                                el.geometricBounds = [el.geometricBounds[0], 0, el.geometricBounds[2], el.geometricBounds[3]];
                            }
    
    
    
                            
                            var objStile = this.getStileForFieldPOP(obj.combinazioneAssegnata, nome_proprieta, currentSuffixSiglaStili, "", true);
                            //var sty = myStyles[obj.combinazioneAssegnata + "_" + nome_proprieta];
    
                            if (objStile != null && objStile.isValid) {
                                this.applyNeastedStyles(el, objStile);
                            }
    
                        }
                        catch (error) {
                            console.error(error);
                            string_error += "errore caricamento font " + [obj.combinazioneAssegnata, nome_proprieta] + " : " + error.message + "\n";
                            //operazioneDaAnnullare=true;
                        }
                    }
                    else if (nome_proprieta == "baffo") {
                        var fondoDaPosizionare = obj["Foto.ExtraAuto"].find(f=>f.tipo == 5);
                        if(fondoDaPosizionare == null){
                            continue;
                        }
                        var baffo=el;

                        var nuovoCollegamento = "";
    
                        try {
                            var imgName = fondoDaPosizionare.nome;
                            var sigla = fondoDaPosizionare.sigla;
                            var tipo = fondoDaPosizionare.tipo;
                            try{
                                var path = pathLavorazione + "/Links/Loghi/" + imgName;
                                baffo.place(path);
                            }
                            catch{
                                
                            }
                            baffo.fit(FitOptions.FRAME_TO_CONTENT);
                            baffo.fillColor = "None";


                            
    
                            var ingombro = this.loadConfinamentoDescrizioneDelBaffo(baffo.graphics.item(0).itemLink.filePath);
                            if(ingombro == null){}
                            else if (ingombro.height != -1 && ingombro.width != -1 && ingombro.left != -1 && ingombro.top != -1) {
                                //Ingombro baffo valido
                                var offsetMarginY = baffo.geometricBounds[0] + 5;
                                var offsetMarginX = baffo.geometricBounds[1] + 5;

                                descrObj.geometricBounds = [ingombro.top + offsetMarginY, ingombro.left + offsetMarginX, ingombro.top + ingombro.height + offsetMarginY, ingombro.left + ingombro.width + offsetMarginX];

                                var newDna = { descrConstraint: true };

                                if (g_new.label != "") {
                                    newDna = JSON.parse(g_new.label);
                                    newDna.descrConstraint = true;
                                }

                                //questo potrebbe causare un overflow del testo
                                if (descrObj.overflows) {

                                    var overflowApplied = 0;
                                    var overflowStep = 1;
                                    var maxTentativi = 30;
                                    var nTentativi = 0;
                                    while (true) {
                                        //Allungo in basso finchè la descrizione non entra e mi salvo il dato di OVERFLOW                    
                                        descrObj.geometricBounds = [descrObj.geometricBounds[0], descrObj.geometricBounds[1], descrObj.geometricBounds[2] + overflowStep, descrObj.geometricBounds[3]];
                                        overflowApplied += overflowStep;
                                        nTentativi++;

                                        if (nTentativi >= maxTentativi || !descrObj.overflows) {
                                            break;
                                        }
                                    }
                                    newDna.overflows = overflowApplied;
                                }
                                else {
                                    newDna.overflows = 0;
                                }

                                g_new.label = JSON.stringify(newDna);

                            }
    
                        }
                        catch (err_baffo) {
                            console.error(err_baffo);
                            //return "error: caricamento baffo: " + err_baffo + " at path " + pathLavorazione + "/foto/" + nuovoCollegamento;
                        }
    
                    }
                    else {
                        //Valore non letto dall'excel per cui oscuro il campo
                        if (nome_proprieta == "campo_offerta_KgL_sconto")
                            el.visible = false;
                    }
    
                    if (sigla_main.indexOf("SCUOLABUONO") >= 0 && (el.constructor.name == "TextFrame")) {
                        //Eccezione SPOSTO la descrizione a   
                        el.geometricBounds = [el.geometricBounds[0] + 8, el.geometricBounds[1], el.geometricBounds[2] + 8, el.geometricBounds[3]];
                        originGB = el.geometricBounds;
                    }
    
    
                    try {
                        if (el.constructor.name == "TextFrame" && nome_proprieta.indexOf("prezzo_offerta") >= 0) {
                            //Il prezzo deve allinearsi al minimo all'inizio della descrizione
                            //Oltre quel limite deve costringere il prezzo ad entrare in uno spazio più piccolo e quindi diminuire il font
                            if (el.characters.item(0).horizontalOffset < realXDescr) {
                                el.geometricBounds = [el.geometricBounds[0], realXDescr, el.geometricBounds[2], el.geometricBounds[3]];
                            }
    
                            if (el.overflows) {
                                //console.error("Prezzo in overflow " + el.contents);
    
                                var tentativi = 0;
                                var originGB = el.geometricBounds;
                                el.geometricBounds = [el.geometricBounds[0], -10, el.geometricBounds[2], el.geometricBounds[3]];
    
                                while (true) {
                                    tentativi++;
    
                                    //console.error("tentativo " + tentativi + " caratteri: " + el.characters.length);
    
                                    for (var cT2 = 0; cT2 < el.characters.length; cT2++) {
                                        var cT2Item = el.characters.item(cT2);
                                        var pSize = cT2Item.pointSize;
                                        pSize -= 1;
                                        cT2Item.pointSize = pSize;
                                        cT2Item.leading = pSize;
                                    }
    
                                    el.geometricBounds = originGB;
    
                                    if (!el.overflows) {
                                        //console.error("OK!");
                                        break;
                                    }
                                    else {
                                        el.geometricBounds = [el.geometricBounds[0], -10, el.geometricBounds[2], el.geometricBounds[3]];
                                        //console.error("Fallito");
                                    }
    
                                    if (tentativi > 10) {
                                        break;
                                    }
                                }
                            }
                        }
    
                    }
                    catch (err2) {
                        console.error(err2);
                    }
    
                    try {
    
                        if (el.characters != null && el.characters.length > 0) {
                            var firstChar = el.characters.item(0);
    
                            if (el.label != "" && el.label.indexOf("sconto_fid") < 0 && el.label.indexOf("sconto_norm") < 0 && el.label.indexOf("prezzo_offerta") < 0 && el.label.indexOf("punti") < 0 && el.label.indexOf("range") < 0) {
    
                                if (firstChar.justification == Justification.CENTER_ALIGN) {
                                    el.geometricBounds = [originGB[0], 0, originGB[2], g_new.geometricBounds[3]];
                                }
                                else if (firstChar.justification == Justification.LEFT_ALIGN) {
                                    el.geometricBounds = [originGB[0], originGB[1], originGB[2], g_new.geometricBounds[3]];
                                }
                                else if (firstChar.justification == Justification.RIGHT_ALIGN) {
                                    el.geometricBounds = [originGB[0], 0, originGB[2], originGB[3]];
    
                                    if (maxXTextOffsetLeft == -1 || maxXTextOffsetLeft > el.characters.item(0).horizontalOffset) {
                                        maxXTextOffsetLeft = el.characters.item(0).horizontalOffset;
                                    }
    
                                }
                            }
                            else if (el.label.indexOf("prezzo_offerta") >= 0) {
                                var firstChar = el.characters.item(0);
    
                                if (firstChar.justification == Justification.RIGHT_ALIGN) {
                                    maxXTextOffsetLeft = el.characters.item(0).horizontalOffset;
                                }
                            }
    
                        }
                    }
                    catch (err_wrng) {
                        console.error(err_wrng);
                    }
                }
    
            }
            console.warn(listNomeBaffi);
            try{
                if (obj["Foto.ExtraAuto"] != null) {
                    for (var i = 0; i < obj["Foto.ExtraAuto"].length; i++) {
    
                        if (obj["Foto.ExtraAuto"][i].escluso == true) {
                            continue;
                        }
    
                        if(obj["Foto.ExtraAuto"][i].tipo == 5){
                            continue;
                        }
                        var imgName = obj["Foto.ExtraAuto"][i].nome;
                        var sigla = obj["Foto.ExtraAuto"][i].sigla;
                        var tipo = obj["Foto.ExtraAuto"][i].tipo;
                        var path = pathLavorazione + "/Links/Loghi/" + imgName;
                        //Controllo esstensine
                        //idms rappresenta un eccezione
                        //Deve essere caricato SOLO 1 VOLTA ew piazzato nella prima pagina in alto a sx
                        if (imgName.split(".")[1] == "idms") {
    
                            let syObj = null;
                            if (this.simboli[sigla] == null || !this.simboli[sigla].isValid) {
                                //Cerco in pagina 1 se ho già impaginato il simbolo
                                var pag0 = doc.pages.item(0);
                                for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                                    var item = pag0.allPageItems[i2];
                                    if (item.label == "simbolo$" + imgName + "$tipo_" + tipo) {
                                        this.simboli[sigla] = item;
                                        break;
                                    }
                                }
    
                                if (this.simboli[sigla] == null || !this.simboli[sigla].isValid) {
                                    let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                                    objDms.label = "simbolo$" + imgName + "$tipo_" + tipo;
                                    this.simboli[sigla] = objDms[0];
                                }
                            }
                            syObj = this.simboli[sigla];
                            var sy = syObj.duplicate(g_new.parentPage);
                            sy.move(doc.layers.itemByName("InPagina"));
                            //muoviamo sy nell'angolo in alto a sinistra del box
                            sy.move([g_new.visibleBounds[1], g_new.visibleBounds[0]]);
                            obj["Foto.ExtraAuto"][i].referenceTo = sy;
                            g_new_all.push(sy);
                            console.log("Ho aggiunto a g_new_all " + sy.label);
                            sy.label = "foto_extra$" + imgName + "$tipo_" + tipo
                            sy.bringToFront();
                        }
                        else {
                            var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: g_new.geometricBounds })
                            g_new_all.push(rect);
                            rect.label = "foto_extra$" + imgName + "$tipo_" + tipo;
                            console.log("Ho aggiunto a g_new_all " + rect.label);
                            rect.place(path);
                            //rect.fit(FitOptions.PROPORTIONALLY);
                            rect.fit(FitOptions.FRAME_TO_CONTENT);
                            rect.fillColor = "None";
                            obj["Foto.ExtraAuto"][i].referenceTo = rect;
                        }
                    }
                }
            }
            catch(e){
                console.error("Errore caricamento foto extra");
                console.error(e);
            }
    
            if (rettangoloTesti != null && maxXTextOffsetLeft > 0) {
                //Allora applico margine specifico al rettangolo
                var rtGB = rettangoloTesti.geometricBounds;
                rettangoloTesti.geometricBounds = [rtGB[0], maxXTextOffsetLeft - 6/*mm di margine*/, rtGB[2], rtGB[3]];
            }
    
            var offset_loghi = 0;
    
            // var nuovoRaggruppamento = new Array();
            // nuovoRaggruppamento.push(g_new);
    
            // var gruppo_Distintivita = (codiceGruppo != obj["Referenza.Codice"].toString() && obj.distintivita.indexOf("inostriori") >= 0);
            // var gruppo_Territorio = (codiceGruppo != obj["Referenza.Codice"].toString() && obj.distintivita.indexOf("territorio") >= 0);
    
            //scorriamo le fotoextra
            if (obj["Foto.ExtraAuto"] != null) {
    
                //cerchiamo LOGO_bandiera_italiana  se lo troviamo spostiamolo primo in lista
                obj["Foto.ExtraAuto"].sort(function (a, b) {
                    // Controlla se "a" o "b" sono "LOGO_bandiera_italiana"
                    if (a.sigla == "LOGO_bandiera_italiana") return -1;
                    if (b.sigla == "LOGO_bandiera_italiana") return 1;
    
                    // Controlla se "a" o "b" sono "logo_BassieFissi"
                    if (a.sigla == "logo") return -1;
                    if (b.sigla == "logo") return 1;
    
                    // Mantieni l'ordine originale per tutto il resto
                    return 0;
                });
                for (var i = 0; i < obj["Foto.ExtraAuto"].length; i++) {
                    var extra = obj["Foto.ExtraAuto"][i];
                    
                    if (obj.combinazioneAssegnata.toLowerCase().indexOf("punti") < 0) {
                    
                        if (extra.sigla.startsWith("INOSTRIORI") && obj.territorialita != null && obj.territorialita.toLowerCase().indexOf("inostriori") >= 0) {
    
                            var wOri = 12;
                            var hOri = 12;
                            var offsest_y_inostriori_x_fid = 0;
    
                            if (formato_file == "A4") {
                                wOri = 28;
                                hOri = 28;
                            }
                            else if (formato_file == "A3") {
                                wOri = 42;
                                hOri = 42;
                            }
                            else if (formato_file == "70x50") {
                                wOri = 28;
                                hOri = 28;
                            }
                            else {
                                offsest_y_inostriori_x_fid = -4;
                            }
    
    
    
    
                            var bounds_rect = [loghi_y + offsest_y_inostriori_x_fid, loghi_x + offset_loghi, loghi_y + hOri + offsest_y_inostriori_x_fid, loghi_x + offset_loghi + wOri];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                        }
    
                        if (extra.sigla.startsWith("TERRITORIO") && obj.territorialita != null && obj.territorialita.toLowerCase().indexOf("territorio") >= 0) {
                            var wOri = 12;
                            var hOri = 12;
                            var offsest_y_territorio_x_fid = 0;
    
                            if (formato_file == "A4") {
                                wOri = 28;
                                hOri = 28;
                            }
                            else if (formato_file == "A3") {
                                wOri = 42;
                                hOri = 42;
                            }
                            else if (formato_file == "70x50") {
                                wOri = 28;
                                hOri = 28;
                            }
                            else {
                                offsest_y_territorio_x_fid = -4;
                            }
    
                            var suffix_LOC_default = "POP_";
    
    
                            var bounds_rect = [loghi_y + offsest_y_territorio_x_fid, loghi_x + offset_loghi, loghi_y + hOri + offsest_y_territorio_x_fid, loghi_x + offset_loghi + wOri];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
    
                            offset_loghi += w;
    
    
                            // rectTerr.graphics.item(0).graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + "territorio_generico").currentVisibility = false;
                            // rectTerr.graphics.item(0).graphicLayerOptions.graphicLayers.itemByName(suffix_LOC_default + obj.distintivita).currentVisibility = true;
    
                            offset_loghi += wOri;
                        }
    
                        var listaProdottiConad = ["bio",
                            "saporidintornipq",
                            "saporiideepq",
                            "cpq",
                            "saporidintorni",
                            "saporiidee",
                            "kids",
                            "piacersi",
                            "aslattosio",
                            "asglutine",
                            "vn",
                            "parafarmacia",
                            "11p",
                            "baby",
                            "essentiae",
                            "petfrplus",
                            "petfr",
                            "logo"];
    
                        if (listaProdottiConad.includes(extra.sigla) && sigla_main != "GIORNATA")//e vediamo cos'altro
                        {
    
                            //Metto la testata CONAD se è un prodotto conad
                            
                            try {
    
                                var w = 12.5;
                                var h = 7;
                                if (formato_file == "A4") {
                                    w = 26.186;
                                    h = 14.5;
                                }
                                else if (formato_file == "A3") {
                                    w = 37.919;
                                    h = 21;
                                }
                                else if (formato_file == "70x50") {
                                    w = 87.2137;
                                    h = 48.3;
                                }
    
                                
                                if (extra.sigla == "saporiideepq") {
                                    if (formato_file == "A4") {
                                        w = 17.73;
                                        h = 17.85;
                                    }
                                    else if (formato_file == "A3") {
                                        w = 25.678;
                                        h = 25.7;
                                    }
                                    else if (formato_file == "70x50") {
    
                                    }
                                    else {
                                        w = 8.5;
                                        h = 8.55;
                                    }
                                }
                                else if (extra.sigla.indexOf("saporidintorni") >= 0 || extra.sigla.indexOf("saporiidee") >= 0) {
                                    var w = 8.5;
                                    if (formato_file == "A4") {
                                        w = 17.73;
                                        h = 14.5;
                                    }
                                    else if (formato_file == "A3") {
                                        w = 25.678;
                                        h = 21;
                                    }
                                    else if (formato_file == "70x50") {
                                        w = 59.059;
                                        h = 48.3;
                                    }
    
                                }
                                else if (extra.sigla == "kids") {
                                    var w = 22.5;
                                    if (formato_file == "A4") {
                                        w = 46.677;
                                        h = 14.5;
                                    }
                                    else if (formato_file == "A3") {
                                        w = 67.601;
                                        h = 21;
                                    }
                                    else if (formato_file == "70x50") {
                                        w = 155.4823;
                                        h = 48.3;
                                    }
                                }
                                if (extra.sigla == "piacersi" || extra.sigla == "parafarmacia") {
                                    var w = 30.6;
                                    if (formato_file == "A4") {
                                        w = 63.431;
                                        h = 14.5;
                                    }
                                    else if (formato_file == "A3") {
                                        w = 91.866;
                                        h = 21;
                                    }
                                    else if (formato_file == "70x50") {
                                        w = 211.2918;
                                        h = 48.3;
                                    }
                                }
    
                                if (extra.sigla == "cpq") {
                                    var w = 22.587;
                                    var h = 3.843;
                                    if (formato_file == "A4") {
                                        w = 47.6;
                                        h = 8.099;
                                    }
                                    else if (formato_file == "A3") {
                                        w = 68.7;
                                        h = 11.689;
                                    }
                                    else if (formato_file == "70x50") {
                                        w = 158.01;
                                        h = 26.8847;
                                    }
                                }
    
    
    
                                var bounds_rect2 = [loghi_y, loghi_x + offset_loghi, loghi_y + h, loghi_x + offset_loghi + w];
    
                                extra.referenceTo.geometricBounds = bounds_rect2;
                                extra.referenceTo.fit(FitOptions.PROPORTIONALLY);
                                offset_loghi += w;
                                
                            }
                            catch (error) {
                                //Dovrei mettere no_foto
                                console.error("error prodotto conad " + obj.prodotto_conad + error.message);
                            }
                            
    
                        }
    
                        if (extra.sigla == "logo_BassieFissi" && sigla_main != "GIORNATA") {
    
                            try {
                                var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fit(FitOptions.FRAME_TO_CONTENT);
                            }
                            catch (error) {
                                console.error("Errore caricamento logo bassi fissi " + error);
                            }
                        }
    
                        // if (logo_ori != "" && sigla_main != "GIORNATA") {
                        //     var w = 33.2;
                        //     var h = 7;
    
                        //     if (formato_file == "A4") {
                        //         w = 69.199;
                        //         h = 14.5;
                        //     }
                        //     else if (formato_file == "A3") {
                        //         w = 99.8;
                        //         h = 21;
                        //     }
                        //     else if (formato_file == "70x50") {
                        //         w = 229.54;
                        //         h = 48.3;
                        //     }
    
                        //     try {
                        //         var bounds_rect = [loghi_y, loghi_x + offset_loghi, loghi_y + h, loghi_x + offset_loghi + w];
                        //         var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, g_new, { geometricBounds: bounds_rect })
    
                        //         var obj_file = pathLavorazione + "/foto/loghi/Logo_ORI" + logo_ori + ".psd";//.replace(".jpg",".psd")/*obj[nome_proprieta].href.replace("file:/",myDocument.filePath.fullName)*/);//myDocument.filePath.path+"\\mastroIndesgn"));
                        //         rect.place(obj_file);
                        //         rect.fit(FitOptions.PROPORTIONALLY);
                        //         rect.fillColor = "None";
    
                        //         nuovoRaggruppamento.push(rect);
                        //     }
                        //     catch (error) {
                        //         console.error("Errore caricamento logo ori " + error);
                        //     }
    
                        // }
    
                        if ((extra.sigla == "dop" || extra.sigla == "igp") && sigla_main != "GIORNATA") {
                            try {
    
                                var w = 7;
                                var h = 7;
    
                                if (formato_file == "A4") {
                                    w = 14.5;
                                    h = 14.5;
                                }
                                else if (formato_file == "A3") {
                                    w = 21;
                                    h = 21;
                                }
                                else if (formato_file == "70x50") {
                                    w = 48.3;
                                    h = 48.3;
                                }
    
    
                                var bounds_rect = [loghi_y, loghi_x + offset_loghi, loghi_y + h, loghi_x + offset_loghi + w];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                                offset_loghi += w;
                            }
                            catch (error) {
                                console.error("Errore caricamento logo dop igp " + error);
                            }
    
                        }
    
                        if (extra.sigla == "Logo_VistoinTV" && sigla_main != "GIORNATA") //e vediamo cos'altro
                        {
                            var w = 16;
                            var h = 16;
                            var x = 10;
                            var y = 51;
    
                            if (formato_file == "A4") {
                                w = 31;
                                h = 31;
                                x = 10;
                                y = 150;
                            }
                            else if (formato_file == "A3") {
                                w = 44;
                                h = 44;
                                x = 10;
                                y = 205;
                            }
                            else if (formato_file == "70x50") {
                                w = 101;
                                h = 101;
                            }
    
                            try {
                                var bounds_rect = [y, x, y + h, x + w];
                                extra.referenceTo.geometricBounds = bounds_rect;
                                extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            }
                            catch (error) {
                                console.error("Errore caricamento logo intv " + error);
                            }
    
                        }
    
                    }
    
                    //??????????
    
                    if (extra.sigla == "Tasto") {
                        var w = 51;
                        var h = 63;
                        var x = 139;
                        var y = descrMatrix[0][0] - 10;
                        if (formato_file == "A3") {
                            x = 226;
                        }
    
                        try {
                            var bounds_rect = [y, x, y + h, x + w];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fit(FitOptions.PROPORTIONALLY);
    
                            //Vediamo adesso se si scontra con i testi sotto
                            var minYleader = 999999;
                            for (var $xa = 0; $xa < g_new.allPageItems.length; $xa++) {
                                var el = g_new.allPageItems[$xa];
                                var nome_proprieta = el.label;
    
                                nome_proprieta = nome_proprieta.replace("X_", "");
    
                                if (!nome_proprieta.startsWith("descrizione") && el.constructor.name == "TextFrame" && el.characters.length > 0) {
                                    var realbound = this.getRealBoundsOfText(el);

                                    //Prendo la y min leader
                                    if (realbound[0] < minYleader) {
                                        minYleader = realbound[0];
                                    }
                                }
    
                            }
    
                            if (minYleader - 3 < extra.referenceTo.geometricBounds[2]) {
                                //Estraggo nuova dim
                                var diff = extra.referenceTo.geometricBounds[2] - minYleader + 3;
                                var newH = h - diff;
                                extra.referenceTo.geometricBounds = [extra.referenceTo.geometricBounds[0], extra.referenceTo.geometricBounds[1], extra.referenceTo.geometricBounds[0] + newH, extra.referenceTo.geometricBounds[3]];
                                extra.referenceTo.fit(FitOptions.PROPORTIONALLY);
                            }
    
                        }
                        catch (error) {
                            console.error("Errore caricamento bollo tasto:");
                            console.error(error);
                        }
                    }
    
                    //fine ???????????



                    if ((extra.sigla.toLowerCase().startsWith("logo_carne") || extra.sigla == ("LOGO_filiera"))) {
                        try {
                            var bounds_rect = [g_new.geometricBounds[0] + offset_loghi, g_new.geometricBounds[1] + offset_loghi, g_new.geometricBounds[2] + offset_loghi, g_new.geometricBounds[3] + offset_loghi];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fit(FitOptions.CONTENT_TO_FRAME);
                            offset_loghi += 2;
                        } catch (error) { }

                    }

                    if (extra.sigla == "LOGO_bandiera_italiana") {

                        try {
                            var bounds_rect = [g_new.geometricBounds[0], g_new.geometricBounds[1], g_new.geometricBounds[2], g_new.geometricBounds[3]];
                            extra.referenceTo.geometricBounds = bounds_rect;
                            extra.referenceTo.fit(FitOptions.FRAME_TO_CONTENT);

                        } catch (error) { }
                    }

    
                }
            }
    
            // if (obj.note_category != null && obj.note_category != "") {
            //     var txt_nota_category = myPage.textFrames.add(doc.layers.itemByName("NOTE_CATEGORY"), LocationOptions.UNKNOWN, g_new, { geometricBounds: g_new.geometricBounds });
    
            //     var str_note = obj.note_category.toString();
            //     while (true) {
            //         if (str_note.indexOf("<br>") >= 0) {
            //             str_note = str_note.replace("<br>", "\n");
            //         }
            //         else {
            //             break;
            //         }
    
            //     }
    
            //     txt_nota_category.contents = str_note;//obj.note.toString().replace("<br>","\n");
            // }
    
    
            var sez_data = obj.sez_data;
    
            if (sez_data != null && sez_data != "") {
                var sezDataStyleName = "SEZ_DATA";
                if (sigla_main == "BB")
                    sezDataStyleName = "SEZ_DATA_BB";
                if (sigla_main == "MC")
                    sezDataStyleName = "SEZ_DATA_MC";
    
                var sezDataStyle = this.getStileForFieldPOP("", sezDataStyleName, currentSuffixSiglaStili);
    
                var boundsData = g_new.geometricBounds;
                if (sigla_main == "GIORNATA") {
                    boundsData = [boundsData[0] + 63, boundsData[1], boundsData[2] + 63, boundsData[3]];
                }
    
                var txt_data = myPage.textFrames.add(doc.layers.itemByName("SEZ_DATA"), LocationOptions.UNKNOWN, g_new, { geometricBounds: boundsData });
                txt_data.contents = sez_data;
                try {
    
                    for (var $c = 0; $c < txt_data.contents.length; $c++)
                        if (sezDataStyle != null && sezDataStyle.isValid) {
                            txt_data.characters.item($c).appliedCharacterStyle = sezDataStyle;
                        }
                        else {
                            txt_data.characters.item($c).appliedCharacterStyle = "SEZ_DATA";
                        }
                } catch (error) {
                    console.error("Errore stile sez_data " + error);
                }
            }
    
            // if (nuovoRaggruppamento.length >= 1) {
    
    
            //     var allG = myPage.groups.add(nuovoRaggruppamento);
            //     allG.label = g_new.label;
            // }
    
            // if (obj.note != null && obj.note != "") {
            //     try {
            //         if (obj.note.indexOf("REF IN COMUNE") > 0) {
            //             var inx_start = obj.note.indexOf("REF IN COMUNE");
            //             var inx_end = obj.note.indexOf("<br>", inx_start);
            //             obj.note = obj.note.substring(0, inx_start) + obj.note.substring(inx_end + "<br>".length);
            //         }
    
            //         var txt_note = myPage.textFrames.add(doc.layers.itemByName("NOTE"), LocationOptions.UNKNOWN, g_new, { geometricBounds: g_new.geometricBounds });
    
            //         var str_note = obj.note.toString();
            //         while (true) {
            //             if (str_note.indexOf("<br>") >= 0) {
            //                 str_note = str_note.replace("<br>", "\n");
            //             }
            //             else {
            //                 break;
            //             }
    
            //         }
    
            //         txt_note.contents = str_note;//obj.note.toString().replace("<br>","\n");
    
            //     }
            //     catch (error) {
            //         console.error("Errore note " + error);
            //     }
            // }
    
            if (g_new_all.length > 0) {
                //console.log("INIT sgruppamento");
                var oldGroup = g_new;
                var oldLabel = oldGroup.label;
                var oldItems = oldGroup.pageItems.everyItem().getElements();
                //console.log("Sgruppamento");
                oldGroup.ungroup();
                //console.log("Concat");
    
                var newItems = oldItems.concat(g_new_all);
                g_new = myPage.groups.add(newItems);
                g_new.label = oldLabel;
    
                //console.log("Scorriamo gli elementi");
    
                //scorriamo tutti gli oggetti in newGroup in cerca di label "immagine" e la portiamo in primo piano
                var base = null;
                var fondo = null;
                for (var i = 0; i < g_new.allPageItems.length; i++) {
                    if (g_new.allPageItems[i].label == "nuovo_fondo_distintivita") {
                        fondo = g_new.allPageItems[i];
                    }
    
                    if (g_new.allPageItems[i].label.indexOf("base") == 0) {
                        base = g_new.allPageItems[i];
                    }
    
                }
                if (base != null) {
                    base.sendToBack();
                }
                if (fondo != null) {
                    fondo.sendToBack();
                }
    
            }
    
    
            
    
            //Inserisco il testo di errore se ci sono stati errori
            if (string_error != "") {
                var txt_error = myPage.textFrames.add(doc.layers.itemByName("InPagina - Errori"), LocationOptions.UNKNOWN, g_new, { geometricBounds: g_new.geometricBounds })
                txt_error.contents = string_error;
            }
    
            // try {
    
            //     //Scrivo la nota con codice referenza
            //     var txt_cod_ref = myPage.textFrames.add(doc.layers.itemByName("CODICE REF"), LocationOptions.UNKNOWN, g_new, { geometricBounds: g_new.geometricBounds });
            //     txt_cod_ref.contents = obj["Referenza.Codice"];
    
    
            // }
            // catch (error) {
            //     console.error("Errore codice ref " + error);
            // }
    
            return ["new", obj, g_new];
        }
        catch (e){
            console.error(e);
            return ["error", obj, g_new];
        }
    },


    getStileForFieldPOP(mastro, nome_field, currentSuffixSiglaStili, prefisso = "", paragraph = false) {

        var folder = currentSuffixSiglaStili;

        var templateLib = app.activeDocument;

        var folderStyles = null;
        if (!paragraph) {
            for (var $s = 0; $s < templateLib.characterStyleGroups.length; $s++) {
                var gStyle = templateLib.characterStyleGroups.item($s);
                if (gStyle.name == folder)
                    folderStyles = templateLib.characterStyleGroups.item($s).characterStyles;
            }
        }
        else{
            for (var $s = 0; $s < templateLib.paragraphStyleGroups.length; $s++) {
                var gStyle = templateLib.paragraphStyleGroups.item($s);
                if (gStyle.name == folder)
                    folderStyles = templateLib.paragraphStyleGroups.item($s).paragraphStyles;
            }
        }

        if (mastro != "") {
            // if (myStyles[mastro + "_" + nome_field] != null) {
            //     if (folderStyles != null) {
            //         var labtest = currentSuffixSiglaStili + "_" + myStyles[mastro + "_" + nome_field];
            //         return folderStyles.itemByName(labtest);
            //     }
            // }


            let sty = null;
            if (this.mappaStili != null) {
                sty = this.mappaStili.find(f => f.meccanica == mastro && f.nome_campo == nome_field);
            }
            if (sty != null) {
                var res = sty["stile"];
                return folderStyles.itemByName(currentSuffixSiglaStili + "_"+prefisso +res);
            }
        }
        else {
            if (folderStyles != null) {

                return folderStyles.itemByName(currentSuffixSiglaStili + "_" + nome_field);
            }
        }
        return null;
    },

    archivioConstraints : {},

    loadConfinamentoDescrizioneDelBaffo(pathBaffo) {

        if (this.archivioConstraints[pathBaffo] != null)
            return this.archivioConstraints[pathBaffo];

        var objIngombro = { width: -1, height: -1, left: -1, top: -1 };

        var pathCss = pathBaffo.replace(".ai", ".css");
        //var f = File(pathCss);
        var f = null;
        try {
         f = fs.readFileSync(pathCss, 'utf8');
        }
        catch (e) {
            return null;
        }
        //troviamo in data l'apertura della {
        var start = f.indexOf("{");
        var end = f.indexOf("}");
        var cssString = f.substring(start, end+1);

        cssString = cssString.trim().replace(/^{|}$/g, '');
        var cssObject = {};
        // Divide le proprietà CSS
        cssString.split(';').forEach(declaration => {
            if (!declaration.includes(':')) return; // Ignora stringhe senza ":"

            let [key, value] = declaration.split(':');

            key = key.trim(); // Rimuove spazi extra
            value = value.trim(); // Rimuove spazi extra

            // Rimuove unità di misura da valori numerici
            if (value.match(/^\d+px$/)) {
                value = parseInt(value.replace('px', ''), 10);
            } else if (value.match(/^\d+%$/)) {
                value = parseInt(value.replace('%', ''), 10);
            } else if (!isNaN(value)) {
                value = Number(value); // Converte in numero se è valido
            }
            
            if(typeof value === "number"){
                value = value * 0.3527777778;
            }
            
            cssObject[key] = value;
        });

        // if (/*f.exists*/ f != null) {
        //     //f.open("r");
        //     var line = f.readln();
        //     while (line != "") {

        //         var _params = line.split("\t");
        //         if (
                    // _params[_params.length - 1].indexOf("width") == 0 ||
                    // _params[_params.length - 1].indexOf("height") == 0 ||
                    // _params[_params.length - 1].indexOf("left") == 0 ||
                    // _params[_params.length - 1].indexOf("top") == 0) {
                    // var vals = _params[_params.length - 1].split(" : ");
                    // var valore = vals[1].replace(";", "");
                    // valore = valore.replace("pt", "");
                    // valore = valore.replace("px", "");

                    //objIngombro[vals[0]] = (parseInt(valore) * 0.3527777778);
        //         }

        //         line = f.readln();
        //     }
        //     //f.close();

        this.archivioConstraints[pathBaffo] = cssObject;

        // }

        return cssObject;
    },

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
                result[1] = -30;
            }
            else if (overflowInstruction.w=="right")
            {
                result[3] = 30;
            }

            if (overflowInstruction.h=="top")
            {
                result[0] = -30;
            }
            else if (overflowInstruction.h=="bottom")
            {
                result[2] = 30;
            }
        }
        return result;
    },

    getCambioStrutturalePath(itemRef)
    {
        //Di default questi
        let result = [{
            id:1,
            titolo: "Cambia prezzo promo",
            istruzioni: [
                { field: "prezzo_promo", valore: null }
            ]
        },
        {
            id:2,
            titolo: "Cambia prezzo promo kg/l",
            istruzioni: [
                { field: "prezzo_promo_kgl", valore: null }
            ]
        },
        {
            id:3,
            titolo: "Cambia sconto",
            istruzioni: [
                { field: "txt_sconto", valore: null}
            ]
        }];

        //Poi
        let codiceBox = itemRef.recordInTracciato.codiceBox;
        let azBoxStd = {
            id:4,
            titolo: "Cambia meccanica in STD",
            istruzioni: [
                { field: "note", valore: "" }
            ]
        };
        let azBoxFid = {
            id:5,
            titolo: "Cambia meccanica in FID",
            istruzioni: [
                { field: "note", valore: "FID" }
            ]
        };
        let azBoxBomba = {
            id:6,
            titolo: "Cambia meccanica in BOMBA",
            istruzioni: [
                { field: "note", valore: ["BOMBA","TEST"] }
            ]
        };
        let azBoxOF = {
            id:7,
            titolo: "Cambia meccanica in OF",
            istruzioni: [
                { field: "note", valore: "" }
            ]
        };
         let azBoxOFSuper = {
            id:8,
            titolo: "Cambia meccanica in OF SUPER",
            istruzioni: [
                { field: "note", valore: ["Settimana1","Settimana2"] }
            ]
        };

        //Quando il valore è null il sistema lo mostra a schermo per farlo settare all'utente
        //Quando il valore è un array significa che il sistema non puo scegliere e mostra l'opzione all'utente

        if (codiceBox=="BOX_STD")
        {
            result.push(azBoxFid);
            result.push(azBoxBomba);
        }
        else if (codiceBox=="BOX_FID")
        {
            result.push(azBoxStd);
            result.push(azBoxBomba);
        }
        else if (codiceBox=="BOX_BOMBA")
        {
            result.push(azBoxStd);
            result.push(azBoxFid);
        }
        else if (codiceBox=="BOX_OF")
        {
            result.push(azBoxOFSuper);
        }
        else if (codiceBox=="BOX_OF_SUPER")
        {
            result.push(azBoxOF);
        }
        
        return result;
    }
    
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
//     console.error("testAlessio");
// }

// function testAlessio2(){
//     console.error("Polifemo!");
// }

module.exports = customAgenzia;
//module.exports = { testAlessio, testAlessio2  }