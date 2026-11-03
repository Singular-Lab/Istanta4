using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Correggo4.Migrations
{
    /// <summary>
    /// I20-1186: la correzione del gruppo fatta dalla «Modifica referenza» del timone, sul capogruppo.
    /// Colonna nullable: il Correggo4 gia' distribuito non la legge e continua a funzionare.
    /// </summary>
    public partial class AggiungiModificaGruppo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "modifica_gruppo",
                table: "volantini_timone_voci",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "modifica_gruppo",
                table: "volantini_timone_voci");
        }
    }
}
