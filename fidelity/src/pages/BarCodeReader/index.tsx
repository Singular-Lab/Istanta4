import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import clsx from 'clsx';
import { useFetchConfig } from '@/query/query';
import { BarcodeDetector } from 'barcode-detector/ponyfill';
import React, { useEffect, useRef, useState } from 'react';
import { ServerCall } from '../../../lib/server_call';
import BoxRef from '../WebPliant/BoxRef';
import {
  CaricamentoPubblico,
  CLASSE_TITOLO_PANNELLO_PUBBLICO,
  CLASSE_TITOLO_PUBBLICO,
  ErrorePubblico,
} from '../WebpliantLayout/StatiPubblici';

const BarCodeReaderComponent: React.FC = () => {
  const [barcode, setBarcode] = useState<string | null>(null);
  const [referenza, setReferenza] = useState<any | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanKey, setScanKey] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dataConfig = useFetchConfig();



  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        setHasPermission(true);
      } catch (error) {
        console.error('Camera access denied:', error);
        setHasPermission(false);
      }
    };

    requestCameraPermission();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (hasPermission && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [hasPermission]);

  useEffect(() => {
    const videoEl = videoRef.current;
    const updateCanvasSize = () => {
      if (videoEl && overlayCanvasRef.current) {
        overlayCanvasRef.current.width = videoEl.videoWidth;
        overlayCanvasRef.current.height = videoEl.videoHeight;
      }
    };

    if (videoEl) {
      videoEl.addEventListener('loadedmetadata', updateCanvasSize);
      return () => videoEl.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission) return;

    const barcodeDetector = new BarcodeDetector({
      formats: [
        'qr_code',
        'code_128',
        'code_39',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
      ],
    });

    const scan = async () => {
      let isBarcodeDetected = false;
      if (videoRef.current) {
        try {
          const detected = await barcodeDetector.detect(videoRef.current);
          if (detected.length > 0) {
            setBarcode(detected[0].rawValue);
            isBarcodeDetected = true;
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
            }
          } else {
            setBarcode(null);
          }
        } catch (error) {
          console.error('Error detecting barcode:', error);
        }
      }

      if (overlayCanvasRef.current) {
        const canvas = overlayCanvasRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.strokeStyle = isBarcodeDetected ? 'green' : 'red';
          context.lineWidth = 4;
          const rectWidth = 40;
          const rectHeight = 40;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const offset = 20;
          context.strokeRect(
            centerX - rectWidth - offset,
            centerY - rectHeight - offset,
            rectWidth,
            rectHeight
          );
          context.strokeRect(
            centerX + offset,
            centerY - rectHeight - offset,
            rectWidth,
            rectHeight
          );
          context.strokeRect(
            centerX - rectWidth - offset,
            centerY + offset,
            rectWidth,
            rectHeight
          );
          context.strokeRect(
            centerX + offset,
            centerY + offset,
            rectWidth,
            rectHeight
          );
        }
      }
      if (!isBarcodeDetected) {
        requestAnimationFrame(scan);
      }
    };

    requestAnimationFrame(scan);
  }, [hasPermission, scanKey]);

  const restartScanning = async () => {
    setBarcode(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (overlayCanvasRef.current) {
            overlayCanvasRef.current.width = videoRef.current!.videoWidth;
            overlayCanvasRef.current.height = videoRef.current!.videoHeight;
          }
        };
      }
      setScanKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error reinitializing camera:', error);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    if (barcode) {
      const fetchReferenza = async () => {
        const response = await ServerCall.get<any>(`/getReferenzaByEAN?ean=${barcode}`);
        setReferenza(response);
      };
      fetchReferenza();
    } else {
      setReferenza(null);
    }
  }, [barcode]);

  // Doppia rotta: dentro il layout operatore (/barcode-reader) e nella vetrina pubblica (/webpliant/barcode-reader)
  const pubblica = window.location.pathname.startsWith('/webpliant');

  const scansione = (
    <>
      {barcode ? (
        <>
          <div className="flex flex-col items-center justify-center bg-slate-900 py-5 text-white">
            <h2 className={pubblica ? clsx(CLASSE_TITOLO_PANNELLO_PUBBLICO, styleWp["wp-mb-0"], 'text-white') : 'title-section text-white'}>
              {barcode}
            </h2>
            <p className="mt-3">Codice scansionato</p>
          </div>
          {referenza && (
            <BoxRef
              referenza={referenza}
              config={dataConfig.data as any}
            />
          )}
          {pubblica ? (
            <button
              type="button"
              onClick={restartScanning}
              className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], 'mt-3 w-full')}
            >
              Scansiona un altro codice
            </button>
          ) : (
            <Button type="button" variant="primary" onClick={restartScanning} className="mt-3 w-full">
              Scansiona un altro codice
            </Button>
          )}
        </>
      ) : (
        <div className="relative w-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-auto w-full bg-slate-900"
          />
          <canvas
            ref={overlayCanvasRef}
            aria-hidden="true"
            className="absolute left-0 top-0 h-full w-full"
          />
        </div>
      )}
    </>
  );

  if (pubblica) {
    return (
      <main className="mt-20 w-full min-h-svh px-4 xl:pt-12">
        <h1 className={clsx(CLASSE_TITOLO_PUBBLICO, styleWp["wp-mb-4"])}>Lettore codici a barre</h1>
        <div className="mx-auto max-w-3xl">
          {hasPermission === null ? (
            <CaricamentoPubblico testo="Richiesta del permesso per la fotocamera..." />
          ) : hasPermission ? (
            scansione
          ) : (
            <ErrorePubblico titolo="Fotocamera non disponibile" messaggio="Accesso alla fotocamera negato." />
          )}
        </div>
      </main>
    );
  }

  return (
    <Pagina titolo="Lettore codici a barre" descrizione="Inquadra il codice a barre di un prodotto per vederne la referenza">
      <Sezione>
        {hasPermission === null ? (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
            <Spinner decorativo />
            <span role="status">Richiesta del permesso per la fotocamera...</span>
          </div>
        ) : hasPermission ? (
          scansione
        ) : (
          <Alert variant="soft-warning" icona="CameraOff" titolo="Fotocamera non disponibile">
            Accesso alla fotocamera negato.
          </Alert>
        )}
      </Sezione>
    </Pagina>
  );
};

export default BarCodeReaderComponent;
