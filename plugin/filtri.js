const InddEvents = require('./events');

const filtri = {
    paginaFiltro:0,

    async visualizzaHomePageFiltri(){
        if(ficoProcess.getTipoLavorazioneCorrente() != 1){
            return;
        }

        showLoading("Lettura filtri in corso...");
        await Utility.sleep(10);
        //}

    //    setTimeout(function () {
    //     if (!fineFlag)
    //         {
                
    //         }, 10);
            
        let me1 = filtri;
        const pagine = docInLavorazione.pages.everyItem().getElements();
        //controlliamo che il file Filtri.json esista, se non esiste lo creiamo con la struttura
        //{
        //     "source": [
        //         {
        //             "pagina": 0,
        //             "filtri": [],
        //             "active": true,
        //             "blocco": false,
        //             "limite": 0,
        //         }
        //     ]
        // }

        var ObjFiltri = readFile(filtri.getNomeFileFiltriJson());


        if (!ObjFiltri) {
            ObjFiltri = {
                source: []
            };
            //creiamo l'oggetto con le pagine
            for (let i = 0; i < pagine.length; i++) {
                ObjFiltri.source.push({
                    pagina: pagine[i].name,
                    filtri: [],
                    active: true,
                    blocco: false,
                    limite: 0,
                });
            }
            //scriviamo il file
            //fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
        }

        
        for (let i = 0; i < pagine.length; i++) {
            //controlliamo se la pagina è già presente in ObjFiltri.source, se non lo è la aggiungiamo
            if (!ObjFiltri.source.some(item => item.pagina === pagine[i].name)) {
                ObjFiltri.source.push({
                    pagina: pagine[i].name,
                    filtri: [],
                    active: true,
                    blocco: false,
                    limite: 0,
                });
            }
        }

        //ordiniamo per pagina
        ObjFiltri.source.sort((a, b) => a.pagina - b.pagina);
        //scriviamo il file
        fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
        

        // svuotiamo filtriBody
        let scrollTop = $('#filtriBodyGriglia').length ? $('#filtriBodyGriglia').scrollTop() : 0;
        $('#filtriBody').empty();
        // adesso in pagina creeremo un header con i seguenti campi
        // Pagina (width: 10%), filtri (width: 10%), N. ref (10%), Griglia (10%), Limite (10%), Ref. Avanzate (15%), Ref. Escluse (15%), Data Conteggio (20%)
        //Ogni header corrisponderà ad una colonna della tabella
        const headerRow = $('<div></div>').css({backgroundColor: 'blue', display: 'flex', marginRight: '5px', width: '97%'});
        const headers = [
            { text: 'Ordine', width: '10%' },
            { text: 'Pagina', width: '10%' },
            { text: 'Filtri', width: '10%' },
            { text: 'Griglia', width: '10%' },
            { text: 'Limite', width: '10%' },
            { text: 'N. ref', width: '10%' },
            { text: 'Ref. Avanzate', width: '13%' },
            { text: 'Ref. Escluse', width: '13%' },
            { text: 'Data Conteggio', width: '14%' }
        ];

        headers.forEach((header, index) => {
            const bgColor = index % 2 === 0 ? 'white' : 'lightgray';
            headerRow.append(
            $('<div></div>')
                .addClass('col-1')
                .text(header.text)
                .css({ height: '30px', width: header.width, backgroundColor: bgColor, fontWeight: 'bold', textAlign: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', })
            );
        });

        $('#filtriBody').append(headerRow);

        //facciamo ora un div che ci farà da body, tale body deve prevedere lo scroll verticale
        const bodyDiv = $('<div></div>').attr('id', 'filtriBodyGriglia').css({
            height: '400px',
            overflowY: 'auto',
            display: 'block',
            margin: '0 px',
            padding: '0 px',
        });
        $('#filtriBody').append(bodyDiv);


        //Al body adesso creiamo le varie righe, avremo una riga per ogni pagina del documento
        let lastElement = null;
        const listaRefConteggio = readFile(pathLavorazione + "/listaRefConteggio.json");
        const listaEscluse = readFile(pathLavorazione + "/listaRefEscluse.json");
        let ultimaDataConteggio = null;
        //compiliamo l'ultima data di conteggio prendendo la data più recente tra quelle presenti in listaRefConteggio
        if (listaRefConteggio && Array.isArray(listaRefConteggio)) {
            listaRefConteggio.forEach(item => {
                if (item.data && (!ultimaDataConteggio || new Date(item.data) > new Date(ultimaDataConteggio))) {
                    ultimaDataConteggio = item.data;
                }
            });
        }

        var incrementalOrder = 1;
        //cerchiamo nei filtri l'elemento con ordine massimo e != 999, il valore di incrementalOrder sarà tale valore + 1
        ObjFiltri.source.forEach(item => {
            if (item.ordine != null && item.ordine != 999 && item.ordine >= incrementalOrder) {
                incrementalOrder = item.ordine + 1;
            }
        });

        var daSalvare = false;
        let lastFiltroAcive = false;
        for (let i = 0; i < pagine.length; i++) {
            const row = $('<div></div>').css({ display: 'flex', marginRight: '5px', backgroundColor: 'blue', height: '32px', width: '99%' });
            // adesso creiamo le colonne della riga con i loro contenuti
            var paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagine[i].name);
            //inseriamo una colonna con una piccola textarea (deve bastare per numeri fino a 2 cifre) per modificare l'ordine in cui verranno eseguiti i filtri
            //questo campo verrà compilato con il valore di paginaFiltri.ordine se c'è altrimenti resta vuoto
            //il box è vuoto e disabilitato e nascosto in ogni caso in cui il filtro non abbia filtri o blocco attivo
            row.append(
                $('<div></div>')
                    .css({ height: '30px', width: '10%', backgroundColor: 'white', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                    .append(
                        $('<input></input>')
                            .attr('type', 'text')
                            .attr('pagina', pagine[i].name)
                            .addClass('inputOrdineFiltro')
                            .addClass('hideble')
                            .attr('value', (paginaFiltri.ordine != null && paginaFiltri.ordine != 999 ? paginaFiltri.ordine : 
                                (paginaFiltri.filtri.length == 0 || paginaFiltri.blocco ? '999' : incrementalOrder)
                            ))
                            .css({ width: '40px', textAlign: 'center', color: 'lightblue' })
                            .val(paginaFiltri.ordine != null && paginaFiltri.ordine != 999 ? paginaFiltri.ordine : 
                                (paginaFiltri.filtri.length == 0 || paginaFiltri.blocco ? '999' : incrementalOrder)
                            )
                            .on('blur', function (){
                                var newOrdine = parseInt($(this).val());
                                var pagina = $(this).attr('pagina');
                                ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
                                paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
                                
                                //gli ordini devono essere univoci e contigui a partire da 1 quindi facciamo alcuni controlli
                                //se l'ordine è già assegnato ad un altro filtro quel filtro scorre
                                //per farlo dobbiamo scorrere tutti i filtri dal primo e appena troviamo un buco nella numerazione decrementiamo di 1 tutti i filtri successivi
                                //poi aumentiamo di 1 tutti i filtri con ordine >= newOrdine ed assegnamo newOrdine a questo filtro
                                //se invece l'ordine è minore di 1 o non valido mandiamo un alert con errore e resettiamo il valore al precedente
                                //se invece il numero è maggiore del numero di ordine massimo + 1 lo portiamo a tale valore e poi controlliamo tutti i filtri da 1 e se troviamo buchi decrementiamo di 1 tutti i filtri successivi
                                if (isNaN(newOrdine) || newOrdine < 1) {
                                    Utility.popup("Errore", "Valore di ordine non valido. Deve essere un numero intero maggiore di 0.");
                                    //resetto al precedente, lo possiamo leggere dal suo attr value
                                    $(this).val(
                                        paginaFiltri.ordine != null && paginaFiltri.ordine != 999 ? paginaFiltri.ordine : $(this).attr('value')
                                    );
                                    return;
                                }
                                
                                //cerchiamo e aggiorniamo la pagina filtri corrispondente a questa pagina
                                if (!paginaFiltri) {
                                    Utility.popup("Errore", "Pagina non trovata nei filtri.");
                                    return;
                                }
                                //controlliamo il valore di partenza e di arrivo, e spostiamo di 1 tutti gli elementi che si trovano in quel range tranne l'elemento corrente
                                //se il valore di partenza è minore di quello di arrivo, decrementiamo di 1 tutti gli ordini tra partenza+1 e arrivo
                                //se il valore di partenza è maggiore di quello di arrivo, incrementiamo di 1 tutti gli ordini tra arrivo e partenza-1
                                
                                //leggiamo dal value il valore di partenza
                                var currentOrdine = paginaFiltri.ordine != null && paginaFiltri.ordine != 999 ? paginaFiltri.ordine : parseInt($(this).attr('value'));
                                if (newOrdine > currentOrdine) {
                                    //decrementiamo di 1 tutti gli ordini tra currentOrdine+1 e newOrdine
                                    ObjFiltri.source.forEach(item => {
                                        if (item.pagina !== paginaFiltri.pagina && item.ordine != null && item.ordine > currentOrdine && item.ordine != 999 && item.ordine <= newOrdine) {
                                            item.ordine--;
                                        }
                                    });
                                } else if (newOrdine < currentOrdine) {
                                    //incrementiamo di 1 tutti gli ordini tra newOrdine e currentOrdine-1
                                    ObjFiltri.source.forEach(item => {
                                        if (item.pagina !== paginaFiltri.pagina && item.ordine != null && item.ordine >= newOrdine && item.ordine != 999 && item.ordine < currentOrdine) {
                                            item.ordine++;
                                        }
                                    });
                                }

                                //è possibile che newOrdine sia maggiore del massimo ordine + 1, in questo caso lo portiamo a tale valore
                                let maxOrdine = 0;
                                ObjFiltri.source.forEach(item => {
                                    if (item.ordine != null && item.ordine != 999 && item.ordine > maxOrdine) {
                                        maxOrdine = item.ordine;
                                    }
                                });

                                if (newOrdine > maxOrdine + 1) {
                                    newOrdine = maxOrdine + 1;
                                }
                                //assegniamo il nuovo ordine a questo filtro
                                paginaFiltri.ordine = newOrdine;

                                //scriviamo il file Filtri.json
                                fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));

                                //aggiorniamo solo tutti i box di ordine
                                var boxOrdine = $('#filtriBody').find('div').find('input');
                                boxOrdine.each(function(){
                                    var pagName = $(this).attr('pagina');
                                    var pagFiltro = ObjFiltri.source.find(item => item.pagina === pagName);
                                    $(this).val(
                                        pagFiltro.ordine != null && pagFiltro.ordine != 999 ? pagFiltro.ordine : ''
                                    );
                                })
                            })
                    )
            );

            //disabilitiamo il box se non ci sono filtri o blocco   
            if (paginaFiltri.filtri.length == 0 || paginaFiltri.blocco) {
                row.find('input').hide();
            }

            //se l'ordine è null dobbiamo salvarlo nel file per inizializzarlo, mettiamo incremental order se ci sono filtri e non ci sonon blocchi, altrimenti mettiamo 999
            if (paginaFiltri.ordine == null) {
                paginaFiltri.ordine = (paginaFiltri.filtri.length == 0 || paginaFiltri.blocco ? 999 : incrementalOrder);
                //scriviamo il file Filtri.json
                daSalvare = true;
            }

            //INCREMENTIAMO incrementalOrder se l'ordine della pagina è stato settato a tale valore
            if (paginaFiltri.ordine === incrementalOrder) {
                incrementalOrder++;
            }

            // Nella prima colonna mettiamo un pulsante tondo con il numero della pagina, il pulsante avrà un evento onclick che per ora lasciamo vuoto
            row.append(
                $('<div></div>')
                    .css({ height: '30px', width: '10%', backgroundColor: 'white', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                    .append(
                        $('<button></button>')
                            .text(pagine[i].name)
                            .css({ borderRadius: '50%', width: '30px', height: '30px' })
                            .on('click', () => {
                                scrollTop = $('#filtriBodyGriglia').length ? $('#filtriBodyGriglia').scrollTop() : 0;
                                me1.apriFiltriPagina(pagine[i].name, scrollTop);
                            })
                    )
            );
            
            // Nella seconda colonna disegneremo:
            // Se c'è un filtro alla a questa pagina: mettiamo FiltroVerde.png
            // Se c'è un blocco a questa pagina: mettiamo PaginaBloccata.png
            // Se non c'è nulla e l'ultimo elemento aggiunto è un filtro, disegniamo una barra verticale che va da cima a fondo del div di colore verde
            //tali informazioni le recuperiamo da ObjFiltri

            if (paginaFiltri.blocco) {
                lastElement = "blocco";
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '10%', backgroundColor: 'lightgray', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<img>')
                                .attr('src', 'images/PaginaBloccata.png')
                                .css({ width: '30px', height: '30px' })
                        )
                );
            } else if (paginaFiltri.filtri.length > 0) {
                lastFiltroAcive = paginaFiltri.active;
                lastElement = "filtro";
                row.append(
                    $('<div></div>')
                        .css({ cursor:'pointer', height: '30px', width: '10%', backgroundColor: (paginaFiltri.active ? 'white' : 'lightgray'), textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<img>')
                                .attr('src', 'images/FiltroVerde.png')
                                .css({ width: '30px', height: '30px' })
                        )
                        //aggiungiamo un evento onclick che setta active del filtro a false
                        .on('click', () => {
                            //dobbiamo rileggere il file e aggiornare pagina filtri
                            ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
                            paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagine[i].name);
                            //mostriamo il dialog dei filtri
                            paginaFiltri.active = !paginaFiltri.active;
                            //scriviamo il file Filtri.json
                            fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));

                            //aggiorniamo la visualizzazione della home page filtri
                            me1.visualizzaHomePageFiltri();             
                        })
                );
            } else if (lastElement === "filtro") {
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '10%', backgroundColor: lastFiltroAcive ? 'white' : 'lightgray', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<div></div>')
                                .css({ width: '5px', height: '100%', backgroundColor: '#089951' }) // Changed to lime green
                        )
                );
            } else{
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '10%', backgroundColor: 'lightgrey', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        //scriviamo libera
                        .append(
                            $('<span></span>')
                                .text('Libera')
                                .css({ color: 'gray', fontStyle: 'italic' })
                        )
                );
            }

            //nella terza colonna avviamo un processo async che andrà a cercare in pagina corrispondente la griglia nel livello 'Griglia', per trovarla guarda
            // se la label inizia con griglia_ e se l'oggetto è visibile. Se la trova fa lo split della label e prende il secondo elemento, che sarà il nome della griglia
            // Mentre il processo è in corso, scriviamo "In corso...", quando finisce scriviamo il nome della griglia
            const grigliaCol = $('<div></div>').css({ 
                height: '30px', 
                width: '10%', 
                backgroundColor: 'lightgrey', 
                textAlign: 'center', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
            });

            grigliaCol.append(
                $('<span></span>')
                    .text('In corso...')
                    .css({ color: 'black' })
            );

            // Add onclick event to navigate to the page and select the grid
            grigliaCol.on('click', async () => {
                try {
                    let griglia = await Utility.getGrigliaFromPage(pagine[i].name);
                    if (griglia) {
                        docInLavorazione.pages.item(i).select(); // Navigate to the page
                        griglia.select(); // Select the grid
                    }
                } catch (error) {
                    console.error("Errore durante la selezione della griglia:", error);
                    alert('Errore durante la selezione della griglia.');
                }
            });

            row.append(grigliaCol);

            (async () => {
                try {
                    let griglia = await Utility.getGrigliaFromPage(pagine[i].name);
                    //la griglia tornata è l'oggetto indesign, se non è null il nome della griglia è lo split della label dell'oggetto [1]
                    if (griglia && griglia.label && griglia.label.startsWith('griglia_')) {
                        const grigliaName = griglia.label.split('_')[1];
                        grigliaCol.empty();
                        grigliaCol.append(
                            $('<span></span>')
                                .text(grigliaName)
                                .css({ color: 'black' })
                        );
                        //cambiamo il colore di sfondo della colonna in bianco
                        grigliaCol.css({ backgroundColor: 'white', cursor: 'pointer'});
                    }
                    else {
                        grigliaCol.empty();
                        grigliaCol.append(
                            $('<span></span>')
                                .text('Nessuna griglia')
                                .css({ color: 'gray' })
                        );
                    }
                } catch (error) {
                    console.error("Errore nel recupero della griglia:", error);
                    grigliaCol.empty();
                    grigliaCol.append(
                        $('<span></span>')
                            .text('Errore')
                            .css({ color: 'red' })
                    );
                    grigliaCol.css({ backgroundColor: 'lightcoral' });

                }
            }
            )();

            //nella quarta colonna mettiamo il limite, se non c'è limite scriviamo 0
            row.append(
                $('<div></div>')
                    .css({ height: '30px', width: '10%', backgroundColor: (paginaFiltri.limite != "" && paginaFiltri.limite != "Ill." ? 'white' : 'lightgrey'), textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                    .append(
                        $('<span></span>')
                            .text(paginaFiltri.limite)
                            .css({ color: 'black' })
                    )
            );

            //nella quinta colonna mettiamo il numero di riferimenti conteggiati, se non ci sono riferimenti scriviamo 0
            let nRefConteggiate = 0;
            var paginaRefAvanzate = (listaRefConteggio!=null)?(listaRefConteggio.find(item => item.Pag === pagine[i].name)):null;
            if (paginaRefAvanzate && paginaRefAvanzate.listaImpaginate) {
                listaImpaginate = JSON.parse(paginaRefAvanzate.listaImpaginate);
                nRefConteggiate = listaImpaginate.length;
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '10%', backgroundColor: 'white', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text(''+nRefConteggiate || 0)
                                .css({ color: 'black' })
                        )
                );
            }
            else{
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '10%', backgroundColor: 'lightgrey', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text('Nessun conteggio')
                                .css({ color: 'black' })
                        )
                );
            }




            //nella sesta colonna mettiamo il numero di riferimenti avanzati, se non ci sono riferimenti scriviamo 0. Per leggere i riferimenti avanzati, dobbiamo leggere il file listaRefConteggio.json
            //Nella struttura cerchiamo l'elemento con Pag = i+1, leggiamo listaAvanzate e la deserializziamo, poi prendiamo la length dell'array
            let nRefAvanzate = 0;
            var paginaRefAvanzate = (listaRefConteggio!=null)?(listaRefConteggio.find(item => item.Pag === pagine[i].name)):null;
            if (paginaRefAvanzate && paginaRefAvanzate.listaAvanzate) {
                refAvanzate = JSON.parse(paginaRefAvanzate.listaAvanzate);
                nRefAvanzate = refAvanzate.length;
                row.append(
                    $('<div></div>')
                        .css({ cursor:'pointer', height: '30px', width: '13%', backgroundColor: 'white', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text(''+nRefAvanzate || 0)
                                .css({ color: 'black' })
                        )
                        //facciamo un evento onclick
                        .on('click', () => {
                            $("#menuRefAvanzate").show();
                            grigliaJs.mostraElementiAvanzati(i+1);
                            //simuliamo un click su #menuRefAvanzate
                            $('#menuRefAvanzate').trigger('click');
                        })
                );
            }
            else{
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '13%', backgroundColor: 'lightgrey', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text('Nessun conteggio')
                                .css({ color: 'black' })
                        )
                );
            }

            //nella settima colonna mettiamo il numero di riferimenti escluse, se non ci sono riferimenti scriviamo 0. Per leggere i riferimenti escluse, dobbiamo leggere il file listaEscluse.json
            let nRefEscluse = 0;
            var paginaRefEscluse = listaEscluse!=null?(listaEscluse.find(item => item.Pag === pagine[i].name)):null;
            if (paginaRefEscluse && paginaRefEscluse.listaEscluse.length > 0) {
                refEscluse = paginaRefEscluse.listaEscluse;
                nRefEscluse = refEscluse.length;
                row.append(
                    $('<div></div>')
                        .css({ cursor:'pointer', height: '30px', width: '13%', backgroundColor: 'lightcoral', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text('' + nRefEscluse || 0)
                                .css({ color: 'black' })
                        )
                        //facciamo un evento onclick
                        .on('click', () => {
                            $("#menuRefAvanzate").show();
                            grigliaJs.mostraElementiAvanzati(pagine[i].name);
                            //simuliamo un click su #menuRefAvanzate
                            $('#menuRefAvanzate').trigger('click');
                        })
                );
            }
            else{
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '13%', backgroundColor: 'lightgrey', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text('Nessun escluso')
                                .css({ color: 'black' })
                        )
                );
            }

            let dataConteggio = null;
            //nell'ultima colonna mettiamo la data di conteggio, se non c'è data scriviamo "Nessun conteggio". Leggiamo da data in listaRefConteggio, se non c'è data scriviamo "Nessun conteggio"
            if (paginaRefAvanzate && paginaRefAvanzate.data) {
                dataConteggio = paginaRefAvanzate.data;
                row.append(
                    $('<div></div>')
                        .css({ 
                            height: '30px', 
                            width: '14%', 
                            backgroundColor: dataConteggio === ultimaDataConteggio ? 'white' : 'lightyellow', 
                            textAlign: 'center', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        })
                        .append(
                            $('<span></span>')
                                .text(dataConteggio)
                                .css({ color: 'black' })
                        )
                );
            } else {
                row.append(
                    $('<div></div>')
                        .css({ height: '30px', width: '14%', backgroundColor: 'lightgrey', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' })
                        .append(
                            $('<span></span>')
                                .text('Nessun conteggio')
                                .css({ color: 'black' })
                        )
                );
            }


            bodyDiv.append(row);
        }

        if(daSalvare){
            fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
        }

        onresizeWindow();
        $('#filtriBodyGriglia').scrollTop(scrollTop); // Ripristina lo scroll verticale
        
        hideLoading();
        fineFlag=true;
    },

    async apriFiltriPagina(pagina, scrollTop = 0) {
        let me = this;
        //apriamo il modal dialogFiltri
        //CREIAMO un pulsante Opzioni avanzate
        // let advancedOptions = $('<sp-action-button name="advancedOptionFiltro">Opzioni avanzate</sp-action-button>');
        // advancedOptions.on('click', function () {
        //     //mostriamo il dialog avanzato
        //     $('#advancedOptionsFiltro').toggle();
        //     //se le opzioni sono visibili mettiamo l'altezza di lockicon e bodyFiltri al 70% della finestra, altrimenti al 100% lockicon e al 90% bodyFiltri
        //     if ($('#advancedOptionsFiltro').is(':visible')) {
        //         $('#lockIcon').css('height', '70%');
        //         $('#bodyFiltri').css('height', '60%');
        //     } else {
        //         $('#lockIcon').css('height', '100%');
        //         $('#bodyFiltri').css('height', '90%');
        //     }
        // });

        scrollObj = {
            scrollTop: scrollTop,
            scrollIdContainer: 'filtriBodyGriglia'
        }

        Utility.apriModal('dialogFiltri', 'Filtri Pagina ' + pagina, true, ["pulsanteAdvancedOptionFiltro"], true, scrollObj);
        //impostiamo i data della pagina
        $('#dialogFiltri').data('pagina', pagina);

        //Un oggetto filtro è così composto:
        // {
        //     "limite": 0,
        //     "ordine": 0,
        //     "criteri": [
        //         {
        //             "chiave": "testo",
        //             "operatore": "testo",
        //             "valore": "testo",
        //         }
        //      ]

        //intanto leggiamo il file Filtri.json e cerchiamo la pagina corrispondente, poi leggiamo i filtri
        //per ogni filtro trovato creiamo a schermo nel bodyFiltri i vari elementi che compongono il filtro (tranne l'ordine), i filtri verrano ordinati per ordine crescente di ordine

        //controlliamo se dobbiamo usare il nome del file


        const ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
        if (!ObjFiltri || !ObjFiltri.source) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }
        const paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
        if (!paginaFiltri) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }

        if( paginaFiltri.blocco ){
            $('#bodyFiltri').hide();
            $('#buttonsFiltri').hide();
            $('#lockIcon').show();
        }

        //svuotiamo il bodyFiltri
        $('#bodyFiltri').empty();
        //ordiniamo i filtri per ordine crescente
        paginaFiltri.filtri.sort((a, b) => a.ordine - b.ordine);
        //per ogni filtro creiamo un div, la prima riga del div conterrà il limite con un campo di testo per modificarlo

        

        // paginaFiltri.filtri.forEach(async (filtro, index) => {
        //     await Utility.sleep(5000);
        //     me.addNewFiltro(filtro);
        // });

        this.paginaFiltro = pagina;

        for (let i = 0; i < paginaFiltri.filtri.length; i++) {
            const filtro = paginaFiltri.filtri[i];
            await Utility.sleep(1);
            await me.addNewFiltro(filtro);
        }
    },

    async addNewFiltro(filtro = null, alternativeBody = null, hideButtonsForTracciato = false, hideNarrow = false) {
        let me = this;
        //creiamo ed appendiamo un nuovo filtro al bodyFiltri
        const newFiltroDiv = $('<div></div>').addClass('filtro').css({ margin: '5px', padding: '5px', border: '1px solid #ccc', borderRadius: '5px' });
        //prima riga con il limite
        if (!hideButtonsForTracciato) {
            newFiltroDiv.append(
                $('<div></div>').addClass('headerFiltro')
                    .css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' })
                    .append(
                        $('<img>')
                            .attr('src', 'images/copy.png')
                            .attr('title', 'Duplica filtro')
                            .css({ width: '15px', height: '15px', marginRight: '10px', cursor: 'pointer' })
                            .on('click', function () {
                                let blocco=$(this).closest('.filtro');
                                blocco.clone().appendTo($(this).closest('#bodyFiltri'));
                                me.salvaFiltri();
                                me.apriFiltriPagina(me.paginaFiltro);
                            })
                    )
                    .append(
                        $('<img>')
                            .attr('src', filtro == null ? 'images/unlocked.png' : 'images/locked.png')
                            .css({ width: '15px', height: '15px', marginRight: '10px', cursor: 'pointer' })
                            .on('click', function () {
                                //se cliccato cerchiamo tutti i select e tutte le textarea e, se sono disabilitati, li abilitiamo oppure viceversa
                                //poi modifichiamo l'src di questa immagine in locked.png o unlocked.png a seconda dello stato
                                const isDisabled = $(this).closest('.headerFiltro').find('input').prop('disabled');
                                $(this).closest('.headerFiltro').find('input').prop('disabled', !isDisabled);
                                $(this).closest('.headerFiltro').find('sp-picker').prop('disabled', !isDisabled);
                                $(this).attr('src', isDisabled ? 'images/unlocked.png' : 'images/locked.png');
                            })
                    )
                    .append(
                        $('<label></label>')
                            .text('Limite:')
                            .css({ marginRight: '10px' })
                    )
                    .append(
                        $('<input ' + (filtro == null ? '' : 'disabled') + '></input>')
                            .attr('type', 'number')
                            .addClass('hideble')
                            .val(filtro == null ? 0 : filtro.limite)
                            .css({ width: '80px', marginRight: '10px', color: 'lightblue' }))
                    //aggiungiamo un pulsante di + che fa addCriterio(newFiltroDiv)
                    .append(
                        $('<button></button>')
                            .text('+')
                            .css({
                                backgroundColor: 'lightgreen',
                                color: 'black',
                                border: 'none',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                textAlign: 'center',
                                lineHeight: '20px'
                            })
                            .on('click', function () {
                                // Aggiunge un nuovo criterio al filtro
                                filtri.addCriterio(newFiltroDiv);
                            })
                            .on('contextmenu', async function (e) {
                                await filtri.apriMenuTemplateFiltri(e, newFiltroDiv, false);
                            })
                    )
                    .append(
                        $('<button></button>')
                            .html('&#x25B2;') // Freccia su
                            .css({
                                backgroundColor: 'lightblue',
                                color: 'black',
                                border: 'none',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                textAlign: 'center',
                                lineHeight: '20px',
                                marginRight: '5px'
                            })
                            .on('click', function () {
                                // Logica per spostare il filtro su
                                const allFilters = $('#bodyFiltri .filtro');
                                const index = allFilters.index(newFiltroDiv);
                                if (index > 0) {
                                    newFiltroDiv.insertBefore(allFilters.eq(index - 1));
                                }
                            })
                    )
                    .append(
                        $('<button></button>')
                            .html('&#x25BC;') // Freccia giù
                            .css({
                                backgroundColor: 'lightblue',
                                color: 'black',
                                border: 'none',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                textAlign: 'center',
                                lineHeight: '20px'
                            })
                            .on('click', function () {
                                // Logica per spostare il filtro giù
                                const allFilters = $('#bodyFiltri .filtro');
                                const index = allFilters.index(newFiltroDiv);
                                if (index < allFilters.length - 1) {
                                    newFiltroDiv.insertAfter(allFilters.eq(index + 1));
                                }
                            })
                    )
                    .append(
                        $('<button></button>')
                            .html('&times;') // X di chiusura
                            .css({
                                backgroundColor: 'red',
                                color: 'white',
                                border: 'none',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                textAlign: 'center',
                                lineHeight: '20px',
                                fontSize: '16px'
                            })
                            .on('click', function () {
                                newFiltroDiv.remove(); // Rimuove il div del filtro dalla UI
                                //$(this).closest('.filtro').remove(); // Rimuove il div del filtro dalla UI
                            })
                    )
            );
        }
        else{
            newFiltroDiv.append(
                $('<div></div>').addClass('headerFiltro')
                    .css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' })
                    .append(
                        $('<button></button>')
                            .text('+')
                            .css({
                                backgroundColor: 'lightgreen',
                                color: 'black',
                                border: 'none',
                                padding: '5px',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                textAlign: 'center',
                                lineHeight: '20px'
                            })
                            .on('click', function () {
                                // Aggiunge un nuovo criterio al filtro
                                filtri.addCriterio(newFiltroDiv, null, hideButtonsForTracciato);
                            })
                            .on('contextmenu', async function (e) {
                                await filtri.apriMenuTemplateFiltri(e, newFiltroDiv, hideButtonsForTracciato);
                            })
                    )
                    //adesso inseriamo una tendina con 3 valori Vedi tutto, impaginati, da impaginare
                    //        <sp-picker id="kitPromoCmb" name="kitPromoCmb">
                    //<sp-menu slot="options">
                    .append(
                        //$('<select></select>')
                        $('<sp-picker></sp-picker>')
                            .addClass('filtro-visualizzazione')
                            .css({ width: '200px', marginLeft: '10px' })
                            .append(
                                $('<sp-menu slot="options" style="white-space:nowrap;"></sp-menu>')
                                .append(
                                    //$('<option selected></option>').text('Vedi tutto').val('all')
                                    $('<sp-menu-item selected></sp-menu-item>').text('Vedi tutto').val('all'))
                                .append(
                                    //$('<option></option>').text('Impaginati').val('impaginati')
                                    $('<sp-menu-item></sp-menu-item>').text('Impaginati').val('impaginati')
                                )
                                .append(
                                    //$('<option></option>').text('Da impaginare').val('da_impaginare')
                                    $('<sp-menu-item></sp-menu-item>').text('Da impaginare').val('da_impaginare')
                                )
                                .on('change', function () {
                                    //togliamo selected ad ogni opzione
                                    //$(this).find('option').prop('selected', false);
                                    //$(this).find('option[value="' + $(this).val() + '"]').prop('selected', true);
                                    $(this).find('sp-menu-item').prop('selected', false);
                                    $(this).find('sp-menu-item[value="' + $(this).val() + '"]').prop('selected', true);


                                    const selectedValue = $(this).val();
                                    //impostiamo selected all'opzione selezionata
                                

                                    //mandiamo la ricerca per il filtro
                                    me.ricercaFiltro(newFiltroDiv).then((resRicerca) => {
                                        aggiornaTracciatoPostRicerca(resRicerca);
                                    });
                                })
                        )
                    )

            );
        }


        newFiltroDiv.append(
            $('<div></div>')
                .addClass('filtro-narrow')
                .css({ color: 'red', width: '100%', backgroundColor: "white", padding: '3px', color: "black", marginTop: "5px", display: hideNarrow ? 'none' : 'block' })
                .text('Spiegazione filtro')
        );
        
        const filtroInfoDiv = $('<div></div>')
            .addClass('filtro-info')
            .css({ marginTop: '10px', marginLeft: '10px' });

        const infoRow = $('<div></div>')
            .addClass('filtro-info-row')
            .css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center',  width: '100%' });



        infoRow.append(
            $('<div></div>')
            .addClass('filtro-info-label-trovati')
            .css({ color: !hideButtonsForTracciato ? '#f15a5a' : '#f3a2a2', width: '40%', alignItems: 'center', display: 'flex' })
            .text('Elementi da impaginare:')
        );

        infoRow.append(
            $('<div></div>')
            .addClass('filtro-info-label-impaginati')
            .css({ color: !hideButtonsForTracciato ? '#539853' : '#aae6aa', width: '40%', alignItems: 'center', display: 'flex'})
            .text('Elementi già impaginati trovati:')
        );

        infoRow.append(
            $('<div></div>')
            .addClass('filtro-info-tot')
            .css({ color: !hideButtonsForTracciato ? '#514f4f' : '#d2cbcb', width: '20%', alignItems: 'center', display: 'flex' })
            .text('Tutti gli elementi:')
        );

        filtroInfoDiv.append(infoRow);

        newFiltroDiv.append(filtroInfoDiv);

        if(filtro == null){
            this.addCriterio(newFiltroDiv, null, hideButtonsForTracciato);
        }
        else{
            
            filtro.criteri.forEach(criterio => {
                me.addCriterio(newFiltroDiv, criterio, hideButtonsForTracciato);
            });

        }

        this.refreshNarrow(newFiltroDiv);


        if(alternativeBody != null){
            alternativeBody.append(newFiltroDiv);
        }
        else{
            //Aggiungiamo il nuovo filtro al bodyFiltri
            $('#bodyFiltri').append(newFiltroDiv);
        }

        //mandiamo la ricerca per il filtro
        var resRicerca = await me.ricercaFiltro(newFiltroDiv);
        if(hideButtonsForTracciato){
            aggiornaTracciatoPostRicerca(resRicerca);
            onResizeTab1Tracciato();
        }

        if (!hideNarrow){
            newFiltroDiv.find("sp-picker").each(function(){
                Utility.setPickerWidthHack($(this));
            })
        }
    },

    addCriterio(body, criterio = null, isTracciato = false) {
        let me = this;

        const isCampoData = (campoAssociato) => {
            if (!campoAssociato || campoAssociato.tendina) {
                return false;
            }

            if (campoAssociato.isData === true || campoAssociato.isDate === true || campoAssociato.date === true || campoAssociato.data === true) {
                return true;
            }

            const candidateValues = [
                campoAssociato.tipo,
                campoAssociato.tipoCampo,
                campoAssociato.tipoValori,
                campoAssociato.fieldType,
                campoAssociato.inputType,
                campoAssociato.formato,
                campoAssociato.format
            ].filter(v => v != null);

            return candidateValues.some((v) => {
                const normalized = String(v).trim().toLowerCase();
                return normalized === 'data'
                    || normalized === 'date'
                    || normalized === 'datetime'
                    || normalized === 'dataora';
            });
        };

        const toItalianDate = (value) => {
            if (value == null) {
                return '';
            }

            const normalized = String(value).trim();
            if (normalized === '') {
                return '';
            }

            const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
            if (isoMatch) {
                return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
            }

            const enMatch = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
            if (enMatch) {
                return enMatch[3] + '/' + enMatch[2] + '/' + enMatch[1];
            }

            const itMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (itMatch) {
                return itMatch[1] + '/' + itMatch[2] + '/' + itMatch[3];
            }

            return normalized;
        };

        const ensureDatePicker = (criterioContainer) => {
            let dateContainer = criterioContainer.find('.filtro-valore-data');
            if (dateContainer.length) {
                if (dateContainer.find('date-menu-picker').length > 0) {
                    Utility.registerDateMenuPicker(dateContainer.get(0));
                }
                return dateContainer;
            }

            const datePickerId = 'filtro-date-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
            dateContainer = $('<div></div>')
                .addClass('filtro-valore-data')
                .css({ width: (isTracciato ? '200px' : '30%'), maxWidth: '100%', minWidth: '0', marginRight: '10px', display: 'none' });

            const placeholder = $('<date-menu-picker></date-menu-picker>')
                .attr('id', datePickerId)
                .attr('label', '');

            dateContainer.append(placeholder);
            criterioContainer.find('.filtro-valore-hidden').before(dateContainer);

            Utility.registerDateMenuPicker(dateContainer.get(0));
            if (dateContainer.find('date-menu-picker').length > 0) {
                Utility.registerDateMenuPicker(criterioContainer.get(0));
            }

            const wrapper = dateContainer.find('#' + datePickerId);
            wrapper.find('sp-label').css({ display: 'none' });
            wrapper.css({ width: '100%', minWidth: '0' });

            wrapper.off('change.filtroDate').on('change.filtroDate', async function () {
                const valoreInput = $(this).closest('.criterio').find('.filtro-valore-hidden');
                const pickedDate = $(this).prop('value') || $(this).find('input').val() || '';
                valoreInput.val(toItalianDate(pickedDate));

                let filtro = $(this).closest('.filtro');
                var resRicerca = await me.ricercaFiltro(filtro);
                if (isTracciato) {
                    aggiornaTracciatoPostRicerca(resRicerca);
                }
            });

            return dateContainer;
        };

        const setDatePickerValue = (criterioContainer, value) => {
            const dateContainer = ensureDatePicker(criterioContainer);
            const wrapper = dateContainer.children().first();
            const safeValue = value == null ? '' : String(value);
            const safeItalianValue = toItalianDate(safeValue);

            const input = wrapper.find('input');
            if (input.length) {
                input.val(safeItalianValue);
            }

            criterioContainer.find('.filtro-valore-hidden').val(safeItalianValue);
        };

        const showDatePickerForCampo = (criterioContainer, value = '') => {
            const dateContainer = ensureDatePicker(criterioContainer);

            criterioContainer.find('.filtro-valore-tendina').css({ display: 'none' });
            criterioContainer.find('.filtro-valore-hidden').css({ display: 'none' });
            dateContainer.css({ display: 'block' });

            setDatePickerValue(criterioContainer, value);
        };

        const hideDatePicker = (criterioContainer) => {
            criterioContainer.find('.filtro-valore-data').css({ display: 'none' });
        };

        //Chiave, operatore e valore sulla stessa riga
        var criterioHtml = null;
        body.find('.filtro-narrow').before(
            criterioHtml = $('<div></div>')
                .addClass('criterio')
                .css({ display: 'flex', alignItems: 'center', marginTop: '5px', backgroundColor: isTracciato ? 'rgba(255,255,255,0.06)' : '', padding: '3px', borderRadius: '10px' })
                .append(
                    $('<label></label>')
                        .css({ marginRight: '10px' })
                )
                // .append(
                //     //inseriamo un'immagine "unlocked.png"
                //     $('<img>')
                //         .attr('src', criterio == null ? 'images/unlocked.png' : 'images/locked.png')
                //         .css({ width: '15px', height: '15px', marginRight: '10px', cursor: 'pointer' })
                //         .on('click', function () {
                //             //se cliccato cerchiamo tutti i select e tutte le textarea e, se sono disabilitati, li abilitiamo oppure viceversa
                //             //poi modifichiamo l'src di questa immagine in locked.png o unlocked.png a seconda dello stato
                //             const isDisabled = $(this).closest('.criterio').find('select, textarea').prop('disabled');
                //             $(this).closest('.criterio').find('select, textarea').prop('disabled', !isDisabled);
                //             $(this).closest('.criterio').find('sp-picker').prop('disabled', !isDisabled);
                //             $(this).attr('src', isDisabled ? 'images/unlocked.png' : 'images/locked.png');
                //         })
                // )
                //mettiamo un icona per copiare/incollare il filtro, se il criterio è appena stato creato di base c'è l'icona di incolla, appena qualcosa viene modificato diventa copia
                .append(
                    $('<img></img>')
                        .addClass('criterio-copy-icon')
                        .attr('src', criterio == null ? 'images/paste.png' : 'images/copy.png')
                        .css({ width: '20px', height: '20px', marginRight: '10px', cursor: 'pointer', backgroundColor: 'white', padding:'3px', borderRadius:'5px' })
                        .attr('title', criterio == null ? 'Incolla criterio filtro' : 'Copia criterio filtro')
                        .on('click', async function () {
                            const isPaste = $(this).attr('src').includes('paste.png');
                            if (isPaste) {
                                const criterioCopia = JSON.parse(localStorage.getItem('criterioCopia'));
                                if (criterioCopia) {
                                    // Imposta chiave picker e hidden
                                    Utility.setPickerValue(criterioHtml.find('.filtro-chiave'), criterioCopia.chiave, false);
                                    criterioHtml.find('.filtro-chiave-hidden').val(criterioCopia.chiaveHidden || criterioCopia.chiave);

                                    
                                    criterioHtml.find('.filtro-chiave').trigger('change');
                                    await Utility.sleep(10); // Attendi un momento per assicurarti che gli eventi di cambio siano gestiti
                                    // Se la chiave in tendina è '' allora nascondi la tendina chiave e mostra l'hidden
                                    if (criterioCopia.chiave === '' || criterioCopia.chiaveHidden === '') {
                                        criterioHtml.find('.filtro-chiave').css({ display: 'none' });
                                        criterioHtml.find('.filtro-chiave-hidden').css({ display: 'block' });
                                        // assicura che l'operatore sia visibile
                                        criterioHtml.find('.filtro-operatore').css({ display: 'block' });
                                    }
                                    // Trigger per mostrare/nascondere controlli in base alla chiave
                                    // Imposta operatore
                                    Utility.setPickerValue(criterioHtml.find('.filtro-operatore'), criterioCopia.operatore, false);

                                    // Imposta valore hidden
                                    criterioHtml.find('.filtro-valore-hidden').val(criterioCopia.valore);


                                    // Imposta valore tendina (se presente) oppure campo testo
                                    const campoAssociato = pluginMiddleware.getCampo("campiFiltro").find(c => c.campoAssociato === (criterioCopia.chiaveHidden || criterioCopia.chiave));
                                    if (campoAssociato && isCampoData(campoAssociato)) {
                                        criterioHtml.find('.filtro-valore-tendina').css({ display: 'none' });
                                        showDatePickerForCampo(criterioHtml, criterioCopia.valore);
                                    } else if (campoAssociato && campoAssociato.tendina) {
                                        const valoreTendina = criterioCopia.valoreTendina != null ? criterioCopia.valoreTendina : criterioCopia.valore;

                                        // Se il valore tendina è '', nascondi la tendina e mostra l'hidden
                                        if (valoreTendina === '') {
                                            criterioHtml.find('.filtro-valore-tendina').css({ display: 'none' });
                                            criterioHtml.find('.filtro-valore-hidden').css({ display: 'block' });
                                            hideDatePicker(criterioHtml);
                                        } else {
                                            Utility.setPickerValue(criterioHtml.find('.filtro-valore-tendina'), valoreTendina, false);
                                            // se impostiamo la tendina, assicuriamoci che l'hidden sia nascosto
                                            criterioHtml.find('.filtro-valore-hidden').css({ display: 'none' });
                                            criterioHtml.find('.filtro-valore-tendina').css({ display: 'block' });
                                            hideDatePicker(criterioHtml);
                                        }
                                    } else {
                                        criterioHtml.find('.filtro-valore-hidden').css({ display: 'block' });
                                        criterioHtml.find('.filtro-valore-tendina').css({ display: 'none' });
                                        hideDatePicker(criterioHtml);
                                    }

                                    // Cambia icona in copia
                                    $(this).attr('src', 'images/copy.png');
                                    $(this).attr('title', 'Copia criterio filtro');
                                } else {
                                    Utility.popup('Errore', 'Nessun criterio copiato trovato.');
                                }
                            } else {
                                // Copia il criterio includendo chiave hidden e valore tendina
                                try{
                                    var $hidden = criterioHtml.find('.filtro-chiave-hidden');
                                    var isHidden = $hidden.css('display') === 'none';
                                    // Copia il criterio includendo chiave hidden e valore tendina
                                    var chiave = !isHidden ? '' : criterioHtml.find('.filtro-chiave').val();
                                    var chiaveHidden = criterioHtml.find('.filtro-chiave-hidden').val();
                                    var operatore = criterioHtml.find('.filtro-operatore').val();
                                    var valoreHidden = criterioHtml.find('.filtro-valore-hidden').val();
                                    var valoreTendina = criterioHtml.find('.filtro-valore-tendina').val();
                                    const criterioDaCopiare = {
                                        chiave: chiave,
                                        chiaveHidden: chiaveHidden,
                                        operatore: operatore,
                                        valore: valoreHidden,
                                        valoreTendina: valoreTendina
                                    };
                                    console.log('Criterio copiato:', criterioDaCopiare);
                                    localStorage.setItem('criterioCopia', JSON.stringify(criterioDaCopiare));
                                }
                                catch(e){
                                    console.error('Errore durante la copia del criterio:', e);
                                }
                            }
                        })
                )
                .append(
                    //$('<select '+ (criterio == null ? '' : 'disabled' ) +'></select>')
                    $('<sp-picker maxWidth="300px" minWidth="200px"></sp-picker>')
                        .addClass('filtro-chiave')
                        .css({ width: '200px', marginRight: '10px', fontSize:'10px' })
                        .attr('title', 'Scegli il parametro di ricerca') // Tooltip aggiunto
                        .on('change', async function (e) {
                            const criterioCorrente = $(this).closest('.criterio');
                            const valoreInput = criterioCorrente.find('.filtro-valore-hidden');
                            const chiaveHidden = criterioCorrente.find('.filtro-chiave-hidden');
                            const pickerRawValue = String($(this).val() || '').trim();
                            const campiFiltro = pluginMiddleware.getCampo("campiFiltro") || [];

                            let selectedValue = pickerRawValue;
                            if (selectedValue !== '' && selectedValue !== 'Impagina tutto' && selectedValue !== 'Valore Libero') {
                                const campoByLabel = campiFiltro.find(c => c.nomeCampoVisualizzato === selectedValue);
                                if (campoByLabel != null) {
                                    selectedValue = campoByLabel.campoAssociato;
                                }
                            }

                            if (selectedValue === 'Valore Libero') {
                                valoreInput.val('');
                                chiaveHidden.val('');
                                //nascondiamo la tendina e mostriamo il campo di testo
                                $(this).css({ display: 'none' });
                                valoreInput.css({ display: 'block' });
                                chiaveHidden.css({ display: 'block' });
                                criterioCorrente.find('.filtro-operatore').css({ display: 'block' });


                                //nascondiamo la tendina e mostriamo il campo di testo
                                criterioCorrente.find('.filtro-valore-tendina').css({ display: 'none' });
                                hideDatePicker(criterioCorrente);
                            } else if (selectedValue === 'Impagina tutto') {
                                //facciamo sparire i campi tendina del val e dell'operatore
                                //nei campi hidden della chiave scriviamo "Referenza.Codice" e nel campo valore hidden scriviamo "999999999999999999999999999999999999999999999999999"
                                //l'operatore lo impostiamo a "!="

                                //nascondiamo il filtro-valore-tendina e il filtro-operatore
                                criterioCorrente.find('.filtro-valore-tendina').css({ display: 'none' });
                                criterioCorrente.find('.filtro-operatore').css({ display: 'none' });
                                hideDatePicker(criterioCorrente);

                                valoreInput.val('999999999999999999999999999999999999999999999999999');
                                chiaveHidden.val('Referenza.Codice');

                                //impostiamo il filtro-operatore                                
                                Utility.setPickerValue(criterioCorrente.find('.filtro-operatore'), "!=", false);

                            } else {
                                // Popola il campo 
                                valoreInput.val('');
                                chiaveHidden.val(selectedValue);
                                // valore in base alla chiave selezionata
                                const campoAssociato = campiFiltro.find(c => c.campoAssociato === selectedValue);
                                criterioCorrente.find('.filtro-operatore').css({ display: 'block' });

                                if (campoAssociato != null && isCampoData(campoAssociato)) {
                                    showDatePickerForCampo(criterioCorrente, '');
                                }
                                else if (campoAssociato != null && campoAssociato.tendina) {
                                    // mostriamo la tendina e nascondiamo il campo di testo
                                    criterioCorrente.find('.filtro-valore-tendina').css({ display: 'block' });
                                    valoreInput.css({ display: 'none' });
                                    hideDatePicker(criterioCorrente);

                                    // cerchiamo il .filtro-valore, svuotiamo le option della tendina e le popoliamo con i valori trovati in trovaValoriPerTendinaValueDelFiltro
                                    const valoriTrovati = filtri.trovaValoriPerTendinaValueDelFiltro(campoAssociato.campoAssociato, campoAssociato.scope);
                                    const filtroValoreSelect = criterioCorrente.find('.filtro-valore-tendina').find("sp-menu");
                                    filtroValoreSelect.empty();
                                    filtroValoreSelect.append(
                                        //$('<option></option>').text('Seleziona Valore').val('')
                                        $('<sp-menu-item selected></sp-menu-item>').text('Seleziona Valore').val('').css({ fontSize:'10px' })
                                    );
                                    filtroValoreSelect.append(
                                        $('<sp-menu-item></sp-menu-item>').text('Valore Libero').val('Valore Libero').css({ fontSize:'10px' })
                                    );
                                    valoriTrovati.forEach(valore => {
                                        filtroValoreSelect.append(
                                            $('<sp-menu-item></sp-menu-item>').text(valore.toString()===""?"[VUOTO]":valore.toString()).val(valore.toString()).css({ fontSize:'10px' })
                                        );
                                    });
                                }
                                else{
                                    //nascondiamo la tendina e mostriamo il campo di testo
                                    criterioCorrente.find('.filtro-valore-tendina').css({ display: 'none' });
                                    valoreInput.css({ display: 'block' });
                                    hideDatePicker(criterioCorrente);
                                }


                            }
                            let filtro = $(this).closest('.filtro');
                            var resRicerca = await me.ricercaFiltro(filtro);
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                            }

                            //cambiamo l'icona in copia
                            $(this).closest('.criterio').find('.criterio-copy-icon').attr('src', 'images/copy.png');
                            $(this).closest('.criterio').find('.criterio-copy-icon').attr('title', 'Copia criterio filtro'); // Aggiorna tooltip

                        })
                        .on('wheel', function (e) {
                            console.log('wheel');
                            console.log(e);
                            if (document.activeElement === this) {
                                e.preventDefault();
                            }
                        })
                        .append(
                            $('<sp-menu slot="options" style="white-space:nowrap;"></sp-menu>')
                            
                            // Solo se isTracciato è false aggiungi "Impagina tutto"
                            .append(
                                $('<sp-menu-item selected></sp-menu-item>').text('Seleziona valore').val('').css({ fontSize:'10px' })
                            )
                            .append(
                                !isTracciato
                                    ? $('<sp-menu-item></sp-menu-item>').text('Impagina tutto').val('Impagina tutto').css({ fontSize:'10px' })
                                    : ""
                            )
                            .append(
                                pluginMiddleware.getCampo("campiFiltro").map(campo =>
                                    
                                    $('<sp-menu-item></sp-menu-item>')
                                        .text(campo.nomeCampoVisualizzato)
                                        .val(campo.campoAssociato)
                                        .css({ fontSize:'10px' })
                                )
                            )
                            .append(
                                //$('<option selected></option>').text('Valore Libero').val('Valore Libero')
                                $('<sp-menu-item></sp-menu-item>').text('Valore Libero').val('Valore Libero').css({ fontSize:'10px' })
                            )

                        )                        

                )
                //appendiamo un hidden che conterrà il val della chiave selezionata
                .append(
                    $('<textarea></textarea>')
                        .addClass('filtro-chiave-hidden hideble')
                        .attr('title', 'Scrivi il parametro di ricerca') // Tooltip aggiunto
                        .val('')
                        .css({ width: (isTracciato?'200px':'30%'), height:'30px', marginRight: '10px', caretColor: 'black', display: 'none' , color: 'lightblue' }) // Nascondiamo la textarea
                        .on('change', async function () {
                            let filtro = $(this).closest('.filtro');
                            var resRicerca = await me.ricercaFiltro(filtro);
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                            }
                        })
                )
                .append(
                    $('<label></label>')
                        .css({ marginRight: '10px' })
                )
                .append(
                    //$('<select '+ (criterio == null ? '' : 'disabled' ) +'></select>')
                    $('<sp-picker maxWidth="100px" minWidth="100px"></sp-picker>')
                        .addClass('filtro-operatore')
                        .css({ width: '100px', marginRight: '10px' })
                        .attr('title', 'Scegli l\'operatore per definire il tipo di confronto') // Tooltip aggiunto
                        .on('change', async function (e) {
                            //let val = e.target.selectedOptions[0]._properties.values().next().value;
                            //criterioHtml.find('.filtro-operatore').val(val);

                            let filtro = $(this).closest('.filtro');
                            var resRicerca = await me.ricercaFiltro(filtro);
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                            }
                        })
                        .on('wheel', function (e) {
                            if (document.activeElement === this) {
                                e.preventDefault();
                            }
                        })
                        .append(
                            $('<sp-menu slot="options" style="white-space:nowrap;"></sp-menu>') 
                            .append(
                                $('<sp-menu-item selected></sp-menu-item>').text('=').val('=').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('NO =').val('!=').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('IN').val('IN').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('NO IN').val('!IN').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('>').val('>').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('>=').val('>=').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('<').val('<').css({ fontSize:'10px' })
                            )
                            .append(
                                $('<sp-menu-item></sp-menu-item>').text('<=').val('<=').css({ fontSize:'10px' })
                            )
                        )
                       
                        

                )
                .append(
                    $('<label></label>')
                        .css({ marginRight: '10px' })
                )
                .append(
                    //$('<select '+ (criterio == null ? '' : 'disabled' ) +'></select>')
                    $('<sp-picker maxWidth="300px" minWidth="200px"></sp-picker>')
                        .addClass('filtro-valore-tendina')
                        .css({ width: '200px', marginRight: '10px', fontSize:'10px' })
                        .attr('title', 'Scegli il valore cercato') // Tooltip aggiunto
                        .on('change', async function (e) {
                            //console.log(e.target.selectedOptions[0]._properties);
                            //let val = e.target.selectedOptions[0]._properties.values().next().value;
                            //criterioHtml.find('.filtro-valore-tendina').val(val);

                            
                            const selectedValue = $(this).val();
                            const valoreInput = $(this).closest('.criterio').find('.filtro-valore-hidden');
                            if (selectedValue === 'Valore Libero') {
                                valoreInput.val('');
                                //nascondiamo la tendina e mostriamo il campo di testo
                                $(this).css({ display: 'none' });
                                valoreInput.css({ display: 'block' });
                                $(this).closest('.criterio').find('.filtro-operatore').css({ display: 'block' });
                                
                            }
                            
                            $(this).closest('.criterio').find('.filtro-valore-hidden').val(selectedValue);
                            var resRicerca = await me.ricercaFiltro($(this).closest('.filtro'));
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                            }
                            
                        })
                        .on('wheel', function (e) {
                            if (document.activeElement === this) {
                                e.preventDefault();
                            }
                        })
                        .append($('<sp-menu slot="options" style="white-space:nowrap;"></sp-menu>'))
                )
                .append(
                    $('<textarea></textarea>')
                        .addClass('filtro-valore-hidden hideble')
                        .attr('title', 'Scrivi il valore da cercare') // Tooltip aggiunto
                        .val('')
                        .css({ width: (isTracciato?'200px':'30%'), height:'30px', marginRight: '10px' ,display: 'none', color: 'lightblue' }) // Nascondiamo il campo di testo
                        .on('keyup', async function () {
                            let filtro = $(this).closest('.filtro');
                            var resRicerca = await me.ricercaFiltro(filtro);
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                            }
                        })
                )
                .append(
                    $('<button></button>')
                        .html('&times;') // X di chiusura
                        .css({
                            backgroundColor: 'red',
                            color: 'white',
                            border: 'none',
                            padding: '5px',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            textAlign: 'center',
                            lineHeight: '15px',
                            fontSize: '12px'
                        })
                        .on('click', async function () {
                            let filtro = $(this).closest('.filtro');
                            $(this).closest('.criterio').remove(); // Rimuove il criterio dalla UI

                            var resRicerca = await me.ricercaFiltro(filtro);
                            if(isTracciato){
                                aggiornaTracciatoPostRicerca(resRicerca);
                                onResizeTab1Tracciato();
                            }
                        })
                )
        );

        if(criterio != null){
            //se criterio non è null, significa che stiamo modificando un criterio esistente, quindi dobbiamo popolare i campi con i valori del criterio
            criterioHtml.find('.filtro-chiave-hidden').val(criterio.chiave);
            //criterioHtml.find('.filtro-valore-hidden').text(criterio.chiave);

            let filtroOperatore = criterioHtml.find('.filtro-operatore');
            Utility.setPickerValue(filtroOperatore, criterio.operatore, false);
            let filtroChiave = criterioHtml.find('.filtro-chiave');
            let filtroValore = criterioHtml.find('.filtro-valore-tendina');

            const campoAssociato = pluginMiddleware.getCampo("campiFiltro").find(c => c.campoAssociato === criterio.chiave);
            let impaginaTutto = false;
            if(criterio.chiave == 'Referenza.Codice' && criterio.operatore == '!=' && criterio.valore == '999999999999999999999999999999999999999999999999999')
            {
                impaginaTutto = true;
            }
            if (campoAssociato != null || impaginaTutto) {
                //criterioHtml.find('.filtro-chiave').val(impaginaTutto ? "Impagina tutto" : criterio.chiave);
                Utility.setPickerValue(filtroChiave, impaginaTutto ? "Impagina tutto" : criterio.chiave, false);
                if(impaginaTutto) {
                    //nascondiamo la tendina e mostriamo il campo di testo
                    criterioHtml.find('.filtro-valore-tendina').css({ display: 'none' });
                    criterioHtml.find('.filtro-valore-hidden').css({ display: 'none' });
                    criterioHtml.find('.filtro-valore-hidden').val(criterio.valore);
                    criterioHtml.find('.filtro-operatore').css({ display: 'none' });
                }
                else if (campoAssociato.tendina) {
                    // mostriamo la tendina e nascondiamo il campo di testo
                    criterioHtml.find('.filtro-valore-tendina').css({ display: 'block' });
                    criterioHtml.find('.filtro-valore-hidden').css({ display: 'none' });

                    // cerchiamo il .filtro-valore, svuotiamo le option della tendina e le popoliamo con i valori trovati in trovaValoriPerTendinaValueDelFiltro
                    const valoriTrovati = filtri.trovaValoriPerTendinaValueDelFiltro(campoAssociato.campoAssociato);
                    //const filtroValoreSelect = criterioHtml.find('.filtro-valore-tendina');
                    const filtroValoreSelect = criterioHtml.find('.filtro-valore-tendina').find("sp-menu");
                    filtroValoreSelect.empty();
                    filtroValoreSelect.append(
                        //$('<option></option>').text('Seleziona Valore').val('')
                        $('<sp-menu-item></sp-menu-item>').text('Seleziona Valore').val('')
                    );
                    filtroValoreSelect.append(
                        $('<sp-menu-item></sp-menu-item>').text('Valore Libero').val('Valore Libero')
                    );
                    valoriTrovati.forEach(valore => {
                        filtroValoreSelect.append(
                            $('<sp-menu-item></sp-menu-item>').text(valore).val(valore)
                        );
                    });
                    if (criterio.valore != null && criterio.valore !== '') {
                        //controlliamo se il valore è presente nella tendina
                        //if (filtroValoreSelect.find(`option[value="${criterio.valore}"]`).length) {
                        if (filtroValoreSelect.find(`sp-menu-item[value="${criterio.valore}"]`).length) {
                            //criterioHtml.closest('.criterio').find('.filtro-valore-tendina').val(criterio.valore);
                            Utility.setPickerValue(filtroValore, criterio.valore, false);
                        }
                        else{
                            criterioHtml.closest('.criterio').find('.filtro-valore-tendina').css({ display: 'none' });
                            criterioHtml.closest('.criterio').find('.filtro-valore-hidden').css({ display: 'block' });
                            criterioHtml.closest('.criterio').find('.filtro-valore-hidden').val(criterio.valore);
                        }
                        // criterioHtml.find('.filtro-valore-tendina option').each(function () {
                        //     if ($(this).val() === criterio.valore) {
                        //       $(this).prop('selected', true);
                        //     } else {
                        //       $(this).prop('selected', false);
                        //     }
                        //   });
                    }
                    criterioHtml.closest('.criterio').find('.filtro-valore-hidden').val(criterio.valore);
                    hideDatePicker(criterioHtml.closest('.criterio'));
                }
                else if (isCampoData(campoAssociato)) {
                    showDatePickerForCampo(criterioHtml.closest('.criterio'), criterio.valore);
                }
                else {
                    //nascondiamo la tendina e mostriamo il campo di testo
                    criterioHtml.closest('.criterio').find('.filtro-valore-tendina').css({ display: 'none' });
                    criterioHtml.closest('.criterio').find('.filtro-valore-hidden').css({ display: 'block' });
                    criterioHtml.closest('.criterio').find('.filtro-valore-hidden').val(criterio.valore);
                    hideDatePicker(criterioHtml.closest('.criterio'));
                }
            }
            else {
                //nascondiamo la tendina e mostriamo il campo di testo
                criterioHtml.closest('.criterio').find('.filtro-valore-tendina').css({ display: 'none' });
                criterioHtml.closest('.criterio').find('.filtro-valore-hidden').css({ display: 'block' });
                criterioHtml.closest('.criterio').find('.filtro-valore-hidden').val(criterio.valore);
                hideDatePicker(criterioHtml.closest('.criterio'));


                criterioHtml.closest('.criterio').find('.filtro-chiave').css({ display: 'none' });
                criterioHtml.closest('.criterio').find('.filtro-chiave-hidden').css({ display: 'block' });
                criterioHtml.closest('.criterio').find('.filtro-chiave-hidden').val(criterio.chiave);
                
            }

        }

        // Stato finale UI criterio: se la chiave e' di tipo data, il date picker deve restare visibile.
        const chiaveFinale = criterioHtml.find('.filtro-chiave-hidden').val();
        const campoFinale = pluginMiddleware.getCampo("campiFiltro").find(c => c.campoAssociato === chiaveFinale);
        if (isCampoData(campoFinale)) {
            showDatePickerForCampo(criterioHtml, criterioHtml.find('.filtro-valore-hidden').val());
        }


        if (!isTracciato){
            criterioHtml.find("sp-picker").each(function(){
                Utility.setPickerWidthHack($(this));
            });
        }

        if(isTracciato){
            onResizeTab1Tracciato();
        }

        this.refreshNarrow(body);
    },

    creaPickerTemplateFiltro(templates, onTemplateSelected) {
        const picker = $("<sp-picker></sp-picker>")
            .attr("maxwidth", "300px")
            .attr("minwidth", "200px")
            .addClass("filtro-template-picker")
            .css({
                fontSize: "10px",
                width: "220px"
            })
            .attr("title", "Scegli template filtro");

        const menu = $("<sp-menu></sp-menu>")
            .attr("slot", "options")
            .css({
                whiteSpace: "nowrap"
            });

        menu.append(
            $("<sp-menu-item></sp-menu-item>")
                .attr("selected", "")
                .attr("value", "")
                .css({ fontSize: "10px" })
                .text("Seleziona template")
        );

        for (let i = 0; i < templates.length; i++) {
            menu.append(
                $("<sp-menu-item></sp-menu-item>")
                    .attr("value", i.toString())
                    .css({ fontSize: "10px" })
                    .text(templates[i].nomeTemplate)
            );
        }

        picker.append(menu);

        picker.on("change", function () {
            const selectedValue = $(this).val();

            if (selectedValue === "" || selectedValue == null)
                return;

            const selectedIndex = parseInt(selectedValue);
            const template = templates[selectedIndex];

            if (template == null)
                return;

            Utility.chiudiFloatingMenu();

            if (onTemplateSelected != null)
                onTemplateSelected(template);
        });

        return picker;
    },

    async applicaTemplateFiltro(bodyFiltro, template, isTracciato = false) {
        if (template == null || template.criteri == null || template.criteri.length === 0)
            return;

        for (let i = 0; i < template.criteri.length; i++) {
            this.addCriterio(bodyFiltro, template.criteri[i], isTracciato);
        }

        this.refreshNarrow(bodyFiltro);

        const resRicerca = await this.ricercaFiltro(bodyFiltro);

        if (isTracciato) {
            aggiornaTracciatoPostRicerca(resRicerca);
            onResizeTab1Tracciato();
        }
    },

    async apriMenuTemplateFiltri(e, bodyFiltro, isTracciato = false) {
        e.preventDefault();
        e.stopPropagation();

        try {
            const templates = await pluginMiddleware.getTemplateFiltri();

            if (templates == null || templates.length === 0) {
                messaggioUtente("Nessun template filtro disponibile", "warning");
                return;
            }

            const picker = this.creaPickerTemplateFiltro(
                templates,
                async (template) => {
                    await this.applicaTemplateFiltro(bodyFiltro, template, isTracciato);
                }
            );

            Utility.creaFloatingMenu({
                x: e.clientX,
                y: e.clientY,
                content: picker,
                className: "floating-menu-template-filtri"
            });

            Utility.setPickerWidthHack(picker);
        }
        catch (err) {
            console.error(err);
            messaggioUtente("Errore durante il caricamento dei template filtro", "error");
        }
    },

    refreshNarrow(filtroDiv)
    {
        const isCampoData = (campoAssociato) => {
            if (!campoAssociato || campoAssociato.tendina) {
                return false;
            }

            if (campoAssociato.isData === true || campoAssociato.isDate === true || campoAssociato.date === true || campoAssociato.data === true) {
                return true;
            }

            const candidateValues = [
                campoAssociato.tipo,
                campoAssociato.tipoCampo,
                campoAssociato.tipoValori,
                campoAssociato.fieldType,
                campoAssociato.inputType,
                campoAssociato.formato,
                campoAssociato.format
            ].filter(v => v != null);

            return candidateValues.some((v) => {
                const normalized = String(v).trim().toLowerCase();
                return normalized === 'data'
                    || normalized === 'date'
                    || normalized === 'datetime'
                    || normalized === 'dataora';
            });
        };

        const toItalianDate = (value) => {
            if (value == null) {
                return '';
            }

            const normalized = String(value).trim();
            if (normalized === '') {
                return '';
            }

            const enMatch = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
            if (enMatch) {
                return enMatch[3] + '/' + enMatch[2] + '/' + enMatch[1];
            }

            return normalized;
        };

        let narrazione="";

        let count=0;
        filtroDiv.find('.criterio').each(function () {
            let chiave = $(this).find('.filtro-chiave-hidden').val();
            let operatore = $(this).find('.filtro-operatore').val();
            let valoreTendina = $(this).find('.filtro-valore-hidden').val();
            const campoAssociato = pluginMiddleware.getCampo("campiFiltro").find(c => c.campoAssociato === chiave);
            const valoreVisualizzato = isCampoData(campoAssociato) ? toItalianDate(valoreTendina) : valoreTendina;

            if (count>0)
                narrazione += " +  ";
            // Aggiungiamo il criterio solo se la chiave è selezionata
            if (chiave!="")
            {
                if (operatore == "IN" || operatore == "!IN")
                {
                    narrazione += "<b>"+ (valoreVisualizzato==""?"<VUOTO>":valoreVisualizzato)  + " " + Utility.getLetturaFacilitataDellaParola(operatore) + " " + chiave + "</b>";
                }
                else
                {
                    narrazione +=  "<b>"+ chiave + " " + Utility.getLetturaFacilitataDellaParola(operatore) + " " + (valoreVisualizzato==""?"<VUOTO>":valoreVisualizzato) + "</b>";
                }

                count++;
            }

        });

        filtroDiv.find(".filtro-narrow").html(narrazione);
    },

    trovaValoriPerTendinaValueDelFiltro(chiave, scope = null){
        let listaTracciato = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
        if(listaTracciato == null){
            messaggioUtente("Code FLT-01 Lista non scaricata, si consiglia di scaricarla dalla schermata home per accedere alle informazioni delle corrispondenze filtro", "warning");
            return [];
        }
        //nel file scaricato troveremo la chiave records (lista), noi dobbiamo controllore in ogni lista il suo recordInTracciato e cercare la chiave (stringa)
        //usando [chiave]. Poi compon iamo un hash con tutti i risultati trovati e lo stampiamo in un array
        let valoriTrovati = new Set();
        listaTracciato.records.forEach(record => {
            if (record.recordInTracciato) {
                if (scope != null) {
                    //percorriamo lo scope per cercare al suo termine la chiave, lo scope è una stringa ad esempio "rev.prova"
                    //inoltre può presentare la dicitura "rev.prova||" in quel caso facciamo uno spli per || e ogni risultato è uno scope da provare in ordine finchè non troviamo il primo valido
                    //un risultato di split di "" indica che lo scope è null
                    let possibleScopes = scope.split('||');
                    let trovato = false;
                    for (let posScope of possibleScopes) {
                        let currentRecord = record.recordInTracciato;
                        let parts = posScope.split('.');
                        for (let part of parts) {
                            if (part != "") {
                                if (currentRecord[part] !== undefined) {
                                    currentRecord = currentRecord[part];
                                } else {
                                    currentRecord = null;
                                    break;
                                }
                            }
                        }

                        for (let part of chiave.split('||')) {
                            if (part != "") {
                                if (currentRecord && currentRecord[part] !== undefined) {

                                    //se il valore è un array, lo aggiungiamo tutto, altrimenti lo aggiungiamo come stringa
                                    if (Array.isArray(currentRecord[part])) {
                                        currentRecord[part].forEach(valore => {
                                            valoriTrovati.add(valore);
                                        });
                                    } else {
                                        valoriTrovati.add(currentRecord[part]);
                                    }
                                    trovato = true;
                                }
                                else if (posScope == possibleScopes[possibleScopes.length - 1]) {
                                    valoriTrovati.add("");
                                }
                            }
                        }

                        if (trovato) {
                            break; // usciamo dal ciclo for non appena troviamo un valore valido
                        }

                    }
                }
                else {
                    for (let part of chiave.split('||')) {
                        if (part != "") {
                            if (record.recordInTracciato[part] != undefined) {
                                //se il valore è un array, lo aggiungiamo tutto, altrimenti lo aggiungiamo come stringa
                                if (Array.isArray(record.recordInTracciato[part])) {
                                    record.recordInTracciato[part].forEach(valore => {
                                        valoriTrovati.add(valore);
                                    });
                                } else {
                                    valoriTrovati.add(record.recordInTracciato[part]);
                                }
                            }
                            else {
                                valoriTrovati.add("");
                            }
                        }
                    }
                }

            }
        });

        let valoriTrovatiArray = Array.from(valoriTrovati);
        if (chiave === "etichetteVisual") {
            valoriTrovati = pluginMiddleware.applicaSchemaDiOrdinamentoConPesi(
                valoriTrovatiArray,
                "",
                "etichetteRef"
            );
        }
        //convertiamo il set in un array e lo ritorniamo
        return valoriTrovatiArray;
    },

    salvaFiltri(){
        let pagina = $('#dialogFiltri').data('pagina');

        let me = this;

        //prendiamo i filtri dal bodyFiltri, per ogni filtro prendiamo il limite e i criteri
        const filtri_arr = [];
        let ordine = 0;
        $('#bodyFiltri .filtro').each(function () {
            ordine++;
            let limite = $(this).find('input[type="number"]').val();
            let criteri = [];
            $(this).find('.criterio').each(function () {
                let chiave = $(this).find('.filtro-chiave-hidden').val();
                let operatore = $(this).find('.filtro-operatore').val();
                let valoreTendina = $(this).find('.filtro-valore-hidden').val();

                // Aggiungiamo il criterio solo se la chiave è selezionata
                if (chiave && operatore!=null) {
                    criteri.push({
                        chiave: chiave,
                        operatore: operatore,
                        valore: valoreTendina
                    });
                }
            });

            // Aggiungiamo il filtro solo se ha criteri
            if (criteri.length > 0) {
                filtri_arr.push({
                    limite: parseInt(limite),
                    ordine: ordine, // Ordine da gestire in futuro
                    criteri: criteri
                });
            }
        });

        // Leggiamo il file Filtri.json

        const ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
        if (!ObjFiltri || !ObjFiltri.source) {
            // Se il file non esiste, creiamo una nuova struttura
            ObjFiltri = { source: [] };
        }
        // Troviamo la pagina esistente o creiamo una nuova
        let paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
        //calcoliamo il limite della pagina, è pari alla somma dei limiti di tutti i filtri
        let limiteTotale = "";
        let count = 0;
        filtri_arr.forEach(filtro => {
            if (filtro.limite === 0) {
                if( count > 0){
                    limiteTotale += " + ";
                }
                limiteTotale += "Ill.";
            }
            else{
                if( count > 0){
                    limiteTotale += " + ";
                }
                limiteTotale += filtro.limite;
            }
            count++;
        });
        if (!paginaFiltri) {
            paginaFiltri = { pagina: pagina, filtri: [], active:true, limite: limiteTotale, blocco: false };
            ObjFiltri.source.push(paginaFiltri);
        }
        else {
            paginaFiltri.limite = limiteTotale; // Aggiorniamo il limite della pagina
        }
        // Aggiorniamo i filtri della pagina
        paginaFiltri.filtri = filtri_arr;

        //se l'ordine corrente è 999 e ci sono filtri allora aggiorniamo l'ordine al massimo ordine +1
        if (paginaFiltri.ordine === 999 && !paginaFiltri.blocco && filtri_arr.length > 0) {
            const ordiniValidi = ObjFiltri.source
                .map(item => item.ordine)
                .filter(ordine => typeof ordine === 'number' && ordine !== 999);
            let maxOrdine = ordiniValidi.length ? Math.max(...ordiniValidi) : 0;

            paginaFiltri.ordine = maxOrdine + 1;
        }

        if (filtri.length === 0) {
            let ordineCorrente = paginaFiltri.ordine;
            ObjFiltri.source.forEach(item => {
                if (item.pagina != pagina && item.ordine != 999 && item.ordine > ordineCorrente) {
                    item.ordine--;
                }
            });
            paginaFiltri.ordine = 999;
        }
        // Salviamo il file Filtri.json
        fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));    

        this.visualizzaHomePageFiltri();

        Utility.chiudiModal();
    },

    getNomeFileFiltriJson(){
        var controlloNomeFile = false;
        if (pluginMiddleware.getCampo("controlloNomeFileFiltri") !== null) {
            controlloNomeFile = pluginMiddleware.getCampo("controlloNomeFileFiltri");
        }

        var nomeFileSenzaEstensione = docInLavorazione.name.replace(/\.[^/.]+$/, "");

        if (!controlloNomeFile) {
            nomeFileSenzaEstensione = "";
        }
        return pathLavorazione + "/Filtri" + nomeFileSenzaEstensione + ".json";
    },

    bloccaSblocca(){
        let pagina = $('#dialogFiltri').data('pagina');
        //leggiamo il file Filtri.json

        const ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
        if (!ObjFiltri || !ObjFiltri.source) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }
        //cerchiamo la pagina corrispondente
        const paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
        if (!paginaFiltri) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }
        //se la pagina è bloccata, la sblocchiamo, altrimenti la blocchiamo
        paginaFiltri.blocco = !paginaFiltri.blocco;
        //dobbiamo aggiornare il valore dell'ordine
        //se la pagina è stata bloccata l'ordine diventa 999
        //se la pagina è stata sblocccata e c'è almeno un filtro a quella pagina allora l'ordine diventa uguale all'ordine massimo+1
        if (paginaFiltri.blocco) {
            //se l'ordine attuale è diverso da 999 troviamo tutti gli elementi con ordine maggiore di questo e li decrementiamo di 1
            if (paginaFiltri.ordine != 999) {
                let ordineCorrente = paginaFiltri.ordine;
                ObjFiltri.source.forEach(item => {
                    if (item.pagina != pagina && item.ordine != 999 && item.ordine > ordineCorrente) {
                        item.ordine--;
                    }
                });
            }
            paginaFiltri.ordine = 999;
        } else {
            if (paginaFiltri.filtri.length > 0) {
                const ordiniValidi = ObjFiltri.source
                    .map(item => item.ordine)
                    .filter(ordine => typeof ordine === 'number' && ordine !== 999);

                const maxOrdine = ordiniValidi.length ? Math.max(...ordiniValidi) : 0;
                paginaFiltri.ordine = maxOrdine + 1;
            }
        }


        //salviamo il file Filtri.json
        fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
        
        //se abbiamo appena bloccato la pagina nascondiamo bodyFiltri e mostriamo lockIcon oppure viceversa
        if (paginaFiltri.blocco) {
            $('#bodyFiltri').hide();
            $('#buttonsFiltri').hide();
            $('#lockIcon').show();
        } else {
            $('#bodyFiltri').show();
            $('#buttonsFiltri').show();
            $('#lockIcon').hide();
        }


        this.visualizzaHomePageFiltri();
    },

    async ricercaFiltro(filtro){
        try{

            const isCampoData = (campoAssociato) => {
                if (!campoAssociato || campoAssociato.tendina) {
                    return false;
                }

                if (campoAssociato.isData === true || campoAssociato.isDate === true || campoAssociato.date === true || campoAssociato.data === true) {
                    return true;
                }

                const candidateValues = [
                    campoAssociato.tipo,
                    campoAssociato.tipoCampo,
                    campoAssociato.tipoValori,
                    campoAssociato.fieldType,
                    campoAssociato.inputType,
                    campoAssociato.formato,
                    campoAssociato.format
                ].filter(v => v != null);

                return candidateValues.some((v) => {
                    const normalized = String(v).trim().toLowerCase();
                    return normalized === 'data'
                        || normalized === 'date'
                        || normalized === 'datetime'
                        || normalized === 'dataora';
                });
            };

            const toItalianDateString = (value) => {
                if (value == null) {
                    return null;
                }

                const raw = String(value).trim();
                if (raw === '') {
                    return null;
                }

                const slashDmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[T\s].*)?$/);
                if (slashDmy) {
                    return slashDmy[1] + '/' + slashDmy[2] + '/' + slashDmy[3];
                }

                const slashYmd = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:[T\s].*)?$/);
                if (slashYmd) {
                    return slashYmd[3] + '/' + slashYmd[2] + '/' + slashYmd[1];
                }

                const isoPrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
                if (isoPrefix) {
                    return isoPrefix[3] + '/' + isoPrefix[2] + '/' + isoPrefix[1];
                }

                // Fallback solo su timestamp ISO-like per evitare ambiguita locale su dd/mm/yyyy.
                const parsed = new Date(raw);
                if (!Number.isNaN(parsed.getTime())) {
                    const day = String(parsed.getDate()).padStart(2, '0');
                    const month = String(parsed.getMonth() + 1).padStart(2, '0');
                    const year = String(parsed.getFullYear());
                    return day + '/' + month + '/' + year;
                }

                return null;
            };

            const parseItalianComparable = (value) => {
                const itDate = toItalianDateString(value);
                if (itDate == null) {
                    return null;
                }

                const parts = itDate.split('/');
                if (parts.length !== 3) {
                    return null;
                }

                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
                    return null;
                }

                return Date.UTC(year, month - 1, day);
            };

            let listImpaginati = await Utility.getListaCodiciImpaginati();
            //cerchiamo nel file listaKit + idKitLavorazione + ".json" i record che soddisfano tutti i criteri del filtro
    
            let listaTracciato = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");

            if(listaTracciato == null){
                messaggioUtente("Code FLT-00 Lista non scaricata", "error");
                return;
            }
    
            //prendiamo i criteri del filtro
            let criteri = filtro.find('.criterio');
            let risultati = [];
            let risultatiImpaginati = [];
            //per ogni record della listaTracciato, controlliamo se soddisfa tutti i criteri
            let criteriValidati = false;
            let campiFiltro = pluginMiddleware.getCampo("campiFiltro") !== null ? pluginMiddleware.getCampo("campiFiltro") : [];
    
            listaTracciato.records.forEach(record => {
                //se è un gruppo e lo statoSelezione è != 1 si salta il record
                if (record.recordInTracciato["Referenza.Codice"] != record.recordInTracciato["Scatto.CodiceGruppo"] && record.recordInTracciato["StatoSelezione"] != 1) {
                    return; // Salta il record se non è selezionato
                }

                if (record.recordInTracciato["Scatto.CodiceGruppo"] == "4058997,4059044,4208186") {
                    console.log("stop");
                }
    
                //se il codice appare in listaImpaginati, lo aggiungiamo ai risultatiImpaginati
    
    
                let soddisfaTutti = true;
                let criteriValidi = 0;
                criteri.each(function () {
                    let chiaveObj = $(this).find('.filtro-chiave-hidden').val();
                    let operatore = $(this).find('.filtro-operatore').val();
                    let valore = $(this).find('.filtro-valore-hidden').val();
                    if(chiaveObj == ""){
                        criteriValidi++;
                    }

                    //cerchiamo in campiFiltro un campo con chiaveObj uguale a campiFiltro.campoAssociato
                    let campoAssociato = campiFiltro.find(c => c.campoAssociato === chiaveObj);
                    const campoData = isCampoData(campoAssociato);
                    let scope = record.recordInTracciato; 
                    if(campoAssociato != null && campoAssociato.scope){
                        let scopes = campoAssociato.scope.split('||');
                        //cerchiamo il primo scope che è definito
                        for (let sc of scopes) {
                            let currentScope = scope;
                            let validScope = true;
                            if (currentScope[sc] !== undefined) {
                                currentScope = currentScope[sc];
                            } else {
                                validScope = false;
                            }
                            if (validScope) {
                                scope = currentScope;
                                break;
                            }
                        }
                    }
    
                    let chiavi = chiaveObj.split('||').map(k => k.trim());
                    for (let chiave of chiavi) {
                        var chiaveSoddisfatta = false;
                        if (chiave != null && chiave !== '' && operatore != null && operatore != "") {
                            criteriValidi++;
                            //operatore = operatore[0]; // Prendiamo il primo carattere dell'operatore
                            // Controlliamo se il record soddisfa il criterio
                            if (scope && scope[chiave] !== undefined) {
                                var valParsed = valore.toString().split("||");
                                let recordValore = scope[chiave];
                                for (let i = 0; i < valParsed.length; i++) {
                                    valore = valParsed[i].trim();
                                    if (Array.isArray(recordValore)) {
                                        if (operatore == '='){
                                            operatore = 'IN';
                                        }
                                        else if (operatore == '!='){
                                            operatore = '!IN';
                                        }

                                        let foundInArray = false;
                                        if (campoData) {
                                            const valoreData = toItalianDateString(valore);
                                            if (valoreData != null) {
                                                foundInArray = recordValore.some(v => toItalianDateString(v) === valoreData);
                                            }
                                        }
                                        else {
                                            foundInArray = recordValore.some(v => v.toString().toLowerCase() === valore.toLowerCase());
                                        }

                                        // Se il valore è un array, controlliamo se contiene il valore cercato (case insensitive)
                                        if (operatore === 'IN' && !foundInArray) {
                                            if (i == valParsed.length - 1) {
                                                //se è l'ultima chiave de controllare
                                                if (chiave == chiavi[chiavi.length - 1]) {
                                                    soddisfaTutti = false;
                                                }
                                            }
                                        } else if (operatore === '!IN' && foundInArray) {
                                            if (i == valParsed.length - 1) {
                                                if (chiave == chiavi[chiavi.length - 1]) {
                                                    soddisfaTutti = false;
                                                }
                                            }
                                        }
                                        else {
                                            chiaveSoddisfatta = true;
                                            break;
                                        }
                                    } else {
                                        // Altrimenti, confrontiamo direttamente (case insensitive per stringhe)
                                        if (campoData) {
                                            const recordDateValue = parseItalianComparable(recordValore);
                                            const filterDateValue = parseItalianComparable(valore);

                                            if (recordDateValue != null && filterDateValue != null) {
                                                recordValore = recordDateValue;
                                                valore = filterDateValue;
                                            }
                                        }

                                        if (typeof recordValore === 'string' /*&& typeof valore === 'string'*/) {
                                            recordValore = recordValore.toLowerCase();
                                            valore = valore.toLowerCase();
                                        }
                                        else if (typeof recordValore === 'number' /*tipo_valore == "number"*/) {
                                            valore = parseFloat(String(valore).toLowerCase());
                                        }
                                        else if (typeof recordValore === 'boolean') {
                                            recordValore = recordValore.toString().toLowerCase();
                                            valore = String(valore).toLowerCase();
                                        }
    
                                        var exitCiclo = false;
    
                                        switch (operatore) {
                                            case '=':
                                                if (recordValore !== valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '!=':
                                                if (recordValore === valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '>':
                                                if (isNaN(recordValore) || isNaN(valore) || recordValore <= valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '>=':
                                                if (isNaN(recordValore) || isNaN(valore) || recordValore < valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '<':
                                                if (isNaN(recordValore) || isNaN(valore) || recordValore >= valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '<=':
                                                if (isNaN(recordValore) || isNaN(valore) || recordValore > valore) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case 'IN':
                                                if (!recordValore.includes(valore)) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                            case '!IN':
                                                if (recordValore.includes(valore)) {
                                                    if (i == valParsed.length - 1) {
                                                        if (chiave == chiavi[chiavi.length - 1]) {
                                                            soddisfaTutti = false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    chiaveSoddisfatta = true;
                                                    exitCiclo = true;
                                                }
                                                break;
                                        }
    
                                        if (exitCiclo) {
                                            //se siamo qui vuol dire che un criterio di || è stato soddisfatto
                                            break;
                                        }
                                    }
                                }
    
                                if(chiaveSoddisfatta){
                                    break;
                                }
                            } else {
                                soddisfaTutti = false; // Se la chiave non esiste nel record, non soddisfa il criterio
                            }
                        }
                    }
                });
    
                if(criteriValidi > 0){
                    criteriValidati = true;
                }
    
                // Se il record soddisfa tutti i criteri, lo aggiungiamo ai risultati
                if (soddisfaTutti) {
                    
                    //al record aggiungiamo una chiave index con il suo indice nella listaTracciato
                    record.index = listaTracciato.records.indexOf(record);
    
                    if (listImpaginati.some(item => item.idRec === record.recordInTracciato.idRec)) {
                        //record aggiunge la chiave della pagina di impaginazione
                        record.paginaImpaginazione = listImpaginati.find(item => item.idRec === record.recordInTracciato.idRec).nomePagina;
                        risultatiImpaginati.push(record);
                    }
                    else{
                        risultati.push(record);
                    }
                }
            });
    
            //filtro-info-label-trovati modifichiamo il testo con il numero dei risultati trovati, inoltre creiamo un pulsante con la i di info, se cliccato
            // si apre Utility.popup('Risultati', x) dove x è il contenuto del popup ovvero il codice HTML con i risultati trovati con la seguente struttura:
            // una riga per risultato divisa in due colonne, la prima con il codice del record e la seconda con la descrizione 1
            filtro.find('.filtro-info-label-trovati').text('Elementi non impaginati: ' + risultati.length);
            filtro.find('.filtro-info-label-trovati').prepend(
                $('<button></button>')
                .html('&#9432;') // Icona di info
                .css({ 
                    color: 'black', 
                    border: 'none', 
                    margin: '0 px',
                    marginLeft: '5px',
                    marginRight: '5px',
                    borderRadius: '50%', 
                    width: '20px', 
                    height: '20px', 
                    fontSize: '12px' 
                })
                .on('click', function () {
                    let popupContent = $('<div></div>');
    
                    risultati.forEach(record => {
                    let msg = record.recordInTracciato["Scatto.CodiceGruppo"];
                    //distinguiamo tra un gruppo e un singolo
                    let descrizione = "";
                    let descrizione2 = "";
                    if (record.recordInTracciato["Referenza.Codice"] == record.recordInTracciato["Scatto.CodiceGruppo"] || record.recordInTracciato.descrizione_gruppo == null) {
                        descrizione = record.recordInTracciato["Descrizioni.Descrizione1"] || "";
                        descrizione2 = record.recordInTracciato["Descrizioni.Descrizione2"] || "";
                    }
                    else{
                        descrizione = record.recordInTracciato.descrizione_gruppo["Descrizioni.Descrizione1"] || "";
                        descrizione2 = record.recordInTracciato.descrizione_gruppo["Descrizioni.Descrizione2"] || "";
                    }
    
                    // Crea riga
                    let riga = $('<div style="display: flex; align-items: center; margin-bottom: 5px;"></div>');
    
                    // Crea bottone copia
                    let $copyButton = $('<img src="images/copyToClipBoard.png" style="height: 14px; margin-left: 5px; cursor: pointer;" />');
                    $copyButton.attr("data-msg", msg);
    
                    $copyButton.on('click', function () {
                        let textToCopy = $(this).attr("data-msg");
                        navigator.clipboard.writeText(textToCopy).then(() => {
                        $(this).attr("src", "images/check.png");
                        setTimeout(() => {
                            $(this).attr("src", "images/copyToClipBoard.png");
                        }, 1000);
                        });
                    });
    
                    // Aggiungi testo
                    let $codice = $('<span style="margin-right: 5px;"></span>').text(
                        msg.length > 12 ? msg.substring(0, 12) + "..." : msg + ":"
                    );
                    let $descrizione = $('<span></span>').text(descrizione+" "+descrizione2);
    
                    // Assembla riga
                    riga.append($copyButton, $codice, $descrizione);
    
                    // Aggiungi al contenuto
                    popupContent.append(riga);
                    });
                    Utility.popup('Risultati', popupContent, "lg");
                })
            );
    
            filtro.find('.filtro-info-label-impaginati').text('Elementi impaginati: ' + risultatiImpaginati.length);
            filtro.find('.filtro-info-label-impaginati').prepend(
                $('<button></button>')
                .html('&#9432;') // Icona di info
                .css({ 
                    color: 'black', 
                    border: 'none', 
                    margin: '0 px',
                    marginLeft: '5px',
                    marginRight: '5px',
                    borderRadius: '50%', 
                    width: '20px', 
                    height: '20px', 
                    fontSize: '12px' 
                })
                .on('click', function () {
                    let popupContent = $('<div></div>');
    
                    risultatiImpaginati.forEach(record => {
                    let msg = record.recordInTracciato["Scatto.CodiceGruppo"];
                    let descrizione = record.recordInTracciato["Descrizioni.Descrizione1"] || "";
                    let descrizione2 = record.recordInTracciato["Descrizioni.Descrizione2"] || "";
    
                    // Crea riga
                    let riga = $('<div style="display: flex; align-items: center; margin-bottom: 5px;"></div>');
    
                    // Crea bottone copia
                    let $copyButton = $('<img src="images/copyToClipBoard.png" style="height: 14px; margin-left: 5px; cursor: pointer;" />');
                    $copyButton.attr("data-msg", msg);
    
                    $copyButton.on('click', function () {
                        let textToCopy = $(this).attr("data-msg");
                        navigator.clipboard.writeText(textToCopy).then(() => {
                        $(this).attr("src", "images/check.png");
                        setTimeout(() => {
                            $(this).attr("src", "images/copyToClipBoard.png");
                        }, 1000);
                        });
                    });
    
                    // Aggiungi testo
                    let $codice = $('<span style="margin-right: 5px;"></span>').text(
                        msg.length > 12 ? msg.substring(0, 12) + "..." : msg + ":"
                    );
                    let $descrizione = $('<span></span>').text(descrizione+" "+descrizione2);
    
                    // Assembla riga
                    riga.append($copyButton, $codice, $descrizione);
    
                    // Aggiungi al contenuto
                    popupContent.append(riga);
                    });
                    Utility.popup('Già impaginati:', popupContent, "lg");
                })
            );
    
            // Aggiungi il totale degli elementi trovati
            const totaleElementi = risultati.length + risultatiImpaginati.length;
            filtro.find('.filtro-info-tot').text('Elementi totali: ' + totaleElementi);
    
    
            //scorriamo la lista completa e per ogni elemento controlliamo se è impaginato, se lo è aggiungiamo il nome pagina al record
    
            var listaCompleta = [];
            listaTracciato.records.forEach(record => {
                //se è un gruppo e lo statoSelezione è != 1 si salta il record
                if (record.recordInTracciato["Referenza.Codice"] != record.recordInTracciato["Scatto.CodiceGruppo"] && record.recordInTracciato["StatoSelezione"] != 1) {
                    return; // Salta il record se non è selezionato
                }
    
                //al record aggiungiamo una chiave index con il suo indice nella listaTracciato
                record.index = listaTracciato.records.indexOf(record);
    
                if (listImpaginati.some(item => item.idRec === record.recordInTracciato.idRec)) {
                    //record aggiunge la chiave della pagina di impaginazione
                    record.paginaImpaginazione = listImpaginati.find(item => item.idRec === record.recordInTracciato.idRec).nomePagina;
                }
                listaCompleta.push(record);
            });
    
            var listaCompletaImpaginati = [];
            listaCompleta.forEach(record => {
                // Aggiungi il record alla lista degli impaginati solo se il loro codice gruppo non appare in listImpaginati
                if (listImpaginati.some(item => item.idRec === record.recordInTracciato.idRec)) {
                    listaCompletaImpaginati.push(record);
                }
            });
    
            var listaCompletaNonImpaginati = [];
            listaCompleta.forEach(record => {
                // Aggiungi il record alla lista dei non impaginati solo se il loro codice gruppo appare in listImpaginati
                if (!listImpaginati.some(item => item.idRec === record.recordInTracciato.idRec)) {
                    listaCompletaNonImpaginati.push(record);
                }
            });
    
            var objRes ={
                impaginati: risultatiImpaginati,
                nonImpaginati: risultati,
                criteriValidati: criteriValidati,
                listaCompleta: listaCompleta,
                listaCompletaImpaginati: listaCompletaImpaginati,
                listaCompletaNonImpaginati: listaCompletaNonImpaginati,
            }
    
            this.refreshNarrow(filtro);
            return objRes;
        }
        catch(error){
            console.error("Errore durante la ricerca del filtro:", error);
            messaggioUtente("Code FLT-02 Errore generico durante la ricerca del filtro: "+error.message, "error");

        }

    },

    async scorriFiltri(scorriAvanti = true, pagina = null, scorriFinoAPaginaBloccata = null, scorriFinoAPaginaConFiltroVuoto = null, paginaFineScorrimento = null) {

        if(pagina == null){
            pagina = $('#dialogFiltri').data('pagina');
        }

        if (scorriFinoAPaginaBloccata == null) {
            scorriFinoAPaginaBloccata = $('#fermaAPaginaBloccata').is(':checked');
        }

        if(scorriFinoAPaginaConFiltroVuoto == null){
            scorriFinoAPaginaConFiltroVuoto = $('#fermaAPaginaVuota').is(':checked');
        }

        //leggiamo il file Filtri.json
        const ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
        if (!ObjFiltri || !ObjFiltri.source) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }

        //cerchiamo la pagina corrispondente
        const paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
        let nomePagina = paginaFiltri.pagina;
        if (!paginaFiltri) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina corrente' + pagina);
            return;
        }

        //se scorriamo avanti iniziamo a far aumentare di uno il nome della pagina fino a una di queste condizioni
        // - la pagina successiva non esiste (ad esempio sono alla 43 e non esiste la 44)
        // - la pagina corrente è bloccata e scorriFinoAPaginaBloccata è true
        // - la pagina corrente ha un filtro vuoto e scorriFinoAPaginaConFiltroVuoto è true
        
        if (scorriAvanti) {
            //ad esempio se siamo a pagina 1 e le pagine sono 1-2-3-4-7-8-9, scorrendo avanti la 1 otteniamo 2-3-4-5-7-8-9
            
            //prendiamo tutte le pagine del filtro a partire da quella corrente fino a una delle condizioni sopra
            let pagineFiltri = [paginaFiltri.pagina]
            let paginaSuccessiva = parseInt(paginaFiltri.pagina) + 1;
            while (true) {
                let paginaSuccessivaFiltri = ObjFiltri.source.find(item => item.pagina === paginaSuccessiva.toString());
                if (!paginaSuccessivaFiltri || 
                    (paginaSuccessivaFiltri.blocco && scorriFinoAPaginaBloccata) || 
                    (paginaSuccessivaFiltri.filtri.length === 0 && scorriFinoAPaginaConFiltroVuoto) ||
                    (paginaFineScorrimento && paginaSuccessivaFiltri.pagina === paginaFineScorrimento)) {
                    if (paginaSuccessivaFiltri) {
                        //rimuoviamola
                        ObjFiltri.source = ObjFiltri.source.filter(item => item.pagina !== paginaSuccessivaFiltri.pagina);
                    }
                    break; // Esci dal ciclo se non esiste la pagina o se è bloccata o se ha un filtro vuoto
                }
                pagineFiltri.push(paginaSuccessivaFiltri.pagina);
                paginaSuccessiva = parseInt(paginaSuccessivaFiltri.pagina) + 1;
            }

            //ordiniamole in ordine descrescente
            pagineFiltri.sort((a, b) => parseInt(b) - parseInt(a));

            //per ogni paginaFiltri aumentiamo il nome della pagina
            pagineFiltri.forEach(pagina => {
                let paginaFiltriObj = ObjFiltri.source.find(item => item.pagina === pagina);
                if (paginaFiltriObj) {
                    paginaFiltriObj.pagina = (parseInt(pagina) + 1).toString();
                }
            });

            //salviamo il file Filtri.json
            fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
            nomePagina = (parseInt(nomePagina) + 1).toString();
        } else {
            //se scorriamo indietro iniziamo a far diminuire di uno il nome della pagina fino a una di queste condizioni
            // - la pagina precedente non esiste (ad esempio sono alla 1 e non esiste la 0)
            // - la pagina corrente è bloccata e scorriFinoAPaginaBloccata è true
            // - la pagina corrente ha un filtro vuoto e scorriFinoAPaginaConFiltroVuoto è true
            
            let pagineFiltri = [paginaFiltri.pagina]
            let paginaPrecedente = parseInt(paginaFiltri.pagina) - 1;
            while (true) {
                let paginaPrecedenteFiltri = ObjFiltri.source.find(item => item.pagina === paginaPrecedente.toString());
                if (!paginaPrecedenteFiltri || 
                    (paginaPrecedenteFiltri.blocco && scorriFinoAPaginaBloccata) || 
                    (paginaPrecedenteFiltri.filtri.length === 0 && scorriFinoAPaginaConFiltroVuoto) ||
                    (paginaFineScorrimento && paginaPrecedenteFiltri.pagina === paginaFineScorrimento)) {
                    if (paginaPrecedenteFiltri) {
                        //rimuoviamola
                        ObjFiltri.source = ObjFiltri.source.filter(item => item.pagina !== paginaPrecedenteFiltri.pagina);
                    }
                    break; // Esci dal ciclo se non esiste la pagina o se è bloccata o se ha un filtro vuoto
                }
                pagineFiltri.push(paginaPrecedenteFiltri.pagina);
                paginaPrecedente = parseInt(paginaPrecedenteFiltri.pagina) - 1;
            }

            //controlliamo se pagina 1 è tra pagineFiltri, se c'è apriamo un confirm  che avvisa che se si procede il filtro a pagina 1 verrà eliminato e sostituito
            if (pagineFiltri.includes("1")) {
                let conferma = await Utility.confirm("Sei sicuro di voler procedere? Il filtro a pagina 1 verrà eliminato e sostituito.");
                if (!conferma) {
                    return false; // Se l'utente non conferma, non facciamo nulla
                }
                else{
                    //rimuoviamo il filtro a pagina 1
                    pagineFiltri = pagineFiltri.filter(p => p !== "1");
                    ObjFiltri.source = ObjFiltri.source.filter(item => item.pagina !== "1");
                }
            }

            //ordiniamole in ordine crescente
            pagineFiltri.sort((a, b) => parseInt(a) - parseInt(b));

            //per ogni paginaFiltri diminuiamo il nome della pagina
            pagineFiltri.forEach(p => {
                let paginaFiltri = ObjFiltri.source.find(item => item.pagina === p);
                if (paginaFiltri) {
                    paginaFiltri.pagina = (parseInt(p) - 1).toString();
                }
            });

            //salviamo il file Filtri.json
            fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
            nomePagina = (parseInt(nomePagina) - 1).toString();
        }

        //aggiorniamo il nome del modale e i data con il nuovo numero di pagina
        $('#dialogFiltri').data('pagina', nomePagina);
        $('#modalTitle').text('Filtri Pagina ' + nomePagina);

        //aggiorniamo la visualizzazione dei filtri
        this.visualizzaHomePageFiltri();
        return true;
    },

    async scambiaFiltri(modalita){
        //le modalità sono:
        // 0 - manda e scorri
        // 1 - scambia

        try{
            let pagina = $('#dialogFiltri').data('pagina');
            let paginaInvio = $('#paginaInvioFiltro').val();
    
            //recuperiamo i filtri della pagina corrente
            let ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
            if (!ObjFiltri || !ObjFiltri.source) {
                Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
                return;
            }
            //cerchiamo la pagina corrispondente
            let paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
            if (!paginaFiltri) {
                Utility.popup ('Errore','Nessun filtro trovato per la pagina corrente' + pagina);
                return;
            }
    
            //controlliamo se la pagina di invio è valida
            if (paginaInvio == null || paginaInvio === '' || isNaN(paginaInvio) || parseInt(paginaInvio) < 1) {
                Utility.popup ('Errore','Inserire un numero di pagina valido per l\'invio del filtro');
                return;
            } 
    
            //cerchiamo la pagina di invio
            let paginaInvioFiltri = ObjFiltri.source.find(item => item.pagina === paginaInvio.toString());
            if (!paginaInvioFiltri) {
                Utility.popup ('Errore','Pagina di invio non trovata' + paginaInvio);
                return;
            }
    
            if(modalita == 0){
                //controlliamo se ci stiamo muovendo avanti o indietro
                let paginaCorrente = parseInt(pagina);
                let paginaInvioCorrente = parseInt(paginaInvio);
                let direzioneAvanti = paginaInvioCorrente < paginaCorrente;
                let res = await this.scorriFiltri(direzioneAvanti, paginaInvio, false, false, pagina)
                if(res == false){
                    return;
                }
                ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
                //infine scriviamo il filtro della pagina corrente nella pagina di invio
                paginaInvioFiltri = ObjFiltri.source.find(item => item.pagina === paginaInvio);
                paginaInvioFiltri.filtri = paginaFiltri.filtri;
                paginaInvioFiltri.blocco = paginaFiltri.blocco;
                paginaInvioFiltri.limite = paginaFiltri.limite;
                //salviamo il file Filtri.json
                fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
                //cambiamo il nome e i data del modale
                $('#dialogFiltri').data('pagina', paginaInvio);
                $('#modalTitle').text('Filtri Pagina ' + paginaInvio);
            }
            else if (modalita == 1){
                //scambiamo i filtri tra la pagina corrente e la pagina di invio
                let filtriCorrenti = paginaFiltri.filtri;
                let filtriInvio = paginaInvioFiltri.filtri;
    
                //aggiorniamo i filtri della pagina corrente con quelli della pagina di invio
                paginaFiltri.filtri = filtriInvio;
                //aggiorniamo i filtri della pagina di invio con quelli della pagina corrente
                paginaInvioFiltri.filtri = filtriCorrenti;
    
                //scambiamo anche i loro valori di pagina bloccata
                let paginaBloccataCorrente = paginaFiltri.blocco;
                let paginaBloccataInvio = paginaInvioFiltri.blocco;
    
                paginaFiltri.blocco = paginaBloccataInvio;
                paginaInvioFiltri.blocco = paginaBloccataCorrente;
    
                //scambiamo anche i limiti delle pagine
                let limiteCorrente = paginaFiltri.limite;
                let limiteInvio = paginaInvioFiltri.limite;
    
                paginaFiltri.limite = limiteInvio;
                paginaInvioFiltri.limite = limiteCorrente;
    
                //salviamo il file Filtri.json
                fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));
    
                //cambiamo il nome e i data del modale
                $('#dialogFiltri').data('pagina', paginaInvio);
                $('#modalTitle').text('Filtri Pagina ' + paginaInvio);
    
            }

            //aggiorniamo la visualizzazione dei filtri
            this.visualizzaHomePageFiltri();

        }
        catch (error) {
            console.error("Errore durante lo scambio dei filtri:", error);
            Utility.popup ('Errore','Si è verificato un errore durante lo scambio dei filtri: ' + error.message);
        }
    },

    async duplicaFiltri()
    {
        let pagina = $('#dialogFiltri').data('pagina');
        let paginaInvio = $('#paginaInvioFiltro').val();

        if (pagina==paginaInvio){
            Utility.popup ('Errore','Non si puo duplicare il filtro di una pagina su se stessa');
            return;
        }
        
        //recuperiamo i filtri della pagina corrente
        let ObjFiltri = readFile(filtri.getNomeFileFiltriJson());
        if (!ObjFiltri || !ObjFiltri.source) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina ' + pagina);
            return;
        }
        //cerchiamo la pagina corrispondente
        let paginaFiltri = ObjFiltri.source.find(item => item.pagina === pagina);
        if (!paginaFiltri) {
            Utility.popup ('Errore','Nessun filtro trovato per la pagina corrente' + pagina);
            return;
        }

        //cerchiamo la pagina di invio
        let paginaInvioFiltri = ObjFiltri.source.find(item => item.pagina === paginaInvio.toString());
        if (!paginaInvioFiltri) {
            Utility.popup ('Errore','Pagina di invio non trovata' + paginaInvio);
            return;
        }

        

        //aggiorniamo i filtri della pagina di invio con quelli della pagina corrente
        paginaInvioFiltri.filtri = paginaFiltri.filtri;
        //aggiorniamo il valore di pagina bloccata della pagina di invio con quello della pagina corrente
        paginaInvioFiltri.blocco = paginaFiltri.blocco;

        //aggiorniamo anche i limiti delle pagine
        paginaInvioFiltri.limite = paginaFiltri.limite;

        //salviamo il file Filtri.json
        fs.writeFileSync(filtri.getNomeFileFiltriJson(), JSON.stringify(ObjFiltri));

        this.visualizzaHomePageFiltri();

        Utility.chiudiModal();


    }
};

module.exports = filtri;