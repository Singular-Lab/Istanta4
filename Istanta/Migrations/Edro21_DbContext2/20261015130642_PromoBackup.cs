using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Istanta.Migrations.Contesto2
{
    /// <summary>
    /// I20-1106 (Lotto 1): la tabella promo_backup, i backup dei record di una promo (Models_2/PromoBackup.cs).
    /// E' la prima migration che il bundle non conosce: la applica Istanta all'avvio (Migrazioni.ApplicaAllAvvio),
    /// per questo 01-istanta.sql non la contiene e non deve contenerla.
    /// </summary>
    public partial class PromoBackup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "promo_backup",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_promo = table.Column<int>(type: "integer", nullable: false),
                    tipo = table.Column<byte>(type: "smallint", nullable: false, comment: "1-record dei tracciati 2-record delle lavorazioni"),
                    data_backup = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    origine = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    conteggio = table.Column<int>(type: "integer", nullable: false),
                    contenuto = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_promo_backup", x => x.id);
                    table.ForeignKey(
                        name: "FK_promo_backup_promo",
                        column: x => x.id_promo,
                        principalTable: "promo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_promo_backup_id_promo",
                table: "promo_backup",
                column: "id_promo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "promo_backup");
        }
    }
}
