using Istanta.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.IO;
using Newtonsoft.Json;
using DocumentFormat.OpenXml.Spreadsheet;

namespace Istanta.Controllers
{
    public class TestJsonOlympus
    {
        public int Id { get; set; }
        public int IdRef { get; set; }
        public string? FileName { get; set; }
        public string? FileHash { get; set; }
    }

    public class TestController : Controller
    {
        private readonly ILogger<MenaboController> _logger;
        private readonly IConfiguration _config;
        private readonly string path_external_source = "";

        public TestController(ILogger<MenaboController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib)
        {

            _logger = logger;
            _config = configuration;
            path_external_source = external_lib.Value.pathSource;
        }

        public IActionResult Index()
        {
            return View();
        }

        //[HttpGet]
        //[Route("Test/hello")]
        //public async Task<IActionResult> hello()
        //{
        //    return Ok("Hello World");
        //}


        //[HttpGet]
        //[Route("Test/generaPacchettoFotoOlympus/{folder}")]
        //public async Task<IActionResult> generaPacchettoFotoOlympus(string folder)
        //{
        //    List<TestJsonOlympus> _result = new List<TestJsonOlympus>();
        //    string[] files = Directory.GetFiles(path_external_source + folder);
        //    foreach(string f in files)
        //    {
        //        string fileName = Path.GetFileName(f);

        //        ArticoliFoto afItem = ctx.ArticoliFotos.Where(x => x.NomeReale == fileName).FirstOrDefault()!;
        //        if (afItem!=null)
        //        {
        //            TestJsonOlympus obj = new TestJsonOlympus();
        //            obj.IdRef = afItem.Id;
        //            obj.FileName = afItem.NomeReale;
        //            /*if (afItem.Hash != null)
        //                obj.FileHash = afItem.Hash;
        //            else*/
        //                obj.FileHash = GetMD5HashFromFile2(f);

        //            _result.Add(obj);
        //        }
        //    }

        //    string jsonStr = JsonConvert.SerializeObject(_result);

        //    using (StreamWriter sw = new StreamWriter(this.path_external_source + "Metadata.json", false))
        //    {
        //        sw.WriteLine(jsonStr);
        //    }

        //    return Ok();
        //}

        //protected string GetMD5HashFromFile(string fileName)
        //{
        //    using (var md5 = MD5.Create())
        //    {
        //        using (var stream =System.IO. File.OpenRead(fileName))
        //        {
        //            return BitConverter.ToString(md5.ComputeHash(stream)).Replace("-", string.Empty);
        //        }
        //    }
        //}
        //protected string GetMD5HashFromFile2(string fileName)
        //{
        //    using (System.Security.Cryptography.MD5 md5 = System.Security.Cryptography.MD5.Create())
        //    {
        //        using (var stream = System.IO.File.OpenRead(fileName))
        //        {                    
        //            byte[] hashBytes = md5.ComputeHash(stream);
        //            return Convert.ToHexString(hashBytes); // .NET 5 +
        //        }
        //    }
        //}
    }
}
