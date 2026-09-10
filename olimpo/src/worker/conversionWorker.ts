// conversionWorker.ts
import { parentPort, workerData } from 'worker_threads';
import ConversionService from '@lib/ConversionService';

(async () => {
  try {
    const {
      path_file_dello_zip_completo,
      nome_archivio_file_finale,
      nome_web_file_finale,
      unique_name,
    } = workerData;

    const result = await ConversionService.conversioneFile(
      path_file_dello_zip_completo,
      nome_archivio_file_finale,
      nome_web_file_finale,
      unique_name
    );
    parentPort?.postMessage({ result });
  } catch (error: any) {
    parentPort?.postMessage({ error: error.message });
  }
})();
