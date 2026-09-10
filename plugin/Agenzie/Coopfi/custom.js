//Coop.fi
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions } = require('indesign');
const { FotoPlacer, Utility } = require('./utility');

class Agenzia {

//#region VARIABILI FILTRO e VISUALIZZAZIONE TRACCIATO

    campiFiltro=[
        {
            nomeCampoVisualizzato:"Tema",
            campoAssociato:"tema",
            tendina:true
        },
        {
            nomeCampoVisualizzato:"Reparto",
            campoAssociato:"reparto",
            tendina:true
        },
        {
            nomeCampoVisualizzato:"Settore",
            campoAssociato:"settore",
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
            nomeCampoVisualizzato:"Sconto",
            campoAssociato:"txt_sconto",
            tendina:false
        },
        {
            nomeCampoVisualizzato:"Sconto soci",
            campoAssociato:"txt_sconto_soci_doppia",
            tendina:false
        }
    ];

    filtroRicerca = [
        {tree: "recordInTracciato", field: "reparto", label: "Reparto", tipoValori:"string"},
        {tree: "recordInTracciato", field: "tema", label: "Tema", tipoValori:"string"},
        {tree: "recordInTracciato", field: "Scatto.CodiceGruppo", label: "Codice", tipoValori:"string"}
    ];

    colonneTracciato = [
        {
            nome: "Codice",
            chiaveDato: "codice",
            percColonna: 80
        },
        {
            nome: "Descrizione",
            chiaveDato: "descrizione",
            percColonna: 140
        },
        {
            nome: "Tema",
            chiaveDato: "tema",
            percColonna: 140
        }, {
            nome: "Reparto",
            chiaveDato: "reparto",
            percColonna: 140
        }
    ];

//#endregion

//#region IMPAGINAZIONE e FIX FOTO
    invalidareStileDiCarattere = false;

    customPadding = [
        { label: "box_sconto", padding: [-18.5, 0, 0, -21] }, //qui vanno messi i padding degli ostacoli per il fix foto se ce ne sono  [{label: "string", padding: [top, left, bottom, right]}]
    ];

    paddingBox = [0, 0, 0, 0]; // [top, left, bottom, right] padding da applicare ai box per il calcolo dei candidati
    paddingFoto = [0, 0]; // [top/bottom, left/right] padding da applicare alle foto

    ignoreElementsFixFoto = ["sconto", "txt_sconto", "sconto_base", "sfondo"];

    exceptionElementsToIgnoreFixFoto = []; //se un elemento è sia in ignoreElementsFixFoto che in exceptionElementsToIgnoreFixFoto non viene ignorato. Serve perchè si può fare cose come ignora loghi e specificare solo il logo che fa eccezione

    calcoloDistanziamentoFoto = [ //il ratio è calcolato Y/X
        {
            foto: 1,
            percDistFoto: [{
                percDistanceXFoto: [],
                percDistanceYFoto: [],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: Infinity,
            }],
        },
        {
            foto: 2,
            percDistFoto: [{
                percDistanceXFoto: [0.5],
                percDistanceYFoto: [-0.25],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: Infinity,
            }],
        },
        {
            foto: 3,
            percDistFoto: [{
                percDistanceXFoto: [0.5, -1.05],
                percDistanceYFoto: [-0.3, 0],
                startRangeRatioCondition: 0,
                endRangeRatioCondition: Infinity,
            },
            ],
        }
    ];

    simboli = {};

    campiSoggettiAOverflow=[{label:"descrizione",h:"top", w:""}];
    
    valoreOverflow = [-2.15, -1, 2.15, 1];

//#endregion

//#region VARIABILI VISUALIZZAZIONE REFERENZA, SALVA REVISIONE ED ESPORTAZIONE

    schemiDescrizioni = [{
        schema: ["START$DESCRIZIONE_TITOLO_SP", "START$DESCRIZIONE_BRAND_SP", "START$DESCRIZIONE_GRAMMATURA_SP", "START$DESCRIZIONE_TIPO_SP"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO_LINEA", "START$DESCRIZIONE_BRAND_LINEA", "START$DESCRIZIONE_GRAMMATURA_LINEA", "START$DESCRIZIONE_TIPO_LINEA"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO_JOLLY", "START$DESCRIZIONE_BRAND_JOLLY", "START$DESCRIZIONE_GRAMMATURA_JOLLY", "START$DESCRIZIONE_TIPO_JOLLY"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_GRAMMATURA", "START$DESCRIZIONE_TIPO"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_GRAMMATURA", "START$DESCRIZIONE_TIPO"],
        setRegole: [[]],
    },
    {
        schema: ["START$DESCRIZIONE_TITOLO", "START$DESCRIZIONE_BRAND", "START$DESCRIZIONE_GRAMMATURA", "START$DESCRIZIONE_TIPO", "START$MAX_PEZZI"],
        setRegole: [[]],
    }
    ];

    listaStiliUniversali = [
        { nome: "DESCRIZIONE_TITOLO", rule: "IN$TITOLO", fondamentale: "descrizione1" },
        { nome: "DESCRIZIONE_BRAND", rule: "IN$BRAND", fondamentale: "descrizione2" },
        { nome: "DESCRIZIONE_GRAMMATURA", rule: "IN$GRAMMATURA", fondamentale: "descrizione4" },
        { nome: "DESCRIZIONE_TIPO", rule: "IN$TIPO", fondamentale: "descrizione3" }];

    grandezzeBox = {
        bigBoxWidth: 200,
        bigBoxHeight: "auto",
        smallBoxWidth: "auto",
        smallBoxHeight: 30,
        bigBoxPerRow: 2,
        smallBoxPerRow: 4,
        marginBetweenBigBox: 10,
        marginBetweenSmallBox: 0,
    };

    abilitaDescrizioniRegionali = false;
    abilitaDescrizioniCanale = false;

//#endregion

//#region VARIABILI CAMPI VARI E NOMENCLATURE

    listCampiNonEditabili = [];
    listCampiEditabiliPrioritari = [];

    nomeFotoPrimaria = "immagine";
    nomeFotoSecondarie = "foto_secondaria";
    fotoNotFound = "fotoNoFound.png";
    nomeNoFoto = "nofoto.png";

    area = null;
    canale = null;
    codiceFormato = null;
    tipoLavorazione = null;
    contesto_promo = [];



    listCampiConfrontoBypass = ["prezzo_promo", "prezzo_promo_kgl", "txt_sconto", "prezzo_continuo"];

//#endregion

//#region METODI SETTER, REMOVE e GETTER VARI

    rimuoviSimboli() {
        for (var key in this.simboli) {
            if (this.simboli[key] != null && this.simboli[key].isValid) {
                this.simboli[key].remove();
            }
        }

        this.simboli = {};
    };

    setBolloNOFOTO(name) {
        this.nomeNoFoto = name;
    };

    setBolloFOTONOFOUND(name) {
        this.fotoNotFound = name;
    };

    getNameStileUniversale(stile) {

        for (var i = 0; i < this.listaStiliUniversali.length; i++) {
            var stileUniversale = this.listaStiliUniversali[i];
            if (stileUniversale.rule.indexOf("IN$") >= 0) {
                if (stile.indexOf(stileUniversale.rule.replace("IN$", "")) >= 0) {
                    return stileUniversale;
                }
            }
        }
        return null;
    };

    getModeConfronto() {
        return 2; //modalità a riempimento
    };

    //Funzione che torna dei dettagli di impaginazione nel proceso di CONTEGGIO per poter destinare alcune ref in spazi ben precisi
    requiresIngombro(itemRef)
    {
        if (itemRef["codiceBox"].startsWith("BOX_doppio_SCONTO") ||
            itemRef["codiceBox"].startsWith("BOX_doppio_SCONTO_LINEA") ||
            itemRef["codiceBox"].startsWith("BOX_JOLLY_EVIDENZIATO") ||
            itemRef["codiceBox"].startsWith("BOX_SpendiPunti")) {
            return "true";
        }

        return "";
    };

    //Funzione che torna dei dettagli di impaginazione nel proceso di CONTEGGIO per poter suggerire decisioni
    getInfoExtra(itemRef)
    {
        var string = "\n";
        string += "Reparto: " + itemRef["reparto"]+ "\n";
        string += "Meccanica: " + itemRef["meccanica"]+ "\n";
        return string;
    };
    
    //Funzione che aggiunge etichette custom al processo core di etichettatura ref
    getEtichette(itemRef, listaEtichette){
        
        let etichetteCustom = [];   
        //Controllare se ci sono prezzi promo differenti e non si tratta di LINEA
        let codGruppo = itemRef["Scatto.CodiceGruppo"];
        let recordsDelGruppo = contenutoKitInLavorazione.records.filter(r=>r.recordInTracciato["Scatto.CodiceGruppo"]==codGruppo);

        if (
            itemRef["codiceBox"]!="BOX_LINEA" &&
            itemRef["codiceBox"]!="BOX_JOLLY" &&
            itemRef["codiceBox"]!="BOX_JOLLY_EVIDENZIATO" &&
            itemRef["codiceBox"]!="BOX_SPRINT" &&
            itemRef["codiceBox"]!="BOX_ESCLUSIVA_SOCI" &&
            itemRef["codiceBox"]!="BOX_SpendiPunti"
        )
        {
            let collPrezzi = [];
            for (let r=0; r<recordsDelGruppo.length; r++)
            {
                let pp = recordsDelGruppo[r].recordInTracciato["prezzo_promo"];
                if (collPrezzi.indexOf(pp)<0)
                {
                    collPrezzi.push(pp);
                }
            }

            if (collPrezzi.length>1)
            {
                etichetteCustom.push("PIU_PREZZI_PROMO");
            }
        }

        if (
            itemRef["codiceBox"]=="BOX_JOLLY" ||
            itemRef["codiceBox"]=="BOX_JOLLY_EVIDENZIATO" ||
            itemRef["codiceBox"]=="BOX_SPRINT"
        )
        {
            if (recordsDelGruppo.length>=5)
            {
                let prezzi =[];
                recordsDelGruppo.map(o=>{
                    if (prezzi.indexOf(o.recordInTracciato["prezzo_promo"])<0)
                    {
                        prezzi.push(o.recordInTracciato["prezzo_promo"]);
                    }
                });
                
                let count=prezzi.length;
                console.log(itemRef["Scatto.CodiceGruppo"] + " => conta prezzi: " + count);

                if (count>=3)
                    etichetteCustom.push("LINEA??");
            }
        }

        if (recordsDelGruppo.length>1)
        {
            if (itemRef["prestazione"]=="")
            {
                etichetteCustom.push("NO PRESTAZIONE");
            }
        }

        listaEtichette.concat(etichetteCustom);

        return listaEtichette;
    };

    getCambioStrutturalePath(itemRef, box) {

        //Di default questi
        let result = [{
            id: 1,
            titolo: "Cambia prezzo promo",
            istruzioni: [
                { field: "prezzo_promo", valore: null, primary: true },
                /*{ field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.prezzo_promo)/old.prezzo_promo",triggerActionId:2 },
                { field: "txt_sconto", valore: null, autocomplete:"100-(((100-old.txt_sconto)*new.prezzo_promo)/old.prezzo_promo)",triggerActionId:3 },
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.prezzo_promo)/old.prezzo_promo",triggerActionId:11 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.prezzo_promo_kgl)/old.prezzo_promo_kgl",triggerActionId:12 },
                { field: "txt_sconto_soci_doppia", valore: null, autocomplete:"(old.txt_sconto_soci_doppia*new.txt_sconto)/old.txt_sconto",triggerActionId:14 }*/
            ],
            campiInddCoinvolti: [{ label: "prezzo_promo", item: null }],
            labelELementCorreggo: "prezzo_promo"
        },
        {
            id: 2,
            titolo: "Cambia prezzo promo kg/l",
            istruzioni: [
                { field: "prezzo_promo_kgl", valore: null, primary: true },
                /*{ field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*new.prezzo_promo_kgl)/old.prezzo_promo_kgl", triggerActionId:1 },
                { field: "txt_sconto", valore: null, autocomplete:"100-(((100-old.txt_sconto)*new.prezzo_promo)/old.prezzo_promo)", triggerActionId:3},
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.prezzo_promo)/old.prezzo_promo",triggerActionId:11 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.prezzo_promo_kgl)/old.prezzo_promo_kgl",triggerActionId:12 },
                { field: "txt_sconto_soci_doppia", valore: null, autocomplete:"(old.txt_sconto_soci_doppia*new.txt_sconto)/old.txt_sconto",triggerActionId:14 }*/
            ],
            labelELementCorreggo: "prezzo_promo_kgl"
        },
        {
            id: 3,
            titolo: "Cambia sconto",
            istruzioni: [
                { field: "txt_sconto", valore: null, primary: true },
                /*{ field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*(100-new.txt_sconto))/(100-old.txt_sconto)", triggerActionId:1},
                { field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.prezzo_promo)/old.prezzo_promo", triggerActionId:2 },
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.prezzo_promo)/old.prezzo_promo",triggerActionId:11 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.prezzo_promo_kgl)/old.prezzo_promo_kgl",triggerActionId:12 },
                { field: "txt_sconto_soci_doppia", valore: null, autocomplete:"(old.txt_sconto_soci_doppia*new.txt_sconto)/old.txt_sconto",triggerActionId:14 }*/
            ],
            campiInddCoinvolti: [{ label: "txt_sconto", item: null }, { label: "sconto_piccolo", item: null }],
            labelELementCorreggo: "txt_sconto"
        },
        {
            id: 17,
            titolo: "Cambia prezzo info pack",
            istruzioni: [
                { field: "Descrizioni$Um", valore: ["KG", "LT", "PZ", ""] }
            ],
            campiInddCoinvolti: [{ label: "prezzo_info_pack", item: null }],
            labelELementCorreggo: "prezzo_info_pack"
        },
        {
            id: 10,
            titolo: "Cambia prezzo continuo",
            istruzioni: [
                { field: "prezzo_continuo", valore: null, primary: true },
                /*{ field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.prezzo_continuo)/old.prezzo_continuo", triggerActionId:2 },
                { field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*new.prezzo_continuo)/old.prezzo_continuo", triggerActionId:1},
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.prezzo_continuo)/old.prezzo_continuo",triggerActionId:11 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.prezzo_continuo)/old.prezzo_continuo",triggerActionId:12 },*/
            ],
            campiInddCoinvolti: [{ label: "prezzo_continuo", item: null }],
            labelELementCorreggo: "prezzo_continuo"
        },
        {
            id: 11,
            titolo: "Cambia prezzo promo soci",
            istruzioni: [
                { field: "prezzo_promo_soci_doppia", valore: null, primary: true },
                /*{ field: "txt_sconto", valore: null, autocomplete:"(old.txt_sconto*new.prezzo_promo_soci_doppia)/old.prezzo_promo_soci_doppia", triggerActionId:3 },
                { field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.prezzo_promo_soci_doppia)/old.prezzo_promo_soci_doppia", triggerActionId:2 },
                { field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*new.prezzo_promo_soci_doppia)/old.prezzo_promo_soci_doppia", triggerActionId:1},
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.prezzo_promo_soci_doppia)/old.prezzo_promo_soci_doppia",triggerActionId:12 },
                { field: "txt_sconto_soci_doppia", valore: null, autocomplete:"(old.txt_sconto_soci_doppia*new.prezzo_promo_soci_doppia)/old.prezzo_promo_soci_doppia",triggerActionId:14 }*/
            ],
            campiInddCoinvolti: [{ label: "prezzo_promo_SOCI_DOPPIA", item: null }],
            labelELementCorreggo: "prezzo_promo_SOCI_DOPPIA"
        },
        {
            id: 12,
            titolo: "Cambia prezzo promo kgl soci",
            istruzioni: [
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, primary: true },
                /*{ field: "txt_sconto", valore: null, autocomplete:"(old.txt_sconto*new.prezzo_promo_kgl_soci_doppia)/old.prezzo_promo_kgl_soci_doppia", triggerActionId:3 },
                { field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.prezzo_promo_kgl_soci_doppia)/old.prezzo_promo_kgl_soci_doppia", triggerActionId:2 },
                { field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*new.prezzo_promo_kgl_soci_doppia)/old.prezzo_promo_kgl_soci_doppia", triggerActionId:1},
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.prezzo_promo_kgl_soci_doppia)/old.prezzo_promo_kgl_soci_doppia",triggerActionId:11 },
                { field: "txt_sconto_soci_doppia", valore: null, autocomplete:"(old.txt_sconto_soci_doppia*new.prezzo_promo_kgl_soci_doppia)/old.prezzo_promo_kgl_soci_doppia",triggerActionId:14 }*/
            ],
            campiInddCoinvolti: [{ label: "prezzo_promo_kgl_SOCI_DOPPIA", item: null }],
            labelELementCorreggo: "prezzo_promo_kgl_SOCI_DOPPIA"
        },
        {
            id: 14,
            titolo: "Cambia sconto soci",
            istruzioni: [
                { field: "txt_sconto_soci_doppia", valore: null, primary: true },
                /*{ field: "txt_sconto", valore: null, autocomplete:"(old.txt_sconto*new.txt_sconto_soci_doppia)/old.txt_sconto_soci_doppia", triggerActionId:3 },
                { field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.txt_sconto_soci_doppia)/old.txt_sconto_soci_doppia", triggerActionId:2 },
                { field: "prezzo_promo", valore: null, autocomplete:"(old.prezzo_promo*new.txt_sconto_soci_doppia)/old.txt_sconto_soci_doppia", triggerActionId:1},
                { field: "prezzo_promo_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_soci_doppia*new.txt_sconto_soci_doppia)/old.txt_sconto_soci_doppia",triggerActionId:11 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.txt_sconto_soci_doppia)/old.txt_sconto_soci_doppia",triggerActionId:12 },*/
            ],
            campiInddCoinvolti: [{ label: "txt_sconto_SOCI_DOPPIA", item: null }],
            labelELementCorreggo: "txt_sconto_SOCI_DOPPIA"
        },
        {
            id: 13,
            titolo: "Cambia Punti Jolly",
            istruzioni: [
                { field: "N_Punti", valore: null, primary: true },
                { field: "tema", valore: "JOLLY" }
            ],
            campiInddCoinvolti: [{ label: "txt_punti_jolly", item: null }],
            labelELementCorreggo: "txt_punti_jolly"
        },
        {
            id: 15,
            titolo: "Cambia peso",
            istruzioni: [
                { field: "Descrizioni$Peso", valore: null, primary: true },
                /*{ field: "prezzo_promo_kgl", valore: null, autocomplete:"(old.prezzo_promo_kgl*new.Descrizioni.Peso)/old.Descrizioni.Peso", triggerActionId:2 },
                { field: "prezzo_promo_kgl_soci_doppia", valore: null, autocomplete:"(old.prezzo_promo_kgl_soci_doppia*new.Descrizioni.Peso)/old.Descrizioni.Peso",triggerActionId:12 },*/
            ],
            campiInddCoinvolti: [{ label: "prezzo_promo_kgl", item: null }, { label: "descrizione#alessio", item: null }],
            labelELementCorreggo: "peso"
        }];
        let azNBruciature = {
            id: 16,
            titolo: "Cambia numero bruciature",
            istruzioni: [
                { field: "N_pezzi_soci", valore: null, primary: true },
                { field: "pezzi_soci", valore: "s" },
            ],
            campiInddCoinvolti: [{ label: "descrizione", item: null }],
            labelELementCorreggo: "n_bruciature"
        };

        let azDelBruciature = {
            id: 17,
            titolo: "Rimuovi bruciature",
            istruzioni: [
                { field: "pezzi_soci", valore: "" },
            ]
        };


        //La meccanica BOX_STD può diventare BOX_SuperprezziOF oppure BOX_LINEA oppure BOX_SpendiPunti oppure BOX_doppio_SCONTO
        //Poi
        let codiceBox = itemRef.recordInTracciato.codiceBox;
        let azBoxStd = {
            id: 4,
            titolo: "Cambia meccanica in STD",
            istruzioni: [
                { field: "tema", valore: "" },
                { field: "is_linea", valore: "" },
                { field: "tipo_evento", valore: "" }
            ]
        };
        let azBoxSuperprezzi = {
            id: 5,
            titolo: "Cambia meccanica in SuperprezziOF",
            istruzioni: [
                { field: "tema", valore: "SUPERPREZZI OF" }
            ]
        };
        let azBoxLinea = {
            id: 6,
            titolo: "Forza meccanica LINEA",
            istruzioni: [
                { field: "is_linea", valore: "xForced" }
            ]
        };
        let azBoxSpendiPunti = {
            id: 7,
            titolo: "Cambia meccanica in SpendiPunti",
            istruzioni: [
                { field: "tipo_evento", valore: "FIDELITY" },
                { field: "N_Punti", valore: null },
                { field: "is_linea", valore: "" }
            ]
        };
        let azBoxDoppio = {
            id: 8,
            titolo: "Cambia meccanica in DoppioSconto",
            istruzioni: [
                { field: "tema", valore: "NEW SOCI" }
            ]
        };
        let azBoxLineaRemove = {
            id: 6,
            titolo: "Rimuovi forzatura meccanica LINEA",
            istruzioni: [
                { field: "is_linea", valore: "" }
            ]
        };



        //Quando il valore è null il sistema lo mostra a schermo per farlo settare all'utente
        //Quando il valore è un array significa che il sistema non puo scegliere e mostra l'opzione all'utente


        result.push(azBoxSuperprezzi);
        result.push(azBoxSpendiPunti);
        result.push(azBoxDoppio);
        result.push(azBoxStd);
        result.push(azBoxLinea);

        let azPuntiSprint = {
            id: 9,
            titolo: "Cambia punti sprint",
            istruzioni: [
                { field: "N_BonusCartacei", valore: null }
            ]
        };

        result.push(azPuntiSprint);
        result.push(azNBruciature);
        result.push(azDelBruciature);

        if (codiceBox == "BOX_LINEA") {
            let inxPkgl = result.indexOf(result.find(b => b.id == 2));
            if (inxPkgl >= 0)
                result.splice(inxPkgl, 1);
        }
        else if (codiceBox == "BOX_SPRINT") {
            let inxPkgl = result.indexOf(result.find(b => b.id == 2));
            if (inxPkgl >= 0)
                result.splice(inxPkgl, 1);
        }
        else if (codiceBox == "BOX_JOLLY") {
            let inxPkgl = result.indexOf(result.find(b => b.id == 2));
            if (inxPkgl >= 0)
                result.splice(inxPkgl, 1);
        }

        if (itemRef.recordInTracciato["is_linea"] == "xForced") {
            result.push(azBoxLineaRemove);
        }


        //ON/OFF prezzo_info_pack
        let dbItems = Utility.getAllFieldsInGroup(box);
        if (dbItems.filter(d => d.label.startsWith("prezzo_info_pack")).length > 0) {
            //OFF
            let azOffInfopack = {
                id: 18,
                titolo: "Togli dicitura info pack",
                istruzioni: [
                    { field: "force_infopack", valore: "" }
                ]
            };
            result.push(azOffInfopack);
        }
        else {
            //ON
            let azOnInfopack = {
                id: 19,
                titolo: "Aggiungi dicitura info pack",
                istruzioni: [
                    { field: "force_infopack", valore: null }
                ]
            };

            result.push(azOnInfopack);
        }


        let azCambioMeccanicaJolly = {
            id: 20,
            titolo: "Cambia meccanica in JOLLY",
            istruzioni: [
                { field: "tema", valore: "JOLLY" },
            ]
        };
        result.push(azCambioMeccanicaJolly);

        let azCambioMeccanicaJollEV = {
            id: 21,
            titolo: "Cambia meccanica in JOLLY EVIDENZIATO",
            istruzioni: [
                { field: "tema", valore: "VENDITE PROPOSITIVE" },
            ]
        };
        result.push(azCambioMeccanicaJollEV);

        let azCambioMeccanicaEsclusivaSoci = {
            id: 22,
            titolo: "Cambia meccanica in SOCI ESCLUSIVA",
            istruzioni: [
                { field: "tema", valore: "SOCI ESCLUSIVA" },
            ]
        };
        result.push(azCambioMeccanicaEsclusivaSoci);

        let azCambioMeccanica1piu1 = {
            id: 23,
            titolo: "Cambia meccanica in 1+1",
            istruzioni: [
                { field: "meccanica", valore: "MXN" },
            ]
        };
        result.push(azCambioMeccanica1piu1);


        let azCambioMeccanicaSprint = {
            id: 24,
            titolo: "Cambia meccanica in SPRINT",
            istruzioni: [
                { field: "tema", valore: "SPRINT" },
            ]
        };
        result.push(azCambioMeccanicaSprint);



        return result;
    };

    getMetaAggiuntiviPerEsportazioneCorreggo()
    {
        return ["codice_settore","codice_reparto","codice_categoria","codice_sottocategoria"];
    };

    getColonneTracciatoIntestazione(){
        return this.colonneTracciato;
    };

//#endregion

//#region METODI IMPAGINAZIONE ed ESPORTAZIONE

    bindRefDataCompiled (box, oggetto, pathLavorazione, boxInGrigliaBounds) {
        //Logica dei colori box sconto
        if (oggetto["logo_toscana1"] == "X") {
            let areaLav = ficoProcess.getAreaLavorazioneCorrente();
            if (areaLav.nome == "B" || areaLav.nome == "B1") {
                if (oggetto.codiceBox == "BOX_STD" || oggetto.codiceBox == "BOX_LINEA" || oggetto.codiceBox == "BOX_1+1") {
                    //Cerchiamo il box sconto
                    for (let el = 0; el < box.allPageItems.length; el++) {
                        let elItem = box.allPageItems[el];
                        if (elItem.label == "sconto_base") {
                            elItem.fillColor = "Speciale Toscana";
                            //break;
                        }
                        if (elItem.label == "txt_sconto") {
                            //elItem.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.item("SCONTO_TOSCANA");
                            for (var j = 0; j < elItem.characters.length; j++) {
                                elItem.characters.item(j).strokeColor = "Speciale Toscana";
                            }
                        }
                    }
                }
            }
        }

        if (oggetto["colore_sconto_speciale"] != null) {
            for (let el = 0; el < box.allPageItems.length; el++) {
                let elItem = box.allPageItems[el];
                if (elItem.label == "sconto_base") {
                    try {
                        elItem.fillColor = oggetto["colore_sconto_speciale"];
                    }
                    catch (err) {
                        messaggioUtente(oggetto["colore_sconto_speciale"] + " stile non trovato", "warning");
                    }
                    //break;
                }
                if (elItem.label == "txt_sconto") {
                    try {
                        //elItem.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.item("SCONTO_TOSCANA");
                        for (var j = 0; j < elItem.characters.length; j++) {
                            elItem.characters.item(j).strokeColor = oggetto["colore_sconto_speciale"];
                        }
                    }
                    catch (err) {
                        messaggioUtente(oggetto["colore_sconto_speciale"] + " stile non trovato", "warning");
                    }
                }
            }
        }

        return box;
    };

    formaDescrizioneIndd(descrizioneItem) {
        var currentCharacterStyle = "";
        DescrizioneIndd = "";
        for (var i = 0; i < descrizioneItem.characters.length; i++) {

            if (currentCharacterStyle != descrizioneItem.characters.item(i).appliedCharacterStyle.name) {
                if (currentCharacterStyle != "") {
                    DescrizioneIndd += "</" + currentCharacterStyle + ">";
                }
                currentCharacterStyle = descrizioneItem.characters.item(i).appliedCharacterStyle.name;
                DescrizioneIndd += "<" + currentCharacterStyle + ">";
            }
            DescrizioneIndd += descrizioneItem.characters.item(i).contents;

        }
        if (currentCharacterStyle != "") {
            DescrizioneIndd += "</" + currentCharacterStyle + ">";
        }
        DescrizioneIndd = customAgenzia.replaceAllSpecialCharacters(DescrizioneIndd);
        return DescrizioneIndd;
    };

    replaceAll(str, stringToReplace, replacement){
        var splitted = str.split(stringToReplace);
        str = splitted.join(replacement);
        return str;
    };

    replaceAllSpecialCharacters(str){
        listSpecialCharacters = [ {chiave: "<br>", valore: "\n"}, {chiave: "<BR>", valore: "\n"}, {chiave: "<[Paragrafo base]>", valore: ""}, {chiave: "</[Paragrafo base]>", valore: ""}, {chiave: "DOUBLE_RIGHT_QUOTE", valore: "\""}, {chiave: "DOUBLE_LEFT_QUOTE", valore: "\""}, {chiave: "FORCED_LINE_BREAK", valore: "\n"} , {chiave: "SINGLE_RIGHT_QUOTE", valore: "'"}, {chiave: "SINGLE_LEFT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}, {chiave: "SINGLE_STRAIGHT_QUOTE", valore: "'"}, {chiave: "DOUBLE_STRAIGHT_QUOTE", valore: "\""}   ];

        listSpecialCharacters.forEach(function(specialCharacter){
            str = customAgenzia.replaceAll(str, specialCharacter.chiave, specialCharacter.valore);
        });

        return str;
    };

    componiEsportazioneMateriale(element, elementiGruppo, pageItem, pageGroup, label) {
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
                try {
                    var imgName = item.images.item(0).itemLink.name
                    //cerchiamo nel gruppo l'elemento con "Foto.nome" = imgName e mettiamo il guidid in resObj.foto
                    var el = elementiGruppo.find(f => f.recordInTracciato["Foto.Nome"] == imgName);
                    if (el != null) {
                        resObj.foto.push(el.recordInTracciato["Foto.guidid"]);
                    }
                    else {
                        resObj.errors.push("L'immagine " + imgName + " non è stata trovata negli elementi del gruppo");
                    }
                }
                catch (e) {
                    console.error("ERROR " + item.label);
                    console.error(element);
                    console.error(e);
                }

                continue;
            }

            if (item.label != null && item.label != "") {

                if (item.constructor.name == "TextFrame") {
                    resObj.customData[item.label] = { content: item.contents, contentHtml: "" };//"";//item.contents;
                    let _html = "";

                    let lastStyle = "";


                    for (let c = 0; c < item.characters.length; c++) {
                        let ch = item.characters.item(c);
                        if (ch.appliedCharacterStyle != null) {

                            let nomeStyle = ch.appliedCharacterStyle.name;

                            if (nomeStyle != lastStyle) {
                                if (lastStyle != "") {
                                    _html += "</" + lastStyle + ">";
                                }


                                _html += "<" + nomeStyle + ">";


                                lastStyle = nomeStyle;
                            }
                        }
                        else {
                            //Carattere non valido!
                        }

                        _html += ch.contents;
                    }

                    if (lastStyle != "") {
                        _html += "</" + lastStyle + ">";
                    }

                    resObj.customData[item.label].contentHtml = _html;

                }
                else if (item.constructor.name == "Rectangle") {
                    if (item.images.length > 0) {
                        var imgName = item.images.item(0).itemLink.name
                        resObj.errors.push("Foto extra non ancora implementate. Nome " + imgName);
                        // var el = element.recordInTracciato["Foto.Extra"].find(f=>f.n == imgName);
                    }
                }

                continue;
            }
        }

        resObj.customData.settore = element.recordInTracciato.descrizione_settore
        resObj.customData["descrizione_reparto"] = element.recordInTracciato["descrizione_reparto"];
        resObj.codice = element.recordInTracciato["Referenza.Codice"];
        resObj.codice_gruppo = element.recordInTracciato["Scatto.CodiceGruppo"];

        resObj.codiceBox = label.split("$")[1];

        //controlliamo l'appledMaster della pagina di indesign
        var appliedMaster = pageItem.appliedMaster;
        if (appliedMaster != null) {
            resObj.mastro = appliedMaster.name;
        }

        return resObj;
    };

    setLavorazione() {
        var filePath = pathLavorazione + "/lavorazioni.json";
        let lavorazioni = readFile(filePath);
        //lavorazione è una lista di oggetti noi dobbiamo trovare qullo con la chiave file = al nome del file aperto di indesign
        var lavorazione = lavorazioni.find(lavorazione => lavorazione.file == app.activeDocument.name);
        if (lavorazione == null) {
            console.error("Lavorazione non trovata");
            return;
        }
        //lavorazione.details è un oggetto che contiene le informazioni della lavorazione, li cerchiamo

        var guidArea = lavorazione.details.guidArea;

        var areaObj = getSourceAree().find(f => f.guidID == guidArea);
        if (areaObj == null) {
            console.error("Area non trovata");
            return;
        }

        this.area = areaObj.sigla;

        var guidCanale = lavorazione.details.guidCanale;
        var canaleObj = getSourceCanali().find(f => f.guidID == guidCanale);
        if (canaleObj == null) {
            console.error("Canale non trovato");
            return;
        }

        this.canale = canaleObj.sigla;

        var guidFormato = lavorazione.details.guidFormato;
        var formatoObj = getSourceFormati().find(f => f.guidID == guidFormato);
        if (formatoObj == null) {
            console.error("Canale non trovato");
            return;
        }

        this.codiceFormato = formatoObj.codice;
        this.tipoLavorazione = formatoObj.tipo;

    };  

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
    };

    cercaChiaveValore(key, value, array){
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] != undefined && array[i][key] == value) {
                return true;
            }
        }
        return false;
    };

    cercaChiaveContesto(key, array){
        for (var i = 0; i < array.length; i++) {
            //controlliamo se l'oggetto  allo spazio i ha la chiave cercata
            if (array[i].nome_field != undefined && array[i].nome_field == key) {
                return array[i].user_value;
            }
        }
        return null;
    };  
    
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
    };

    getOverflowsInstruction(field) {
        let overflowInstruction = customAgenzia.campiSoggettiAOverflow.find(c => c.label == field.label);
        let result = null;

        if (overflowInstruction != null) {
            gbBKP = field.geometricBounds;
            result = [0, 0, 0, 0];
            //Creo lo spazio per overflow
            if (overflowInstruction.w == "left") {
                result[1] = -1;
            }
            else if (overflowInstruction.w == "right") {
                result[3] = 1;
            }

            if (overflowInstruction.h == "top") {
                result[0] = -2.15;
            }
            else if (overflowInstruction.h == "bottom") {
                result[2] = 2.15;
            }
        }
        return result;
    };

//#endregion

}

const customAgenzia = new Agenzia();
module.exports = customAgenzia;