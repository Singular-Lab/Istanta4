using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Correggo4.Migrations
{
    /// <summary>
    /// I20-1186: migration di partenza di Correggo4Context. Lo schema c'e' gia' su ogni database, creato
    /// da correggo4/db/correggo4_schema.sql (31 tabelle, le stesse del modello), e questa migration lo
    /// registra senza toccarlo. Per questo Up e Down sono vuoti. Il modello di partenza e' nel Designer.
    ///
    /// All'avvio Correggo4 crea la tabella __EFMigrationsHistory e ci scrive questa riga. Su un database
    /// nuovo va prima lo schema del bundle (docker/istanta-correggo/schemas/correggo4/01-schema.sql).
    /// </summary>
    public partial class Baseline : Migration
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
