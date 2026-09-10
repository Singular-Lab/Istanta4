import IstantaLogo from "@/assets/images/logo_ext.png";
import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import * as yup from "yup";
import { ServerCall } from "../../../lib/server_call";

// Schema di validazione
const resetSchema = yup.object({
  password: yup
    .string()
    .required("La password è obbligatoria")
    .min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: yup
    .string()
    .required("Conferma la password")
    .oneOf([yup.ref("password")], "Le password non corrispondono"),
}).required();

type ResetForm = yup.InferType<typeof resetSchema>;

interface UserInfo {
  nome: string;
  cognome: string;
  nome_completo: string;
  email: string;
}

interface ValidateResponse {
  valid: boolean;
  user: UserInfo;
}

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ctx = searchParams.get("ctx");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Valida il token e recupera i dati utente
  const { data: tokenData, isLoading, error: tokenError } = useQuery({
    queryKey: ["validateResetToken", ctx],
    queryFn: async () => {
      if (!ctx) throw new Error("Token mancante");
      const response = await ServerCall.get<ValidateResponse>(`/email/validate-reset-token?ctx=${ctx}`);
      return response;
    },
    enabled: !!ctx,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: yupResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Mutation per il reset password
  const resetMutation = useMutation({
    mutationFn: async (data: ResetForm) => {
      const response = await ServerCall.post<{ message: string }>("/email/reset-password", {
        ctx,
        password: data.password,
      });
      return response;
    },
    onSuccess: () => {
      setResetSuccess(true);
    },
  });

  const onSubmit = async (data: ResetForm) => {
    await resetMutation.mutateAsync(data);
  };

  // Stato di caricamento
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3">
          <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary" />
          <span className="text-lg text-slate-600">Verifica in corso...</span>
        </div>
      </div>
    );
  }

  // Token non valido o mancante
  if (!ctx || tokenError || !tokenData?.valid) {
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
              <img src={IstantaLogo} alt="Istanta Logo" />
              <div className="mt-10">
                <div className="flex items-center justify-center flex-col text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <Lucide icon="CircleX" className="w-8 h-8 text-red-600" />
                  </div>
                  <h1 className="text-xl font-medium text-slate-800 mb-2">Link non valido</h1>
                  <p className="text-slate-500 mb-6">
                    {!ctx
                      ? "Il link di reset password non è valido."
                      : "Il link di reset password è scaduto o non è più valido."}
                  </p>
                  <Link to="/recupero-password">
                    <Button variant="primary" rounded className="bg-gradient-to-r from-theme-1/70 to-theme-2/70">
                      Richiedi nuovo link
                    </Button>
                  </Link>
                  <Link to="/login" className="text-primary hover:underline mt-4 text-sm">
                    Torna al Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BackgroundDecoration />
      </>
    );
  }

  // Reset completato con successo
  if (resetSuccess) {
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
              <img src={IstantaLogo} alt="Istanta Logo" />
              <div className="mt-10">
                <div className="flex items-center justify-center flex-col text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Lucide icon="CircleCheck" className="w-8 h-8 text-green-600" />
                  </div>
                  <h1 className="text-xl font-medium text-slate-800 mb-2">Password aggiornata!</h1>
                  <p className="text-slate-500 mb-6">
                    La tua password è stata modificata con successo. Ora puoi accedere con le nuove credenziali.
                  </p>
                  <Link to="/login">
                    <Button variant="primary" rounded className="bg-gradient-to-r from-theme-1/70 to-theme-2/70">
                      Vai al Login
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BackgroundDecoration />
      </>
    );
  }

  // Form di reset password
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
            <img src={IstantaLogo} alt="Istanta Logo" />
            <div className="mt-10">
              <div className="font-medium">
                <h1>Reimposta Password</h1>
              </div>

              {/* Saluto utente */}
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600">
                  Ciao <span className="font-semibold text-slate-800">{tokenData.user.nome_completo}</span>,
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Inserisci la tua nuova password per completare il reset.
                </p>
              </div>

              {/* Errore generale */}
              {resetMutation.error && (
                <div className="flex items-center px-4 py-3 my-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  <Lucide icon="CircleAlert" className="w-6 h-6 mr-2" />
                  <span>{(resetMutation.error as any)?.message || "Errore durante il reset della password"}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
                {/* Nuova password */}
                <div className="mb-4">
                  <FormLabel htmlFor="password">Nuova Password</FormLabel>
                  <div className="relative">
                    <FormInput
                      id="password"
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      className={clsx(
                        "block px-4 py-3.5 rounded-[0.6rem] border-slate-300/80 w-full pr-12",
                        errors.password && "border-danger"
                      )}
                      placeholder="Inserisci la nuova password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      <Lucide icon={showPassword ? "EyeOff" : "Eye"} className="w-5 h-5" />
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-danger mt-2 text-sm">{errors.password.message}</p>
                  )}
                </div>

                {/* Conferma password */}
                <div className="mb-4">
                  <FormLabel htmlFor="confirmPassword">Conferma Password</FormLabel>
                  <div className="relative">
                    <FormInput
                      id="confirmPassword"
                      {...register("confirmPassword")}
                      type={showConfirmPassword ? "text" : "password"}
                      className={clsx(
                        "block px-4 py-3.5 rounded-[0.6rem] border-slate-300/80 w-full pr-12",
                        errors.confirmPassword && "border-danger"
                      )}
                      placeholder="Conferma la nuova password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      <Lucide icon={showConfirmPassword ? "EyeOff" : "Eye"} className="w-5 h-5" />
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-danger mt-2 text-sm">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="mt-5 text-center xl:mt-8 xl:text-left">
                  <Button
                    variant="primary"
                    rounded
                    type="submit"
                    disabled={isSubmitting || resetMutation.isPending}
                    className={clsx(
                      "bg-gradient-to-r from-theme-1/70 to-theme-2/70 w-full py-3.5",
                      (isSubmitting || resetMutation.isPending) && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting || resetMutation.isPending ? (
                      <div className="flex items-center justify-center">
                        <Lucide icon="Loader" className="w-5 h-5 mr-2 animate-spin" /> Aggiornamento...
                      </div>
                    ) : (
                      "Reimposta Password"
                    )}
                  </Button>
                </div>

                <div className="mt-4 text-center text-sm text-slate-500">
                  <Link to="/login" className="text-primary hover:underline">
                    Torna al Login
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <BackgroundDecoration />
    </>
  );
};

// Componente sfondo condiviso
const BackgroundDecoration: React.FC = () => (
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
);

export default ResetPassword;
