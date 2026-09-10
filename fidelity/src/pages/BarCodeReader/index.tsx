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
    <main className="mt-20 w-full min-h-svh shop-main">
      <section className="shop-main d-flex mr-1 pt-xl-5" style={{ marginRight: "2.25rem", marginLeft: "2.55rem" }}>
        <div className="col-12">
          <div className="d-flex flex-column align-items-center mb-4">
            <h1>Barcode Reader</h1>
          </div>
          <div className="d-flex flex-column gap-3">
            <div className="card">
              <div className="card-body">
                {hasPermission === null ? (
                  <p>Requesting camera permission...</p>
                ) : hasPermission ? (
                  <>
                    {barcode ? (
                      <>
                        <div className="d-flex flex-column justify-content-center align-items-center bg-dark text-white py-5">
                          <h2>{barcode}</h2>
                          <p className="mt-3">Barcode scannerizzato</p>
                          <span>{barcode}</span>
                        </div>
                        {referenza && (
                          <>
                            <BoxRef
                              referenza={referenza}
                              config={dataConfig.data as any}
                            />
                            <Button onClick={restartScanning} className="btn btn-warning w-100 mt-3">
                              Vai alla pagina di dettaglio
                            </Button>
                          </>
                        )}
                        <Button onClick={restartScanning} className="btn btn-primary w-100 mt-3">
                          Scannerizza un'altro codice
                        </Button>
                      </>
                    ) : (
                      <div className="position-relative w-100">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-100 h-auto bg-dark"
                        />
                        <canvas
                          ref={overlayCanvasRef}
                          onClick={handleCanvasClick}
                          onMouseDown={handleCanvasMouseDown}
                          onMouseUp={handleCanvasMouseUp}
                          onMouseMove={handleCanvasMouseMove}
                          className="position-absolute top-0 start-0 w-100 h-100"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p>Permission to access the camera was denied.</p>
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
