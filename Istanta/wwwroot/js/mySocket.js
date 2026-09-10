class MySocket {
    myWebSocket;

    cbOnMessage;
    cbOnOpen;
    cbOnClose;
    cbOnError;
    messagesInstance;
    myId = 0;
    numberOfConnection = 0;
    numberMaxTentativi = 20;
    _timeout;
    constructor(cb_onMessage, cb_onOpen, cb_onClose, cb_onError) {
        if (cb_onMessage == null) {
            console.error("Callback on message non dichiarata");
        }
        else {
            this.cbOnMessage = cb_onMessage;
            this.cbOnOpen = (cb_onOpen != null ? cb_onOpen : null);
            this.cbOnClose = (cb_onClose != null ? cb_onClose : null);
            this.cbOnError = (cb_onError != null ? cb_onError : null);
            this.messagesInstance = new Messages();
            this.connectToWS();
        }
    }


    reconnectAfterDelay() {
        clearTimeout(this._timeout);
        let me = this;
        this._timeout = setTimeout(function () {
            me.connectToWS();
        }, 3000); // 3000 millisecondi (3 secondi)
    }

    connectToWS()
    {

        console.log("Tentativo di connessione al socket...");

        if (socketEndPoint == null || socketEndPoint == "") {
            return;
        }

        let me = this;
        const guid = uuidv4();// Math.random() * 9000000000 + 1;        
        // Restituisci il numero con al massimo 2 cifre decimali
        this.myId = guid;// parseFloat(randomNumber.toFixed(2));
        
        var endpoint = socketEndPoint;

        if (this.myWebSocket !== undefined) {
            this.myWebSocket.close()
        }

        this.myWebSocket = new WebSocket(endpoint);



        this.myWebSocket.onmessage = function (event) {
            var leng;
            if (event.data.size === undefined) {
                leng = event.data.length
            } else {
                leng = event.data.size
            }
            
            let jsonObj;
            try {
                jsonObj = JSON.parse(event.data);
                if (jsonObj.senderId != me.myId) {
                    me.cbOnMessage(jsonObj);
                }
            }
            catch {

            }
        }

        this.myWebSocket.onopen = function (evt) {
            console.log("onopen.");            
            if (me.numberOfConnection > 0) {
                me.showMessage('Riconnessione riuscita', 'success');
                me.numberOfConnection = 0;
            }
        };

        this.myWebSocket.onclose = function (evt) {
            console.log("onclose.");
            me.numberOfConnection++
            if (me.numberOfConnection < me.numberMaxTentativi) {
                me.showMessage('Disconnesso dal socket, riconnessione in corso attendere', 'warning');
                me.reconnectAfterDelay();
            }
            else
            {
                me.showMessage('Impossibile stabilire una connessione al socket ', 'danger');
            }
        };

        this.myWebSocket.onerror = function (evt) {
            console.log("Error!");
            me.numberOfConnection++;
            if (me.numberOfConnection < me.numberMaxTentativi) {
                me.showMessage('Errore di connessione al socket (' + evt.message + '), tentativo di connessione numero ' + me.numberOfConnection, 'failure');
                me.reconnectAfterDelay();
            }
            else {
                me.showMessage('Impossibile stabilire una connessione al socket ', 'danger');
            }
        };
    }


    sendMsg(message) {
        if (this.myWebSocket == null)
            return;

        if (message == null) {
            console.log("Message null");
            return;
        }
        if (this.myWebSocket == null) {
            console.log("Web socket null");
            return;
        }
        message.senderId = this.myId;
        let jsonString = JSON.stringify(message);
        this.myWebSocket.send(jsonString);
    }


    closeConn() {
        if (this.myWebSocket == null) {
            return;
        }
        this.myWebSocket.close();
    }

    showMessage(text, color) {
        $('.message').remove();

        // Creazione dell'elemento del messaggio con classi di Bootstrap
        //const messageElement = $('<div class="message alert"><div class="message-content"><span class="message-text">' + text + '</span></div><div class="close-btn" style="cursor:pointer;" onclick=\'console.log("entro");$(".message").remove();\'><i class="fas fa-times"></i></div></div>');
        const messageElement = $('<div class="message alert"><div class="message-content"><span class="message-text">' + text + '</span></div><button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>');
        
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
                messageElement.fadeOut(1000, function () {
                    $(this).remove();
                });
            }, 5000); // 10000 millisecondi (10 secondi)
        }
    }
}

class Messages {

    // areaOperativa:
    // 0 = errore, non specificata
    // 1 = tutte le area
    // 2 = menabo
    // 3 = revisore
    // 4 = menabo e revisore

    MenaboMessages = {
        OnImpaginato: {senderId: 0, messageId: 1, areaOperativa: 2, tracciato: 0, codici: [] },
        OnRemoveImpaginato: { senderId: 0, messageId: 2, areaOperativa: 2, tracciato: 0, codici: [] },
    };

    RevisoreMessages = {
        OnSalvataRevisione: { senderId: 0, messageId: 101, areaOperativa: 4, codici: []},
    };
}