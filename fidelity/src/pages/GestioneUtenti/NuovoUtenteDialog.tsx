import { FormField, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useFetchAllGDO, useFetchAllRuoliGDO, useFetchPuntiVenditaDellaGdo } from "@/query/query";
import { generaPassword } from "@/utils/generaPassword";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import {
  DESCRIZIONE_REGOLA_PASSWORD,
  ETICHETTE_TIPO_UTENTE,
  REGOLA_PASSWORD,
  scegliePiuGdo,
  tipiUtenteCreabili,
} from "../../../lib/accessi/tipiUtenteCreabili";
import { STATO_UTENTI, TIPO_UTENTI, UTENTE_GENERE } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { GDOResponseDTO, PuntoVenditaResponseDTO, RuoloUtenteGDOResponseDTO } from "../../../server/core/dto";
import { useNotification } from "../../context/NotificationContext";
import { useUser } from "../../context/UserContext";
import {
  normalizzaEmail,
  regolaDataDiNascita,
  regolaEmail,
  regolaNome,
  regolaResidenza,
  regolaTelefono,
} from "./campiUtente";

interface ValoriNuovoUtente {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  tipoUtente: string;
  statoUtente: string;
  gdoScelta: string;
  ruolo_gdo: string;
  idPuntoVendita: string;
  telefono: string;
  sesso: string;
  dataDiNascita: string;
  residenza: string;
}

const VALORI_VUOTI: ValoriNuovoUtente = {
  nome: "",
  cognome: "",
  email: "",
  password: "",
  tipoUtente: "",
  statoUtente: STATO_UTENTI.ATTIVO,
  gdoScelta: "",
  ruolo_gdo: "",
  idPuntoVendita: "",
  telefono: "",
  sesso: "",
  dataDiNascita: "",
  residenza: "",
};

/** La GDO si sceglie solo se chi crea opera per più GDO; per gli altri la decide il server. */
const creaSchema = (scegliGdo: boolean) =>
  yup.object({
    nome: regolaNome("nome"),
    cognome: regolaNome("cognome"),
    email: regolaEmail(),
    password: yup.string().required("La password è obbligatoria").matches(REGOLA_PASSWORD, DESCRIZIONE_REGOLA_PASSWORD),
    tipoUtente: yup.string().required("Scegli il tipo di utente"),
    statoUtente: yup.string().required("Lo stato dell'utente è obbligatorio"),
    gdoScelta: yup.string().defined().when("tipoUtente", {
      is: (tipo: string) => scegliGdo && !!tipo && tipo !== TIPO_UTENTI.SUPERADMIN,
      then: (schema) => schema.required("Scegli la GDO del nuovo utente"),
    }),
    ruolo_gdo: yup.string().defined(),
    idPuntoVendita: yup.string().defined().when("tipoUtente", {
      is: TIPO_UTENTI.PUNTOVENDITA,
      then: (schema) => schema.required("Il punto vendita è obbligatorio per gli utenti Punto Vendita"),
    }),
    telefono: regolaTelefono(),
    sesso: yup.string().defined(),
    dataDiNascita: regolaDataDiNascita(),
    residenza: regolaResidenza(),
  });

/** Le parti dell'errore di ServerCall che servono qui. */
type ErroreCreazione = { error?: unknown; httpStatus?: unknown; status?: unknown; message?: unknown } | null | undefined;

/** Errore del limite di creazioni: il server risponde 429, i test e le versioni vecchie con il codice. */
const eLimiteCreazioni = (errore: ErroreCreazione) =>
  errore?.error === "REGISTRATION_RATE_LIMIT_EXCEEDED" || errore?.httpStatus === 429 || errore?.status === 429;

const eEmailGiaInUso = (errore: ErroreCreazione) => /email.*già in uso/i.test(String(errore?.message ?? ""));

interface NuovoUtenteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Dopo ogni utente creato, per ricaricare l'elenco. */
  onCreato: () => void;
  /** Il server ha fermato la creazione per il limite di utenti creati nell'ultima ora. */
  onLimiteSuperato: () => void;
}

/**
 * Inserimento manuale di un utente: prima chi è e come accede, poi tipo, GDO, ruolo e punto vendita;
 * i dati anagrafici sono facoltativi. "Crea e aggiungi un altro" tiene tipo, GDO, ruolo e stato.
 */
const NuovoUtenteDialog = ({ open, onClose, onCreato, onLimiteSuperato }: NuovoUtenteDialogProps) => {
  const { user } = useUser();
  const { showNotification } = useNotification();
  const scegliGdo = scegliePiuGdo(user?.tipo);
  const tipiCreabili = tipiUtenteCreabili(user?.tipo);
  const { data: tutteLeGdo } = useFetchAllGDO();
  const { data: ruoliGdo } = useFetchAllRuoliGDO();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues,
    setError,
    setFocus,
    watch,
  } = useForm<ValoriNuovoUtente>({ resolver: yupResolver(creaSchema(scegliGdo)), defaultValues: VALORI_VUOTI });

  const tipoUtente = watch("tipoUtente");
  const gdoScelta = watch("gdoScelta");
  const email = watch("email");
  const password = watch("password");
  const conGdo = !!tipoUtente && tipoUtente !== TIPO_UTENTI.SUPERADMIN;
  const conPuntoVendita = tipoUtente === TIPO_UTENTI.PUNTOVENDITA;
  const puntiVendita = useFetchPuntiVenditaDellaGdo(
    scegliGdo ? gdoScelta : "",
    open && conPuntoVendita && (!scegliGdo || !!gdoScelta)
  );

  const [mostraPassword, setMostraPassword] = useState(false);
  const [passwordCopiata, setPasswordCopiata] = useState(false);
  const [altriDatiAperti, setAltriDatiAperti] = useState(false);
  /** Email (normalizzata) che il server ha già dato per registrata. */
  const [emailRegistrata, setEmailRegistrata] = useState<string | null>(null);
  const aggiungiUnAltro = useRef(false);
  const idPassword = useId();

  const gdoUnica = tutteLeGdo?.length === 1 ? tutteLeGdo[0] : undefined;
  // Con una sola GDO non c'è niente da scegliere
  const idGdoPredefinita = scegliGdo && gdoUnica ? gdoUnica.id : "";

  // Ogni apertura parte da un modulo vuoto
  useEffect(() => {
    if (open) {
      reset(VALORI_VUOTI);
      setMostraPassword(false);
      setAltriDatiAperti(false);
      setEmailRegistrata(null);
    }
  }, [open, reset]);

  // Anche quando l'elenco delle GDO arriva dopo l'apertura, senza toccare ciò che è già scritto
  useEffect(() => {
    if (open && idGdoPredefinita && !getValues("gdoScelta")) {
      setValue("gdoScelta", idGdoPredefinita);
    }
  }, [open, idGdoPredefinita, getValues, setValue]);

  // Il punto vendita scelto appartiene alla GDO di prima
  useEffect(() => {
    setValue("idPuntoVendita", "");
  }, [gdoScelta, setValue]);

  useEffect(() => {
    if (!passwordCopiata) return;
    const attesa = setTimeout(() => setPasswordCopiata(false), 1500);
    return () => clearTimeout(attesa);
  }, [passwordCopiata]);

  const emailGiaRegistrata = !!email && emailRegistrata === normalizzaEmail(email);

  const verificaEmail = async () => {
    const valore = normalizzaEmail(getValues("email"));
    if (!valore || !(await regolaEmail().isValid(valore))) return;
    try {
      const risposta = await ServerCall.get<{ registrata: boolean }>(
        `/utenti/email-registrata?email=${encodeURIComponent(valore)}`
      );
      if (risposta?.registrata) setEmailRegistrata(valore);
      else if (emailRegistrata === valore) setEmailRegistrata(null);
    } catch {
      // La verifica è un aiuto: se non risponde, decide il server alla creazione
    }
  };

  const generaNuovaPassword = () => {
    setValue("password", generaPassword(), { shouldValidate: true, shouldDirty: true });
    setMostraPassword(true);
    setPasswordCopiata(false);
  };

  const copiaPassword = () => {
    const appunti = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!appunti) {
      showNotification("Copia non disponibile: seleziona la password e copiala a mano", { variant: "warning" });
      return;
    }
    appunti.writeText(getValues("password")).then(
      () => setPasswordCopiata(true),
      () => showNotification("Copia non riuscita: seleziona la password e copiala a mano", { variant: "warning" })
    );
  };

  const creaUtente = useMutation({
    mutationKey: ["registerUtente"],
    mutationFn: async (valori: ValoriNuovoUtente) => {
      const payload: Record<string, string | undefined> = {
        email: normalizzaEmail(valori.email),
        nome: valori.nome.trim(),
        cognome: valori.cognome.trim(),
        password: valori.password,
        tipo: valori.tipoUtente,
        stato: valori.statoUtente,
        residenza: valori.residenza.trim() || undefined,
        dataDiNascita: valori.dataDiNascita || undefined,
        telefono: valori.telefono.trim() || undefined,
        sesso: valori.sesso || undefined,
      };
      if (valori.tipoUtente !== TIPO_UTENTI.SUPERADMIN) {
        if (scegliGdo && valori.gdoScelta) payload.gdoScelta = valori.gdoScelta;
        if (valori.ruolo_gdo) payload.ruoloGDO = valori.ruolo_gdo;
      }
      if (valori.tipoUtente === TIPO_UTENTI.PUNTOVENDITA) payload.idPuntoVendita = valori.idPuntoVendita;
      await ServerCall.post("/register-user", payload);
    },
    onSuccess: (_risposta, valori) => {
      onCreato();
      const nome = `${valori.nome.trim()} ${valori.cognome.trim()}`;
      if (aggiungiUnAltro.current) {
        showNotification(`Utente ${nome} creato: inserisci il prossimo`, { variant: "success" });
        reset({
          ...VALORI_VUOTI,
          tipoUtente: valori.tipoUtente,
          statoUtente: valori.statoUtente,
          gdoScelta: valori.gdoScelta,
          ruolo_gdo: valori.ruolo_gdo,
        });
        setMostraPassword(false);
        setEmailRegistrata(null);
        setTimeout(() => setFocus("nome"), 0);
      } else {
        showNotification(`Utente ${nome} creato`, { variant: "success" });
        onClose();
      }
    },
    onError: (errore: ErroreCreazione, valori) => {
      if (eLimiteCreazioni(errore)) {
        onLimiteSuperato();
      } else if (eEmailGiaInUso(errore)) {
        setEmailRegistrata(normalizzaEmail(valori.email));
        setFocus("email");
      } else {
        showNotification(String(errore?.message || "Errore durante la creazione dell'utente"), { variant: "error" });
      }
    },
  });

  const invia = (unAltro: boolean) => {
    aggiungiUnAltro.current = unAltro;
    return handleSubmit(
      (valori) => {
        if (emailRegistrata === normalizzaEmail(valori.email)) {
          setError("email", { type: "registrata" });
          setFocus("email");
          return;
        }
        creaUtente.mutate(valori);
      },
      (errori) => {
        // Un errore nei dati facoltativi deve vedersi anche a sezione chiusa
        if (errori.telefono || errori.dataDiNascita) setAltriDatiAperti(true);
      }
    )();
  };

  const chiudi = () => {
    if (!creaUtente.isPending) onClose();
  };

  const erroreEmail = emailGiaRegistrata
    ? "Email già registrata: esiste già un utente con questa email"
    : errors.email?.message;
  const nomeGdoUtente = gdoUnica?.nome;

  return (
    <Dialog size="xl" open={open} onClose={chiudi}>
      <Dialog.Panel>
        <Dialog.Title>
          <Lucide icon="UserPlus" aria-hidden="true" className="h-5 w-5 text-primary" />
          Crea nuovo utente
        </Dialog.Title>
        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            invia(false);
          }}
        >
          <Dialog.Description className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField etichetta="Nome" obbligatorio errore={errors.nome?.message}>
                <FormInput {...register("nome")} type="text" autoComplete="off" placeholder="Mario" className={clsx(errors.nome && "border-danger")} />
              </FormField>
              <FormField etichetta="Cognome" obbligatorio errore={errors.cognome?.message}>
                <FormInput {...register("cognome")} type="text" autoComplete="off" placeholder="Rossi" className={clsx(errors.cognome && "border-danger")} />
              </FormField>
              <FormField className="sm:col-span-2" etichetta="Email" obbligatorio errore={erroreEmail}>
                <FormInput
                  {...register("email", { onBlur: verificaEmail })}
                  type="email"
                  autoComplete="off"
                  placeholder="mario.rossi@esempio.it"
                  className={clsx(erroreEmail && "border-danger")}
                />
              </FormField>

              {/* Password con i comandi accanto: etichetta, aiuto ed errore collegati a mano come in FormField */}
              <div className="flex flex-col sm:col-span-2">
                <FormLabel htmlFor={idPassword}>
                  Password
                  <span aria-hidden="true" className="ml-0.5 text-danger">*</span>
                  {" "}
                  <span className="sr-only">(obbligatorio)</span>
                </FormLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <FormInput
                    {...register("password")}
                    id={idPassword}
                    type={mostraPassword ? "text" : "password"}
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder="Scrivila o premi Genera"
                    aria-required
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={`${idPassword}-aiuto${errors.password ? ` ${idPassword}-errore` : ""}`}
                    className={clsx("font-mono sm:flex-1", errors.password && "border-danger")}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline-secondary"
                      aria-pressed={mostraPassword}
                      onClick={() => setMostraPassword((valore) => !valore)}
                    >
                      <Lucide icon={mostraPassword ? "EyeOff" : "Eye"} aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      {mostraPassword ? "Nascondi" : "Mostra"}
                    </Button>
                    <Button type="button" variant="outline-primary" onClick={generaNuovaPassword}>
                      <Lucide icon="Wand2" aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      Genera
                    </Button>
                    <Button type="button" variant="outline-secondary" onClick={copiaPassword} disabled={!password}>
                      <Lucide icon={passwordCopiata ? "Check" : "Copy"} aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      {passwordCopiata ? "Copiata" : "Copia"}
                    </Button>
                  </div>
                </div>
                <p id={`${idPassword}-aiuto`} className="mt-1.5 text-xs text-slate-500">
                  {DESCRIZIONE_REGOLA_PASSWORD}. Comunicala tu al nuovo utente: potrà cambiarla dal suo profilo.
                </p>
                {errors.password && (
                  <p id={`${idPassword}-errore`} className="mt-1.5 text-xs text-danger">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200/60 pt-4 sm:col-span-2">
                <h3 className="text-sm font-medium text-slate-700">Ruolo e appartenenza</h3>
              </div>
              <FormField etichetta="Tipo utente" obbligatorio errore={errors.tipoUtente?.message}>
                <FormSelect {...register("tipoUtente")} className={clsx(errors.tipoUtente && "border-danger")}>
                  <option value="">Scegli il tipo</option>
                  {tipiCreabili.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ETICHETTE_TIPO_UTENTE[tipo]}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField etichetta="Stato" obbligatorio errore={errors.statoUtente?.message}>
                <FormSelect {...register("statoUtente")} className={clsx(errors.statoUtente && "border-danger")}>
                  <option value={STATO_UTENTI.ATTIVO}>Attivo</option>
                  <option value={STATO_UTENTI.DISATTIVO}>Disattivo</option>
                </FormSelect>
              </FormField>

              {conGdo && (scegliGdo ? (
                <FormField etichetta="GDO" obbligatorio errore={errors.gdoScelta?.message}>
                  <FormSelect {...register("gdoScelta")} className={clsx(errors.gdoScelta && "border-danger")}>
                    <option value="">Scegli la GDO</option>
                    {tutteLeGdo?.map((gdo: GDOResponseDTO) => (
                      <option key={gdo.id} value={gdo.id}>
                        {gdo.nome} {gdo.ragione_sociale ? `(${gdo.ragione_sociale})` : ""}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
              ) : (
                <FormField etichetta="GDO" aiuto="Gli utenti che crei appartengono alla tua GDO">
                  <FormInput type="text" readOnly value={nomeGdoUtente ?? "La tua GDO"} className="bg-slate-50" />
                </FormField>
              ))}
              {conGdo && (
                <FormField etichetta="Ruolo (facoltativo)" errore={errors.ruolo_gdo?.message}>
                  <FormSelect {...register("ruolo_gdo")}>
                    <option value="">Nessun ruolo</option>
                    {ruoliGdo?.map((ruolo: RuoloUtenteGDOResponseDTO) => (
                      <option key={ruolo.id} value={ruolo.id}>
                        {ruolo.ruolo.replace("_", " ")}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
              )}
              {conPuntoVendita && (
                <FormField
                  className="sm:col-span-2"
                  etichetta="Punto vendita"
                  obbligatorio
                  errore={errors.idPuntoVendita?.message}
                  aiuto={scegliGdo && !gdoScelta ? "Scegli prima la GDO" : undefined}
                >
                  <FormSelect
                    {...register("idPuntoVendita")}
                    disabled={scegliGdo && !gdoScelta}
                    className={clsx(errors.idPuntoVendita && "border-danger")}
                  >
                    <option value="">
                      {puntiVendita.isLoading ? "Caricamento punti vendita…" : "Scegli il punto vendita"}
                    </option>
                    {puntiVendita.data?.map((punto: PuntoVenditaResponseDTO) => (
                      <option key={punto.id} value={punto.id}>
                        {punto.nome}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
              )}

              <details
                className="rounded-control border border-slate-200/60 sm:col-span-2"
                open={altriDatiAperti}
                onToggle={(evento) => setAltriDatiAperti((evento.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700">
                  Altri dati (facoltativi)
                </summary>
                <div className="grid grid-cols-1 gap-4 px-3 pb-3 pt-1 sm:grid-cols-2">
                  <FormField etichetta="Telefono" errore={errors.telefono?.message}>
                    <FormInput {...register("telefono")} type="tel" autoComplete="off" placeholder="+39 055 123 4567" className={clsx(errors.telefono && "border-danger")} />
                  </FormField>
                  <FormField etichetta="Sesso">
                    <FormSelect {...register("sesso")}>
                      <option value="">Non specificato</option>
                      {Object.entries(UTENTE_GENERE).map(([chiave, valore]) => (
                        <option key={chiave} value={valore}>{valore}</option>
                      ))}
                    </FormSelect>
                  </FormField>
                  <FormField etichetta="Data di nascita" errore={errors.dataDiNascita?.message}>
                    <FormInput {...register("dataDiNascita")} type="date" className={clsx(errors.dataDiNascita && "border-danger")} />
                  </FormField>
                  <FormField etichetta="Residenza">
                    <FormInput {...register("residenza")} type="text" autoComplete="off" placeholder="Via Roma 1, Firenze" />
                  </FormField>
                </div>
              </details>
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={chiudi} disabled={creaUtente.isPending}>
              Annulla
            </Button>
            <Button
              type="button"
              variant="outline-primary"
              onClick={() => invia(true)}
              disabled={creaUtente.isPending}
            >
              Crea e aggiungi un altro
            </Button>
            <Button type="submit" variant="primary" loading={creaUtente.isPending}>
              Crea
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
};

export default NuovoUtenteDialog;
