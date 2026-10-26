using Istanta.Models;
using Microsoft.Identity.Client;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Istanta.Controllers
{
    public interface IExternalUserValidator
    {
        Task<ExternalValidationResult> ValidateAsync(string customerId, string email);
    }

    public record ExternalValidationResult(bool Allowed, string? Reason);

    public class NoExternalValidator : IExternalUserValidator
    {
        public Task<ExternalValidationResult> ValidateAsync(string customerId, string email)
            => Task.FromResult(new ExternalValidationResult(true, null));
    }

    public class EntraIDUserValidator : IExternalUserValidator
    {
        private readonly AuthADOptions _cfg;

        public EntraIDUserValidator(AuthADOptions cfg)
        {
            _cfg = cfg;
        }

        public async Task<ExternalValidationResult> ValidateAsync(string customerId, string email)
        {
            if (_cfg == null)
                return new ExternalValidationResult(true, null);

            var token = await AuthEntraIDController.GetGraphTokenAsync(_cfg.TenantId, _cfg.ClientId, _cfg.ClientSecret);

            var enabled = await AuthEntraIDController.IsUserEnabledInEntraAsync(token, email);

            return enabled
                ? new ExternalValidationResult(true, null)
                : new ExternalValidationResult(false, "Utente non presente o disabilitato su Entra ID");
        }
    }

    public static class AuthEntraIDController
    {
        public static async Task<string> GetGraphTokenAsync(
    string tenantId,
    string clientId,
    string clientSecret)
        {
            var app = ConfidentialClientApplicationBuilder
                .Create(clientId)
                .WithClientSecret(clientSecret)
                .WithAuthority($"https://login.microsoftonline.com/{tenantId}")
                .Build();

            var result = await app
                .AcquireTokenForClient(new[] { "https://graph.microsoft.com/.default" })
                .ExecuteAsync();

            return result.AccessToken;
        }
        public static async Task<bool> IsUserEnabledInEntraAsync(
    string accessToken,
    string email)
        {
            using var http = new HttpClient();

            http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);

            var url = "https://graph.microsoft.com/v1.0/users" +
                      $"?$filter=mail eq '{email}' or userPrincipalName eq '{email}'" +
                      $"&$select=id,accountEnabled,mail,userPrincipalName";

            var res = await http.GetAsync(url);

            if (!res.IsSuccessStatusCode)
                throw new Exception($"Graph error: {res.StatusCode}");

            var json = await res.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(json);
            var users = doc.RootElement.GetProperty("value");

            if (users.GetArrayLength() == 0)
                return false; // non esiste nel tenant

            var accountEnabled = users[0].GetProperty("accountEnabled").GetBoolean();
            return accountEnabled;
        }
    }
}
