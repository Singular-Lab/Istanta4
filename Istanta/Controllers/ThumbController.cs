using Istanta.Models;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
//using static System.Net.WebRequestMethods;
using Microsoft.Extensions.Options;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace Istanta.Controllers
{
    public class ThumbController : Controller
    {
        private string path_jpg;
        private readonly string connString = "";
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public ThumbController(IOptions<PathFotoJpg> options, IConfiguration configuration, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            options.ToString();
            path_jpg = options.Value.path;

            this.connString = configuration.GetConnectionString("IstandaConnectionDb")!;
            this._dbContextFactory = dbContextFactory;
        }

        [HttpGet]
        [Route("Thumb/Ale")]
        public async Task<IActionResult> Index()
        {
            return Ok("Ciaoooo");
        }

        [HttpGet]
        public async Task<IActionResult> Index(string codice, Int64 id_foto, int w, int h)
        {
            
            edro21_dbContext ctx = this._dbContextFactory.CreateDbContext(); //new edro21_dbContext(this.connString);


            string path = path_jpg + "0.png";

            if (id_foto > 0)
            {
                var articolo_foto = await ctx.ArticoliFotos.Where(a => a.Id == id_foto).FirstOrDefaultAsync();
                if (articolo_foto != null)
                {

                    FileInfo fi = new FileInfo(articolo_foto.NomeReale);
                    path = path_jpg + articolo_foto.NomeReale.Replace(fi.Extension, ".jpg");
                }
                else
                {
                    //NoContent();
                    return Ok("Ops");
                }
            }
            else if (codice != null)
            {

                var articolo = await ctx.Articolis.Include(i => i.ArticoliFotos).Where(a => a.Codice == codice).FirstOrDefaultAsync();

                if (articolo != null)
                {
                    //Elaboro l'immagine
//#warning ATTENZIONE - Rimettere DataModifica in produzione
                    ArticoliFoto? foto_primaria = articolo.ArticoliFotos!.Where(f => (!f.Tipo.HasValue || f.Tipo == (Byte)TipoFoto.Foto) && f.Attiva == true).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                    if (foto_primaria != null)
                    {
                        path = foto_primaria.NomeReale;
                        FileInfo _fi = new FileInfo(path);
                        path = path.Replace(_fi.Extension, ".jpg");
                        path = path_jpg + path;

                    }
                }
                else
                {
                    NoContent();
                }

            }
            else
            {
                NoContent();
            }

            if (!System.IO.File.Exists(path))
            {
                path = path_jpg + "0.png";
            }

            if (System.IO.File.Exists(path))
            {

                //Response.Write("success");

                Image? image = Image.FromFile(path);

                int h_prop = (w * image.Height) / image.Width;


                int srcWidth = image.Width;
                int srcHeight = image.Height;
                int thumbHeight = h_prop;

                int destWidth = w;
                int destHeight = h_prop;

                System.Drawing.Bitmap bmp = new Bitmap(w, thumbHeight);

                if (srcHeight > srcWidth)
                {
                    int w_prop = (h * image.Width) / image.Height;
                    bmp = new Bitmap(w_prop, h);
                    destWidth = w_prop;
                    destHeight = h;
                }


                System.Drawing.Graphics gr = Graphics.FromImage(bmp);
                gr.SmoothingMode = SmoothingMode.HighQuality;
                gr.CompositingQuality = CompositingQuality.HighQuality;
                gr.InterpolationMode = InterpolationMode.High;

                gr.DrawImage(image, 0, 0, destWidth, destHeight);

                MemoryStream ms = new MemoryStream();
                bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);


                bmp.Dispose();
                image.Dispose();

                /*byte[] bytes = ms.ToArray();               
                string base64 = "data:image/png;base64," + Convert.ToBase64String(bytes);*/
                ms.Position = 0;
                return File(ms, "image/png");// Ok(base64);
            }


            return Ok("Not found " + path);// NotFound();
        }
    }
}
