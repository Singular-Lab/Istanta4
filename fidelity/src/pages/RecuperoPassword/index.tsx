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
import CardAccesso from "../HubLogin/components/CardAccesso";
import ProviderCard from "../HubLogin/components/ProviderCard";

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
    <CardAccesso
      titolo="Recupero Password"
      descrizione={
        hasInternalProvider
          ? "Inserisci l'email associata al tuo account per ricevere le istruzioni di recupero."
          : "Seleziona il servizio con cui hai effettuato la registrazione per recuperare la password."
      }
    >
      {/* Loading */}
      {loadingProviders && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" etichetta="Caricamento metodi di accesso" />
        </div>
      )}

      {/* Errore */}
      {generalError && (
        <Alert
          variant="soft-danger"
          icona="CircleAlert"
          titolo="Errore"
          onChiudi={() => setGeneralError(null)}
          className="mb-5 text-sm"
        >
          {generalError}
        </Alert>
      )}

      {/* Successo */}
      {successMessage && (
        <Alert
          variant="soft-success"
          icona="CircleCheck"
          onChiudi={() => setSuccessMessage(null)}
          className="mb-5 text-sm"
        >
          {successMessage}
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
                <Alert variant="soft-warning" icona="Info" className="mb-4 text-sm">
                  Il recupero password è gestito dal tuo provider di autenticazione.
                  Seleziona il servizio per procedere.
                </Alert>
              )}

              <div className="space-y-2">
                {externalProviders.map((provider, index) => {
                  const resetUrl = provider.config_client?.password_reset_url;
                  return (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      index={index}
                      onClick={() => handleExternalReset(provider)}
                      disabled={!resetUrl}
                      titolo={`Recupera tramite ${provider.nome}`}
                      descrizione={
                        resetUrl
                          ? "Verrai reindirizzato al servizio esterno"
                          : "Contatta il tuo amministratore per il recupero password"
                      }
                      indicatore={resetUrl ? "esterno" : "nessuno"}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Nessun provider configurato */}
          {providers.length === 0 && !loadingProviders && (
            <Alert variant="soft-secondary" icona="TriangleAlert" className="text-sm">
              Nessun provider di autenticazione configurato. Contatta l'amministratore del sistema.
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
          <Lucide icon="ArrowLeft" aria-hidden="true" className="w-4 h-4" />
          Torna al Login
        </Link>
      </div>
    </CardAccesso>
  );
};

export default RecuperoPassword;
