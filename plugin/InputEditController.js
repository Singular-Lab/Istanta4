
/// I20-1002: i campi di testo della scheda referenza - cosa e' stato modificato, cosa si puo'
/// modificare, cosa va salvato.
///
/// Tiene da parte il valore che ogni campo aveva all'apertura, e su quello si regge tutto:
/// getOperazioniDiSalvataggioDaFare confronta e restituisce SOLO le operazioni che servono
/// davvero, invece di risalvare ogni campo a ogni conferma.
///
/// E' una classe: ne nasce una per ogni scheda aperta.

//I20-1084: dal suo modulo, cosi' le decisioni del salvataggio si provano sotto Node. E' lo stesso
//oggetto che il Plugin usa altrove.
const TestoTag = require('./testoTag');

//Il marcatore con cui il server sa che una descrizione non e' stata toccata
//(SpecificitaDescrizione.NonToccato).
const SpecificitaNonToccato = "<untouched>";

class InputEditController {
    inputCollection = [];
    datasource = {};
    myContainer = null;
    convalidaFirma = false;//Boolean che mi specifica se tale REF in lettura è stata REVISIONATA con la FIRMA del tracciato o se invece è DA CONTROLLARE.
    descrInArchivio;
    inMismatch=false;
    //I20-993: le varianti che non comandano si guardano e non si toccano.
    solaLettura = false;

    constructor(container, convalidaFirma, descrInArchivio, compiledFields = null) {
        this.myContainer = container;//.find('input');
        this.convalidaFirma = convalidaFirma;   
        this.descrInArchivio = descrInArchivio;

        if(compiledFields!=null){
            let matchFieldData = compiledFields.find(f => Utility.parseLabel(f.labelName) == "descrizione");
            if (matchFieldData != null) {
                //Posso compilare il campo con i dati che leggo
                let content = matchFieldData.content;
                //Parsing del content
                if(content!=null){
                    let contentObj = TestoTag.parseContent(content);
                    //mettiamoci da parte una lista di tutti gli stili di tutte le row in contentObj post parse
                    for (let r = 0; r < contentObj.length; r++) {
                        let itemRow = contentObj[r];
                        if (itemRow.stile != null && itemRow.stile != "" && itemRow.stile.includes("_$Hidden")) {
                            var stile = itemRow.stile.replace("_$Hidden", "");
                            var stileUniversale = pluginMiddleware.getNameStileUniversale(stile);

                            if (stileUniversale != null) {

                                if (stileUniversale.fondamentale == "descrizione1") {
                                    descrInArchivio[0] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione2") {
                                    descrInArchivio[1] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione3") {
                                    descrInArchivio[2] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione4") {
                                    descrInArchivio[3] = "";
                                }
                            }
                        }
                    }
                }
            }
        }


        this.listen();

    }

    /// Si mette in ascolto delle modifiche dell'operatore sui campi.
    listen() {
        let me = this;

        let inddNettoInpage = "";
        let descr1InPage="";
        let descr2InPage="";
        let descr3InPage="";
        let descr4InPage="";

        //console.log("LISTEN");
        //console.log(this.myContainer.find("textarea"));
        this.myContainer.find("textarea").each((index, element) => {
            //console.log(element);
            let el = $(element);
            let labFam = el.attr("labelcorrispondente");

            if (labFam=="descrizione")
            {
                let style= el.attr("currentcharacterstyle");
                let univStyle = pluginMiddleware.getNameStileUniversale(style);
                if (univStyle!=null){

                    let val=el.val();
                    if (val[0]=='\n')
                    {
                        val = val.substring(1);                        
                    }
                    if (val[val.length-1]=='\n')
                    {
                        val = val.substring(0,val.length-1);
                    }

                    if (univStyle.fondamentale=="descrizione1")
                    {
                        if (descr1InPage=="")
                            descr1InPage=val;

                        inddNettoInpage+=val;
                    }
                                        
                    if (univStyle.fondamentale=="descrizione2")
                    {
                        if (descr2InPage=="")
                            descr2InPage=val;

                        inddNettoInpage+=val;
                    }

                    if (univStyle.fondamentale=="descrizione3")
                    {
                        if (descr3InPage=="")
                            descr3InPage=val;

                        inddNettoInpage+=val;
                    }


                    if (univStyle.fondamentale=="descrizione4")
                    {
                        if (descr4InPage=="")
                            descr4InPage=val;

                        inddNettoInpage+=val;
                    }
    

                }
            }
            

            let fam = me.datasource[labFam];
            if (fam == null) {
                me.datasource[labFam] = { lista: [], modificato: false };
            }

            me.datasource[labFam].lista.push(el);

            //I20-1084: anche change, all'uscita dal campo: se un incolla o un taglia non manda
            //input, il campo risulta cambiato lo stesso e il pulsante si aggiorna.
            el.on('input change', function (event) {
                //console.log("testo cambiato");

                let objFam = me.datasource[labFam];
                let elFamList = objFam.lista;

                let diff = false;
                for (let f = 0; f < elFamList.length; f++) {
                    let currVal = $(elFamList[f]).val();
                    let originVal = $(elFamList[f]).attr("defaultvalue");
                    //console.log(currVal + " != " + originVal);
                    if (currVal != originVal) {
                        diff = true;
                    }
                }

                objFam.modificato = diff;

                if (!diff) {
                    // for (let f = 0; f < elFamList.length; f++) {
                    //     $(elFamList[f]).css("background-color", "white");
                    //     //aggiungiamo una classe per il changestato
                    //     $(elFamList[f]).removeClass("textModified");
                    // }

                    $(el).css("background-color", "white");
                    //aggiungiamo una classe per il changestato
                    $(el).removeClass("textModified");
                    

                }
                else {
                    // for (let f = 0; f < elFamList.length; f++) {
                    //     $(elFamList[f]).css("background-color", "red");
                    //     //aggiungiamo una classe per il changestato
                    //     $(elFamList[f]).addClass("textModified");
                    // }

                    $(el).css("background-color", "red");
                    //aggiungiamo una classe per il changestato
                    $(el).addClass("textModified");
                }

                me.checkStato();

            });
            // $(element).on('keydown', me.onKeyDown);
        });

        this.checkStato();


        //Controllo MISMATCH

        this.descrInArchivio[0] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[0]);
        this.descrInArchivio[1] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[1]);
        this.descrInArchivio[2] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[2]);
        this.descrInArchivio[3] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[3]);

        if (false){//this.descrInArchivio[4] != null && this.descrInArchivio[4] != "") {
            //Esiste in archivio la desczrizione INDD
            let inddNettoINArchivioObj = TestoTag.parseContent(this.descrInArchivio[4]);

            let inddNettoINArchivio ="";
            for (let i2=0; i2<inddNettoINArchivioObj.length; i2++ )
            {
                let item2 = inddNettoINArchivioObj[i2];
                let val=item2.content;
                // if (val[0]=='\n')
                // {
                //     val = val.substring(1);                        
                // }
                // if (val[val.length-1]=='\n')
                // {
                //     val = val.substring(0,val.length-1);
                // }
                inddNettoINArchivio+=TestoTag.trimDescrizione(val);
            }



            if (inddNettoINArchivio != TestoTag.trimDescrizione(inddNettoInpage)) {
                //MISMATCH WARNING
                $("#mismatchWarningPanel").text("ATTENZIONE - Mismatch tra impaginato e Istanta: La desrizione HTML non coincide");
                $("#mismatchWarningPanel").css("background-color", "orange");
                
                //Abilito il bottone di azione
                $("#salvaButton").css("display", "block");
                this.inMismatch=true;
            }
        }
        else {
            let report = "";

            if (TestoTag.trimDescrizione(this.descrInArchivio[0]) != TestoTag.trimDescrizione(descr1InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione1 no match";
            }
            if (TestoTag.trimDescrizione(this.descrInArchivio[1]) != TestoTag.trimDescrizione(descr2InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione2 no match";
            }
            if (TestoTag.trimDescrizione(this.descrInArchivio[2]) != TestoTag.trimDescrizione(descr3InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione3 no match";
            }
            if (TestoTag.trimDescrizione(this.descrInArchivio[3]) != TestoTag.trimDescrizione(descr4InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione4 no match";
            }

            if (report != "") {
                //MISMATCH WARNING
                $("#mismatchWarningPanel").html("<h5>ATTENZIONE - Mismatch tra impaginato e Istanta:" + report+"</h5>");
                $("#mismatchWarningPanel").css("background-color", "orange");

                //Abilito il bottone di azione
                $("#salvaButton").css("display", "block");
                this.inMismatch=true;
            }

        }

    }

    /// Aggiorna lo stato della scheda dopo una modifica: cosa risulta cambiato, e se la
    /// descrizione mostrata si discosta da quella in archivio.
    checkStato() {
        let modificato = false;
        for (let key in this.datasource) {
            let objFam = this.datasource[key];

            if (objFam.modificato) {
                modificato = true;
                break;
            }

        }

        let azioniStrutturali = false;
        //controlliamo se #azioni_strutturali ha figli
        if ($("#azioni_strutturali").children().length > 0) {
            azioniStrutturali = true;
        }

        //$("#salvaButton").prop("disabled", !modificato);
        $("#salvaButton").css("display", modificato || azioniStrutturali ? "block" : "none");
        if (!this.convalidaFirma) {
            messaggioUtente("Convalidare firma", "warning", false, 3);
            //Il pulsante va fatto vedere a prescindere anche se con testo diverso
            //$("#salvaButton").text("Approva descrizione");
            //cambiamo il colore del testo del pulsante
            $("#salvaButton").css("color", "yellow");
            $("#salvaButton").css("display", "block");

            //$("#edit_campi_offerta").css("display", "none");

        }

        if (this.inMismatch)
        {
            $("#salvaButton").css("display", "block");
        }

        //I20-1084: basta il testo di una descrizione diverso dall'archivio, anche se nessun
        //evento ha detto che e' cambiato. Questa condizione si aggiunge alle altre e non ne
        //toglie nessuna: dove il pulsante si vedeva, si vede ancora.
        if (this.descrizioneDiversaDallArchivio())
        {
            $("#salvaButton").css("display", "block");
        }

    }

    /// I20-1084: il testo come lo confronta il controllo di mismatch, senza spazi e a capo.
    static testoPerConfronto(testo) {
        return TestoTag.trimDescrizione(testo == null ? "" : String(testo));
    }

    /// I20-1084: i campi della descrizione, uno per textarea, come li guarda il salvataggio: lo
    /// stile, la descrizione fondamentale a cui porta (null se nessuna), il testo, se il campo ha
    /// ricevuto una modifica, e se e' un tratto nascosto o di bruciatura.
    vociDellaDescrizione() {
        const famiglia = this.datasource != null ? this.datasource["descrizione"] : null;
        const lista = famiglia != null && Array.isArray(famiglia.lista) ? famiglia.lista : [];
        const me = this;

        return lista.map(function (el) {
            const stile = $(el).attr("currentcharacterstyle");
            const universale = stile != null ? pluginMiddleware.getNameStileUniversale(stile) : null;
            return {
                stile: stile,
                fondamentale: universale != null ? universale.fondamentale : null,
                valore: $(el).val(),
                modificato: $(el).hasClass("textModified"),
                nascosto: $(el).attr("trattonascosto") == "1",
                bruciatura: me.eTrattoDiBruciatura("descrizione", stile)
            };
        });
    }

    /// I20-1084: le descrizioni fondamentali che nel box hanno piu' di un tratto con del testo,
    /// con gli stili di quei tratti: [{ fondamentale, stili }], vuoto se non ce ne sono. Con due
    /// tratti per la stessa descrizione non si sa quale mandare al server, e il salvataggio si
    /// ferma. I tratti vuoti non contano: sono quelli che lo schema aggiunge per gli stili
    /// mancanti, o quelli che l'operatore ha svuotato spostandone il testo in un altro. Non
    /// contano nemmeno i nascosti e le bruciature, che descrizione non sono.
    static trattiRipetuti(voci) {
        const perFondamentale = {};

        (voci || []).forEach(function (voce) {
            if (voce == null || voce.fondamentale == null || voce.nascosto || voce.bruciatura) {
                return;
            }
            if (InputEditController.testoPerConfronto(voce.valore) === "") {
                return;
            }
            if (perFondamentale[voce.fondamentale] == null) {
                perFondamentale[voce.fondamentale] = [];
            }
            if (perFondamentale[voce.fondamentale].indexOf(voce.stile) < 0) {
                perFondamentale[voce.fondamentale].push(voce.stile);
            }
            perFondamentale[voce.fondamentale].quanti = (perFondamentale[voce.fondamentale].quanti || 0) + 1;
        });

        return Object.keys(perFondamentale)
            .filter(f => perFondamentale[f].quanti > 1)
            .sort()
            .map(f => ({ fondamentale: f, stili: perFondamentale[f].slice() }));
    }

    /// I20-1084: "DESCRIZIONE_GRAMMATURA, DESCRIZIONE_TIPO", per i messaggi.
    static nomiDeiTrattiRipetuti(ripetuti) {
        return (ripetuti || []).map(r => r.stili.join(" / ")).join(", ");
    }

    /// I20-1084: le descrizioni fondamentali ripetute nei campi di questa scheda.
    trattiRipetutiDellaDescrizione() {
        return InputEditController.trattiRipetuti(this.vociDellaDescrizione());
    }

    /// I20-1084: cosa mandare al server per ciascuna descrizione fondamentale, dal contenuto dei
    /// campi e non dagli eventi. Un campo uguale all'archivio, a meno di spazi e a capo, parte
    /// come "<untouched>"; uno diverso parte col suo testo. Con forzato (descrizione ereditata,
    /// variante nuova, "Scegli quella del box") partono tutti col loro testo, come prima.
    ///
    /// Restano alla regola di prima - il testo se il campo e' stato modificato, se la scheda e'
    /// in mismatch o se forzato, altrimenti "<untouched>" - i tratti nascosti, che l'operatore non
    /// vede, e le varianti in sola lettura, che mostrano i testi di un'altra variante: confrontarli
    /// con questo archivio direbbe "cambiato" per niente.
    ///
    /// Restituisce { valori: { descrizioneN: testo | "<untouched>" }, cambiati: [descrizioneN],
    /// ripetuti }: una descrizione senza nessun campo non c'e' fra i valori, e il server la
    /// lascia com'e'. Una ripetuta nemmeno: con lei il salvataggio non parte.
    static decidiFondamentali(voci, archivio, opzioni = {}) {
        const forzato = opzioni.forzato === true;
        const regolaDiPrima = function (voce) {
            return voce.modificato || opzioni.inMismatch === true || forzato;
        };
        const ripetuti = InputEditController.trattiRipetuti(voci);
        const valori = {};
        const cambiati = [];

        ["descrizione1", "descrizione2", "descrizione3", "descrizione4"].forEach(function (fondamentale, indice) {
            const sue = (voci || []).filter(v => v != null && v.fondamentale === fondamentale && !v.bruciatura);
            if (sue.length === 0 || ripetuti.some(r => r.fondamentale === fondamentale)) {
                return;
            }

            const visibili = sue.filter(v => !v.nascosto);

            if (visibili.length === 0 || opzioni.solaLettura === true) {
                //L'ultimo campo modificato vince, gli altri non toccano niente: com'era.
                sue.forEach(function (voce) {
                    if (regolaDiPrima(voce)) {
                        valori[fondamentale] = voce.valore;
                    }
                    else if (valori[fondamentale] == null) {
                        valori[fondamentale] = SpecificitaNonToccato;
                    }
                });
                if (valori[fondamentale] !== SpecificitaNonToccato) {
                    cambiati.push(fondamentale);
                }
                return;
            }

            //Il campo con del testo, se c'e'; se sono tutti vuoti, il primo: la descrizione e'
            //stata svuotata.
            const conTesto = visibili.filter(v => InputEditController.testoPerConfronto(v.valore) !== "");
            const scelta = conTesto.length > 0 ? conTesto[0] : visibili[0];
            const inArchivio = archivio != null ? archivio[indice] : null;
            const diverso = InputEditController.testoPerConfronto(scelta.valore) !== InputEditController.testoPerConfronto(inArchivio);

            if (diverso) {
                cambiati.push(fondamentale);
            }
            valori[fondamentale] = diverso || forzato ? scelta.valore : SpecificitaNonToccato;
        });

        return { valori: valori, cambiati: cambiati, ripetuti: ripetuti };
    }

    /// I20-1084: il testo di almeno una descrizione fondamentale e' diverso da quello in archivio,
    /// oppure una descrizione ha piu' tratti: in tutti e due i casi c'e' da salvare, o da sentirsi
    /// dire perche' non si puo'. Mai in sola lettura e mai coi tratti nascosti: vedi
    /// decidiFondamentali.
    descrizioneDiversaDallArchivio() {
        if (this.solaLettura) {
            return false;
        }
        const voci = this.vociDellaDescrizione().filter(v => !v.nascosto);
        const decise = InputEditController.decidiFondamentali(voci, this.descrInArchivio);
        return decise.cambiati.length > 0 || decise.ripetuti.length > 0;
    }

    /// I20-1079: il tratto della descrizione con uno stile di bruciatura del cliente, che il
    /// confronto lascia fuori (confronti.stiliBruciaturaDelCampo). Senza stili dichiarati, mai.
    eTrattoDiBruciatura(key, style) {
        if (key != "descrizione" || typeof confronti === "undefined" || confronti == null) {
            return false;
        }
        return confronti.eStileBruciatura(style, confronti.stiliBruciaturaDelCampo(key));
    }

    /// Il cuore della classe: confronta i valori attuali con quelli di partenza e restituisce
    /// le sole operazioni necessarie. Senza questo confronto ogni conferma riscriverebbe tutti
    /// i campi, anche quelli che l'operatore non ha toccato.
    getOperazioniDiSalvataggioDaFare(descrizioneEreditata = false)
    {
        //Funzione che torna al gestore le cose che devono essere cambiate
        let operazioni={
            revisione:{valore:"",valoreInddSoloFondamentali:"",valoreIndd:""},
            campi_offerta:[],
            //I20-1084: le descrizioni con piu' tratti nel box. Se non e' vuoto la descrizione non
            //si puo' mandare: lo decide chi salva.
            trattiRipetuti:[]
        };

        let lastValLettoInDescrizione="";

        for (let key in this.datasource) {
            let objFam = this.datasource[key];

            if (objFam.modificato ||
                (key=="descrizione" && (!this.convalidaFirma || this.inMismatch || descrizioneEreditata || this.descrizioneDiversaDallArchivio()))
             ) {

                //I20-1084: le descrizioni fondamentali si decidono tutte insieme, dal contenuto,
                //invece che campo per campo dall'ultimo modificato.
                if (key=="descrizione")
                {
                    const decise = InputEditController.decidiFondamentali(this.vociDellaDescrizione(), this.descrInArchivio,
                        { forzato: descrizioneEreditata, inMismatch: this.inMismatch, solaLettura: this.solaLettura });
                    Object.assign(operazioni.revisione, decise.valori);
                    operazioni.trattiRipetuti = decise.ripetuti;
                }

                for(let i=0; i<objFam.lista.length; i++)
                {
                    let el = objFam.lista[i];
                    let style= $(el).attr("currentcharacterstyle");
                    //I20-1079: la bruciatura (Coop: MAX_PEZZI) sta nel box ma non e' descrizione: non
                    //si manda al server come tale. Il box resta com'e'.
                    if (this.eTrattoDiBruciatura(key, style)) {
                        continue;
                    }
                    let hasMismatch = $(el).hasClass("mismatchInImpaginato");
                    let parag="none";
                    let parag_universale = parag;
                    if (style=="mix")
                    {
                        parag= $(el).attr("paragraphStyle");
                        let parag_universale_search = pluginMiddleware.getNameStileUniversale(parag);
                        if (parag_universale_search!=null)
                        {
                            parag_universale=parag_universale_search.nome;
                        }
                        else
                        {
                            parag_universale=parag;
                        }
                    }
                    
                    let valNetto = $(el).val();
                    //leggiamo descrInArchivio[i] e lo confrontiamo con valNetto


                    //Vediamo se dobbiamo aggiungere uno spazio prima dell'inizio del testo
                    // if (lastValLettoInDescrizione!="" && valNetto!="")
                    // {
                    //     if (valNetto[0]!=' ' && valNetto[0]!='\n')
                    //     {       
                    //         if (lastValLettoInDescrizione[lastValLettoInDescrizione.length-1]!=' ' && 
                    //             lastValLettoInDescrizione[lastValLettoInDescrizione.length-1]!='\n'
                    //         )
                    //         {
                    //             valNetto = " " + valNetto;   
                    //             $(el).val(valNetto);
                    //         }
                    //     }
                    // }  

                    let valWithTag="<"+style+">";
                    valWithTag+=valNetto;
                    valWithTag+="</"+style+">";

                    let stile_universale = pluginMiddleware.getNameStileUniversale(style);


                    let valoreInddUniversale=valWithTag;

                    if (stile_universale!=null)
                    {
                        valoreInddUniversale="<"+stile_universale.nome+">";
                        valoreInddUniversale+=valNetto;
                        valoreInddUniversale+="</"+stile_universale.nome+">";
                    }

                    if (key=="descrizione")
                    {
                        //operazioni.campi_offerta.push({label:key, valore:objFam.lista});
                        
                        if (stile_universale!=null)
                        {

                            //Lo prendo in considerazione                            

               
                            operazioni.revisione.valoreInddSoloFondamentali += valoreInddUniversale;
                            //I20-1084: descrizione1-4 le ha gia' decise decidiFondamentali.

                        }

                        operazioni.revisione.valore += valNetto;
                        operazioni.revisione.valoreIndd += valWithTag;

                        //Descrizione come campo SyncIndd
                        let item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        if (item==null)
                        {
                            operazioni.campi_offerta.push(
                                {
                                    label:key, 
                                    labelUniversale:key,
                                    valore:"",
                                    valoreIndd:"",
                                    valoreInddSoloFondamentali:"",
                                    paragraphStyle:"none",//Descrizione non puo avere paragrafo
                                    paragraphStyleUniversale:"none"

                                }
                            );
                        }
                        item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        item.valore += valNetto;
                        item.valoreIndd+= valWithTag;
                        item.valoreInddSoloFondamentali += valoreInddUniversale;

                        if (valNetto!="")
                        {
                            //Solo se il campo  definito
                            lastValLettoInDescrizione = valNetto;
                        }
                    }
                    else
                    {
                        //operazioni.campi_offerta.push({label:key, valore:objFam.lista});
                        let item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        if (item==null)
                        {
                            operazioni.campi_offerta.push(
                                {
                                    label:key, 
                                    labelUniversale:(stile_universale!=null?stile_universale.nome:key),
                                    valore:"",
                                    valoreIndd:"",
                                    valoreInddSoloFondamentali:"",
                                    paragraphStyle:parag,
                                    paragraphStyleUniversale:parag_universale
                                }
                            );
                        }
                        item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        item.valore += valNetto;
                        item.valoreIndd+= valWithTag;
                        item.valoreInddSoloFondamentali += valoreInddUniversale;

                    }


                }
                    
            }

        }

        return operazioni;
    }
}

module.exports = InputEditController;