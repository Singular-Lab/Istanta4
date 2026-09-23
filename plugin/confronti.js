const InputEditController = require('./InputEditController');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const { app, PDFExportOptions, CompressionQuality } = require('indesign');
const fs = require('fs');
const { parse } = require('path');
const GarbageCollector = require('./garbageCollector');
const { ref } = require('process');
const NoRenderElementi = require('./noRenderElementi');
const reportIntegritaAvvio = require('./reportIntegritaAvvio');
const reportConfrontoCsv = require('./reportConfrontoCsv');
const reportConteggi = require('./reportConteggi');
const reportConfronti = require('./reportConfronti');
const barraScorrimento = require('./barraScorrimento');

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
        //I20-981: le soglie (oltre quattro ore si rifa' senza chiedere, oltre due la data va
        //in evidenza) stanno in reportIntegritaAvvio, dove si possono verificare.
        const createdAt = wrapper?.createdAt || wrapper?.createdAtLabel;
        const decisione = reportIntegritaAvvio.decidiReportEsistente(createdAt);

        if (!decisione.chiedi) {
            return "new";
        }

        const oldStyle = decisione.vecchio ? "color:#b00020;font-weight:700;" : "color:#111;";
        const message = "Esiste già un report integrità creato in data "
            + "<span style=\"" + oldStyle + "\">" + this._formatReportDate(decisione.data) + "</span>.";

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
        //I20-981: tre pulsanti da novanta pixel non stavano in un riquadro largo il 60% del
        //pannello e uscivano di lato. Ora il riquadro e' largo quasi quanto il pannello e i
        //pulsanti vanno a capo.
        const dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        const body = $('<div style="flex:1 1 auto; min-height:0; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const buttons = $('<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; flex:0 0 auto; padding-top:12px;"></div>');

        actions.forEach(action => {
            const btn = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:' + action.color + '; color:white; border:none; border-radius:5px; cursor:pointer;">' + action.label + '</button>');
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

    //I20-981: il report resta aperto su un documento preciso e tiene isBusy per se'.
    //Chi lo chiude, a mano o perche' il documento e' cambiato, passa da qui: cosi' lo stato,
    //il busy e le finestre restano coerenti.
    _reportIntegritaAperto: false,
    _documentoDelReport: "",

    reportIntegritaAperto() {
        return this._reportIntegritaAperto === true;
    },

    documentoDelReport() {
        return this._documentoDelReport || "";
    },

    chiudiReportIntegrita(motivo = null) {
        if (!this.reportIntegritaAperto()) {
            return false;
        }

        //Il report puo' chiudersi mentre l'operatore sta nella scheda di una sua referenza
        //(succede al cambio di documento): la scheda va smontata, ma senza ricontrollare
        //niente, perche' il report a cui il ricontrollo servirebbe non c'e' piu'.
        if (this._schedaDalReport != null) {
            const schedaAperta = this._schedaDalReport;
            this._schedaDalReport = null;

            if (schedaAperta.timer != null) {
                clearInterval(schedaAperta.timer);
            }

            this._terminaSchedaDalReport();
        }

        this._reportIntegritaAperto = false;
        this._documentoDelReport = "";

        try {
            $("#confrontoInfoOverlay").remove();
            Utility.chiudiModal();
        }
        catch (err) {
            console.error("Errore durante la chiusura del report integrità:", err);
        }

        if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
            indesignEvents.setBusy(false);
        }

        if (motivo != null) {
            messaggioUtente("Report integrità chiuso: " + motivo, "warning", false, 6);
        }

        return true;
    },


    //I20-981 (Lotto 4a): la scheda referenza aperta dal report. Non e' una copia della scheda:
    //e' la scheda vera, mostrata al posto del report. Una copia avrebbe voluto dire duplicare
    //il markup di index.html e i suoi id, cioe' due schede destinate ad allontanarsi; e in
    //ogni caso i modal della scheda (info, noRender, cambia foto) svuotano #bodyModal, che e'
    //dove vive il report: sotto la scheda il report non sopravvivrebbe comunque. Percio' il
    //report si chiude e si riapre dal suo stato, che e' in memoria e su disco.

    //Ogni quanto si controlla che la scheda sia ancora agganciata al suo box e che la
    //navigazione resti bloccata. La scheda si ridisegna da sola e diversi suoi flussi
    //liberano gli eventi uscendo: il blocco va riaffermato, non solo impostato.
    INTERVALLO_VIGILANZA_SCHEDA: 600,
    //Oltre questo tempo la rilettura della scheda dal server si considera persa: meglio
    //lasciare il report com'era che restare appesi con il caricamento davanti.
    ATTESA_MASSIMA_RILETTURA_SCHEDA: 20000,

    schedaDalReportAperta() {
        return this._schedaDalReport != null;
    },

    //I20-981: il tracciato di quello che la scheda aperta dal report fa davvero. Il collaudo
    //vede il risultato ma non il percorso, e senza il percorso si tira a indovinare: qui ogni
    //passo lascia una riga in logs/schedaDalReport.log nella cartella di lavorazione, oltre
    //che in console. Non puo' mai fermare il flusso: se non riesce a scrivere, tace.
    FILE_TRACCIATO_SCHEDA: "/logs/schedaDalReport.log",

    _tracciaScheda(evento, dati) {
        try {
            const riga = "[" + new Date().toISOString() + "] " + evento +
                (dati != null ? " | " + JSON.stringify(dati) : "");

            console.log("SchedaDalReport " + riga);

            const percorso = pathLavorazione + this.FILE_TRACCIATO_SCHEDA;
            let contenuto = "";

            try {
                contenuto = fs.readFileSync(percorso, "utf8") || "";
            }
            catch (err) {
                contenuto = "";
            }

            fs.writeFileSync(percorso, contenuto + riga + "\n");
        }
        catch (err) {
            console.error("Tracciato della scheda non scritto:", err);
        }
    },

    _descriviBox(box) {
        try {
            if (box == null) {
                return { presente: false };
            }

            return {
                presente: true,
                valido: box.isValid === true,
                id: box.isValid ? box.id : null,
                pagina: box.isValid && box.parentPage != null ? box.parentPage.name : null
            };
        }
        catch (err) {
            return { presente: true, valido: false, errore: String(err) };
        }
    },

    _descriviRecord(record) {
        try {
            const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
            return {
                codiceGruppo: record?.codiceGruppo || null,
                inddId: record?.inddId ?? null,
                refIdMappa: record?.elementoMappa?.refId ?? null,
                numeroPagina: record?.numeroPagina ?? null,
                duplicato: record?.duplicateInfo != null,
                recordsScheda: Array.isArray(record?.schedaRef?.records) ? record.schedaRef.records.length : null,
                differenze: differenze.map(d => (d?.label || "") + ": " + (d?.difference || "") + (d?.origine ? " [" + d.origine + "]" : "")),
                errori: Array.isArray(record?.preAnalisi?.errors) ? record.preAnalisi.errors : []
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    _descriviDatiConfronto(records) {
        try {
            const dati = typeof datiPrimarioPerConfronto === "function" ? datiPrimarioPerConfronto(records) : null;
            if (dati == null) {
                return { primario: false, records: (records || []).length };
            }

            return {
                primario: true,
                records: (records || []).length,
                sottogruppo: dati.primario?.sottogruppo != null,
                compiledFields: (dati.compiledFields || []).map(c => c?.labelName),
                deletedFields: (dati.deletedFields || []).length,
                listaFoto: (dati.listaFoto || []).map(f => f?.nomeFoto),
                fotoExtra: (dati.fotoExtra || []).length,
                fotoExtraAuto: (dati.fotoExtraAuto || []).length,
                noRender: (dati.tracciatoPrimario?.noRenderElementi || []).length
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    /// Porta la riga del record nella parte visibile dell'elenco e la evidenzia per un attimo,
    /// con lo stesso gesto che il report usa per i duplicati. Il primo tentativo aspetta: in
    /// UXP le misure lette subito dopo aver costruito l'interfaccia non sono attendibili.
    _evidenziaRigaDelRecord(record, tentativi = 5) {
        setTimeout(() => {
            try {
                const riga = this._rigaDelPayload(this._payloadIdDelRecord(record));

                if (riga == null) {
                    if (tentativi > 0) {
                        this._evidenziaRigaDelRecord(record, tentativi - 1);
                    }
                    return;
                }

                this._scrollReportRowIntoView(riga);
            }
            catch (err) {
                console.error("Riga del record non evidenziata:", err);
            }
        }, 80);
    },

    /// Dove sta la riga del record nella vista, dopo il ridisegno: c'e', in che pagina, a che
    /// posizione, ed e' visibile? E' l'ultimo anello: il dato puo' essere giusto e la vista no.
    _descriviRigaDelRecord(record) {
        try {
            const payloadId = this._payloadIdDelRecord(record);
            const riga = this._rigaDelPayload(payloadId);

            if (riga == null) {
                return { rigaTrovata: false, payloadId };
            }

            const pagina = riga.dataset?.pageNumber || null;
            const righeDellaPagina = document.querySelectorAll(
                '[data-page-number="' + pagina + '"][data-record-type="' + (riga.dataset?.recordType || "") + '"][data-payload-id]');

            let posizione = -1;
            for (let i = 0; i < righeDellaPagina.length; i++) {
                if (righeDellaPagina[i] === riga) {
                    posizione = i + 1;
                    break;
                }
            }

            return {
                rigaTrovata: true,
                payloadId,
                pagina,
                posizioneNellaPagina: posizione + " di " + righeDellaPagina.length,
                display: riga.style.display || "",
                opacita: riga.style.opacity || "",
                categoriaNelReport: this._categoriaDelRecord(record)
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    _dimensioniReport() {
        const report = this._confrontoReportState?.report;
        if (report == null) {
            return null;
        }

        const conta = (chiave) => Array.isArray(report[chiave]) ? report[chiave].length : 0;
        return {
            cambiati: conta("recordCambiati"),
            usciti: conta("recordUsciti"),
            conErrori: conta("recordConErrori"),
            giusti: conta("recordGiusti"),
            nuoviRisolti: conta("recordNuoviRisolti"),
            lista: this._confrontoReportState?.activeList || null
        };
    },

    /// Il Trova: prima porta l'operatore sul box, poi gli apre la scheda di quella referenza
    /// al posto del report.
    async _apriSchedaDalReport(payloadId, payload) {
        if (this._schedaDalReport != null) {
            return;
        }

        const box = this._findElemento(payload);
        if (box == null) {
            return;
        }

        const dna = Utility.getDnaOfBox(box);
        if (dna == null) {
            messaggioUtente("Code CNF-70 Il box non ha un dna leggibile: la scheda non si puo' aprire", "error", false, 5);
            return;
        }

        const record = payload?.record?._fullReportRecord || payload?.record;

        this._schedaDalReport = {
            payloadId,
            payload,
            record,
            //Il box lo teniamo noi: la selezione dell'operatore va e viene, e anche la scheda
            //la puo' perdere svuotandosi. Quello che conta e' se questo riferimento e' ancora
            //valido, e quello si chiede al box, non a chi lo ha selezionato.
            box,
            codiceGruppo: dna.codice_gruppo,
            idRec: dna.idRec,
            timer: null,
            riaggancioInCorso: false
        };

        this._tracciaScheda("apertura", {
            payloadId,
            tipo: payload?.tipo || null,
            recordVisibileEraFiltrato: payload?.record?._fullReportRecord != null,
            record: this._descriviRecord(record),
            box: this._descriviBox(box),
            dna: { codice: dna.codice, codiceGruppo: dna.codice_gruppo, idRec: dna.idRec },
            report: this._dimensioniReport()
        });

        //Il report si chiude qui: il suo stato resta in _confrontoReportState e lo si riapre
        //alla X. chiudiModal rimette visibile la schermata principale, che e' dove sta la
        //scheda.
        Utility.chiudiModal();

        $("#refImage").show();
        this._crChiusuraSchedaDalReport();
        this._applicaBloccoSchedaDalReport();

        showLoading("Caricamento scheda REF");
        //La scheda deve sapere da dove arriva: le azioni strutturali della schermata di edit
        //non si offrono a chi e' venuto qui a sistemare una segnalazione.
        schedaRef.apertaDalReport = true;
        schedaRef.setInvalidated(false);
        schedaRef.initSchedaRef(this._refPerSchedaDalReport(box, dna));

        //initSchedaRef libera gli eventi uscendo: da qui in avanti devono restare fermi, e il
        //vigilante li riafferma ad ogni giro.
        this._applicaBloccoSchedaDalReport();
        this._schedaDalReport.timer = setInterval(
            () => this._vigilaSchedaDalReport(), this.INTERVALLO_VIGILANZA_SCHEDA);
    },

    _refPerSchedaDalReport(box, dna) {
        let pagina = -1;
        let paginaRef = null;
        let bounds = null;

        try {
            paginaRef = box.parentPage;
            pagina = paginaRef == null ? -1 : parseInt(paginaRef.name);
            bounds = box.geometricBounds;
        }
        catch (err) {
            console.error("Pagina o dimensioni del box non leggibili:", err);
        }

        return schedaRef.refDalBoxPerReport(box, dna, { pagina, paginaRef, bounds });
    },

    /// La X: l'unica via d'uscita. Deselezionare non chiude niente, perche' sgruppamenti e
    /// raggruppamenti deselezionano e riselezionano il box senza che l'operatore abbia finito.
    _crChiusuraSchedaDalReport() {
        $("#chiudiSchedaDalReport").remove();

        const testata = $("#referenza");
        testata.css("display", "flex");
        testata.css("align-items", "center");
        testata.css("justify-content", "space-between");

        const bottone = $('<div id="chiudiSchedaDalReport">✕</div>');
        bottone.css("color", "white");
        bottone.css("cursor", "pointer");
        bottone.css("padding", "0px 10px");
        bottone.css("font-size", "14px");
        bottone.on("click", () => this._chiudiSchedaDalReport());

        testata.append(bottone);

        const elemento = document.getElementById("chiudiSchedaDalReport");
        if (elemento != null) {
            Utility.impostaTooltip(elemento, "Chiudi la scheda e torna al report");
        }
    },

    /// La barra resta sulla sola referenza e gli eventi restano fermi. Si riapplica ad ogni
    /// giro perche' la scheda, ridisegnandosi, rimette in piedi quello che le appartiene.
    _applicaBloccoSchedaDalReport() {
        try {
            schedaRef.DAL_REPORT_VOCI_BARRA_NASCOSTE.forEach(id => $("#" + id).hide());
            schedaRef.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE.forEach(
                tab => $(".subTab5").find('img[tab="' + tab + '"]').hide());

            if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
                indesignEvents.setBusy(true);
            }
        }
        catch (err) {
            console.error("Blocco della navigazione non applicato:", err);
        }
    },

    _vigilaSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        this._applicaBloccoSchedaDalReport();

        if (stato.riaggancioInCorso) {
            return;
        }

        if (!schedaRef.serveRiaggancioDalReport(stato.box)) {
            return;
        }

        stato.riaggancioInCorso = true;
        this._riagganciaSchedaDalReport();
    },

    /// Reimpagina e cambi strutturali rifanno il box: con gli eventi fermi nessuno ripunta la
    /// scheda, e allora la ripuntiamo noi, cercando il box nuovo per codice gruppo.
    _riagganciaSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        const box = this._resolveBoxByCodiceGruppo(stato.record);
        const dna = box != null ? Utility.getDnaOfBox(box) : null;

        this._tracciaScheda("riaggancio", {
            boxPrecedente: this._descriviBox(stato.box),
            boxNuovo: this._descriviBox(box),
            dnaLetto: dna != null
        });

        if (box == null || dna == null) {
            messaggioUtente("Code CNF-71 Il box non e' piu' in pagina: la scheda si chiude e il report si aggiorna", "warning", false, 6);
            stato.riaggancioInCorso = false;
            this._chiudiSchedaDalReport();
            return;
        }

        try {
            app.selection = [box];
        }
        catch (err) {
            console.error("Errore selezione del box rifatto:", err);
        }

        //Una scheda morta a meta' resta occupata, e occupata rifiuterebbe di ripartire.
        schedaRef.setBusy(false);
        schedaRef.setInvalidated(false);

        stato.box = box;

        showLoading("Ricarico la scheda sul box rifatto");
        schedaRef.initSchedaRef(this._refPerSchedaDalReport(box, dna));

        stato.riaggancioInCorso = false;
        this._applicaBloccoSchedaDalReport();
    },

    /// La chiusura: si ricontrolla la referenza, perche' l'operatore puo' averne risolto le
    /// segnalazioni standoci dentro, e si torna al report aggiornato.
    async _chiudiSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        //Una volta sola: la X si puo' premere due volte, e il riaggancio puo' arrivarci nello
        //stesso momento.
        this._schedaDalReport = null;
        if (stato.timer != null) {
            clearInterval(stato.timer);
        }

        showLoading("Aggiorno la referenza nel report...");

        this._tracciaScheda("chiusura:inizio", {
            box: this._descriviBox(stato.box),
            record: this._descriviRecord(stato.record),
            report: this._dimensioniReport()
        });

        let piano = null;

        try {
            piano = await this._ricontrollaReferenzaDopoScheda(stato);
        }
        catch (err) {
            console.error("Ricontrollo della referenza non riuscito:", err);
            this._tracciaScheda("chiusura:eccezione", { errore: String(err), stack: err?.stack || null });
            messaggioUtente("Code CNF-72 Ricontrollo della referenza non riuscito: il report resta com'era", "error", false, 6);
        }

        this._terminaSchedaDalReport();
        hideLoading();

        //Il report torna con la referenza ancora al suo posto: quello che il ricontrollo ha
        //trovato risolto lo si vede andare via, non lo si trova gia' sparito.
        this._riapriReportDopoScheda();
        this._tracciaScheda("chiusura:reportRiaperto", { report: this._dimensioniReport(), pianoPresente: piano != null });

        if (piano == null) {
            return;
        }

        this._azioneReportInCorso = true;

        try {
            await this._mostraSegnalazioniRisolte(piano);
            const prima = this._dimensioniReport();
            piano.applica();
            this._tracciaScheda("chiusura:applicato", {
                prima,
                dopo: this._dimensioniReport(),
                record: this._descriviRecord(piano.record)
            });
            this._saveCurrentReportAndWhitelist();
            this._refreshConfrontoReportUi();
            this._tracciaScheda("chiusura:vista", this._descriviRigaDelRecord(piano.record));

            //Il ridisegno riparte dall'alto: la riga, anche restando al suo posto, puo' essere
            //finita fuori dallo schermo, e una riga che non si vede sembra sparita. Se il record
            //e' ancora in un elenco visibile, lo si riporta sotto gli occhi e lo si evidenzia.
            const categoriaFinale = this._categoriaDelRecord(piano.record);
            if (categoriaFinale === "recordCambiati" || categoriaFinale === "recordUsciti") {
                this._evidenziaRigaDelRecord(piano.record);
            }
        }
        catch (err) {
            console.error("Aggiornamento del report dopo la scheda non riuscito:", err);
            this._tracciaScheda("chiusura:eccezioneApplicazione", { errore: String(err), stack: err?.stack || null });
        }
        finally {
            this._azioneReportInCorso = false;
        }
    },

    /// Fa vedere le segnalazioni che il ricontrollo ha trovato risolte: se non ne resta
    /// nessuna se ne va la riga intera, altrimenti se ne vanno solo quelle.
    async _mostraSegnalazioniRisolte(piano) {
        const risolte = piano?.chiaviRisolte || [];
        if (piano?.record == null || risolte.length === 0) {
            return;
        }

        const riga = this._rigaDelPayload(this._payloadIdDelRecord(piano.record));
        if (riga == null) {
            return;
        }

        const restanti = this._chiaviSegnalazioniDelRecord(piano.record)
            .filter(chiave => risolte.indexOf(chiave) < 0);

        if (restanti.length === 0) {
            await this._dissolviElementi(riga);
            return;
        }

        const elementi = [];

        try {
            const nodi = riga.querySelectorAll("[data-segnalazione-key]");
            for (let i = 0; i < nodi.length; i++) {
                if (risolte.indexOf(nodi[i].dataset.segnalazioneKey) >= 0) {
                    elementi.push(nodi[i]);
                }
            }
        }
        catch (err) {
            console.error("Segnalazioni risolte non trovate nella riga:", err);
        }

        await this._dissolviElementi(elementi);
    },

    /// La riga del record dopo che il report si e' ridisegnato: i payload sono altri, quindi
    /// si cerca per record, non per identificativo.
    _payloadIdDelRecord(record) {
        if (record == null || this._confrontoReportStore == null) {
            return null;
        }

        let trovato = null;

        this._confrontoReportStore.forEach((payload, id) => {
            if (trovato != null) {
                return;
            }

            const candidato = payload?.record?._fullReportRecord || payload?.record;
            if (candidato === record || this._sameReportRecord(candidato, record)) {
                trovato = id;
            }
        });

        return trovato;
    },

    _terminaSchedaDalReport() {
        try {
            $("#chiudiSchedaDalReport").remove();
            $("#referenza").css("display", "");
            $("#referenza").css("justify-content", "");

            schedaRef.apertaDalReport = false;
            schedaRef.setInvalidated(true);
            schedaRef.svuotaRef();
            schedaRef.resetRefInterface();

            //L'interfaccia torna come quando non c'e' niente di selezionato: e' lo stato che il
            //plugin conosce gia', non uno nuovo inventato qui.
            $("#homeImage").show();
            $("#menaboTab").show();
            $("#utilityImage").show();
            $("#refImage").hide();
            $("#raggruppaImage").hide();
            $("#grigliaTab").hide();
            schedaRef.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE.forEach(
                tab => $(".subTab5").find('img[tab="' + tab + '"]').show());

            jsIndexControls.changeSubMenu($("#homeImage").attr("subTab"));
            jsIndexControls.changeImage($("#homeImage"));
        }
        catch (err) {
            console.error("Chiusura della scheda dal report non completata:", err);
        }
    },

    _riapriReportDopoScheda() {
        const state = this._confrontoReportState;
        if (state == null) {
            return;
        }

        this._saveCurrentReportAndWhitelist();

        this.compilaReportConfronto(state.report, {
            wrapper: {
                createdAt: state.createdAt,
                createdAtLabel: state.createdAtLabel,
                report: state.report,
                uiPrefs: state.uiPrefs
            },
            skipSave: true,
            activeList: state.activeList,
            activeTab: state.activeTab
        });
    },

    /// Il ricontrollo di una sola referenza alla chiusura della scheda. La scheda si rilegge
    /// dal server e quel dato diventa la verita': sistemando una segnalazione l'operatore
    /// allinea il box al server, e se la lista restasse indietro il report continuerebbe a
    /// giudicare il box con un dato che non e' piu' quello vero. Per questo il record riletto
    /// prende il posto di quello in lista, e la preanalisi si rifa' per intero: dice tutto
    /// quello che c'e', non solo quello che se ne va.
    /// Non applica niente: torna il piano, cosi' chi chiama puo' far vedere le segnalazioni
    /// che se ne stanno andando prima che se ne vadano davvero.
    async _ricontrollaReferenzaDopoScheda(stato) {
        const state = this._confrontoReportState;
        const record = stato?.record;

        if (state == null || record == null) {
            return null;
        }

        //Nella whitelist le segnalazioni stanno parcheggiate apposta: ricontrollarle da qui
        //vorrebbe dire rimettere in circolo quello che l'operatore ha messo da parte, e per
        //giunta in un elenco, quello del report, dove quel record non sta.
        if (state.activeList === "whitelist") {
            this._tracciaScheda("ricontrollo:saltato", { motivo: "vista whitelist" });
            return null;
        }

        //Il box e' quello che ci siamo tenuti aprendo la scheda, o quello su cui l'abbiamo
        //riagganciata: non lo si chiede alla selezione, che nel frattempo l'operatore puo'
        //aver spostata, ne' alla scheda, che svuotandosi lo perde.
        let box = schedaRef.serveRiaggancioDalReport(stato.box) ? null : stato.box;
        let viaDelBox = box != null ? "memoria" : null;

        if (box == null) {
            //Prima di dire che non c'e' piu' lo si cerca come lo cerca il Trova: per id e poi
            //per codice gruppo. Dichiararlo sparito costa al record l'uscita dal report.
            box = this._resolveBoxFromRecord(record);
            viaDelBox = box != null ? "ricerca" : "nessuno";
        }

        this._tracciaScheda("ricontrollo:box", { via: viaDelBox, box: this._descriviBox(box) });

        if (box == null) {
            //Il box non c'e' piu': la referenza esce dal report e ricompare fra le Nuove, che
            //si calcolano per differenza da chi nel report c'e' gia'.
            return {
                record,
                chiaviRisolte: this._chiaviSegnalazioniDelRecord(record),
                applica: () => this._rimuoviRecordDalReport(record)
            };
        }

        const records = await this._leggiSchedaRefAggiornata(stato.codiceGruppo, stato.idRec);

        this._tracciaScheda("ricontrollo:schedaRiletta", {
            richiesta: { codiceGruppo: stato.codiceGruppo, idRec: stato.idRec },
            dalServer: this._descriviDatiConfronto(records),
            dellaLista: this._descriviDatiConfronto(record?.schedaRef?.records)
        });

        if (records == null || records.length === 0) {
            messaggioUtente("Code CNF-73 Scheda della referenza non riletta: il report resta com'era", "warning", false, 6);
            return null;
        }

        const preAnalisi = await preAnalisiBoxMappato(records, record.elementoMappa, box);

        this._tracciaScheda("ricontrollo:preanalisi", {
            nulla: preAnalisi == null,
            differenze: (preAnalisi?.differenze || []).map(d => (d?.label || "") + ": " + (d?.difference || "")),
            errori: preAnalisi?.errors || []
        });

        if (preAnalisi == null) {
            messaggioUtente("Code CNF-74 Referenza non ricontrollata: il report resta com'era", "warning", false, 6);
            return null;
        }

        preAnalisi.differenze = reportIntegritaAvvio.differenzeDopoRicontrollo(
            preAnalisi.differenze,
            reportIntegritaAvvio.differenzeDiConfronto(record),
            record.duplicateInfo);

        const chiaviPrima = this._chiaviSegnalazioniDelRecord(record);
        const chiaviDopo = new Set(preAnalisi.differenze.map(d => this._getSegnalazioneKey(d)));

        this._diagnosticaRicontrollo(record, records, chiaviPrima, preAnalisi);

        //Il dato riletto puo' non avere niente da confrontare: allora lo zero differenze non
        //dice "a posto", dice "non ho guardato".
        const dati = typeof datiPrimarioPerConfronto === "function"
            ? datiPrimarioPerConfronto(records)
            : null;

        const esito = reportIntegritaAvvio.esitoChiusuraScheda({
            boxPresente: true,
            preAnalisi,
            haDuplicato: record.duplicateInfo != null,
            nienteDaConfrontare: !reportIntegritaAvvio.ciSonoDatiDaConfrontare(dati)
        });

        if (esito.azione === "invariato") {
            this._avvisaRicontrolloNonRiuscito(esito.motivo);
        }

        //Si fa vedere andare via solo cio' che si e' visto risolvere davvero.
        const chiaviRisolte = esito.azione === "invariato"
            ? []
            : chiaviPrima.filter(chiave => !chiaviDopo.has(chiave));

        this._tracciaScheda("ricontrollo:esito", {
            esito,
            chiaviPrima,
            chiaviDopo: Array.from(chiaviDopo),
            chiaviRisolte
        });

        return {
            record,
            chiaviRisolte,
            applica: () => {
                //Il riferimento al box si aggiorna comunque: quello lo abbiamo in mano.
                this._aggiornaRiferimentiBox(record, box);

                //Di quello che non abbiamo potuto verificare non si scrive niente: ne' l'analisi
                //del record, ne' i suoi dati, ne' la lista del kit.
                if (esito.azione === "invariato") {
                    return;
                }

                record.schedaRef = { records };
                record.preAnalisi = preAnalisi;
                this._aggiornaListaKitConRecordFreschi(records);

                //Se il record resta nella stessa categoria non lo si tocca: togliere e
                //rimettere lo manderebbe in fondo al suo gruppo di pagina, e l'operatore, che lo
                //cercherebbe dov'era, lo darebbe per sparito. E' successo.
                const categoriaAttuale = this._categoriaDelRecord(record);

                if (esito.azione === "sposta" && esito.categoria === categoriaAttuale) {
                    this._tracciaScheda("report:recordAggiornatoInPosto", { categoria: categoriaAttuale });
                }
                else {
                    this._rimuoviRecordDalReport(record);

                    if (esito.azione === "sposta" && esito.categoria != null) {
                        const state2 = this._confrontoReportState;
                        if (state2 != null && state2.report != null) {
                            state2.report[esito.categoria] = state2.report[esito.categoria] || [];
                            state2.report[esito.categoria].push(record);
                        }
                    }
                }

                this._removeConfrontoPayload(stato.payloadId);
            }
        };
    },

    /// Quando il ricontrollo non decide, l'operatore deve sapere perche': altrimenti crede di
    /// aver sistemato qualcosa e il report, restando fermo, sembra rotto.
    _avvisaRicontrolloNonRiuscito(motivo) {
        if (motivo === "errori") {
            messaggioUtente("Code CNF-75 Il ricontrollo della referenza e' andato in errore: il report resta com'era", "warning", false, 6);
            return;
        }

        if (motivo === "nienteDaConfrontare") {
            messaggioUtente("Code CNF-76 Il dato riletto non ha campi da confrontare: il report resta com'era", "warning", false, 6);
        }
    },

    _chiaviSegnalazioniDelRecord(record) {
        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
        return differenze.map(diff => this._getSegnalazioneKey(diff));
    },

    /// Una segnalazione che se ne va senza che l'operatore abbia fatto niente e' un fatto da
    /// spiegare, non da subire: qui si scrive cosa ha risposto il server rispetto a cosa
    /// diceva la lista, cosi' il collaudo dice come stanno le cose invece di farmele indovinare.
    _diagnosticaRicontrollo(record, recordsFreschi, chiaviPrima, preAnalisi) {
        try {
            const campiDaGuardare = ["compiledFields", "deletedFields", "Foto.Nome", "Foto.Hash", "Foto.Extra", "Foto.ExtraAuto", "membriGruppoFoto"];

            const primarioFresco = (recordsFreschi || []).find(r => r?.recordInTracciato?.StatoSelezione == 1);
            const primarioLista = (record?.schedaRef?.records || []).find(r => r?.recordInTracciato?.StatoSelezione == 1);

            const tracciatoFresco = primarioFresco?.sottogruppo || primarioFresco?.recordInTracciato || {};
            const tracciatoLista = primarioLista?.sottogruppo || primarioLista?.recordInTracciato || {};

            const diversi = campiDaGuardare.filter(campo => {
                try {
                    return JSON.stringify(tracciatoFresco[campo]) !== JSON.stringify(tracciatoLista[campo]);
                }
                catch (err) {
                    return true;
                }
            });

            const differenzeDopo = preAnalisi != null ? preAnalisi.differenze || [] : [];
            const erroriAnalisi = preAnalisi != null ? preAnalisi.errors || [] : [];

            console.log("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                ": segnalazioni prima " + chiaviPrima.length + ", dopo " + differenzeDopo.length +
                "; errori dell'analisi " + erroriAnalisi.length +
                "; record dal server " + (recordsFreschi || []).length +
                "; campi diversi fra server e lista: " + (diversi.length > 0 ? diversi.join(", ") : "nessuno"));

            if (erroriAnalisi.length > 0) {
                console.warn("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                    ": l'analisi e' finita in errore, il report non si tocca. " + erroriAnalisi.join(" | "));
            }

            if (diversi.length === 0 && differenzeDopo.length < chiaviPrima.length) {
                console.warn("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                    ": segnalazioni risolte con dato identico a quello della lista. Il box e' cambiato, oppure il confronto non e' lo stesso del report.");
            }
        }
        catch (err) {
            console.error("Diagnostica del ricontrollo non riuscita:", err);
        }
    },

    /// Il dato riletto sostituisce quello della lista del kit: da qui in poi il resto del
    /// report, l'elenco dei Nuovi e il prossimo Fix guardano lo stesso dato che ha deciso il
    /// ricontrollo.
    _aggiornaListaKitConRecordFreschi(recordsFreschi) {
        try {
            const percorso = pathLavorazione + "/listaKit" + idKitLavorazione + ".json";
            const lista = readFile(percorso);

            if (lista == null || !Array.isArray(lista.records)) {
                console.warn("Lista del kit non aggiornata: file non leggibile o senza record");
                return false;
            }

            const esito = reportIntegritaAvvio.sostituisciRecordNellaLista(lista.records, recordsFreschi);

            if (esito.sostituiti === 0) {
                console.warn("Lista del kit non aggiornata: nessun record corrispondente");
                return false;
            }

            lista.records = esito.records;
            fs.writeFileSync(percorso, JSON.stringify(lista));

            //La copia in memoria deve seguire il file, altrimenti l'elenco dei Nuovi e il
            //tracciato continuerebbero a mostrare il dato vecchio fino al prossimo download.
            if (this._confrontoReportState != null) {
                this._confrontoReportState.listaKit = lista;
            }

            try {
                contenutoKitInLavorazione = lista;
            }
            catch (err) {
                console.error("Copia in memoria della lista non aggiornata:", err);
            }

            console.log("Lista del kit aggiornata dal server: " + esito.sostituiti + " record");
            return true;
        }
        catch (err) {
            console.error("Lista del kit non aggiornata:", err);
            return false;
        }
    },

    /// L'elenco del report in cui il record sta adesso, o null se non sta in nessuno.
    _categoriaDelRecord(record) {
        const report = this._confrontoReportState?.report;
        if (report == null || record == null) {
            return null;
        }

        const target = record._fullReportRecord || record;
        const categorie = ["recordCambiati", "recordUsciti", "recordConErrori", "recordGiusti", "recordNuoviRisolti"];

        for (let i = 0; i < categorie.length; i++) {
            const elenco = report[categorie[i]];
            if (Array.isArray(elenco) && elenco.some(item => this._sameReportRecord(item, target))) {
                return categorie[i];
            }
        }

        return null;
    },

    _rimuoviRecordDalReport(record) {
        const state = this._confrontoReportState;
        if (state == null || state.report == null) {
            return;
        }

        const tolti = {};

        ["recordCambiati", "recordUsciti", "recordConErrori", "recordGiusti", "recordNuoviRisolti"]
            .forEach(chiave => {
                tolti[chiave] = this._removeRecordFromArray(state.report[chiave], record) ? 1 : 0;
            });

        this._tracciaScheda("report:recordTolto", { tolti });
    },

    /// Il box puo' essere un altro rispetto a quello con cui il report e' nato: chi lo cerchera'
    /// domani deve trovare questo.
    _aggiornaRiferimentiBox(record, box) {
        try {
            record.inddId = box.id;

            if (record.elementoMappa != null) {
                record.elementoMappa.refId = box.id;
            }

            const pagina = box.parentPage != null ? box.parentPage.name : null;
            if (pagina != null) {
                record.numeroPagina = pagina;

                if (record.elementoMappa != null) {
                    record.elementoMappa.pagina = pagina;
                    record.elementoMappa.paginaAttuale = pagina;
                }
            }
        }
        catch (err) {
            console.error("Riferimenti del box non aggiornati:", err);
        }
    },

    /// La scheda si rilegge dal server per quella sola referenza: i record con cui il report e'
    /// nato sono di prima che l'operatore ci mettesse mano.
    _leggiSchedaRefAggiornata(codiceGruppo, idRec) {
        return new Promise(resolve => {
            let risposto = false;

            const rispondi = (valore) => {
                if (risposto) {
                    return;
                }
                risposto = true;
                resolve(valore);
            };

            //XMLHttpRequestClient.abort() non interrompe davvero: la richiesta tardiva la si
            //lascia cadere, ma l'attesa non deve tenere fermo l'operatore.
            setTimeout(() => rispondi(null), this.ATTESA_MASSIMA_RILETTURA_SCHEDA);

            try {
                schedaRef.getSchedaRef(codiceGruppo, (errore, risultato) => {
                    if (errore != null || risultato == null || (risultato.error != null && risultato.error !== "")) {
                        console.error("Rilettura della scheda non riuscita:", errore || risultato?.error);
                        rispondi(null);
                        return;
                    }

                    rispondi(risultato.records || null);
                }, idRec);
            }
            catch (err) {
                console.error("Rilettura della scheda non partita:", err);
                rispondi(null);
            }
        });
    },

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

        //Il documento su cui questo report vale: se l'operatore ne apre un altro, il report
        //si chiude da solo (il controllo sta in events.js).
        this._reportIntegritaAperto = true;
        this._documentoDelReport = typeof indesignEvents !== "undefined" && indesignEvents != null
            ? (indesignEvents.lastActiveDocument || "")
            : "";

        const headerActions = document.getElementById("pulsantiTestataConfronto");
        if (headerActions) {
            let btnScaricaCsv = document.getElementById("scaricaReportConfrontoCsv");
            if (!btnScaricaCsv) {
                btnScaricaCsv = document.createElement("button");
                btnScaricaCsv.id = "scaricaReportConfrontoCsv";
                btnScaricaCsv.type = "button";
                btnScaricaCsv.textContent = "Scarica CSV";
                Utility.impostaTooltip(btnScaricaCsv, "Scarica il report confronto in formato CSV");
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

            Utility.impostaTooltip(btnScaricaCsv, "Scarica il report confronto in formato CSV");
            btnScaricaCsv.onclick = async () => await this.scaricaReportConfrontoCsv(this._confrontoReportState?.report || reportData);

            //I20-981: il pulsantino accanto cambia la cartella dei csv. Il title dice dove
            //stanno andando adesso, cosi' non serve aprire il selettore per saperlo.
            let btnCartellaCsv = document.getElementById("cartellaReportConfrontoCsv");
            if (!btnCartellaCsv) {
                btnCartellaCsv = document.createElement("button");
                btnCartellaCsv.id = "cartellaReportConfrontoCsv";
                btnCartellaCsv.type = "button";
                btnCartellaCsv.textContent = "...";
                btnCartellaCsv.style.height = "25px";
                btnCartellaCsv.style.width = "26px";
                btnCartellaCsv.style.padding = "0";
                btnCartellaCsv.style.cursor = "pointer";
                btnCartellaCsv.style.marginRight = "8px";

                btnScaricaCsv.parentNode.insertBefore(btnCartellaCsv, btnScaricaCsv.nextSibling);
            }

            btnCartellaCsv.onclick = async () => await this.scegliCartellaCsvReport();
            this._aggiornaTitoloCartellaCsv();
        }

        const body = document.getElementById("bodyConfrontoReport");
        if (!body) {
            console.error("Elemento #bodyConfrontoReport non trovato");
            return;
        }

        //I20-981: via il piede del report. Conteneva solo "Fix massivo", che dietro aveva un
        //TODO e non faceva nulla: un pulsante che promette un'azione inesistente e' peggio di
        //un pulsante che manca. Lo spazio recuperato va all'elenco, che su questo pannello
        //conta piu' di tutto.
        const footer = document.getElementById("footerConfrontoReport");
        if (footer) {
            footer.innerHTML = "";
            footer.style.display = "none";
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

        //I20-981: i pannelli si costruiscono per primi, perche' le linguette portano il
        //conteggio di cio' che i pannelli mostrano davvero. In vista whitelist le liste sono
        //altre, e un numero preso dal report intero direbbe il falso.
        //I20-981: le differenze sui campi osservati servono ai nuovi e al csv, quindi si
        //calcolano prima dei pannelli e restano indicizzate per presenza.
        this._confrontoReportState.confronti = this._calcolaConfronti();
        this._indiceConfronti = reportConfronti.indicizzaPerPresenza(this._confrontoReportState.confronti.voci);

        const recordsCambiati = this._getCurrentReportRecords("recordCambiati");
        const recordsUsciti = this._getCurrentReportRecords("recordUsciti");

        const changedPanel = this._buildPanelCambiati(recordsCambiati);
        const removedPanel = this._buildPanelEliminati(recordsUsciti);
        const confrontiPanel = this._buildPanelConfronti();

        const newPanel = this._buildPanelNuovi(this._confrontoReportState.report);

        const conteggi = reportConteggi.conteggiVisibili(
            recordsCambiati,
            recordsUsciti,
            this._confrontoNuoviState?.rowsOriginal);

        const changedTab = this._crTabButton(reportConteggi.etichettaLinguetta("Cambiati", conteggi.cambiati), true, "Cambiati");
        const removedTab = this._crTabButton(reportConteggi.etichettaLinguetta("Eliminati", conteggi.eliminati), false, "Eliminati");
        const newTab = this._crTabButton(reportConteggi.etichettaLinguetta("Nuovi", conteggi.nuovi), false, "Nuovi");
        const confrontiTab = this._crTabButton("Confronti", false, "Confronti");

        const panels = [
            { button: changedTab, panel: changedPanel },
            { button: removedTab, panel: removedPanel },
            { button: newTab, panel: newPanel },
            { button: confrontiTab, panel: confrontiPanel }
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
        confrontiTab.addEventListener("click", () => activateTab(3));

        tabsRoot.header.appendChild(changedTab);
        tabsRoot.header.appendChild(removedTab);
        tabsRoot.header.appendChild(newTab);
        tabsRoot.header.appendChild(confrontiTab);

        tabsRoot.content.appendChild(changedPanel);
        tabsRoot.content.appendChild(removedPanel);
        tabsRoot.content.appendChild(newPanel);
        tabsRoot.content.appendChild(confrontiPanel);

        body.appendChild(metaBar);
        body.appendChild(tabsRoot.root);

        activateTab(activeTab);
        this._restorePendingReportScroll();
    },

    //I20-981: il csv del report.
    //Il salvataggio ora avviene da solo quando nasce un report nuovo (automatico = true) e
    //resta disponibile a mano dalla testata. La cartella di destinazione puo' essere cambiata
    //dalla schermata del report: vale per la sessione del codice del plugin, un reload di UXP
    //la riporta alla cartella di esportazione.
    _cartellaCsvSessione: null,
    _csvDelReportCorrente: null,

    async scaricaReportConfrontoCsv(report, opzioni = {}) {
        const automatico = opzioni.automatico === true;

        try {
            const cartella = this.cartellaCsvReport();
            const testo = this._buildReportConfrontoCsv(report);
            const nomeFile = await this._nomeFileReportCsv(cartella);

            const filePath = await this._scriviTestoUtf8(cartella, nomeFile, testo);
            this._csvDelReportCorrente = filePath;

            messaggioUtente((automatico ? "Report confronto salvato in CSV: " : "Report confronto scaricato in CSV: ") + filePath, "success", false, 10);
            return filePath;
        } catch (err) {
            console.error("Errore durante lo scaricamento del report CSV:", err);
            messaggioUtente("Code CNF-020: Errore durante lo scaricamento del report CSV: " + (err?.message || err), "error", false, 10);
            return null;
        }
    },

    /// La cartella dove finiscono i csv: quella scelta per questa sessione, altrimenti la
    /// cartella di esportazione configurata nei percorsi di sistema.
    cartellaCsvReport() {
        const scelta = this._cartellaCsvSessione;
        const cartella = scelta != null && scelta !== ""
            ? String(scelta)
            : (typeof percorsoEsportazione !== "undefined" ? String(percorsoEsportazione || "") : "");

        if (!cartella) {
            throw new Error("cartella di export non configurata");
        }

        return cartella.endsWith("/") ? cartella : cartella + "/";
    },

    /// Il selettore di cartella dalla schermata del report. Cambiando cartella il csv di
    /// questo confronto viene riscritto subito la' dentro e tolto da dove stava: cosi' il
    /// report e il suo csv restano nello stesso posto.
    async scegliCartellaCsvReport() {
        try {
            const cartella = await fs2.getFolder();
            if (!cartella) {
                return null;
            }

            let attuale = "";
            try {
                attuale = this.cartellaCsvReport();
            }
            catch (errCartella) {
                attuale = "";
            }

            const scelta = String(cartella.nativePath || "");
            if (attuale !== "" && (scelta === attuale || scelta + "/" === attuale)) {
                //Stessa cartella: non c'e' niente da spostare e non serve un file in piu'.
                this._aggiornaTitoloCartellaCsv();
                return this._cartellaCsvSessione;
            }

            const precedente = this._csvDelReportCorrente;
            this._cartellaCsvSessione = scelta;

            const report = this._confrontoReportState?.report;
            if (report != null) {
                const nuovoPercorso = await this.scaricaReportConfrontoCsv(report, { automatico: true });

                if (nuovoPercorso != null && precedente != null && precedente !== nuovoPercorso) {
                    this._eliminaFile(precedente);
                }
            }

            this._aggiornaTitoloCartellaCsv();
            return this._cartellaCsvSessione;
        }
        catch (err) {
            console.error("Errore durante la scelta della cartella dei csv:", err);
            messaggioUtente("Code CNF-021: Errore durante la scelta della cartella dei csv: " + (err?.message || err), "error", false, 10);
            return null;
        }
    },

    /// Il nome del prossimo csv in quella cartella. Il progressivo guarda i file gia' presenti
    /// la' dentro, quindi cambiando cartella riparte da quello che la nuova cartella contiene.
    async _nomeFileReportCsv(cartella) {
        const titolo = this._titoloKitPerCsv();
        const dataReport = new Date(this._confrontoReportState?.createdAt || Date.now());
        const progressivo = reportConfrontoCsv.prossimoProgressivo(await this._nomiFileNellaCartella(cartella));

        return reportConfrontoCsv.nomeFileReport(progressivo, titolo, dataReport);
    },

    /// Il titolo del kit come lo mostra la testata del plugin: e' quello che dice all'operatore
    /// a che volantino si riferisce il csv.
    _titoloKitPerCsv() {
        try {
            const meta = ficoProcess?.metaLavorazioneCorrente?.meta;
            if (meta != null && meta.titolo) {
                return String(meta.titolo);
            }
        }
        catch (err) {
            console.warn("Titolo del kit non disponibile per il nome del csv:", err);
        }

        return typeof idKitLavorazione !== "undefined" ? String(idKitLavorazione || "kit") : "kit";
    },

    async _nomiFileNellaCartella(cartella) {
        try {
            const percorso = cartella.endsWith("/") ? cartella.slice(0, -1) : cartella;
            const entry = await fs2.getEntryWithUrl("file://" + percorso);
            const voci = await entry.getEntries();

            return (voci || []).filter(v => v.isFile).map(v => v.name);
        }
        catch (err) {
            //Cartella non leggibile: il csv si scrive lo stesso, il progressivo riparte da uno.
            console.warn("Cartella dei csv non leggibile, progressivo da capo:", err);
            return [];
        }
    },

    /// I20-981: il csv si scrive in byte utf8, non come stringa.
    /// Scritto come stringa, il file usciva con le accentate rotte: l'operatore apriva il csv
    /// e al posto di "è" trovava segni che non c'entravano nulla, perche' l'interpretazione
    /// della stringa non era piu' nelle nostre mani. I byte li calcola reportConfrontoCsv e
    /// il BOM in testa dice a Excel come leggerli.
    async _scriviTestoUtf8(cartella, nomeFile, testo) {
        const percorso = cartella.endsWith("/") ? cartella.slice(0, -1) : cartella;
        const entry = await fs2.getEntryWithUrl("file://" + percorso);
        const file = await entry.createFile(nomeFile, { overwrite: true });

        const bytes = reportConfrontoCsv.bytesUtf8(testo);
        await file.write(bytes, { format: require("uxp").storage.formats.binary });

        return cartella + nomeFile;
    },

    _eliminaFile(percorso) {
        try {
            fs.unlinkSync(percorso);
        }
        catch (err) {
            console.warn("Il csv precedente non e' stato rimosso:", percorso, err);
        }
    },

    //I20-981: il percorso completo della cartella dei csv vive nel suggerimento del pulsante.
    _aggiornaTitoloCartellaCsv() {
        const bottone = document.getElementById("cartellaReportConfrontoCsv");
        if (bottone == null) {
            return;
        }

        let cartella = "";
        try {
            cartella = this.cartellaCsvReport();
        }
        catch (err) {
            cartella = "";
        }

        //Il testo del pulsante non cambia: cambiarlo spostava tutta la testata a ogni scelta,
        //e una cartella dal nome lungo non ci stava comunque. Il percorso sta nel suggerimento.
        Utility.impostaTooltip(bottone, "Scegli cartella. Attualmente impostata: "
            + (cartella !== "" ? cartella : "nessuna (configura i percorsi di sistema)"));
    },

    _buildReportConfrontoCsv(report) {
        const voci = [];

        const aggiungi = (stato, records, dettagliDelRecord) => {
            (records || []).forEach(record => {
                const raw = this._getReportRecordRaw(record);
                const dati = reportConfrontoCsv.datiRecordPerCsv(raw);
                const dettagli = dettagliDelRecord(record) || [{ campo: "", dettaglio: "" }];

                //I20-981: i cambiamenti sui campi osservati stanno tutti in una colonna sola,
                //ripetuta su ogni riga della referenza: in Excel si filtra "non vuota".
                const confronto = this._testoConfrontoDelRecord(record);

                dettagli.forEach(dettaglio => {
                    voci.push({
                        stato: stato,
                        pagina: this._getReportRecordPage(record),
                        codiceGruppo: record?.codiceGruppo || "",
                        etichetta: dati.etichetta,
                        versione: dati.versione,
                        reparto: dati.reparto,
                        descrizione: dati.descrizione,
                        campo: dettaglio?.campo || "",
                        dettaglio: dettaglio?.dettaglio || "",
                        confronto: confronto
                    });
                });
            });
        };

        aggiungi("Cambiato", report?.recordCambiati, (record) => {
            const tutte = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
            //Le differenze sui campi osservati hanno la loro colonna: qui restano le
            //segnalazioni dell'analisi di integrita', altrimenti si leggerebbero due volte.
            const differenze = tutte.filter(d => d?.origine !== "confronto");

            if (differenze.length === 0) {
                return [{ campo: "", dettaglio: tutte.length > 0 ? "" : "Differenza non specificata" }];
            }

            return differenze.map(diff => ({
                campo: diff?.label || "",
                dettaglio: diff?.difference || ""
            }));
        });

        aggiungi("Eliminato", report?.recordUsciti, () => {
            return [{ campo: "", dettaglio: "Presente in impaginato ma non nel tracciato" }];
        });

        aggiungi("Errore", report?.recordConErrori, (record) => {
            const errors = Array.isArray(record?.preAnalisi?.errors) ? record.preAnalisi.errors : [];
            if (errors.length === 0) {
                return [{ campo: "", dettaglio: "Errore non specificato" }];
            }

            return errors.map(error => ({ campo: "", dettaglio: error }));
        });

        //I nuovi non hanno una pagina: nel documento non ci sono ancora, e in coda ci vanno.
        this._getReportNuoviRows(report).forEach(row => {
            const dati = reportConfrontoCsv.datiRecordPerCsv(row.raw);

            voci.push({
                stato: "Nuovo",
                pagina: "",
                codiceGruppo: row.codiceGruppo || "",
                etichetta: dati.etichetta,
                versione: dati.versione,
                reparto: dati.reparto,
                descrizione: row.descrizione || dati.descrizione,
                campo: "",
                dettaglio: "Presente nel tracciato ma non in impaginato",
                confronto: row.confronto || ""
            });
        });

        return reportConfrontoCsv.componiCsv(voci);
    },

    //I20-981: la lista del kit si legge una volta sola per ogni apertura del report.
    //La leggevano il pannello dei nuovi e il csv, ognuno per conto suo, e su un volantino sono
    //parecchi megabyte di json; adesso la sezione Confronti sarebbe stata la terza.
    _leggiListaKitLocale() {
        const stato = this._confrontoReportState;

        if (stato != null && stato.listaKit !== undefined) {
            return stato.listaKit;
        }

        let lista = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");

        if (typeof lista === "string") {
            try {
                lista = JSON.parse(lista);
            }
            catch (err) {
                console.error("Errore parse listaKit:", err);
                lista = null;
            }
        }

        if (stato != null) {
            stato.listaKit = lista;
        }

        return lista;
    },

    /// I record della lista del kit, o un elenco vuoto se la lista non c'e'.
    _recordsListaKit() {
        const lista = this._leggiListaKitLocale();

        if (Array.isArray(lista)) {
            return lista;
        }

        return Array.isArray(lista?.records) ? lista.records : [];
    },

    _getReportNuoviRows(report) {
        const listaTracciato = this._leggiListaKitLocale();

        return this._estraiNuoviDaLista(report, listaTracciato);
    },

    /// I cambiamenti sui campi osservati di una referenza, in una riga sola per il csv.
    _testoConfrontoDelRecord(record) {
        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];

        return differenze
            .filter(d => d?.origine === "confronto")
            .map(d => (d.label || "") + ": " + (d.difference || ""))
            .join(" | ");
    },

    _getReportRecordRaw(record) {
        if (Array.isArray(record?.schedaRef?.records) && record.schedaRef.records.length > 0) {
            return record.schedaRef.records[0]?.recordInTracciato || null;
        }

        return record?.recordInTracciato || record?.raw || null;
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
        Utility.impostaTooltip(next, "Vai alla prossima istanza duplicata");
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

        //I20-981: questo era l'unico overlay del plugin che usava "inset: 0" per occupare lo
        //schermo; gli altri dieci scrivono top, left, width e height per esteso. Senza quelle
        //misure il riquadro si stringeva sul contenuto: da li' la finestra ridotta a una
        //colonna e lo scorrimento che non arrivava in fondo, perche' il corpo calcolava la
        //propria altezza dentro un riquadro che non ne aveva una.
        const overlay = $('<div id="confrontoInfoOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999999; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box;"></div>');
        const dialog = $('<div style="width: 92%; max-width: 720px; height: 86%; max-height: 86%; background: #fff; color: #111; display: flex; flex-direction: column; border-radius: 4px; box-shadow: 0 8px 28px rgba(0,0,0,0.35); overflow: hidden; box-sizing: border-box;"></div>');
        const header = $('<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-bottom:1px solid #ccc; flex:0 0 auto;"></div>');
        const title = $('<div style="font-weight:700;"></div>').text(titolo || "Info dati referenza");
        const close = $('<button type="button" style="height:26px; min-width:32px; cursor:pointer;">&times;</button>');
        const body = $('<div id="confrontoInfoBody" style="flex:1 1 auto; min-height:0; overflow:auto; padding:10px;"></div>');
        const footer = $('<div style="display:flex; flex-wrap:wrap; gap:8px; padding:8px 10px; border-top:1px solid #ccc; flex:0 0 auto;"></div>');
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
        const dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        const body = $('<div style="flex:1 1 auto; min-height:0; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const chkWrap = $('<label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-top:8px;"><input type="checkbox"><span>Non chiedere di nuovo per questo report</span></label>');
        const buttons = $('<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; flex:0 0 auto; padding-top:12px;"></div>');
        const ok = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">Conferma</button>');
        const cancel = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:#dc3545; color:white; border:none; border-radius:5px; cursor:pointer;">Annulla</button>');
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

    _buildPanelCambiati(records) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent();

        //I20-981: via "Fix all", come "Fix massivo" dietro non aveva nulla. Il fix per singola
        //segnalazione resta, ed e' l'unico che abbia mai davvero sistemato qualcosa.
        const picker = this._crReportListPicker();
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


                    const row = this._crRow("cambiato");
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

                    const codice = this._crCodiceGruppo(item.codiceGruppo);

                    const diffList = document.createElement("div");
                    diffList.style.display = "flex";
                    diffList.style.flexDirection = "column";
                    diffList.style.gap = "2px";
                    diffList.style.minWidth = "0";
                    diffList.style.width = "100%";

                    //I20-981: nella stessa riga convivono due cose diverse. Le segnalazioni
                    //dell'analisi di integrita' dicono che il box in pagina non corrisponde al
                    //dato; le differenze sui campi osservati dicono che e' cambiato qualcosa
                    //che non tocca il box ma puo' cambiare la pagina in cui va. Si vedono
                    //separate perche' chiedono all'operatore due decisioni diverse.
                    const tutteLeDifferenze = Array.isArray(item?.preAnalisi?.differenze) ? item.preAnalisi.differenze : [];
                    const segnalazioniIntegrita = tutteLeDifferenze.filter(d => d?.origine !== "confronto");
                    const differenzeConfronto = tutteLeDifferenze.filter(d => d?.origine === "confronto");

                    const differenze = segnalazioniIntegrita;
                    if (tutteLeDifferenze.length === 0) {
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
                            //I20-981: il nome del campo in grassetto e il resto normale: in un
                            //elenco di differenze e' il campo che si cerca con l'occhio.
                            if (diff?.label) {
                                const campo = document.createElement("span");
                                campo.textContent = diff.label;
                                campo.style.fontWeight = "600";
                                diffRow.appendChild(campo);
                                diffRow.appendChild(document.createTextNode(": " + (diff?.difference || "")));
                            }
                            else {
                                diffRow.textContent = diff?.difference || "-";
                            }
                            //La chiave della segnalazione resta attaccata alla riga: serve per
                            //far vedere quale se ne sta andando dopo un ricontrollo.
                            diffRow.dataset.segnalazioneKey = this._getSegnalazioneKey(diff);
                            diffRow.style.fontSize = "11px";
                            diffRow.style.lineHeight = "1.3";
                            diffRow.style.whiteSpace = "normal";
                            diffRow.style.wordBreak = "break-word";
                            diffRow.style.overflowWrap = "anywhere";
                            diffRow.style.minWidth = "0";
                            diffList.appendChild(diffRow);
                        });
                    }

                    if (differenzeConfronto.length > 0) {
                        diffList.appendChild(this._crRiquadroConfronto(differenzeConfronto));
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
                    //Su un pannello stretto i pulsanti vanno a capo invece di ridurre il testo
                    //della riga a due lettere.
                    actions.style.flexWrap = "wrap";
                    actions.style.justifyContent = "flex-end";
                    actions.style.maxWidth = "50%";
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
                        //Il Fix rifa' il box a partire dal dato: con sole differenze sui campi
                        //osservati in pagina non c'e' niente da rifare, e offrirlo sarebbe un
                        //invito a rimettere mano a un box che va bene com'e'.
                        if (segnalazioniIntegrita.length > 0) {
                            actions.appendChild(btnFix);
                        }
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

                    const row = this._crRow("uscito");
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

                    const codice = this._crCodiceGruppo(item.codiceGruppo);
                    codice.style.flex = "1 1 auto";

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
                    actions.style.flexWrap = "wrap";
                    actions.style.justifyContent = "flex-end";
                    actions.style.maxWidth = "50%";
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

        btnDeleteAll.addEventListener("click", () => this._eliminaTuttiUsciti(records));

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    //I20-981: una segnalazione che se ne va lo deve far vedere. L'opacita' si scrive a passi:
    //in UXP leggere una misura appena scritta non e' affidabile, e delle animazioni di jQuery
    //nel plugin non c'e' un solo uso vivo (fadeOut e animate compaiono commentati), quindi non
    //ci si appoggia. Scrivere style.opacity invece funziona, ed e' gia' usato in mezzo report.
    DURATA_DISSOLVENZA: 420,
    PASSO_DISSOLVENZA: 35,

    /// Mentre una riga sta sparendo non si accetta nessun'altra azione del report. I pulsanti
    /// delle righe sono immagini, non bottoni: disabled non esiste e pointer-events in UXP non
    /// e' verificabile, quindi il blocco vero e' questo interruttore, che non dipende da come
    /// il motore tratta lo stile.
    azioneReportInCorso() {
        return this._azioneReportInCorso === true;
    },

    _dissolviElementi(elementi) {
        const lista = (Array.isArray(elementi) ? elementi : [elementi]).filter(el => el != null);

        return new Promise(resolve => {
            if (lista.length === 0) {
                resolve(false);
                return;
            }

            lista.forEach(el => this._spegniInterazione(el));

            const passi = Math.max(1, Math.round(this.DURATA_DISSOLVENZA / this.PASSO_DISSOLVENZA));
            let passo = 0;

            const timer = setInterval(() => {
                passo++;
                const opacita = Math.max(0, 1 - (passo / passi));

                lista.forEach(el => {
                    try {
                        el.style.opacity = String(opacita);
                    }
                    catch (err) {
                        //Un elemento tolto dall'interfaccia mentre sfuma non e' un errore.
                    }
                });

                if (passo >= passi) {
                    clearInterval(timer);
                    resolve(true);
                }
            }, this.PASSO_DISSOLVENZA);
        });
    },

    _spegniInterazione(elemento) {
        try {
            elemento.style.pointerEvents = "none";
            elemento.style.cursor = "default";

            const figli = elemento.querySelectorAll("img, button, sp-action-button, sp-button, input");
            for (let i = 0; i < figli.length; i++) {
                figli[i].style.pointerEvents = "none";
                figli[i].style.cursor = "default";

                if (figli[i].tagName !== "IMG") {
                    figli[i].disabled = true;
                }
            }
        }
        catch (err) {
            console.error("Interazione non disattivata durante la dissolvenza:", err);
        }
    },

    _rigaDelPayload(payloadId) {
        if (!payloadId) {
            return null;
        }

        try {
            return document.querySelector('[data-payload-id="' + payloadId + '"]');
        }
        catch (err) {
            console.error("Riga della segnalazione non trovata:", err);
            return null;
        }
    },

    /// La riga se ne va sotto gli occhi dell'operatore, e solo dopo cambia lo stato. Se la riga
    /// non si trova, il lavoro si fa lo stesso: l'effetto e' un di piu', non una condizione.
    async _dissolviRiga(payloadId) {
        const riga = this._rigaDelPayload(payloadId);
        if (riga == null) {
            return false;
        }

        return await this._dissolviElementi(riga);
    },

    async _onConfrontoAction(ev, action) {
        //Mentre una riga sta sparendo non si accetta altro: un secondo clic lavorerebbe su un
        //record che sta gia' uscendo dal report.
        if (this.azioneReportInCorso()) {
            return;
        }

        const payloadId = ev.currentTarget?.dataset?.payloadId;
        const payload = this._getConfrontoPayload(payloadId);

        if (!payload) {
            console.warn("Payload non trovato:", payloadId);
            return;
        }

        this._azioneReportInCorso = true;

        try {
            await this._eseguiAzioneConfronto(action, payloadId, payload);
        }
        finally {
            this._azioneReportInCorso = false;
        }
    },

    async _eseguiAzioneConfronto(action, payloadId, payload) {
        switch (action) {
            case "find":
                await this._apriSchedaDalReport(payloadId, payload);
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
                await this._mandaInWhitelist(payloadId, payload);
                break;

            case "restoreWhitelist":
                await this._ripristinaDaWhitelist(payloadId, payload);
                break;

            case "delete":
                await this._deleteElemento(payloadId, payload);
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

        await this._dissolviRiga(payloadId);

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

    async _mandaInWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        await this._dissolviRiga(payloadId);

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

    async _ripristinaDaWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        await this._dissolviRiga(payloadId);

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
            Utility.impostaTooltip(iconEl, payload.hidden ? "Nascosto" : "Visibile");
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
            return null;
        }

        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
        } catch (err) {
            console.error("Errore selezione:", err);
        }

        return box;
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

    async _deleteElemento(payloadId, payload) {
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

            await this._dissolviRiga(payloadId);

            const key = this._getReportCategoryFromTipo(payload?.tipo);
            this._removeRecordFromArray(this._confrontoReportState?.report?.[key], record);
            this._removeConfrontoPayload(payloadId);
            this._saveCurrentReportAndWhitelist();
            this._refreshConfrontoReportUi();

        } catch (err) {
            console.error("Errore durante eliminazione box:", err);
        }
    },

    //I20-981: l'eliminazione di tutti i box usciti, che prima era un pulsante con dietro un
    //TODO. Toglie dal documento gli stessi box che il singolo "Elimina" toglie uno per uno:
    //una conferma sola all'inizio, con scritto quanti sono, e un solo rinfresco alla fine.
    //Un box gia' sparito dal documento non e' un errore: e' il caso di chi ha fatto pulizia a
    //mano prima di aprire il report, e nel riepilogo si conta a parte.
    async _eliminaTuttiUsciti(records) {
        const elenco = Array.isArray(records) ? records.slice() : [];

        if (elenco.length === 0) {
            messaggioUtente("Nessun elemento da eliminare", "warning", false, 3);
            return;
        }

        const ok = await this._confirmReportAction(
            "massive",
            "Eliminare dal documento " + elenco.length + " box segnalati come usciti dal tracciato? L'operazione non si annulla.");

        if (!ok) {
            return;
        }

        let eliminati = 0;
        let nonTrovati = 0;
        let errori = 0;

        for (let i = 0; i < elenco.length; i++) {
            const record = elenco[i];

            try {
                const box = this._resolveBoxFromRecord(record);

                if (!box || !box.isValid) {
                    nonTrovati++;
                    continue;
                }

                box.remove();
                this._removeRecordFromArray(this._confrontoReportState?.report?.recordUsciti, record);
                eliminati++;
            }
            catch (err) {
                console.error("Errore durante l'eliminazione massiva del box:", err);
                errori++;
            }
        }

        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();

        let riepilogo = "Eliminati " + eliminati + " box su " + elenco.length;
        if (nonTrovati > 0) {
            riepilogo += ", " + nonTrovati + " non piu' in pagina";
        }
        if (errori > 0) {
            riepilogo += ", " + errori + " con errori (vedi console)";
        }

        messaggioUtente("Code CNF-023: " + riepilogo, errori > 0 ? "warning" : "success", false, 8);
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
                true
            );

            rimuoviSimboli();


            if (box != null){
                await this._dissolviRiga(payloadId);

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
        //I20-981: quattro linguette con il conteggio non stanno su una riga sola in un pannello
        //stretto: vanno a capo invece di uscire.
        header.style.flexWrap = "wrap";
        header.style.rowGap = "4px";
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

    //Il nome semplice serve al suggerimento: sull'etichetta c'e' anche il conteggio, e
    //"Mostra cambiati (12)" si leggerebbe male.
    _crTabButton(label, active = false, nomeSemplice = null) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.type = "button";
        Utility.impostaTooltip(btn, "Mostra " + String(nomeSemplice || label || "").toLowerCase());
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
        el.style.fontSize = "12px";
        el.style.letterSpacing = "0.4px";
        el.style.textTransform = "uppercase";
        el.style.padding = "6px 8px";
        el.style.marginTop = "10px";
        el.style.marginBottom = "2px";
        el.style.borderBottom = "2px solid #8ab661";
        el.style.flexShrink = "0";
        el.style.backgroundColor = "#eef7e3";
        return el;
    },

    //I20-981: il codice gruppo si copia con un clic.
    //Un codice gruppo e' l'elenco dei membri separati da virgola: copiato cosi' com'e' si
    //incolla nella ricerca del revisore, che e' il motivo per cui serve.
    _crCodiceGruppo(codiceGruppo) {
        const testo = String(codiceGruppo == null ? "" : codiceGruppo);

        const elemento = document.createElement("div");
        elemento.textContent = this._truncate(testo || "-", 20);
        elemento.style.fontWeight = "600";
        elemento.style.whiteSpace = "nowrap";
        elemento.style.overflow = "hidden";
        elemento.style.textOverflow = "ellipsis";
        elemento.style.minWidth = "0";

        if (testo === "") {
            return elemento;
        }

        Utility.impostaTooltip(elemento, "Clicca per copiare i codici del gruppo: " + testo);
        elemento.style.cursor = "pointer";
        elemento.style.textDecoration = "underline dotted";

        elemento.addEventListener("click", () => this.copiaCodiceGruppo(testo));

        return elemento;
    },

    copiaCodiceGruppo(codiceGruppo) {
        const testo = String(codiceGruppo == null ? "" : codiceGruppo);
        if (testo === "") {
            return;
        }

        try {
            //writeText vuole una stringa: passargli un oggetto, come si fa in qualche altro
            //punto del plugin, finisce per copiare "[object Object]".
            navigator.clipboard.writeText(testo);
            messaggioUtente("Codici del gruppo copiati negli appunti", "success", false, 2);
        }
        catch (err) {
            console.error("Errore durante la copia del codice gruppo:", err);
            messaggioUtente("Code CNF-022: Non e' stato possibile copiare i codici del gruppo", "error", false, 6);
        }
    },

    //I20-981: una riga porta sul fianco il colore del suo stato.
    //Scorrendo un elenco lungo il colore dice a che categoria appartiene la riga senza doverla
    //leggere: e' la differenza fra cercare e vedere.
    COLORI_STATO: {
        cambiato: "#e0a800",
        uscito: "#c0392b",
        nuovo: "#2e7d32",
        differente: "#1565c0"
    },

    //I20-981: il riquadro che raccoglie le differenze sui campi osservati dentro una riga.
    //Sta staccato dalle segnalazioni di integrita' e porta il colore dei confronti, cosi' si
    //capisce a colpo d'occhio che parla di un'altra cosa.
    _crRiquadroConfronto(differenze) {
        const riquadro = document.createElement("div");
        riquadro.style.marginTop = "6px";
        riquadro.style.padding = "4px 6px";
        riquadro.style.borderLeft = "3px solid " + this.COLORI_STATO.differente;
        riquadro.style.backgroundColor = "#eef3fb";
        riquadro.style.borderRadius = "3px";
        riquadro.style.minWidth = "0";

        const titolo = document.createElement("div");
        titolo.textContent = "Campi osservati (confronto)";
        titolo.style.fontSize = "10px";
        titolo.style.fontWeight = "700";
        titolo.style.letterSpacing = "0.3px";
        titolo.style.textTransform = "uppercase";
        titolo.style.color = this.COLORI_STATO.differente;
        titolo.style.marginBottom = "2px";
        Utility.impostaTooltip(titolo, "Campi che non cambiano il box ma che decidono a che pagina va la referenza");
        riquadro.appendChild(titolo);

        (differenze || []).forEach(differenza => {
            const riga = document.createElement("div");
            riga.style.fontSize = "11px";
            riga.style.lineHeight = "1.3";
            riga.style.whiteSpace = "normal";
            riga.style.overflowWrap = "anywhere";
            riga.style.minWidth = "0";

            const campo = document.createElement("span");
            campo.textContent = differenza?.label || "";
            campo.style.fontWeight = "600";
            riga.appendChild(campo);
            riga.appendChild(document.createTextNode(": " + (differenza?.difference || "")));

            riquadro.appendChild(riga);
        });

        return riquadro;
    },

    _crRow(stato = null) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexDirection = "row";
        row.style.alignItems = "start";
        row.style.gap = "10px";
        row.style.padding = "8px";
        row.style.border = "1px solid #444";
        row.style.borderLeft = "4px solid " + (this.COLORI_STATO[stato] || "#444");
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
        Utility.impostaTooltip(btn, label);
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
            Utility.impostaTooltip(img, label);
            img.style.height = "16px";
            img.style.width = "auto";
            img.style.display = "block";
            Utility.impostaTooltip(btn, label);
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
        Utility.impostaTooltip(img, label);
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


    //I20-981 (Lotto 4a): la sezione Confronti, nella modalita' che si apre per prima.
    //Confronta la lista con se stessa: per i campi che l'agenzia tiene d'occhio, mostra cosa
    //aveva la referenza prima e cosa ha adesso. Evidenzia e basta, non propone correzioni: a
    //decidere se la referenza va spostata di pagina e' l'operatore.
    campiOsservatiConfronto() {
        try {
            const campi = pluginMiddleware.getCampo("campiOsservatiConfronto");
            return Array.isArray(campi) ? campi : [];
        }
        catch (err) {
            console.error("Campi osservati per il confronto non disponibili:", err);
            return [];
        }
    },

    _calcolaConfronti() {
        const campi = this.campiOsservatiConfronto();

        if (campi.length === 0) {
            return { campi: campi, voci: [] };
        }

        return {
            campi: campi,
            voci: reportConfronti.confrontoConSeStessa(this._recordsListaKit(), campi)
        };
    },

    //I20-981: la scheda Confronti ospitera' il confronto con un'altra lista (prossimo lotto).
    //Il confronto della lista con se stessa vive nelle righe dei Cambiati, dove ci sono gia' i
    //pulsanti per trovare la referenza, risolverla o metterla in whitelist.
    _buildPanelConfronti() {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent();

        const modo = document.createElement("div");
        modo.textContent = "Confronto con un'altra lista";
        modo.style.fontWeight = "600";
        modo.style.fontSize = "12px";
        topbar.appendChild(modo);

        content.appendChild(this._crEmptyState("Nessuna lista di confronto selezionata"));

        const nota = document.createElement("div");
        nota.textContent = "Le differenze della lista con se stessa si trovano nella scheda Cambiati, "
            + "nel riquadro \"Campi osservati\" di ogni referenza.";
        nota.style.padding = "0 8px 12px 8px";
        nota.style.fontSize = "11px";
        nota.style.opacity = "0.8";
        nota.style.whiteSpace = "normal";
        content.appendChild(nota);

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    _buildPanelNuovi(report) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();

        const btnImpaginaTutti = this._crButton("Impagina in coda");
        Utility.impostaTooltip(btnImpaginaTutti, "Impagina tutto in coda al documento");

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
        //I20-981: in orizzontale questo contenitore non scorre, in nessun modo nativo: ne' con
        //"auto", ne' con "scroll", nemmeno dando alla tabella una larghezza vera in pixel. Lo
        //scorrimento laterale lo fa la barra qui sotto, spostando la tabella; qui resta il solo
        //scorrimento verticale, che invece funziona ed e' quello della rotella.
        tableScroll.style.overflowX = "hidden";
        tableScroll.style.overflowY = "scroll";
        tableScroll.style.border = "1px solid #555";
        tableScroll.style.borderRadius = "4px";

        //I20-981: la tabella e' divisa in due colonne dentro l'unico contenitore che scorre in
        //verticale: a sinistra i pulsanti di impaginazione, a larghezza fissa, che restano
        //fermi; a destra i dati, che sono i soli a spostarsi di lato. Stando nello stesso
        //contenitore le due colonne scorrono insieme in verticale per costruzione, e le righe
        //restano appaiate grazie alle altezze fisse gia' in uso: 42px la riga, 34px
        //l'intestazione.
        const divisione = document.createElement("div");
        divisione.style.display = "flex";
        divisione.style.flexDirection = "row";
        divisione.style.alignItems = "flex-start";
        divisione.style.minWidth = "100%";

        const colonnaAzioni = document.createElement("div");
        colonnaAzioni.style.display = "flex";
        colonnaAzioni.style.flexDirection = "column";
        colonnaAzioni.style.flexShrink = "0";
        colonnaAzioni.style.borderRight = "2px solid #bbb";

        const headerAzioni = document.createElement("div");
        headerAzioni.style.display = "flex";
        headerAzioni.style.flexShrink = "0";

        const bodyAzioni = document.createElement("div");
        bodyAzioni.style.display = "flex";
        bodyAzioni.style.flexDirection = "column";

        colonnaAzioni.appendChild(headerAzioni);
        colonnaAzioni.appendChild(bodyAzioni);

        //L'area dei dati e' la finestra dello scorrimento laterale: quello che esce di qui
        //resta nascosto, e la sua larghezza e' la misura che dice alla barra quanto si vede.
        const areaDati = document.createElement("div");
        areaDati.style.flex = "1 1 auto";
        areaDati.style.minWidth = "0";
        areaDati.style.overflow = "hidden";

        //I20-981: la larghezza della tabella dei dati si dichiara in pixel, sommando le
        //colonne. Era scritta "fit-content", e senza una larghezza vera non c'e' nulla da
        //scorrere: la tabella si schiaccia nello spazio disponibile. Il minWidth al 100%
        //serve per il caso opposto, poche colonne in un pannello largo, dove la tabella deve
        //comunque riempire il riquadro.
        const table = document.createElement("div");
        table.style.display = "flex";
        table.style.flexDirection = "column";
        table.style.alignItems = "flex-start";
        table.style.minWidth = "100%";

        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.flexShrink = "0";
        headerRow.style.minWidth = "100%";

        const body = document.createElement("div");
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.minWidth = "100%";

        table.appendChild(headerRow);
        table.appendChild(body);
        areaDati.appendChild(table);
        divisione.appendChild(colonnaAzioni);
        divisione.appendChild(areaDati);
        tableScroll.appendChild(divisione);
        wrapper.appendChild(tableScroll);

        panel.appendChild(topbar);
        panel.appendChild(wrapper);

        const listaTracciato = this._leggiListaKitLocale();

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
            table,
            tableScroll,
            areaDati,
            colonnaAzioni,
            headerAzioni,
            bodyAzioni,
            colonneExtra,
            sortKey: null,
            sortDirection: null,

            pickerLibreria,
            menuLibreria,
            btnRefreshLibreria,
            libreriaCorrente: null,
            elementiLibreria: []
        };

        wrapper.appendChild(this._crBarraScorrimentoNuovi(this._confrontoNuoviState));

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

            //I20-981: anche una referenza non ancora impaginata puo' avere campi osservati
            //cambiati, ed e' un'informazione che serve prima di decidere dove metterla.
            const confrontoRiga = reportConfronti.differenzePerPresenza(
                this._indiceConfronti, codiceGruppo, reportConfronti.idRecDelRecord(item));

            result.push({
                raw: item,
                originalIndex: i,
                codiceGruppo,
                descrizione: this._getDescrizioneNuovo(item),
                confronto: confrontoRiga != null ? reportConfronti.testoDifferenze(confrontoRiga.differenze) : ""
            });
        }

        return result;
    },

    //I20-981: una sola descrizione composta per il csv, per la tabella dei nuovi e per le
    //info, con la barra al posto del trattino: due separatori diversi fra schermo e file
    //sarebbero una trappola per chi confronta l'uno con l'altro.
    _getDescrizioneNuovo(item) {
        return reportConfrontoCsv.descrizioneComposta(item);
    },

    _renderNuoviTable() {
        const state = this._confrontoNuoviState;
        if (!state) return;

        state.headerRow.innerHTML = "";
        state.body.innerHTML = "";

        if (state.headerAzioni != null) state.headerAzioni.innerHTML = "";
        if (state.bodyAzioni != null) state.bodyAzioni.innerHTML = "";

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

        //I20-981: i campi osservati stanno in fondo a destra: servono quando servono, e non
        //devono rubare spazio a codice e descrizione, che si leggono sempre.
        const colonnaConfronto = {
            key: "confronto",
            label: "Campi osservati",
            perc: 130,
            minPx: 260,
            sortable: true,
            small: true
        };

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
            return key !== "codicegruppo" && key !== "descrizione" && key !== "codice" && key !== "confronto";
        });

        const colonne = [...colonneBase, ...colonneExtraFiltrate, colonnaConfronto];
        state.colonneRender = colonne;

        //La colonna dei pulsanti sta fuori dallo scorrimento: la larghezza da scorrere e'
        //quella dei soli dati, ed e' la sola che la barra deve conoscere.
        const colonnaAzione = colonne.find(col => col.key === "__azione__");
        const colonneDati = colonne.filter(col => col.key !== "__azione__");

        const larghezzaTotale = this._larghezzaTotaleColonne(colonneDati);
        state.larghezzaTotale = larghezzaTotale;

        if (state.table != null) {
            state.table.style.width = larghezzaTotale + "px";
        }
        state.headerRow.style.width = larghezzaTotale + "px";
        state.body.style.width = larghezzaTotale + "px";

        if (state.headerAzioni != null && colonnaAzione != null) {
            state.headerAzioni.appendChild(this._crNuoviHeaderCell(colonnaAzione));
        }

        for (let i = 0; i < colonneDati.length; i++) {
            state.headerRow.appendChild(this._crNuoviHeaderCell(colonneDati[i]));
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
            if (state.bodyAzioni != null) {
                state.bodyAzioni.appendChild(this._crNuoviActionCell(state.rowsCurrent[i]));
            }

            state.body.appendChild(this._crNuoviDataRow(state.rowsCurrent[i], colonneDati));
        }

        //Le colonne possono essere cambiate: si riporta la tabella dove dice lo spostamento e
        //si rimette il cursore in accordo.
        this._scorriNuovi(state, state.spostamento || 0);
    },

    //I20-981: la barra di scorrimento orizzontale della tabella dei nuovi, disegnata da noi.
    //In UXP quel contenitore non scorre in orizzontale in nessun modo nativo, cosi' la tabella
    //viene spostata con un margine negativo e la barra la mettiamo qui sotto, sempre visibile.
    //Le frecce e il clic sulla traccia bastano da soli: se il trascinamento del cursore non
    //funzionasse, la tabella si scorre comunque.
    PASSO_SCORRIMENTO: 160,

    _crBarraScorrimentoNuovi(state) {
        const barra = document.createElement("div");
        barra.style.display = "flex";
        barra.style.alignItems = "center";
        barra.style.gap = "4px";
        barra.style.flexShrink = "0";
        barra.style.padding = "4px 0 0 0";

        const indietro = this._crFrecciaScorrimento("‹", "Sposta la tabella verso sinistra");
        const avanti = this._crFrecciaScorrimento("›", "Sposta la tabella verso destra");

        const traccia = document.createElement("div");
        traccia.style.position = "relative";
        traccia.style.flex = "1 1 auto";
        traccia.style.height = "12px";
        traccia.style.minWidth = "0";
        traccia.style.backgroundColor = "#e6e6e6";
        traccia.style.borderRadius = "6px";
        traccia.style.cursor = "pointer";
        Utility.impostaTooltip(traccia, "Clicca o trascina per scorrere le colonne");

        const cursore = document.createElement("div");
        cursore.style.position = "absolute";
        cursore.style.top = "0";
        cursore.style.left = "0";
        cursore.style.height = "12px";
        cursore.style.width = "40px";
        cursore.style.backgroundColor = "#8a8a8a";
        cursore.style.borderRadius = "6px";
        cursore.style.cursor = "grab";

        traccia.appendChild(cursore);

        barra.appendChild(indietro);
        barra.appendChild(traccia);
        barra.appendChild(avanti);

        state.barra = barra;
        state.traccia = traccia;
        state.cursore = cursore;
        state.spostamento = 0;

        indietro.addEventListener("click", () => this._scorriNuovi(state, state.spostamento - this.PASSO_SCORRIMENTO));
        avanti.addEventListener("click", () => this._scorriNuovi(state, state.spostamento + this.PASSO_SCORRIMENTO));

        traccia.addEventListener("click", (evento) => {
            //Il clic sul cursore lo prende il cursore: qui arriva solo il clic sulla traccia.
            if (evento?.target === cursore) {
                return;
            }

            const misure = this._misureScorrimentoNuovi(state);
            const posizione = this._posizioneNellaTraccia(evento, traccia);

            this._scorriNuovi(state, barraScorrimento.spostamentoDaClic(
                posizione, misure.contenuto, misure.visibile, misure.traccia));
        });

        //Terzo strato: il trascinamento. Se questi eventi non arrivano, restano frecce e traccia.
        cursore.addEventListener("mousedown", (evento) => {
            const misure = this._misureScorrimentoNuovi(state);

            state.trascinamento = {
                partenzaX: evento?.clientX || 0,
                spostamentoIniziale: state.spostamento,
                misure: misure
            };

            cursore.style.cursor = "grabbing";
        });

        this._abilitaTrascinamentoBarra();

        return barra;
    },

    _crFrecciaScorrimento(simbolo, descrizione) {
        const freccia = document.createElement("button");
        freccia.type = "button";
        freccia.textContent = simbolo;
        freccia.style.height = "16px";
        freccia.style.minWidth = "18px";
        freccia.style.padding = "0";
        freccia.style.lineHeight = "1";
        freccia.style.cursor = "pointer";
        freccia.style.flexShrink = "0";
        Utility.impostaTooltip(freccia, descrizione);
        return freccia;
    },

    /// Il trascinamento si ascolta una volta sola sul documento: il mouse esce dal cursore
    /// quasi subito, e se ascoltassimo solo lui il movimento si perderebbe.
    _abilitaTrascinamentoBarra() {
        if (this._trascinamentoBarraAttivo) {
            return;
        }

        this._trascinamentoBarraAttivo = true;
        const me = this;

        $(document).on("mousemove", function (evento) {
            const state = me._confrontoNuoviState;
            if (state == null || state.trascinamento == null) {
                return;
            }

            const misure = state.trascinamento.misure;
            const pixel = (evento?.clientX || 0) - state.trascinamento.partenzaX;

            me._scorriNuovi(state, barraScorrimento.spostamentoDaTrascinamento(
                state.trascinamento.spostamentoIniziale, pixel,
                misure.contenuto, misure.visibile, misure.traccia));
        });

        $(document).on("mouseup", function () {
            const state = me._confrontoNuoviState;
            if (state == null || state.trascinamento == null) {
                return;
            }

            state.trascinamento = null;
            if (state.cursore != null) {
                state.cursore.style.cursor = "grab";
            }
        });
    },

    /// Le misure si leggono adesso, non alla costruzione: quando il pannello nasce non e'
    /// ancora impaginato e tornerebbero zero.
    _misureScorrimentoNuovi(state) {
        let visibile = 0;
        let traccia = 0;

        try {
            visibile = (state?.areaDati || state?.tableScroll)?.clientWidth || 0;
            traccia = state?.traccia?.clientWidth || 0;
        }
        catch (err) {
            console.error("Misure della barra non disponibili:", err);
        }

        return {
            contenuto: state?.larghezzaTotale || 0,
            visibile: visibile,
            traccia: traccia
        };
    },

    _posizioneNellaTraccia(evento, traccia) {
        try {
            const rettangolo = traccia.getBoundingClientRect();
            return (evento?.clientX || 0) - (rettangolo?.left || 0);
        }
        catch (err) {
            return 0;
        }
    },

    /// Sposta la tabella e aggiorna il cursore.
    _scorriNuovi(state, spostamento) {
        if (state == null || state.table == null) {
            return;
        }

        const misure = this._misureScorrimentoNuovi(state);

        state.spostamento = barraScorrimento.limitaSpostamento(spostamento, misure.contenuto, misure.visibile);
        state.table.style.marginLeft = "-" + state.spostamento + "px";

        this._aggiornaCursoreNuovi(state, misure);
    },

    _aggiornaCursoreNuovi(state, misure) {
        if (state == null || state.cursore == null) {
            return;
        }

        const m = misure || this._misureScorrimentoNuovi(state);
        const serve = barraScorrimento.serveLaBarra(m.contenuto, m.visibile);

        if (state.barra != null) {
            //Se le colonne ci stanno tutte, la barra non ha niente da fare e sparisce.
            //Finche' le misure non sono disponibili la si lascia, altrimenti lampeggerebbe.
            state.barra.style.display = (m.visibile > 0 && !serve) ? "none" : "flex";
        }

        const geometria = barraScorrimento.geometriaCursore(
            state.spostamento, m.contenuto, m.visibile, m.traccia);

        state.cursore.style.width = geometria.larghezza + "px";
        state.cursore.style.left = geometria.sinistra + "px";
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
        Utility.impostaTooltip(cell, col.label);

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
        row.style.width = (this._confrontoNuoviState?.larghezzaTotale || 0) + "px";
        row.style.minWidth = "100%";

        for (let i = 0; i < colonne.length; i++) {
            const col = colonne[i];

            //I pulsanti non stanno qui: sono nella colonna fissa di sinistra, che non si
            //sposta di lato.
            if (col.key === "__azione__") {
                continue;
            }

            let value = "";
            if (col.key === "codiceGruppo") {
                value = rowData.codiceGruppo || "";
            } else if (col.key === "descrizione") {
                value = rowData.descrizione || "";
            } else if (col.key === "confronto") {
                value = rowData.confronto || "";
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
        cell.style.borderBottom = "1px solid #eee";
        //I20-981: i pulsanti restano fermi mentre i campi scorrono perche' questa cella sta
        //nella colonna di sinistra, fuori dalla tabella che si sposta. Con position sticky non
        //funzionava: in UXP non viene ignorato, toglie la cella dal flusso e manda la colonna
        //fuori dal riquadro.
        cell.style.backgroundColor = "#ffffff";
        cell.style.minHeight = "42px";
        cell.style.maxHeight = "42px";

        const btn = this._crButton("Imp.");
        Utility.impostaTooltip(btn, "Impagina questo nuovo record");
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
        Utility.impostaTooltip(text, value || "");
        text.style.width = "100%";
        text.style.overflow = "hidden";
        text.style.whiteSpace = "nowrap";
        text.style.textOverflow = "ellipsis";
        text.style.lineHeight = "1.2";
        text.style.fontSize = small ? "11px" : "12px";

        Utility.impostaTooltip(cell, value || "");

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

    /// La larghezza della tabella, in pixel: la somma delle colonne.
    /// Serve perche' il contenitore abbia qualcosa da scorrere in orizzontale.
    _larghezzaTotaleColonne(colonne) {
        return (colonne || []).reduce((somma, col) => {
            const larghezza = parseInt(this._calcNuoviColumnWidth(col), 10);
            return somma + (isNaN(larghezza) ? 0 : larghezza);
        }, 0);
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
