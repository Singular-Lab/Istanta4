import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ServerCall } from '../../../../lib/server_call';
import { FileItemKit } from '../../../../lib/types';
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";

interface PdfVolantiniViewerProps {
  idCanale: string | null;
  idArea: string | null;
  idPV: string | null;
  idsKitDesign: string[];
  idsTipiDiExport: string[];
  className?: string;
}

interface PdfVolantiniData {
  idCanale: string;
  idKit: string;
  idArea: string;
  nomeCanale: string;
  nomeArea: string;
  files_field: {
    nome_file: string;
    id_olimpo_cloud: string;
    tipo_export: string;
    codice_tipiexport: string;
    idPromo: string;
    url: string;
    url_download: string;
  }[];
}

const PdfVolantiniViewer: React.FC<PdfVolantiniViewerProps> = ({
  idCanale,
  idArea,
  idPV,
  idsKitDesign,
  idsTipiDiExport,
  className
}) => {
  const [pdfVolantini, setPdfVolantini] = useState<PdfVolantiniData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (url: string, fileName: string) => {
    try {
      // Estrai l'ID dal URL originale del server Olimpo
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const pdfId = urlParams.get('id');
      
      if (!pdfId) {
        throw new Error('ID del PDF non trovato nell\'URL');
      }
      
      // Usa l'endpoint proxy del nostro server
      const urlProxy = ServerCall.getUrl()
      const proxyUrl = `${urlProxy}/downloadPDFVolantino/${pdfId}?fileName=${encodeURIComponent(fileName)}`;
      
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Errore durante il download:', error);
      // Fallback al metodo originale
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    const fetchPdfVolantini = async () => {
      if (!idCanale || !idArea) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await ServerCall.put<PdfVolantiniData[]>("/getAllCombinazioniRuntimePDFWebPliant", {
            idCanale,
            idArea,
            idsKitDesign,
            idsTipiDiExport,
        });
        console.log("RESPONSE getAllCombinazioniRuntimePDFWebPliant",response)
        setPdfVolantini(response || []);
      } catch (err) {
        console.error('Errore nel caricamento dei PDF volantini:', err);
        setError('Errore nel caricamento dei PDF volantini');
      } finally {
        setLoading(false);
      }
    };

    fetchPdfVolantini();
  }, [idCanale, idArea]);

  if (loading) {
    return (
      <div className={clsx(styleWp["wp-container"], "my-4", className)}>
        <div className={clsx(styleWp["wp-row"], styleWp["wp-justify-content-center"])}>
          <div className="text-center">
            <p>Caricamento PDF volantini...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx(styleWp["wp-container"], "my-4", className)}>
        <div className={clsx(styleWp["wp-row"], styleWp["wp-justify-content-center"])}>
          <div className="text-center text-red-500">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pdfVolantini || pdfVolantini.length === 0) {
    console.log("CIAOOOOOOOOo")
    return null;
  }

  return (
    <div className={clsx(styleWp["wp-container"], "my-4", className)}>
      <div className={clsx(styleWp["wp-row"], styleWp["wp-justify-content-center"],"!border-b-0")}>
        {pdfVolantini.map((volantino) => 
          volantino.files_field.map((pdf) => (
            <div key={pdf.id_olimpo_cloud} className={clsx(styleWp["wp-col-12"], styleWp["wp-col-md-6"], styleWp["wp-col-lg-4"], styleWp["wp-mb-4"],"!border-b-0")}>
              <div className={clsx(styleWp["wp-text-center"], styleWp["wp-d-flex"], styleWp["wp-flex-column"], styleWp["wp-align-items-center"], styleWp["wp-justify-content-center"])}>
                <div className={clsx(styleWp["wp-mb-3"], styleWp["wp-d-flex"], styleWp["wp-justify-content-center"])}>
                  <img 
                    src={pdf.url} 
                    alt={pdf.nome_file} 
                    className={clsx(styleWp["wp-border"], styleWp["wp-rounded"], styleWp["wp-shadow-sm"])}
                    style={{ maxHeight: '250px', objectFit: 'cover', width: 'auto' }}
                  />
                </div>
                <h6 className={clsx(styleWp["wp-mb-3"], styleWp["wp-text-dark"], styleWp["wp-text-center"])}>
                  {pdf.nome_file}
                </h6>
                {pdf.url_download && (
                  <div className={clsx(styleWp["wp-d-flex"], styleWp["wp-justify-content-center"])}>
                    <button 
                      onClick={() => handleDownload(pdf.url_download, pdf.nome_file)}
                      className={clsx(
                        styleWp["wp-btn"], 
                        styleWp["wp-btn-primary"], 
                        styleWp["wp-btn-sm"],
                        "!text-white"
                      )}
                    >
                      Scarica PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PdfVolantiniViewer; 