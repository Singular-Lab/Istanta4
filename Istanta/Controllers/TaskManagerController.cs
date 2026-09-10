using Microsoft.AspNetCore.Mvc;
using Istanta.Models_2;
using Istanta.SocketsManager;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Controllers
{

    public class TaskManagerController:Controller
    {
        private readonly ILogger<RevisoreController> _logger;
        private readonly Edro21_DbContext2 ctx2;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public TaskManagerController(ILogger<RevisoreController> logger, IConfiguration configuration, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;

        }

        [HttpGet]
        public async Task<IActionResult> Index(int id_promo, string id_tracciati)
        {
            
            return View();
        }
    }
}
