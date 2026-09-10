using Istanta.Models;
using Istanta.Utility;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using Microsoft.Extensions.FileSystemGlobbing;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Istanta.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
            ViewData["jsGuid"] = Guid.NewGuid().ToString();
        }

        public IActionResult Index()
        {
            /*
            this.ViewData["MyName"] = "Alessio Mattolini";
            this.ViewData["num1"] = 50;
            this.ViewData["num2"] = 100;


            string[] pattern = new string[] { "(^|_)([^_]+)", "^[^\\s]{1,30}$" };//{ @"(^|_)([^_]+)" , "^\\d{1,15}$" };
            string[] ignoringKeys = new string[] { "$", "_"};
            string fieldValue = "_8000430138832";
            int index = 0;

            MatchCollection matches=null;
            foreach (string regex in pattern)
            {
                matches = Regex.Matches(fieldValue, regex);
                if (matches.Count > index)
                {
                    fieldValue = matches[index].Value;
                    foreach (string ignore in ignoringKeys)
                    {
                        if (fieldValue.IndexOf(ignore) >= 0)
                        {
                            fieldValue = fieldValue.Replace(ignore, "");
                        }
                    }
                }
                else
                {
                    matches = null;
                    fieldValue = "";

                }
            }

            //MatchCollection matches = Regex.Matches("$8000_boh", pattern);
            //matches = Regex.Matches(matches[0].Value, @"^\d{1,5}$");
            */

            var impRes = new ImpersonateHelper();
            ViewBag.NomePrima = impRes.nomePrima.ToString();
            ViewBag.NomeDopo = impRes.nomeDopo.ToString();
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}