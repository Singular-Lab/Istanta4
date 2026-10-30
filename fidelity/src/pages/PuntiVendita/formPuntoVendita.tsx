import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { useFetchAllCombinazioneForGDO } from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import _ from "lodash";
import { useMemo } from "react";
import { useForm, type DefaultValues, type Resolver } from "react-hook-form";
import * as yup from "yup";
import type { PuntoVenditaResponseDTO } from "../../../server/core/dto";

/**
 * Form dell'anagrafica del punto vendita, lo stesso nel modale "Nuovo punto vendita" e
 * "Modifica" dell'elenco e nella scheda Anagrafica della gestione: stessi campi, stessa
 * validazione, stesso salvataggio (/ACPV/salvaPV e /ACPV/modificaPV, che scrivono prima su
 * Istanta e poi in Fidelity).
 */

export const schemaPuntoVendita = yup.object().shape({
  nome: yup.string().required("Il nome è obbligatorio"),
  indirizzo: yup.string().required("L'indirizzo è obbligatorio"),
  canaleArea: yup.string().required("Il canale/area è obbligatorio"),
  citta: yup.string().required("La città è obbligatoria"),
  cap: yup
    .string()
    .required("Il cap è obbligatorio")
    .matches(/^[0-9]{5}$/, "Il CAP deve essere di 5 cifre"),
  // Facoltativi come nel modello: un PV importato spesso non ha coordinate o telefono
  lat: yup
    .number()
    .transform((valore, originale) => (originale === "" || originale === null ? undefined : valore))
    .typeError("La latitudine deve essere un numero")
    .optional(),
  lon: yup
    .number()
    .transform((valore, originale) => (originale === "" || originale === null ? undefined : valore))
    .typeError("La longitudine deve essere un numero")
    .optional(),
  ragioneSociale: yup.string(),
  provincia: yup.string(),
  regione: yup.string(),
  telefono: yup.string(),
});

export type DatiFormPuntoVendita = yup.InferType<typeof schemaPuntoVendita>;

const resolverPuntoVendita = yupResolver(schemaPuntoVendita);
type ResolverPuntoVendita = typeof resolverPuntoVendita;

/** I campi del form come li vede react-hook-form, prima della validazione. */
export type CampiFormPuntoVendita = Parameters<ResolverPuntoVendita>[0];

/** I valori validati che arrivano a handleSubmit. */
type UscitaFormPuntoVendita = ResolverPuntoVendita extends Resolver<CampiFormPuntoVendita, unknown, infer Uscita>
  ? Uscita
  : DatiFormPuntoVendita;

/**
 * Il form con lo schema dell'anagrafica, eventualmente già riempito. I tipi sono quelli dello
 * schema: dedotti dai valori iniziali diventerebbero tutti facoltativi.
 */
export const useFormPuntoVendita = (valoriIniziali?: DefaultValues<CampiFormPuntoVendita>) =>
  useForm<CampiFormPuntoVendita, unknown, UscitaFormPuntoVendita>({ resolver: resolverPuntoVendita, defaultValues: valoriIniziali });

export type FormPuntoVendita = ReturnType<typeof useFormPuntoVendita>;

/** Risposta di salvaPV e modificaPV. */
export interface RispostaSalvataggioPuntoVendita {
  esito: boolean;
  error: string;
  message?: string;
  isUpdate?: boolean;
  data?: PuntoVenditaResponseDTO;
}

/** Coordinata del form: vuota resta assente (null), non diventa 0. */
export const coordinataDaForm = (valore: unknown) => {
  const numero = typeof valore === "number" ? valore : parseFloat(String(valore ?? ""));
  return Number.isFinite(numero) ? numero : null;
};

/** Il corpo di salvaPV/modificaPV: con guidID vuoto il server crea, altrimenti modifica quel PV. */
export const corpoSalvataggio = (dati: DatiFormPuntoVendita, guidID: string) => ({
  ...dati,
  guidID,
  guidIDCombinazione: dati.canaleArea,
  lat: coordinataDaForm(dati.lat),
  lon: coordinataDaForm(dati.lon),
});

/** Valori del form per un punto vendita nuovo, con la prima combinazione disponibile. */
export const valoriNuovoPuntoVendita = (idCombinazione = "") => ({
  nome: "",
  citta: "",
  indirizzo: "",
  cap: "",
  lat: undefined,
  lon: undefined,
  provincia: "",
  regione: "",
  telefono: "",
  ragioneSociale: "",
  canaleArea: idCombinazione,
});

/** Combinazioni canale-area della GDO per nome, raggruppate per canale nella tendina. */
export const useCombinazioniPerCanale = () => {
  const combinazioni = useFetchAllCombinazioneForGDO();
  const perCanale = useMemo(
    () =>
      Object.entries(
        _.groupBy(
          _.sortBy(combinazioni.data ?? [], ["nome_canale", "nome_area"]),
          c => c.nome_canale ?? c.sigla_combinazione
        )
      ),
    [combinazioni.data]
  );
  return { combinazioni, perCanale };
};

type CombinazioniPerCanale = ReturnType<typeof useCombinazioniPerCanale>["perCanale"];

/** "Spazio · Emilia": insegna e area per nome, come nell'elenco; la sigla solo se mancano i nomi. */
export const etichettaCombinazione = (c: { nome_canale?: string | null; nome_area?: string | null; sigla_combinazione?: string | null }) =>
  [c.nome_canale, c.nome_area].filter(Boolean).join(" · ") || c.sigla_combinazione || "";

function Errore({ messaggio }: { messaggio?: string }) {
  return messaggio ? <p className="mt-1 text-xs text-danger">{messaggio}</p> : null;
}

interface CampiPuntoVenditaProps {
  form: FormPuntoVendita;
  combinazioniPerCanale: CombinazioniPerCanale;
  /** Latitudine e longitudine nei campi; la gestione le mostra accanto alla mappa, con "Correggi". */
  conCoordinate?: boolean;
  disabled?: boolean;
}

/** I campi dell'anagrafica in una griglia: nome e recapiti, indirizzo, canale e area. */
export function CampiPuntoVendita({ form, combinazioniPerCanale, conCoordinate = true, disabled = false }: CampiPuntoVenditaProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const campo = (
    nome: "nome" | "telefono" | "ragioneSociale" | "indirizzo" | "cap" | "citta" | "provincia" | "regione",
    etichetta: string,
    classe: string,
    extra: { maxLength?: number } = {}
  ) => (
    <div className={classe}>
      <FormLabel htmlFor={nome}>{etichetta}</FormLabel>
      <FormInput
        id={nome}
        {...extra}
        {...register(nome)}
        disabled={disabled}
        aria-invalid={errors[nome] ? true : undefined}
        className={errors[nome] ? "border-danger" : ""}
      />
      <Errore messaggio={errors[nome]?.message} />
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-4 gap-y-3">
      {campo("nome", "Nome", "col-span-12 sm:col-span-8")}
      {campo("telefono", "Telefono", "col-span-12 sm:col-span-4")}
      {campo("ragioneSociale", "Ragione sociale", "col-span-12")}
      {campo("indirizzo", "Indirizzo", "col-span-12 sm:col-span-8")}
      {campo("cap", "Cap", "col-span-12 sm:col-span-4", { maxLength: 5 })}
      {campo("citta", "Città", "col-span-12 sm:col-span-4")}
      {campo("provincia", "Provincia", "col-span-6 sm:col-span-4")}
      {campo("regione", "Regione", "col-span-6 sm:col-span-4")}
      <div className="col-span-12">
        <FormLabel htmlFor="canaleArea">Canale e area</FormLabel>
        <FormSelect
          id="canaleArea"
          value={watch("canaleArea") ?? ""}
          onChange={e => setValue("canaleArea", e.target.value, { shouldDirty: true, shouldValidate: Boolean(errors.canaleArea) })}
          disabled={disabled}
          aria-invalid={errors.canaleArea ? true : undefined}
          className={errors.canaleArea ? "border-danger" : ""}
        >
          <option value="">Seleziona</option>
          {combinazioniPerCanale.map(([canale, combinazioni]) => (
            <optgroup key={canale} label={canale}>
              {combinazioni.map(c => (
                <option key={c.id} value={c.id}>
                  {etichettaCombinazione(c)}
                </option>
              ))}
            </optgroup>
          ))}
        </FormSelect>
        <Errore messaggio={errors.canaleArea?.message} />
      </div>
      {conCoordinate && <CampiCoordinate form={form} disabled={disabled} className="col-span-12 sm:col-span-6" />}
    </div>
  );
}

/** Latitudine e longitudine: vuote restano senza coordinate, il punto vendita non va sulla mappa. */
export function CampiCoordinate({ form, disabled = false, className }: { form: FormPuntoVendita; disabled?: boolean; className?: string }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <>
      {(["lat", "lon"] as const).map(nome => (
        <div key={nome} className={className}>
          <FormLabel htmlFor={nome}>{nome === "lat" ? "Latitudine" : "Longitudine"}</FormLabel>
          <FormInput
            id={nome}
            type="number"
            step="0.000000000001"
            {...register(nome)}
            disabled={disabled}
            aria-invalid={errors[nome] ? true : undefined}
            className={errors[nome] ? "border-danger" : ""}
          />
          <Errore messaggio={errors[nome]?.message} />
        </div>
      ))}
    </>
  );
}
