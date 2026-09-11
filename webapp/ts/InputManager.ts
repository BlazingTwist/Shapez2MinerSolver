import { Logger } from "./Logger.js";
import { getSettings, KeybindT } from "./Settings.js";

export type KeyChord = string[];
export type KeybindCallback = () => void;

export class Keybind {
    orBinds: KeyChord[];

    public static ofSingleKey(code: string): Keybind {
        return new Keybind([[code]]);
    }

    public static orKeys(orCodes: string[]): Keybind {
        return new Keybind(orCodes.map(code => [code]));
    }

    constructor(orBinds: KeyChord[]) {
        this.orBinds = orBinds;
    }

    toString(): string {
        return this.orBinds.map(chord => `[${chord.join("+")}]`).join(", ");
    }
}

export class KeybindObserver {
    readonly key: KeybindT;
    private readonly callbacks: KeybindCallback[] = [];

    constructor(key: KeybindT) {
        this.key = key;
        InputManager.pushKeybind(this);
    }

    update(pressedKeys: Set<string>): void {
        let isTriggered = false;
        for (let chord of getSettings().keybinds[this.key.settingsKey].orBinds) {
            let chordSatisfied = true;
            for (let bind of chord) {
                if (!pressedKeys.has(bind)) {
                    chordSatisfied = false;
                    break;
                }
            }
            if (chordSatisfied) {
                isTriggered = true;
                break;
            }
        }

        if (isTriggered) {
            for (let callback of this.callbacks) {
                try {
                    callback();
                } catch (err) {
                    Logger.error("Error during keybind callback:", err);
                }
            }
        }
    }

    addCallback(callback: KeybindCallback) {
        this.callbacks.push(callback);
    }
}

export class InputManager {
    private static readonly keybinds: KeybindObserver[] = [];
    private static readonly pressedKeys: Set<string> = new Set<string>();

    public static register(): void {
        document.addEventListener("keydown", ev => {
            const target: any = ev.target;
            const lowerTagName = (target && target.tagName) ? (("" + target.tagName).toLowerCase()) : "";
            if (lowerTagName === 'input') {
                const inputType = (<HTMLInputElement>target).type;
                if (inputType === 'text' || inputType === 'number') {
                    // event seems to be coming from an element receiving input -> ignore
                    return;
                }
            }
            if (lowerTagName === 'textarea') {
                // event seems to be coming from an element receiving input -> ignore
                return;
            }

            InputManager.pressedKeys.add(ev.code);
            InputManager.update();
        });
        document.addEventListener("keyup", ev => {
            const target: any = ev.target;
            if (target && target.tagName && (target.tagName === 'input' || target.tagName === 'textarea')) {
                // seems to be coming from an element receiving input -> ignore
                return;
            }

            InputManager.pressedKeys.delete(ev.code);
            InputManager.update();
        });
    }

    private static update(): void {
        for (let keybind of InputManager.keybinds) {
            keybind.update(InputManager.pressedKeys);
        }
    }

    public static pushKeybind(bind: KeybindObserver): void {
        InputManager.keybinds.push(bind);
    }
}

