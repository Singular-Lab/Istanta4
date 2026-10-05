/// Il motore di confronto: quello che c'e' nel documento InDesign messo a fianco di quello che
/// dice il dato.
///
///   confrontoBox                         due box a confronto: porta nel box nuovo quello che
///                                        l'operatore aveva cambiato a mano in quello vecchio
///   confrontoBoxCompiledFieldPreAnalisi  un box e i suoi record: cosa non corrisponde piu'
///   mappaturaImpaginato                  la mappa di cio' che e' impaginato, pagina per pagina
///   semplificazioneMappaImpaginato       la stessa mappa ridotta a quello che chiede il server
///   decodeSpecialCharacters              i caratteri speciali del testo InDesign
///
/// Lo usano il cambio strutturale e la reimpaginazione di una referenza, la scheda, il
/// ricalcolo del conteggio della griglia, il ricollegamento delle foto e il Report Integrita'.
///
/// I20-1014: fino ad allora questo file era anche il Report Integrita', con tutta la sua
/// interfaccia: 7.443 righe. Il report e' uscito in plugin/reportIntegrita/, e qui e' rimasto
/// il motore, che non usa niente del report.

const RicollegaEsiti = require('./ricollegaEsiti');
const fs = require('fs');
const NoRenderElementi = require('./noRenderElementi');

/// I20-1046: gli elementi del box che decidono le regole e non l'operatore: la base (e gli altri
/// campi base*, a cui il custom del cliente da' lo stile oggetto del formato) e i loghi e gli sfondi
/// automatici (foto_extra$..., sfondo$...), che si vedono o no secondo il record. Dopo un cambio
/// strutturale per questi valgono visibilita' e stile oggetto del box nuovo.
function elementoDecisoDalleRegole(etichetta) {
    var e = String(etichetta == null ? "" : etichetta);
    if (e.indexOf("X_") == 0) {
        e = e.substring(2);
    }
    return e.indexOf("base") == 0 || e.indexOf("foto_extra$") == 0 || e.indexOf("sfondo$") == 0;
}

const confronti = {
    /// Guarda un box impaginato e dice cosa non corrisponde piu' al dato del
    /// server: e' il confronto vero, quello da cui nascono le segnalazioni.
    async confrontoBox(box1, box2, forzaReimpaginazione = false){ //mode 0 -> cambio strutturale, mode 1 -> confrontoMassivo
        try {

            let useBox2 = false;
            let box2CampiEsclusivi = [];
            let box2campi = box2.allPageItems.filter(campo => campo.isValid);
            let box2CampiLabels = box2campi.map(campo => Utility.parseLabel(campo.label));
            
            
            //duplichiamo il box1 nella stessa identica posizione
            let box1Duplicate = box1.duplicate();
            //i due box sono gruppi, facciamo una mappatura dei campi tramite label, i campi presenti solo nel primo box vengono messi in una lista chiamata box1CampiEsclusivi e viceversa
            let box1CampiEsclusivi = [];
            let box1campi = box1Duplicate.allPageItems.filter(campo => campo.isValid);
            let box1CampiLabels = box1campi.map(campo => Utility.parseLabel(campo.label));
            let listCampiConDifferenze = [];
            box1campi.forEach(campo => {
                if(!campo.isValid || campo.label == ""){
                    return;
                }
                if (!box2CampiLabels.includes(Utility.parseLabel(campo.label))) {
                    box1CampiEsclusivi.push(campo);
                }
            });
            box2campi.forEach(campo => {
                if(!campo.isValid || campo.label == ""){
                    return;
                }
                if (!box1CampiLabels.includes(Utility.parseLabel(campo.label))) {
                    box2CampiEsclusivi.push(campo);
                }
            });

            //per ora creiamo dei console log in questi risultati
            //I box hanno tutti campi identici
            //Il box 2 ha campi esclusivi
            //Il box 1 ha campi esclusivi

            if (box1CampiEsclusivi.length == 0 && box2CampiEsclusivi.length == 0) {
                console.log("I box hanno tutti campi identici");
            }

            if (box1CampiEsclusivi.length > 0) {
                console.log("Il box 1 ha i seguenti campi esclusivi:");
                box1CampiEsclusivi.forEach(campo => {
                    if(!campo.isValid){
                        return;
                    }
                    console.log(campo.label);
                });
            }

            if (box2CampiEsclusivi.length > 0) {
                console.log("Il box 2 ha i seguenti campi esclusivi:");
                box2CampiEsclusivi.forEach(campo => {
                    if(!campo.isValid){
                        return;
                    }
                    console.log(campo.label);
                });
            }

            let box1Rimosso = false;

            if (box1Duplicate.label == box2.label && !forzaReimpaginazione) {
                //se tutti i campi sono comuni
                box1campi.forEach(campo => {
                    if (!campo.isValid || campo.label == "") {
                        return;
                    }
                    campoBox2 = box2campi.find(campo2 => campo2.isValid && Utility.parseLabel(campo2.label) == Utility.parseLabel(campo.label));
                    if (campoBox2 == undefined) {
                        return;
                    }

                    //I20-1046: visibilita' e stile oggetto della base e dei loghi e sfondi automatici
                    //li decidono le regole: vale il box nuovo, e la differenza conta come le altre, quindi
                    //il box vecchio resta come clone. Prima il confronto guardava solo testi, stili di
                    //paragrafo e immagini: la forzatura di Artisti della Qualita' (base ADQ, logo e sfondo
                    //del Buono del Paese nascosti) spariva con il box nuovo, e il clone non c'era.
                    if (elementoDecisoDalleRegole(campo.label)) {
                        let cambiatoDalleRegole = false;
                        if (campo.visible !== campoBox2.visible) {
                            campo.visible = campoBox2.visible;
                            cambiatoDalleRegole = true;
                        }
                        let stileVecchio = campo.appliedObjectStyle != null && campo.appliedObjectStyle.isValid ? campo.appliedObjectStyle.name : null;
                        let stileNuovo = campoBox2.appliedObjectStyle != null && campoBox2.appliedObjectStyle.isValid ? campoBox2.appliedObjectStyle.name : null;
                        if (stileNuovo != null && stileNuovo !== stileVecchio) {
                            campo.appliedObjectStyle = campoBox2.appliedObjectStyle;
                            cambiatoDalleRegole = true;
                        }
                        if (cambiatoDalleRegole && listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null) {
                            listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                        }
                    }

                    //controlliamo il costruttore per decidere come agire, quelli che ci interessano sono textFrames e rectangles
                    if (campo.constructorName == "TextFrame") {
                        if (campo.contents != campoBox2.contents) {
                            campo.contents = "";
                            campo.contents = campoBox2.contents;

                            for (let c=0; c<campo.characters.length; c++){
                                campo.characters.item(c).appliedCharacterStyle = campoBox2.characters.item(c).appliedCharacterStyle;
                            }
                            
                            if(listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null){
                                listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                            }
                        }

                        //facciamo un controllo se il testo del box1 è ora in overflow, se lo è cambiamo i geometric bound di modo che sia uguale a quelli del box2
                        if (campo.overflows) {
                            campo.geometricBounds = campoBox2.geometricBounds;
                        }

                        //controlliamo lo stile di paragrafo, se è diverso lo cambiamo
                        if (campo.paragraphs.length > 0 && campoBox2.paragraphs.length > 0 && campo.paragraphs.item(0).appliedParagraphStyle.name != campoBox2.paragraphs.item(0).appliedParagraphStyle.name) {
                            campo.paragraphs.item(0).appliedParagraphStyle = campoBox2.paragraphs.item(0).appliedParagraphStyle;
                            if(listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null){
                                listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                            }
                        }
                        else if (campo.paragraphs.length > 0 && campoBox2.paragraphs.length == 0) {
                            campo.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.itemByName("None");
                            if(listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null){
                                listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                            }
                        }
                    }
                    else if (campo.constructorName == "Rectangle") {
                        //controlliamo se ci sono immagini, se ci sono controlliamo che abbiano lo stesso path
                        if (campo.graphics.length > 0 && campoBox2.graphics.length > 0 && campo.graphics.item(0).itemLink.filePath != campoBox2.graphics.item(0).itemLink.filePath) {
                            campo.place(campoBox2.graphics.item(0).itemLink.filePath);
                            if(listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null){
                                listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                            }
                        }
                        else if (campo.graphics.length > 0 && campoBox2.graphics.length == 0) {
                            campo.graphics.everyItem().remove();
                            if(listCampiConDifferenze.find(c => c == Utility.parseLabel(campo.label)) == null){
                                listCampiConDifferenze.push(Utility.parseLabel(campo.label));
                            }
                        }
                    }
                });

                var key = requireKeyForGarbage();

                // if (box1CampiEsclusivi.length != 0 && box2CampiEsclusivi.length != 0) {
                //     var baseBox1 = box1CampiEsclusivi.find(campo1 => campo1.isValid && campo1.label.startsWith("base"));
                //     var baseBox2 = box2CampiEsclusivi.find(campo2 => campo2.isValid && campo2.label.startsWith("base"));

                //     if (baseBox1 != undefined && baseBox2 != undefined) {
                //         baseBox1.label = baseBox2.label;
                //     }
                //     //rimuoviamo le basi dai due boxCampiEsclusivi
                //     box1CampiEsclusivi = box1CampiEsclusivi.filter(campo => campo.isValid && !campo.label.startsWith("base"));
                //     box2CampiEsclusivi = box2CampiEsclusivi.filter(campo => campo.isValid && !campo.label.startsWith("base"));
                // }
                
                if (box1CampiEsclusivi.length != 0){
                    box1CampiEsclusivi.forEach(campo => {
                        if(!campo.isValid){
                            return;
                        }
                        // var myColor = docInLavorazione.colors.itemByName("Red");
                        // if (myColor == null || myColor.isValid == false) {
                        //     myColor = docInLavorazione.colors.add({ name: "Red", model: ColorModel.process, colorValue: [0, 100, 20, 20] });
                        // }
                        // campo.fillColor = myColor;
                        addToGarbageCollector(campo);
                    });
                }
                var listDuplicati = [];
                var elementiDaRimuovere = [];
                if (box2CampiEsclusivi.length != 0) {                
                    //scorriamo ogni singolo campo esclusivo, lo duplichiamo, lo inseriamo in lista e lo coloriamo di verde
                    box2CampiEsclusivi.forEach(campo => {
                        if(useBox2 || !campo.isValid || campo.label == ""){
                            return;
                        }

                        var nomeElementoOriginale = Utility.parseLabel(campo.label);

                        //controlliamo la profondità a cui si trova l'elemento risalendo la gerarchia fino a trovare il box, il box è quello il cui parent è la spread
                        var parent = campo.parent;
                        while (parent.constructor.name != "Spread") {
                            parent = parent.parent;
                            if(parent.constructor.name != "Spread"){
                                campo = campo.parent;
                            }
                        }

                        //controlliamo che il campo non sia già stato duplicato e inserito nella lista
                        if (listDuplicati.find(campoDuplicato => campoDuplicato.isValid && Utility.parseLabel(campoDuplicato.label) == Utility.parseLabel(campo.label)) != undefined) {
                            return;
                        }

                        //cerchiamo il campo nel box1Campi e se lo troviamo lo aggiungiamo alla lista elementiDaRimuovere
                        var campoDaRimuovere = box1campi.find(campo1 => campo1.isValid && Utility.parseLabel(campo.label) != "" && Utility.parseLabel(campo1.label) == Utility.parseLabel(campo.label));
                        if (campoDaRimuovere != undefined) {
                            elementiDaRimuovere.push(campoDaRimuovere);
                        }
                        else if(campo.label == ""){
                            console.error("Il gruppo padre di "+nomeElementoOriginale+" non può essere modificato in quanto privo di EtichettaScript, verrà usato il nuovo impaginato, valutare il campionamento del campo se si vuole mantenere le modifiche di lavorazione del box originale.")
                            messaggioUtente("Code CNF-001 - Il contenitore dell'elemento non può essere modificato in quanto privo di etichetta. Verrà usato il nuovo impaginato, valutare il campionamento del campo se si vuole mantenere le modifiche di lavorazione del box originale.", "warning", false, 3);
                            useBox2 = true;
                        }

                        newCampo = campo.duplicate();
                        // var myColor = docInLavorazione.colors.itemByName("Green");
                        // if (myColor == null || myColor.isValid == false) {
                        //     myColor = docInLavorazione.colors.add({ name: "Green", model: ColorModel.process, colorValue: [100, 0, 100, 0] });
                        // }
                        // newCampo.fillColor = myColor;
                        listDuplicati.push(newCampo);

                        //calcoliamo la posizione relativa del newCampo rispetto al box 2
                        //var posizioneRelativa = [newCampo.geometricBounds[1] - box2.geometricBounds[1], newCampo.geometricBounds[0] - box2.geometricBounds[0]];

                        //muoviamo il newCampo sull'angolo in alto a sinistra di box1duplicate e poi lo spostiamo nella posizione relativa
                        //newCampo.move(undefined, [box1Duplicate.geometricBounds[0] - newCampo.geometricBounds[0] + posizioneRelativa[0], box1Duplicate.geometricBounds[1] - newCampo.geometricBounds[1] + posizioneRelativa[1]]);

                    });

                    if(!useBox2){
                        //rimuoviamo gli elementi da rimuovere usando un ciclo for contrario
                        for (let i = elementiDaRimuovere.length - 1; i >= 0; i--) {
                            elementiDaRimuovere[i].remove();
                        }
    
                        //sgruppiamo il boxDuplicato e aggiungiamo i campi duplicati

                        
                        var oldLabel = box1Duplicate.label;
                        var newItems = [box1Duplicate].concat(listDuplicati);
                        var newGroup = box1Duplicate.parentPage.groups.add(newItems);
                        box1Duplicate.ungroup();
                        newGroup.label = oldLabel;
                        box1Duplicate = newGroup;

    
                        // let page = box1Duplicate.parentPage;
                        // var oldGroup = box1Duplicate;//field.parent;
                        // var oldLabel = oldGroup.label;
                        // var oldItems = oldGroup.pageItems.everyItem().getElements();
                        // oldGroup.ungroup();
    
                        // var newItems = oldItems.concat(listDuplicati);
                        // var newGroup = page.groups.add(newItems);
                        // //photo.sendToBack();
                        // newGroup.label = oldLabel;
                        // box1Duplicate = newGroup;
                    }
                }

                if(!useBox2){
                    //se ci sono differenze tra i due box chiamiamo la funzione di utility addBollino
                    if (box1CampiEsclusivi.length != 0 || box2CampiEsclusivi.length != 0) {
                        //box1Duplicate = Utility.addBollinoCustom(box1Duplicate, "Dif", "orange", null, 1, null);
                    }
                    else{
                        if (pluginMiddleware.getCampo("listCampiConfrontoBypass") !== null){
                            //controlliamo se tutti i campi contenuti in listCampiConDifferenze sono presenti in listCampiConfrontoBypass
                            //se lo sono rimuoviamo il box 1
                            let tuttiCampiBypassati = true;
                            listCampiConDifferenze.forEach(campo => {
                                if (!pluginMiddleware.getCampo("listCampiConfrontoBypass").includes(campo)) {
                                    tuttiCampiBypassati = false;
                                    return;
                                }
                            });
                            if (tuttiCampiBypassati) {
                                box1.remove();
                                box1Rimosso = true;
                            }
                            else{
                                //box1 = Utility.addBollinoCustom(box1, "Dif", "orange", null, 1, null);
                            }
                        }
                        else{
                            if(listCampiConDifferenze.length == 0){
                                box1.remove();
                                box1Rimosso = true;
                            }else{
                                //box1Duplicate = Utility.addBollinoCustom(box1Duplicate, "Dif", "orange", null, 1, null);                    
                            }
                        }
                    }

                    box2.remove();

                }
                else{
                    box2.select();
                    box1Duplicate.remove();
                    //box2 = Utility.addBollinoCustom(box2, "Dif", "orange", null, 1, null);
                }


                activateKeyForGarbage(key);
            }
            else{
                //muoviamo il box1 in alto a sinistra di 10 px poi selezioniamo il box 2
                box2.select();
                box1Duplicate.remove();
                //box2 = Utility.addBollinoCustom(box2, "Dif", "orange", null, 1, null);
            }

            if (!box1Rimosso) {
                box1.move(undefined, [10, -10]);
                if (docInLavorazione.layers.itemByName("cloneVecchioImpaginato") == null || !docInLavorazione.layers.itemByName("cloneVecchioImpaginato").isValid) {
                    docInLavorazione.layers.add({ name: "cloneVecchioImpaginato" });
                    //assicuriamoci che il layer "cloneVecchioImpaginato" sia prima del layer InPagina di modo che sia visualizzato sopra
                    let inPaginaLayer = docInLavorazione.layers.itemByName("InPagina");
                    if (inPaginaLayer != null && inPaginaLayer.isValid) {
                        docInLavorazione.layers.itemByName("cloneVecchioImpaginato").move(LocationOptions.before, inPaginaLayer);
                    }
                }
                box1.itemLayer = docInLavorazione.layers.itemByName("cloneVecchioImpaginato");
            }
        } catch (error) {
            console.error(error);
        }
    },

    //elementiNoRender: elenco degli elementi che l'operatore ha messo in noRender (I20-968).
    //Un elemento marcato e poi cancellato dai livelli non e' un file perso: va detto, non gridato.
    /// Il confronto fatto sui campi gia' compilati, senza rileggere il box:
    /// e' la via veloce, usata quando la pre-analisi ha gia' raccolto tutto.
    /// checkMD5 a false salta il confronto degli hash delle foto, che e' la parte cara.
    async confrontoBoxCompiledFieldPreAnalisi(box1, compiledFields, deletedFields, listFoto, fotoExtra, fotoExtraAuto, checkMD5 = true, elementiNoRender = null, itemRef = null) { //mode 0 -> cambio strutturale, mode 1 -> confrontoMassivo
        let differenze = [];
        let errors = [];
        let me = this;
        try {
            //compiled fields è un array di oggetti con le proprietà label, content, labelName e paragraphName
            //content: "al kg da € 21,75 a € 17,32"
            //labelName: "campo_offerta_KgL_sconto"
            //paragraphName: "PREZ_CampoOfferta_KgL_SC"
            //deletedFields è un array di stringhe con le label dei campi da eliminare

            //nella pre analisi dobbiamo fare due cose:
            //1. controllare se i campi compilati sono presenti nel box1 e se sono con lo stesso contenuto e lo stesso stile di paragrafo/carattere 
            // (se paragraphName name è null o "" c'è lo stile di carattere in forma <stileCarattere>content</stileCarattere> nel content, potenzialmente anche più di uno)
            //2. controllare se nel box1 sono presenti i campi eliminati dai deletedFields

            //alla fine torniamo un oggetto con le proprità:
            // - differenze: un array di label dei campi che hanno differenze (sia se hanno valori diversi o stili diversi, sia se nel box sono presenti ma appaiono anche nei deletedFields)
            // - errors: un array di stringhe con gli errori riscontrati durante la pre analisi

            let box1campi = box1.allPageItems.filter(campo => campo.isValid);
            //var base =  Utility.getFieldByLabel("base", box1);
            let listFotoBox1 = [];
            let listFotoExtraBox1 = [];
            //controlliamo se i campi compilati sono presenti nel box1 e se sono con lo stesso contenuto e lo stesso stile di paragrafo/carattere
            compiledFields.forEach(compiledField => {
                if (!compiledField.labelName || compiledField.labelName == "") {
                    errors.push("Il campo compilato " + compiledField.label + " non ha un labelName valido");
                    return;
                }
                let campoBox1 = box1campi.find(campo => campo.isValid && Utility.parseLabel(campo.label) == Utility.parseLabel(compiledField.labelName));
                if (campoBox1 == undefined) {
                    //se il campo compilato non è presente nel box1 allora lo aggiungiamo alle differenze
                    var labelCampo = Utility.parseLabel(compiledField.labelName);
                    var classificatoCampo = NoRenderElementi.classificaLabel(labelCampo);
                    //Un elemento in noRender che non c'e' piu' e' un'assenza voluta: non si segnala.
                    if (NoRenderElementi.daSegnalareComeMancante(elementiNoRender, classificatoCampo.tipo, classificatoCampo.chiave)) {
                        differenze.push({ label: labelCampo, difference: "non presente" });
                    }
                    return;
                }

                if (campoBox1.constructorName == "TextFrame") {
                    //controlliamo il contenuto del campo compilato e quello del campo nel box1
                    if (campoBox1.contents != compiledField.content && compiledField.paragraphName && compiledField.paragraphName != "") {
                        //prima di dire che è diverso togliamo tutti gli spazi e tutti i ritorni a capo e confrontiamo i due contenuti
                        let contentBox1 = campoBox1.contents.replace(/<br\s*\/?>|\s+|\n/gi, '');
                        let contentCompiled = compiledField.content.replace(/<br\s*\/?>|\s+|\n/gi, '');
                        if (contentBox1 != contentCompiled) {
                            differenze.push({ label: Utility.parseLabel(compiledField.labelName), difference: "contenuto" });
                        }
                    }
                    //controlliamo lo stile di paragrafo/carattere
                    if (compiledField.paragraphName && compiledField.paragraphName != "") {
                        //se il campo compilato ha un paragrafo allora controlliamo che sia lo stesso del campo nel box1

                        var stile = TestoTag.parseStile(compiledField.paragraphName, true);

                        if (campoBox1.paragraphs.length > 0 && (stile != null && stile.isValid ? stile.name : compiledField.paragraphName) != campoBox1.paragraphs.item(0).appliedParagraphStyle.name) {
                            differenze.push({ label: Utility.parseLabel(compiledField.labelName), difference: "paragrafo" });
                        }
                    }
                    else {
                        //se il campo compilato non ha un paragrafo allora controlliamo che lo stile di carattere sia lo stesso del campo nel box1
                        //i characterStyle sono in forma <stileCarattere>content</stileCarattere><stileCarattere>content</stileCarattere>...
                        //dobbiamo intanto controllare il content del campoBox1 che sarà un textframe e ricostruire la stringa in forma <tag>content</tag><tag>content</tag>... per poi confrontarla con il content del campo compilato
                        let stringaRicomposta = "";
                        let currentCharacterStyle = null;

                        //I20-995: il campo si legge a tratti di stile invece che carattere per
                        //carattere. Prima ogni carattere costava due passaggi verso InDesign -
                        //l'oggetto e il nome del suo stile - e questa preanalisi gira a ogni
                        //apertura di scheda e per ogni referenza del Report Integrita'.
                        //
                        //Il testo si scorre ancora carattere per carattere, ma in memoria: il
                        //tag si apre sul primo carattere che conta davvero, e un tratto fatto di
                        //soli spazi non ne apre nessuno, esattamente come prima.
                        let trattiDelCampo = TestoTag.trattiDiStileDelCampo(campoBox1);

                        for (let t = 0; t < trattiDelCampo.length; t++) {
                            let styleName = trattiDelCampo[t].nome;
                            let testoDelTratto = trattiDelCampo[t].contenuto;

                            for (let i = 0; i < testoDelTratto.length; i++) {
                                let carattere = testoDelTratto[i];
                                let chParsed = me.decodeSpecialCharacters(carattere);
                                //se il character content non è una stringa continua
                                if ((typeof chParsed !== 'string' && typeof carattere !== 'string') || chParsed.trim() === '') {
                                    continue;
                                }
                                else if (typeof chParsed !== 'string') {
                                    chParsed = chParsed.contents;
                                }

                                if (styleName !== currentCharacterStyle) {
                                    if (currentCharacterStyle != null) {
                                        stringaRicomposta += `</${currentCharacterStyle}>`;
                                    }
                                    currentCharacterStyle = styleName;
                                    stringaRicomposta += `<${currentCharacterStyle}>`;
                                }

                                // Aggiungi il testo normale
                                stringaRicomposta += chParsed;
                            }
                        }

                        // Chiudi l’ultimo tag aperto
                        if (currentCharacterStyle != null) {
                            stringaRicomposta += `</${currentCharacterStyle}>`;
                        }
                        //ora controlliamo se la stringa ricomposta è uguale al content del campo compilato
                        //prima di confrontare togliamo tutti gli spazi e i ritorni a capo
                        stringaRicomposta = stringaRicomposta
                            .replace(/[’']/g, "'")
                            .replace(/°/g, '')
                            .replace(/<br\s*\/?>|\s+|\n/gi, '');
                        let stringaConfronto = compiledField.content
                            .replace(/[’']/g, "'")
                            .replace(/°/g, '')
                            .replace(/<br\s*\/?>|\s+|\n/gi, '');
                        //la stringaConfronto sarà in una forma tipo questa
                        //                         "<DICITURA_Rep_21>Reparto Surgelati</DICITURA_Rep_21>
                        //                          <A.DES_descr_nome_SC>Barattolino  Delizie</A.DES_descr_nome_SC>
                        //                          <A.DES_descr_marca_SC>Sammontana</A.DES_descr_marca_SC>
                        //                          <A.DES_descr_tipo_SC>panna cotta variegato al gusto mou con granella di croccante di mandorle</A.DES_descr_tipo_SC>
                        //                          <A.DES_descr_gr_SC>500 g</A.DES_descr_gr_SC>"
                        // noi prima di poterla confrontare dobbiamo usare il parseStile per aggiustare i tag, ad esempio passando al parseStile A.DES_descr_nome_SC riceveremo lo stile di carattere corrispondente
                        //e leggendo il nome dello stile ricevuto possiamo sostituire il tag <A.DES_descr_nome_SC> con il nome dello stile di carattere (che sarà uguale senza A.)
                        let tagRegex = /<([^>]+)>/g;
                        let match;

                        //cerchiamo se esistono tag con _$Hidden e in caso li togliamo dalla stringa confronto con tutto il loro contenuto
                        let hiddenTagRegex = /<([^>]*_\$Hidden)>/g;
                        let hiddenMatch;

                        while ((hiddenMatch = hiddenTagRegex.exec(stringaConfronto))) {
                            let hiddenTagName = hiddenMatch[1];

                            let escapedTagName = hiddenTagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                            let hiddenContentRegex = new RegExp(`<${escapedTagName}>.*?</${escapedTagName}>`, 'g');

                            stringaConfronto = stringaConfronto.replace(hiddenContentRegex, '');
                        }

                        while (match = tagRegex.exec(stringaConfronto)) {
                            let tagName = match[1];
                            let stile = TestoTag.parseStile(tagName);
                            if (stile != null && stile.isValid) {
                                stringaConfronto = stringaConfronto.replace(new RegExp(`<${tagName}>`, 'g'), `<${stile.name}>`);
                                stringaConfronto = stringaConfronto.replace(new RegExp(`</${tagName}>`, 'g'), `</${stile.name}>`);
                            }
                        }

                        //facciamo un ultimo controllo sulle due stringhe, se le stringhe contengono stili che si aprono e si chiudono senza contenuto togliamo quello stile
                        let emptyTagRegex = /<([^>]+)><\/\1>/g;
                        stringaRicomposta = stringaRicomposta.replace(emptyTagRegex, '');
                        stringaConfronto = stringaConfronto.replace(emptyTagRegex, '');

                        if (stringaRicomposta != stringaConfronto) {
                            differenze.push({ label: compiledField.labelName, difference: "contenuto" });
                        }
                    }
                }
            });

            //cataloghiamo le foto presenti nel box1
            const risultati = await Promise.all(
                box1campi.map(async campo => {
                    if (campo.constructorName !== "Rectangle") return null;

                    //I20-1022: il clone della primaria non e' una foto del dato, e' nato nel documento:
                    //contarlo farebbe sembrare il box diverso da quello che dice il server.
                    if (Utility.eUnClone(campo.label)) return null;

                    if (
                        Utility.parseLabel(campo.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") ?? "immagine") ||
                        Utility.parseLabel(campo.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") ?? "foto_secondaria")
                    ) {
                        if (campo.graphics.length > 0) {
                            let fullPath = campo.graphics.item(0).itemLink.filePath;
                            let nomeFile = fullPath.split("/").pop();

                            if (checkMD5){
                                const res = await ReperimentoFoto.getLinkHash(campo);
    
                                return {
                                    tipo: "principale",
                                    data: {
                                        nomeFoto: nomeFile,
                                        hash: res.hash,
                                        mismatch: res.mismatch,
                                        missing: res.missing
                                    }
                                };
                            }
                            else{
                                return {
                                    tipo: "principale",
                                    data: {
                                        nomeFoto: nomeFile
                                    }
                                };
                            }
                        }
                    }

                    if (Utility.parseLabel(campo.label).startsWith("foto_extra") || Utility.parseLabel(campo.label).startsWith("sfondo$")) {
                        if (campo.graphics.length > 0) {
                            let fullPath = campo.graphics.item(0).itemLink.filePath;
                            let nomeFile = fullPath.split("/").pop();

                            return {
                                tipo: "extra",
                                data: nomeFile
                            };
                        }
                    }

                    return null;
                })
            );

            // separazione pulita
            listFotoBox1 = risultati
                .filter(x => x?.tipo === "principale")
                .map(x => x.data);

            listFotoExtraBox1 = risultati
                .filter(x => x?.tipo === "extra")
                .map(x => x.data);

            //controlliamo se nel box1 sono presenti i campi eliminati dai deletedFields
            deletedFields.forEach(deletedField => {
                if (!deletedField || deletedField == "") {
                    errors.push("Il campo eliminato " + deletedField + " non ha un label valido");
                    return;
                }
                let campoBox1 = box1campi.find(campo => campo.isValid && Utility.parseLabel(campo.label) == Utility.parseLabel(deletedField));
                if (campoBox1 != undefined) {
                    //se il campo eliminato è presente nel box1 allora lo aggiungiamo alle differenze
                    differenze.push({ label: Utility.parseLabel(deletedField), difference: "eliminato" });
                }
            });

            //controlliamo se le foto nel box1 sono le stesse di quelle in listFoto
            if (listFoto && listFoto.length > 0) {
                listFoto.forEach(foto => {
                    if (foto.nomeFoto != "" && listFotoBox1.find(f => f.nomeFoto == foto.nomeFoto) == undefined) {
                        if (NoRenderElementi.daSegnalareComeMancante(elementiNoRender, NoRenderElementi.TIPO_FOTO, foto.nomeFoto)) {
                            differenze.push({ label: foto.nomeFoto, difference: "foto mancante nel box: " + foto.nomeFoto });
                        }
                        //controlliamo se la foto c'è nella cartella di lavorazione
                        var path = /*pathLavorazione +*/ percorsoLinks + foto.nomeFoto;
                        try{
                            var fileBuffer = fs.readFileSync(path);
                        }
                        catch{
                            differenze.push({ label: foto.nomeFoto, difference: "foto mancante nella cartella di lavorazione: " + foto.nomeFoto });
                        }
                    }
                    else {
                        if (checkMD5) {
                            var fotoCorrispondente = listFotoBox1.find(f => f.nomeFoto == foto.nomeFoto);
                            if(fotoCorrispondente != null){
                                var fotoCorrispondenteHash = fotoCorrispondente && fotoCorrispondente.hash ? fotoCorrispondente.hash.toUpperCase() : null;
                                var fotoHash = foto.hash ? foto.hash.toUpperCase() : null;
                                if (fotoCorrispondente.mismatch || fotoHash != fotoCorrispondenteHash) {
                                    differenze.push({ label: foto.nomeFoto, difference: "foto non corrispondente nel box: " + foto.nomeFoto });
                                }
                                if (fotoCorrispondente.missing) {
                                    differenze.push({ label: foto.nomeFoto, difference: "foto mancante nella cartella di lavorazione: " + foto.nomeFoto });
                                }
                            }
                        }
                        else {
                            var path = /*pathLavorazione +*/ percorsoLinks + foto.nomeFoto;
                            try {
                                var fileBuffer = fs.readFileSync(path);
                            }
                            catch {
                                differenze.push({ label: foto.nomeFoto, difference: "foto mancante nella cartella di lavorazione: " + foto.nomeFoto });
                            }
                        }
                    }
                });
                listFotoBox1.forEach(foto => {
                    let noFoto = false;
                    if (foto == (pluginMiddleware.getCampo("nomeNoFoto") ? pluginMiddleware.getCampo("nomeNoFoto") : "nofoto.png")) {
                        noFoto = true;
                    }
                    if ((!noFoto && !listFoto.find(f => f.nomeFoto == foto.nomeFoto)) || (noFoto && !listFoto.find(f => f.nomeFoto == ""))) {
                        differenze.push({ label: foto.nomeFoto, difference: "foto in più nel box: " + foto.nomeFoto });
                    }
                });
            }

            if (fotoExtra && fotoExtra.length > 0) {
                fotoExtra.forEach(foto => {
                    let fotoCorrispondente = listFotoExtraBox1.find(f => f == foto.nome);
                    if (fotoCorrispondente == undefined) {
                        //la foto la cerchiamo perchè anche se non è attiva potrebbe esserci, ma se non c'è non è un errore
                        if (!foto.attiva) {
                            return;
                        }
                        var tipoExtra = foto.tipo == 3 ? NoRenderElementi.TIPO.logo : NoRenderElementi.TIPO.fotoExtra;
                        if (NoRenderElementi.daSegnalareComeMancante(elementiNoRender, tipoExtra, foto.sigla)) {
                            differenze.push({ label: foto.nome, difference: "foto extra mancante nel box: " + foto.nome });
                        }
                    }
                    else {
                        //togliamo la foto dalla lista
                        listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != fotoCorrispondente);
                    }
                });
            }

            if (fotoExtraAuto && fotoExtraAuto.length > 0) {
                //I20-1026: un logo che la regola disattiva del framework CSS vuole fuori da questo box
                //non e' mancante, e se c'e' ancora lo togliera' il prossimo fix: non si segnala.
                var disattivatiDallaForma = itemRef != null && typeof CssFramework !== "undefined"
                    ? CssFramework.disattivatiDallaForma(box1, itemRef, box1.geometricBounds).disattivati
                    : new Set();
                fotoExtraAuto.forEach(foto => {
                    if (disattivatiDallaForma.has(foto.sigla)) {
                        listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != foto.nome && f != foto.sigla);
                        return;
                    }
                    if(foto.nome.includes(".idms")){
                        //cerchiamo nel box un elemento con questa etichetta
                        let campoBox1 = box1campi.find(campo => campo.isValid && Utility.parseLabel(campo.label).includes(foto.sigla));
                        if (campoBox1 == undefined) {
                            if (!foto.escluso) {
                                differenze.push({ label: foto.sigla, difference: "foto extraAuto mancante nel box: " + foto.sigla });
                            }
                        }
                        else {
                            if (foto.escluso) {
                                differenze.push({ label: foto.sigla, difference: "foto extraAuto esclusa ma presente nel box: " + foto.sigla });
                            }
                            //togliamo la foto dalla lista
                            listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != foto.sigla);
                        }
                    }
                    else{
                        let fotoCorrispondente = listFotoExtraBox1.find(f => f == foto.nome);
                        if (foto.escluso) {
                            if (fotoCorrispondente != undefined) {
                                differenze.push({ label: foto.nome, difference: "foto extraAuto esclusa ma presente nel box: " + foto.nome });
                                listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != fotoCorrispondente);
                            }
                        }
                        else {
                            if (fotoCorrispondente == undefined) {
                                differenze.push({ label: foto.nome, difference: "foto extraAuto mancante nel box: " + foto.nome });
                            }
                            else {
                                //togliamo la foto dalla lista
                                listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != fotoCorrispondente);
                            }
                        }
                    }
                });
            }

            //scorriamo listFotoExtraBox1, sono tutti elementi che non ci dovrebbero essere
            listFotoExtraBox1.forEach(foto => {
                differenze.push({ label: foto, difference: "foto extra in più nel box originale: " + foto });
            });

            //I20-968, caso opposto: l'elemento e' in noRender ma nel documento qualcuno lo ha
            //rimesso visibile. Qui la segnalazione serve: il box non rispetta piu' la scelta.
            if (elementiNoRender && elementiNoRender.length > 0) {
                var nomePrimariaBox = pluginMiddleware.getCampo("nomeFotoPrimaria");
                var nomeSecondariaBox = pluginMiddleware.getCampo("nomeFotoSecondaria");

                box1campi.forEach(campo => {
                    var classificatoCampo = NoRenderElementi.classificaLabel(campo.label, nomePrimariaBox, nomeSecondariaBox);
                    if (classificatoCampo == null) {
                        return;
                    }
                    if (NoRenderElementi.daSegnalareComeRiattivato(elementiNoRender, classificatoCampo.tipo, classificatoCampo.chiave, campo.visible)) {
                        differenze.push({
                            label: classificatoCampo.chiave,
                            difference: NoRenderElementi.segnalazioneElementoRiattivato(classificatoCampo.chiave)
                        });
                    }
                });
            }

        } catch (error) {
            console.error(error);
            errors.push("Errore durante la pre analisi: " + error.message);
        }

        return {
            differenze: differenze,
            errors: errors
        };
    },

    /// Legge il documento e ne fa una mappa: quali referenze stanno in quali
    /// box, a quale pagina. Con simplified torna la versione ridotta al necessario.
    async mappaturaImpaginato(pag = null, infoDescrizione = false, simplified = false){
        try{
            let mappa = {};
            //scorriamo tutte le pagine, e creiamo un oggetto pagina che poi andremo a compilare, i parametri della pagina sono due, name (ovvero il nome della pagina) e gruppi ([] ovvero un array di gruppi)
            //per ogni pagina scorriamo i suoi gruppi e su ognuno usiamo la funzione di utility getDnaOfBox per ottenere il dna del box
            //poi se il risultato non è nullo creiamo un nuovo oggeto da mettere nell'array gruppi della pagina
            //l'oggetto è composto da ref che è il val[0] del dna, codice che è il val[1] del dna, codiceGruppo che è il val[2] del dna e infine stato che per ora varrà 0
            //poi aggiungiamo l'oggetto alla pagina e alla fine della pagina la aggiungiamo alla mappa

            let pagine = [];
            if (pag != null) {
                var pagineRange = pag;
                var pagineRangeSplit = pagineRange.split(",");
                for (var i = 0; i < pagineRangeSplit.length; i++) {
                    var range = pagineRangeSplit[i].split("-");
                    if (range.length == 1) {
                        var page = parseInt(range[0]);
                        if (isNaN(page)) {
                            messaggioUtente("Code CNF-002: Pagina da mappare non valida nell'unica pagina specificata: " + range[0], "Error", false);
                            return;
                        }
                        pagine.push(page);
                    }
                    else if (range.length == 2) {
                        var startPage = parseInt(range[0]);
                        var endPage = parseInt(range[1]);
                        if (isNaN(startPage) || isNaN(endPage)) {
                            messaggioUtente("Code CNF-003: Pagina da mappare non valida nel range di pagine specificato: " + range[0] + "-" + range[1], "Error", false);
                            return;
                        }
                        for (var j = startPage; j <= endPage; j++) {
                            pagine.push(j);
                        }
                    }
                }
            }


            if (isNaN(pag)) {
                try {
                    pag = parseInt(pag);
                }
                catch (e) {
                    console.error("Pagina non valida");
                    return;
                }
            }
            if (pagine.length == 0) {
                pagine = docInLavorazione.pages;
                for (let i = 0; i < pagine.length; i++) {
                    let pagina = pagine.item(i);
                    let gruppi = [];
                    let gruppiPagina = pagina.groups;
                    for (let j = 0; j < gruppiPagina.length; j++) {
                        let gruppo = gruppiPagina.item(j);
                        if (gruppo.itemLayer.name.toLowerCase() != "inpagina") {
                            continue;
                        }
                        let dna = Utility.getDnaOfBox(gruppo);
                        if (dna != null) {
                            //se infoDescrizione è true allora cerchiamo nel gruppo un textFrame con label descrizione e se lo troviamo copiamo il suo content in una variabile
                            let descrizione = "";
                            let foto = [];
                            if (infoDescrizione) {
                                for (let k = 0; k < gruppo.textFrames.length; k++) {
                                    if (Utility.parseLabel(gruppo.textFrames.item(k).label).toLowerCase().startsWith("descrizione")) {
                                        descrizione = gruppo.textFrames.item(k).contents;
                                        break;
                                    }
                                }
                            }

                            if (!simplified) {
                                //cerchiamo le foto nel gruppo, se sono presenti le aggiungiamo ad un array foto
                                for (let k = 0; k < gruppo.rectangles.length; k++) {
                                    let rect = gruppo.rectangles.item(k);

                                    //I20-986: cosa sia quel rettangolo lo decide un posto solo. Qui
                                    //la stessa lettura era scritta due volte, una per quando si mappa
                                    //tutto il documento e una per le pagine scelte, e le due copie
                                    //erano divergenti: la seconda non registrava il codice della foto.
                                    let riconosciuta = RicollegaEsiti.fotoDallaLabel(
                                        Utility.parseLabel(rect.label),
                                        pluginMiddleware.getCampo("nomeFotoPrimaria"),
                                        pluginMiddleware.getCampo("nomeFotoSecondaria"));

                                    if (riconosciuta != null && rect.graphics.length > 0) {
                                        let fullPath = rect.graphics.item(0).itemLink.filePath;
                                        let nomeFile = fullPath.split("/").pop();
                                        foto.push({
                                            nomeFoto: nomeFile,
                                            element: rect,
                                            statoSelezione: riconosciuta.statoSelezione,
                                            codiceFoto: riconosciuta.codiceFoto
                                        });
                                    }
                                }
                            }
                            let gruppoObj = {
                                ref: gruppo,
                                refId: gruppo.id,
                                codice: dna.codice,
                                codiceGruppo: dna.codice_gruppo,
                                idRec: dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec)) ? parseInt(dna.idRec) : null,
                                bounds: gruppo.geometricBounds,
                                pagina: pagina.name,
                                paginaAttuale: pagina.name,
                                infoDescrizione: infoDescrizione ? descrizione : null,
                                match: false,
                                foto: foto, //array di oggetti con nomeFoto, elemento e statoSelezione
                                stato: 1, //di base finchè non fa match si considera da sostituire
                                //gli stati sono:
                                //0 -> da non modificare
                                //1 -> da sostituire
                                //2 -> sostituito
                            };
                            gruppi.push(gruppoObj);
                        }
                    }
                    mappa[pagina.name] = gruppi;
                    console.log("Pagina " + pagina.name + " completata");
                }
            }
            else if (pagine.length > 0) {
                //prendiamo la pagina con il numero corrispondente a quello passato come parametro
                for (let i = 0; i < pagine.length; i++) {
                    let gruppi = [];

                    let nomePagina = pagine[i];
                    let pagina = docInLavorazione.pages.itemByName(nomePagina.toString());
                    if (pagina == null || !pagina.isValid) {
                        continue;
                    }
                    let gruppiPagina = pagina.groups;
                    for (let j = 0; j < gruppiPagina.length; j++) {
                        let gruppo = gruppiPagina.item(j);
                        if (gruppo.itemLayer.name.toLowerCase() != "inpagina") {
                            continue;
                        }
                        let dna = Utility.getDnaOfBox(gruppo);
                        if (dna != null) {
                            let descrizione = "";
                            let foto = [];
                            if (infoDescrizione) {
                                for (let k = 0; k < gruppo.textFrames.length; k++) {
                                    if (Utility.parseLabel(gruppo.textFrames.item(k).label).toLowerCase().startsWith("descrizione")) {
                                        descrizione = gruppo.textFrames.item(k).contents;
                                        break;
                                    }
                                }
                            }

                            if (!simplified) {
                                //cerchiamo le foto nel gruppo, se sono presenti le aggiungiamo ad un array foto
                                for (let k = 0; k < gruppo.rectangles.length; k++) {
                                    let rect = gruppo.rectangles.item(k);

                                    //I20-986: cosa sia quel rettangolo lo decide un posto solo. Qui
                                    //la stessa lettura era scritta due volte, una per quando si mappa
                                    //tutto il documento e una per le pagine scelte, e le due copie
                                    //erano divergenti: la seconda non registrava il codice della foto.
                                    let riconosciuta = RicollegaEsiti.fotoDallaLabel(
                                        Utility.parseLabel(rect.label),
                                        pluginMiddleware.getCampo("nomeFotoPrimaria"),
                                        pluginMiddleware.getCampo("nomeFotoSecondaria"));

                                    if (riconosciuta != null && rect.graphics.length > 0) {
                                        let fullPath = rect.graphics.item(0).itemLink.filePath;
                                        let nomeFile = fullPath.split("/").pop();
                                        foto.push({
                                            nomeFoto: nomeFile,
                                            element: rect,
                                            statoSelezione: riconosciuta.statoSelezione,
                                            codiceFoto: riconosciuta.codiceFoto
                                        });
                                    }
                                }
                            }

                            let gruppoObj = {
                                ref: gruppo,
                                refId: gruppo.id,
                                codice: dna.codice,
                                codiceGruppo: dna.codice_gruppo,
                                idRec: dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec)) ? parseInt(dna.idRec) : null,
                                bounds: gruppo.geometricBounds,
                                puntoCentrale: [gruppo.geometricBounds[1] + (gruppo.geometricBounds[3] - gruppo.geometricBounds[1]) / 2, gruppo.geometricBounds[0] + (gruppo.geometricBounds[2] - gruppo.geometricBounds[0]) / 2],
                                pagina: pagina.name,
                                paginaAttuale: pagina.name,
                                infoDescrizione: infoDescrizione ? descrizione : null,
                                match: false,
                                foto: foto, //array di oggetti con nomeFoto, elemento e statoSelezione
                                stato: 1, //di base finchè non fa match si considera da sostituire
                                //gli stati sono:
                                //0 -> da non modificare
                                //1 -> da sostituire
                                //2 -> sostituito
                            };
                            gruppi.push(gruppoObj);
                        }
                    }
                    mappa[pagina.name] = gruppi;
                }
            }
            console.log(mappa);

            //ordiniamo la mappa basandoci sui bounds dei gruppi
            //l'ordinamento segue tre regole, ogni pagina ordina i suoi elementi
            //l'ordinamento da priorità alla y e poi alla x
            //se la y di due gruppi ha una differenza inferiore a +/- 5 px allora si ordina per x

            for (let key in mappa) {
                mappa[key].sort((a, b) => {
                    // Calcola la differenza assoluta in Y
                    const diffY = Math.abs(a.bounds[0] - b.bounds[0]);

                    // Se la differenza in Y è 5 o meno, considerali uguali e confronta la X
                    if (diffY <= 5) {
                        return a.bounds[1] - b.bounds[1];
                    }

                    // Altrimenti ordina normalmente per Y
                    return a.bounds[0] - b.bounds[0];
                });
            }

            return mappa;

        }
        catch (error) {
            console.error("Errore durante la mappatura dell'impaginato: " + error);
            messaggioUtente("Code CNF-004: Errore durante la mappatura dell'impaginato: " + error, "error");
            return null;
        }
    },

    semplificazioneMappaImpaginato(mappa){
        let listaPagine = [];
        for (let key in mappa) {
            let paginaObj = {
                nomePagina: key,
                codiciConId: []
            };
            mappa[key].forEach(gruppo => {
                var codice = gruppo != null && gruppo.codiceGruppo != null ? gruppo.codiceGruppo.toString() : "";
                var idRec = gruppo != null && gruppo.idRec != null && !isNaN(parseInt(gruppo.idRec))
                    ? parseInt(gruppo.idRec)
                    : 0;

                if (codice === "") {
                    return;
                }

                var exists = paginaObj.codiciConId.some(c => c.codice === codice && parseInt(c.idRec) === idRec);
                if (!exists) {
                    paginaObj.codiciConId.push({ codice: codice, idRec: idRec });
                }
            });
            listaPagine.push(paginaObj);
        }

        var lista = {
            listRefPerPagina: listaPagine
        }

        return lista;
    },

    decodeSpecialCharacters(text) {
        var originalText = text;
        var textString = text.toString();

        textString = textString
            // Pseudo-tag testuali che vuoi rimuovere o trasformare
            .replace(/<br>/gi, "\n")
            .replace(/<\[Paragrafo base\]>/gi, '')
            .replace(/<\/\[Paragrafo base\]>/gi, '')

            // Simboli speciali da InDesign (se presenti come testo, non come oggetti)
            .replace(/DOUBLE_RIGHT_QUOTE/g, '"')
            .replace(/DOUBLE_LEFT_QUOTE/g, '"')
            .replace(/SINGLE_RIGHT_QUOTE/g, "'")
            .replace(/SINGLE_LEFT_QUOTE/g, "'")
            .replace(/DOUBLE_STRAIGHT_QUOTE/g, '"')
            .replace(/SINGLE_STRAIGHT_QUOTE/g, "'")
            .replace(/FORCED_LINE_BREAK/g, "\n")

            // HTML entities standard
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        if (textString != originalText.toString()) {
            return textString;
        }
        else {
            return originalText;
        }

    },
};

module.exports = confronti;
