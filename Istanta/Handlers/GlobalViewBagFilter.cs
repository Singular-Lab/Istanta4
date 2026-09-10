using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.Extensions.Options;

public class CustomViewBagFilter : IActionFilter
{
    private readonly string nomeCliente;
    private readonly string pathExternalSource;
    public CustomViewBagFilter(IOptions<FicoConfig> ficoConf, IOptions<PathExternal> external_paths)
    {
        this.nomeCliente = ficoConf.Value.nomeCliente;
        this.pathExternalSource = external_paths.Value.pathSource;
    }
    public void OnActionExecuting(ActionExecutingContext context)
    {
        var controller = context.Controller as Controller;
        if (controller != null)
        {
            // Il separatore di percorso dipende dal sistema operativo: normalizzo su "/"
            // prima di cercare il marcatore, altrimenti su Linux IndexOf non trova nulla
            // e Substring restituisce un pezzo arbitrario del percorso.
            string percorsoNormalizzato = this.pathExternalSource.Replace("\\", "/");
            const string marcatore = "external_source/";
            int inizio = percorsoNormalizzato.IndexOf(marcatore);
            string pathSuffix = inizio >= 0
                ? percorsoNormalizzato.Substring(inizio + marcatore.Length).Trim('/')
                : "";
            string relPath = pathSuffix != "" ? "/" + pathSuffix : "";// this.nomeCliente;
            controller.ViewBag.ExternalSourceCustom = relPath;
        }
        else
        {
            controller!.ViewBag.ExternalSourceCustom = "";
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}