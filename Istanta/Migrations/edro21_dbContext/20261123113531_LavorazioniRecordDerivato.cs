using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto1
{
    /// <summary>
    /// Riallinea lo snapshot del primo contesto alla colonna nuova di PromoLavorazioniRecord (DerivatoDi). Nel
    /// primo contesto l'entita' e' raggiunta per navigazione e senza ToTable: la tabella PromoLavorazioniRecord
    /// non esiste in nessun database, e un ALTER farebbe fallire l'avvio. Per questo Up e Down sono vuoti, come
    /// in LavorazioniRecordAttivo; la colonna vera la aggiunge la migration omonima del secondo contesto.
    /// </summary>
    public partial class LavorazioniRecordDerivato : Migration
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
