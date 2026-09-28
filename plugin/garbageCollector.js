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
/// Difetti noti, descritti nel task dedicato e non corretti qui: inProcess non viene mai messo
/// a true, ContentType e' usato senza require e l'errore finisce in un catch vuoto, $.writeln
/// e' un residuo di ExtendScript, e il callback di startInterval si perde quando Add riavvia
/// il timer.
class GarbageCollector {
    constructor() {
        this.elements = [];
        this.processingElements = [];
        this.interval = null;
        this.waitingKeys = [];
        this.startInterval();
    }

    /// Avvia il timer che svuota la coda, se non e' gia' in moto. Il callback, se passato,
    /// viene chiamato quando la coda si svuota - ma solo per questo avvio: vedi i difetti noti.
    startInterval(callback){
        let me = this;
        if(this.interval != null) {
            return;
        }
        var inProcess = false;
        this.interval = setInterval(() => {
            if (me.elements.length > 0) {
                if(inProcess){
                    return;
                }
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

                            try{
                                if(parentNode && parentNode.constructorName == "Rectangle" && parentNode.isValid){
                                    parentNode.contentType = ContentType.UNASSIGNED;
                                }
                            }
                            catch(e2){
                            }
                            //se parent è definito e valido impostiamo il suo content Type a ContentType.UNASSIGNED;

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
                inProcess = false;
            }
            else{
                me.stop();
                if(callback && typeof callback === "function") {
                    callback();
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
            $.writeln("L'elemento aggiunto non ha un metodo remove");
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