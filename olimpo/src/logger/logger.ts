import { LoggerService } from '@nestjs/common';
import * as path from 'path';

export class EmojiLogger implements LoggerService {
  private logFilePath: string;

  constructor(logFileName: string = 'app.log') {
    this.logFilePath = path.join(__dirname, logFileName);
  }

  log(message: string | object) {
    this.writeToFile('INFO', '📢', message);
  }

  error(message: string | object, trace: string) {
    this.writeToFile('ERROR', '❌', message);
    this.writeToFile('ERROR', '🔍', 'Stack Trace: ' + trace);
  }

  warn(message: string | object) {
    this.writeToFile('WARN', '⚠️', message);
  }

  debug(message: string | object) {
    this.writeToFile('DEBUG', '🐞', message);
  }

  private writeToFile(level: string, emoji: string, message: string | object) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${level}] ${emoji} ${this.safeStringify(message)}\n`;

    // Write log message to a file
    // fs.appendFileSync(this.logFilePath, logMessage, { encoding: 'utf8' });
    // console.log(this.logFilePath)
    // Log to console as well (for debugging purposes)
    console.log(logMessage);
  }

  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }
}
