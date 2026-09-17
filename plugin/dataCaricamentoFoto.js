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

    return {
        formattaDataCaricamento: formattaDataCaricamento,
        dataDaMostrare: dataDaMostrare
    };
})();

module.exports = DataCaricamentoFoto;
