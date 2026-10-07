/// I20-1009: la sistemazione delle foto nel box, la parte che parla con InDesign.
///
/// Due passi, sempre in coppia: getSpazioImpaginazione(box) trova dove c'e' posto - gli
/// ostacoli, i rettangoli liberi - e fixFoto(box, candidate, obstacles) ci fa stare le foto
/// senza che si sovrappongano, scegliendo lo spazio con sceltaSpazio.
///
/// Il concetto sta in questa cartella, in tre file:
///   sistemazioneFoto.js  questo: legge e scrive il documento, quindi sotto Node non si carica
///   spazioLibero.js      il calcolo dei rettangoli liberi, puro e verificato dai test
///   sceltaSpazio.js      quale rettangolo vince, puro e verificato dai test
///
/// Prima stava dentro CssFramework.js, mescolato a ridimensionamenti, allineamenti e
/// segnalazioni conflitti. CssFramework tiene ancora getSpazioImpaginazione, fixFoto e
/// safeFitToContent come rimandi a questo modulo, perche' le agenzie li chiamano da li'.
///
/// Da CssFramework prende cinque cose che restano sue: makeRegexFromGroupName, i due
/// lettori della configurazione del box (getSceltaSpazioFoto, getEstensioniFoto), il
/// controllo delle segnalazioni conflitti e il suo interruttore. Le chiede al momento della
/// chiamata, con cssFramework(): CssFramework carica questo modulo in testa, e un require
/// reciproco a quel punto troverebbe CssFramework ancora vuoto.
///
/// Usa come globali Utility, messaggioUtente, addSegnalazione, customAgenzia e
/// pluginMiddleware, come il resto del Plugin.

const { FitOptions, ClippingPathType } = require('indesign');
const spazioLibero = require('./spazioLibero');
const sceltaSpazio = require('./sceltaSpazio');
const etichettaSegnalazioni = require('../segnalazioni/etichetta');

/// CssFramework, chiesto quando serve: vedi l'intestazione.
function cssFramework() {
    return require('../CssFramework');
}

const SistemazioneFoto = {

    //sono i valori sulla x e sulla y in percentuale (0-1) di cui deve essere distanziato dall'immagine prima
    /// Per ogni numero di foto, le percentuali di distanziamento fra una e l'altra, scelte in
    /// base al rapporto altezza/larghezza. Il cliente la sovrascrive da custom.js.
    calcoloDistanziamentoFoto: [ //il ratio è calcolato Y/X
        {
            foto: 0,
            percDistFoto: [{
                percDistanceXFoto: [],
                percDistanceYFoto: [],
                startRangeRatioCondition: 0.0,
                endRangeRatioCondition: Infinity,
            }],
        },
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
                endRangeRatioCondition: 1.1,
            },
            {
                percDistanceXFoto: [0.3, -0.3],
                percDistanceYFoto: [-0.3, -0.3],
                startRangeRatioCondition: 1.1,
                endRangeRatioCondition: Infinity,
            }
            ],
        }
    ],

    /// La porta d'ingresso del gruppo: quali porzioni del box sono libere per le foto.
    /// Mette in fila i tre passi - ostacoli, candidati grossolani, raffinamento - e torna
    /// { candidate, obstacles }. Chi chiama passa poi tutti e due a fixFoto.
    ///
    /// Lo spazio si cerca dentro la base del box: senza base non c'e' niente da calcolare.
    /// I20-1010: allora si avvisa (CSF-19) e si torna uno spazio vuoto, con cui fixFoto non
    /// sposta nessuna foto: si ferma quel box, non l'operazione. La base si cerca per prima,
    /// cosi' senza base nessun testo prende il fit. Prima si rompeva con un TypeError, dopo
    /// aver gia' fatto il fit ai testi del box.
    ///
    /// Se qualcosa va storto dopo getObstacles, gli ostacoli tornano alle misure di prima
    /// del fit e l'errore prosegue: fixFoto, che li ripristina, non ci arriverebbe.
    getSpazioImpaginazione(box) {
        var base = this.trovaBase(box);
        if (base == null) {
            this.segnalaBaseMancante(box);
            return {candidate: [], obstacles: []};
        }

        let obs = this.getObstacles(box);
        try {
            return this.calcolaSpazioLibero(box, base, obs);
        }
        catch (e) {
            this.ripristinaOstacoli(obs);
            throw e;
        }
    },

    /// Il resto di getSpazioImpaginazione, una volta che base e ostacoli ci sono: candidati
    /// grossolani e raffinamento.
    ///
    /// I20-1058: lo spazio si cerca dentro la traccia della base, non sui suoi bordi geometrici:
    /// con una traccia al centro meta' dello spessore cadeva nello spazio libero, e la foto finiva
    /// sul bordo. Il calcolo si fa nel rettangolo interno alla traccia - ostacoli spostati, misure
    /// ridotte - e i candidati tornano poi nelle coordinate della base. Il paddingBox del cliente
    /// vale cosi' dal bordo interno della traccia. Senza traccia lo spostamento e' zero e non
    /// cambia niente. Gli ostacoli restituiti restano quelli ricevuti: fixFoto li ripristina.
    calcolaSpazioLibero(box, base, obs) {
        let traccia = cssFramework().insetTracciaBase(base);
        let baseWidth = base.geometricBounds[3] - base.geometricBounds[1] - 2 * traccia;
        let baseHeight = base.geometricBounds[2] - base.geometricBounds[0] - 2 * traccia;
        let ostacoliInterni = obs.map(o => Object.assign({}, o, { x: o.x - traccia, y: o.y - traccia }));

        //calcoliamo i rettangoli liberi
        //Il margine attorno agli ostacoli e' del cliente: se custom.js non lo dice vale il
        //default di spazioLibero.
        let paddingBox = customAgenzia && customAgenzia.paddingBox ? customAgenzia.paddingBox : null;
        let candidate = spazioLibero.generateCandidateRects(baseWidth, baseHeight, ostacoliInterni, 0, paddingBox);

        //refiniamo i rettangoli liberi
        //I20-1011: l'esito dice come e' andato il raffinamento. La riga in console serve a
        //misurare sui volantini veri quanto costa: il numero di rettangoli, e con lui il
        //tempo, cresce in fretta con gli ostacoli.
        let esito = {};
        let inizioRaffinamento = Date.now();
        let refinedRects = spazioLibero.refineRects(ostacoliInterni, candidate, baseWidth, baseHeight, 0, esito)
            .map(r => Object.assign({}, r, { x: r.x + traccia, y: r.y + traccia }));
        let codiceGruppo = this.codiceGruppoDelBox(box);
        console.log("refineRects " + codiceGruppo + ": " + esito.ostacoli + " ostacoli, " + esito.iterazioni + " iterazioni, " +
            esito.rettangoli + " rettangoli, " + (Date.now() - inizioRaffinamento) + " ms");

        if (esito.interrotto) {
            //Non dovrebbe succedere mai: vedi refineRects. Se succede, lo spazio per le foto e'
            //calcolato a meta' e l'operatore deve saperlo prima di guardare l'impaginato.
            console.warn("refineRects " + codiceGruppo + ": interrotto dalla guardia dopo " + esito.iterazioni +
                " iterazioni, con " + esito.rettangoli + " rettangoli e " + esito.ostacoli + " ostacoli");
            messaggioUtente("Code CSF-18: Nel box con codice gruppo " + codiceGruppo + " lo spazio per le foto non e' stato calcolato fino in fondo: " +
                "controllare la posizione delle foto.", "warning");
        }

        return {candidate: refinedRects, obstacles: obs};

    },

    /// La base del box: il primo elemento la cui label comincia per "base". E' lo spazio
    /// dentro cui si cerca lo spazio per le foto. Null se non c'e'.
    trovaBase(box) {
        for (var i = 0; i < box.allPageItems.length; i++) {
            var el = box.allPageItems[i];
            if (Utility.parseLabel(el.label).startsWith("base")) {
                return el;
            }
        }
        return null;
    },

    /// I20-1010: la base manca. Lo si dice all'operatore e nelle segnalazioni, con il box e
    /// il suo codice gruppo, perche' la causa si possa trovare: un box malformato, una base
    /// rinominata, un livello cancellato.
    segnalaBaseMancante(box) {
        var nomeBox = "";
        try {
            nomeBox = Utility.parseLabel(box.label);
        }
        catch (e) {
            nomeBox = "senza etichetta";
        }
        var testo = "Code CSF-19: Nel box " + nomeBox + " con codice gruppo " + this.codiceGruppoDelBox(box) +
            " manca la base: lo spazio per le foto non si può calcolare e le foto non vengono sistemate.";
        console.warn(testo);
        messaggioUtente(testo, "warning");
        addSegnalazione(testo, "warning", 2, false);
    },

    /// Il codice gruppo del box, per i messaggi. "sconosciuto" se il DNA non lo dice o non si
    /// legge: e' solo un'etichetta, non deve poter fermare il calcolo.
    codiceGruppoDelBox(box) {
        try {
            let dna = Utility.getDnaOfBox(box);
            return dna != null && dna.codice_gruppo != null ? dna.codice_gruppo : "sconosciuto";
        }
        catch (e) {
            return "sconosciuto";
        }
    },

    /// Rimette i frame alle misure che avevano prima del fit: [{ object, originalBounds }].
    /// Un frame che non si lascia rimettere non ferma gli altri.
    ripristinaFit(fitApplicati) {
        for (let i = 0; i < fitApplicati.length; i++) {
            let f = fitApplicati[i];
            try {
                f.object.geometricBounds = [f.originalBounds[0], f.originalBounds[1], f.originalBounds[2], f.originalBounds[3]];
            }
            catch (e) {
                console.error("Ripristino delle misure non riuscito:", e);
            }
        }
    },

    /// Gli ostacoli tornano alle misure che avevano prima di getObstacles. I gruppi si saltano:
    /// non prendono il fit. Rimettere due volte le stesse misure non fa danni, per questo
    /// fixFoto puo' chiamarla sia prima dei controlli sia in chiusura.
    ripristinaOstacoli(obstacles) {
        if (obstacles == null) {
            return;
        }
        this.ripristinaFit(obstacles.filter(obs => obs.constructor == null || obs.constructor.toLowerCase() != "group"));
    },

    /// Quali elementi del box sono ostacoli per le foto, in coordinate relative alla base.
    /// Non lo sono le foto stesse, le loro etichette e gli sfondi: le foto vengono collocate
    /// tutte insieme dal fixFoto, e lo sfondo sta dietro a tutto.
    /// I20-1059: non lo e' nemmeno il bollino delle segnalazioni, che il Plugin disegna sopra il
    /// box: in alto a sinistra toglieva 10 mm allo spazio delle foto, e il fix foto lanciato da
    /// solo, dopo l'impaginazione, le lasciava piccole anche dopo aver fatto posto.
    /// Il cliente puo' intervenire da custom.js con ignoreElementsFixFoto per aggiungerne,
    /// exceptionElementsToIgnoreFixFoto per fare eccezioni, customPadding per dare a un elemento
    /// un margine suo.
    ///
    /// I testi prendono il fit (safeFitToContent), cosi' l'ostacolo e' il testo e non il suo
    /// riquadro. I20-1010: ogni fit viene ricordato con le misure di prima, legato all'id
    /// dell'elemento. Chi ha preso il fit ma non diventa ostacolo - senza label, o di misura
    /// nulla - torna subito com'era; gli ostacoli li rimette fixFoto. Se qui dentro qualcosa
    /// va storto, torna tutto com'era e l'errore prosegue.
    /// Senza base: CSF-19 e nessun ostacolo, senza toccare niente.
    getObstacles(box) {
        var base = this.trovaBase(box);
        if (base == null) {
            this.segnalaBaseMancante(box);
            return [];
        }

        //scorriamo tutti gli elementi tranne quelli elencati nella variabile ignoreElements
        let ignoreElements = ["base*", "immagine*", "foto_secondaria*", "etichetta*", "foto_extra*", "sfondo*"];
        let exception = [];
        if (customAgenzia && customAgenzia.exceptionElementsToIgnoreFixFoto) {
            exception = customAgenzia.exceptionElementsToIgnoreFixFoto;
        }
        if (customAgenzia && customAgenzia.ignoreElementsFixFoto) {
            ignoreElements = ignoreElements.concat(customAgenzia.ignoreElementsFixFoto);
        }
        let customPadding = []; //[{label: "string", padding: [top, left, bottom, right]}]
        if(customAgenzia && customAgenzia.customPadding) {
            customPadding = customAgenzia.customPadding;
        }
        let obstacles = [];


        //scorriamo tutti gli elementi del box
        let listObjFitted = [];
        let fitApplicati = [];
        try {
            for (let i = 0; i < box.allPageItems.length; i++) {
                const item = box.allPageItems[i];
                if (etichettaSegnalazioni.eDiSegnalazioni(item.label)) {
                    continue;
                }
                //controlliamo se l'elemento è valido e non è uno degli elementi da ignorare (se la label inizia con uno degli ignoreElements)
                //se però è presente in exception non lo ignoriamo
                if (
                    !ignoreElements.some(ignore => item.label && cssFramework().makeRegexFromGroupName(ignore).test(Utility.parseLabel(item.label))) ||
                    exception.some(exc => item.label && cssFramework().makeRegexFromGroupName(exc).test(Utility.parseLabel(item.label)))
                ){
                    var obj = {
                        id: item.id,
                        originalBounds: item.geometricBounds,
                        originalWidth: item.geometricBounds[3] - item.geometricBounds[1],
                        originalHeight: item.geometricBounds[2] - item.geometricBounds[0],
                        label: Utility.parseLabel(item.label),
                    }

                    //controlliamo se è un textFrame
                    if (item.constructorName === "TextFrame") {
                        //applichiamo il fit al contenuto, ricordando com'era prima
                        fitApplicati.push({ object: item, originalBounds: obj.originalBounds });
                        this.safeFitToContent(item);
                    }

                    listObjFitted.push(obj);
                }

            }
        
            for (let i = 0; i < box.allPageItems.length; i++) {
                const item = box.allPageItems[i];
                if (etichettaSegnalazioni.eDiSegnalazioni(item.label)) {
                    continue;
                }
                //controlliamo se l'elemento è valido e non è uno degli elementi da ignorare (se la label inizia con uno degli ignoreElements)
                if (item.isValid && item.label != "" && (!ignoreElements.some(ignore => item.label && cssFramework().makeRegexFromGroupName(ignore).test(Utility.parseLabel(item.label))) || exception.some(exc => item.label && cssFramework().makeRegexFromGroupName(exc).test(Utility.parseLabel(item.label))))) {
                    //aggiungiamo l'elemento come ostacolo
                    //controlliamo se l'elemento ha un padding personalizzato
                    let padding = [0, 0, 0, 0]; // [top, left, bottom, right]
                    if (customPadding.length > 0) {
                        let customPad = customPadding.find(p => item.label && cssFramework().makeRegexFromGroupName(p.label).test(Utility.parseLabel(item.label)));
                        if (customPad) {
                            padding = customPad.padding;
                        }
                    }

                    //I20-1010: per id, non per label. Con due elementi della stessa label il secondo
                    //prendeva le misure del primo, e al ripristino gli finiva sopra.
                    var obj = listObjFitted.find(o => o.id == item.id);

                    //controlliamo se è un textFrame
                    if (item.constructorName === "TextFrame") {
                        //applichiamo il fit al contenuto
                        this.safeFitToContent(item);
                    }

                    obj = {
                        x: (item.geometricBounds[1] > base.geometricBounds[1] ? item.geometricBounds[1] : base.geometricBounds[1]) - base.geometricBounds[1] - padding[1],
                        y: (item.geometricBounds[0] > base.geometricBounds[0] ? item.geometricBounds[0] : base.geometricBounds[0]) - base.geometricBounds[0] - padding[0],
                        width: (item.geometricBounds[3] - item.geometricBounds[1] <= base.geometricBounds[3] - base.geometricBounds[1] ? item.geometricBounds[3] - item.geometricBounds[1] : box.geometricBounds[3] - box.geometricBounds[1]) + padding[1] + padding[3],
                        height: (item.geometricBounds[2] - item.geometricBounds[0] <= base.geometricBounds[2] - base.geometricBounds[0] ? item.geometricBounds[2] - item.geometricBounds[0] : box.geometricBounds[2] - box.geometricBounds[0]) + padding[0] + padding[2],
                        label: Utility.parseLabel(item.label),
                        constructor: item.constructorName,
                        object: item,
                        originalBounds: obj.originalBounds,
                        originalWidth: obj.originalWidth,
                        originalHeight: obj.originalHeight,
                    }

                    //Se width e height sono positivi, aggiungiamo l'ostacolo
                    if (obj.width > 0 && obj.height > 0) {
                        obstacles.push(obj);
                    }
                }
            }
        }
        catch (e) {
            this.ripristinaFit(fitApplicati);
            throw e;
        }

        //Chi ha preso il fit ma non e' un ostacolo non lo rimettera' nessuno: lo si fa adesso.
        let idOstacoli = obstacles.map(o => o.object.id);
        this.ripristinaFit(fitApplicati.filter(f => !idOstacoli.includes(f.object.id)));

        return obstacles;
    },

    /// Fit di un TextFrame al contenuto, conservando la posizione del testo.
    /// InDesign, con FRAME_TO_CONTENT, sposta anche il testo: qui si misura la baseline prima e
    /// dopo e si rimette il frame dov'era, altrimenti ogni fit farebbe salire il testo.
    /// Sui frame di piu' righe stringe anche in orizzontale sulla larghezza vera del testo, riga
    /// per riga, tenendo conto di inset, indent e scala orizzontale, con un 3% di margine.
    /// Se il frame e' in overflow non tocca niente e lo segnala (CSF-001): un fit su un testo che
    /// non ci sta gia' peggiorerebbe le cose. CSF-000 se non si risale al box.
    safeFitToContent(textFrame) {
        if (!textFrame || !textFrame.lines || textFrame.lines.length === 0 || textFrame.rotationAngle != 0) return;
    
        // 1. Salva il punto iniziale della baseline della prima linea
        if(textFrame.overflows){
            //risaliamo al box che contiene il textframe
            let currentElement = textFrame;
            while (currentElement.parent != null && currentElement.parent.constructorName != "Spread") {
                currentElement = currentElement.parent;
            }

            var box = Utility.getBoxFromElementOfBox(currentElement);
            if (box == null) {
                messaggioUtente("Code CSF-000: Impossibile risalire al box padre dell'elemento " + textFrame.label, "error");
                return;
            }
            //abbiamo trovato il box, cerchiamo la base
            var dna = Utility.getDnaOfBox(currentElement);

            var codiceGruppo = dna.codice_gruppo != null ? dna.codice_gruppo : "sconosciuto";
            messaggioUtente("Code CSF-001: Nel box con codice gruppo " + codiceGruppo + ", il TextFrame " + Utility.parseLabel(textFrame.label) + " è in overflow, impossibile fare il fit", "error");
            return;
        }
        //I20-1010: fit, spostamento e restringimento sono tre passi. Se uno va storto il frame
        //non deve restare a meta': torna com'era e l'errore prosegue.
        var boundsIniziali = textFrame.geometricBounds;
        try {
            var originalBaseline = textFrame.lines.item(0).baseline;
            
            // 3. Fit
            textFrame.fit(FitOptions.FRAME_TO_CONTENT);
    
            // 4. Nuova baseline
            var newBaseline = textFrame.lines.item(0).baseline;
    
            // 5. Calcola la differenza e sposta verticalmente
            var deltaY = originalBaseline - newBaseline;
    
            // 6. Applica lo spostamento
            textFrame.move(undefined, [0, deltaY]);

            if (textFrame.lines.length > 1) {

                var left = Infinity;
                var right = -Infinity;

                for (var i = 0; i < textFrame.lines.length; i++) {
                    var line = textFrame.lines.item(i);
                    var start = line.horizontalOffset;
                    //var start = line.insertionPoints.item(0).horizontalOffset;
                    var end = line.endHorizontalOffset;
                    //var end = line.insertionPoints.item(-1).endHorizontalOffset;

                    if (start < left) left = start;
                    if (end > right) right = end;
                }

                var prefs = textFrame.textFramePreferences;

                var insetLeft = prefs.insetSpacing[1];
                var insetRight = prefs.insetSpacing[3];
                var absoluteHorizontalScale = textFrame.absoluteHorizontalScale / 100;
            

                //controlliamo anche i left e rightindent del paragrafo 0

                var leftIndent = 0;
                var rightIndent = 0;
                if (textFrame.paragraphs.length > 0) {
                    var firstPara = textFrame.paragraphs.item(0);
                    if (firstPara.leftIndent != null) {
                        leftIndent = firstPara.leftIndent;
                    }
                    if (firstPara.rightIndent != null) {
                        rightIndent = firstPara.rightIndent;
                    }
                }

                if (insetLeft == null || insetRight == null) {
                    //per qualche motivo l'insetSpacing può essere o un array di 4 unità o un singolo valore int, questo è un fallback nel caso non fosse un array
                    insetLeft = prefs.insetSpacing;
                    insetRight = prefs.insetSpacing;
                }

                //Aumentiamolo del 3% per starci largo
                absoluteHorizontalScale += (absoluteHorizontalScale*0.03);

                insetLeft = insetLeft * absoluteHorizontalScale;
                insetRight = insetRight * absoluteHorizontalScale;
                leftIndent = leftIndent * absoluteHorizontalScale;
                rightIndent = rightIndent * absoluteHorizontalScale;

                textFrame.geometricBounds = [textFrame.geometricBounds[0], left - insetLeft - leftIndent, textFrame.geometricBounds[2], right + insetRight + rightIndent];
            }
        }
        catch (e) {
            this.ripristinaFit([{ object: textFrame, originalBounds: boundsIniziali }]);
            throw e;
        }
    },

    /// Fa stare le foto nello spazio trovato, senza che si sovrappongano.
    /// Riceve i candidati di getSpazioImpaginazione, dispone le foto in gruppo, sceglie il
    /// candidato con sceltaSpazio, ridimensiona il gruppo perche' ci stia e lo applica.
    /// Con projection = true calcola soltanto l'area occupata SENZA toccare il documento:
    /// serve a sapere quanto spazio servirebbe, prima di decidere.
    /// Si ferma senza fare nulla se non c'e' una configurazione di distanziamento per quel
    /// numero di foto (CSF-12) o se nessun candidato puo' ospitare il gruppo.
    /// In coda ripristina la dimensione originale degli ostacoli, che getObstacles aveva
    /// alterato col fit, e fa scattare il controllo delle segnalazioni conflitti.
    /// I20-1010: il ripristino avviene sempre, prima del controllo dei conflitti - che deve
    /// vedere i testi alle loro misure vere - anche nelle uscite anticipate, e comunque in
    /// chiusura, anche se qualcosa va storto. Prima le uscite senza foto e CSF-12 lasciavano i
    /// testi ristretti dal fit.
    fixFoto(box, candidateRects, obstacles, projection = false) {
        try {
            return this.eseguiFixFoto(box, candidateRects, obstacles, projection);
        }
        finally {
            this.ripristinaOstacoli(obstacles);
        }
    },

    /// I20-1025: prova fixFoto senza toccare il documento e restituisce { area, distanzaDalCentro },
    /// o null se le foto non trovano posto. fixFoto in prova restituisce solo l'area, e senza
    /// posto undefined: chi confrontava due prove con Math.floor otteneva NaN e sceglieva sempre
    /// la seconda.
    proiezioneFixFoto(box, candidateRects, obstacles) {
        this.ultimaProiezione = null;
        this.fixFoto(box, candidateRects, obstacles, true);
        return this.ultimaProiezione;
    },

    /// I20-1025: fra due prove di proiezioneFixFoto del box, quale tenere ("prima" o "seconda"),
    /// con la preferenza del box sullo spazio delle foto: tolleranza e centratura, non solo l'area.
    preferisciDisposizione(box, prima, seconda) {
        return sceltaSpazio.preferisciDisposizione(prima, seconda, cssFramework().getSceltaSpazioFoto(box));
    },

    /// Il corpo di fixFoto. Si chiama solo da li': e' fixFoto a garantire il ripristino.
    eseguiFixFoto(box, candidateRects, obstacles, projection) {

        //I20-1025: l'esito di questa prova, per proiezioneFixFoto. Resta null nelle uscite senza posto.
        this.ultimaProiezione = null;

        var base = this.trovaBase(box);

        if (customAgenzia.calcoloDistanziamentoFoto != null) {
            this.calcoloDistanziamentoFoto = customAgenzia.calcoloDistanziamentoFoto;
        }

        var listFoto = [];

        //cerchiamo nel box le foto
        for (let k = 0; k < box.rectangles.length; k++) {
            let rect = box.rectangles.item(k);

            //I20-978: una foto in noRender e' impaginata ma invisibile, e resta un rettangolo
            //del box. Contandola, il fix foto sceglieva la disposizione per una foto in piu' e
            //ne spostava una che nessuno vede: l'unica visibile finiva nel posto sbagliato e
            //restava un buco. Le foto invisibili non partecipano.
            if (rect.visible === false) {
                continue;
            }
            if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine") ||
                Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                //la mettiamo da parte, se è la primaria la mettiamo in testa
                if (Utility.parseLabel(rect.label).startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine")) {
                    listFoto.unshift(rect);
                }
                else {
                    listFoto.push(rect);
                }
            }
        }

        console.log(listFoto);

        var fotos = [];
        for (let i = 0; i < listFoto.length; i++) {
            let foto = listFoto[i];
            //calcoliamo i bounds della foto
            let paddingFoto = [0,0];
            if(customAgenzia && customAgenzia.paddingFoto) {
                paddingFoto = customAgenzia.paddingFoto;
            }
            let boundsFoto = this.getRealBoundsOfFoto(foto, paddingFoto);
            let obj = {
                object: foto,
                bounds: boundsFoto,
                altezzaFoto: boundsFoto[2] - boundsFoto[0],
                larghezzaFoto: boundsFoto[3] - boundsFoto[1],
                aspectRatioX: (boundsFoto[2] - boundsFoto[0]) / (boundsFoto[3] - boundsFoto[1]),
                aspectRatioY: (boundsFoto[3] - boundsFoto[1]) / (boundsFoto[2] - boundsFoto[0]),
            }
            fotos.push(obj);
        }

        if(fotos.length == 0){
            this.ripristinaOstacoli(obstacles);
            if (!projection && !cssFramework().sospendiControlloSegnalazioniConflitti) {
                cssFramework().controllaSegnalazioniConflittiPendenti(box);
            }
            return 0;
        }

        console.log(fotos);

        //cerchiamo in calcoloDistanziamentoFoto l'oggetto che ha foto uguale alla lunghezza della lista delle foto
        var distanzFoto = this.calcoloDistanziamentoFoto.find(d => d.foto == fotos.length);
        //se non lo troviamo prendiamo l'ultimo elemento in lista come valido
        if(distanzFoto == null){
            //non esiste una configurazione per questo numero di foto, mandiamo l'avviso e torniamo senza fare nulla
            messaggioUtente("Code CSF-12: Non esiste una configurazione di fix foto automatico per " + fotos.length + " foto.", "warning");
            addSegnalazione("Code CSF-12: Non esiste una configurazione di fix foto automatico per " + fotos.length + " foto.", "warning", 2, false);
            this.ripristinaOstacoli(obstacles);
            if (!projection && !cssFramework().sospendiControlloSegnalazioniConflitti) {
                cssFramework().controllaSegnalazioniConflittiPendenti(box);
            }
            return;
            // distanzFoto = JSON.parse(JSON.stringify(this.calcoloDistanziamentoFoto[this.calcoloDistanziamentoFoto.length - 1]));
            // for(var i = 0; i < distanzFoto.foto - fotos.length; i++){
            //     //leggiamo l'ultimo elemento di percDistanceXFoto e ne copiamo il valore
            //     distanzFoto.percDistFoto.push({
            //         percDistanceXFoto: distanzFoto.percDistanceXFoto[distanzFoto.percDistanceXFoto.length - 1],
            //         percDistanceYFoto: distanzFoto.percDistanceYFoto[distanzFoto.percDistanceYFoto.length - 1],
            //         startRangeRatioCondition: 0,
            //         endRangeRatioCondition: Infinity
            //     })
            // }
        }

        //I20-978: prima di disporle, le foto tornano tutte alla stessa scala. Senza questo, un
        //fix foto girato su un gruppo ridotto lascia ingrandite le foto rimaste e la foto
        //riattivata dopo, mai toccata, risulta piu' piccola per sempre.
        this.normalizzaScalaDelleFoto(fotos);

        var res = this.getRaggruppamentoFoto(fotos, distanzFoto)
        var boundsGruppo = res.boundsGruppo;
        fotos = res.fotos;

        //ora che abbiamo i bounds del gruppo cerchiamo fra i candidati quello che lo ospita meglio.
        //Di norma "meglio" vuol dire piu' grande; il box puo' chiedere di privilegiare la
        //centratura, e allora si accetta qualche millimetro in meno per non finire di lato.
        //La scelta vive in sceltaSpazio, fuori da InDesign e quindi verificabile.
        var bestCandidate = null;
        var bestArea = 0;
        let useXaxisForReference = false;

        let larghezzaBase = base != null ? base.geometricBounds[3] - base.geometricBounds[1] : 0;
        let altezzaBase = base != null ? base.geometricBounds[2] - base.geometricBounds[0] : 0;

        let preferenzaSpazio = cssFramework().getSceltaSpazioFoto(box);

        //Cio' che sta attaccato alla foto e sporge (un'ombra) non e' un ostacolo, ma occupa
        //spazio: lo si toglie ai candidati prima di adattarvi il gruppo, cosi' la foto viene
        //quel poco piu' piccola che serve e la sporgenza non finisce sugli altri elementi.
        let estensioniFoto = cssFramework().getEstensioniFoto(box);
        let candidatiUtili = sceltaSpazio.restringiCandidati(candidateRects, estensioniFoto);

        //I20-1009: lo spazio scelto si chiamava sceltaSpazio, come il modulo che lo sceglie:
        //dopo il rinomina del modulo la variabile lo nascondeva, e fixFoto si rompeva qui.
        let spazioScelto = sceltaSpazio.scegli(candidatiUtili, boundsGruppo, preferenzaSpazio, larghezzaBase, altezzaBase);

        console.log("fixFoto " + box.label + ": " + sceltaSpazio.descriviScelta(candidatiUtili, spazioScelto, preferenzaSpazio, larghezzaBase, altezzaBase, estensioniFoto));

        if (spazioScelto != null) {
            bestCandidate = spazioScelto.candidato;
            bestArea = spazioScelto.area;
            useXaxisForReference = spazioScelto.useXaxisForReference;
        }

        if (bestCandidate == null) {
            //ripristiniamo la grandezza originale degli ostacoli
            this.ripristinaOstacoli(obstacles);
            console.error("Nessun candidato trovato per le foto");
            if (!projection && !cssFramework().sospendiControlloSegnalazioniConflitti) {
                cssFramework().controllaSegnalazioniConflittiPendenti(box);
            }
            return;
        }
        //ora che abbiamo il candidato migliore, calcoliamo di quanto il gruppo deve ridimensionarsi in % per adattarsi al candidato
        let ratio = 1;
        if(!useXaxisForReference)
            ratio = bestCandidate.height / (boundsGruppo[2] - boundsGruppo[0]);
        else
            ratio = bestCandidate.width / (boundsGruppo[3] - boundsGruppo[1]);

        //moltiplichiamo i bounds delle foto per il ratio
        for (let i = 0; i < fotos.length; i++) {
            let foto = fotos[i];
            foto.bounds[0] *= ratio;
            foto.bounds[1] *= ratio;
            foto.bounds[2] *= ratio;
            foto.bounds[3] *= ratio;

            //applichiamo il ratio anche alle dimensioni della foto
            foto.larghezzaFoto *= ratio;
            foto.altezzaFoto *= ratio;
        }
        
        //ricalcoliamo i bounds del gruppo dopo il ridimensionamento
        boundsGruppo[0] *= ratio;
        boundsGruppo[1] *= ratio;
        boundsGruppo[2] *= ratio;
        boundsGruppo[3] *= ratio;

        //i bounds del gruppo sono in posizione assoluta, calcoliamo il vettore per spostare il gruppo al centro del candidato
        let offsetX =  (bestCandidate.width - (boundsGruppo[3] - boundsGruppo[1])) / 2;
        let offsetY =  (bestCandidate.height - (boundsGruppo[2] - boundsGruppo[0])) / 2;
        
        //calcoliamo la posizione assoluta del gruppo
        let absoluteBounds = [
            offsetY + bestCandidate.y,
            offsetX + bestCandidate.x,
            offsetY + bestCandidate.y + (boundsGruppo[2] - boundsGruppo[0]),
            offsetX + bestCandidate.x + (boundsGruppo[3] - boundsGruppo[1])
        ];

        //leggiamo quale è la x negativa massima e la y negativa massima
        let minX = Math.min(...fotos.map(f => f.bounds[1]));
        let minY = Math.min(...fotos.map(f => f.bounds[0]));

        //per ognuna, se il valore è negativo, sommiamo il valore assoluto a tutti i bounds corrispondenti (X con X, Y con Y)
        if (minY < 0) {
            for (let i = 0; i < fotos.length; i++) {
                let foto = fotos[i];
                foto.bounds[0] += Math.abs(minY);
                foto.bounds[2] += Math.abs(minY);
            }
        }
        if (minX < 0) {
            for (let i = 0; i < fotos.length; i++) {
                let foto = fotos[i];
                foto.bounds[1] += Math.abs(minX);
                foto.bounds[3] += Math.abs(minX);
            }
        }

        if (!projection) { //se true non applichiamo i bounds alle foto, ma solo calcoliamo l'area occupata dal gruppo
            //applichiamo i bounds del gruppo a tutte le foto
            for (let i = 0; i < fotos.length; i++) {
                let foto = fotos[i];
                //calcoliamo i padding della foto
                let padding = [0, 0];
                if (customAgenzia && customAgenzia.paddingFoto) {
                    padding = customAgenzia.paddingFoto;
                }
                foto.object.geometricBounds = [
                    absoluteBounds[0] + foto.bounds[0] + base.geometricBounds[0] + padding[0],
                    absoluteBounds[1] + foto.bounds[1] + base.geometricBounds[1] + padding[1],
                    absoluteBounds[0] + foto.bounds[2] + base.geometricBounds[0] - padding[0],
                    absoluteBounds[1] + foto.bounds[3] + base.geometricBounds[1] - padding[1]
                ];

                foto.object.fit(FitOptions.CONTENT_TO_FRAME);

                foto.object.geometricBounds = [
                    foto.object.geometricBounds[0] - padding[0],
                    foto.object.geometricBounds[1] - padding[1],
                    foto.object.geometricBounds[2] + padding[0],
                    foto.object.geometricBounds[3] + padding[1]
                ];
            }

        }
        
        //ripristiniamo la grandezza originale degli ostacoli
        this.ripristinaOstacoli(obstacles);

        //calcoliamo l'area finale occupato dal gruppo
        let areaFinale = (absoluteBounds[2] - absoluteBounds[0]) * (absoluteBounds[3] - absoluteBounds[1]);
        //I20-1025: il gruppo e' centrato nel candidato, quindi la sua distanza dal centro della base
        //e' quella del candidato, sull'asse che il box chiede.
        this.ultimaProiezione = {
            area: areaFinale,
            distanzaDalCentro: sceltaSpazio.distanzaDalCentro(bestCandidate, larghezzaBase, altezzaBase, sceltaSpazio.normalizzaPreferenza(preferenzaSpazio).asseCentratura)
        };
        if (!projection && !cssFramework().sospendiControlloSegnalazioniConflitti) {
            cssFramework().controllaSegnalazioniConflittiPendenti(box);
        }
        return areaFinale;
    },

    /// La scala a cui e' inserita l'immagine di una foto, in percentuale, oppure null se la
    /// foto e' vuota o la scala non si legge.
    scalaDellaFoto(rect) {
        try {
            var grafica = null;
            if (rect.images != null && rect.images.length > 0) {
                grafica = rect.images.item(0);
            }
            else if (rect.graphics != null && rect.graphics.length > 0) {
                grafica = rect.graphics.item(0);
            }

            if (grafica == null) {
                return null;
            }

            return grafica.horizontalScale;
        }
        catch (e) {
            //Una scala illeggibile non deve fermare il fix foto: quella foto resta com'e'.
            console.log("Scala della foto non leggibile: " + e);
            return null;
        }
    },

    /// Riporta le foto alla scala della prima, che e' la primaria. La regola vive in
    /// sceltaSpazio, fuori da InDesign e quindi verificabile.
    normalizzaScalaDelleFoto(fotos) {
        var scale = [];
        for (var i = 0; i < fotos.length; i++) {
            scale.push(this.scalaDellaFoto(fotos[i].object));
        }

        var fattori = sceltaSpazio.fattoriDiNormalizzazione(scale);

        for (var f = 0; f < fotos.length; f++) {
            var fattore = fattori[f];
            if (fattore === 1) {
                continue;
            }

            var foto = fotos[f];
            foto.altezzaFoto *= fattore;
            foto.larghezzaFoto *= fattore;
            foto.bounds = [
                foto.bounds[0] * fattore,
                foto.bounds[1] * fattore,
                foto.bounds[2] * fattore,
                foto.bounds[3] * fattore
            ];
        }

        return fattori;
    },

    /// Dispone le foto a cascata: ognuna centrata rispetto alla precedente e scostata delle
    /// percentuali configurate. Il set di percentuali si sceglie sul rapporto altezza/larghezza
    /// della PRIMA foto. Torna l'ingombro complessivo del gruppo e le foto con i nuovi bounds,
    /// normalizzati con l'angolo in 0,0.
    getRaggruppamentoFoto(fotos, distanzFoto){
        //adattiamo i bounds della foto di modo che le misure diventino normalizzate con l'angolo in 0,0

        //usiamo la prima foto per calcolare il ratio Y/X
        var ratio = fotos[0].altezzaFoto / fotos[0].larghezzaFoto;
        //cerchiamo in distanzFoto il primo oggetto che ha startRangeRatioCondition <= ratio <= endRangeRatioCondition
        for (var i = 0; i < distanzFoto.percDistFoto.length; i++) {
            var distanz = distanzFoto.percDistFoto[i];
            if (distanz.startRangeRatioCondition <= ratio && ratio <= distanz.endRangeRatioCondition) {
                distanzFoto = distanz;
                break;
            }
        }

        for (var i = 0; i < fotos.length; i++) {
            var foto = fotos[i];

            if(i==0){
                foto.bounds[0] = 0;
                foto.bounds[1] = 0;
                foto.bounds[2] = foto.altezzaFoto;
                foto.bounds[3] = foto.larghezzaFoto;
                continue;
            }
            else{
                //se non è la prima foto, prendiamo i bounds della foto precedente
                var prevFoto = fotos[i - 1];
                var spostamentoXRelativo = prevFoto.larghezzaFoto / 2 - foto.larghezzaFoto / 2;
                var spostamentoYRelativo = prevFoto.altezzaFoto / 2 - foto.altezzaFoto / 2;
                foto.bounds[0] = prevFoto.bounds[0] + spostamentoYRelativo;
                foto.bounds[1] = prevFoto.bounds[1] + spostamentoXRelativo;
                foto.bounds[2] = foto.bounds[0] + foto.altezzaFoto;
                foto.bounds[3] = foto.bounds[1] + foto.larghezzaFoto;
            }

            //prendiamo la distanzaX e la distanzaY dalla distanzaFoto
            var distanceX = distanz.percDistanceXFoto[i - 1];
            var distanceY = distanz.percDistanceYFoto[i - 1];

            //moltiplichiamo il ratio per la distanza
            var distanzaPercXPostRatio = this.approachOne(foto.aspectRatioX) * distanceX;
            var distanzaPercYPostRatio = this.approachOne(foto.aspectRatioY) * distanceY;

            //calcoliamo la distanza effettiva
            var distanzaX = foto.larghezzaFoto * distanzaPercXPostRatio;
            var distanzaY = foto.altezzaFoto * distanzaPercYPostRatio;

            //applichiamo la distanza ai bounds della foto
            fotos[i].bounds[0] += distanzaY;
            fotos[i].bounds[1] += distanzaX;    
            fotos[i].bounds[2] += distanzaY;
            fotos[i].bounds[3] += distanzaX;
        }

        //calcoliamo i bounds del rettangolo che contiene tutte le foto
        var minY = Math.min(...fotos.map(f => f.bounds[0]));
        var minX = Math.min(...fotos.map(f => f.bounds[1]));
        var maxY = Math.max(...fotos.map(f => f.bounds[2]));
        var maxX = Math.max(...fotos.map(f => f.bounds[3]));
        var boundsGruppo = [minY, minX, maxY, maxX];
        console.log(boundsGruppo);
        return {boundsGruppo:boundsGruppo, fotos:fotos};
    },

    /// Avvicina un valore a 1 con un decadimento esponenziale. Smorza l'effetto del rapporto
    /// d'aspetto sul distanziamento: una foto molto allungata non deve allontanarsi dalle altre
    /// in proporzione alla sua stranezza.
    approachOne(x, k = 1.2) {
        let resOperation = 1 + ((x - 1) * Math.exp(-k));
        console.log("Res: "+resOperation);
        return resOperation;
    },

    /// I vertici dell'immagine dentro il riquadro, per getRealBoundsOfFoto.
    /// E' l'unica sopravvissuta della vecchia geometria del fix iterativo: tutte le altre
    /// servivano solo alla catena MAIN_fixFoto, cancellata in I20-1002.
    getVertex(img, offset) {
        //img.graphics[0].clippingPath.clippingType = ClippingPathType.ALPHA_CHANNEL;    

        var result = [];
        if (img == null) {
            result.push({ nvert: [], vertx: [], verty: [], points: [] });
            return result;
        }

        var vertx = new Array();
        var verty = new Array();
        var points = [];
        var nvertTotal = 0;

        try {
            // console.log(img.images.item(0));
            // if (img.images.item(0) instanceof Image)
            // {
            //    console.log("Sono un inomage"); 
            // }  
            // //console.log(img.graphics.item(0).clippingPath);
            // console.log(img.graphics.item(0).itemLink.filePath);


            let policy = pluginMiddleware.getCampo("policyImpaginazioneMechanism");
            let permettoClipping=true;
            let clippingOptions={tolerance : 0, threshold : 1};

            if (policy!=null && policy.length>0)
            {
                let polUser = policy.find(f=>f.idUtente==idUtente)
                
                if (polUser==null)
                    polUser = policy.find(f=> f.tipo_utente ==ruoloUtenteLoggato);

                if(polUser==null)
                    polUser = policy.find(f=> f.tipo_utente ==0);

                if (polUser!=null)
                {
                    clippingOptions = polUser.macro.find(p=>p.azione=="clippingPath");

                }
            }
            
            if (clippingOptions!=null && clippingOptions.valore)
            {
                if (img.images.length > 0) {
                    img.images.item(0).clippingPath.clippingType = ClippingPathType.DETECT_EDGES;
                    img.images.item(0).clippingPath.tolerance = clippingOptions.tolerance;
                    img.images.item(0).clippingPath.threshold = clippingOptions.threshold;
                }
                else if (img.epss.length > 0){
                    img.epss.item(0).clippingPath.clippingType = ClippingPathType.DETECT_EDGES;
                    img.epss.item(0).clippingPath.tolerance = clippingOptions.tolerance;
                    img.epss.item(0).clippingPath.threshold = clippingOptions.threshold;
                }
                else if (img.pdfs.length > 0){
                    img.pdfs.item(0).clippingPath.clippingType = ClippingPathType.DETECT_EDGES;
                    img.pdfs.item(0).clippingPath.tolerance = 0;
                    img.pdfs.item(0).clippingPath.tolerance = clippingOptions.tolerance;
                    img.pdfs.item(0).clippingPath.threshold = clippingOptions.threshold;
                }
            }

            //alert(img.label);
            //alert(img.graphics[0].clippingPath.paths.length);


            // if (img.images.item(0).clippingPath.paths.length>1)
            // {
            //     //Path complesso, prendiamo il   boundary
            // }

            if (img.images.length > 0) {
                for (var $p = 0; $p < img.images.item(0).clippingPath.paths.length; $p++) {
                    var path = img.images.item(0).clippingPath.paths.item($p).entirePath;
                    var nvert = path.length;
                    nvertTotal += nvert;
                    //alert("Numero vertici " + img.graphics[0].clippingPath.paths.length);
                    //alert([path[0][0], path[0][1]]);

                    for (var $v = 0; $v < nvert; $v++) {
                        if (path[$v][0] instanceof Array) {
                            //alert("Vert " + $v + " is a group of " + path[$v].length);
                            vertx.push(path[$v][0][0] + offset[0]);
                            verty.push(path[$v][0][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                        else {
                            //alert(path[$v][0]+offset[0] + ";" + path[$v][1]+offset[1]);
                            vertx.push(path[$v][0] + offset[0]);
                            verty.push(path[$v][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                    }

                    //alert(vertx);
                    //alert(verty);
                    //alert(vertx);


                }
            }
            else  if (img.epss.length > 0){
                for (var $p = 0; $p < img.epss.item(0).clippingPath.paths.length; $p++) {
                    var path = img.epss.item(0).clippingPath.paths.item($p).entirePath;
                    var nvert = path.length;
                    nvertTotal += nvert;
                    //alert("Numero vertici " + img.graphics[0].clippingPath.paths.length);
                    //alert([path[0][0], path[0][1]]);

                    for (var $v = 0; $v < nvert; $v++) {
                        if (path[$v][0] instanceof Array) {
                            //alert("Vert " + $v + " is a group of " + path[$v].length);
                            vertx.push(path[$v][0][0] + offset[0]);
                            verty.push(path[$v][0][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                        else {
                            //alert(path[$v][0]+offset[0] + ";" + path[$v][1]+offset[1]);
                            vertx.push(path[$v][0] + offset[0]);
                            verty.push(path[$v][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                    }

                    //alert(vertx);
                    //alert(verty);
                    //alert(vertx);


                }
            }
            else  if (img.pdfs.length > 0){
                for (var $p = 0; $p < img.pdfs.item(0).clippingPath.paths.length; $p++) {
                    var path = img.pdfs.item(0).clippingPath.paths.item($p).entirePath;
                    var nvert = path.length;
                    nvertTotal += nvert;

                    for (var $v = 0; $v < nvert; $v++) {
                        if (path[$v][0] instanceof Array) {
                            //alert("Vert " + $v + " is a group of " + path[$v].length);
                            vertx.push(path[$v][0][0] + offset[0]);
                            verty.push(path[$v][0][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                        else {
                            //alert(path[$v][0]+offset[0] + ";" + path[$v][1]+offset[1]);
                            vertx.push(path[$v][0] + offset[0]);
                            verty.push(path[$v][1] + offset[1]);
                            points.push([vertx[vertx.length - 1], verty[verty.length - 1]]);
                        }
                    }
                }
            }


        } catch (err) {
            console.error(err);
        }

        //alert(points);

        result.push({ nvert: nvertTotal, vertx: vertx, verty: verty, points: points });

        return result;//nvert:nvert, vertx:vertx, verty:verty};
    },

    /// L'ingombro reale dell'immagine dentro il riquadro, che non coincide col riquadro:
    /// e' quello che conta per disporre le foto senza spazi vuoti fra l'una e l'altra.
    getRealBoundsOfFoto(img, offset)//Funione da spostare in Utility (ora è occupata)
    {
        //img.graphics[0].clippingPath.clippingType = ClippingPathType.ALPHA_CHANNEL;
        let xmin=-1;
        let xmax=-1;
        let ymin=-1;
        let ymax=-1;

        var foto_vertex_list=this.getVertex(img, offset);
       
        for (var $vtx=0; $vtx<foto_vertex_list.length; $vtx++)
        {
            var foto_vertex=foto_vertex_list[$vtx];
            for (var $v=0; $v<foto_vertex.vertx.length; $v++)
            {

                var myx=foto_vertex.vertx[$v];
                var myy=foto_vertex.verty[$v];

                if (xmin==-1 || xmin>myx)
                    xmin=myx;
                if (xmax==-1 || xmax<myx)
                    xmax=myx;
                if (ymin==-1 || ymin>myy)
                    ymin=myy;
                if (ymax==-1 || ymax<myy)
                    ymax=myy;
            }
        } 

        return [ymin-offset[0], xmin-offset[1], ymax+offset[0], xmax+offset[1]]; // [ymin, xmin, ymax, xmax]
    },
};

module.exports = SistemazioneFoto;
