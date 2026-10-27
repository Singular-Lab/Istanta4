import Button from '@/components/Base/Button';
import { guidIdDaUrlOlimpo } from '@/utils/olimpo';
import Dropzone, { DropzoneElement } from '@/components/Base/Dropzone';
import { FormCheck, FormField, FormInline, FormInput, FormSelect, FormTextarea } from '@/components/Base/Form';
import Alert from '@/components/Base/Alert';
import Badge from '@/components/Base/Badge';
import EmptyState from '@/components/EmptyState';
import { Slideover, Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useGestioneReferenze } from '@/context/GestioneReferenzeContext';
import { useFetchAree, useFetchCanali } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { DropzoneFile } from 'dropzone';
import parse from 'html-react-parser';
import React, { forwardRef, Fragment, useEffect, useState } from 'react';
import { ServerCall } from '../../../../lib/server_call';
import { ReferenzeIstanta } from '../../../../lib/types';
import { urlFoto } from '@/utils/helper';
import TabContenutiAggiuntivi from './TabContenutiAggiunitivi';




interface ImageDisplayProps {
  url: string;
  altText: string;
  onUploadNuovaFoto: (addedFile: DropzoneFile, referenza: ReferenzeIstanta, url: string) => void;
  onUploadSostituzioneFoto?: (addedFile: DropzoneFile, referenza: ReferenzeIstanta, url: string) => void;
  referenza: ReferenzeIstanta;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ url, altText, onUploadNuovaFoto, onUploadSostituzioneFoto, referenza }) => {
  const [isImageValid, setIsImageValid] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addedFile, setAddedFile] = useState<DropzoneFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleImageError = () => {
    setIsImageValid(false);
  };

  const handleUpload = async (file: DropzoneFile, isReplacement: boolean = false) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 15;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 300);

      // Execute the appropriate upload function
      if (isReplacement && onUploadSostituzioneFoto) {
        await onUploadSostituzioneFoto(file, referenza, url);
      } else {
        await onUploadNuovaFoto(file, referenza, url);
      }

      // Complete the progress bar
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadSuccess(true);

      // Reset the state after showing success
      setTimeout(() => {
        setIsUploading(false);
        setAddedFile(null);
        setUploadSuccess(false);
        setUploadProgress(0);
        // Refresh the image by forcing a re-render
        setIsImageValid(true);
      }, 1500);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError('Si è verificato un errore durante il caricamento. Riprova.');
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    setAddedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
  };

  // Reset success state if URL changes
  useEffect(() => {
    setUploadSuccess(false);
    setIsImageValid(true);
  }, [url]);




  return (
    <div className="relative group w-full">
      <div className="overflow-hidden rounded-card border border-slate-200">
        {isImageValid ? (
          <div className="flex flex-col items-center justify-center bg-slate-50 p-2">
            <div className="relative w-full aspect-w-1 aspect-h-1 flex items-center justify-center">
              <img
                src={uploadSuccess ? `${url}?t=${Date.now()}` : url}
                alt={altText}
                className="object-contain max-h-56 mx-auto rounded-control"
                onError={handleImageError}
              />

              {/* Image overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  variant="primary"
                  size="sm"
                  className="border-white bg-white text-primary hover:bg-primary/5"
                  onClick={() => {
                    const dropzoneEl = document.getElementById(`dropzone-${url.replace(/[^a-zA-Z0-9]/g, '')}`);
                    if (dropzoneEl) {
                      dropzoneEl.click();
                    }
                  }}
                >
                  <Lucide icon="RefreshCw" className="w-4 h-4 mr-1" />
                  Sostituisci
                </Button>
              </div>
            </div>

            {/* Dropzone (hidden until clicked) */}
            <div className={`mt-3 w-full ${addedFile ? 'block' : 'hidden'}`}>
              <Dropzone
                id={`dropzone-${url.replace(/[^a-zA-Z0-9]/g, '')}`}
                className="border-2 border-dashed border-slate-300 rounded-control p-3 text-center"
                options={{
                  addedfile: (file) => {
                    setAddedFile(file);
                    setUploadError(null);
                  },
                  maxFiles: 1,
                  maxFilesize: 2, // 2MB
                  method: "POST",
                  url: '/upload', // Your upload URL
                  acceptedFiles: 'image/jpeg,image/png,image/gif',
                  dictDefaultMessage: 'Trascina qui o clicca per caricare',
                  autoProcessQueue: false,
                  addRemoveLinks: true,
                }}
                getRef={(el: DropzoneElement) => { }}
              >
                {!addedFile ? (
                  <p className="text-slate-600 text-sm">
                    Trascina qui o clicca per caricare una nuova immagine
                  </p>
                ) : null}
              </Dropzone>
            </div>

            {/* Preview and buttons for selected file */}
            {addedFile && (
              <div className="w-full mt-3">
                <div className="bg-slate-100 rounded-control p-3">
                  <div className="flex items-center mb-2">
                    <Lucide icon="FileImage" className="w-5 h-5 text-primary mr-2" />
                    <div className="text-sm text-slate-700 truncate flex-1">
                      {addedFile.name}
                    </div>
                    <span className="text-xs text-slate-500">
                      {(addedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="mt-2">
                    <img
                      src={URL.createObjectURL(addedFile)}
                      alt="Preview"
                      className="w-full h-auto max-h-36 object-contain rounded-control"
                    />
                  </div>

                  {/* Upload progress */}
                  {isUploading && (
                    <div className="mt-3">
                      <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div
                          className="bg-primary h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-center">
                        {uploadProgress < 100
                          ? `Caricamento... ${Math.round(uploadProgress)}%`
                          : 'Caricamento completato!'}
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {uploadError && (
                    <Alert variant="soft-danger" icona="TriangleAlert" className="mt-2 px-3 py-2 text-sm">{uploadError}</Alert>
                  )}

                  {/* Upload success message */}
                  {uploadSuccess && (
                    <Alert variant="soft-success" icona="CircleCheck" className="mt-2 px-3 py-2 text-sm">Immagine caricata con successo!</Alert>
                  )}

                  {/* Action buttons */}
                  {!isUploading && !uploadSuccess && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={cancelUpload}
                      >
                        <Lucide icon="X" className="w-4 h-4 mr-1" />
                        Annulla
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleUpload(addedFile, true)}
                      >
                        <Lucide icon="Upload" className="w-4 h-4 mr-1" />
                        Carica
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 p-4">
            <div className="text-center w-full">
              <div className="text-slate-500 mb-3">
                <Lucide icon="ImageOff" className="w-8 h-8 mx-auto" />
                <p className="font-medium mt-2">Immagine non valida</p>
              </div>

              <Dropzone
                className="border-2 border-dashed border-slate-300 rounded-control p-4 text-center"
                options={{
                  addedfile: (file) => {
                    setAddedFile(file);
                    setUploadError(null);
                  },
                  maxFiles: 1,
                  maxFilesize: 2, // 2MB
                  method: "POST",
                  url: '/upload', // Your upload URL
                  acceptedFiles: 'image/jpeg,image/png,image/gif',
                  dictDefaultMessage: 'Carica una nuova immagine',
                  autoProcessQueue: false,
                  addRemoveLinks: true,
                }}
                getRef={(el: DropzoneElement) => { }}
              >
                {!addedFile ? (
                  <div className={`text-sm ${isUploading ? 'opacity-50' : ''}`}>
                    <p className="text-sm text-slate-600 font-medium">
                      {isUploading ? 'Caricamento in corso...' : 'Trascina qui o clicca per caricare'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Formati supportati: JPG, PNG, GIF
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dimensioni massime: 2MB
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="bg-slate-50 rounded-control p-3">
                      <div className="flex items-center mb-2">
                        <Lucide icon="FileImage" className="w-5 h-5 text-primary mr-2" />
                        <div className="text-sm text-slate-700 truncate flex-1">
                          {addedFile.name}
                        </div>
                        <span className="text-xs text-slate-500">
                          {(addedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      <div className="mt-2">
                        <img
                          src={URL.createObjectURL(addedFile)}
                          alt="Preview"
                          className="w-full h-auto max-h-36 object-contain rounded-control"
                        />
                      </div>

                      {/* Upload progress */}
                      {isUploading && (
                        <div className="mt-3">
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 text-center">
                            {uploadProgress < 100
                              ? `Caricamento... ${Math.round(uploadProgress)}%`
                              : 'Caricamento completato!'}
                          </p>
                        </div>
                      )}

                      {/* Error message */}
                      {uploadError && (
                        <Alert variant="soft-danger" icona="TriangleAlert" className="mt-2 px-3 py-2 text-sm">{uploadError}</Alert>
                      )}

                      {/* Success message */}
                      {uploadSuccess && (
                        <Alert variant="soft-success" icona="CircleCheck" className="mt-2 px-3 py-2 text-sm">Immagine caricata con successo!</Alert>
                      )}

                      {/* Action buttons */}
                      {!isUploading && !uploadSuccess && (
                        <div className="flex gap-2 mt-3 justify-end">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={cancelUpload}
                          >
                            <Lucide icon="X" className="w-4 h-4 mr-1" />
                            Annulla
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleUpload(addedFile)}
                          >
                            <Lucide icon="Upload" className="w-4 h-4 mr-1" />
                            Carica
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Dropzone>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Standalone image uploader for the "Foto Gruppo" section
export const ImageUploader: React.FC<{
  onFileSelected: (file: DropzoneFile) => void;
  onUpload: () => void;
  onCancel: () => void;
  file: DropzoneFile | null;
  isUploading?: boolean;
}> = ({ onFileSelected, onUpload, onCancel, file, isUploading = false }) => {
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isUploading) {
      interval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 15;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 300);
    } else {
      setUploadProgress(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isUploading]);

  return (
    <div className="mt-4">
      <Dropzone
        className="border-2 border-dashed border-slate-300 rounded-control p-4 text-center"
        options={{
          addedfile: (file) => {
            onFileSelected(file);
          },
          maxFiles: 1,
          maxFilesize: 2, // 2MB
          method: "POST",
          url: '/upload', // Your upload URL
          acceptedFiles: 'image/jpeg,image/png,image/gif',
          dictDefaultMessage: 'Carica una nuova immagine',
          autoProcessQueue: false,
          addRemoveLinks: true,
        }}
        getRef={(el: DropzoneElement) => { }}
      >
        {!file ? (
          <div className={`text-sm ${isUploading ? 'opacity-50' : ''}`}>
            <p className="text-sm text-slate-600 font-medium">
              {isUploading ? 'Caricamento in corso...' : 'Trascina qui o clicca per caricare'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Formati supportati: JPG, PNG, GIF
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Dimensioni massime: 2MB
            </p>
          </div>
        ) : null}
      </Dropzone>

      {file && (
        <div className="mt-3 bg-slate-50 rounded-control p-3">
          <div className="flex items-center mb-2">
            <Lucide icon="FileImage" className="w-5 h-5 text-primary mr-2" />
            <div className="text-sm text-slate-700 truncate flex-1">
              {file.name}
            </div>
            <span className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>

          <div className="mt-2">
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="w-full h-auto max-h-36 object-contain rounded-control"
            />
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="mt-3">
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-1 text-center">
                {uploadProgress < 100
                  ? `Caricamento... ${Math.round(uploadProgress)}%`
                  : 'Caricamento completato!'}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!isUploading && (
            <div className="flex gap-2 mt-3 justify-end">
              <Button
                variant="outline-danger"
                size="sm"
                onClick={onCancel}
              >
                <Lucide icon="X" className="w-4 h-4 mr-1" />
                Annulla
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={onUpload}
              >
                <Lucide icon="Upload" className="w-4 h-4 mr-1" />
                Carica
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// Types and Interfaces
interface GestioneReferenzeHandle extends React.RefAttributes<HTMLDivElement> {
  toggleVisibility: () => void;
}

interface EditDataFieldsProps {
  dataFields: Record<string, any>;
  referenzaId: string | number;
  onSave: (updatedFields: Record<string, any>) => void;
  onCancel: () => void;
}

// EditDataFields Component
const EditDataFields: React.FC<EditDataFieldsProps> = ({
  dataFields,
  referenzaId,
  onSave,
  onCancel,
}) => {
  try {
    const [fields, setFields] = useState<Record<string, any>>(dataFields);

    const handleChange = (key: string, value: any) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    };


    return (
      <div>
        {Object.entries(fields).map(([key, value]) => (
          <div key={key} className="mb-2">
            <label htmlFor={`campo-dati-${key}`} className="block text-sm font-medium text-slate-700">{key}</label>
            {typeof value === 'object' && value !== null ? (
              <FormTextarea
                id={`campo-dati-${key}`}
                value={JSON.stringify(value, null, 2)}
                onChange={(e) => handleChange(key, JSON.parse(e.target.value))}
                className="mt-1"
              />
            ) : (
              <FormInput
                id={`campo-dati-${key}`}
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="mt-1"
              />
            )}
          </div>
        ))}
      </div>
    );
  } catch (error) {
    console.error('Error in EditDataFields:', error);
  }

};

// Main GestioneReferenze Component
const GestioneReferenze = forwardRef<GestioneReferenzeHandle, {}>((props, ref) => {
  // State definitions
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [isEditingDataFields, setIsEditingDataFields] = useState(false);
  // Refs
  const imageRefNoValid = React.useRef<boolean>(false);

  // Context
  const { referenza, setReferenza, kit } = useGestioneReferenze();
  const [forzaturaFotoSingolaReferenza, setForzaturaFotoSingolaReferenza] = useState(false);
  const aree = useFetchAree();
  const canali = useFetchCanali();

  useEffect(() => {
    if (referenza) {
      setIsVisible(true);
    }
  }, [referenza]);


  useEffect(() => {
    if (referenza) {
      setForzaturaFotoSingolaReferenza(referenza?.fotoSingolaForzata ?? false);
    }
  }, [referenza]);


  const mutationForzatura = useMutation({
    mutationFn: async (data: ReferenzeIstanta) => {
      delete data.visibile;
      const response = await ServerCall.put<
        { esito: boolean, error: string, content: ReferenzeIstanta | undefined }
      >('/updateReferenzaWebpliant', data);
      return response;
    },
    onSuccess: (data) => {
    },
    onError: (error) => {
      console.error('Errore durante l\'aggiornamento della forzatura foto singola:', error);
    },
  });

  // Effects
  // Handlers
  const handleDataFieldsSave = (updatedFields: Record<string, any>) => {
    if (referenza?.id) {
      setReferenza({
        ...referenza,
        dataFields: updatedFields,
        // contextTracciato: referenza.contextTracciato,
        // contextPromo: referenza.contextPromo || null
      });
    } else {
      console.error('Referenza ID is undefined');
    }
    setIsEditingDataFields(false);
  };

  const handleDataFieldsCancel = () => {
    setIsEditingDataFields(false);
  };
  const handleImmagineReferenzaMancante = async (acceptedFiles: DropzoneFile, ref: ReferenzeIstanta, url: string) => {
    if (acceptedFiles) {
      const file = acceptedFiles;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const guidId = guidIdDaUrlOlimpo(url);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('guidId', guidId ?? "");
      formData.append("guidIdReferenza", ref?.id);
      const urlAPI = ServerCall.getUrl();
      const uploadedFile = await axios.post(`${urlAPI}/updateImmagineReferenza`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (uploadedFile.status === 200) {
      }
    }
  };



  const handleImmagineGruppoReferenza = async (acceptedFiles: DropzoneFile, ref: ReferenzeIstanta) => {
    if (acceptedFiles) {
      const file = acceptedFiles;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('guidId', ref.id);
      formData.append("idArea", selectAreaPerFotoGruppo);
      formData.append("idCanale", selectCanalePerFotoGruppo);
      const urlAPI = ServerCall.getUrl();
      const uploadedFile = await axios.post(`${urlAPI}/updateImmagineGruppoReferenza`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (uploadedFile.status === 200) {
      }
    }
  }

  // Tab panel rendering helpers
  const renderGeneralTab = () => (
    <div>
      <h3 className="title-card">Informazioni generali</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-slate-500">ID</dt>
          <dd className="mt-1 text-sm text-slate-900">{referenza?.id}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-slate-500">Visibile</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {referenza?.visibile !== undefined ? referenza?.visibile.toString() : 'N/A'}
          </dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-slate-500">Kit runtime</dt>
          <dd className="mt-1 text-sm text-slate-900">{kit?.titolo}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-slate-500">Meccanica</dt>
          <dd className="mt-1 text-sm text-slate-900">{referenza?.meccanica}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-slate-500">Codice Box</dt>
          <dd className="mt-1 text-sm text-slate-900">{referenza?.codiceBox}</dd>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="title-card">Campi eliminati</h3>
        <div className="mt-2">
          {(referenza?.deletedFields ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referenza?.deletedFields.map((field, index) => (
                <Badge key={index} variant="secondary">
                  {field}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nessun campo eliminato</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderFieldsTab = () => (
    <div>
      <h3 className="title-card">Campi compilati</h3>
      <div className="mt-2">
        {(referenza?.compiledFields ?? []).length > 0 ? (
          <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-200">
              {referenza?.compiledFields.map((field, index) => (
                <li key={index} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary truncate">
                      {field.label_name}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <Badge variant="info" size="sm">
                        {field.paragraph_name || 'Nessun paragrafo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div
                      className="mt-2 flex items-center text-sm text-slate-500 sm:mt-0"
                    >
                      {(() => {
                        if (typeof field.content === 'string') {
                          return parse(field.content);
                        } else if (typeof field.content === 'object') {
                          return JSON.stringify(field.content);
                        }
                        return field.content;
                      })()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nessun campo compilato</p>
        )}
      </div>

      <div className="mt-8">
        <h3 className="title-card">Campi dati</h3>
        <div className="mt-2">
          {isEditingDataFields ? (
            <EditDataFields
              dataFields={referenza?.dataFields || {}}
              referenzaId={referenza?.id ?? ''}
              onSave={handleDataFieldsSave}
              onCancel={handleDataFieldsCancel}
            />
          ) : (
            <>
              {Object.keys(referenza?.dataFields || {}).length > 0 ? (
                <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-200">
                    {Object.entries(referenza?.dataFields || {}).map(([key, value], index) => (
                      <li key={index} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-primary truncate">{key}</p>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="mt-2 flex items-center text-sm text-slate-500 sm:mt-0">
                            <p>{(() => {
                              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                return value.toString();
                              } else if (Array.isArray(value)) {
                                const formattedContent: React.ReactElement[] = [];
                                value.forEach((item, idx) => {
                                  formattedContent.push(
                                    <span key={idx} className="block">
                                      {typeof item === 'object' && item !== null
                                        ? Object.entries(item).map(([key, val]) => (
                                          <Fragment key={key}>
                                            <span>
                                              <strong>{key}:</strong> {(val as any).toString()}
                                            </span>
                                            <br />
                                          </Fragment>
                                        ))
                                        : item}
                                    </span>
                                  );
                                });
                                return formattedContent;
                              } else if (typeof value === 'object') {
                                return Object.entries(value).map(([key, val], idx) => (
                                  <span key={idx} className="block">
                                    <strong>{key}:</strong> {typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? val.toString() : 'N/A'}
                                  </span>
                                ));
                              }
                              return 'N/A';
                            })()}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nessun campo dati disponibile</p>
              )}
              <div className="mt-4">
                <Button type="button" variant="outline-secondary" size="sm" onClick={() => setIsEditingDataFields(true)}>
                  <Lucide icon="Pencil" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Modifica campi dati
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderImagesTab = () => {


    const handleUploadGruppo = async () => {
      if (fileGruppo && referenza) {
        try {
          setIsUploadingGruppo(true);
          await handleImmagineGruppoReferenza(fileGruppo, referenza);
          // Refresh the referenza data after successful upload
          // This should be handled by your app's state management
          setIsUploadingGruppo(false);
          setFileGruppo(null);
        } catch (error) {
          console.error('Error uploading group image:', error);
          setIsUploadingGruppo(false);
        }
      }
    };

    const handleUploadLogo = async () => {
      if (fileLogo && referenza) {
        try {
          setIsUploadingLogo(true);
          // You would need to implement a function similar to handleImmagineGruppoReferenza
          // that handles logo uploads

          // Example implementation:
          // await handleImmagineLogoReferenza(fileLogo, referenza, selectedLogoTipo, selectedLogoSigla);

          setIsUploadingLogo(false);
          setFileLogo(null);
          setSelectedLogoTipo('bollo');
          setSelectedLogoSigla('');
        } catch (error) {
          console.error('Error uploading logo:', error);
          setIsUploadingLogo(false);
        }
      }
    };

    return (
      <div>
        {/* Foto Referenza Section */}
        <div className="mb-8">
          <h3 className="title-card">Foto referenza</h3>
          <div className="mt-4">
            {(referenza?.foto ?? []).length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {referenza && urlFoto(referenza.foto).map((url, index) => (
                    <ImageDisplay
                      key={`image-${index}`}
                      url={url}
                      altText={`Referenza-${referenza?.dataFields?.codice_referenza || index}`}
                      referenza={referenza}
                      onUploadNuovaFoto={(file, ref, url) => {
                        handleImmagineReferenzaMancante(file, ref, url);
                      }}
                      onUploadSostituzioneFoto={(file, ref, url) => {
                        handleImmagineReferenzaMancante(file, ref, url);
                      }}
                    />
                  ))}
                </div>
                <FormCheck>
                  <FormCheck.Input
                    type="checkbox"
                    id="fotoReferenzaMancante"
                    checked={forzaturaFotoSingolaReferenza}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (referenza) {
                        mutationForzatura.mutate({
                          ...referenza,
                          fotoSingolaForzata: e.target.checked,
                        });
                        setForzaturaFotoSingolaReferenza(e.target.checked);
                      }
                    }}
                  />
                  <FormCheck.Label htmlFor="fotoReferenzaMancante">
                    Forza la foto singola
                  </FormCheck.Label>
                </FormCheck>
              </>
            ) : (
              <EmptyState
                compatta
                icon="ImageOff"
                title="Nessuna immagine"
                description="Aggiungi immagini alla referenza."
                className="border border-slate-200"
              />
            )}
          </div>
        </div>

        {/* Loghi e bolli Section */}
        <div className="mb-8">
          <h3 className="title-card">Loghi e bolli</h3>
          <div className="mt-4">
            {(referenza?.fotoExtra ?? []).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {referenza?.fotoExtra.map((logo, index) => (
                  <div key={`logo-${index}`} className="rounded-card border border-slate-200 bg-white p-4 flex flex-col items-center">
                    <div className="text-center mb-2">
                      <Badge variant="success" size="sm">
                        {logo.tipo}
                      </Badge>
                      <h4 className="title-card mt-1">{logo.sigla}</h4>
                    </div>
                    <div className="w-full relative overflow-hidden rounded-control">
                      <ImageDisplay
                        referenza={referenza}
                        url={logo.guidId}
                        altText={`Logo-${logo.sigla}`}
                        onUploadNuovaFoto={(file, ref, url) => {
                          handleImmagineReferenzaMancante(file, ref, url);
                        }}
                        onUploadSostituzioneFoto={(file, ref, url) => {
                          handleImmagineReferenzaMancante(file, ref, url);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compatta
                icon="Stamp"
                title="Nessun logo e/o bollo"
                description=""
                className="border border-slate-200"
              />
            )}

            {/* Form to add a new logo */}
            <div className="mt-6 rounded-card border border-slate-200 bg-slate-50 p-4">
              <h4 className="title-card">Aggiungi nuovo logo/bollo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <FormField etichetta="Tipo">
                    <FormSelect
                      value={selectedLogoTipo}
                      onChange={(e) => setSelectedLogoTipo(e.target.value)}
                    >
                      <option value="bollo">Bollo</option>
                      <option value="logo">Logo</option>
                    </FormSelect>
                  </FormField>
                </div>
                <div>
                  <FormField etichetta="Sigla">
                    <FormInput
                      type="text"
                      value={selectedLogoSigla}
                      onChange={(e) => setSelectedLogoSigla(e.target.value)}
                      placeholder="Inserisci sigla"
                    />
                  </FormField>
                </div>
              </div>

              <ImageUploader
                onFileSelected={(file) => setFileLogo(file)}
                onUpload={handleUploadLogo}
                onCancel={() => setFileLogo(null)}
                file={fileLogo}
                isUploading={isUploadingLogo}
              />
            </div>
          </div>
        </div>

        {/* Foto Gruppo Section */}
        <div className="mb-8">
          <h3 className="title-card">Foto gruppo</h3>
          <div className="mt-4">
            {referenza?.fotoGruppo ? (
              <div className="rounded-card border border-slate-200 bg-white p-4">
                <ImageDisplay
                  url={referenza.fotoGruppo}
                  altText="Foto Gruppo"
                  referenza={referenza}
                  onUploadNuovaFoto={(file, ref) => {
                    handleImmagineGruppoReferenza(file, ref);
                  }}
                  onUploadSostituzioneFoto={(file, ref) => {
                    handleImmagineGruppoReferenza(file, ref);
                  }}
                />
                <FormInline className='m-4 gap-4'>
                  <FormSelect
                    className="mt-4"
                    value={selectCanalePerFotoGruppo}
                    onChange={(e) => setSelectCanalePerFotoGruppo(e.target.value)}
                  >
                    <option value={""}>Scegli un canale</option>
                    {(canali && canali.data) && canali?.data.map((canale) => (
                      <option key={canale.id} value={canale.id}>
                        {canale.nome}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    value={selectAreaPerFotoGruppo}
                    onChange={(e) => setSelectAreaPerFotoGruppo(e.target.value)}
                    className="mt-4"
                  >
                    <option value={""}>Scegli un'area</option>
                    {(aree && aree.data) && aree?.data.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nome}
                      </option>
                    ))}
                  </FormSelect>

                </FormInline>
              </div>
            ) : (
              <div className="rounded-card border border-slate-200 bg-white p-4 text-center">
                <EmptyState
                  compatta
                  icon="ImageOff"
                  title="Nessuna foto gruppo"
                  description="Aggiungi una foto gruppo alla referenza."
                />

                <ImageUploader
                  onFileSelected={(file) => setFileGruppo(file)}
                  onUpload={handleUploadGruppo}
                  onCancel={() => setFileGruppo(null)}
                  file={fileGruppo}
                  isUploading={isUploadingGruppo}
                />
                <FormInline className='m-4 gap-4'>
                  <FormSelect
                    className="mt-4"
                    value={selectCanalePerFotoGruppo}
                    onChange={(e) => setSelectCanalePerFotoGruppo(e.target.value)}
                  >
                    <option value={""}>Scegli un canale</option>
                    {(canali && canali.data) && canali?.data.map((canale) => (
                      <option key={canale.id} value={canale.id}>
                        {canale.nome}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    value={selectAreaPerFotoGruppo}
                    onChange={(e) => setSelectAreaPerFotoGruppo(e.target.value)}
                    className="mt-4"
                  >
                    <option value={""}>Scegli un'area</option>
                    {(aree && aree.data) && aree?.data.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nome}
                      </option>
                    ))}
                  </FormSelect>

                </FormInline>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const renderContextTab = () => (
    <div>
      <h3 className="title-card">Informazioni di contesto</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-slate-500">Contesto tracciato</dt>
          <dd className="mt-1 text-sm text-slate-900 bg-slate-50 p-4 rounded-control overflow-auto">
            <pre>
              {Array.isArray(referenza?.dataFields.context_promo)
                ? referenza?.dataFields.context_promo.map((item, index) => (
                  <div key={index}>
                    {typeof item === 'string' ? (
                      <strong>{item}</strong>
                    ) : item && typeof item === 'object' && 'nome_field' in item ? (
                      <>
                        <strong>{(item as { nome_field: string; user_value: string }).nome_field}:</strong> {(item as { nome_field: string; user_value: string }).user_value}
                      </>
                    ) : (
                      JSON.stringify(item)
                    )}
                  </div>
                ))
                : JSON.stringify(referenza?.dataFields.context_promo, null, 2)}
            </pre>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-slate-500">Contesto promo</dt>
          <dd className="mt-1 text-sm text-slate-900 bg-slate-50 p-4 rounded-control overflow-auto">
            <pre>{Array.isArray(referenza?.dataFields.context_promo)
              ? referenza?.dataFields.context_promo.map((item, index) => (
                <div key={index}>
                  {typeof item === 'string' ? (
                    <strong>{item}</strong>
                  ) : (
                    <>
                      <strong>{(item as { nome_field: string; user_value: string }).nome_field}:</strong> {(item as { nome_field: string; user_value: string }).user_value}
                    </>
                  )}
                </div>
              ))
              : JSON.stringify(referenza?.dataFields.context_promo, null, 2)}</pre>
          </dd>
        </div>
      </div>
    </div>
  );
  const [fileGruppo, setFileGruppo] = useState<DropzoneFile | null>(null);
  const [isUploadingGruppo, setIsUploadingGruppo] = useState(false);
  const [fileLogo, setFileLogo] = useState<DropzoneFile | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedLogoTipo, setSelectedLogoTipo] = useState<string>('bollo');
  const [selectAreaPerFotoGruppo, setSelectAreaPerFotoGruppo] = useState<string>('');
  const [selectCanalePerFotoGruppo, setSelectCanalePerFotoGruppo] = useState<string>('');
  const [selectedLogoSigla, setSelectedLogoSigla] = useState<string>('');
  // Render main component


  useEffect(() => {
    if (isVisible) {
      setSelectAreaPerFotoGruppo("");
      setSelectCanalePerFotoGruppo("");
    }
  }, [isVisible]);


  return (
    isVisible && (
      <Slideover size='xl' open={isVisible} onClose={() => { setIsVisible(false); setReferenza(undefined) }} className="">
        <Slideover.Panel>
          <Slideover.Title>
            <h2 className="title-section">Dettaglio referenza</h2>
          </Slideover.Title>
          <Slideover.Description>
            <Tab.Group className={"flex flex-col gap-y-7 justify-start"}>
              <Tab.List className="flex flex-wrap" variant="boxed-tabs">
                <Tab>
                  <Tab.Button onClick={() => setActiveTab('general')}>
                    Generale
                  </Tab.Button>
                </Tab>
                <Tab>
                  <Tab.Button onClick={() => setActiveTab('fields')}>
                    Campi
                  </Tab.Button>
                </Tab>
                <Tab>
                  <Tab.Button onClick={() => setActiveTab('images')}>
                    Immagini
                  </Tab.Button>
                </Tab>
                <Tab>
                  <Tab.Button onClick={() => setActiveTab('context')}>
                    Contesto
                  </Tab.Button>
                </Tab>
                <Tab>
                  <Tab.Button onClick={() => setActiveTab('contenuti_aggiuntivi')}>
                    Contenuti Aggiuntivi
                  </Tab.Button>
                </Tab>
              </Tab.List>
              <Tab.Panels>
                <Tab.Panel className="leading-relaxed">
                  {renderGeneralTab()}
                </Tab.Panel>

                <Tab.Panel className="leading-relaxed">
                  {renderFieldsTab()}
                </Tab.Panel>

                <Tab.Panel className="leading-relaxed">
                  {renderImagesTab()}
                </Tab.Panel>

                <Tab.Panel className="leading-relaxed">
                  {renderContextTab()}
                </Tab.Panel>

                <Tab.Panel className="leading-relaxed">
                  <TabContenutiAggiuntivi referenza={referenza} />
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </Slideover.Description>
        </Slideover.Panel>
      </Slideover>
    )
  );
});

export default GestioneReferenze;
