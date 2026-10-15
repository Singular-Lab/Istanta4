class Call {

    static do(controller, address, method, params, sender, callback, callbackError) {



        //console.log("HOSTNAME " + document.location.hostnam);

        let controller_link = getWebAppRootFolder() + controller + "/";
        /*if (controller === "")
            controller_link = "";*/

        $.ajax({
            dataType: 'json',
            type: method,
            url: "/"+controller_link + address,
            data: params,
            success: function (data) {
                //console.log("output : " + JSON.stringify(data));
                //I20-1069: una risposta 200 con esito negativo resta del chiamante, come sempre, ma il motivo
                //e la traccia del server finiscono in console: prima non li vedeva nessuno.
                Call.registraEsitoNegativo(address, data);
                callback(data, sender);
            },
            error: function (data, status, error) {
                //I20-1069: la traccia completa del server, quando c'e', per chi guarda la console.
                if (data && data.responseJSON && data.responseJSON.dettaglio) {
                    console.error("Dettaglio dell'errore del server (" + address + "):", data.responseJSON.dettaglio);
                }
                let serverMessage =
                    data.responseJSON?.detail ??
                    data.responseJSON?.error ??
                    data.responseJSON?.message ??
                    data.responseText;

                let details = {
                    info: data,
                    error: status || "unknown",
                    message: serverMessage
                };

                if (!details.message) {
                    if (data.status === 0) {
                        details.message =
                            "Riscontrati problemi con la connessione, impossibile portare a termine l'operazione!";
                    } else {
                        details.message =
                            "Errore " + data.status + ", impossibile portare a termine l'operazione!";
                    }
                }

                if (callbackError != null) {
                    callbackError(details);
                } else {
                    callback(details);
                }
            }
        });

    }

    /// I20-1069: il perche' di una risposta che non e' andata bene, in parole per l'operatore, oppure null
    /// se e' andata bene. Vale per tutte e due le cose che il chiamante di Call.do puo' ricevere:
    /// - l'oggetto che Call.do costruisce su un errore HTTP o di rete ({ info, error, message }): il motivo
    ///   del server, o quello della connessione. Il suo error e' il testo di stato di jQuery ("error"),
    ///   che da solo non dice niente;
    /// - la risposta 200 del server: con esito negativo (Esito o esito false), o con un error valorizzato
    ///   come quello della lista del revisore.
    static motivoDellErrore(risposta) {
        if (risposta == null) {
            return "Istanta non ha risposto";
        }
        if (typeof risposta !== "object" || Array.isArray(risposta)) {
            return null;
        }
        if (risposta.info !== undefined && risposta.message !== undefined) {
            return risposta.message || risposta.error || "richiesta non riuscita";
        }
        if (risposta.Esito === false || risposta.esito === false) {
            return risposta.error || "operazione non riuscita, senza motivo";
        }
        if (typeof risposta.error === "string" && risposta.error.trim() !== "") {
            return risposta.error;
        }
        return null;
    }

    /// I20-1069: scrive in console motivo e traccia di una risposta 200 con esito negativo. Non cambia
    /// niente per il chiamante: e' solo per chi guarda la console.
    static registraEsitoNegativo(address, data) {
        try {
            const motivo = Call.motivoDellErrore(data);
            if (motivo != null) {
                console.error("Risposta con esito negativo (" + address + "): " + motivo);
                if (data.dettaglio) {
                    console.error("Dettaglio dell'errore del server (" + address + "):", data.dettaglio);
                }
            }
        }
        catch (e) {
            //Un log non deve mai impedire la risposta.
        }
    }

    static doWithUpload(controller, address, method, params, sender, callback) {


        //let controller_link = controller + "/";
        let controller_link = getWebAppRootFolder() + controller + "/";
        /*if (controller === "")
            controller_link = "";*/

        $.ajax({
            type: method,
            method:method,
            url: "/" + controller_link + address,
            data: params,
            processData: false,
            contentType: false,
            success: function (data) {
                //console.log("output : " + JSON.stringify(data));
                callback(data, sender);
            },
            error: function (data) {

                console.log("error : " + JSON.stringify(data));
                callback({ info: data, error: "uknown" });
            },
        });

    }

    static doWithLargePayload(controller, address, method, params, sender, callback) {

        let controller_link = getWebAppRootFolder() + controller + "/";

        $.ajax({
            dataType: 'json',
            type: method,
            url: "/" + controller_link + address,
            data: JSON.stringify(params),
            contentType: 'application/json; charset=utf-8',
            success: function (data) {
                callback(data, sender);
            },
            error: function (data) {
                console.log("error : " + JSON.stringify(data));
                callback({ info: data, error: "unknown" });
            },
        });
    }

}

//I20-1069: per i test sotto Node; nel browser module non c'e' e non cambia niente.
if (typeof module !== "undefined" && module.exports) {
    module.exports = Call;
}
