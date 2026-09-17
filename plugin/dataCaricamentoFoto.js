//I20-971: data di caricamento mostrata sulle foto della schermata di cambio foto.
//Modulo CommonJS come gli altri del Plugin: si carica con require('./dataCaricamentoFoto').
//Qui non si tocca InDesign, cosi' la formattazione e' verificabile dal test runner di Node.
var DataCaricamentoFoto = (function () {

    //Sotto questa soglia la data non e' un caricamento reale ma un valore di default lasciato
    //in archivio: meglio nessun badge che un badge con scritto 01/01/0001.
    var ANNO_MINIMO_PLAUSIBILE = 2000;

    function dueCifre(numero) {
        return numero < 10 ? "0" + numero : "" + numero;
    }

    /// Data di caricamento di una foto, come la mostra il badge: gg/mm/aaaa.
    /// Torna stringa vuota quando la data manca o non e' plausibile, e in quel caso
    /// il badge non viene disegnato affatto.
    function formattaDataCaricamento(valore) {
        if (valore == null || valore === "") {
            return "";
        }

        var data = valore instanceof Date ? valore : new Date(valore);

        if (isNaN(data.getTime())) {
            return "";
        }

        if (data.getFullYear() < ANNO_MINIMO_PLAUSIBILE) {
            return "";
        }

        return dueCifre(data.getDate()) + "/" + dueCifre(data.getMonth() + 1) + "/" + data.getFullYear();
    }

    /// Data da mostrare per una foto dell'elenco: il caricamento e', per l'archivio, la data
    /// di inserimento della riga. Se manca si ripiega sulla data di modifica, che e' anche il
    /// criterio con cui l'elenco arriva ordinato.
    function dataDaMostrare(foto) {
        if (foto == null) {
            return "";
        }

        var inserimento = formattaDataCaricamento(foto.DataInserimento);
        if (inserimento !== "") {
            return inserimento;
        }

        return formattaDataCaricamento(foto.DataModifica);
    }

    /// Momento di caricamento di una foto come numero confrontabile. Le foto senza data
    /// utilizzabile tornano null e vanno tenute in fondo: non si inventa loro una data.
    function istanteDiCaricamento(foto) {
        if (foto == null) {
            return null;
        }

        var valori = [foto.DataInserimento, foto.DataModifica];
        for (var i = 0; i < valori.length; i++) {
            if (formattaDataCaricamento(valori[i]) === "") {
                continue;
            }
            var data = valori[i] instanceof Date ? valori[i] : new Date(valori[i]);
            return data.getTime();
        }

        return null;
    }

    /// Ordina le foto dalla piu' nuova alla piu' vecchia. Quelle senza data finiscono in fondo
    /// nell'ordine in cui sono arrivate, che dal server e' gia' per data di modifica
    /// decrescente. L'ordine fra foto di pari data resta quello di partenza: si confrontano
    /// gli indici, cosi' l'esito non dipende dalla stabilita' di sort del motore.
    function ordinaDallaPiuNuova(lista) {
        var elementi = (lista || []).slice();
        var conIndice = elementi.map(function (foto, indice) {
            return { foto: foto, indice: indice, istante: istanteDiCaricamento(foto) };
        });

        conIndice.sort(function (a, b) {
            if (a.istante == null && b.istante == null) {
                return a.indice - b.indice;
            }
            if (a.istante == null) {
                return 1;
            }
            if (b.istante == null) {
                return -1;
            }
            if (a.istante === b.istante) {
                return a.indice - b.indice;
            }
            return b.istante - a.istante;
        });

        return conIndice.map(function (voce) { return voce.foto; });
    }

    /// Separa dalla lista la foto attualmente in uso, che va mostrata in cima alla schermata.
    /// Estrarla, invece di lasciarla dov'e', evita che compaia due volte: due schede cliccabili
    /// per la stessa foto confonderebbero piu' del problema che stiamo risolvendo.
    function estraiAttuale(lista, idAttuale) {
        var elementi = lista || [];
        var attuale = null;
        var resto = [];

        for (var i = 0; i < elementi.length; i++) {
            if (attuale == null && idAttuale != null && elementi[i] != null && elementi[i].Id === idAttuale) {
                attuale = elementi[i];
                continue;
            }
            resto.push(elementi[i]);
        }

        return { attuale: attuale, resto: resto };
    }

    return {
        formattaDataCaricamento: formattaDataCaricamento,
        dataDaMostrare: dataDaMostrare,
        ordinaDallaPiuNuova: ordinaDallaPiuNuova,
        estraiAttuale: estraiAttuale
    };
})();

module.exports = DataCaricamentoFoto;
