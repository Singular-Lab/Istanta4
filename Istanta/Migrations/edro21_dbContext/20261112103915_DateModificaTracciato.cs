using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto1
{
    /// <summary>
    /// Riallinea lo snapshot del primo contesto alle due date nuove di PromoTracciatiRecord
    /// (DataModifica, DataModificaStrutturale). Nel primo contesto l'entita' e' raggiunta per navigazione e
    /// senza ToTable: la tabella PromoTracciatiRecord non esiste in nessun database, e un ALTER farebbe fallire
    /// l'avvio. Per questo Up e Down sono vuoti, come in TimestampSenzaFuso; le colonne vere le aggiunge la
    /// migration omonima del secondo contesto. Il modello e' nel Designer.
    /// </summary>
    public partial class DateModificaTracciato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
