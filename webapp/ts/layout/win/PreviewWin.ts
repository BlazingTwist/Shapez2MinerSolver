import {
    BevelColors,
    BevelOptions,
    CutOptions,
    GradientColor,
    OctagonBevel,
    OctagonCut, RectBevel,
    RectTlCutBevel,
    ShapeColors,
    ShapeRenderer,
    WindowFrame
} from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { RenderMode, renderModeValues, RenderModeViewData } from "../../AsteroidRenderer.js";
import { getSettings, KeybindObservers, KeybindT, SettingObserver } from "../../Settings.js";
import { InteractiveCanvas } from "../comp/InteractiveCanvas.js";
import { SolverGuiHandler } from "../../SolverGuiHandler.js";
import { LayoutHelper } from "../LayoutHelper.js";
import { MainLayout } from "../MainLayout.js";
import { Strings } from "../../Strings.js";

export interface TooltipSupplier {
    getTooltip(worldX: number, worldY: number): string | undefined;
}

export type RoidBounds = { originX: number, originY: number, width: number, height: number };

export interface RoidBoundsSupplier {
    getRoidBounds(roidIdx: number): RoidBounds | undefined;
}

export class PreviewWin {
    readonly frame: WindowFrame;
    readonly previewCanvas: InteractiveCanvas;

    private readonly modeIndicators: Map<RenderMode, TemplateElement> = new Map<RenderMode, TemplateElement>();
    private readonly tooltipIndicator: TemplateElement;
    private readonly frameSlider: HTMLInputElement;
    private readonly frameSliderHandle: TemplateElement;
    private readonly frameIdxInput: HTMLInputElement;
    private readonly tooltipWrapper: TemplateElement;
    private readonly tooltipContent: TemplateElement;
    private readonly roidOutline: TemplateElement;
    private tooltipSupplier: TooltipSupplier | undefined;
    private getRoidBounds: RoidBoundsSupplier | undefined;
    private outlineBounds: RoidBounds | undefined = undefined;

    constructor(layout: MainLayout) {
        const self = this;
        this.frame = new WindowFrame(Strings.previewTitle, SettingObserver.previewWinClosed);
        this.frame.frame.classList.add("window-after-ftue")

        this.frame.handleSpacer.child([
            TemplateElement.html(`<div class="window-content" style="position: absolute; inset: 0; transform: translateY(calc(0.5em + var(--bevel)));"></div>`)
                .child(
                    TemplateElement.html(`<div style="--edgeCut: 1.5em; --bevel: 0.25em; height: calc(2.5em + (0.25em * var(--gui-scale))); position: absolute; top: 0; right: 0; display: grid; grid-auto-flow: column; grid-auto-columns: calc(3.5em + (0.25em * var(--gui-scale) / var(--font-scale))); grid-template-rows: 100%; column-gap: 1px;"></div>`)
                        .child(renderModeValues().map((mode, index) => {
                            let indicator = TemplateElement.html(`<div style="border-radius: 50%; width: 0.5em; height: 0.5em;"></div>`);

                            let modeBtn = TemplateElement.html(`<button class="clickable" style="height: 100%; width: 100%;"></button>`)
                                .and(btn => ShapeRenderer.rectTlCut(btn, undefined, ShapeColors.lightBtn, RectTlCutBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.alphaShadow44)))
                                .child([
                                    indicator.and(i => {
                                        i.style.position = "absolute";
                                        i.style.left = "0.6em";
                                        i.style.bottom = "0.4em";
                                    }),
                                    TemplateElement.html(`<span style="position: absolute; right: var(--bevel); bottom: 0; font-family: 'Arial Black',sans-serif; font-size: 1.75em;">${index + 1}</span>`)
                                ]);
                            let modeData = RenderModeViewData.get(mode);
                            modeBtn.element.addEventListener("click", () => SettingObserver.previewRenderMode.set(modeData.mode));
                            modeBtn.element.addEventListener("pointerover", () => {
                                modeBtn.element.title = `View as ${modeData.label} (Hotkey: ${getSettings().keybinds[modeData.key.settingsKey].toString()})`;
                            });
                            self.modeIndicators.set(mode, indicator);
                            return modeBtn;
                        }))
                ),
        ]);
        this.tooltipIndicator = TemplateElement.html(`<div style="height: 0.8em; width: 0.8em;"></div>`);
        const previewCanvas = TemplateElement.html(`<canvas style="image-rendering: pixelated; touch-action: none; cursor: move; width: 100%; height: var(--preview-height);"></canvas>`);
        this.previewCanvas = new InteractiveCanvas(<HTMLCanvasElement>previewCanvas.element);

        this.frameSlider = <HTMLInputElement>TemplateElement.html(`<input type="range" min="0" max="0" class="clickable" style="position: absolute; inset: 0; margin: 0; opacity: 0;" aria-label="frame slider">`).element;
        this.frameSlider.addEventListener("change", () => self.onSetFrameIdx(Number(self.frameSlider.value)));
        this.frameSlider.addEventListener("input", () => self.onSetFrameIdx(Number(self.frameSlider.value)));
        this.frameSliderHandle = TemplateElement.html(`<div style="position: absolute; height: 75%; top: 50%; transform: translate(-50%, -50%); width: 0.5em; box-sizing: border-box;"></div>`);
        const frameIdxInputWrapper = TemplateElement.html(`<input type="number" min="0" max="0" style="width: 5ch; font-weight: 900;">`);
        this.frameIdxInput = <HTMLInputElement>frameIdxInputWrapper.element;
        this.frameIdxInput.addEventListener("change", () => self.onSetFrameIdx(Number(self.frameIdxInput.value)));
        this.frameIdxInput.addEventListener("input", () => self.onSetFrameIdx(Number(self.frameIdxInput.value)));

        this.tooltipContent = TemplateElement.html(`<span></span>`);
        this.tooltipWrapper = TemplateElement.html(`<div class="overlay shadow ${BevelOptions.bevel4.bevelClass}" style="display: none; z-index: 1; color: ${ShapeColors.fontDark.colorExpr};"></div>`)
            .child(TemplateElement.html(`<div style="padding: calc(var(--bevel) + var(--edgeCut));"></div>`)
                .and(item => ShapeRenderer.octagon(item, CutOptions.cut4, undefined, ShapeColors.lightBtn, OctagonCut.all, OctagonBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit)))
                .child(this.tooltipContent)
            );
        this.previewCanvas.canvas.addEventListener("pointerleave", () => {
            self.tooltipWrapper.element.style.display = "none";
        });
        this.previewCanvas.setHoverCallback((_: InteractiveCanvas, ev: PointerEvent, worldX: number, worldY: number) => {
            const ttElement = self.tooltipWrapper.element;
            if (self.tooltipSupplier !== undefined) {
                const tooltip = self.tooltipSupplier.getTooltip(Math.floor(worldX), Math.floor(worldY));
                if (tooltip !== undefined) {
                    let tooltipY = ev.clientY;
                    if (ev.pointerType === "touch") {
                        tooltipY -= 50; // move up from underneath the users' fat finger.
                    }

                    let tooltipX = ev.clientX;
                    if (ttElement.style.display !== "none") {
                        const width = ttElement.offsetWidth;
                        if (tooltipX - (width / 2) < 0) {
                            // centered placement would exceed left bound
                            tooltipX = 0;
                            ttElement.style.transform = "translateY(-100%)";
                        } else if (tooltipX + (width / 2) > window.innerWidth) {
                            // centered placement would exceed right bound
                            tooltipX = window.innerWidth;
                            ttElement.style.transform = "translateX(-100%) translateY(-100%)";
                        } else {
                            ttElement.style.transform = "translateX(-50%) translateY(-100%)";
                        }
                    } else {
                        // offsetWidth is not known yet
                        ttElement.style.display = "block";
                        ttElement.style.transform = "translateX(-50%) translateY(-100%)";
                    }
                    ttElement.style.left = "" + tooltipX + "px";
                    ttElement.style.top = "" + tooltipY + "px";
                    self.tooltipContent.element.innerHTML = tooltip;
                } else {
                    ttElement.style.display = "none";
                }
            } else {
                ttElement.style.display = "none";
            }
        });

        this.roidOutline = TemplateElement.html(`<div style="position: absolute; top: 0; left: 0; border: 2px dashed red; display: none; box-sizing: border-box;"></div>`);

        const tooltipToggleOverlay = TemplateElement.html(`<div style="position: absolute; top: 0; right: 0; z-index: 1;"></div>`)
            .child([
                TemplateElement.html(`<div style="position: relative; inset: 0; padding: 0.5em;"></div>`)
                    .and(item => ShapeRenderer.rect(item, BevelOptions.bevel4, ShapeColors.frameFg, new RectBevel(undefined, ShapeColors.frameFgUnlit, ShapeColors.frameFgUnlit, ShapeColors.frameFgUnlit)))
                    .child([
                        TemplateElement.html(`<button class="clickable flex-center ${BevelOptions.bevel2.bevelClass}" style="padding: 0 0.4em; gap: 0.2em;"></button>`)
                            .and(item => {
                                ShapeRenderer.rect(item, undefined, ShapeColors.darkBtn, RectBevel.ctor(ShapeColors.frameFgUnlit, ShapeColors.frameFgLit));
                                item.addEventListener("click", () => self.onSetTooltipsVisible(!getSettings().tooltipOptions.enable));
                                item.addEventListener("pointerover", () => {
                                    item.title = `Toggle Tooltip (Hotkey: ${getSettings().keybinds[KeybindT.toggleTooltip.settingsKey].toString()})`;
                                });
                            })
                            .child([
                                TemplateElement.html(`<i class="icon-eye icon-color-gray" style="height: 1.5em;"></i>`),
                                this.tooltipIndicator,
                            ]),
                    ]),
            ]);

        this.frame.contentPanel.child([
            TemplateElement.html(`<div class="drag-vert" style="position: absolute; top: 0; left: 0; right: 0; transform: translateY(-100%); height: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragYCallback(item, dy => {
                        SettingObserver.previewHeight.set(getSettings().layoutOptions.previewHeight - dy);
                        const scrollContainer = layout.mainWindowStack.container.element;
                        scrollContainer.scrollTop -= dy;
                    });
                }),
            TemplateElement.html(`<div class="drag-vert" style="position: absolute; bottom: 0; left: 0; right: 0; transform: translateY(100%); height: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragYCallback(item, dy => {
                        SettingObserver.previewHeight.set(getSettings().layoutOptions.previewHeight + dy);
                    });
                }),
            TemplateElement.html(`<div style="position: relative; display: grid"></div>`)
                .child([
                    tooltipToggleOverlay,
                    this.tooltipWrapper,
                    TemplateElement.html(`<div style="position: relative;"></div>`)
                        .and(item => ShapeRenderer.rect(item, BevelOptions.bevel2, ShapeColors.canvasBg, new RectBevel(ShapeColors.frameFgUnlit, ShapeColors.frameFgUnlit, undefined, ShapeColors.frameFgLit)))
                        .child([
                            previewCanvas,
                            TemplateElement.html(`<div style="position: absolute; inset: 0; overflow: hidden; z-index: 1; pointer-events: none;"></div>`)
                                .child(this.roidOutline),
                        ])
                ]),
            TemplateElement.html(`<div style="padding: var(--bevel);"></div>`)
                .and(item => ShapeRenderer.octagon(item, CutOptions.cut6, BevelOptions.bevel2, ShapeColors.frameBg, OctagonCut.bottom, new OctagonBevel(ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgLit)))
                .child([
                    TemplateElement.html(`<div style="display: grid; grid-template-columns: auto 1fr auto auto; column-gap: 0.5em; align-items: stretch; height: calc(1.75em + (2 * var(--bevel))); padding: 0.75em 0.5em;"></div>`)
                        .child([
                            TemplateElement.html(`<button class="clickable flex-center" style="height: 1.75em; aspect-ratio: 1; --edgeCut: 50%;"></button>`)
                                .and(item => {
                                    ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.lightBtn, OctagonCut.left, OctagonBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit));
                                    item.addEventListener("click", () => self.onClickPrevFrame());
                                    item.addEventListener("pointerover", () => {
                                        item.title = `Previous Frame (Hotkey: ${getSettings().keybinds[KeybindT.prevFrame.settingsKey].toString()})`;
                                    });
                                })
                                .child(`<i class="icon-minus icon-color-dark" style="height: 1em; padding-left: 0.3em;"></i>`),
                            TemplateElement.html(`<div class="clickable" style="padding: 0 0.5em; position: relative;"></div>`)
                                .and(item => {
                                    ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.frameBgLit));
                                })
                                .child([
                                    self.frameSlider,
                                    TemplateElement.html(`<div style="position: relative; height: 100%; width: 100%; pointer-events: none;"></div>`)
                                        .child([
                                            TemplateElement.html(`<div style="position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 0.25em; box-sizing: border-box;"></div>`)
                                                .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.frameBg, RectBevel.ctor(ShapeColors.frameBgUnlit, undefined))),
                                            self.frameSliderHandle
                                                .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.frameFg, RectBevel.ctor(ShapeColors.frameFgLit, ShapeColors.frameFgUnlit))),
                                        ]),
                                ]),
                            frameIdxInputWrapper.and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.frameBgLit))),
                            TemplateElement.html(`<button class="clickable flex-center" style="height: 1.75em; aspect-ratio: 1; --edgeCut: 50%;"></button>`)
                                .and(item => {
                                    ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.lightBtn, OctagonCut.right, OctagonBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit));
                                    item.addEventListener("click", () => self.onClickNextFrame());
                                    item.addEventListener("pointerover", () => {
                                        item.title = `Next Frame (Hotkey: ${getSettings().keybinds[KeybindT.nextFrame.settingsKey].toString()})`;
                                    });
                                })
                                .child(`<i class="icon-plus icon-color-dark" style="height: 1em; padding-right: 0.3em;"></i>`),
                        ])
                ])
        ]);

        KeybindObservers[KeybindT.nextFrame.settingsKey].addCallback(() => self.onClickNextFrame());
        KeybindObservers[KeybindT.prevFrame.settingsKey].addCallback(() => self.onClickPrevFrame());
        KeybindObservers[KeybindT.toggleTooltip.settingsKey].addCallback(() => self.onSetTooltipsVisible(!getSettings().tooltipOptions.enable));
        for (let mode of renderModeValues()) {
            const modeData = RenderModeViewData.get(mode);
            KeybindObservers[modeData.key.settingsKey].addCallback(() => SettingObserver.previewRenderMode.set(mode));
        }

        SettingObserver.previewRenderMode.addListener(val => self.onSetMode(val));
        this.onSetTooltipsVisible(getSettings().tooltipOptions.enable);
        this.onSetFrameIdx(0);
    }

    public resetViewport(): void {
        this.setMaxFrameIdx(0);
        this.previewCanvas.transformInfo.offsetX = 0;
        this.previewCanvas.transformInfo.offsetY = 0;
    }

    public setGuiHandler(guiHandler: SolverGuiHandler): void {
        const self = this;
        this.previewCanvas.setDrawCallback(controller => {
            guiHandler.drawToCanvas(guiHandler, self.getFrameIdx(), controller);
            self.updateBoundsOverlay();
        });
        this.tooltipSupplier = {
            getTooltip(worldX: number, worldY: number): string | undefined {
                return guiHandler.generateTooltip(guiHandler, worldX, worldY);
            }
        };
        this.getRoidBounds = {
            getRoidBounds(roidIdx: number): RoidBounds | undefined {
                if (roidIdx < 0 || roidIdx > guiHandler.roidData.length) {
                    return undefined;
                }
                const roid = guiHandler.roidData[roidIdx];
                return {
                    originX: roid.parserResult.originX,
                    originY: roid.parserResult.originY,
                    width: roid.parserResult.maxX + 1,
                    height: roid.parserResult.maxY + 1,
                };
            }
        }
    }

    onSetMode(mode: RenderMode): void {
        this.previewCanvas.updateCanvas();

        this.modeIndicators.forEach((val, key) => {
            if (key === mode) {
                ShapeRenderer.indicator(val.element, BevelOptions.bevel2, BevelColors.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit),
                    GradientColor.indicatorGradient(ShapeColors.indicatorOnHighlight, ShapeColors.indicatorOnInner, ShapeColors.indicatorOnOuter)
                );
            } else {
                ShapeRenderer.indicator(val.element, BevelOptions.bevel2, BevelColors.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit),
                    GradientColor.indicatorGradient(ShapeColors.indicatorOffHighlight, ShapeColors.indicatorOffInner, ShapeColors.indicatorOffOuter)
                );
            }
        });
    }

    onSetTooltipsVisible(visible: boolean): void {
        getSettings().tooltipOptions.enable = visible;
        this.previewCanvas.updateTooltip();

        if (visible) {
            ShapeRenderer.indicator(this.tooltipIndicator.element, undefined, BevelColors.ctor(ShapeColors.darkBtnLit, ShapeColors.darkBtnUnlit),
                GradientColor.indicatorGradient(ShapeColors.indicatorOnHighlight, ShapeColors.indicatorOnInner, ShapeColors.indicatorOnOuter)
            );
        } else {
            ShapeRenderer.indicator(this.tooltipIndicator.element, undefined, BevelColors.ctor(ShapeColors.darkBtnLit, ShapeColors.darkBtnUnlit),
                GradientColor.indicatorGradient(ShapeColors.indicatorOffHighlight, ShapeColors.indicatorOffInner, ShapeColors.indicatorOffOuter)
            );
        }
    }

    setMaxFrameIdx(maxFrameIdx: number): void {
        this.frameSlider.max = "" + maxFrameIdx;
        this.frameIdxInput.max = "" + maxFrameIdx;
        this.onSetFrameIdx(Number(this.frameSlider.value));
    }

    onSetFrameIdx(frameIdx: number): void {
        const maxFrame = Number(this.frameSlider.max);
        frameIdx = Math.max(0, Math.min(maxFrame, frameIdx));
        const frameStr: string = "" + frameIdx;
        const fracPct = (frameIdx * 100 / maxFrame) + "%";

        if (this.frameSlider.value !== frameStr) {
            this.frameSlider.value = frameStr;
        }

        this.frameSliderHandle.element.style.left = fracPct;

        if (this.frameIdxInput.value !== frameStr) {
            this.frameIdxInput.value = frameStr;
        }

        this.previewCanvas.updateCanvas();
    }

    getFrameIdx(): number {
        return Number(this.frameSlider.value);
    }

    onClickPrevFrame(): void {
        this.onSetFrameIdx(Number(this.frameSlider.value) - 1);
    }

    onClickNextFrame(): void {
        this.onSetFrameIdx(Number(this.frameSlider.value) + 1);
    }

    outlineAsteroid(roidIdx: number | undefined): void {
        if (roidIdx === undefined || this.getRoidBounds === undefined) {
            this.outlineBounds = undefined;
        } else {
            this.outlineBounds = this.getRoidBounds!.getRoidBounds(roidIdx);
        }
        this.previewCanvas.updateCanvas();
    }

    updateBoundsOverlay(): void {
        if (this.outlineBounds === undefined) {
            this.roidOutline.element.style.display = "none";
        } else {
            this.roidOutline.element.style.display = "block";
            const outlineBounds = this.outlineBounds!;
            const origin = this.previewCanvas.worldToScreen(outlineBounds.originX, outlineBounds.originY);
            const endPos = this.previewCanvas.worldToScreen(outlineBounds.originX + outlineBounds.width, outlineBounds.originY + outlineBounds.height);
            this.roidOutline.element.style.top = origin.y + "px";
            this.roidOutline.element.style.left = origin.x + "px";
            this.roidOutline.element.style.width = (endPos.x - origin.x) + "px";
            this.roidOutline.element.style.height = (endPos.y - origin.y) + "px";
        }
    }
}