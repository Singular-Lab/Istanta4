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
                callback(data, sender);
            },
            error: function (data, status, error) {
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