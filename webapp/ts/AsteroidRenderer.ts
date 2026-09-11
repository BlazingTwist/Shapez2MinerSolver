import { Asteroid, CenterMiner, Coordinate, EdgeMiner, MinerPlacement } from "./ShapezSolverWasm.js";
import { ColorUtils } from "./ColorGenerator.js";
import { InteractiveCanvas } from "./layout/comp/InteractiveCanvas.js";
import { KeybindT } from "./Settings.js";
import { TileRotations } from "./SolverGuiHandler.js";
import { Logger } from "./Logger.js";

export enum RenderMode {
    BitMap,
    Svg,
    Occupancy,
}

export function renderModeValues(): RenderMode[] {
    return [RenderMode.BitMap, RenderMode.Svg, RenderMode.Occupancy];
}

export class RenderModeViewData {
    mode: RenderMode;
    label: string;
    key: KeybindT;

    constructor(mode: RenderMode, label: string, keyMapId: KeybindT) {
        this.mode = mode;
        this.label = label;
        this.key = keyMapId;
    }

    private static modeMap: Map<RenderMode, RenderModeViewData> = new Map<RenderMode, RenderModeViewData>();

    public static get(mode: RenderMode): RenderModeViewData {
        let result = RenderModeViewData.modeMap.get(mode);
        if (result === undefined) {
            switch (mode) {
                case RenderMode.BitMap:
                    result = new RenderModeViewData(mode, "BitMap", KeybindT.renderModeBitMap);
                    break;
                case RenderMode.Svg:
                    result = new RenderModeViewData(mode, "Icons", KeybindT.renderModeSvg);
                    break;
                case RenderMode.Occupancy:
                    result = new RenderModeViewData(mode, "Occupancy", KeybindT.renderModeOccupancy);
                    break;
            }
            RenderModeViewData.modeMap.set(mode, result);
        }
        return result;
    }
}

export enum SolverEventType {
    EdgeMiner,
    CenterMiner,
    Undo,
    Failure,
}

export type SolverPlacement = {
    type: SolverEventType.EdgeMiner;
    miner: EdgeMiner;
    color: number;
} | {
    type: SolverEventType.CenterMiner;
    miner: CenterMiner;
    color: number;
}

export type SolverEvent = SolverPlacement | {
    type: SolverEventType.Undo;
    target: SolverPlacement;
} | {
    type: SolverEventType.Failure;
    color: number;
}

export interface AsteroidRenderer {
    readonly renderMode: RenderMode;

    getNumFrames(): number;

    addFrame(frame: SolverEvent): void;

    showFrame(frameId: number): void;

    draw(canvas: InteractiveCanvas): void;
}

interface RenderCommand {
    do(): void;

    undo(): void;
}

class RenderTimeline {
    commands: RenderCommand[] = [];
    curPosition: number = 0;

    get length(): number {
        return this.commands.length;
    }

    add(command: RenderCommand): void {
        this.commands.push(command);
    }

    seek(target: number): void {
        target = Math.max(0, Math.min(this.commands.length, target));
        if (target == this.curPosition)
            return;

        if (this.curPosition < target) {
            while (this.curPosition < target) {
                this.commands[this.curPosition].do();
                this.curPosition += 1;
            }
        } else {
            while (this.curPosition > target) {
                this.curPosition -= 1;
                this.commands[this.curPosition].undo();
            }
        }
    }

    replayUpTo(target: number): void {
        for (let i = 0; i <= target; i++) {
            this.commands[i].do();
        }
    }
}

class BitMapRenderer implements AsteroidRenderer {
    asteroid: Asteroid;
    renderMode = RenderMode.BitMap;
    timeline: RenderTimeline = new RenderTimeline();
    pixelCanvas: HTMLCanvasElement;
    pixelCtx: CanvasRenderingContext2D;
    pixel: ImageData;

    constructor(asteroid: Asteroid) {
        this.asteroid = asteroid;
        this.pixelCanvas = document.createElement("canvas");
        this.pixelCtx = this.pixelCanvas.getContext("2d")!;
        this.pixel = new ImageData(1, 1);

        this.pixelCanvas.width = asteroid.maxX + 1;
        this.pixelCanvas.height = asteroid.maxY + 1;

        const renderer = this;
        this.timeline.add({
            do() {
                renderer.drawAsteroid(renderer.getAsteroidColor());
            },
            undo() {
                // cannot be undone.
            }
        });
    }

    getAsteroidColor(): number {
        return ColorUtils.getAsteroidColor(this.asteroid);
    }

    getNumFrames(): number {
        return this.timeline.length - 1; // -1 due to implicit asteroid frame
    }

    addFrame(frame: SolverEvent): void {
        const renderer = this;

        const command: RenderCommand = (function () {
            switch (frame.type) {
                case SolverEventType.Undo:
                    return {
                        do() {
                            renderer.drawUndo(frame.target, false);
                        },
                        undo() {
                            renderer.drawUndo(frame.target, true);
                        }
                    };
                case SolverEventType.EdgeMiner:
                case SolverEventType.CenterMiner:
                    return {
                        do() {
                            renderer.drawPlacementEvent(frame, false);
                        },
                        undo() {
                            renderer.drawPlacementEvent(frame, true);
                        }
                    };
                case SolverEventType.Failure:
                    const frameId = renderer.timeline.length;
                    return {
                        do() {
                            renderer.drawFailure(frameId, frame.color, false);
                        },
                        undo() {
                            renderer.drawFailure(frameId, frame.color, true);
                        }
                    };
            }
        })();
        this.timeline.add(command);
    }

    drawPlacementEvent(placement: SolverPlacement, undo: boolean): void {
        this.pixel.data[3] = 255; // alpha, always fully opaque.
        switch (placement.type) {
            case SolverEventType.EdgeMiner:
                this.drawEdgeMiner(placement.miner, placement.color, undo);
                break;
            case SolverEventType.CenterMiner:
                this.drawCenterMiner(placement.miner, placement.color, undo);
                break;
            default:
                Logger.error("unsupported placement event is ignored: ", placement);
                break;
        }
    }

    drawAsteroid(color: number): void {
        this.pixel.data[0] = ColorUtils.getRed(color);
        this.pixel.data[1] = ColorUtils.getGreen(color);
        this.pixel.data[2] = ColorUtils.getBlue(color);
        this.pixel.data[3] = 255; // alpha, always fully opaque.
        const roid = this.asteroid;
        for (let i = 0; i < roid.posLen; i++) {
            const x = roid.posXArr[i];
            const y = roid.posYArr[i];
            this.pixelCtx.putImageData(this.pixel, x, y);
        }
    }

    drawEdgeMiner(data: EdgeMiner, color: number, undo: boolean): void {
        this.drawPlacement([data.miner, data.ext1, data.ext2, data.ext3], color, undo);
    }

    drawCenterMiner(data: CenterMiner, color: number, undo: boolean): void {
        this.drawPlacement([data.belt, data.lift], color, undo);
        this.drawEdgeMiner(data.miner1, ColorUtils.mul(color, 0.95), undo);
        this.drawEdgeMiner(data.miner2, ColorUtils.mul(color, 0.90), undo);
        this.drawEdgeMiner(data.miner3, ColorUtils.mul(color, 0.85), undo);
    }

    drawUndo(data: SolverPlacement, undo: boolean): void {
        this.drawPlacementEvent(data, !undo);
    }

    drawFailure(frameId: number, color: number, undo: boolean): void {
        if (undo) {
            this.timeline.replayUpTo(frameId - 1);
        } else {
            this.drawAsteroid(color);
        }
    }

    drawPlacement(coords: Coordinate[], color: number, undo: boolean): void {
        if (undo) {
            color = this.getAsteroidColor();
        }
        this.pixel.data[0] = ColorUtils.getRed(color);
        this.pixel.data[1] = ColorUtils.getGreen(color);
        this.pixel.data[2] = ColorUtils.getBlue(color);

        for (let coord of coords) {
            this.pixelCtx.putImageData(this.pixel, coord.x, coord.y);
        }
    }

    showFrame(frameId: number): void {
        this.timeline.seek(frameId + 1); // +1 due to implicit asteroid frame
    }

    draw(canvas: InteractiveCanvas): void {
        canvas.context.imageSmoothingEnabled = false;
        canvas.context.drawImage(this.pixelCanvas, this.asteroid.originX, this.asteroid.originY);
    }
}

const svgPaths = {
    failureSym: new Path2D("m-.4-.3.3.3-.3.3.1.1.3-.3.3.3.1-.1-.3-.3.3-.3-.1-.1-.3.3-.3-.3"),
    mergeBelt: new Path2D("m.2-.4h.1v.1h.1v.1h-.2m0 .6v-.2h.2v.1h-.1v.1m-.5 0h-.1v-.1h-.1v-.1h.2m0-.6v.2h-.2v-.1h.1v-.1"),
    extender: new Path2D("m.3.1.2-.1-.2-.1m-.7.5h.8c.08 0 .08-.1 0-.1h-.7v-.6h.7c.08 0 .08-.1 0-.1h-.8"),
    lift: new Path2D("m-.3.3.6.1v-.1l-.6-.1m0-.4.6-.1v-.1l-.6.1m-.2.2.2.1-.2.1"),
    miner: new Path2D("m-.4.3-.1.1.1.1.1-.1h.6l.1.1.05-.05v-.15h-.75v-.6h.75v-.15l-.05-.05-.1.1h-.6l-.1-.1-.1.1.1.1"),
    shapeSym: new Path2D("m-.175-.175h.15v.15h-.15m0 .05v.15h.15v-.15m.05 0v.15h.15v-.15m0-.05h-.15v-.15h.15"),
    fluidSym: new Path2D("m-.15.05c-.05.2.35.2.3 0l-.15-.225"),
};

class SvgRenderer implements AsteroidRenderer {
    readonly asteroid: Asteroid;
    readonly renderMode = RenderMode.Svg;
    readonly timeline: RenderTimeline = new RenderTimeline();
    readonly occupancyMap: Map<string, SolverPlacement> = new Map<string, SolverPlacement>();
    readonly tileRotations: TileRotations;
    failureCount: number = 0;

    constructor(asteroid: Asteroid, tileRotations: TileRotations) {
        this.asteroid = asteroid;
        this.tileRotations = tileRotations;
    }

    getNumFrames(): number {
        return this.timeline.length;
    }

    addFrame(frame: SolverEvent): void {
        const renderer = this;

        let command: RenderCommand;
        switch (frame.type) {
            case SolverEventType.Undo:
                command = {
                    do() {
                        renderer.occupUpdateUndo(frame.target, false);
                    },
                    undo() {
                        renderer.occupUpdateUndo(frame.target, true);
                    }
                };
                break;
            case SolverEventType.EdgeMiner:
            case SolverEventType.CenterMiner:
                command = {
                    do() {
                        renderer.occupUpdatePlacement(frame, false);
                    },
                    undo() {
                        renderer.occupUpdatePlacement(frame, true);
                    }
                };
                break;
            case SolverEventType.Failure:
                command = {
                    do() {
                        renderer.failureCount++;
                    },
                    undo() {
                        renderer.failureCount--;
                    },
                };
                break;
        }
        this.timeline.add(command);
    }

    occupUpdatePlacement(placement: SolverPlacement, undo: boolean): void {
        let key: string;
        switch (placement.type) {
            case SolverEventType.EdgeMiner:
                key = placement.miner.miner.x + ", " + placement.miner.miner.y;
                break;
            case SolverEventType.CenterMiner:
                key = placement.miner.belt.x + ", " + placement.miner.belt.y;
                break;
            default:
                Logger.error("unsupported placement event is ignored: ", placement);
                return;
        }

        if (undo) {
            this.occupancyMap.delete(key);
        } else {
            this.occupancyMap.set(key, placement);
        }
    }

    occupUpdateUndo(data: SolverPlacement, undo: boolean): void {
        this.occupUpdatePlacement(data, !undo);
    }

    showFrame(frameId: number): void {
        this.timeline.seek(frameId);
    }

    draw(canvas: InteractiveCanvas): void {
        const isFailure = this.failureCount > 0;
        const ctx = canvas.context;
        ctx.save();
        // 0.5 because svg icons are centered
        ctx.translate(this.asteroid.originX + 0.5, this.asteroid.originY + 0.5);

        { // draw background
            let symbol: Path2D;
            if (isFailure) {
                symbol = svgPaths.failureSym;
            } else if (this.asteroid.asteroidType === 'fluid') {
                symbol = svgPaths.fluidSym;
            } else {
                symbol = svgPaths.shapeSym;
            }

            let fillStyle: string;
            if (isFailure) {
                fillStyle = ColorUtils.toColorStr(0xff0000);
            } else {
                fillStyle = ColorUtils.toColorStr(ColorUtils.getAsteroidColor(this.asteroid));
            }

            ctx.fillStyle = fillStyle;
            for (let i = 0; i < this.asteroid.posLen; i++) {
                const x = this.asteroid.posXArr[i];
                const y = this.asteroid.posYArr[i];
                ctx.translate(x, y);
                ctx.fill(symbol);
                ctx.translate(-x, -y);
            }
        }

        const self = this;
        const drawTile = function (coord: Coordinate, symbol: Path2D): void {
            ctx.save();
            ctx.translate(coord.x, coord.y);
            const rotation = self.tileRotations.get(coord.x, coord.y);
            if (rotation) {
                ctx.rotate(rotation * Math.PI / 2);
            }
            ctx.fill(symbol);
            ctx.restore();
        }
        const drawMiner = function (miner: MinerPlacement, color: number): void {
            ctx.fillStyle = ColorUtils.toColorStr(color);
            drawTile(miner.miner, svgPaths.miner);
            drawTile(miner.ext1, svgPaths.extender);
            drawTile(miner.ext2, svgPaths.extender);
            drawTile(miner.ext3, svgPaths.extender);
        }

        { // draw occupancy
            const iter = this.occupancyMap.values();
            let item: IteratorResult<SolverPlacement>;
            while (!(item = iter.next()).done) {
                const value: SolverPlacement = item.value;
                switch (value.type) {
                    case SolverEventType.EdgeMiner:
                        drawMiner(value.miner, value.color);
                        break;
                    case SolverEventType.CenterMiner:
                        ctx.fillStyle = ColorUtils.toColorStr(value.color);
                        drawTile(value.miner.belt, svgPaths.mergeBelt);
                        drawTile(value.miner.lift, svgPaths.lift);

                        drawMiner(value.miner.miner1, ColorUtils.mul(value.color, 0.95));
                        drawMiner(value.miner.miner2, ColorUtils.mul(value.color, 0.90));
                        drawMiner(value.miner.miner3, ColorUtils.mul(value.color, 0.85));
                        break;
                }
            }
        }

        ctx.restore();
    }
}

class OccupancyRenderer extends BitMapRenderer {
    renderMode = RenderMode.Occupancy;

    constructor(asteroid: Asteroid) {
        super(asteroid);
    }

    drawPlacement(coords: Coordinate[], color: number, undo: boolean): void {
        super.drawPlacement(coords, undo ? color : 0x00ff00, undo);
    }
}

export function createRenderer(mode: RenderMode, asteroid: Asteroid, tileRotations: TileRotations): AsteroidRenderer {
    switch (mode) {
        case RenderMode.BitMap:
            return new BitMapRenderer(asteroid);
        case RenderMode.Svg:
            return new SvgRenderer(asteroid, tileRotations);
        case RenderMode.Occupancy:
            return new OccupancyRenderer(asteroid);
        default:
            throw new Error("RenderMode '" + mode + "' is unknown / not implemented");
    }
}