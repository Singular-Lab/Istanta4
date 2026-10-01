/// I20-1015: collocare il file di una foto nel suo riquadro - placeFoto, updateFoto,
/// applicaNoRender. Stava in utility.js come oggetto a se', FotoPlacer; utility.js lo riesporta
/// con lo stesso nome, perche' il core e le agenzie (Agenzie/*/custom.js) lo prendono con
/// require('./utility').
///
/// Usa come globali quelle di indexNew - pluginMiddleware, customAgenzia, docInLavorazione,
/// pathLavorazione, percorsoLinks, percorsoLoghi - come faceva dentro utility.js. Non importa
/// utility.js: e' utility.js a importare questo file.

const { FitOptions, LocationOptions } = require('indesign');

const FotoPlacer =
{
    placeFoto:function(nomeFoto, fotoRectangle, callback)
    {
        var warningMessage = "";
        let nomeNoFoto = pluginMiddleware.getCampo("nomeNoFoto");
        if(nomeNoFoto == null || nomeNoFoto == "")
        {
            nomeNoFoto = "nofoto.png";
        }

        let nomeFotoNoFound = pluginMiddleware.getCampo("fotoNotFound");
        if(nomeFotoNoFound == null || nomeFotoNoFound == "")
        {
            nomeFotoNoFound = "fotoNoFound.png";
        }

        var path = /*pathLavorazione +*/ (nomeFoto != null && nomeFoto != "" ? percorsoLinks + nomeFoto : percorsoLoghi + nomeNoFoto);
        try {
            console.log("Path: " + path);
            if(customAgenzia.paddingFoto){
                //rimpiccioliamo la fotorectangle del padding
                fotoRectangle.geometricBounds = [
                    fotoRectangle.geometricBounds[0] + customAgenzia.paddingFoto[0],
                    fotoRectangle.geometricBounds[1] + customAgenzia.paddingFoto[1],
                    fotoRectangle.geometricBounds[2] - customAgenzia.paddingFoto[0],
                    fotoRectangle.geometricBounds[3] - customAgenzia.paddingFoto[1]
                ];
            }
            fotoRectangle.place(path);
            //fotoRectangle.fillColor = "None";
            fotoRectangle.fit(FitOptions.PROPORTIONALLY);
            if(customAgenzia.paddingFoto){
                fotoRectangle.geometricBounds = [
                    fotoRectangle.geometricBounds[0] - customAgenzia.paddingFoto[0],
                    fotoRectangle.geometricBounds[1] - customAgenzia.paddingFoto[1],
                    fotoRectangle.geometricBounds[2] + customAgenzia.paddingFoto[0],
                    fotoRectangle.geometricBounds[3] + customAgenzia.paddingFoto[1]
                ];
            }
            //fotoRectangle.fit(FitOptions.FRAME_TO_CONTENT);
        }
        catch (ex) {
            let fotoNotFoundErr = false;
            if (nomeFoto != null && nomeFoto != "") {
                //Non è stato trovato la foto prodotto
                path = /*pathLavorazione +*/ percorsoLoghi + nomeFotoNoFound;
                try {
                    console.log("Path: " + path);
                    fotoRectangle.place(path);
                    //fotoRectangle.fillColor = "None";
                    fotoRectangle.fit(FitOptions.PROPORTIONALLY);
                    //fotoRectangle.fit(FitOptions.FRAME_TO_CONTENT);
                    warningMessage = "Foto non trovata, è stata inserita fotoNoFound.png";
                    fotoNotFoundErr = true;
                }
                catch (ex) {
                    //non è stato trovato il file nofoto            
                    warningMessage = "errore FotoNoFound non presente";
                }
            }
            else {
                //Non è stato trovato il file nofoto
                warningMessage = "Nofoto not found";
            }

            if (!fotoNotFoundErr && warningMessage != "") {
                var myColor = docInLavorazione.colors.itemByName("Red");
                if (myColor == null|| myColor.isValid == false) {
                    myColor = docInLavorazione.colors.add({ name: "Red", model: ColorModel.process, colorValue: [0, 100, 20, 20] });
                }
                fotoRectangle.fillColor = myColor;

                //creiamo un textframe in foto con il messaggio di errore
                var bounds = fotoRectangle.geometricBounds;
                var textFrame = fotoRectangle.textFrames.add();
                textFrame.contents = warningMessage;
                textFrame.geometricBounds = bounds;
            }

        }
        return warningMessage;
    },

    /// I20-1026: mette nel box un logo automatico, cioe' una voce di Foto.ExtraAuto, e restituisce
    /// l'elemento creato, ancora fuori dal gruppo: raggrupparlo tocca a chi chiama. E' la strada
    /// dell'impaginazione (impaginaBox) e del fix (CssFramework.applicaDisattivazioni, che riattiva
    /// i loghi che la forma del box vuole), per avere un modo solo di farlo.
    ///  - Un .idms si piazza una volta sola, in alto a sinistra della prima pagina, con label
    ///    simbolo$<sigla>$tipo_<tipo>, e lo si ricorda in cacheLoghi (globale di indexNew); nel box
    ///    ne va una copia, nell'angolo in alto a sinistra.
    ///  - Un'immagine va in un riquadro grande quanto il box, con il fit del cliente
    ///    (pluginMiddleware.getFitTypeLogo) e poi proporzionale.
    /// La label nel box e' foto_extra$<sigla>$tipo_<tipo>, e la voce riceve referenceTo.
    piazzaFotoExtraAuto(extra, box, paginaDelBox, doc = docInLavorazione) {
        var imgName = extra.nome;
        var sigla = extra.sigla;
        var tipo = extra.tipo;
        var path = /*pathLavorazione +*/ percorsoLoghi + imgName;
        //idms rappresenta un eccezione: deve essere caricato SOLO 1 VOLTA e piazzato nella prima pagina in alto a sx
        if (imgName.split(".")[1] == "idms") {
            if (cacheLoghi[sigla] == null || !cacheLoghi[sigla].isValid) {
                //Cerco in pagina 1 se ho gia' impaginato il simbolo
                var pag0 = doc.pages.item(0);
                for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                    var item = pag0.allPageItems[i2];
                    if (item.label == "simbolo$" + sigla + "$tipo_" + tipo) {
                        cacheLoghi[sigla] = item;
                        break;
                    }
                }

                if (cacheLoghi[sigla] == null || !cacheLoghi[sigla].isValid) {
                    let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                    objDms.label = "simbolo$" + sigla + "$tipo_" + tipo;
                    cacheLoghi[sigla] = objDms[0];
                }
            }
            var sy = cacheLoghi[sigla].duplicate(paginaDelBox);
            sy.move(doc.layers.itemByName("InPagina"));
            //muoviamo sy nell'angolo in alto a sinistra del box
            sy.move([box.visibleBounds[1], box.visibleBounds[0]]);
            extra.referenceTo = sy;
            sy.label = "foto_extra$" + sigla + "$tipo_" + tipo;
            sy.bringToFront();
            return sy;
        }

        var rect = box.parentPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, box, { geometricBounds: box.geometricBounds });
        rect.label = "foto_extra$" + sigla + "$tipo_" + tipo;
        rect.place(path);
        //Alessio: CONTENT_TO_FRAME al posto di FRAME_TO_CONTENT perche' in Despar faceva un macello con i
        //loghi che costringevano il frame ad adattarsi. Il cliente lo cambia con getFitTypeLogo.
        let fitType = FitOptions.CONTENT_TO_FRAME;
        if (pluginMiddleware.getFitTypeLogo != null) {
            fitType = pluginMiddleware.getFitTypeLogo(sigla, tipo);
        }
        if (fitType != null) {
            rect.fit(fitType);
            rect.fit(FitOptions.PROPORTIONALLY);
        }
        extra.referenceTo = rect;
        return rect;
    },

    applicaNoRender:function(fotoRectangle, noRender)
    {
        if (fotoRectangle == null) {
            return;
        }
        try {
            fotoRectangle.visible = noRender ? false : true;
        }
        catch (err) {
            console.log("Impossibile applicare l'opzione di rendering alla foto: " + err);
        }
    },

    updateFoto:function(nomeFoto, box, fotoRectangle, codice, statoSelezione = null, noRender = false)
    {
        //Se nomeFoto viene passato come null, allora si tratta di istruire la funzione a RIMUOVERE il rectangle se trovato
        //noRender true: la foto viene comunque impaginata e posizionata, ma resa invisibile nel documento

        var lastFoto = null;
        var primaria = null;

        if (fotoRectangle == null && codice != null) {
            //se non c'è la foto, cerchiamo se c'è già una foto con lo stesso codice
            for (var $box = 0; $box < box.allPageItems.length; $box++) {
                var item = box.allPageItems[$box];
                if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria")) || item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria"))) {//"immagine" || item.label=="foto_secondaria"){
                    //facciamo lo split della label per prendere il codice
                    var cod = item.label.split("$")[1];
                    if (cod == codice.toString()) {
                        fotoRectangle = item;
                        break;
                    }

                    lastFoto = item;
                    if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria"))) {
                        primaria = item;
                    }
                }
            }
        }

        if (nomeFoto != null) {
            try {
                let fotoCreata = false;
                if (fotoRectangle == null) {
                    //creiamo un nuovo rectangle, i bounds li facciamo pari a quelli della primaria con un offset di 10 a destra e in basso, se non ce la facciamo grnde 1/4 del box
                    var bounds_rect = (lastFoto != null ? [lastFoto.geometricBounds[0] + 10, lastFoto.geometricBounds[1] + 10, lastFoto.geometricBounds[2] + 10, lastFoto.geometricBounds[3] + 10] : [box.geometricBounds[0], box.geometricBounds[1], box.geometricBounds[0] + ((box.geometricBounds[2] - box.geometricBounds[0]) / 4), box.geometricBounds[1] + ((box.geometricBounds[3] - box.geometricBounds[1]) / 4)]);
                    fotoRectangle = box.parentPage.rectangles.add(box.itemLayer, LocationOptions.UNKNOWN, box, { geometricBounds: bounds_rect });
                    fotoCreata = true;

                    if (primaria != null) {
                        fotoRectangle.label = (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria") + "$" + codice;
                    }
                    else {
                        fotoRectangle.label = (pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine") + "$" + codice;
                    }
                }else{
                    if (fotoRectangle.images.length > 0) {
                        // Remove the previous image
                        fotoRectangle.images.item(0).remove();
                    }
                    else if (fotoRectangle.graphics.length > 0) {
                        // Remove the previous image
                        fotoRectangle.graphics.item(0).remove();
                    }
                }
                if (statoSelezione == 2) {
                    fotoRectangle.label = (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria") + "$" + codice;
                }
                else if (statoSelezione == 1) {
                    fotoRectangle.label = (pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine") + "$" + codice;
                }
                
                //I20-967: il chiamante deve poter sapere se il place e' andato a vuoto,
                //perche' un file appena scaricato puo' non essere ancora visibile a InDesign.
                var warningImpaginazione = FotoPlacer.placeFoto(nomeFoto, fotoRectangle, null);

                //L'opzione di rendering non altera geometria ne' posizionamento: la foto occupa
                //lo stesso spazio di prima, cambia solo la sua visibilita'.
                FotoPlacer.applicaNoRender(fotoRectangle, noRender);

                if (fotoCreata) {
                    //sfacciamo il box salvandoci l'etichetta e i suoi elementi, poi ricomponiamo un nuovo box con la foto, i vecchi elementi e assegnamo l'etichetta
                    var myPage = box.parentPage;
                    var oldGroup = box;
                    var oldLabel = oldGroup.label;
                    var oldItems = oldGroup.pageItems.everyItem().getElements();
                    //console.log("Sgruppamento");
                    oldGroup.ungroup();
                    //console.log("Concat");

                    var newItems = oldItems.concat(fotoRectangle);
                    var masterGroup = myPage.groups.add(newItems);
                    fotoRectangle.bringToFront();
                    masterGroup.label = oldLabel;

                    //console.log("Scorriamo gli elementi");

                    //scorriamo tutti gli oggetti in newGroup in cerca di label "immagine" e la portiamo in primo piano
                    var fotoPrimaria = null;
                    var base = null;
                    for (var i = masterGroup.allPageItems.length - 1; i >= 0; i--) {
                        if (masterGroup.allPageItems[i].label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine")) {
                            fotoPrimaria = masterGroup.allPageItems[i];
                        }
                        if (masterGroup.allPageItems[i].label.indexOf("base") == 0) {
                            base = masterGroup.allPageItems[i];
                        }
                    }

                    if (fotoPrimaria != null) {
                        fotoPrimaria.sendToBack();
                    }
                    if (base != null) {
                        base.sendToBack();
                    }

                    box = masterGroup;
                }

                return { box: box, fotoRectangle: fotoRectangle, warning: warningImpaginazione };
            } catch (err) {
                console.log(err);
                //Anche qui la foto non e' finita in pagina: il chiamante deve poterlo sapere.
                return { box: box, fotoRectangle: fotoRectangle, warning: "Errore durante l'impaginazione: " + err };
            }
        }
        else {
            //rimuoviamo la foto se c'è
            if (fotoRectangle != null) {
                fotoRectangle.remove();
            }
        }
        return { box: box, fotoRectangle: null, warning: "" };
    },

};

module.exports = FotoPlacer;
