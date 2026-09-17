const InputEditController = require('./InputEditController');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const { app, PDFExportOptions, CompressionQuality } = require('indesign');
const fs = require('fs');
const { parse } = require('path');
const GarbageCollector = require('./garbageCollector');
const { ref } = require('process');

const confronti = {
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
    async confrontoBoxCompiledFieldPreAnalisi(box1, compiledFields, deletedFields, listFoto, fotoExtra, fotoExtraAuto, checkMD5 = true, elementiNoRender = null) { //mode 0 -> cambio strutturale, mode 1 -> confrontoMassivo
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
                    differenze.push({
                        label: labelCampo,
                        difference: NoRenderElementi.segnalazioneElementoMancante(
                            "non presente", elementiNoRender, classificatoCampo.tipo, classificatoCampo.chiave)
                    });
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

                        var stile = Utility.parseStile(compiledField.paragraphName, true);

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

                        for (let i = 0; i < campoBox1.characters.length; i++) {
                            let character = campoBox1.characters.item(i);
                            let chParsed = me.decodeSpecialCharacters(character.contents);
                            //se il character content non è una stringa continua
                            if ((typeof chParsed !== 'string' && typeof character.contents !== 'string') || chParsed.trim() === '') {
                                continue;
                            }
                            else if (typeof chParsed !== 'string') {
                                chParsed = chParsed.contents;
                            }

                            let styleName = character.appliedCharacterStyle.name;

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
                            let stile = Utility.parseStile(tagName);
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

                    if (
                        Utility.parseLabel(campo.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") ?? "immagine") ||
                        Utility.parseLabel(campo.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") ?? "foto_secondaria")
                    ) {
                        if (campo.graphics.length > 0) {
                            let fullPath = campo.graphics.item(0).itemLink.filePath;
                            let nomeFile = fullPath.split("/").pop();

                            if (checkMD5){
                                const res = await Utility.getLinkHash(campo);
    
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
                        differenze.push({
                            label: foto.nomeFoto,
                            difference: NoRenderElementi.segnalazioneElementoMancante(
                                "foto mancante nel box: " + foto.nomeFoto, elementiNoRender, NoRenderElementi.TIPO_FOTO, foto.nomeFoto)
                        });
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
                        differenze.push({
                            label: foto.nome,
                            difference: NoRenderElementi.segnalazioneElementoMancante(
                                "foto extra mancante nel box: " + foto.nome, elementiNoRender,
                                foto.tipo == 3 ? NoRenderElementi.TIPO.logo : NoRenderElementi.TIPO.fotoExtra, foto.sigla)
                        });
                    }
                    else {
                        //togliamo la foto dalla lista
                        listFotoExtraBox1 = listFotoExtraBox1.filter(f => f != fotoCorrispondente);
                    }
                });
            }

            if (fotoExtraAuto && fotoExtraAuto.length > 0) {
                fotoExtraAuto.forEach(foto => {
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

        } catch (error) {
            console.error(error);
            errors.push("Errore durante la pre analisi: " + error.message);
        }

        return {
            differenze: differenze,
            errors: errors
        };
    },

    testMappaturaImpaginato()
    {
        let pagine = docInLavorazione.pages;
        for (let i = 0; i < pagine.length; i++) {
            let pagina = pagine.item(i);
            let gruppi = [];
            let gruppiPagina = pagina.groups;
            for (let j = 0; j < gruppiPagina.length; j++) {
                let gruppo = gruppiPagina.item(j);
                let dna = Utility.getDnaOfBox(gruppo);
            }
        }
    },

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
                                    if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine") ||
                                        Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                                        if (rect.graphics.length > 0) {
                                            let fullPath = rect.graphics.item(0).itemLink.filePath;
                                            let nomeFile = fullPath.split("/").pop();
                                            let statoSelezione = 0;
                                            if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine")) {
                                                statoSelezione = 1; //foto primaria
                                            }
                                            else if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                                                statoSelezione = 2; //foto secondaria
                                            }
                                            let codiceAssociato = "";
                                            if (Utility.parseLabel(rect.label).split("$").length > 1) {
                                                codiceAssociato = Utility.parseLabel(rect.label).split("$")[1];
                                            }
                                            foto.push({ nomeFoto: nomeFile, element: rect, statoSelezione: statoSelezione, codiceFoto: codiceAssociato });
                                        }
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
                                    if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine") ||
                                        Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                                        if (rect.graphics.length > 0) {
                                            let fullPath = rect.graphics.item(0).itemLink.filePath;
                                            let nomeFile = fullPath.split("/").pop();
                                            let statoSelezione = 0;
                                            if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine")) {
                                                statoSelezione = 1; //foto primaria
                                            }
                                            else if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                                                statoSelezione = 2; //foto secondaria
                                            }
                                            foto.push({ nomeFoto: nomeFile, element: rect, statoSelezione: statoSelezione });
                                        }
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

    async preAnalisiMismatchNumeriPagina(rangePagine, mappa) {

        //se rangePagine è null allora rangePagine diventa tutte le pagine del documento
        if (rangePagine == null || rangePagine == "") {
            rangePagine = "";
            for (let i = 0; i < docInLavorazione.pages.length; i++) {
                let pagina = docInLavorazione.pages.item(i);
                if (i == 0) {
                    rangePagine += pagina.name;
                }
                else {
                    rangePagine += "," + pagina.name;
                }
            }
        }

        if (mappa == null) {
            mappa = await this.mappaturaImpaginato(rangePagine, false, true);
        }
        //il server si aspetta una lista di {
        //  string nomePagina: "1",
        //  List<string>: codici: []
        //}
        //leggiamo la mappa e per ogni pagina creiamo l'oggetto con nomePagina e codici (leggendo i codiciGruppo)
        var lista = this.semplificazioneMappaImpaginato(mappa);

        var formData = new FormData();
        formData.append("lista", JSON.stringify(lista));

        var res = null;

        xhrInProcess = new XMLHttpRequestClient();
        xhrInProcess.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        console.error("preAnalisiMismatchNumeriPagina: Errore durante il parsing della risposta JSON: " + e, "error");
                        messaggioUtente("Code CNF-005: Errore durante il parsing della risposta di preanalisi Mismatch numerica: " + e, "error");
                        inProcess = false;
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    if(objResult.errors && objResult.errors.length > 0){
                    messaggioUtente("Code CNF-006: Errore durante la preanalisi Mismatch numerica: " + objResult.errors.join(", "), "error");
                    }
                    else{
                        messaggioUtente("Code CNF-006.5: Errore indefinito durante la preanalisi Mismatch numerica", "error");
                    }
                    res = objResult;
                    return;
                }
                res = objResult;
            }
            catch (e) {
                messaggioUtente("Code CNF-007: Errore durante la preanalisi Mismatch numerica: " + e, "error");
            }
        };


        xhrInProcess.onreadystatechange = function () {
            if (xhrInProcess.readyState == 4) {
                if (xhrInProcess.status == 200) {
                } else {
                }
            }
        };

        xhrInProcess.onerror = function () {
            messaggioUtente("Code CNF-008: Errore di connessione al server durante la preanalisi", "error");
        }

        xhrInProcess.send("Menabo/PreAnalisiMismatch/"+idKitLavorazione, formData, "PUT");

        var securityCounter = 0;
        while (res == null) {
            if (securityCounter > 600) {
                messaggioUtente("Code CNF-009: Timeout durante la preanalisi", "error");
                hideLoading();
                break;
            }else{
                securityCounter++;
                await Utility.sleep(100);
            }
        }

        return res;
    },

    async syncImpaginatoConServer(mappa = null, preAnalisi, applicaImpaginazioni = false){

        var lista = null;
        if (mappa != null){
            lista = this.semplificazioneMappaImpaginato(mappa);
        }


        var formData = new FormData();
        formData.append("preAnalisi", JSON.stringify(preAnalisi.resultPaginas));
        if (lista != null) {
            formData.append("mappa", JSON.stringify(lista));
        }

        var stato = null;

        xhrInProcess = new XMLHttpRequestClient();
        xhrInProcess.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        console.error("syncImpaginatoConServer: Errore durante il parsing della risposta JSON: " + e, "error");
                        messaggioUtente("Code CNF-011: Errore durante il parsing della risposta JSON: " + e, "error");
                        inProcess = false;
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code CNF-010: Errore durante la sincronizzazione dell'impaginato: " + objResult.error, "error");
                    return;
                }

                stato = "InProgress";
                //per objresult.recordsPerPagina, che è una lista di oggetti con nomePagina e List<List<record>> records
                //chiamiamo la funzione impaginazioneSingoloIndd(records, nomePagina) per ogni pagina
                if (objResult.recordsPerPagina && objResult.recordsPerPagina.length > 0) {
                    for (let i = 0; i < objResult.recordsPerPagina.length; i++) {
                        let paginaObj = objResult.recordsPerPagina[i];
                        if (paginaObj.records && paginaObj.records.length > 0) {
                            for (let j = 0; j < paginaObj.records.length; j++) {
                                let gruppoRecords = paginaObj.records[j];
                                var box = await impaginazioneSingoloIndd(gruppoRecords, paginaObj.nomePagina, applicaImpaginazioni);

                                if (box == null) {
                                    messaggioUtente("Code CNF-012: Errore durante l'impaginazione della pagina " + paginaObj.nomePagina, "error");
                                }
                            }
                        }
                    }
                }

                stato = "Completed";

            }
            catch (e) {
                console.error(e);
                messaggioUtente("Code CNF-013: Errore generico durante la sincronizzazione dell'impaginato: " + e, "error");
            }
        };


        xhrInProcess.onreadystatechange = function () {
            if (xhrInProcess.readyState == 4) {
                if (xhrInProcess.status == 200) {
                } else {
                }
            }
        };

        xhrInProcess.onerror = function () {
            messaggioUtente("Code CNF-014: Errore di connessione al server durante la sincronizzazione dell'impaginato", "error");
        }

        xhrInProcess.send("Menabo/syncImpaginatoConServer/"+idKitLavorazione+"/"+applicaImpaginazioni, formData, "PUT");

        var securityCounter = 0;
        while (stato == null) {
            if (securityCounter > 100) {
                messaggioUtente("Code CNF-015: Timeout durante la sincronizzazione dell'impaginato", "error");
                break;
            }
            securityCounter++;
            await Utility.sleep(100);
        }

        while (stato == "InProgress") {
            await Utility.sleep(100);
        }

        stato = "Completed";

        return stato;
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

    ripristinaCacheConfronto() {
        //facciamo la chiamata xhr per settare la sessione
        var xhr = new XMLHttpRequestClient();

        xhr.onload = async (objResult, parsed) => {
            try {
                try {
                    console.log("RESULT cache");
                    console.log(objResult);

                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code CNF-016: Errore durante il parsing della risposta della cache: " + objResult, "error");
                }
            }
            catch (e) {
                messaggioUtente("Code CNF-017: Errore generico durante il ripristino della cache: " + e, "error");
            }
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                } else {
                    messaggioUtente("Code CNF-018: Errore di rete durante il ripristino della cache: " + xhr.status, "error");
                }
            }
        }

        xhr.onerror = function () {
        };

        xhr.onNoConnection = async function () {
            messaggioUtente("Code CNF-019: Impossibile ripristinare la cache per problemi di rete", "error");
        };

        //creiamo la req composta da username e password
        var formData = new FormData();
        formData.append("idLavorazione", idKitLavorazione);
        xhr.send("Menabo/restoreCacheConfronto", formData, "POST");
    },

    _getReportIntegritaFilePath(idKit = null) {
        const kit = idKit != null ? idKit : (typeof idKitLavorazione !== "undefined" ? idKitLavorazione : "kit");
        return pathLavorazione + "/reportIntegrita_" + kit + ".json";
    },

    _getWhitelistIntegritaFilePath(idKit = null) {
        const kit = idKit != null ? idKit : (typeof idKitLavorazione !== "undefined" ? idKitLavorazione : "kit");
        return pathLavorazione + "/whitelistIntegrita_" + kit + ".json";
    },

    _formatReportDate(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (isNaN(date.getTime())) {
            return "";
        }

        const pad = (value) => value < 10 ? "0" + value : String(value);
        return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear()
            + ", " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    },

    _cloneForReportStorage(value) {
        try {
            return JSON.parse(JSON.stringify(value, (key, val) => {
                if (key === "ref" || key === "element" || key === "item") {
                    return null;
                }

                if (typeof val === "function") {
                    return undefined;
                }

                return val;
            }));
        } catch (err) {
            console.error("Errore durante la serializzazione del report integrità:", err);
            return value;
        }
    },

    _normalizeReportIntegritaWrapper(data) {
        if (!data) return null;

        if (data.report) {
            data.report.recordCambiati = data.report.recordCambiati || [];
            data.report.recordUsciti = data.report.recordUsciti || [];
            data.report.recordConErrori = data.report.recordConErrori || [];
            data.report.recordGiusti = data.report.recordGiusti || [];
            data.report.recordNuoviRisolti = data.report.recordNuoviRisolti || [];
            data.uiPrefs = data.uiPrefs || {};
            return data;
        }

        data.recordCambiati = data.recordCambiati || [];
        data.recordUsciti = data.recordUsciti || [];
        data.recordConErrori = data.recordConErrori || [];
        data.recordGiusti = data.recordGiusti || [];
        data.recordNuoviRisolti = data.recordNuoviRisolti || [];

        const createdAt = new Date().toISOString();
        return {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            createdAt,
            createdAtLabel: this._formatReportDate(createdAt),
            report: data,
            uiPrefs: {}
        };
    },

    leggiReportIntegritaLocale(idKit = null) {
        try {
            const filePath = this._getReportIntegritaFilePath(idKit);
            let data = readFile(filePath);
            if (typeof data === "string") {
                data = JSON.parse(data);
            }

            const wrapper = this._normalizeReportIntegritaWrapper(data);
            if (wrapper) {
                wrapper.filePath = filePath;
            }
            return wrapper;
        } catch (err) {
            console.error("Errore lettura report integrità locale:", err);
            return null;
        }
    },

    salvaReportIntegritaLocale(report, options = {}) {
        const createdAt = options.createdAt || new Date().toISOString();
        const wrapper = {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            createdAt,
            createdAtLabel: this._formatReportDate(createdAt),
            report: this._cloneForReportStorage(report || {}),
            uiPrefs: this._cloneForReportStorage(options.uiPrefs || {})
        };

        const filePath = this._getReportIntegritaFilePath();
        fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2));
        return wrapper;
    },

    eliminaReportIntegritaLocale(idKit = null) {
        try {
            const filePath = this._getReportIntegritaFilePath(idKit);
            fs.unlinkSync(filePath);
        } catch (err) {

        }
    },

    _getEmptyWhitelistIntegrita() {
        return {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            recordCambiati: [],
            recordUsciti: []
        };
    },

    leggiWhitelistIntegritaLocale() {
        try {
            const filePath = this._getWhitelistIntegritaFilePath();

            let data = readFile(filePath);
            if(data == null){
                return this._getEmptyWhitelistIntegrita();
            }
            if (typeof data === "string") {
                data = JSON.parse(data);
            }

            data = data || {};
            data.recordCambiati = data.recordCambiati || [];
            data.recordUsciti = data.recordUsciti || [];
            return data;
        } catch (err) {
            return this._getEmptyWhitelistIntegrita();
        }
    },

    salvaWhitelistIntegritaLocale(whitelist) {
        const data = Object.assign(this._getEmptyWhitelistIntegrita(), whitelist || {});
        fs.writeFileSync(this._getWhitelistIntegritaFilePath(), JSON.stringify(this._cloneForReportStorage(data), null, 2));
        return data;
    },

    async richiediAzioneReportIntegritaEsistente(wrapper) {
        const createdAt = wrapper?.createdAt || wrapper?.createdAtLabel;
        const createdDate = new Date(createdAt);
        if (isNaN(createdDate.getTime())) {
            return "new";
        }

        const ageHours = (new Date() - createdDate) / (1000 * 60 * 60);
        if (ageHours > 4) {
            return "new";
        }

        const oldStyle = ageHours > 2 ? "color:#b00020;font-weight:700;" : "color:#111;";
        const message = "Esiste già un report integrità creato in data "
            + "<span style=\"" + oldStyle + "\">" + this._formatReportDate(createdDate) + "</span>.";

        return await this._confirmTreAzioniReport(message, [
            { value: "open", label: "Riapri", color: "#007bff" },
            { value: "new", label: "Nuovo report", color: "#007bff" },
            { value: "cancel", label: "Annulla", color: "#dc3545" }
        ]);
    },

    async _confirmTreAzioniReport(message, actions) {
        let result = null;
        Utility.nascondiHidebleElements();

        const modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        const dialog = $('<div style="width: 60%; min-height: 35%; background-color: white; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; padding: 14px; box-sizing: border-box;"></div>');
        const body = $('<div style="flex:1; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const buttons = $('<div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; padding-top:12px;"></div>');

        actions.forEach(action => {
            const btn = $('<button style="min-width:90px; height:26px; background-color:' + action.color + '; color:white; border:none; border-radius:5px; cursor:pointer;">' + action.label + '</button>');
            btn.attr("title", action.tooltip || action.label);
            btn.on("click", function () {
                result = action.value;
                $("#confirmModal").remove();
            });
            buttons.append(btn);
        });

        modal.click(function (e) {
            e.stopPropagation();
        });

        dialog.append(body);
        dialog.append(buttons);
        modal.append(dialog);
        $("body").append(modal);

        while (result == null) {
            await Utility.sleep(100);
        }

        Utility.mostraHidebleElements();
        return result;
    },

    //#region  UI integrità

    compilaReportConfronto(report, options = {}) {
        const wrapper = this._normalizeReportIntegritaWrapper(options.wrapper || null);
        const createdAt = options.createdAt || wrapper?.createdAt || new Date().toISOString();
        const activeTab = options.activeTab != null ? options.activeTab : (this._confrontoReportState?.activeTab || 0);
        const activeList = options.activeList || this._confrontoReportState?.activeList || "report";
        const uiPrefs = options.uiPrefs || wrapper?.uiPrefs || this._confrontoReportState?.uiPrefs || {};
        const pendingScrollToDuplicateInstanceId = options.pendingScrollToDuplicateInstanceId || this._confrontoReportState?.pendingScrollToDuplicateInstanceId || "";
        const pendingScrollRecordType = options.pendingScrollRecordType || this._confrontoReportState?.pendingScrollRecordType || "";
        const reportData = wrapper?.report || report || {};

        reportData.recordCambiati = reportData.recordCambiati || [];
        reportData.recordUsciti = reportData.recordUsciti || [];
        reportData.recordConErrori = reportData.recordConErrori || [];
        reportData.recordGiusti = reportData.recordGiusti || [];
        reportData.recordNuoviRisolti = reportData.recordNuoviRisolti || [];

        const savedWrapper = options.skipSave
            ? (wrapper || { createdAt, createdAtLabel: this._formatReportDate(createdAt), report: reportData, uiPrefs })
            : this.salvaReportIntegritaLocale(reportData, { createdAt, uiPrefs });

        this._confrontoReportState = {
            report: reportData,
            createdAt: savedWrapper.createdAt || createdAt,
            createdAtLabel: savedWrapper.createdAtLabel || this._formatReportDate(createdAt),
            activeTab,
            activeList,
            uiPrefs: savedWrapper.uiPrefs || uiPrefs,
            whitelist: this.leggiWhitelistIntegritaLocale(),
            pendingScrollToDuplicateInstanceId,
            pendingScrollRecordType
        };

        this.salvaWhitelistIntegritaLocale(this._confrontoReportState.whitelist);

        if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
            indesignEvents.setBusy(true);
        }

        Utility.apriModal("dialogConfrontoReport", "Report Confronto", false, ["pulsantiTestataConfronto"]);

        const headerActions = document.getElementById("pulsantiTestataConfronto");
        if (headerActions) {
            let btnScaricaCsv = document.getElementById("scaricaReportConfrontoCsv");
            if (!btnScaricaCsv) {
                btnScaricaCsv = document.createElement("button");
                btnScaricaCsv.id = "scaricaReportConfrontoCsv";
                btnScaricaCsv.type = "button";
                btnScaricaCsv.textContent = "Scarica CSV";
                btnScaricaCsv.title = "Scarica il report confronto in formato CSV";
                btnScaricaCsv.style.height = "25px";
                btnScaricaCsv.style.cursor = "pointer";
                btnScaricaCsv.style.marginRight = "8px";

                const closeButton = document.getElementById("closeModalConfronto");
                if (closeButton) {
                    headerActions.insertBefore(btnScaricaCsv, closeButton);
                } else {
                    headerActions.appendChild(btnScaricaCsv);
                }
            }

            btnScaricaCsv.title = "Scarica il report confronto in formato CSV";
            btnScaricaCsv.onclick = () => this.scaricaReportConfrontoCsv(this._confrontoReportState?.report || reportData);
        }

        const body = document.getElementById("bodyConfrontoReport");
        if (!body) {
            console.error("Elemento #bodyConfrontoReport non trovato");
            return;
        }

        const footer = document.getElementById("footerConfrontoReport");
        if (footer) {
            footer.innerHTML = "";
            footer.style.display = "flex";
            footer.style.justifyContent = "center";
            footer.style.alignItems = "center";
            footer.style.padding = "8px 0";

            const btnFixMassivo = document.createElement("button");
            btnFixMassivo.type = "button";
            btnFixMassivo.textContent = "Fix massivo";
            btnFixMassivo.title = "Applica il fix massivo al report";
            btnFixMassivo.style.padding = "8px 18px";
            btnFixMassivo.style.cursor = "pointer";
            btnFixMassivo.style.border = "1px solid #a22";
            btnFixMassivo.style.borderRadius = "4px";
            btnFixMassivo.style.backgroundColor = "#c33";
            btnFixMassivo.style.color = "#fff";
            btnFixMassivo.style.fontWeight = "700";
            btnFixMassivo.style.display = activeList === "whitelist" ? "none" : "block";

            btnFixMassivo.addEventListener("click", async () => {
                const ok = await this._confirmReportAction("massive", "Procedere con il fix massivo del report?");
                if (!ok) return;
                // TODO
            });

            footer.appendChild(btnFixMassivo);
        }

        // Store runtime per recuperare i dati reali al click dei pulsanti
        this._confrontoReportStore = new Map();
        this._confrontoReportCounter = 0;

        body.innerHTML = "";
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.height = "100%";
        body.style.minHeight = "0";
        body.style.overflow = "hidden";

        const metaBar = document.createElement("div");
        metaBar.textContent = "Report creato il " + (this._confrontoReportState.createdAtLabel || this._formatReportDate(this._confrontoReportState.createdAt));
        metaBar.style.flexShrink = "0";
        metaBar.style.fontSize = "12px";
        metaBar.style.fontWeight = "600";
        metaBar.style.padding = "0 0 6px 0";

        const tabsRoot = this._crTabRoot();

        const changedTab = this._crTabButton("Cambiati", true);
        const removedTab = this._crTabButton("Eliminati", false);
        const newTab = this._crTabButton("Nuovi", false);

        const changedPanel = this._buildPanelCambiati(this._getCurrentReportRecords("recordCambiati"));
        const removedPanel = this._buildPanelEliminati(this._getCurrentReportRecords("recordUsciti"));
        const newPanel = this._buildPanelNuovi(this._confrontoReportState.report);

        const panels = [
            { button: changedTab, panel: changedPanel },
            { button: removedTab, panel: removedPanel },
            { button: newTab, panel: newPanel }
        ];

        const activateTab = (activeIndex) => {
            if (this._confrontoReportState) {
                this._confrontoReportState.activeTab = activeIndex;
            }
            panels.forEach((entry, index) => {
                const isActive = index === activeIndex;
                entry.button.classList.toggle("is-active", isActive);
                entry.button.style.opacity = isActive ? "1" : "0.7";
                entry.button.style.fontWeight = isActive ? "700" : "400";
                entry.panel.style.display = isActive ? "flex" : "none";
            });
        };

        changedTab.addEventListener("click", () => activateTab(0));
        removedTab.addEventListener("click", () => activateTab(1));
        newTab.addEventListener("click", () => activateTab(2));

        tabsRoot.header.appendChild(changedTab);
        tabsRoot.header.appendChild(removedTab);
        tabsRoot.header.appendChild(newTab);

        tabsRoot.content.appendChild(changedPanel);
        tabsRoot.content.appendChild(removedPanel);
        tabsRoot.content.appendChild(newPanel);

        body.appendChild(metaBar);
        body.appendChild(tabsRoot.root);

        activateTab(activeTab);
        this._restorePendingReportScroll();
    },

    scaricaReportConfrontoCsv(report) {
        try {
            const cartellaExport = this._getCartellaExportReport();
            const nomeFile = this._getNomeFileReportCsv();
            const filePath = cartellaExport + nomeFile;
            const csv = this._buildReportConfrontoCsv(report);

            fs.writeFileSync(filePath, "\uFEFF" + csv);
            messaggioUtente("Report confronto scaricato in CSV: " + filePath, "success", false, 10);
        } catch (err) {
            console.error("Errore durante lo scaricamento del report CSV:", err);
            messaggioUtente("Code CNF-020: Errore durante lo scaricamento del report CSV: " + (err?.message || err), "error", false, 10);
        }
    },

    _getCartellaExportReport() {
        const cartellaExport = typeof percorsoEsportazione !== "undefined" ? String(percorsoEsportazione || "") : "";
        if (!cartellaExport) {
            throw new Error("cartella di export non configurata");
        }

        const pathExport = cartellaExport.endsWith("/") ? cartellaExport : cartellaExport + "/";
        return pathExport;
    },

    _getNomeFileReportCsv() {
        const pad = (value) => value < 10 ? "0" + value : String(value);
        const now = new Date();
        const timestamp = now.getFullYear()
            + pad(now.getMonth() + 1)
            + pad(now.getDate())
            + "_"
            + pad(now.getHours())
            + pad(now.getMinutes())
            + pad(now.getSeconds());

        const idKit = typeof idKitLavorazione !== "undefined" ? String(idKitLavorazione || "kit") : "kit";
        const safeIdKit = idKit.replace(/[\\/:*?"<>|]/g, "_");
        return "reportConfronto_" + safeIdKit + "_" + timestamp + ".csv";
    },

    _buildReportConfrontoCsv(report) {
        const intestazioni = ["Tipo", "Pagina", "Codice gruppo", "RefId", "Descrizione", "Campo", "Dettaglio"];
        const rows = [intestazioni];

        this._appendReportRecordsCsvRows(rows, "Cambiato", report?.recordCambiati || [], (record) => {
            const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
            if (differenze.length === 0) {
                return [{ campo: "", dettaglio: "Differenza non specificata" }];
            }

            return differenze.map(diff => ({
                campo: diff?.label || "",
                dettaglio: diff?.difference || ""
            }));
        });

        this._appendReportRecordsCsvRows(rows, "Eliminato", report?.recordUsciti || [], () => {
            return [{ campo: "", dettaglio: "Presente in impaginato ma non nel tracciato" }];
        });

        this._appendReportRecordsCsvRows(rows, "Errore", report?.recordConErrori || [], (record) => {
            const errors = Array.isArray(record?.preAnalisi?.errors) ? record.preAnalisi.errors : [];
            if (errors.length === 0) {
                return [{ campo: "", dettaglio: "Errore non specificato" }];
            }

            return errors.map(error => ({
                campo: "",
                dettaglio: error
            }));
        });

        const nuovi = this._getReportNuoviRows(report);
        nuovi.forEach(row => {
            rows.push([
                "Nuovo",
                "",
                row.codiceGruppo || "",
                "",
                row.descrizione || "",
                "",
                "Presente nel tracciato ma non in impaginato"
            ]);
        });

        return rows
            .map(row => row.map(value => this._csvEscape(value)).join(";"))
            .join("\n");
    },

    _appendReportRecordsCsvRows(rows, tipo, records, detailFactory) {
        (records || []).forEach(record => {
            const details = detailFactory(record) || [{ campo: "", dettaglio: "" }];
            details.forEach(detail => {
                rows.push([
                    tipo,
                    this._getReportRecordPage(record),
                    record?.codiceGruppo || "",
                    this._getReportRecordRefId(record),
                    this._getReportRecordDescrizione(record),
                    detail?.campo || "",
                    detail?.dettaglio || ""
                ]);
            });
        });
    },

    _getReportNuoviRows(report) {
        let listaTracciato = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
        if (typeof listaTracciato === "string") {
            try {
                listaTracciato = JSON.parse(listaTracciato);
            } catch (err) {
                console.error("Errore parse listaKit per export CSV:", err);
                listaTracciato = [];
            }
        }

        return this._estraiNuoviDaLista(report, listaTracciato);
    },

    _getReportRecordRaw(record) {
        if (Array.isArray(record?.schedaRef?.records) && record.schedaRef.records.length > 0) {
            return record.schedaRef.records[0]?.recordInTracciato || null;
        }

        return record?.recordInTracciato || record?.raw || null;
    },

    _getReportRecordDescrizione(record) {
        const raw = this._getReportRecordRaw(record);
        if (!raw) {
            return "";
        }

        return this._getDescrizioneNuovo(raw);
    },

    _getReportRecordPage(record) {
        return record?.numeroPagina ?? record?.elementoMappa?.numeroPagina ?? record?.elementoMappa?.pagina ?? "";
    },

    _getReportRecordRefId(record) {
        return record?.inddId
            ?? record?.refId
            ?? record?.duplicateInfo?.refId
            ?? record?.elementoMappa?.refId
            ?? record?.elementoMappa?.idRec
            ?? "";
    },

    _getCurrentReportRecords(key) {
        const state = this._confrontoReportState;
        if (!state) return [];

        if (state.activeList === "whitelist") {
            return this._applyReportToWhitelistRecords(state.report?.[key] || [], state.whitelist?.[key] || [], key);
        }

        return this._applyWhitelistToReportRecords(state.report?.[key] || [], state.whitelist?.[key] || [], key);
    },

    _applyReportToWhitelistRecords(records, whitelistRecords, key) {
        const result = [];

        (whitelistRecords || []).forEach(whitelistRecord => {
            const reportRecord = (records || []).find(item => this._sameReportRecord(item, whitelistRecord));
            if (!reportRecord) {
                return;
            }

            const reportSegnalazioni = this._getRecordSegnalazioni(reportRecord, key);
            const reportKeys = new Set(reportSegnalazioni.map(item => item.key));
            const whitelistSegnalazioni = this._getRecordSegnalazioni(whitelistRecord, key);
            const segnalazioniAncoraPresenti = whitelistSegnalazioni.filter(item => reportKeys.has(item.key));

            if (segnalazioniAncoraPresenti.length === 0) {
                return;
            }

            const filtered = this._cloneForReportStorage(whitelistRecord);
            filtered._fullWhitelistRecord = whitelistRecord;
            filtered._fullReportRecord = reportRecord;
            filtered.elementoMappa = reportRecord.elementoMappa || filtered.elementoMappa;
            filtered.numeroPagina = reportRecord.numeroPagina ?? filtered.numeroPagina;
            filtered.elementoPaginaMappa = reportRecord.elementoPaginaMappa || filtered.elementoPaginaMappa;
            filtered.schedaRef = reportRecord.schedaRef || filtered.schedaRef;

            if (key === "recordCambiati") {
                filtered.preAnalisi = filtered.preAnalisi || {};
                filtered.preAnalisi.differenze = segnalazioniAncoraPresenti.map(item => item.value);
            }

            result.push(filtered);
        });

        return result;
    },

    _applyWhitelistToReportRecords(records, whitelistRecords, key) {
        const result = [];

        (records || []).forEach(record => {
            const whitelistRecord = (whitelistRecords || []).find(item => this._sameReportRecord(item, record));
            if (!whitelistRecord) {
                result.push(record);
                return;
            }

            const reportSegnalazioni = this._getRecordSegnalazioni(record, key);
            const whitelistSegnalazioni = this._getRecordSegnalazioni(whitelistRecord, key);
            const whitelistKeys = new Set(whitelistSegnalazioni.map(item => item.key));
            const segnalazioniVisibili = reportSegnalazioni.filter(item => !whitelistKeys.has(item.key));

            if (segnalazioniVisibili.length === 0) {
                return;
            }

            const filtered = this._cloneForReportStorage(record);
            filtered._fullReportRecord = record;
            filtered._hasWhitelistOtherSegnalazioni = true;

            if (key === "recordCambiati") {
                filtered.preAnalisi = filtered.preAnalisi || {};
                filtered.preAnalisi.differenze = segnalazioniVisibili.map(item => item.value);
            }

            result.push(filtered);
        });

        return result;
    },

    _getRecordSegnalazioni(record, key) {
        if (key === "recordUsciti") {
            return [{
                key: "uscito",
                value: { label: "", difference: "Presente in impaginato ma non nel tracciato" }
            }];
        }

        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
        return differenze.map(diff => ({
            key: this._getSegnalazioneKey(diff),
            value: diff
        }));
    },

    _getSegnalazioneKey(diff) {
        return JSON.stringify({
            label: String(diff?.label || "").trim(),
            difference: String(diff?.difference || "").trim()
        });
    },

    _getDuplicateInfo(record) {
        return record?.duplicateInfo || record?.elementoMappa?.duplicateInfo || null;
    },

    _getDuplicateActiveRecords(duplicateKey, options = {}) {
        const includeWhitelist = options.includeWhitelist !== false;
        const includeReport = options.includeReport !== false;
        const state = this._confrontoReportState;
        if (!state || !duplicateKey) return [];

        const result = [];
        const collect = (records, key, listMode) => {
            (records || []).forEach(record => {
                const info = this._getDuplicateInfo(record);
                if (!info || info.key !== duplicateKey) return;
                result.push({ record, key, listMode });
            });
        };

        if (includeReport) {
            collect(this._applyWhitelistToReportRecords(state.report?.recordCambiati || [], state.whitelist?.recordCambiati || [], "recordCambiati"), "recordCambiati", "report");
            collect(this._applyWhitelistToReportRecords(state.report?.recordUsciti || [], state.whitelist?.recordUsciti || [], "recordUsciti"), "recordUsciti", "report");
        }

        if (includeWhitelist) {
            collect(this._applyReportToWhitelistRecords(state.report?.recordCambiati || [], state.whitelist?.recordCambiati || [], "recordCambiati"), "recordCambiati", "whitelist");
            collect(this._applyReportToWhitelistRecords(state.report?.recordUsciti || [], state.whitelist?.recordUsciti || [], "recordUsciti"), "recordUsciti", "whitelist");
        }

        result.sort((a, b) => {
            const ia = Number(this._getDuplicateInfo(a.record)?.index || 0);
            const ib = Number(this._getDuplicateInfo(b.record)?.index || 0);
            return ia - ib;
        });

        return result;
    },

    _getDuplicateResolvedCount(record) {
        const info = this._getDuplicateInfo(record);
        if (!info) return 0;

        const total = Number(info.total || 0);
        const activeCount = this._getDuplicateActiveRecords(info.key, { includeWhitelist: true }).length;
        return Math.max(0, total - activeCount);
    },

    _crDuplicateControl(record, reportKey) {
        const info = this._getDuplicateInfo(record);
        if (!info || Number(info.total || 0) <= 1) {
            return null;
        }

        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.alignItems = "center";
        root.style.gap = "6px";
        root.style.margin = "4px 0";
        root.style.padding = "6px 8px";
        root.style.fontSize = "12px";
        root.style.fontWeight = "800";
        root.style.color = "#7a1f00";
        root.style.backgroundColor = "#ffe1b8";
        root.style.border = "2px solid #d66a00";
        root.style.borderRadius = "4px";
        root.style.boxSizing = "border-box";
        root.style.width = "fit-content";
        root.style.maxWidth = "100%";

        const resolvedCount = this._getDuplicateResolvedCount(record);
        const label = document.createElement("span");
        label.textContent = "BOX DUPLICATO " + info.index + "/" + info.total + (resolvedCount > 0 ? " - " + resolvedCount + " segnalazioni risolte" : "");
        label.style.whiteSpace = "normal";
        label.style.overflowWrap = "anywhere";

        const next = this._crButton(">");
        next.title = "Vai alla prossima istanza duplicata";
        next.style.minWidth = "24px";
        next.style.minHeight = "22px";
        next.style.padding = "2px 6px";
        next.addEventListener("click", () => this._goToNextDuplicate(record, reportKey, true));

        root.appendChild(label);
        root.appendChild(next);
        return root;
    },

    _styleDuplicateRow(row) {
        if (!row) return;

        row.style.border = "2px solid #d66a00";
        row.style.backgroundColor = "#fff7ec";
        row.style.boxShadow = "inset 4px 0 0 #d66a00";
    },

    _goToNextDuplicate(record, reportKey, includeWhitelist = true) {
        const info = this._getDuplicateInfo(record);
        if (!info) return false;

        const records = this._getDuplicateActiveRecords(info.key, { includeWhitelist });
        if (records.length <= 1) {
            messaggioUtente("Non ci sono altre istanze non risolte per questo duplicato.", "warning", false, 3);
            return false;
        }

        const currentId = info.instanceId;
        let currentIndex = records.findIndex(item => this._getDuplicateInfo(item.record)?.instanceId === currentId);
        if (currentIndex < 0) {
            currentIndex = -1;
        }

        const next = records[(currentIndex + 1) % records.length];
        if (!next) return false;

        const state = this._confrontoReportState;
        const nextInfo = this._getDuplicateInfo(next.record);
        const nextRecordType = next.key === "recordUsciti" ? "uscito" : "cambiato";
        if (state) {
            state.activeList = next.listMode;
            state.activeTab = nextRecordType === "uscito" ? 1 : 0;
            state.pendingScrollToDuplicateInstanceId = nextInfo?.instanceId || "";
            state.pendingScrollRecordType = nextRecordType;
            this._refreshConfrontoReportUi();
        }

        setTimeout(() => {
            this._findElemento({ record: next.record });
            if (nextInfo?.instanceId) {
                setTimeout(() => {
                    const row = this._findReportRowByDuplicateInstanceId(nextInfo.instanceId, nextRecordType);
                    if (row) {
                        this._scrollReportRowIntoView(row);
                    }
                }, 80);
            }
        }, 50);
        return true;
    },

    _restorePendingReportScroll() {
        const state = this._confrontoReportState;
        const instanceId = state?.pendingScrollToDuplicateInstanceId;
        if (!instanceId) return;

        const attemptScroll = (remainingAttempts) => {
            const currentState = this._confrontoReportState;
            const targetInstanceId = currentState?.pendingScrollToDuplicateInstanceId;
            if (!targetInstanceId) return;

            const row = this._findReportRowByDuplicateInstanceId(targetInstanceId, currentState.pendingScrollRecordType);
            if (!row) {
                if (remainingAttempts > 0) {
                    setTimeout(() => attemptScroll(remainingAttempts - 1), 60);
                } else {
                    currentState.pendingScrollToDuplicateInstanceId = "";
                    currentState.pendingScrollRecordType = "";
                }
                return;
            }

            this._scrollReportRowIntoView(row);
            currentState.pendingScrollToDuplicateInstanceId = "";
            currentState.pendingScrollRecordType = "";
        };

        setTimeout(() => attemptScroll(5), 0);
    },

    _findReportRowByDuplicateInstanceId(instanceId, recordType = "") {
        const rows = document.querySelectorAll("[data-duplicate-instance-id]");
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row?.dataset?.duplicateInstanceId !== instanceId) continue;
            if (recordType && row?.dataset?.recordType !== recordType) continue;
            return row;
        }

        return null;
    },

    _scrollReportRowIntoView(row) {
        if (!row) return;

        const scrollContainer = this._getReportScrollContainer(row);
        if (!scrollContainer) return;

        let targetTop = row.offsetTop || 0;
        try {
            const rowRect = row.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            targetTop = scrollContainer.scrollTop + rowRect.top - containerRect.top - 12;
        } catch (err) {
            let current = row;
            targetTop = 0;
            while (current && current !== scrollContainer) {
                targetTop += current.offsetTop || 0;
                current = current.offsetParent;
            }
            targetTop -= 12;
        }

        targetTop = Math.max(0, targetTop);
        scrollContainer.scrollTop = targetTop;

        if (typeof $ !== "undefined") {
            try {
                $(scrollContainer).scrollTop(targetTop);
            } catch (err) {
                // UXP a volte espone solo lo scrollTop nativo.
            }
        }

        const oldOutline = row.style.outline;
        row.style.outline = "3px solid #d66a00";
        setTimeout(() => {
            row.style.outline = oldOutline || "";
        }, 1200);
    },

    _getReportScrollContainer(row) {
        let current = row?.parentElement || null;
        while (current) {
            const overflowY = current.style?.overflowY || "";
            if (overflowY === "scroll" || overflowY === "auto") {
                return current;
            }
            if (current.clientHeight > 0 && current.scrollHeight > current.clientHeight) {
                return current;
            }
            current = current.parentElement;
        }

        return document.getElementById("bodyConfrontoReport") || document.getElementById("bodyModal");
    },

    _getRecordIdentity(record) {
        const codiceGruppo = String(record?.codiceGruppo || record?.elementoMappa?.codiceGruppo || "").trim();
        const idRec = record?.elementoMappa?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.IdRec
            ?? null;
        const refId = record?.elementoMappa?.refId ?? "";
        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? "";
        const duplicateInstanceId = record?.duplicateInfo?.instanceId || record?.elementoMappa?.duplicateInfo?.instanceId || "";

        return {
            codiceGruppo,
            idRec: idRec == null || isNaN(parseInt(idRec)) ? "" : String(parseInt(idRec)),
            refId: String(refId || ""),
            pagina: String(pagina || ""),
            duplicateInstanceId: String(duplicateInstanceId || "")
        };
    },

    _sameReportRecord(a, b) {
        const ia = this._getRecordIdentity(a);
        const ib = this._getRecordIdentity(b);

        if (ia.duplicateInstanceId || ib.duplicateInstanceId) {
            return ia.duplicateInstanceId !== "" && ia.duplicateInstanceId === ib.duplicateInstanceId;
        }

        if (ia.codiceGruppo !== ib.codiceGruppo) return false;
        if (ia.idRec !== ib.idRec) return false;

        if (ia.refId || ib.refId) {
            return ia.refId !== "" && ia.refId === ib.refId;
        }

        if (ia.idRec || ib.idRec) {
            return true;
        }

        return ia.pagina === ib.pagina;
    },

    _removeRecordFromArray(arr, record) {
        const list = arr || [];
        const target = record?._fullReportRecord || record;
        const index = list.findIndex(item => this._sameReportRecord(item, target));
        if (index >= 0) {
            list.splice(index, 1);
            return true;
        }
        return false;
    },

    _saveCurrentReportAndWhitelist() {
        const state = this._confrontoReportState;
        if (!state) return;

        const saved = this.salvaReportIntegritaLocale(state.report, {
            createdAt: state.createdAt,
            uiPrefs: state.uiPrefs || {}
        });

        state.createdAt = saved.createdAt;
        state.createdAtLabel = saved.createdAtLabel;
        state.uiPrefs = saved.uiPrefs || state.uiPrefs || {};
        state.whitelist = this.salvaWhitelistIntegritaLocale(state.whitelist || this._getEmptyWhitelistIntegrita());
    },

    _refreshConfrontoReportUi() {
        const state = this._confrontoReportState;
        if (!state) return;

        this.compilaReportConfronto(state.report, {
            createdAt: state.createdAt,
            activeTab: state.activeTab,
            activeList: state.activeList,
            uiPrefs: state.uiPrefs,
            skipSave: true,
            wrapper: {
                createdAt: state.createdAt,
                createdAtLabel: state.createdAtLabel,
                report: state.report,
                uiPrefs: state.uiPrefs
            }
        });
    },

    _setReportListMode(value) {
        const state = this._confrontoReportState;
        if (!state) return;

        state.activeList = value === "whitelist" ? "whitelist" : "report";
        this._refreshConfrontoReportUi();
    },

    _crReportListPicker() {
        const picker = document.createElement("sp-picker");
        picker.style.minWidth = "150px";

        const menu = document.createElement("sp-menu");
        menu.setAttribute("slot", "options");

        const itemReport = document.createElement("sp-menu-item");
        itemReport.value = "report";
        itemReport.textContent = "Segnalazioni";

        const itemWhitelist = document.createElement("sp-menu-item");
        itemWhitelist.value = "whitelist";
        itemWhitelist.textContent = "Whitelist";

        if ((this._confrontoReportState?.activeList || "report") === "whitelist") {
            itemWhitelist.setAttribute("selected", "selected");
        } else {
            itemReport.setAttribute("selected", "selected");
        }

        menu.appendChild(itemReport);
        menu.appendChild(itemWhitelist);
        picker.appendChild(menu);

        picker.addEventListener("change", (ev) => {
            this._setReportListMode(ev.target.value || "report");
        });

        return picker;
    },

    _getReportCategoryFromTipo(tipo) {
        if (tipo === "uscito") return "recordUsciti";
        return "recordCambiati";
    },

    _getReportRecordRawForInfo(record) {
        const raw = this._getReportRecordRaw(record);
        if (raw) return raw;

        return {
            "Scatto.CodiceGruppo": record?.codiceGruppo || record?.elementoMappa?.codiceGruppo || "",
            "Pagina": this._getReportRecordPage(record),
            "RefId": this._getReportRecordRefId(record)
        };
    },

    _openInfoReportRecord(record) {
        const raw = this._getReportRecordRawForInfo(record);
        if (!raw) {
            console.warn("Info non disponibili per la segnalazione:", record);
            return;
        }

        if (typeof schedaRef !== "undefined" && schedaRef?.preparaInfoIspezioneDelDato) {
            schedaRef.preparaInfoIspezioneDelDato(raw, raw);
            this._apriOverlayInfoReport("Info dati referenza");
        } else {
            console.log("Info dati referenza:", raw);
        }
    },

    _apriOverlayInfoReport(titolo) {
        $("#confrontoInfoOverlay").remove();

        const overlay = $('<div id="confrontoInfoOverlay" style="position: fixed; inset: 0; z-index: 9999999; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box;"></div>');
        const dialog = $('<div style="width: 80%; height: 80%; background: #fff; color: #111; display: flex; flex-direction: column; border-radius: 4px; box-shadow: 0 8px 28px rgba(0,0,0,0.35); overflow: hidden;"></div>');
        const header = $('<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-bottom:1px solid #ccc; flex:0 0 auto;"></div>');
        const title = $('<div style="font-weight:700;"></div>').text(titolo || "Info dati referenza");
        const close = $('<button type="button" style="height:26px; min-width:32px; cursor:pointer;">&times;</button>');
        const body = $('<div id="confrontoInfoBody" style="flex:1 1 auto; min-height:0; overflow:auto; padding:10px;"></div>');
        const footer = $('<div style="display:flex; gap:8px; padding:8px 10px; border-top:1px solid #ccc; flex:0 0 auto;"></div>');
        const btnVediTutto = $('<button type="button" style="height:26px;">Vedi tutto</button>');
        const btnVediMeno = $('<button type="button" style="height:26px; display:none;">Vedi meno</button>');
        const btnScarica = $('<button type="button" style="height:26px;">Scarica dato</button>');
        close.attr("title", "Chiudi info");
        btnVediTutto.attr("title", "Mostra tutte le informazioni del record");
        btnVediMeno.attr("title", "Mostra solo le informazioni principali del record");
        btnScarica.attr("title", "Scarica le informazioni del record");

        const render = (informazioniRapide) => {
            const infoRapide = $("#infoPerLeggiInfoRef").data("infoRapide");
            const infoComplete = $("#infoPerLeggiInfoRef").data("infoComplete");
            body.html(informazioniRapide ? (infoRapide || "") : (infoComplete || ""));
            btnVediTutto.css("display", informazioniRapide ? "block" : "none");
            btnVediMeno.css("display", informazioniRapide ? "none" : "block");
        };

        close.on("click", () => overlay.remove());
        overlay.on("click", (ev) => {
            if (ev.target === overlay[0]) {
                overlay.remove();
            }
        });
        btnVediTutto.on("click", () => render(false));
        btnVediMeno.on("click", () => render(true));
        btnScarica.on("click", () => {
            if (typeof schedaRef !== "undefined" && schedaRef?.scaricaJson) {
                schedaRef.scaricaJson();
            }
        });

        header.append(title, close);
        footer.append(btnVediTutto, btnVediMeno, btnScarica);
        dialog.append(header, body, footer);
        overlay.append(dialog);
        $("body").append(overlay);
        render(true);
    },

    async _confirmReportAction(kind, message) {
        const state = this._confrontoReportState;
        const prefs = state?.uiPrefs || {};

        if (kind === "fixSingle" && prefs.skipConfirmFixSingle) return true;
        if (kind === "resolve" && prefs.skipConfirmResolve) return true;

        const withSkip = kind === "fixSingle" || kind === "resolve";
        if (!withSkip) {
            return await Utility.confirm(message);
        }

        const res = await this._confirmConNonChiedere(message);
        if (res.result && res.dontAsk && state) {
            if (kind === "fixSingle") {
                state.uiPrefs.skipConfirmFixSingle = true;
            }
            if (kind === "resolve") {
                state.uiPrefs.skipConfirmResolve = true;
            }
            this._saveCurrentReportAndWhitelist();
        }

        return res.result;
    },

    async _confirmConNonChiedere(message) {
        let result = null;
        let dontAsk = false;
        Utility.nascondiHidebleElements();

        const modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        const dialog = $('<div style="width: 60%; min-height: 36%; background-color: white; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; padding: 14px; box-sizing: border-box;"></div>');
        const body = $('<div style="flex:1; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const chkWrap = $('<label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-top:8px;"><input type="checkbox"><span>Non chiedere di nuovo per questo report</span></label>');
        const buttons = $('<div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; padding-top:12px;"></div>');
        const ok = $('<button style="min-width:90px; height:26px; background-color:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">Conferma</button>');
        const cancel = $('<button style="min-width:90px; height:26px; background-color:#dc3545; color:white; border:none; border-radius:5px; cursor:pointer;">Annulla</button>');
        ok.attr("title", "Conferma operazione");
        cancel.attr("title", "Annulla operazione");

        ok.on("click", function () {
            result = true;
            dontAsk = chkWrap.find("input").prop("checked") === true;
            $("#confirmModal").remove();
        });

        cancel.on("click", function () {
            result = false;
            $("#confirmModal").remove();
        });

        modal.click(function (e) {
            e.stopPropagation();
        });

        body.append(chkWrap);
        buttons.append(ok, cancel);
        dialog.append(body, buttons);
        modal.append(dialog);
        $("body").append(modal);

        while (result == null) {
            await Utility.sleep(100);
        }

        Utility.mostraHidebleElements();
        return { result, dontAsk };
    },

    _csvEscape(value) {
        const normalized = value == null ? "" : String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        return "\"" + normalized.replace(/"/g, "\"\"") + "\"";
    },

    _buildPanelCambiati(records) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent();

        const btnFixAll = this._crButton("Fix all");
        const picker = this._crReportListPicker();

        if (this._confrontoReportState?.activeList !== "whitelist") {
            topbar.appendChild(btnFixAll);
        }
        topbar.appendChild(picker);

        const grouped = this._groupByPage(records);

        if (grouped.length === 0) {
            content.appendChild(this._crEmptyState("Nessun elemento cambiato"));
        } else {
            grouped.forEach(group => {
                if (!group.items.length) return;

                content.appendChild(this._crPageHeader(group.page, "cambiato"));
                content.appendChild(this._crPageHiddenNotice(group.page, "cambiato"));

                group.items.forEach(item => {
                    const payloadId = this._storeConfrontoPayload({
                        tipo: "cambiato",
                        record: item,
                        elementoMappa: item.elementoMappa || null,
                        refId: item?.elementoMappa?.refId || null,
                        schedaRecords: item?.schedaRef?.records || null,
                        numeroPagina: item?.numeroPagina ?? item?.elementoMappa?.numeroPagina ?? null,
                        elementoPaginaMappa: item?.elementoPaginaMappa || null,
                        hidden: false
                    });


                    const row = this._crRow();
                    row.dataset.payloadId = payloadId;
                    row.dataset.pageNumber = String(group.page);
                    row.dataset.recordType = "cambiato";
                    const duplicateInfo = this._getDuplicateInfo(item);
                    if (duplicateInfo) {
                        if (duplicateInfo.instanceId) {
                            row.dataset.duplicateInstanceId = duplicateInfo.instanceId;
                        }
                        if (duplicateInfo.key) {
                            row.dataset.duplicateKey = duplicateInfo.key;
                        }
                        this._styleDuplicateRow(row);
                    }

                    const left = document.createElement("div");
                    left.style.display = "flex";
                    left.style.flexDirection = "column";
                    left.style.flex = "1 1 auto";
                    left.style.minWidth = "0";
                    left.style.overflow = "hidden";
                    left.style.gap = "4px";

                    const codice = document.createElement("div");
                    codice.textContent = this._truncate(item.codiceGruppo || "-", 20);
                    codice.title = item.codiceGruppo || "";
                    codice.style.fontWeight = "600";
                    codice.style.whiteSpace = "nowrap";
                    codice.style.overflow = "hidden";
                    codice.style.textOverflow = "ellipsis";
                    codice.style.minWidth = "0";

                    const diffList = document.createElement("div");
                    diffList.style.display = "flex";
                    diffList.style.flexDirection = "column";
                    diffList.style.gap = "2px";
                    diffList.style.minWidth = "0";
                    diffList.style.width = "100%";

                    const differenze = Array.isArray(item?.preAnalisi?.differenze) ? item.preAnalisi.differenze : [];
                    if (differenze.length === 0) {
                        const emptyDiff = document.createElement("div");
                        emptyDiff.textContent = "Nessuna differenza rilevata";
                        emptyDiff.style.opacity = "0.7";
                        emptyDiff.style.minWidth = "0";
                        emptyDiff.style.whiteSpace = "normal";
                        emptyDiff.style.overflowWrap = "anywhere";
                        diffList.appendChild(emptyDiff);
                    } else {
                        differenze.forEach(diff => {
                            const diffRow = document.createElement("div");
                            diffRow.textContent = (diff?.label ? diff.label + " - " : "-") + (diff?.difference || "");
                            diffRow.style.fontSize = "11px";
                            diffRow.style.lineHeight = "1.3";
                            diffRow.style.whiteSpace = "normal";
                            diffRow.style.wordBreak = "break-word";
                            diffRow.style.overflowWrap = "anywhere";
                            diffRow.style.minWidth = "0";
                            diffList.appendChild(diffRow);
                        });
                    }

                    if (item?._hasWhitelistOtherSegnalazioni) {
                        const whitelistNotice = document.createElement("div");
                        whitelistNotice.textContent = "(Altre segnalazioni presenti in whitelist)";
                        whitelistNotice.style.fontSize = "11px";
                        whitelistNotice.style.fontStyle = "italic";
                        whitelistNotice.style.opacity = "0.75";
                        whitelistNotice.style.marginTop = "2px";
                        whitelistNotice.style.whiteSpace = "normal";
                        diffList.appendChild(whitelistNotice);
                    }

                    const duplicateControl = this._crDuplicateControl(item, "recordCambiati");
                    left.appendChild(codice);
                    if (duplicateControl) {
                        left.appendChild(duplicateControl);
                    }
                    left.appendChild(diffList);

                    const actions = document.createElement("div");
                    actions.style.display = "flex";
                    actions.style.flexShrink = "0";
                    actions.style.alignItems = "flex-start";
                    actions.style.alignSelf = "flex-start";
                    actions.style.gap = "6px";

                    const btnFix = this._crIconButton("Fix", "images/fix.png");
                    const btnResolve = this._crIconButton("Risolvi segnalazione", "images/risolviSegnalazioni.png");
                    const btnWhitelist = this._confrontoReportState?.activeList === "whitelist"
                        ? this._crIconButton("Ripristina segnalazione", "images/rimuoviWhitelist.png")
                        : this._crIconButton("Manda in whitelist", "images/whitelist.png");
                    const btnFind = this._crIconButton("Trova", "images/leggiLog.png");
                    const btnInfo = this._crIconButton("Info", "images/info.png");

                    btnFix.dataset.payloadId = payloadId;
                    btnResolve.dataset.payloadId = payloadId;
                    btnWhitelist.dataset.payloadId = payloadId;
                    btnFind.dataset.payloadId = payloadId;
                    btnInfo.dataset.payloadId = payloadId;

                    btnFix.addEventListener("click", (ev) => this._onConfrontoAction(ev, "fix"));
                    btnResolve.addEventListener("click", (ev) => this._onConfrontoAction(ev, "resolve"));
                    btnWhitelist.addEventListener("click", (ev) => this._onConfrontoAction(ev, this._confrontoReportState?.activeList === "whitelist" ? "restoreWhitelist" : "whitelist"));
                    btnFind.addEventListener("click", (ev) => this._onConfrontoAction(ev, "find"));
                    btnInfo.addEventListener("click", (ev) => this._onConfrontoAction(ev, "info"));

                    if (this._confrontoReportState?.activeList !== "whitelist") {
                        actions.appendChild(btnFix);
                        actions.appendChild(btnResolve);
                    }
                    actions.appendChild(btnWhitelist);
                    actions.appendChild(btnFind);
                    actions.appendChild(btnInfo);

                    row.appendChild(left);
                    row.appendChild(actions);
                    content.appendChild(row);
                });
            });
        }

        btnFixAll.addEventListener("click", () => {
            this._confirmReportAction("massive", "Procedere con il fix massivo degli elementi modificati?").then(ok => {
                if (ok) {
                    console.log("TODO: Fix all cambiati", records);
                }
            });
        });

        this._confrontoCambiatiContent = content;

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    _getConfrontoVisibilityFilter() {
        return this._confrontoVisibilityFilter || "visible";
    },

    _setConfrontoVisibilityFilter(value) {
        this._confrontoVisibilityFilter = value;
    },

    _buildPanelEliminati(records) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent(true);

        const btnDeleteAll = this._crButton("Elimina tutti");
        const picker = this._crReportListPicker();
        if (this._confrontoReportState?.activeList !== "whitelist") {
            topbar.appendChild(btnDeleteAll);
        }
        topbar.appendChild(picker);

        const grouped = this._groupByPage(records);

        if (grouped.length === 0) {
            content.appendChild(this._crEmptyState("Nessun elemento eliminato"));
        } else {
            grouped.forEach(group => {
                if (!group.items.length) return;

                content.appendChild(this._crPageHeader(group.page, "uscito"));

                group.items.forEach(item => {

                    const payloadId = this._storeConfrontoPayload({
                        tipo: "uscito",
                        record: item,
                        elementoMappa: item.elementoMappa || null,
                        refId: item?.elementoMappa?.refId || null,
                        schedaRecords: item?.schedaRef?.records || null,
                        numeroPagina: item?.numeroPagina ?? item?.elementoMappa?.numeroPagina ?? null,
                        elementoPaginaMappa: item?.elementoPaginaMappa || null,
                        hidden: false
                    });

                    const row = this._crRow();
                    row.dataset.payloadId = payloadId;
                    row.dataset.pageNumber = String(group.page);
                    row.dataset.recordType = "uscito";
                    const duplicateInfo = this._getDuplicateInfo(item);
                    if (duplicateInfo) {
                        if (duplicateInfo.instanceId) {
                            row.dataset.duplicateInstanceId = duplicateInfo.instanceId;
                        }
                        if (duplicateInfo.key) {
                            row.dataset.duplicateKey = duplicateInfo.key;
                        }
                        this._styleDuplicateRow(row);
                    }

                    const codice = document.createElement("div");
                    codice.textContent = this._truncate(item.codiceGruppo || "-", 20);
                    codice.title = item.codiceGruppo || "";
                    codice.style.flex = "1 1 auto";
                    codice.style.minWidth = "0";
                    codice.style.fontWeight = "600";
                    codice.style.whiteSpace = "nowrap";
                    codice.style.overflow = "hidden";
                    codice.style.textOverflow = "ellipsis";

                    const left = document.createElement("div");
                    left.style.display = "flex";
                    left.style.flexDirection = "column";
                    left.style.flex = "1 1 auto";
                    left.style.minWidth = "0";
                    left.style.gap = "4px";

                    left.appendChild(codice);

                    const duplicateControl = this._crDuplicateControl(item, "recordUsciti");
                    if (duplicateControl) {
                        left.appendChild(duplicateControl);
                    }

                    const actions = document.createElement("div");
                    actions.style.display = "flex";
                    actions.style.flexShrink = "0";
                    actions.style.alignItems = "center";
                    actions.style.gap = "6px";

                    const btnFind = this._crIconButton("Trova", "images/leggiLog.png");
                    const btnDelete = this._crIconButton("Elimina", "images/icon_small_cestino.png");
                    const btnResolve = this._crIconButton("Risolvi segnalazione", "images/risolviSegnalazioni.png");
                    const btnWhitelist = this._confrontoReportState?.activeList === "whitelist"
                        ? this._crIconButton("Ripristina segnalazione", "images/rimuoviWhitelist.png")
                        : this._crIconButton("Manda in whitelist", "images/whitelist.png");
                    const btnInfo = this._crIconButton("Info", "images/info.png");

                    btnFind.dataset.payloadId = payloadId;
                    btnDelete.dataset.payloadId = payloadId;
                    btnResolve.dataset.payloadId = payloadId;
                    btnWhitelist.dataset.payloadId = payloadId;
                    btnInfo.dataset.payloadId = payloadId;

                    btnFind.addEventListener("click", (ev) => this._onConfrontoAction(ev, "find"));
                    btnDelete.addEventListener("click", (ev) => this._onConfrontoAction(ev, "delete"));
                    btnResolve.addEventListener("click", (ev) => this._onConfrontoAction(ev, "resolve"));
                    btnWhitelist.addEventListener("click", (ev) => this._onConfrontoAction(ev, this._confrontoReportState?.activeList === "whitelist" ? "restoreWhitelist" : "whitelist"));
                    btnInfo.addEventListener("click", (ev) => this._onConfrontoAction(ev, "info"));

                    if (this._confrontoReportState?.activeList !== "whitelist") {
                        actions.appendChild(btnDelete);
                        actions.appendChild(btnResolve);
                    }
                    actions.appendChild(btnWhitelist);
                    actions.appendChild(btnFind);
                    actions.appendChild(btnInfo);

                    row.appendChild(left);
                    row.appendChild(actions);
                    content.appendChild(row);
                });
            });
        }

        btnDeleteAll.addEventListener("click", () => {
            this._confirmReportAction("massive", "Procedere con l'eliminazione massiva degli elementi eliminati?").then(ok => {
                if (ok) {
                    console.log("TODO: Elimina tutti usciti", records);
                }
            });
        });

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    async _onConfrontoAction(ev, action) {
        const payloadId = ev.currentTarget?.dataset?.payloadId;
        const payload = this._getConfrontoPayload(payloadId);

        if (!payload) {
            console.warn("Payload non trovato:", payloadId);
            return;
        }

        switch (action) {
            case "find":
                this._findElemento(payload);
                break;

            case "info":
                this._openInfoReportRecord(payload.record);
                break;

            case "fix":
                this._findElemento(payload);
                await this._fixElemento(payloadId, payload);
                break;

            case "resolve":
                await this._resolveSegnalazione(payloadId, payload);
                break;

            case "whitelist":
                this._mandaInWhitelist(payloadId, payload);
                break;

            case "restoreWhitelist":
                this._ripristinaDaWhitelist(payloadId, payload);
                break;

            case "delete":
                this._deleteElemento(payloadId, payload);
                break;
        }
    },

    async _resolveSegnalazione(payloadId, payload) {
        const ok = await this._confirmReportAction("resolve", "Risolvi questa segnalazione?");
        if (!ok) return;

        const state = this._confrontoReportState;
        if (!state) return;

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordRisolto = payload.record;
        const duplicateInfo = this._getDuplicateInfo(recordRisolto);

        this._removeRecordFromArray(state.report?.[key], recordRisolto);
        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();

        if (duplicateInfo) {
            const altreIstanze = this._getDuplicateActiveRecords(duplicateInfo.key, { includeWhitelist: false });
            if (altreIstanze.length > 0) {
                const vaiAllaProssima = await Utility.confirm("Ci sono altre istanze non risolte di questo box duplicato. Vuoi andare alla prossima?");
                if (vaiAllaProssima) {
                    this._goToNextDuplicate(recordRisolto, key, false);
                }
            }
        }
    },

    _mandaInWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordDaSpostare = payload?.record?._fullReportRecord || payload.record;
        state.whitelist = state.whitelist || this._getEmptyWhitelistIntegrita();
        state.whitelist[key] = state.whitelist[key] || [];

        this._removeRecordFromArray(state.whitelist[key], recordDaSpostare);
        state.whitelist[key].push(this._cloneForReportStorage(recordDaSpostare));

        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();
    },

    _ripristinaDaWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordDaRipristinare = payload?.record?._fullReportRecord || payload.record;
        const recordWhitelistVisibile = payload.record;
        state.report[key] = state.report[key] || [];

        if (!state.report[key].some(item => this._sameReportRecord(item, recordDaRipristinare))) {
            state.report[key].push(this._cloneForReportStorage(recordDaRipristinare));
        }

        this._removeSegnalazioniFromWhitelistRecord(state.whitelist?.[key], recordWhitelistVisibile, key);
        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();
    },

    _removeSegnalazioniFromWhitelistRecord(arr, visibleRecord, key) {
        const list = arr || [];
        const targetRecord = visibleRecord?._fullWhitelistRecord || visibleRecord;
        const index = list.findIndex(item => this._sameReportRecord(item, targetRecord));
        if (index < 0) {
            return false;
        }

        if (key === "recordUsciti") {
            list.splice(index, 1);
            return true;
        }

        const visibleKeys = new Set(this._getRecordSegnalazioni(visibleRecord, key).map(item => item.key));
        const target = list[index];
        const differenze = Array.isArray(target?.preAnalisi?.differenze) ? target.preAnalisi.differenze : [];
        target.preAnalisi = target.preAnalisi || {};
        target.preAnalisi.differenze = differenze.filter(diff => !visibleKeys.has(this._getSegnalazioneKey(diff)));

        if (target.preAnalisi.differenze.length === 0) {
            list.splice(index, 1);
        }

        return true;
    },

    _toggleHiddenElemento(payloadId, iconEl) {
        const payload = this._getConfrontoPayload(payloadId);
        if (!payload) return;

        payload.hidden = !payload.hidden;

        if (iconEl) {
            iconEl.src = payload.hidden ? "images/sleep.png" : "images/wake.png";
            iconEl.title = payload.hidden ? "Nascosto" : "Visibile";
        }

        this._refreshCambiatiVisibility();
    },

    _crPageSection(pageNumber, recordType) {
        const root = document.createElement("div");
        root.dataset.pageSection = "true";
        root.dataset.pageNumber = String(pageNumber);
        root.dataset.recordType = recordType;
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.gap = "6px";
        root.style.marginBottom = "6px";

        const header = document.createElement("div");
        header.textContent = `Pagina ${pageNumber}`;
        header.dataset.pageHeader = "true";
        header.dataset.pageNumber = String(pageNumber);
        header.dataset.recordType = recordType;
        header.style.fontWeight = "700";
        header.style.padding = "10px 8px";
        header.style.marginTop = "6px";
        header.style.border = "1px solid #666";
        header.style.borderRadius = "4px";
        header.style.backgroundColor = "#E6F4EA";

        const notice = document.createElement("div");
        notice.dataset.pageHiddenNotice = "true";
        notice.dataset.pageNumber = String(pageNumber);
        notice.dataset.recordType = recordType;
        notice.textContent = "Ci sono elementi nascosti dalle attuali impostazioni di visualizzazione";
        notice.style.display = "none";
        notice.style.padding = "8px";
        notice.style.border = "1px dashed #666";
        notice.style.borderRadius = "4px";
        notice.style.opacity = "0.8";
        notice.style.fontSize = "11px";

        const rows = document.createElement("div");
        rows.dataset.pageRows = "true";
        rows.style.display = "flex";
        rows.style.flexDirection = "column";
        rows.style.gap = "6px";

        root.appendChild(header);
        root.appendChild(notice);
        root.appendChild(rows);

        return { root, header, notice, rows };
    },

    _refreshCambiatiVisibility() {
        const filter = this._getConfrontoVisibilityFilter();
        const $content = $(this._confrontoCambiatiContent);
        const $rows = $content.find('[data-record-type="cambiato"][data-payload-id]');

        $rows.each((index, el) => {
            const payloadId = el.dataset.payloadId;
            const payload = this._getConfrontoPayload(payloadId);

            if (!payload) {
                $(el).hide();
                return;
            }

            const isHidden = !!payload.hidden;

            let mustShow = false;
            if (filter === "visible") {
                mustShow = !isHidden;
            } else if (filter === "hidden") {
                mustShow = isHidden;
            } else {
                mustShow = true;
            }

            if (mustShow) {
                $(el).css("display", "flex");
            } else {
                $(el).hide();
            }
        });

        this._refreshCambiatiPageHeaders();
    },

    _crPageHiddenNotice(pageNumber, recordType) {
        const el = document.createElement("div");
        el.textContent = "Ci sono elementi nascosti dalle attuali impostazioni di visualizzazione";
        el.dataset.pageHiddenNotice = "true";
        el.dataset.pageNumber = String(pageNumber);
        el.dataset.recordType = recordType;

        el.style.display = "none";
        el.style.padding = "8px";
        el.style.border = "1px dashed #666";
        el.style.borderRadius = "4px";
        el.style.opacity = "0.8";
        el.style.fontSize = "11px";
        el.style.flexShrink = "0";

        return el;
    },

    _refreshCambiatiPageHeaders() {
        const $content = $(this._confrontoCambiatiContent);
        const filter = this._getConfrontoVisibilityFilter();

        const $headers = $content.find('[data-page-header="true"][data-record-type="cambiato"]');

        $headers.each((index, headerEl) => {
            const pageNumber = headerEl.dataset.pageNumber;

            const $header = $(headerEl);
            const $notice = $content.find(
                `[data-page-hidden-notice="true"][data-record-type="cambiato"][data-page-number="${pageNumber}"]`
            ).first();

            const $rows = $content.find(
                `[data-record-type="cambiato"][data-page-number="${pageNumber}"][data-payload-id]`
            );

            let totalRows = 0;
            let visibleRows = 0;
            let hiddenRows = 0;
            let shownRows = 0;

            $rows.each((i, rowEl) => {
                totalRows++;
                const payloadId = rowEl.dataset.payloadId;
                const payload = this._getConfrontoPayload(payloadId);

                if (!payload) {
                    return;
                }

                const isHidden = !!payload.hidden;
                if (isHidden) hiddenRows++;
                else visibleRows++;

                const isCurrentlyShown = rowEl.style.display !== "none";
                if (isCurrentlyShown) shownRows++;
            });

            if (totalRows === 0) {
                $header.hide();
                $notice.hide();
                return;
            }

            let showNotice = false;

            if (filter === "visible" && hiddenRows > 0 && shownRows === 0) {
                showNotice = true;
            }

            if (filter === "hidden" && visibleRows > 0 && shownRows === 0) {
                showNotice = true;
            }

            if (shownRows > 0 || showNotice) {
                $header.show();
            } else {
                $header.hide();
            }

            if (showNotice) {
                $notice.show();
            } else {
                $notice.hide();
            }
        });
    },

    _findElemento(payload) {
        const record = payload?.record;
        const box = this._resolveBoxFromRecord(record);

        if (!box) {
            messaggioUtente("Impossibile trovare l'elemento nel documento il riferimento potrebbe essere stato perso", "warning", false, 5);
            console.warn("Elemento non trovato");
            return;
        }

        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
        } catch (err) {
            console.error("Errore selezione:", err);
        }
    },

    _resolveBoxFromRecord(record) {
        const isDuplicato = !!this._getDuplicateInfo(record);
        const boxById = this._resolveBoxByInddId(record);
        if (boxById) {
            return boxById;
        }

        if (isDuplicato) {
            messaggioUtente("Il riferimento InDesign dell'istanza duplicata non è più valido. La ricerca proverà a selezionare la prima istanza trovata per codice gruppo.", "warning", false, 5, false, true);
        }

        return this._resolveBoxByCodiceGruppo(record);
    },

    _resolveBoxByInddId(record) {
        const refId = this._getRecordInddId(record);
        if (refId == null) {
            return null;
        }

        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? record?.elementoMappa?.numeroPagina ?? null;
        return this._findBoxByInddId(refId, pagina);
    },

    _getRecordInddId(record) {
        const refId = record?.duplicateInfo?.refId
            ?? record?.elementoMappa?.duplicateInfo?.refId
            ?? record?.inddId
            ?? record?.refId
            ?? record?.elementoMappa?.refId
            ?? null;

        if (refId == null || refId === "") {
            return null;
        }

        const parsed = Number(refId);
        return Number.isNaN(parsed) ? refId : parsed;
    },

    _findBoxByInddId(refId, pageName = null) {
        const matchesId = (item) => {
            try {
                return item && item.isValid && item.id === refId;
            } catch (e) {
                return false;
            }
        };

        const page = this._getDocumentPageByName(pageName);
        const boxInPage = this._findItemInCollection(page?.allPageItems, matchesId);
        if (boxInPage) {
            return boxInPage;
        }

        try {
            return this._findItemInCollection(app.activeDocument?.allPageItems, matchesId);
        } catch (err) {
            console.error("Errore ricerca box per id InDesign:", err);
            return null;
        }
    },

    _resolveBoxByCodiceGruppo(record) {
        const codiceGruppo = this._getRecordCodiceGruppo(record);
        if (!codiceGruppo) {
            return null;
        }

        const idRec = this._getRecordIdRec(record);
        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? record?.elementoMappa?.numeroPagina ?? null;

        const boxInPage = this._findBoxByCodiceGruppoInPage(codiceGruppo, idRec, pagina);
        if (boxInPage) {
            return boxInPage;
        }

        return this._findBoxByCodiceGruppoInDocument(codiceGruppo, idRec);
    },

    _getRecordCodiceGruppo(record) {
        return String(record?.codiceGruppo
            || record?.elementoMappa?.codiceGruppo
            || record?.schedaRef?.records?.[0]?.recordInTracciato?.["Scatto.CodiceGruppo"]
            || "").trim();
    },

    _getRecordIdRec(record) {
        const idRec = record?.elementoMappa?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.IdRec
            ?? null;

        if (idRec == null || idRec === "" || isNaN(parseInt(idRec))) {
            return null;
        }

        return parseInt(idRec);
    },

    _findBoxByCodiceGruppoInPage(codiceGruppo, idRec, pageName) {
        const page = this._getDocumentPageByName(pageName);
        if (!page) {
            return null;
        }

        return this._findBoxByCodiceGruppoInGroups(page.groups, codiceGruppo, idRec);
    },

    _findBoxByCodiceGruppoInDocument(codiceGruppo, idRec) {
        try {
            const doc = app.activeDocument;
            for (let i = 0; i < doc.pages.length; i++) {
                const page = doc.pages.item(i);
                const box = this._findBoxByCodiceGruppoInGroups(page.groups, codiceGruppo, idRec);
                if (box) {
                    return box;
                }
            }
        } catch (err) {
            console.error("Errore ricerca box per codice gruppo:", err);
        }

        return null;
    },

    _findBoxByCodiceGruppoInGroups(groups, codiceGruppo, idRec) {
        return this._findItemInCollection(groups, (group) => {
            try {
                if (!group || !group.isValid) {
                    return false;
                }

                const dna = Utility.getDnaOfBox(group);
                if (!dna || String(dna.codice_gruppo || "").trim() !== codiceGruppo) {
                    return false;
                }

                if (idRec != null) {
                    const dnaIdRec = dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec)) ? parseInt(dna.idRec) : null;
                    if (dnaIdRec != null && dnaIdRec !== idRec) {
                        return false;
                    }
                }

                return true;
            } catch (err) {
                return false;
            }
        });
    },

    _getDocumentPageByName(pageName) {
        if (pageName == null || pageName === "") {
            return null;
        }

        try {
            const page = app.activeDocument.pages.itemByName(String(pageName));
            return page && page.isValid ? page : null;
        } catch (err) {
            return null;
        }
    },

    _findItemInCollection(collection, predicate) {
        if (!collection) {
            return null;
        }

        try {
            const length = collection.length;
            for (let i = 0; i < length; i++) {
                const item = typeof collection.item === "function" ? collection.item(i) : collection[i];
                if (predicate(item)) {
                    return item;
                }
            }
        } catch (err) {
            console.error("Errore scansione collezione InDesign:", err);
        }

        return null;
    },

    _deleteElemento(payloadId, payload) {
        const record = payload?.record;
        const box = this._resolveBoxFromRecord(record);

        if (!box) {
            console.warn("Riferimento box mancante, impossibile eliminare");
            return;
        }

        try {
            if (!box.isValid) {
                console.warn("Il riferimento al box non è più valido");
                return;
            }

            box.remove();

            const key = this._getReportCategoryFromTipo(payload?.tipo);
            this._removeRecordFromArray(this._confrontoReportState?.report?.[key], record);
            this._removeConfrontoPayload(payloadId);
            this._saveCurrentReportAndWhitelist();
            this._refreshConfrontoReportUi();

        } catch (err) {
            console.error("Errore durante eliminazione box:", err);
        }
    },

    async _fixElemento(payloadId, payload) {
        const ok = await this._confirmReportAction("fixSingle", "Procedere con il fix di questa segnalazione?");
        if (!ok) return;

        const record = payload?.record;
        const schedaRecords = record?.schedaRef?.records;
        const numeroPagina = record?.numeroPagina;
        const elementoPaginaMappa = record?.elementoPaginaMappa;

        if (!schedaRecords) {
            console.warn("Fix impossibile: schedaRef.records mancante");
            return;
        }

        if (numeroPagina == null) {
            console.warn("Fix impossibile: numeroPagina mancante");
            return;
        }

        if (!elementoPaginaMappa) {
            console.warn("Fix impossibile: elementoPaginaMappa mancante");
            return;
        }

        try {
            var box = await impaginazioneSingoloIndd(
                schedaRecords,
                numeroPagina,
                true,
                elementoPaginaMappa,
                true,
                false
            );

            rimuoviSimboli();


            if (box != null){
                const key = this._getReportCategoryFromTipo(payload?.tipo);
                this._removeRecordFromArray(this._confrontoReportState?.report?.[key], record);
                this._removeConfrontoPayload(payloadId);
                this._saveCurrentReportAndWhitelist();
                this._refreshConfrontoReportUi();
            }
            console.log("Fix completato", payload);

        } catch (err) {
            console.error("Errore durante il fix:", err);
        }
    },

    _storeConfrontoPayload(payload) {
        const id = `confronto_${++this._confrontoReportCounter}`;
        this._confrontoReportStore.set(id, payload);
        return id;
    },

    _removeConfrontoPayload(payloadId) {
        if (!this._confrontoReportStore) return;
        this._confrontoReportStore.delete(payloadId);
    },

    _removeConfrontoRow(payloadId) {
        const row = document.querySelector(`[data-payload-id="${payloadId}"]`);
        if (!row) return;

        const pageNumber = row.dataset.pageNumber;
        const recordType = row.dataset.recordType;

        row.remove();

        if (!pageNumber || !recordType) return;

        const remainingRows = document.querySelectorAll(
            `[data-page-number="${pageNumber}"][data-record-type="${recordType}"][data-payload-id]`
        );

        if (remainingRows.length === 0) {
            const pageHeader = document.querySelector(
                `[data-page-header="true"][data-page-number="${pageNumber}"][data-record-type="${recordType}"]`
            );
            if (pageHeader) {
                pageHeader.remove();
            }
        }

        this._refreshCambiatiVisibility();
    },

    _getConfrontoPayload(id) {
        if (!this._confrontoReportStore) return null;
        return this._confrontoReportStore.get(id) || null;
    },

    _groupByPage(records) {
        const map = new Map();

        (records || []).forEach(item => {
            const page = String(item?.numeroPagina ?? item?.elementoMappa?.pagina ?? "?");
            if (!map.has(page)) {
                map.set(page, []);
            }
            map.get(page).push(item);
        });

        return [...map.entries()]
            .sort((a, b) => {
                const na = parseInt(a[0], 10);
                const nb = parseInt(b[0], 10);
                if (Number.isNaN(na) || Number.isNaN(nb)) {
                    return String(a[0]).localeCompare(String(b[0]));
                }
                return na - nb;
            })
            .map(([page, items]) => ({ page, items }));
    },

    _truncate(text, maxLen) {
        const value = String(text ?? "");
        if (value.length <= maxLen) return value;
        return value.slice(0, maxLen) + "...";
    },

    _crTabRoot() {
        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.flex = "1 1 auto";
        root.style.minHeight = "0";
        root.style.height = "100%";
        root.style.overflow = "hidden";
        root.style.boxSizing = "border-box";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.gap = "6px";
        header.style.padding = "0 0 8px 0";
        header.style.flexShrink = "0";
        header.style.boxSizing = "border-box";
        header.style.backgroundColor = "#e0eef4";


        const content = document.createElement("div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.flex = "1 1 auto";
        content.style.minHeight = "0";
        content.style.overflow = "hidden";
        //content.style.paddingTop = "8px";
        content.style.boxSizing = "border-box";

        root.appendChild(header);
        root.appendChild(content);

        return { root, header, content };
    },

    _crTabButton(label, active = false) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.type = "button";
        btn.title = "Mostra " + String(label || "").toLowerCase();
        btn.style.padding = "6px 10px";
        btn.style.border = "1px solid #666";
        btn.style.borderRadius = "4px";
        btn.style.cursor = "pointer";
        btn.style.opacity = active ? "1" : "0.7";
        btn.style.fontWeight = active ? "700" : "400";
        return btn;
    },

    _crPanel() {
        const panel = document.createElement("div");
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.flex = "1 1 auto";
        panel.style.minHeight = "0";
        panel.style.height = "100%";
        panel.style.overflow = "hidden";
        panel.style.boxSizing = "border-box";
        return panel;
    },

    _stylePanelForReportListMode(panel) {
        if (!panel) return;

        if (this._confrontoReportState?.activeList === "whitelist") {
            panel.style.backgroundColor = "#fff4d8";
            panel.style.padding = "6px";
        }
    },

    _crTabTopbar() {
        const topbar = document.createElement("div");
        topbar.style.display = "flex";
        topbar.style.alignItems = "center";
        topbar.style.gap = "8px";
        topbar.style.padding = "8px 0";
        topbar.style.borderBottom = "1px solid #555";
        topbar.style.flexShrink = "0";
        topbar.style.boxSizing = "border-box";
        topbar.style.width = "100%";
        return topbar;
    },

    _crScrollableContent() {
        const content = document.createElement("div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "6px";
        content.style.flex = "1 1 auto";
        content.style.minHeight = "0";
        content.style.minWidth = "0";
        content.style.overflowY = "scroll";
        content.style.overflowX = "hidden";
        content.style.padding = "8px 0";
        content.id = "confrontoContent";

        return content;
    },

    _crPageHeader(pageNumber, recordType) {
        const el = document.createElement("div");
        el.textContent = `Pagina ${pageNumber}`;
        el.dataset.pageHeader = "true";
        el.dataset.pageNumber = String(pageNumber);
        el.dataset.recordType = recordType;
        el.style.fontWeight = "700";
        el.style.padding = "10px 8px";
        el.style.marginTop = "6px";
        el.style.marginBottom = "6px";
        el.style.border = "1px solid #666";
        el.style.borderRadius = "4px";
        el.style.flexShrink = "0";
        el.style.backgroundColor = "#d6f5b3";
        return el;
    },

    _crRow() {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexDirection = "row";
        row.style.alignItems = "start";
        row.style.gap = "10px";
        row.style.padding = "8px";
        row.style.border = "1px solid #444";
        row.style.borderRadius = "4px";
        row.style.boxSizing = "border-box";
        row.style.width = "100%";

        // QUESTO è il punto importante
        row.style.flexShrink = "0";
        row.style.flexGrow = "0";
        row.style.flexBasis = "auto";

        return row;
    },

    _crButton(label, iconPath = null) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = label;
        btn.style.cursor = "pointer";
        btn.style.padding = "4px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.minWidth = "28px";
        btn.style.minHeight = "28px";
        btn.style.boxSizing = "border-box";

        if (iconPath) {
            const img = document.createElement("img");
            img.src = iconPath;
            img.alt = label;
            img.title = label;
            img.style.height = "16px";
            img.style.width = "auto";
            img.style.display = "block";
            btn.title = label;
            btn.appendChild(img);
        } else {
            btn.textContent = label;
            btn.style.padding = "4px 8px";
        }

        return btn;
    },

    _crEmptyState(text) {
        const el = document.createElement("div");
        el.textContent = text;
        el.style.padding = "12px 8px";
        el.style.opacity = "0.7";
        return el;
    },

    _crIconButton(label, iconPath) {
        const img = document.createElement("img");

        img.src = iconPath;
        img.alt = label;
        img.title = label;
        img.onerror = () => {
            if (iconPath.indexOf("risolviSegnalazioni.png") >= 0) img.src = "images/check.png";
            else if (iconPath.indexOf("whitelist.png") >= 0) img.src = "images/wake.png";
            else if (iconPath.indexOf("rimuoviWhitelist.png") >= 0) img.src = "images/sleep.png";
        };

        //img.style.width = "50px";
        img.style.height = "30px";
        img.style.padding = "4px";
        img.style.boxSizing = "content-box";

        img.style.border = "1px solid #666";
        img.style.borderRadius = "4px";
        img.style.cursor = "pointer";
        //img.style.background = "#827f7f";

        img.style.display = "inline-block";
        img.style.userSelect = "none";

        return img;
    },


    _buildPanelNuovi(report) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();

        const btnImpaginaTutti = this._crButton("Impagina in coda");
        btnImpaginaTutti.title = "Impagina tutto in coda al documento";

        const pickerLibreria = document.createElement("sp-picker");
        pickerLibreria.style.minWidth = "220px";

        const menuLibreria = document.createElement("sp-menu");
        menuLibreria.setAttribute("slot", "options");
        pickerLibreria.appendChild(menuLibreria);

        const btnRefreshLibreria = this._crIconButton("Refresh libreria", "images/refresh.png");

        topbar.appendChild(btnImpaginaTutti);
        topbar.appendChild(pickerLibreria);
        topbar.appendChild(btnRefreshLibreria);

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.flex = "1 1 auto";
        wrapper.style.minHeight = "0";
        wrapper.style.minWidth = "0";
        wrapper.style.overflow = "hidden";

        const tableScroll = document.createElement("div");
        tableScroll.style.flex = "1 1 auto";
        tableScroll.style.minHeight = "0";
        tableScroll.style.minWidth = "0";
        tableScroll.style.overflowX = "auto";
        tableScroll.style.overflowY = "auto";
        tableScroll.style.border = "1px solid #555";
        tableScroll.style.borderRadius = "4px";

        const table = document.createElement("div");
        table.style.display = "inline-flex";
        table.style.flexDirection = "column";
        table.style.alignItems = "flex-start";
        table.style.minWidth = "fit-content";

        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.flexShrink = "0";
        headerRow.style.width = "fit-content";
        headerRow.style.minWidth = "100%";

        const body = document.createElement("div");
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.width = "fit-content";
        body.style.minWidth = "100%";

        table.appendChild(headerRow);
        table.appendChild(body);
        tableScroll.appendChild(table);
        wrapper.appendChild(tableScroll);

        panel.appendChild(topbar);
        panel.appendChild(wrapper);

        let listaTracciato = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
        if (typeof listaTracciato === "string") {
            try {
                listaTracciato = JSON.parse(listaTracciato);
            } catch (err) {
                console.error("Errore parse listaKit:", err);
                listaTracciato = [];
            }
        }

        const colonneExtra = (pluginMiddleware?.getColonneTracciatoIntestazione?.() || []).map(col => ({
            nome: col?.nome || col?.name || col?.label || col?.chiaveDato || "",
            chiaveDato: col?.chiaveDato || col?.key || "",
            percColonna: Number(col?.percColonna || col?.width || 50)
        }));

        const rowsOriginal = this._confrontoReportState?.activeList === "whitelist"
            ? []
            : this._estraiNuoviDaLista(report, listaTracciato);

        this._confrontoNuoviState = {
            report,
            rowsOriginal,
            rowsCurrent: [...rowsOriginal],
            body,
            headerRow,
            colonneExtra,
            sortKey: null,
            sortDirection: null,

            pickerLibreria,
            menuLibreria,
            btnRefreshLibreria,
            libreriaCorrente: null,
            elementiLibreria: []
        };

        this._renderNuoviTable();
        this._refreshPickerLibreriaNuovi();

        btnRefreshLibreria.addEventListener("click", () => {
            this._refreshPickerLibreriaNuovi();
        });

        pickerLibreria.addEventListener("change", () => {
            const state = this._confrontoNuoviState;
            if (!state) return;
            state.selectedLibraryItemName = pickerLibreria.value || null;
        });

        btnImpaginaTutti.addEventListener("click", async () => {
            try {
                const ok = await this._confirmReportAction("massive", "Impaginare tutti i nuovi elementi in coda al documento?");
                if (ok) {
                    await this._impaginaTuttiNuoviInCoda();
                }
            } catch (err) {
                console.error("Errore impaginazione massiva nuovi:", err);
            }
        });

        return panel;
    },

    async _impaginaTuttiNuoviInCoda() {
        const state = this._confrontoNuoviState;
        if (!state) {
            console.error("Stato nuovi non disponibile.");
            return;
        }

        // if (!app.libraries || app.libraries.length === 0) {
        //     console.error("Nessuna libreria caricata.");
        //     return;
        // }

        // if (app.libraries.length > 1) {
        //     console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
        //     return;
        // }

        if (!state.libreriaCorrente || !state.libreriaCorrente.isValid) {
            console.error("Libreria selezionata non valida.");
            return;
        }

        const libraryAssets = this._getSelectedLibraryAssetNuovi();
        if (!libraryAssets || libraryAssets.length === 0) {
            console.error("Nessun asset compatibile trovato per la griglia selezionata.");
            return;
        }

        let queue = [...(state.rowsCurrent || [])];
        if (!queue.length) {
            console.log("Nessun nuovo elemento da impaginare.");
            return;
        }

        const totale = queue.length;
        let completati = 0;
        const startedAt = Date.now();

        try {
            await this._updateMassiveLoadingNuovi(completati, totale, startedAt);

            while (queue.length > 0) {
                const nuovaPagina = this._createPageAtEnd();
                if (!nuovaPagina) {
                    console.error("Impossibile creare una nuova pagina in coda al documento.");
                    return;
                }

                const assetScelto = this._chooseLibraryAssetForPage(libraryAssets, nuovaPagina);
                if (!assetScelto) {
                    console.error("Impossibile determinare la variante corretta della griglia per la pagina:", nuovaPagina?.name);
                    return;
                }

                const griglia = await this._placeSelectedGridAssetOnPage(assetScelto, nuovaPagina, "GRIGLIA");
                if (!griglia) {
                    console.error("Impossibile piazzare la griglia sulla pagina:", nuovaPagina?.name);
                    return;
                }

                const boxInGriglia = this._getValidGridBoxes(griglia);
                if (!boxInGriglia.length) {
                    console.error("La griglia piazzata non contiene box validi.");
                    return;
                }

                const impaginatiInQuestaPagina = [];
                const paginaNome = String(nuovaPagina.name || "").trim();

                for (let i = 0; i < boxInGriglia.length; i++) {
                    if (queue.length === 0) break;

                    const rowData = queue.shift();
                    const box = boxInGriglia[i];
                    const boxBounds = this._getBoundsFromPageItem(box);

                    if (!boxBounds) {
                        console.error("Impossibile leggere i bounds del box:", box);
                        completati++;
                        await this._updateMassiveLoadingNuovi(completati, totale, startedAt);
                        continue;
                    }

                    const records = [{
                        recordInTracciato: rowData.raw
                    }];

                    try {
                        await impaginazioneSingoloIndd(
                            records,
                            paginaNome,
                            false,
                            null,
                            true,
                            false,
                            boxBounds,
                            true
                        );

                        impaginatiInQuestaPagina.push(rowData);

                    } catch (err) {
                        console.error("Errore durante impaginazione massiva del record:", rowData, err);
                    }

                    completati++;
                    await this._updateMassiveLoadingNuovi(completati, totale, startedAt);
                }

                rimuoviSimboli();


                for (let i = 0; i < impaginatiInQuestaPagina.length; i++) {
                    this._removeNuovoRowData(impaginatiInQuestaPagina[i], false);
                }

                try {
                    griglia.remove();
                } catch (err) {
                    console.error("Errore rimozione griglia dopo impaginazione:", err);
                }

                this._renderNuoviTable();
                queue = [...(this._confrontoNuoviState?.rowsCurrent || [])];
            }

        } finally {
            hideLoading();
        }
    },

    _createPageAtEnd() {
        try {
            const doc = app.activeDocument;
            return doc.pages.add(LocationOptions.AT_END);
        } catch (err) {
            console.error("Errore creazione pagina in fondo al documento:", err);
            return null;
        }
    },

    _formatSecondsToHuman(seconds) {
        const s = Math.max(0, Math.round(seconds));

        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;

        if (hh > 0) {
            return `${hh}h ${mm}m ${ss}s`;
        }

        if (mm > 0) {
            return `${mm}m ${ss}s`;
        }

        return `${ss}s`;
    },

    async _updateMassiveLoadingNuovi(completati, totale, startedAt, sampleCount = 5) {
        let msg = `Impaginazione nuovi in corso... ${completati}/${totale}`;

        if (completati > 0) {
            const elapsedSec = (Date.now() - startedAt) / 1000;
            const baseCount = Math.min(completati, sampleCount);

            if (baseCount > 0) {
                const avgSec = elapsedSec / completati;
                const remaining = Math.max(0, totale - completati);
                const etaSec = avgSec * remaining;

                msg += `\nTempo trascorso: ${this._formatSecondsToHuman(elapsedSec)}`;
                msg += `\nTempo stimato rimanente: ${this._formatSecondsToHuman(etaSec)}`;
            }
        }

        showLoading(msg);
        await Utility.sleep(1);
    },

    _chooseLibraryAssetForPage(assets, pagina) {
        if (!assets || !assets.length || !pagina) return null;

        const pageName = String(pagina.name || "").trim();
        const pageNum = parseInt(pageName, 10);

        const isRightPage = !Number.isNaN(pageNum) ? (pageNum % 2 !== 0) : true;
        const suffixWanted = isRightPage ? "_DX" : "_SX";

        let fallback = null;

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const name = String(asset?.name || "").trim();

            if (!name) continue;
            if (!fallback) fallback = asset;

            if (name.toUpperCase().endsWith(suffixWanted)) {
                return asset;
            }
        }

        return fallback;
    },

    async _placeSelectedGridAssetOnPage(asset, pagina, nomeLayer = "GRIGLIA") {
        if (!asset || !pagina) return null;

        try {
            const doc = app.activeDocument;
            let layer = null;

            try {
                layer = doc.layers.itemByName(nomeLayer);
                if (layer && !layer.isValid) layer = null;
            } catch (e) {
                layer = null;
            }

            if (!layer) {
                console.error("Layer non trovato:", nomeLayer);
                return null;
            }

            let grigliaObj = asset.placeAsset(docInLavorazione)[0];
            var offsetPag = 0;
            var wPage = pagina.bounds[3] - pagina.bounds[1];
            if (parseInt(pagina.name) % 2 != 0 && parseInt(pagina.name) > 1) {
                offsetPag += wPage;
            }
            grigliaObj.move([offsetPag, 0]);

            return grigliaObj;

        } catch (err) {
            console.error("Errore piazzamento griglia:", err);
            return null;
        }
    },

    _getValidGridBoxes(griglia) {
        const boxInGriglia = [];

        try {
            if (!griglia || !griglia.groups) return boxInGriglia;

            for (let iG = 0; iG < griglia.groups.length; iG++) {
                const gruppo = griglia.groups.item(iG);
                const label = String(gruppo?.label || "").trim();

                if (!label) continue;
                if (!label.toLowerCase().startsWith("box_")) continue;

                boxInGriglia.push(gruppo);
            }

            boxInGriglia.sort((a, b) => {
                const labelA = String(a?.label || "");
                const labelB = String(b?.label || "");

                const numA = parseInt(labelA.split("_")[1], 10);
                const numB = parseInt(labelB.split("_")[1], 10);

                const safeA = Number.isNaN(numA) ? 999999 : numA;
                const safeB = Number.isNaN(numB) ? 999999 : numB;

                return safeA - safeB;
            });

        } catch (err) {
            console.error("Errore lettura box griglia:", err);
        }

        return boxInGriglia;
    },

    _getBoundsFromPageItem(item) {
        if (!item) return null;

        try {
            if (item.geometricBounds && item.geometricBounds.length === 4) {
                return item.geometricBounds;
            }
        } catch (err) {
            console.error("Errore lettura geometricBounds:", err);
        }

        return null;
    },

    _appendPickerPlaceholder(menu, label) {
        const item = document.createElement("sp-menu-item");
        item.value = "";
        item.textContent = label;
        item.setAttribute("selected", "selected");
        menu.appendChild(item);
    },

    _refreshPickerLibreriaNuovi() {
        const state = this._confrontoNuoviState;
        if (!state || !state.menuLibreria || !state.pickerLibreria) return;

        const menu = state.menuLibreria;
        const picker = state.pickerLibreria;

        menu.innerHTML = "";
        state.libreriaCorrente = null;
        state.elementiLibreria = [];
        state.selectedLibraryItemName = null;

        try {
            var libreria = null;
            try {
                libreria = pluginMiddleware.getLibreria();
            } catch (errLib) {
                console.warn("Libreria configurata non disponibile, uso fallback:", errLib);
                libreria = null;
            }
            if (libreria == null || !libreria.isValid) {
                if (!app.libraries || app.libraries.length === 0) {
                    console.error("Nessuna libreria caricata.");
                    this._appendPickerPlaceholder(menu, "Nessuna libreria");
                    return;
                }

                if (app.libraries.length > 1) {
                    console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
                    this._appendPickerPlaceholder(menu, "Troppe librerie");
                    return;
                }

                var nomeLibreria = "";
                if (nomeLibreria == null) {
                    nomeLibreria = pluginMiddleware.getCampo("nomeLibreriaIndd");
                }
                if (ficoProcess.getTipoLavorazioneCorrente() == 1 && app.libraries.length == 0) {
                    if (nomeLibreria) {
                        messaggioUtente("Code IDX-11 Filtro: Non è stata caricata la libreria " + nomeLibreria, "Error", false, 5);
                    }
                    else {
                        messaggioUtente("Code IDX-12 Filtro: Non è stata caricata nessuna libreria", "Error", false, 5);
                    }
                    hideLoading();

                    cbkEnd?.("error");

                    return;
                }
                else if (nomeLibreria) {
                    //cerchiamo una libreria che abbia nel nome quello specificato
                    // for (var i = 0; i < app.libraries.length; i++) {
                    //     var lib = app.libraries.item(i);
                    //     if (lib.name && lib.name.indexOf(nomeLibreria) === 0) {
                    //         libreria = lib;
                    //         break;
                    //     }
                    // }
                    libreria = app.libraries.itemByName(nomeLibreria);
                }
                else if (app.libraries.length == 1) {
                    libreria = app.libraries.item(0);
                }

                if (libreria == null || !libreria.isValid) {
                    if (nomeLibreria) {
                        messaggioUtente("Code IDX-13 Filtro: Non è stata trovata la libreria " + nomeLibreria, "Error", false, 5);
                    }
                    else if (app.libraries.length > 1) {
                        messaggioUtente("Code IDX-14 Filtro: Sono caricate librerie multiple, chiudere tutte le librerie eccetto quella di impaginazione prima di procedere", "Error", false, 5);
                    }
                    else {
                        messaggioUtente("Code IDX-15 Filtro: Non è stata trovata la libreria", "Error", false, 5);
                    }
                    hideLoading();
                    cbkEnd?.("error");
                    return;
                }
            }

            state.libreriaCorrente = libreria;

            const nomiBaseUnici = new Set();
            let foundAny = false;

            for (let i = 0; i < libreria.assets.length; i++) {
                const asset = libreria.assets.item(i);
                const nomeCompleto = String(asset?.name || "").trim();
                if (!nomeCompleto) continue;

                foundAny = true;
                state.elementiLibreria.push(asset);

                const nomeBase = this._normalizeLibraryGridName(nomeCompleto);
                if (!nomeBase) continue;

                if (nomiBaseUnici.has(nomeBase)) continue;
                nomiBaseUnici.add(nomeBase);

                const item = document.createElement("sp-menu-item");
                item.value = nomeBase;
                item.textContent = nomeBase;

                if (nomiBaseUnici.size === 1) {
                    item.setAttribute("selected", "selected");
                    state.selectedLibraryItemName = nomeBase;
                }

                menu.appendChild(item);
            }

            if (!foundAny) {
                console.error("La libreria è presente ma non contiene elementi.");
                this._appendPickerPlaceholder(menu, "Libreria vuota");
                return;
            }

            if (nomiBaseUnici.size === 0) {
                console.error("La libreria non contiene griglie valide.");
                this._appendPickerPlaceholder(menu, "Nessuna griglia valida");
                return;
            }

            picker.value = state.selectedLibraryItemName || "";

        } catch (err) {
            console.error("Errore durante il refresh della libreria:", err);
            this._appendPickerPlaceholder(menu, "Errore libreria");
        }
    },

    _normalizeLibraryGridName(nome) {
        const value = String(nome || "").trim();
        if (!value) return "";

        return value.replace(/_(DX|SX)$/i, "");
    },

    _getSelectedLibraryAssetNuovi() {
        const state = this._confrontoNuoviState;
        if (!state) return [];

        // if (!app.libraries || app.libraries.length === 0) {
        //     console.error("Nessuna libreria caricata.");
        //     return [];
        // }

        // if (app.libraries.length > 1) {
        //     console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
        //     return [];
        // }

        if (!state.libreriaCorrente || state.libreriaCorrente.isValid === false) {
            console.error("Libreria corrente non valida.");
            return [];
        }

        const selectedName = state.pickerLibreria?.value || state.selectedLibraryItemName || "";
        if (!selectedName) return [];

        const matches = [];

        for (let i = 0; i < state.elementiLibreria.length; i++) {
            const asset = state.elementiLibreria[i];
            const assetName = String(asset?.name || "").trim();
            if (!assetName) continue;

            const normalized = this._normalizeLibraryGridName(assetName);
            if (normalized === String(selectedName)) {
                matches.push(asset);
            }
        }

        return matches;
    },

    _estraiNuoviDaLista(report, listaTracciato) {
        const codiciPresenti = new Set();

        const addCodici = (arr) => {
            (arr || []).forEach(item => {
                const codice = String(item?.codiceGruppo || "").trim();
                if (codice) {
                    codiciPresenti.add(codice);
                }
            });
        };

        addCodici(report?.recordCambiati);
        addCodici(report?.recordUsciti);
        addCodici(report?.recordGiusti);
        addCodici(report?.recordConErrori);
        addCodici(report?.recordNuoviRisolti);

        let lista = [];
        if (Array.isArray(listaTracciato)) {
            lista = listaTracciato;
        } else if (Array.isArray(listaTracciato?.records)) {
            lista = listaTracciato.records;
        }

        const result = [];

        for (let i = 0; i < lista.length; i++) {
            const item = lista[i].recordInTracciato;
            if (Number(item?.StatoSelezione) !== 1) continue;

            const codiceGruppo = String(item["Scatto.CodiceGruppo"] || "").trim();
            if (!codiceGruppo) continue;

            if (codiciPresenti.has(codiceGruppo)) continue;

            result.push({
                raw: item,
                originalIndex: i,
                codiceGruppo,
                descrizione: this._getDescrizioneNuovo(item)
            });
        }

        return result;
    },

    _getDescrizioneNuovo(item) {
        const src = item?.descrizione_gruppo || item || {};

        const candidates = [
            "Descrizioni.Descrizione1", "Descrizioni.Descrizione2", "Descrizioni.Descrizione3", "Descrizioni.Descrizione4",
        ];

        const parts = [];

        for (let i = 0; i < candidates.length; i++) {
            const key = candidates[i];
            const val = src?.[key];
            if (val != null && String(val).trim() !== "") {
                parts.push(String(val).trim());
            }
        }

        return parts.join(" - ");
    },

    _renderNuoviTable() {
        const state = this._confrontoNuoviState;
        if (!state) return;

        state.headerRow.innerHTML = "";
        state.body.innerHTML = "";

        const colonneBase = [
            {
                key: "__azione__",
                label: "Imp.",
                perc: 55,
                minPx: 130,
                sortable: false
            },
            {
                key: "codiceGruppo",
                label: "Codice gruppo",
                perc: 70,
                minPx: 140,
                sortable: true
            },
            {
                key: "descrizione",
                label: "Descrizione",
                perc: 120,
                minPx: 240,
                sortable: true,
                small: true
            }
        ];

        const colonneExtra = (state.colonneExtra || []).map(col => ({
            key: col.chiaveDato,
            label: col.nome,
            perc: Number(col.percColonna || 50),
            minPx: Math.max(90, Math.round((Number(col.percColonna || 50) / 50) * 90)),
            sortable: true
        }));

        //rimuoviamo aventuali colonneExtra con chiave codice, descrizione o codiceGruppo se ci sono, per evitare duplicati
        const colonneExtraFiltrate = colonneExtra.filter(col => {
            const key = col.key.toLowerCase();
            return key !== "codicegruppo" && key !== "descrizione" && key !== "codice";
        });

        const colonne = [...colonneBase, ...colonneExtraFiltrate];
        state.colonneRender = colonne;

        for (let i = 0; i < colonne.length; i++) {
            state.headerRow.appendChild(this._crNuoviHeaderCell(colonne[i]));
        }

        if (!state.rowsCurrent.length) {
            const empty = document.createElement("div");
            empty.textContent = "Nessun nuovo elemento trovato";
            empty.style.padding = "12px 8px";
            empty.style.opacity = "0.7";
            state.body.appendChild(empty);
            return;
        }

        for (let i = 0; i < state.rowsCurrent.length; i++) {
            state.body.appendChild(this._crNuoviDataRow(state.rowsCurrent[i], colonne));
        }
    },

    _crNuoviHeaderCell(col) {
        const state = this._confrontoNuoviState;

        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.padding = "8px";
        cell.style.minHeight = "34px";
        cell.style.maxHeight = "34px";
        cell.style.fontWeight = "700";
        cell.style.borderRight = "1px solid #ddd";
        cell.style.overflow = "hidden";
        cell.style.whiteSpace = "nowrap";
        cell.style.textOverflow = "ellipsis";
        cell.style.width = this._calcNuoviColumnWidth(col);
        cell.style.minWidth = this._calcNuoviColumnWidth(col);

        let label = col.label;
        if (col.sortable && state.sortKey === col.key) {
            if (state.sortDirection === "asc") label += " ▲";
            else if (state.sortDirection === "desc") label += " ▼";
        }

        cell.textContent = label;
        cell.title = col.label;

        if (col.sortable) {
            cell.style.cursor = "pointer";
            cell.addEventListener("click", () => {
                this._toggleNuoviSort(col.key);
            });
        }

        return cell;
    },

    _crNuoviDataRow(rowData, colonne) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexShrink = "0";
        row.style.minHeight = "42px";
        row.style.maxHeight = "42px";
        row.style.borderBottom = "1px solid #eee";
        row.style.width = "fit-content";
        row.style.minWidth = "100%";

        for (let i = 0; i < colonne.length; i++) {
            const col = colonne[i];

            if (col.key === "__azione__") {
                row.appendChild(this._crNuoviActionCell(rowData));
                continue;
            }

            let value = "";
            if (col.key === "codiceGruppo") {
                value = rowData.codiceGruppo || "";
            } else if (col.key === "descrizione") {
                value = rowData.descrizione || "";
            } else {
                const rawVal = this._getRawValueForNuoviColumn(rowData?.raw, col.key);
                value = rawVal == null ? "" : String(rawVal);
            }

            row.appendChild(this._crNuoviTextCell(value, col, !!col.small));
        }

        return row;
    },

    _crNuoviActionCell(rowData) {
        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.gap = "6px";
        cell.style.padding = "6px 8px";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.width = "130px";
        cell.style.minWidth = "130px";
        cell.style.borderRight = "1px solid #eee";
        cell.style.minHeight = "42px";
        cell.style.maxHeight = "42px";

        const btn = this._crButton("Imp.");
        btn.title = "Impagina questo nuovo record";
        btn.style.padding = "4px 6px";
        btn.style.minWidth = "0";
        btn.style.fontSize = "10px";
        btn.style.lineHeight = "1";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 3;
        input.placeholder = "Pag";
        input.style.width = "36px";
        input.style.minWidth = "36px";
        input.style.textAlign = "center";

        btn.addEventListener("click", async () => {
            try {
                await this._impaginaNuovoSingolo(rowData, input);
            } catch (err) {
                console.error("Errore impaginazione nuovo singolo:", rowData, err);
            }
        });

        const btnInfo = this._crIconButton("Info", "images/info.png");
        btnInfo.style.height = "22px";
        btnInfo.addEventListener("click", () => {
            this._openInfoReportRecord({ raw: rowData.raw, codiceGruppo: rowData.codiceGruppo });
        });

        cell.appendChild(btn);
        cell.appendChild(input);
        cell.appendChild(btnInfo);

        return cell;
    },

    _crNuoviTextCell(value, col, small = false) {
        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.padding = "6px 8px";
        cell.style.borderRight = "1px solid #eee";
        cell.style.width = this._calcNuoviColumnWidth(col);
        cell.style.minWidth = this._calcNuoviColumnWidth(col);
        cell.style.minHeight = "42px";
        cell.style.maxHeight = "42px";
        cell.style.overflow = "hidden";
        cell.style.cursor = "pointer";

        const text = document.createElement("div");
        text.textContent = value || "";
        text.title = value || "";
        text.style.width = "100%";
        text.style.overflow = "hidden";
        text.style.whiteSpace = "nowrap";
        text.style.textOverflow = "ellipsis";
        text.style.lineHeight = "1.2";
        text.style.fontSize = small ? "11px" : "12px";

        cell.title = value || "";

        cell.addEventListener("click", () => {
            navigator.clipboard.writeText(String(value || "")).then(() => {
                const oldBg = cell.style.backgroundColor;
                cell.style.backgroundColor = "#dff0d8";
                setTimeout(() => {
                    cell.style.backgroundColor = oldBg || "";
                }, 700);
            }).catch(err => {
                console.error("Errore copia clipboard:", err);
            });
        });

        cell.appendChild(text);
        return cell;
    },

    _getRawValueForNuoviColumn(raw, key) {
        if (!raw || !key) return "";

        if (raw[key] != null) {
            return raw[key];
        }

        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "codice") {
            return raw["Referenza.Codice"] ?? raw.codice ?? "";
        }

        if (lowerKey === "descrizione") {
            return this._getDescrizioneNuovo(raw);
        }

        const match = Object.keys(raw).find(k => k.toLowerCase() === lowerKey);
        return match ? raw[match] : "";
    },

    _calcNuoviColumnWidth(col) {
        const perc = Number(col?.perc || 50);
        const minPx = Number(col?.minPx || 90);
        const proportionalPx = Math.round((perc / 50) * 90);
        return `${Math.max(minPx, proportionalPx)}px`;
    },

    _toggleNuoviSort(key) {
        const state = this._confrontoNuoviState;
        if (!state) return;

        if (state.sortKey !== key) {
            state.sortKey = key;
            state.sortDirection = "asc";
        } else if (state.sortDirection === "asc") {
            state.sortDirection = "desc";
        } else if (state.sortDirection === "desc") {
            state.sortKey = null;
            state.sortDirection = null;
        } else {
            state.sortDirection = "asc";
        }

        state.rowsCurrent = [...state.rowsOriginal];

        if (state.sortKey && state.sortDirection) {
            const dir = state.sortDirection === "asc" ? 1 : -1;
            const sortKey = state.sortKey;

            state.rowsCurrent.sort((a, b) => {
                let va = "";
                let vb = "";

                if (sortKey === "codiceGruppo") {
                    va = a.codiceGruppo || "";
                    vb = b.codiceGruppo || "";
                } else if (sortKey === "descrizione") {
                    va = a.descrizione || "";
                    vb = b.descrizione || "";
                } else {
                    va = a?.raw?.[sortKey] != null ? String(a.raw[sortKey]) : "";
                    vb = b?.raw?.[sortKey] != null ? String(b.raw[sortKey]) : "";
                }

                return va.localeCompare(vb, undefined, {
                    numeric: true,
                    sensitivity: "base"
                }) * dir;
            });
        }

        this._renderNuoviTable();
    },

    async _impaginaNuovoSingolo(rowData, inputEl = null) {
        if (!rowData || !rowData.raw) {
            console.error("Impaginazione singolo nuovo: rowData non valido");
            return;
        }

        let pagina = "";

        if (inputEl && inputEl.value != null) {
            pagina = String(inputEl.value).trim();
        }

        if (!pagina) {
            let paginaCorrente = "";

            try {
                paginaCorrente = pagSelected;
            } catch (err) {
                console.error("Impossibile leggere la pagina corrente di InDesign:", err);
            }

            if (!paginaCorrente) {
                console.error("Nessuna pagina specificata e impossibile determinare la pagina corrente.");
                return;
            }

            const conferma = await Utility.confirm(
                "Non hai specificato una pagina. La referenza verrà impaginata nella pagina corrente: " + paginaCorrente + ". Continuare?"
            );

            if (!conferma) {
                return;
            }

            pagina = paginaCorrente;
        }

        const records =[{
           recordInTracciato : rowData.raw
        }];
            

        try {
            await impaginazioneSingoloIndd(
                records,
                pagina,
                false,
                null,
                false,
                false,
                null,
                true
            );

            this._removeNuovoRowData(rowData);
        } catch (err) {
            console.error("Errore durante impaginazioneSingoloIndd:", err);
        }
    },

    _removeNuovoRowData(rowData, rerender = true) {
        const state = this._confrontoNuoviState;
        if (!state || !rowData) return;

        const sameRow = (item) => {
            if (!item) return false;

            if (item === rowData) return true;

            if (item.originalIndex != null && rowData.originalIndex != null) {
                return item.originalIndex === rowData.originalIndex;
            }

            if (item.raw && rowData.raw) {
                return item.raw === rowData.raw;
            }

            return false;
        };

        state.rowsOriginal = (state.rowsOriginal || []).filter(item => !sameRow(item));
        state.rowsCurrent = (state.rowsCurrent || []).filter(item => !sameRow(item));

        if (rerender) {
            this._renderNuoviTable();
        }
    },

    //#endregion
};

module.exports = confronti;
