import IstantaLogo from "@/assets/images/logo_ext.png";
import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormField, FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Spinner from "@/components/Base/Spinner";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import * as yup from "yup";
import { ServerCall } from "../../../lib/server_call";
import type { AuthProviderDTO } from "../../../lib/types";
import HubBackground from "../HubLogin/components/HubBackground";
const isImageIcon = (icona: string) =>
  icona.startsWith("data:image/") || icona.startsWith("http://") || icona.startsWith("https://");

// Schema di validazione
const recuperoSchema = yup.object({
  email: yup
    .string()
    .required("L'email è obbligatoria")
    .email("Inserisci un indirizzo email valido"),
}).required();

type RecuperoForm = yup.InferType<typeof recuperoSchema>;

const RecuperoPassword: React.FC = () => {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RecuperoForm>({
    resolver: yupResolver(recuperoSchema),
    defaultValues: { email: "" },
  });

  // Fetch auth providers per capire se il recupero interno è disponibile
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['authProviders'],
    queryFn: () => ServerCall.get<AuthProviderDTO[]>('/auth-providers'),
    staleTime: 1000 * 60 * 60,
  });

  const hasInternalProvider = providers.some(p => p.tipo === 'internal');
  const externalProviders = providers.filter(p => p.tipo !== 'internal');

  // Chiamata per richiedere il reset password
  const recuperoFn = async (data: RecuperoForm): Promise<{ message: string }> => {
    const response = await ServerCall.post<{ message: string }>("/email/recupero-password", {
      email: data.email,
    });
    return response;
  };

  const recuperoMutation = useMutation({
    mutationFn: recuperoFn,
    mutationKey: ["recuperoPassword"],
    onSuccess: () => {
      setSuccessMessage(
        "Se l'email è registrata nel sistema, riceverai a breve le istruzioni per reimpostare la password."
      );
      setGeneralError(null);
    },
    onError: () => {
      // Per sicurezza, mostriamo sempre lo stesso messaggio generico
      setSuccessMessage(
        "Se l'email è registrata nel sistema, riceverai a breve le istruzioni per reimpostare la password."
      );
      setGeneralError(null);
    },
  });

  const onFormError = () => {
    setFocus("email");
  };

  const onSubmit = async (data: RecuperoForm) => {
    setGeneralError(null);
    setSuccessMessage(null);
    await recuperoMutation.mutateAsync(data);
  };

  const handleExternalReset = (provider: AuthProviderDTO) => {
    const resetUrl = provider.config_client?.password_reset_url;
    if (resetUrl) {
      window.open(resetUrl, "_blank");
    }
  };

  return (
    <>
      <HubBackground />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[460px]">
          {/* Card glassmorphism: sullo sfondo a gradiente l'ombra standard della card non la stacca */}
          <div className="backdrop-blur-xl bg-white/75 border border-white/30 rounded-card shadow-2xl p-8 sm:p-10">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={IstantaLogo} alt="Istanta 2 GDO Suite" className="h-12 sm:h-14" />
            </div>

            <h1 className="title-page text-center text-slate-800 mb-1">
              Recupero Password
            </h1>
            <p className="text-center text-sm text-slate-500 mb-6">
              {hasInternalProvider
                ? "Inserisci l'email associata al tuo account per ricevere le istruzioni di recupero."
                : "Seleziona il servizio con cui hai effettuato la registrazione per recuperare la password."
              }
            </p>

            {/* Loading */}
            {loadingProviders && (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" etichetta="Caricamento metodi di accesso" />
              </div>
            )}

            {/* Errore */}
            {generalError && (
              <Alert variant="soft-danger" className="flex items-center gap-2 px-4 py-3 mb-5">
                <Lucide icon="CircleAlert" aria-hidden="true" className="w-5 h-5 shrink-0" />
                <span className="text-sm">
                  <span className="font-medium mr-1">Errore:</span>
                  {generalError}
                </span>
                <button type="button" onClick={() => setGeneralError(null)} className="ml-auto shrink-0" aria-label="Chiudi">
                  <Lucide icon="X" aria-hidden="true" className="w-4 h-4" />
                </button>
              </Alert>
            )}

            {/* Successo */}
            {successMessage && (
              <Alert variant="soft-success" className="flex items-start gap-2 px-4 py-3 mb-5">
                <Lucide icon="CircleCheck" aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-sm">{successMessage}</span>
                <button type="button" onClick={() => setSuccessMessage(null)} className="ml-auto shrink-0" aria-label="Chiudi">
                  <Lucide icon="X" aria-hidden="true" className="w-4 h-4" />
                </button>
              </Alert>
            )}

            {!loadingProviders && (
              <div className="space-y-4">
                {/* Form recupero interno - solo se esiste un provider internal */}
                {hasInternalProvider && !successMessage && (
                  <form
                    onSubmit={handleSubmit(onSubmit, onFormError)}
                    className="space-y-4 animate-fade-in-up"
                  >
                    <FormField etichetta="Email" errore={errors.email?.message}>
                      <FormInput
                        id="email"
                        {...register("email")}
                        type="email"
                        className={clsx(
                          "block px-4 py-3 rounded-control border-slate-300/80 w-full",
                          errors.email && "border-danger"
                        )}
                        placeholder="inserisci la tua email"
                        autoComplete="email"
                      />
                    </FormField>

                    <Button
                      variant="primary"
                      rounded
                      type="submit"
                      loading={isSubmitting || recuperoMutation.isPending}
                      className="bg-gradient-to-r from-theme-1/90 to-theme-2/90 w-full py-3"
                    >
                      Invia Istruzioni
                    </Button>
                  </form>
                )}

                {/* Provider esterni - se ce ne sono */}
                {externalProviders.length > 0 && (
                  <div className={clsx(hasInternalProvider && "pt-2")}>
                    {hasInternalProvider && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-slate-300/50" />
                        <span className="text-xs text-slate-400 font-medium">oppure</span>
                        <div className="flex-1 h-px bg-slate-300/50" />
                      </div>
                    )}

                    {!hasInternalProvider && (
                      <Alert variant="soft-warning" className="flex items-start gap-2 px-4 py-3 mb-4">
                        <Lucide icon="Info" aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
                        <span className="text-sm">
                          Il recupero password è gestito dal tuo provider di autenticazione.
                          Seleziona il servizio per procedere.
                        </span>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      {externalProviders.map((provider, index) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleExternalReset(provider)}
                          disabled={!provider.config_client?.password_reset_url}
                          className={clsx(
                            "w-full flex items-center gap-4 p-4 rounded-control transition-all duration-300 text-left",
                            "border border-slate-200/50",
                            provider.config_client?.password_reset_url
                              ? "hover:border-theme-1/30 hover:bg-theme-1/5 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                              : "opacity-60 cursor-not-allowed",
                            "animate-fade-in-up"
                          )}
                          style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-theme-1/10 text-theme-1 shrink-0">
                            {isImageIcon(provider.icona) ? (
                              <img src={provider.icona} alt={provider.nome} className="w-5 h-5 object-contain" />
                            ) : (
                              <Lucide icon={provider.icona as any} className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 text-sm">
                              Recupera tramite {provider.nome}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {provider.config_client?.password_reset_url
                                ? "Verrai reindirizzato al servizio esterno"
                                : "Contatta il tuo amministratore per il recupero password"
                              }
                            </div>
                          </div>
                          {provider.config_client?.password_reset_url && (
                            <Lucide icon="ExternalLink" className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nessun provider configurato */}
                {providers.length === 0 && !loadingProviders && (
                  <Alert variant="soft-secondary" className="flex items-start gap-2 px-4 py-3">
                    <Lucide icon="AlertTriangle" aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Nessun provider di autenticazione configurato. Contatta l'amministratore del sistema.
                    </span>
                  </Alert>
                )}
              </div>
            )}

            {/* Torna al Login */}
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-theme-1 hover:underline transition-colors"
              >
                <Lucide icon="ArrowLeft" className="w-4 h-4" />
                Torna al Login
              </Link>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 text-xs text-slate-400">
              Powered by Singular Lab
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecuperoPassword;
