const { core } = require('indesign');
const path = require('path');
//const uxp = require('uxp');
//const CryptoJS = require('crypto-js');
const fs = uxp.storage.localFileSystem;

/// I20-1002: lo scaricamento delle immagini dal server nella cartella Links di InDesign.
///
/// I20-1015: si chiamava scaricamentoFoto.js, un nome che non diceva cosa fa. Ora e' reperimentoFoto/
/// scaricamento.js, parte del concetto "procurarsi la foto giusta", e chi lo usa lo chiama
/// scaricamentoFoto: indexNew.js lo dichiara come globale, e lo usano schedaFoto e
/// ReperimentoFoto. La rinomina in scaricaImmagini.js proposta in I20-1002 e' assorbita qui.
///
/// Il lavoro vero e' non riscaricare quello che c'e' gia': si calcola l'md5 dei file presenti e
/// lo si confronta con quelli richiesti.
const scaricamentoFoto = {

    //I20-967: sotto questa soglia i file gia' presenti si cercano per nome invece di elencare
    //l'intera cartella di destinazione.
    SOGLIA_LETTURA_MIRATA: 25,

    /// Scarica nella cartella Links le immagini che non ci sono gia'.
    /// Lo chiamano indexNew, per il cambio foto della scheda e per la sincronizzazione massiva.
    async downloadImages(listImagesRequired, objProcess, cartella, idOperazione)
    {
        const folder = cartella;
    
        if (!folder) {
            console.log("Selezione della cartella annullata dall'utente.");
            return;
        }
    
    
        //I20-967: i nomi richiesti in una mappa, cosi' la cartella si scorre una volta sola
        //e senza una ricerca lineare per ogni file presente.
        const nomiRichiesti = new Map();
        for (const richiesta of listImagesRequired) {
            if (richiesta != null && richiesta.fileName != null) {
                nomiRichiesti.set(richiesta.fileName, richiesta);
            }
        }

        let md5GIaScaricati= [];
        if (objProcess != null && objProcess.onProgress != null) {
            await objProcess.onProgress(0, "Calcolo Md5 già scaricati");
        }
        var count = 0;
        console.log("------------------------------- INIZIO CALCOLO MD5 -------------------------------");

        //I20-967: per poche foto (tipicamente una sola, dal cambio foto della scheda ref) chiediamo
        //i file per nome: elencare una cartella Links con migliaia di immagini costerebbe molto di piu'.
        let entriesDaControllare = null;
        if (nomiRichiesti.size > 0 && nomiRichiesti.size <= scaricamentoFoto.SOGLIA_LETTURA_MIRATA && typeof folder.getEntry === "function") {
            entriesDaControllare = [];
            for (const nomeRichiesto of nomiRichiesti.keys()) {
                try {
                    const entry = await folder.getEntry(nomeRichiesto);
                    if (entry != null && entry.isFile) {
                        entriesDaControllare.push(entry);
                    }
                }
                catch (err) {
                    //Il file non c'è: va scaricato, non è un errore.
                }
            }
        }

        if (entriesDaControllare == null) {
            const entries = await folder.getEntries(); // Ottieni le voci (file e cartelle) nella cartella
            entriesDaControllare = [];
            for (const entry of entries) {
                if (entry.isFile && nomiRichiesti.has(entry.name)) {
                    entriesDaControllare.push(entry);
                }
            }
        }

        var countTotal = entriesDaControllare.length;

        if (objProcess != null && objProcess.onTotalCount != null) {
            await objProcess.onTotalCount(countTotal);
        }

        for (const entry of entriesDaControllare) {
            if(abortedSyncFoto.includes(idOperazione)){
                objProcess.onAbort("Operazione annullata dall'utente");
                return;
            }

            const data = await entry.read({ format: uxp.storage.formats.binary });
            const byteArray = new Uint8Array(data);
            md5GIaScaricati.push(scaricamentoFoto.md5ArrayBuffer(byteArray));

            count++;

            console.log(`File: ${entry.name}`);
            console.log(count);

            if (objProcess != null && objProcess.onProgress != null) {
                objProcess.onProgress(count, "Calcolo Md5 già scaricati");
            }
        }
        console.log("------------------------------- FINE CALCOLO MD5 -------------------------------");
    
        
    
        let idsObj = [];
        for (var i=0; i<listImagesRequired.length; i++)
        {
            let item = listImagesRequired[i];
            idsObj.push({
                "id": item.id,
                "filename": item.fileName,
                "size": item.size,
                "md5": item.fileHash
            });
        }
        var fileNames = [];
        let limit=15000000;
        if (objProcess != null && objProcess.onTotalCount != null) {
            await objProcess.onTotalCount(idsObj.length);
        }
    
        for (var $va=0; $va<idsObj.length; $va++)
        {
            if(abortedSyncFoto.includes(idOperazione)){
                objProcess.onAbort("Operazione annullata dall'utente");
                return;
            }

            if (objProcess != null && objProcess.onProgress != null) {
                objProcess.onProgress($va + 1, "Download foto");
            }
    
            let item=idsObj[$va];
            fileNames.push(item.filename);
            if (md5GIaScaricati.includes(item.md5))
            {
                console.log("File già scaricato: " + item.filename);
                count++;
                continue;
            }
    
            let size = item.size;
            
    
            let chunks = [0];
            if (item.size>limit)
            {
                //console.log("Multiplo chunks");
                //console.log(item.size+">"+limit);
    
                chunks = [];
                //Devo fare multiplo chunks
                let sizeChucked = size/limit;
                //console.log("Size Chunked: " + sizeChucked);
    
                let cChunks=0;
                if (sizeChucked>1)
                {
                    cChunksRest = size%limit;
                    //console.log("cChunk step 1: " + parseInt(sizeChucked));
                    cChunks = parseInt(sizeChucked);
    
                    //console.log(size + " - " +  (cChunks*limit) + " -> " +(size - cChunks*limit>0));
                    if (size - cChunks*limit>0)
                    {
                        cChunks++;
                    }
                }
    
                //console.log("Chunks: "+cChunks);
    
                for (var i=0; i<cChunks; i++)
                {
                    chunks.push(i*limit);
                }
            }
    
            const byteArrayTotal = new Uint8Array(size);
            let bytesChunks=[];
            console.log("------------"+ item.filename +" (" + size + ")-------------");
            
            for (var i=0; i<chunks.length; i++)
            {
                let s = limit;
                if (chunks[i]>0 || chunks.length>1)
                {
                    s = size - chunks[i];
                    if (s>limit)
                        s=limit;
                }
                else
                {
                    s=size;
                }
    
                try
                {
                    //let olimpoIp = testMode?"http://192.168.178.197:3100/olimpo/foto/":"http://85.215.121.166:81/olimpo/foto/";
                    let url = olimpoIp + 'getFotoStreamFromId?id='+item.id+'&start='+chunks[i]+'&end=' + (chunks[i]+s);
                    //console.log(url);
                    const response = await fetch(url);
                    //console.log("http://85.215.121.166/olimpo/getFotoStreamFromId?id="+item.id);
    
    
                    // // Converte la risposta in array di byte (buffer)
                    const arrayBuffer = await response.arrayBuffer();
                    console.log("CHUNCK: "+(i+1) + " di " + chunks.length);
                    console.log(arrayBuffer);
                    const byteArray = new Uint8Array(arrayBuffer);
                    
                    //console.log(byteArray);
                    
                    bytesChunks.push(byteArray);
                }
                catch (err)
                {
                    console.error('Errore durante il download del file:', err);
                }
                
            }
    
            //Scrivi i byte su disco usando UXP FileSystem
            try {
    
                console.log("Ricompongo il file...");
                //Ricmpongo il file
                for(var i=0; i<bytesChunks.length; i++)
                {
                    let start = chunks[i];
                    let end = start + bytesChunks[i].length;
                    //console.log("Start: "+start+" - End: "+end);
                    byteArrayTotal.set(bytesChunks[i], start);
                }
                // Apre una finestra di dialogo per scegliere il percorso del file
                const file = await folder.createFile(item.filename, { overwrite: true });
                console.log($va + " -> Salvo il file");
    
                await file.write(byteArrayTotal);
            } catch (err) {
                console.error('Errore durante il salvataggio del file:', err);
                if (objProcess != null && objProcess.onProgress != null) {
                    objProcess.onProgress($va, "Errore durante il salvataggio del file");
                    await scaricamentoFoto.delay(3000);
                }
            }
    
            if(objProcess != null && objProcess.onProgress != null)
            {
                await objProcess.onProgress($va+1, null);
            }
        }
    
        if(objProcess != null && objProcess.onComplete != null)
        {
            await objProcess.onComplete("Operazione completata");
        }
        
        // if (objProcess != null && objProcess.onProgress != null) {
        //     await objProcess.onProgress($va, "Operazione completata");
        // }
    },
    
    
    /// L'md5 di un file letto in memoria. Lo usano anche utility.js e schedaRef.js per sapere
    /// se una foto locale e' ancora quella del server.
    md5ArrayBuffer(arrayBuffer) {
        function rotateLeft(lValue, iShiftBits) {
            return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
        }
    
        function addUnsigned(lX, lY) {
            var lX4, lY4, lX8, lY8, lResult;
            lX8 = (lX & 0x80000000);
            lY8 = (lY & 0x80000000);
            lX4 = (lX & 0x40000000);
            lY4 = (lY & 0x40000000);
            lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
            if (lX4 & lY4) {
                return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
            }
            if (lX4 | lY4) {
                if (lResult & 0x40000000) {
                    return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                } else {
                    return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
                }
            } else {
                return (lResult ^ lX8 ^ lY8);
            }
        }
    
        function F(x, y, z) {
            return (x & y) | ((~x) & z);
        }
    
        function G(x, y, z) {
            return (x & z) | (y & (~z));
        }
    
        function H(x, y, z) {
            return (x ^ y ^ z);
        }
    
        function I(x, y, z) {
            return (y ^ (x | (~z)));
        }
    
        function FF(a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        }
    
        function GG(a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        }
    
        function HH(a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        }
    
        function II(a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        }
    
        function convertToWordArray(arrayBuffer) {
            var lWordCount;
            var lMessageLength = arrayBuffer.byteLength;
            var lNumberOfWords_temp1 = lMessageLength + 8;
            var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
            var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
            var lWordArray = new Array(lNumberOfWords - 1);
            var byteArray = new Uint8Array(arrayBuffer);
            var lBytePosition = 0;
            var lByteCount = 0;
            while (lByteCount < lMessageLength) {
                lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                lBytePosition = (lByteCount % 4) * 8;
                lWordArray[lWordCount] = (lWordArray[lWordCount] | (byteArray[lByteCount] << lBytePosition));
                lByteCount++;
            }
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
            lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
            lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
            return lWordArray;
        }
    
        function wordToHex(lValue) {
            var WordToHexValue = "",
                WordToHexValue_temp = "",
                lByte, lCount;
            for (lCount = 0; lCount <= 3; lCount++) {
                lByte = (lValue >>> (lCount * 8)) & 255;
                WordToHexValue_temp = "0" + lByte.toString(16);
                WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
            }
            return WordToHexValue;
        }
    
        var x = convertToWordArray(arrayBuffer);
        var a = 0x67452301;
        var b = 0xEFCDAB89;
        var c = 0x98BADCFE;
        var d = 0x10325476;
    
        for (var k = 0; k < x.length; k += 16) {
            var AA = a,
                BB = b,
                CC = c,
                DD = d;
            a = FF(a, b, c, d, x[k + 0], 7, 0xD76AA478);
            d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
            c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB);
            b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
            a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
            d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A);
            c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613);
            b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
            a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8);
            d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
            c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
            b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
            a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122);
            d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193);
            c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E);
            b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);
            a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562);
            d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340);
            c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51);
            b = GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
            a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D);
            d = GG(d, a, b, c, x[k + 10], 9, 0x02441453);
            c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
            b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
            a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
            d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6);
            c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
            b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
            a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
            d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
            c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9);
            b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
            a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
            d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681);
            c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
            b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
            a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
            d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
            c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
            b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
            a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
            d = HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
            c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
            b = HH(b, c, d, a, x[k + 6], 23, 0x04881D05);
            a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
            d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
            c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
            b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
            a = II(a, b, c, d, x[k + 0], 6, 0xF4292244);
            d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97);
            c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
            b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
            a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3);
            d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
            c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
            b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
            a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
            d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
            c = II(c, d, a, b, x[k + 6], 15, 0xA3014314);
            b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
            a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82);
            d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
            c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
            b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);
            a = addUnsigned(a, AA);
            b = addUnsigned(b, BB);
            c = addUnsigned(c, CC);
            d = addUnsigned(d, DD);
        }
    
        var md5Hash = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
        return md5Hash.toLowerCase();
    },
    
    /// Pausa, usata fra un tentativo di scaricamento e il successivo.
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = scaricamentoFoto;