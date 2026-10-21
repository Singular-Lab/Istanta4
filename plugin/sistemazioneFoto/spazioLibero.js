/// I20-1009: i rettangoli liberi di un box, dato dove stanno gli ostacoli.
///
/// E' il calcolo dietro getSpazioImpaginazione di sistemazioneFoto: per ogni ostacolo lo
/// spazio sopra, sotto, a sinistra e a destra (generateCandidateRects), poi da quei candidati
/// si tolgono gli ostacoli uno alla volta, tenendo i rettangoli liberi piu' grandi (refineRects).
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

    /// Il cuore del gruppo: toglie dai candidati gli ostacoli, uno alla volta. Ogni candidato
    /// che un ostacolo attraversa lascia il posto ai pezzi che restano liberi attorno a lui
    /// (intersectRect); dopo ogni ostacolo si tolgono i doppioni e i rettangoli contenuti in un
    /// altro. Alla fine si scartano i candidati piu' piccoli di un quarto della base per lato.
    ///
    /// I20-1060: prima ogni candidato si spezzava su tutti gli ostacoli insieme, e i pezzi ai
    /// lati di un ostacolo erano alti solo quanto lui: lo spazio a destra di un ostacolo
    /// piccolo in un angolo, alto quanto la base, non nasceva mai. Ora i pezzi sono i
    /// rettangoli liberi piu' grandi, e un ostacolo alla volta con la potatura ne restano pochi:
    /// sul box Edro21 della issue, 12 ostacoli, da circa 900 rettangoli a meno di 100.
    ///
    /// Il calcolo fa un giro per ostacolo e finisce sempre. La guardia sta sul numero di
    /// rettangoli: se dopo un ostacolo ne restano piu' di limiteRettangoli il calcolo si ferma
    /// li', esito.interrotto lo dice e getSpazioImpaginazione lo fa sapere. Con i box
    /// reali non succede: 50 ostacoli a caso ne lasciano meno di 500.
    ///
    /// esito, se passato, si riempie con { iterazioni, rettangoli, ostacoli, interrotto }:
    /// iterazioni sono gli ostacoli tolti, rettangoli il massimo dei pezzi in un giro.
    refineRects(obstacles, contours, boxWidth, boxHeight, tolerance = 0, esito = null) {
        let currentRects = this.reduceResult(this.removeDuplicateRects([...contours]));
        let rettangoliAlPicco = currentRects.length;
        let iterazioni = 0;
        let interrotto = false;

        for (const obs of obstacles) {
            const newRects = [];
            for (const rect of currentRects) {
                for (const r of this.intersectRect(rect, obs, tolerance)) {
                    newRects.push(r);
                }
            }
            rettangoliAlPicco = Math.max(rettangoliAlPicco, newRects.length);
            currentRects = this.reduceResult(this.removeDuplicateRects(newRects));
            iterazioni++;

            if (currentRects.length > this.limiteRettangoli) {
                interrotto = true;
                break;
            }
        }

        if (esito != null) {
            esito.iterazioni = iterazioni;
            esito.rettangoli = rettangoliAlPicco;
            esito.ostacoli = obstacles.length;
            esito.interrotto = interrotto;
        }

        return this.removeRectsToSmall(currentRects, boxWidth / 4, boxHeight / 4); // rimuove rettangoli troppo piccoli
    },

    /// La guardia di refineRects: oltre questi rettangoli il calcolo si ferma.
    limiteRettangoli: 20000,

    /// Cosa resta libero di un rettangolo tolto di mezzo un ostacolo: fino a quattro pezzi,
    /// sopra, sotto, a sinistra e a destra dell'ostacolo. I20-1060: ognuno e' il rettangolo
    /// libero piu' grande da quel lato, quindi i pezzi si sovrappongono: quelli laterali sono
    /// alti quanto il rettangolo, non piu' quanto la sola fascia dell'ostacolo. Se l'ostacolo
    /// non lo tocca, il rettangolo resta com'e'.
    intersectRect(rect, obs, tolerance = 0.0001) {
        // Coordinate di intersezione
        const interX1 = Math.max(rect.x, obs.x);
        const interY1 = Math.max(rect.y, obs.y);
        const interX2 = Math.min(rect.x + rect.width, obs.x + obs.width);
        const interY2 = Math.min(rect.y + rect.height, obs.y + obs.height);

        // Se non c'è intersezione, il rettangolo rimane com'è
        if (interX2 <= interX1 + tolerance || interY2 <= interY1 + tolerance) {
            return [rect];
        }

        const results = [];
        const newRefs = [...(rect.obstacleRefs || []), obs];

        // Sopra l'ostacolo
        if (interY1 > rect.y) {
            results.push({ x: rect.x, y: rect.y, width: rect.width, height: interY1 - rect.y, direction: rect.direction, obstacleRefs: newRefs });
        }

        // Sotto l'ostacolo
        if (interY2 < rect.y + rect.height) {
            results.push({ x: rect.x, y: interY2, width: rect.width, height: (rect.y + rect.height) - interY2, direction: rect.direction, obstacleRefs: newRefs });
        }

        // A sinistra dell'ostacolo
        if (interX1 > rect.x) {
            results.push({ x: rect.x, y: rect.y, width: interX1 - rect.x, height: rect.height, direction: rect.direction, obstacleRefs: newRefs });
        }

        // A destra dell'ostacolo
        if (interX2 < rect.x + rect.width) {
            results.push({ x: interX2, y: rect.y, width: (rect.x + rect.width) - interX2, height: rect.height, direction: rect.direction, obstacleRefs: newRefs });
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
    /// di uno piu' grande. I20-1060: si confronta ognuno con tutti gli altri, non solo con quelli
    /// che lo precedono, e restano nell'ordine in cui sono arrivati. Fra due uguali resta il
    /// primo, ma removeDuplicateRects li ha gia' tolti.
    reduceResult(res) {
        const tolleranza = 0.0001;
        const contiene = function (esterno, interno) {
            return interno.x >= esterno.x - tolleranza &&
                interno.y >= esterno.y - tolleranza &&
                interno.x + interno.width <= esterno.x + esterno.width + tolleranza &&
                interno.y + interno.height <= esterno.y + esterno.height + tolleranza;
        };
        return res.filter((r, i) => !res.some((altro, j) => j !== i && contiene(altro, r) && (!contiene(r, altro) || j < i)));
    },
};

module.exports = spazioLibero;
