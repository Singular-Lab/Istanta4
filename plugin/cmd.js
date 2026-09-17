const { core } = require('indesign');
const path = require('path');
//const uxp = require('uxp');
//const CryptoJS = require('crypto-js');
const fs = uxp.storage.localFileSystem;

const cmd = {

    //I20-967: sotto questa soglia i file gia' presenti si cercano per nome invece di elencare
    //l'intera cartella di destinazione.
    SOGLIA_LETTURA_MIRATA: 25,

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
        if (nomiRichiesti.size > 0 && nomiRichiesti.size <= cmd.SOGLIA_LETTURA_MIRATA && typeof folder.getEntry === "function") {
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
            md5GIaScaricati.push(cmd.md5ArrayBuffer(byteArray));

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
                    await cmd.delay(3000);
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
    
    async requestImages()
    {
    
    
        
        
        // console.log("Richiesta immagini");
    
        // var file = await fs.getFileForOpening();
        // if (file) {
        //     // Leggi il contenuto del file
        //     const data = await file.read({ format: uxp.storage.formats.binary });
        //     const byteArray = new Uint8Array(data);
        //     let hash=md5ArrayBuffer(byteArray);
    
        //     let url = 'http://85.215.121.166/olimpo/uploadFoto';
    
        //     var formData = new FormData();
        //     formData.append("file", byteArray);
        //     formData.append("hash", hash);
    
        //     try {
        //         // Esegui la richiesta POST per caricare la foto
        //         const response = await fetch(url, {
        //             method: 'POST',
        //             body: formData, // Passa i dati del form (compresi file)
        //             headers: {
        //                 // fetch si occupa automaticamente di gestire il Content-Type
        //             }
        //         });
        
        //         if (response.ok) {
        //             const data = await response.json(); // Se la risposta è JSON
        //             console.log('Success:', data);
        //         } else {
        //             const data = await response.json();
        //             console.error('Error:', data);
        //         }
        //     } catch (error){}
    
    
    
        //     return;
    
        // }
    
    
        const folder = await fs.getFolder();
    
        if (!folder) {
            console.log("Selezione della cartella annullata dall'utente.");
            return;
        }
    
        const entries = await folder.getEntries(); // Ottieni le voci (file e cartelle) nella cartella
    
        let md5GIaScaricati= [];
    
        for (const entry of entries) {
            if (entry.isFile) {
                console.log(`File: ${entry.name}`);
                const data = await entry.read({ format: uxp.storage.formats.binary });
                //console.log("File data (binary):", data);
                const byteArray = new Uint8Array(data);
                //console.log("MD5 Hash:", md5ArrayBuffer(byteArray));
                md5GIaScaricati.push(cmd.md5ArrayBuffer(byteArray));
    
                // Qui puoi elaborare ogni file come desideri
            } else if (entry.isFolder) {
                console.log(`Cartella: ${entry.name}`);
                // Puoi anche gestire eventuali sottocartelle se lo desideri
            }
        }
    
        console.log("MD5 già scaricati: ", md5GIaScaricati);
    
    
    
    
        //    let ids = ["3236d1a4-abac-413d-be13-35a8a4a44120", "ef838173-2615-4e6f-90d9-84aec1afd139", "f337cc09-5fcd-4f0c-8306-534aa6c38f0c"];
        let ids = [
            "b37d00a0-7298-4865-9781-93e93956edb3",
            "38fcb5ef-90d6-4ec5-8647-708eca59e9bc",
            "a4cb2433-fad8-4137-889e-57698c4e61d1",
            "671ac94d-608c-47cc-93cb-a7ad05ebc80f",
            "4b2bea90-53e6-455c-8c14-4d96741f1f36",
            "e4df2712-821f-4560-9757-e7ffeb175df5",
            "e25037da-d022-4e7c-b779-c4407e0b09a9",
            "657a8bb9-b12a-4394-ac1b-ae5c7cf5636d",
            "a6dd1446-8fa8-491a-b6a2-7e8a8886d9b6",
            "3f5c9d05-a2c0-4ef0-94df-655a14e6de6e",
            "74a1f683-beb6-439b-9e88-22a56d2df3ac",
            "a85d8f5c-62da-4c52-98b2-0597031a9288",
            "04341fce-5b0f-4acc-b21f-f173400b9a99",
            "cfe02f97-eca0-4488-9015-3681f2f97cb1",
            "1dcaacd9-cd32-4a49-9979-3dc4a62c5145",
            "e050a907-6e09-48b2-91f7-8efca7689dff",
            "e209500a-b534-4c9a-a846-13fe481d25b5",
            "f66cac72-f1b3-4743-9994-b419564599cd",
            "2d1a430e-267b-41a2-8aaf-5a136341a4c7",
            "90e5ab06-37a5-492a-8d54-682ca9b66a75",
            "4a10a7f5-96e9-4f2d-8754-a544318eb07b",
            "e75305d9-67e9-423c-a226-7b166da55248",
            "b5f3c1e3-fa5a-408d-b30b-b382e9425124",
            "c626998a-bef2-4341-9c31-91aa0b7f9898",
            "162f9675-2619-4c05-887d-01253354a5f1",
            "413b3e31-e5ba-4660-b735-053928035ffb",
            "87c82b85-f278-4a12-b1ea-1f92a438ae17",
            "5c58b2a1-3a23-4dba-a4fe-e841c0de80c0",
            "ca74b425-e04e-41d4-872a-e90319d65887",
            "7690d016-d14c-4c97-bd83-910e987dee12",
            "f10bcd14-b00d-40ef-ba13-15528b2ffc00",
            "2bff3828-d35b-4438-8e4d-34c0e9819678",
            "572b54fe-7257-4dda-afbc-8fb4f3ed8e32",
            "0d2f2af1-cb6d-4ea6-bba0-39c69c992149",
            "1cdb442c-a5ce-446e-bbf3-64c5317791fa",
            "4bf7c848-115d-407c-8fa1-93ad9c08867d",
            "e4c6a455-9876-44dd-a678-7a11d34bd645",
            "371bbfad-0827-4e0e-b7f1-1a8222923a37",
            "bbd896d5-0292-4fad-9180-7ebb386ed97b",
            "d2399f67-2894-46d1-979c-388987dfdb54",
            "9387a233-42e5-49fc-9624-c75b96e7f215",
            "148013fa-5199-4256-a04b-4097b9284689",
            "e7e61b68-57ec-4788-ba15-0cbb8f89f621",
            "fd1fd1a1-c0ca-48cf-9445-637f58b0d16d",
            "2a955166-ee37-4cb8-8949-25614a85cc3e",
            "35d851f6-994f-43eb-bed4-005d3528c9e9",
            "1f1e98e0-432e-4138-b5eb-23016f1cf59f",
            "30381d3d-4d1f-485e-a538-14fa9d411dee",
            "9b1d08be-d047-45d9-be64-67f0cc09b37f",
            "2151766a-c1cd-4b94-b264-e0a995baac4e",
            "6c9508de-6d92-459a-80e0-4a47ab1fd3be",
            "8a9a93cc-ad15-41f5-b40c-41af67326dc8",
            "a163a35e-7ce9-4beb-b912-09bdbef33c4e",
            "73875624-3579-4da0-b8fc-f02c9fc2f3ae",
            "c6a5cecd-d2a3-436f-87ba-da76ffc524ec",
            "e8c4224d-a9c3-4290-a7d3-520cc5935485",
            "dda61620-d331-4c33-b786-60b8dfdec458",
            "533e88bd-6281-46c4-b439-feab5382a78b",
            "ae1ea894-2ae1-4d75-a17b-5e3c13a66628",
            "55651860-cc58-4995-a917-c0cea9fe388e",
            "6db18c2c-a538-4cdc-98bf-1bf28fbadc0d",
            "c610c931-c40c-4d6d-91f8-ff962eee1e32",
            "f8ec815a-6da7-4d95-9f75-7039e9ab31c3",
            "e9609b2b-811d-4625-9900-f55c1091d8f3",
            "46936a04-a72d-4dd7-a207-97e827e52e68",
            "08d4353e-dbe4-492f-bca0-5fbc4451b3c9",
            "31be0675-f6a0-4db4-b149-bc06b25d7795",
            "43d702a4-3a5b-453b-9ecf-0735759f1fb7",
            "36c98464-1fe9-4ea4-8ff9-cd1f1cc54306",
            "9100de42-0823-4cf5-ad96-0d6253d3b72b",
            "d795a73f-5e56-4eaa-a888-fa0c9f9a0f44",
            "7ff87fca-bac7-495b-bce8-0cf15745ff4f",
            "c7bd2ee1-d33f-4037-a0f8-5fc074f324ae",
            "703d4c4b-7621-4bbb-bebe-b5dc0dd3771f",
            "8d83dff8-d461-4e93-9b75-72b6125ff4d3",
            "8dbe63f8-9678-4b28-ad23-5c4648138d78",
            "6436f344-f8d2-4e15-b3dc-685839906afb",
            "b0b010cd-5bbe-49d1-a58d-f0f78657e15d",
            "5dfc8563-f8b1-4a3e-a4c9-d8e6acf5e91b",
            "a8bd5b97-62ec-40f1-b7d2-1298c9a0d9a6",
            "1fa28421-2a1f-4981-b5f6-1c4ef77a7b3e",
            "7cb90cd8-680f-430f-b62e-b5c75bd1771e",
            "fcf76279-4e66-4f3b-ae19-0d98ec8a0457",
            "2cce41b0-89fc-4f00-b75a-a8290b6ad252",
            "3c7039e4-fb28-4a6d-84cc-68d5adbe0a55",
            "4dad3acf-9eac-433c-affd-d1143827a896",
            "40cf60cd-9353-4d6b-8566-f6fbce81fa5c",
            "d93c0dbc-b058-41d4-ae67-c2b9eef73484",
            "eb68c252-9adb-40b2-8b1c-865e819d91fb",
            "ba191b6c-6932-4fe8-aba7-91b35d924bde",
            "0c0f9520-9e11-4313-bf1d-9418d39724bd",
            "713716d3-b8ab-432c-9ccf-e0daa2e22104",
            "23741300-11f2-416d-8969-2338f4196b74",
            "23e48adf-068f-4cc5-affd-d0f308112be1",
            "3193905a-ce9b-43af-9d98-62928b0c1abb",
            "2ec207b9-49da-4e22-9876-68a67fb020a2",
            "b2187cad-811d-4a27-8b3a-ed51de0a2b72",
            "f5198b2d-47f9-4dc3-8ecd-6af346688f6f",
            "52c4e92d-6bc7-45b4-8249-088a5217308c",
            "9649b8d9-6716-4d28-ba78-065ae687fae5",
            "59a5e156-9937-41b3-ba7b-97f5ec69bb7f",
            "61313ae6-8a5e-4582-b6b2-2b432948c68e",
            "3e3348e3-dee5-49a4-beab-efd4bbb5c4b2",
            "359ab4b5-a073-410f-b590-f329fa4641c4",
            "6621fe95-96ad-45ca-83a5-7e8db06dd47a",
            "eda69481-e667-47a2-a783-2981b0d84aad",
            "4315bd2e-35aa-4421-ae4d-417d030c82e7",
            "ff242018-6fc3-4e1c-b888-2d7e559cec89",
            "0487d097-3bfc-4481-9276-009dcd390249",
            "41a4bdbc-68b4-4af0-b80b-d921eb2275f3",
            "a50fc811-2e80-4c99-842a-a456ffa74e97",
            "8883c202-82d8-4264-a00d-91058bd76e52",
            "792506d8-743d-468a-8a6d-7ab43ac2f8fa",
            "70ba2fdc-c6bc-42ef-bdf4-9dae2ef61b49",
            "4d992c6a-b466-40aa-bbe0-d30144903435",
            "37b68a8d-c7ef-4adf-a020-896a7c8b9436",
            "e2dad4a5-f331-454b-9fc5-e03913176fdf",
            "3c28e959-a3ef-45ac-9b95-df219357de5c",
            "7ff57190-31ec-4756-bfee-7d733f7736f5",
            "53d75e1c-bd42-409d-86df-936603cd63f4",
            "bcb96867-b251-4536-a8bf-d386808f7940",
            "575ca01a-9a80-4da2-a959-342a31dcf273",
            "c3e6d8d0-7c8a-4f3c-88ce-bd018d5dc00d",
            "79a79965-138f-442b-b287-a3a1cc4a5838",
            "8be17f79-544a-4efa-8b93-7413c2030099",
            "dd7c9ae9-9493-4b90-96c1-5b429d70260d",
            "5ba671cf-5781-46c5-ae30-3ffce2ff6a22",
            "63f94746-ec5c-44b9-8a6e-d0e4d0fafc57",
            "b2795d52-cc8c-4189-8404-5d70b3162567",
            "904cd04b-e0b8-4b2e-83b1-f09ea2162cfe",
            "18fc438b-50b4-40e6-86f8-5552b6a0573e",
            "a9651061-4bbd-4295-8213-d44dcb2c89b8",
            "d75d5b4e-277b-45b9-9f91-25a245b652d6",
            "588807c6-bd83-48aa-9315-552f0500274b",
            "f7d11800-4f82-49cf-af5a-f18eec55b525",
            "e45af2ab-e460-4787-b113-708564fbf963",
            "5beb8696-71ce-4d35-aba5-06c15a526355",
            "05bcbc6a-bfec-494f-bedf-a3194da00435",
            "f4c16dee-cdce-4425-821d-094cc91e2a80",
            "b4d35b36-0a96-4f07-9c8a-a15c330737ae",
            "8d246130-3b02-420c-9dd7-95a1e0b4a7bf",
            "56475d12-01e8-4c0e-88db-c9a0f8492bb3",
            "663fab59-2c4b-45aa-b36c-6aa1ee97c6f7"
        ];
    
        let idsObj = [
            {
                "id": "b37d00a0-7298-4865-9781-93e93956edb3",
                "filename": "ed3b48d5-9149-43c2-bb07-842021861baa.jpg",
                "size": 3810664,
                "md5": "eefed962bf93faa38fe6f9b19045633a"
            },
            {
                "id": "38fcb5ef-90d6-4ec5-8647-708eca59e9bc",
                "filename": "0a2f1671-3bde-4297-b9c5-673e5937c89b.psd",
                "size": 1180836,
                "md5": "e556bf2cac211e5c27668a9e86238228"
            },
            {
                "id": "a4cb2433-fad8-4137-889e-57698c4e61d1",
                "filename": "44a4ba03-29c2-46a5-a26a-27c599fe31fb.jpg",
                "size": 1615923,
                "md5": "a346fee3aa8a36f4f91fac7b60271d8d"
            },
            {
                "id": "671ac94d-608c-47cc-93cb-a7ad05ebc80f",
                "filename": "14cf1793-c349-4aa8-94fd-df813cf1961a.jpg",
                "size": 1426983,
                "md5": "907a5c7bd11b816f9817d0931c05d992"
            },
            {
                "id": "4b2bea90-53e6-455c-8c14-4d96741f1f36",
                "filename": "f34d34f7-5e27-45ec-adea-d82ffcfd46f3.jpg",
                "size": 1749984,
                "md5": "6cea81cf24b7d753a78a9943201e08b8"
            },
            {
                "id": "e4df2712-821f-4560-9757-e7ffeb175df5",
                "filename": "8b356821-3859-48ec-8921-1de65689f817.jpg",
                "size": 3938564,
                "md5": "1d97161247a56e1b9bafb03c7df2e46f"
            },
            {
                "id": "e25037da-d022-4e7c-b779-c4407e0b09a9",
                "filename": "7ddfe678-6f1f-451d-8706-07172503d4f7.jpg",
                "size": 1453860,
                "md5": "b097e6136fe084416878eb4264d7bc25"
            },
            {
                "id": "657a8bb9-b12a-4394-ac1b-ae5c7cf5636d",
                "filename": "f52cfa74-19e4-43d3-ae1f-1bfca6616e93.jpg",
                "size": 2983581,
                "md5": "933723ecda1e1c0cc833ce583215225c"
            },
            {
                "id": "a6dd1446-8fa8-491a-b6a2-7e8a8886d9b6",
                "filename": "c947c9d5-5af9-4eee-b075-dfecb49c8491.png",
                "size": 287985,
                "md5": "75147f8ff27c1d110641ec4262399594"
            },
            {
                "id": "3f5c9d05-a2c0-4ef0-94df-655a14e6de6e",
                "filename": "4eba451d-2b20-4354-9df5-091df5804a31.png",
                "size": 300148,
                "md5": "b16d584df50edc314219a86520025e84"
            },
            {
                "id": "74a1f683-beb6-439b-9e88-22a56d2df3ac",
                "filename": "6070fa45-412a-4f27-96d2-97a981251be2.jpg",
                "size": 1539282,
                "md5": "c5c0d9023f4181cfe34df34f09265fc4"
            },
            {
                "id": "a85d8f5c-62da-4c52-98b2-0597031a9288",
                "filename": "d99ef468-0ae0-4cd6-acbb-d53a9cd7661c.jpg",
                "size": 1236369,
                "md5": "93baa3dc6733ba80f0ca3b5799f48232"
            },
            {
                "id": "04341fce-5b0f-4acc-b21f-f173400b9a99",
                "filename": "498c4bab-61c9-4feb-8df8-d49f2e9f2ac2.eps",
                "size": 3650893,
                "md5": "d2747494bb3396e21669b7fc8681f71a"
            },
            {
                "id": "cfe02f97-eca0-4488-9015-3681f2f97cb1",
                "filename": "2a00a8ff-87cb-472a-95f9-b7ed7f99df02.jpg",
                "size": 1497581,
                "md5": "db877220e7de75d0cb93cae3e870a8be"
            },
            {
                "id": "1dcaacd9-cd32-4a49-9979-3dc4a62c5145",
                "filename": "7982512c-aa31-4ae4-84db-b7126b668a10.jpg",
                "size": 1058815,
                "md5": "3b1428d133bbf9f01fa38b150b5db1d0"
            },
            {
                "id": "e050a907-6e09-48b2-91f7-8efca7689dff",
                "filename": "6a9ab348-f101-459e-b233-94e0321d2620.jpg",
                "size": 1200149,
                "md5": "e6639fac3aa066417f656964499ec9a7"
            },
            {
                "id": "e209500a-b534-4c9a-a846-13fe481d25b5",
                "filename": "711c3b02-2939-48f8-85c8-b18515e6d7f6.jpg",
                "size": 1225921,
                "md5": "270a37329d999ceba6e86a40dc5da8b3"
            },
            {
                "id": "f66cac72-f1b3-4743-9994-b419564599cd",
                "filename": "6680b8e6-d7a3-46c5-ba48-052d1e4ec728.jpg",
                "size": 1032161,
                "md5": "1a564035b28cc99609fafd14e10c1620"
            },
            {
                "id": "2d1a430e-267b-41a2-8aaf-5a136341a4c7",
                "filename": "d0853649-1d25-46d5-9ea3-15eebdebe82c.jpg",
                "size": 984966,
                "md5": "3b4d35b7977893cc24a74e2b1da13a96"
            },
            {
                "id": "90e5ab06-37a5-492a-8d54-682ca9b66a75",
                "filename": "55dd248d-a88c-416c-bbb1-cb3eb2f6c935.jpg",
                "size": 1099944,
                "md5": "9a28aeaabf0afac32febae0b29e3aa67"
            },
            {
                "id": "4a10a7f5-96e9-4f2d-8754-a544318eb07b",
                "filename": "4b6c5997-3334-4dbf-99f5-e18815d9ea10.jpg",
                "size": 1478106,
                "md5": "812c0bdd774db5748aeb1e60cb1b1e80"
            },
            {
                "id": "e75305d9-67e9-423c-a226-7b166da55248",
                "filename": "341610fd-9d71-4ddc-8085-6558691c554c.jpg",
                "size": 831396,
                "md5": "09a14082c7d27ce18ad2cf6b75a9e9f6"
            },
            {
                "id": "b5f3c1e3-fa5a-408d-b30b-b382e9425124",
                "filename": "1f958a69-4651-4105-858d-455a0e347fa0.jpg",
                "size": 1369847,
                "md5": "4eb61418f9a255b341139d0de94b21e7"
            },
            {
                "id": "c626998a-bef2-4341-9c31-91aa0b7f9898",
                "filename": "174afb58-138e-4bd6-8be4-9c12d29c5a59.jpg",
                "size": 1521665,
                "md5": "1988717ef37a31f35761aa578ddd1297"
            },
            {
                "id": "162f9675-2619-4c05-887d-01253354a5f1",
                "filename": "2f13a65c-9302-4de6-9501-2e10a2f08753.jpg",
                "size": 1209967,
                "md5": "40ecb3960497e8faff8124ff989976c6"
            },
            {
                "id": "413b3e31-e5ba-4660-b735-053928035ffb",
                "filename": "824d7b47-c997-4b20-9b8d-53226bc8b96e.jpg",
                "size": 1368300,
                "md5": "3d3676ea35c1bd91a4c2d6153b84938c"
            },
            {
                "id": "87c82b85-f278-4a12-b1ea-1f92a438ae17",
                "filename": "ce4077d4-e1c7-4370-95f3-0179b4932e8a.jpg",
                "size": 1352768,
                "md5": "f41448eff7de34a4f8f68a86bd757768"
            },
            {
                "id": "5c58b2a1-3a23-4dba-a4fe-e841c0de80c0",
                "filename": "1333450c-32df-4034-b98b-2863fbd1986d.jpg",
                "size": 2078840,
                "md5": "340a07ee05fe7609dc69f30093fc50b0"
            },
            {
                "id": "ca74b425-e04e-41d4-872a-e90319d65887",
                "filename": "84f6dc27-9ea7-4285-aba1-c8f803998770.jpg",
                "size": 1166804,
                "md5": "b2237435cef53f44cc26887f9365c9d6"
            },
            {
                "id": "7690d016-d14c-4c97-bd83-910e987dee12",
                "filename": "bf645591-869a-45a5-9c87-a839eddce32b.jpg",
                "size": 2878126,
                "md5": "c25ffadbfffa9e20d0cd69c1a209f62f"
            },
            {
                "id": "f10bcd14-b00d-40ef-ba13-15528b2ffc00",
                "filename": "7bb5c287-a25f-431c-b3f4-267cde2f2325.jpg",
                "size": 648009,
                "md5": "703c4e90b32f30f53b7c374010cedd7b"
            },
            {
                "id": "2bff3828-d35b-4438-8e4d-34c0e9819678",
                "filename": "fabfacbb-2e8e-428d-b63b-b69b406188c3.jpg",
                "size": 3968508,
                "md5": "4b556d8d496f469dcfe685969e515e30"
            },
            {
                "id": "572b54fe-7257-4dda-afbc-8fb4f3ed8e32",
                "filename": "c31d93ab-67b0-4814-b4af-a23d704ef8fe.jpg",
                "size": 921745,
                "md5": "9c36d6a9f05f408d4708064664f4ffa2"
            },
            {
                "id": "0d2f2af1-cb6d-4ea6-bba0-39c69c992149",
                "filename": "013da635-555b-4d58-bfe7-f948f5825cd1.jpg",
                "size": 2052114,
                "md5": "9f415289c908929e8fb78d5e359087f1"
            },
            {
                "id": "1cdb442c-a5ce-446e-bbf3-64c5317791fa",
                "filename": "2dd35064-f8dc-4628-a89c-ee51e96645b9.jpg",
                "size": 1938705,
                "md5": "27e6492888d03393b62d05b3f7dda502"
            },
            {
                "id": "4bf7c848-115d-407c-8fa1-93ad9c08867d",
                "filename": "5b8b02ce-33ce-482d-bc1d-7b0ceb0472d9.jpg",
                "size": 1919044,
                "md5": "10ab4ab3b5013aa1c84c313a160c0573"
            },
            {
                "id": "e4c6a455-9876-44dd-a678-7a11d34bd645",
                "filename": "643d4b05-7f7f-4214-8460-6233981f41cc.jpg",
                "size": 1932977,
                "md5": "8f29925d186ecc290957d44a5dedfe2e"
            },
            {
                "id": "371bbfad-0827-4e0e-b7f1-1a8222923a37",
                "filename": "794209ed-5b8d-4c0f-8b35-1f4a4b90cb41.jpg",
                "size": 1904301,
                "md5": "7f00acab749b7ebe25789d66ed0e5ea6"
            },
            {
                "id": "bbd896d5-0292-4fad-9180-7ebb386ed97b",
                "filename": "9cfff5a9-17e4-4ba2-82f5-0038472de83d.jpg",
                "size": 2312473,
                "md5": "7ad2beb8e4518f0cd28726035f99f9ae"
            },
            {
                "id": "d2399f67-2894-46d1-979c-388987dfdb54",
                "filename": "a829ba26-e702-431e-84f2-b4d1ff99798d.jpg",
                "size": 3266634,
                "md5": "6908ae5c05a5e3f822683953ab4c13a7"
            },
            {
                "id": "9387a233-42e5-49fc-9624-c75b96e7f215",
                "filename": "9ef1a930-8b37-4b43-b50d-a253d7a3a121.jpg",
                "size": 2549473,
                "md5": "0c98cd8e6206ddb38330c3d6e18ab767"
            },
            {
                "id": "148013fa-5199-4256-a04b-4097b9284689",
                "filename": "155658e6-c6e6-4f56-925a-32475987a6e7.jpg",
                "size": 1468653,
                "md5": "163153b53f762ed4aa74a2ca225aa169"
            },
            {
                "id": "e7e61b68-57ec-4788-ba15-0cbb8f89f621",
                "filename": "6968f8e7-f88e-424d-8a80-d17cb5235f42.eps",
                "size": 5204025,
                "md5": "23abe872ed2a0d41acddb4873f60f5f5"
            },
            {
                "id": "fd1fd1a1-c0ca-48cf-9445-637f58b0d16d",
                "filename": "1a36d8a9-f896-42bb-ac5f-f5d1a136f6c9.png",
                "size": 1109815,
                "md5": "71ea9d494a8afd33dacab561d81824db"
            },
            {
                "id": "2a955166-ee37-4cb8-8949-25614a85cc3e",
                "filename": "e4dc27cd-4886-4a6a-834d-931cf0028e09.jpg",
                "size": 2120821,
                "md5": "5f3cb0c7cf48bf48e5576523fd69201c"
            },
            {
                "id": "35d851f6-994f-43eb-bed4-005d3528c9e9",
                "filename": "ab5b75ce-80ac-452a-8a0a-bf13689d11f8.jpg",
                "size": 1747079,
                "md5": "1ae4e3296ee2d49b1c33e8db2d3f8249"
            },
            {
                "id": "1f1e98e0-432e-4138-b5eb-23016f1cf59f",
                "filename": "7d59002b-5334-457b-9303-a7cf504c9581.jpg",
                "size": 1710556,
                "md5": "122b668bb54022483081ffb3d58dc056"
            },
            {
                "id": "30381d3d-4d1f-485e-a538-14fa9d411dee",
                "filename": "b9230692-944e-4246-ac6f-d0dda84ef38b.jpg",
                "size": 1124678,
                "md5": "5ec42e349f21cb4556322050dcc05743"
            },
            {
                "id": "9b1d08be-d047-45d9-be64-67f0cc09b37f",
                "filename": "b5d67dbf-c963-48c0-88e4-5918318943ac.jpg",
                "size": 1942618,
                "md5": "6198153c2f257d5ac8751b03efc7a400"
            },
            {
                "id": "2151766a-c1cd-4b94-b264-e0a995baac4e",
                "filename": "6d7750fe-c36f-4eff-ae31-017e0e3527d1.jpg",
                "size": 4062404,
                "md5": "f466bb0d002295258b190e4aa821b221"
            },
            {
                "id": "6c9508de-6d92-459a-80e0-4a47ab1fd3be",
                "filename": "e3022e51-4222-4d92-8f05-4a25880b9f3d.jpg",
                "size": 2082131,
                "md5": "bb29fc34ef77cff0a6d983f5b474c807"
            },
            {
                "id": "8a9a93cc-ad15-41f5-b40c-41af67326dc8",
                "filename": "cfea1ba5-edf2-49f7-8f07-5c1ee09bd054.eps",
                "size": 1780938,
                "md5": "5e61bfa3424b93ad13dbb1582e85adad"
            },
            {
                "id": "a163a35e-7ce9-4beb-b912-09bdbef33c4e",
                "filename": "7c141780-bb5e-48f2-b0b1-cf36ea33e958.png",
                "size": 380839,
                "md5": "11f9a7f40b6925af80ee85850b485b74"
            },
            {
                "id": "73875624-3579-4da0-b8fc-f02c9fc2f3ae",
                "filename": "cf8cbf3b-41f4-4182-a986-41e6983cd504.eps",
                "size": 1974226,
                "md5": "14c955f906e631c381ac32e3093ea8f2"
            },
            {
                "id": "c6a5cecd-d2a3-436f-87ba-da76ffc524ec",
                "filename": "729aa122-175e-4729-8a63-96fa2253d095.jpg",
                "size": 8401786,
                "md5": "6dcce86c0ffc4af31ccd1fb684626e66"
            },
            {
                "id": "e8c4224d-a9c3-4290-a7d3-520cc5935485",
                "filename": "046359cb-6474-4a67-8ab1-3f14488ef285.jpg",
                "size": 9262067,
                "md5": "f8ba499602f2607781197c34ce90d960"
            },
            {
                "id": "dda61620-d331-4c33-b786-60b8dfdec458",
                "filename": "f5bb78df-dfdb-4944-a075-bad8132b71a1.png",
                "size": 3161523,
                "md5": "028f955d8bf8da7ba8950ae2a8b3311e"
            },
            {
                "id": "533e88bd-6281-46c4-b439-feab5382a78b",
                "filename": "42e02e39-8757-41e0-9acc-1d6f603d801c.eps",
                "size": 2623321,
                "md5": "d9fb82975343d189e5d6402d8094cd63"
            },
            {
                "id": "ae1ea894-2ae1-4d75-a17b-5e3c13a66628",
                "filename": "33f0b5b3-710a-44d2-97f5-b63741dd743f.jpg",
                "size": 1124716,
                "md5": "bfca36f2c529da63ce61fcf4bbc1270b"
            },
            {
                "id": "55651860-cc58-4995-a917-c0cea9fe388e",
                "filename": "c8028655-bdce-4b4a-bf49-298fe4ec12be.psd",
                "size": 25898891,
                "md5": "a18d80fdce2bf6169b51945f46bb4d48"
            },
            {
                "id": "6db18c2c-a538-4cdc-98bf-1bf28fbadc0d",
                "filename": "00eafba1-3511-40d0-b713-88c71dac7d76.eps",
                "size": 1926809,
                "md5": "3ff0ed2dc06a2294ba68d43d6ce53e16"
            },
            {
                "id": "c610c931-c40c-4d6d-91f8-ff962eee1e32",
                "filename": "cc839e2d-bb61-4a76-8df0-9f138466aba6.jpg",
                "size": 941009,
                "md5": "83f409ce754dd28688543bbdc4471390"
            },
            {
                "id": "f8ec815a-6da7-4d95-9f75-7039e9ab31c3",
                "filename": "df871cf2-f435-4633-a76a-cc5d2985510c.eps",
                "size": 1923613,
                "md5": "e6abbe6eecea3ff2b29edcf5c956b297"
            },
            {
                "id": "e9609b2b-811d-4625-9900-f55c1091d8f3",
                "filename": "08a127fd-3101-41b8-9243-d33dbdb5d443.psd",
                "size": 46603221,
                "md5": "46c2e440cf9262f7ada156ca00accce3"
            },
            {
                "id": "46936a04-a72d-4dd7-a207-97e827e52e68",
                "filename": "9dbfdc2a-6645-4c70-8d3f-71da20e46799.eps",
                "size": 4101259,
                "md5": "c33bb0b1b55723a5c29ae2f8a35c105c"
            },
            {
                "id": "08d4353e-dbe4-492f-bca0-5fbc4451b3c9",
                "filename": "5f466224-69f6-445b-b940-c6ed3aff009d.jpg",
                "size": 655114,
                "md5": "ec9431f03af6b4c5aa253a21002c9e91"
            },
            {
                "id": "31be0675-f6a0-4db4-b149-bc06b25d7795",
                "filename": "01081539-7b9a-4604-ab04-d05f4731f661.jpg",
                "size": 2767651,
                "md5": "d8587ee11f3b395eac25a44788599a98"
            },
            {
                "id": "43d702a4-3a5b-453b-9ecf-0735759f1fb7",
                "filename": "04b281e3-078c-4258-ac36-2c743fb92bbf.eps",
                "size": 2039262,
                "md5": "10cbcfc00fb05cf0c4739a77ce04cb50"
            },
            {
                "id": "36c98464-1fe9-4ea4-8ff9-cd1f1cc54306",
                "filename": "53ab4c5a-0b33-4496-9ce0-6f99678c8fa3.psd",
                "size": 240193001,
                "md5": "b4e432f37d3a5e9b3c476adf7e181732"
            },
            {
                "id": "9100de42-0823-4cf5-ad96-0d6253d3b72b",
                "filename": "990888a0-6dbe-4234-94ed-96da5edaf54c.psd",
                "size": 251812443,
                "md5": "836f4b533710ff08f2a48c1daa141d74"
            },
            {
                "id": "d795a73f-5e56-4eaa-a888-fa0c9f9a0f44",
                "filename": "946f27b8-2617-4931-b0c4-89e5934cf1c2.jpg",
                "size": 1154192,
                "md5": "e3a6a168d3611bc4d4201e4218b5f6e8"
            },
            {
                "id": "7ff87fca-bac7-495b-bce8-0cf15745ff4f",
                "filename": "972a80bb-437c-44f2-80b0-aa7a897aefb5.eps",
                "size": 3267435,
                "md5": "2bcaa1a29a2f256cd4a45cfed0fc0a75"
            },
            {
                "id": "c7bd2ee1-d33f-4037-a0f8-5fc074f324ae",
                "filename": "e5459a8b-3111-41c4-898f-4be099dd85a9.eps",
                "size": 4479660,
                "md5": "6852101bf0f8e764068c871f9f14c047"
            },
            {
                "id": "703d4c4b-7621-4bbb-bebe-b5dc0dd3771f",
                "filename": "07206cdd-1c7d-4173-a128-8272ee7c445f.eps",
                "size": 3482821,
                "md5": "535d2959656715eca01d9514f165f878"
            },
            {
                "id": "8d83dff8-d461-4e93-9b75-72b6125ff4d3",
                "filename": "9926bf41-708f-46c9-bdd6-15f6c59ec0d8.jpg",
                "size": 684490,
                "md5": "1c135b955d12d7f5b606796d103aa9c2"
            },
            {
                "id": "8dbe63f8-9678-4b28-ad23-5c4648138d78",
                "filename": "32065013-6864-40d3-8272-5adee3e0a2b4.jpg",
                "size": 692239,
                "md5": "0cf605429e81c963115d2694099ccb28"
            },
            {
                "id": "6436f344-f8d2-4e15-b3dc-685839906afb",
                "filename": "d303055e-d441-4fa9-8e9a-23fc82bf4c80.psd",
                "size": 7944207,
                "md5": "4284e4aa0438bc09b67cc481ca46a29c"
            },
            {
                "id": "b0b010cd-5bbe-49d1-a58d-f0f78657e15d",
                "filename": "35d51cbb-871a-4c83-b7ac-588bdf4e3a68.jpg",
                "size": 2971017,
                "md5": "e0880925c0c6586e20d155747c74d723"
            },
            {
                "id": "5dfc8563-f8b1-4a3e-a4c9-d8e6acf5e91b",
                "filename": "e70fa5b6-265f-4ca1-8c40-cd28db4d006e.jpg",
                "size": 605685,
                "md5": "8e47cfc60d1695bfddfe87ab40c4db84"
            },
            {
                "id": "a8bd5b97-62ec-40f1-b7d2-1298c9a0d9a6",
                "filename": "12f69f14-1d64-4d88-b337-213a3674ce55.jpg",
                "size": 753020,
                "md5": "d4357c0df5eef43bee73a8ff6d29e8d5"
            },
            {
                "id": "1fa28421-2a1f-4981-b5f6-1c4ef77a7b3e",
                "filename": "7293b4ea-5bd2-4743-92f1-163d626f9d46.jpg",
                "size": 632331,
                "md5": "6b774798f8e175a554a19059987439d6"
            },
            {
                "id": "7cb90cd8-680f-430f-b62e-b5c75bd1771e",
                "filename": "624599bb-62c8-493c-9629-e0bf917f9514.jpg",
                "size": 2449902,
                "md5": "a535c37331c969b80b07b2bb419d978a"
            },
            {
                "id": "fcf76279-4e66-4f3b-ae19-0d98ec8a0457",
                "filename": "5f125764-625a-4579-9436-4396c044a70c.jpg",
                "size": 2775249,
                "md5": "e5856aecfb8f18fd28aacac70e062225"
            },
            {
                "id": "2cce41b0-89fc-4f00-b75a-a8290b6ad252",
                "filename": "f31da74b-e1e6-46d4-87ae-99323cf3695e.jpg",
                "size": 1263569,
                "md5": "e614b21e92b9e04db4cb65f4ed137fbe"
            },
            {
                "id": "3c7039e4-fb28-4a6d-84cc-68d5adbe0a55",
                "filename": "fccc9562-95c2-404b-8b5c-3b667ba1b0f3.jpg",
                "size": 616656,
                "md5": "c24c59e735e5111a1ac6524e71777b1a"
            },
            {
                "id": "4dad3acf-9eac-433c-affd-d1143827a896",
                "filename": "810fcdae-f62f-45bf-ae97-337d22433049.jpg",
                "size": 190621,
                "md5": "50ccd9bf327d859c30583649b1f74363"
            },
            {
                "id": "40cf60cd-9353-4d6b-8566-f6fbce81fa5c",
                "filename": "a441c6b7-d86d-4caf-b6a9-869673e3cdbd.jpg",
                "size": 2818120,
                "md5": "c693b3d50c11f4d3e50de6962779fff0"
            },
            {
                "id": "d93c0dbc-b058-41d4-ae67-c2b9eef73484",
                "filename": "3636795d-8468-4ffd-9422-b93a59eea477.jpg",
                "size": 1370781,
                "md5": "dfa45be9a678c5bd99565caf6d6bca2f"
            },
            {
                "id": "eb68c252-9adb-40b2-8b1c-865e819d91fb",
                "filename": "55657bc0-00a6-43ee-a4c9-1a906d7e657a.jpg",
                "size": 1109513,
                "md5": "ce97844eb0cbf259722a808c05243506"
            },
            {
                "id": "ba191b6c-6932-4fe8-aba7-91b35d924bde",
                "filename": "2dc7d61b-f153-48c5-92e5-f4fc5f3d7859.jpg",
                "size": 2302588,
                "md5": "a6ed0e69b6111d1ea72283383cffe3c2"
            },
            {
                "id": "0c0f9520-9e11-4313-bf1d-9418d39724bd",
                "filename": "93459b98-5328-4ab4-88f3-ed5f9daf2821.jpg",
                "size": 3165539,
                "md5": "223837c0adfb69227223f24c458a7332"
            },
            {
                "id": "713716d3-b8ab-432c-9ccf-e0daa2e22104",
                "filename": "3b4154c0-1497-417a-9d03-5f8799817836.jpg",
                "size": 909225,
                "md5": "373a6a6c3302f9461a664d590bd730e2"
            },
            {
                "id": "23741300-11f2-416d-8969-2338f4196b74",
                "filename": "ec07f014-3203-4b42-a754-add7c71db48a.jpg",
                "size": 653456,
                "md5": "2f394bb51736aa841d9d72bd8854cef6"
            },
            {
                "id": "23e48adf-068f-4cc5-affd-d0f308112be1",
                "filename": "ffc71649-023d-4552-9482-2d80503714e8.jpg",
                "size": 543109,
                "md5": "8deac92b36c91c70d7caee35e7bf6800"
            },
            {
                "id": "3193905a-ce9b-43af-9d98-62928b0c1abb",
                "filename": "d9c71ea8-e1fa-4759-a30e-3a8b1105fa79.jpg",
                "size": 1863958,
                "md5": "dd3da6b7e333b2d0bca13d5985fa442b"
            },
            {
                "id": "2ec207b9-49da-4e22-9876-68a67fb020a2",
                "filename": "fb63c594-5346-4e91-9bf2-a9936e5f687c.jpg",
                "size": 3397240,
                "md5": "c4c868db769daca847fbd561083fb224"
            },
            {
                "id": "b2187cad-811d-4a27-8b3a-ed51de0a2b72",
                "filename": "c42ec07f-8b06-49a0-8558-b3be5beba3d1.jpg",
                "size": 2059026,
                "md5": "034e2edd62a413c1a49d8a6be4297076"
            },
            {
                "id": "f5198b2d-47f9-4dc3-8ecd-6af346688f6f",
                "filename": "9c7a6677-9366-4128-9913-c4c6799a2634.jpg",
                "size": 2014315,
                "md5": "8bfec81a6bb036f34912cd4f2220b6ca"
            },
            {
                "id": "52c4e92d-6bc7-45b4-8249-088a5217308c",
                "filename": "e0d48845-b3ea-4945-a0cd-85dd33674b8e.jpg",
                "size": 3031095,
                "md5": "2eaf00b38c5c70284f30cbef65591ed9"
            },
            {
                "id": "9649b8d9-6716-4d28-ba78-065ae687fae5",
                "filename": "62862500-24d3-4372-9c13-991db415b131.jpg",
                "size": 2938698,
                "md5": "87ad8c1633f96498889dc179ec23c516"
            },
            {
                "id": "59a5e156-9937-41b3-ba7b-97f5ec69bb7f",
                "filename": "7679496e-4b71-48b7-91db-2e26da02e340.jpg",
                "size": 1356028,
                "md5": "7fe60a15f7b30a65551c56357b584b7e"
            },
            {
                "id": "61313ae6-8a5e-4582-b6b2-2b432948c68e",
                "filename": "3cff0f3a-bf14-4d39-a0f8-42472057b8aa.jpg",
                "size": 1524489,
                "md5": "2ff6563cd27c6884bef3b62cc7b84185"
            },
            {
                "id": "3e3348e3-dee5-49a4-beab-efd4bbb5c4b2",
                "filename": "7743462c-fea6-4ac8-aa06-17c2e1101b07.jpg",
                "size": 1908527,
                "md5": "b54194c607e78591f8921dc792ac1ed4"
            },
            {
                "id": "359ab4b5-a073-410f-b590-f329fa4641c4",
                "filename": "7c478371-b0cd-4a43-a1dd-f1cc92687828.jpg",
                "size": 2571576,
                "md5": "56c9315f1531c8b6d66bbbfd60ff694f"
            },
            {
                "id": "6621fe95-96ad-45ca-83a5-7e8db06dd47a",
                "filename": "f3b73cfa-a113-4196-b44f-ceae607512b1.jpg",
                "size": 1943200,
                "md5": "325a6b0f01291be38eb608db2602522d"
            },
            {
                "id": "eda69481-e667-47a2-a783-2981b0d84aad",
                "filename": "6601c2c9-0fe3-45ab-803d-661b94586445.jpg",
                "size": 1288383,
                "md5": "3e24b20261c467589e68c979a8e19a51"
            },
            {
                "id": "4315bd2e-35aa-4421-ae4d-417d030c82e7",
                "filename": "6d97b058-0acd-45e2-a139-298b854c3f57.jpg",
                "size": 3132216,
                "md5": "8f467d99715f2e3c50c06e9fce8d4ca0"
            },
            {
                "id": "ff242018-6fc3-4e1c-b888-2d7e559cec89",
                "filename": "0c6889d4-2514-4fd7-a3b6-260e409f7405.jpg",
                "size": 2557468,
                "md5": "744e551fc89f24d4674c50af061bd844"
            },
            {
                "id": "0487d097-3bfc-4481-9276-009dcd390249",
                "filename": "8cc17f75-9f40-4d36-82a2-345cde7f8a48.jpg",
                "size": 29020607,
                "md5": "0b5c0e62275ae0cd424cd7bfba22bdba"
            },
            {
                "id": "41a4bdbc-68b4-4af0-b80b-d921eb2275f3",
                "filename": "2c39454d-7507-4c75-8384-97bce73c7e81.jpg",
                "size": 1169628,
                "md5": "c348cde88bc7b0281e60d8033d19bf70"
            },
            {
                "id": "a50fc811-2e80-4c99-842a-a456ffa74e97",
                "filename": "6a7e0564-47d1-4bae-bd45-e06415e1e3fe.jpg",
                "size": 1220325,
                "md5": "7934b9baa9ea7c11e32e11d3bce4ad9c"
            },
            {
                "id": "8883c202-82d8-4264-a00d-91058bd76e52",
                "filename": "1d8887e4-1f72-450f-9b52-e5f4a049f0de.jpg",
                "size": 704196,
                "md5": "fe657c77a3d1b61dfa7bba0fda069a1e"
            },
            {
                "id": "792506d8-743d-468a-8a6d-7ab43ac2f8fa",
                "filename": "b78c2b30-b1c4-4b7c-a896-eef6fcf695ec.jpg",
                "size": 906488,
                "md5": "9a35395e998d2168af0e779882d144b3"
            },
            {
                "id": "70ba2fdc-c6bc-42ef-bdf4-9dae2ef61b49",
                "filename": "c68a4fc1-249e-47a1-82cd-35624190fe8b.jpg",
                "size": 679406,
                "md5": "c6b0e954fe81bf6a7bc99b1d47082460"
            },
            {
                "id": "4d992c6a-b466-40aa-bbe0-d30144903435",
                "filename": "1d282872-bc59-456e-9942-c6574a1aeacb.jpg",
                "size": 1932503,
                "md5": "cc10f4c18d74c5a54b33e3423bc8e8bb"
            },
            {
                "id": "37b68a8d-c7ef-4adf-a020-896a7c8b9436",
                "filename": "56b9da6f-4b35-428c-9970-095b8756a74e.jpg",
                "size": 1820275,
                "md5": "1ae0ba1a9e1fbd6bd40c069e5dd34b1d"
            },
            {
                "id": "e2dad4a5-f331-454b-9fc5-e03913176fdf",
                "filename": "f9d8c7c3-094b-4407-91ad-dfadf4dabb8b.jpg",
                "size": 1302729,
                "md5": "67550c98bd6ae6726bd61cb1d9f23844"
            },
            {
                "id": "3c28e959-a3ef-45ac-9b95-df219357de5c",
                "filename": "777f7570-c920-4345-8ad0-83b7c87e2301.jpg",
                "size": 1225579,
                "md5": "2af8d0737f2901094b1431d4eab7d5e8"
            },
            {
                "id": "7ff57190-31ec-4756-bfee-7d733f7736f5",
                "filename": "a5fa202a-f35b-4462-a047-8d6d9178c9f1.jpg",
                "size": 2476095,
                "md5": "7d46089407f6666ce219cfff6093798f"
            },
            {
                "id": "53d75e1c-bd42-409d-86df-936603cd63f4",
                "filename": "58406815-5edc-4efd-88d4-ace341fa50c6.jpg",
                "size": 2379570,
                "md5": "27cbb739f07c68777e84f49ae9201ec3"
            },
            {
                "id": "bcb96867-b251-4536-a8bf-d386808f7940",
                "filename": "3690f4bd-68ce-40a9-872b-ffd80f556d44.png",
                "size": 543711,
                "md5": "ef8f4919a1287374771f19cde92f39a2"
            },
            {
                "id": "575ca01a-9a80-4da2-a959-342a31dcf273",
                "filename": "cad6c485-d6b8-4264-8368-c6fd19b22030.jpg",
                "size": 3331045,
                "md5": "af36b1f0e30b8a9911b28bf389911fd2"
            },
            {
                "id": "c3e6d8d0-7c8a-4f3c-88ce-bd018d5dc00d",
                "filename": "beba6ec7-a45d-42cb-aa20-fb45abfd6ef2.jpg",
                "size": 3220107,
                "md5": "27570ecf457a486a2ac38e04bc6ea4a5"
            },
            {
                "id": "79a79965-138f-442b-b287-a3a1cc4a5838",
                "filename": "0d66fe6e-6119-4b66-bb56-39abeb620096.jpg",
                "size": 716455,
                "md5": "24e01e6748d1efd8a3aa846092b34a27"
            },
            {
                "id": "8be17f79-544a-4efa-8b93-7413c2030099",
                "filename": "0716bef3-ff5a-4bf2-b812-157a01a6d148.jpg",
                "size": 1920236,
                "md5": "90d8cdace26048d8e354951d9fe044f5"
            },
            {
                "id": "dd7c9ae9-9493-4b90-96c1-5b429d70260d",
                "filename": "28058704-3beb-4dfe-bf03-fb2aedb036d3.png",
                "size": 5388961,
                "md5": "6d8690f1fc1acf373b88e99f24a584a1"
            },
            {
                "id": "5ba671cf-5781-46c5-ae30-3ffce2ff6a22",
                "filename": "f4dc0ec8-ff6d-4bfd-a6ff-325dbcb4abae.png",
                "size": 11723272,
                "md5": "37253ebe14b8a6874e0e8e16d9b16a28"
            },
            {
                "id": "63f94746-ec5c-44b9-8a6e-d0e4d0fafc57",
                "filename": "75e8cb40-a98f-4e5a-b56b-e826b2bf73f4.jpg",
                "size": 3500850,
                "md5": "f5b0fc95a672ca60add4b7a437ef650b"
            },
            {
                "id": "b2795d52-cc8c-4189-8404-5d70b3162567",
                "filename": "c2e1d9a1-4496-450b-a66c-5ba88f4f705f.psd",
                "size": 485865,
                "md5": "73d8cf39310867e8f48efb15543e06ac"
            },
            {
                "id": "904cd04b-e0b8-4b2e-83b1-f09ea2162cfe",
                "filename": "fd13900f-f05f-43fd-a09a-ed5d6d5c4d0e.eps",
                "size": 2335856,
                "md5": "04af3a8133c73a5ac56769f571b8fc81"
            },
            {
                "id": "18fc438b-50b4-40e6-86f8-5552b6a0573e",
                "filename": "b3330515-3d0b-4639-b8b6-1636b4c1eda0.psd",
                "size": 286959975,
                "md5": "17f6dd85c0fbe0f60ab7d9957ba8d0b8"
            },
            {
                "id": "a9651061-4bbd-4295-8213-d44dcb2c89b8",
                "filename": "f6de000b-b47a-49fd-aa03-66edfe80adf2.jpg",
                "size": 9317111,
                "md5": "3f833aeaffe7aa40e9ccb92c442b9e47"
            },
            {
                "id": "d75d5b4e-277b-45b9-9f91-25a245b652d6",
                "filename": "4eeaf2a2-7170-4087-967f-eb35e30cf17f.png",
                "size": 4249611,
                "md5": "0483f49962f02a46248a11f50afd65f2"
            },
            {
                "id": "588807c6-bd83-48aa-9315-552f0500274b",
                "filename": "082b3fae-84e1-473b-8af1-0d2bcb566dec.psd",
                "size": 79670292,
                "md5": "826301bad16c7a0a318f5735554e5588"
            },
            {
                "id": "f7d11800-4f82-49cf-af5a-f18eec55b525",
                "filename": "49a4cc67-09a3-4f29-9ab5-f1ce53b5403c.jpg",
                "size": 452832,
                "md5": "31c5fdfb34188cc4a9d85cd31d369b00"
            },
            {
                "id": "e45af2ab-e460-4787-b113-708564fbf963",
                "filename": "98ec6e43-cd68-4cf7-aa9c-15a9a46db769.jpg",
                "size": 1362272,
                "md5": "caac22bc86b32a62e27667c7390cfc2d"
            },
            {
                "id": "5beb8696-71ce-4d35-aba5-06c15a526355",
                "filename": "8318d72a-70ae-45fa-8e03-ce4ff2ce9614.jpg",
                "size": 391697,
                "md5": "fd787307151109fc128b2c74825df4bd"
            },
            {
                "id": "05bcbc6a-bfec-494f-bedf-a3194da00435",
                "filename": "f3d34819-7141-4f37-a97f-47fca76afc05.eps",
                "size": 1962994,
                "md5": "1eb63f2e8601c10f501516b9fa37db1c"
            },
            {
                "id": "f4c16dee-cdce-4425-821d-094cc91e2a80",
                "filename": "f9f3eab9-e5dc-41b4-aa22-b53977d1ce65.eps",
                "size": 2351032,
                "md5": "4f5cb928586c934090ed7988b17deedf"
            },
            {
                "id": "b4d35b36-0a96-4f07-9c8a-a15c330737ae",
                "filename": "2213a784-c8d0-4186-967c-3080d382d021.jpg",
                "size": 3042358,
                "md5": "4fac32b5686474d4fa33ca3a6c226422"
            },
            {
                "id": "8d246130-3b02-420c-9dd7-95a1e0b4a7bf",
                "filename": "0ba43597-7b68-4ed5-add3-ae65f4517eaa.jpg",
                "size": 2489409,
                "md5": "b8053c6de32cf9bf3e976c2c17fcddeb"
            },
            {
                "id": "56475d12-01e8-4c0e-88db-c9a0f8492bb3",
                "filename": "19d24f08-218f-4d20-b7a8-0175aef72a96.png",
                "size": 904099,
                "md5": "477c30014f9f66969d71d538faac9a92"
            },
            {
                "id": "663fab59-2c4b-45aa-b36c-6aa1ee97c6f7",
                "filename": "c5c8e2ff-59b7-40c3-bcfa-2cb1f98b4820.jpg",
                "size": 3760928,
                "md5": "ba79fb16aa8032b7221212644b7003e2"
            }
        ]
    
        let limit=15000000;
        for (var $va=0; $va<idsObj.length; $va++)
        {
            let item=idsObj[$va];
    
            if (md5GIaScaricati.includes(item.md5))
            {
                console.log("File già scaricato: " + item.filename);
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
                //await file.write(byteArray);
                console.log($va + " -> Salvo il file");
    
                await file.write(byteArrayTotal);
    
                //const file = await fs.getFileForSaving('downloaded-file.jpg');
    
                // if (file) {
                //     // Scrive il file sul disco
                //     await file.write(byteArray);
                //     console.log('File salvato con successo');
                // } else {
                //     console.log('Salvataggio del file annullato dall\'utente.');
                // }
            } catch (err) {
                console.error('Errore durante il salvataggio del file:', err);
            }
    
            // 3. Decodifica i dati binari in testo per identificare il separatore (se è testuale)
            //const textDecoder = new TextDecoder();
            //const dataAsText = textDecoder.decode(arrayBuffer);
            
    
    
            // 4. Usa un separatore per dividere i file (ad esempio "---file-separator---")
            //const separator = "\n--file-separator--\n";
            //const separator = new Uint8Array([  10,  45,  45, 102, 105, 108, 101,  45, 115, 101, 112,  97, 114,  97, 116, 111, 114,  45,  45,  10]);
    
    
    
            // function findSeparatorIndices(buffer, separator) {
            //     let indices = [];
            //     for (let i = 0; i <= buffer.length - separator.length; i++) {
            //         let match = true;
            //         for (let j = 0; j < separator.length; j++) {
            //             if (buffer[i + j] !== separator[j]) {
            //                 match = false;
            //                 break;
            //             }
            //         }
            //         if (match) {
            //             indices.push(i);
            //         }
            //     }
            //     return indices;
            // }
    
            // // 5. Trova gli indici dei separatori
            // const separatorIndices = findSeparatorIndices(byteArray, separator);
    
    
    
            // Chiede all'utente di selezionare una cartella in cui salvare i file
    
    
            // // 6. Salva ogni parte del file nella cartella selezionata
            // for (let i = 0; i < fileChunks.length; i++) {
            //     const fileContent = fileChunks[i];
            //     const fileName = `file-${i + 1}.jpeg`;  // Puoi cambiare l'estensione in base al tipo di file
    
            //     // Crea il file nella cartella selezionata
            //     const file = await folder.createFile(fileName, { overwrite: true });
    
            //     // Scrive il contenuto nel file
            //     const textEncoder = new TextEncoder();
            //     const fileData = textEncoder.encode(fileContent);
            //     await file.write(fileData);
    
            //     console.log(`File ${fileName} salvato con successo.`);
            // }
    
            // let start = 0;
            // console.log(separatorIndices);
            // for (let i = 0; i <= separatorIndices.length; i++) {
            //     // Seleziona la parte tra i separatori
            //     let end = separatorIndices[i] || byteArray.length;
            //     const fileData = byteArray.slice(start, end);
            //     start = end + separator.length;
    
            //     // Crea e salva il file nella cartella selezionata
            //     const fileName = `file-${i + 1}.jpeg`;
            //     const file = await folder.createFile(fileName, { overwrite: true });
            //     await file.write(fileData);
    
            //     console.log(`File ${fileName} salvato con successo.`);
            // }
    
            //break;
        }
    },
    
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
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = cmd;