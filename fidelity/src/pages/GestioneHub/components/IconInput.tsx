import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { useState } from "react";
import { isDataUriIcon, readFileAsDataUri } from "../utils";

interface IconInputProps {
  label: string;
  value: string;
  name?: string;
  helperText?: string;
  /** false: niente riquadro di anteprima, quando la pagina ne mostra gia' uno suo. */
  mostraAnteprima?: boolean;
  onChange: (value: string) => void;
}

const IconInput = ({ label, value, name, helperText, mostraAnteprima = true, onChange }: IconInputProps) => {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasImage = isDataUriIcon(value);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      const dataUri = await readFileAsDataUri(file);
      onChange(dataUri);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Impossibile caricare l'immagine.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <FormLabel htmlFor={name}>{label}</FormLabel>
        <FormInput
          id={name}
          name={name}
          value={hasImage ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nome icona Lucide, ad esempio Box"
          className="mt-2"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <FormInput type="file" accept="image/*" onChange={handleFileChange} className="max-w-xs" />
          {hasImage && (
            <Button variant="outline-secondary" size="sm" onClick={() => onChange("Box")}>
              Ripristina icona Lucide
            </Button>
          )}
        </div>
        {(helperText || uploadError) && (
          <p className={`mt-2 text-xs ${uploadError ? "text-danger" : "text-slate-500"}`}>
            {uploadError || helperText}
          </p>
        )}
      </div>

      {mostraAnteprima && (
        <div className="rounded-card border border-dashed border-slate-200 bg-slate-50 p-4">
          <div className="title-eyebrow">Preview</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white">
              {hasImage ? (
                <img src={value} alt="" className="w-full h-full object-contain" />
              ) : (
                <Lucide icon={value || "Box"} className="w-6 h-6 text-slate-700" />
              )}
            </div>
            <div className="text-sm text-slate-600">
              {hasImage ? "Immagine caricata" : value || "Nessuna icona selezionata"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IconInput;
