//Logica dell'opzione noRender sugli elementi di un box.
//Modulo CommonJS come gli altri del Plugin: si carica con require('./noRenderElementi'),
//non con un tag script. I consumatori sono schedaRef, confronti e indexNew.
//Qui dentro non si tocca InDesign: si ragiona solo su label, meta e liste, cosi' il
//comportamento e' verificabile con il test runner di Node come gli altri moduli puri.
//
//Un elemento del box e' identificato da tipo + chiave logica (sigla per loghi e foto extra,
//nome del campo per campi ed etichette, codice referenza per le foto). La label InDesign non
//serve da identificativo: incorpora il codice della ref e viene ricostruita a ogni impaginazione.
var NoRenderElementi = (function () {

    //Deve restare allineato a TipoElementoBox di Istanta.Models.
    var TIPO = {
        campo: 1,
        logo: 2,
        fotoExtra: 3,
        etichetta: 4,
        foto: 5,
        altro: 99
    };

    //Le foto primarie/secondarie stanno nella stessa struttura degli altri elementi, con il
    //codice referenza per chiave: un solo salvataggio e una sola applicazione in impaginazione.
    var TIPO_FOTO = TIPO.foto;

    //tipo_N nelle label rimanda a TipoFoto di IstantaLib: 3 e' il logo.
    var TIPO_FOTO_LOGO = 3;

    function pulisci(valore) {
        return valore == null ? "" : String(valore);
    }

    /// Ricava tipo e chiave logica dalla label InDesign di un elemento del box.
    function classificaLabel(label, nomeFotoPrimaria, nomeFotoSecondaria) {
        var testo = pulisci(label);
        if (testo === "") {
            return null;
        }

        var primaria = pulisci(nomeFotoPrimaria) || "immagine";
        var secondaria = pulisci(nomeFotoSecondaria) || "foto_secondaria";

        if (testo.indexOf(primaria + "$") === 0 || testo.indexOf(secondaria + "$") === 0) {
            return { tipo: TIPO_FOTO, chiave: testo.split("$")[1] || "" };
        }

        if (testo.indexOf("foto_extra$") === 0 || testo.indexOf("simbolo$") === 0 || testo.indexOf("sfondo$") === 0) {
            var parti = testo.split("$");
            var sigla = parti[1] || "";
            var tipoFoto = parseInt(pulisci(parti[2]).replace("tipo_", ""), 10);
            return { tipo: tipoFoto === TIPO_FOTO_LOGO ? TIPO.logo : TIPO.fotoExtra, chiave: sigla };
        }

        if (testo.indexOf("etichetta_") === 0) {
            return { tipo: TIPO.etichetta, chiave: testo.substring("etichetta_".length) };
        }

        //Caso generico: il campo si identifica con la parte di label prima del $,
        //come fa Utility.parseLabel. Qui la label arriva grezza, cosi' i prefissi noti
        //sopra restano riconoscibili: parseLabel troncherebbe simbolo$sigla$tipo_2 a simbolo.
        return { tipo: TIPO.campo, chiave: testo.split("$")[0] };
    }

    /// Nome mostrato nel modal: per i loghi nome e sigla, per le immagini il nome della foto.
    function descriviElemento(elemento) {
        if (elemento == null) {
            return "";
        }

        var nome = pulisci(elemento.nome);
        var chiave = pulisci(elemento.chiave);

        if (elemento.tipo === TIPO.logo || elemento.tipo === TIPO.fotoExtra) {
            //La sigla di un extra si mostra sempre: e' il nome con cui l'operatore lo riconosce
            //nel documento e nelle segnalazioni. Il nome esteso la accompagna quando c'e'.
            if (nome !== "" && chiave !== "" && nome !== chiave) {
                return nome + " (" + chiave + ")";
            }
            return chiave !== "" ? chiave : nome;
        }

        //Foto, campi ed etichette: il nome quando c'e', altrimenti la chiave.
        return nome !== "" ? nome : chiave;
    }

    function stessoElemento(a, b) {
        return a != null && b != null && a.tipo === b.tipo && pulisci(a.chiave) === pulisci(b.chiave);
    }

    /// Lista del modal: gli elementi presenti nel box piu' quelli marcati nei meta che dal
    /// documento sono spariti. Senza questa unione un elemento cancellato dai livelli non
    /// sarebbe piu' togglabile dal Plugin.
    function componiLista(elementiVivi, elementiMarcati) {
        var vivi = elementiVivi || [];
        var marcati = elementiMarcati || [];
        var lista = [];

        for (var i = 0; i < vivi.length; i++) {
            var vivo = vivi[i];
            if (vivo == null) {
                continue;
            }
            var marcato = null;
            for (var m = 0; m < marcati.length; m++) {
                if (stessoElemento(vivo, marcati[m])) {
                    marcato = marcati[m];
                    break;
                }
            }
            lista.push({
                tipo: vivo.tipo,
                chiave: pulisci(vivo.chiave),
                nome: pulisci(vivo.nome) !== "" ? pulisci(vivo.nome) : (marcato != null ? pulisci(marcato.nome) : ""),
                guidId: pulisci(vivo.guidId) !== "" ? pulisci(vivo.guidId) : (marcato != null ? pulisci(marcato.guidId) : ""),
                presente: true,
                noRender: marcato != null || vivo.noRender === true
            });
        }

        for (var k = 0; k < marcati.length; k++) {
            var marcatoSolo = marcati[k];
            if (marcatoSolo == null) {
                continue;
            }
            var giaInLista = false;
            for (var j = 0; j < lista.length; j++) {
                if (stessoElemento(lista[j], marcatoSolo)) {
                    giaInLista = true;
                    break;
                }
            }
            if (!giaInLista) {
                lista.push({
                    tipo: marcatoSolo.tipo,
                    chiave: pulisci(marcatoSolo.chiave),
                    nome: pulisci(marcatoSolo.nome),
                    guidId: pulisci(marcatoSolo.guidId),
                    presente: false,
                    noRender: true
                });
            }
        }

        return lista;
    }

    /// Payload per il server: solo gli elementi effettivamente in noRender, foto comprese,
    /// senza flag ne' stato di presenza. Se non ce n'e' nessuno l'elenco e' vuoto, e il server
    /// in quel caso toglie del tutto la chiave dai meta.
    function elementiDaSalvare(lista) {
        var risultato = [];
        var elementi = lista || [];
        for (var i = 0; i < elementi.length; i++) {
            var elemento = elementi[i];
            if (elemento == null || elemento.noRender !== true) {
                continue;
            }
            risultato.push({
                tipo: elemento.tipo,
                chiave: pulisci(elemento.chiave),
                nome: pulisci(elemento.nome)
            });
        }
        return risultato;
    }

    /// Elenco usato dalle segnalazioni: agli elementi del box unisce le foto in noRender,
    /// che vivono in membriGruppoFoto. Le foto sono indicizzate per nome file perche' e' cosi'
    /// che compaiono nei report di confronto.
    function elencoPerSegnalazioni(elementiNoRender, membriGruppoFoto) {
        var elenco = (elementiNoRender || []).slice();
        var membri = membriGruppoFoto || [];

        //Nei meta la foto ha per chiave il codice referenza, nei report il nome del file:
        //si aggiunge la voce tradotta, altrimenti la segnalazione non riconosce l'immagine.
        for (var i = 0; i < elenco.length; i++) {
            if (elenco[i] == null || elenco[i].tipo !== TIPO_FOTO) {
                continue;
            }
            var membro = membri.find(m => m != null && m.codRef == elenco[i].chiave);
            if (membro != null && pulisci(membro.nomeFoto) !== "") {
                elenco.push({ tipo: TIPO_FOTO, chiave: pulisci(membro.nomeFoto), nome: pulisci(membro.nomeFoto) });
            }
        }

        return elenco;
    }

    /// Dati di una foto extra a partire dalla sigla. Gli extra del box stanno in due
    /// collezioni del record: Foto.Extra, gestita dall'operatore, e Foto.ExtraAuto, piazzata
    /// dall'automatismo del cliente. Vanno cercate entrambe, altrimenti gli extra automatici
    /// restano senza nome e senza guid, quindi senza miniatura.
    function datiExtraDiSigla(sigla, fotoExtra, fotoExtraAuto) {
        var siglaCercata = pulisci(sigla);
        if (siglaCercata === "") {
            return null;
        }

        var collezioni = [fotoExtra || [], fotoExtraAuto || []];
        for (var c = 0; c < collezioni.length; c++) {
            for (var i = 0; i < collezioni[c].length; i++) {
                var voce = collezioni[c][i];
                if (voce != null && pulisci(voce.sigla) === siglaCercata) {
                    return {
                        nome: pulisci(voce.nome),
                        sigla: siglaCercata,
                        guidId: pulisci(voce.guidId)
                    };
                }
            }
        }

        return null;
    }

    /// Miniatura dell'elemento, quando ne ha una: immagini e loghi hanno un guid in archivio,
    /// campi ed etichette no. L'indirizzo di base e' quello di Olimpo, che il Plugin conosce.
    function urlMiniatura(elemento, indirizzoBase, larghezza) {
        if (elemento == null) {
            return "";
        }

        var haMiniatura = elemento.tipo === TIPO_FOTO || elemento.tipo === TIPO.logo || elemento.tipo === TIPO.fotoExtra;
        var guid = pulisci(elemento.guidId);

        if (!haMiniatura || guid === "" || pulisci(indirizzoBase) === "") {
            return "";
        }

        var larghezzaRichiesta = parseInt(larghezza, 10);
        if (isNaN(larghezzaRichiesta) || larghezzaRichiesta <= 0) {
            larghezzaRichiesta = 50;
        }

        return pulisci(indirizzoBase) + "getThumbNailOnDemand?width=" + larghezzaRichiesta + "&guidId=" + encodeURIComponent(guid);
    }

    /// Dati di una riga del modal: descrizione e i due indirizzi della miniatura, piccola
    /// per la riga e grande per l'ingrandimento. Stanno qui, e non nel disegno della lista,
    /// perche' ogni riga deve portarsi i propri: un indirizzo condiviso fra le righe mostrava
    /// sempre l'ultima immagine.
    function datiRiga(elemento, indirizzoBase) {
        var marcato = elemento != null && elemento.noRender === true;

        return {
            descrizione: descriviElemento(elemento),
            urlMiniatura: urlMiniatura(elemento, indirizzoBase, 50),
            urlIngrandita: urlMiniatura(elemento, indirizzoBase, 300),
            presente: elemento != null && elemento.presente !== false,
            noRender: marcato,
            //Lo stato deve leggersi dalla riga: chi apre il modal deve sapere cosa e' gia'
            //nascosto senza andare a controllare il box in InDesign.
            barrato: marcato,
            etichettaStato: marcato ? "NON RENDERIZZATO" : "",
            testoBottone: marcato ? "Ripristina" : "Nascondi"
        };
    }

    /// Riepilogo in testa all'elenco: quanti elementi del box sono nascosti.
    function riepilogo(lista) {
        var elementi = lista || [];
        var marcati = 0;

        for (var i = 0; i < elementi.length; i++) {
            if (elementi[i] != null && elementi[i].noRender === true) {
                marcati++;
            }
        }

        if (marcati === 0) {
            return "Nessun elemento nascosto: " + elementi.length + " element" + (elementi.length === 1 ? "o" : "i") + " nel box.";
        }

        return marcati + " element" + (marcati === 1 ? "o" : "i") + " su " + elementi.length + " non renderizzat" + (marcati === 1 ? "o" : "i") + ".";
    }

    function inNoRender(elementiMarcati, tipo, chiave) {
        var marcati = elementiMarcati || [];
        for (var i = 0; i < marcati.length; i++) {
            if (stessoElemento(marcati[i], { tipo: tipo, chiave: chiave })) {
                return true;
            }
        }
        return false;
    }

    /// Un elemento assente dal box non e' un difetto se l'operatore lo ha messo in noRender e
    /// poi lo ha cancellato dai livelli: quella mancanza e' voluta e non va segnalata affatto.
    function daSegnalareComeMancante(elementiMarcati, tipo, chiave) {
        return !inNoRender(elementiMarcati, tipo, chiave);
    }

    /// Il caso opposto: l'elemento e' in noRender ma nel documento qualcuno lo ha rimesso
    /// visibile. Qui la segnalazione serve, perche' il documento non rispetta piu' la scelta.
    function daSegnalareComeRiattivato(elementiMarcati, tipo, chiave, visibile) {
        return visibile === true && inNoRender(elementiMarcati, tipo, chiave);
    }

    /// Testo della segnalazione per un elemento disattivato tornato visibile.
    function segnalazioneElementoRiattivato(descrizione) {
        return "elemento disattivato ma presente nel box: " + pulisci(descrizione);
    }

    return {
        TIPO: TIPO,
        TIPO_FOTO: TIPO_FOTO,
        classificaLabel: classificaLabel,
        descriviElemento: descriviElemento,
        componiLista: componiLista,
        elementiDaSalvare: elementiDaSalvare,
        datiExtraDiSigla: datiExtraDiSigla,
        datiRiga: datiRiga,
        riepilogo: riepilogo,
        urlMiniatura: urlMiniatura,
        elencoPerSegnalazioni: elencoPerSegnalazioni,
        inNoRender: inNoRender,
        daSegnalareComeMancante: daSegnalareComeMancante,
        daSegnalareComeRiattivato: daSegnalareComeRiattivato,
        segnalazioneElementoRiattivato: segnalazioneElementoRiattivato
    };
})();

module.exports = NoRenderElementi;
