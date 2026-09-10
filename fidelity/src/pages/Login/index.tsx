import IstantaLogo from "@/assets/images/logo_ext.png";
import userIcon from "@/assets/images/users/user_icon_profile.png";
import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { TIPO_UTENTI } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { UtenteAttributes } from "../../../lib/types";
import { UtenteResponseDTO } from "../../../server/core/dto";

// Schema di validazione con Yup
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

const getDefaultLandingByType = (_userType?: TIPO_UTENTI): string => '/hub';

const Login: React.FC = () => {
  const navigate = useNavigate();
  // dobbiamo intercettare il parametro query "reason=session_expired" per mostrare un messaggio all'utente
  const queryParams = new URLSearchParams(window.location.search);

  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<LoginForm>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [multipleUsers, setMultipleUsers] = useState<(UtenteResponseDTO & { page_to_land?: string })[]>();
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Stato per mostrare/nascondere password
  const [reason, setReason] = useState<string | null>(() => {
    return queryParams.get("reason");
  });
  const [reasonMessage, setReasonMessage] = useState<string | null>(() => {
    return queryParams.get("message");
  });
  // Controlla redirect salvato da scadenza sessione

  // Reset errore generale quando cambiano email o password
  useEffect(() => {
    if (generalError) setGeneralError(null);
  }, [watch("email"), watch("password")]);

  // Chiamata login
  const loginFn = async (data: LoginForm & { selectedUserType?: TIPO_UTENTI }): Promise<UtenteAttributes & { page_to_land?: string }> => {
    try {
      const response = await ServerCall.post<any>("/login_user", {
        email: data.email,
        password: data.password,
        selectedUserType: data.selectedUserType
      });

      // Verifica se la risposta contiene un messaggio di errore
      if (response && response.code === 500) {
        throw {
          response: {
            status: response.code,
            data: { message: response.message }
          }
        };
      }

      return response;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const checkLoginForMultipleUsersFn = async (data: LoginForm) => {
    const response = await ServerCall.post<(UtenteResponseDTO & { page_to_land?: string })[]>("/check_login_for_multiple_users", {
      email: data.email,
      password: data.password
    });

    return response;
  };

  const multipleUsersMutation = useMutation({
    mutationFn: checkLoginForMultipleUsersFn,
    mutationKey: ["checkMultipleUsers"],
    onSuccess: (users) => {
      if (users && users.length > 1) {
        setMultipleUsers(users);
        setShowUserSelection(true);
      } else if (users && users.length === 1) {
        // Se c'è un solo utente, memorizza il suo page_to_land e effettua direttamente il login
        const singleUser = users[0];
        loginMutation.mutate({
          email: watch("email"),
          password: watch("password"),
          selectedUserType: singleUser.tipo
        });
      }
    },
    onError: (err: any) => {
      handleLoginError(err);
    }
  });

  const loginMutation = useMutation({
    mutationFn: loginFn,
    mutationKey: ["login"],
    onSuccess: (user: UtenteAttributes & { page_to_land?: string }) => {
      const userType = (user as any)?.tipo as TIPO_UTENTI | undefined;
      // Redirect a /hub, oppure deep-link recovery se la sessione era scaduta
      const destination = '/hub';

      // Reset flag sessione scaduta per permettere nuovi 401
      ServerCall.resetSessionExpiredFlag();

      // Pulisci localStorage da eventi scadenza precedenti
      localStorage.removeItem('session_expired');
      localStorage.removeItem('logout');

      // Redirect alla pagina richiesta (non usiamo navigate per ricaricare)
      navigate(destination);
    },
    onError: (err: any) => {
      handleLoginError(err);
    },
  });

  const handleLoginError = (err: any) => {
    // Caso specifico: utente GDO che deve accedere tramite Istanta
    const code = err?.code || err?.response?.data?.code;
    if (code === "ISTANTA_LOGIN_REQUIRED") {
      setReason("istanta_required");
      setGeneralError(null);
      return;
    }

    // Gestione errori strutturati dal backend
    if (err.response?.data) {
      const errorData = err.response.data;

      // Se l'errore ha la struttura del backend (code, name, message)
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

    // Gestione errori standard basata su status HTTP
    if (err) {
      // Controllo se l'errore ha una struttura specifica dal backend
      const errorData = err;

      if (errorData?.code === "UTENTE_NOT_FOUND") {
        setGeneralError("Credenziali non valide. Verifica email e password.");
      } else if (errorData?.name === "NotFoundError") {
        setGeneralError(errorData.message || "Utente non trovato");
      } else {
        // Fallback ai controlli basati su status HTTP se non è un formato di errore specifico
        const status = err.status;
        if (status === 401) {
          setGeneralError("Email o password non validi");
        } else if (status === 404) {
          setGeneralError("Credenziali non valide. Verifica email e password.");
        } else if (status >= 500) {
          setGeneralError("Errore del server, riprova più tardi");
        } else {
          setGeneralError(errorData?.message || "Si è verificato un errore");
        }
      }
    } else if (err.request) {
      setGeneralError("Impossibile connettersi al server. Controlla la tua connessione");
    } else {
      setGeneralError("Errore inaspettato. Riprova.");
    }
  };

  const dismissReason = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("reason");
    url.searchParams.delete("message");
    window.history.replaceState({}, document.title, url.toString());
    setReason(null);
    setReasonMessage(null);
  };

  // Focus sul primo errore
  const onFormError = (formErrors: any) => {
    if (formErrors.email) setFocus("email");
    else if (formErrors.password) setFocus("password");
  };

  const handleUserSelection = (user: UtenteResponseDTO & { page_to_land?: string }) => {
    // Modifichiamo il tipo_utenti nella richiesta di login per specificare quale tipo di account usare
    loginMutation.mutate({
      email: watch("email"),
      password: watch("password"),
      selectedUserType: user.tipo
    });
    setShowUserSelection(false);
  };

  // Funzione per toggleare la visibilità della password
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Componente modale per la selezione degli utenti
  const UserSelectionModal = () => {
    const getUserTypeLabel = (type: TIPO_UTENTI) => {
      switch (type) {
        case TIPO_UTENTI.SUPERADMIN:
          return "Amministratore di Sistema";
        case TIPO_UTENTI.GDO:
          return "Account GDO";
        case TIPO_UTENTI.PUNTOVENDITA:
          return "Account Punto Vendita";
        case TIPO_UTENTI.GUEST:
          return "Account Gues";
        case TIPO_UTENTI.AGENZIA:
          return "Account Agenzia";
        default:
          return type;
      }
    };

    return (
      <Dialog
        open={showUserSelection}
        onClose={() => setShowUserSelection(false)}
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
              {multipleUsers?.map((user: UtenteResponseDTO & { page_to_land?: string }, index) => (
                <div
                  key={`${user.id}-${user.tipo}`}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                  onClick={() => handleUserSelection(user)}
                >
                  <div className="flex items-center">
                    <div className="overflow-hidden rounded-full w-11 h-11 image-fit border-[3px] border-slate-200/70">
                      <img
                        alt="Tailwise - Admin Dashboard Template"
                        src={user?.meta?.photo ? `data:image/png;base64,${user.meta.photo}` : userIcon}
                      />
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.nome_completo}
                      </div>
                      <div className="text-sm text-slate-500">
                        {getUserTypeLabel(user.tipo)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setShowUserSelection(false)}
              className="w-24 mr-1"
            >
              Annulla
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    );
  };

  return (
    <>
      <div className="container !overflow-clip grid lg:h-screen grid-cols-12 lg:max-w-[1550px] 2xl:max-w-[1750px] py-10 px-5 sm:py-14 sm:px-10 md:px-36 lg:py-0 lg:pl-14 lg:pr-12 xl:px-24">
        <div
          className={clsx(
            "relative z-50 h-full col-span-12 p-7 sm:p-14 bg-white rounded-2xl lg:bg-transparent lg:pr-10 lg:col-span-5 xl:pr-24 2xl:col-span-4 lg:p-0",
            "before:content-[''] before:absolute before:inset-0 before:-mb-3.5 before:bg-white/40 before:rounded-2xl before:mx-5"
          )}
        >
          <div className="relative z-10 flex flex-col justify-center w-full h-full">
            <img src={IstantaLogo} alt="Logo Istanta 2 GDO Suite" />
            <div className="mt-10">
              <div className=" font-medium">
                <h1>
                  Area Riservata
                </h1>
              </div>

              {generalError && (
                <div className="flex items-center px-4 py-3 my-7 bg-red-100 border border-red-400 text-red-700 rounded">
                  <Lucide icon="CircleAlert" className="w-6 h-6 mr-2" />
                  <span className="font-medium mr-2">Errore:</span> {generalError}
                  <button
                    onClick={() => setGeneralError(null)}
                    className="ml-auto"
                    aria-label="Chiudi"
                  >
                    <Lucide icon="X" className="w-5 h-5" />
                  </button>
                </div>
              )}
              {reason === "logout_success" && (
                <div className="flex items-center px-4 py-3 my-7 bg-green-100 border border-green-400 text-green-700 rounded">
                  <Lucide icon="CircleCheck" className="w-6 h-6 mr-2 shrink-0" />
                  <span>{reasonMessage || "Logout effettuato con successo."}</span>
                  <button
                    onClick={dismissReason}
                    className="ml-auto"
                    aria-label="Chiudi"
                  >
                    <Lucide icon="X" className="w-5 h-5" />
                  </button>
                </div>
              )}
              {reason === "session_expired" && (
                <div className="flex items-center px-4 py-3 my-7 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
                  <Lucide icon="CircleAlert" className="w-6 h-6 mr-2" />
                  <span className="font-medium mr-2">Attenzione:</span> La tua sessione è scaduta. Effettua nuovamente il login per continuare.
                  <button
                    onClick={dismissReason}
                    className="ml-auto"
                    aria-label="Chiudi"
                  >
                    <Lucide icon="X" className="w-5 h-5" />
                  </button>
                </div>
              )}
              {reason === "istanta_required" && (
                <div className="flex flex-col items-center px-4 py-4 my-7 bg-primary/10 border border-primary text-primary rounded-lg shadow-sm animate-fade-in">
                  <div className="flex items-center mb-2">
                    <Lucide icon="CircleAlert" className="w-5 h-5 mr-2 text-primary" />
                    <span className="font-semibold text-sm">Accesso tramite Istanta richiesto</span>
                  </div>
                  <div className="text-center mb-2 text-xs sm:text-sm">
                    <span>
                      La tua sessione è scaduta.<br />
                      Per accedere, effettua il login dalla piattaforma <strong>Istanta</strong>.
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    rounded
                    size="sm"
                    className="mt-1 px-4 py-2 text-xs font-medium shadow hover:bg-primary/80 transition"
                    onClick={() => {
                      const istantaUrl = import.meta.env.VITE_ISTANTA_IP_ADDRESS;
                      if (istantaUrl) {
                        window.open(istantaUrl, "_blank");
                      }
                    }}
                  >
                    Vai su Istanta
                  </Button>
                </div>
              )}
              <form
                onSubmit={handleSubmit(
                  async (data) => await multipleUsersMutation.mutateAsync(data),
                  onFormError
                )}
                className={clsx("mt-6", reason === "istanta_required" && "hidden")}
              >
                <div className="mb-4">
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <FormInput
                    id="email"
                    {...register("email")}
                    type="email"
                    className={clsx(
                      "block px-4 py-3.5 rounded-[0.6rem] border-slate-300/80 w-full",
                      errors.email && "border-danger"
                    )}
                    placeholder="inserisci la tua email"
                    aria-invalid={errors.email ? "true" : undefined}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p id="email-error" className="text-danger mt-2 text-sm" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <FormLabel htmlFor="password">Password</FormLabel>
                  <div className="relative">
                    <FormInput
                      id="password"
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      className={clsx(
                        "block px-4 py-3.5 rounded-[0.6rem] border-slate-300/80 w-full pr-12",
                        errors.password && "border-danger"
                      )}
                      placeholder="inserisci la tua password"
                      aria-invalid={errors.password ? "true" : undefined}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600"
                      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      <Lucide
                        icon={showPassword ? "EyeOff" : "Eye"}
                        className="w-5 h-5"
                      />
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-danger mt-2 text-sm" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex mt-4 items-center text-xs text-slate-500 sm:text-sm">
                  <a href="/recupero-password" className="text-primary hover:underline ml-auto">
                    Password Dimenticata?
                  </a>
                </div>

                <div className="mt-5 text-center xl:mt-8 xl:text-left">
                  <Button
                    variant="primary"
                    rounded
                    type="submit"
                    disabled={formSubmitting || multipleUsersMutation.isPending || loginMutation.isPending}
                    className={clsx(
                      "bg-gradient-to-r from-theme-1/70 to-theme-2/70 w-full py-3.5 xl:mr-3",
                      (formSubmitting || multipleUsersMutation.isPending || loginMutation.isPending) && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {formSubmitting || multipleUsersMutation.isPending || loginMutation.isPending ? (
                      <div className="flex items-center justify-center">
                        <Lucide icon="Loader" className="w-5 h-5 mr-2 animate-spin" /> Accesso in corso...
                      </div>
                    ) : (
                      "Entra"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Grafica di sfondo invariata */}
      <div className="fixed container grid w-screen inset-0 h-screen grid-cols-12 lg:max-w-[1550px] 2xl:max-w-[1750px] pl-14 pr-12 xl:px-24">
        <div
          className={clsx([
            "relative h-screen col-span-12 lg:col-span-5 2xl:col-span-4 z-20",
            "after:bg-white after:hidden after:lg:block after:content-[''] after:absolute after:right-0 after:inset-y-0 after:bg-gradient-to-b after:from-white after:to-slate-100/80 after:w-[800%] after:rounded-[0_1.2rem_1.2rem_0/0_1.7rem_1.7rem_0]",
            "before:content-[''] before:hidden before:lg:block before:absolute before:right-0 before:inset-y-0 before:my-6 before:bg-gradient-to-b before:from-white/10 before:to-slate-50/10 before:bg-white/50 before:w-[800%] before:-mr-4 before:rounded-[0_1.2rem_1.2rem_0/0_1.7rem_1.7rem]",
          ])}
        ></div>
        <div className={clsx([
          "h-full col-span-7 2xl:col-span-8 lg:relative",
          "before:content-[''] before:absolute before:lg:-ml-10 before:left-0 before:inset-y-0 before:bg-gradient-to-b before:from-theme-1 before:to-theme-2 before:w-screen before:lg:w-[800%]",
          "after:content-[''] after:absolute after:inset-y-0 after:left-0 after:w-screen after:lg:w-[800%] after:bg-texture-white after:bg-fixed after:bg-center after:lg:bg-[25rem_-25rem] after:bg-no-repeat",
        ])}></div>
      </div>

      {/* Modale per la selezione degli utenti */}
      <UserSelectionModal />
    </>
  );
};

export default Login;
