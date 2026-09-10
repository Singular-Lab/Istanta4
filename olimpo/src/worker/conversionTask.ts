import { Worker } from 'worker_threads';
import * as path from 'path';




function runConversionTask(task: {
  path_file_dello_zip_completo: string;
  nome_archivio_file_finale: string;
  nome_web_file_finale: string;
  unique_name: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const myPath = path.resolve(__dirname, 'conversionWorker.js');
    const worker = new Worker(myPath, {
      workerData: task,
    });
    worker.on('message', (msg) => {
      if (msg.error) {
        return reject(new Error(msg.error));
      }
      resolve(msg.result);
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

export default runConversionTask;