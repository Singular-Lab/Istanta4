using Istanta.Models;
using IstantaLib;

namespace Istanta.Utility
{
    /// I20-1253: quando una foto del prodotto si puo' eliminare dalla Scheda articolo, e quando la
    /// conferma deve avvisare che la foto e' stata selezionata da poco. Le usano la vista, per il
    /// pulsante e per la conferma, e SchedaArticolo/DeleteFoto, che rifiuta da se' le foto in uso:
    /// cosi' la regola e' una sola.
    ///
    /// Una data di selezione in archivio non c'e'. "Seleziona" (AggiornaPrimario) porta solo
    /// DataModifica a adesso, e la primaria della scheda e' la foto del prodotto con la DataModifica
    /// piu' recente; il Plugin, per ogni area e canale, prende l'attiva piu' recente di quell'ambito.
    public static class EliminazioneFoto
    {
        /// Oltre questo scarto fra inserimento e modifica la foto e' stata toccata dopo essere entrata
        /// in archivio (selezionata, sincronizzata di nuovo): appena caricata le due date coincidono.
        private static readonly TimeSpan ScartoModificaDopoInserimento = TimeSpan.FromMinutes(1);

        public static bool EFotoDelProdotto(ArticoliFoto foto)
        {
            return !foto.Tipo.HasValue || foto.Tipo == (byte)TipoFoto.Foto;
        }

        /// La primaria selezionata della Scheda articolo, con la stessa regola della vista
        /// (_GestioneFoto.cshtml): la foto del prodotto con la DataModifica piu' recente.
        public static ArticoliFoto? PrimariaDellaScheda(IEnumerable<ArticoliFoto>? fotoArticolo)
        {
            return (fotoArticolo ?? Enumerable.Empty<ArticoliFoto>())
                .Where(EFotoDelProdotto)
                .OrderByDescending(o => o.DataModifica)
                .FirstOrDefault();
        }

        /// La foto non si elimina: e' la primaria della scheda, oppure e' l'attiva piu' recente della
        /// sua area e del suo canale, cioe' quella che il Plugin usa per quell'ambito.
        public static bool InUso(ArticoliFoto foto, IEnumerable<ArticoliFoto>? fotoArticolo)
        {
            var tutte = (fotoArticolo ?? Enumerable.Empty<ArticoliFoto>()).ToList();
            if (PrimariaDellaScheda(tutte)?.Id == foto.Id)
            {
                return true;
            }
            if (foto.Attiva != true)
            {
                return false;
            }
            var inUsoNellAmbito = tutte
                .Where(f => EFotoDelProdotto(f) && f.Attiva == true
                    && Ambito(f.Area) == Ambito(foto.Area) && Ambito(f.Canale) == Ambito(foto.Canale))
                .OrderByDescending(o => o.DataModifica)
                .FirstOrDefault();
            return inUsoNellAmbito?.Id == foto.Id;
        }

        /// La foto e' stata selezionata meno di un mese fa: la sua ultima modifica e' di meno di un mese
        /// e la foto e' stata in uso (attiva, o con uno stato di selezione) o toccata dopo l'inserimento.
        /// Una foto appena archiviata senza selezionarla non lo e': e' il caso della foto caricata per errore.
        public static bool SelezionataDiRecente(ArticoliFoto foto, DateTime adesso)
        {
            if (!foto.DataModifica.HasValue)
            {
                return false;
            }
            DateTime modifica = foto.DataModifica.Value;
            if (modifica <= adesso.AddMonths(-1))
            {
                return false;
            }
            bool statoSelezionata = foto.StatoSelezione == (byte)StatoSelezioneFoto.Primaria
                || foto.StatoSelezione == (byte)StatoSelezioneFoto.Selezionata;
            bool toccataDopo = modifica - foto.DataInserimento > ScartoModificaDopoInserimento;
            return foto.Attiva == true || statoSelezionata || toccataDopo;
        }

        /// Vuoto, "*" e null valgono tutti "ovunque".
        private static string Ambito(string? valore)
        {
            return string.IsNullOrWhiteSpace(valore) || valore.Trim() == "*" ? "" : valore.Trim();
        }
    }
}
