//Famila
//Nato come copia di plugin/Agenzie/Coopfi/custom.js (era: //Coop.fi) il 15/09/2026.
//Da rivedere: i valori qui dentro sono ancora quelli di Coop.fi.
const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions } = require('indesign');
const MAIN_fixFoto = require('./fotoFix');
const { FotoPlacer, Utility } = require('./utility');
const GarbageCollector = require('./garbageCollector');
const ficoProcess = require('./ficoProcess');
const CssFramework = require('./CssFramework');

const customAgenzia={
    usaSottogruppi: false,
    fixFotoLavorazioni: [1,2], 
    callCustom: false,
    calcoloDistanziamentoFoto: [ //il ratio è calcolato Y/X
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
    ],
    ignoreElementsFixFoto:["sconto","txt_sconto","sconto_base","sfondo"],
    customPadding: [
    ], 

    area: null,
    canale: null,
    codiceFormato: null,

    bindRefDataCompiled: function(box, oggetto, pathLavorazione, boxInGrigliaBounds) {

        return box;
    },

    impaginazioneFotoExtraCustom(imgName, tipo, box, pathLavorazione, objItem, sigla){
        return null;
    },

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


    getMetaAggiuntiviPerEsportazioneCorreggo()
    {
        return ["codice_settore","codice_reparto","codice_categoria","codice_sottocategoria"];
    },
    
};

module.exports = customAgenzia;
