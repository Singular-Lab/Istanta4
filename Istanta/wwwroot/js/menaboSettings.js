class MenaboSettings {
    constructor() {


    }

    mostraSchema(id_schema) {

        //$("#schema_" + id_schema).css("display", "block");
        $("#modalSchema").find("#content").empty();
        $("#modalSchema").find("#content").append($("#schema_" + id_schema).clone().html());
        $("#modalSchema").modal("show");

    }

    salvaPaginaSchema(sender, id_schema) {

        let myRow = sender.closest(".row");
        let container = sender.closest(".schema").find("#containerPags");

        let pagItem = {
            numero: parseInt(myRow.find("#numeroPag").val()),
            idMastro: parseInt(myRow.find("#mastroPag").val())
        };


         //console.log([myRow.find("#numeroPag").val(), myRow.find("#mastroPag").val()]);


        Call.do("MenaboSettings", "salvaPaginaSchema/" + id_schema, "PUT", pagItem, this, function (result, sender) {

            if (result.esito) 
            {
                if (myRow.attr("id") == "newPag")
                {
                    let newRow = myRow.clone();
                    newRow.attr("id", "pag_" + pagItem.numero);
                    newRow.find("#btnSalvaPag").attr("onclick", "msInstance.salvaPaginaSchema(this, " + result.id + ")");
                    newRow.find("#btnSalvaPag").val("Salva");
                    newRow.find("#btnEliminaPag").attr("onclick", "msInstance.eliminaPaginaSchema(this, " + result.id + ")");
                    newRow.find("#btnEliminaPag").css("display", "block");
                    container.append(newRow);

                    newRow.find("#mastroPag").val(pagItem.idMastro);
                    newRow.find("#numeroPag").attr("readonly", "readonly");

                    myRow.find("#numeroPag").val(pagItem.numero+1);
                }
            }
            else
            {
                alert(result.error);
            }

        });

    }

    eliminaPaginaSchema(sender, id_schema) {

        if (confirm('Sicuro di voler eliminare?')) {
            let myRow = sender.closest(".row");

            let pagItem = {
                numero: parseInt(myRow.find("#numeroPag").val())
            };

            Call.do("MenaboSettings", "eliminaPaginaSchema/" + id_schema, "PUT", pagItem, this, function (result, sender) {

                if (result.esito) {
                    myRow.remove();
                }
                else {
                    alert(result.error);
                }

            });
        }
    }

    salvaFormatiPagine() {
        let newValue = $("#FormatiPagina").val();
        newValue = newValue.replace(/\s/g, '');
        
        // Dividi la stringa in base alla virgola
        let elementi = newValue.split(',');

        // Loop attraverso gli elementi
        for (let i = 0; i < elementi.length; i++) {
            let elemento = elementi[i];

            // Dividi l'elemento in base alla X
            let parti = elemento.split('x');

            // Verifica che ci siano esattamente due parti (sinistra e destra della X)
            if (parti.length === 2) {

                // Verifica che entrambe le parti siano numeri
                if (!isNaN(parti[0]) && !isNaN(parti[1])) {
                    
                } else {
                    alert(`Elemento non valido: ${elemento}`);
                    return;
                }
            } else {
                alert(`Elemento non valido: ${elemento}`);
                return;
            }
        }

        Call.do("MenaboSettings", "salvaFormatiPagine/" + newValue, "GET", null, this, function (result, sender) {
            if (!result.esito) {
                alert("Operazione fallita: " + result.error);
            }
            else {
                sender.showMessage('Operazione riuscita', 'success');
            }
        });
    }

    showMessage(text, color) {
        $('.message').remove();

        // Creazione dell'elemento del messaggio con classi di Bootstrap
        const messageElement = $('<div class="message alert"><div class="message-content"><span class="message-text">' + text + '</span></div><div class="close-btn" onclick=\'$(".message").remove();\'><i class="fas fa-times"></i></div></div>');

        // Applicazione degli stili aggiuntivi
        messageElement.css({
            'position': 'fixed',
            'top': '10%',
            'left': '50%',
            'transform': 'translate(-50%, -50%)',
            'display': 'flex',
            'flex-direction': 'row', // Imposta la direzione della flessione su "row" (riga)
            'justify-content': 'space-between', // Allinea gli elementi su entrambi i lati
            'align-items': 'center',
            'text-align': 'center',
            'width': '90%',
            'padding': '10px',
        });

        // Aggiunta della classe di colore di Bootstrap
        messageElement.addClass('alert-' + color);

        // Aggiunta del messaggio al corpo della pagina
        $('body').append(messageElement);

        // Chiudi automaticamente e con transizione graduale se il colore è 'success'
        if (color === 'success') {
            setTimeout(function () {
                messageElement.fadeOut(2000, function () {
                    $(this).remove();
                });
            }, 1000); // 10000 millisecondi (10 secondi)
        }
    }
}