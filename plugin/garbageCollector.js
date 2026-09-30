/// I20-1002: rimuove elementi InDesign in differita invece che subito.
///
/// Chi vuole cancellare un elemento lo accoda con Add; un timer ogni 100 ms svuota la coda a
/// ondate e si ferma da solo quando non resta niente. Le chiavi servono a trattenere la
/// rimozione: chi sta per fare un'operazione lunga ne chiede una, la passa agli elementi che
/// accoda, e finche' non la attiva quegli elementi tornano in coda invece di sparire.
///
/// indexNew.js ne crea una sola istanza, gC, e la espone con addToGarbageCollector,
/// requireKeyForGarbage e activateKeyForGarbage.
///
/// I20-1006: i quattro difetti annotati in I20-1002, verificati a runtime il 30/09/2026.
///  - ContentType senza require NON era un difetto: indexNew.js e' uno script classico e le sue
///    costanti di primo livello, ContentType compresa, sono visibili a tutti i moduli (come
///    customAgenzia per CssFramework). Il riquadro rimasto vuoto torna davvero UNASSIGNED.
///  - $.writeln era un difetto vero: $ e' jQuery, writeln non esiste, e Add avrebbe lanciato un
///    errore nel chiamante invece di avvisare. Ora e' console.warn.
///  - La guardia inProcess non serviva: il corpo del timer e' sincrono, e un tick di setInterval
///    non parte mentre il precedente e' in corso. E' stata tolta.
///  - Il callback di startInterval ora si ricorda anche quando Add riavvia il timer.
class GarbageCollector {
    constructor() {
        this.elements = [];
        this.processingElements = [];
        this.interval = null;
        this.waitingKeys = [];
        //Chiamato ogni volta che la coda si svuota e il timer si ferma. Resta impostato anche
        //quando Add riavvia il timer, che il callback non lo passa.
        this.callbackCodaVuota = null;
        this.startInterval();
    }

    /// Avvia il timer che svuota la coda, se non e' gia' in moto. Il callback, se passato,
    /// viene chiamato ogni volta che la coda si svuota, anche dopo i riavvii fatti da Add.
    startInterval(callback){
        let me = this;
        if(callback && typeof callback === "function") {
            this.callbackCodaVuota = callback;
        }
        if(this.interval != null) {
            return;
        }
        this.interval = setInterval(() => {
            if (me.elements.length > 0) {
                me.processingElements = me.elements.slice();
                me.elements = [];

                for (let i = me.processingElements.length - 1; i >= 0; i--) {
                    try {
                        if(me.processingElements[i].element.isValid && (me.processingElements[i].key == null || !me.waitingKeys.includes(me.processingElements[i].key))){
                            //recuperiamo il genitore prima di rimuovere l'elemento
                            var parentNode = me.processingElements[i].element.parent;
                            while (parentNode && parentNode.isValid && parentNode.constructorName === "Group") {
                                parentNode = parentNode.parent;
                                if (parentNode && parentNode.constructorName === "Spread") {
                                    parentNode = null;
                                    break;
                                }
                            }

                            me.processingElements[i].element.remove();

                            //Il riquadro che conteneva l'elemento torna senza contenuto.
                            //ContentType arriva da indexNew.js (vedi l'intestazione): se un giorno
                            //non ci fosse piu', qui lo si vedrebbe invece di passare in silenzio.
                            try{
                                if(parentNode && parentNode.constructorName == "Rectangle" && parentNode.isValid){
                                    parentNode.contentType = ContentType.UNASSIGNED;
                                }
                            }
                            catch(e2){
                                console.warn("Garbage collector: riquadro non azzerato dopo la rimozione: " + (e2 && e2.message ? e2.message : e2));
                            }

                        }
                        else if(!me.processingElements[i].element.isValid){
                            //l'elemento non è più valido, non facciamo nulla
                        }
                        else{
                            me.elements.push(me.processingElements[i]);
                        }
                    } catch (e) {
                        console.error("Errore nel rimuovere l'elemento: " + e.message);
                    }
                }

                me.processingElements = [];
            }
            else{
                me.stop();
                if(me.callbackCodaVuota && typeof me.callbackCodaVuota === "function") {
                    me.callbackCodaVuota();
                }
            }
        }, 100);
    }

    /// Accoda un elemento da rimuovere, con la chiave che ne trattiene la rimozione.
    /// Se il timer era fermo lo riavvia.
    Add(element, key = null) {
        if (element && typeof element.remove === "function") {
            var obj ={
                key: key,
                element: element
            }
            this.elements.push(obj);
        } else {
            //I20-1006: era $.writeln, che in UXP non esiste e faceva saltare il chiamante.
            console.warn("Garbage collector: l'elemento aggiunto non ha un metodo remove");
        }

        if(this.interval == null){
            this.startInterval();
        }
    }

    /// Una chiave nuova, che da questo momento trattiene gli elementi che la portano.
    generateKey(){
        //generiamo una chiave casuale di 10 carattri alfanumerici che non sono già presenti in waitingKeys
        let key = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        do {
            //I20-1006: si riparte da capo a ogni tentativo, altrimenti una collisione allungava la chiave.
            key = "";
            for (let i = 0; i < 10; i++)
                key += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        while(this.waitingKeys.includes(key));

        this.waitingKeys.push(key);
        return key;
    }

    /// Toglie la chiave dalle attive: da ora gli elementi che la portano possono essere rimossi.
    activateKey(key){
        let index = this.waitingKeys.indexOf(key);
        if(index != -1){
            this.waitingKeys.splice(index, 1);
        }
    }

    /// Ferma il timer. Non svuota la coda: quello che resta accodato verra' rimosso al
    /// prossimo Add, che fa ripartire il timer.
    stop() {
        clearInterval(this.interval);
        this.interval = null;
    }
}

module.exports = GarbageCollector;