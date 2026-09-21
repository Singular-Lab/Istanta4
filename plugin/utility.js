const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters } = require('indesign');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const cacheHashFoto = require('./cacheHashFoto');
const tooltipPosizione = require('./tooltipPosizione');

const Utility=
{
    itemsInfami:[],
    pagInfame:null,
    parseContent: function(content)
    {
        let result=[];
        let tagInLettura="";
        let inxLettura=0;

        //Controllo subito se il primo carattere è un tag altrimenti significa cheil contenuto non è taggettizzato
        if (content[0]!='<')
        {
            result.push({stile:"", content:content});
            return result;
        }    


        for (let i=0; i<content.length; i++)
        {
            console.log("Siamo all'indice " + i + " -> " + content[i]);

            if (content[i]=='<')
            {
                if (tagInLettura=="")
                {
                    //tag aperto
                    
                    let inxChiusuraTagApertura=content.indexOf(">", i);
                    
                    let tagName = content.substring(i+1, inxChiusuraTagApertura);
                    tagInLettura=tagName
                    
                    //i=inxChiusuraTagApertura;
                    inxLettura = inxChiusuraTagApertura;+1;

                    //Cerco la chiusura 
                    let keyTagChiuso="</"+tagInLettura+">";
                    let inxChiusuraTag = content.indexOf(keyTagChiuso, inxLettura);
                    if (inxChiusuraTag<0)
                    {
                        //Error
                        result.push({stile:tagName, content:"No found end of tag "+ tagName});
                        break;
                    }
                    else
                    {
                        tagInLettura="";

                        //guardiamo se subito dopo la chiusura del tag c'è \n, se c'è aggiungeremo al substring lo \n
                        let valText = content.substring(inxLettura+1, inxChiusuraTag);
                        valText = Utility.replaceAllSpecialCharacters(valText);

                        if (content[inxChiusuraTag+keyTagChiuso.length] == '\n')
                        {
                            //Aggiungo \n
                            result.push({stile:tagName, content:valText + "\n"});
                        }
                        else{
                            //Aggiungo il contenuto senza \n
                            result.push({stile:tagName, content:valText});
                        }
                        //Mi sposto all'indice dopo la chiusura del tag per iniziare a leggere il prossimo
                        i=((inxChiusuraTag+keyTagChiuso.length)-1);//-1 perchè poi al cisclo dopo prima di entrare fa i++
                        //inxLettura = i;
                    }

                }
                else
                {
                    // //let inxChiusuraTagChiusura=content.indexOf(">", inxLettura);
                    // let keyTagChiuso="</"+tagInLettura+">";
                    // let inxChiusuraTagChiusura=content.indexOf(keyTagChiuso, inxLettura);
                    // let tagName = content.substring(i+1, inxChiusuraTagChiusura+keyTagChiuso.length);
                    // if (tagName!="/"+tagInLettura)
                    // {
                    //     result.push({stile:"", content:"error"});
                    // }

                    // i=inxChiusuraTagChiusura;
                    // inxLettura=i+1;
                    // tagInLettura="";
                }
            }
            // else    
            //     result[result.length-1].content += content[i];   
            

        }

        return result;

    },
    componiStringTagFromInndTextFrame: function(tf)
    {
        let lastStyle="";
        let stringaFormata="";
        for (let t=0; t<tf.characters.length; t++)
        {
            let ch = tf.characters.item(t);
            let style = ch.appliedCharacterStyle.name;
            if (style!=lastStyle)
            {  
                if (lastStyle!="")
                {  
                    stringaFormata +="</" + lastStyle +  ">";
                }

                stringaFormata +="<" + style +  ">";
            }
            
            stringaFormata += ch.contents;

            lastStyle=style;

        }

        if (lastStyle!="")
            stringaFormata +="</" + lastStyle +  ">";

        return stringaFormata;
    },

    // Prende una stringa tipo: <StyleA>ciao</StyleA><StyleB>mondo</StyleB>
    // e la scrive nel textFrame applicando i characterStyle corretti ai range di testo.
    // NOTA: i "tag" devono chiamarsi ESATTAMENTE come i Character Style in InDesign.
    applicaTagStringToInndTextFrame: function (tf, taggedString, boxBounds) {
        try{
            if (!tf || !tf.isValid) return false;
            if (taggedString == null) return false;
    
            // --- parser semplice a stack: supporta annidamenti e testo libero ---
            function parseTaggedString(str) {
                let tokens = [];
                let i = 0;
    
                while (i < str.length) {
                    // trova prossimo tag
                    let lt = str.indexOf("<", i);
                    if (lt === -1) {
                        // solo testo finale
                        if (i < str.length) tokens.push({ type: "text", value: str.slice(i) });
                        break;
                    }
    
                    // testo prima del tag
                    if (lt > i) {
                        tokens.push({ type: "text", value: str.slice(i, lt) });
                    }
    
                    let gt = str.indexOf(">", lt + 1);
                    if (gt === -1) {
                        // tag rotto -> tutto testo
                        tokens.push({ type: "text", value: str.slice(lt) });
                        break;
                    }
    
                    let tagBody = str.slice(lt + 1, gt).trim();
                    if (tagBody.length === 0) {
                        i = gt + 1;
                        continue;
                    }
    
                    if (tagBody[0] === "/") {
                        tokens.push({ type: "close", name: tagBody.slice(1).trim() });
                    } else {
                        tokens.push({ type: "open", name: tagBody });
                    }
    
                    i = gt + 1;
                }
    
                return tokens;
            }
    
            // --- normalizza ritorni a capo a \r (InDesign) ---
            function normalizeIndesignBreaks(s) {
                if (s == null) return "";
                return String(s).replace(/\r\n/g, "\r").replace(/\n/g, "\r");
            }
    
            // --- ricostruisce testo + segmenti con style attivo ---
            function buildSegments(tokens) {
                let fullText = "";
                let segments = []; // {start,end,styleName}
    
                let styleStack = []; // stack di styleName
                let cursor = 0;
    
                for (let k = 0; k < tokens.length; k++) {
                    let tok = tokens[k];
    
                    if (tok.type === "open") {
                        styleStack.push(tok.name);
                        continue;
                    }
    
                    if (tok.type === "close") {
                        // chiusura: pop fino a quel nome (tollerante)
                        for (let s = styleStack.length - 1; s >= 0; s--) {
                            if (styleStack[s] === tok.name) {
                                styleStack.splice(s, 1);
                                break;
                            }
                        }
                        continue;
                    }
    
                    if (tok.type === "text") {
                        //let txt = normalizeIndesignBreaks(tok.value);
                        let txt = tok.value;
                        if (txt.length === 0) continue;
    
                        let activeStyle = styleStack.length > 0 ? styleStack[styleStack.length - 1] : null;

                        if (activeStyle && activeStyle.includes("$Hidden")) {
                            continue;
                        }
    
                        let start = cursor;
                        fullText += txt;
                        cursor += txt.length;
                        let end = cursor;
    
                        if (activeStyle) {
                            segments.push({ start: start, end: end, styleName: activeStyle });
                        }
                    }
                }
    
                return { fullText: fullText, segments: segments };
            }
    
            //prendiamo le misure originali del text frame
            let tfBounds = tf.geometricBounds;
            //prendiamo l'allineamento verticale del text frame
            let allineamento = tf.textFramePreferences.verticalJustification.toString();

            let overflowDirection = this.getDefaultOverflowDirection(tf);

            //cerchiamo in agenzia getOverflowDirection per vedere se c'è una configurazione specifica per questo text frame
            if (pluginMiddleware.getOverflowDirection) {
                let overflowDirectionCustom = pluginMiddleware.getOverflowDirection(tf);
                if (overflowDirectionCustom) {
                    overflowDirection.vertical = overflowDirectionCustom.vertical;
                    overflowDirection.horizontal = overflowDirectionCustom.horizontal;
                }
            }

            let tokens = parseTaggedString(String(taggedString));
            let built = buildSegments(tokens);
    
            //impostiamo lo stile del textFrame a nessuno
            let nessCharStyle=docInLavorazione.characterStyles.item("NESSUNO");
            //let nessCharStyleSys=docInLavorazione.characterStyles.item("[Nessuno]");
            if (!nessCharStyle.isValid)
            {
                nessCharStyle=docInLavorazione.characterStyles.item("[Nessuno]");
            }
            var invalidareStileDiCarattere = pluginMiddleware.getCampo("invalidareStileDiCarattere") !== null ? pluginMiddleware.getCampo("invalidareStileDiCarattere") : false;

            if (invalidareStileDiCarattere){
                tf.characters.everyItem().appliedCharacterStyle = nessCharStyle;
            }
    
            //allarghiamo il textframe alle dimensioni del box (con un margine di 1mm)
            let margine = 1; //mm
            if (tf.absoluteRotationAngle == 0) {
                tf.geometricBounds = [boxBounds[0]+margine, boxBounds[1]+margine, boxBounds[2]-margine, boxBounds[3]-margine];
            }
            // scrivi testo "pulito" nel frame
            tf.contents = built.fullText;
    
            // applica stili ai range
            for (let i = 0; i < built.segments.length; i++) {
                let seg = built.segments[i];
                let st = this.parseStile(seg.styleName, false);
                if (!st) continue;
    
                try {
                    // characters.itemByRange accetta indici inclusivi
                    let from = seg.start;
                    let to = seg.end - 1;
                    if (to < from) continue;
    
                    tf.characters.itemByRange(from, to).appliedCharacterStyle = st;
                } catch (e) {
                    // ignora errori sui range
                }
            }

            // if(built.segments.length==0 && invalidareStileDiCarattere){
            //     //se non ci sono segmenti con stili applicati, applichiamo lo stile nessuno a tutto il testo
            //     tf.characters.itemByRange(0, tf.characters.length - 1).appliedCharacterStyle = nessCharStyleSys;
            // }

            if (tf.absoluteRotationAngle != 0) {
                return true;
            }

            //controlliamo che overflow sono supportati, 
            // se non è supportato vertical rimettiamo l'altezza originale
            // se non è supportato horizontal rimettiamo la larghezza originale
            if (!overflowDirection.vertical) {
                //ripristino altezza originale
                tf.geometricBounds = [tfBounds[0], tf.geometricBounds[1], tfBounds[2], tf.geometricBounds[3]];
            }
            if (!overflowDirection.horizontal) {
                //ripristino larghezza originale
                tf.geometricBounds = [tf.geometricBounds[0], tfBounds[1], tf.geometricBounds[2], tfBounds[3]];
            }

            //Facciamo il fit del text frame al contenuto
            tf.parentStory.recompose();
            tf.fit(FitOptions.FRAME_TO_CONTENT);
    
    
            var newTfBounds = tf.geometricBounds;
    
            //controlliamo separatamente larghezza e altezza tra newTfBounds e TfBounds
            // se altezza tf > altezza newTf allora ripristiniamo i bounds verticali originali
            // se larghezza tf > larghezza newTf allora ripristiniamo i bounds orizzontali originali
            // se altezza newTf > tf dovremo spostare il textframe per ancorarlo dove era prima, per farlo leggiamo allineamento per capire 
            // come è allineato il testo, se è allineato in alto non c'è niente da fare
            // se è allineato in basso dobbiamo spostare il textframe per farlo coincidere con il bordo inferiore originale senza modificare l'altezza
            // se è allineato al centro dobbiamo spostare il textframe per farlo coincidere con il centro originale
    
            let altezzaOriginale = tfBounds[2] - tfBounds[0];
            let larghezzaOriginale = tfBounds[3] - tfBounds[1];
            let altezzaNuova = newTfBounds[2] - newTfBounds[0];
            let larghezzaNuova = newTfBounds[3] - newTfBounds[1];
    
            if (altezzaOriginale > altezzaNuova) {
                //ripristino altezza originale
                tf.geometricBounds = [tfBounds[0], newTfBounds[1], tfBounds[2], newTfBounds[3]];
            }
            else {
                //dobbiamo spostare il textframe per ancorarlo dove era prima
                if (allineamento == "TOP_ALIGN") {
                    //la linea di base del testo va rimessa a quella originale
                    tf.geometricBounds = [tfBounds[0], newTfBounds[1], tfBounds[0] + altezzaNuova, newTfBounds[3]];
                }
                else if (allineamento == "BOTTOM_ALIGN") {
                    //dobbiamo spostare il textframe per farlo coincidere con il bordo inferiore originale senza modificare l'altezza               
                    tf.geometricBounds = [tfBounds[2] - altezzaNuova, newTfBounds[1], tfBounds[2], newTfBounds[3]];
                }
                else if (allineamento == "CENTER_ALIGN") {
                    //dobbiamo spostare il textframe per farlo coincidere con il centro originale, l'altezza si usa quella del newTfBounds
                    let centroOriginale = tfBounds[0] + altezzaOriginale / 2;
                    tf.geometricBounds = [centroOriginale - altezzaNuova / 2, newTfBounds[1], centroOriginale + altezzaNuova / 2, newTfBounds[3]];
                }
            }
    
            if (larghezzaOriginale > larghezzaNuova) {
                //ripristino larghezza originale
                tf.geometricBounds = [tf.geometricBounds[0], tfBounds[1], tf.geometricBounds[2], tfBounds[3]];
            }

            //occupiamoci di eventuali sforamenti dai bounds del box

            if (tf.visibleBounds[0] < boxBounds[0] - 0.05) {
                tf.move(undefined, [0, boxBounds[0] - tf.visibleBounds[0]]);
                console.warn(`Elemento '${Utility.parseLabel(tf.label)}' spostato verso il basso per rientrare nei limiti della griglia.`);
                //mandiamo il messaggioUtente solo il margine di spostamento è superiore a 1
                if(Math.abs(boxBounds[0] - tf.visibleBounds[0]) > 1){
                    messaggioUtente(`Code TLY-01 Elemento '${Utility.parseLabel(tf.label)}' spostato verso il basso per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.`, "warning");
                }
            }
            if (tf.visibleBounds[1] < boxBounds[1] - 0.05) {
                tf.move(undefined, [boxBounds[1] - tf.visibleBounds[1], 0]);
                console.warn(`Elemento '${Utility.parseLabel(tf.label)}' spostato verso destra per rientrare nei limiti della griglia.`);
                if(Math.abs(boxBounds[1] - tf.visibleBounds[1]) > 1){
                    messaggioUtente(`Code TLY-02 Elemento '${Utility.parseLabel(tf.label)}' spostato verso destra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.`, "warning");
                }
            }
            if (tf.visibleBounds[2] > boxBounds[2] + 0.05) {
                tf.move(undefined, [0, boxBounds[2] - tf.visibleBounds[2]]);
                console.warn(`Elemento '${Utility.parseLabel(tf.label)}' spostato verso l'alto per rientrare nei limiti della griglia.`);
                if(Math.abs(boxBounds[2] - tf.visibleBounds[2]) > 1){
                    messaggioUtente(`Code TLY-03 Elemento '${Utility.parseLabel(tf.label)}' spostato verso l'alto per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.`, "warning");
                }
            }
            if (tf.visibleBounds[3] > boxBounds[3] + 0.05) {
                tf.move(undefined, [boxBounds[3] - tf.visibleBounds[3], 0]);
                console.warn(`Elemento '${Utility.parseLabel(tf.label)}' spostato verso sinistra per rientrare nei limiti della griglia.`);
                if(Math.abs(boxBounds[3] - tf.visibleBounds[3]) > 1){
                    messaggioUtente(`Code TLY-04 Elemento '${Utility.parseLabel(tf.label)}' spostato verso sinistra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.`, "warning");
                }
            }
    
            return true;

        }
        catch(ex){
            messaggioUtente("Code TLY-05: Errore generico durante l'applicazione degli stili al textframe: " + ex, "error");
            console.error(ex);
            return false;
        }
        
    },

    getDefaultOverflowDirection(tf){
        let overflowDirection = [
            {
                label: "descrizione",
                vertical: true,
                horizontal: false
            },
            {
                label: "defaultLabelNotFound",
                vertical: false,
                horizontal: true
            }
        ]
        //cerchiamo l'elemento di overflowDirection che ha label uguale a quella del text frame, se non lo troviamo usiamo defaultLabelNotFound
        let labelTf = Utility.parseLabel(tf.label);
        let found = overflowDirection.find(o => o.label === labelTf);
        if (found) {
            return { vertical: found.vertical, horizontal: found.horizontal };
        }
        else {
            let defaultFound = overflowDirection.find(o => o.label === "defaultLabelNotFound");
            return { vertical: defaultFound.vertical, horizontal: defaultFound.horizontal };
        }
    },

    applyNeastedStyles:function(ctrl, paragraph) {
        try {
            var step = paragraph.nestedStyles;
    
            var current_indice = -1;
    
            console.log("NEASTED STYLE");

            //alert(paragraph.name);
            //if (paragraph.name == "PREZ_Fidelity_EV_EURprima")
            //alert(ctrl.label + " steps:"+step.length);
    
            for (var $va = 0; $va < step.length; $va++) {
                //alert(ctrl.label + " step " + $va);
                var flag = step.item($va).delimiter;
    
    
                console.log("Step neatesd " + flag);

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
                       
                        console.log("Character style  " + step.item($va).appliedCharacterStyle.name);

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
    
            console.log(ctrl.label + " set parag to " + paragraph.name + " " + ctrl.paragraphs.length);
            if (paragraph != null && ctrl.paragraphs.length > 0) {
                ctrl.paragraphs.item(0).appliedParagraphStyle = paragraph;
            }
    
        }
        catch (error) {
            console.log(error);            
        }
    
    },
    getFieldByLabel:function(label, box, parseLabel = true)
    {
        let result=null;

        if (!box.isValid)
        {
            return result;
        }

        for (let i=0; i<box.allPageItems.length; i++)
        {
            let campo=box.allPageItems[i];
            if (!campo.isValid)
            {
                return null;
            }

            if ((parseLabel ? Utility.parseLabel(campo.label) : campo.label) == label)
                return campo;
        }

        return result;
    },
    getAllFieldsInGroup:function(box)
    {
        let result=[];

        if (!box.isValid)
        {
            return result;
        }

        for (let i=0; i<box.allPageItems.length; i++)
        {
            let campo=box.allPageItems[i];
            if (campo.label!="")
            {
                result.push({ label: Utility.parseLabel(campo.label), item: campo });
                if (Utility.parseLabel(campo.label)=="descrizione")
                {
                    //Estrapolo tutti gli stili coinvolti
                    let stileAnomalo = {label:""};
                    for (var ich = 0; ich < campo.characters.length; ich++) {
    
                        let styName = campo.characters.item(ich).appliedCharacterStyle.name;
                        //console.log("diodidio ");
                        console.log(styName);
                        if (pluginMiddleware.getCampo("listaStiliUniversali").filter(s=>styName.startsWith(s.nome)).length<=0)
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
                            stileAnomalo.item = campo.characters.item(ich).lines.item(0);//La linea
                            
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
    getBolloNOFOTO(callback, callbackError)
    {
        this.getNomeFotoLogoBolloBySigla("nofoto", callback, callbackError);
    },
    getBolloFOTONOFOUND(callback, callbackError)
    {
        this.getNomeFotoLogoBolloBySigla("fotonofound", callback, callbackError);
    },
    getNomeFotoLogoBolloBySigla:function(sigla, callback, callbackError)
    {
        var xhr = new XMLHttpRequestClient();
    
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        if (callbackError)
                            callbackError("result parsing error ::: " + e);
                        return;
                    }
                }
                // Chiamata alla callback con il risultato ottenuto
                if (objResult.esito)
                {
                    if (callback) {
                        callback(objResult.item.nome); // Passiamo `null` come primo argomento per indicare che non c'è errore
                    }
                }
                else
                {
                    if (callbackError)
                        callbackError(objResult.error);
                }
            } catch (e) {
                // Gestione dell'errore e chiamata alla callback con l'errore
                if (callback) {
                    callback(e, null);
                }
            }
        };
    
        xhr.onerror = function (e) {
            // Gestione degli errori di rete e chiamata alla callback con l'errore
            if (callback) {
                callback(e, null);
            }
        };
    

        xhr.send("LoghiBolli/getBySigla/" + sigla, null, "GET");
    },
    testPerformance:async function(pagIndex)
    {
        //let myPag = docInLavorazione.pages.item(pagIndex);
        
        let start = Date.now();

        await confronti.mappaturaImpaginato(null, false, true);
        // console.log("N elements " + myPag.groups.length);
        // let filter=0;

        // for (let i=0; i<myPag.groups.length; i++)
        // {
        //     let pItem = myPag.groups.item(i);
        //     if (pItem.itemLayer.name=="InPagina")
        //     {
        //         filter++;
        //     }
        // }

        // console.log(filter+"/"+myPag.groups.length);

        let fine=Date.now();

        console.log("PERFORMANCE RESULT: " +  (fine-start));
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
    addBollinoCustom(box, text, colorString, colorGradient, positionEnum = 1, customBoundsRelativeToBox = null, overflowControls = true){
    
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

        //this.pagInfame =box;
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

    setPickerValue(picker, value, ignoreEvents = true) {
        var options = $(picker).find('sp-menu-item');
        
        ignoreChangeEvent = true;
        let optionFound = false;
        options.each(function () {
            //console.log($(this).text());
            //console.log($(this).val());
            if ($(this).val() === value) {
                $(this).attr('selected', '');
                $(picker).attr("lastValue", value);
                optionFound = true;
            } else {
                $(this).removeAttr('selected');
            }
        });

        if (!optionFound && options.length > 0) {
            $(options[0]).attr('selected', '');
            $(picker).attr("lastValue", $(options[0]).text());
        }

        ignoreChangeEvent = false;

        return optionFound;
    },

    setPickerWidthHack(picker)
    {        
        picker.each(function(){
            
            $(this).on("mouseover", function()
            {
                if (document.getElementById("wrapper").clientWidth < 700) {
                    let w = $(this).attr("maxWidth");
                    $(this).css("width", w);
                }

            });
            $(this).on("mouseout", function()
            {
                if (document.getElementById("wrapper").clientWidth<700)
                {
                    let w = $(this).attr("minWidth");
                    $(this).css("width", w);
                }
            });

            $(this).on("click", function()
            {
                if (document.getElementById("wrapper").clientWidth<700)
                {
                    let w = $(this).attr("minWidth");
                    $(this).css("width", w);
                }
            });

        })

    },

    getLetturaFacilitataDellaParola(parola)
    {
        if (parola=="IN")
        {
            return "contiente";
        }
        else if (parola=="!IN")
        {
            return "non contiente";
        }
        else if (parola=="=")
        {
            return "è uguale a";
        }
        else if (parola=="!=")
        {
            return "è diverso da";
        }
        else if (parola=="<")
        {
            return "è minore di";
        }
        else if (parola=="<=")
        {
            return "è minore o uguale di";
        }
        else if (parola==">")
        {
            return "è maggiore di";
        }
        else if (parola==">=")
        {
            return "è maggiore o uguale di";
        }

        return parola;
    },

    isElementVisible(elem) {
        try{
            if (elem[0].localName === document.body.localName || elem.parent() == null) return true; // Se l'elemento è il body, è considerato visibile
            if (!elem || elem.css("display") === 'none' || elem.css("visibility") === 'none' || elem.css("visibility") === 'hidden') return false; // Controlla se l'elemento è nascosto
            return this.isElementVisible(elem.parent()); // Ricorsione per controllare i genitori
        }
        catch (e) {
            console.error("Errore durante il controllo della visibilità dell'elemento: ", e);
            return false; // In caso di errore, consideriamo l'elemento non visibile
        }
    },

    nascondiHidebleElements() {
        let me = this;
        $(".hideble").each(function() {
            if (me.isElementVisible($(this))) {
                $(this).css("visibility","hidden");
                $(this).attr("hidden", true);
            }
        });
    },

    mostraHidebleElements() {
        $(".hideble[hidden]").each(function () {
            $(this).css("visibility", "visible");
            //rimuoviamo la prop nascosta
            $(this).removeAttr("hidden");                
        });
    },

    moveToPasteBoard(el){
        el.move([-1000, el.geometricBounds[0]]);
    },

    trimDescrizione(val)
    {
        let result=val;
        
        result=val.trim();

        //Rimuovo \n
        while(result.indexOf('\n')>=0)
        {
            result=result.replace('\n', '');
        }
        while(result.indexOf('\r')>=0)
        {
            result=result.replace('\r', '');
        }
        while(result.indexOf(' ')>=0)
        {
            result=result.replace(' ', '');
        }
    
        

        return result;
    },

    async confirm (message){
        //creiamo un confirm con un messaggio di conferma e due pulsanti, uno per confermare e uno per annullare
        //se il pulsante conferma viene premuto allora la funzione torna true, sennò false
        //la funzione è asincrona
        try{
            this.nascondiHidebleElements();
            var result = null;
            var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
            var dialog = $('<div style="width: 60%; height: 40%; background-color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px;"></div>');
            
            let messaggio = $('<div style="display: flex; height: 80%;"></div>');
    
            if (typeof message === "string") {
                messaggio.html(`<h3>${message}</h3>`);
            } else if (message instanceof jQuery || message instanceof Element) {
                messaggio.append(message);
            } else {
                messaggio.text(String(message));
            }
            
            //var messaggio = $('<div style="display: flex; height: 80%;"><h3>'+message+'</h3></div>');
            var pulsanti = $('<div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; height: 20%;"></div>');
            var conferma = $('<button style="width: 100px; height: 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Conferma</button>');
            var annulla = $('<button style="width: 100px; height: 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Annulla</button>');
        
            modal.click(function(e) {
                e.stopPropagation();
            });
        
            conferma.click(function(){
                result = true;
                $("#confirmModal").remove();
            });
        
            annulla.click(function(){
                result = false;
                $("#confirmModal").remove();
            });
        
            pulsanti.append(conferma);
            pulsanti.append(annulla);
            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);
            $("body").append(modal);
        
            while(result == null){
                await delay(100);
            }
            this.mostraHidebleElements();
            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm: ", e);
            this.mostraHidebleElements();
            return false; // In caso di errore, consideriamo l'azione annullata
        }
    },

    closeAllModal(){
        $("#popup").remove();
        $("#confirmModal").remove();
        this.chiudiModal();
    },

    async popup(title, message, taglia = "md") {
        try {
            let me = this;
            me.nascondiHidebleElements();
    
            // Dimensioni in base alla taglia
            switch (taglia.toLowerCase()) {
                case "sm":
                    taglia = "width: 30%; height: 20%;";
                    break;
                case "md":
                    taglia = "width: 60%; height: 40%;";
                    break;
                case "lg":
                    taglia = "width: 80%; height: 60%;";
                    break;
                case "xl":
                    taglia = "width: 100%; height: 80%;";
                    break;
                default:
                    taglia = "width: 60%; height: 40%;";
                    break;
            }
    
            let result = null;
    
            // Contenitore modale a schermo intero
            let modal = $(`
                <div id="popup" style="
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: rgba(0,0,0,0.5); z-index: 9000;
                    display: flex; justify-content: center; align-items: center; padding: 10px;
                "></div>
            `);
    
            // Barra del titolo
            let titleBar = $(`
                <div style="
                    display: flex; justify-content: space-between; align-items: center;
                    width: 100%; height: 10%; background-color: #f1f1f1;
                    padding: 5px; box-sizing: border-box;
                "></div>
            `);
    
            let titleText = $(`<span style="font-size: 16px; font-weight: bold;">${title}</span>`);
            let closeButton = $('<button style="background-color: transparent; border: none; font-size: 18px; cursor: pointer;">&times;</button>');
    
            closeButton.click(function () {
                me.mostraHidebleElements();
                $("#popup").remove();
            });
    
            titleBar.append(titleText).append(closeButton);
    
            // Finestra centrale
            let dialog = $(`
                <div style="${taglia} background-color: white;
                    overflow-y: auto; display: flex; flex-direction: column;
                    justify-content: flex-start; align-items: flex-start; padding: 10px;
                "></div>
            `);
    
            // Corpo del messaggio
            let messaggio = $('<div style="flex: 1; width: 100%; overflow-y: auto;"></div>');
    
            if (typeof message === "string") {
                messaggio.html(`<h3>${message}</h3>`);
            } else if (message instanceof jQuery || message instanceof Element) {
                messaggio.append(message);
            } else {
                messaggio.text(String(message));
            }
    
            modal.click(function (e) {
                e.stopPropagation();
            });
    
            dialog.prepend(titleBar);
            dialog.append(messaggio);
            modal.append(dialog);
            $("body").append(modal);
    
            while (result == null) {
                await delay(100);
            }
    
        } catch (e) {
            console.error("Errore durante la creazione del popup: ", e);
        }
    
        return result;
    },
    
    
    async confirmCustom (message, bottoneConfirm1Text, hiddenVal1=null, bottoneConfirm2Text = null, hiddenVal2 = null){
        //creiamo un confirm con un messaggio di conferma e due pulsanti, uno per confermare e uno per annullare
        //se il pulsante conferma viene premuto allora la funzione torna true, sennò false
        //la funzione è asincrona
    
        var result = null;
        this.nascondiHidebleElements();
        var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        var dialog = $('<div style="width: 60%; height: 40%; background-color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px;"></div>');
        var messaggio = $('<div style="display: flex; height: 80%;"><h3>'+message+'</h3></div>');
        var pulsanti = $('<div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; height: 20%;"></div>');
        var conferma1 = $('<button style="width:'+ (bottoneConfirm2Text != null ? '80px;' :'100px;')+' height: 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm1Text +'</button>');
        if(bottoneConfirm2Text != null){
            var conferma2 = $('<button style="width:'+ (bottoneConfirm2Text != null ? '80px;' :'100px;')+' height: 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">'+bottoneConfirm2Text +'</button>');
        }
        var annulla = $('<button style="width:'+ (bottoneConfirm2Text != null ? '80px;' :'100px;')+' height: 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Annulla</button>');
    
        var objRes = {
            result: false,
            hiddenVal: null,
        }
    
        modal.click(function(e) {
            e.stopPropagation();
        });
    
        conferma1.click(function(){
            objRes.result = true;
            objRes.hiddenVal = hiddenVal1;
            $("#confirmModal").remove();
        });
    
        if(bottoneConfirm2Text != null){
            conferma2.click(function(){
                objRes.result = true;
                objRes.hiddenVal = hiddenVal2;
                $("#confirmModal").remove();
            });
        }
    
        annulla.click(function(){
            objRes.result = false;
            $("#confirmModal").remove();
        });
    
        pulsanti.append(conferma1);
        if(bottoneConfirm2Text != null){
            pulsanti.append(conferma2);
        }
    
        pulsanti.append(annulla);
        dialog.append(messaggio);
        dialog.append(pulsanti);
        modal.append(dialog);
        $("body").append(modal);
    
        while(objRes.hiddenVal == null){
            await delay(100);
        }
    
        this.mostraHidebleElements();
    
        return objRes;
    },

    async confirmRimozioneRef(codiciGruppo) {
        try {
            Utility.nascondiHidebleElements();

            var result = null;

            var codici = [];
            if (codiciGruppo != null && codiciGruppo.length > 0 && codiciGruppo[0] != null) {
                codici = codiciGruppo[0]
                    .split(",")
                    .map(x => x.trim())
                    .filter(x => x !== "");
            }

            var modal = $(`
            <div id="confirmModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                z-index: 5000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10px;
            "></div>
        `);

            var dialog = $(`
            <div style="
                width: 60%;
                height: 45%;
                background-color: white;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                padding: 12px;
                box-sizing: border-box;
            "></div>
        `);

            var messaggio = $(`
            <div style="
                height: 75%;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            ">
                <h3>Sei sicuro di voler rimuovere la ref impaginata?</h3>

                <label style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    cursor:pointer;
                ">
                    <input type="checkbox" id="chkEliminaDaTracciato">
                    <span>Eliminare dal tracciato l'elemento</span>
                </label>

                <div id="boxCodiciDaEliminare" style="display:none;">
                    <div style="
                        font-weight:bold;
                        color:red;
                        margin-bottom:6px;
                    ">I seguenti elementi verranno eliminati:</div>

                    <div id="listaCodiciDaEliminare" style="
                        font-size:12px;
                        line-height:18px;
                    "></div>
                </div>
            </div>
        `);

            var pulsanti = $(`
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                height:20%;
                width:100%;
            "></div>
        `);

            var conferma = $(`
            <button id="btnConfirmRimozioneRef" style="
                width:140px;
                height:24px;
                background-color:#007bff;
                color:white;
                border:none;
                border-radius:5px;
                cursor:pointer;
            ">Rimuovi ref</button>
        `);

            var annulla = $(`
            <button style="
                width:100px;
                height:24px;
                background-color:#dc3545;
                color:white;
                border:none;
                border-radius:5px;
                cursor:pointer;
            ">Annulla</button>
        `);

            messaggio.find("#listaCodiciDaEliminare").html(
                codici.map(c => `<div>${c}</div>`).join("")
            );

            messaggio.find("#chkEliminaDaTracciato").on("change", function () {
                if ($(this).prop("checked")) {
                    $("#boxCodiciDaEliminare").show();
                    $("#btnConfirmRimozioneRef").text("Elimina da tracciato");
                } else {
                    $("#boxCodiciDaEliminare").hide();
                    $("#btnConfirmRimozioneRef").text("Rimuovi ref");
                }
            });

            conferma.on("click", function () {
                result = {
                    confermato: true,
                    eliminaDaTracciato: $("#chkEliminaDaTracciato").prop("checked") === true,
                    codici: codici
                };

                $("#confirmModal").remove();
            });

            annulla.on("click", function () {
                result = {
                    confermato: false,
                    eliminaDaTracciato: false,
                    codici: []
                };

                $("#confirmModal").remove();
            });

            modal.on("click", function (e) {
                e.stopPropagation();
            });

            pulsanti.append(conferma);
            pulsanti.append(annulla);

            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);

            $("body").append(modal);

            while (result == null) {
                await delay(100);
            }

            Utility.mostraHidebleElements();

            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm rimozione ref:", e);
            Utility.mostraHidebleElements();

            return {
                confermato: false,
                eliminaDaTracciato: false,
                codici: []
            };
        }
    },

    async confirmRimozioneRefNonTrovata(datiRef) {
        try {
            Utility.nascondiHidebleElements();

            var result = null;
            var codice = datiRef != null && datiRef.codice != null ? datiRef.codice.toString() : "";
            var idRec = datiRef != null && datiRef.idRec != null && !isNaN(parseInt(datiRef.idRec))
                ? parseInt(datiRef.idRec)
                : 0;
            var paginaAttesa = datiRef != null && datiRef.paginaAttesa != null && datiRef.paginaAttesa.toString() !== ""
                ? datiRef.paginaAttesa.toString()
                : "non disponibile";

            var modal = $(`
            <div id="confirmModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                z-index: 5000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10px;
                box-sizing: border-box;
            "></div>
        `);

            var dialog = $(`
            <div style="
                width: 620px;
                max-width: 90%;
                max-height: 80%;
                background-color: white;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
                padding: 16px;
                box-sizing: border-box;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            "></div>
        `);

            var messaggio = $(`
            <div style="
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                color: #222;
            ">
                <div style="
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                ">
                    <div style="
                        width: 34px;
                        min-width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background-color: #fff3cd;
                        color: #8a5a00;
                        border: 1px solid #ffdf7e;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 22px;
                        line-height: 34px;
                    ">!</div>
                    <div>
                        <h3 style="margin: 0 0 6px 0; font-size: 18px;">Elemento non trovato nell'impaginato</h3>
                        <div style="font-size: 13px; line-height: 18px;">
                            La referenza cercata non è presente nel documento. Prima di rimuoverla dal server verifica i dati della ricerca.
                        </div>
                    </div>
                </div>

                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background-color: #f7f7f7;
                    border: 1px solid #dedede;
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 13px;
                    line-height: 18px;
                ">
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Codice</div>
                        <div id="refNonTrovataCodice" style="word-break: break-word;"></div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Id record</div>
                        <div id="refNonTrovataIdRec" style="word-break: break-word;"></div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <div style="font-weight: bold; width: 130px; min-width: 130px;">Pagina attesa</div>
                        <div id="refNonTrovataPagina" style="word-break: break-word;"></div>
                    </div>
                </div>

                <div style="
                    border-left: 4px solid #dc3545;
                    background-color: #fff5f5;
                    padding: 10px;
                    font-size: 13px;
                    line-height: 18px;
                ">
                    Confermando, l'elemento verrà rimosso dall'impaginato sul server. Il documento InDesign non verrà modificato perché l'elemento non è stato trovato in pagina.
                </div>
            </div>
        `);

            messaggio.find("#refNonTrovataCodice").text(codice);
            messaggio.find("#refNonTrovataIdRec").text(idRec);
            messaggio.find("#refNonTrovataPagina").text(paginaAttesa);

            var pulsanti = $(`
            <div style="
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 10px;
                width: 100%;
                margin-top: 16px;
            "></div>
        `);

            var annulla = $(`
            <button style="
                min-width: 110px;
                height: 28px;
                background-color: #f1f1f1;
                color: #222;
                border: 1px solid #cfcfcf;
                border-radius: 5px;
                cursor: pointer;
            ">Mantieni</button>
        `);

            var conferma = $(`
            <button style="
                min-width: 150px;
                height: 28px;
                background-color: #dc3545;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Rimuovi dal server</button>
        `);

            conferma.on("click", function () {
                result = true;
                $("#confirmModal").remove();
            });

            annulla.on("click", function () {
                result = false;
                $("#confirmModal").remove();
            });

            modal.on("click", function (e) {
                e.stopPropagation();
            });

            pulsanti.append(annulla);
            pulsanti.append(conferma);

            dialog.append(messaggio);
            dialog.append(pulsanti);
            modal.append(dialog);

            $("body").append(modal);

            while (result == null) {
                await delay(100);
            }

            Utility.mostraHidebleElements();

            return result;
        }
        catch (e) {
            console.error("Errore durante la creazione del confirm rimozione ref non trovata:", e);
            Utility.mostraHidebleElements();
            return false;
        }
    },

    apriModal(modalId, titolo, bottoneChiusura = true, idElementiInTestata = [], hideBehind = true, scrollRules = null){

        console.log("Apro modale!");
    
        //var dialog = $("#"+modalId).clone();
        var dialog = cloneElementWithEvents($("#"+modalId));
        console.log(dialog);
        dialog.css("display", "block");
        //impostiamo un attr che ricordi il val di scrollTop
        $("#bodyModal").attr("scrollTop", scrollRules ? scrollRules.scrollTop : 0);
        $("#bodyModal").attr("scrollIdContainer", scrollRules ? scrollRules.scrollIdContainer : "");
        $("#bodyModal").empty();
        $("#modalTitle").text((titolo != null ? titolo : ""));
        $("#bodyModal").append(dialog);
        $("#overlayModal").css("display", "flex");
        if(!bottoneChiusura){
            $("#closeModal").hide();
        }
        else if (bottoneChiusura){
            $("#closeModal").show();
        }
        
        //rimuoviamo tutti gli elementi aggiunti in precedenza
        $(".elementoAggiunto").remove();
    
        //per ogni id in idElementiInTestata cloniamo con eventi l'elemento e lo appendiamo prima del bottone di chiusura, assegnandogli una classe che indica che è un elemento aggiunto
        for(var i = 0; i < idElementiInTestata.length; i++){
            var element = cloneElementWithEvents($("#"+idElementiInTestata[i]));
            element.addClass("elementoAggiunto");
            //mettiamo a display flex
            element.css("display", "flex");
            $("#closeModal").before(element);
        }
    
        if(hideBehind){
            //prima era commentato
            $("#mainContent").hide();
        }

    },

    apriModalCustom(modalId, titolo, suffissoOverlayModal, bottoneChiusura = true, idElementiInTestata = [], hideBehind = true){

        console.log("Apro modale!");
    
        var dialog = cloneElementWithEvents($("#"+modalId));
        console.log(dialog);
        dialog.css("display", "block");
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").empty();
        $("#overlayModal"+suffissoOverlayModal).find("#modalTitle").text((titolo != null ? titolo : ""));
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").append(dialog);
        $("#overlayModal"+suffissoOverlayModal).css("display", "flex");
        if(!bottoneChiusura){
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").hide();
        }
        else if (bottoneChiusura){
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").show();
        }
        
        //rimuoviamo tutti gli elementi aggiunti in precedenza
        $("#overlayModal"+suffissoOverlayModal).find(".elementoAggiunto").remove();
    
        //per ogni id in idElementiInTestata cloniamo con eventi l'elemento e lo appendiamo prima del bottone di chiusura, assegnandogli una classe che indica che è un elemento aggiunto
        for(var i = 0; i < idElementiInTestata.length; i++){
            var element = cloneElementWithEvents($("#"+idElementiInTestata[i]));
            element.addClass("elementoAggiunto");
            $("#overlayModal"+suffissoOverlayModal).find("#closeModal").before(element);
        }
    
        if(hideBehind){
            //$("#mainContent").hide();
        }

    },
    
    chiudiModalCustom(suffissoOverlayModal){
        $("#overlayModal"+suffissoOverlayModal).hide();
        $("#mainContent").show();
        $("#overlayModal"+suffissoOverlayModal).find("#bodyModal").empty();
    },

    chiudiModal(){
        $("#overlayModal").hide();
        $("#mainContent").show();
        $("#overlayModal").find("#bodyModal").empty();
        //cerchiamo se ci sono scroll rules attive e in caso scrolliamo il container alla posizione scrollTop
        let scrollTop = $("#overlayModal").find("#bodyModal").attr("scrollTop");
        let scrollIdContainer = $("#overlayModal").find("#bodyModal").attr("scrollIdContainer");
        if(scrollIdContainer != null && scrollIdContainer != "" && scrollTop != null && scrollTop != ""){
            $("#" + scrollIdContainer).scrollTop(scrollTop);
        }
    },

    chiudiModalSync(){
        this.chiudiModal();
        $("#headerModal").find("#pulsantiTestataSync").remove();
        $("#headerModal").find("#pulsantiTestataSyncOnline").remove();
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

    async getListaCodiciImpaginati(){
        var result = null;
        var error = null;
        xhrInProcess = new XMLHttpRequestClient();
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
            return [];
        }

        if (i == 100) {
            messaggioUtente("Code TLY-08: Tempo massimo per lo scaricamento del dato superato", "error");
            console.warn("Code TLY-08: Tempo massimo per lo scaricamento del dato superato");
            return [];
        }

        if (result != null ) {
            return result;
        }
        else {
            return [];
        }


    },

    parseStile(stile, paragraph = false) {
        stileSplitted = stile.split(".");
        //se stileSplitted.length > 1

        if(stileSplitted.length == 1){
            if(paragraph){
                return docInLavorazione.paragraphStyles.item(stileSplitted[0]);
            }
            else{
                return docInLavorazione.characterStyles.item(stileSplitted[0]);
            }
        }

        if(paragraph){
            if (stileSplitted.length > 1) {
                //se il primo elemento è A
                //if (stileSplitted[0] == "A") {
                    for (var $s = 0; $s < docInLavorazione.paragraphStyleGroups.length; $s++) {
                        var gStyle = docInLavorazione.paragraphStyleGroups.item($s);
                        if (gStyle.name == stileSplitted[0])
                            return docInLavorazione.paragraphStyleGroups.item($s).paragraphStyles.item(stileSplitted[1]);
                    }
               // }  
            }
        }
        else{
            if (stileSplitted.length > 1) {
                //se il primo elemento è A
                //if (stileSplitted[0] == "A") {
                    for (var $s = 0; $s < docInLavorazione.characterStyleGroups.length; $s++) {
                        var gStyle = docInLavorazione.characterStyleGroups.item($s);
                        if (gStyle.name == stileSplitted[0])
                            return docInLavorazione.characterStyleGroups.item($s).characterStyles.item(stileSplitted[1]);
                    }
                //}  
            }
        }

        return null;
    },

    parseObjStile(stile) {
        stileSplitted = stile.split(".");
        //se stileSplitted.length > 1

        if(stileSplitted.length == 1){
            return docInLavorazione.objectStyles.item(stileSplitted[0]);
        }

        if (stileSplitted.length > 1) {
            for (var $s = 0; $s < docInLavorazione.objectStyleGroups.length; $s++) {
                var gStyle = docInLavorazione.objectStyleGroups.item($s);
                if (gStyle.name == stileSplitted[0])
                    return docInLavorazione.objectStyleGroups.item($s).objectStyles.item(stileSplitted[1]);
            }
        }
        

        return null;
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

    async getLinkHash(rectangle) {
        var result = {
            success: false,
            missing: false,
            mismatch: false,
            hash: null,
            error: null
        }
        try{
            if (rectangle == null || rectangle.graphics.length == 0) {
                result.error = "Rectangle is null or has no graphics.";
                return result;
            }
            const graphic = rectangle.graphics.item(0);
            const link = graphic.itemLink;
    
            if (link.status.toString() == "LINK_MISSING") {
                result.error = "Immagine non presente nella cartella: " + link.status.toString();
                result.missing = true;
                return result;
            }
            else if (link.status.toString() == "LINK_EMBEDDED") {
                result.error = "Immagine incorporata nel documento: " + link.status.toString();
                return result;
            }
            else if (link.status.toString() == "LINK_INACCESSIBLE") {
                result.error = "Immagine non accessibile: " + link.status.toString();
                return result;
            }
            else if(link.status.toString() == "LINK_UNKNOWN") {
                result.error = "Immagine in stato sconosciuto: " + link.status.toString();
                return result;
            }
    
            const filePath = link.filePath;

            const fs = require("uxp").storage.localFileSystem;
            const fileEntry = await fs.getEntryWithUrl("file://" + filePath);

            //I20-981: leggere il file e calcolarne l'md5 e' il costo dominante del Report
            //Integrita', che lo fa per ogni foto di ogni box. La chiave della cache porta
            //dentro dimensione e data di modifica, quindi una foto sostituita non puo'
            //riusare l'hash vecchio. Se i metadati non si leggono si calcola e non si
            //conserva nulla.
            let chiaveCache = null;
            try {
                chiaveCache = cacheHashFoto.chiave(filePath, await fileEntry.getMetadata());
            }
            catch (exMeta) {
                chiaveCache = null;
            }

            const hashInCache = cacheHashFoto.ottieni(chiaveCache);
            if (hashInCache != null) {
                result.hash = hashInCache;
            }
            else {
                const data = await fileEntry.read({ format: require("uxp").storage.formats.binary });
                const byteArray = new Uint8Array(data);

                result.hash = cmd.md5ArrayBuffer(byteArray);
                cacheHashFoto.memorizza(chiaveCache, result.hash);
            }
    
            if (link.status.toString() == "LINK_OUT_OF_DATE") {
                result.error = "Immagine non aggiornata: " + link.status.toString();
                result.mismatch = true;
            }
        }
        catch (ex) {
            result.error = "Errore sconosciuto durante il calcolo dell'hash: " + ex.message;
            return result;
        }

        result.success = true;
        return result;
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

    cercaChiaveValore(key, value, array) {
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] != undefined && array[i][key] == value) {
                return true;
            }
        }
        return false;
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

    creaFloatingMenu(options) {
        const x = options.x;
        const y = options.y;
        const content = options.content;
        const className = options.className || "";
        const onClose = options.onClose || null;

        Utility.chiudiFloatingMenu();

        const floatingMenu = $("<div></div>")
            .addClass("utility-floating-menu")
            .addClass(className)
            .css({
                position: "fixed",
                left: x + "px",
                top: y + "px",
                zIndex: 999999,
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "6px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
            });

        floatingMenu.append(content);

        $("body").append(floatingMenu);

        setTimeout(function () {
            $(document).on("mousedown.utilityFloatingMenu", function (e) {
                if ($(e.target).closest(".utility-floating-menu").length === 0) {
                    Utility.chiudiFloatingMenu();

                    if (onClose != null)
                        onClose();
                }
            });
        }, 0);

        return floatingMenu;
    },

    chiudiFloatingMenu() {
        $(document).off("mousedown.utilityFloatingMenu");
        $(".utility-floating-menu").remove();
    },

    //I20-981: i tooltip del plugin.
    //In UXP l'attributo title non mostra niente, e i title scritti in giro per il plugin, un
    //centinaio, erano muti. Invece di toccarli uno per uno, un solo gestore delegato ascolta
    //l'hover su qualunque elemento che abbia un title e disegna il riquadro .jq-tooltip
    //previsto in index.html: valgono anche i title creati dopo, che qui nascono in continuazione
    //insieme alle righe dei pannelli.
    _tooltipGlobaliAttivi: false,
    _riquadroTooltip: null,
    _timerTooltip: null,
    _ancoraTooltip: null,
    RITARDO_TOOLTIP: 350,
    ATTRIBUTO_TOOLTIP: "data-tooltip",
    //Larghezza che chiediamo per il riquadro: oltre questa il testo va a capo.
    LARGHEZZA_TOOLTIP: 260,

    abilitaTooltipGlobali() {
        if (this._tooltipGlobaliAttivi) {
            return;
        }

        this._tooltipGlobaliAttivi = true;
        const me = this;

        $(document).on("mouseenter", "[" + this.ATTRIBUTO_TOOLTIP + "], [title]", function (evento) {
            try {
                //Con elementi annidati che hanno entrambi un suggerimento vince il piu' interno,
                //quello che il mouse sta davvero toccando.
                const piuInterno = $(evento.target).closest("[" + me.ATTRIBUTO_TOOLTIP + "], [title]")[0];
                if (piuInterno != null && piuInterno !== this) {
                    return;
                }

                const testo = me._testoDelTooltip(this);
                if (testo == null) {
                    return;
                }

                me.nascondiTooltip();

                const elemento = this;
                me._timerTooltip = setTimeout(function () {
                    me._mostraTooltip(elemento, testo);
                }, me.RITARDO_TOOLTIP);
            }
            catch (err) {
                console.error("Errore durante l'apertura del tooltip:", err);
            }
        });

        $(document).on("mouseleave", "[" + this.ATTRIBUTO_TOOLTIP + "], [title]", function () {
            me.nascondiTooltip();
        });

        //Un clic sposta o cambia il pannello: il riquadro sparisce.
        //Niente aggancio allo scorrimento: scroll non risale fino a document e jQuery non
        //sa ascoltarlo in cattura, quindi sarebbe un gestore che non parte mai.
        $(document).on("click", function () {
            me.nascondiTooltip();
        });
    },

    /// Il testo da mostrare, e al primo passaggio del mouse il trasloco del vecchio title.
    /// InDesign un suggerimento suo per l'attributo title lo mostra, e sarebbe il doppione di
    /// questo: portando il testo su un attributo nostro resta un suggerimento solo.
    _testoDelTooltip(elemento) {
        const titolo = tooltipPosizione.testoTooltip(elemento.getAttribute("title"));
        if (titolo != null) {
            this.impostaTooltip(elemento, titolo);
            return titolo;
        }

        return tooltipPosizione.testoTooltip(elemento.getAttribute(this.ATTRIBUTO_TOOLTIP));
    },

    /// Il modo giusto di dare un suggerimento a un elemento creato da codice.
    /// In UXP scrivere elemento.title come proprieta' non crea l'attributo, e chi guarda
    /// l'attributo (il suggerimento di InDesign e questo gestore) non vede niente: e' per
    /// questo che i pulsanti del report erano muti. Qui si scrive l'attributo, sempre.
    impostaTooltip(elemento, testo) {
        if (elemento == null || elemento.setAttribute == null) {
            return;
        }

        const pulito = tooltipPosizione.testoTooltip(testo);

        if (pulito == null) {
            elemento.removeAttribute(this.ATTRIBUTO_TOOLTIP);
        }
        else {
            elemento.setAttribute(this.ATTRIBUTO_TOOLTIP, pulito);
        }

        if (elemento.removeAttribute != null) {
            elemento.removeAttribute("title");
        }
    },

    nascondiTooltip() {
        if (this._timerTooltip != null) {
            clearTimeout(this._timerTooltip);
            this._timerTooltip = null;
        }

        this._ancoraTooltip = null;

        if (this._riquadroTooltip != null) {
            this._riquadroTooltip.style.display = "none";
            this._riquadroTooltip.style.visibility = "hidden";
        }
    },

    //I20-981: il riquadro si mette dove dice tooltipPosizione, che non lo misura.
    //Misurarlo era il difetto: passando da un elemento all'altro UXP restituiva le dimensioni
    //del testo precedente e il riquadro usciva spostato di quella differenza. Ora si usano il
    //rettangolo dell'elemento e i limiti massimi che imponiamo qui sotto in stile: il riquadro
    //puo' essere piu' piccolo del limite, mai piu' grande, e tanto basta a tenerlo dentro.
    _mostraTooltip(elemento, testo) {
        try {
            if (elemento == null || !document.body.contains(elemento)) {
                return;
            }

            const riquadro = this._creaRiquadroTooltip();
            const finestra = this._dimensioniPannello();

            let rettangolo = null;
            try {
                rettangolo = elemento.getBoundingClientRect();
            }
            catch (err) {
                rettangolo = null;
            }

            const ancoraggio = tooltipPosizione.ancoraggioTooltip(
                rettangolo || {}, finestra, this.LARGHEZZA_TOOLTIP);

            riquadro.textContent = testo;
            riquadro.style.maxWidth = ancoraggio.maxWidth + "px";
            riquadro.style.maxHeight = ancoraggio.maxHeight + "px";
            riquadro.style.left = ancoraggio.left + "px";

            //Uno dei due, mai tutti e due: l'altro va rimesso ad auto, altrimenti resta quello
            //del suggerimento precedente e il riquadro si stira.
            if (ancoraggio.top != null) {
                riquadro.style.top = ancoraggio.top + "px";
                riquadro.style.bottom = "auto";
            }
            else {
                riquadro.style.bottom = ancoraggio.bottom + "px";
                riquadro.style.top = "auto";
            }

            riquadro.style.visibility = "visible";
            riquadro.style.display = "block";
        }
        catch (err) {
            console.error("Errore durante la posa del tooltip:", err);
            this.nascondiTooltip();
        }
    },

    _creaRiquadroTooltip() {
        if (this._riquadroTooltip != null && document.body.contains(this._riquadroTooltip)) {
            return this._riquadroTooltip;
        }

        const riquadro = document.createElement("div");
        riquadro.className = "jq-tooltip";
        riquadro.id = "tooltipGlobale";
        document.body.appendChild(riquadro);

        this._riquadroTooltip = riquadro;
        return riquadro;
    },

    /// Le misure del pannello del plugin, che e' cio' che i tooltip non devono mai superare.
    /// I20-981: prima si guardava window.innerWidth, che in UXP non e' la finestra del
    /// pannello: su quelle misure il riquadro finiva fuori dai bordi e il testo lungo non
    /// andava a capo dove doveva. #wrapper e' la stessa fonte che usa onresizeWindow.
    _dimensioniPannello() {
        const candidati = [
            document.getElementById("wrapper"),
            document.documentElement,
            document.body
        ];

        for (let i = 0; i < candidati.length; i++) {
            const elemento = candidati[i];
            if (elemento == null) {
                continue;
            }

            const larghezza = elemento.clientWidth;
            const altezza = elemento.clientHeight;

            if (larghezza > 0 && altezza > 0) {
                return { width: larghezza, height: altezza };
            }
        }

        if (typeof window !== "undefined" && window.innerWidth > 0 && window.innerHeight > 0) {
            return { width: window.innerWidth, height: window.innerHeight };
        }

        return { width: 800, height: 600 };
    },

    registerDateMenuPicker(rootNode = null) {
        const toInputDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return day + '/' + month + '/' + year;
        };

        const parseInputDate = (value) => {
            if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                return null;
            }
            const parts = value.split('/').map((v) => parseInt(v, 10));
            const date = new Date(parts[2], parts[1] - 1, parts[0]);
            if (Number.isNaN(date.getTime())) {
                return null;
            }
            return date;
        };

        const openCalendarModal = (currentValue, onPick) => {
            const monthLabels = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            const dayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
            const dayCellSize = 32;
            const dayGap = 4;
            const daysRowWidth = (dayCellSize * 7) + (dayGap * 6);
            const selectedDate = parseInputDate(currentValue) || new Date();
            let visibleDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            let hiddenBehind = false;

            try {
                Utility.nascondiHidebleElements();
                hiddenBehind = true;
            } catch (e) {
                console.warn('Impossibile nascondere elementi hideble per date picker:', e);
            }

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.45)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const card = document.createElement('div');
            card.style.width = '292px';
            card.style.background = '#2f2f2f';
            card.style.border = '1px solid #4f4f4f';
            card.style.borderRadius = '8px';
            card.style.padding = '10px';
            card.style.color = 'white';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '8px';

            const btnPrev = document.createElement('button');
            btnPrev.textContent = '<';
            btnPrev.style.width = '28px';
            btnPrev.style.height = '28px';
            btnPrev.style.cursor = 'pointer';

            const btnNext = document.createElement('button');
            btnNext.textContent = '>';
            btnNext.style.width = '28px';
            btnNext.style.height = '28px';
            btnNext.style.cursor = 'pointer';

            const title = document.createElement('div');
            title.style.fontSize = '13px';
            title.style.fontWeight = 'bold';

            header.appendChild(btnPrev);
            header.appendChild(title);
            header.appendChild(btnNext);

            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexDirection = 'column';
            grid.style.gap = '4px';
            grid.style.alignItems = 'center';

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.marginTop = '10px';

            const btnToday = document.createElement('button');
            btnToday.textContent = 'Oggi';
            btnToday.style.cursor = 'pointer';

            const btnClose = document.createElement('button');
            btnClose.textContent = 'Chiudi';
            btnClose.style.cursor = 'pointer';

            footer.appendChild(btnToday);
            footer.appendChild(btnClose);

            const closeModal = () => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }

                if (hiddenBehind) {
                    Utility.mostraHidebleElements();
                    hiddenBehind = false;
                }
            };

            const renderGrid = () => {
                title.textContent = monthLabels[visibleDate.getMonth()] + ' ' + visibleDate.getFullYear();
                grid.innerHTML = '';

                const headerRow = document.createElement('div');
                headerRow.style.display = 'flex';
                headerRow.style.gap = dayGap + 'px';
                headerRow.style.width = daysRowWidth + 'px';

                dayLabels.forEach((day) => {
                    const dayHead = document.createElement('div');
                    dayHead.textContent = day;
                    dayHead.style.fontSize = '10px';
                    dayHead.style.textAlign = 'center';
                    dayHead.style.opacity = '0.8';
                    dayHead.style.flex = '0 0 ' + dayCellSize + 'px';
                    dayHead.style.width = dayCellSize + 'px';
                    dayHead.style.height = '18px';
                    dayHead.style.lineHeight = '18px';
                    dayHead.style.boxSizing = 'border-box';
                    headerRow.appendChild(dayHead);
                });
                grid.appendChild(headerRow);

                const firstDay = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1);
                const firstWeekDay = (firstDay.getDay() + 6) % 7;
                const daysInMonth = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 0).getDate();

                const totalCells = firstWeekDay + daysInMonth;
                const weekCount = Math.ceil(totalCells / 7);
                let dayCounter = 1;

                for (let week = 0; week < weekCount; week++) {
                    const weekRow = document.createElement('div');
                    weekRow.style.display = 'flex';
                    weekRow.style.gap = dayGap + 'px';
                    weekRow.style.width = daysRowWidth + 'px';

                    for (let col = 0; col < 7; col++) {
                        const cellIndex = week * 7 + col;
                        const isBeforeMonth = cellIndex < firstWeekDay;
                        const isAfterMonth = dayCounter > daysInMonth;

                        if (isBeforeMonth || isAfterMonth) {
                            const empty = document.createElement('div');
                            empty.style.flex = '0 0 ' + dayCellSize + 'px';
                            empty.style.width = dayCellSize + 'px';
                            empty.style.height = '30px';
                            empty.style.boxSizing = 'border-box';
                            weekRow.appendChild(empty);
                            continue;
                        }

                        const cellDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), dayCounter);
                        const cell = document.createElement('div');
                        cell.textContent = String(dayCounter);
                        cell.style.flex = '0 0 ' + dayCellSize + 'px';
                        cell.style.width = dayCellSize + 'px';
                        cell.style.height = '30px';
                        cell.style.boxSizing = 'border-box';
                        cell.style.display = 'flex';
                        cell.style.alignItems = 'center';
                        cell.style.justifyContent = 'center';
                        cell.style.cursor = 'pointer';
                        cell.style.borderRadius = '4px';
                        cell.style.border = '1px solid #5a5a5a';
                        cell.style.background = '#3a3a3a';
                        cell.style.color = 'white';
                        cell.style.userSelect = 'none';

                        if (toInputDate(cellDate) === toInputDate(selectedDate)) {
                            cell.style.background = '#0a84ff';
                            cell.style.borderColor = '#0a84ff';
                        }

                        cell.addEventListener('click', () => {
                            onPick(toInputDate(cellDate));
                            closeModal();
                        });

                        weekRow.appendChild(cell);
                        dayCounter++;
                    }

                    grid.appendChild(weekRow);
                }
            };

            btnPrev.addEventListener('click', () => {
                visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
                renderGrid();
            });

            btnNext.addEventListener('click', () => {
                visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
                renderGrid();
            });

            btnToday.addEventListener('click', () => {
                onPick(toInputDate(new Date()));
                closeModal();
            });

            btnClose.addEventListener('click', closeModal);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            });

            card.appendChild(header);
            card.appendChild(grid);
            card.appendChild(footer);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            renderGrid();
        };

        const renderPicker = () => {
            const searchRoot = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
            const placeholders = searchRoot.querySelectorAll('date-menu-picker');
            placeholders.forEach((placeholder) => {
                const elementId = placeholder.getAttribute('id') || 'dataFiltroInput';
                const label = placeholder.getAttribute('label') || 'Data';

                const wrapper = document.createElement('div');
                wrapper.id = elementId;
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.width = '100%';
                wrapper.style.minWidth = '0';

                const labelNode = document.createElement('sp-label');
                labelNode.textContent = label;
                labelNode.style.color = 'white';
                labelNode.style.fontSize = '11px';

                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '6px';
                controls.style.alignItems = 'center';
                controls.style.width = '100%';
                controls.style.minWidth = '0';

                const inputDate = document.createElement('input');
                inputDate.id = elementId + '_value';
                inputDate.classList.add('hideble');
                inputDate.type = 'text';
                inputDate.placeholder = 'GG/MM/AAAA';
                inputDate.value = toInputDate(new Date());
                let lastValidDate = inputDate.value;
                inputDate.readOnly = true;
                inputDate.style.cursor = 'pointer';
                inputDate.style.height = '30px';
                inputDate.style.border = '1px solid #6a6a6a';
                inputDate.style.borderRadius = '4px';
                inputDate.style.background = '#2e2e2e';
                inputDate.style.color = '#ffffff';
                inputDate.style.padding = '0 8px';
                inputDate.style.width = '100%';
                inputDate.style.minWidth = '0';
                inputDate.style.flex = '1 1 auto';
                inputDate.style.boxSizing = 'border-box';
                inputDate.style.overflow = 'hidden';
                inputDate.style.textOverflow = 'ellipsis';

                const openCalendarButton = document.createElement('button');
                openCalendarButton.type = 'button';
                openCalendarButton.style.height = '30px';
                openCalendarButton.style.width = '34px';
                openCalendarButton.style.padding = '0';
                openCalendarButton.style.cursor = 'pointer';
                openCalendarButton.style.border = '1px solid #6a6a6a';
                openCalendarButton.style.borderRadius = '4px';
                openCalendarButton.style.background = '#3a3a3a';
                openCalendarButton.style.flex = '0 0 34px';

                const calendarIcon = document.createElement('img');
                calendarIcon.src = 'images/calendario.png';
                calendarIcon.alt = 'Calendario';
                calendarIcon.style.width = '16px';
                calendarIcon.style.height = '16px';
                calendarIcon.style.display = 'block';
                calendarIcon.style.margin = '0 auto';
                openCalendarButton.appendChild(calendarIcon);

                const emitChange = () => {
                    const detail = {
                        value: inputDate.value
                    };
                    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: detail, bubbles: true }));
                    wrapper.dispatchEvent(new Event('change', { bubbles: true }));
                };

                const openCalendar = () => {
                    openCalendarModal(inputDate.value, (pickedValue) => {
                        inputDate.value = pickedValue;
                        lastValidDate = pickedValue;
                        emitChange();
                    });
                };

                inputDate.addEventListener('click', openCalendar);
                openCalendarButton.addEventListener('click', openCalendar);

                inputDate.addEventListener('keydown', function (e) {
                    e.preventDefault();
                    if (e.key === 'Enter' || e.key === ' ') {
                        openCalendar();
                    }
                });

                inputDate.addEventListener('beforeinput', function (e) {
                    e.preventDefault();
                });

                inputDate.addEventListener('input', function () {
                    if (inputDate.value !== lastValidDate) {
                        inputDate.value = lastValidDate;
                    }
                });

                inputDate.addEventListener('paste', function (e) {
                    e.preventDefault();
                });

                inputDate.addEventListener('drop', function (e) {
                    e.preventDefault();
                });

                Object.defineProperty(wrapper, 'value', {
                    get() {
                        return inputDate.value;
                    },
                    set(newValue) {
                        inputDate.value = String(newValue || '');
                        emitChange();
                    }
                });

                controls.appendChild(inputDate);
                controls.appendChild(openCalendarButton);
                wrapper.appendChild(labelNode);
                wrapper.appendChild(controls);

                if (placeholder.parentNode) {
                    placeholder.parentNode.replaceChild(wrapper, placeholder);
                }
            });
        };

        if (rootNode == null && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderPicker, { once: true });
        }

        // In UXP alcuni flussi dinamici possono perdere il timing del DOMContentLoaded.
        // Eseguiamo sempre un tentativo immediato di mount sui placeholder presenti.
        renderPicker();
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

    getDnaOfBox: function (box) {
        if (!box.isValid)
            return null;

        if (box.parent.constructor.name != "Spread") {
            return null;
        }

        var result = null;
        var baseOld = null;
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (item.label && item.label.includes("$DNA$")) {
                var parts = item.label.split("$");
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
            else if (item.label && item.label.startsWith("base$")) {
                baseOld = item;
            }
        }
        var res = result != null ? result : (baseOld != null ? {
            label: "base",
            item: baseOld,
            boxLabel: baseOld.label.split("$")[1],
            codice: baseOld.label.split("$")[2],
            codice_gruppo: baseOld.label.split("$")[3],
            idRec: baseOld.label.split("$")[4],
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

const FotoPlacer=
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

}

module.exports.Utility = Utility;
module.exports.FotoPlacer = FotoPlacer;
