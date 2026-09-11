import { SolverOptions } from "./ShapezSolverWasm.js";
import { RenderMode } from "./AsteroidRenderer.js";
import { Keybind, KeybindObserver, KeyChord } from "./InputManager.js";
import { Logger } from "./Logger.js";

export class KeybindT {
    readonly settingsKey: string;

    constructor(settingsKey: string) {
        this.settingsKey = settingsKey;
    }

    public static prevFrame = new KeybindT("prevFrame");
    public static nextFrame = new KeybindT("nextFrame");
    public static prevStat = new KeybindT("prevStat");
    public static nextStat = new KeybindT("nextStat");
    public static toggleTooltip = new KeybindT("toggleTooltip");
    public static renderModeBitMap = new KeybindT("renderModeBitMap");
    public static renderModeSvg = new KeybindT("renderModeSvg");
    public static renderModeOccupancy = new KeybindT("renderModeOccupancy");
}

export type TooltipOptions = {
    enable: boolean,
    showWorldCoordinates: boolean,
    showIslandCoordinates: boolean,
    showIslandId: boolean,
    showIslandType: boolean,
    showErrors: boolean,
    showWarnings: boolean,
}

export type LayoutOptions = {
    windowWidth: number,
    sidebarWidth: number,
    previewHeight: number,
    previewResolutionScale: number,
    consoleHeight: number,
    fontScale: number,
    decorationScale: number,
    colorShift: number,

    inputWinClosed: boolean,
    previewWinClosed: boolean,
    outputWinClosed: boolean,
    statsWinClosed: boolean,
    consoleWinClosed: boolean,
}

export type SolverProfileData = {
    activeProfile: string,
    savedProfiles: NamedSolverProfile[],
}

export type NamedSolverProfile = {
    name: string,
    profile: SavableSolverOptions,
}

export interface SavableSolverOptions {
    impl: SolverOptions;
    solverShapeMinerPresetId: string;
    solverFluidMinerPresetId: string;
}

export type Settings = {
    // Save / Load
    saveToBrowserAutomatically: boolean,

    // Solver
    solverProfiles: SolverProfileData,

    // GUI > Appearance
    layoutOptions: LayoutOptions,
    // GUI > Preview Window
    liveUpdate: boolean,
    renderMode: RenderMode,
    // GUI > Preview Window > Tooltip
    tooltipOptions: TooltipOptions,

    // Keymap
    keybinds: Record<string, Keybind>,
}

export const KeybindObservers: Record<string, KeybindObserver> = {
    [KeybindT.nextFrame.settingsKey]: new KeybindObserver(KeybindT.nextFrame),
    [KeybindT.prevFrame.settingsKey]: new KeybindObserver(KeybindT.prevFrame),
    [KeybindT.nextStat.settingsKey]: new KeybindObserver(KeybindT.nextStat),
    [KeybindT.prevStat.settingsKey]: new KeybindObserver(KeybindT.prevStat),
    [KeybindT.toggleTooltip.settingsKey]: new KeybindObserver(KeybindT.toggleTooltip),
    [KeybindT.renderModeBitMap.settingsKey]: new KeybindObserver(KeybindT.renderModeBitMap),
    [KeybindT.renderModeSvg.settingsKey]: new KeybindObserver(KeybindT.renderModeSvg),
    [KeybindT.renderModeOccupancy.settingsKey]: new KeybindObserver(KeybindT.renderModeOccupancy),
}

const allSettingObservers: SettingObserver<any>[] = [];

export class SettingObserver<T> {
    // Save / Load
    public static saveToBrowserAutomatically = new SettingObserver(() => getSettings().saveToBrowserAutomatically, (val) => getSettings().saveToBrowserAutomatically = val);

    // Solver
    public static profile = new SettingObserver(() => getSettings().solverProfiles.activeProfile, (val) => getSettings().solverProfiles.activeProfile = val);
    public static profiles = new SettingObserver(() => getSettings().solverProfiles.savedProfiles.map(x => x.name), (_) => {
    });
    // Solver > Parser
    public static solverShapeCodes = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.parser.shapeCodes, (val) => SettingsHelper.getSolverSettings().impl.parser.shapeCodes = val);
    public static solverFluidCodes = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.parser.fluidCodes, (val) => SettingsHelper.getSolverSettings().impl.parser.fluidCodes = val);
    public static solverIgnoredCodes = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.parser.ignoredCodes, (val) => SettingsHelper.getSolverSettings().impl.parser.ignoredCodes = val);
    public static solverFallbackMode = new SettingObserver<string>(() => SettingsHelper.getSolverSettings().impl.parser.fallbackMode, (val) => {
        // @ts-ignore
        SettingsHelper.getSolverSettings().impl.parser.fallbackMode = val
    });
    // Solver > Miner Blueprints
    public static solverShapeMiner = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.shapeMinerBpStr, (val) => SettingsHelper.getSolverSettings().impl.shapeMinerBpStr = val);
    public static solverShapeMinerPresetId = new SettingObserver(() => SettingsHelper.getSolverSettings().solverShapeMinerPresetId, (val) => SettingsHelper.getSolverSettings().solverShapeMinerPresetId = val);
    public static solverFluidMiner = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.fluidMinerBpStr, (val) => SettingsHelper.getSolverSettings().impl.fluidMinerBpStr = val);
    public static solverFluidMinerPresetId = new SettingObserver(() => SettingsHelper.getSolverSettings().solverFluidMinerPresetId, (val) => SettingsHelper.getSolverSettings().solverFluidMinerPresetId = val);
    // Solver > Advanced > Phase 1
    public static solverP1MaxLookahead = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase1.maxLookahead, (val) => SettingsHelper.getSolverSettings().impl.phase1.maxLookahead = val);
    public static solverP1PreScanCwCount = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase1.preScanCwCount, (val) => SettingsHelper.getSolverSettings().impl.phase1.preScanCwCount = val);
    public static solverP1PreScanCcwCount = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase1.preScanCcwCount, (val) => SettingsHelper.getSolverSettings().impl.phase1.preScanCcwCount = val);
    // Solver > Advanced > Phase 2
    public static solverP2OptimizeOccupied = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase2.optimizeOccupied, (val) => SettingsHelper.getSolverSettings().impl.phase2.optimizeOccupied = val);
    public static solverP2TargetMinScore = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase2.targetMinScore, (val) => SettingsHelper.getSolverSettings().impl.phase2.targetMinScore = val);
    public static solverP2MaxRetryMiners = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase2.maxRetryMiners, (val) => SettingsHelper.getSolverSettings().impl.phase2.maxRetryMiners = val);
    // Solver > Advanced > Phase 3
    public static solverP3MaxBeamWidth = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase3.maxBeamWidth, (val) => SettingsHelper.getSolverSettings().impl.phase3.maxBeamWidth = val);
    public static solverP3ReduceBeamWidthNTiles = new SettingObserver(() => SettingsHelper.getSolverSettings().impl.phase3.reduceBeamWidthNTiles, (val) => SettingsHelper.getSolverSettings().impl.phase3.reduceBeamWidthNTiles = val);

    // GUI > Appearance
    public static colorShift = new SettingObserver(() => getSettings().layoutOptions.colorShift, (val) => getSettings().layoutOptions.colorShift = val);
    public static decorationScale = new SettingObserver(() => getSettings().layoutOptions.decorationScale, (val) => getSettings().layoutOptions.decorationScale = val);
    public static fontScale = new SettingObserver(() => getSettings().layoutOptions.fontScale, (val) => getSettings().layoutOptions.fontScale = val);
    // GUI > Preview Window
    public static previewLiveUpdate = new SettingObserver(() => getSettings().liveUpdate, (val) => getSettings().liveUpdate = val);
    public static previewResolutionScale = new SettingObserver(() => getSettings().layoutOptions.previewResolutionScale, (val) => getSettings().layoutOptions.previewResolutionScale = val);
    public static previewRenderMode = new SettingObserver(() => getSettings().renderMode, (val) => getSettings().renderMode = val);
    // GUI > Preview Window > Tooltip
    public static tooltipShowWorldCoordinates = new SettingObserver(() => getSettings().tooltipOptions.showWorldCoordinates, (val) => getSettings().tooltipOptions.showWorldCoordinates = val);
    public static tooltipShowIslandCoordinates = new SettingObserver(() => getSettings().tooltipOptions.showIslandCoordinates, (val) => getSettings().tooltipOptions.showIslandCoordinates = val);
    public static tooltipShowIslandId = new SettingObserver(() => getSettings().tooltipOptions.showIslandId, (val) => getSettings().tooltipOptions.showIslandId = val);
    public static tooltipShowIslandType = new SettingObserver(() => getSettings().tooltipOptions.showIslandType, (val) => getSettings().tooltipOptions.showIslandType = val);
    public static tooltipShowErrors = new SettingObserver(() => getSettings().tooltipOptions.showErrors, (val) => getSettings().tooltipOptions.showErrors = val);
    public static tooltipShowWarnings = new SettingObserver(() => getSettings().tooltipOptions.showWarnings, (val) => getSettings().tooltipOptions.showWarnings = val);

    public static windowWidth = new SettingObserver(() => getSettings().layoutOptions.windowWidth, (val) => getSettings().layoutOptions.windowWidth = Math.max(50, val));
    public static sidebarWidth = new SettingObserver(() => getSettings().layoutOptions.sidebarWidth, (val) => getSettings().layoutOptions.sidebarWidth = Math.max(50, val));
    public static previewHeight = new SettingObserver(() => getSettings().layoutOptions.previewHeight, (val) => getSettings().layoutOptions.previewHeight = Math.max(10, val));
    public static consoleHeight = new SettingObserver(() => getSettings().layoutOptions.consoleHeight, (val) => getSettings().layoutOptions.consoleHeight = Math.max(10, val));

    // Window states
    public static inputWinClosed = new SettingObserver(() => getSettings().layoutOptions.inputWinClosed, (val) => getSettings().layoutOptions.inputWinClosed = val);
    public static previewWinClosed = new SettingObserver(() => getSettings().layoutOptions.previewWinClosed, (val) => getSettings().layoutOptions.previewWinClosed = val);
    public static outputWinClosed = new SettingObserver(() => getSettings().layoutOptions.outputWinClosed, (val) => getSettings().layoutOptions.outputWinClosed = val);
    public static statsWinClosed = new SettingObserver(() => getSettings().layoutOptions.statsWinClosed, (val) => getSettings().layoutOptions.statsWinClosed = val);
    public static consoleWinClosed = new SettingObserver(() => getSettings().layoutOptions.consoleWinClosed, (val) => getSettings().layoutOptions.consoleWinClosed = val);

    public static keybinds: Record<string, SettingObserver<KeyChord[]>> = {
        [KeybindT.nextFrame.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.nextFrame.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.nextFrame.settingsKey].orBinds = val),
        [KeybindT.prevFrame.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.prevFrame.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.prevFrame.settingsKey].orBinds = val),
        [KeybindT.nextStat.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.nextStat.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.nextStat.settingsKey].orBinds = val),
        [KeybindT.prevStat.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.prevStat.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.prevStat.settingsKey].orBinds = val),
        [KeybindT.toggleTooltip.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.toggleTooltip.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.toggleTooltip.settingsKey].orBinds = val),
        [KeybindT.renderModeBitMap.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.renderModeBitMap.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.renderModeBitMap.settingsKey].orBinds = val),
        [KeybindT.renderModeSvg.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.renderModeSvg.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.renderModeSvg.settingsKey].orBinds = val),
        [KeybindT.renderModeOccupancy.settingsKey]: new SettingObserver(() => getSettings().keybinds[KeybindT.renderModeOccupancy.settingsKey].orBinds, (val) => getSettings().keybinds[KeybindT.renderModeOccupancy.settingsKey].orBinds = val),
    }

    public static notifyAll(): void {
        for (let obs of allSettingObservers) {
            obs.notify();
        }
    }

    private readonly getter: () => T;
    private readonly setter: (val: T) => void;
    private readonly changeListeners: ((val: T) => void)[];

    constructor(getter: () => T, setter: (val: T) => void) {
        this.getter = getter;
        this.setter = setter;
        this.changeListeners = [];
        allSettingObservers.push(this);
    }

    public addListener(listener: (val: T) => void, callInit: boolean = true): void {
        this.changeListeners.push(listener);
        if (callInit) {
            listener(this.getter());
        }
    }

    public notify() {
        if (this.changeListeners.length > 0) {
            const newValue = this.getter();
            for (let listener of this.changeListeners) {
                listener(newValue);
            }
        }
    }

    public get(): T {
        return this.getter();
    }

    public set(value: T, forceNotify: boolean = false): void {
        const prevValue = this.getter();
        this.setter(value);
        const newValue = this.getter();
        if (forceNotify || prevValue !== newValue) {
            this.notify();
        }
    }
}

class LocalStorageTimer {
    private timer: number | undefined = undefined;

    set dirty(dirty: boolean) {
        if (dirty) {
            if (this.timer !== undefined) {
                return; // already marked as dirty.
            }
            if (!SettingObserver.saveToBrowserAutomatically.get()) {
                return;
            }

            const self = this;
            this.timer = window.setTimeout(() => {
                self.timer = undefined;
                if (SettingObserver.saveToBrowserAutomatically.get()) {
                    console.debug("LocalStorageTimer is saving to localStorage");
                    SettingsManager.exportToLocalStorage();
                }
            }, 2000);
        } else {
            if (this.timer === undefined) {
                return;
            }

            window.clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}

export class SettingsManager {
    private static initDone: boolean = false;
    private static settings: Settings;
    private static readonly localStorageKey: string = "settings";
    private static readonly localStorageTimer: LocalStorageTimer = new LocalStorageTimer();

    public static getSettings(): Settings {
        SettingsManager.init();
        return SettingsManager.settings;
    }

    public static init(): void {
        if (SettingsManager.initDone)
            return;

        SettingsManager.settings = getDefaultSettings();
        if (window.localStorage) {
            try {
                const storedSettings = window.localStorage.getItem(SettingsManager.localStorageKey);
                if (storedSettings) {
                    console.debug("retrieved settings from localStorage");
                    SettingsManager.settings = JSON.parse(storedSettings);
                }
            } catch (e) {
                console.error("failed to fetch settings from localStorage", e);
                SettingsManager.settings = getDefaultSettings();
            }
        }

        SettingsManager.initDone = true;
        SettingObserver.profile.addListener(_ => {
            // notify each listener
            SettingObserver.solverShapeCodes.notify();
            SettingObserver.solverFluidCodes.notify();
            SettingObserver.solverIgnoredCodes.notify();
            SettingObserver.solverFallbackMode.notify();
            SettingObserver.solverShapeMiner.notify();
            SettingObserver.solverShapeMinerPresetId.notify();
            SettingObserver.solverFluidMiner.notify();
            SettingObserver.solverFluidMinerPresetId.notify();
            SettingObserver.solverP1MaxLookahead.notify();
            SettingObserver.solverP1PreScanCwCount.notify();
            SettingObserver.solverP1PreScanCcwCount.notify();
            SettingObserver.solverP2OptimizeOccupied.notify();
            SettingObserver.solverP2TargetMinScore.notify();
            SettingObserver.solverP2MaxRetryMiners.notify();
            SettingObserver.solverP3MaxBeamWidth.notify();
            SettingObserver.solverP3ReduceBeamWidthNTiles.notify();
        });

        const registerBpPresetIdListener = (presetProp: SettingObserver<string>, bpProp: SettingObserver<string>) => {
            presetProp.addListener(val => {
                if (val !== "custom") {
                    bpProp.set("");
                    fetch(`resources/minerBlueprints/${val}`).then(resp => {
                        if (resp.ok) {
                            resp.text().then(txt => {
                                bpProp.set(txt);
                            });
                        } else {
                            bpProp.set("ERROR");
                            Logger.error(`Failed to fetch miner blueprint '${val}':`, resp);
                        }
                    });
                }
            });
        }
        registerBpPresetIdListener(SettingObserver.solverShapeMinerPresetId, SettingObserver.solverShapeMiner);
        registerBpPresetIdListener(SettingObserver.solverFluidMinerPresetId, SettingObserver.solverFluidMiner);

        SettingObserver.saveToBrowserAutomatically.addListener(val => {
            if (val) {
                SettingsManager.exportToLocalStorage();
            }
        });

        const self = this;
        for(let obs of allSettingObservers) {
            obs.addListener(() => self.localStorageTimer.dirty = true, false);
        }
    }

    public static resetAll(): void {
        SettingsManager.settings = getDefaultSettings();
        SettingObserver.notifyAll();
    }

    public static exportToLocalStorage(): boolean {
        this.localStorageTimer.dirty = false;
        try {
            const data = JSON.stringify(getSettings());
            window.localStorage.setItem(SettingsManager.localStorageKey, data);
            return true;
        } catch (e) {
            console.error("failed to save settings to local storage", e);
            return false;
        }
    }

    public static importFromLocalStorage(): boolean {
        try {
            const dataStr = window.localStorage.getItem(SettingsManager.localStorageKey);
            if (dataStr) {
                SettingsManager.setSettingsFromJson(dataStr);
                return true;
            }
        } catch (e) {
            console.error("failed to load settings from local storage", e);
        }
        return false;
    }

    public static exportSettingsToFile(): void {
        const data = JSON.stringify(getSettings());
        const filename = "Shapez2MinerSolver.json";

        const btn = document.createElement("a");
        btn.setAttribute("href", `data:text/plain;charset=utf-8,${encodeURIComponent(data)}`);
        btn.setAttribute("download", filename);
        btn.style.display = "none";
        document.body.appendChild(btn);
        btn.click();
        document.body.removeChild(btn);
    }

    public static importSettingsFromFile(): void {
        let inputElem = document.createElement("input");
        inputElem.setAttribute("type", "file");
        inputElem.setAttribute("accept", "application/json");
        inputElem.style.display = "none";

        inputElem.onchange = () => {
            if (inputElem.files === undefined || inputElem.files === null || inputElem.files.length <= 0) {
                console.log("Import was aborted (received no file)");
                return;
            }

            inputElem.files[0].text().then((dataStr) => {
                SettingsManager.setSettingsFromJson(dataStr);
            });
        }

        document.body.appendChild(inputElem);
        inputElem.click();
        document.body.removeChild(inputElem);
    }

    private static setSettingsFromJson(settingsStr: string): void {
        SettingsManager.settings = <Settings>JSON.parse(settingsStr); // very safe, yes yes :)
        SettingObserver.notifyAll();
    }
}

export function getSettings(): Settings {
    return SettingsManager.getSettings();
}

export class SettingsHelper {
    public static clone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    public static getProfile(name: string): NamedSolverProfile | undefined {
        const _settings = getSettings();
        for (let profile of _settings.solverProfiles.savedProfiles) {
            if (profile.name === name) {
                return profile;
            }
        }
        return undefined;
    }

    public static getSolverSettings(): SavableSolverOptions {
        const _settings = getSettings();
        const profileName = _settings.solverProfiles.activeProfile;
        let profile: NamedSolverProfile | undefined = SettingsHelper.getProfile(profileName);
        if (profile !== undefined)
            return profile.profile;

        console.error(`No profile of name '${profileName}' could be found in settings. Reset to default.`);
        profile = {
            name: profileName,
            profile: getDefaultSolverOptions(),
        };
        SettingsHelper.saveProfile(profile);
        return profile.profile;
    }

    public static resetProfile(name?: string): void {
        const _settings = getSettings();
        const activeProfileName = _settings.solverProfiles.activeProfile;

        if (name === undefined) {
            name = activeProfileName;
        }
        const activeProfileEdited = activeProfileName === name;

        const profile = SettingsHelper.getProfile(name);
        if (profile === undefined) {
            console.error(`failed to reset profile '${name}', because profile was not found in saved data.`);
            return;
        }

        profile.profile = getDefaultSolverOptions();
        if (activeProfileEdited) {
            SettingObserver.profile.notify();
        }
    }

    public static deleteProfile(name?: string): void {
        const _settings = getSettings();
        const activeProfileName = _settings.solverProfiles.activeProfile;

        if (name === undefined) {
            name = activeProfileName;
        }
        const activeProfileDeleted = activeProfileName === name;

        const profileIdx = _settings.solverProfiles.savedProfiles.map(p => p.name).indexOf(name);
        if (profileIdx < 0) {
            console.error(`failed to delete profile '${name}', because profile was not found in saved data.`);
            return;
        }

        _settings.solverProfiles.savedProfiles.splice(profileIdx, 1);
        if (_settings.solverProfiles.savedProfiles.length <= 0) {
            SettingsHelper.saveProfile({ name: "default", profile: getDefaultSolverOptions() }, undefined, true);
        }

        if (activeProfileDeleted) {
            const newProfileIdx = Math.min(profileIdx, _settings.solverProfiles.savedProfiles.length - 1);
            const newProfileName = _settings.solverProfiles.savedProfiles[newProfileIdx].name;
            SettingObserver.profile.set(newProfileName, true);
        }
        SettingObserver.profiles.notify();
    }

    public static saveProfile(profile: NamedSolverProfile, overwriteCallback?: () => boolean, skipNotify: boolean = false): void {
        const existingProfile = SettingsHelper.getProfile(profile.name);
        if (existingProfile !== undefined) {
            if (overwriteCallback !== undefined) {
                const overwriteOk = overwriteCallback();
                if (!overwriteOk) {
                    return;
                }
            }
            existingProfile.profile = profile.profile;
            return;
        }

        getSettings().solverProfiles.savedProfiles.push(profile);
        if (!skipNotify)
            SettingObserver.profiles.notify();
    }
}

export function getDefaultSolverOptions(): SavableSolverOptions {
    return {
        impl: {
            parser: {
                shapeCodes: ["Layout_ShapeMiner", "Layout_ShapeMinerExtension"],
                fluidCodes: ["Layout_FluidMiner", "Layout_FluidMinerExtension"],
                ignoredCodes: [],
                fallbackMode: "shape",
            },
            phase1: {
                maxLookahead: 6,
                preScanCwCount: 4,
                preScanCcwCount: 4,
            },
            phase2: {
                optimizeOccupied: false,
                targetMinScore: 3,
                maxRetryMiners: 10,
            },
            phase3: {
                maxBeamWidth: 2,
                reduceBeamWidthNTiles: 750,
            },
            shapeMinerBpStr: "NOT READY",
            fluidMinerBpStr: "NOT READY",
        },
        solverShapeMinerPresetId: "shape_f3_1_cheapest_v2.spz2",
        solverFluidMinerPresetId: "fluid_f3_1_default.spz2",
    };
}

export function getDefaultSettings(): Settings {
    return {
        solverProfiles: {
            activeProfile: "default",
            savedProfiles: [
                {
                    name: "default",
                    profile: getDefaultSolverOptions(),
                }
            ]
        },
        tooltipOptions: {
            enable: true,
            showWorldCoordinates: true,
            showIslandCoordinates: false,
            showIslandId: true,
            showIslandType: true,
            showErrors: true,
            showWarnings: true,
        },
        renderMode: RenderMode.BitMap,
        liveUpdate: true,
        layoutOptions: {
            windowWidth: 600,
            sidebarWidth: 400,
            previewHeight: 400,
            previewResolutionScale: 1,
            consoleHeight: 300,
            fontScale: 1,
            decorationScale: 1,
            colorShift: 0,

            inputWinClosed: false,
            previewWinClosed: false,
            outputWinClosed: false,
            statsWinClosed: false,
            consoleWinClosed: false,
        },
        keybinds: {
            [KeybindT.nextFrame.settingsKey]: Keybind.ofSingleKey("Period"),
            [KeybindT.prevFrame.settingsKey]: Keybind.ofSingleKey("Comma"),
            [KeybindT.nextStat.settingsKey]: Keybind.ofSingleKey("ArrowRight"),
            [KeybindT.prevStat.settingsKey]: Keybind.ofSingleKey("ArrowLeft"),
            [KeybindT.toggleTooltip.settingsKey]: Keybind.ofSingleKey("KeyT"),
            [KeybindT.renderModeBitMap.settingsKey]: Keybind.orKeys(["Digit1", "Numpad1"]),
            [KeybindT.renderModeSvg.settingsKey]: Keybind.orKeys(["Digit2", "Numpad2"]),
            [KeybindT.renderModeOccupancy.settingsKey]: Keybind.orKeys(["Digit3", "Numpad3"]),
        },
        saveToBrowserAutomatically: true,
    };
}
