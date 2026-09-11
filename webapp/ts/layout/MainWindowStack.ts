import { InputWin } from "./win/InputWin.js";
import { PreviewWin } from "./win/PreviewWin.js";
import { getSettings, SettingObserver } from "../Settings.js";
import { ConsoleWin } from "./win/ConsoleWin.js";
import { OutputWin } from "./win/OutputWin.js";
import { StatsWin } from "./win/StatsWin.js";
import { GuiCallback, SolverGuiHandler } from "../SolverGuiHandler.js";
import { ShapezSolverWasm, SolutionStats } from "../ShapezSolverWasm.js";
import { Logger } from "../Logger.js";
import { TemplateElement } from "../HtmlTemplating.js";
import { ShapeColors } from "./WindowStyle.js";
import { MainLayout } from "./MainLayout.js";
import { LayoutHelper } from "./LayoutHelper.js";

export class MainWindowStack implements GuiCallback {
    readonly container: TemplateElement;
    readonly inputWin: InputWin;
    readonly previewWin: PreviewWin;
    readonly outputWin: OutputWin;
    readonly statsWin: StatsWin;
    readonly consoleWin: ConsoleWin;

    constructor(layout: MainLayout) {
        const self = this;
        const stackFlex = TemplateElement.html(`<div style="
                    position: relative;
                    display: flex; flex-direction: column; gap: 3em;
                    padding: 2em 1em;"></div>`);
        this.container = TemplateElement.html(`<div id="main-window-stack" style="
                position: relative; overflow-y: auto; overflow-x: clip;
                max-height: 100%; width: 100%; max-width: var(--window-width);
                justify-self: center; display: grid;
                scrollbar-color: ${ShapeColors.windowBgScrollFg.colorExpr} ${ShapeColors.windowBgScrollBg.colorExpr};"></div>`)
            .child(stackFlex);
        this.inputWin = new InputWin();
        this.previewWin = new PreviewWin(layout);
        this.outputWin = new OutputWin();
        this.statsWin = new StatsWin();
        this.consoleWin = new ConsoleWin(layout);

        Logger.consoleWin = this.consoleWin;

        stackFlex.child([
            TemplateElement.html(`<div class="drag-horiz" style="position: absolute; top: 0; bottom: 0; right: 0; width: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragXCallback(item, dx => {
                        SettingObserver.windowWidth.set(getSettings().layoutOptions.windowWidth + (dx * 2));
                    });
                }),
            TemplateElement.html(`<div class="drag-horiz" style="position: absolute; top: 0; bottom: 0; left: 0; width: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragXCallback(item, dx => {
                        SettingObserver.windowWidth.set(getSettings().layoutOptions.windowWidth - (dx * 2));
                    });
                }),
            this.inputWin.frame.frame,
            this.previewWin.frame.frame,
            this.outputWin.frame.frame,
            this.statsWin.frame.frame,
            this.consoleWin.frame.frame,
        ])

        ShapezSolverWasm.addNoLongerBusyCallback(() => {
            self.inputWin.showSolveBtn();
        })
        this.inputWin.onCancelClickedCallback = () => {
            ShapezSolverWasm.cancelAllItems();
        };
        this.inputWin.onSolveClickedCallback = () => {
            self.previewWin.resetViewport();
            self.outputWin.setOutput("");
            self.statsWin.reset();
            self.consoleWin.clear();
            const blueprint = self.inputWin.input.value;
            const guiHandler = new SolverGuiHandler(blueprint, self);
            self.inputWin.setGuiHandler(guiHandler);
            self.previewWin.setGuiHandler(guiHandler);
            ShapezSolverWasm.pushWork(guiHandler);
        };
        this.statsWin.onAsteroidSelectedCallback = (roidIdx: number | undefined) => {
            this.previewWin.outlineAsteroid(roidIdx);
        };
    }

    onFrameCountChanged(numFrames: number): void {
        this.previewWin.setMaxFrameIdx(numFrames);
        if (getSettings().liveUpdate && !this.previewWin.frame.isFolded) {
            this.previewWin.onSetFrameIdx(numFrames);
        }
    }

    updateCanvas(): void {
        if (getSettings().liveUpdate && !this.previewWin.frame.isFolded) {
            this.previewWin.previewCanvas.updateCanvas();
        }
    }

    scaleCanvasToFit(maxDx: number, maxDy: number): void {
        // avoid zooming in much too far for small asteroids / anomalous values.
        maxDx = Math.max(10, maxDx);
        maxDy = Math.max(10, maxDy);

        const cvs = this.previewWin.previewCanvas;
        const resScale = cvs.canvasInfo.resolutionScale;
        let scaleFillX = (cvs.canvas.width / 2) / maxDx / resScale;
        let scaleFillY = (cvs.canvas.height / 2) / maxDy / resScale;
        cvs.transformInfo.scale = Math.min(scaleFillX, scaleFillY);
        cvs.updateCanvas();
    }

    onIslandStatsCalculated(stats: SolutionStats): void {
        this.statsWin.addStats(stats);
    }

    onSolutionBlueprintReceived(blueprint: string): void {
        this.outputWin.setOutput(blueprint);
    }
}