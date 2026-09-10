import userIcon from "@/assets/images/users/user_icon_profile.png";
import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import {
  FormCheck,
  FormHelp,
  FormInput,
  FormLabel,
  FormSelect,
  FormSwitch,
} from "@/components/Base/Form";
import Litepicker from "@/components/Base/Litepicker";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Table from "@/components/Base/Table";
import Tippy from "@/components/Base/Tippy";
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useUser } from "@/context/UserContext";
import clsx from "clsx";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { STATO_UTENTI, TIPO_UTENTI, UTENTE_GENERE } from "../../../lib/enums";
import { PROFILE_PHOTO_MAX_SIZE_BYTES, PROFILE_PHOTO_MAX_SIZE_MB } from "../../../lib/profilePhoto";
import { ServerCall } from "../../../lib/server_call";
import { UtenteAttributes } from "../../../lib/types";
import { UtenteResponseDTO } from "../../../server/core/dto";
dayjs.extend(customParseFormat);
function Main() {
  const [dateOfBirth, setDateOfBirth] = useState<string>();
  const [name, setName] = useState<string>();
  const [surname, setSurname] = useState<string>();
  const [gender, setGender] = useState<UTENTE_GENERE>();
  const [email, setEmail] = useState<string>();
  const [phone, setPhone] = useState<string>();
  const [address, setAddress] = useState<string>();
  const [city, setCity] = useState<string>();
  const [cap, setZip] = useState<string>();
  const [province, setProvince] = useState<string>();
  const [photo, setPhoto] = useState<string>();
  const [photoPrivacy, setPhotoPrivacy] = useState<string>();
  const [address2, setAddress2] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user, setUser } = useUser();
  const { showNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.nome);
      setSurname(user.cognome);
      setEmail(user.email);
      setPhone(user.telefono);
      setAddress(user.residenza);
      setDateOfBirth(user.datadinascita ? dayjs(user.datadinascita).format("YYYY-MM-DD") : undefined);
      setCity(user.meta?.citta);
      setZip(user.meta?.cap);
      setProvince(user.meta?.provincia);
      setPhoto(user.meta?.photo);
      setPhotoPrivacy(user.meta?.photoPrivacy);
      setGender(user.sesso as UTENTE_GENERE);
      setAddress2(user.meta?.residenza2 ?? '');
    }
  }, [user])





  const handleSave = async () => {
    setIsSaving(true);
    try {
      const normalizedPhoto = (() => {
        if (photo === undefined) {
          return undefined;
        }

        if (photo === "") {
          return "";
        }

        if (photo.startsWith("data:")) {
          return photo.split(",")[1] ?? "";
        }

        return photo;
      })();

      const updatedUser: UtenteAttributes = {
        id_utenti: user?.id as string,
        outsider_utenti: user?.outsider as boolean,
        tipo_utenti: user?.tipo as TIPO_UTENTI,
        stato_utenti: user?.stato as STATO_UTENTI,
        sesso_utenti: gender as UTENTE_GENERE,
        privatekey_utenti: user?.private_key,
        nome_utenti: name,
        cognome_utenti: surname,
        email_utenti: email,
        telefono_utenti: phone,
        datadinascita_utenti: dateOfBirth ? new Date(dateOfBirth) : undefined,
        residenza_utenti: address,
        meta_utenti: {
          citta: city,
          cap,
          provincia: province,
          residenza2: address2,
          photo: normalizedPhoto,
          photoPrivacy,
        }
      };

      const response = await ServerCall.put<UtenteResponseDTO>(`/update_profile`, updatedUser);
      setUser(response);
      showNotification('Profilo aggiornato con successo', { variant: 'success' });
    } catch (error) {
      showNotification('Errore durante il salvataggio del profilo', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    setPhoto("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > PROFILE_PHOTO_MAX_SIZE_BYTES) {
        setError(`Il file non può superare i ${PROFILE_PHOTO_MAX_SIZE_MB}MB.`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('Tutti i campi password sono obbligatori', { variant: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Le nuove password non coincidono', { variant: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      showNotification('La nuova password deve contenere almeno 8 caratteri', { variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      await ServerCall.put('/update_password', { currentPassword, newPassword, confirmPassword });
      showNotification('Password aggiornata con successo', { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il cambio password';
      showNotification(msg, { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailAddress)) {
      showNotification('Inserisci un indirizzo email valido', { variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const updatedUser: UtenteAttributes = {
        id_utenti: user?.id as string,
        outsider_utenti: user?.outsider as boolean,
        tipo_utenti: user?.tipo as TIPO_UTENTI,
        stato_utenti: user?.stato as STATO_UTENTI,
        email_utenti: newEmailAddress,
      };
      const response = await ServerCall.put<UtenteResponseDTO>('/update_profile', updatedUser);
      setUser(response);
      setEmail(newEmailAddress);
      setNewEmailAddress('');
      showNotification('Email aggiornata con successo', { variant: 'success' });
    } catch {
      showNotification('Errore durante l\'aggiornamento dell\'email', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const isOutsider = user?.outsider === true;
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
          <PageHeader title="Impostazioni Account" />
          <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 md:ml-auto">
            <Button
              variant="primary"
              className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent"
            >
              <Lucide
                icon="ExternalLink"
                className="stroke-[1.3] w-4 h-4 mr-3"
              />{" "}
              Vai al Mio Profilo
            </Button>
          </div>
        </div>
        {error && (
          <Alert variant="danger" className="mt-4">
            {error}
            <Alert.DismissButton onClick={() => setError(null)} />
          </Alert>
        )}
        <div className="mt-3.5 grid grid-cols-12 gap-y-10 gap-x-6">
          <div className="relative col-span-12 xl:col-span-3">
            <div className="sticky top-[104px]">
              <div className="flex flex-col px-5 pt-5 pb-6 box box--stacked">
                <Link
                  to="/profilo-utente"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    { active: queryParams.get("page") === null },
                  ])}
                >
                  <Lucide
                    icon="AppWindow"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Informazioni personali
                </Link>
                {!isOutsider && (
                  <Link
                    to="/profilo-utente?page=email-profilo-utente"
                    className={clsx([
                      "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                      { active: queryParams.get("page") === "email-profilo-utente" },
                    ])}
                  >
                    <Lucide
                      icon="MailCheck"
                      className="stroke-[1.3] w-4 h-4 mr-3"
                    />{" "}
                    Impostazioni Email
                  </Link>
                )}
                {!isOutsider && (
                  <Link
                    to="/profilo-utente?page=security"
                    className={clsx([
                      "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                      { active: queryParams.get("page") === "security" },
                    ])}
                  >
                    <Lucide
                      icon="KeyRound"
                      className="stroke-[1.3] w-4 h-4 mr-3"
                    />{" "}
                    Sicurezza
                  </Link>
                )}
                <Link
                  to="/profilo-utente?page=preferences"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    { active: queryParams.get("page") === "preferences" },
                  ])}
                >
                  <Lucide
                    icon="PackageCheck"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Preferenze
                </Link>
                <Link
                  to="/profilo-utente?page=two-factor-authentication"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    {
                      active:
                        queryParams.get("page") === "two-factor-authentication",
                    },
                  ])}
                >
                  <Lucide
                    icon="ShieldCheck"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Autenticazione a Due Fattori (2FA)
                </Link>
                <Link
                  to="/profilo-utente?page=device-history"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    { active: queryParams.get("page") === "device-history" },
                  ])}
                >
                  <Lucide
                    icon="Smartphone"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Cronologia Dispositivi
                </Link>
                <Link
                  to="/profilo-utente?page=notification-profilo-utente"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    {
                      active:
                        queryParams.get("page") === "notification-profilo-utente",
                    },
                  ])}
                >
                  <Lucide
                    icon="BellDot"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Impostazioni Notifiche
                </Link>
                <Link
                  to="/profilo-utente?page=connected-services"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    {
                      active: queryParams.get("page") === "connected-services",
                    },
                  ])}
                >
                  <Lucide
                    icon="Workflow"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Servizi Connessi
                </Link>
                <Link
                  to="/profilo-utente?page=social-media-links"
                  className={clsx([
                    "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                    {
                      active: queryParams.get("page") === "social-media-links",
                    },
                  ])}
                >
                  <Lucide
                    icon="Podcast"
                    className="stroke-[1.3] w-4 h-4 mr-3"
                  />{" "}
                  Link Social Media
                </Link>
                {!isOutsider && (
                  <Link
                    to="/profilo-utente?page=account-deactivation"
                    className={clsx([
                      "flex items-center py-3 first:-mt-3 last:-mb-3 [&.active]:text-primary [&.active]:font-medium hover:text-primary",
                      {
                        active:
                          queryParams.get("page") === "account-deactivation",
                      },
                    ])}
                  >
                    <Lucide icon="Trash2" className="stroke-[1.3] w-4 h-4 mr-3" />{" "}
                    Disattivazione Account
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col col-span-12 xl:col-span-9 gap-y-7">
            <div className="p-1.5 box flex flex-col box--stacked">
              <div className="h-60 relative w-full rounded-[0.6rem] bg-gradient-to-b from-theme-1/95 to-theme-2/95">
                <div
                  className={clsx([
                    "w-full h-full relative overflow-hidden",
                    "before:content-[''] before:absolute before:inset-0 before:bg-texture-white before:-mt-[50rem]",
                    "after:content-[''] after:absolute after:inset-0 after:bg-texture-white after:-mt-[50rem]",
                  ])}
                ></div>
                <div className="absolute inset-x-0 top-0 w-32 h-32 mx-auto mt-36">
                  <div className="w-full h-full overflow-hidden border-[6px] box border-white rounded-full image-fit">
                    <img
                      alt="Foto profilo"
                      src={photo && photo.startsWith('data:') ? photo : (photo ? `data:image/png;base64,${photo}` : userIcon)}
                    />
                  </div>
                  {photo && !isOutsider && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-0 right-0 flex items-center justify-center w-6 h-6 mt-1 mr-1 text-white bg-danger rounded-full shadow-md hover:bg-danger/80 transition-colors"
                      title="Rimuovi foto"
                    >
                      <Lucide icon="X" className="w-3.5 h-3.5 stroke-[2]" />
                    </button>
                  )}
                  <div className="absolute bottom-0 right-0 w-5 h-5 mb-2.5 mr-2.5 border-2 border-white rounded-full bg-success box"></div>
                </div>
              </div>
              <div className="p-5 flex flex-col sm:flex-row gap-y-3 sm:items-end rounded-[0.6rem] bg-slate-50 pt-12">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-medium text-sm">{name} {surname}</div>
                    {isOutsider && (
                      <div className="flex items-center text-xs font-medium rounded-md text-warning bg-warning/10 border border-warning/10 px-1.5 py-px">
                        Account Esterno
                      </div>
                    )}
                  </div>
                  <FormLabel
                    htmlFor="regular-form-1"
                    className="flex items-center text-slate-500"
                  >
                    Chi può vedere la tua foto del profilo?
                    <Tippy as="div" content="Low" className="ml-1.5">
                      <Lucide
                        icon="Info"
                        className="w-3.5 h-3.5 text-slate-500 stroke-[1.3]"
                      />
                    </Tippy>
                  </FormLabel>
                  <div className="relative mt-2.5">
                    <Lucide
                      icon="Globe"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3]"
                    />
                    <FormSelect value={photoPrivacy} onChange={(e) => setPhotoPrivacy(e.target.value)} className="sm:w-44 mr-3 rounded-[0.5rem] pl-9">
                      <option value="tutti">Tutti</option>
                      <option value="solo_tu">Solo tu</option>
                    </FormSelect>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
                <Button
                  variant="outline-primary"
                  className="sm:ml-auto border-primary/50"
                  onClick={handleCoverUpload}
                >
                  <Lucide
                    icon="Image"
                    className="stroke-[1.3] w-4 h-4 mr-2.5"
                  />{" "}
                  Upload Cover
                </Button>
                <FormHelp className="sm:ml-3 text-xs text-slate-500">
                  Dimensione massima: {PROFILE_PHOTO_MAX_SIZE_MB}MB
                </FormHelp>
              </div>
            </div>
            {queryParams.get("page") === null && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Informazioni personali
                </div>
                {isOutsider && (
                  <Alert variant="outline-warning" className="flex items-start mb-6">
                    <Lucide icon="AlertTriangle" className="w-6 h-6 mr-2 mt-0.5 shrink-0" />
                    <div>
                      Il tuo profilo è gestito dal provider di identità esterno. I dati non possono essere modificati da questa pagina.
                    </div>
                  </Alert>
                )}
                <div className={isOutsider ? "opacity-60 pointer-events-none select-none" : ""}>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Nome Completo</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Inserisci il tuo nome completo come appare sul tuo documento d'identità.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <div className="flex flex-col items-center md:flex-row">
                        <FormInput
                          type="text"
                          className="first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                          }}
                        />
                        <FormInput
                          type="text"
                          className="first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10"
                          value={surname}
                          onChange={(e) => {
                            setSurname(e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Data di Nascita</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Questa informazione è necessaria per verificare la tua età e fornire servizi appropriati.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <Litepicker
                        value={dateOfBirth ? dayjs(dateOfBirth).format("DD/MM/YYYY") : ""}
                        onChange={(date) => {
                          setDateOfBirth(dayjs(date.target.value, "DD/MM/YYYY").format("YYYY-MM-DD"));
                        }}
                        options={{
                          buttonText: {
                            apply: "Applica",
                            cancel: "Annulla",
                            reset: "Reset",
                            previousMonth: "<",
                            nextMonth: ">",
                          },
                          mobileFriendly: true,
                          autoApply: false,
                          singleMode: true,
                          showWeekNumbers: false,
                          format: "DD/MM/YYYY",
                          lang: "it-IT",
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Genere</div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Seleziona il tuo genere dalle opzioni.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <div className="flex flex-col items-center md:flex-row">
                        <div className="bg-white w-full px-3 py-2 border rounded-md shadow-sm border-slate-300/60 first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <FormCheck>
                            <FormCheck.Input
                              id="checkbox-switch-1"
                              type="radio"
                              value={UTENTE_GENERE.UOMO}
                              checked={gender === UTENTE_GENERE.UOMO}
                              onChange={(e) => {
                                setGender(e.target.value as UTENTE_GENERE);
                              }}
                            />
                            <FormCheck.Label htmlFor="checkbox-switch-1">
                              Uomo
                            </FormCheck.Label>
                          </FormCheck>
                        </div>
                        <div className="bg-white w-full px-3 py-2 border rounded-md shadow-sm border-slate-300/60 first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <FormCheck>
                            <FormCheck.Input
                              id="checkbox-switch-2"
                              type="radio"
                              value={UTENTE_GENERE.DONNA}
                              checked={gender === UTENTE_GENERE.DONNA}
                              onChange={(e) => {
                                setGender(e.target.value as UTENTE_GENERE);
                              }}
                            />
                            <FormCheck.Label htmlFor="checkbox-switch-2">
                              Donna
                            </FormCheck.Label>
                          </FormCheck>
                        </div>
                        <div className="bg-white w-full px-3 py-2 border rounded-md shadow-sm border-slate-300/60 first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <FormCheck>
                            <FormCheck.Input
                              id="checkbox-switch-3"
                              type="radio"
                              value={UTENTE_GENERE.ALTRO}
                              checked={gender === UTENTE_GENERE.ALTRO}
                              onChange={(e) => {
                                setGender(e.target.value as UTENTE_GENERE);
                              }}
                            />
                            <FormCheck.Label htmlFor="checkbox-switch-3">
                              Altro
                            </FormCheck.Label>
                          </FormCheck>
                        </div>
                        <div className="bg-white w-full px-3 py-2 border rounded-md shadow-sm border-slate-300/60 first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <FormCheck>
                            <FormCheck.Input
                              id="checkbox-switch-4"
                              type="radio"
                              value={UTENTE_GENERE.NON_BINARIO}
                              checked={gender === UTENTE_GENERE.NON_BINARIO}
                              onChange={(e) => {
                                setGender(e.target.value as UTENTE_GENERE);
                              }}
                            />
                            <FormCheck.Label htmlFor="checkbox-switch-4">
                              Non binario
                            </FormCheck.Label>
                          </FormCheck>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Email</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Fornisci un indirizzo email valido a cui hai accesso.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Numero di Telefono</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Fornisci un numero di telefono valido dove possiamo contattarti se necessario.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <div className="flex flex-col items-center md:flex-row">
                        <FormInput
                          type="text"
                          className="first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                          }}
                        />
                        <FormSelect className="md:w-36 first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <option value="office">Ufficio</option>
                          <option value="home">Casa</option>
                        </FormSelect>
                      </div>
                      <a
                        className="flex items-center mt-3.5 -mb-1 font-medium text-primary"
                        href=""
                      >
                        <Lucide
                          className="w-4 h-4 stroke-[1.3] mr-1"
                          icon="Plus"
                        />
                        Aggiungi telefono
                      </a>
                    </div>
                  </div>

                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Tipo di Account</div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Il tipo di account determina le funzionalità e i privilegi che avrai su questa piattaforma.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/10 text-xs rounded-md font-medium">
                          {user?.tipo}
                        </span>
                        {isOutsider && (
                          <span className="px-2 py-0.5 bg-warning/10 text-warning border border-warning/10 text-xs rounded-md font-medium">
                            Account Esterno
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Indirizzo Linea 1</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Inserisci la linea principale del tuo indirizzo fisico, tipicamente includendo il numero civico e il nome della via.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Indirizzo Linea 2</div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Questo campo è opzionale e può essere utilizzato per fornire dettagli aggiuntivi dell'indirizzo, come numero dell'appartamento, piano, o qualsiasi altra informazione rilevante.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Città</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Inserisci il nome della città o località dove si trova il tuo indirizzo.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">Provincia</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Seleziona la tua provincia dalla lista fornita.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">CAP</div>
                          <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                            Obbligatorio
                          </div>
                        </div>
                        <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                          Inserisci il codice postale o CAP associato al tuo indirizzo.
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormInput
                        type="text"
                        placeholder={cap}
                        value={cap}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                {!isOutsider && (
                  <div className="flex pt-5 mt-6 border-t border-dashed md:justify-end border-slate-300/70">
                    <Button
                      variant="outline-primary"
                      className="w-full px-4 border-primary/50 md:w-auto"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      Salva Modifiche
                    </Button>
                  </div>
                )}
              </div>
            )}
            {queryParams.get("page") === "email-profilo-utente" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Impostazioni Email
                </div>
                {isOutsider ? (
                  <Alert variant="info">
                    L'indirizzo email è gestito dal tuo provider di identità esterno e non può essere modificato qui.
                  </Alert>
                ) : (
                  <>
                    <div>
                      <div className="text-slate-500">
                        Il tuo indirizzo email attuale è{" "}
                        <span className="font-medium">{email}</span>.
                      </div>
                      <div className="flex-col block pt-5 mt-2 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                        <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-60 xl:mr-14">
                          <div className="text-left">
                            <div className="flex items-center">
                              <div className="font-medium">Nuovo Indirizzo Email</div>
                              <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                                Obbligatorio
                              </div>
                            </div>
                            <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                              Inserisci un indirizzo email valido a cui hai accesso.
                            </div>
                          </div>
                        </label>
                        <div className="flex-1 w-full mt-3 xl:mt-0">
                          <FormInput
                            type="email"
                            value={newEmailAddress}
                            onChange={(e) => setNewEmailAddress(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex pt-5 mt-6 border-t border-dashed md:justify-end border-slate-300/70">
                      <Button
                        variant="outline-primary"
                        className="w-full px-4 border-primary/50 md:w-auto"
                        onClick={handleEmailChange}
                        disabled={isSaving}
                      >
                        Salva Modifiche
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {queryParams.get("page") === "security" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Sicurezza
                </div>
                {isOutsider ? (
                  <Alert variant="info">
                    Gli utenti con accesso esterno (OIDC) non possono modificare la password tramite questo pannello. Gestisci la tua password dal tuo provider di identità.
                  </Alert>
                ) : (
                  <>
                    <div>
                      <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                        <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-64 xl:mr-14">
                          <div className="text-left">
                            <div className="flex items-center">
                              <div className="font-medium">Password Attuale</div>
                              <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                                Obbligatorio
                              </div>
                            </div>
                            <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                              Inserisci la tua password attuale per verificare la tua identità.
                            </div>
                          </div>
                        </label>
                        <div className="flex-1 w-full mt-3 xl:mt-0">
                          <FormInput
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                        <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-64 xl:mr-14">
                          <div className="text-left">
                            <div className="flex items-center">
                              <div className="font-medium">Nuova Password</div>
                              <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                                Obbligatorio
                              </div>
                            </div>
                            <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                              Crea una nuova password per il tuo account.
                            </div>
                          </div>
                        </label>
                        <div className="flex-1 w-full mt-3 xl:mt-0">
                          <FormInput
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex-col block pt-5 mt-5 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                        <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-64 xl:mr-14">
                          <div className="text-left">
                            <div className="flex items-center">
                              <div className="font-medium">Conferma Nuova Password</div>
                              <div className="ml-2.5 px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-darkmode-300 dark:text-slate-400 text-xs rounded-md border border-slate-200">
                                Obbligatorio
                              </div>
                            </div>
                            <div className="mt-1.5 xl:mt-3 text-xs leading-relaxed text-slate-500/80">
                              Reinserisci la nuova password appena scelta.
                            </div>
                          </div>
                        </label>
                        <div className="flex-1 w-full mt-3 xl:mt-0">
                          <FormInput
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                          <div className="mt-4 text-slate-500">
                            <div className="font-medium">Requisiti della password:</div>
                            <ul className="flex flex-col gap-1 pl-3 mt-2.5 list-disc text-slate-500">
                              <li className="pl-0.5">Le password devono essere lunghe almeno 8 caratteri.</li>
                              <li className="pl-0.5">Includere almeno una cifra numerica (0-9).</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex pt-5 mt-6 border-t border-dashed md:justify-end border-slate-300/70">
                      <Button
                        variant="outline-primary"
                        className="w-full px-4 border-primary/50 md:w-auto"
                        onClick={handlePasswordChange}
                        disabled={isSaving}
                      >
                        Salva Modifiche
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {queryParams.get("page") === "preferences" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Preferenze
                </div>
                <div>
                </div>
                <div className="flex pt-5 mt-6 border-t border-dashed md:justify-end border-slate-300/70">
                  <Button
                    variant="outline-primary"
                    className="w-full px-4 border-primary/50 md:w-auto"
                  >
                    Salva Modifiche
                  </Button>
                </div>
              </div>
            )}
            {queryParams.get("page") === "two-factor-authentication" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Autenticazione a Due Fattori (2FA)
                </div>
                <div className="text-slate-500">
                  Funzionalità non ancora disponibile. Sarà disponibile in un aggiornamento futuro.
                </div>
              </div>
            )}
            {queryParams.get("page") === "device-history" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Cronologia Dispositivi
                </div>
                <div className="text-slate-500">
                  Funzionalità non ancora disponibile. Sarà disponibile in un aggiornamento futuro.
                </div>
              </div>
            )}
            {queryParams.get("page") === "notification-profilo-utente" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="flex items-center pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Impostazioni Notifiche
                </div>
                <div>
                  <div className="mt-5 border rounded-lg border-slate-200/80">
                    <div className="overflow-auto xl:overflow-visible">
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Td className="py-4 font-medium first:rounded-tl-lg border-slate-200/80 last:rounded-tr-lg bg-slate-50 text-slate-500">
                              Tipo
                            </Table.Td>
                            <Table.Td className="py-4 font-medium first:rounded-tl-lg border-slate-200/80 last:rounded-tr-lg bg-slate-50 text-slate-500">
                              <div className="flex flex-col items-center">
                                <Lucide icon="MailCheck" className="w-6 h-6" />
                                <div className="mt-1.5">Email</div>
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 font-medium first:rounded-tl-lg border-slate-200/80 last:rounded-tr-lg bg-slate-50 text-slate-500">
                              <div className="flex flex-col items-center">
                                <Lucide icon="Globe" className="w-6 h-6" />
                                <div className="mt-1.5">Browser</div>
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 font-medium first:rounded-tl-lg border-slate-200/80 last:rounded-tr-lg bg-slate-50 text-slate-500">
                              <div className="flex flex-col items-center">
                                <Lucide icon="Smartphone" className="w-6 h-6" />
                                <div className="mt-1.5">App</div>
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          <Table.Tr className="[&_td]:last:border-b-0">
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="whitespace-nowrap">
                                Attività di accesso insolita rilevata
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                          </Table.Tr>
                          <Table.Tr className="[&_td]:last:border-b-0">
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="flex items-center whitespace-nowrap">
                                Richiesta di cambio password
                                <Lucide
                                  className="w-4 h-4 ml-1.5 text-slate-400 stroke-[1.3]"
                                  icon="Info"
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                          </Table.Tr>
                          <Table.Tr className="[&_td]:last:border-b-0">
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="whitespace-nowrap">
                                Nuovo messaggio ricevuto
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                          </Table.Tr>
                          <Table.Tr className="[&_td]:last:border-b-0">
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="whitespace-nowrap">
                                Riepilogo attività account
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                          </Table.Tr>
                          <Table.Tr className="[&_td]:last:border-b-0">
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="flex items-center whitespace-nowrap">
                                Avviso di sicurezza: dispositivo non riconosciuto
                                <Lucide
                                  className="w-4 h-4 ml-1.5 text-slate-400 stroke-[1.3]"
                                  icon="Info"
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                            <Table.Td className="py-4 border-dashed border-slate-300/70 dark:bg-darkmode-600">
                              <div className="text-center">
                                <FormCheck.Input
                                  id="checkbox-switch-3"
                                  type="checkbox"
                                  value=""
                                />
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        </Table.Tbody>
                      </Table>
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-3 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-1/2 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">
                            Quando preferiresti ricevere le notifiche?
                          </div>
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <FormSelect>
                        <option value="Immediately">Immediatamente</option>
                        <option value="In the morning">Al mattino</option>
                        <option value="At noon">A mezzogiorno</option>
                        <option value="In the afternoon">Nel pomeriggio</option>
                        <option value="In the evening">In serata</option>
                        <option value="At night">Di notte</option>
                        <option value="Once a day">Una volta al giorno</option>
                        <option value="Twice a day">Due volte al giorno</option>
                        <option value="Custom schedule">Orario personalizzato</option>
                        <option value="Don't send notifications">Non inviare notifiche</option>
                      </FormSelect>
                    </div>
                  </div>
                  <div className="flex-col block pt-5 mt-3 xl:items-center sm:flex xl:flex-row first:mt-0 first:pt-0">
                    <label className="inline-block mb-2 sm:mb-0 sm:mr-5 sm:text-right xl:w-1/2 xl:mr-14">
                      <div className="text-left">
                        <div className="flex items-center">
                          <div className="font-medium">
                            Ricevi un riepilogo giornaliero ('Daily Digest') della tua attività.
                          </div>
                        </div>
                      </div>
                    </label>
                    <div className="flex-1 w-full mt-3 xl:mt-0">
                      <div className="flex flex-col items-center md:flex-row">
                        <FormSelect className="first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <option value="Every day">Ogni giorno</option>
                          <option value="Once a day">Una volta al giorno</option>
                          <option value="Twice a day">Due volte al giorno</option>
                          <option value="No daily overview (disable Daily Digest)">Nessun riepilogo giornaliero</option>
                        </FormSelect>
                        <FormSelect className="first:rounded-b-none first:md:rounded-bl-md first:md:rounded-r-none [&:not(:first-child):not(:last-child)]:-mt-px [&:not(:first-child):not(:last-child)]:md:mt-0 [&:not(:first-child):not(:last-child)]:md:-ml-px [&:not(:first-child):not(:last-child)]:rounded-none last:rounded-t-none last:md:rounded-l-none last:md:rounded-tr-md last:-mt-px last:md:mt-0 last:md:-ml-px focus:z-10">
                          <option value="at 8:00 AM">alle 8:00</option>
                          <option value="at 12:00 PM">alle 12:00</option>
                          <option value="at 4:00 PM">alle 16:00</option>
                          <option value="at 8:00 PM">alle 20:00</option>
                        </FormSelect>
                      </div>
                    </div>
                  </div>
                  <div className="mt-7 text-slate-500">
                    Per ridurre le interruzioni, le notifiche email vengono raggruppate e consegnate quando non stai usando attivamente il dispositivo.
                  </div>
                </div>
                <div className="flex pt-5 mt-6 border-t border-dashed md:justify-end border-slate-300/70">
                  <Button
                    variant="outline-primary"
                    className="w-full px-4 border-primary/50 md:w-auto"
                  >
                    Salva Modifiche
                  </Button>
                </div>
              </div>
            )}
            {queryParams.get("page") === "connected-services" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Servizi Connessi
                </div>
                <div className="text-slate-500">
                  Funzionalità non ancora disponibile. Sarà disponibile in un aggiornamento futuro.
                </div>
              </div>
            )}
            {queryParams.get("page") === "social-media-links" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Link Social Media
                </div>
                <div className="text-slate-500">
                  Funzionalità non ancora disponibile. Sarà disponibile in un aggiornamento futuro.
                </div>
              </div>
            )}
            {queryParams.get("page") === "account-deactivation" && (
              <div className="flex flex-col p-5 box box--stacked">
                <div className="flex items-center pb-5 mb-6 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                  Disattivazione Account
                </div>
                {isOutsider ? (
                  <Alert variant="outline-warning" className="flex items-start">
                    <Lucide icon="AlertTriangle" className="w-6 h-6 mr-2 mt-0.5 shrink-0" />
                    <div>
                      Gli account con autenticazione esterna (OIDC) non possono essere eliminati da questo pannello. Contatta l'amministratore del sistema per procedere.
                    </div>
                  </Alert>
                ) : (
                  <>
                    <div>
                      <div className="leading-relaxed">
                        Avviando il processo di eliminazione dell'account, perderai l'accesso a tutti i servizi della piattaforma e i tuoi dati personali verranno rimossi definitivamente. Hai una finestra di 10 giorni per annullare la richiesta se necessario.
                      </div>
                      <FormCheck className="mt-5">
                        <FormCheck.Input
                          id="checkbox-switch-1"
                          type="checkbox"
                          value=""
                        />
                        <FormCheck.Label htmlFor="checkbox-switch-1">
                          Confermo di voler eliminare il mio account.
                        </FormCheck.Label>
                      </FormCheck>
                    </div>
                    <div className="flex flex-col-reverse gap-3 pt-5 mt-6 border-t border-dashed md:flex-row md:justify-end border-slate-300/70">
                      <Button
                        variant="outline-secondary"
                        className="w-full px-4 md:w-auto"
                      >
                        Maggiori Informazioni
                      </Button>
                      <Button
                        variant="outline-danger"
                        className="w-full px-4 border-danger/50 bg-danger/5 md:w-auto"
                      >
                        Elimina Account
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(Main);
