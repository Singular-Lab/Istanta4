using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using System.Collections.Generic;
using Newtonsoft.Json;
using Microsoft.Extensions.Options;
using Istanta.MiddleWare;
using DocumentFormat.OpenXml.Spreadsheet;
using System.Text;
using IstantaLib;
using Istanta.Utility;

namespace Istanta.Controllers
{
    public class CustomPlugin : Controller
    {
        private readonly ILogger<CustomPlugin> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly string olUrl;
        private readonly string fpUrl;
        private readonly OlympusUserPolicyRequest[] olympusUserPolycy;
        private readonly string secretKey;
        private readonly HttpClient httpClient;
        private readonly LogAssistent logAssistent;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public CustomPlugin(ILogger<CustomPlugin> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<FicoConfig> ficoConf, IHttpClientFactory httpClientFactory, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext(); //new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);

            olUrl = ficoConf.Value.olympusServerUrl;
            fpUrl= ficoConf.Value.fpServerUrl;
            olympusUserPolycy = ficoConf.Value.userDataPolicy!;
            secretKey = ficoConf.Value.secretKey;

            httpClient=httpClientFactory.CreateClient();

            logAssistent = new LogAssistent();

        }

        public async Task<IActionResult> Index()
        {
            this.ViewBag.error = "Interfaccia non implementata";

            return View();
        }

        private async Task Bind()
        {
            var source = exClass.getCustomPluginAgenzia();// await this.ctx.Arees.OrderBy(o=>o.IndiceCombo).ToListAsync();
            this.ViewBag.source = source.DB;
        }

        [HttpGet]
        [Route("CustomPlugin/getCustomPlugin")]
        public async Task<IActionResult> getCustomPlugin()
        {
            var _list = exClass.getCustomPluginAgenzia();
            return Ok(_list.DB);
        }

        [HttpPut]
        [Route("CustomPlugin/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            bRes = SingletonConfiguration.dbPluginAgenzia!.SetJsonSource(request.jsoncode);

            return Ok(bRes);
        }
    }
}
