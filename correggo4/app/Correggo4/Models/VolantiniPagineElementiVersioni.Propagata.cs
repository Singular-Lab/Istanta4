namespace Correggo4.Models;

/// <summary>
/// j227: la colonna aggiunta a mano dopo lo scaffold. Sta in un file a parte, cosi' un nuovo
/// scaffold di VolantiniPagineElementiVersioni.cs non la cancella.
/// </summary>
public partial class VolantiniPagineElementiVersioni
{
    /// <summary>
    /// Edit avanzato propagato: il box **pilota** da cui arriva la correzione (l'originale metteva
    /// questo stesso id dentro id_elemento_propagazione, che qui invece punta ai propagati delle
    /// catene di note e timbri). Quando e' valorizzato, nuova_versione e' vuota: i campi e le foto
    /// si leggono dalla correzione del pilota.
    /// </summary>
    public long? IdElementoMaster { get; set; }
}
