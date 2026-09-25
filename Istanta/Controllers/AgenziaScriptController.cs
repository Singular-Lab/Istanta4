using Microsoft.AspNetCore.Mvc;

namespace Istanta.Controllers
{
    /// I20-997: lo script di agenzia del cliente montato su questa macchina.
    ///
    /// Un solo indirizzo per tutti, uguale su ogni installazione: nel sorgente della pagina non
    /// compare piu' nessun nome di cliente. Gli archivi stanno fuori da wwwroot, quindi non si
    /// scaricano per indirizzo nemmeno indovinandolo, ed e' il motivo per cui questo controller
    /// esiste invece di un semplice file statico.
    public class AgenziaScriptController : Controller
    {
        private readonly IWebHostEnvironment _ambiente;

        public AgenziaScriptController(IWebHostEnvironment ambiente)
        {
            _ambiente = ambiente;
        }

        [HttpGet]
        [Route("Agenzia/script.js")]
        public IActionResult Script()
        {
            //Stessa variabile che Program.cs usa per scegliere appsettings.<cliente>.json: una
            //sola fonte per "quale cliente e' montato qui".
            string? cliente = Environment.GetEnvironmentVariable("ISTANTA_CLIENTE");

            if (!Utility.ScriptAgenzia.NomeAccettabile(cliente))
            {
                //Si fallisce in chiaro invece di servire un file qualunque. E' la stessa scelta
                //di Program.cs, che ferma l'avvio quando il cliente non esiste: partire sul
                //cliente sbagliato e' il guasto piu' difficile da riconoscere.
                return Problem(
                    detail: "ISTANTA_CLIENTE non e' impostata o non e' un nome valido: non so quale script di agenzia servire.",
                    statusCode: 500);
            }

            //La radice del contenuto, non quella di output: in sviluppo e' la cartella del
            //progetto, quindi si legge il file che si sta modificando e basta ricaricare la
            //pagina. In pubblicazione e' la cartella dell'applicazione, dove il csproj li copia.
            string radice = Path.Combine(_ambiente.ContentRootPath, Utility.ScriptAgenzia.Cartella);

            if (!Directory.Exists(radice))
            {
                return Problem(
                    detail: "La cartella degli script di agenzia non esiste: " + radice,
                    statusCode: 500);
            }

            var cartelle = Directory.GetDirectories(radice).Select(d => new DirectoryInfo(d).Name);
            string? cartella = Utility.ScriptAgenzia.TrovaCartella(cartelle, cliente);

            if (cartella == null)
            {
                return Problem(
                    detail: "Nessuno script di agenzia per il cliente " + cliente + ".",
                    statusCode: 500);
            }

            string percorso = Path.Combine(radice, cartella, Utility.ScriptAgenzia.NomeFile);

            if (!System.IO.File.Exists(percorso))
            {
                return Problem(
                    detail: "Manca " + Utility.ScriptAgenzia.NomeFile + " per il cliente " + cliente + ".",
                    statusCode: 500);
            }

            //Si rilegge dal disco a ogni richiesta, senza cache del server: chi sviluppa modifica
            //l'archivio del suo cliente e ricarica la pagina, senza rebuild e senza riavvio. La
            //cache del browser la governa gia' il layout con il suo identificativo.
            return Content(System.IO.File.ReadAllText(percorso), "application/javascript");
        }
    }
}
