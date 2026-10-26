/// I20-985: la miniatura che il browser non sa disegnare da solo.
///
/// Un psd il browser non lo apre, ma Photoshop ci scrive dentro una miniatura in jpeg fra le
/// risorse immagine del file. Qui si va a prenderla, cosi' chi sta per archiviare una foto vede
/// cosa sta archiviando invece di un riquadro vuoto. E' la stessa lettura gia' usata dal Plugin
/// in I20-980, portata sul web: la si tiene separata perche' non dipende ne' dalla pagina ne'
/// dal Plugin, e cosi' si puo' provare da sola.
class AnteprimaPsd {

    /// I byte della miniatura jpeg dentro al psd, oppure niente se non c'e' o il file non si
    /// capisce. Si legge senza fidarsi: un file corrotto non deve far cadere la pagina.
    static miniaturaJpeg(byte) {
        try {
            var dati = byte instanceof Uint8Array ? byte : new Uint8Array(byte);

            //Firma 8BPS: se manca, non e' un psd e non si prosegue a tentoni.
            if (dati.length < 30 || dati[0] !== 0x38 || dati[1] !== 0x42 || dati[2] !== 0x50 || dati[3] !== 0x53) {
                return null;
            }

            var leggi32 = function (posizione) {
                return (dati[posizione] * 16777216) + (dati[posizione + 1] * 65536) +
                    (dati[posizione + 2] * 256) + dati[posizione + 3];
            };
            var leggi16 = function (posizione) {
                return (dati[posizione] * 256) + dati[posizione + 1];
            };

            //Intestazione fissa, poi il blocco dei colori, poi le risorse immagine.
            var posizione = 26;
            posizione += 4 + leggi32(posizione);

            var fineRisorse = posizione + 4 + leggi32(posizione);
            posizione += 4;

            while (posizione + 12 <= fineRisorse && posizione + 12 <= dati.length) {
                //8BIM apre ogni risorsa: fuori sincrono ci si ferma invece di indovinare.
                if (dati[posizione] !== 0x38 || dati[posizione + 1] !== 0x42 ||
                    dati[posizione + 2] !== 0x49 || dati[posizione + 3] !== 0x4D) {
                    return null;
                }

                var identificativo = leggi16(posizione + 4);

                var posizioneNome = posizione + 6;
                var saltoNome = 1 + dati[posizioneNome];
                if (saltoNome % 2 !== 0) {
                    saltoNome++;
                }

                var posizioneDimensione = posizioneNome + saltoNome;
                var dimensione = leggi32(posizioneDimensione);
                var posizioneDati = posizioneDimensione + 4;

                //1036 e' la miniatura in jpeg. La 1033 ha gli stessi dati ma col rosso e il blu
                //scambiati, quindi si lascia stare. I primi 28 byte descrivono la miniatura.
                if (identificativo === 1036) {
                    if (dimensione <= 28 || posizioneDati + dimensione > dati.length) {
                        return null;
                    }
                    return dati.slice(posizioneDati + 28, posizioneDati + dimensione);
                }

                posizione = posizioneDati + dimensione + (dimensione % 2);
            }

            return null;
        }
        catch (e) {
            return null;
        }
    }

    /// I byte come indirizzo data, che e' l'unico modo di mostrarli: la policy della pagina
    /// ammette self, Olimpo e data, quindi un indirizzo blob verrebbe rifiutato dal browser.
    static indirizzoMiniatura(byte) {
        var miniatura = AnteprimaPsd.miniaturaJpeg(byte);
        if (miniatura == null || miniatura.length === 0) {
            return null;
        }

        var testo = AnteprimaPsd.base64Di(miniatura);
        return testo == null ? null : "data:image/jpeg;base64," + testo;
    }

    /// I byte in base64. Si procede a blocchi perche' passare un array intero come argomenti
    /// di una chiamata sola, su una miniatura grande, supera il limite e solleva un errore.
    static base64Di(byte) {
        try {
            var dati = byte instanceof Uint8Array ? byte : new Uint8Array(byte);
            var pezzi = [];
            var quanti = 8192;

            for (var inizio = 0; inizio < dati.length; inizio += quanti) {
                pezzi.push(String.fromCharCode.apply(null, dati.subarray(inizio, inizio + quanti)));
            }

            return btoa(pezzi.join(""));
        }
        catch (e) {
            return null;
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = AnteprimaPsd;
}
