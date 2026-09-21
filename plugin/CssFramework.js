const { app, FitOptions, LocationOptions, Justification, VerticalJustification, NestedStyleDelimiters, Leading } = require('indesign');
const { ClippingPathType, ClippingPathSettings, Image } = require('indesign');
const cssComposizioneBox = require('./cssComposizioneBox');
const cssSequenzaOperazioni = require('./cssSequenzaOperazioni');
const cssSpazioFoto = require('./cssSpazioFoto');
const cssRegoleConflitti = require('./cssRegoleConflitti');

const CssFramework =
{
    //sono i valori sulla x e sulla y in percentuale (0-1) di cui deve essere distanziato dall'immagine prima
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

    semaforoDownloadFramework:true,

    richiediDiScaricareFramework()
    {
        this.semaforoDownloadFramework = true;
    },

    adaptField: function (field, compiledInfo, offsetX, offsetY) {
        //Azioni CSS standard
        //move: aggiungere X o Y se si intende muovere solo una delle due assi. Move, sposta dell'offset il campo, mantenendo le stesse dimensioni
        //resize: aggiungere X o Y se si intede ridimensionare solo una delle due assi: Resize, ridimensiona dell'offset il box ancorandosi al punto di ridimensionamento (in basso a destra)
        //max-sizeX: aggiungere il valore di massima larghezza in cui puo presentarsi il box (es: max-sizeX:400)
        //max-sizeY: aggiungere il valore di massima altezza in cui puo presentarsi il box (es: max-sizeY:400)
        //min-sizeX: aggiungere il valore di mminima larghezza in cui puo presentarsi il box (es: min-sizeX:200)
        //min-sizeY: aggiungere il valore di minima altezza in cui puo presentarsi il box (es: min-sizeY:200)
        //alignX: aggiungere left/rigth (Nei casi di max o min size si puo suggerire al sistema se seguire l'allineamento verso sinitra o verso destra) 
        //alignY: aggiungere top/bottom (Nei casi di max o min size si puo suggerire al sistema se seguire l'allineamento verso sl'alto o verso il basso) 

        //ATTENZIONE: è imnportante seguire questa priorità di scrittura quando si imposta il valore css
        //Es. corretto
        //"resize max-sizeX:300 alignXright" //Questo chiede ridimensionamento con limite massimo di allargamento. Nel caso di allargamento ridotto allineare il contenuto verso l'avanzo a destra
        //Es. sbagliato
        //"resize alignXright -sizeX:300";

        if (compiledInfo.css != null) {
            let cssInstructions = compiledInfo.css.split(' ');
            let avanzo_margine = 0;

            cssInstructions.forEach(element => {

                if (element.startsWith("move")) {
                    let option = element.replace("move", "");
                    let xOff = 0;
                    let yOff = 0;
                    if (option == "X") {
                        xOff = offsetX;
                    }
                    else if (option == "Y") {
                        yOff = offsetY;
                    }
                    else {
                        xOff = offsetX;
                        yOff = offsetY;
                    }

                    field.geometricBounds = [field.geometricBounds[0] + yOff, field.geometricBounds[1] + xOff, field.geometricBounds[2] + yOff, field.geometricBounds[3] + xOff];

                }
                else if (element.startsWith("resize")) {
                    let option = element.replace("resize", "");
                    let xOff = 0;
                    let yOff = 0;
                    let xOffEnd = offsetX;
                    let yOffEnd = offsetY;

                    if (option == "X") {
                        xOff = 0;
                        yOff = offsetY;
                    }
                    else if (option == "Y") {
                        xOff = offsetX;
                        yOff = 0;
                    }
                    else {
                        xOff = 0;
                        yOff = 0;
                    }

                    field.geometricBounds = [field.geometricBounds[0] + yOff, field.geometricBounds[1] + xOff, field.geometricBounds[2] + yOffEnd, field.geometricBounds[3] + xOffEnd];

                }
                else if (element.startsWith("max-size")) {
                    let p = element.replace("max-size", "").split(':');
                    let unita = p[0];
                    let val = Number(p[1]);

                    if (unita == "X") {
                        console.log("Massima larghezza: " + val);
                        let w = field.geometricBounds[3] - field.geometricBounds[1];
                        if (w > val) {
                            let diff = val - w;
                            avanzo_margine = diff;
                            field.geometricBounds = [field.geometricBounds[0], field.geometricBounds[1], field.geometricBounds[2], field.geometricBounds[3] + diff];
                        }
                    }
                    else if (unita == "Y") {
                        console.log("Massima altezza: " + val);
                        let h = field.geometricBounds[2] - field.geometricBounds[0];
                        if (h > val) {
                            let diff = val - h;
                            avanzo_margine = diff;
                            field.geometricBounds = [field.geometricBounds[0], field.geometricBounds[1], field.geometricBounds[2] + diff, field.geometricBounds[3]];
                        }
                    }


                }
                else if (element.startsWith("min-size")) {
                    let p = element.replace("min-size", "").split(':');;
                    let unita = p[0];

                    if (unita == "X") {
                        console.log("Minima larghezza: " + val);
                        let w = field.geometricBounds[3] - field.geometricBounds[1];
                        if (w < val) {
                            let diff = val - w;
                            avanzo_margine = diff;
                            field.geometricBounds = [field.geometricBounds[0], field.geometricBounds[1], field.geometricBounds[2], field.geometricBounds[3] + diff];
                        }
                    }
                    else if (unita == "Y") {
                        console.log("Minima altezza: " + val);
                        let h = field.geometricBounds[2] - field.geometricBounds[0];
                        if (h < val) {
                            let diff = val - h;
                            avanzo_margine = diff;
                            field.geometricBounds = [field.geometricBounds[0], field.geometricBounds[1], field.geometricBounds[2] + diff, field.geometricBounds[3]];
                        }
                    }
                }
                else if (element.startsWith("alignX")) {
                    //Si basa su avanzo margine
                    let dir = element.replace("alignX", "");
                    if (dir == "left") {

                    }
                    else if (dir == "right") {

                    }
                }
                else if (element.startsWith("alignY")) {
                    //Si basa su avanzo margine
                    let dir = element.replace("alignY", "");
                    if (dir == "top") {

                    }
                    else if (dir == "bottom") {

                    }
                }


            });
        }

    },

    getSpazioImpaginazione(box) {
        let obs = this.getObstacles(box);
        //calcoliamo la larghezza e l'altezza del box
        // let boxWidth = box.geometricBounds[3] - box.geometricBounds[1];
        // let boxHeight = box.geometricBounds[2] - box.geometricBounds[0];

        var base = null;
        for (var i = 0; i < box.allPageItems.length; i++){
            var el = box.allPageItems[i];
            if(Utility.parseLabel(el.label).startsWith("base")){
                base = el;
                break;
            }
        }

        let baseWidth = base.geometricBounds[3] - base.geometricBounds[1];
        let baseHeight = base.geometricBounds[2] - base.geometricBounds[0];

        //calcoliamo i rettangoli liberi
        let candidate = this.generateCandidateRects(baseWidth, baseHeight, obs, 0);

        //refiniamo i rettangoli liberi
        let refinedRects = this.refineRects(obs, candidate, baseWidth, baseHeight, 0);

        return {candidate: refinedRects, obstacles: obs};

    },

    getObstacles(box) {
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
        var base = null;
        for (let i = 0; i < box.allPageItems.length; i++) {
            const item = box.allPageItems[i];
            if(base == null && Utility.parseLabel(item.label).startsWith("base")){
                base = item;
            }
            //controlliamo se l'elemento è valido e non è uno degli elementi da ignorare (se la label inizia con uno degli ignoreElements)
            //se però è presente in exception non lo ignoriamo
            if (
                !ignoreElements.some(ignore => item.label && this.makeRegexFromGroupName(ignore).test(Utility.parseLabel(item.label))) ||
                exception.some(exc => item.label && this.makeRegexFromGroupName(exc).test(Utility.parseLabel(item.label)))
            ){
                var obj = {
                    originalBounds: item.geometricBounds,
                    originalWidth: item.geometricBounds[3] - item.geometricBounds[1],
                    originalHeight: item.geometricBounds[2] - item.geometricBounds[0],
                    label: Utility.parseLabel(item.label),
                }

                //controlliamo se è un textFrame
                if (item.constructorName === "TextFrame") {
                    //applichiamo il fit al contenuto
                    this.safeFitToContent(item);
                }

                listObjFitted.push(obj);
            }

        }
        
        for (let i = 0; i < box.allPageItems.length; i++) {
            const item = box.allPageItems[i];
            //controlliamo se l'elemento è valido e non è uno degli elementi da ignorare (se la label inizia con uno degli ignoreElements)
            if (item.isValid && item.label != "" && (!ignoreElements.some(ignore => item.label && this.makeRegexFromGroupName(ignore).test(Utility.parseLabel(item.label))) || exception.some(exc => item.label && this.makeRegexFromGroupName(exc).test(Utility.parseLabel(item.label))))) {
                //aggiungiamo l'elemento come ostacolo
                //controlliamo se l'elemento ha un padding personalizzato
                let padding = [0, 0, 0, 0]; // [top, left, bottom, right]
                if (customPadding.length > 0) {
                    let customPad = customPadding.find(p => item.label && this.makeRegexFromGroupName(p.label).test(Utility.parseLabel(item.label)));
                    if (customPad) {
                        padding = customPad.padding;
                    }
                }

                var obj = listObjFitted.find(o => o.label == Utility.parseLabel(item.label));

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

        return obstacles;
    },

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
    },

    // findFreeRectangles(surfaceWidth, surfaceHeight, obstacles) {
    //     // Ogni ostacolo è un rettangolo: { x, y, width, height }
    //     const freeRects = [{ x: 0, y: 0, width: surfaceWidth, height: surfaceHeight }];

    //     for (const obs of obstacles) {
    //         const newFreeRects = [];

    //         for (const rect of freeRects) {
    //             const intersect = this.getIntersection(rect, obs);

    //             if (!intersect) {
    //                 newFreeRects.push(rect); // Nessuna sovrapposizione, lo teniamo
    //             } else {
    //                 // Dividiamo il rettangolo libero in fino a 4 rettangoli non sovrapposti
    //                 const { x, y, width, height } = rect;
    //                 const ix = intersect.x;
    //                 const iy = intersect.y;
    //                 const iw = intersect.width;
    //                 const ih = intersect.height;

    //                 // Sopra
    //                 if (iy > y) {
    //                     newFreeRects.push({ x: x, y: y, width: width, height: iy - y });
    //                 }
    //                 // Sotto
    //                 if (iy + ih < y + height) {
    //                     newFreeRects.push({ x: x, y: iy + ih, width: width, height: (y + height) - (iy + ih) });
    //                 }
    //                 // Sinistra
    //                 if (ix > x) {
    //                     newFreeRects.push({ x: x, y: Math.max(y, iy), width: ix - x, height: Math.min(height, ih) });
    //                 }
    //                 // Destra
    //                 if (ix + iw < x + width) {
    //                     newFreeRects.push({ x: ix + iw, y: Math.max(y, iy), width: (x + width) - (ix + iw), height: Math.min(height, ih) });
    //                 }
    //             }
    //         }

    //         // Aggiorna i rettangoli liberi
    //         freeRects.length = 0;
    //         freeRects.push(...newFreeRects);
    //     }

    //     return freeRects;
    // },

    generateCandidateRects(boxWidth, boxHeight, obstacles, tolerance = 0) {
        const results = [];
        var paddingBox = [-2, -2, -2, -2]; // [top, left, bottom, right]
        if (customAgenzia && customAgenzia.paddingBox) {
            paddingBox = customAgenzia.paddingBox;
        }
        for (const obs of obstacles) {
            const { x, y, width, height } = obs;

            // Sopra
            if (y > tolerance) {
                results.push({
                    x: 0,
                    y: 0,
                    width: boxWidth,
                    height: y,
                    direction: "sopra",
                    obstacleRefs: [obs]
                });
            }

            // Sotto
            if (y + height < boxHeight - tolerance) {
                results.push({
                    x: 0,
                    y: y + height,
                    width: boxWidth,
                    height: boxHeight - (y + height),
                    direction: "sotto",
                    obstacleRefs: [obs]
                });
            }

            // Sinistra
            if (x > tolerance) {
                results.push({
                    x: 0,
                    y: 0,
                    width: x,
                    height: boxHeight,
                    direction: "sinistra",
                    obstacleRefs: [obs]
                });
            }

            // Destra
            if (x + width < boxWidth - tolerance) {
                results.push({
                    x: x + width,
                    y: 0,
                    width: boxWidth - (x + width),
                    height: boxHeight,
                    direction: "destra",
                    obstacleRefs: [obs]
                });
            }
        }

        //per ogni risultato applichiamo i padding del box
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            r.x -= paddingBox[1];
            r.y -= paddingBox[0];
            r.width += (paddingBox[1] + paddingBox[3]);
            r.height += (paddingBox[0] + paddingBox[2]);

            // Controlla se il rettangolo è valido dopo il padding
            if (r.width <= 0 || r.height <= 0) {
                results.splice(i, 1);
                i--; // Decrementa l'indice per compensare la rimozione
            }
        }

        return results;
    },

    reduceResult(res) {
        const reduced = [];
        for (const r of res) {
            const isContained = reduced.some(existing =>
                existing !== r && // ✅ evita di confrontare con se stesso
                r.x >= existing.x &&
                r.y >= existing.y &&
                r.x + r.width <= existing.x + existing.width &&
                r.y + r.height <= existing.y + existing.height
            );
            if (!isContained) {
                reduced.push(r);
            }
        }
        return reduced; // ✅ restituisce il risultato
    },


    refineRects(obstacles, contours, boxWidth, boxHeight, tolerance = 0) {
        let currentRects = [...contours];
        let changed = true;
        let emergencycounter = 0;
        let emergencyLimit = 10000000;
        while (changed && emergencycounter < 1000 && currentRects.length < emergencyLimit) {
            changed = false;
            const newRects = [];

            for (const rect of currentRects) {
                let collided = false;

                for (const obs of obstacles) {
                    // evita di controllare ostacoli già considerati
                    if (rect.obstacleRefs.includes(obs)) continue;

                    // test collisione
                    const collides =
                        rect.x < obs.x + obs.width &&
                        rect.x + rect.width > obs.x &&
                        rect.y < obs.y + obs.height &&
                        rect.y + rect.height > obs.y;

                    if (collides) {
                        collided = true;
                        const inter = this.intersectRect(rect, obs, tolerance);
                        if (inter.length > 0) {
                            //aggiungiamo i risultati
                            for (const r of inter) {
                                newRects.push({
                                    ...r,
                                    direction: rect.direction,
                                    obstacleRefs: [...rect.obstacleRefs, obs]
                                });
                            }
                            changed = true;
                        }
                        
                    }
                }

                if (!collided) {
                    newRects.push(rect);
                }
            }

            currentRects = newRects;
            currentRects = this.removeDuplicateRects(currentRects);
            emergencycounter++;
        }

        let cleanedRects = this.removeDuplicateRects(currentRects);
        cleanedRects = this.removeRectsToSmall(cleanedRects, boxWidth / 4, boxHeight / 4); // rimuove rettangoli troppo piccoli

        //Se vogliamo più aree possiamo disattivare questa funzione, le aree che toglie non sono sbagliate ma sono sottoaree di quelle rimaste
        cleanedRects = this.reduceResult(cleanedRects);
        //this.coloraResults(docInLavorazione.pages.item(0), cleanedRects);
        return cleanedRects;
    },

    coloraResults(page, res) {
        for (var i = 0; i < res.length; i++) {
            var r = res[i];

            try {
                // Calcolo geometricBounds: [y1, x1, y2, x2]
                var gb = [
                    r.y,                   // top
                    r.x,                   // left
                    r.y + r.height,        // bottom
                    r.x + r.width          // right
                ];

                var newRect = page.rectangles.add();
                newRect.geometricBounds = gb;
                newRect.fillColor = "Rosso prezzi";
                newRect.strokeWeight = 0;
            } catch (e) {
                console.log("Errore su rettangolo " + i + ": " + e);
            }
        }
    },

    removeDuplicateRects(rects, tolerance = 0.0001) {
        const unique = [];

        for (const r of rects) {
            const exists = unique.some(u =>
                Math.abs(u.x - r.x) < tolerance &&
                Math.abs(u.y - r.y) < tolerance &&
                Math.abs(u.width - r.width) < tolerance &&
                Math.abs(u.height - r.height) < tolerance
            );

            if (!exists) {
                unique.push(r);
            }
        }

        return unique;
    },

    removeRectsToSmall(rects, widthMin, heightMin) {
        const tolerance = 0.0001;
        return rects.filter(r =>
            r.width > widthMin - tolerance &&
            r.height > heightMin - tolerance
        );
    },

    // // Intersezione geometrica di due rettangoli
    // intersectRect(r1, r2, tolerance = 0.0001) {
    //     const x1 = Math.max(r1.x, r2.x);
    //     const y1 = Math.max(r1.y, r2.y);
    //     const x2 = Math.min(r1.x + r1.width, r2.x + r2.width);
    //     const y2 = Math.min(r1.y + r1.height, r2.y + r2.height);

    //     if (x2 > x1 + tolerance && y2 > y1 + tolerance) {
    //         return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    //     }
    //     return null;
    // },

    intersectRect(rect, obs, tolerance = 0.0001) {
        const results = [];

        // Coordinate di intersezione
        const interX1 = Math.max(rect.x, obs.x);
        const interY1 = Math.max(rect.y, obs.y);
        const interX2 = Math.min(rect.x + rect.width, obs.x + obs.width);
        const interY2 = Math.min(rect.y + rect.height, obs.y + obs.height);

        // Se non c'è intersezione, il rettangolo rimane com'è
        if (interX2 <= interX1 + tolerance || interY2 <= interY1 + tolerance) {
            return [rect];
        }

        // ---- SPLIT IN 4 PEZZI POSSIBILI ----
        const newRefs = [...rect.obstacleRefs, obs];

        // Sopra l'ostacolo
        if (interY1 > rect.y) {
            results.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: interY1 - rect.y,
                direction: rect.direction,
                obstacleRefs: newRefs
            });
        }

        // Sotto l'ostacolo
        if (interY2 < rect.y + rect.height) {
            results.push({
                x: rect.x,
                y: interY2,
                width: rect.width,
                height: (rect.y + rect.height) - interY2,
                direction: rect.direction,
                obstacleRefs: newRefs
            });
        }

        // A sinistra dell'ostacolo
        if (interX1 > rect.x) {
            results.push({
                x: rect.x,
                y: Math.max(interY1, rect.y),
                width: interX1 - rect.x,
                height: Math.min(interY2, rect.y + rect.height) - Math.max(interY1, rect.y),
                direction: rect.direction,
                obstacleRefs: newRefs
            });
        }

        // A destra dell'ostacolo
        if (interX2 < rect.x + rect.width) {
            results.push({
                x: interX2,
                y: Math.max(interY1, rect.y),
                width: (rect.x + rect.width) - interX2,
                height: Math.min(interY2, rect.y + rect.height) - Math.max(interY1, rect.y),
                direction: rect.direction,
                obstacleRefs: newRefs
            });
        }

        // Filtra eventuali rettangoli con area nulla
        return results.filter(r => r.width > tolerance && r.height > tolerance);
    },



    // getIntersection (r1, r2) {
    //     const x1 = Math.max(r1.x, r2.x);
    //     const y1 = Math.max(r1.y, r2.y);
    //     const x2 = Math.min(r1.x + r1.width, r2.x + r2.width);
    //     const y2 = Math.min(r1.y + r1.height, r2.y + r2.height);

    //     if (x2 <= x1 || y2 <= y1) return null;

    //     return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    // },

    // mergeRectangles(rects, tolerance = 0.01) {
    //     // Filtra rettangoli "vuoti" o con area nulla
    //     rects = rects.filter(r => r.width > tolerance && r.height > tolerance);

    //     let merged = true;

    //     while (merged) {
    //         merged = false;
    //         const result = [];

    //         while (rects.length > 0) {
    //             const current = rects.shift();
    //             let combined = false;

    //             for (let i = 0; i < rects.length; i++) {
    //                 const other = rects[i];

    //                 // 🔹 Merge verticale (stessa X e Width, adiacenti verticalmente)
    //                 if (Math.abs(current.x - other.x) < tolerance &&
    //                     Math.abs(current.width - other.width) < tolerance &&
    //                     (Math.abs(current.y + current.height - other.y) < tolerance ||
    //                      Math.abs(other.y + other.height - current.y) < tolerance)) {
    //                     const minY = Math.min(current.y, other.y);
    //                     const maxY = Math.max(current.y + current.height, other.y + other.height);
    //                     rects.splice(i, 1);
    //                     rects.push({ x: current.x, y: minY, width: current.width, height: maxY - minY });
    //                     combined = true;
    //                     merged = true;
    //                     break;
    //                 }

    //                 // 🔹 Merge orizzontale (stessa Y e Height, adiacenti orizzontalmente)
    //                 if (Math.abs(current.y - other.y) < tolerance &&
    //                     Math.abs(current.height - other.height) < tolerance &&
    //                     (Math.abs(current.x + current.width - other.x) < tolerance ||
    //                      Math.abs(other.x + other.width - current.x) < tolerance)) {
    //                     const minX = Math.min(current.x, other.x);
    //                     const maxX = Math.max(current.x + current.width, other.x + other.width);
    //                     rects.splice(i, 1);
    //                     rects.push({ x: minX, y: current.y, width: maxX - minX, height: current.height });
    //                     combined = true;
    //                     merged = true;
    //                     break;
    //                 }
    //             }

    //             if (!combined) {
    //                 result.push(current);
    //             }
    //         }

    //         rects = result;
    //     }

    //     return rects;
    // },

    // getMaxIntersectionRectangles(rects, maxResults = 5, tolerance = 0.0001) {
    //     rects = rects.filter(r => r.width > tolerance && r.height > tolerance);

    //     const results = [];
    //     const n = rects.length;

    //     // Genera tutte le combinazioni
    //     const subsets = (arr) => {
    //         const res = [];
    //         const total = 1 << arr.length;
    //         for (let mask = 1; mask < total; mask++) {
    //             const combo = [];
    //             for (let i = 0; i < arr.length; i++) {
    //                 if (mask & (1 << i)) combo.push(arr[i]);
    //             }
    //             if (combo.length >= 2) res.push(combo);
    //         }
    //         return res;
    //     };

    //     const allCombos = subsets(rects);

    //     //ordiniamo le combinazioni per valore y
    //     allCombos.forEach(combo => {
    //         combo.sort((a, b) => a.y - b.y);
    //     });

    //     for (const combo of allCombos) {
    //         //se il valore di y è uguale al valore di height dell'elemento prima, il valore di y diventa uguale al valore di y dell'elemento prima
    //         if(combo.length < 2) continue;
    //         //scorriamo tutti gli elementi di combo e se il valore di y è uguale al valore di height dell'elemento prima, il valore di y diventa uguale al valore di y dell'elemento prima
    //         for (let i = 1; i < combo.length; i++) {
    //             if (Math.abs(combo[i].y - combo[i-1].y - combo[i-1].height) < tolerance) {
    //                 combo[i].y = combo[i-1].y;
    //                 combo[i].height += combo[i-1].height;
    //             }
    //         }

    //         //push in results di tutti i rettangoli 
    //         for (const r of combo) {
    //             results.push({
    //                 x: r.x,
    //                 y: r.y,
    //                 width: r.width,
    //                 height: r.height
    //             });
    //         }
    //     }

    //     //ripetiamo sulle x
    //     allCombos.forEach(combo => {
    //         combo.sort((a, b) => a.x - b.x);
    //     }
    //     );

    //     for (const combo of allCombos) {
    //         //se il valore di x è uguale al valore di width dell'elemento prima, il valore di x diventa uguale al valore di x dell'elemento prima
    //         if(combo.length < 2) continue;
    //         //scorriamo tutti gli elementi di combo e se il valore di x è uguale al valore di width dell'elemento prima, il valore di x diventa uguale al valore di x dell'elemento prima
    //         for (let i = 1; i < combo.length; i++) {
    //             if (Math.abs(combo[i].x - combo[i-1].x - combo[i-1].width) < tolerance) {
    //                 combo[i].x = combo[i-1].x;
    //                 combo[i].width += combo[i-1].width;
    //             }
    //         }

    //         //push in results di tutti i rettangoli 
    //         for (const r of combo) {
    //             results.push({
    //                 x: r.x,
    //                 y: r.y,
    //                 width: r.width,
    //                 height: r.height
    //             });
    //         }
    //     }

    //     // Elimina duplicati
    //     const unique = [];
    //     for (const r of results) {
    //         if (!unique.some(u =>
    //             Math.abs(u.x - r.x) < tolerance &&
    //             Math.abs(u.y - r.y) < tolerance &&
    //             Math.abs(u.width - r.width) < tolerance &&
    //             Math.abs(u.height - r.height) < tolerance
    //         )) {
    //             unique.push(r);
    //         }
    //     }

    //     // Ordina per area decrescente
    //     unique.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    //     return unique.slice(0, maxResults);
    // }

    fixFoto(box, candidateRects, obstacles, projection = false) {

        var base = null;
        for (var i = 0; i < box.allPageItems.length; i++){
            var el = box.allPageItems[i];
            if(Utility.parseLabel(el.label).startsWith("base")){
                base = el;
                break;
            }
        }

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
            if (!projection && !this.sospendiControlloSegnalazioniConflitti) {
                this.controllaSegnalazioniConflittiPendenti(box);
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
            if (!projection && !this.sospendiControlloSegnalazioniConflitti) {
                this.controllaSegnalazioniConflittiPendenti(box);
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
        //La scelta vive in cssSpazioFoto, fuori da InDesign e quindi verificabile.
        var bestCandidate = null;
        var bestArea = 0;
        let useXaxisForReference = false;

        let larghezzaBase = base != null ? base.geometricBounds[3] - base.geometricBounds[1] : 0;
        let altezzaBase = base != null ? base.geometricBounds[2] - base.geometricBounds[0] : 0;

        let preferenzaSpazio = this.getSceltaSpazioFoto(box);

        //Cio' che sta attaccato alla foto e sporge (un'ombra) non e' un ostacolo, ma occupa
        //spazio: lo si toglie ai candidati prima di adattarvi il gruppo, cosi' la foto viene
        //quel poco piu' piccola che serve e la sporgenza non finisce sugli altri elementi.
        let estensioniFoto = this.getEstensioniFoto(box);
        let candidatiUtili = cssSpazioFoto.restringiCandidati(candidateRects, estensioniFoto);

        let sceltaSpazio = cssSpazioFoto.scegli(candidatiUtili, boundsGruppo, preferenzaSpazio, larghezzaBase, altezzaBase);

        console.log("fixFoto " + box.label + ": " + cssSpazioFoto.descriviScelta(candidatiUtili, sceltaSpazio, preferenzaSpazio, larghezzaBase, altezzaBase, estensioniFoto));

        if (sceltaSpazio != null) {
            bestCandidate = sceltaSpazio.candidato;
            bestArea = sceltaSpazio.area;
            useXaxisForReference = sceltaSpazio.useXaxisForReference;
        }

        if (bestCandidate == null) {
            //ripristiniamo la grandezza originale degli ostacoli
            for (let i = 0; i < obstacles.length; i++) {
                let obs = obstacles[i];
                if (obs.constructor.toLowerCase() == "group") continue;
                obs.object.geometricBounds = [
                    obs.originalBounds[0],
                    obs.originalBounds[1],
                    obs.originalBounds[2],
                    obs.originalBounds[3]
                ];
            }
            console.error("Nessun candidato trovato per le foto");
            if (!projection && !this.sospendiControlloSegnalazioniConflitti) {
                this.controllaSegnalazioniConflittiPendenti(box);
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
        for (let i = 0; i < obstacles.length; i++) {
            let obs = obstacles[i];
            if (obs.constructor.toLowerCase() == "group") continue;
            obs.object.geometricBounds = [
                obs.originalBounds[0],
                obs.originalBounds[1],
                obs.originalBounds[2],
                obs.originalBounds[3]
            ];
        }

        //calcoliamo l'area finale occupato dal gruppo
        let areaFinale = (absoluteBounds[2] - absoluteBounds[0]) * (absoluteBounds[3] - absoluteBounds[1]);
        if (!projection && !this.sospendiControlloSegnalazioniConflitti) {
            this.controllaSegnalazioniConflittiPendenti(box);
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
    /// cssSpazioFoto, fuori da InDesign e quindi verificabile.
    normalizzaScalaDelleFoto(fotos) {
        var scale = [];
        for (var i = 0; i < fotos.length; i++) {
            scale.push(this.scalaDellaFoto(fotos[i].object));
        }

        var fattori = cssSpazioFoto.fattoriDiNormalizzazione(scale);

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

    approachOne(x, k = 1.2) {
        let resOperation = 1 + ((x - 1) * Math.exp(-k));
        console.log("Res: "+resOperation);
        return resOperation;
    },

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

    getRealBoundsOfFoto(img, offset)//Funione da spostare in Utility (ora è occupata)
    {
        //img.graphics[0].clippingPath.clippingType = ClippingPathType.ALPHA_CHANNEL;
        let xmin=-1;
        let xmax=-1;
        let ymin=-1;
        let ymax=-1;

        var foto_vertex_list=CssFramework.getVertex(img, offset);
       
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


    checkHittedArea(bounds_area, img, offset) {
        var listObjVertex = getVertex(img, offset);
        for (var $vtx = 0; $vtx < listObjVertex.length; $vtx++) {
            var objVertex = listObjVertex[$vtx]; //getVertex(img, offset);
            var nvert = objVertex.nvert;
            var vertx = objVertex.vertx;
            var verty = objVertex.verty;

            var minmax = [-1000, -1000, -1000, -1000];

            for (var $v = 0; $v < nvert; $v++) {
                var vPos = [vertx[$v], verty[$v]];
                if (minmax[1] == -1000 || vPos[0] < minmax[1])
                    minmax[1] = vPos[0];

                if (minmax[3] == -1000 || vPos[0] > minmax[3])
                    minmax[3] = vPos[0];

                if (minmax[0] == -1000 || vPos[1] < minmax[0])
                    minmax[0] = vPos[1];

                if (minmax[2] == -1000 || vPos[1] > minmax[2])
                    minmax[2] = vPos[1];

                if (vPos[0] >= bounds_area[1] && vPos[0] <= bounds_area[3] &&
                    vPos[1] >= bounds_area[0] && vPos[1] <= bounds_area[2]) {
                    return true;
                }
            }

        }
        //alert(minmax + " ------ " + bounds_area);
        var y_compresa = (minmax[0] < bounds_area[0] && minmax[2] > bounds_area[0]) || (minmax[0] > bounds_area[0] && minmax[0] < bounds_area[2]);
        var x_compresa = (minmax[1] < bounds_area[1] && minmax[1] > bounds_area[1]) || (minmax[1] > bounds_area[1] && minmax[1] < bounds_area[3]);
        if (y_compresa && x_compresa) {
            //alert("QUI!")
            return true;
        }

        return false;
    },



    intersec(nvert, vertx, verty, testx, testy) {

        var i, j, c = 0;
        var inter = 0;

        for (i = 0, j = nvert - 1; i < nvert; j = i++) {

            if ((verty[i] > testy) != (verty[j] > testy)) {
                if (verty[i] == testy && vertx[i] == testx) {
                    //alert("STESSO PUNTO " + [testx,testy]);
                    c = !c;
                }
                else {
                    var calcolo = (vertx[j] - vertx[i]) * (testy - verty[i]) / (verty[j] - verty[i]) + vertx[i];
                    if (testx < calcolo) {
                        //alert("PUNTO CONTENUTO " + [testx,testy]);

                        c = !c;
                        //if (c)
                        //alert([testx,texty]);
                    }
                }
            }
        }

        //alert("Interazioni " + inter);

        return c;
    },

    //Basata su poligono complesso
    getAreaSovrapposizione(imgPolygon1, imgPolygon2) {
        var intersectPoints = [];

        for (var p = 0; p < imgPolygon2.points.length; p++) {
            var pTest = imgPolygon2.points[p];
            // alert([pTest[0], pTest[1]]);
            var isInside = intersec(imgPolygon1.nvert, imgPolygon1.vertx, imgPolygon1.verty, pTest[0], pTest[1]);
            //alert(isInside);
            if (isInside) {
                intersectPoints.push(pTest);
            }
        }

        return intersectPoints;
    },

    //Basata su rect semplice
    getAreaSovrapposizione2(rect1, rect2) {

        // Extracting coordinates of Rectangle A
        //const { x1: x1A, y1: y1A, x2: x2A, y2: y2A } = rectA;
        var x1 = rect1[0];
        var y1 = rect1[1];
        var x1max = rect1[2];
        var y1max = rect1[3];

        // Extracting coordinates of Rectangle B
        //const { x1: x1B, y1: y1B, x2: x2B, y2: y2B } = rectB;
        var x2 = rect2[0];
        var y2 = rect2[1];
        var x2max = rect2[2];
        var y2max = rect2[3];

        // Calculate overlap in X-axis
        const overlapX = Math.max(0, Math.min(x1max, x2max) - Math.max(x1, x2));

        // Calculate overlap in Y-axis
        const overlapY = Math.max(0, Math.min(y1max, y2max) - Math.max(y1, y2));

        // Calculate total overlap area
        const overlapArea = overlapX * overlapY;

        return overlapArea;


        // var poly1 = {points:[[rect1[0],rect1[1]],[rect1[2],rect1[1]],[rect1[2],rect1[3]],[rect1[0],rect1[3]],[rect1[0],rect1[1]]], nvert:0, vertx:[], verty:[]};
        // var poly2 = {points:[[rect2[0],rect2[1]],[rect2[2],rect2[1]],[rect2[2],rect2[3]],[rect2[0],rect2[3]], [rect2[0],rect2[1]]], nvert:0, vertx:[], verty:[]};

        // for (var p=0; p<poly1.points.length; p++)
        // {
        //     poly1.nvert += 1;
        //     poly2.nvert += 1;

        //     poly1.vertx.push(poly1.points[p][0]);
        //     poly2.vertx.push(poly2.points[p][0]);

        //     poly1.verty.push(poly1.points[p][1]);
        //     poly2.verty.push(poly2.points[p][1]);
        // }

        // // alert(poly1.vertx);
        // // alert(poly1.verty);
        // // alert(poly2.vertx);
        // // alert(poly2.verty);
        // alert("Confronto\n"+poly1.points+"\n\n"+poly2.points);

        // var result=getAreaSovrapposizione(poly1, poly2);
        // alert("RESULT " + result);
        // return result;
    },

    // alert(img1[0]);
    // alert(img2[0]);

    calcolaAreaPoligono(poligono) {
        const n = poligono.length;

        if (n < 3) {
            // Il poligono deve avere almeno 3 vertici
            return 0;
        }

        var area = 0;

        for (var i = 0; i < n; i++) {
            var x1 = poligono[i][0];
            var y1 = poligono[i][1];

            var x2 = poligono[(i + 1) % n][0];
            var y2 = poligono[(i + 1) % n][1];

            area += (x1 * y2 - x2 * y1);
        }

        // L'area calcolata è positiva, prendiamo il valore assoluto
        area = Math.abs(area) / 2.0;

        return area;
    },

    getRect(poligono) {
        var boundary = [9000, 9000, 0, 0];
        for (var p = 0; p < poligono.length; p++) {
            var _p = poligono[p];
            if (_p[0] < boundary[0])
                boundary[0] = _p[0];
            if (_p[1] < boundary[1])
                boundary[1] = _p[1];
            if (_p[0] > boundary[2])
                boundary[2] = _p[0];
            if (_p[1] > boundary[3])
                boundary[3] = _p[1];
        }

        if (poligono.length < 3) {
            boundary = [0, 0, 0, 0];
        }

        return boundary;
    },


    checkOverflow(rect) {
        //alert(rect + " ++++ " + confini );
        var result = "";

        if (rect[0] < confini[0]) {
            result += "-2"; //OVERFLOW -X
        }
        if (rect[1] < confini[1]) {
            result += "-3"; //OVERFLOW -Y
        }
        if (rect[2] > confini[2]) {
            result += "-4"; //OVERFLOW +X
        }
        if (rect[3] > confini[3]) {
            result += "-5"; //OVERFLOW +Y
        }

        return result; //OK
    },

    startFix(imgList, nTentativo) {
        //Posiziono tute le immagini al centro rispetto al confine
        for (var f = 0; f < imgList.length; f++) {
            var item = imgList[f];
            if (item == null)
                continue;

            var bound = item.graphics.item(0).geometricBounds;//item.geometricBounds;
            var h = bound[2] - bound[0];
            var w = bound[3] - bound[1];

            if (modelloDiFix.scaleReduce > 0 && nTentativo > 1) {
                var hDaSottrarre = modelloDiFix.scaleReduce * h;
                var wDaSottrarre = modelloDiFix.scaleReduce * w;
                h -= hDaSottrarre;
                w -= wDaSottrarre;
            }

            var startCenterX = confini[0] + ((confini[2] - confini[0] - w) / 2);
            var startCenterY = confini[1] + ((confini[3] - confini[1] - h) / 2);
            //alert([startCenterY, startCenterX, startCenterY+h, startCenterX+w]);



            item.graphics.item(0).geometricBounds = [startCenterY, startCenterX, startCenterY + h, startCenterX + w];

            item.geometricBounds = item.graphics.item(0).geometricBounds;
        }
    },


    fixIterazione(imgList) {
        for (var f = 0; f < imgList.length; f++) {
            var item = imgList[f];
            if (item == null)
                continue;

            var offsetModello = modelloDiFix.offsetSteps[f][0];//Il momento non cambia mai. Semper e solo 1 per adesso
            var offset = [offsetModello[0], offsetModello[1]];
            offset[0] *= offsetScale;
            offset[1] *= offsetScale;


            item.graphics.item(0).geometricBounds = [item.graphics.item(0).geometricBounds[0] + offset[1], item.graphics.item(0).geometricBounds[1] + offset[0], item.graphics.item(0).geometricBounds[2] + offset[1], item.graphics.item(0).geometricBounds[3] + offset[0]];
            item.geometricBounds = item.graphics.item(0).geometricBounds;//[item.geometricBounds[0]+offset[1], item.geometricBounds[1]+offset[0], item.geometricBounds[2]+offset[1], item.geometricBounds[3]+offset[0]];
        }
    },


    analisiModello(imgList) {
        var rapporti = [];

        for (var f = 0; f < imgList.length; f++) {
            var item = imgList[f];
            if (item == null)
                continue;

            var poly = getVertex(item, [0, 0, 0, 0]);
            var rect = getRect(poly[0].points);
            var w = rect[2] - rect[0];
            var h = rect[3] - rect[1];

            //alert([w,h]);

            rapporti.push(w / h);
        }

        //alert(rapporti.length);

        if (rapporti.length == 2) {
            if ((rapporti[0] >= 1 && rapporti[1] < 0) ||
                rapporti[1] >= 1 && rapporti[0] < 0) {
                //Due foto con orientamento diverso
                // aprescindere dal differenziale si applica il modello classico orizzontale
                return modelloStandardFotoOrizzontali;//"due foto con orientamento differente -> modelloStandardFotoOrizzontali";
            }
            else {
                if (rapporti[0] < 1) {
                    //h>w
                    var minRapp = Math.min(rapporti[0], rapporti[1]);
                    //alert(minRapp);
                    if (minRapp >= 0.45) {
                        return modelloStandardFotoVerticali;//"due foto con orientamento verticale (rapp "+ minRapp +")  -> modelloSlimFotoVerticali";
                    }
                    else {
                        return modelloSlimFotoVerticali;//"due foto con orientamento verticale (rapp "+ minRapp +") -> modelloStandardFotoVerticali";
                    }
                }
                else {
                    //w>h                
                    var maxRapp = Math.max(rapporti[0], rapporti[1]);
                    if (maxRapp <= 3) {
                        return modelloStandardFotoOrizzontali;//"due foto con orientamento orizzontale (rapp "+ maxRapp +") -> modelloSlimFotoOrizzontali";
                    }
                    else {
                        return modelloSlimFotoOrizzontali;//"due foto con orientamento orizzontale (rapp "+ maxRapp +") -> modelloStandardFotoOrizzontali";
                    }
                }
            }
        }
        else if (rapporti.length == 3) {
            //Nel caso di 3 foto, basta prendere il rapporto della prima. Sono per forza dello stesso orientamento (da specifica)
            if (rapporti[0] >= 1) {
                //Tre foto orizzontali
                return modelloTreFoto;
            }
            else {
                return modelloTreFotoVerticale;
            }
        }

    },

    test() {
        //alert("step1");

        img1 = getVertex(inddItemImg1, [0, 0, 0, 0]);
        img2 = getVertex(inddItemImg2, [0, 0, 0, 0]);
        img3 = getVertex(inddItemImg3, [0, 0, 0, 0]);

        //alert("step2");

        var img1_rect = getRect(img1[0].points);
        var img2_rect = getRect(img2[0].points);
        var img3_rect = getRect(img3[0].points);

        //alert(img1_rect);

        var overflow1 = checkOverflow(img1_rect);
        if (overflow1 != "") {
            //alert("IMG 1 fuori dai margini " + overflow1);
            if (overflow1.indexOf("-2") >= 0 || overflow1.indexOf("-4") >= 0) {
                modelloDiFix.offsetSteps[0][0][0] = 0;
            }

            if (overflow1.indexOf("-3") >= 0 || overflow1.indexOf("-5") >= 0) {
                modelloDiFix.offsetSteps[0][0][1] = 0;
            }
        }

        var overflow2 = checkOverflow(img2_rect);
        if (overflow2 != "") {
            //alert("IMG 2 fuori dai margini " + overflow2);
            if (overflow2.indexOf("-2") >= 0 || overflow2.indexOf("-4") >= 0) {
                modelloDiFix.offsetSteps[1][0][0] = 0;
            }

            if (overflow2.indexOf("-3") >= 0 || overflow2.indexOf("-5") >= 0) {
                modelloDiFix.offsetSteps[1][0][1] = 0;
            }
        }

        var overflow3 = checkOverflow(img3_rect);
        if (overflow3 != "") {
            //alert("IMG 3 fuori dai margini " + overflow2);
            if (overflow3.indexOf("-2") >= 0 || overflow3.indexOf("-4") >= 0) {
                modelloDiFix.offsetSteps[2][0][0] = 0;
            }

            if (overflow3.indexOf("-3") >= 0 || overflow3.indexOf("-5") >= 0) {
                modelloDiFix.offsetSteps[2][0][1] = 0;
            }
        }

        //alert("step3");


        /*
        var areaImg1 = calcolaAreaPoligono(img1[0].points);
        var areaImg2 = calcolaAreaPoligono(img2[0].points);
        var areaImg3 = calcolaAreaPoligono(img3[0].points);
       
        //Sovrapposizione tra foto 1 e 2
        var sovrapposizione1=getAreaSovrapposizione(img1[0], img2[0]);
        var sovrapposizione2=getAreaSovrapposizione(img2[0], img1[0]);
        var sovrapposizione_complessiva = sovrapposizione1.concat(sovrapposizione2);
        var sovrapposizione_rect = getRect(sovrapposizione_complessiva);
        var areaSovrapposizione = (sovrapposizione_rect[2]-sovrapposizione_rect[0]) * (sovrapposizione_rect[3]-sovrapposizione_rect[1]);
        */

        var areaImg1 = (img1_rect[2] - img1_rect[0]) * (img1_rect[3] - img1_rect[1]);
        var areaImg2 = (img2_rect[2] - img2_rect[0]) * (img2_rect[3] - img2_rect[1]);
        var areaImg3 = (img3_rect[2] - img3_rect[0]) * (img3_rect[3] - img3_rect[1]);


        var areaSovrapposizione = getAreaSovrapposizione2(img1_rect, img2_rect);
        //var areaSovrapposizione = (sovrapposizione_rect[2]-sovrapposizione_rect[0]) * (sovrapposizione_rect[3]-sovrapposizione_rect[1]);

        //alert(areaSovrapposizione);

        // if (parseInt(areaSovrapposizione)<=0)
        // {
        //     //Probabilmente siamo in una casistica d esatta sovrapposizione 
        //     //Tipica per le linee di prodotti con stessa identica confezione e solo cambio gusto
        //     //Allora proviamo a risolvere estraendo i rect
        //     var rect1 = getRect(img1[0].points);
        //     var rect2 = getRect(img2[0].points);

        //     var areaCoincidente = (parseInt(rect1[0])==parseInt(rect2[0]) && parseInt(rect1[1])==parseInt(rect2[1]) && parseInt(rect1[2])==parseInt(rect2[2]) && parseInt(rect1[3])==parseInt(rect2[3]));

        //     if (areaCoincidente)
        //     {
        //         //alert("L'area coincide");
        //         areaSovrapposizione = areaImg1;
        //     }


        // }

        //alert("step4");
        //alert("1. " + areaSovrapposizione);

        var perc1 = (areaSovrapposizione / areaImg1) * 100;
        var perc2 = (areaSovrapposizione / areaImg2) * 100;
        var percErr = Math.max(perc1, perc2);

        //alert("1. " + percErr);
        //Sovrapposizione tra foto 1 e 3
        if (areaImg3 > 0) {
            //Controllo sovrapposizione tra 2 e 3
            areaSovrapposizione = getAreaSovrapposizione2(img2_rect, img3_rect);
            //areaSovrapposizione = (sovrapposizione_rect[2]-sovrapposizione_rect[0]) * (sovrapposizione_rect[3]-sovrapposizione_rect[1]);

            //alert("2. " + areaSovrapposizione + " su " + areaImg2);

            var perc1 = (areaSovrapposizione / areaImg2) * 100;
            var perc2 = (areaSovrapposizione / areaImg3) * 100;

            percErr = Math.max(Math.max(perc1, perc2), percErr);


            //Controllo sovrapposizione tra 1 e 3
            areaSovrapposizione = getAreaSovrapposizione2(img1_rect, img3_rect);
            //areaSovrapposizione = (sovrapposizione_rect[2]-sovrapposizione_rect[0]) * (sovrapposizione_rect[3]-sovrapposizione_rect[1]);

            //alert("2. " + areaSovrapposizione + " su " + areaImg2);

            perc1 = (areaSovrapposizione / areaImg2) * 100;
            perc2 = (areaSovrapposizione / areaImg3) * 100;

            percErr = Math.max(Math.max(perc1, perc2), percErr);
        }

        //alert(percErr);

        return percErr;

    },

    getAllineamentiDB(callback){

        let me=this;
        var xhr = new XMLHttpRequestClient();
    
        xhr.onload = async (objResult, parsed) => {
            try {

                if (!parsed) {
                    try {
                        
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code CSF-002: Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                
                me.semaforoDownloadFramework = false;

                // Chiamata alla callback con il risultato ottenuto
                if (callback) {
                    try
                    {
                        var allineamentiDB = objResult;
                        fs.writeFileSync(pathLavorazione + "/allineamenti.json", JSON.stringify(allineamentiDB));
                        callback(null, allineamentiDB); // Passiamo `null` come primo argomento per indicare che non c'è errore
                    }catch(e){
                        //console.error(e);  
                    }
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


        xhr.send("FrameworkCssController/scaricaAllineamenti", null, "GET");

    },

    /*
     * Mappa degli elementi del box indicizzata per etichetta: e' cio' su cui lavorano
     * ridimensionamenti e allineamenti.
     *
     * L'etichetta viene normalizzata togliendo quello che segue il $, cosi' "descrizione$1"
     * e "descrizione" sono la stessa cosa. Per le copie delle duplicazioni quel taglio sarebbe
     * rovinoso: due ombre finirebbero sulla stessa chiave e la seconda cancellerebbe la prima.
     * Le foto sono gia' un'eccezione dentro Utility.parseLabel per lo stesso motivo.
     */
    creaMappaturaBoxOriginale(box, prefissiDerivati) {
        var mappaElementi = {};
        try {
            //facciamo una mappatura degli elementi del box di cui la chiave di ricerca sarà la label
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                if (item.label) {
                    let relativeBounds = [
                        item.geometricBounds[0] - box.geometricBounds[0],
                        item.geometricBounds[1] - box.geometricBounds[1],
                        item.geometricBounds[2] - box.geometricBounds[0],
                        item.geometricBounds[3] - box.geometricBounds[1]
                    ];

                    // Ensure bounds do not exceed the box boundaries
                    relativeBounds[0] = Math.max(relativeBounds[0], 0);
                    relativeBounds[1] = Math.max(relativeBounds[1], 0);
                    relativeBounds[2] = Math.min(relativeBounds[2], box.geometricBounds[2] - box.geometricBounds[0]);
                    relativeBounds[3] = Math.min(relativeBounds[3], box.geometricBounds[3] - box.geometricBounds[1]);

                    var chiaveElemento = cssComposizioneBox.etichettaDerivata(item.label, prefissiDerivati)
                        ? item.label
                        : Utility.parseLabel(item.label);

                    mappaElementi[chiaveElemento] = {
                        item: item,
                        label: chiaveElemento,
                        bounds: relativeBounds, // Adjusted bounds relative to the box
                        eliminato: false
                    };
                }
            }
        } catch (err) {
            console.log(err);
        }

        return mappaElementi;
    },

    updateMap(mappaBoxOriginale) {
        //scorriamp la mappaBoxOriginale per vedere quali elementi sono ancora validi, se non lo sono impostiamo eliminato=true
        for (var key in mappaBoxOriginale) {
            if (mappaBoxOriginale.hasOwnProperty(key)) {
                var elemento = mappaBoxOriginale[key];
                if (!elemento.item.isValid) {
                    elemento.eliminato = true;
                }
            }
        }

        return mappaBoxOriginale;
    },

    /*
     * Aggiunge alla mappa gli elementi comparsi dopo che e' stata creata.
     * Le copie delle duplicazioni nascono a valle degli allineamenti: senza questo passaggio
     * le regole eseguite in un momento successivo non le vedrebbero affatto.
     */
    aggiungiNuoviElementiAllaMappa(box, mappaBoxOriginale, prefissiDerivati) {
        if (box == null || !box.isValid || mappaBoxOriginale == null) {
            return mappaBoxOriginale;
        }

        try {
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                if (item == null || !item.isValid || !item.label) {
                    continue;
                }

                var chiaveElemento = cssComposizioneBox.etichettaDerivata(item.label, prefissiDerivati)
                    ? item.label
                    : Utility.parseLabel(item.label);

                var gia = mappaBoxOriginale[chiaveElemento];
                if (gia != null && gia.item != null && gia.item.isValid) {
                    continue;
                }

                var relativeBounds = [
                    item.geometricBounds[0] - box.geometricBounds[0],
                    item.geometricBounds[1] - box.geometricBounds[1],
                    item.geometricBounds[2] - box.geometricBounds[0],
                    item.geometricBounds[3] - box.geometricBounds[1]
                ];

                mappaBoxOriginale[chiaveElemento] = {
                    item: item,
                    label: chiaveElemento,
                    bounds: relativeBounds,
                    eliminato: false
                };
            }
        }
        catch (err) {
            console.log(err);
        }

        return mappaBoxOriginale;
    },

    /*
     * Le regole del box, cercate prima fra quelle del kit e poi fra quelle di default.
     * La stessa ricerca serviva in piu' punti: tenerla in un posto solo evita che divergano.
     */
    getElementoBoxDB(box, DBallineamenti, DBDefault) {
        if (box == null) {
            return null;
        }

        var meccanica = box.label;
        var elementoBox = DBallineamenti ? DBallineamenti.find(el => el.nomiBox != null && el.nomiBox.includes(meccanica)) : null;
        if (elementoBox == null) {
            elementoBox = DBDefault ? DBDefault.find(el => el.nomiBox != null && el.nomiBox.includes(meccanica)) : null;
        }

        return elementoBox;
    },

    getPrefissiDerivati(box, DBallineamenti, DBDefault) {
        var elementoBox = this.getElementoBoxDB(box, DBallineamenti, DBDefault);
        return elementoBox != null ? cssComposizioneBox.prefissiDerivati(elementoBox.duplicazioni) : [];
    },

    /*
     * Preferenza del box su come scegliere lo spazio delle foto. Null: area massima, come sempre.
     */
    getSceltaSpazioFoto(box) {
        var contesto = this.contestoCss;
        if (contesto == null || box == null) {
            return null;
        }

        var elementoBox = this.getElementoBoxDB(box, contesto.DBallineamenti, contesto.DBDefault);
        return elementoBox != null ? elementoBox.sceltaSpazioFoto : null;
    },

    /*
     * Spazio da riservare attorno alle foto, per lato, in millimetri.
     *
     * La regola del box (estensioniFoto) usa le stesse espressioni dei post ridimensionamenti:
     * un numero, oppure un'etichetta con le sue specifiche, come "sy_ombra*[H][50%]" per meta'
     * dell'altezza dell'ombra. Si misura sul box com'e' adesso, non sulla mappa d'origine,
     * perche' gli elementi derivati nascono dopo quella mappa. Un'etichetta che nel box non
     * c'e', o che c'e' ma e' invisibile, azzera il lato: non c'e' nulla per cui fare spazio.
     */
    getEstensioniFoto(box) {
        var vuote = { alto: 0, sinistra: 0, basso: 0, destra: 0 };
        var contesto = this.contestoCss;
        if (contesto == null || box == null || !box.isValid) {
            return vuote;
        }

        var elementoBox = this.getElementoBoxDB(box, contesto.DBallineamenti, contesto.DBDefault);
        var regola = elementoBox != null ? elementoBox.estensioniFoto : null;
        if (regola == null) {
            return vuote;
        }

        try {
            var mappaCorrente = this.creaMappaturaBoxOriginale(box, contesto.prefissiDerivati);
            for (var chiave in mappaCorrente) {
                var voce = mappaCorrente[chiave];
                if (voce == null || voce.item == null || !voce.item.isValid || voce.item.visible === false) {
                    delete mappaCorrente[chiave];
                }
            }

            var valuta = function (espressione, asse) {
                var valore = CssFramework.calcolaValoreDimensione(espressione, asse, mappaCorrente, box);
                return valore != null && isFinite(valore) && valore > 0 ? valore : 0;
            };

            return {
                alto: valuta(regola.alto, "height"),
                sinistra: valuta(regola.sinistra, "width"),
                basso: valuta(regola.basso, "height"),
                destra: valuta(regola.destra, "width")
            };
        }
        catch (e) {
            console.error("Code CSF-17: estensioni foto del box " + box.label + " non calcolate: " + e);
            return vuote;
        }
    },

    /*
     * Contesto dell'ultima applicazione del CSS a un box: consente ai passaggi successivi
     * (scelta dello spazio foto, operazioni del momento dopoFixFoto, ricomposizione) di
     * lavorare senza rileggere il file delle regole a ogni box.
     */
    contestoCss: null,

    memorizzaContestoCss(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DBallineamenti, DBDefault) {
        this.contestoCss = {
            etichettaBox: box != null ? box.label : null,
            boundsBoxImpaginato: boundsBoxImpaginato,
            mappaBoxOriginale: mappaBoxOriginale,
            itemRef: itemRef,
            DBallineamenti: DBallineamenti,
            DBDefault: DBDefault,
            prefissiDerivati: this.getPrefissiDerivati(box, DBallineamenti, DBDefault)
        };

        return this.contestoCss;
    },

    applicaRidimensionamento(box, boxInGrigliaBounds, mappaBoxOriginale, itemRef, DBallineamenti, DBDef) {
        try{

            etichetteSegnalate = [];

            let wBOX_ridimensionato = boxInGrigliaBounds[3] - boxInGrigliaBounds[1];
            let hBOX_ridimensionato = boxInGrigliaBounds[2] - boxInGrigliaBounds[0];
    
            var boxOriginalBounds = box.geometricBounds.slice();
    
            //mappiamo il box
            var boundsVisibleBox = null;
            //calcoliamo i bounds del box usando i bounds dei suoi elementi visibili, prendiamo [minY, minX, maxY, maxX]
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                //dobbiamo controllare se lui o uno dei suoi genitori è nascosto
                var parent = item.parent;
                var itemVisible = item.visible;
                while (parent.constructorName != "Spread" && parent.constructorName != "Document") {
                    if (!parent.visible) {
                        itemVisible = false;
                        break;
                    }
                    parent = parent.parent;
                }

                if (itemVisible && item.geometricBounds) {
                    if (!boundsVisibleBox) {
                        boundsVisibleBox = item.geometricBounds.slice();
                    } else {
                        if (item.geometricBounds[0] < boundsVisibleBox[0])
                            boundsVisibleBox[0] = item.geometricBounds[0];
                        if (item.geometricBounds[1] < boundsVisibleBox[1])
                            boundsVisibleBox[1] = item.geometricBounds[1];
                        if (item.geometricBounds[2] > boundsVisibleBox[2])
                            boundsVisibleBox[2] = item.geometricBounds[2];
                        if (item.geometricBounds[3] > boundsVisibleBox[3])
                            boundsVisibleBox[3] = item.geometricBounds[3];
                    }
                }
            }

            //li confrontiamo con i bounds del box e per ognuno prendiamo quello che darebbe il box più piccolo
            if (!boundsVisibleBox) {
                //Se non ci sono elementi visibili usiamo i bounds del box
                boundsVisibleBox = box.geometricBounds.slice();
            } else {
                if (boxOriginalBounds[0] > boundsVisibleBox[0])
                    boundsVisibleBox[0] = boxOriginalBounds[0];
                if (boxOriginalBounds[1] > boundsVisibleBox[1])
                    boundsVisibleBox[1] = boxOriginalBounds[1];
                if (boxOriginalBounds[2] < boundsVisibleBox[2])
                    boundsVisibleBox[2] = boxOriginalBounds[2];
                if (boxOriginalBounds[3] < boundsVisibleBox[3])
                    boundsVisibleBox[3] = boxOriginalBounds[3];
            }

            let wBOX = boundsVisibleBox[3] - boundsVisibleBox[1];
            let hBOX = boundsVisibleBox[2] - boundsVisibleBox[0];

            let percIngrandimentoX = wBOX_ridimensionato / wBOX;
            let percIngrandimentoY = hBOX_ridimensionato / hBOX;

            var diff_x =  wBOX_ridimensionato - wBOX;
            var diff_y =  hBOX_ridimensionato - hBOX;
            var meccanica = box.label;


            var elementDB = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementDBDefault = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.length == 0) : null;

            var elementDefaultDB = DBDef ? DBDef.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementDefaultDBDefault = DBDef ? DBDef.find(el => el.nomiBox.length == 0) : null;


            if (!elementDB && !elementDBDefault) {
                console.error("Non è stato trovato nessun allineamento per la meccanica " + meccanica + " e l'allineamento di default non è definito");
                return;
            }

            var listFitToDo = [];

            for (var $gn = 0; $gn < box.allPageItems.length; $gn++) {
                var item = box.allPageItems[$gn];
                if(item.label == ""){
                    continue;
                }

                //cerchiamo nell'allineamento.ridimensionamenti l'elemento che contiene il nome dell'elemento, prendiamo l'ultimo se ce ne sono più di uno
                    
                var ridimensionamentoElemento = null;
                if(elementDB){
                    ridimensionamentoElemento = elementDB.ridimensionamenti.find(el => {
                        return el.gruppoEtichette.some(etichetta => {
                            if (etichetta.includes('*')) {
                                // Convert the wildcard pattern to a regular expression
                                var regex = this.makeRegexFromGroupName(etichetta);
                                return regex.test(Utility.parseLabel(item.label));
                            } else {
                                return etichetta === Utility.parseLabel(item.label);
                            }
                        });
                    });

                    if(ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null){
                        var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                        if(!condizioneValida){
                            ridimensionamentoElemento = null;
                        }
                    }
                }

                //proviamo a cercarlo in quello di default
                if (!ridimensionamentoElemento && elementDBDefault) {
                    ridimensionamentoElemento = elementDBDefault.ridimensionamenti.find(el => {
                        return el.gruppoEtichette.some(etichetta => {
                            if (etichetta.includes('*')) {
                                // Convert the wildcard pattern to a regular expression
                                var regex = this.makeRegexFromGroupName(etichetta);
                                return regex.test(Utility.parseLabel(item.label));
                            } else {
                                return etichetta === Utility.parseLabel(item.label);
                            }
                        });
                    });

                    if(ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null){
                        var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                        if(!condizioneValida){
                            ridimensionamentoElemento = null;
                        }
                    }
                }

                //se non è stato trovato l'elemento prendiamo se c'è dove gruppoEtichette è vuoto se c'è
                if (!ridimensionamentoElemento && elementDB) {
                    ridimensionamentoElemento = elementDB.ridimensionamenti.find(el => el.gruppoEtichette.length == 0);

                    if(ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null){
                        var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                        if(!condizioneValida){
                            ridimensionamentoElemento = null;
                        }
                    }
                }

                if (!ridimensionamentoElemento && elementDBDefault) {
                    ridimensionamentoElemento = elementDBDefault.ridimensionamenti.find(el => el.gruppoEtichette.length == 0);

                    if(ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null){
                        var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                        if(!condizioneValida){
                            ridimensionamentoElemento = null;
                        }
                    }
                }

                if (!ridimensionamentoElemento) {
                    if (elementDefaultDB) {
                        ridimensionamentoElemento = elementDefaultDB.ridimensionamenti.find(el => {
                            return el.gruppoEtichette.some(etichetta => {
                                if (etichetta.includes('*')) {
                                    // Convert the wildcard pattern to a regular expression
                                    var regex = this.makeRegexFromGroupName(etichetta);
                                    return regex.test(Utility.parseLabel(item.label));
                                } else {
                                    return etichetta === Utility.parseLabel(item.label);
                                }
                            });
                        });

                        if (ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null) {
                            var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                            if (!condizioneValida) {
                                ridimensionamentoElemento = null;
                            }
                        }
                    }

                    //proviamo a cercarlo in quello di default
                    if (!ridimensionamentoElemento && elementDefaultDBDefault) {
                        ridimensionamentoElemento = elementDefaultDBDefault.ridimensionamenti.find(el => {
                            return el.gruppoEtichette.some(etichetta => {
                                if (etichetta.includes('*')) {
                                    // Convert the wildcard pattern to a regular expression
                                    var regex = this.makeRegexFromGroupName(etichetta);
                                    return regex.test(Utility.parseLabel(item.label));
                                } else {
                                    return etichetta === Utility.parseLabel(item.label);
                                }
                            });
                        });

                        if (ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null) {
                            var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                            if (!condizioneValida) {
                                ridimensionamentoElemento = null;
                            }
                        }
                    }

                    //se non è stato trovato l'elemento prendiamo se c'è dove gruppoEtichette è vuoto se c'è
                    if (!ridimensionamentoElemento && elementDefaultDB) {
                        ridimensionamentoElemento = elementDefaultDB.ridimensionamenti.find(el => el.gruppoEtichette.length == 0);

                        if (ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null) {
                            var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                            if (!condizioneValida) {
                                ridimensionamentoElemento = null;
                            }
                        }
                    }

                    if (!ridimensionamentoElemento && elementDefaultDBDefault) {
                        ridimensionamentoElemento = elementDefaultDBDefault.ridimensionamenti.find(el => el.gruppoEtichette.length == 0);

                        if (ridimensionamentoElemento && ridimensionamentoElemento.listSetCondizioni != null) {
                            var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, ridimensionamentoElemento.listSetCondizioni, box);
                            if (!condizioneValida) {
                                ridimensionamentoElemento = null;
                            }
                        }
                    }
                }

                if (!ridimensionamentoElemento) {
                    console.warn("Non è stato trovato nessun ridimensionamento per l'elemento " + Utility.parseLabel(item.label) + " della meccanica " + meccanica);
                    continue;
                }

                

                //controlliamo il tipo di ridimensionamento su X e Y (Ridimensionamento.X e Ridimensionamento.Y)
                var ridX = this.enumAxisResizeMode(ridimensionamentoElemento.ridimensionamento.x);
                var ridY = this.enumAxisResizeMode(ridimensionamentoElemento.ridimensionamento.y);


                switch (ridX) {
                    case "proporzionale":
                        //Ridimensionamento proporzionale
                        //usiamo la percentuale di ingrandimento calcolata per modificare i bounds
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1] * percIngrandimentoX,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3] * percIngrandimentoX,
                        ];
                        break;
                    case "ingrandimento_lineare":
                        //allarghiamo l'elemento aggiungendo al bounds 3 la diff_x
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3] + diff_x
                        ];
                        break;
                    case "spostamento_lineare":
                        //spostiamo l'elemento aggiungendo ai bounds 1,3 la diff_x
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],      
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1] + diff_x,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3] + diff_x
                        ];
                        break;
                    case "spostamento_lineare_centrato":
                        //spostiamo l'elemento aggiungendo ai bounds 1,3 la diff_x
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1] + diff_x/2,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3] + diff_x/2
                        ];
                        break;
                    default:
                        //niente
                        break;
                }

                switch (ridY) {
                    case "proporzionale":
                        //Ridimensionamento proporzionale
                        //usiamo la percentuale di ingrandimento calcolata per modificare i bounds
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0] * percIngrandimentoY,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2] * percIngrandimentoY,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3],
                        ];
                        break;
                    case "ingrandimento_lineare":
                        //allarghiamo l'elemento aggiungendo al bounds 2 la diff_y
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2] + diff_y,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3]
                        ];
                        break;
                    case "spostamento_lineare":
                        //spostiamo l'elemento aggiungendo ai bounds 0,2 la diff_y
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0] + diff_y,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2] + diff_y,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3]
                        ];
                        break;
                    case "spostamento_lineare_centrato":
                        //spostiamo l'elemento aggiungendo ai bounds 0,2 la diff_y
                        mappaBoxOriginale[Utility.parseLabel(item.label)].bounds = [
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0] + diff_y/2,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2] + diff_y/2,
                            mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3]
                        ];
                        break;
                    default:
                        //niente
                        break;
                }

                if (mappaBoxOriginale[Utility.parseLabel(item.label)]) {
                    //applichiamo i nuovi bounds all'elemento

                    if(ridY != null){
                        if (ridY == "spostamento_lineare" || ridY == "spostamento_lineare_centrato") {
                            var spostamento = ridY == "spostamento_lineare_centrato" ? diff_y/2 : diff_y;

                            //controlliamo che lo spostamento non porti l'elemento fuori dal boxInGrigliaBounds, nel caso lo limitiamo
                            // if(item.geometricBounds[0] + spostamento < boxOriginalBounds[0]){
                            //     spostamento = boxOriginalBounds[0] - item.geometricBounds[0];
                            // }
                            // if(item.geometricBounds[2] + spostamento > boxOriginalBounds[2]){
                            //     spostamento = boxOriginalBounds[2] - item.geometricBounds[2];
                            // }
                            if(item.geometricBounds[0] + spostamento < boxInGrigliaBounds[0]){
                                spostamento = boxInGrigliaBounds[0] - item.geometricBounds[0];
                            }
                            if(item.geometricBounds[2] + spostamento > boxInGrigliaBounds[2]){
                                spostamento = boxInGrigliaBounds[2] - item.geometricBounds[2];
                            }
                            item.move(undefined, [0,spostamento]);
                        }
                        else {
                            item.geometricBounds = [
                                boxOriginalBounds[0] + mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[0],
                                item.geometricBounds[1],
                                boxOriginalBounds[0] + mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[2],
                                item.geometricBounds[3]
                            ];
                        }
                    }

                    if (ridX != null) {
                        if (ridX == "spostamento_lineare" || ridX == "spostamento_lineare_centrato") {
                            var spostamento = ridX == "spostamento_lineare_centrato" ? diff_x / 2 : diff_x;

                            //controlliamo che lo spostamento non porti l'elemento fuori dal box, nel caso lo limitiamo
                            if(item.geometricBounds[1] + spostamento < boxInGrigliaBounds[1]){
                                spostamento = boxInGrigliaBounds[1] - item.geometricBounds[1];
                            }
                            if(item.geometricBounds[3] + spostamento > boxInGrigliaBounds[3]){
                                spostamento = boxInGrigliaBounds[3] - item.geometricBounds[3];
                            }
                            item.move(undefined, [spostamento, 0]);
                        }
                        else {
                            item.geometricBounds = [
                                item.geometricBounds[0],
                                boxOriginalBounds[1] + mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[1],
                                item.geometricBounds[2],
                                boxOriginalBounds[1] + mappaBoxOriginale[Utility.parseLabel(item.label)].bounds[3]
                            ];
                        }
                    }
                }


                //facciamo un controllo che l'elemento sia ancora dentro il box, se non lo è lo riportiamo dentro
                // if (mappaBoxOriginale[item.label] && !item.label.startsWith ("base")) {
                //     //controllo superiore
                //     if (boxOriginalBounds[0] + mappaBoxOriginale[item.label].bounds[0] < boxInGrigliaBounds[0]) {
                //         let diffFuori = boxInGrigliaBounds[0] - (boxOriginalBounds[0] + mappaBoxOriginale[item.label].bounds[0]);
                //         //spostiamo l'elemento dentro
                //         item.move(undefined, [0, -diffFuori]);
                //     }
                //     //controllo sinistro
                //     if (boxOriginalBounds[1] + mappaBoxOriginale[item.label].bounds[1] < boxInGrigliaBounds[1]) {
                //         let diffFuori = boxInGrigliaBounds[1] - (boxOriginalBounds[1] + mappaBoxOriginale[item.label].bounds[1]);
                //         //spostiamo l'elemento dentro
                //         item.move(undefined, [-diffFuori, 0]);
                //     }
                //     //controllo inferiore
                //     if (boxOriginalBounds[0] + mappaBoxOriginale[item.label].bounds[2] > boxInGrigliaBounds[2]) {
                //         let diffFuori = (boxOriginalBounds[0] + mappaBoxOriginale[item.label].bounds[2]) - boxInGrigliaBounds[2];
                //         //spostiamo l'elemento dentro
                //         item.move(undefined, [0, -diffFuori]);
                //     }
                //     //controllo destro
                //     if (boxOriginalBounds[1] + mappaBoxOriginale[item.label].bounds[3] > boxInGrigliaBounds[3]) {
                //         let diffFuori = (boxOriginalBounds[1] + mappaBoxOriginale[item.label].bounds[3]) - boxInGrigliaBounds[3];
                //         //spostiamo l'elemento dentro
                //         item.move(undefined, [-diffFuori, 0]);
                //     }
                // }
                
                //se il campo appena ridimensionato è un textFrame ed è in overflow

                var itemContained = this.getItemContained(item);
                for (var c = 0; c < itemContained.length; c++) {
                    var itemC = itemContained[c];
                    if (itemC.constructorName == "TextFrame") {
                        if (itemC.overflows) {
                            applyOverflowFix(boxInGrigliaBounds, itemC);
                        }
                    }
                }
                //se è un gruppo scorriamo i suoi elementi interni

                if(ridimensionamentoElemento.finalFit && ridimensionamentoElemento.finalFit.length > 0){
                    //cerchiamo se l'item è in lista di FinalFit
                    //facciamo la regex
                    for(var f=0; f<ridimensionamentoElemento.finalFit.length; f++){
                        var fit = ridimensionamentoElemento.finalFit[f];
                        if (fit.nomiElementi.some(etichetta => {
                            if (etichetta.includes('*')) {
                                // Convert the wildcard pattern to a regular expression
                                var regex = this.makeRegexFromGroupName(etichetta);
                                return regex.test(Utility.parseLabel(item.label));
                            } else {
                                return etichetta === Utility.parseLabel(item.label);
                            }
                        })) {
                            listFitToDo.push(fit);
                            break;
                        }
                    }
                }
            }

            if(listFitToDo.length > 0){
                //rimuoviamo i duplicati (se un elemento è presente più volte in lista)
                this.finalFit(mappaBoxOriginale, listFitToDo);
            }

        }
        catch (error) {
            //console.error("Errore nel ridimensionamentoCustom della box " + box.label);
            console.error(error);
        }
    },

    applicaPostRidimensionamento(box, mappaBoxOriginale, itemRef, DBallineamenti, DBDef) {
        try {

            mappaBoxOriginale = CssFramework.updateMap(mappaBoxOriginale);

            var meccanica = box.label;
            var elementDB = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementDBDefault = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.length == 0) : null;

            var elementDefaultDB = DBDef ? DBDef.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementDefaultDBDefault = DBDef ? DBDef.find(el => el.nomiBox.length == 0) : null;

            if (!elementDB && !elementDBDefault) {
                console.error("Non è stato trovato nessun allineamento per la meccanica " + meccanica + " e l'allineamento di default non è definito");
                return;
            }

            var listPostRidimensionamenti = [];

            if (elementDefaultDBDefault) {
                for (var i = 0; i < elementDefaultDBDefault.postRidimensionamenti.length; i++) {
                    var postRidimensionamento = elementDefaultDBDefault.postRidimensionamenti[i];

                    // cerchiamo se il NomeGruppo è presente in elementDefaultDB, elementDB o elementDBDefault, se c'è per ora saltiamo
                    if ((elementDefaultDB && elementDefaultDB.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo)) ||
                        (elementDB && elementDB.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo)) ||
                        (elementDBDefault && elementDBDefault.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo))) {
                        continue;
                    }

                    listPostRidimensionamenti.push(postRidimensionamento);

                    // // recuperiamo tutti gli elementi listati in gruppoEtichette
                    // var gruppoElementi = [];
                    // for (var j = 0; j < postRidimensionamento.gruppoEtichette.length; j++) {
                    //     var labelElemento = postRidimensionamento.gruppoEtichette[j];
                    //     var isItemLinkLabel = /\[itemLink\]$/i.test(labelElemento);
                        
                    //     var regex = this.makeRegexFromGroupName(labelElemento);
                    //     for (var key in mappaBoxOriginale) {
                    //         if (regex.test(key)) {
                    //             gruppoElementi.push({
                    //                 elemento: mappaBoxOriginale[key],
                    //                 isItemLink: isItemLinkLabel
                    //             });
                    //         }
                    //     }
                    // }

                    // // qui inseriremo i PostRidimensionamenti
                    // for (var k = 0; k < gruppoElementi.length; k++) {
                    //     var elemento = gruppoElementi[k];
                    //     this.applicaPostRidimensionamenti(elemento.elemento, mappaBoxOriginale, itemRef, postRidimensionamento.ridimensionamenti, box, elemento.isItemLink);
                    // }

                    // if (postRidimensionamento.finalFit && postRidimensionamento.finalFit.length > 0) {
                    //     this.finalFit(mappaBoxOriginale, postRidimensionamento.finalFit);
                    // }
                }
            }

            // ripetiamo per elementDefaultDB se esiste
            if (elementDefaultDB) {
                for (var i = 0; i < elementDefaultDB.postRidimensionamenti.length; i++) {
                    var postRidimensionamento = elementDefaultDB.postRidimensionamenti[i];

                    // cerchiamo se il NomeGruppo è presente in elementDB o elementDBDefault, se c'è per ora saltiamo
                    if ((elementDB && elementDB.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo)) ||
                        (elementDBDefault && elementDBDefault.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo))) {
                        continue;
                    }

                    listPostRidimensionamenti.push(postRidimensionamento);


                    // // recuperiamo tutti gli elementi listati in gruppoEtichette
                    // var gruppoElementi = [];
                    // for (var j = 0; j < postRidimensionamento.gruppoEtichette.length; j++) {
                    //     var labelElemento = postRidimensionamento.gruppoEtichette[j];
                    //     var isItemLinkLabel = /\[itemLink\]$/i.test(labelElemento);
                    //     var regex = this.makeRegexFromGroupName(labelElemento);
                    //     for (var key in mappaBoxOriginale) {
                    //         if (regex.test(key)) {
                    //             gruppoElementi.push({
                    //                 elemento: mappaBoxOriginale[key],
                    //                 isItemLink: isItemLinkLabel
                    //             });
                    //         }
                    //     }
                    // }

                    // // qui inseriremo i PostRidimensionamenti
                    // for (var k = 0; k < gruppoElementi.length; k++) {
                    //     var elemento = gruppoElementi[k];
                    //     this.applicaPostRidimensionamenti(elemento.elemento, mappaBoxOriginale, itemRef, postRidimensionamento.ridimensionamenti, box, elemento.isItemLink);
                    // }

                    // if (postRidimensionamento.finalFit && postRidimensionamento.finalFit.length > 0) {
                    //     this.finalFit(mappaBoxOriginale, postRidimensionamento.finalFit);
                    // }
                }
            }



            if (elementDBDefault) {
                for (var i = 0; i < elementDBDefault.postRidimensionamenti.length; i++) {
                    var postRidimensionamento = elementDBDefault.postRidimensionamenti[i];

                    //cerchiamo se il NomeGruppo è presente in elementDB, se c'è per ora saltiamo
                    if (elementDB) {
                        if (elementDB.postRidimensionamenti.find(el => el.nomeGruppo == postRidimensionamento.nomeGruppo)) {
                            continue;
                        }
                    }

                    listPostRidimensionamenti.push(postRidimensionamento);


                    // //recuperiamo tutti gli elementi listati in gruppoEtichette
                    // var gruppoElementi = [];
                    // for (var j = 0; j < postRidimensionamento.gruppoEtichette.length; j++) {
                    //     var labelElemento = postRidimensionamento.gruppoEtichette[j];
                    //     var isItemLinkLabel = /\[itemLink\]$/i.test(labelElemento);
                    //     var regex = this.makeRegexFromGroupName(labelElemento);
                    //     for (var key in mappaBoxOriginale) {
                    //         if (regex.test(key)) {
                    //             gruppoElementi.push({
                    //                 elemento: mappaBoxOriginale[key],
                    //                 isItemLink: isItemLinkLabel
                    //             });
                    //         }
                    //     }
                    // }

                    // //qui inseriremo i PostRidimensionamenti
                    // for (var k = 0; k < gruppoElementi.length; k++) {
                    //     var elemento = gruppoElementi[k];
                    //     this.applicaPostRidimensionamenti(elemento.elemento, mappaBoxOriginale, itemRef, postRidimensionamento.ridimensionamenti, box, elemento.isItemLink);
                    // }

                    // if (postRidimensionamento.finalFit && postRidimensionamento.finalFit.length > 0) {
                    //     this.finalFit(mappaBoxOriginale, postRidimensionamento.finalFit);
                    // }
                }
            }


            //ripetiamo per elementDB se esiste
            if (elementDB) {
                for (var i = 0; i < elementDB.postRidimensionamenti.length; i++) {
                    var postRidimensionamento = elementDB.postRidimensionamenti[i];
                    listPostRidimensionamenti.push(postRidimensionamento);


                    // //recuperiamo tutti gli elementi listati in gruppoEtichette
                    // var gruppoElementi = [];
                    // for (var j = 0; j < postRidimensionamento.gruppoEtichette.length; j++) {
                    //     var labelElemento = postRidimensionamento.gruppoEtichette[j];
                    //     var isItemLinkLabel = /\[itemLink\]$/i.test(labelElemento);
                    //     var regex = this.makeRegexFromGroupName(labelElemento);
                    //     for (var key in mappaBoxOriginale) {
                    //         if (regex.test(key)) {
                    //             gruppoElementi.push({
                    //                 elemento: mappaBoxOriginale[key],
                    //                 isItemLink: isItemLinkLabel
                    //             });
                    //         }
                    //     }
                    // }

                    // //qui inseriremo i PostRidimensionamenti
                    // for (var k = 0; k < gruppoElementi.length; k++) {
                    //     var elemento = gruppoElementi[k];
                    //     this.applicaPostRidimensionamenti(elemento.elemento, mappaBoxOriginale, itemRef, postRidimensionamento.ridimensionamenti, box, elemento.isItemLink);
                    // }

                    // if (postRidimensionamento.finalFit && postRidimensionamento.finalFit.length > 0) {
                    //     this.finalFit(mappaBoxOriginale, postRidimensionamento.finalFit);
                    // }
                }
            }

            listPostRidimensionamenti = listPostRidimensionamenti.sort((a, b) => {a.ordine - b.ordine});

            for (var i = 0; i < listPostRidimensionamenti.length; i++) {
                var postRidimensionamento = listPostRidimensionamenti[i];
                // recuperiamo tutti gli elementi listati in gruppoEtichette
                var gruppoElementi = [];
                for (var j = 0; j < postRidimensionamento.gruppoEtichette.length; j++) {
                    var labelElemento = postRidimensionamento.gruppoEtichette[j];
                    var isItemLinkLabel = /\[itemLink\]$/i.test(labelElemento);

                    var regex = this.makeRegexFromGroupName(labelElemento);
                    for (var key in mappaBoxOriginale) {
                        if (regex.test(key)) {
                            gruppoElementi.push({
                                elemento: mappaBoxOriginale[key],
                                isItemLink: isItemLinkLabel
                            });
                        }
                    }
                }

                // qui inseriremo i PostRidimensionamenti
                for (var k = 0; k < gruppoElementi.length; k++) {
                    var elemento = gruppoElementi[k];
                    this.applicaPostRidimensionamenti(elemento.elemento, mappaBoxOriginale, itemRef, postRidimensionamento.ridimensionamenti, box, elemento.isItemLink);
                }

                if (postRidimensionamento.finalFit && postRidimensionamento.finalFit.length > 0) {
                    this.finalFit(mappaBoxOriginale, postRidimensionamento.finalFit);
                }
            }

        }
        catch (error) {
            //console.error("Errore nel ridimensionamentoCustom della box " + box.label);
            console.error(error);
        }
    },

    applicaPostRidimensionamenti(elemento, mappaBoxOriginale, itemRef, listaPostRidimensionamenti, box, isItemLink) {
        try {
            if (!elemento || elemento.eliminato) {
                return;
            }

            if (isItemLink === undefined) {
                isItemLink = false;
            }

            // target su cui applicare i geometricBounds
            var targetItem = elemento.item;
            if (isItemLink && targetItem && targetItem.graphics && targetItem.graphics.length > 0) {
                try {
                    targetItem = targetItem.graphics.item(0);
                } catch (e) {
                    // se qualcosa va storto, ripieghiamo sul container
                    return;
                }
            }

            //listaPostRidimensionamenti è una lista di oggetti con le seguenti proprietà: 
            // - instructionX: string (andrà decodificata)
            // - instructionY: string (andrà decodificata)
            // - setWidth: float (se presente la larghezza dell'elemento sarà impostata a questo valore)
            // - setHeight: float (se presente l'altezza dell'elemento sarà impostata a questo valore)
            // - ListSetCondizioni: array di condizioni

            for (var i = 0; i < listaPostRidimensionamenti.length; i++) {
                var postRidimensionamento = listaPostRidimensionamenti[i];

                if (postRidimensionamento.listSetCondizioni != null) {
                    var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, postRidimensionamento.listSetCondizioni, box);
                    if (!condizioneValida) {
                        continue;
                    }
                }

                // if(postRidimensionamento.setWidth != null){
                //     var nuovaLarghezza = postRidimensionamento.setWidth;
                //     if (typeof nuovaLarghezza === 'string' && nuovaLarghezza.endsWith('%')) {
                //         //dobbiamo stare attenti alla dicitura, i numeri frazionali potrebbero avere la virgola
                //         nuovaLarghezza = nuovaLarghezza.replace(',', '.');
                //         //è una percentuale
                //         var perc = parseFloat(nuovaLarghezza);
                //         if (!isNaN(perc)) {
                //             var larghezzaBox = itemRef.geometricBounds[3] - itemRef.geometricBounds[1];
                //             nuovaLarghezza = (larghezzaBox * perc) / 100;
                //         } else {
                //             //valore non valido, saltiamo questa istruzione
                //             nuovaLarghezza = null;
                //         }
                //     } else {
                //         nuovaLarghezza = parseFloat(nuovaLarghezza);
                //         if (isNaN(nuovaLarghezza)) {
                //             //valore non valido, saltiamo questa istruzione
                //             nuovaLarghezza = null;
                //         }
                //     }

                //     if (nuovaLarghezza != null) {
                //         //impostiamo la nuova larghezza
                //         elemento.bounds[3] = elemento.bounds[1] + nuovaLarghezza;
                //         //aggiorniamo anche i veri geometricBounds
                //         elemento.item.geometricBounds = [
                //             elemento.item.geometricBounds[0],
                //             elemento.item.geometricBounds[1],
                //             elemento.item.geometricBounds[2],
                //             elemento.item.geometricBounds[1] + nuovaLarghezza
                //         ];
                //     }
                // }

                // if(postRidimensionamento.setHeight != null){
                //     var nuovaAltezza = postRidimensionamento.setHeight;
                //     if (typeof nuovaAltezza === 'string' && nuovaAltezza.endsWith('%')) {
                //         //dobbiamo stare attenti alla dicitura, i numeri frazionali potrebbero avere la virgola
                //         nuovaAltezza = nuovaAltezza.replace(',', '.');
                //         //è una percentuale
                //         var perc = parseFloat(nuovaAltezza);
                //         if (!isNaN(perc)) {
                //             var altezzaBox = itemRef.geometricBounds[2] - itemRef.geometricBounds[0];
                //             nuovaAltezza = (altezzaBox * perc) / 100;
                //         } else {
                //             //valore non valido, saltiamo questa istruzione
                //             nuovaAltezza = null;
                //         }
                //     } else {
                //         nuovaAltezza = parseFloat(nuovaAltezza);
                //         if (isNaN(nuovaAltezza)) {
                //             //valore non valido, saltiamo questa istruzione
                //             nuovaAltezza = null;
                //         }
                //     }

                //     if (nuovaAltezza != null) {
                //         //impostiamo la nuova altezza
                //         elemento.bounds[2] = elemento.bounds[0] + nuovaAltezza;
                //         //aggiorniamo anche i veri geometricBounds
                //         elemento.item.geometricBounds = [
                //             elemento.item.geometricBounds[0],
                //             elemento.item.geometricBounds[1],
                //             elemento.item.geometricBounds[0] + nuovaAltezza,
                //             elemento.item.geometricBounds[3]
                //         ];
                //     }
                // }

                if (postRidimensionamento.setWidth != null) {
                    var nuovaLarghezza = this.calcolaValoreDimensione(
                        postRidimensionamento.setWidth,
                        "width",
                        mappaBoxOriginale,
                        box
                    );

                    if (nuovaLarghezza != null && !isNaN(nuovaLarghezza)) {
                        // aggiorno bounds "virtuali"
                        if(!isItemLink){
                            elemento.bounds[3] = elemento.bounds[1] + nuovaLarghezza;
                        }

                        // aggiorno i geometricBounds reali
                        targetItem.geometricBounds = [
                            targetItem.geometricBounds[0],
                            targetItem.geometricBounds[1],
                            targetItem.geometricBounds[2],
                            targetItem.geometricBounds[1] + nuovaLarghezza
                        ];
                    }
                }

                if (postRidimensionamento.setHeight != null) {
                    var nuovaAltezza = this.calcolaValoreDimensione(
                        postRidimensionamento.setHeight,
                        "height",
                        mappaBoxOriginale,
                        box
                    );

                    if (nuovaAltezza != null && !isNaN(nuovaAltezza)) {
                        if(!isItemLink){
                            // aggiorno bounds "virtuali"
                            elemento.bounds[2] = elemento.bounds[0] + nuovaAltezza;
                        }

                        elemento.item.geometricBounds = [
                            targetItem.geometricBounds[0],
                            targetItem.geometricBounds[1],
                            targetItem.geometricBounds[0] + nuovaAltezza,
                            targetItem.geometricBounds[3]
                        ];
                    }
                }




                //le istruzioni sono in queste possibili forme:
                // "+/-number" esempio "+10", "-5"
                // "+/-etichetta" esempio "+prezzo_promo", "-descrizione"
                // "+/-etichetta+/-number" esempio "+prezzo_promo+10", "-descrizione+5"
                // "+/-etichetta [specifica]" esempio "+prezzo_promo[50%]", "-descrizione[10%]"

                //come si interpreta:
                // -/+ number: aumenta/diminuisce il bound[2](y)[3](x) di quel numero
                // -/+ etichetta: aumenta/diminuisce il bound[2](y)[3](x) pari alla larghezza(x)/altezza(y) dell'elemento con quell'etichetta
                // qualsiasi specifica dopo un etichetta indica la percentuale della larghezza/altezza dell'elemento da usare per il calcolo, ad esempio -prezzo_promo[50%] (su y) indica che se l'elemento prezzo_promo è alto 100px, allora useremo 50px per il calcolo
                //la stringa può contenere un qualsiasi numero di istruzioni concatenate, ad esempio "+10-prezzo_promo+5+descrizione[30%]"

                //iniziamo con l'asse X
                if (postRidimensionamento.instructionX && postRidimensionamento.instructionX != "") {
                    var istruzioni = postRidimensionamento.instructionX.replace(/\s+/g, '')       // rimuove tutti gli spazi
                    .replace(/\+\+/g, '+')     // ++ → +
                    .replace(/--/g, '-')       // -- → -
                    .replace(/\+-/g, '-')      // +- → -
                    .replace(/-\+/g, '+')     // -+ → +
                    .match(/([+-][^\+-]+)/g);
                    if (istruzioni) {
                        for (var j = 0; j < istruzioni.length; j++) {
                            var istruzione = istruzioni[j];
                            var segno = istruzione.charAt(0);
                            var corpo = istruzione.substring(1);

                            if (!corpo || corpo == "") {
                                continue;
                            }

                            //controlliamo se il corpo è un numero
                            corpo = corpo.replace(',', '.');
                            var valoreNumerico = parseFloat(corpo);
                            if (!isNaN(valoreNumerico)) {
                                //è un numero
                                if (segno == "+") {
                                    if(!isItemLink){
                                        elemento.bounds[3] += valoreNumerico;
                                    }
                                    //aggiorniamo anche i veri geometricBounds
                                    targetItem.geometricBounds = [
                                        targetItem.geometricBounds[0],
                                        targetItem.geometricBounds[1],
                                        targetItem.geometricBounds[2],
                                        targetItem.geometricBounds[3] + valoreNumerico
                                    ];
                                } else {
                                    if(!isItemLink){
                                        elemento.bounds[3] -= valoreNumerico;
                                    }
                                    //aggiorniamo anche i veri geometricBounds
                                    targetItem.geometricBounds = [
                                        targetItem.geometricBounds[0],
                                        targetItem.geometricBounds[1],
                                        targetItem.geometricBounds[2],
                                        targetItem.geometricBounds[3] - valoreNumerico
                                    ];
                                }
                            }
                            else {
                                //non è un numero, controlliamo se c'è una specifica tra parentesi quadre
                                const matchSpec = corpo.match(/^([^\[\]]+)(\[(\d+(?:[.,]\d+)?)%\])?$/);
                                if (matchSpec) {
                                    var etichetta = matchSpec[1];
                                    var percentuale = matchSpec[3] ? parseFloat(matchSpec[3].replace(',', '.')) : 100;

                                    //cerchiamo l'elemento con quell'etichetta
                                    var regex = this.makeRegexFromGroupName(etichetta);
                                    var elementoRiferimento = null;
                                    for (var key in mappaBoxOriginale) {
                                        if (regex.test(key)) {
                                            elementoRiferimento = mappaBoxOriginale[key];
                                            break;
                                        }
                                    }

                                    if (elementoRiferimento) {
                                        var larghezzaElementoRiferimento = elementoRiferimento.bounds[3] - elementoRiferimento.bounds[1];
                                        var valoreDaUsare = (larghezzaElementoRiferimento * percentuale) / 100;
                                        if (segno == "+") {
                                            if(!isItemLink){
                                                elemento.bounds[3] += valoreDaUsare;
                                            }
                                            //aggiorniamo anche i veri geometricBounds
                                            targetItem.geometricBounds = [
                                                targetItem.geometricBounds[0],
                                                targetItem.geometricBounds[1],
                                                targetItem.geometricBounds[2],
                                                targetItem.geometricBounds[3] + valoreDaUsare
                                            ];
                                        } else {
                                            if(!isItemLink){
                                                elemento.bounds[3] -= valoreDaUsare;
                                            }
                                            //aggiorniamo anche i veri geometricBounds
                                            targetItem.geometricBounds = [
                                                targetItem.geometricBounds[0],
                                                targetItem.geometricBounds[1],
                                                targetItem.geometricBounds[2],
                                                targetItem.geometricBounds[3] - valoreDaUsare
                                            ];
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                //ora l'asse Y
                if (postRidimensionamento.instructionY && postRidimensionamento.instructionY != "") {
                    var istruzioni = postRidimensionamento.instructionY.replace(/\s+/g, '')       // rimuove tutti gli spazi
                    .replace(/\+\+/g, '+')     // ++ → +
                    .replace(/--/g, '-')       // -- → -
                    .replace(/\+-/g, '-')      // +- → -
                    .replace(/-\+/g, '+')     // -+ → +
                    .match(/([+-][^\+-]+)/g);
                    if (istruzioni) {
                        for (var j = 0; j < istruzioni.length; j++) {
                            var istruzione = istruzioni[j];
                            var segno = istruzione.charAt(0);
                            var corpo = istruzione.substring(1);

                            if (!corpo || corpo == "") {
                                continue;
                            }

                            //controlliamo se il corpo è un numero
                            var valoreNumerico = parseFloat(corpo);
                            if (!isNaN(valoreNumerico)) {
                                //è un numero
                                if (segno == "+") {
                                    elemento.bounds[2] += valoreNumerico;
                                    elemento.item.geometricBounds = [
                                        elemento.item.geometricBounds[0],
                                        elemento.item.geometricBounds[1],
                                        elemento.item.geometricBounds[2] + valoreNumerico,
                                        elemento.item.geometricBounds[3]
                                    ];
                                } else {
                                    elemento.bounds[2] -= valoreNumerico;
                                    elemento.item.geometricBounds = [
                                        elemento.item.geometricBounds[0],
                                        elemento.item.geometricBounds[1],
                                        elemento.item.geometricBounds[2] - valoreNumerico,
                                        elemento.item.geometricBounds[3]
                                    ];
                                }
                            }
                            else {
                                //non è un numero, controlliamo se c'è una specifica tra parentesi quadre
                                const matchSpec = corpo.match(/^([^\[\]]+)(\[(\d+(?:[.,]\d+)?)%\])?$/);
                                if (matchSpec) {
                                    var etichetta = matchSpec[1];
                                    var percentuale = matchSpec[3] ? parseFloat(matchSpec[3].replace(',', '.')) : 100;

                                    //cerchiamo l'elemento con quell'etichetta
                                    var regex = this.makeRegexFromGroupName(etichetta);
                                    var elementoRiferimento = null;
                                    for (var key in mappaBoxOriginale) {
                                        if (regex.test(key)) {
                                            elementoRiferimento = mappaBoxOriginale[key];
                                            break;
                                        }
                                    }

                                    if (elementoRiferimento) {
                                        var altezzaElementoRiferimento = elementoRiferimento.bounds[2] - elementoRiferimento.bounds[0];
                                        var valoreDaUsare = (altezzaElementoRiferimento * percentuale) / 100;
                                        if (segno == "+") {
                                            elemento.bounds[2] += valoreDaUsare;
                                            //aggiorniamo anche i veri geometricBounds
                                            elemento.item.geometricBounds = [
                                                elemento.item.geometricBounds[0],
                                                elemento.item.geometricBounds[1],
                                                elemento.item.geometricBounds[2] + valoreDaUsare,
                                                elemento.item.geometricBounds[3]
                                            ];
                                        } else {
                                            elemento.bounds[2] -= valoreDaUsare;
                                            //aggiorniamo anche i veri geometricBounds
                                            elemento.item.geometricBounds = [
                                                elemento.item.geometricBounds[0],
                                                elemento.item.geometricBounds[1],
                                                elemento.item.geometricBounds[2] - valoreDaUsare,
                                                elemento.item.geometricBounds[3]
                                            ];
                                        }

                                    }
                                }
                            }
                        }
                    }
                }
            }

            
        }
        catch (error) {
            console.error(error);
            return;
        }
    },

    calcolaValoreDimensione: function (espressione, asse, mappaBoxOriginale, box) {
        // asse: "width" oppure "height"
        if (espressione == null) {
            return null;
        }

        var txt = ("" + espressione).replace(/\s+/g, ""); // tolgo tutti gli spazi
        if (txt === "") {
            return null;
        }

        // normalizzo sequenze di + e -
        txt = txt
            .replace(/\+\+/g, "+")
            .replace(/--/g, "-")
            .replace(/\+-/g, "-")
            .replace(/-\+/g, "+");

        // se non inizia con + o -, aggiungo un +
        if (txt.charAt(0) !== "+" && txt.charAt(0) !== "-") {
            txt = "+" + txt;
        }

        var pezzi = txt.match(/([+-][^+-]+)/g);
        if (!pezzi || pezzi.length === 0) {
            return null;
        }

        var isWidth = (asse === "width");
        var baseWidth = box.geometricBounds[3] - box.geometricBounds[1];
        var baseHeight = box.geometricBounds[2] - box.geometricBounds[0];

        var totale = 0;
        var haTerminiValidi = false;

        for (var i = 0; i < pezzi.length; i++) {
            var istr = pezzi[i];
            var segno = istr.charAt(0);
            var corpo = istr.substring(1);

            if (!corpo) {
                continue;
            }

            corpo = corpo.replace(/,/g, "."); // virgole → punti

            var valoreTermine = null;

            // 1) CASO: numero o numero%
            //    es: "40"   → 40
            //        "20%"  → 20% della dimensione del box (width o height a seconda dell’asse)
            var matchNum = corpo.match(/^(\d+(?:\.\d+)?)(%)?$/);
            if (matchNum) {
                var num = parseFloat(matchNum[1]);
                if (!isNaN(num)) {
                    if (matchNum[2] === "%") {
                        // percentuale del box "corrente"
                        var base = isWidth ? baseWidth : baseHeight;
                        valoreTermine = (base * num) / 100;
                    } else {
                        valoreTermine = num;
                    }
                }
            } else {
                // 2) CASO: etichetta con zero o più specifiche tra []
                //    nome
                //    nome[text]
                //    nome[W]
                //    nome[H]
                //    nome[50%]
                //    nome[presente]
                //    nome[text][H][30%] ecc.
                var labelMatch = corpo.match(/^([^\[\]]+)/);
                if (labelMatch) {
                    var etichetta = labelMatch[1];
                    var rest = corpo.substring(etichetta.length);

                    var usaWidth = isWidth;    // di default uso l’asse richiesto
                    var percent = null;        // eventuale % da applicare
                    var usaTextBounds = false; // se vedo [text] diventa true
                    var richiedePresenza = false; // se vedo [presente] diventa true


                    // parso tutte le [ ... ]
                    var specRegex = /\[([^\]]+)\]/g;
                    var m;
                    while ((m = specRegex.exec(rest)) !== null) {
                        var spec = m[1];
                        var specNorm = spec.toLowerCase().replace(/,/g, ".");

                        if (specNorm === "text") {
                            usaTextBounds = true;
                        } else if (specNorm === "w") {
                            usaWidth = true;
                        } else if (specNorm === "h") {
                            usaWidth = false;
                        } else if (specNorm === "presente") {
                            // il termine vale solo se l’elemento esiste e non è eliminato
                            richiedePresenza = true;
                        } else {
                            var mPerc = specNorm.match(/^(\d+(?:\.\d+)?)%$/);
                            if (mPerc) {
                                var p = parseFloat(mPerc[1]);
                                if (!isNaN(p)) {
                                    percent = p;
                                }
                            }
                        }
                    }

                    // cerco elemento di riferimento
                    var regex = this.makeRegexFromGroupName(etichetta);
                    var elementoRiferimento = null;
                    for (var key in mappaBoxOriginale) {
                        if (regex.test(key)) {
                            elementoRiferimento = mappaBoxOriginale[key];
                            break;
                        }
                    }

                    if (elementoRiferimento) {
                        if(richiedePresenza && elementoRiferimento.eliminato){}
                        else{
                            // scelgo i bounds di partenza
                            var boundsArr;
                            if (usaTextBounds) {
                                // textBounds dell’elemento; se la tua getRealBounds
                                // si aspetta direttamente l’item, puoi togliere il fallback
                                boundsArr = this.getRealBounds(
                                    elementoRiferimento.item || elementoRiferimento
                                );
                            } else {
                                boundsArr = elementoRiferimento.bounds;
                            }
    
                            if (boundsArr && boundsArr.length === 4) {
                                var wRef = boundsArr[3] - boundsArr[1];
                                var hRef = boundsArr[2] - boundsArr[0];
    
                                var baseVal = usaWidth ? wRef : hRef;
                                if (percent != null && !isNaN(percent)) {
                                    baseVal = (baseVal * percent) / 100;
                                }
    
                                valoreTermine = baseVal;
                            }
                        }
                    }
                }
            }

            if (valoreTermine != null && !isNaN(valoreTermine)) {
                haTerminiValidi = true;
                if (segno === "+") {
                    totale += valoreTermine;
                } else {
                    totale -= valoreTermine;
                }
            }
        }

        return haTerminiValidi ? totale : null;
    },

    async applicaRidimensionamentoCss(box, boxInGrigliaBounds, itemRef, garbageKey, modalitaOperazioni = 0, momento = cssSequenzaOperazioni.standard) {
        try {
            //modalità operazioni: 0 = tutto, 1 = solo ridimensionamentoBase, 2 = escludi ridimensionamentoBase
            let me = this;
            let result = null;

            if (this.semaforoDownloadFramework){//!bypassDownload) {
                this.getAllineamentiDB(async function (err, allineamentiDB) {
                    var file = allineamentiDB;
                    if (file) {
                        //facciamo il parse del file JSON
                        console.log(file);
                    }
                    if (err) {
                        file = readFile(pathLavorazione + "/allineamenti.json");
                        if (!file) {
                            console.error("Non è stato possibile leggere il file di allineamenti in locale. Operazione annullata.");
                            return;
                        }
                        else {
                            console.error("Non è stato possibile aggiornare il file di allineamenti, sarà usata l'ultima versione scaricata: Versione " + file.version, err);
                        }
                    }

                    var ficoArea = ficoProcess.getAreaLavorazioneCorrente();
                    if(ficoArea==null){
                        messaggioUtente("Code CSF-003: Non è stata trovata l'area di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null
                        }
                        return;
                    }

                    var currentArea = ficoArea.sigla;

                    var ficoCanale = ficoProcess.getCanaleLavorazioneCorrente();
                    if(ficoCanale==null){
                        messaggioUtente("Code CSF-004: Non è stato trovato il canale di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null
                        }
                        return;
                    }

                    var currentCanale = ficoCanale.sigla;

                    var kitTipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
                    if(kitTipoLavorazione==null || kitTipoLavorazione == 0){
                        messaggioUtente("Code CSF-005: Non è stato trovato il tipo di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null
                        }
                        return;
                    }

                    var ficoFormato = ficoProcess.getFormatoLavorazioneCorrente();
                    if(ficoFormato==null){
                        messaggioUtente("Code CSF-006: Non è stato trovato il formato di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null
                        }
                        return;
                    }

                    var kitFormato = ficoFormato.codice;
                    //cerchiamo in file.ModificheCssPerKit un elemento con area e canale uguali a quelli correnti
                    var fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) 
                    && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) 
                    && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0)
                    && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                    //se non lo troviamo proviamo a cercare solo per area
                    if (!fileModifiche) {
                        fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) 
                        && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) 
                        && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0)
                        && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                    }
                    //se non lo troviamo proviamo a cercare solo per canale
                    if (!fileModifiche) {
                        fileModifiche = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                    }
                    //se non lo troviamo prendiamo quello di default (area e canale vuoti)
                    //if (!fileModifiche) {
                    var fileModificheDef = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                    //}

                    if(!fileModifiche){
                        fileModifiche = fileModificheDef;
                    }

                    //se non c'è mandiamo un errore perchè non sono state inserite nell'external source nessuna modifica css
                    if (!fileModifiche) {
                        console.error("Code CSF-007: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.");
                        messaggioUtente("Code CSF-007: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null
                        }
                        return;
                    }

                    var DB = fileModifiche ? fileModifiche.operazioniPerBox : null;
                    var DBDef = fileModificheDef ? fileModificheDef.operazioniPerBox : null;

                    //Le copie generate dalle duplicazioni vanno riconosciute per etichetta prima
                    //di costruire la mappa, altrimenti due omonime collassano in una sola voce.
                    var prefissiDerivati = me.getPrefissiDerivati(box, DB, DBDef);
                    //Il motore riceve le sole regole del momento richiesto: una regola senza fase
                    //appartiene al momento standard, quindi l'ordine di sempre non cambia.
                    DB = cssSequenzaOperazioni.filtraDBPerMomento(DB, momento);
                    DBDef = cssSequenzaOperazioni.filtraDBPerMomento(DBDef, momento);

                    var mappaBoxOriginale = null;
                    if (modalitaOperazioni != 2){
                        mappaBoxOriginale = me.creaMappaturaBoxOriginale(box, prefissiDerivati);
                        me.applicaRidimensionamento(box, boxInGrigliaBounds, mappaBoxOriginale, itemRef, DB, DBDef);
    
                        if (modalitaOperazioni == 1) {
                            result = {
                                esito: true,
                                mappaBoxOriginale: mappaBoxOriginale
                            }
                            return;
                        }
                    }

                    mappaBoxOriginale = me.creaMappaturaBoxOriginale(box, prefissiDerivati);
                    if(garbageKey!=null){
                        activateKeyForGarbage(garbageKey);
                    }

                    await Utility.sleep(200);


                    me.applicaPostRidimensionamento(box, mappaBoxOriginale, itemRef, DB, DBDef);
                    box = me.fixOverflowFromBox(boxInGrigliaBounds, box, mappaBoxOriginale);

                    result = {
                        esito: true,
                        mappaBoxOriginale: mappaBoxOriginale,
                        box : box
                    }
                });

                //aspettiamo che il risultato sia pronto
                counter = 600;
                while (result == null && counter != 0) {
                    await Utility.sleep(100);
                    counter--;
                }

                if (counter == 0) {
                    console.error("Timeout scaduto nell'applicazione del ridimensionamento CSS alla box " + box.label);
                    return {
                        esito: false,
                        mappaBoxOriginale: null
                    };
                }

                return result;
            }
            else{
                var file = readFile(pathLavorazione + "/allineamenti.json");
                if (!file) {
                    console.error("Non è stato possibile leggere il file di allineamenti in locale. Operazione annullata.");
                    return {
                        esito: false,
                        mappaBoxOriginale: null
                    };
                }

                var ficoArea = ficoProcess.getAreaLavorazioneCorrente();
                if(ficoArea==null){
                    messaggioUtente("Code CSF-003: Non è stata trovata l'area di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null
                    }
                    return;
                }

                var currentArea = ficoArea.sigla;
                
                var ficoCanale = ficoProcess.getCanaleLavorazioneCorrente();
                if(ficoCanale==null){
                    messaggioUtente("Code CSF-004: Non è stato trovato il canale di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null
                    }
                    return;
                }

                var currentCanale = ficoCanale.sigla;

                var kitTipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
                if(kitTipoLavorazione==null || kitTipoLavorazione == 0){
                    messaggioUtente("Code CSF-005: Non è stato trovato il tipo di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null
                    }
                    return;
                }

                var ficoFormato = ficoProcess.getFormatoLavorazioneCorrente();
                if(ficoFormato==null){
                    messaggioUtente("Code CSF-006: Non è stato trovato il formato di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null
                    }
                    return;
                }

                var kitFormato = ficoFormato.codice;
                //cerchiamo in file.modificheCssPerKit un elemento con area e canale uguali a quelli correnti
                //cerchiamo in file.ModificheCssPerKit un elemento con area e canale uguali a quelli correnti
                var fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                //se non lo troviamo proviamo a cercare solo per area
                if (!fileModifiche) {
                    fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                }
                //se non lo troviamo proviamo a cercare solo per canale
                if (!fileModifiche) {
                    fileModifiche = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                }
                //se non lo troviamo prendiamo quello di default (area e canale vuoti)
                //if (!fileModifiche) {
                var fileModificheDef = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                //}

                if (!fileModifiche) {
                    fileModifiche = fileModificheDef;
                }

                //se non c'è mandiamo un errore perchè non sono state inserite nell'external source nessuna modifica css
                if (!fileModifiche) {
                    console.error("Code CSF-007: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.");
                    messaggioUtente("Code CSF-007: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null
                    }
                    return;
                }

                var DB = fileModifiche ? fileModifiche.operazioniPerBox : null;
                var DBDef = fileModificheDef ? fileModificheDef.operazioniPerBox : null;

                //Le copie generate dalle duplicazioni vanno riconosciute per etichetta prima
                //di costruire la mappa, altrimenti due omonime collassano in una sola voce.
                var prefissiDerivati = me.getPrefissiDerivati(box, DB, DBDef);
                //Il motore riceve le sole regole del momento richiesto: una regola senza fase
                //appartiene al momento standard, quindi l'ordine di sempre non cambia.
                DB = cssSequenzaOperazioni.filtraDBPerMomento(DB, momento);
                DBDef = cssSequenzaOperazioni.filtraDBPerMomento(DBDef, momento);

                var mappaBoxOriginale = null;
                if (modalitaOperazioni != 2) {
                    mappaBoxOriginale = me.creaMappaturaBoxOriginale(box, prefissiDerivati);
                    me.applicaRidimensionamento(box, boxInGrigliaBounds, mappaBoxOriginale, itemRef, DB, DBDef);
                    if (modalitaOperazioni == 1) {
                        result = {
                            esito: true,
                            mappaBoxOriginale: mappaBoxOriginale
                        }
                        return;
                    }
                }
                mappaBoxOriginale = me.creaMappaturaBoxOriginale(box, prefissiDerivati);
                if (garbageKey != null) {
                    activateKeyForGarbage(garbageKey);
                }

                await Utility.sleep(200);


                me.applicaPostRidimensionamento(box, mappaBoxOriginale, itemRef, DB, DBDef);
                box = me.fixOverflowFromBox(boxInGrigliaBounds, box, mappaBoxOriginale);

                return {
                    esito: true,
                    mappaBoxOriginale: mappaBoxOriginale,
                    box: box
                }
            }
        }
        catch (error) {
            console.error("Errore nell'applicazione del CSS alla box " + box.label);
            console.error(error);
        }
    },

    etichetteSegnalate : [],

    fixOverflowFromBox(boxInGrigliaBounds, box, mappaBoxOriginale = null){
        //controlliamo per ogni pageItem di box se esce dai bounds di boxInGrigliaBounds
        //se esce lo riportiamo dentro
        var segnalazioneDescrizione = false;
        for (var i = 0; i < box.pageItems.length; i++) {
            var pageItem = box.pageItems.item(i);
            var moved = false;
            if (pageItem.geometricBounds[0] < boxInGrigliaBounds[0] - 0.05) {
                //prima di muoverlo, se è un textframe, proviamo a ridurlo per vedere se lo possiamo far rientrare nel limite senza mandarlo in overflow
                if (this.isTextFrame(pageItem)) {
                    var cantReduce = false;
                    var originalBounds = pageItem.geometricBounds;
                    var bounds0 = Math.max(pageItem.geometricBounds[0], boxInGrigliaBounds[0]);
                    if (pageItem.geometricBounds[2] - bounds0 > 0) {
                        pageItem.geometricBounds = [
                            bounds0,
                            pageItem.geometricBounds[1],
                            pageItem.geometricBounds[2],
                            pageItem.geometricBounds[3]
                        ];
                    }
                    else{
                        cantReduce = true;
                    }

                    //se è in overflow anche dopo la riduzione lo ripristiniamo e continuiamo con lo spostamento, altrimenti manteniamo la riduzione
                    if (pageItem.properties.overflows || cantReduce) {
                        pageItem.geometricBounds = originalBounds;
                        console.warn("Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " spostato verso il basso per rientrare nei limiti della griglia.");
                        //mandiamo il messaggioUtente solo il margine di spostamento è superiore a 1
                        if (Math.abs(boxInGrigliaBounds[0] - pageItem.geometricBounds[0]) > 1) {
                            messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso il basso per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                            moved = true;
                        }
                        var movementY = boxInGrigliaBounds[0] - pageItem.geometricBounds[0];
                        pageItem.move(undefined, [0, movementY]);
                        //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                        if (mappaBoxOriginale) {
                            var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                            if (item) {
                                item.bounds[0] += movementY;
                                item.bounds[2] += movementY;
                            }
                        }
                    }
                }
                else{
                    console.warn("Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " spostato verso il basso per rientrare nei limiti della griglia.");
                    //mandiamo il messaggioUtente solo il margine di spostamento è superiore a 1
                    if (Math.abs(boxInGrigliaBounds[0] - pageItem.geometricBounds[0]) > 1) {
                        messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso il basso per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                        moved = true;
                    }
                    var movementY = boxInGrigliaBounds[0] - pageItem.geometricBounds[0];
                    pageItem.move(undefined, [0, movementY]);
                        //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                            if (mappaBoxOriginale) {
                                var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                                if (item) {
                                    item.bounds[0] += movementY;
                                    item.bounds[2] += movementY;
                                }
                            }
                }
            }
            if (pageItem.geometricBounds[1] < boxInGrigliaBounds[1] - 0.05) {
                if (this.isTextFrame(pageItem)) {
                    var cantReduce = false;
                    var originalBounds = pageItem.geometricBounds;
                    var bounds1 = Math.max(pageItem.geometricBounds[1], boxInGrigliaBounds[1]);
                    if (pageItem.geometricBounds[3] - bounds1 > 0) {
                        pageItem.geometricBounds = [
                            pageItem.geometricBounds[0],
                            bounds1,
                            pageItem.geometricBounds[2],
                            pageItem.geometricBounds[3]
                        ];
                    }
                    else{
                        cantReduce = true;
                    }
                    if (pageItem.properties.overflows || cantReduce) {
                        pageItem.geometricBounds = originalBounds;
                        console.warn("Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " spostato verso destra per rientrare nei limiti della griglia.");
                        if (Math.abs(boxInGrigliaBounds[1] - pageItem.geometricBounds[1]) > 1) {
                            messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso destra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                            moved = true;
                        }
                        var movementX = boxInGrigliaBounds[1] - pageItem.geometricBounds[1];
                        pageItem.move(undefined, [movementX, 0]);
                        //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                        if (mappaBoxOriginale) {
                            var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                            if (item) {
                                item.bounds[1] += movementX;
                                item.bounds[3] += movementX;
                            }
                        }
                    }
                }
                else {
                    console.warn("Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " spostato verso destra per rientrare nei limiti della griglia.");
                    if (Math.abs(boxInGrigliaBounds[1] - pageItem.geometricBounds[1]) > 1) {
                        messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : 'senza etichetta') +" spostato verso destra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                        moved = true;
                    }
                    pageItem.move(undefined, [boxInGrigliaBounds[1] - pageItem.geometricBounds[1], 0]);
                    //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                    if (mappaBoxOriginale) {
                        var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                        if (item) {
                            item.bounds[1] += boxInGrigliaBounds[1] - pageItem.geometricBounds[1];
                            item.bounds[3] += boxInGrigliaBounds[1] - pageItem.geometricBounds[1];
                        }
                    }
                }
            }
            if (pageItem.geometricBounds[2] > boxInGrigliaBounds[2] + 0.05) {
                if (this.isTextFrame(pageItem)) {
                    var cantReduce = false;
                    var originalBounds = pageItem.geometricBounds;
                    var bounds2 = Math.min(pageItem.geometricBounds[2], boxInGrigliaBounds[2]);
                    if (bounds2 - pageItem.geometricBounds[0] > 0) {
                        pageItem.geometricBounds = [
                            pageItem.geometricBounds[0],
                            pageItem.geometricBounds[1],
                            bounds2,
                            pageItem.geometricBounds[3]
                        ];
                    }
                    else{
                        cantReduce = true;
                    }
                    if (pageItem.properties.overflows || cantReduce) {
                        pageItem.geometricBounds = originalBounds;
                        console.warn('Elemento '+(pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +' spostato verso l\'alto per rientrare nei limiti della griglia.');
                        if (Math.abs(boxInGrigliaBounds[2] - pageItem.geometricBounds[2]) > 1) {
                            messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso l'alto per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                            moved = true;
                        }
                        var movementY = boxInGrigliaBounds[2] - pageItem.geometricBounds[2];
                        pageItem.move(undefined, [0, movementY]);
                        //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                        if (mappaBoxOriginale) {
                            var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                            if (item) {
                                item.bounds[1] += movementY;
                                item.bounds[3] += movementY;
                            }
                        }
                    }
                }
                else {
                    console.warn('Elemento '+(pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +' spostato verso l\'alto per rientrare nei limiti della griglia.');
                    if (Math.abs(boxInGrigliaBounds[2] - pageItem.geometricBounds[2]) > 1) {
                        messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso l'alto per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                        moved = true;
                    }
                    var movementY = boxInGrigliaBounds[2] - pageItem.geometricBounds[2];
                    pageItem.move(undefined, [0, movementY]);
                    //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                    if (mappaBoxOriginale) {
                        var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                        if (item) {
                            item.bounds[1] += movementY;
                            item.bounds[3] += movementY;
                        }
                    }
                }
            }
            if (pageItem.geometricBounds[3] > boxInGrigliaBounds[3] + 0.05) {
                if (this.isTextFrame(pageItem)) {
                    var cantReduce = false;
                    var originalBounds = pageItem.geometricBounds;
                    var bounds3 = Math.min(pageItem.geometricBounds[3], boxInGrigliaBounds[3])
                    if (bounds3 - pageItem.geometricBounds[1] > 0) {
                        pageItem.geometricBounds = [
                            pageItem.geometricBounds[0],
                            pageItem.geometricBounds[1],
                            pageItem.geometricBounds[2],
                            bounds3
                        ];
                    }
                    else{
                        cantReduce = true;
                    }
                    if (pageItem.properties.overflows || cantReduce) {
                        pageItem.geometricBounds = originalBounds;
                        console.warn('Elemento '+(pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +' spostato verso sinistra per rientrare nei limiti della griglia.');
                        if (Math.abs(boxInGrigliaBounds[3] - pageItem.geometricBounds[3]) > 1) {
                            messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso sinistra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                            moved = true;
                        }
                        var movementX = boxInGrigliaBounds[3] - pageItem.geometricBounds[3];
                        pageItem.move(undefined, [movementX, 0]);
                        //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                        if (mappaBoxOriginale) {
                            var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                            if (item) {
                                item.bounds[0] += movementX;
                                item.bounds[2] += movementX;
                            }
                        }
                    }
                }
                else {
                    console.warn('Elemento '+(pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +' spostato verso sinistra per rientrare nei limiti della griglia.');
                    if (Math.abs(boxInGrigliaBounds[3] - pageItem.geometricBounds[3]) > 1) {
                        messaggioUtente("Code CSF-008: Elemento " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") +" spostato verso sinistra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.", "warning");
                        moved = true;
                    }
                    var movementX = boxInGrigliaBounds[3] - pageItem.geometricBounds[3];
                    pageItem.move(undefined, [movementX, 0]);
                    //se la mappaBox è presente cerchiamo l'elemento con quell'etichetta e aggiorniamo i suoi bounds con quelli attuali del pageItem
                    if (mappaBoxOriginale) {
                        var item = mappaBoxOriginale[Utility.parseLabel(pageItem.label)];
                        if (item) {
                            item.bounds[0] += movementX;
                            item.bounds[2] += movementX;
                        }
                    }
                }
            }

            if (Utility.parseLabel(pageItem.label).toLowerCase() == "descrizione" && moved) {
                segnalazioneDescrizione = true;
            }
        }

        if (segnalazioneDescrizione) {
            addSegnalazione("Descrizione spostata poichè uscita dai limiti del box", "warning", 2, true, ["Descrizione spostata poichè uscita dai limiti del box", "orange"], "descrizione_spostata");
            box = Utility.addBollinoCustom(box, "Descrizione spostata poichè uscita dai limiti del box", "orange", null, 0, null, false)
        }

        //controlliamo che post spostamento non abbia causato overflow, se è uscito vuol dire che l'elemento è troppo grande e dobbiamo mandare un messaggioUtente
        for (var i = 0; i < box.pageItems.length; i++) {
            var pageItem = box.pageItems.item(i);
            if (pageItem.geometricBounds[0] < boxInGrigliaBounds[0] - 0.05 ||
                pageItem.geometricBounds[1] < boxInGrigliaBounds[1] - 0.05 ||
                pageItem.geometricBounds[2] > boxInGrigliaBounds[2] + 0.05 ||
                pageItem.geometricBounds[3] > boxInGrigliaBounds[3] + 0.05) {
                if (!etichetteSegnalate.includes(Utility.parseLabel(pageItem.label))) {
                    messaggioUtente("Code CSF-009: L'elemento con etichetta " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " nel box " + (box.label != "" ? box.label : "senza etichetta") + ", post ridimensionamento eccede i limiti della griglia assegnata. L'elemento è stato rimpicciolito per permettere la corretta impaginazione.", "error");
                    addSegnalazione("Code CSF-009: L'elemento con etichetta " + (pageItem.label != "" ? Utility.parseLabel(pageItem.label) : "senza etichetta") + " nel box " + (box.label != "" ? box.label : "senza etichetta") + ", post ridimensionamento eccede i limiti della griglia assegnata. L'elemento è stato rimpicciolito per permettere la corretta impaginazione.", "error", 1, true, ["CSF-009", "red"]);
                    etichetteSegnalate.push(Utility.parseLabel(pageItem.label));

                    //Rimpiccioliamo l'elemento in modo proporzionale per farlo rientrare nei limiti della griglia
                    //calcoliamo quanto esce in ogni direzione
                    var boxHeight = boxInGrigliaBounds[2] - boxInGrigliaBounds[0];
                    var boxWidth = boxInGrigliaBounds[3] - boxInGrigliaBounds[1];

                    var itemHeight = pageItem.geometricBounds[2] - pageItem.geometricBounds[0];
                    var itemWidth = pageItem.geometricBounds[3] - pageItem.geometricBounds[1];

                    var scaleFactorVertical = boxHeight / itemHeight;
                    var scaleFactorHorizontal = boxWidth / itemWidth;

                    var scaleFactor = Math.min(scaleFactorVertical, scaleFactorHorizontal);
                    scaleFactor = Math.min(scaleFactor, 1);
                    scaleFactor = Math.max(scaleFactor, 0.01);

                    pageItem.resize(
                        CoordinateSpaces.INNER_COORDINATES,
                        AnchorPoint.CENTER_ANCHOR,
                        ResizeMethods.MULTIPLYING_CURRENT_DIMENSIONS_BY,
                        [scaleFactor, scaleFactor]
                    );
                }
            }
        }

        return box;
    },

    isTextFrame(item) {
        try {
            return item.constructor.name == "TextFrame" ||
                (item.properties.parentStory != null &&
                item.properties.textFramePreferences != null &&
                item.properties.overflows != null &&
                item.properties.contents != null);
        } catch (e) {
            return false;
        }
    },

    fixCollisioneTracciaBase(box, gruppoElementi, evitaTracciaImpostazioni) {
        var useTextBounds = false;
        var distance = 0;
        if (evitaTracciaImpostazioni && evitaTracciaImpostazioni.useTextBounds != null) {
            useTextBounds = evitaTracciaImpostazioni.useTextBounds;
        }
        if (evitaTracciaImpostazioni && evitaTracciaImpostazioni.distance != null && !isNaN(evitaTracciaImpostazioni.distance)) {
            distance = evitaTracciaImpostazioni.distance;
        }

        var base = Utility.getFieldByLabel("base", box);
        if (base == null || !base.isValid) {
            return;
        }

        var stroke = base.strokeWeight;
        if (stroke == null || stroke <= 0) {
            return;
        }

        var inset = 0;
        try {
            switch (base.strokeAlignment.toString()) {
                case "INSIDE_ALIGNMENT":
                    inset = stroke;
                    break;
                case "CENTER_ALIGNMENT":
                    inset = stroke / 2;
                    break;
                case "OUTSIDE_ALIGNMENT":
                    inset = 0;
                    break;
                default:
                    inset = stroke / 2;
                    break;
            }
        } catch (e) {
            // fallback prudente: in caso di valore non leggibile
            inset = stroke / 2;
        }

        if (inset <= 0) {
            return;
        }

        inset = inset * 0.352777778; // convertiamo da punti a mm (1pt = 0.352777778 mm)

        var minX = null;
        var maxX = null;
        var minY = null;
        var maxY = null;

        for (var i = 0; i < gruppoElementi.length; i++) {
            var elementi = gruppoElementi[i].elementi;
            for (var j = 0; j < elementi.length; j++) {
                var item = elementi[j].item;
                if (item && item.isValid) {
                    var bounds = useTextBounds ? this.getRealBounds(item) : item.geometricBounds; // [top, left, bottom, right]\

                    if (minX == null || bounds[1] < minX) minX = bounds[1];
                    if (maxX == null || bounds[3] > maxX) maxX = bounds[3];
                    if (minY == null || bounds[0] < minY) minY = bounds[0];
                    if (maxY == null || bounds[2] > maxY) maxY = bounds[2];
                }
            }
        }

        if (minX == null || maxX == null || minY == null || maxY == null) {
            return;
        }

        var baseBounds = base.geometricBounds; // [top, left, bottom, right]
        var innerTop = baseBounds[0] + inset + distance;
        var innerLeft = baseBounds[1] + inset + distance;
        var innerBottom = baseBounds[2] - inset - distance;
        var innerRight = baseBounds[3] - inset - distance;

        var offsetX = 0;
        var offsetY = 0;

        if (minX < innerLeft) {
            offsetX = innerLeft - minX;
        } else if (maxX > innerRight) {
            offsetX = innerRight - maxX;
        }

        if (minY < innerTop) {
            offsetY = innerTop - minY;
        } else if (maxY > innerBottom) {
            offsetY = innerBottom - maxY;
        }

        if (offsetX !== 0 || offsetY !== 0) {
            for (var i = 0; i < gruppoElementi.length; i++) {
                var elementi = gruppoElementi[i].elementi;
                for (var j = 0; j < elementi.length; j++) {
                    var item = elementi[j].item;
                    if (item && item.isValid) {
                        item.move(undefined, [offsetX, offsetY]);
                    }
                }
            }
        }
    },

    fixCollisioneTracciaBaseSingolo(box, singolo, useTextBounds = false, distance = 0) {
        var base = Utility.getFieldByLabel("base", box);
        if (base == null || !base.isValid) {
            return;
        }

        var stroke = base.strokeWeight;
        if (stroke == null || stroke <= 0) {
            return;
        }

        var inset = 0;
        try {
            switch (base.strokeAlignment.toString()) {
                case "INSIDE_ALIGNMENT":
                    inset = stroke;
                    break;
                case "CENTER_ALIGNMENT":
                    inset = stroke / 2;
                    break;
                case "OUTSIDE_ALIGNMENT":
                    inset = 0;
                    break;
                default:
                    inset = stroke / 2;
                    break;
            }
        } catch (e) {
            // fallback prudente: in caso di valore non leggibile
            inset = stroke / 2;
        }

        if (inset <= 0) {
            return;
        }

        inset = inset * 0.352777778; // convertiamo da punti a mm (1pt = 0.352777778 mm)

        var bounds = useTextBounds ? this.getRealBounds(singolo) : singolo.geometricBounds; // [top, left, bottom, right]

        var minX = bounds[1]; // left
        var maxX = bounds[3]; // right
        var minY = bounds[0]; // top
        var maxY = bounds[2]; // bottom

        if (minX == null || maxX == null || minY == null || maxY == null) {
            return;
        }

        var baseBounds = base.geometricBounds; // [top, left, bottom, right]
        var innerTop = baseBounds[0] + inset + distance;
        var innerLeft = baseBounds[1] + inset + distance;
        var innerBottom = baseBounds[2] - inset - distance;
        var innerRight = baseBounds[3] - inset - distance;

        var offsetX = 0;
        var offsetY = 0;

        if (minX < innerLeft) {
            offsetX = innerLeft - minX;
        } else if (maxX > innerRight) {
            offsetX = innerRight - maxX;
        }

        if (minY < innerTop) {
            offsetY = innerTop - minY;
        } else if (maxY > innerBottom) {
            offsetY = innerBottom - maxY;
        }

        if (offsetX !== 0 || offsetY !== 0) {
            singolo.move(undefined, [offsetX, offsetY]);
        }
    },

    AllineamentoInternoGruppo(box, nomeGruppo, gruppoElementiOriginal, ordinamento, lettura, Spacing, mappaBoxOriginale, itemRef) {
        let me = this;
        //ordiniamo gli elementi in ordinamento per valore di Livello
        ordinamento.sort((a, b) => a.livello - b.livello);
        let angoloTopLeft = [box.geometricBounds[0], box.geometricBounds[1]]; //y,x
        //i bounds in gruppoElementiOriginal sono relativi al box, creiamo quindi un gruppoElementi con bounds assoluti
        let gruppoElementi = gruppoElementiOriginal.map(el => {
            return {
                item: el.item,
                label: Utility.parseLabel(el.label),
                bounds: [
                    el.bounds[0] + angoloTopLeft[0],
                    el.bounds[1] + angoloTopLeft[1],
                    el.bounds[2] + angoloTopLeft[0],
                    el.bounds[3] + angoloTopLeft[1]
                ],
                eliminato: el.eliminato
            }
        });

        //per ogni livello controlliamo se le condizioni sono valide, se non lo sono rimuoviamo il livello dall'ordinamento
        for (var i = ordinamento.length - 1; i >= 0; i--) {
            var livelloDiOrdinamento = ordinamento[i];
            if (livelloDiOrdinamento.listSetCondizioni && livelloDiOrdinamento.listSetCondizioni.length > 0) {
                var condizioneValida = this.checkAllConditions(mappaBoxOriginale, itemRef, livelloDiOrdinamento.listSetCondizioni, box);
                if (!condizioneValida) {
                    //rimuoviamo il livello dall'ordinamento
                    ordinamento.splice(i, 1);
                }
            }
        }

        //ora possiamo procedere con l'allineamento
        //per ogni livello di ordinamento, recuperiamo gli elementi corrispondenti e li ordiniamo in base alla lettura
        let listGruppiAllineamentoBounds = [];

        for (var i = 0; i < ordinamento.length; i++) {
            var livelloDiOrdinamento = ordinamento[i];
            var elementiDaAllineare = [];
            var elementiEliminati = [];
            for (var j = 0; j < livelloDiOrdinamento.elementi.length; j++) {
                var labelElemento = livelloDiOrdinamento.elementi[j];
                var regex = this.makeRegexFromGroupName(labelElemento);
                var elementoTrovato = gruppoElementi.find(el => regex.test(Utility.parseLabel(el.label)) && !el.eliminato);
                if (elementoTrovato) {
                    elementiDaAllineare.push(elementoTrovato);
                }
                else {
                    var elementoEliminato = gruppoElementi.find(el => {
                        var regex = this.makeRegexFromGroupName(labelElemento);
                        return regex.test(Utility.parseLabel(el.label)) && el.eliminato;
                    });
                    if (elementoEliminato) {
                        elementiEliminati.push(elementoEliminato);
                    }
                }
            }

            switch (this.enumLetturaLivelli(lettura)) {
                case "righe_bottom_to_top":
                    //cerchiamo il bound[2] più basso tra gli elementiDaAllineare e eliminati
                    var maxBottomElementiDaAllineare = Math.max(...elementiDaAllineare.map(el => el.bounds[2]));
                    var maxBottomElementiEliminati = elementiEliminati.length > 0 ? Math.max(...elementiEliminati.map(el => el.bounds[2])) : null;
                    var max = maxBottomElementiEliminati && maxBottomElementiEliminati > maxBottomElementiDaAllineare ? maxBottomElementiEliminati : maxBottomElementiDaAllineare;
                    //calcoliamo senza allineare quale sarebbero i bounds dell'ipotetico gruppo post allineamento
                    var ipoticalBounds = [];
                    for (var k = 0; k < elementiDaAllineare.length; k++) {
                        var elemento = elementiDaAllineare[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max - hElemento,
                            elemento.item.geometricBounds[1],
                            max,
                            elemento.item.geometricBounds[3]
                        ]);
                    }

                    for (var k = 0; k < elementiEliminati.length; k++) {
                        var elemento = elementiEliminati[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max - hElemento,
                            elemento.bounds[1],
                            max,
                            elemento.bounds[3]
                        ]);
                    }

                    //ora calcoliamo quali sarebbero i bounds del gruppo
                    var gruppoBounds = [
                        Math.min(...ipoticalBounds.map(b => b[0])),
                        Math.min(...ipoticalBounds.map(b => b[1])),
                        Math.max(...ipoticalBounds.map(b => b[2])),
                        Math.max(...ipoticalBounds.map(b => b[3])),
                    ];

                    if(elementiDaAllineare.length > 0 || elementiEliminati.length > 0){
                        listGruppiAllineamentoBounds.push({
                            bounds: gruppoBounds,
                            elementi: elementiDaAllineare,
                            elementiEliminati : elementiEliminati,
                            elementiOrdinati: livelloDiOrdinamento.elementi,
                            livelloEliminato : elementiDaAllineare.length === 0 ? true : false,
                            InternalAnchor : this.enumInternalAnchor(livelloDiOrdinamento.internalAnchor),
                            InternalSpacing : livelloDiOrdinamento.spacing,
                            allineaATextBounds: livelloDiOrdinamento.allineaATextBounds
                        });
                    }


                    break;
                case "righe_top_to_bottom":
                    let maxTopElementiDaAllineare = Math.max(...elementiDaAllineare.map(el => el.bounds[0]));
                    let maxTopElementiEliminati = elementiEliminati.length > 0 ? Math.max(...elementiEliminati.map(el => el.bounds[0])) : null;
                    var max = maxTopElementiEliminati && maxTopElementiEliminati > maxTopElementiDaAllineare ? maxTopElementiEliminati : maxTopElementiDaAllineare;
                    //calcoliamo senza allineare quale sarebbero i bounds dell'ipotetico gruppo post allineamento
                    var ipoticalBounds = [];
                    for (var k = 0; k < elementiDaAllineare.length; k++) {
                        var elemento = elementiDaAllineare[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max,
                            elemento.item.geometricBounds[1],
                            max + hElemento,
                            elemento.item.geometricBounds[3]
                        ]);
                    }

                    for (var k = 0; k < elementiEliminati.length; k++) {
                        var elemento = elementiEliminati[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max,
                            elemento.bounds[1],
                            max + hElemento,
                            elemento.bounds[3]
                        ]);
                    }

                    //ora calcoliamo quali sarebbero i bounds del gruppo
                    var gruppoBounds = [
                        Math.min(...ipoticalBounds.map(b => b[0])),
                        Math.min(...ipoticalBounds.map(b => b[1])),
                        Math.max(...ipoticalBounds.map(b => b[2])),
                        Math.max(...ipoticalBounds.map(b => b[3])),
                    ];

                    if(elementiDaAllineare.length > 0 || elementiEliminati.length > 0){
                        listGruppiAllineamentoBounds.push({
                            bounds: gruppoBounds,
                            elementi: elementiDaAllineare,
                            elementiEliminati : elementiEliminati,
                            elementiOrdinati: livelloDiOrdinamento.elementi,
                            livelloEliminato : elementiDaAllineare.length === 0 ? true : false,
                            InternalAnchor : this.enumInternalAnchor(livelloDiOrdinamento.internalAnchor),
                            InternalSpacing : livelloDiOrdinamento.spacing,
                            allineaATextBounds: livelloDiOrdinamento.allineaATextBounds
                        });
                    }
                    break;
                case "colonne_left_to_right":
                    let maxLeftElementiDaAllineare = Math.max(...elementiDaAllineare.map(el => el.bounds[1]));
                    let maxLeftElementiEliminati = elementiEliminati.length > 0 ? Math.max(...elementiEliminati.map(el => el.bounds[1])) : null;
                    var max = maxLeftElementiEliminati && maxLeftElementiEliminati > maxLeftElementiDaAllineare ? maxLeftElementiEliminati : maxLeftElementiDaAllineare;
                    //calcoliamo senza allineare quale sarebbero i bounds dell'ipotetico gruppo post allineamento
                    var ipoticalBounds = [];
                    for (var k = 0; k < elementiDaAllineare.length; k++) {
                        var elemento = elementiDaAllineare[k];
                        var wElemento = elemento.bounds[3] - elemento.bounds[1];
                        ipoticalBounds.push([
                            elemento.item.geometricBounds[0],
                            max,
                            elemento.item.geometricBounds[2],
                            max + wElemento
                        ]);
                    }

                    for (var k = 0; k < elementiEliminati.length; k++) {
                        var elemento = elementiEliminati[k];
                        var wElemento = elemento.bounds[3] - elemento.bounds[1];
                        ipoticalBounds.push([
                            elemento.bounds[0],
                            max,
                            elemento.bounds[2],
                            max + wElemento
                        ]);
                    }

                    //ora calcoliamo quali sarebbero i bounds del gruppo
                    var gruppoBounds = [
                        Math.min(...ipoticalBounds.map(b => b[0])),
                        Math.min(...ipoticalBounds.map(b => b[1])),
                        Math.max(...ipoticalBounds.map(b => b[2])),
                        Math.max(...ipoticalBounds.map(b => b[3])),
                    ];

                    if (elementiDaAllineare.length > 0 || elementiEliminati.length > 0) {
                        listGruppiAllineamentoBounds.push({
                            bounds: gruppoBounds,
                            elementi: elementiDaAllineare,
                            elementiEliminati : elementiEliminati,
                            elementiOrdinati: livelloDiOrdinamento.elementi,
                            livelloEliminato : elementiDaAllineare.length === 0 ? true : false,
                            InternalAnchor : this.enumInternalAnchor(livelloDiOrdinamento.internalAnchor),
                            InternalSpacing : livelloDiOrdinamento.spacing,
                            allineaATextBounds: livelloDiOrdinamento.allineaATextBounds
                        });
                    }
                    break;
                case "colonne_right_to_left":
                    let maxRightElementiDaAllineare = Math.max(...elementiDaAllineare.map(el => el.bounds[3]));
                    let maxRightElementiEliminati = elementiEliminati.length > 0 ? Math.max(...elementiEliminati.map(el => el.bounds[3])) : null;
                    var max = maxRightElementiEliminati && maxRightElementiEliminati > maxRightElementiDaAllineare ? maxRightElementiEliminati : maxRightElementiDaAllineare;
                    //calcoliamo senza allineare quale sarebbero i bounds dell'ipotetico gruppo post allineamento
                    var ipoticalBounds = [];
                    for (var k = 0; k < elementiDaAllineare.length; k++) {
                        var elemento = elementiDaAllineare[k];
                        var wElemento = elemento.bounds[3] - elemento.bounds[1];
                        ipoticalBounds.push([
                            elemento.item.geometricBounds[0],
                            max - wElemento,
                            elemento.item.geometricBounds[2],
                            max
                        ]);
                    }

                    for (var k = 0; k < elementiEliminati.length; k++) {
                        var elemento = elementiEliminati[k];
                        var wElemento = elemento.bounds[3] - elemento.bounds[1];
                        ipoticalBounds.push([
                            elemento.bounds[0],
                            max - wElemento,
                            elemento.bounds[2],
                            max
                        ]);
                    }

                    //ora calcoliamo quali sarebbero i bounds del gruppo
                    var gruppoBounds = [
                        Math.min(...ipoticalBounds.map(b => b[0])),
                        Math.min(...ipoticalBounds.map(b => b[1])),
                        Math.max(...ipoticalBounds.map(b => b[2])),
                        Math.max(...ipoticalBounds.map(b => b[3])),
                    ];

                    if (elementiDaAllineare.length > 0 || elementiEliminati.length > 0) {
                        listGruppiAllineamentoBounds.push({
                            bounds: gruppoBounds,
                            elementi: elementiDaAllineare,
                            elementiEliminati : elementiEliminati,
                            elementiOrdinati: livelloDiOrdinamento.elementi,
                            livelloEliminato : elementiDaAllineare.length === 0 ? true : false,
                            InternalAnchor : this.enumInternalAnchor(livelloDiOrdinamento.internalAnchor),
                            InternalSpacing : livelloDiOrdinamento.spacing,
                            allineaATextBounds: livelloDiOrdinamento.allineaATextBounds
                        });
                    }
                    break;
                default:
                    //cerchiamo il bound[2] più basso tra gli elementiDaAllineare e eliminati
                    var maxBottomElementiDaAllineare = Math.max(...elementiDaAllineare.map(el => el.bounds[2]));
                    var maxBottomElementiEliminati = elementiEliminati.length > 0 ? Math.max(...elementiEliminati.map(el => el.bounds[2])) : null;
                    var max = maxBottomElementiEliminati && maxBottomElementiEliminati > maxBottomElementiDaAllineare ? maxBottomElementiEliminati : maxBottomElementiDaAllineare;
                    //calcoliamo senza allineare quale sarebbero i bounds dell'ipotetico gruppo post allineamento
                    var ipoticalBounds = [];
                    for (var k = 0; k < elementiDaAllineare.length; k++) {
                        var elemento = elementiDaAllineare[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max - hElemento,
                            elemento.item.geometricBounds[1],
                            max,
                            elemento.item.geometricBounds[3]
                        ]);
                    }

                    for (var k = 0; k < elementiEliminati.length; k++) {
                        var elemento = elementiEliminati[k];
                        var hElemento = elemento.bounds[2] - elemento.bounds[0];
                        ipoticalBounds.push([
                            max - hElemento,
                            elemento.bounds[1],
                            max,
                            elemento.bounds[3]
                        ]);
                    }

                    //ora calcoliamo quali sarebbero i bounds del gruppo
                    var gruppoBounds = [
                        Math.min(...ipoticalBounds.map(b => b[0])),
                        Math.min(...ipoticalBounds.map(b => b[1])),
                        Math.max(...ipoticalBounds.map(b => b[2])),
                        Math.max(...ipoticalBounds.map(b => b[3])),
                    ];

                    if (elementiDaAllineare.length > 0 || elementiEliminati.length > 0) {
                        listGruppiAllineamentoBounds.push({
                            bounds: gruppoBounds,
                            elementi: elementiDaAllineare,
                            elementiEliminati: elementiEliminati,
                            elementiOrdinati: livelloDiOrdinamento.elementi,
                            livelloEliminato: elementiDaAllineare.length === 0 ? true : false,
                            InternalAnchor: this.enumInternalAnchor(livelloDiOrdinamento.internalAnchor),
                            InternalSpacing: livelloDiOrdinamento.InternalSpacing,
                            allineaATextBounds: livelloDiOrdinamento.allineaATextBounds
                        });
                    }

                    break;
            }
        }


        var spostamentoLivelloPrecedente = [0,0]; //y,x
        for (var g = 0; g < listGruppiAllineamentoBounds.length; g++) {
            var gruppo = listGruppiAllineamentoBounds[g];
            var boundsGruppoDaSostituire = gruppo.bounds;
            //controlliamo il livello precedente per vedere se era stato eliminato
            var livelloPrecedenteEliminato = g > 0 ? listGruppiAllineamentoBounds[g - 1].livelloEliminato : false;
            //se è stato eliminato scendiamo di un livello alla volta per trovare l'ultimo livello contiguo ad essere eliminato
            if (livelloPrecedenteEliminato) {
                var indiceLivelloContiguoEliminato = g - 1;
                while (indiceLivelloContiguoEliminato > 0 && listGruppiAllineamentoBounds[indiceLivelloContiguoEliminato].livelloEliminato) {
                    indiceLivelloContiguoEliminato--;
                }
                if(!listGruppiAllineamentoBounds[indiceLivelloContiguoEliminato].livelloEliminato){
                    indiceLivelloContiguoEliminato++;
                }
                //ora indiceLivelloContiguoEliminato è l'indice dell'ultimo livello non eliminato prima di una serie di livelli eliminati
                boundsGruppoDaSostituire = listGruppiAllineamentoBounds[indiceLivelloContiguoEliminato].bounds;
            }

            //C'è DA ALLINEARE I LIVELLI TRA DI LORO, NON SOLO CON LO SPACING COME è STATO FATTO

            //ora allineiamo gli elementi del gruppo al gruppo da sostiuire basandoci sulla lettura, ad esempio se la lettura è righe_bottom_to_top allineiamo il bound[2] di ogni elemento al bound[2] del gruppo da sostituire e il bound[0] di ogni elemento al bound[2] - hElemento
            var spostamentoMinore = [null,null]; //y,x
            for (var e = 0; e < gruppo.elementi.length; e++) {
                var elemento = gruppo.elementi[e];
                var hElemento = elemento.bounds[2] - elemento.bounds[0];
                var wElemento = elemento.bounds[3] - elemento.bounds[1];
                var spostamento = [0, 0]; // [spostamentoY, spostamentoX]

                switch (this.enumLetturaLivelli(lettura)) {
                    case "righe_bottom_to_top":
                        spostamento[0] = boundsGruppoDaSostituire[0] /*- hElemento*/ - elemento.item.geometricBounds[0];
                        elemento.item.geometricBounds = [
                            elemento.item.geometricBounds[0] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[1],
                            elemento.item.geometricBounds[2] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[3]
                        ];
                        break;
                    case "righe_top_to_bottom":
                        spostamento[0] = boundsGruppoDaSostituire[2] - elemento.item.geometricBounds[2];
                        elemento.item.geometricBounds = [
                            elemento.item.geometricBounds[0] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[1],
                            elemento.item.geometricBounds[2] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[3]
                        ];
                        break;
                    case "colonne_left_to_right":
                        spostamento[1] = boundsGruppoDaSostituire[1] /*- wElemento*/ - elemento.item.geometricBounds[1];
                        elemento.item.geometricBounds = [
                            elemento.item.geometricBounds[0],
                            elemento.item.geometricBounds[1] + spostamento[1] + spostamentoLivelloPrecedente[1],
                            elemento.item.geometricBounds[2],
                            elemento.item.geometricBounds[3] + spostamento[1] + spostamentoLivelloPrecedente[1] 
                        ];
                        break;
                    case "colonne_right_to_left":
                        spostamento[1] = boundsGruppoDaSostituire[3] - elemento.item.geometricBounds[3];
                        elemento.item.geometricBounds = [
                            elemento.item.geometricBounds[0],
                            elemento.item.geometricBounds[1] + spostamento[1] + spostamentoLivelloPrecedente[1],
                            elemento.item.geometricBounds[2],
                            elemento.item.geometricBounds[3] + spostamento[1] + spostamentoLivelloPrecedente[1]
                        ];
                        break;
                    default:
                        spostamento[0] = boundsGruppoDaSostituire[2] - hElemento - elemento.item.geometricBounds[0];
                        elemento.item.geometricBounds = [
                            elemento.item.geometricBounds[0] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[1],
                            elemento.item.geometricBounds[2] + spostamento[0] + spostamentoLivelloPrecedente[0],
                            elemento.item.geometricBounds[3]
                        ];
                        break;
                }

                if(spostamentoMinore[0] == null || Math.abs(spostamento[0]) < Math.abs(spostamentoMinore[0])){
                    spostamentoMinore[0] = spostamento[0];
                }
                if(spostamentoMinore[1] == null || Math.abs(spostamento[1]) < Math.abs(spostamentoMinore[1])){
                    spostamentoMinore[1] = spostamento[1];
                }

                console.log(`Elemento ${Utility.parseLabel(elemento.label)} spostato di Y: ${spostamento[0]}, X: ${spostamento[1]}`);
            }

            spostamentoLivelloPrecedente = spostamentoMinore;

            //ricalcoliamo i bounds del gruppo usando solo gli elementi non eliminati, se il livello è eliminato per ora si salta poichè poi elimineremo tale livello dalla lista
            if (!gruppo.livelloEliminato) {
                let nuovoGruppoBounds = [
                    Math.min(...gruppo.elementi.map(el => el.item.geometricBounds[0])),
                    Math.min(...gruppo.elementi.map(el => el.item.geometricBounds[1])),
                    Math.max(...gruppo.elementi.map(el => el.item.geometricBounds[2])),
                    Math.max(...gruppo.elementi.map(el => el.item.geometricBounds[3])),
                ];

                gruppo.bounds = nuovoGruppoBounds;
            }
            
        }

        //un primo allineamento alla base di ogni livello è stato fatto, ora se togliamo dalla lista i livelli eliminati
        listGruppiAllineamentoBounds = listGruppiAllineamentoBounds.filter(g => !g.livelloEliminato);
        
        //ora applichiamo lo Spacing tra i gruppi se c'è
        if (Spacing != null && listGruppiAllineamentoBounds.length > 1) {
            for (var g = 1; g < listGruppiAllineamentoBounds.length; g++) {
                var gruppo = listGruppiAllineamentoBounds[g];
                var gruppoPrecedente = listGruppiAllineamentoBounds[g - 1];
                switch (this.enumLetturaLivelli(lettura)) {
                    case "righe_top_to_bottom":
                        //spostiamo il gruppo corrente in modo che il suo bound[2] sia uguale al bound[0] del gruppo precedente - Spacing
                        var spostamento = (gruppoPrecedente.bounds[0] - Spacing) - gruppo.bounds[2];
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                        }

                        //aggiorniamo la posizione del gruppo
                        gruppo.bounds = [
                            gruppo.bounds[0] + spostamento,
                            gruppo.bounds[1],
                            gruppo.bounds[2] + spostamento,
                            gruppo.bounds[3]
                        ];
                        break;
                    case "righe_bottom_to_top":
                        //spostiamo il gruppo corrente in modo che il suo bound[0] sia uguale al bound[2] del gruppo precedente + Spacing
                        var spostamento = (gruppoPrecedente.bounds[2] + Spacing) - gruppo.bounds[0];
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                        }

                        //aggiorniamo la posizione del gruppo
                        gruppo.bounds = [
                            gruppo.bounds[0] + spostamento,
                            gruppo.bounds[1],
                            gruppo.bounds[2] + spostamento,
                            gruppo.bounds[3]
                        ];
                        break;
                    case "colonne_right_to_left":
                        //spostiamo il gruppo corrente in modo che il suo bound[3] sia uguale al bound[1] del gruppo precedente - Spacing
                        var spostamento = (gruppoPrecedente.bounds[1] - Spacing) - gruppo.bounds[3];
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                        }

                        //aggiorniamo la posizione del gruppo
                        gruppo.bounds = [
                            gruppo.bounds[0],
                            gruppo.bounds[1] + spostamento,
                            gruppo.bounds[2],
                            gruppo.bounds[3] + spostamento
                        ];
                        break;
                    case "colonne_left_to_right":
                        //spostiamo il gruppo corrente in modo che il suo bound[1] sia uguale al bound[3] del gruppo precedente + Spacing
                        var spostamento = (gruppoPrecedente.bounds[3] + Spacing) - gruppo.bounds[1];
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                        }

                        //aggiorniamo la posizione del gruppo
                        gruppo.bounds = [
                            gruppo.bounds[0],
                            gruppo.bounds[1] + spostamento,
                            gruppo.bounds[2],
                            gruppo.bounds[3] + spostamento
                        ];
                        break;
                    default:
                        //spostiamo il gruppo corrente in modo che il suo bound[2] sia uguale al bound[0] del gruppo precedente - Spacing
                        var spostamento = (gruppoPrecedente.bounds[0] - Spacing) - gruppo.bounds[2];
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                        }

                        //aggiorniamo la posizione del gruppo
                        gruppo.bounds = [
                            gruppo.bounds[0] + spostamento,
                            gruppo.bounds[1],
                            gruppo.bounds[2] + spostamento,
                            gruppo.bounds[3]
                        ];
                        break;
                }
            }
        }

        //ora iniziamo l'ordinamento interno per ogni livello
        for (var g = 0; g < listGruppiAllineamentoBounds.length; g++) {
            var gruppo = listGruppiAllineamentoBounds[g];
            var InternalAnchor = gruppo.InternalAnchor;
            var InternalSpacing = gruppo.InternalSpacing;

            if(!InternalAnchor || gruppo.elementi.length < 2){
                //il livello non vuole essere ordinato internamente
                continue;
            }

            //se il gruppo ha allineaATextBounds allora dobbiamo ricalcolare i bounds dei singoli elementi
            //se sono textframe i bounds X diventano quelli dell'horizontalOffset (minore per [1] e maggiore per [3])
            //a questo punto usiamo i nuovi bounds calcolati senza però sostituire i bounds originali dell'elemento
            if(gruppo.allineaATextBounds){
                for(var e=0; e<gruppo.elementi.length; e++){
                    var elemento = gruppo.elementi[e];
                    if(elemento.item.constructorName == "TextFrame"){
                        var lines = elemento.item.lines.everyItem().getElements();
                        if(lines.length > 0){
                            var minX = Math.min(...lines.map(l => l.horizontalOffset));
                            var maxX = Math.max(...lines.map(l => l.endHorizontalOffset));

                            var prefs = elemento.item.textFramePreferences;
                            var insetLeft = prefs.insetSpacing[1];
                            var insetRight = prefs.insetSpacing[3];

                            elemento.textBounds = elemento.bounds.slice(); //copiamo i bounds originali
                            elemento.textBounds[1] = minX - insetLeft;
                            elemento.textBounds[3] = maxX + insetRight;
                        }
                    }
                }
            }

            //ordiniamo gli elementi del gruppo in base all'InternalAnchor usando il primo elemento come elemento fisso di riferimento
            var elementoRiferimento = gruppo.elementi[0];

            for (var e = 1; e < gruppo.elementi.length; e++) {
                var elemento = gruppo.elementi[e];

                if(elemento.eliminato){
                    continue;
                }

                //cerchiamo di trovare l'elemento precedente non eliminato, per spostarci fino a distanza di spancing da esso
                //se non c'è usiamo l'elemento di riferimento ma invece che spostarci a distanza di spacing ci spostiamo fino a far combaciare il bound corrispondente (es. bound[3] per right, bound[1] per left, bound[0] per top, bound[2] per bottom)
                var elementoPrecedente = null;
                for(var k = e - 1; k >= 0; k--){
                    if(!gruppo.elementi[k].eliminato){
                        elementoPrecedente = gruppo.elementi[k];
                        break;
                    }
                }

                var boundsToUse = null;
                if(elementoPrecedente){
                    boundsToUse = elementoPrecedente.textBounds ? elementoPrecedente.textBounds : elementoPrecedente.bounds;
                }

                switch (InternalAnchor.toLowerCase()) {
                    case "left":
                        //left indica che si va da sinistra verso destra
                        if(boundsToUse){
                            var spostamento = (boundsToUse[3] + InternalSpacing) - elemento.item.geometricBounds[1];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];

                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }
                        }
                        else{
                            //non c'è un elemento precedente non eliminato, usiamo l'elemento di riferimento
                            var spostamento = elementoRiferimento.item.geometricBounds[1] - elemento.item.geometricBounds[1];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }
                        }
                        break;
                    case "right":
                        //right indica che si va da destra verso sinistra
                        if(boundsToUse){
                            var spostamento = (boundsToUse[1] - InternalSpacing) - elemento.item.geometricBounds[3];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }
                        }
                        else{
                            //non c'è un elemento precedente non eliminato, usiamo l'elemento di riferimento
                            var spostamento = (elementoRiferimento.item.geometricBounds[3] - InternalSpacing) - elemento.item.geometricBounds[3];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }
                        }

                        break;
                    case "top":
                        //top indica che si va dall'alto verso il basso
                        if(boundsToUse){
                            var spostamento = (boundsToUse[2] + InternalSpacing) - elemento.item.geometricBounds[0];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0] + spostamento,
                                    elemento.textBounds[1],
                                    elemento.textBounds[2] + spostamento,
                                    elemento.textBounds[3] 
                                ];
                            }
                        }
                        else{
                            //non c'è un elemento precedente non eliminato, usiamo l'elemento di riferimento
                            var spostamento = elementoRiferimento.item.geometricBounds[0] - elemento.item.geometricBounds[0];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0] + spostamento,
                                    elemento.textBounds[1],
                                    elemento.textBounds[2] + spostamento,
                                    elemento.textBounds[3]
                                ];
                            }
                        }
                        break;
                    case "bottom":
                        //bottom indica che si va dal basso verso l'alto
                        if(boundsToUse){
                            var spostamento = (boundsToUse[0] - InternalSpacing) - elemento.item.geometricBounds[2];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0] + spostamento,
                                    elemento.textBounds[1],
                                    elemento.textBounds[2] + spostamento,
                                    elemento.textBounds[3]
                                ];
                            }
                        }
                        else{
                            //non c'è un elemento precedente non eliminato, usiamo l'elemento di riferimento
                            var spostamento = (elementoRiferimento.item.geometricBounds[2] - InternalSpacing) - elemento.item.geometricBounds[2];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0] + spostamento,
                                elemento.item.geometricBounds[1],
                                elemento.item.geometricBounds[2] + spostamento,
                                elemento.item.geometricBounds[3]
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0] + spostamento,
                                    elemento.textBounds[1],
                                    elemento.textBounds[2] + spostamento,
                                    elemento.textBounds[3]
                                ];
                            }
                        }
                        break;
                    default:
                        //left indica che si va da sinistra verso destra
                        if(boundsToUse){
                            var spostamento = (boundsToUse[3] + InternalSpacing) - elemento.item.geometricBounds[1];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];
                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }
                        }
                        else {
                            //non c'è un elemento precedente non eliminato, usiamo l'elemento di riferimento
                            var spostamento = elementoRiferimento.item.geometricBounds[1] - elemento.item.geometricBounds[1];
                            elemento.item.geometricBounds = [
                                elemento.item.geometricBounds[0],
                                elemento.item.geometricBounds[1] + spostamento,
                                elemento.item.geometricBounds[2],
                                elemento.item.geometricBounds[3] + spostamento
                            ];

                            if (gruppo.allineaATextBounds) {
                                elemento.textBounds = [
                                    elemento.textBounds[0],
                                    elemento.textBounds[1] + spostamento,
                                    elemento.textBounds[2],
                                    elemento.textBounds[3] + spostamento
                                ];
                            }

                        }
                        break;
                }
            }
        }

        return listGruppiAllineamentoBounds

    },

    checkCondition(mappaBoxOriginale, itemRef, condizione, box) {
        try{
            //la condizione ha questa struttura
            /*
            {
                "elementiDaTrovare": List<string>, //la condizione diventa false se anche solo uno di questi elementi non viene trovato
                "elementiDaNonTrovare": List<string>, //la condizione diventa false se anche solo uno di questi elementi viene trovato
                "touchCondition": [{
                    "etichetteToccanti": List<string>, //se almeno una di queste etichette
                    "etichetteToccate": List<string>, //tocca almeno una di queste etichette
                    "trueOnContact": bool //se true la condizione diventa false se non c'è contatto, se false la condizione diventa false se c'è contatto
                    "useTextBounds": bool //se true usa i textBounds invece dei bounds normali per verificare il contatto
                }],
                "kitCondition":[{
                    "canaliValidi": List<string>, //se la lista contiene almeno un elemento dobbiamo controllare che ficoProcess.getCanaleLavorazioneCorrente().codice sia uno di questi
                    "areeValide": List<string>, //se la lista contiene almeno un elemento dobbiamo controllare che ficoProcess.getAreaLavorazioneCorrente().codice sia uno di questi
                    "kitTipoLavorazioniValide": List<int>, //se la lista contiene almeno un elemento dobbiamo controllare che ficoProcess.getTipoLavorazioneCorrente() sia uno di questi
                    "kitFormatiValidi": List<string>, //se la lista contiene almeno un elemento dobbiamo controllare che ficoProcess.getFormatoLavorazioneCorrente().codice sia uno di questi
                }],
                "boxCondition":[{
                    "boxValidi": List<string>, //se la lista contiene almeno un elemento dobbiamo controllare che il box corrente sia uno di questi
                    "boxInvalidi": List<string>, //se la lista contiene almeno un elemento dobbiamo controllare che il box corrente non sia uno di questi
                }]

            }
            */
           if(!condizione){
               //se non c'è condizione la consideriamo sempre vera
               return true;
           }

            //Avendo la mappa dobbiamo controllare se la condizione è rispettata o no
            //Controlliamo prima gli elementiDaTrovare
            if (condizione.elementiDaTrovare && condizione.elementiDaTrovare.length > 0) {
                for (var i = 0; i < condizione.elementiDaTrovare.length; i++) {
                    var labelDaTrovare = condizione.elementiDaTrovare[i];
                    var regex = this.makeRegexFromGroupName(labelDaTrovare);
                    //var trovato = Object.keys(mappaBoxOriginale).some(key => regex.test(key) && !mappaBoxOriginale[key].eliminato);
                    var elementoTrovato = Object.keys(mappaBoxOriginale).some(key => regex.test(key) && !mappaBoxOriginale[key].eliminato);
                    if (!elementoTrovato) {
                        //non è stato trovato un elemento che doveva essere trovato, la condizione è falsa
                        return false;
                    }
                }
            }

            //Controlliamo poi gli elementiDaNonTrovare
            if (condizione.elementiDaNonTrovare && condizione.elementiDaNonTrovare.length > 0) {
                for (var i = 0; i < condizione.elementiDaNonTrovare.length; i++) {
                    var labelSpec = condizione.elementiDaNonTrovare[i];
                    var parsed = this.parseGroupSpec(labelSpec);
                    var regex = this.makeRegexFromGroupName(parsed.name);

                    var keys = Object.keys(mappaBoxOriginale);

                    // esiste almeno un match, anche eliminato?
                    var esisteNelMap = keys.some(key => regex.test(key));

                    // esiste un match NON eliminato?
                    var trovatoNonEliminato = keys.some(key =>
                        regex.test(key) && !mappaBoxOriginale[key].eliminato
                    );

                    // regola base: se trovo un elemento non eliminato che non doveva esserci => false
                    if (trovatoNonEliminato) {
                        return false;
                    }

                    // regola aggiuntiva [exist]:
                    // se doveva comunque esistere ma non esiste proprio nemmeno tra eliminati => false
                    if (parsed.mustExist && !esisteNelMap) {
                        return false;
                    }
                }
            }

            //Controlliamo infine le touchCondition
            if (condizione.touchCondition && condizione.touchCondition.length > 0) {
                for (var i = 0; i < condizione.touchCondition.length; i++) {
                    var touchCond = condizione.touchCondition[i];
                    if (touchCond.etichetteToccanti && touchCond.etichetteToccanti.length > 0 && touchCond.etichetteToccate && touchCond.etichetteToccate.length > 0) {
                        //dobbiamo controllare se almeno una delle etichette toccanti tocca almeno una delle etichette toccate
                        var tocca = false;
                        for (var j = 0; j < touchCond.etichetteToccanti.length; j++) {
                            var labelToccante = touchCond.etichetteToccanti[j];
                            var regex = this.makeRegexFromGroupName(labelToccante);
                            //non possiamo usare il find ma dobbiamo applicare la regex
                            var elementoToccante = Object.values(mappaBoxOriginale).find(el => regex.test(Utility.parseLabel(el.label)) && !el.eliminato);
                            if (elementoToccante) {
                                for (var k = 0; k < touchCond.etichetteToccate.length; k++) {
                                    var labelToccata = touchCond.etichetteToccate[k];
                                    var regex = this.makeRegexFromGroupName(labelToccata);
                                    var elementoToccata = Object.values(mappaBoxOriginale).find(el => regex.test(Utility.parseLabel(el.label)) && !el.eliminato);
                                    if (elementoToccata) {
                                        //controlliamo se i due elementi si toccano
                                        if (this.elementsTouching(elementoToccante.item, elementoToccata.item, touchCond.useTextBounds)) {
                                            tocca = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (tocca) {
                                break;
                            }
                        }

                        if (touchCond.trueOnContact) {
                            //la condizione diventa false se non c'è contatto
                            if (!tocca) {
                                return false;
                            }
                        }
                        else {
                            //la condizione diventa false se c'è contatto
                            if (tocca) {
                                return false;
                            }
                        }
                    }
                }
            }

            //Controlliamo infine le kitCondition
            if (condizione.kitCondition && condizione.kitCondition.length > 0) {
                var canaleObj = ficoProcess.getCanaleLavorazioneCorrente();
                if(canaleObj == null){
                    console.error("Impossibile recuperare il canale della lavorazione corrente");
                    return false;
                }
                var canale = canaleObj.sigla;
                var areaObj = ficoProcess.getAreaLavorazioneCorrente();
                if(areaObj == null){
                    console.error("Impossibile recuperare l'area della lavorazione corrente");
                    return false;
                }
                var area = areaObj.sigla;
                var tipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
                if(tipoLavorazione == null || tipoLavorazione == 0){
                    console.error("Impossibile recuperare il tipo di lavorazione corrente");
                    return false;
                }

                var formatoObj = ficoProcess.getFormatoLavorazioneCorrente();
                if(formatoObj == null){
                    console.error("Impossibile recuperare il formato della lavorazione corrente");
                    return false;
                }
                var formato = formatoObj.codice;

                var valida = false;
                for (var i = 0; i < condizione.kitCondition.length; i++) {
                    var kitCond = condizione.kitCondition[i];
                    if (kitCond.canaliValidi && kitCond.canaliValidi.length > 0) {
                        if (kitCond.canaliValidi.includes(canale)) {
                            valida = true;
                        }
                    }
                    if (kitCond.areeValide && kitCond.areeValide.length > 0) {
                        if (kitCond.areeValide.includes(area)) {
                            valida = false;
                        }
                    }
                    if (kitCond.kitTipoLavorazioniValide && kitCond.kitTipoLavorazioniValide.length > 0) {
                        if (kitCond.kitTipoLavorazioniValide.includes(tipoLavorazione)) {
                            valida = true;
                        }
                    }
                    if (kitCond.kitFormatiValidi && kitCond.kitFormatiValidi.length > 0) {
                        if (kitCond.kitFormatiValidi.includes(formato)) {
                            valida = true;
                        }
                    }
                    if (valida) {
                        break;
                    }
                }
                if (!valida) {
                    return false;
                }
            }

            //Controlliamo infine le boxCondition
            if (condizione.boxCondition && condizione.boxCondition.length > 0) {
                var valida = true;
                for (var i = 0; i < condizione.boxCondition.length; i++) {
                    var boxCond = condizione.boxCondition[i];
                    if (boxCond.boxValidi && boxCond.boxValidi.length > 0) {
                        if (!boxCond.boxValidi.includes(box.label)) {
                            valida = false;
                        }
                    }
                    if (boxCond.boxInvalidi && boxCond.boxInvalidi.length > 0) {
                        if (boxCond.boxInvalidi.includes(box.label)) {
                            valida = false;
                        }
                    }
                    if (valida) {
                        break;
                    }
                }
                if (!valida) {
                    return false;
                }
            }

            //se siamo arrivati qui la condizione è rispettata
            return true;

        }
        catch(error){
            console.error("Errore nel controllo della condizione " + JSON.stringify(condizione));
            console.error(error);
            return false;
        }
    },

    checkSetCondition(mappaBoxOriginale, itemRef, setCondition, box) {
        try {
            if (!setCondition || !setCondition.setCondizioni || setCondition.setCondizioni.length == 0) {
                //non ci sono condizioni da rispettare
                return true;
            }
            // Controlliamo se la condizione di set è rispettata
            for (var i = 0; i < setCondition.setCondizioni.length; i++) {
                var condizione = setCondition.setCondizioni[i];
                if (!this.checkCondition(mappaBoxOriginale, itemRef, condizione, box)) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            console.error("Errore nel controllo della condizione di set " + JSON.stringify(setCondition));
            console.error(error);
            return false;
        }
    },

    checkAllConditions(mappaBoxOriginale, itemRef, ListSetCondizioni, box) {
        try {
            if(ListSetCondizioni == null || ListSetCondizioni.length == 0){
                //non ci sono condizioni da rispettare
                return true;
            }
            //controlliamo se almeno una delle setCondition è rispettata
            for (var i = 0; i < ListSetCondizioni.length; i++) {
                var setCondizioni = ListSetCondizioni[i];
                if (this.checkSetCondition(mappaBoxOriginale, itemRef, setCondizioni, box)) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.error("Errore nel controllo delle condizioni " + JSON.stringify(ListSetCondizioni));
            console.error(error);
            return false;
        }
    },

    /// Rettangoli delle righe di un campo di testo, uno per riga. Sono la geometria vera
    /// del testo: baseline, ascent e descent per l'altezza, gli offset orizzontali per la
    /// larghezza, senza i margini interni del riquadro. Per quel che non e' testo, o quando
    /// le righe non si possono leggere, l'elenco resta vuoto e si torna al rettangolo unico.
    righeDiTesto(item) {
        try {
            if (item == null || item.constructorName != "TextFrame" || !item.lines) {
                return [];
            }

            var righe = [];
            var elenco = item.lines.everyItem().getElements();
            for (var i = 0; i < elenco.length; i++) {
                var linea = elenco[i];
                righe.push(cssRegoleConflitti.rettangoloDiRiga(
                    linea.baseline, linea.ascent, linea.descent,
                    linea.horizontalOffset, linea.endHorizontalOffset));
            }

            return righe;
        }
        catch (e) {
            console.log("Impossibile leggere le righe di " + (item != null ? item.label : "elemento nullo") + ": " + e);
            return [];
        }
    },

    elementsTouching(item1, item2, useTextBounds = false) {
        //controlliamo se i due item si toccano
        var b1 = useTextBounds ? this.getRealBounds(item1) : item1.geometricBounds;
        var b2 = useTextBounds ? this.getRealBounds(item2) : item2.geometricBounds;

        if (!useTextBounds) {
            return cssRegoleConflitti.rettangoliInContatto(b1, b2);
        }

        //Sul testo il rettangolo unico non basta: ingloba tutte le righe, quindi una riga
        //lunga presta la sua larghezza alla fascia dove c'e' solo una riga corta, e lo
        //spazio fra le righe conta come testo. Si confronta riga per riga.
        var righe1 = this.righeDiTesto(item1);
        var righe2 = this.righeDiTesto(item2);

        if (righe1.length == 0 && righe2.length == 0) {
            return cssRegoleConflitti.rettangoliInContatto(b1, b2);
        }

        if (righe1.length > 0 && righe2.length > 0) {
            for (var i = 0; i < righe1.length; i++) {
                if (cssRegoleConflitti.contattoConLeRighe(righe1[i], righe2, b2)) {
                    return true;
                }
            }
            return false;
        }

        //Uno solo dei due e' testo: l'altro si confronta con le sue righe.
        return righe1.length > 0
            ? cssRegoleConflitti.contattoConLeRighe(b2, righe1, b1)
            : cssRegoleConflitti.contattoConLeRighe(b1, righe2, b2);
    },

    segnalazioniConflittiPendenti: null,
    sospendiControlloSegnalazioniConflitti: false,

    getBoxKeySegnalazioniConflitti(box) {
        try {
            if (box && box.id != null) {
                return box.id.toString();
            }
        } catch (e) {}

        return box && box.label ? box.label : "";
    },

    //La lettura delle regole vive in cssRegoleConflitti: li' e' verificabile dalla suite.
    splitSegnalazioniConflittiSpec(spec) {
        return cssRegoleConflitti.splitSpec(spec);
    },

    normalizzaRegolaSegnalazioniConflitti(regola) {
        return cssRegoleConflitti.normalizzaRegola(regola);
    },

    getListaRegoleSegnalazioniConflitti(segnalazioniConflitti) {
        return cssRegoleConflitti.getListaRegole(segnalazioniConflitti);
    },

    aggiungiRegoleSegnalazioniConflitti(listRegole, elementDB, chiaviRegole) {
        if (!elementDB || elementDB.segnalazioniConflitti == null) {
            return;
        }

        var regole = this.getListaRegoleSegnalazioniConflitti(elementDB.segnalazioniConflitti);
        for (var i = 0; i < regole.length; i++) {
            var regola = regole[i];
            var key = cssRegoleConflitti.chiaveRegola(regola);
            if (chiaviRegole.indexOf(key) >= 0) {
                continue;
            }

            chiaviRegole.push(key);
            listRegole.push(regola);
        }
    },

    preparaSegnalazioniConflitti(box, DBallineamenti, DBDefault) {
        try {
            var meccanica = box.label;
            var elementAllineamento = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementAllineamentoDefault = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.length == 0) : null;
            var elementDefaultAllineamento = DBDefault ? DBDefault.find(el => el.nomiBox.includes(meccanica)) : null;
            var elementDefaultAllineamentoDefault = DBDefault ? DBDefault.find(el => el.nomiBox.length == 0) : null;

            var regole = [];
            var chiaviRegole = [];

            this.aggiungiRegoleSegnalazioniConflitti(regole, elementDefaultAllineamentoDefault, chiaviRegole);
            this.aggiungiRegoleSegnalazioniConflitti(regole, elementDefaultAllineamento, chiaviRegole);
            this.aggiungiRegoleSegnalazioniConflitti(regole, elementAllineamentoDefault, chiaviRegole);
            this.aggiungiRegoleSegnalazioniConflitti(regole, elementAllineamento, chiaviRegole);

            this.segnalazioniConflittiPendenti = {
                boxKey: this.getBoxKeySegnalazioniConflitti(box),
                boxLabel: meccanica,
                regole: regole,
                controllato: false,
                chiaviSegnalate: []
            };
        }
        catch (error) {
            console.error("Errore nella preparazione delle segnalazioni conflitti per la box " + (box && box.label ? box.label : ""));
            console.error(error);
        }
    },

    elementoVisibilePerSegnalazioniConflitti(item) {
        try {
            var current = item;
            while (current != null && current.constructorName != "Spread" && current.constructorName != "Document") {
                if (current.visible === false) {
                    return false;
                }
                current = current.parent;
            }
        } catch (e) {}

        return true;
    },

    getItemKeySegnalazioniConflitti(item, index) {
        try {
            if (item && item.id != null) {
                return item.id.toString();
            }
        } catch (e) {}

        return "idx_" + index;
    },

    getElementiSegnalazioniConflitti(box, listaEtichette) {
        var result = [];
        var chiaviAggiunte = [];
        if (!box || !box.allPageItems || !listaEtichette || listaEtichette.length == 0) {
            return result;
        }

        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (!item || item.isValid === false || item.label == null || item.label == "" || !item.geometricBounds || !this.elementoVisibilePerSegnalazioniConflitti(item)) {
                continue;
            }

            var label = Utility.parseLabel(item.label);
            for (var j = 0; j < listaEtichette.length; j++) {
                var regex = this.makeRegexFromGroupName(listaEtichette[j]);
                if (!regex.test(label)) {
                    continue;
                }

                var itemKey = this.getItemKeySegnalazioniConflitti(item, i);
                if (chiaviAggiunte.indexOf(itemKey) < 0) {
                    chiaviAggiunte.push(itemKey);
                    result.push({
                        item: item,
                        label: label,
                        key: itemKey
                    });
                }
                break;
            }
        }

        return result;
    },

    segnalaConflittoElementi(box, elementoA, elementoB, pendente) {
        var labels = [elementoA.label, elementoB.label].sort();
        var pairKey = labels[0] + "|" + labels[1] + "|" + [elementoA.key, elementoB.key].sort().join("|");
        if (pendente.chiaviSegnalate.indexOf(pairKey) >= 0) {
            return;
        }

        pendente.chiaviSegnalate.push(pairKey);

        var boxLabel = box && box.label ? box.label : "senza etichetta";
        var msg = "Code CSF-013: Conflitto tra elementi nel box " + boxLabel + ": " + elementoA.label + " non dovrebbe toccare " + elementoB.label + ".";
        messaggioUtente(msg, "warning");
        addSegnalazione(msg, "warning", 2, true, ["CSF-013", "yellow"]);
    },

    controllaSegnalazioniConflittiPendenti(box) {
        try {
            var pendente = this.segnalazioniConflittiPendenti;
            if (!pendente || pendente.controllato || !pendente.regole || pendente.regole.length == 0 || !box) {
                return;
            }

            var boxKey = this.getBoxKeySegnalazioniConflitti(box);
            if (pendente.boxKey != "" && boxKey != "" && pendente.boxKey != boxKey && pendente.boxLabel != box.label) {
                return;
            }

            for (var i = 0; i < pendente.regole.length; i++) {
                var regola = pendente.regole[i];
                var elementiA = this.getElementiSegnalazioniConflitti(box, regola.latoA);

                if (regola.latoB.length == 0) {
                    for (var a = 0; a < elementiA.length; a++) {
                        for (var b = a + 1; b < elementiA.length; b++) {
                            if (this.elementsTouching(elementiA[a].item, elementiA[b].item, regola.useTextBounds)) {
                                this.segnalaConflittoElementi(box, elementiA[a], elementiA[b], pendente);
                            }
                        }
                    }
                    continue;
                }

                var elementiB = this.getElementiSegnalazioniConflitti(box, regola.latoB);
                for (var a = 0; a < elementiA.length; a++) {
                    for (var b = 0; b < elementiB.length; b++) {
                        if (elementiA[a].key == elementiB[b].key) {
                            continue;
                        }

                        if (this.elementsTouching(elementiA[a].item, elementiB[b].item, regola.useTextBounds)) {
                            this.segnalaConflittoElementi(box, elementiA[a], elementiB[b], pendente);
                        }
                    }
                }
            }

            pendente.controllato = true;
        }
        catch (error) {
            console.error("Errore nel controllo delle segnalazioni conflitti per la box " + (box && box.label ? box.label : ""));
            console.error(error);
        }
    },
    

    applicaAllineamentoCss(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, bypassDownload = true, momento = cssSequenzaOperazioni.standard) {
        try {
            let me = this;

            mappaBoxOriginale = CssFramework.updateMap(mappaBoxOriginale);

            if (this.semaforoDownloadFramework) {// !bypassDownload) {
                this.getAllineamentiDB(async function (err, allineamentiDB) {
                    var file = allineamentiDB;
                    if (file) {
                        //facciamo il parse del file JSON
                        console.log(file);
                    }
                    if (err) {
                        file = readFile(pathLavorazione + "/allineamenti.json");
                        if (!file) {
                            console.error("Non è stato possibile leggere il file di allineamenti in locale. Operazione annullata.");
                            return box;
                        }
                        else {
                            console.error("Non è stato possibile aggiornare il file di allineamenti, sarà usata l'ultima versione scaricata: Versione " + file.version, err);
                        }
                    }

                    var ficoArea = ficoProcess.getAreaLavorazioneCorrente();
                    if(ficoArea==null){
                        messaggioUtente("Code CSF-03: Non è stata trovata l'area di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null,
                            box: box
                        }
                        return box;
                    }

                    var currentArea = ficoArea.sigla;

                    var ficoCanale = ficoProcess.getCanaleLavorazioneCorrente();
                    if(ficoCanale==null){
                        messaggioUtente("Code CSF-04: Non è stato trovato il canale di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null,
                            box: box
                        }
                        return box;
                    }

                    var currentCanale = ficoCanale.sigla;

                    var kitTipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
                    if(kitTipoLavorazione==null || kitTipoLavorazione == 0){
                        messaggioUtente("Code CSF-05: Non è stato trovato il tipo di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null,
                            box: box
                        }
                        return box;
                    }

                    var ficoFormato = ficoProcess.getFormatoLavorazioneCorrente();
                    if(ficoFormato==null){
                        messaggioUtente("Code CSF-06: Non è stato trovato il formato di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                        result = {
                            esito: false,
                            mappaBoxOriginale: null,
                            box: box
                        }
                        return box;
                    }

                    var kitFormato = ficoFormato.codice;

                    //cerchiamo in file.modificheCssPerKit un elemento con area e canale uguali a quelli correnti
                    var fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                    //se non lo troviamo proviamo a cercare solo per area
                    if (!fileModifiche) {
                        fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0) );
                    }
                    //se non lo troviamo proviamo a cercare solo per canale
                    if (!fileModifiche) {
                        fileModifiche = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0) );
                    }
                    //se non lo troviamo prendiamo quello di default (area e canale vuoti)
                    //if (!fileModifiche) {
                    var fileModificheDef = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0) );
                    //}
                    if(!fileModifiche){
                        fileModifiche = fileModificheDef;
                    }

                    //se non c'è mandiamo un errore perchè non sono state inserite nell'external source nessuna modifica css
                    if (!fileModifiche) {
                        if(kitFormato != null){
                            console.error("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + ", il canale " + currentCanale + " e il formato " + kitFormato + " e non è stato definito un default.");
                            messaggioUtente("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + ", il canale " + currentCanale + " e il formato " + kitFormato + " e non è stato definito un default.", "error");
                            return box;
                        }
                        console.error("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.");
                        messaggioUtente("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.", "error");
                        return box;
                    }
                    

                    var DB = fileModifiche ? fileModifiche.operazioniPerBox : null;
                    var DBDefault = fileModificheDef ? fileModificheDef.operazioniPerBox : null;

                    me.memorizzaContestoCss(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DB, DBDefault);

                    var DBMomento = cssSequenzaOperazioni.filtraDBPerMomento(DB, momento);
                    var DBDefaultMomento = cssSequenzaOperazioni.filtraDBPerMomento(DBDefault, momento);

                    me.preparaSegnalazioniConflitti(box, DB, DBDefault);
                    box = me.allineamenti(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DBMomento, DBDefaultMomento);
                    //Dopo gli allineamenti: le copie derivano dalla posizione definitiva degli elementi.
                    box = me.applicaComposizioneBox(box, mappaBoxOriginale, itemRef, DB, DBDefault);
                    return box;
                });
            }
            else{
                var file = readFile(pathLavorazione + "/allineamenti.json");
                if (!file) {
                    console.error("Non è stato possibile leggere il file di allineamenti in locale. Operazione annullata.");
                    return;
                }

                var ficoArea = ficoProcess.getAreaLavorazioneCorrente();
                if (ficoArea == null) {
                    messaggioUtente("Code CSF-03: Non è stata trovata l'area di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null,
                        box: box
                    }
                    return box;
                }

                var currentArea = ficoArea.sigla;

                var ficoCanale = ficoProcess.getCanaleLavorazioneCorrente();
                if (ficoCanale == null) {
                    messaggioUtente("Code CSF-04: Non è stato trovato il canale di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null,
                        box: box
                    }
                    return box;
                }

                var currentCanale = ficoCanale.sigla;

                var kitTipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
                if (kitTipoLavorazione == null || kitTipoLavorazione == 0) {
                    messaggioUtente("Code CSF-05: Non è stato trovato il tipo di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null,
                        box: box
                    }
                    return box;
                }

                var ficoFormato = ficoProcess.getFormatoLavorazioneCorrente();
                if (ficoFormato == null) {
                    messaggioUtente("Code CSF-06: Non è stato trovato il formato di lavorazione corrente. Impossibile procedere con il ridimensionamento CSS.", "error");
                    result = {
                        esito: false,
                        mappaBoxOriginale: null,
                        box: box
                    }
                    return box;
                }

                var kitFormato = ficoFormato.codice;

                //cerchiamo in file.modificheCssPerKit un elemento con area e canale uguali a quelli correnti
                var fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                //se non lo troviamo proviamo a cercare solo per area
                if (!fileModifiche) {
                    fileModifiche = file.modificheCssPerKit.find(el => el.kit.areeValide != null && el.kit.areeValide.includes(currentArea) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                }
                //se non lo troviamo proviamo a cercare solo per canale
                if (!fileModifiche) {
                    fileModifiche = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && el.kit.canaliValidi != null && el.kit.canaliValidi.includes(currentCanale) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                }
                //se non lo troviamo prendiamo quello di default (area e canale vuoti)
                // if (!fileModifiche) {
                //     fileModifiche = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0));
                // }

                var fileModificheDef = file.modificheCssPerKit.find(el => (el.kit.areeValide == null || el.kit.areeValide.length === 0) && (el.kit.canaliValidi == null || el.kit.canaliValidi.length === 0) && (el.kit.kitTipoLavorazioniValide == null || el.kit.kitTipoLavorazioniValide.includes(kitTipoLavorazione) || el.kit.kitTipoLavorazioniValide.length === 0) && (el.kit.kitFormatiValidi == null || el.kit.kitFormatiValidi.includes(kitFormato) || el.kit.kitFormatiValidi.length === 0));
                
                if (!fileModifiche) {
                    fileModifiche = fileModificheDef;
                }

                //se non c'è mandiamo un errore perchè non sono state inserite nell'external source nessuna modifica css
                if (!fileModifiche) {
                    if (kitFormato != null) {
                        console.error("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + ", il canale " + currentCanale + " e il formato " + kitFormato + " e non è stato definito un default.");
                        messaggioUtente("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + ", il canale " + currentCanale + " e il formato " + kitFormato + " e non è stato definito un default.", "error");
                        return box;
                    }
                    console.error("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.");
                    messaggioUtente("Code CSF-07: Non sono state trovate modifiche css per l'area " + currentArea + " e il canale " + currentCanale + " e non è stato definito un default.", "error");
                    return box;
                }

                var DB = fileModifiche ? fileModifiche.operazioniPerBox : null;
                var DBDefault = fileModificheDef ? fileModificheDef.operazioniPerBox : null;

                //Il contesto resta a disposizione dei passaggi successivi: la scelta dello spazio
                //foto e le operazioni del momento dopoFixFoto non rileggono il file per ogni box.
                me.memorizzaContestoCss(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DB, DBDefault);

                var DBMomento = cssSequenzaOperazioni.filtraDBPerMomento(DB, momento);
                var DBDefaultMomento = cssSequenzaOperazioni.filtraDBPerMomento(DBDefault, momento);

                me.preparaSegnalazioniConflitti(box, DB, DBDefault);
                box = me.allineamenti(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DBMomento, DBDefaultMomento);
                //Dopo gli allineamenti: le copie derivano dalla posizione definitiva degli elementi.
                box = me.applicaComposizioneBox(box, mappaBoxOriginale, itemRef, DB, DBDefault);
                return box;
            }
        }
        catch (error) {
            console.error("Errore nell'applicazione del CSS alla box " + box.label);
            console.error(error);
        }

        return box;
    },

    allineamenti(box, boundsBoxImpaginato, mappaBoxOriginale, itemRef, DBallineamenti, DBDefault) {
        //leggiamo la label del box per capire che meccanica è
        //cerchiamo nel DB l'elemento la cui variabile nomiBox contiene la meccanica

        var meccanica = box.label;
        var elementAllineamento = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.includes(meccanica)) : null;
        var elementAllineamentoDefault = DBallineamenti ? DBallineamenti.find(el => el.nomiBox.length == 0) : null;
        var elementDefaultAllineamento = DBDefault ? DBDefault.find(el => el.nomiBox.includes(meccanica)) : null;
        var elementDefaultAllineamentoDefault = DBDefault ? DBDefault.find(el => el.nomiBox.length == 0) : null;

        if (!elementAllineamento && !elementAllineamentoDefault) {
            console.error("Non è stato trovato nessun allineamento per la meccanica " + meccanica + " e l'allineamento di default non è definito");
            return box;
        }

        var listAllineamenti = [];

        if (elementDefaultAllineamentoDefault) {
            for (var i = 0; i < elementDefaultAllineamentoDefault.allineamenti.length; i++) {
                var allineamentoSingolo = elementDefaultAllineamentoDefault.allineamenti[i];

                //cerchiamo se il NomeGruppo è presente in elementDefaultAllineamento, elementAllineamentoDefault o elementAllineamento, se c'è per ora saltiamo
                if (elementDefaultAllineamento || elementAllineamentoDefault || elementAllineamento) {
                    var allineamentiPossibili = [];

                    if (elementDefaultAllineamento) {
                        allineamentiPossibili = allineamentiPossibili.concat(elementDefaultAllineamento.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo));
                    }

                    if (elementAllineamentoDefault) {
                        allineamentiPossibili = allineamentiPossibili.concat(elementAllineamentoDefault.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo));
                    }

                    if (elementAllineamento) {
                        allineamentiPossibili = allineamentiPossibili.concat(elementAllineamento.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo));
                    }

                    if (allineamentiPossibili.length > 0) {
                        var skip = false;
                        for (var k = 0; k < allineamentiPossibili.length; k++) {
                            var allineamentoEl = allineamentiPossibili[k];
                            //controlliamo se l'elemento corrispondente ha condizioni, se le ha le controlliamo
                            if (allineamentoEl.listSetCondizioni && allineamentoEl.listSetCondizioni.length > 0) {
                                if (this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoEl.listSetCondizioni, box)) {
                                    //le condizioni sono rispettate, saltiamo l'allineamento di default
                                    skip = true;
                                    break;
                                }
                            }
                            else {
                                //non ha condizioni, saltiamo l'allineamento di default
                                skip = true;
                                break;
                            }
                        }
                        if (skip) {
                            continue;
                        }
                    }
                }

                //controlliamo le condizioni se ci sono, se non sono rispettate saltiamo questo allineamento
                if (allineamentoSingolo.listSetCondizioni && allineamentoSingolo.listSetCondizioni.length > 0) {
                    if (!this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoSingolo.listSetCondizioni, box)) {
                        //le condizioni non sono rispettate, saltiamo questo allineamento
                        continue;
                    }
                }

                listAllineamenti.push(allineamentoSingolo);

            }
        }

        //ripetiamo per elementAllineamento se esiste
        if (elementDefaultAllineamento) {
            for (var i = 0; i < elementDefaultAllineamento.allineamenti.length; i++) {
                var allineamentoSingolo = elementDefaultAllineamento.allineamenti[i];

                //lo controlliamo in elementAllineamento e elementAllineamentoDefault, se c'è per ora saltiamo
                if (elementAllineamento || elementAllineamentoDefault) {
                    var allineamentiPossibili = [];

                    if (elementAllineamento) {
                        allineamentiPossibili = allineamentiPossibili.concat(elementAllineamento.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo));
                    }

                    if (elementAllineamentoDefault) {
                        allineamentiPossibili = allineamentiPossibili.concat(elementAllineamentoDefault.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo));
                    }

                    if (allineamentiPossibili.length > 0) {
                        var skip = false;
                        for (var k = 0; k < allineamentiPossibili.length; k++) {
                            var allineamentoEl = allineamentiPossibili[k];
                            //controlliamo se l'elemento corrispondente ha condizioni, se le ha le controlliamo
                            if (allineamentoEl.listSetCondizioni && allineamentoEl.listSetCondizioni.length > 0) {
                                if (this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoEl.listSetCondizioni, box)) {
                                    //le condizioni sono rispettate, saltiamo l'allineamento di default
                                    skip = true;
                                    break;
                                }
                            }
                            else {
                                //non ha condizioni, saltiamo l'allineamento di default
                                skip = true;
                                break;
                            }
                        }
                        if (skip) {
                            continue;
                        }
                    }
                }

                //controlliamo le condizioni se ci sono, se non sono rispettate saltiamo questo allineamento
                if (allineamentoSingolo.listSetCondizioni && allineamentoSingolo.listSetCondizioni.length > 0) {
                    if (!this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoSingolo.listSetCondizioni, box)) {
                        //le condizioni non sono rispettate, saltiamo questo allineamento
                        continue;
                    }
                }

                listAllineamenti.push(allineamentoSingolo);
            }
        }




        if (elementAllineamentoDefault) {
            for (var i = 0; i < elementAllineamentoDefault.allineamenti.length; i++) {
                var allineamentoSingolo = elementAllineamentoDefault.allineamenti[i];

                //cerchiamo se il NomeGruppo è presente in elementAllineamento, se c'è per ora saltiamo
                if (elementAllineamento) {
                    var allineamentoElemento = elementAllineamento.allineamenti.filter(el => el.nomeGruppo == allineamentoSingolo.nomeGruppo);

                    if (allineamentoElemento.length > 0) {
                        var skip = false;
                        for (var k = 0; k < allineamentoElemento.length; k++) {
                            var allineamentoEl = allineamentoElemento[k];
                            //controlliamo se l'elemento corrispondente in elementAllineamento ha condizioni, se le ha le controlliamo
                            if (allineamentoEl.listSetCondizioni && allineamentoEl.listSetCondizioni.length > 0) {
                                if (this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoEl.listSetCondizioni, box)) {
                                    //le condizioni sono rispettate, saltiamo l'allineamento di default
                                    skip = true;
                                    break;
                                }
                            }
                            else {
                                //non ha condizioni, saltiamo l'allineamento di default
                                skip = true;
                                break;
                            }
                        }
                        if (skip) {
                            continue;
                        }
                    }
                }

                //controlliamo le condizioni se ci sono, se non sono rispettate saltiamo questo allineamento
                if (allineamentoSingolo.listSetCondizioni && allineamentoSingolo.listSetCondizioni.length > 0) {
                    if (!this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoSingolo.listSetCondizioni, box)) {
                        //le condizioni non sono rispettate, saltiamo questo allineamento
                        continue;
                    }
                }

                listAllineamenti.push(allineamentoSingolo);

            }
        }

        //ripetiamo per elementAllineamento se esiste
        if (elementAllineamento) {
            for (var i = 0; i < elementAllineamento.allineamenti.length; i++) {
                var allineamentoSingolo = elementAllineamento.allineamenti[i];


                //controlliamo le condizioni se ci sono, se non sono rispettate saltiamo questo allineamento
                if (allineamentoSingolo.listSetCondizioni && allineamentoSingolo.listSetCondizioni.length > 0) {
                    if (!this.checkAllConditions(mappaBoxOriginale, itemRef, allineamentoSingolo.listSetCondizioni, box)) {
                        //le condizioni non sono rispettate, saltiamo questo allineamento
                        continue;
                    }
                }

                listAllineamenti.push(allineamentoSingolo);

            }
        }

        //ordiniamo la listAllineamenti usando .ordine come chiave
        listAllineamenti.sort((a, b) => a.ordine - b.ordine);

        for (var i = 0; i < listAllineamenti.length; i++) {
            var allineamentoSingolo = listAllineamenti[i];
            var gruppoElementi = [];
            var isItemLinkGruppo = false;

            for (var j = 0; j < allineamentoSingolo.gruppoEtichette.length; j++) {
                var labelElemento = allineamentoSingolo.gruppoEtichette[j];

                if (/\[itemLink\]$/i.test(labelElemento)) {
                    isItemLinkGruppo = true;
                }

                var regex = this.makeRegexFromGroupName(labelElemento);
                for (var key in mappaBoxOriginale) {
                    if (regex.test(key)) {
                        gruppoElementi.push(mappaBoxOriginale[key]);
                    }
                }
            }

            if (isItemLinkGruppo && allineamentoSingolo.gruppoEtichette.length > 1) {
                // allineamento non valido per un itemLink
                isItemLinkGruppo = false;
            }

            let listGruppoAllineamento = this.AllineamentoInternoGruppo(
                box,
                allineamentoSingolo.nomeGruppo,
                gruppoElementi, // Create a deep copy to avoid modifying the original structure
                JSON.parse(JSON.stringify(allineamentoSingolo.ordinamentoLivelli)),
                allineamentoSingolo.letturaLivelli,
                allineamentoSingolo.spacingLivelli,
                mappaBoxOriginale, // Create a deep copy to avoid modifying the original structure
                itemRef
            );
            let allineamentiRiusciti = {
                x: false,
                y: false
            };
            if (allineamentoSingolo.followAnchor != null && allineamentoSingolo.followAnchor.length > 0) {
                allineamentiRiusciti = this.FollowAnchorGruppo(mappaBoxOriginale, listGruppoAllineamento, allineamentoSingolo.followAnchor, elementAllineamento, elementAllineamentoDefault, elementDefaultAllineamento, elementDefaultAllineamentoDefault, itemRef, box, isItemLinkGruppo);
            }

            if (allineamentoSingolo.staticAnchor != null && allineamentoSingolo.staticAnchor.length > 0) {
                allineamentiRiusciti = this.followStaticAnchor(box, listGruppoAllineamento, allineamentoSingolo.staticAnchor, mappaBoxOriginale, itemRef, allineamentiRiusciti, isItemLinkGruppo);
            }

            if (allineamentoSingolo.finalFit && allineamentoSingolo.finalFit.length > 0) {
                this.finalFit(mappaBoxOriginale, allineamentoSingolo.finalFit);
            }

            if (allineamentoSingolo.evitaTracciaAllineamento && allineamentoSingolo.evitaTracciaAllineamento.evitaTracciaBase) {
                this.fixCollisioneTracciaBase(box, listGruppoAllineamento, allineamentoSingolo.evitaTracciaAllineamento);
            }

            box = this.fixOverflowFromBox(boundsBoxImpaginato, box, mappaBoxOriginale);

        }

        return box;
    },

    FollowAnchorGruppo(mappaBoxOriginale, gruppoAllineamento, anchor, elementAllineamento, elementAllineamentoDefault, elementDefaultAllineamento, elementDefaultAllineamentoDefault, itemRef, box, isItemLinkGruppo) {
        //struttura di un anchor
        // followAnchor: [{
        //     nomiGruppiSeguiti: ["id"], //il nome del gruppo che viene seguito, può essere anche il nome di una label, in quel caso viene seguita quella label
        //     XAnchor:{
        //         distance: 0, //la distanza orizzontale in mm che deve essere mantenuta tra la y del gruppo corrente e la y del gruppo seguito.
        //         allineaAlLato: "left", //ha due valori (left-right-middle). Indica il lato del gruppo target al quale ci avviciniamo
        //         allineaLato: "left", //I valori sono (left-right-middle). Indica il lato di riferimento del gruppo in allineamento
        //         stopOnCollision: true, //Quando si fa il follow ci si ferma in anticipo in caso di collisione
        //     YAnchor:{
        //         distance: 0, //la distanza orizzontale in mm che deve essere mantenuta tra la y del gruppo corrente e la y del gruppo seguito.
        //         allineaAlLato: "top", //ha due valori (top-down-middle). Indica il lato del gruppo target al quale ci avviciniamo
        //         allineaLato: "top", //I valori sono (top-down-middle). Indica il lato di riferimento del gruppo in allineamento
        //         stopOnCollision: true, //Quando si fa il follow ci si ferma in anticipo in caso di collisione
        //     },
        //     condition: {}
        //     priority: "x", //indica se la priorità è sulla x o sulla y, se non specificato o il valore non è valido viene considerata la x
        // }]

        var allineamentoRiuscito = {
            x: false,
            y: false
        };

        if(gruppoAllineamento.length == 0){
            return allineamentoRiuscito;
        }

        //scorriamo uno ad uno gli anchor
        for (var a = 0; a < anchor.length; a++) {
            var singleAnchor = anchor[a];

            //controlliamo se la lista dei nomi dei gruppi seguiti contiene elementi, se non c'è saltiamo
            if (!singleAnchor.nomiGruppiSeguiti || singleAnchor.nomiGruppiSeguiti.length == 0) {
                continue;
            }

            //controlliamo le condizioni
            if (singleAnchor.listSetCondizioni && singleAnchor.listSetCondizioni.length > 0) {
                if (!this.checkAllConditions(mappaBoxOriginale, itemRef, singleAnchor.listSetCondizioni, box)) {
                    //le condizioni non sono rispettate, saltiamo questo anchor
                    continue;
                }
            }



            var gruppoSeguito = [];


            //scorriamo uno ad uno i nomi dei gruppi seguiti, per ognuno proviamo a cercarlo prima in nel DBallineamenti, se non c'è proviamo a cercarlo come label in mappaBoxOriginale
            for (var n = 0; n < singleAnchor.nomiGruppiSeguiti.length; n++) {
                var nomeGruppoSeguito = singleAnchor.nomiGruppiSeguiti[n];

                //cerchiamo il gruppo nel DBallineamenti
                var allineamentoSeguito = null;
                var allineamentiPossibili = [];

                if (elementAllineamento) {
                    allineamentiPossibili = elementAllineamento.allineamenti.filter(a => {
                        var regex = this.makeRegexFromGroupName(nomeGruppoSeguito);
                        return regex.test(a.nomeGruppo);
                    });
                }

                //controlliamo le condizioni dell'allineamento seguito
                if (allineamentiPossibili && allineamentiPossibili.length > 0) {
                    for (var ap = 0; ap < allineamentiPossibili.length; ap++) {
                        var possibile = allineamentiPossibili[ap];
                        if (possibile.listSetCondizioni && possibile.listSetCondizioni.length > 0) {
                            if (this.checkAllConditions(mappaBoxOriginale, itemRef, possibile.listSetCondizioni, box)) {
                                allineamentoSeguito = possibile;
                                break;
                            }
                        }
                        else{
                            allineamentoSeguito = possibile;
                            break;
                        }
                    }
                }

                allineamentiPossibili = [];

                if (!allineamentoSeguito && elementAllineamentoDefault) {
                    allineamentiPossibili = elementAllineamentoDefault.allineamenti.filter(a => {
                        var regex = this.makeRegexFromGroupName(nomeGruppoSeguito);
                        return regex.test(a.nomeGruppo);
                    });
                }

                //controlliamo le condizioni dell'allineamento seguito di default
                if (allineamentiPossibili && allineamentiPossibili.length > 0) {
                    for (var ap = 0; ap < allineamentiPossibili.length; ap++) {
                        var possibile = allineamentiPossibili[ap];
                        if (possibile.listSetCondizioni && possibile.listSetCondizioni.length > 0) {
                            if (this.checkAllConditions(mappaBoxOriginale, itemRef, possibile.listSetCondizioni, box)) {
                                allineamentoSeguito = possibile;
                                break;
                            }
                        }
                        else{
                            allineamentoSeguito = possibile;
                            break;
                        }
                    }
                }

                allineamentiPossibili = [];

                if (!allineamentoSeguito && elementDefaultAllineamento) {
                    allineamentiPossibili = elementDefaultAllineamento.allineamenti.filter(a => {
                        var regex = this.makeRegexFromGroupName(nomeGruppoSeguito);
                        return regex.test(a.nomeGruppo);
                    });
                }

                //controlliamo le condizioni dell'allineamento seguito di default del default
                if (allineamentiPossibili && allineamentiPossibili.length > 0) {
                    for (var ap = 0; ap < allineamentiPossibili.length; ap++) {
                        var possibile = allineamentiPossibili[ap];
                        if (possibile.listSetCondizioni && possibile.listSetCondizioni.length > 0) {
                            if (this.checkAllConditions(mappaBoxOriginale, itemRef, possibile.listSetCondizioni, box)) {
                                allineamentoSeguito = possibile;
                                break;
                            }
                        }
                        else{
                            allineamentoSeguito = possibile;
                            break;
                        }
                    }
                }

                allineamentiPossibili = [];

                if (!allineamentoSeguito && elementDefaultAllineamentoDefault) {
                    allineamentiPossibili = elementDefaultAllineamentoDefault.allineamenti.filter(a => {
                        var regex = this.makeRegexFromGroupName(nomeGruppoSeguito);
                        return regex.test(a.nomeGruppo);
                    });
                }

                //controlliamo le condizioni dell'allineamento seguito di default del default
                if (allineamentiPossibili && allineamentiPossibili.length > 0) {
                    for (var ap = 0; ap < allineamentiPossibili.length; ap++) {
                        var possibile = allineamentiPossibili[ap];
                        if (possibile.listSetCondizioni && possibile.listSetCondizioni.length > 0) {
                            if (this.checkAllConditions(mappaBoxOriginale, itemRef, possibile.listSetCondizioni, box)) {
                                allineamentoSeguito = possibile;
                                break;
                            }
                        }
                        else{
                            allineamentoSeguito = possibile;
                            break;
                        }
                    }
                }

                if (allineamentoSeguito) {
                    for (var i = 0; i < allineamentoSeguito.gruppoEtichette.length; i++) {
                        var etichetta = allineamentoSeguito.gruppoEtichette[i];
                        // cerchiamo l'elemento in mappaBoxOriginale e se non è eliminato lo mettiamo nel gruppo seguito
                        if (mappaBoxOriginale[etichetta] && !mappaBoxOriginale[etichetta].eliminato) {
                            gruppoSeguito.push(mappaBoxOriginale[etichetta]);
                        }         
                    }
                    if (gruppoSeguito.length > 0) {
                        break;
                    }
                }
                else {
                    //cerchiamo l'elemento in mappaBoxOriginale e se non è eliminato lo mettiamo nel gruppo seguito
                    var regex = this.makeRegexFromGroupName(nomeGruppoSeguito);
                    for (var key in mappaBoxOriginale) {
                        if (regex.test(key) && !mappaBoxOriginale[key].eliminato) {
                            gruppoSeguito.push(mappaBoxOriginale[key]);
                            break;
                        }
                    }
                }
            }

            if (gruppoSeguito.length == 0) {
                //non è stato trovato nessun gruppo da seguire, passiamo a vedere la prossima ancora di follow
                continue;
            }

            console.log("Follow Anchor: Gruppo seguito composto da " + gruppoSeguito.length + " elementi");
            console.log(gruppoSeguito);
            console.log("Gruppo di allineamento: ", gruppoAllineamento);
            console.log("Anchor: ", singleAnchor);

            if(this.enumPriorityAxis(singleAnchor.priority) == "y"){
                allineamentoRiuscito.y = this.followGroup(gruppoSeguito, gruppoAllineamento, singleAnchor.yAnchor, "y", singleAnchor.useTextBounds, isItemLinkGruppo);
                allineamentoRiuscito.x = this.followGroup(gruppoSeguito, gruppoAllineamento, singleAnchor.xAnchor, "x", singleAnchor.useTextBounds, isItemLinkGruppo);
            }
            else{
                allineamentoRiuscito.x = this.followGroup(gruppoSeguito, gruppoAllineamento, singleAnchor.xAnchor, "x", singleAnchor.useTextBounds, isItemLinkGruppo);
                allineamentoRiuscito.y = this.followGroup(gruppoSeguito, gruppoAllineamento, singleAnchor.yAnchor, "y", singleAnchor.useTextBounds, isItemLinkGruppo);
            }
        }

        return allineamentoRiuscito;
    },

    // makeRegexFromGroupName(groupName) {
    //     // Escapa i caratteri speciali, tranne *
    //     let escaped = groupName.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    //     // Converte * in .*
    //     let regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    //     return new RegExp(regexStr);
    // },

    /*
     * I20-970: elementi derivati e ordine di sovrapposizione.
     *
     * Il framework sapeva spostare, ridimensionare e allineare quello che gia' esisteva nel box,
     * non crearne di nuovi ne' decidere chi sta davanti a chi. Le due regole vivono nel DB come
     * tutte le altre, cosi' il comportamento resta dato e non finisce in custom.js.
     *
     * Le decisioni (quali copie, con che etichetta, con che bounds, cosa mandare dietro a cosa)
     * stanno in cssComposizioneBox, verificabile fuori da InDesign; qui si esegue soltanto.
     */
    getElementiComposizione(box) {
        var elementi = [];
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (item == null || !item.isValid || item.label == null || item.label === "") {
                continue;
            }
            elementi.push({ etichetta: item.label, bounds: item.geometricBounds, item: item });
        }
        return elementi;
    },

    regoleComposizioneAttive(regole, mappaBoxOriginale, itemRef, box) {
        var attive = [];
        if (regole == null) {
            return attive;
        }
        for (var i = 0; i < regole.length; i++) {
            var regola = regole[i];
            if (regola == null) {
                continue;
            }
            if (regola.listSetCondizioni != null && regola.listSetCondizioni.length > 0
                && !this.checkAllConditions(mappaBoxOriginale, itemRef, regola.listSetCondizioni, box)) {
                continue;
            }
            attive.push(regola);
        }
        return attive;
    },

    applicaComposizioneBox(box, mappaBoxOriginale, itemRef, DBallineamenti, DBDefault) {
        try {
            var me = this;
            var elementoBox = me.getElementoBoxDB(box, DBallineamenti, DBDefault);
            if (elementoBox == null) {
                return box;
            }

            var regoleDuplicazioni = me.regoleComposizioneAttive(elementoBox.duplicazioni, mappaBoxOriginale, itemRef, box);
            var regoleOrdiniZ = me.regoleComposizioneAttive(elementoBox.ordiniZ, mappaBoxOriginale, itemRef, box);

            if (regoleDuplicazioni.length === 0 && regoleOrdiniZ.length === 0) {
                return box;
            }

            var corrisponde = function (etichetta, spec) {
                return me.makeRegexFromGroupName(spec).test(etichetta);
            };

            var adattaContenuto = function (item, fitContenuto) {
                //Ridimensionare il riquadro non ridimensiona il grafico che contiene.
                if (fitContenuto == null || item.graphics == null || item.graphics.length === 0) {
                    return;
                }
                item.fit(fitContenuto === "proporzionale" ? FitOptions.PROPORTIONALLY : FitOptions.CONTENT_TO_FRAME);
            };

            if (regoleDuplicazioni.length > 0) {
                var elementi = me.getElementiComposizione(box);
                var piano = cssComposizioneBox.pianificaDuplicazioni(regoleDuplicazioni, elementi, corrisponde);
                var copieCreate = [];

                for (var c = 0; c < piano.copie.length; c++) {
                    var copia = piano.copie[c];
                    var modello = elementi.find(el => el.etichetta === copia.etichettaModello);
                    if (modello == null || !modello.item.isValid) {
                        continue;
                    }
                    try {
                        //La copia nasce sullo spread, fuori dal gruppo: InDesign non permette di
                        //aggiungere un elemento a un gruppo esistente. Si rientra dopo, tutte insieme.
                        var nuovo = modello.item.duplicate();
                        nuovo.label = copia.etichetta;
                        nuovo.geometricBounds = copia.bounds;
                        adattaContenuto(nuovo, copia.fitContenuto);
                        copieCreate.push(nuovo);
                    }
                    catch (e) {
                        console.error("Code CSF-10: duplicazione di " + copia.etichettaModello + " non riuscita: " + e);
                    }
                }

                for (var a = 0; a < piano.aggiornamenti.length; a++) {
                    var aggiornamento = piano.aggiornamenti[a];
                    var daAggiornare = elementi.find(el => el.etichetta === aggiornamento.etichetta);
                    if (daAggiornare == null || !daAggiornare.item.isValid) {
                        continue;
                    }
                    try {
                        daAggiornare.item.geometricBounds = aggiornamento.bounds;
                        adattaContenuto(daAggiornare.item, aggiornamento.fitContenuto);
                    }
                    catch (e) {
                        console.error("Code CSF-14: aggiornamento di " + aggiornamento.etichetta + " non riuscito: " + e);
                    }
                }

                //Le rimozioni per ultime: il modello serve finche' ci sono copie da creare.
                for (var r = 0; r < piano.rimozioni.length; r++) {
                    var daRimuovere = elementi.find(el => el.etichetta === piano.rimozioni[r]);
                    if (daRimuovere == null || !daRimuovere.item.isValid) {
                        continue;
                    }
                    try {
                        daRimuovere.item.remove();
                    }
                    catch (e) {
                        console.error("Code CSF-11: rimozione di " + piano.rimozioni[r] + " non riuscita: " + e);
                    }
                }

                //Fuori dal gruppo le copie non le vedrebbe piu' nessuno: ne' gli allineamenti,
                //ne' il passaggio successivo che deve riportarle sotto alla propria foto.
                //Da qui in avanti "box" puo' essere un oggetto nuovo.
                box = me.riportaDentroAlBox(box, copieCreate);
            }

            if (regoleOrdiniZ.length > 0) {
                //La lista va riletta: le copie appena create partecipano all'ordinamento.
                var elementiAggiornati = me.getElementiComposizione(box);
                var operazioni = cssComposizioneBox.pianificaOrdineZ(regoleOrdiniZ, elementiAggiornati, corrisponde);

                for (var o = 0; o < operazioni.length; o++) {
                    var operazione = operazioni[o];
                    var elemento = elementiAggiornati.find(el => el.etichetta === operazione.etichetta);
                    if (elemento == null || !elemento.item.isValid) {
                        continue;
                    }
                    try {
                        var riferimenti = operazione.riferimenti
                            .map(et => elementiAggiornati.find(el => el.etichetta === et))
                            .filter(el => el != null && el.item.isValid);

                        if (riferimenti.length === 0) {
                            if (operazione.posizione === "davanti") {
                                elemento.item.bringToFront();
                            }
                            else {
                                elemento.item.sendToBack();
                            }
                            continue;
                        }

                        //Dietro a tutti i riferimenti, o davanti a tutti: si applica a ciascuno,
                        //l'ultimo spostamento e' quello che soddisfa anche i precedenti.
                        for (var k = 0; k < riferimenti.length; k++) {
                            if (operazione.posizione === "davanti") {
                                elemento.item.bringToFront(riferimenti[k].item);
                            }
                            else {
                                elemento.item.sendToBack(riferimenti[k].item);
                            }
                        }
                    }
                    catch (e) {
                        console.error("Code CSF-12: ordinamento di " + operazione.etichetta + " non riuscito: " + e);
                    }
                }
            }
        }
        catch (error) {
            console.error("Code CSF-13: errore nella composizione del box " + box.label);
            console.error(error);
        }

        return box;
    },

    /*
     * Porta dentro al gruppo del box elementi che stanno fuori.
     *
     * InDesign non permette di aggiungere un elemento a un gruppo esistente, ne' passando il
     * gruppo a duplicate() ne' a move(). La tecnica usata in tutto il plugin (bollini, foto
     * extra) e': raggruppare il box con i nuovi elementi, sciogliere il gruppo interno e dare
     * al gruppo esterno l'etichetta del box. Il box che torna e' un oggetto nuovo, con gli
     * stessi figli: chi lo riceve deve usare quello e non il vecchio riferimento.
     */
    riportaDentroAlBox(box, elementi) {
        if (box == null || !box.isValid || elementi == null || elementi.length === 0) {
            return box;
        }

        var daInserire = elementi.filter(el => el != null && el.isValid && !this.elementoDentroAlBox(el, box));
        if (daInserire.length === 0) {
            return box;
        }

        var etichetta = box.label;
        var nuovoGruppo = null;

        try {
            var contenitore = box.parentPage != null ? box.parentPage : box.parent;
            nuovoGruppo = contenitore.groups.add([box].concat(daInserire));
        }
        catch (e) {
            console.error("Code CSF-15: impossibile raggruppare il box " + etichetta + " con i suoi elementi derivati: " + e);
            return box;
        }

        try {
            box.ungroup();
        }
        catch (e) {
            //Il box e' rimasto intero dentro a un gruppo anonimo: meglio scioglierlo e tornare com'era.
            console.error("Code CSF-15: impossibile sciogliere il gruppo interno del box " + etichetta + ": " + e);
            try {
                nuovoGruppo.ungroup();
            }
            catch (e2) {
                console.error("Code CSF-15: il box " + etichetta + " e' rimasto annidato in un gruppo senza etichetta: " + e2);
            }
            return box;
        }

        nuovoGruppo.label = etichetta;
        return nuovoGruppo;
    },

    elementoDentroAlBox(item, box) {
        try {
            if (item == null || !item.isValid || box == null) {
                return false;
            }

            var contenitore = item.parent;
            while (contenitore != null) {
                if (contenitore === box || (contenitore.id != null && box.id != null && contenitore.id === box.id)) {
                    return true;
                }
                if (contenitore.constructorName === "Spread" || contenitore.constructorName === "Page" || contenitore.constructorName === "Layer") {
                    return false;
                }
                contenitore = contenitore.parent;
            }
        }
        catch (e) {
            //Non poter rispondere vale come "non lo so": si tenta comunque il rientro nel gruppo.
        }

        return false;
    },

    /*
     * Ricompone il box col contesto dell'ultima applicazione del CSS.
     * Va chiamata dopo la sistemazione delle foto: gli elementi derivati prendono le misure
     * dalle immagini, che fino a quel momento possono ancora spostarsi.
     * Il piano e' rieseguibile, quindi ripassare non duplica nulla due volte.
     */
    riapplicaComposizioneBox(box) {
        if (box == null || !box.isValid || this.contestoCss == null) {
            return box;
        }
        var contesto = this.contestoCss;
        return this.applicaComposizioneBox(box, contesto.mappaBoxOriginale, contesto.itemRef, contesto.DBallineamenti, contesto.DBDefault);
    },

    /*
     * Operazioni dichiarate per il momento dopoFixFoto, seguite dalla ricomposizione del box.
     *
     * E' il punto in cui le immagini hanno preso la loro posizione definitiva: chi si era
     * allineato a loro prima stava seguendo una posizione provvisoria. Lavora sul contesto
     * dell'ultima applicazione del CSS, quindi non rilegge il file delle regole.
     */
    applicaOperazioniDopoFixFoto(box, boundsBoxImpaginato) {
        if (box == null || !box.isValid) {
            return box;
        }

        var contesto = this.contestoCss;

        try {
            if (contesto != null) {
                var momento = cssSequenzaOperazioni.dopoFixFoto;

                if (cssSequenzaOperazioni.esistonoRegole(contesto.DBallineamenti, momento) ||
                    cssSequenzaOperazioni.esistonoRegole(contesto.DBDefault, momento)) {

                    var bounds = boundsBoxImpaginato != null ? boundsBoxImpaginato : contesto.boundsBoxImpaginato;

                    //Le copie sono nate dopo la mappa: senza questo passaggio non esisterebbero
                    //per le regole che stanno per essere eseguite.
                    var mappa = this.aggiungiNuoviElementiAllaMappa(box, this.updateMap(contesto.mappaBoxOriginale), contesto.prefissiDerivati);

                    var DB = cssSequenzaOperazioni.filtraDBPerMomento(contesto.DBallineamenti, momento);
                    var DBDefault = cssSequenzaOperazioni.filtraDBPerMomento(contesto.DBDefault, momento);

                    this.applicaRidimensionamento(box, bounds, mappa, contesto.itemRef, DB, DBDefault);
                    this.applicaPostRidimensionamento(box, mappa, contesto.itemRef, DB, DBDefault);
                    box = this.allineamenti(box, bounds, mappa, contesto.itemRef, DB, DBDefault);
                }
            }
        }
        catch (error) {
            console.error("Code CSF-16: errore nelle operazioni successive alla sistemazione delle foto del box " + box.label);
            console.error(error);
        }

        return this.riapplicaComposizioneBox(box);
    },

    makeRegexFromGroupName(groupName) {
        // rimuovo un eventuale [itemLink] finale (case-insensitive)
        var baseName = groupName.replace(/\[itemLink\]$/i, '')
        .replace(/\[exist\]$/i, '');

        // Escapa i caratteri speciali, tranne *
        var escaped = baseName.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
        // Converte * in .*
        var regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
        return new RegExp(regexStr);
    },

    parseGroupSpec(groupName) {
        const hasExist = /\[exist\]$/i.test(groupName);
        const cleanName = groupName.replace(/\[exist\]$/i, '');

        return {
            raw: groupName,
            name: cleanName,
            mustExist: hasExist
        };
    },


    getRealBounds(item) {
        if (item.isInvalid){
            return [-1,-1,-1,-1];
        }
        if (item.constructorName == "TextFrame") {

            //mettiamo da parte i bounds dell'elemento
            var gb = item.geometricBounds; // [y1, x1, y2, x2]

            this.safeFitToContent(item);

            var lines = item.lines.everyItem().getElements();
            if (lines.length > 0) {
            var minX = Math.min(...lines.map(l => l.horizontalOffset));
            var maxX = Math.max(...lines.map(l => l.endHorizontalOffset));
            var minY = item.geometricBounds[0];
            var maxY = item.geometricBounds[2];

            var prefs = item.textFramePreferences;
            var insetLeft = prefs.insetSpacing[1];
            var insetRight = prefs.insetSpacing[3];
            var insetTop = prefs.insetSpacing[0];
            var insetBottom = prefs.insetSpacing[2];
            if(prefs.insetSpacing[1] == null){
                 insetLeft = prefs.insetSpacing;
                 insetRight = prefs.insetSpacing;
                 insetTop = prefs.insetSpacing;
                 insetBottom = prefs.insetSpacing;
            }

            //ripristiniamo i bounds originali
            item.geometricBounds = gb;

            if(minY == maxY || minX == maxX){
                return gb;
            }

            return [
                minY /*- insetTop*/,           // adjusted top
                minX - insetLeft,          // adjusted left
                maxY /*+ insetBottom*/,        // adjusted bottom
                maxX + insetRight          // adjusted right
            ];
            }
        }
        else if (item.constructorName == "Group") {
            //dobbiamo calcolare i bounds di tutti i figli del gruppo
            var boundsList = [];
            for (var j = 0; j < item.pageItems.length; j++) {
                var child = item.pageItems.item(j);
                // If it's a group, we need to check its children for text frames
                var bounds = this.getRealBounds(child);
                if (bounds) {
                    boundsList.push(bounds);
                }

                // Calculate the overall bounds for the group
            }
            if (boundsList.length > 0) {
                return [
                    Math.min(...boundsList.map(b => b[0])),
                    Math.min(...boundsList.map(b => b[1])),
                    Math.max(...boundsList.map(b => b[2])),
                    Math.max(...boundsList.map(b => b[3])),
                ];
            }
        }
        else if (item.constructorName == "PageItem"){

            if(item.pageItems && item.pageItems.length > 0){
                //è un gruppo
                var boundsList = [];
                for (var j = 0; j < item.pageItems.length; j++) {
                    var child = item.pageItems.item(j);
                    // If it's a group, we need to check its children for text frames
                    var bounds = this.getRealBounds(child);
                    if (bounds) {
                        boundsList.push(bounds);
                    }

                    // Calculate the overall bounds for the group
                }
                if (boundsList.length > 0) {
                    return [
                        Math.min(...boundsList.map(b => b[0])),
                        Math.min(...boundsList.map(b => b[1])),
                        Math.max(...boundsList.map(b => b[2])),
                        Math.max(...boundsList.map(b => b[3])),
                    ];
                }
            }
            else {
                var properties = item.properties;
                if (properties) {
                    var startTextFrame = properties.startTextFrame;
                    if (startTextFrame) {
                        return this.getRealBounds(startTextFrame);
                    }
                    else{
                        return item.geometricBounds;
                    }
                }
            }
        }
        else {
            return item.geometricBounds;
        }
    },

    getBoundsLineByIndex(item, indexLine) {
        if (item.constructorName == "TextFrame") {

            var lines = item.lines.everyItem().getElements();
            if (indexLine >= 0 && indexLine < lines.length) {
                var line = lines[indexLine];
                var base = line.baseline;
                var top = base - line.ascent;
                var bottom = base + line.descent;
                // prendo un carattere “rappresentativo” della riga
                var ch = null;
                try {
                    if (line.characters && line.characters.length > 0) {
                        var chars = line.characters.everyItem().getElements();
                        var maxPS = -1;
                        for (var i = 0; i < chars.length; i++) {
                            var ps = chars[i].pointSize;
                            if (ps != null && !isNaN(ps) && ps > maxPS) {
                                maxPS = ps;
                                ch = chars[i];
                            }
                        }
                    }
                } catch (e) {
                    ch = null;
                }
                if (ch) {
                    var top = base - line.ascent - ch.pointSize;
                    var bottom = base + line.descent;
                }

                var left = line.horizontalOffset;
                var right = line.endHorizontalOffset;


                return [top, left, bottom, right];
            }
            else {
                console.error("Linea non valida");
                return null;
            }
        }
        else {
            console.error("Linea non valida");
            return null;
        }
    },

    getBoundsLine(line) {
        if (line.constructorName == "Line") {

            var base = line.baseline;
            var top = base - line.ascent;
            var bottom = base + line.descent;
            // prendo un carattere “rappresentativo” della riga
            var ch = null;
            try {
                if (line.characters && line.characters.length > 0) {
                    var chars = line.characters.everyItem().getElements();
                    var maxPS = -1;
                    for (var i = 0; i < chars.length; i++) {
                        var ps = chars[i].pointSize;
                        if (ps != null && !isNaN(ps) && ps > maxPS) {
                            maxPS = ps;
                            ch = chars[i];
                        }
                    }
                }
            } catch (e) {
                ch = null;
            }
            if (ch) {
                var top = base - line.ascent - ch.pointSize;
                var bottom = base + line.descent;
            }

            var left = line.horizontalOffset;
            var right = line.endHorizontalOffset;
            return [top, left, bottom, right];
        }
        else {
            console.error("Linea non valida");
            return null;
        }
    },

    getSubstringBoundsAndWidth(line, startIndex, endIndex) {
        if (!line || !line.characters) {
            throw new Error("Line non valida");
        }

        var chars = line.characters;
        var len = chars.length;

        if (len === 0) return 0;

        if (startIndex < 0 || endIndex < 0 || startIndex >= len || endIndex >= len) {
            throw new Error("Indici fuori range");
        }

        if (startIndex > endIndex) {
            throw new Error("startIndex > endIndex");
        }

        // escludi eventuale fine riga
        if (chars.item(endIndex).contents === "\r") {
            endIndex--;
            if (endIndex < startIndex) return 0;
        }

        var left = chars.item(startIndex).horizontalOffset;
        var right = chars.item(endIndex).endHorizontalOffset;

        var width = right - left;
        return [left, right, width];
    },

    /**
 * Ristruttura un TextFrame evitando conflitti con items nel box.
 *
 * @param {TextFrame} textFrame
 * @param {Array} box - array di PageItem (può includere textFrame)
 * @param {Array} labelEscluse - array di stringhe (pattern con * supportato) da ignorare (match su item.label)
 * @param {Array} characterSuddivision - array come ["car1,car2", "car2,car3", ...] (controllo: nome stile CONTIENE stringa)
 * @param {Boolean} reducePointSizeFallback
 * @param {String} expandVericalToFindSpace - "bottom" | "top" | "none"
 */
    reflowTextFrameAvoidConflicts(
        textFrame,
        box,
        labelEscluse,
        characterSuddivision,
        reducePointSizeFallback = true,
        expandVericalToFindSpace
    ) {
        try{
            labelEscluse = labelEscluse.concat("") || [""];
            //concateniamo anche base* e sfondo*
            labelEscluse = labelEscluse.concat(["base*", "sfondo*"]);
            characterSuddivision = characterSuddivision || [];
            reducePointSizeFallback = !!reducePointSizeFallback;
            expandVericalToFindSpace = expandVericalToFindSpace || "bottom";
    
            var MIN_POINT_SIZE = 3;
            var MAX_MAIN_ITERS = 200;     // anti-loop
            var MAX_LOCAL_ITERS = 50;     // anti-loop per conflitto singolo
            var EXPAND_STEP = 1;          // pt (o unità documento corrente)
    
            // --- dipendenze esterne richieste ---
            // getRealBounds(item) -> [t,l,b,r]
            // makeRegexFromGroupName(name) -> RegExp  (la tua)
            // getSubstringBoundsAndWidth(line, startIndex, endIndex) -> [left,right,width] (la tua)
    
            if (!textFrame || !textFrame.isValid) throw new Error("textFrame non valido");
    
            // Story di riferimento
            var story = textFrame.parentStory;
            if (!story || !story.isValid) throw new Error("parentStory non valido");
    
            // Traccia degli a-capo che inseriamo noi (indici in story.contents)
            var insertedBreakStoryIndices = {}; // {index:true}
    
            // Prepariamo i matcher delle label escluse
            var excludeRegexes = [];
            for (var i = 0; i < labelEscluse.length; i++) {
                excludeRegexes.push(makeRegexFromGroupName(labelEscluse[i]));
            }

            // Cache bounds oggetti esterni (immutabili durante l'esecuzione)
            var itemBoundsCache = {}; // key -> [t,l,b,r]
            var cachedBoxItems = [];  // lista items validi che consideriamo

            function cacheKeyForItem(it) {
                // id è comodo ma non sempre presente; fallback su toSpecifier()
                try {
                    if (it.id !== undefined) return String(it.id);
                } catch (e) { }
                try {
                    return it.toSpecifier();
                } catch (e2) { }
                // ultima spiaggia
                return String(it);
            }

            function buildItemBoundsCache() {
                itemBoundsCache = {};
                cachedBoxItems = [];

                var all = box.allPageItems; // collection
                for (var i = 0; i < all.length; i++) {
                    var it = all.item ? all.item(i) : all[i];
                    if (!it || !it.isValid) continue;

                    if (Utility.parseLabel(it.label) === Utility.parseLabel(textFrame.label)) continue;
                    if (it.constructorName === "Group" || it.constructorName === "PDF") continue;
                    if (isExcludedItem(it)) continue;

                    var key = cacheKeyForItem(it);
                    itemBoundsCache[key] = CssFramework.getRealBounds(it);
                    cachedBoxItems.push(it);
                }
            }

            function getCachedBounds(it) {
                var key = cacheKeyForItem(it);
                return itemBoundsCache[key];
            }

            buildItemBoundsCache();

    
            function isExcludedItem(item) {
                if (!item || !item.isValid) return true;
                if (item === textFrame) return true; // non collide con sé stesso
                var lab = "";
                try { lab = Utility.parseLabel(item.label) || ""; } catch (e) { lab = ""; }
                for (var k = 0; k < excludeRegexes.length; k++) {
                    if (excludeRegexes[k].test(lab)) return true;
                }
                return false;
            }
    
            function boundsIntersect(a, b) {
                const tol = 0.5;

                const separatedHorizontally =
                    a[3] <= b[1] + tol ||
                    a[1] >= b[3] - tol;

                const separatedVertically =
                    a[2] <= b[0] + tol ||
                    a[0] >= b[2] - tol;

                return !(separatedHorizontally || separatedVertically);
            }

            function getLineJustification(line) {
                try {
                    return line.paragraphs.item(0).justification;
                } catch (e) {
                    return null;
                }
            }

            function getLimitsForLine(lineBounds, tfBounds) {
                var leftLimit = tfBounds[1];
                var rightLimit = tfBounds[3];

                for (var i = 0; i < cachedBoxItems.length; i++) {
                    var it = cachedBoxItems[i];
                    if (!it || !it.isValid) continue;

                    var itB = getCachedBounds(it);
                    if (!itB) continue;

                    if (lineBounds[2] <= itB[0] || lineBounds[0] >= itB[2]) continue;

                    if (itB[1] > lineBounds[1]) rightLimit = Math.min(rightLimit, itB[1]);
                    if (itB[3] < lineBounds[3]) leftLimit = Math.max(leftLimit, itB[3]);
                }

                return { left: leftLimit, right: rightLimit };
            }

            function getFirstWordRangeInLine(line) {
                var chars = line.characters;
                var len = chars.length;

                // skip spazi/tab
                var s = 0;
                while (s < len) {
                    var c = chars.item(s);
                    if (!c || !c.isValid) { s++; continue; }
                    if (c.contents === " " || c.contents === "\t") { s++; continue; }
                    break;
                }
                if (s >= len) return null;

                // end fino a spazio/tab/\r
                var e = s;
                while (e < len) {
                    var c2 = chars.item(e);
                    if (!c2 || !c2.isValid) { e++; continue; }
                    var t = c2.contents;
                    if (t === " " || t === "\t" || t === "\r") break;
                    e++;
                }
                if (e <= s) return null;

                return { start: s, end: e - 1 };
            }


            function canPullFirstWordUp(prevLine, currLine, tfBounds, boxItems) {
                var prevB = CssFramework.getBoundsLine(prevLine);

                var wordRange = getFirstWordRangeInLine(currLine);
                if (!wordRange) return false;

                var w = CssFramework.getSubstringBoundsAndWidth(currLine, wordRange.start, wordRange.end);
                var wordWidth = w[2];

                // serve spazio?
                var prevChars = prevLine.characters;
                var prevLen = prevChars.length;
                if (prevLen === 0) return false;

                var last = prevChars.item(prevLen - 1);
                if (last && last.isValid && last.contents === "\r" && prevLen > 1) last = prevChars.item(prevLen - 2);
                if (!last || !last.isValid) return false;

                var needsSpace = (last.contents !== " " && last.contents !== "\t");
                var spaceWidth = 0;

                if (needsSpace) {
                    var sw = getSpaceWidthForLine(currLine, textFrame);
                    if (sw === null) return false;
                    spaceWidth = sw;
                }

                // characterSuddivision
                var styleA = styleNameOfChar(last);
                var firstWordChar = currLine.characters.item(wordRange.start);
                var styleB = styleNameOfChar(firstWordChar);
                if (!canMergeBetweenStyles(styleA, styleB)) return false;

                // limiti riga
                var limits = getLimitsForLine(prevB, tfBounds);

                // allineamento
                var just = getLineJustification(prevLine);
                just = just.toString();
                var extra = spaceWidth + wordWidth;

                // LEFT
                if (
                    just == "LEFT_ALIGN" ||
                    just == "LEFT_JUSTIFIED" ||
                    just == "FULLY_JUSTIFIED" ||
                    just == null
                ) {
                    var prevRight = prevB[3];
                    return (prevRight + extra) <= limits.right;
                }

                // RIGHT
                if (
                    just == "RIGHT_ALIGN" ||
                    just == "RIGHT_JUSTIFIED"
                ) {
                    var prevLeft = prevB[1];
                    return (prevLeft - extra) >= limits.left;
                }

                // CENTER
                if (just == "CENTER_ALIGN") {
                    var centerOKRight = (prevB[3] + extra / 2) <= limits.right;
                    var centerOKLeft = (prevB[1] - extra / 2) >= limits.left;
                    return centerOKLeft && centerOKRight;
                }


                // fallback conservativo
                return false;
            }

            function justValue(j) {
                if (j === null || j === undefined) return null;
                try { return j.valueOf(); } catch (e) { }
                try { return Number(j); } catch (e2) { }
                return null;
            }

            function getSpaceWidthForLine(line, textFrame) {
                if (!line || !line.isValid) return null;

                // 1) stessa riga
                var w = findSpaceWidthInCharacters(line.characters);
                if (w !== null) return w;

                // 2) altre righe dello stesso frame
                if (textFrame && textFrame.isValid) {
                    var lines = textFrame.texts.item(0).lines;
                    for (var i = 0; i < lines.length; i++) {
                        var ln = lines.item(i);
                        if (!ln || !ln.isValid) continue;
                        w = findSpaceWidthInCharacters(ln.characters);
                        if (w !== null) return w;
                    }
                }

                // 3) qualsiasi spazio nello story (range del frame se possibile)
                try {
                    var story = textFrame.parentStory;
                    var txt = textFrame.texts.item(0);
                    var startIdx = txt.insertionPoints.firstItem().index;
                    var endIdx = txt.insertionPoints.lastItem().index;
                    var chars = story.characters;

                    for (var j = startIdx; j <= endIdx && j < chars.length; j++) {
                        var ch = chars.item(j);
                        if (!ch || !ch.isValid) continue;
                        if (ch.contents === " ") {
                            return ch.endHorizontalOffset - ch.horizontalOffset;
                        }
                    }
                } catch (e) { }

                // 4) fallback stimato (ultimo resort)
                try {
                    var ch0 = line.characters.length > 0 ? line.characters.item(0) : null;
                    if (ch0 && ch0.isValid) {
                        // valore tipico: spazio ≈ 0.25–0.33 del pointSize (dipende dal font)
                        return ch0.pointSize * 0.3;
                    }
                } catch (e2) { }

                return null;
            }

            function findSpaceWidthInCharacters(chars) {
                var len = chars.length;
                for (var i = 0; i < len; i++) {
                    var ch = chars.item(i);
                    if (ch && ch.isValid && ch.contents === " ") {
                        return ch.endHorizontalOffset - ch.horizontalOffset;
                    }
                }
                return null;
            }

            function minimizeLinesByPullingWordsUp(textFrame) {
                if (!textFrame || !textFrame.isValid) throw new Error("textFrame non valido");

                // precondizione: niente conflitti e niente overset (se vuoi, puoi forzare un check qui)
                // if (getConflictingItems().length > 0 || textFrame.overflows) return false;

                var story = textFrame.parentStory;
                if (!story || !story.isValid) throw new Error("parentStory non valido");

                var txt = textFrame.texts.item(0);
                if (!txt || !txt.isValid) return false;

                var startIdx = txt.insertionPoints.firstItem().index;
                var endIdx = txt.insertionPoints.lastItem().index;

                var storyChars = story.characters;
                var n = storyChars.length;

                var madeAnyChange = false;

                // più pass: spostare una parola può abilitare altri spostamenti
                var PASS_GUARD = 50;
                for (var pass = 0; pass < PASS_GUARD; pass++) {
                    var changedThisPass = false;
                    var tfBounds = CssFramework.getRealBounds(textFrame);

                    // scansiono i break nel range del frame
                    for (var i = startIdx; i <= endIdx && i < n; i++) {
                        var br = storyChars.item(i);
                        if (!br || !br.isValid) continue;
                        if (br.contents !== "\r") continue;

                        // devo avere carattere prima e dopo
                        if (i - 1 < 0 || i + 1 >= storyChars.length) continue;

                        // trova inizio della prima parola dopo il break (salta spazi/tab)
                        var wStart = i + 1;
                        while (wStart <= endIdx && wStart < storyChars.length) {
                            var c0 = storyChars.item(wStart);
                            if (!c0.isValid) { wStart++; continue; }
                            if (c0.contents === " " || c0.contents === "\t") { wStart++; continue; }
                            break;
                        }
                        if (wStart > endIdx || wStart >= storyChars.length) continue;

                        // se il prossimo non è una lettera/numero, comunque lo considero "token" (ma puoi filtrare se vuoi)
                        // trova fine parola (fino a spazio/tab/\r)
                        var wEnd = wStart;
                        while (wEnd <= endIdx && wEnd < storyChars.length) {
                            var c1 = storyChars.item(wEnd);
                            if (!c1.isValid) { wEnd++; continue; }
                            var s = c1.contents;
                            if (s === " " || s === "\t" || s === "\r") break;
                            wEnd++;
                        }
                        if (wEnd === wStart) continue; // parola vuota

                        // constraint characterSuddivision: stile tra char prima del break e primo char della parola
                        var before = storyChars.item(i - 1);
                        var firstWordChar = storyChars.item(wStart);
                        if (!before.isValid || !firstWordChar.isValid) continue;

                        var styleA = styleNameOfChar(before);
                        var styleB = styleNameOfChar(firstWordChar);

                        if (!canMergeBetweenStyles(styleA, styleB)) {
                            continue; // non posso mettere quella parola sulla riga sopra
                        }

                        // --- PRE-CHECK (veloce) usando lines reali ---
                        // Trovo la line corrente e la precedente a partire dall'indice story i
                        // Nota: i è l'indice del carattere '\r' nello story
                        var ipBeforeBreak = story.insertionPoints.item(i); // insertion point al break
                        var currLine = null;
                        var prevLine = null;

                        try {
                            // line dopo il break: prendo l'insertion point subito dopo e leggo la sua linea
                            var ipAfter = story.insertionPoints.item(i + 1);
                            currLine = ipAfter.lines.item(0);
                            prevLine = ipBeforeBreak.lines.item(0);
                        } catch (eLine) {
                            currLine = null;
                            prevLine = null;
                        }

                        // Se non riesco a risalire alle line, non faccio pre-check (fallback al tentativo classico)
                        if (prevLine && prevLine.isValid && currLine && currLine.isValid) {
                            // IMPORTANTE: passare anche textFrame a getSpaceWidthForLine (canPullFirstWordUp lo usa)
                            if (!canPullFirstWordUp(prevLine, currLine, tfBounds, box.allPageItems)) {
                                continue; // non ci sta, skip senza recompose
                            }
                        }

                        // --- TENTATIVO: sposta solo la prima parola ---
                        // 1) sostituisci break con spazio (lunghezza invariata => indici stabili)
                        br.contents = " ";

                        // 2) inserisci break dopo la parola
                        // wEnd è un insertion point (indice) dopo l'ultimo char della parola
                        var ip = story.insertionPoints.item(wEnd);
                        ip.contents = "\r";

                        // riferimento al break inserito (dopo l'inserimento, è un char a indice wEnd)
                        var insertedBreak = storyChars.item(wEnd);

                        //se la riga è rimasta vuota la eliminiamo
                        trimEmptyComposedLines(textFrame);
                        // pulizia spazi iniziali riga (importante dopo la manovra)
                        trimLeadingSpacesEachComposedLine(textFrame);

                        // ricomponi prima di valutare conflitti
                        try { story.recompose(); } catch (e) { }

                        // verifica: niente conflitti, niente overset
                        var ok = (getConflictingItems().length === 0 && !textFrame.overflows);

                        if (ok) {
                            changedThisPass = true;
                            madeAnyChange = true;

                            // aggiornamenti indici/range: la story è cresciuta di 1 char
                            endIdx += 1;
                            n += 1;

                            // continua a scansionare (ma attenzione: indici dopo wEnd sono shiftati; per semplicità riparto dal pass successivo)
                            break;
                        } else {
                            // --- ROLLBACK ---
                            // rimuovi break inserito e ripristina il break originale
                            try {
                                if (insertedBreak && insertedBreak.isValid && insertedBreak.contents === "\r") {
                                    insertedBreak.remove();
                                }
                            } catch (e2) { }

                            try {
                                // ripristina il carattere al vecchio indice i: essendo stato " " torna "\r"
                                storyChars.item(i).contents = "\r";
                            } catch (e3) { }

                            trimEmptyComposedLines(textFrame);
                            trimLeadingSpacesEachComposedLine(textFrame);
                            try { story.recompose(); } catch (e4) { }

                            // range torna com'era (se rimozione riuscita)
                            // se per qualche motivo la rimozione non è riuscita, non forzo aggiustamenti qui: lo noteresti dai conflitti.
                        }
                    }

                    if (!changedThisPass) break; // stallo: non si può minimizzare oltre
                }

                return madeAnyChange;
            }

            // function trimEmptyComposedLines(textFrame) {
            //     if (!textFrame || !textFrame.isValid) return;
            //     var story = textFrame.parentStory;
            //     if (!story || !story.isValid) return;
            //     var txt = textFrame.texts.item(0);
            //     if (!txt || !txt.isValid) return;
            //     var startIdx = txt.insertionPoints.firstItem().index;
            //     var endIdx = txt.insertionPoints.lastItem().index;
            //     var storyChars = story.characters;
            //     for (var i = endIdx; i >= startIdx; i--) {
            //         var ch = storyChars.item(i);
            //         if (!ch || !ch.isValid) continue;
            //         if (ch.contents === "\r") {
            //             // controlla se la riga è vuota (solo spazi/tab)
            //             var ipBefore = story.insertionPoints.item(i - 1);
            //             var line = null;
            //             try {
            //                 line = ipBefore.lines.item(0);
            //             } catch (e) {
            //                 line = null;
            //             }
            //             if (line && line.isValid) {
            //                 var isEmpty = true;
            //                 var lineChars = line.characters;
            //                 for (var j = 0; j < lineChars.length; j++) {
            //                     var lc = lineChars.item(j);
            //                     if (!lc || !lc.isValid) continue;
            //                     var s = lc.contents;
            //                     if (s !== " " && s !== "\t" && s !== "\r") {
            //                         isEmpty = false;
            //                         break;
            //                     }
            //                 }
            //                 if (isEmpty) {
            //                     // rimuovi il break
            //                     ch.remove();
            //                 }
            //             }
            //         }
            //     }
            // }

            function trimEmptyComposedLines(textFrame) {
                if (!textFrame || !textFrame.isValid) return;

                var lines;
                try {
                    lines = textFrame.lines;
                } catch (e) {
                    return;
                }
                if (!lines || lines.length === 0) return;

                // Scorri dal basso per evitare problemi di reindex
                for (var i = lines.length - 1; i >= 0; i--) {
                    var line = lines.item(i);
                    if (!line || !line.isValid) continue;

                    var content = "";
                    try {
                        content = line.contents;
                    } catch (e) {
                        continue;
                    }

                    // Normalizzazione aggressiva:
                    // - elimina spazi/tab
                    // - elimina \r
                    // - elimina caratteri invisibili tipici
                    // - elimina eventuali unicode “strani” usati dagli enumerator
                    var cleaned = content
                        .replace(/[ \t\r\n]/g, "")
                        .replace(/\u2028/g, "")
                        .replace(/\u2029/g, "")
                        .replace(/\uFEFF/g, "")
                        .replace(/\u200B/g, "")
                        .replace(/\u202F/g, "")
                        .replace(/\u00A0/g, "");

                    //Dobbiamo controllare se ci sono enumerator per farlo sappiamo che facendo il toSting() del character enumerator otteniamo "[object Character]"
                    var chars = line.characters;
                    for (var cIdx = 0; cIdx < chars.length; cIdx++) {
                        var ch = chars.item(cIdx);
                        if (!ch || !ch.isValid) continue;
                        var chStr = ch.contents.toString();
                        //questo non funzionerà mai perchè contents di un character non sarà mai "[object Character]", se troviamo un nuovo caso di enumerator 
                        //dobbiamo capire come trattarlo qui dentro
                        if (chStr === "[object Character]") {
                            cleaned = cleaned.replace(ch.contents, "");
                        }
                    }

                    // Se dopo la pulizia è vuota, eliminiamo il break finale
                    if (cleaned.length === 0) {
                        try {
                            // La "line" in InDesign finisce sempre prima del return del paragrafo.
                            // Il return è spesso nel carattere successivo nello story.
                            var lastIP = line.insertionPoints.lastItem();
                            var ch = lastIP.characters.item(0);

                            // se è un ritorno a capo, lo togliamo
                            if (ch && ch.isValid && ch.contents === "\r") {
                                ch.remove();
                            } else {
                                // fallback: proviamo a rimuovere l'ultimo carattere della linea se è \r
                                var lastChar = line.characters.lastItem();
                                if (lastChar && lastChar.isValid && lastChar.contents === "\r") {
                                    lastChar.remove();
                                }
                            }
                        } catch (e) {
                            // Se fallisce, ignoriamo e andiamo avanti
                        }
                    }
                }
            }


            function getConflictingItems() {
                var tfB = CssFramework.getRealBounds(textFrame);
                var conflicts = [];

                // Cache bounds righe (eviti di richiamare getBoundsLine 1000 volte per item)
                var tfLines = textFrame.texts.item(0).lines;
                var lineBoundsCache = []; // [{line: Line, b:[t,l,b,r]}]

                for (var li = 0; li < tfLines.length; li++) {
                    var ln = tfLines.item(li);
                    if (!ln || !ln.isValid) continue;
                    var lb = CssFramework.getBoundsLine(ln); // [t,l,b,r]
                    lineBoundsCache.push({ line: ln, b: lb, index: li });
                }

                for (var j = 0; j < cachedBoxItems.length; j++) {
                    var item = cachedBoxItems[j];
                    if (!item || !item.isValid) continue;

                    var itB = getCachedBounds(item);
                    if (!itB) continue;

                    if (!boundsIntersect(tfB, itB)) continue;

                    // Narrow-phase: trova righe realmente in conflitto
                    var hitLines = [];
                    for (var k = 0; k < lineBoundsCache.length; k++) {
                        var lb = lineBoundsCache[k].b;

                        // micro-ottimizzazione: se la riga è completamente sopra o sotto l'item, skip
                        if (lb[2] <= itB[0] || lb[0] >= itB[2]) continue;

                        if (boundsIntersect(lb, itB)) {
                            hitLines.push({
                                line: lineBoundsCache[k].line,
                                lineBounds: lb,
                                lineIndex: lineBoundsCache[k].index
                            });
                        }
                    }

                    // Se nessuna riga collide davvero, è un falso positivo: skip
                    if (hitLines.length === 0) continue;

                    conflicts.push({
                        item: item,
                        itemBounds: itB,
                        tfBounds: tfB,
                        lines: hitLines
                    });
                }

                return conflicts;
            }

    
            // --- characterSuddivision parsing ---
            // Regola: default [] => NON permettere che due stili diversi stiano nella stessa riga (separazione forte).
            // Se compilato: ogni entry "a,b,c" indica che questi possono convivere a coppie “a-b”, “b-c” ma non tutti e tre assieme.
            // Implemento: per decidere se posso rimuovere un \r tra due righe, guardo lo stile dell’ultimo char riga sopra e primo char riga sotto.
            // Se []: consentito solo se "contiene" la stessa stringa stile (quindi praticamente uguale criterio per contains).
            function styleNameOfChar(ch) {
                try {
                    var cs = ch.appliedCharacterStyle;
                    if (cs && cs.isValid) return cs.name || "";
                } catch (e) { }
                // fallback: stile paragrafo o none
                return "";
            }
    
            function styleMatchesToken(styleName, token) {
                if (!token) return false;
                return styleName.indexOf(token) !== -1;
            }
    
            // Costruisco una lista di gruppi: [["car1","car2"], ["car2","car3"], ...] da stringhe "car1,car2"
            var sudGroups = [];
            for (var sg = 0; sg < characterSuddivision.length; sg++) {
                var parts = String(characterSuddivision[sg]).split(",");
                var cleaned = [];
                for (var p = 0; p < parts.length; p++) {
                    var t = parts[p].replace(/^\s+|\s+$/g, "");
                    if (t) cleaned.push(t);
                }
                if (cleaned.length) sudGroups.push(cleaned);
            }
    
            function canMergeBetweenStyles(styleA, styleB) {
                // styleA/styleB sono nomi reali degli appliedCharacterStyle
                if (sudGroups.length === 0) {
                    // default: non mischiare stili diversi nella stessa riga
                    // Qui "stesso" lo interpreto come: se uno contiene l'altro? No.
                    // Interpreto: se sono identici, ok. Se diversi, no.
                    return styleA === styleB;
                }
    
                // Con suddivision: permetto merge se esiste un gruppo dove A e B sono “adiacenti” o comunque presenti,
                // ma con regola “catena”: a può con b, b con c, ecc.
                // Qui, per merge tra due righe basta che in almeno un gruppo:
                // - A matcha token i
                // - B matcha token i+1 oppure i-1
                for (var g = 0; g < sudGroups.length; g++) {
                    var grp = sudGroups[g];
                    for (var idx = 0; idx < grp.length; idx++) {
                        if (styleMatchesToken(styleA, grp[idx])) {
                            if (idx > 0 && styleMatchesToken(styleB, grp[idx - 1])) return true;
                            if (idx < grp.length - 1 && styleMatchesToken(styleB, grp[idx + 1])) return true;
                        }
                    }
                }
                return false;
            }
    
            // --- utilità per operare su break in story ---
            function storyIndexOfCharacter(ch) {
                // ch.insertionPoints[0].index è spesso affidabile
                try {
                    return ch.insertionPoints.item(0).index;
                } catch (e) {
                    // fallback brutale: null
                    return null;
                }
            }

            function trimLeadingSpacesEachComposedLine(textFrame) {
                var lines = textFrame.texts.item(0).lines;
                for (var li = 0; li < lines.length; li++) {
                    var line = lines.item(li);
                    if (!line || !line.isValid) continue;

                    // rimuove spazi/tab all'inizio della line finché ci sono
                    while (line.characters.length > 0) {
                        var ch = line.characters.item(0);
                        if (!ch || !ch.isValid) break;
                        if (ch.contents === " " || ch.contents === "\t") {
                            ch.remove();
                        } else {
                            break;
                        }
                    }
                }
            }



            function insertBreakAtSpace(line, spaceCharIndexInLine) {
                // sostituisce lo spazio con \r.
                // Opero sul character della line: se è uno spazio vero.
                var ch = line.characters.item(spaceCharIndexInLine);
                if (!ch || !ch.isValid) return false;
                if (ch.contents !== " ") return false;
    
                var idx = storyIndexOfCharacter(ch);
                if (idx === null) return false;
    
                // sostituisco lo spazio con a-capo
                ch.contents = "\r";
                insertedBreakStoryIndices[idx] = true;
                return true;
            }
    
            function isInsertedBreakByUs(storyIndex) {
                return !!insertedBreakStoryIndices[storyIndex];
            }
    
            function tryRemoveNextMergeableBreakAfter(line) {
                // Cerca nella story dopo questa line un "\r" che:
                // - non sia uno dei nostri break inseriti
                // - sia mergeabile secondo characterSuddivision (stile ultimo char prima del break, primo dopo break)
                // Ritorna true se rimosso.
                var lineText = line; // Line object
                var lastChar = null;
                try {
                    if (lineText.characters.length > 0) {
                        lastChar = lineText.characters.item(lineText.characters.length - 1);
                        // se ultimo è \r, prendo quello prima
                        if (lastChar.contents === "\r" && lineText.characters.length > 1) {
                            lastChar = lineText.characters.item(lineText.characters.length - 2);
                        }
                    }
                } catch (e) { }
    
                if (!lastChar || !lastChar.isValid) return false;
    
                // punto di partenza: fine riga (insertionPoint dopo ultimo char)
                var startIdx = storyIndexOfCharacter(lastChar);
                if (startIdx === null) return false;
    
                // scorriamo un po' avanti nello story per trovare un break candidato
                // Limite scan per non andare in loop infinito
                var scanLimit = 300;
    
                var sp = story.insertionPoints.item(startIdx);
                if (!sp || !sp.isValid) return false;
    
                // lavoriamo su story.characters per indicizzare
                var storyChars = story.characters;
                var n = storyChars.length;
    
                for (var i = startIdx; i < Math.min(n, startIdx + scanLimit); i++) {
                    var c = storyChars.item(i);
                    if (!c || !c.isValid) continue;
                    if (c.contents === "\r") {
                        // if (isInsertedBreakByUs(i)) {
                        //     continue; // non posso rimuovere i nostri break
                        // }
    
                        // stile prima break: carattere i-1 (se esiste), dopo break: i+1
                        if (i - 1 < 0 || i + 1 >= n) continue;
                        var before = storyChars.item(i - 1);
                        var after = storyChars.item(i + 1);
                        if (!before.isValid || !after.isValid) continue;
    
                        var styleA = styleNameOfChar(before);
                        var styleB = styleNameOfChar(after);
    
                        if (canMergeBetweenStyles(styleA, styleB)) {
                            c.contents = " "; // rimpiazzo break con spazio
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
    
                return false;
            }

            
    
            function lineTouchesItemHorizontally(line, itemBounds) {
                // la riga “tocca” l’oggetto se:
                // - overlap in Y tra bounds riga e bounds oggetto
                // - overlap in X tra bounds riga e bounds oggetto
                // Bounds riga: ricostruisco in modo leggero usando left/right dagli offset e top/bottom da baseline/ascent/descent (+ leading extra sarebbe meglio ma per collisioni basta spesso)
                var lineBounds = CssFramework.getBoundsLine(line);
                var top = lineBounds[0];
                var bottom = lineBounds[2];
                var left = lineBounds[1];
                var right = lineBounds[3];
    
                var overlapX = !(right <= itemBounds[1] || left >= itemBounds[3]);
                var overlapY = !(bottom <= itemBounds[0] || top >= itemBounds[2]);
                return overlapX && overlapY;
            }
    
            function findBreakSpaceBeforeCollision(line, itemBounds) {
                // Trova uno spazio nella riga tale che il suo endHorizontalOffset sia <= itemBounds.left (o <= itemBounds.right se l'oggetto è “a sinistra”?)
                // Strategia:
                // - se l’oggetto invade da destra (oggetto a destra del testo), soglia = itemBounds[1]
                // - se invade da sinistra, soglia = itemBounds[3]
                // Determino lato in base a dove cade il centro della riga rispetto al box.
                var threshold;
                var lineMid = (line.horizontalOffset + line.endHorizontalOffset) / 2;
                var objMid = (itemBounds[1] + itemBounds[3]) / 2;
                if (objMid >= lineMid) threshold = itemBounds[1]; else threshold = itemBounds[3];
    
                var chars = line.characters;
                var len = chars.length;
    
                // Scorro indietro cercando ' '
                for (var i = len - 1; i >= 0; i--) {
                    var ch = chars.item(i);
                    if (!ch || !ch.isValid) continue;
                    if (ch.contents !== " ") continue;
    
                    var endX = ch.endHorizontalOffset;
                    if (endX <= threshold) return i;
                }
                return -1;
            }
    
            function tryResolveHorizontalConflict(conflict) {
                // trova righe incriminate e mette a capo
                var itemBounds = conflict.itemBounds;
    
                var lines = textFrame.texts.item(0).lines;
                for (var li = 0; li < lines.length; li++) {
                    var line = lines.item(li);
                    if (!line || !line.isValid) continue;
    
                    if (!lineTouchesItemHorizontally(line, itemBounds)) continue;
    
                    var spaceIdx = findBreakSpaceBeforeCollision(line, itemBounds);
                    if (spaceIdx === -1) {
                        // nessuno spazio: non posso spezzare qui senza andare a “spaccare” parole
                        // qui potresti decidere: hyphenation / tracking / fallback. Io lo lascio al fallback pointSize.
                        return false;
                    }
    
                    // inserisco break sostituendo lo spazio
                    if (!insertBreakAtSpace(line, spaceIdx)) return false;
    
                    // poi provo a rimuovere un break successivo mergeabile secondo suddivisione
                    tryRemoveNextMergeableBreakAfter(line);
    
                    return true; // ho fatto una modifica, esco e ricontrollo conflitti
                }
    
                return false;
            }
    
            function tryResolveVerticalByRemovingBreaks() {
                // Prova a ridurre altezza testo rimuovendo break “mergeabili” (non nostri)
                // Strategia: scansiono story in range del textFrame, cerco \r rimuovibili.
                var changed = false;
    
                // range story del frame: non banale; uso textFrame.texts.item(0) per scoprire start/end insertionPoint
                var txt = textFrame.texts.item(0);
                if (!txt || !txt.isValid) return false;
    
                var startIP = txt.insertionPoints.firstItem();
                var endIP = txt.insertionPoints.lastItem();
                if (!startIP.isValid || !endIP.isValid) return false;
    
                var startIdx = startIP.index;
                var endIdx = endIP.index;
    
                var storyChars = story.characters;
    
                for (var i = startIdx; i <= endIdx; i++) {
                    var c = storyChars.item(i);
                    if (!c || !c.isValid) continue;
                    if (c.contents !== "\r") continue;
    
                    if (isInsertedBreakByUs(i)) continue; // non tocco i nostri
    
                    // devo verificare mergeabilità tra char prima e dopo
                    if (i - 1 < 0 || i + 1 >= storyChars.length) continue;
                    var before = storyChars.item(i - 1);
                    var after = storyChars.item(i + 1);
                    if (!before.isValid || !after.isValid) continue;
    
                    var styleA = styleNameOfChar(before);
                    var styleB = styleNameOfChar(after);
    
                    if (canMergeBetweenStyles(styleA, styleB)) {
                        c.contents = " ";
                        changed = true;
                        // faccio una rimozione per iterazione, per controllo graduale
                        break;
                    }
                }
    
                return changed;
            }
    
            function expandFrameIfOverset() {
                if (expandVericalToFindSpace === "none") return false;
                if (!textFrame.overflows) return false;
    
                var expanded = false;
    
                // bounds del frame (geometric bounds, non real bounds)
                var gb = textFrame.geometricBounds; // [t,l,b,r]
    
                for (var step = 0; step < 200; step++) {
                    if (!textFrame.overflows) break;
    
                    var newGb = gb.slice(0);
                    if (expandVericalToFindSpace === "bottom") {
                        newGb[2] = newGb[2] + EXPAND_STEP;
                    } else if (expandVericalToFindSpace === "top") {
                        newGb[0] = newGb[0] - EXPAND_STEP;
                    } else {
                        break;
                    }
    
                    // prima di applicare: verifica che l'espansione non crei collisione con altri items
                    // uso getRealBounds del frame dopo espansione? Non posso senza applicare.
                    // faccio check conservativo usando geometricBounds espansi contro getRealBounds(items).
                    // (è un'approssimazione, ma evita disastri)
                    var wouldCollide = false;
                    var tmpTfB = newGb; // approx
                    for (var j = 0; j < cachedBoxItems.length; j++) {
                        var it = cachedBoxItems[j];
                        if (!it || !it.isValid) continue;

                        var itB = getCachedBounds(it);
                        if (!itB) continue;

                        if (boundsIntersect(tmpTfB, itB)) { wouldCollide = true; break; }
                    }
    
                    if (wouldCollide) break;
    
                    textFrame.geometricBounds = newGb;
                    gb = newGb;
                    expanded = true;
                }
    
                return expanded;
            }
    
            function reducePointSizeAllTextBy1() {
                var txt = textFrame.texts.item(0);
                if (!txt || !txt.isValid) return false;

                // bounds originali da ripristinare
                var originalGB = textFrame.geometricBounds.slice(0);

                // trova pointSize corrente minimo “rappresentativo”
                var cur = null;
                try { cur = txt.characters.item(0).pointSize; } catch (e) { cur = null; }
                if (cur === null || cur === undefined) return false;
                if (cur <= MIN_POINT_SIZE) return false;

                // 1) se overset, espandi temporaneamente finché non lo è più (o fino a un limite ragionevole)
                if (textFrame.overflows) {
                    // espansione semplice: aumenta bottom a step
                    // (se vuoi top, cambia indice 0 invece di 2)
                    var gb = textFrame.geometricBounds.slice(0);
                    var guard = 0;

                    while (textFrame.overflows && guard++ < 500) {
                        gb[2] += 5; // step più grosso per essere veloce
                        textFrame.geometricBounds = gb;
                    }

                    // se ancora overset dopo il tentativo, non garantisco che riesci a scalare tutto
                    // ma comunque provo (meglio di niente)
                }

                // 2) applica riduzione a TUTTO il testo dello story relativo al frame
                // Qui la scelta più robusta è agire su parentStory, ma limitandosi al range del frame.
                var story = textFrame.parentStory;
                if (!story || !story.isValid) {
                    // fallback: almeno sui chars del txt
                    try {
                        var pointSize = Math.max(MIN_POINT_SIZE, cur - 1);
                        txt.characters.everyItem().pointSize = pointSize;
                        //leading
                        txt.characters.everyItem().leading = pointSize;
                        return true;
                    } catch (e2) {
                        return false;
                    } finally {
                        // ripristina bounds
                        textFrame.geometricBounds = originalGB;
                    }
                }

                var startIdx = txt.insertionPoints.firstItem().index;
                var endIdx = txt.insertionPoints.lastItem().index;

                var storyChars = story.characters;
                for (var i = startIdx; i <= endIdx && i < storyChars.length; i++) {
                    var ch = storyChars.item(i);
                    if (!ch || !ch.isValid) continue;

                    var ps = ch.pointSize;
                    if (typeof ps === "number" && isFinite(ps)) {
                        var pointSize = Math.max(MIN_POINT_SIZE, ps - 1);
                        ch.pointSize = pointSize;
                        ch.leading = pointSize;
                    }
                }

                // 3) ripristina bounds originali
                textFrame.geometricBounds = originalGB;

                return true;
            }

            function resolveOversetFirst() {
                // ritorna true se ha fatto qualcosa (o se non era overset), false se bloccato
                if (!textFrame.overflows) return true;

                // 1) prova ad espandere se permesso
                if (expandVericalToFindSpace !== "none") {
                    var didExpand = expandFrameIfOverset(); // la tua funzione
                    if (!textFrame.overflows) return true;
                    // anche se ha espanso ma non basta, continua con compattazione
                }

                // 2) prova a compattare togliendo break consentiti
                // fai qualche tentativo, perché togliere un break può far ricomporre più righe
                var guard = 0;
                while (textFrame.overflows && guard++ < 200) {
                    var didCompact = tryResolveVerticalByRemovingBreaks(); // la tua funzione
                    if (!didCompact) break;
                }

                return !textFrame.overflows;
            }

    
            // === MAIN LOOP ===
            // Strategia:
            // 1) tenta risoluzioni orizzontali (inserisci break) finché ci sono conflitti
            // 2) se overflow, prova expand (se permesso), altrimenti prova compattare (rimuovi break) dove possibile
            // 3) se ancora conflitti e fallback, riduci pointSize e riparti (reset tracking break nostri)
            var fallbackGuard = 0;

            trimEmptyComposedLines(textFrame);
            trimLeadingSpacesEachComposedLine(textFrame);

            while (true) {
                var mainIter = 0;

                // Questo flag decide se possiamo fare fallback pointSize
                var didAnyChangeThisPass = false;

                while (mainIter++ < MAX_MAIN_ITERS) {
                    var changedThisIteration = false;

                    // 1) Overset handling (è una "mossa" a tutti gli effetti)
                    if (textFrame.overflows) {
                        var didExpand = expandFrameIfOverset();
                        if (didExpand) {
                            changedThisIteration = true;
                        } else {
                            var didCompact = tryResolveVerticalByRemovingBreaks();
                            if (didCompact) changedThisIteration = true;
                        }
                    }

                    // 2) Conflitti
                    var conflicts = getConflictingItems();

                    if (conflicts.length > 0) {
                        // Provo risolvere conflitti: se anche uno cambia qualcosa, continuo a iterare
                        for (var c = 0; c < conflicts.length; c++) {
                            var localIter = 0;
                            while (localIter++ < MAX_LOCAL_ITERS) {
                                conflicts[c].tfBounds = CssFramework.getRealBounds(textFrame);
                                var cb = getCachedBounds(conflicts[c].item);
                                if (!cb) {
                                    // item non cache-ato o non valido: trattalo come non risolvibile oppure ricache-alo al volo
                                    // scelta conservativa:
                                    break;
                                }
                                conflicts[c].itemBounds = cb;

                                // Se non intersect broad-phase, passa oltre
                                if (!boundsIntersect(conflicts[c].tfBounds, conflicts[c].itemBounds)) break;

                                // ORIZZONTALE
                                var did = tryResolveHorizontalConflict(conflicts[c]);
                                if (did) {
                                    changedThisIteration = true;
                                    break; // esci localIter, passa al prossimo conflitto (o ricomponi)
                                }

                                // VERTICALE/COMPACT
                                var didV = tryResolveVerticalByRemovingBreaks();
                                if (didV) {
                                    changedThisIteration = true;
                                    break;
                                }

                                // Bloccato su questo conflitto
                                break;
                            }
                            trimEmptyComposedLines(textFrame);
                            trimLeadingSpacesEachComposedLine(textFrame);

                            // Non breakare sul primo conflitto risolto: continua a vedere se ce ne sono altri nello stesso giro
                            // (Se preferisci ricomporre subito, puoi fare un "break" qui e lasciare che il loop riparta.
                        }
                    } else {
                        // Nessun conflitto: se non overset, finito
                        if (!textFrame.overflows) {
                            var didMin = minimizeLinesByPullingWordsUp(textFrame); // o la versione calcolata
                            if (didMin) {
                                trimEmptyComposedLines(textFrame);
                                trimLeadingSpacesEachComposedLine(textFrame);
                                continue; // rientra e ricontrolla (sicurezza)
                            }
                            return true; // già ottimizzato o non ottimizzabile
                        }

                        // Overset senza conflitti: prova ancora a risolvere overset (già fatto sopra, ma qui puoi ribadire)
                        var didExpand2 = expandFrameIfOverset();
                        if (didExpand2) changedThisIteration = true;
                        else {
                            var didCompact2 = tryResolveVerticalByRemovingBreaks();
                            if (didCompact2) changedThisIteration = true;
                        }
                    }

                    trimEmptyComposedLines(textFrame);
                    trimLeadingSpacesEachComposedLine(textFrame);

                    if (changedThisIteration) {
                        didAnyChangeThisPass = true;
                        // Continua: ricomputa bounds/conflicts nella prossima iterazione
                        continue;
                    }

                    // Se arrivi qui: nessuna mossa applicabile in questa iterazione -> stallo locale.
                    break;
                }

                // Check finale dopo aver iterato finché possibile
                var finalConflicts = getConflictingItems();

                if (finalConflicts.length === 0 && !textFrame.overflows) {
                    // fase di ottimizzazione finale
                    var didMin = minimizeLinesByPullingWordsUp(textFrame); // o la versione calcolata
                    if (didMin) {
                        trimEmptyComposedLines(textFrame);
                        trimLeadingSpacesEachComposedLine(textFrame);
                        continue; // rientra e ricontrolla (sicurezza)
                    }
                    return true; // già ottimizzato o non ottimizzabile
                }

                // Se nel pass abbiamo cambiato qualcosa, NON fare fallback: riparti e riprova
                // Questo risolve il tuo caso "Fix1 poi Fix2 crea nuovo conflitto": il pass successivo vede nuove mosse.
                if (didAnyChangeThisPass) {
                    continue;
                }

                // Qui sei davvero in stallo: nessuna operazione ha fatto nulla.
                // Prima prova a risolvere overset (se presente) con la routine dedicata
                if (textFrame.overflows) {
                    var oversetSolved = resolveOversetFirst();
                    if (oversetSolved) continue;
                    // se anche qui non risolve, resti in stallo -> fallback
                }

                if (reducePointSizeFallback) {
                    var ok = reducePointSizeAllTextBy1();
                    if (!ok) {
                        console.error("Non posso ridurre ulteriormente il pointSize.");
                        return false;
                    }

                    // dopo riduzione, reset tracking break e riparti
                    insertedBreakStoryIndices = {};
                    fallbackGuard++;
                    if (fallbackGuard > 50) {
                        console.error("[ERROR] Loop eccessivo nel fallback pointSize.");
                        return false;
                    }
                    continue;
                } else {
                    console.error("[ERROR] Impossibile aggiustare: conflitti/overflow persistenti e fallback disattivato.");
                    return false;
                }
            }

            
        }
        catch(e){
            console.error("Errore in reflowTextFrameAvoidConflicts: " + e.message);
            return false;
        }
    },


    getItemContained(item) {
        var listItem = [];
        if (item.constructorName == "TextFrame") {

            return [item];
        }
        else if (item.constructorName == "Group") {
            for (var j = 0; j < item.pageItems.length; j++) {
                var child = item.pageItems.item(j);
                // If it's a group, we need to check its children for text frames
                var res = this.getItemContained(child);
                if (res) {
                    listItem = listItem.concat(res);
                }
            }
            
            return listItem;
        }
        else if (item.constructorName == "PageItem"){

            if (item.pageItems && item.pageItems.length > 0) {
                for (var j = 0; j < item.pageItems.length; j++) {
                    var child = item.pageItems.item(j);
                    // If it's a group, we need to check its children for text frames
                    var res = this.getItemContained(child);
                    if (res) {
                        listItem = listItem.concat(res);
                    }
                }
                return listItem;
            }
            else {
                return [item];
            }
        }
        else {
            return [item];
        }
    },

    followGroup(gruppoSeguito, gruppoAllineamento, anchor, direction = "x", useTextBounds = false, isItemLinkGruppo = false) {
        try {
            let me = this;
            if (!anchor) {
                return false;
            }

            if (direction != "x" && direction != "y") {
                direction = "x";
            }

            // helper: per il gruppo di allineamento, se è itemLink usiamo la graphic interna
            function getTargetItem(wrapperEl) {
                // wrapperEl è l'oggetto di livello.elementi (ha .item, .eliminato, ecc.)
                var baseItem = wrapperEl.item;
                if (!isItemLinkGruppo || !baseItem) {
                    return baseItem;
                }
                try {
                    if (baseItem.graphics && baseItem.graphics.length > 0) {
                        return baseItem.graphics.item(0);
                    }
                } catch (e) {
                    // se qualcosa va storto, fallback al container
                }
                return baseItem;
            }

            //se useTextBounds è true dobbiamo calcolare i bounds del testo per i textframe e per i figli dei gruppi
            var gruppoBounds;
            if (useTextBounds) {
                var boundsList = [];
                for (var i = 0; i < gruppoSeguito.length; i++) {
                    var el = gruppoSeguito[i];
                    boundsList.push(me.getRealBounds(el.item));
                }
                gruppoBounds = [
                    Math.min(...boundsList.map(b => b[0])),
                    Math.min(...boundsList.map(b => b[1])),
                    Math.max(...boundsList.map(b => b[2])),
                    Math.max(...boundsList.map(b => b[3])),
                ];
            }
            else {
                gruppoBounds = [
                    Math.min(...gruppoSeguito.map(el => el.item.geometricBounds[0])),
                    Math.min(...gruppoSeguito.map(el => el.item.geometricBounds[1])),
                    Math.max(...gruppoSeguito.map(el => el.item.geometricBounds[2])),
                    Math.max(...gruppoSeguito.map(el => el.item.geometricBounds[3])),
                ];
            }


            var spostamentoDaApplicare = [0, 0];
            var allineaAlLato = "left";
            var allineaLato = "left";
            if (direction == "x") {
                allineaAlLato = anchor.allineaAlLato ? this.enumHorizontalReferenceLine(anchor.allineaAlLato) : "left";
                allineaLato = anchor.allineaLato ? this.enumHorizontalReferenceLine(anchor.allineaLato) : "left";
            }
            else if (direction == "y") {
                allineaAlLato = anchor.allineaAlLato ? this.enumVerticalReferenceLine(anchor.allineaAlLato) : "top";
                allineaLato = anchor.allineaLato ? this.enumVerticalReferenceLine(anchor.allineaLato) : "top";
            }

            var elemento = null; // wrapper dell'elemento scelto nel gruppoAllineamento
            for (var g = 0; g < gruppoAllineamento.length; g++) {
                var livello = gruppoAllineamento[g];

                //all'interno del livello scorriamo tutti i suoi elementi per cercare quello più estremo
                if (direction == "x") {
                    if (allineaLato == "left") {
                        var minValore = elemento ? getTargetItem(elemento).geometricBounds[1] : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[1] : target.geometricBounds[1];
                            if (valoreLato < minValore) {
                                minValore = valoreLato;
                                if (!elemento || valoreLato < (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[1] : getTargetItem(elemento).geometricBounds[1])) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else if (allineaLato == "right") {
                        var maxValore = elemento ? getTargetItem(elemento).geometricBounds[3] : -Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[3] : target.geometricBounds[3];
                            if (valoreLato > maxValore) {
                                maxValore = valoreLato;
                                if (!elemento || valoreLato > (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[3] : getTargetItem(elemento).geometricBounds[3])) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else if (allineaLato == "middle") {
                        var centroGruppo = (gruppoBounds[1] + gruppoBounds[3]) / 2;
                        var minDiff = elemento ? getTargetItem(elemento).geometricBounds[1] - ((getTargetItem(elemento).geometricBounds[3] - getTargetItem(elemento).geometricBounds[1]) / 2) : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target) : target.geometricBounds;
                            var centroElemento = (valoreLato[1] + valoreLato[3]) / 2;
                            var diff = Math.abs(centroElemento - centroGruppo);
                            if (diff < minDiff) {
                                minDiff = diff;
                                if (!elemento || diff < Math.abs(((useTextBounds ? (me.getRealBounds(getTargetItem(elemento))[1] + me.getRealBounds(getTargetItem(elemento))[3]) : (getTargetItem(elemento).geometricBounds[1] + getTargetItem(elemento).geometricBounds[3])) / 2) - centroGruppo)) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else {
                        //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse left
                        var minValore = elemento ? getTargetItem(elemento).geometricBounds[1] : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[1] : target.geometricBounds[1];
                            if (valoreLato < minValore) {
                                minValore = valoreLato;
                                if (!elemento || valoreLato < (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[1] : getTargetItem(elemento).geometricBounds[1])) {
                                    elemento = el;
                                }
                            }
                        }
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come left");
                    }
                }
                else if (direction == "y") {
                    if (allineaLato == "top") {
                        var minValore = elemento ? getTargetItem(elemento).geometricBounds[0] : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[0] : target.geometricBounds[0];
                            if (valoreLato < minValore) {
                                minValore = valoreLato;
                                if (!elemento || valoreLato < (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[0] : getTargetItem(elemento).geometricBounds[0])) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else if (allineaLato == "bottom") {
                        var maxValore = elemento ? getTargetItem(elemento).geometricBounds[2] : -Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[2] : target.geometricBounds[2];
                            if (valoreLato > maxValore) {
                                maxValore = valoreLato;
                                if (!elemento || valoreLato > (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[2] : getTargetItem(elemento).geometricBounds[2])) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else if (allineaLato == "middle") {
                        var centroGruppo = (gruppoBounds[0] + gruppoBounds[2]) / 2;
                        var minDiff = elemento ? getTargetItem(elemento).geometricBounds[0] - ((getTargetItem(elemento).geometricBounds[2] - getTargetItem(elemento).geometricBounds[0]) / 2) : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target) : target.geometricBounds;
                            var centroElemento = (valoreLato[0] + valoreLato[2]) / 2;
                            var diff = Math.abs(centroElemento - centroGruppo);
                            if (diff < minDiff) {
                                minDiff = diff;
                                if (!elemento || diff < Math.abs(((useTextBounds ? (me.getRealBounds(getTargetItem(elemento))[0] + me.getRealBounds(getTargetItem(elemento))[2]) : (getTargetItem(elemento).geometricBounds[0] + getTargetItem(elemento).geometricBounds[2])) / 2) - centroGruppo)) {
                                    elemento = el;
                                }
                            }
                        }
                    }
                    else {
                        //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse top
                        var minValore = elemento ? getTargetItem(elemento).geometricBounds[0] : Infinity;
                        for (var e = 0; e < livello.elementi.length; e++) {
                            var el = livello.elementi[e];
                            if (el.eliminato) {
                                continue;
                            }
                            var target = getTargetItem(el);
                            if (!target) continue;

                            var valoreLato = useTextBounds ? me.getRealBounds(target)[0] : target.geometricBounds[0];
                            if (valoreLato < minValore) {
                                minValore = valoreLato;
                                if (!elemento || valoreLato < (useTextBounds ? me.getRealBounds(getTargetItem(elemento))[0] : getTargetItem(elemento).geometricBounds[0])) {
                                    elemento = el;
                                }
                            }
                        }
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come top");
                    }
                }
            }

            if (!elemento) {
                //nessun elemento trovato in questo livello, passiamo al prossimo
                return false;
            }

            var spostamento = [0, 0];
            var targetElemento = getTargetItem(elemento);
            if (!targetElemento) {
                return false;
            }

            if (direction == "x") {
                if (allineaAlLato == "left") {
                    if (allineaLato == "left") {
                        spostamento[0] = (gruppoBounds[1] + anchor.distance) - targetElemento.geometricBounds[1];
                    }
                    else if (allineaLato == "right") {
                        spostamento[0] = (gruppoBounds[1] + anchor.distance) - targetElemento.geometricBounds[3];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[1] + targetElemento.geometricBounds[3]) / 2;
                        spostamento[0] = (gruppoBounds[1] + anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[0] = (gruppoBounds[1] + anchor.distance) - targetElemento.geometricBounds[1];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come left");
                    }
                }
                else if (allineaAlLato == "right") {
                    if (allineaLato == "left") {
                        spostamento[0] = (gruppoBounds[3] - anchor.distance) - targetElemento.geometricBounds[1];
                    }
                    else if (allineaLato == "right") {
                        spostamento[0] = (gruppoBounds[3] - anchor.distance) - targetElemento.geometricBounds[3];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[1] + targetElemento.geometricBounds[3]) / 2;
                        spostamento[0] = (gruppoBounds[3] - anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[0] = (gruppoBounds[3] - anchor.distance) - targetElemento.geometricBounds[3];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + anchor.allineaLato + " non supportato, eseguito come right");
                    }
                }
                else if (allineaAlLato == "middle") {
                    var centroGruppo = (gruppoBounds[1] + gruppoBounds[3]) / 2;
                    if (allineaLato == "left") {
                        spostamento[0] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[1];
                    }
                    else if (allineaLato == "right") {
                        spostamento[0] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[3];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[1] + targetElemento.geometricBounds[3]) / 2;
                        spostamento[0] = (centroGruppo + anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[0] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[1];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come middle");
                    }
                }
                else {
                    spostamento[0] = (gruppoBounds[1] + anchor.distance) - targetElemento.geometricBounds[1];
                    messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaAlLato + " non supportato, eseguito come left");
                }
            }
            else {
                if (allineaAlLato == "top") {
                    if (allineaLato == "top") {
                        spostamento[1] = (gruppoBounds[0] + anchor.distance) - targetElemento.geometricBounds[0];
                    }
                    else if (allineaLato == "bottom") {
                        spostamento[1] = (gruppoBounds[0] + anchor.distance) - targetElemento.geometricBounds[2];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[0] + targetElemento.geometricBounds[2]) / 2;
                        spostamento[1] = (gruppoBounds[0] + anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[1] = (gruppoBounds[0] + anchor.distance) - targetElemento.geometricBounds[0];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come top");
                    }
                }
                else if (allineaAlLato == "bottom") {
                    if (allineaLato == "top") {
                        spostamento[1] = (gruppoBounds[2] - anchor.distance) - targetElemento.geometricBounds[0];
                    }
                    else if (allineaLato == "bottom") {
                        spostamento[1] = (gruppoBounds[2] - anchor.distance) - targetElemento.geometricBounds[2];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[0] + targetElemento.geometricBounds[2]) / 2;
                        spostamento[1] = (gruppoBounds[2] - anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[1] = (gruppoBounds[2] - anchor.distance) - targetElemento.geometricBounds[2];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come bottom");
                    }
                }
                else if (allineaAlLato == "middle") {
                    var centroGruppo = (gruppoBounds[0] + gruppoBounds[2]) / 2;
                    if (allineaLato == "top") {
                        spostamento[1] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[0];
                    }
                    else if (allineaLato == "bottom") {
                        spostamento[1] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[2];
                    }
                    else if (allineaLato == "middle") {
                        var centroElemento = (targetElemento.geometricBounds[0] + targetElemento.geometricBounds[2]) / 2;
                        spostamento[1] = (centroGruppo + anchor.distance) - centroElemento;
                    }
                    else {
                        spostamento[1] = (centroGruppo + anchor.distance) - targetElemento.geometricBounds[0];
                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come middle");
                    }
                }
                else {
                    spostamento[1] = (gruppoBounds[0] + anchor.distance) - targetElemento.geometricBounds[0];
                    messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaAlLato + " non supportato, eseguito come top");
                }
            }

            //spostamento da applicare a tutti gli elementi del gruppoAllineamento
            spostamentoDaApplicare = spostamento;


            // bounds per collisioni: qui usiamo SEMPRE il targetItem
            var listBoundsGruppoSeguito = gruppoSeguito.map(el => {
                return me.getRealBounds(el.item);
            });

            var listBoundsGruppoAllineamento = [];

            for (var g = 0; g < gruppoAllineamento.length; g++) {
                var gruppo = gruppoAllineamento[g];

                if (gruppo.livelloEliminato) {
                    continue;
                }

                for (var e = 0; e < gruppo.elementi.length; e++) {
                    var elemWrapper = gruppo.elementi[e];

                    if (elemWrapper.eliminato) {
                        continue;
                    }

                    var target = getTargetItem(elemWrapper);
                    if (!target) continue;

                    var boundsPostSpostamento = [
                        target.geometricBounds[0] + spostamentoDaApplicare[1],
                        target.geometricBounds[1] + spostamentoDaApplicare[0],
                        target.geometricBounds[2] + spostamentoDaApplicare[1],
                        target.geometricBounds[3] + spostamentoDaApplicare[0],
                    ];

                    if (useTextBounds) {
                        var boundsEl = this.getRealBounds(target);
                        boundsPostSpostamento = [
                            boundsEl[0] + spostamentoDaApplicare[1],
                            boundsEl[1] + spostamentoDaApplicare[0],
                            boundsEl[2] + spostamentoDaApplicare[1],
                            boundsEl[3] + spostamentoDaApplicare[0],
                        ];
                    }

                    listBoundsGruppoAllineamento.push({
                        item: target,
                        boundsPostSpostamento: boundsPostSpostamento
                    });
                }
            }

            // --- collisioni e spostamento finale rimangono invariati, lavorano su item = target ---

            if (anchor.stopOnCollision) {
                var collisioneRilevata = true;
                var securityCounter = 1000;
                while (collisioneRilevata && securityCounter > 0) {

                    collisioneRilevata = false;
                    for (var j = 0; j < listBoundsGruppoAllineamento.length; j++) {
                        var boundsAllineamento = listBoundsGruppoAllineamento[j];

                        for (var i = 0; i < listBoundsGruppoSeguito.length; i++) {
                            var boundsSeguito = listBoundsGruppoSeguito[i];

                            if (this.checkCollision(boundsSeguito, boundsAllineamento.boundsPostSpostamento)) {

                                var spostamentoCollisione = 0;
                                if (direction == "x") {
                                    if (allineaLato == "left") {
                                        spostamentoCollisione = boundsSeguito[3] - boundsAllineamento.boundsPostSpostamento[1];
                                    }
                                    else if (allineaLato == "right") {
                                        spostamentoCollisione = boundsSeguito[1] - boundsAllineamento.boundsPostSpostamento[3];
                                    }
                                    else if (allineaLato == "middle") {
                                        var distanzaLeft = Math.abs(boundsSeguito[1] - boundsAllineamento.boundsPostSpostamento[3]);
                                        var distanzaRight = Math.abs(boundsSeguito[3] - boundsAllineamento.boundsPostSpostamento[1]);
                                        if (distanzaLeft <= distanzaRight) {
                                            spostamentoCollisione = boundsSeguito[3] - boundsAllineamento.boundsPostSpostamento[1];
                                        }
                                        else {
                                            spostamentoCollisione = boundsSeguito[1] - boundsAllineamento.boundsPostSpostamento[3];
                                        }
                                    }
                                    else {
                                        spostamentoCollisione = boundsSeguito[3] - boundsAllineamento.boundsPostSpostamento[1];
                                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come left");
                                    }
                                }
                                else {
                                    if (allineaLato == "top") {
                                        spostamentoCollisione = boundsSeguito[2] - boundsAllineamento.boundsPostSpostamento[0];
                                    }
                                    else if (allineaLato == "bottom") {
                                        spostamentoCollisione = boundsSeguito[0] - boundsAllineamento.boundsPostSpostamento[2];
                                    }
                                    else if (allineaLato == "middle") {
                                        var distanzaTop = Math.abs(boundsSeguito[0] - boundsAllineamento.boundsPostSpostamento[2]);
                                        var distanzaBottom = Math.abs(boundsSeguito[2] - boundsAllineamento.boundsPostSpostamento[0]);
                                        if (distanzaTop <= distanzaBottom) {
                                            spostamentoCollisione = boundsSeguito[2] - boundsAllineamento.boundsPostSpostamento[0];
                                        }
                                        else {
                                            spostamentoCollisione = boundsSeguito[0] - boundsAllineamento.boundsPostSpostamento[2];
                                        }
                                    }
                                    else {
                                        spostamentoCollisione = boundsSeguito[2] - boundsAllineamento.boundsPostSpostamento[0];
                                        messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come top");
                                    }
                                }

                                for (var k = 0; k < listBoundsGruppoAllineamento.length; k++) {
                                    if (direction == "x") {
                                        listBoundsGruppoAllineamento[k].boundsPostSpostamento[1] += spostamentoCollisione;
                                        listBoundsGruppoAllineamento[k].boundsPostSpostamento[3] += spostamentoCollisione;
                                    }
                                    else {
                                        listBoundsGruppoAllineamento[k].boundsPostSpostamento[0] += spostamentoCollisione;
                                        listBoundsGruppoAllineamento[k].boundsPostSpostamento[2] += spostamentoCollisione;
                                    }
                                }

                                collisioneRilevata = true;
                                securityCounter--;
                                break;
                            }
                        }
                        if (collisioneRilevata) {
                            break;
                        }
                    }
                }

                if (securityCounter == 0) {
                    console.error("Follow Anchor: Rilevato possibile ciclo infinito nel calcolo dello spostamento per evitare collisioni, l'operazione di follow potrebbe non essere stata completata correttamente");
                }

            }

            for (var k = 0; k < listBoundsGruppoAllineamento.length; k++) {
                var elementoItem = listBoundsGruppoAllineamento[k].item;
                if (direction == "x") {
                    if (allineaLato == "left") {
                        let deltaX = listBoundsGruppoAllineamento[k].boundsPostSpostamento[1] - elementoItem.geometricBounds[1];
                        elementoItem.move(undefined, [deltaX, 0]);
                    }
                    else if (allineaLato == "right") {
                        let deltaX = listBoundsGruppoAllineamento[k].boundsPostSpostamento[3] - elementoItem.geometricBounds[3];
                        elementoItem.move(undefined, [deltaX, 0]);
                    }
                    else if (allineaLato == "middle") {
                        let centroElementoOriginale = (elementoItem.geometricBounds[1] + elementoItem.geometricBounds[3]) / 2;
                        let deltaX = centroElementoOriginale - (listBoundsGruppoAllineamento[k].boundsPostSpostamento[1] + listBoundsGruppoAllineamento[k].boundsPostSpostamento[3]) / 2;
                        elementoItem.move(undefined, [deltaX, 0]);
                    }
                }
                else {
                    if (allineaLato == "top") {
                        let deltaY = listBoundsGruppoAllineamento[k].boundsPostSpostamento[0] - elementoItem.geometricBounds[0];
                        elementoItem.move(undefined, [0, deltaY]);
                    }
                    else if (allineaLato == "bottom") {
                        let deltaY = listBoundsGruppoAllineamento[k].boundsPostSpostamento[2] - elementoItem.geometricBounds[2];
                        elementoItem.move(undefined, [0, deltaY]);
                    }
                    else if (allineaLato == "middle") {
                        let centroElementoOriginale = (elementoItem.geometricBounds[0] + elementoItem.geometricBounds[2]) / 2;
                        let deltaY = centroElementoOriginale - (listBoundsGruppoAllineamento[k].boundsPostSpostamento[0] + listBoundsGruppoAllineamento[k].boundsPostSpostamento[2]) / 2;
                        elementoItem.move(undefined, [0, deltaY]);
                    }
                }
            }

            return true;
        }
        catch (err) {
            console.error("Follow Anchor: Errore imprevisto durante il follow del gruppo", err);
            messaggioUtente("Code CSF-11 Attenzione: Errore generico durante il follow del gruppo");
            return false;
        }
    },

    followStaticAnchor(box, gruppoAllineamento, anchor, mappaBoxOriginale, itemRef, allineamentiRiusciti, isItemLinkGruppo = false) {

        if (gruppoAllineamento.length == 0) {
            return true;
        }

        // helper: se è un gruppo itemLink, lavoriamo sulla graphic interna
        function getTargetItem(elementoWrapper) {
            var baseItem = elementoWrapper.item;
            if (!isItemLinkGruppo || !baseItem) {
                return baseItem;
            }
            try {
                if (baseItem.graphics && baseItem.graphics.length > 0) {
                    return baseItem.graphics.item(0);
                }
            } catch (e) {
                // fallback al container se qualcosa va storto
            }
            return baseItem;
        }

        var spostamentoDaApplicare = [0, 0];

        for (var i = 0; i < anchor.length; i++) {

            //controlliamo le condizioni
            var singleAnchor = anchor[i];

            if (singleAnchor.listSetCondizioni && singleAnchor.listSetCondizioni.length > 0) {
                if (!this.checkAllConditions(mappaBoxOriginale, itemRef, singleAnchor.listSetCondizioni, box)) {
                    //le condizioni non sono rispettate, saltiamo questo anchor
                    continue;
                }
            }

            //se siamo qui le condizioni sono soddisfatte o non ci sono condizioni, procediamo con l'anchor

            // ----------- X -----------
            if (singleAnchor.xAnchor && !allineamentiRiusciti.x) {
                var distanzaX = singleAnchor.xAnchor.distance;
                if (singleAnchor.xAnchor.distance && typeof singleAnchor.xAnchor.distance == "string") {
                    var isPercentual = singleAnchor.xAnchor.distance.indexOf("%") > -1;
                    //proviamo a convertire in numero la stringa togliendo % se c'è, facciamo attenzione alle virgole o punti
                    var numericVal = parseFloat(singleAnchor.xAnchor.distance.replace(",", ".").replace("%", ""));
                    if (!isNaN(numericVal)) {
                        if (!isPercentual) {
                            //la distanza è in mm
                            distanzaX = numericVal;
                        }
                        else {
                            //la distanza è in percentuale, la calcoliamo in base alla larghezza del box
                            distanzaX = ((box.geometricBounds[3] - box.geometricBounds[1]) * numericVal / 100);
                        }
                    }
                    else {
                        messaggioUtente("Code CSF-12 Attenzione: distanza X dell'anchor statica non valida, usato 0");
                        console.error("Follow Static Anchor: distanza X dell'anchor statica non valida, usato 0");
                        distanzaX = 0;
                    }
                }

                for (var g = 0; g < gruppoAllineamento.length; g++) {
                    var gruppo = gruppoAllineamento[g];

                    if (gruppo.livelloEliminato) {
                        continue;
                    }

                    for (var e = 0; e < gruppo.elementi.length; e++) {
                        var elemento = gruppo.elementi[e];

                        if (elemento.eliminato) {
                            continue;
                        }

                        var targetItem = getTargetItem(elemento);
                        if (!targetItem) {
                            continue;
                        }

                        var spostamento = 0;

                        //controlliamo allineaAlLato e allineaLato per calcolare lo spostamento
                        var allineaAlLato = singleAnchor.xAnchor.allineaAlLato ? this.enumHorizontalReferenceLine(singleAnchor.xAnchor.allineaAlLato) : "left";
                        var allineaLato = singleAnchor.xAnchor.allineaLato ? this.enumHorizontalReferenceLine(singleAnchor.xAnchor.allineaLato) : "left";
                        if (allineaAlLato == "left") {
                            if (allineaLato == "left") {
                                spostamento = (box.geometricBounds[1] + distanzaX) - targetItem.geometricBounds[1];
                            }
                            else if (allineaLato == "right") {
                                spostamento = (box.geometricBounds[1] + distanzaX) - targetItem.geometricBounds[3];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoX = (targetItem.geometricBounds[1] + targetItem.geometricBounds[3]) / 2;
                                spostamento = (box.geometricBounds[1] + distanzaX) - centroElementoX;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse left
                                spostamento = (box.geometricBounds[1] + distanzaX) - targetItem.geometricBounds[1];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come left");
                            }
                        }
                        else if (allineaAlLato == "right") {
                            if (allineaLato == "left") {
                                spostamento = (box.geometricBounds[3] - distanzaX) - targetItem.geometricBounds[1];
                            }
                            else if (allineaLato == "right") {
                                spostamento = (box.geometricBounds[3] - distanzaX) - targetItem.geometricBounds[3];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoX = (targetItem.geometricBounds[1] + targetItem.geometricBounds[3]) / 2;
                                spostamento = (box.geometricBounds[3] - distanzaX) - centroElementoX;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse right
                                spostamento = (box.geometricBounds[3] - distanzaX) - targetItem.geometricBounds[3];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come right");
                            }
                        }
                        else if (allineaAlLato == "middle") {
                            var centroBoxX = (box.geometricBounds[1] + box.geometricBounds[3]) / 2;
                            if (allineaLato == "left") {
                                spostamento = (centroBoxX + distanzaX) - targetItem.geometricBounds[1];
                            }
                            else if (allineaLato == "right") {
                                spostamento = (centroBoxX + distanzaX) - targetItem.geometricBounds[3];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoX = (targetItem.geometricBounds[1] + targetItem.geometricBounds[3]) / 2;
                                spostamento = (centroBoxX + distanzaX) - centroElementoX;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse middle
                                spostamento = (centroBoxX + distanzaX) - targetItem.geometricBounds[1];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come middle");
                            }
                        }
                        else {
                            //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse left
                            spostamento = (box.geometricBounds[1] + distanzaX) - targetItem.geometricBounds[1];
                            messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaAlLato + " non supportato, eseguito come left");
                        }

                        //spostamento da applicare è il minimo tra tutti gli elementi del gruppo di allineamento
                        if ((g == 0 && e == 0) || (e == 0 && singleAnchor.xAnchor.applyToSingleLevels)) {
                            spostamentoDaApplicare[0] = spostamento;
                        }
                        else {
                            if (Math.abs(spostamento) < Math.abs(spostamentoDaApplicare[0])) {
                                spostamentoDaApplicare[0] = spostamento;
                            }
                        }
                    }

                    //se applyToSingleLevels è true invece che calcolare lo spostamento minimo e spostare tutti come un gruppo muoviamo tutti gli elementi di questo livello singolarmente
                    //in questo modo ogni livello si allinea singolarmente
                    if (singleAnchor.xAnchor.applyToSingleLevels) {
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];

                            if (elemento.eliminato) {
                                continue;
                            }

                            var targetItem = getTargetItem(elemento);
                            if (!targetItem) {
                                continue;
                            }

                            let deltaX = spostamentoDaApplicare[0];
                            targetItem.move(undefined, [deltaX, 0]);
                        }
                        //azzeriamo lo spostamento da applicare in modo che non venga applicato di nuovo dopo il ciclo dei gruppi
                        spostamentoDaApplicare[0] = 0;
                    }

                }

            }

            // ----------- Y -----------
            if (singleAnchor.yAnchor && !allineamentiRiusciti.y) {
                var distanzaY = singleAnchor.yAnchor.distance;
                if (singleAnchor.yAnchor.distance && typeof singleAnchor.yAnchor.distance == "string") {
                    var isPercentualY = singleAnchor.yAnchor.distance.indexOf("%") > -1;
                    //proviamo a convertire in numero la stringa togliendo % se c'è, facciamo attenzione alle virgole o punti
                    var numericValY = parseFloat(singleAnchor.yAnchor.distance.replace(",", ".").replace("%", ""));
                    if (!isNaN(numericValY)) {
                        if (!isPercentualY) {
                            //la distanza è in mm
                            distanzaY = numericValY;
                        }
                        else {
                            //la distanza è in percentuale, la calcoliamo in base all'altezza del box
                            distanzaY = ((box.geometricBounds[2] - box.geometricBounds[0]) * numericValY / 100);
                        }
                    }
                    else {
                        messaggioUtente("Code CSF-12 Attenzione: distanza Y dell'anchor non è un numero valido, usato 0mm");
                        console.error(" Code CSF-12 Follow Static Anchor: distanza Y dell'anchor non è un numero valido, usato 0mm");
                        distanzaY = 0;
                    }
                }

                for (var g = 0; g < gruppoAllineamento.length; g++) {
                    var gruppo = gruppoAllineamento[g];

                    if (gruppo.livelloEliminato) {
                        continue;
                    }

                    for (var e = 0; e < gruppo.elementi.length; e++) {
                        var elemento = gruppo.elementi[e];

                        if (elemento.eliminato) {
                            continue;
                        }

                        var targetItem = getTargetItem(elemento);
                        if (!targetItem) {
                            continue;
                        }

                        var spostamento = 0;

                        //controlliamo allineaAlLato e allineaLato per calcolare lo spostamento
                        var allineaAlLato = singleAnchor.yAnchor.allineaAlLato ? this.enumVerticalReferenceLine(singleAnchor.yAnchor.allineaAlLato) : "top";
                        var allineaLato = singleAnchor.yAnchor.allineaLato ? this.enumVerticalReferenceLine(singleAnchor.yAnchor.allineaLato) : "top";
                        if (allineaAlLato == "top") {
                            if (allineaLato == "top") {
                                spostamento = (box.geometricBounds[0] + distanzaY) - targetItem.geometricBounds[0];
                            }
                            else if (allineaLato == "bottom") {
                                spostamento = (box.geometricBounds[0] + distanzaY) - targetItem.geometricBounds[2];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoY = (targetItem.geometricBounds[0] + targetItem.geometricBounds[2]) / 2;
                                spostamento = (box.geometricBounds[0] + distanzaY) - centroElementoY;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse top
                                spostamento = (box.geometricBounds[0] + distanzaY) - targetItem.geometricBounds[0];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come top");
                            }
                        }
                        else if (allineaAlLato == "bottom") {
                            if (allineaLato == "top") {
                                spostamento = (box.geometricBounds[2] - distanzaY) - targetItem.geometricBounds[0];
                            }
                            else if (allineaLato == "bottom") {
                                spostamento = (box.geometricBounds[2] - distanzaY) - targetItem.geometricBounds[2];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoY = (targetItem.geometricBounds[0] + targetItem.geometricBounds[2]) / 2;
                                spostamento = (box.geometricBounds[2] - distanzaY) - centroElementoY;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse bottom
                                spostamento = (box.geometricBounds[2] - distanzaY) - targetItem.geometricBounds[2];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come bottom");
                            }
                        }
                        else if (allineaAlLato == "middle") {
                            var centroBoxY = (box.geometricBounds[0] + box.geometricBounds[2]) / 2;
                            if (allineaLato == "top") {
                                spostamento = (centroBoxY + distanzaY) - targetItem.geometricBounds[0];
                            }
                            else if (allineaLato == "bottom") {
                                spostamento = (centroBoxY + distanzaY) - targetItem.geometricBounds[2];
                            }
                            else if (allineaLato == "middle") {
                                var centroElementoY = (targetItem.geometricBounds[0] + targetItem.geometricBounds[2]) / 2;
                                spostamento = (centroBoxY + distanzaY) - centroElementoY;
                            }
                            else {
                                //mandiamo un avviso messaggioUtente di warn ed eseguiamo come fosse middle
                                spostamento = (centroBoxY + distanzaY) - targetItem.geometricBounds[0];
                                messaggioUtente("Code CSF-10 Attenzione: allineamento " + allineaLato + " non supportato, eseguito come middle");
                            }
                        }

                        //spostamento da applicare è il minimo tra tutti gli elementi del gruppo di allineamento
                        if ((g == 0 && e == 0) || (e == 0 && singleAnchor.yAnchor.applyToSingleLevels)) {
                            spostamentoDaApplicare[1] = spostamento;
                        }
                        else {
                            if (Math.abs(spostamento) < Math.abs(spostamentoDaApplicare[1])) {
                                spostamentoDaApplicare[1] = spostamento;
                            }
                        }
                    }

                    //se applyToSingleLevels è true invece che calcolare lo spostamento minimo e spostare tutti come un gruppo muoviamo tutti gli elementi di questo livello singolarmente
                    //in questo modo ogni livello si allinea singolarmente
                    if (singleAnchor.yAnchor.applyToSingleLevels) {
                        for (var e = 0; e < gruppo.elementi.length; e++) {
                            var elemento = gruppo.elementi[e];

                            if (elemento.eliminato) {
                                continue;
                            }

                            var targetItem = getTargetItem(elemento);
                            if (!targetItem) {
                                continue;
                            }

                            let deltaY = spostamentoDaApplicare[1];
                            targetItem.move(undefined, [0, deltaY]);
                        }
                        //azzeriamo lo spostamento da applicare in modo che non venga applicato di nuovo dopo il ciclo dei gruppi
                        spostamentoDaApplicare[1] = 0;
                    }

                }

            }

            if (spostamentoDaApplicare[0] != 0 || spostamentoDaApplicare[1] != 0) {
                //applichiamo lo spostamento a tutti gli elementi del gruppo di allineamento
                for (var g = 0; g < gruppoAllineamento.length; g++) {
                    var gruppo = gruppoAllineamento[g];

                    if (gruppo.livelloEliminato) {
                        continue;
                    }

                    for (var e = 0; e < gruppo.elementi.length; e++) {
                        var elemento = gruppo.elementi[e];

                        if (elemento.eliminato) {
                            continue;
                        }

                        var targetItem = getTargetItem(elemento);
                        if (!targetItem) {
                            continue;
                        }

                        targetItem.geometricBounds = [
                            targetItem.geometricBounds[0] + spostamentoDaApplicare[1],
                            targetItem.geometricBounds[1] + spostamentoDaApplicare[0],
                            targetItem.geometricBounds[2] + spostamentoDaApplicare[1],
                            targetItem.geometricBounds[3] + spostamentoDaApplicare[0],
                        ];
                    }
                }
            }
            break;
        }

    },


    checkCollision(boundsA, boundsB) {
        // Controlla se due bounding box si sovrappongono
        return !(boundsA[2] <= boundsB[0] || // A è a sinistra di B
            boundsA[0] >= boundsB[2] || // A è a destra di B
            boundsA[3] <= boundsB[1] || // A è sopra B
            boundsA[1] >= boundsB[3]);   // A è sotto B
    },

    finalFit(mappaBoxOriginale, fitRichiesti) {
        //fitRichiesti è un array di
        // {
        //     "nomiElementi": ["string"], //l'etichetta dell'elemento che deve subire il fit
        //     "Fit": ["sting"] //i fit da effettuare in ordine i valori possono essere "FRAME_TO_CONTENT", "CONTENT_TO_FRAME", "PROPORTIONALLY"
        // }

        //scorriamo i fit richiesti
        for (var f = 0; f < fitRichiesti.length; f++) {
            var fitRichiesto = fitRichiesti[f];

            //cerchiamo gli elementi nell'array listGruppoAllineamento
            var elementiTrovati = [];
            for (var i = 0; i < fitRichiesto.nomiElementi.length; i++) {
                var nomeElemento = fitRichiesto.nomiElementi[i];
                //usiamo di nuovo le regex per cercare l'elemento
                var regex = this.makeRegexFromGroupName(nomeElemento);

                for (var key in mappaBoxOriginale) {
                    if (regex.test(key) && !mappaBoxOriginale[key].eliminato) {
                        elementiTrovati.push({item: mappaBoxOriginale[key].item, fitRichiesto: fitRichiesto.fit});
                        //break;
                    }
                }
            }

            if (elementiTrovati.length > 0) {
                //eseguiamo i fit richiesti in ordine per ogni elemento trovato
                for (var e = 0; e < elementiTrovati.length; e++) {
                    var elementoTrovato = elementiTrovati[e];
                    for (var fitIndex = 0; fitIndex < elementoTrovato.fitRichiesto.length; fitIndex++) {
                        var fitType = this.enumFitOperation(elementoTrovato.fitRichiesto[fitIndex]);
                        if (fitType == "FRAME_TO_CONTENT") {
                            try {
                                elementoTrovato.item.fit(FitOptions.FRAME_TO_CONTENT);
                            } catch (error) {
                                messaggioUtente("Code CSF-11 Attenzione: impossibile eseguire il fit FRAME_TO_CONTENT sull'elemento " + elementoTrovato.item.name + ", operazione ignorata");
                            }
                        }
                        else if (fitType == "CONTENT_TO_FRAME") {
                            try {
                                elementoTrovato.item.fit(FitOptions.CONTENT_TO_FRAME);
                            } catch (error) {
                                messaggioUtente("Code CSF-11 Attenzione: impossibile eseguire il fit CONTENT_TO_FRAME sull'elemento " + elementoTrovato.item.name + ", operazione ignorata");
                            }
                        }
                        else if (fitType == "PROPORTIONALLY") {
                            try {
                                elementoTrovato.item.fit(FitOptions.PROPORTIONALLY);
                            } catch (error) {
                                messaggioUtente("Code CSF-11 Attenzione: impossibile eseguire il fit PROPORTIONALLY sull'elemento " + elementoTrovato.item.name + ", operazione ignorata");
                            }
                        }
                        else if (fitType == "FILL_PROPORTIONALLY") {
                            try {
                                elementoTrovato.item.fit(FitOptions.FILL_PROPORTIONALLY);
                            } catch (error) {
                                messaggioUtente("Code CSF-11 Attenzione: impossibile eseguire il fit FILL_PROPORTIONALLY sull'elemento " + elementoTrovato.item.name + ", operazione ignorata");
                            }
                        }
                        else {
                            messaggioUtente("Code CSF-11 Attenzione: tipo di fit " + fitType + " non riconosciuto per l'elemento " + elementoTrovato.item.name + ", operazione ignorata");
                        }
                    }
                }
            }
        }
            
    },

    enumAxisResizeMode(numericValue){
        switch(numericValue){
            case 0:
                return "proporzionale";
            case 1:
                return "ingrandimento_lineare";
            case 2:
                return "spostamento_lineare";
            case 3:
                return "spostamento_lineare_centrato";
            default:
                return null;
        }
    },

    enumLetturaLivelli(numericValue){
        switch(numericValue){
            case 0:
                return "colonne_left_to_right";
            case 1:
                return "colonne_right_to_left";
            case 2:
                return "righe_top_to_bottom";
            case 3:
                return "righe_bottom_to_top";
            default:
                return null;
        }
    },

    enumInternalAnchor(numericValue){
        switch(numericValue){
            case 0:
                return "left";
            case 1:
                return "right";
            case 2:
                return "top";
            case 3:
                return "bottom";
            default:
                return null;
        }
    },

    enumVerticalReferenceLine(numericValue){
        switch(numericValue){
            case 0:
                return "top";
            case 1:
                return "bottom";
            case 2:
                return "middle";
            default:
                return null;
        }
    },
    
    enumHorizontalReferenceLine(numericValue){
        switch(numericValue){
            case 0:
                return "left";
            case 1:
                return "right";
            case 2:
                return "middle";
            default:
                return null;
        }
    },

    enumPriorityAxis(numericValue){
        switch(numericValue){
            case 0:
                return "x";
            case 1:
                return "y";
            default:
                return "x";
        }
    },

    enumFitOperation(numericValue){
        switch(numericValue){
            case 0:
                return "FRAME_TO_CONTENT";
            case 1:
                return "CONTENT_TO_FRAME";
            case 2:
                return "PROPORTIONALLY";
            case 3:
                return "FILL_PROPORTIONALLY";
            default:
                return null;
        }
    },

    confini: [7.225, 27.625, 7.225 + 61.5, 27.625 + 38.375],
    offsetScale: 1,

    //DEFINIZIONE MODELLI
    //offsetSteps: E' un array a 3 dimensioni
    //il primo array è l'indice della foto per cui
    //L'array di secondo livello specifica i momenti. Quando una immagine arriva ad azzerare entrami gli offset per cui è in fase di stallo, procede (se esiste) con il momento successivo, altrimenti rimane ferma
    //L'array di terzo livello invece rappresenta la coppia X,Y
    //scaleReduce: Coefficiente di scalatura della dimenione delle immagini a partire dal secondo tentativo tra i maxTentativi disponibili
    //maxTentativi: Quante volte il FIX deve essere operato in caso di mancata risoluzione.Un ciclo di fix si termina quando tutti gli offsetSteps di tutte le immagini coinvolte sono tutte in stallo
    //percentualeSovrapposizioneAccettabile: Percentuale accettabile di area ovrapposta tra le immagini 

    // 2 foto dove w>h
    modelloStandardFotoOrizzontali: {
        scaleReduce: 0.15,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 25,
        momenti: [0, 0, 0]
    },

    // 2 foto dove h>w
    modelloStandardFotoVerticali: {
        scaleReduce: 0.15,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 25,
        momenti: [0, 0, 0]
    },

    // 2 foto dove w>h Rapporto >= del 50%
    modelloSlimFotoOrizzontali: {
        scaleReduce: 0.15,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 0,
        momenti: [0, 0, 0]
    },

    // 2 foto dove h>w Rapporto >= del 50%
    modelloSlimFotoVerticali: {
        scaleReduce: 0.07,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 0,
        momenti: [0, 0, 0]
    },

    // 3 foto 
    modelloTreFoto: {
        scaleReduce: 0.15,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 35,
        momenti: [0, 0, 0]
    },

    modelloTreFotoVerticale: {
        scaleReduce: 0.1,
        maxTentativi: 5,
        percentualeSovrapposizioneAccettabile: 25,
        momenti: [0, 0, 0]
    },

    img1: {},
    img2: {},
    img3: {},
    inddItemImg1: null,
    inddItemImg2: null,
    inddItemImg3: null,

    cacheBoundaries: {},
    modelloDiFix: null,

    MAIN_fixFoto(listaFoto, confiniParam) {

        img1 = {};
        img2 = {};
        img3 = {};

        inddItemImg1 = null;
        inddItemImg2 = null;
        inddItemImg3 = null;

        for (var p = 0; p < listaFoto.length; p++) {
            if (p == 0) {
                inddItemImg1 = listaFoto[p];
            }
            else if (p == 1) {
                inddItemImg2 = listaFoto[p];
            }
            else if (p == 2) {
                inddItemImg3 = listaFoto[p];
            }
        }
        console.log(confiniParam);
        confini = [confiniParam[1], confiniParam[0], confiniParam[3], confiniParam[2]];// [objDna.confineFixFoto[1],objDna.confineFixFoto[0],objDna.confineFixFoto[3],objDna.confineFixFoto[2]];

        if (inddItemImg2 != null) {
            //alert("Inizio fix");

            //Ci devono essere almeno 2 foto per questo genere di FIX
            //Altrimenti analizzo modello e procedo al fix
            modelloDiFix = analisiModello([inddItemImg1, inddItemImg2, inddItemImg3]);
            modelloDiFix.momenti = [0, 0, 0];

            //alert("START");
            //alert(modelloDiFix);

            var risolto = true;

            for (var m = 0; m < modelloDiFix.maxTentativi; m++) {


                //alert("Tentativo " + (m+1));
                modelloStandardFotoOrizzontali.offsetSteps = [[[-2, -1]], [[2, 1]], [[1, -0.7]]];
                modelloStandardFotoVerticali.offsetSteps = [[[-1, -1]], [[1, 1]], [[1, -0.7]]];
                modelloSlimFotoOrizzontali.offsetSteps = [[[0, -1]], [[0, 1]], [[0, 2]]];
                modelloSlimFotoVerticali.offsetSteps = [[[-1, 0]], [[1, 0]], [[2, 0]]];
                modelloTreFoto.offsetSteps = [[[-2, -1]], [[0, 1]], [[1, -0.7]]];
                modelloTreFotoVerticale.offsetSteps = [[[-2, -1]], [[0, 1]], [[2, -0.7]]];

                startFix([inddItemImg1, inddItemImg2, inddItemImg3], m + 1);

                //Da fare FIX
                var tester = test();
                var paracadute = 0;


                risolto = true;

                //alert("Tolleranza " + modelloDiFix.percentualeSovrapposizioneAccettabile);

                while (tester > modelloDiFix.percentualeSovrapposizioneAccettabile) {
                    //alert("ERR: " + tester);
                    // logFile = File (myDoc.filePath +"/loadingFixFoto.txt");
                    // logFile.encoding="ASCII";
                    // logFile.open("w");
                    // logFile.writeln(pagItem.name + " - Tentativo n." + (m+1) + " SOVRAPPOSIZIONE " + tester + "%");
                    // logFile.close();

                    fixIterazione([inddItemImg1, inddItemImg2, inddItemImg3]);
                    tester = test();
                    //alert("tester finito");

                    paracadute++;
                    if (paracadute > 10) {
                        risolto = false;
                        break;
                    }
                }

                //alert(tester);


                if (risolto)
                    break;

            }
        }
    },
}

module.exports = CssFramework;
