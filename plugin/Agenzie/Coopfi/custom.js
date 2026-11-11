//Coop.fi
const fs = require('fs');
const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, CornerOptions } = require('indesign');
const { FotoPlacer, Utility } = require('../../utility');
const GarbageCollector = require('../../garbageCollector');
const ficoProcess = require('../../ficoProcess');
const CssFramework = require('../../CssFramework');

const customAgenzia={
    callCustom: false,
    //TASK-9bf94d47: i dati del fix foto (lavorazioni, distanziamento, elementi ignorati) stanno
    //nella sezione fixFoto del SourceFrameworkCss del cliente: CssFramework.getConfigurazioneFixFoto.

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
        //I20-1061: la voce di questa macchina (copiata qui se era solo nel file di un'altra)
        var voceDiQuestaMacchina = Utility.voceLavorazione(pathLavorazione, idMacchina(), app.activeDocument.name, libroDelDocumentoInLavorazione(app.activeDocument.name));
        let lavorazioni = voceDiQuestaMacchina != null ? [voceDiQuestaMacchina] : [];
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
