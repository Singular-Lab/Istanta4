/// I20-1012: il testo dei campi con i suoi stili, uscito da utility.js.
///
/// I tag sono i nomi degli stili di carattere scritti nel testo, <StileA>ciao</StileA>: il Plugin
/// li legge da un campo (componiStringTagFromInndTextFrame), li scrive in un campo
/// (applicaTagStringToInndTextFrame), li scompone (parseContent). Qui stanno anche gli stili
/// annidati, i tratti di stile di un campo, la ricerca di uno stile per nome ("Gruppo.Nome") e la
/// direzione in cui un campo cresce quando il testo non ci sta.
///
/// Gli altri file lo chiamano TestoTag.X, come globale dichiarata da indexNew.js. Usa Utility
/// come globale anche lui, per parseLabel e replaceAllSpecialCharacters: utility.js importa
/// questo file, e un require al contrario creerebbe un ciclo.
///
/// SI CARICA SOTTO NODE, anche se parla con InDesign. Delle costanti di InDesign servono solo
/// FitOptions e NestedStyleDelimiters, e si chiedono con indesign() dentro le due funzioni che le
/// usano: cosi' parseContent, trimDescrizione, parseStile e parseObjStile si provano chiamandole,
/// le ultime due con un documento finto. Il resto si prova in collaudo.
const trattiDescrizione = require('./trattiDescrizione');
//Si chiede al momento della chiamata: in testa al file, sotto Node il modulo non si caricherebbe.
function indesign() { return require('indesign'); }

const TestoTag = {
    /// Scompone un testo con i tag, <StileA>ciao</StileA><StileB>mondo</StileB>, in
    /// [{ stile, content }]. Senza un tag in testa il testo e' un pezzo solo, senza stile. Un tag
    /// non chiuso ferma la lettura e lascia un pezzo che lo dice.
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
            //I20-1012: qui c'era un console.log per ogni carattere del testo, su ogni campo.

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
    /// Il contrario di applicaTagStringToInndTextFrame: legge un campo di InDesign e ne scrive il
    /// testo con i tag, un tag a ogni cambio di stile di carattere.
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
        const { FitOptions } = indesign();
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

    /// Da che parte puo' crescere un campo quando il testo non ci sta, secondo la sua etichetta: la
    /// descrizione in verticale, ogni altro campo in orizzontale.
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

    /// Applica al campo ctrl, carattere per carattere, gli stili annidati dello stile di paragrafo:
    /// per parole, per caratteri, fino al tab.
    applyNeastedStyles:function(ctrl, paragraph) {
        const { NestedStyleDelimiters } = indesign();
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
    /// I20-995: i tratti di stile di un campo, letti in un colpo solo.
    ///
    /// textStyleRanges da' i pezzi di testo con stile omogeneo: sono pochi, mentre i caratteri
    /// sono tanti, e ogni carattere chiesto a InDesign e' un passaggio che si paga. I tratti
    /// consecutivi con lo stesso stile si accorpano, perche' InDesign spezza anche dove cambia
    /// soltanto un attributo locale e la scheda invece ragiona per nome di stile.
    trattiDiStileDelCampo:function(item)
    {
        if (item == null || !item.isValid)
        {
            return [];
        }

        let tratti=[];
        let pezzi=item.textStyleRanges.everyItem().getElements();

        for (let i=0; i<pezzi.length; i++)
        {
            let pezzo=pezzi[i];
            let stile=pezzo.appliedCharacterStyle;
            let nome=stile!=null ? stile.name : "";
            let gruppo=null;

            if (stile!=null && stile.parent!=null && stile.parent.constructorName=="CharacterStyleGroup")
            {
                gruppo=stile.parent.name;
            }

            tratti.push({
                nome: nome,
                nomeCompleto: trattiDescrizione.nomeCompletoStile(nome, gruppo),
                contenuto: pezzo.contents,
                origine: pezzo
            });
        }

        return trattiDescrizione.accorpa(tratti);
    },

    /// Una descrizione ridotta per il confronto: senza a capo e senza spazi, nemmeno in mezzo.
    /// Non e' un trim: "Pasta di semola" diventa "Pastadisemola".
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

    /// Lo stile di paragrafo o di carattere del documento, dato il nome. "Nome" lo cerca in
    /// radice, "Gruppo.Nome" dentro il gruppo. null se non c'e'.
    parseStile(stile, paragraph = false) {
        //I20-1012: locale. Prima era scritta senza dichiararla, e finiva fra le globali.
        let stileSplitted = stile.split(".");
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

    /// Come parseStile, per gli stili oggetto.
    parseObjStile(stile) {
        //I20-1012: locale. Prima era scritta senza dichiararla, e finiva fra le globali.
        let stileSplitted = stile.split(".");
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
};

module.exports = TestoTag;
