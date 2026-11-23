using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto2
{
    /// <summary>
    /// TASK-22d7fad2: promo_lavorazioni_records.derivato_di. Non nulla per un box derivato, cioe' una seconda
    /// impaginazione dello stesso record: vale l'Id della riga del box originale. Senza chiave esterna, perche'
    /// il derivato resta valido anche se l'originale esce. Le righe che esistono gia' restano a null.
    /// </summary>
    public partial class LavorazioniRecordDerivato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "derivato_di",
                table: "promo_lavorazioni_records",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "derivato_di",
                table: "promo_lavorazioni_records");
        }
    }
}
