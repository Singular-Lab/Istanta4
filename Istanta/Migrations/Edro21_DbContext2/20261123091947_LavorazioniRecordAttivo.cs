using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto2
{
    /// <summary>
    /// TASK-bb04f9aa: promo_lavorazioni_records.attivo. Una riga disattivata e' un box uscito dalla
    /// lavorazione di cui si conservano i meta. Il default e' true, scritto a mano al posto del false
    /// generato: le righe che esistono gia' sono tutte impaginazioni in corso.
    /// </summary>
    public partial class LavorazioniRecordAttivo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "attivo",
                table: "promo_lavorazioni_records",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "attivo",
                table: "promo_lavorazioni_records");
        }
    }
}
