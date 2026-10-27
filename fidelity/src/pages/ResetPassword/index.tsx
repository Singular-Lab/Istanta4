import IstantaLogo from "@/assets/images/logo_ext.png";
import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormField } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import * as yup from "yup";
import { ServerCall } from "../../../lib/server_call";
import CampoPassword from "../HubLogin/components/CampoPassword";
import HubBackground from "../HubLogin/components/HubBackground";

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
      <CardAccesso>
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner size="lg" etichetta="Verifica in corso..." />
          <p aria-hidden="true" className="text-slate-600">Verifica in corso...</p>
        </div>
      </CardAccesso>
    );
  }

  // Token non valido o mancante
  if (!ctx || tokenError || !tokenData?.valid) {
    return (
      <CardAccesso>
        <h1 className="title-page text-center text-slate-800 mb-6">Link non valido</h1>
        <PageError
          compatta
          titolo="Impossibile reimpostare la password"
          motivo={
            !ctx
              ? "Il link di reset password non è valido."
              : "Il link di reset password è scaduto o non è più valido."
          }
        />
        <div className="mt-6 flex flex-col items-center gap-4">
          <Button
            as={Link}
            to="/recupero-password"
            variant="primary"
            rounded
            className="bg-gradient-to-r from-theme-1/90 to-theme-2/90 px-5"
          >
            Richiedi nuovo link
          </Button>
          <Link to="/login" className="text-sm text-theme-1 hover:underline">
            Torna al Login
          </Link>
        </div>
      </CardAccesso>
    );
  }

  // Reset completato con successo
  if (resetSuccess) {
    return (
      <CardAccesso>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <Lucide icon="CircleCheck" aria-hidden="true" className="w-8 h-8 text-success" />
          </div>
          <h1 className="title-page text-slate-800 mb-2">Password aggiornata!</h1>
          <p className="text-slate-500 mb-6">
            La tua password è stata modificata con successo. Ora puoi accedere con le nuove credenziali.
          </p>
          <Button
            as={Link}
            to="/login"
            variant="primary"
            rounded
            className="bg-gradient-to-r from-theme-1/90 to-theme-2/90 px-5"
          >
            Vai al Login
          </Button>
        </div>
      </CardAccesso>
    );
  }

  // Form di reset password
  return (
    <CardAccesso>
      <h1 className="title-page text-center text-slate-800 mb-6">Reimposta Password</h1>

      {/* Saluto utente */}
      <div className="p-4 bg-slate-50/80 rounded-control border border-slate-200">
        <p className="text-slate-600">
          Ciao <span className="font-semibold text-slate-800">{tokenData.user.nome_completo}</span>,
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Inserisci la tua nuova password per completare il reset.
        </p>
      </div>

      {/* Errore generale */}
      {resetMutation.error && (
        <Alert variant="soft-danger" className="flex items-center gap-2 px-4 py-3 mt-4">
          <Lucide icon="CircleAlert" aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm">{(resetMutation.error as any)?.message || "Errore durante il reset della password"}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <FormField etichetta="Nuova Password" errore={errors.password?.message}>
          <CampoPassword
            id="password"
            {...register("password")}
            className={clsx(
              "block px-4 py-3 rounded-control border-slate-300/80 w-full",
              errors.password && "border-danger"
            )}
            placeholder="Inserisci la nuova password"
            autoComplete="new-password"
          />
        </FormField>

        <FormField etichetta="Conferma Password" errore={errors.confirmPassword?.message}>
          <CampoPassword
            id="confirmPassword"
            {...register("confirmPassword")}
            className={clsx(
              "block px-4 py-3 rounded-control border-slate-300/80 w-full",
              errors.confirmPassword && "border-danger"
            )}
            placeholder="Conferma la nuova password"
            autoComplete="new-password"
          />
        </FormField>

        <Button
          variant="primary"
          rounded
          type="submit"
          loading={isSubmitting || resetMutation.isPending}
          className="bg-gradient-to-r from-theme-1/90 to-theme-2/90 w-full py-3"
        >
          Reimposta Password
        </Button>

        <div className="text-center text-sm">
          <Link to="/login" className="text-theme-1 hover:underline">
            Torna al Login
          </Link>
        </div>
      </form>
    </CardAccesso>
  );
};

// Stesso layout di HubLogin e RecuperoPassword: sfondo animato e card in vetro con il logo
const CardAccesso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <HubBackground />
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-[460px]">
        {/* Card glassmorphism: sullo sfondo a gradiente l'ombra standard della card non la stacca */}
        <div className="backdrop-blur-xl bg-white/75 border border-white/30 rounded-card shadow-2xl p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <img src={IstantaLogo} alt="Istanta 2 GDO Suite" className="h-12 sm:h-14" />
          </div>
          {children}
          <div className="text-center mt-8 text-xs text-slate-400">
            Powered by Singular Lab
          </div>
        </div>
      </div>
    </div>
  </>
);

export default ResetPassword;
