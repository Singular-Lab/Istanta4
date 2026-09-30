/// I20-1009: i rettangoli liberi di un box, dato dove stanno gli ostacoli.
///
/// E' il calcolo dietro getSpazioImpaginazione di sistemazioneFoto: per ogni ostacolo lo
/// spazio sopra, sotto, a sinistra e a destra (generateCandidateRects), poi ogni candidato
/// spezzato sugli altri ostacoli finche' nessuno collide piu' (refineRects), e tre potature.
///
/// Lavora su numeri - rettangoli { x, y, width, height } in coordinate relative alla base -
/// e non tocca InDesign: si carica sotto Node ed e' verificato da
/// tests/plugin/raffinamentoSpazio.test.js. Prima stava dentro CssFramework.js, e il test
/// doveva sostituire il modulo indesign per poterlo caricare.
///
/// Esecuzione dei test: node --test tests/plugin/*.test.js

const spazioLibero = {

    /// I candidati grossolani: per ogni ostacolo, tutto lo spazio sopra, sotto, a sinistra e a
    /// destra di esso. Sono sovrapposti fra loro e ignorano l'esistenza degli altri ostacoli:
    /// e' refineRects a sistemarli.
    /// Ogni candidato viene poi ristretto di paddingBox, che di default e' negativo,
    /// [-2,-2,-2,-2], cosi' le foto non finiscono a filo degli ostacoli. Il cliente puo'
    /// cambiarlo da custom.js: lo legge sistemazioneFoto e lo passa qui.
    /// I20-1009: prima lo si leggeva qui dalla globale customAgenzia, e la funzione non si
    /// poteva provare senza.
    generateCandidateRects(boxWidth, boxHeight, obstacles, tolerance = 0, paddingBox = null) {
        const results = [];
        if (paddingBox == null) {
            paddingBox = [-2, -2, -2, -2]; // [top, left, bottom, right]
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

    /// Il cuore del gruppo: spezza ogni candidato sugli ostacoli che lo attraversano, e ripete
    /// finche' nessuno collide piu'. Alla fine toglie i duplicati, scarta i candidati piu'
    /// piccoli di un quarto della base per lato e quelli contenuti in altri.
    ///
    /// Il ciclo finisce sempre, in al piu' tanti giri quanti sono gli ostacoli piu' uno: ogni
    /// pezzo nato da una spezzatura porta in obstacleRefs l'ostacolo che l'ha spezzato, e su
    /// quello non viene piu' spezzato; un rettangolo che a un giro non collide con niente non
    /// collide piu', perche' gli ostacoli non cambiano. Quindi a ogni giro chi resta da
    /// spezzare ha un ostacolo in piu' nei suoi obstacleRefs, e gli ostacoli sono finiti.
    ///
    /// La guardia e' quel numero, obstacles.length + 1. Se scatta la regola qui sopra e' stata
    /// rotta, e i candidati restituiti sono quelli parziali dell'ultimo giro: esito.interrotto
    /// lo dice, e getSpazioImpaginazione lo fa sapere.
    /// I20-1011: prima la guardia era a mille giri, e un secondo limite a dieci milioni di
    /// rettangoli si controllava solo all'inizio di ogni giro. Non potevano scattare, e se
    /// l'avessero fatto nessuno l'avrebbe saputo.
    ///
    /// esito, se passato, si riempie con { iterazioni, rettangoli, ostacoli, interrotto }.
    refineRects(obstacles, contours, boxWidth, boxHeight, tolerance = 0, esito = null) {
        let currentRects = [...contours];
        let changed = true;
        let emergencycounter = 0;
        let rettangoliAlPicco = currentRects.length;
        const limiteIterazioni = obstacles.length + 1;
        while (changed && emergencycounter < limiteIterazioni) {
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
            rettangoliAlPicco = Math.max(rettangoliAlPicco, currentRects.length);
            emergencycounter++;
        }

        if (esito != null) {
            esito.iterazioni = emergencycounter;
            esito.rettangoli = rettangoliAlPicco;
            esito.ostacoli = obstacles.length;
            //Uscito con changed ancora vero: l'ha fermato la guardia, non la convergenza.
            esito.interrotto = changed;
        }

        let cleanedRects = this.removeDuplicateRects(currentRects);
        cleanedRects = this.removeRectsToSmall(cleanedRects, boxWidth / 4, boxHeight / 4); // rimuove rettangoli troppo piccoli

        //Se vogliamo più aree possiamo disattivare questa funzione, le aree che toglie non sono sbagliate ma sono sottoaree di quelle rimaste
        cleanedRects = this.reduceResult(cleanedRects);
        return cleanedRects;
    },

    /// Cosa resta di un rettangolo tolto di mezzo un ostacolo: fino a quattro pezzi, sopra,
    /// sotto, a sinistra e a destra. I pezzi laterali sono alti quanto la sola fascia
    /// dell'ostacolo, cosi' non si sovrappongono a quelli sopra e sotto.
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

    /// Via i rettangoli uguali a meno della tolleranza.
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

    /// Via i rettangoli troppo piccoli. La soglia arriva da refineRects ed e' un quarto della
    /// base per lato: sotto quella misura non ci sta una foto utile.
    removeRectsToSmall(rects, widthMin, heightMin) {
        const tolerance = 0.0001;
        return rects.filter(r =>
            r.width > widthMin - tolerance &&
            r.height > heightMin - tolerance
        );
    },

    /// Toglie i candidati interamente contenuti in un altro: non sono sbagliati, sono sottoaree
    /// di uno piu' grande. Disattivandola si ottengono piu' aree fra cui scegliere.
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
};

module.exports = spazioLibero;
