import Button from '@/components/Base/Button';
import { useFetchConfig } from '@/query/query';
import { BarcodeDetector } from 'barcode-detector/ponyfill';
import React, { useEffect, useRef, useState } from 'react';
import { ServerCall } from '../../../lib/server_call';
import BoxRef from '../WebPliant/BoxRef';

const BarCodeReaderComponent: React.FC = () => {
  const [barcode, setBarcode] = useState<string | null>(null);
  const [referenza, setReferenza] = useState<any | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanKey, setScanKey] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dataConfig = useFetchConfig();



  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    console.log('Canvas overlay clicked at:', x, y);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    console.log('Canvas overlay mouse down at:', x, y);
  };

  const handleCanvasMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    console.log('Canvas overlay mouse up at:', x, y);
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    console.log('Canvas overlay mouse move at:', x, y);
  };

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

  return (
    <main className="mt-20 w-full min-h-svh">
      <section className="flex mx-9 xl:pt-12">
        <div className="w-full">
          <div className="flex flex-col items-center mb-4">
            <h1 className="title-page">Lettore codici a barre</h1>
          </div>
          <div className="flex flex-col gap-3">
            <div className="box box--stacked rounded-card">
              <div className="p-5">
                {hasPermission === null ? (
                  <p>Richiesta del permesso per la fotocamera...</p>
                ) : hasPermission ? (
                  <>
                    {barcode ? (
                      <>
                        <div className="flex flex-col justify-center items-center bg-slate-900 text-white py-5">
                          <h2 className="title-section text-white">{barcode}</h2>
                          <p className="mt-3">Barcode scannerizzato</p>
                          <span>{barcode}</span>
                        </div>
                        {referenza && (
                          <>
                            <BoxRef
                              referenza={referenza}
                              config={dataConfig.data as any}
                            />
                          </>
                        )}
                        <Button variant="primary" onClick={restartScanning} className="w-full mt-3">
                          Scannerizza un altro codice
                        </Button>
                      </>
                    ) : (
                      <div className="relative w-full">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-auto bg-slate-900"
                        />
                        <canvas
                          ref={overlayCanvasRef}
                          onClick={handleCanvasClick}
                          onMouseDown={handleCanvasMouseDown}
                          onMouseUp={handleCanvasMouseUp}
                          onMouseMove={handleCanvasMouseMove}
                          className="absolute top-0 left-0 w-full h-full"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p>Accesso alla fotocamera negato.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BarCodeReaderComponent;
