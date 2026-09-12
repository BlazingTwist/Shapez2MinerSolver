import { Logger } from "./Logger.js";
import { Strings } from "./Strings.js";

export interface SolverOptions {
    parser: BlueprintParseOptions;
    phase1: Phase1Options;
    phase2: Phase2Options;
    phase3: Phase3Options;
    shapeMinerBpStr: string;
    fluidMinerBpStr: string;
}

export interface BlueprintParseOptions {
    shapeCodes: string[];
    fluidCodes: string[];
    ignoredCodes: string[];
    fallbackMode: "shape" | "fluid" | "ignored";
}

export interface Phase1Options {
    maxLookahead: number;
    preScanCwCount: number;
    preScanCcwCount: number;
}

export interface Phase2Options {
    targetMinScore: number;
    optimizeOccupied: boolean;
    maxRetryMiners: number;
}

export interface Phase3Options {
    maxBeamWidth: number;
    reduceBeamWidthNTiles: number;
}

export enum Phase {
    Phase0,
    Phase1,
    Phase2,
    Phase3,
    FinishSingle,
}

export interface StatNumMiners {
    numEdgeMiners: number;
    numCenterMiners: number;
}

export interface SolutionStats {
    numShapeMiners: StatNumMiners;
    numFluidMiners: StatNumMiners;
    numGapTiles: number;
    numGapIslands: number;
    runtime: PhaseRuntime[];
}

type Pointer = number;
type i32 = number;
type u8 = number;
type u32 = number;
type usize = number;
export type SolverId = u32;

interface WasmJsImpl extends Record<string, WebAssembly.ImportValue> {
    memory: WebAssembly.Memory;

    reportError(msgPtr: Pointer, msgLen: number): void;

    logWarning(msgPtr: Pointer, msgLen: number): void;

    getTimestampMillis(): bigint;

    onAsteroidParsed(jsonPtr: Pointer, jsonLen: number): void;

    onEdgeMinerPlacement(solverId: SolverId, xCoordsPtr: Pointer, yCoordsPtr: Pointer): void;

    onCenterMinerPlacement(solverId: SolverId, xCoordsPtr: Pointer, yCoordsPtr: Pointer): void;

    onUndoPlacement(solverId: SolverId): void;

    onTileRotation(tileX: u32, tileY: u32, rotation: u8): void;

    onStatsComputed(edgeMiners: i32, centerMiners: i32, gapTiles: i32, gapIslands: i32): void;

    onSolutionBpMerged(bpPtr: Pointer, bpLen: number): void;
}

interface WasmZigImpl {
    resetArena(): void;

    allocBytes(len: number): Pointer;

    parseOptions(optionsJson: Pointer, len: number): Pointer;

    parseBlueprint(bpPtr: Pointer, bpLen: number, optionsPtr: Pointer): number;

    phase0(roid: Pointer): Pointer;

    phase1_init(p0: Pointer, workItem: Pointer): Pointer;

    phase1_step(roid: Pointer, p0: Pointer, p1: Pointer, workItem: Pointer, timeoutMillis: number): number;

    phase2_init(p0: Pointer, p1: Pointer): Pointer;

    phase2_step(roid: Pointer, p0: Pointer, p2: Pointer, workItem: Pointer, timeoutMillis: number): number;

    phase3_init(p0: Pointer, workItem: Pointer): Pointer;

    phase3_step(roid: Pointer, p0: Pointer, p3: Pointer, workItem: Pointer, timeoutMillis: number): number;

    finishSingle(roid: Pointer, p0: Pointer, p1: Pointer, p2: Pointer, p3: Pointer, workItem: Pointer): number;

    mergeBlueprintsToStr(workItem: Pointer): number;
}

export interface Asteroid {
    bufferPtr: Pointer;
    bufferLen: number;
    originX: i32;
    originY: i32;
    asteroidType: "shape" | "fluid";
    maxX: u32;
    maxY: u32;
    posXArr: u32[];
    posYArr: u32[];
    posLen: usize;
}

export interface Coordinate {
    x: number,
    y: number,
}

export interface MinerPlacement {
    miner: Coordinate,
    ext1: Coordinate,
    ext2: Coordinate,
    ext3: Coordinate,
}

export interface EdgeMiner extends MinerPlacement {
}

export interface CenterMiner {
    belt: Coordinate,
    lift: Coordinate,
    miner1: MinerPlacement,
    miner2: MinerPlacement,
    miner3: MinerPlacement,
}

export interface WorkItem<TSelf extends WorkItem<TSelf>> {
    stopped: boolean;
    blueprint: string;
    options: SolverOptions;

    onError(self: TSelf, roidIdx: number, message: string): void;

    onWarning(self: TSelf, roidIdx: number, message: string): void;

    /**
     * Called once per Asteroid contained in the {@link blueprint}.
     */
    onAsteroidParsed(self: TSelf, roidIdx: number, parserResult: Asteroid): void;

    onAsteroidFailed(self: TSelf, roidIdx: number): void;

    onPhaseComplete(self: TSelf, roidIdx: number, phase: Phase): void;

    onEdgeMinerPlacement(self: TSelf, roidIdx: number, solverId: SolverId, miner: EdgeMiner): void;

    onCenterMinerPlacement(self: TSelf, roidIdx: number, solverId: SolverId, miner: CenterMiner): void;

    onUndoPlacement(self: TSelf, roidIdx: number, solverId: SolverId): void;

    onTileRotation(self: TSelf, roidIdx: number, tileX: number, tileY: number, rotation: number): void;

    onIslandStatsCalculated(self: TSelf, roidIdx: number, wasmSolverStats: WasmSolverStats, runtime: PhaseRuntime[]): void;

    onSolutionBpMerged(self: TSelf, blueprint: string): void;
}

interface SimpleIterator<T> {
    next(): T | undefined;
}

export interface PhaseRuntime {
    label: string;
    millis: number;
}

export interface WasmSolverStats {
    numEdgeMiners: i32;
    numCenterMiners: i32;
    numGapTiles: i32;
    numGapIslands: i32;
}

class CurrentAsteroidData {
    roidIdx: number;
    solverStats: WasmSolverStats | undefined;
    runtime: PhaseRuntime[];

    constructor(roidIdx: number) {
        this.roidIdx = roidIdx;
        this.solverStats = undefined;
        this.runtime = [];
    }

    public pushRuntime(label: string, millis: number): void {
        this.runtime.push({
            label: label,
            millis: millis,
        });
    }
}

export class ShapezSolverWasm {
    private static instance?: ShapezSolverWasm = undefined;
    private static workItems: WorkItem<any>[] = [];
    private static readonly onNoLongerBusyCallbacks: (() => void)[] = [];

    public static async init(): Promise<ShapezSolverWasm> {
        if (ShapezSolverWasm.instance === undefined) {
            ShapezSolverWasm.instance = new ShapezSolverWasm();
            await ShapezSolverWasm.instance.init();
        }
        return ShapezSolverWasm.instance;
    }

    public static cancelAllItems(): void {
        if (!ShapezSolverWasm.instance?.busy) {
            ShapezSolverWasm.notifyNoLongerBusyCallbacks();
            return;
        }

        for (let item of ShapezSolverWasm.workItems) {
            item.stopped = true;
        }
    }

    public static pushWork(item: WorkItem<any>): void {
        ShapezSolverWasm.workItems.push(item);
        ShapezSolverWasm.init().then(instance => {
            if (!instance.busy) {
                instance.processWorkItem();
            }
        });
    }

    public static addNoLongerBusyCallback(callback: () => void): void {
        ShapezSolverWasm.onNoLongerBusyCallbacks.push(callback);
    }

    private static notifyNoLongerBusyCallbacks(): void {
        for (let callback of ShapezSolverWasm.onNoLongerBusyCallbacks) {
            callback();
        }
    }

    busy: boolean;
    jsImpl: WasmJsImpl;
    zigImpl?: WasmZigImpl;
    private curAsteroids: Asteroid[];
    private currentAsteroid?: CurrentAsteroidData;

    private constructor() {
        this.busy = false;

        this.jsImpl = {
            // zig stack requires 31 pages.
            // A "regular sized" asteroid requires <1 MB of allocations (-> +16 pages)
            // The 100x100 test-grid requires 10 MB
            // Limit to 50 MB. (800 pages)
            memory: new WebAssembly.Memory({ initial: 31 + 16, maximum: 800, shared: false }),
            reportError: this.reportError,
            logWarning: this.logWarning,
            getTimestampMillis: this.getTimeMillis,
            onAsteroidParsed: this.onAsteroidParsed,
            onEdgeMinerPlacement: this.onEdgeMinerPlacement,
            onCenterMinerPlacement: this.onCenterMinerPlacement,
            onUndoPlacement: this.onUndoPlacement,
            onTileRotation: this.onTileRotation,
            onStatsComputed: this.onStatsComputed,
            onSolutionBpMerged: this.onSolutionBpMerged,
        }

        this.zigImpl = undefined;
        this.curAsteroids = [];
        this.currentAsteroid = undefined;
    }

    private resolveExportFn<T>(wasmInstance: WebAssembly.WebAssemblyInstantiatedSource, fnName: string): T {
        const fn = wasmInstance.instance!.exports[fnName];
        if (fn === undefined)
            throw new Error(`Wasm implementation does not export function ${fnName}`);
        return (<T>fn);
    }

    private async init(): Promise<void> {
        const self = this;
        await fetch("/zig-out/bin/ShapezMinerSolver-Wasm.wasm") // development url
            .then(response => {
                if (response.ok) {
                    return response;
                } else {
                    const fallbackPath = "/ShapezMinerSolver-Wasm.wasm"; // static site url
                    console.log("fallback to", fallbackPath);
                    return fetch(fallbackPath).then(fallbackResponse => {
                        if (fallbackResponse.ok) {
                            return fallbackResponse;
                        } else {
                            Logger.error("unable to find ShapezMinerSolver-Wasm", response, fallbackResponse);
                            window.alert("Solver WASM could not be loaded. The solver will not work.")
                        }
                    });
                }
            })
            .then(response => response!.blob())
            .then(blob => new Response(blob.stream(), { headers: { "Content-Type": "application/wasm" } }).arrayBuffer())
            .then(wasmBuffer => WebAssembly.instantiate(wasmBuffer, {
                env: self.jsImpl
            }))
            .then(wasmInstance => {
                console.log("wasm fetched");
                self.zigImpl = {
                    resetArena: self.resolveExportFn(wasmInstance, "resetArena"),
                    allocBytes: self.resolveExportFn(wasmInstance, "allocBytes"),
                    parseOptions: self.resolveExportFn(wasmInstance, "parseOptions"),
                    parseBlueprint: self.resolveExportFn(wasmInstance, "parseBlueprint"),
                    phase0: self.resolveExportFn(wasmInstance, "phase0"),
                    phase1_init: self.resolveExportFn(wasmInstance, "phase1_init"),
                    phase1_step: self.resolveExportFn(wasmInstance, "phase1_step"),
                    phase2_init: self.resolveExportFn(wasmInstance, "phase2_init"),
                    phase2_step: self.resolveExportFn(wasmInstance, "phase2_step"),
                    phase3_init: self.resolveExportFn(wasmInstance, "phase3_init"),
                    phase3_step: self.resolveExportFn(wasmInstance, "phase3_step"),
                    finishSingle: self.resolveExportFn(wasmInstance, "finishSingle"),
                    mergeBlueprintsToStr: self.resolveExportFn(wasmInstance, "mergeBlueprintsToStr"),
                }
            });
    }

    private processWorkItem() {
        const self = ShapezSolverWasm.instance!;
        self.busy = true;

        ShapezSolverWasm.workItems = ShapezSolverWasm.workItems.filter(item => !item.stopped);
        if (ShapezSolverWasm.workItems.length <= 0) {
            self.busy = false;
            ShapezSolverWasm.notifyNoLongerBusyCallbacks();
            return;
        }

        let item = ShapezSolverWasm.workItems[0];
        try {
            self.processSingleItem(item)
                .then(() => {
                    item.stopped = true;
                    self.processWorkItem();
                    Logger.info("Solved item", item);
                })
                .catch(e => {
                    Logger.error("error while processing item.", item, e);
                    window.alert("error while processing item: " + e);
                    item.stopped = true;
                    self.processWorkItem();
                });
        } catch (error) {
            Logger.error("error while dispatching item to be processed.", item, error);
            window.alert("error while dispatching item to be processed: " + error);
            item.stopped = true;
            self.processWorkItem();
        }
    }

    private async processSingleItem(item: WorkItem<any>) {
        const self = ShapezSolverWasm.instance!;
        if (self.zigImpl === undefined) {
            throw new Error("zigImpl was not ready");
        }
        self.zigImpl.resetArena();
        self.curAsteroids = [];
        self.currentAsteroid = undefined;

        const checkInterrupt = async () => {
            if (globalThis.scheduler?.yield) {
                await globalThis.scheduler.yield();
            }
            if (item.stopped) {
                throw new Error("task interrupted");
            }
        }

        if(item.blueprint.trim().length == 0) {
            throw new Error("Input blueprint must not be empty");
        }

        const parseStart = performance.now();
        const encodedBp = new TextEncoder().encode(item.blueprint);
        const bpOffset = self.zigImpl.allocBytes(encodedBp.length);
        const bpMem = new Uint8Array(self.jsImpl.memory.buffer, bpOffset, encodedBp.length);
        bpMem.set(encodedBp);

        const optionsStr = JSON.stringify(item.options);
        const encodedOptions = new TextEncoder().encode(optionsStr);
        const optionsStrOffset = self.zigImpl.allocBytes(encodedOptions.length);
        let optionsMem = new Uint8Array(self.jsImpl.memory.buffer, optionsStrOffset, encodedOptions.length);
        optionsMem.set(encodedOptions);

        const workItemPtr = self.zigImpl.parseOptions(optionsStrOffset, encodedOptions.length);
        if (workItemPtr === 0) {
            throw new Error("abort item, because parseOptions() failed");
        }
        await checkInterrupt();

        const parseStatus = self.zigImpl.parseBlueprint(bpOffset, encodedBp.length, workItemPtr);
        if (parseStatus !== 0) {
            throw new Error(`abort item, because parseBlueprint() failed. (status ${parseStatus})`);
        }

        const parseEnd = performance.now();
        let parseMillis = parseEnd - parseStart;

        let roidIdx = -1;
        roidLoop: for (let roid of self.curAsteroids) {
            await checkInterrupt();

            roidIdx += 1;
            const curRoidData = new CurrentAsteroidData(roidIdx);
            self.currentAsteroid = curRoidData;
            const p0Start = performance.now();
            const p0 = self.zigImpl.phase0(roid.bufferPtr);
            if (p0 === 0) {
                self.onIslandFailure(item, roidIdx, "Phase0 failed");
                continue;
            }
            await checkInterrupt();
            item.onPhaseComplete(item, roidIdx, Phase.Phase0);

            const p1Start = performance.now();
            curRoidData.pushRuntime(Strings.phase0Title, p1Start - p0Start + parseMillis);
            parseMillis = 0; // attribute initial parsing to Phase 0 of first island

            const p1 = self.zigImpl.phase1_init(p0, workItemPtr);
            if (p1 === 0) {
                self.onIslandFailure(item, roidIdx, "Phase1_init failed");
                continue;
            }
            await checkInterrupt();

            while (true) {
                const p1Status = self.zigImpl.phase1_step(roid.bufferPtr, p0, p1, workItemPtr, 100);
                await checkInterrupt();
                if (p1Status < 0) {
                    self.onIslandFailure(item, roidIdx, `Phase1_step failed. (status: ${p1Status})`);
                    continue roidLoop;
                }
                if (p1Status === 0) {
                    // Phase1 fully processed.
                    break;
                }
            }

            const p1End = performance.now();
            item.onPhaseComplete(item, roidIdx, Phase.Phase1);
            curRoidData.pushRuntime(Strings.phase1Title, p1End - p1Start);

            const p2 = self.zigImpl.phase2_init(p0, p1);
            if (p2 === 0) {
                self.onIslandFailure(item, roidIdx, "Phase2_init failed");
                continue;
            }
            await checkInterrupt();

            while (true) {
                const p2Status = self.zigImpl.phase2_step(roid.bufferPtr, p0, p2, workItemPtr, 100);
                await checkInterrupt();
                if (p2Status < 0) {
                    self.onIslandFailure(item, roidIdx, `Phase2_step failed. (status: ${p2Status})`);
                    continue roidLoop;
                }
                if (p2Status === 0) {
                    // Phase2 fully processed.
                    break;
                }
            }

            const p2End = performance.now();
            item.onPhaseComplete(item, roidIdx, Phase.Phase2);
            curRoidData.pushRuntime(Strings.phase2Title, p2End - p1End);

            const p3 = self.zigImpl.phase3_init(p0, workItemPtr);
            if (p3 === 0) {
                self.onIslandFailure(item, roidIdx, "Phase3_init failed");
                continue;
            }
            await checkInterrupt();

            while (true) {
                const p3Status = self.zigImpl.phase3_step(roid.bufferPtr, p0, p3, workItemPtr, 100);
                await checkInterrupt();
                if (p3Status < 0) {
                    self.onIslandFailure(item, roidIdx, `Phase3_step failed. (status: ${p3Status})`);
                    continue roidLoop;
                }
                if (p3Status === 0) {
                    // Phase2 fully processed.
                    break;
                }
            }

            const p3End = performance.now();
            item.onPhaseComplete(item, roidIdx, Phase.Phase3);
            curRoidData.pushRuntime(Strings.phase3Title, p3End - p2End);

            const finishSingleStatus = self.zigImpl.finishSingle(roid.bufferPtr, p0, p1, p2, p3, workItemPtr);
            if (finishSingleStatus < 0) {
                self.onIslandFailure(item, roidIdx, `finishSingle failed. (status: ${finishSingleStatus})`);
                continue;
            }
            const finishSingleEnd = performance.now();
            item.onPhaseComplete(item, roidIdx, Phase.FinishSingle);
            curRoidData.pushRuntime("Finisher (rotate islands, calculate stats)", finishSingleEnd - p3End);
            item.onIslandStatsCalculated(item, curRoidData.roidIdx, curRoidData.solverStats!, curRoidData.runtime);
        }
        self.currentAsteroid = undefined;

        const mergeBpStatus = self.zigImpl.mergeBlueprintsToStr(workItemPtr);
        if (mergeBpStatus < 0) {
            throw new Error(`abort item, because mergeBlueprintsToStr() failed. (status ${mergeBpStatus})`);
        }
    }

    private onIslandFailure(item: WorkItem<any>, roidIdx: number, failMsg: string) {
        item.onAsteroidFailed(item, roidIdx);
        item.onError(item, roidIdx, failMsg);
    }


    private readMemoryString(pos: Pointer, len: number): string {
        const self = ShapezSolverWasm.instance!;
        let strView = new DataView(self.jsImpl.memory.buffer, pos, len);
        return new TextDecoder().decode(strView);
    }

    private getTimeMillis(): bigint {
        return BigInt(Math.floor(performance.now()));
    }

    private reportError(msgPtr: Pointer, msgLen: number): void {
        const self = ShapezSolverWasm.instance!;
        const err = self.readMemoryString(msgPtr, msgLen);

        Logger.error(err);
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            item.onError(item, self.currentAsteroid!.roidIdx, err);
        }
    }

    private logWarning(msgPtr: Pointer, msgLen: number): void {
        const self = ShapezSolverWasm.instance!;
        const warn = self.readMemoryString(msgPtr, msgLen);

        Logger.warn(warn);
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            item.onWarning(item, self.currentAsteroid!.roidIdx, warn);
        }
    }

    private onAsteroidParsed(jsonPtr: Pointer, jsonLen: number) {
        const self = ShapezSolverWasm.instance!;
        const asteroid: Asteroid = JSON.parse(self.readMemoryString(jsonPtr, jsonLen));
        const roidIdx = self.curAsteroids.length;
        self.curAsteroids.push(asteroid);

        if (ShapezSolverWasm.workItems.length > 0) {
            const item = ShapezSolverWasm.workItems[0];
            item.onAsteroidParsed(item, roidIdx, asteroid);
        }
    }

    private coordsIter(xCoordsPtr: Pointer, yCoordsPtr: Pointer, len: number): SimpleIterator<Coordinate> {
        const self = ShapezSolverWasm.instance!;
        const xView = new DataView(self.jsImpl.memory.buffer, xCoordsPtr, len * 4);
        const yView = new DataView(self.jsImpl.memory.buffer, yCoordsPtr, len * 4);
        return new class implements SimpleIterator<Coordinate> {
            offset: number;

            constructor() {
                this.offset = 0;
            }

            next(): Coordinate | undefined {
                if (this.offset >= len)
                    return undefined;

                const result: Coordinate = {
                    x: xView.getUint32(this.offset * 4, true),
                    y: yView.getUint32(this.offset * 4, true),
                }
                this.offset += 1;
                return result;
            }
        }
    }

    private readMinerCoords(iter: SimpleIterator<Coordinate>): MinerPlacement {
        return {
            miner: iter.next()!,
            ext1: iter.next()!,
            ext2: iter.next()!,
            ext3: iter.next()!,
        };
    }

    private onEdgeMinerPlacement(solverId: SolverId, xCoordsPtr: Pointer, yCoordsPtr: Pointer): void {
        const self = ShapezSolverWasm.instance!;
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            const iter = self.coordsIter(xCoordsPtr, yCoordsPtr, 4);
            item.onEdgeMinerPlacement(item, self.currentAsteroid!.roidIdx, solverId, self.readMinerCoords(iter));
        }
    }

    private onCenterMinerPlacement(solverId: SolverId, xCoordsPtr: Pointer, yCoordsPtr: Pointer): void {
        const self = ShapezSolverWasm.instance!;
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            const iter = self.coordsIter(xCoordsPtr, yCoordsPtr, 14);
            item.onCenterMinerPlacement(item, self.currentAsteroid!.roidIdx, solverId, {
                belt: iter.next()!,
                lift: iter.next()!,
                miner1: self.readMinerCoords(iter),
                miner2: self.readMinerCoords(iter),
                miner3: self.readMinerCoords(iter),
            });
        }
    }

    private onUndoPlacement(solverId: SolverId): void {
        const self = ShapezSolverWasm.instance!;
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            item.onUndoPlacement(item, self.currentAsteroid!.roidIdx, solverId);
        }
    }

    private onTileRotation(tileX: u32, tileY: u32, rotation: u8): void {
        const self = ShapezSolverWasm.instance!;
        if (ShapezSolverWasm.workItems.length > 0 && self.currentAsteroid !== undefined) {
            const item = ShapezSolverWasm.workItems[0];
            item.onTileRotation(item, self.currentAsteroid!.roidIdx, tileX, tileY, rotation);
        }
    }

    private onStatsComputed(edgeMiners: i32, centerMiners: i32, gapTiles: i32, gapIslands: i32): void {
        const self = ShapezSolverWasm.instance!;
        if (self.currentAsteroid !== undefined) {
            self.currentAsteroid.solverStats = {
                numEdgeMiners: edgeMiners,
                numCenterMiners: centerMiners,
                numGapTiles: gapTiles,
                numGapIslands: gapIslands,
            }
        }
    }

    private onSolutionBpMerged(bpPtr: Pointer, bpLen: number) {
        const self = ShapezSolverWasm.instance!;
        const blueprint: string = self.readMemoryString(bpPtr, bpLen);
        if (ShapezSolverWasm.workItems.length > 0) {
            const item = ShapezSolverWasm.workItems[0];
            item.onSolutionBpMerged(item, blueprint);
        }
    }
}

