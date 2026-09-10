import Button from '@/components/Base/Button';
import Dropzone, { DropzoneElement } from '@/components/Base/Dropzone';
import { FormCheck, FormInline, FormSelect } from '@/components/Base/Form';
import { Slideover, Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useGestioneReferenze } from '@/context/GestioneReferenzeContext';
import { useFetchAree, useFetchCanali } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import parse from 'html-react-parser';
import React, { forwardRef, Fragment, useEffect, useState } from 'react';
import { Colorize } from '../../../../lib/Colorize';
import { ServerCall } from '../../../../lib/server_call';
import { ReferenzeIstanta } from '../../../../lib/types';
import TabContenutiAggiuntivi from './TabContenutiAggiunitivi';




interface ImageDisplayProps {
  url: string;
  altText: string;
  onUploadNuovaFoto: (addedFile: Dropzone.DropzoneFile, referenza: ReferenzeIstanta, url: string) => void;
  onUploadSostituzioneFoto?: (addedFile: Dropzone.DropzoneFile, referenza: ReferenzeIstanta, url: string) => void;
  referenza: ReferenzeIstanta;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ url, altText, onUploadNuovaFoto, onUploadSostituzioneFoto, referenza }) => {
  const [isImageValid, setIsImageValid] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addedFile, setAddedFile] = useState<Dropzone.DropzoneFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleImageError = () => {
    setIsImageValid(false);
  };

  const handleUpload = async (file: Dropzone.DropzoneFile, isReplacement: boolean = false) => {
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
      <div className="overflow-hidden rounded-lg border border-gray-200">
        {isImageValid ? (
          <div className="flex flex-col items-center justify-center bg-gray-50 p-2">
            <div className="relative w-full aspect-w-1 aspect-h-1 flex items-center justify-center">
              <img
                src={uploadSuccess ? `${url}?t=${Date.now()}` : url}
                alt={altText}
                className="object-contain max-h-56 mx-auto rounded-md"
                onError={handleImageError}
              />

              {/* Image overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-blue-50"
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
                className="border-2 border-dashed border-gray-300 rounded-md p-3 text-center"
                options={{
                  addedfile: (file) => {
                    console.log("File added", file);
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
                  <p className="text-gray-600 text-sm">
                    Trascina qui o clicca per caricare una nuova immagine
                  </p>
                ) : null}
              </Dropzone>
            </div>

            {/* Preview and buttons for selected file */}
            {addedFile && (
              <div className="w-full mt-3">
                <div className="bg-gray-100 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <Lucide icon="FileImage" className="w-5 h-5 text-blue-500 mr-2" />
                    <div className="text-sm text-gray-700 truncate flex-1">
                      {addedFile.name}
                    </div>
                    <span className="text-xs text-gray-500">
                      {(addedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="mt-2">
                    <img
                      src={URL.createObjectURL(addedFile)}
                      alt="Preview"
                      className="w-full h-auto max-h-36 object-contain rounded-md"
                    />
                  </div>

                  {/* Upload progress */}
                  {isUploading && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {uploadProgress < 100
                          ? `Caricamento... ${Math.round(uploadProgress)}%`
                          : 'Caricamento completato!'}
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {uploadError && (
                    <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
                      <Lucide icon="TriangleAlert" className="w-4 h-4 inline mr-1" />
                      {uploadError}
                    </div>
                  )}

                  {/* Upload success message */}
                  {uploadSuccess && (
                    <div className="mt-2 p-2 bg-green-50 text-green-600 text-sm rounded flex items-center">
                      <Lucide icon="CircleCheck" className="w-4 h-4 mr-1" />
                      <span>Immagine caricata con successo!</span>
                    </div>
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
          <div className="w-full h-full flex items-center justify-center bg-gray-100 p-4">
            <div className="text-center w-full">
              <div className="text-gray-500 mb-3">
                <Lucide icon="ImageOff" className="w-8 h-8 mx-auto" />
                <p className="font-medium mt-2">Immagine non valida</p>
              </div>

              <Dropzone
                className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center"
                options={{
                  addedfile: (file) => {
                    console.log("File added", file);
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
                    <p className="text-sm text-gray-600 font-medium">
                      {isUploading ? 'Caricamento in corso...' : 'Trascina qui o clicca per caricare'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Formati supportati: JPG, PNG, GIF
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Dimensioni massime: 2MB
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="bg-gray-50 rounded-md p-3">
                      <div className="flex items-center mb-2">
                        <Lucide icon="FileImage" className="w-5 h-5 text-blue-500 mr-2" />
                        <div className="text-sm text-gray-700 truncate flex-1">
                          {addedFile.name}
                        </div>
                        <span className="text-xs text-gray-500">
                          {(addedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      <div className="mt-2">
                        <img
                          src={URL.createObjectURL(addedFile)}
                          alt="Preview"
                          className="w-full h-auto max-h-36 object-contain rounded-md"
                        />
                      </div>

                      {/* Upload progress */}
                      {isUploading && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-center">
                            {uploadProgress < 100
                              ? `Caricamento... ${Math.round(uploadProgress)}%`
                              : 'Caricamento completato!'}
                          </p>
                        </div>
                      )}

                      {/* Error message */}
                      {uploadError && (
                        <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
                          <Lucide icon="TriangleAlert" className="w-4 h-4 inline mr-1" />
                          {uploadError}
                        </div>
                      )}

                      {/* Success message */}
                      {uploadSuccess && (
                        <div className="mt-2 p-2 bg-green-50 text-green-600 text-sm rounded flex items-center">
                          <Lucide icon="CircleCheck" className="w-4 h-4 mr-1" />
                          <span>Immagine caricata con successo!</span>
                        </div>
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
  onFileSelected: (file: Dropzone.DropzoneFile) => void;
  onUpload: () => void;
  onCancel: () => void;
  file: Dropzone.DropzoneFile | null;
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
        className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center"
        options={{
          addedfile: (file) => {
            console.log("File added", file);
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
            <p className="text-sm text-gray-600 font-medium">
              {isUploading ? 'Caricamento in corso...' : 'Trascina qui o clicca per caricare'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Formati supportati: JPG, PNG, GIF
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Dimensioni massime: 2MB
            </p>
          </div>
        ) : null}
      </Dropzone>

      {file && (
        <div className="mt-3 bg-gray-50 rounded-md p-3">
          <div className="flex items-center mb-2">
            <Lucide icon="FileImage" className="w-5 h-5 text-blue-500 mr-2" />
            <div className="text-sm text-gray-700 truncate flex-1">
              {file.name}
            </div>
            <span className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>

          <div className="mt-2">
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="w-full h-auto max-h-36 object-contain rounded-md"
            />
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
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
            <label className="block text-sm font-medium text-gray-700">{key}</label>
            {typeof value === 'object' && value !== null ? (
              <textarea
                value={JSON.stringify(value, null, 2)}
                onChange={(e) => handleChange(key, JSON.parse(e.target.value))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
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
    console.log('Referenza changed:', referenza);
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
      console.log('Forzatura foto singola aggiornata:', data);
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
  const handleImmagineReferenzaMancante = async (acceptedFiles: Dropzone.DropzoneFile, ref: ReferenzeIstanta, url: string) => {
    if (acceptedFiles) {
      const file = acceptedFiles;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const searchParams = new URLSearchParams(new URL(url).search);
      const guidId = searchParams.get('guidId');
      console.log(guidId);
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
        console.log('File uploaded successfully:', uploadedFile.data);
      }
    }
  };



  const handleImmagineGruppoReferenza = async (acceptedFiles: Dropzone.DropzoneFile, ref: ReferenzeIstanta) => {
    if (acceptedFiles) {
      const file = acceptedFiles;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('guidId', ref.id);
      formData.append("idArea", selectAreaPerFotoGruppo);
      formData.append("idCanale", selectCanalePerFotoGruppo);
      console.log(Object.fromEntries(formData));
      const urlAPI = ServerCall.getUrl();
      const uploadedFile = await axios.post(`${urlAPI}/updateImmagineGruppoReferenza`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (uploadedFile.status === 200) {
        console.log('File uploaded successfully:', uploadedFile.data);
      }
    }
  }

  // Tab panel rendering helpers
  const renderGeneralTab = () => (
    <div>
      <h3 className="text-lg font-medium text-gray-900">General Information</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-gray-500">ID</dt>
          <dd className="mt-1 text-sm text-gray-900">{referenza?.id}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-gray-500">Visible</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {referenza?.visibile !== undefined ? referenza?.visibile.toString() : 'N/A'}
          </dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-gray-500">Runtime Kit ID</dt>
          <dd className="mt-1 text-sm text-gray-900">{kit?.titolo}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-gray-500">Meccanica</dt>
          <dd className="mt-1 text-sm text-gray-900">{referenza?.meccanica}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-sm font-medium text-gray-500">Codice Box</dt>
          <dd className="mt-1 text-sm text-gray-900">{referenza?.codiceBox}</dd>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-900">Deleted Fields</h3>
        <div className="mt-2">
          {(referenza?.deletedFields ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referenza?.deletedFields.map((field, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800"
                >
                  {field}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No deleted fields</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderFieldsTab = () => (
    <div>
      <h3 className="text-lg font-medium text-gray-900">Compiled Fields</h3>
      <div className="mt-2">
        {(referenza?.compiledFields ?? []).length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {referenza?.compiledFields.map((field, index) => (
                <li key={index} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      {field.label_name}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {field.paragraph_name || 'No paragraph'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div
                      className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0"
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
          <p className="text-sm text-gray-500">No compiled fields</p>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900">Data Fields</h3>
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
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {Object.entries(referenza?.dataFields || {}).map(([key, value], index) => (
                      <li key={index} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600 truncate">{key}</p>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
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
                <p className="text-sm text-gray-500">No data fields available</p>
              )}
              <div className="mt-4">
                <button
                  onClick={() => setIsEditingDataFields(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md"
                >
                  Modifica Data Fields
                </button>
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
          <h3 className="text-lg font-medium text-gray-900">Foto Referenza</h3>
          <div className="mt-4">
            {(referenza?.foto ?? []).length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {referenza?.foto.map((url, index) => (
                    <ImageDisplay
                      key={`image-${index}`}
                      url={url}
                      altText={`Referenza-${referenza?.dataFields?.codice_referenza || index}`}
                      referenza={referenza}
                      onUploadNuovaFoto={(file, ref, url) => {
                        console.log('Image uploaded');
                        handleImmagineReferenzaMancante(file, ref, url);
                      }}
                      onUploadSostituzioneFoto={(file, ref, url) => {
                        console.log('Image replaced');
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
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <Lucide icon="ImageOff" className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna immagine</h3>
                <p className="mt-1 text-sm text-gray-500">Aggiungi immagini alla referenza.</p>
                <div className="mt-6">
                  <Button
                    variant="outline-primary"
                    className="inline-flex items-center"
                  >
                    <Lucide icon="Plus" className="w-4 h-4 mr-1" />
                    Aggiungi Immagine
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loghi e bolli Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900">Loghi e bolli</h3>
          <div className="mt-4">
            {(referenza?.fotoExtra ?? []).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {referenza?.fotoExtra.map((logo, index) => (
                  <div key={`logo-${index}`} className="bg-white rounded-lg shadow-sm p-4 flex flex-col items-center">
                    <div className="text-center mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {logo.tipo}
                      </span>
                      <h4 className="mt-1 text-sm font-medium text-gray-900">{logo.sigla}</h4>
                    </div>
                    <div className="w-full relative overflow-hidden rounded-md">
                      <ImageDisplay
                        referenza={referenza}
                        url={logo.guidId}
                        altText={`Logo-${logo.sigla}`}
                        onUploadNuovaFoto={(file, ref, url) => {
                          console.log('Logo uploaded');
                          handleImmagineReferenzaMancante(file, ref, url);
                        }}
                        onUploadSostituzioneFoto={(file, ref, url) => {
                          console.log('Logo replaced');
                          handleImmagineReferenzaMancante(file, ref, url);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Nessun logo e/o bollo</p>
              </div>
            )}

            {/* Form to add a new logo */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-md font-medium text-gray-800">Aggiungi nuovo logo/bollo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={selectedLogoTipo}
                    onChange={(e) => setSelectedLogoTipo(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="bollo">Bollo</option>
                    <option value="logo">Logo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sigla</label>
                  <input
                    type="text"
                    value={selectedLogoSigla}
                    onChange={(e) => setSelectedLogoSigla(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Inserisci sigla"
                  />
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
          <h3 className="text-lg font-medium text-gray-900">Foto Gruppo</h3>
          <div className="mt-4">
            {referenza?.fotoGruppo ? (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <ImageDisplay
                  url={referenza.fotoGruppo}
                  altText="Foto Gruppo"
                  referenza={referenza}
                  onUploadNuovaFoto={(file, ref) => {
                    console.log('Foto Gruppo uploaded');
                    handleImmagineGruppoReferenza(file, ref);
                  }}
                  onUploadSostituzioneFoto={(file, ref) => {
                    console.log('Foto Gruppo replaced');
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
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <Lucide icon="ImageOff" className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna foto gruppo</h3>
                <p className="mt-1 text-sm text-gray-500">Aggiungi una foto gruppo alla referenza.</p>

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
      <h3 className="text-lg font-medium text-gray-900">Informazioni di contesto</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-gray-500">Context Tracciato</dt>
          <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-4 rounded-md overflow-auto">
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
          <dt className="text-sm font-medium text-gray-500">Context Promo</dt>
          <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-4 rounded-md overflow-auto">
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
  const [fileGruppo, setFileGruppo] = useState<Dropzone.DropzoneFile | null>(null);
  const [isUploadingGruppo, setIsUploadingGruppo] = useState(false);
  const [fileLogo, setFileLogo] = useState<Dropzone.DropzoneFile | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedLogoTipo, setSelectedLogoTipo] = useState<string>('bollo');
  const [selectAreaPerFotoGruppo, setSelectAreaPerFotoGruppo] = useState<string>('');
  const [selectCanalePerFotoGruppo, setSelectCanalePerFotoGruppo] = useState<string>('');
  const [selectedLogoSigla, setSelectedLogoSigla] = useState<string>('');
  // Render main component


  useEffect(() => {
    console.log('isVisible changed:', isVisible);
    if (isVisible) {
      setSelectAreaPerFotoGruppo("");
      setSelectCanalePerFotoGruppo("");
    }
  }, [isVisible]);


  useEffect(() => {
    console.log(Colorize.bgMagenta("CAMBIO SELECT PER FOTO GRUPPO"));
    console.log(selectAreaPerFotoGruppo, selectCanalePerFotoGruppo);
  }, [selectAreaPerFotoGruppo, selectCanalePerFotoGruppo])

  return (
    isVisible && (
      <Slideover size='xl' open={isVisible} onClose={() => { console.log("CIAO"); setIsVisible(false); setReferenza(undefined) }} className="">
        <Slideover.Panel className={'w-full max-w-3xl z-50'}>
          <Slideover.Title>
            <h2 className="text-xl font-semibold text-gray-800">Dettaglio referenza</h2>
          </Slideover.Title>
          <Slideover.Description>
            <Tab.Group className={"flex flex-col gap-y-7 justify-start"}>
              <Tab.List className="flex flex-wrap items-start -mb-px p-0 text-center" variant="link-tabs">
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
              <Tab.Panels className="p-6">
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
