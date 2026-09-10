declare const __FP_IS_PROD__: boolean;

export class FPLogger {
    constructor(private readonly isProd: boolean) { }

    log(...args: unknown[]): void {
        if (!this.isProd) console.log(...args);
    }

    warn(...args: unknown[]): void {
        if (!this.isProd) console.warn(...args);
    }

    error(...args: unknown[]): void {
        if (!this.isProd) console.error(...args);
    }
}

export const fpLogger = new FPLogger(__FP_IS_PROD__);
