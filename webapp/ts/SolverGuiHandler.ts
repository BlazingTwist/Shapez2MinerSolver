import {
    Asteroid,
    CenterMiner,
    EdgeMiner,
    Phase,
    PhaseRuntime,
    SolutionStats,
    SolverId,
    SolverOptions,
    StatNumMiners,
    WasmSolverStats,
    WorkItem
} from "./ShapezSolverWasm.js";
import { AsteroidRenderer, createRenderer, RenderMode, SolverEvent, SolverEventType, SolverPlacement } from "./AsteroidRenderer.js";
import { InteractiveCanvas } from "./layout/comp/InteractiveCanvas.js";
import { ColorGenerator, CyanColorGen, GrayScaleGen, YellowPurpleGen } from "./ColorGenerator.js";
import { getSettings, SettingObserver, SettingsHelper } from "./Settings.js";

class RoidData {
    failed: boolean;
    errors: string[];
    warnings: string[];
    parserResult: Asteroid;
    renderData: Map<RenderMode, AsteroidRenderer>;
    curColorGen: ColorGenerator;
    tileRotations: TileRotations;
    numTilesOccupied: number;

    constructor(colorGen: ColorGenerator) {
        this.failed = false;
        this.errors = [];
        this.warnings = [];
        // @ts-ignore
        this.parserResult = undefined;
        this.renderData = new Map<RenderMode, AsteroidRenderer>();
        this.curColorGen = colorGen;
        this.tileRotations = new TileRotations();
        this.numTilesOccupied = 0;
    }

    public getCompletionFraction(): number {
        if (this.failed)
            return 1;
        if (this.parserResult === undefined)
            return 0;

        const totalTiles = this.parserResult.posLen;
        return this.numTilesOccupied / totalTiles;
    }
}

export class TileRotations {
    private readonly rotations: Map<number, Map<number, number>> = new Map<number, Map<number, number>>();

    public put(x: number, y: number, rotation: number): void {
        let column = this.rotations.get(x);
        if (!column) {
            column = new Map<number, number>();
            this.rotations.set(x, column);
        }
        column.set(y, rotation);
    }

    public get(x: number, y: number): number | undefined {
        return this.rotations.get(x)?.get(y);
    }
}

export interface GuiCallback {
    onFrameCountChanged(numFrames: number): void;

    updateCanvas(): void;

    scaleCanvasToFit(maxDx: number, maxDy: number): void;

    onIslandStatsCalculated(stats: SolutionStats): void;

    onSolutionBlueprintReceived(blueprint: string): void;
}

export class SolverGuiHandler implements WorkItem<SolverGuiHandler> {
    stopped: boolean = false;
    blueprint: string;
    options: SolverOptions;
    roidData: RoidData[] = [];
    p1ColorGen: ColorGenerator = new GrayScaleGen();
    p2ColorGen: ColorGenerator = new CyanColorGen();
    p3ColorGen: ColorGenerator = new YellowPurpleGen();
    guiCallback: GuiCallback;
    curFrameCount: number = 0;
    solverPlacementsById: Map<SolverId, SolverPlacement[]> = new Map<SolverId, SolverPlacement[]>();
    roidIdxByCoordinate: Map<string, number> = new Map<string, number>();

    constructor(blueprint: string, guiCallback: GuiCallback) {
        this.blueprint = blueprint;
        this.options = SettingsHelper.getSolverSettings().impl;
        this.guiCallback = guiCallback;
    }

    onError(self: SolverGuiHandler, roidIdx: number, message: string): void {
        self.roidData[roidIdx].errors.push(message);
    }

    onWarning(self: SolverGuiHandler, roidIdx: number, message: string): void {
        self.roidData[roidIdx].warnings.push(message);
    }

    onAsteroidParsed(self: SolverGuiHandler, roidIdx: number, parserResult: Asteroid): void {
        while (roidIdx >= self.roidData.length) {
            self.roidData.push(new RoidData(self.p1ColorGen));
        }

        const roid = self.roidData[roidIdx];
        roid.parserResult = parserResult;
        roid.renderData.set(RenderMode.BitMap, createRenderer(RenderMode.BitMap, parserResult, roid.tileRotations));
        roid.renderData.set(RenderMode.Svg, createRenderer(RenderMode.Svg, parserResult, roid.tileRotations));
        roid.renderData.set(RenderMode.Occupancy, createRenderer(RenderMode.Occupancy, parserResult, roid.tileRotations));

        // store the index by coordinates for tooltip lookup.
        for (let i = 0; i < parserResult.posLen; i++) {
            const x = parserResult.posXArr[i] + parserResult.originX;
            const y = parserResult.posYArr[i] + parserResult.originY;
            self.roidIdxByCoordinate.set(`${x}, ${y}`, roidIdx);
        }

        // Adjust the zoom such that the full bounds are visible when the view is centered on (0,0)
        let maxDx: number = 0;
        let maxDy: number = 0;
        for (let otherRoid of self.roidData) {
            const minX = otherRoid.parserResult.originX;
            const maxX = otherRoid.parserResult.maxX + otherRoid.parserResult.originX;
            const minY = otherRoid.parserResult.originY;
            const maxY = otherRoid.parserResult.maxY + otherRoid.parserResult.originY;
            maxDx = Math.max(maxDx, Math.abs(minX), Math.abs(maxX));
            maxDy = Math.max(maxDy, Math.abs(minY), Math.abs(maxY));
        }
        self.guiCallback.scaleCanvasToFit(maxDx, maxDy);
    }

    onAsteroidFailed(self: SolverGuiHandler, roidIdx: number): void {
        const roid = self.roidData[roidIdx];
        roid.failed = true;
        this.addFrame(roid, {
            type: SolverEventType.Failure,
            color: 0xff0000,
        });
    }

    onPhaseComplete(self: SolverGuiHandler, roidIdx: number, phase: Phase): void {
        const roid = self.roidData[roidIdx];
        switch (phase) {
            case Phase.Phase0:
                roid.curColorGen = self.p1ColorGen;
                break;
            case Phase.Phase1:
                roid.curColorGen = self.p2ColorGen;
                break;
            case Phase.Phase2:
                roid.curColorGen = self.p3ColorGen;
                break;
            case Phase.FinishSingle:
                self.guiCallback.updateCanvas();
                break;
        }
    }

    onEdgeMinerPlacement(self: SolverGuiHandler, roidIdx: number, solverId: SolverId, miner: EdgeMiner): void {
        const roid = self.roidData[roidIdx];
        const frame: SolverPlacement = {
            type: SolverEventType.EdgeMiner,
            color: roid.curColorGen.next(),
            miner: miner,
        };
        roid.numTilesOccupied += 4;
        this.storeSolverPlacement(solverId, frame);
        this.addFrame(roid, frame);
    }

    onCenterMinerPlacement(self: SolverGuiHandler, roidIdx: number, solverId: SolverId, miner: CenterMiner): void {
        const roid = self.roidData[roidIdx];
        const frame: SolverPlacement = {
            type: SolverEventType.CenterMiner,
            color: roid.curColorGen.next(),
            miner: miner,
        };
        roid.numTilesOccupied += 14;
        this.storeSolverPlacement(solverId, frame);
        this.addFrame(roid, frame);
    }

    onUndoPlacement(self: SolverGuiHandler, roidIdx: number, solverId: SolverId): void {
        const roid = self.roidData[roidIdx];
        const revFrame = this.findSolverPlacement(solverId);
        if (revFrame === undefined)
            throw new Error(`got undo-event for a frame that was never 'done'. solverId: ${solverId}`);

        const frame: SolverEvent = {
            type: SolverEventType.Undo,
            target: revFrame,
        };
        if (revFrame.type == SolverEventType.EdgeMiner) {
            roid.numTilesOccupied -= 4;
        } else if (revFrame.type == SolverEventType.CenterMiner) {
            roid.numTilesOccupied -= 14;
        }
        this.addFrame(roid, frame);
    }

    onTileRotation(self: SolverGuiHandler, roidIdx: number, tileX: number, tileY: number, rotation: number): void {
        const roid = self.roidData[roidIdx];
        roid.tileRotations.put(tileX, tileY, rotation);
    }

    onIslandStatsCalculated(self: SolverGuiHandler, roidIdx: number, wasmSolverStats: WasmSolverStats, runtime: PhaseRuntime[]): void {
        const roid = self.roidData[roidIdx];
        const zeroCount: StatNumMiners = {
            numEdgeMiners: 0,
            numCenterMiners: 0,
        }
        const minerCount: StatNumMiners = {
            numEdgeMiners: wasmSolverStats.numEdgeMiners,
            numCenterMiners: wasmSolverStats.numCenterMiners * 3,
        }
        const stats: SolutionStats = {
            numShapeMiners: zeroCount,
            numFluidMiners: zeroCount,
            numGapTiles: wasmSolverStats.numGapTiles,
            numGapIslands: wasmSolverStats.numGapIslands,
            runtime: runtime,
        }
        switch (roid.parserResult.asteroidType) {
            case "shape":
                stats.numShapeMiners = minerCount;
                break;
            case "fluid":
                stats.numFluidMiners = minerCount;
                break;
        }
        self.guiCallback.onIslandStatsCalculated(stats);
    }

    onSolutionBpMerged(self: SolverGuiHandler, blueprint: string): void {
        self.guiCallback.onSolutionBlueprintReceived(blueprint);
    }

    /**
     * @returns `true` if this is the first time this placement was tried. `false` otherwise.
     */
    private storeSolverPlacement(id: SolverId, placement: SolverPlacement): void {
        let frames = this.solverPlacementsById.get(id);
        if (frames === undefined) {
            frames = [];
            this.solverPlacementsById.set(id, frames);
        }
        frames.push(placement);
    }

    private findSolverPlacement(id: SolverId): SolverPlacement | undefined {
        let frames = this.solverPlacementsById.get(id);
        return frames === undefined ? undefined : frames[frames.length - 1];
    }

    addFrame(roid: RoidData, frame: SolverEvent): void {
        let newNumFrames = 0;
        for (let renderer of Array.from(roid.renderData.values())) {
            renderer.addFrame(frame);
            newNumFrames = Math.max(newNumFrames, renderer.getNumFrames());
        }
        if (newNumFrames > this.curFrameCount) {
            this.curFrameCount = newNumFrames;
        }
        // always trigger event to cause a reRender of the canvas
        this.guiCallback.onFrameCountChanged(Math.max(newNumFrames, this.curFrameCount));
    }

    drawToCanvas(self: SolverGuiHandler, frame: number, canvas: InteractiveCanvas): void {
        for (let roid of self.roidData) {
            const renderer = roid.renderData.get(SettingObserver.previewRenderMode.get());
            if (renderer === undefined)
                continue;

            renderer.showFrame(frame);
            renderer.draw(canvas);
        }
    }

    generateTooltip(self: SolverGuiHandler, x: number, y: number): string | undefined {
        const roidIdx = self.roidIdxByCoordinate.get(`${x}, ${y}`)
        if (roidIdx === undefined)
            return undefined;

        const ttOpts = getSettings().tooltipOptions;
        if (!ttOpts.enable)
            return undefined;

        const roid = self.roidData[roidIdx];
        const asteroid = roid.parserResult;
        let tooltip: string = [
            ttOpts.showWorldCoordinates ? `x = ${x}, y = ${y} (world)` : undefined,
            ttOpts.showIslandCoordinates ? `x = ${x - asteroid.originX}, y = ${y - asteroid.originY} (island)` : undefined,
            ttOpts.showIslandId ? `islandId = ${roidIdx}` : undefined,
            ttOpts.showIslandType ? `islandType = ${roid.parserResult.asteroidType}` : undefined,
        ].filter(line => line !== undefined).join("<br/>");
        if (ttOpts.showErrors) {
            for (let err of roid.errors) {
                tooltip += `<br/><span class="log-error">Error = ${err}</span>`;
            }
        }
        if (ttOpts.showWarnings) {
            for (let warn of roid.warnings) {
                tooltip += `<br/><span class="log-warn">Warning = ${warn}</span>`;
            }
        }
        return tooltip;
    }

    toString(): string {
        return "SolverGuiHandler(bp.len=" + this.blueprint.length + ")";
    }

}