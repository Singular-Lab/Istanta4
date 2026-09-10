export class Colorize {
    // Base colors
    static black(...args: any[]): string {
        return `\x1b[30m${this.formatArgs(args)}\x1b[0m`;
    }

    static red(...args: any[]): string {
        return `\x1b[31m${this.formatArgs(args)}\x1b[0m`;
    }

    static green(...args: any[]): string {
        return `\x1b[32m${this.formatArgs(args)}\x1b[0m`;
    }

    static yellow(...args: any[]): string {
        return `\x1b[33m${this.formatArgs(args)}\x1b[0m`;
    }

    static blue(...args: any[]): string {
        return `\x1b[34m${this.formatArgs(args)}\x1b[0m`;
    }

    static magenta(...args: any[]): string {
        return `\x1b[35m${this.formatArgs(args)}\x1b[0m`;
    }
    static warning(...args: any[]): string {
        return `\x1b[35m${this.formatArgs(args)}\x1b[0m`;
    }

    static cyan(...args: any[]): string {
        return `\x1b[36m${this.formatArgs(args)}\x1b[0m`;
    }

    static white(...args: any[]): string {
        return `\x1b[37m${this.formatArgs(args)}\x1b[0m`;
    }
    static gray(...args: any[]): string {
        return `\x1b[90m${this.formatArgs(args)}\x1b[0m`;
    }
    // Bright colors
    static brightBlack(...args: any[]): string {
        return `\x1b[90m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightRed(...args: any[]): string {
        return `\x1b[91m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightGreen(...args: any[]): string {
        return `\x1b[92m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightYellow(...args: any[]): string {
        return `\x1b[93m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightBlue(...args: any[]): string {
        return `\x1b[94m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightMagenta(...args: any[]): string {
        return `\x1b[95m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightCyan(...args: any[]): string {
        return `\x1b[96m${this.formatArgs(args)}\x1b[0m`;
    }

    static brightWhite(...args: any[]): string {
        return `\x1b[97m${this.formatArgs(args)}\x1b[0m`;
    }

    // Background colors
    static bgBlack(...args: any[]): string {
        return `\x1b[40m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgRed(...args: any[]): string {
        return `\x1b[41m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgGreen(...args: any[]): string {
        return `\x1b[42m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgYellow(...args: any[]): string {
        return `\x1b[43m${this.formatArgs(args)}\x1b[0m`;
    }
    static bgWarning(...args: any[]): string {
        return `\x1b[43m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBlue(...args: any[]): string {
        return `\x1b[44m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgMagenta(...args: any[]): string {
        return `\x1b[45m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgCyan(...args: any[]): string {
        return `\x1b[46m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgWhite(...args: any[]): string {
        return `\x1b[47m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightBlack(...args: any[]): string {
        return `\x1b[100m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightRed(...args: any[]): string {
        return `\x1b[101m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightGreen(...args: any[]): string {
        return `\x1b[102m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightYellow(...args: any[]): string {
        return `\x1b[103m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightBlue(...args: any[]): string {
        return `\x1b[104m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightMagenta(...args: any[]): string {
        return `\x1b[105m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightCyan(...args: any[]): string {
        return `\x1b[106m${this.formatArgs(args)}\x1b[0m`;
    }

    static bgBrightWhite(...args: any[]): string {
        return `\x1b[107m${this.formatArgs(args)}\x1b[0m`;
    }
    static bgGray(...args: any[]): string {
        return `\x1b[48;5;240m${this.formatArgs(args)}\x1b[0m`;
    }

    // Utility for formatting arguments
    private static formatArgs(args: any[]): string {
        return args
            .map(arg =>
                typeof arg === 'object'
                    ? JSON.stringify(arg, null, 2) // Pretty print objects
                    : String(arg)
            )
            .join(' ');
    }

    static randomHexColor(): string {
        const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
        return `#${randomHex()}${randomHex()}${randomHex()}`;
    }
}
