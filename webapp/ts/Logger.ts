import { ConsoleWin, LogLevel } from "./layout/win/ConsoleWin.js";

export class Logger {
    public static consoleWin: ConsoleWin | undefined = undefined;

    static error(...args: any[]): void {
        console.error(...args);
        this.consoleWin?.addLine(LogLevel.error, args.join(" "));
    }

    static warn(...args: any[]): void {
        console.warn(...args);
        this.consoleWin?.addLine(LogLevel.warn, args.join(" "));
    }

    static info(...args: any[]): void {
        console.info(...args);
        this.consoleWin?.addLine(LogLevel.info, args.join(" "));
    }
}