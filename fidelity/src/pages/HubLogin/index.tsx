import IstantaLogo from "@/assets/images/logo_ext.png";
import userIcon from "@/assets/images/users/user_icon_profile.png";
import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { startTransition, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { TIPO_UTENTI } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import type { AuthProviderDTO, UtenteAttributes } from "../../../lib/types";
import type { UtenteResponseDTO } from "../../../server/core/dto";
import HubBackground from "./components/HubBackground";
import ProviderCard from "./components/ProviderCard";
import SessionExpiredBanner from "./components/SessionExpiredBanner";

const loginSchema = yup.object({
  email: yup
    .string()
    .required("L'email è obbligatoria")
    .email("Inserisci un indirizzo email valido"),
  password: yup
    .string()
    .required("La password è obbligatoria")
    .min(6, "La password deve contenere almeno 6 caratteri"),
}).required();

type LoginForm = yup.InferType<typeof loginSchema>;

const HubLogin: React.FC = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const navigate = useNavigate()
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setFocus,
    watch,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<LoginForm>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [multipleUsers, setMultipleUsers] = useState<(UtenteResponseDTO & { page_to_land?: string })[]>();
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const [reason, setReason] = useState<string | null>(() => queryParams.get("reason"));

  // Fetch auth providers
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['authProviders'],
    queryFn: () => ServerCall.get<AuthProviderDTO[]>('/auth-providers'),
    staleTime: 1000 * 60 * 60,
  });



  useEffect(() => {
    if (generalError) setGeneralError(null);
  }, [watch("email"), watch("password")]);

  // Se c'è un solo provider 'internal', espandilo automaticamente
  useEffect(() => {
    if (providers.length === 1 && providers[0].tipo === 'internal') {
      setExpandedProvider(providers[0].codice);
    }
  }, [providers]);

  // ─── Login Logic (riusa la logica esistente) ─────────────

  const loginFn = async (data: LoginForm & { selectedUserType?: TIPO_UTENTI }): Promise<UtenteAttributes & { page_to_land?: string }> => {
    const response = await ServerCall.post<any>("/login_user", {
      email: data.email,
      password: data.password,
      selectedUserType: data.selectedUserType,
    });
    if (response && response.code === 500) {
      throw { response: { status: response.code, data: { message: response.message } } };
    }
    return response;
  };

  const checkLoginForMultipleUsersFn = async (data: LoginForm) => {
    return await ServerCall.post<(UtenteResponseDTO & { page_to_land?: string })[]>(
      "/check_login_for_multiple_users",
      { email: data.email, password: data.password }
    );
  };

  const multipleUsersMutation = useMutation({
    mutationFn: checkLoginForMultipleUsersFn,
    mutationKey: ["checkMultipleUsers"],
    onSuccess: (users) => {
      if (users && users.length > 1) {
        startTransition(() => {
          setMultipleUsers(users);
          setShowUserSelection(true);
        });
      } else if (users && users.length === 1) {
        const singleUser = users[0];
        loginMutation.mutate({
          email: watch("email"),
          password: watch("password"),
          selectedUserType: singleUser.tipo,
        });
      }
    },
    onError: (err: any) => handleLoginError(err),
  });

  const loginMutation = useMutation({
    mutationFn: loginFn,
    mutationKey: ["login"],
    onSuccess: async (_user: UtenteAttributes & { page_to_land?: string }) => {
      // Redirect a /hub, oppure deep-link recovery se la sessione era scaduta
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["hubUserInfo"] }),
        queryClient.cancelQueries({ queryKey: ["hubServices"] }),
        queryClient.cancelQueries({ queryKey: ["hubNews"] }),
      ]);
      queryClient.removeQueries({ queryKey: ["hubUserInfo"] });
      queryClient.removeQueries({ queryKey: ["hubServices"] });
      queryClient.removeQueries({ queryKey: ["hubNews"] });

      ServerCall.resetSessionExpiredFlag();
      localStorage.removeItem('session_expired');
      localStorage.removeItem('logout');
      navigate("/hub")
    },
    onError: (err: any) => handleLoginError(err),
  });

  const handleLoginError = (err: any) => {
    const code = err?.code || err?.response?.data?.code;
    if (code === "ISTANTA_LOGIN_REQUIRED") {
      setReason("istanta_required");
      setGeneralError(null);
      return;
    }
    if (err.response?.data) {
      const errorData = err.response.data;
      if (errorData.code && errorData.name && errorData.message) {
        switch (errorData.code) {
          case "UTENTE_NOT_FOUND":
            setGeneralError("Credenziali non valide. Verifica email e password.");
            break;
          default:
            setGeneralError(errorData.message || "Si è verificato un errore");
            break;
        }
        return;
      }
    }
    if (err) {
      const errorData = err;
      if (errorData?.code === "UTENTE_NOT_FOUND") {
        setGeneralError("Credenziali non valide. Verifica email e password.");
      } else if (errorData?.name === "NotFoundError") {
        setGeneralError(errorData.message || "Utente non trovato");
      } else {
        const status = err.status;
        if (status === 401) setGeneralError("Email o password non validi");
        else if (status === 404) setGeneralError("Credenziali non valide. Verifica email e password.");
        else if (status >= 500) setGeneralError("Errore del server, riprova più tardi");
        else setGeneralError(errorData?.message || "Si è verificato un errore");
      }
    } else {
      setGeneralError("Errore inaspettato. Riprova.");
    }
  };

  const onFormError = (formErrors: any) => {
    if (formErrors.email) setFocus("email");
    else if (formErrors.password) setFocus("password");
  };

  const handleUserSelection = (user: UtenteResponseDTO & { page_to_land?: string }) => {
    loginMutation.mutate({
      email: watch("email"),
      password: watch("password"),
      selectedUserType: user.tipo,
    });
    startTransition(() => {
      setShowUserSelection(false);
    });
  };
  const [oidcLoading, setOidcLoading] = useState<string | null>(null);

  // Provider links
  const handleProviderClick = async (provider: AuthProviderDTO) => {
    if (provider.tipo === 'internal') {
      startTransition(() => {
        setExpandedProvider(expandedProvider === provider.codice ? null : provider.codice);
      });
    } else if (provider.tipo === 'custom' && provider.config_client?.redirect_uri) {
      window.location.href = provider.config_client.redirect_uri;
    } else if (provider.tipo === 'oidc') {
      try {
        setOidcLoading(provider.codice);
        setGeneralError(null);
        const response = await ServerCall.get<{ authorize_url: string }>(`/auth/oidc/authorize/${provider.codice}`);
        if (response?.authorize_url) {
          window.location.href = response.authorize_url;
        } else {
          setGeneralError("Impossibile avviare l'autenticazione con questo provider");
          setOidcLoading(null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Errore durante l'avvio dell'autenticazione OIDC";
        setGeneralError(message);
        setOidcLoading(null);
      }
    }
  };

  const isLoading = formSubmitting || multipleUsersMutation.isPending || loginMutation.isPending || oidcLoading !== null;

  const getDefaultLandingByType = (_type?: TIPO_UTENTI) => '/hub';

  const getUserTypeLabel = (type: TIPO_UTENTI) => {
    switch (type) {
      case TIPO_UTENTI.SUPERADMIN: return "Amministratore di Sistema";
      case TIPO_UTENTI.GDO: return "Account GDO";
      case TIPO_UTENTI.PUNTOVENDITA: return "Account Punto Vendita";
      case TIPO_UTENTI.GUEST: return "Account Guest";
      case TIPO_UTENTI.AGENZIA: return "Account Agenzia";
      default: return type;
    }
  };

  return (
    <>
      <HubBackground />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[460px]">
          {/* Card glassmorphism */}
          <div className="backdrop-blur-xl bg-white/75 border border-white/30 rounded-3xl shadow-2xl p-8 sm:p-10">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={IstantaLogo} alt="Istanta 2 GDO Suite" className="h-12 sm:h-14" />
            </div>

            <h1 className="text-center font-urbanist text-xl sm:text-2xl font-semibold text-slate-800 mb-1">
              Accedi alla piattaforma
            </h1>
            <p className="text-center text-sm text-slate-500 mb-6">
              Suite Istanta
            </p>

            {/* Banners */}
            <SessionExpiredBanner
              reason={reason}
              onDismiss={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("reason");
                window.history.replaceState({}, document.title, url.toString());
                startTransition(() => {
                  setReason(null);
                });
              }}
            />

            {generalError && (
              <div className="flex items-center px-4 py-3 mb-5 bg-red-100/80 border border-red-400/50 text-red-700 rounded-xl backdrop-blur-sm">
                <Lucide icon="CircleAlert" className="w-5 h-5 mr-2 shrink-0" />
                <span className="text-sm">
                  <span className="font-medium mr-1">Errore:</span>
                  {generalError}
                </span>
                <button onClick={() => startTransition(() => setGeneralError(null))} className="ml-auto shrink-0" aria-label="Chiudi">
                  <Lucide icon="X" className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Provider list */}
            {reason !== "istanta_required" && (
              <div className="space-y-3">
                {loadingProviders ? (
                  <div className="flex items-center justify-center py-8">
                    <Lucide icon="Loader" className="w-6 h-6 animate-spin text-theme-1" />
                  </div>
                ) : (
                  providers.map((provider, index) => (
                    <div key={provider.id}>
                      <ProviderCard
                        provider={provider}
                        isExpanded={expandedProvider === provider.codice}
                        isLoading={oidcLoading === provider.codice}
                        onClick={() => handleProviderClick(provider)}
                        index={index}
                      />

                      {/* Form email/password inline */}
                      {provider.tipo === 'internal' && expandedProvider === provider.codice && (
                        <div className="mt-3 animate-fade-in-up">
                          <form
                            onSubmit={handleSubmit(
                              async (data) => await multipleUsersMutation.mutateAsync(data),
                              onFormError
                            )}
                            className="space-y-4"
                          >
                            <div>
                              <FormLabel htmlFor="email">Email</FormLabel>
                              <FormInput
                                id="email"
                                {...register("email")}
                                type="email"
                                className={clsx(
                                  "block px-4 py-3 rounded-xl border-slate-300/80 w-full",
                                  errors.email && "border-danger"
                                )}
                                placeholder="inserisci la tua email"
                                autoComplete="email"
                              />
                              {errors.email && (
                                <p className="text-danger mt-1.5 text-xs">{errors.email.message}</p>
                              )}
                            </div>

                            <div>
                              <FormLabel htmlFor="password">Password</FormLabel>
                              <div className="relative">
                                <FormInput
                                  id="password"
                                  {...register("password")}
                                  type={showPassword ? "text" : "password"}
                                  className={clsx(
                                    "block px-4 py-3 rounded-xl border-slate-300/80 w-full pr-12",
                                    errors.password && "border-danger"
                                  )}
                                  placeholder="inserisci la tua password"
                                  autoComplete="current-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => startTransition(() => setShowPassword((prev) => !prev))}
                                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                                >
                                  <Lucide icon={showPassword ? "EyeOff" : "Eye"} className="w-5 h-5" />
                                </button>
                              </div>
                              {errors.password && (
                                <p className="text-danger mt-1.5 text-xs">{errors.password.message}</p>
                              )}
                            </div>

                            <div className="flex items-center text-xs text-slate-500">
                              <a href="/recupero-password" className="text-theme-1 hover:underline ml-auto">
                                Password Dimenticata?
                              </a>
                            </div>

                            <Button
                              variant="primary"
                              rounded
                              type="submit"
                              disabled={isLoading}
                              className={clsx(
                                "bg-gradient-to-r from-theme-1/90 to-theme-2/90 w-full py-3",
                                isLoading && "opacity-70 cursor-not-allowed"
                              )}
                            >
                              {isLoading ? (
                                <div className="flex items-center justify-center">
                                  <Lucide icon="Loader" className="w-5 h-5 mr-2 animate-spin" />
                                  Accesso in corso...
                                </div>
                              ) : (
                                "Entra"
                              )}
                            </Button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-8 text-xs text-slate-400">
              Powered by Singular Lab
            </div>
          </div>
        </div>
      </div>

      {/* Multi-account selection modal */}
      <Dialog
        open={showUserSelection}
        onClose={() => startTransition(() => setShowUserSelection(false))}
        size="md"
        centered
      >
        <Dialog.Panel>
          <Dialog.Title className="font-medium">
            <h2 className="text-xl">Seleziona Account</h2>
          </Dialog.Title>
          <Dialog.Description>
            <p className="mb-4 text-sm text-slate-600">
              Hai accesso a più tipi di account. Seleziona quello con cui desideri accedere:
            </p>
            <div className="space-y-2">
              {multipleUsers?.map((user) => (
                <div
                  key={`${user.id}-${user.tipo}`}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => handleUserSelection(user)}
                >
                  <div className="flex items-center gap-3">
                    <div className="overflow-hidden rounded-full w-11 h-11 border-[3px] border-slate-200/70 shrink-0">
                      <img
                        alt="Avatar utente"
                        src={user?.meta?.photo ? `data:image/png;base64,${user.meta.photo}` : userIcon}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="font-medium">{user.nome_completo}</div>
                      <div className="text-sm text-slate-500">{getUserTypeLabel(user.tipo)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => startTransition(() => setShowUserSelection(false))}
              className="w-24"
            >
              Annulla
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </>
  );
};

export default HubLogin;
