using DocumentFormat.OpenXml.InkML;
using Istanta.Models;
using Newtonsoft.Json;
using System.Net.Http;
using System.Text;
using System;
using DocumentFormat.OpenXml.Wordprocessing;
using IstantaLib;

namespace Istanta.MiddleWare
{
    public static class FICOMiddleware
    {

        public static async Task<FICOLoginResponse> login(string olUrl, Utenti user, string secretKey, OlympusUserPolicyRequest[] policy, edro21_dbContext ctx, HttpClient httpClient)
        {
            FICOLoginResponse result = new FICOLoginResponse();

            StringContent? content = null;

            httpClient.DefaultRequestHeaders.Clear();
            //var client = new HttpClient();            
            if (user!=null && user.PrivateKey!=null)
            {
                httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + user.PrivateKey);                
            }
            else if (secretKey != "")
            {
                //Devo anche mandare i miei dati anagrafici
                httpClient.DefaultRequestHeaders.Add("fico-secret", secretKey);


                FICOPassportCredentials fICOPassportCredentials = new FICOPassportCredentials() {

                    username = user!.Email,
                    tipoUtente = (FicoUserType)user.Ruolo,
                    origin = FICOOrigins.Istanta,
                    campi_aggiuntivi = new Dictionary<string, string>()                    
                
                };

                //Console.WriteLine("fico secret " + secretKey);
                //Console.WriteLine("FICO policy configured " + policy.Length);

                foreach (OlympusUserPolicyRequest oup in policy)
                {
                    if (oup.source == "nome")
                    {
                        //Console.WriteLine("set FICO NOME: " + user.Nome);
                        fICOPassportCredentials.campi_aggiuntivi.Add("nome", user.Nome!);
                    }
                    else if (oup.source == "cognome")
                    {
                        //Console.WriteLine("set FICO COGNOME: " + user.Cognome);
                        fICOPassportCredentials.campi_aggiuntivi.Add("cognome", user.Cognome!);
                    }
                }

                //Console.WriteLine(JsonConvert.SerializeObject(fICOPassportCredentials));

                content = new StringContent(JsonConvert.SerializeObject(fICOPassportCredentials), Encoding.UTF8, "application/json");
                // Effettua la richiesta PUT
            }
            else
            {
                throw new Exception("Errore chiamata");
            }

            string url = $"{olUrl}/auth/getPassport";

            try
            {
                var response = await httpClient.PutAsync(url, content);

                if (response.IsSuccessStatusCode)
                {

                    var contentResponse = await response.Content.ReadAsStringAsync();
                    result = JsonConvert.DeserializeObject<FICOLoginResponse>(contentResponse)!;

                    if (result.esito && user.PrivateKey == null && result.privateKey != null)
                    {
                        //Salvo per sempre la mia chiave privata
                        user.PrivateKey = result.privateKey;
                        ctx.SaveChanges();
                    }
                }
                else
                {
                    throw new Exception("Errore chiamata: " + response.Content.ReadAsStringAsync());
                }
            }
            catch(Exception ex)
            {
                result.error = ex.ToString();
            }

            return result;
           
        }

    }
}
