import userIcon from "@/assets/images/users/user_icon_profile.png";
import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import {
  FormCheck,
  FormField,
  FormHelp,
  FormInput,
  FormLabel,
  FormSelect,
} from "@/components/Base/Form";
import Litepicker from "@/components/Base/Litepicker";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Tippy from "@/components/Base/Tippy";
import withSessionCheck from "@/components/SessionChecker";
import EmptyState from "@/components/EmptyState";
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

const OPZIONI_GENERE = [
  { valore: UTENTE_GENERE.UOMO, etichetta: "Uomo", id: "genere-uomo" },
  { valore: UTENTE_GENERE.DONNA, etichetta: "Donna", id: "genere-donna" },
  { valore: UTENTE_GENERE.ALTRO, etichetta: "Altro", id: "genere-altro" },
  { valore: UTENTE_GENERE.NON_BINARIO, etichetta: "Non binario", id: "genere-non-binario" },
];

/** Sezione del profilo senza funzionalità dietro: niente comandi che non salvano nulla. */
function SezioneNonDisponibile({ titolo }: { titolo: string }) {
  return (
    <Sezione titolo={titolo}>
      <EmptyState
        compatta
        icon="Clock"
        title="Funzionalità non ancora disponibile"
        description="Sarà disponibile in un aggiornamento futuro."
      />
    </Sezione>
  );
}

type VoceMenu = { pagina: string | null; etichetta: string; icona: string; soloInterni?: boolean };

// Voci del menu laterale: pagina null è la scheda predefinita (informazioni personali)
const VOCI_MENU: VoceMenu[] = [
  { pagina: null, etichetta: "Informazioni personali", icona: "AppWindow" },
  { pagina: "email-profilo-utente", etichetta: "Impostazioni Email", icona: "MailCheck", soloInterni: true },
  { pagina: "security", etichetta: "Sicurezza", icona: "KeyRound", soloInterni: true },
  { pagina: "preferences", etichetta: "Preferenze", icona: "PackageCheck" },
  { pagina: "two-factor-authentication", etichetta: "Autenticazione a Due Fattori (2FA)", icona: "ShieldCheck" },
  { pagina: "device-history", etichetta: "Cronologia Dispositivi", icona: "Smartphone" },
  { pagina: "notification-profilo-utente", etichetta: "Impostazioni Notifiche", icona: "BellDot" },
  { pagina: "connected-services", etichetta: "Servizi Connessi", icona: "Workflow" },
  { pagina: "social-media-links", etichetta: "Link Social Media", icona: "Podcast" },
  { pagina: "account-deactivation", etichetta: "Disattivazione Account", icona: "Trash2", soloInterni: true },
];

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
  const [passwordDisattivazione, setPasswordDisattivazione] = useState("");
  const [confermaDisattivazione, setConfermaDisattivazione] = useState(false);
  const [disattivazioneInCorso, setDisattivazioneInCorso] = useState(false);
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

  const handleDisattivaAccount = async () => {
    setDisattivazioneInCorso(true);
    try {
      await ServerCall.post('/utente/disattiva-account', { password: passwordDisattivazione });
      // Le sessioni sono già chiuse dal server: ricarico da zero per svuotare lo stato dell'app
      window.location.assign('/login');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Errore durante la disattivazione dell'account", { variant: 'error' });
      setDisattivazioneInCorso(false);
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
  const paginaCorrente = queryParams.get("page");
  const vociVisibili = VOCI_MENU.filter((voce) => !(voce.soloInterni && isOutsider));
  const classiPiede = "mt-6 flex border-t border-dashed border-slate-200 pt-5 md:justify-end";

  return (
    <Pagina titolo="Impostazioni Account" descrizione="Gestisci il tuo profilo, l'accesso e la sicurezza dell'account">
      {error && (
        <Alert variant="soft-danger" icona="CircleAlert" onChiudi={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-12 gap-6">
        <div className="relative col-span-12 xl:col-span-3">
          <Sezione as="div" className="sticky top-24">
            <nav aria-label="Sezioni del profilo" className="-my-3 flex flex-col">
              {vociVisibili.map((voce) => {
                const attiva = paginaCorrente === voce.pagina;
                return (
                  <Link
                    key={voce.pagina ?? "profilo"}
                    to={voce.pagina ? `/profilo-utente?page=${voce.pagina}` : "/profilo-utente"}
                    aria-current={attiva ? "page" : undefined}
                    className={clsx(
                      "flex items-center py-3 transition-colors hover:text-primary",
                      attiva && "font-medium text-primary"
                    )}
                  >
                    <Lucide icon={voce.icona} aria-hidden="true" className="mr-3 h-4 w-4" />
                    {voce.etichetta}
                  </Link>
                );
              })}
            </nav>
          </Sezione>
        </div>
        <div className="col-span-12 flex flex-col gap-6 xl:col-span-9">
          <div className="box box--stacked flex flex-col p-1.5">
            <div className="relative h-60 w-full rounded-card bg-gradient-to-b from-theme-1/95 to-theme-2/95">
              <div className="absolute inset-x-0 top-0 mx-auto mt-36 h-32 w-32">
                <div className="image-fit box h-full w-full overflow-hidden rounded-full border-4 border-white">
                  <img
                    alt="Foto profilo"
                    src={photo && photo.startsWith('data:') ? photo : (photo ? `data:image/png;base64,${photo}` : userIcon)}
                  />
                </div>
                {photo && !isOutsider && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute right-0 top-0 mr-1 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow-md transition-colors hover:bg-danger/80"
                    title="Rimuovi foto"
                    aria-label="Rimuovi foto"
                  >
                    <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5 stroke-[2]" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-y-3 rounded-card bg-slate-50 p-5 pt-12 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-sm font-medium">{name} {surname}</div>
                  {isOutsider && (
                    <Badge variant="warning" size="sm">Account Esterno</Badge>
                  )}
                </div>
                <FormLabel
                  htmlFor="privacy-foto"
                  className="flex items-center text-slate-500"
                >
                  Chi può vedere la tua foto del profilo?
                  <Tippy as="div" content="Scegli chi può vedere la tua foto del profilo" className="ml-1.5">
                    <Lucide
                      icon="Info"
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-slate-500"
                    />
                  </Tippy>
                </FormLabel>
                <div className="relative mt-2.5">
                  <Lucide
                    icon="Globe"
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 z-10 my-auto ml-3 h-4 w-4 text-slate-500"
                  />
                  <FormSelect id="privacy-foto" value={photoPrivacy} onChange={(e) => setPhotoPrivacy(e.target.value)} className="mr-3 pl-9 sm:w-44">
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
                variant="outline-secondary"
                className="sm:ml-auto"
                onClick={handleCoverUpload}
              >
                <Lucide
                  icon="Image"
                  aria-hidden="true"
                  className="mr-2 h-4 w-4"
                />
                Carica foto
              </Button>
              <FormHelp className="text-xs text-slate-500 sm:ml-3">
                Dimensione massima: {PROFILE_PHOTO_MAX_SIZE_MB}MB
              </FormHelp>
            </div>
          </div>
          {queryParams.get("page") === null && (
            <Sezione titolo="Informazioni personali">
              {isOutsider && (
                <Alert variant="soft-warning" icona="TriangleAlert" className="mb-6">
                  Il tuo profilo è gestito dal provider di identità esterno. I dati non possono essere modificati da questa pagina.
                </Alert>
              )}
              <div className={clsx("grid grid-cols-12 gap-x-6 gap-y-5", isOutsider && "opacity-60 pointer-events-none select-none")}>
                <FormField
                  className="col-span-12 md:col-span-6"
                  etichetta="Nome"
                  obbligatorio
                  aiuto="Come appare sul tuo documento d'identità."
                >
                  <FormInput
                    type="text"
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>
                <FormField
                  className="col-span-12 md:col-span-6"
                  etichetta="Cognome"
                  obbligatorio
                  aiuto="Come appare sul tuo documento d'identità."
                >
                  <FormInput
                    type="text"
                    autoComplete="family-name"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                  />
                </FormField>
                <FormField
                  className="col-span-12 md:col-span-6"
                  etichetta="Data di nascita"
                  obbligatorio
                  aiuto="Serve a verificare la tua età e a fornirti servizi appropriati."
                >
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
                </FormField>
                <fieldset className="col-span-12">
                  <legend className="mb-2">Genere</legend>
                  <div className="flex flex-col gap-2 md:flex-row">
                    {OPZIONI_GENERE.map((opzione) => (
                      <FormCheck
                        key={opzione.valore}
                        className="w-full px-3 py-2 bg-white border rounded-control shadow-sm border-slate-300/60"
                      >
                        <FormCheck.Input
                          id={opzione.id}
                          type="radio"
                          name="genere"
                          value={opzione.valore}
                          checked={gender === opzione.valore}
                          onChange={(e) => setGender(e.target.value as UTENTE_GENERE)}
                        />
                        <FormCheck.Label htmlFor={opzione.id}>{opzione.etichetta}</FormCheck.Label>
                      </FormCheck>
                    ))}
                  </div>
                </fieldset>
                <FormField
                  className="col-span-12 md:col-span-6"
                  etichetta="Email"
                  obbligatorio
                  aiuto="Un indirizzo email valido a cui hai accesso."
                >
                  <FormInput
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
                <FormField
                  className="col-span-12 md:col-span-6"
                  etichetta="Numero di telefono"
                  obbligatorio
                  aiuto="Un numero a cui possiamo contattarti se necessario."
                >
                  <FormInput
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </FormField>
                <div className="col-span-12">
                  <div className="mb-2">Tipo di account</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{user?.tipo}</Badge>
                    {isOutsider && <Badge variant="warning">Account Esterno</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Il tipo di account determina le funzionalità e i privilegi che avrai su questa piattaforma.
                  </p>
                </div>
                <FormField
                  className="col-span-12"
                  etichetta="Indirizzo linea 1"
                  obbligatorio
                  aiuto="Via e numero civico."
                >
                  <FormInput
                    type="text"
                    autoComplete="address-line1"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </FormField>
                <FormField
                  className="col-span-12"
                  etichetta="Indirizzo linea 2"
                  aiuto="Facoltativo: interno, piano o altre indicazioni utili."
                >
                  <FormInput
                    type="text"
                    autoComplete="address-line2"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                  />
                </FormField>
                <FormField className="col-span-12 md:col-span-4" etichetta="Città" obbligatorio>
                  <FormInput
                    type="text"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </FormField>
                <FormField className="col-span-12 md:col-span-4" etichetta="Provincia" obbligatorio>
                  <FormInput
                    type="text"
                    autoComplete="address-level1"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </FormField>
                <FormField className="col-span-12 md:col-span-4" etichetta="CAP" obbligatorio>
                  <FormInput
                    type="text"
                    autoComplete="postal-code"
                    value={cap}
                    onChange={(e) => setZip(e.target.value)}
                  />
                </FormField>
              </div>
              {!isOutsider && (
                <div className={classiPiede}>
                  <Button
                    variant="primary"
                    className="w-full md:w-auto"
                    onClick={handleSave}
                    loading={isSaving}
                  >
                    Salva Modifiche
                  </Button>
                </div>
              )}
            </Sezione>
          )}
          {queryParams.get("page") === "email-profilo-utente" && (
            <Sezione titolo="Impostazioni Email">
              {isOutsider ? (
                <Alert variant="soft-info" icona="Info">
                  L'indirizzo email è gestito dal tuo provider di identità esterno e non può essere modificato qui.
                </Alert>
              ) : (
                <>
                  <div>
                    <div className="text-slate-500">
                      Il tuo indirizzo email attuale è{" "}
                      <span className="font-medium">{email}</span>.
                    </div>
                    <FormField
                      className="mt-5"
                      etichetta="Nuovo indirizzo email"
                      obbligatorio
                      aiuto="Inserisci un indirizzo email valido a cui hai accesso."
                    >
                      <FormInput
                        type="email"
                        autoComplete="email"
                        value={newEmailAddress}
                        onChange={(e) => setNewEmailAddress(e.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className={classiPiede}>
                    <Button
                      variant="primary"
                      className="w-full md:w-auto"
                      onClick={handleEmailChange}
                      loading={isSaving}
                    >
                      Salva Modifiche
                    </Button>
                  </div>
                </>
              )}
            </Sezione>
          )}
          {queryParams.get("page") === "security" && (
            <Sezione titolo="Sicurezza">
              {isOutsider ? (
                <Alert variant="soft-info" icona="Info">
                  Gli utenti con accesso esterno (OIDC) non possono modificare la password tramite questo pannello. Gestisci la tua password dal tuo provider di identità.
                </Alert>
              ) : (
                <>
                  <div className="flex flex-col gap-y-5">
                    <FormField
                      etichetta="Password attuale"
                      obbligatorio
                      aiuto="Serve a verificare la tua identità."
                    >
                      <FormInput
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </FormField>
                    <FormField etichetta="Nuova password" obbligatorio>
                      <FormInput
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </FormField>
                    <FormField
                      etichetta="Conferma nuova password"
                      obbligatorio
                      aiuto="Reinserisci la nuova password appena scelta."
                    >
                      <FormInput
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </FormField>
                    <div className="text-slate-500">
                      <div className="font-medium">Requisiti della password:</div>
                      <ul className="flex flex-col gap-1 pl-3 mt-2.5 list-disc text-slate-500">
                        <li className="pl-0.5">Le password devono essere lunghe almeno 8 caratteri.</li>
                        <li className="pl-0.5">Includere almeno una cifra numerica (0-9).</li>
                      </ul>
                    </div>
                  </div>
                  <div className={classiPiede}>
                    <Button
                      variant="primary"
                      className="w-full md:w-auto"
                      onClick={handlePasswordChange}
                      loading={isSaving}
                    >
                      Salva Modifiche
                    </Button>
                  </div>
                </>
              )}
            </Sezione>
          )}
          {queryParams.get("page") === "preferences" && <SezioneNonDisponibile titolo="Preferenze" />}
          {queryParams.get("page") === "two-factor-authentication" && (
            <SezioneNonDisponibile titolo="Autenticazione a Due Fattori (2FA)" />
          )}
          {queryParams.get("page") === "device-history" && <SezioneNonDisponibile titolo="Cronologia Dispositivi" />}
          {queryParams.get("page") === "notification-profilo-utente" && (
            <Sezione titolo="Impostazioni Notifiche">
              <Alert variant="soft-info" icona="Info">
                Le preferenze di notifica non sono ancora configurabili: al momento Fidelity non invia notifiche personalizzate.
              </Alert>
            </Sezione>
          )}
          {queryParams.get("page") === "connected-services" && <SezioneNonDisponibile titolo="Servizi Connessi" />}
          {queryParams.get("page") === "social-media-links" && <SezioneNonDisponibile titolo="Link Social Media" />}
          {queryParams.get("page") === "account-deactivation" && (
            <Sezione titolo="Disattivazione Account">
              {isOutsider ? (
                <Alert variant="soft-warning" icona="TriangleAlert">
                  Gli account con autenticazione esterna (OIDC) non possono essere disattivati da questo pannello. Contatta l'amministratore del sistema per procedere.
                </Alert>
              ) : (
                <>
                  <div className="leading-relaxed">
                    Disattivando l'account perderai l'accesso a Fidelity e verranno chiuse tutte le tue sessioni aperte. I tuoi dati restano conservati: per riattivare l'account contatta l'amministratore.
                  </div>
                  <FormField className="mt-5" etichetta="Password attuale">
                    <FormInput
                      id="password-disattivazione"
                      type="password"
                      autoComplete="current-password"
                      value={passwordDisattivazione}
                      onChange={(e) => setPasswordDisattivazione(e.target.value)}
                    />
                  </FormField>
                  <FormCheck className="mt-4">
                    <FormCheck.Input
                      id="conferma-disattivazione"
                      type="checkbox"
                      checked={confermaDisattivazione}
                      onChange={(e) => setConfermaDisattivazione(e.target.checked)}
                    />
                    <FormCheck.Label htmlFor="conferma-disattivazione">
                      Confermo di voler disattivare il mio account.
                    </FormCheck.Label>
                  </FormCheck>
                  <div className={classiPiede}>
                    <Button
                      variant="danger"
                      className="w-full md:w-auto"
                      onClick={handleDisattivaAccount}
                      disabled={!confermaDisattivazione || !passwordDisattivazione}
                      loading={disattivazioneInCorso}
                    >
                      Disattiva account
                    </Button>
                  </div>
                </>
              )}
            </Sezione>
          )}
        </div>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(Main);
