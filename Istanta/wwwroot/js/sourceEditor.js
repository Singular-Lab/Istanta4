class ExternalSourceEditor {

    constructor() {
        this.editorInstance = null;
        this.editorContainer = null;
        this.sourceUri = null;
        this.initialized = false;

        require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@latest/min/vs' } });

    }

    init(sourceUri) {

        showLoading();

        if (this.initialized) {
            console.warn("ExternalSourceEditor already initialized");
            return;
        }

        this.initialized = true;

        this.sourceUri = sourceUri;//
        this.editorContainer = document.getElementById('editor');

        this.editorContainer.style.display = 'block';
        let me = this;  

        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('/' + getWebAppRootFolder() + 'external_source' + exPathCustom + '/' + this.sourceUri + '.json?v1.' + rndVersion, function (data) {

            let val = JSON.stringify(data);
            console.log(val);
            require(['vs/editor/editor.main'], function () {
                me.editorInstance = monaco.editor.create(me.editorContainer, {
                    value: val,
                    language: 'json',
                    theme: 'vs-dark',
                    autoIndent: true
                });

                console.log("Editor creato");
                console.log(me.editorInstance);
                console.log(me.editorInstance.getValue());

                setInterval(function () {
                    me.editorInstance.getAction("editor.action.formatDocument").run();
                    hideLoading();
                }, 1000);

            });


        }).fail(function (jqxhr, textStatus, error) {
            $("#contentSource").append('<div class="alert alert-warning" role="alert"><strong>Attenzione</strong>: Nessuna file ' + me.sourceUri + ' trovato</div>');
            console.error('Errore nel caricamento del file:', textStatus, error);
            hideLoading();
            // qui puoi gestire il caso in cui il file non esista o dia errore
        });

        
    }

    save(scope)
    {
        const model = this.editorInstance.getModel();
        let markers = monaco.editor.getModelMarkers({ resource: model.uri });

        if (markers.length == 0)
        {
            showLoading();

            let rawValue = this.editorInstance.getValue();
            let jsonObject = JSON.parse(rawValue); // verifica validità
            let minifiedJson = JSON.stringify(jsonObject); // minifica


            //Valido
            //si puo procedere con il salvataggio

            Call.doWithLargePayload(scope, "salvaSourceJsonCode", "PUT", { jsoncode: minifiedJson, origin: this.sourceUri }, this,
                function (result, sender) {
                    if (result.esito) {
                        console.log("Salvataggio effettuato con successo");
                    }
                    else
                    {
                        console.error(result);
                    }

                    hideLoading();
                }
            );
            //
        }
        else
        {

        }

    }

}