using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto2
{
    /// <summary>
    /// Le date di modifica dei record dei tracciati: data_modifica e' l'ultima importazione che ha cambiato il
    /// dato (alla nascita vale data_registrazione), data_modifica_strutturale l'ultimo cambio strutturale
    /// (null finche' non ce n'e' uno). Le righe che esistono gia' partono con data_modifica = data_registrazione.
    /// </summary>
    public partial class DateModificaTracciato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "data_modifica",
                table: "promo_tracciati_records",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "data_modifica_strutturale",
                table: "promo_tracciati_records",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.Sql("UPDATE promo_tracciati_records SET data_modifica = data_registrazione WHERE data_modifica IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "data_modifica",
                table: "promo_tracciati_records");

            migrationBuilder.DropColumn(
                name: "data_modifica_strutturale",
                table: "promo_tracciati_records");
        }
    }
}
