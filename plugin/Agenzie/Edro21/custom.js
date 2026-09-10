//EDRO21
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions, StrokeAlignment } = require('indesign');

const customAgenzia={

    callCustom: false,


//#region VARIABILI IMPAGINAZIONE e FIX FOTO

    customPadding : [{label: "campo_offerta_KgL_sconto", padding:[0,0,0,0]}, //qui vanno messi i padding degli ostacoli per il fix foto se ce ne sono  [{label: "string", padding: [top, left, bottom, right]}]
    {label: "prezzo_offerta_gruppo", padding:[0,0,0,0]},
    {label: "descrizione", padding:[0,0,0,0]},], 

    paddingBox : [0, 0, 0, 0], // [top, left, bottom, right] padding da applicare ai box per il calcolo dei candidati

    paddingFoto : [1, 1], // [top/bottom, left/right] padding da applicare alle foto
    
    ignoreElementsFixFoto: ["*fondo*","*soggetto_IT*","parentesi_BeF","sy_ombra"],
    
    exceptionElementsToIgnoreFixFoto: ["*cpq*","*conad_logo*","*piacersi*","*lattosio*","*glutine*",
        "*parafarmacia*","*conad_vn*","*conad_11P*","*essentiae*","*PetFr*","*petfrplus*","*conad_baby*","*Friend-of-the-Sea*",
        "*Marinou*","*Carne_Chianina*","*Logo_filiera*","*Logo_BDP*","*Logo_SDB*",], //se un elemento è sia in ignoreElementsFixFoto che in exceptionElementsToIgnoreFixFoto non viene ignorato. Serve perchè si può fare cose come ignora loghi e specificare solo il logo che fa eccezione
    
    calcoloDistanziamentoFoto: [ //il ratio è calcolato Y/X
        {
            foto: 1,
            percDistFoto: [{
                percDistanceXFoto: [],
                percDistanceYFoto: [],
                startRangeRatioCondition : 0.0,
                endRangeRatioCondition : Infinity,
            }],
        },
        {
            foto: 2,
            percDistFoto: [{
                percDistanceXFoto: [0.5],
                percDistanceYFoto: [-0.25],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: 3,
            },{
                percDistanceXFoto: [0.55],
                percDistanceYFoto: [-0.05],
                startRangeRatioCondition: 3,
                endRangeRatioCondition: Infinity,
            }],
        },
        {
            foto: 3,
            percDistFoto: [{
                percDistanceXFoto: [0.3, -0.3],
                percDistanceYFoto: [-0.5, -0.5],
                startRangeRatioCondition: 0,
                endRangeRatioCondition: 0.4,
            },{
                percDistanceXFoto: [0.5, -1.05],
                percDistanceYFoto: [-0.3, 0],
                startRangeRatioCondition: 0.4,
                endRangeRatioCondition: 1.5,
            },
            {
                percDistanceXFoto: [0.4, -0.6],
                percDistanceYFoto: [-0.1, -0.1],
                startRangeRatioCondition: 1.5,
                endRangeRatioCondition: Infinity,
            }
            ],
        }
    ],


    
//#endregion 

//#region VARIABILI CAMPI VARI E NOMENCLATURE

    area: null,
    canale: null,
    codiceFormato: null,
    tipoLavorazione: null,
    contesto_promo : [],

//#endregion

//#region METODI SETTER, REMOVE e GETTER VARI

    //TODO: da deprecare
    setLavorazione(){
        var filePath = pathLavorazione + "/lavorazioni.json";
        let lavorazioni = readFile(filePath);
        //lavorazione è una lista di oggetti noi dobbiamo trovare qullo con la chiave file = al nome del file aperto di indesign
        var lavorazione = lavorazioni.find(lavorazione => lavorazione.file == docInLavorazione.name);
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
            console.error("Formato non trovato");
            return;
        }

        this.codiceFormato = formatoObj.codice;
        this.tipoLavorazione = formatoObj.tipo;

    },

    //TODO: trasferire nel cssFramework
    getEtichetteEsclusePerFixDescrizione() {
        return ["base*", "sfondo*"];
    },

//#endregion

//#region METODI IMPAGINAZIONE ed ESPORTAZIONE

    bindRefDataCompiled: function(box, oggetto, pathLavorazione, boxInGrigliaBounds) {
        try
        {
            if(this.tipoLavorazione == 1){

                //var res = this.getRefCompiledInBox_provvisorio(oggetto, box, boxInGrigliaBounds, pathLavorazione, []);
                var res = this.getRefCompiledInBox_Css(oggetto, box, boxInGrigliaBounds, pathLavorazione, []);
            }
            else{
                return box;
                var res = this.getRefCompiledInBox_provvisorioPOP(oggetto, box, pathLavorazione, []);
            }
        }
        catch (error) {
            console.error(error);
            return null;
        }

        return res[2];      
    },

    getRefCompiledInBox_Css(objItem, box, box_griglia_bounds, pathLavorazione = "", context = []) {

        this.contesto_promo = context;
        let myPage = box.parentPage;
        var area = this.area;
        var canale = this.canale;

        var livelli_meccanica = new Array();
        recInTrac = objItem.recordInTracciato;

        var meta_meccanica = this.parseMeccanica_provvisorioCompiled(objItem, objItem.allEtichette, canale);
        var tema = Utility.cercaChiaveContesto("tema", this.contesto_promo);
        var materiale = Utility.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        tema = tema == null ? "" : tema;
        var isMZLOC = ((tema.indexOf("LOC") >= 0 && materiale == "MZ") || objItem.allEtichette.includes("MZLOC"));

        var doc = docInLavorazione;


        var obj_da_cestinare = new Array();
        var fondoDaPosizionare = objItem["Foto.ExtraAuto"].find(f => f.tipo == 5);
        var meccanica = objItem.combinazioneAssegnata;

        for (var $xa = 0; $xa < box.allPageItems.length; $xa++) {
            try {
                var pItem = box.allPageItems[$xa];
                var nome_proprieta = pItem.label.replace("X_", "");

                if (nome_proprieta.indexOf("base") == 0) {

                    // if (objItem["Foto.ExtraAuto"].find(f => f.sigla.includes("piacersi")) != null && meccanica.indexOf("focus") < 0) {
                    //     if (canale == "SC") {
                    //         var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_Piacersi" };
                    //         meta_meccanica.azioni.push(a_eff);
                    //     }

                    //     if (canale != "SC") {
                    //         var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_Piacersi" };
                    //         meta_meccanica.azioni.push(a_eff);
                    //     }
                    // }

                    if (canale == "SC" && (meccanica.indexOf("_sdb") >= 0 || meccanica.indexOf("_bdp") >= 0)) {
                        if (meccanica.indexOf("_sdb") >= 0) {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_SDB" };
                            meta_meccanica.azioni.push(a_eff);
                        }
                        else if (meccanica.indexOf("_bdp") >= 0) {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_BDP" };
                            meta_meccanica.azioni.push(a_eff);
                        }
                    }else if (objItem["Foto.ExtraAuto"].find(f => f.sigla.includes("piacersi")) != null && meccanica.indexOf("focus") < 0) {
                        if (canale == "SC") {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_Piacersi" };
                            meta_meccanica.azioni.push(a_eff);
                        }

                        if (canale != "SC") {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_Piacersi" };
                            meta_meccanica.azioni.push(a_eff);
                        }
                    }

                    if (canale != "SC" && (meccanica.indexOf("_sdb") >= 0 || meccanica.indexOf("_bdp") >= 0)) {
                        if (meccanica.indexOf("_sdb") >= 0) {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_SDB" };
                            meta_meccanica.azioni.push(a_eff);
                        }
                        else if (meccanica.indexOf("_bdp") >= 0) {
                            var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_BDP" };
                            meta_meccanica.azioni.push(a_eff);
                        }
                    }

                    if (canale == "SC" && objItem.codiceBox.indexOf("BOX41") >= 0 && meccanica.indexOf("focus") < 0) {
                        var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_B&F" };
                        meta_meccanica.azioni.push(a_eff);
                    }

                    if (canale != "SC" && objItem.codiceBox.indexOf("BOX41") >= 0 && meccanica.indexOf("focus") < 0) {
                        var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_B&F" };
                        meta_meccanica.azioni.push(a_eff);
                    }

                    if (canale == "SC" && meccanica.indexOf("focus") < 0 && fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn") {
                        var a_eff = { tipo: "effect", campo_indd: "base", name: "base_A_VersoNatura" };
                        meta_meccanica.azioni.push(a_eff);
                    }

                    if (canale != "SC" && meccanica.indexOf("focus") < 0 && fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn") {
                        var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P_VersoNatura" };
                        meta_meccanica.azioni.push(a_eff);
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

                            if (mItem.strokeAlignment != null && mItem.strokeAlignment != pItem.strokeAlignment) {
                                pItem.strokeAlignment = mItem.strokeAlignment;
                            }
                        }
                        else if (mItem.tipo == "unplace") {
                            pItem.graphics.item(0).remove();
                        }
                        else if (mItem.tipo == "effect" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                            Utility.applyObjectStyle(doc, pItem, mItem.name);
                        }
                    }

                    if (objItem.codiceBox == "solo_descr") {
                        obj_da_cestinare.push(pItem);
                    }
                }
                else if (nome_proprieta == "immagine") {

                    if (objItem.codiceBox == "solo_descr") {
                        obj_da_cestinare.push(pItem);
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
                else {

                    color = "";
                    //Da vedere in funzione di eventuali opzioni binding nei meta della meccanica
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
                                Utility.applyObjectStyle(doc, pItem, mItem.name);
                            }
                            else if (mItem.tipo == "alignment" && nome_proprieta.startsWith(mItem.campo_indd) && nome_proprieta != "") {
                                var firstParagraph = pItem.paragraphs.item(0);
                                if (firstParagraph && firstParagraph.isValid) {
                                    if (mItem.align.toUpperCase() == "LEFT_ALIGN") {
                                        firstParagraph.justification = Justification.LEFT_ALIGN;
                                    }
                                    else if (mItem.align.toUpperCase() == "CENTER_ALIGN") {
                                        firstParagraph.justification = Justification.CENTER_ALIGN;
                                    }
                                    else if (mItem.align.toUpperCase() == "RIGHT_ALIGN") {
                                        firstParagraph.justification = Justification.RIGHT_ALIGN;
                                    }
                                }
                            }
                        }
                    }

                    if (fondoDaPosizionare != null && fondoDaPosizionare.sigla == "sfondo_vn" && nome_proprieta == "PIEDE_Titolari"
                        && objItem.combinazioneAssegnata.indexOf("focus") < 0
                    ) {
                        //resize del piede //andrebbe previsto nel css framework
                        var boundsPiede = pItem.geometricBounds;
                        boundsPiede[0] = boundsPiede[0] - 0.5;
                        boundsPiede[1] = boundsPiede[1] + 0.7;
                        boundsPiede[2] = boundsPiede[2] - 0.5;
                        boundsPiede[3] = boundsPiede[3] - 0.7;
                        pItem.geometricBounds = boundsPiede;
                    }

                }
            } catch (error) {
                messaggioUtente("Code CAG-01 Errore generico nel caricamento campo: " + nome_proprieta, "error");
                console.error("1624. " + error + " su " + nome_proprieta);
                console.error(error);
            }
        }

        //Loghi

        if (objItem["Foto.ExtraAuto"] != null) {
            for (var i = 0; i < objItem["Foto.ExtraAuto"].length; i++) {
                var extra = objItem["Foto.ExtraAuto"][i];
                if (extra.sigla == "logo_attributo_it" != null && extra.sigla == "logo_attributo_it") {
                    try {
                        if (extra.referenceTo != null) {
                            extra.referenceTo.textFrames.item(0).contents = objItem.logo_attributo_it.replace("<br>", "\n");
                        }
                    }
                    catch (error) {
                        //Dovrei mettere no_foto   
                        console.error("IDMS ERROR " + error.message);
                    }

                }
            }
        }

        return ["new", objItem, box];

    },

    parseMeccanica_provvisorioCompiled(objRef, allEtichette,canale) {

        var materiale = Utility.cercaChiaveContesto("materiale", this.contesto_promo);
        materiale = materiale == null ? "" : materiale;
        var tema = Utility.cercaChiaveContesto("tema", this.contesto_promo);
        tema = tema == null ? "" : tema;

        if (tema.indexOf("LOC") >= 0) {
            //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
            this.contesto_promo = this.assegnaNuovoValoreContesto("materiale", "VOL", this.contesto_promo);
            materiale = "VOL";
        }

        var meccanica = objRef.combinazioneAssegnata;
        var temaRef = objRef.tema.toLowerCase();
        var tipo_tema = objRef.tipo_tema.toLowerCase();
        var grafica_50al50 = allEtichette.includes("SEZ. 50 AL 50");
        var ISTITUZIONALE = allEtichette.includes("ISTITUZIONALE");
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
        // else if (meccanica.indexOf("_minicoll") > 0) {
        //     if (meccanica.indexOf("PUNTI_TP") < 0 && meccanica.indexOf("PERCENTO") < 0) {
        //         var a_p = { tipo: "pos", campo_indd: "descrizione", align: Justification.LEFT_ALIGN, absoluteX: 0 };
        //         obj.azioni.push(a_p);
        //     }
        // }
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

            // if (meccanica.indexOf("50al50") < 0 ) {
            //     if (canale != "SC") {
            //         var a_color4 = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
            //         obj.azioni.push(a_color4);
            //     }
            // }

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
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 3, strokeAlignment: StrokeAlignment.INSIDE_ALIGNMENT  };
                        obj.azioni.push(a_border);
                    }

                }
                else if (meccanica.indexOf("_sdb") >= 0) {
                    if (canale == "SC") {
                        var a_color = { tipo: "color", campo_indd: "rect_etto", colore: "righine-gabbie SCELTE di BENESSERE" };
                        obj.azioni.push(a_color);
                    }

                    if (tipo_tema.indexOf("focus") < 0) {
                        var a_border = { tipo: "border", campo_indd: "base", radius: 2, borderWidth: 3, strokeAlignment: StrokeAlignment.INSIDE_ALIGNMENT };
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

                // var a_color4 = { tipo: "color", campo_indd: "sconto_norm", colore: "Bianco" };
                // obj.azioni.push(a_color4);
                // var a_color5 = { tipo: "color", campo_indd: "sconto_fid", colore: "Bianco" };
                // obj.azioni.push(a_color5);
            }

            if (meccanica.indexOf("_sdb") > 0) {
                var a_color = { tipo: "color", campo_indd: "rect_tipico", colore: "righine-gabbie SCELTE di BENESSERE" };
                obj.azioni.push(a_color);

                var a_color2 = { tipo: "color", campo_indd: "base", colore: "righine-gabbie SCELTE di BENESSERE" };
                obj.azioni.push(a_color2);
            }

            // if (canale == "SC") {
            //     var a_color = { tipo: "color", campo_indd: "sy_euro", colore: "Bianco" };
            //     obj.azioni.push(a_color);
            // }
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
            
            if (!ISTITUZIONALE){

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

        if (objRef.codiceBox == "BOX14") {
            obj.azioni.push({ tipo: "alignment", campo_indd: "descrizione", align: "LEFT_ALIGN"});
        } 

        if (objRef.codiceBox == "BOX41" && (objRef.tipo_tema.toLowerCase() == "focus" || objRef.tipo_tema.toLowerCase() == "attivita di reparto")) {
            obj.azioni.push({ tipo: "unplace", campo_indd: "base"});
            obj.azioni.push({ tipo: "effect", campo_indd: "base", name: "base_focus_SC" });
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
            if (objRef.codiceBox != "BOX41" && objRef.codiceBox != "BOX40") {
                var a_eff = { tipo: "effect", campo_indd: "base", name: "base_P" };
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
        
        return obj;

    },

    //TODO: da deprecare e uniformare al core
    impaginazioneFotoExtraCustom(imgName, tipo, box, pathLavorazione, objItem, sigla){
        var doc = docInLavorazione;
        if (imgName.split(".")[1] == "idms") {
            var path = /*pathLavorazione +*/ percorsoLoghi + imgName;
            let syObj = null;
            if (simboli[sigla] == null || !simboli[sigla].isValid) {
                //Cerco in pagina 1 se ho già impaginato il simbolo
                var pag0 = doc.pages.item(0);
                for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                    var item = pag0.allPageItems[i2];
                    if (item.label == "simbolo$" + imgName + "$tipo_" + tipo) {
                        simboli[sigla] = item;
                        break;
                    }
                }

                if (simboli[sigla] == null || !simboli[sigla].isValid) {
                    let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                    objDms.label = "simbolo$" + imgName + "$tipo_" + tipo;
                    simboli[sigla] = objDms[0];
                }
            }
            syObj = simboli[sigla];
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

    //!non dovrebbe più servire poichè è l'esportazione ad occuparsene
    // applyCustomFilter(pItem, rootPath, $f, inxCriterio){
    //     var stringPath = rootPath + ".listFiltri[" + $f + "].Criteri[" + inxCriterio + "]";
    //     return stringPath + ".Chiave=tipo_volantino&" + stringPath + ".Operatore=0&" + stringPath + ".Valore=V - volantino&";
    // },


    setCustomFixFoto(box){

        if(ficoProcess.getTipoLavorazioneCorrente() != 1){
            return box;
        }

        const getElements = ["sy_euro", "sy_-", "sy_%", "sconto_fid", "prezzo_offerta", "campo_offerta_KgL_sconto", "campo_offerta", "prezzo_offerta_etto", "rect_etto","LBL_Titolari"];
        //duplichiamo il box
        if (box.label == "BOX40")
        {
            return box;
        }
        var res1 = CssFramework.getSpazioImpaginazione(box);
        if (box.label == "BOX14" || box.label == "BOX11"|| box.label == "BOX41") {
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
            return box;
        }

        var area1 = CssFramework.fixFoto(box, res1.candidate, res1.obstacles, true);


        var items = box.allPageItems;
        var minLeft = box.geometricBounds[3];
        var originalBoxBounds = box.geometricBounds;
        var descrizione = null;
        var piedeTitolari = null;
        var logoUsoAntibiotici = null;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.label == "descrizione" && box.label != "BOX7") {
                descrizione = item;
                continue;
            }
            else if (item.label == "gruppo_descrizione_BIS" && box.label == "BOX7") {
                descrizione = item;
                continue;
            }

            if(item.label.startsWith("PIEDE_Titolari")){
                piedeTitolari = item;
                continue;
            }

            if(item.label.includes("LOGO_carneS_USOdiANTIBIOTICI")){
                logoUsoAntibiotici = item;
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
            else{
                left = bounds[1];
            }
            if (left < minLeft) {
                minLeft = left;
            }
        }

        var oldBounds = null;

        //spostiamo la descrizione di modo che il suo bounds[2] sia uguale alla base del box e il suo bounds[3] sia uguale a minLeft
        if (descrizione != null && logoUsoAntibiotici == null) {
            oldBounds = descrizione.geometricBounds;
            var base = Utility.getFieldByLabel("base", box);
            if (base == null || !base.isValid) {
                return;
            }

            var stroke = base.strokeWeight;
            var inset = 0;
            if (stroke != null && stroke > 0) {
                try {
                    switch (base.strokeAlignment.toString()) {
                        case "INSIDE_ALIGNMENT":
                            inset = stroke;
                            break;
                        case "CENTER_ALIGNMENT":
                            inset = stroke / 2;
                            break;
                        case "OUTSIDE_ALIGNMENT":
                            inset = 0;
                            break;
                        default:
                            inset = stroke / 2;
                            break;
                    }
                } catch (e) {
                    // fallback prudente: in caso di valore non leggibile
                    inset = stroke / 2;
                }
    
                if (inset <= 0) {
                    return;
                }
    
                inset = inset * 0.352777778; // convertiamo da punti a mm (1pt = 0.352777778 mm)
            }

            var altezzaDes = descrizione.geometricBounds[2] - descrizione.geometricBounds[0];
            var larghezzaDes = descrizione.geometricBounds[3] - descrizione.geometricBounds[1];
            var newBounds = [];
            if (piedeTitolari != null) {
                var altezzaPiede = piedeTitolari.geometricBounds[2] - piedeTitolari.geometricBounds[0];
                newBounds = [box.geometricBounds[2] - altezzaDes - altezzaPiede - inset, minLeft - larghezzaDes, box.geometricBounds[2] - altezzaPiede - inset, minLeft];
            }
            else{
                newBounds = [box.geometricBounds[2]-altezzaDes - inset, minLeft-larghezzaDes, box.geometricBounds[2] - inset, minLeft];
            }
            descrizione.geometricBounds = newBounds;

            //controlliamo se la descrizione esce dai bounds originali del box
            var descrizioneFuoriBox = false;
            if (descrizione.geometricBounds[0] < originalBoxBounds[0] || descrizione.geometricBounds[1] < originalBoxBounds[1] || descrizione.geometricBounds[2] > originalBoxBounds[2] || descrizione.geometricBounds[3] > originalBoxBounds[3]) {
                descrizioneFuoriBox = true;
            }

            if (descrizioneFuoriBox) {
                var descrizioneDaRidurre = descrizione;
                if (box.label == "BOX7" && descrizione.allPageItems != null) {
                    for (var d = 0; d < descrizione.allPageItems.length; d++) {
                        var itemDescrizioneBox7 = descrizione.allPageItems[d];
                        if (itemDescrizioneBox7.label == "Descrizione") {
                            descrizioneDaRidurre = itemDescrizioneBox7;
                            break;
                        }
                    }
                }

                //se la descrizione esce dai bounds del box proviamo a ridurre i suoi bounds sinistri per metterli pari al box e controlliamo se va in oveflow
                var oldBoundsOverflow = descrizioneDaRidurre.geometricBounds;
                var newBoundsOverflow = [descrizioneDaRidurre.geometricBounds[0], originalBoxBounds[1], descrizioneDaRidurre.geometricBounds[2], descrizioneDaRidurre.geometricBounds[3]];
                descrizioneDaRidurre.geometricBounds = newBoundsOverflow;
                if (descrizioneDaRidurre.overflows) {
                    //ripristiniamo i bounds originali della descrizione
                    descrizioneDaRidurre.geometricBounds = oldBoundsOverflow;
                    descrizione.geometricBounds = oldBounds;
                    CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
                    return box;
                }
            }
        }
        else{
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
            return box;
        }

        var res2 = CssFramework.getSpazioImpaginazione(box);
        var area2 = CssFramework.fixFoto(box, res2.candidate, res2.obstacles, true);

        //teniamo il box con area maggiore, eliminiamo l'altro e poi restituiamo il box tenuto
        if (Math.floor(area1) >= Math.floor(area2)) {
            descrizione.geometricBounds = oldBounds;
            CssFramework.fixCollisioneTracciaBaseSingolo(box, descrizione);
            CssFramework.fixFoto(box, res1.candidate, res1.obstacles);
        }
        else {
            CssFramework.fixCollisioneTracciaBaseSingolo(box, descrizione);
            CssFramework.fixFoto(box, res2.candidate, res2.obstacles);
        }
        
        return box;
    },

    decodificaNomeFile(fullPath)
    {
        let sep="/";
        let platform=require('os').platform().toLowerCase();
        platform.indexOf("win") == 0 ? sep="\\" : sep="/";

        let tree=fullPath.split(sep);
        let folderContainer = tree[tree.length -2];
        let nomeFile = tree[tree.length -1];

        let macroSuddivisione =  nomeFile.split("_");
        let siglaFormato = macroSuddivisione[0];
        let ca=macroSuddivisione[1];
        if (macroSuddivisione[0]=="A4")
        {
            if (macroSuddivisione[1]=="FLUSSO2")
            {
                siglaFormato+=("_"+macroSuddivisione[1]);
                ca=macroSuddivisione[2];
            }
        }

        let siglaCanale = ca.substring(0,2);
        let siglaArea = ca.substring(2,4);
        
        return {
            nomePromo:folderContainer, 
            siglaFormato:siglaFormato,
            siglaCanale:siglaCanale,
            siglaArea:siglaArea
        };
    },
    //#endregion
};


//const customAgenzia = new Agenzia("customAgenzia");
module.exports = customAgenzia;
