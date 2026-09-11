import { Asteroid } from "./ShapezSolverWasm.js";

export interface ColorGenerator {
    next(): number;
}

export class ColorUtils {
    public static getRed(color: number): number {
        return (color >> 16) & 0xff;
    }

    public static getGreen(color: number): number {
        return (color >> 8) & 0xff;
    }

    public static getBlue(color: number): number {
        return color & 0xff;
    }

    public static toColorStr(color: number): string {
        return "#" + color.toString(16).padStart(6, "0");
    }

    public static getAsteroidColor(roid: Asteroid): number {
        if (roid.asteroidType == 'fluid') {
            return 0x000020;
        } else {
            return 0x002000;
        }
    }

    public static mul(color: number, factor: number): number {
        const r = Math.min(255, Math.max(0, (color & 0xff) * factor));
        const g = Math.min(255, Math.max(0, ((color & (0xff << 8)) >> 8) * factor));
        const b = Math.min(255, Math.max(0, ((color & (0xff << 16)) >> 16) * factor));
        return (r | (g << 8) | (b << 16));
    }
}

export class GrayScaleGen implements ColorGenerator {
    colorGenId: number;

    constructor() {
        this.colorGenId = 0;
    }

    next(): number {
        this.colorGenId++;
        const gray = ((this.colorGenId % 6)) << 5;
        return (gray << 16) | (gray << 8) | (gray);
    }
}

export class CyanColorGen implements ColorGenerator {
    colorGenId: number;

    constructor() {
        this.colorGenId = 0;
    }

    next(): number {
        this.colorGenId++;
        const gray = ((this.colorGenId % 6) + 1) << 5 | 0b01000;
        return (gray << 8) | gray;
    }
}

export class YellowPurpleGen implements ColorGenerator {
    colorGenId: number;

    constructor() {
        this.colorGenId = 0;
    }

    next(): number {
        this.colorGenId++;
        const gray = (((this.colorGenId / 2) % 6) + 1) << 5 | 0b10000;
        const cycleId = this.colorGenId % 2;
        if (cycleId === 0) {
            return (gray << 16 | gray);
        } else {
            return (gray << 16 | gray << 8);
        }
    }
}