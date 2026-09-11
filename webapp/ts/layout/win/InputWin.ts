import {
    BevelOptions,
    CutOptions,
    OctagonBevel,
    OctagonCut,
    RectBevel,
    ShapeColors,
    ShapeRenderer,
    TrapezoidBevel,
    TrapezoidCut,
    WindowFrame
} from "../WindowStyle.js";
import {TemplateElement} from "../../HtmlTemplating.js";
import {DropdownPanel} from "../comp/DropdownPanel.js";
import {SolverGuiHandler} from "../../SolverGuiHandler.js";
import { Logger } from "../../Logger.js";
import { Strings } from "../../Strings.js";
import { SettingObserver } from "../../Settings.js";

class ExampleBlueprint {
    readonly displayName: string;
    readonly resourceUrl: string;

    constructor(displayName: string, resourceUrl: string) {
        this.displayName = displayName;
        this.resourceUrl = resourceUrl;
    }

    public static all: ExampleBlueprint[] = [
        new ExampleBlueprint("Single Shape Asteroid (28x28)", "resources/exampleBlueprints/singleShapeAsteroid.spz2"),
        new ExampleBlueprint("Large Square Grid (100x100)", "resources/exampleBlueprints/grid100x100.spz2"),
        new ExampleBlueprint("Large Set of mixed Asteroids (124x221)", "resources/exampleBlueprints/largeSetOfMixedAsteroids.spz2"),
        new ExampleBlueprint("Debug 1", "resources/exampleBlueprints/debug1.spz2"),
        new ExampleBlueprint("Debug 2", "resources/exampleBlueprints/debug2.spz2"),
    ];
}

export class InputWin {
    readonly frame: WindowFrame;
    readonly input: HTMLInputElement;
    readonly exampleBpDropdownPanel: DropdownPanel;
    readonly btnPanelSolve: TemplateElement;
    readonly btnPanelCancel: TemplateElement;
    readonly btnPanelStopping: TemplateElement;
    readonly solverProgressOutput: TemplateElement;

    guiHandler: SolverGuiHandler | undefined = undefined;

    onSolveClickedCallback: (() => void) | undefined;
    onCancelClickedCallback: (() => void) | undefined;

    constructor() {
        const self = this;
        this.frame = new WindowFrame(Strings.inputTitle, SettingObserver.inputWinClosed);
        // this.frame.contentPanel.element.style.padding = "var(--bevel)";

        this.input = <HTMLInputElement>TemplateElement.html(`<input type="text" style="width: 100%;" value="SHAPEZ2-5-EXAMPLE$">`).element;
        this.loadExampleBlueprint("resources/exampleBlueprints/tinyExample.spz2");

        this.exampleBpDropdownPanel = new DropdownPanel();
        this.exampleBpDropdownPanel.panel.child(
            TemplateElement.html(`<div style="display: flex; flex-direction: column; padding: 1.25em 1em; gap: 0.75em; overflow-y: auto;"></div>`)
                .and(panel => ShapeRenderer.octagon(panel, CutOptions.cut8, BevelOptions.bevel2, ShapeColors.frameBg, OctagonCut.bottom, OctagonBevel.ctor(ShapeColors.frameBgLit, ShapeColors.frameBgUnlit)))
                .child(ExampleBlueprint.all.map(bp => {
                    let element = TemplateElement.html(`<button class="clickable" style="color: ${ShapeColors.fontLight.colorExpr}; padding: calc(0.2em + var(--edgeCut)) calc(0.5em + var(--edgeCut));">${bp.displayName}</button>`)
                        .and(item => ShapeRenderer.octagon(item, CutOptions.cut4, undefined, ShapeColors.alphaShadow44, OctagonCut.all, undefined));
                    element.element.addEventListener("click", (ev) => {
                        self.loadExampleBlueprint(bp.resourceUrl);
                        self.exampleBpDropdownPanel.hide();
                        ev.stopPropagation();
                    });
                    return element;
                }))
        );

        this.btnPanelSolve = TemplateElement.html(`<button class="clickable flex-center"></button>`)
            .and(btnPanel => {
                ShapeRenderer.trapezoid(btnPanel, undefined, undefined, ShapeColors.greenBtn, TrapezoidCut.b15, TrapezoidBevel.ctor(ShapeColors.greenBtnLit, ShapeColors.greenBtnUnlit))
                btnPanel.addEventListener("click", () => self.onSolveClicked());
                btnPanel.appendChild(TemplateElement.html(
                    `<span style="font-size: 1.25em; font-family: 'Arial Black',sans-serif; font-weight: bolder; color: ${ShapeColors.fontDark.colorExpr};">SOLVE</span>`
                ).element);
            });
        this.solverProgressOutput = TemplateElement.html(`<span>0%</span>`);
        this.btnPanelCancel = TemplateElement.html(`<div style="display: none; grid-template-columns: 1fr auto; column-gap: 1em; align-items: stretch;"></div>`)
            .child([
                TemplateElement.html(`<div class="flex-center"></div>`)
                    .and(item => ShapeRenderer.octagonInvertR(item, undefined, ShapeColors.alphaShadow44))
                    .child(TemplateElement.html(`<span style="font-size: 1.25em; color: ${ShapeColors.fontLight.colorExpr};"></span>`)
                        .child([
                            `<span>Processing... (</span>`,
                            self.solverProgressOutput,
                            `<span>)</span>`
                        ])
                    ),
                TemplateElement.html(`<button class="clickable flex-center" style="aspect-ratio: 1.5;"></button>`)
                    .and(cancelBtn => {
                        ShapeRenderer.octagon(cancelBtn, undefined, undefined, ShapeColors.redBtn, OctagonCut.all, OctagonBevel.ctor(ShapeColors.redBtnLit, ShapeColors.redBtnUnlit));
                        cancelBtn.addEventListener("click", () => self.onCancelClicked());
                    })
                    .child(`<i class="icon-cross icon-color-dark" style="width: 1.25em;"></i>`),
            ]);
        this.btnPanelStopping = TemplateElement.html(`<div class="flex-center" style="display: none;"></div>`)
            .and(stopPanel => {
                ShapeRenderer.octagon(stopPanel, undefined, undefined, ShapeColors.alphaShadow44, OctagonCut.all, undefined);
                stopPanel.appendChild(TemplateElement.html(`<span style="color: ${ShapeColors.fontLight.colorExpr}; font-size: 1.25em;">Stopping...</span>`).element);
            });

        this.frame.contentPanel.child(
            ShapeRenderer.newOctagon(CutOptions.cut6, BevelOptions.bevel2, ShapeColors.frameBg, OctagonCut.bottom, new OctagonBevel(ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgLit)),
            item => {
                // item.style.padding = "var(--bevel)";
                new TemplateElement(item).child([
                    TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr auto; padding: calc(1em + var(--bevel)) calc(0.5em + var(--bevel)); column-gap: 0.5em; height: 1.5em; align-items: stretch; position: relative;"></div>`)
                        .child([
                            new TemplateElement(ShapeRenderer.newRect(undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.frameBgLit)))
                                .and(inputFrame => {
                                    inputFrame.style.padding = "var(--bevel)";
                                    inputFrame.style.display = "flex";
                                    inputFrame.style.flexDirection = "row";
                                    inputFrame.style.alignItems = "center";
                                    inputFrame.appendChild(self.input);
                                }),
                            TemplateElement.html(`<button title="Examples" class="clickable flex-center" style="padding: var(--bevel);"></button>`)
                                .and(dropdownBtn => ShapeRenderer.octagon(dropdownBtn, CutOptions.cut8, undefined, ShapeColors.lightBtn, OctagonCut.right, OctagonBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit)))
                                .child(`<i class="icon-chevron-down icon-color-dark" style="width: 1em; margin-right: var(--edgeCut); margin-left: 0.1em;"></i>`)
                                .and(dropdownBtn => {
                                    dropdownBtn.addEventListener("click", (ev) => {
                                        self.exampleBpDropdownPanel.toggle();
                                        ev.stopPropagation();
                                    });
                                }),
                            self.exampleBpDropdownPanel.panel,
                        ]),
                    TemplateElement.html(`<div style="padding: 1.5em 3em 1em 3em; display: grid; height: 2.5em; box-sizing: content-box;" class="cut-8"></div>`)
                        .child(TemplateElement.html(`<div style="display: grid;"></div>`)
                            .child([self.btnPanelSolve, self.btnPanelCancel, self.btnPanelStopping]))
                ]);
                return item;
            }
        );
    }

    public setGuiHandler(guiHandler: SolverGuiHandler): void {
        this.guiHandler = guiHandler;
        this.handleProgressUpdates();
    }

    private handleProgressUpdates(): void {
        let completionPct: number = 0;
        const numRoids: number | undefined = this.guiHandler?.roidData?.length;
        if (numRoids !== undefined && numRoids! > 0) {
            const roidData = this.guiHandler!.roidData!;
            const completionFracSum = roidData.map(r => r.getCompletionFraction()).reduce((acc, val) => acc + val, 0);
            const completionFrac = completionFracSum / roidData.length;
            completionPct = Math.round(completionFrac * 100);
        }

        const self = this;
        self.solverProgressOutput.element.innerHTML = `${completionPct}%`;

        if (this.btnPanelCancel.element.style.display !== "none") {
            window.requestAnimationFrame(() => self.handleProgressUpdates());
        }
    }

    loadExampleBlueprint(resourceUrl: string) {
        const self = this;
        fetch(resourceUrl).then(resp => {
            if (resp.ok) {
                resp.text().then(txt => {
                    self.input.value = txt;
                });
            } else {
                self.input.value = "ERROR: " + resp.status + " " + resp.statusText;
                Logger.error("Failed to fetch example blueprint at resourceUrl:", resourceUrl, resp);
            }
        });
    }

    onSolveClicked() {
        document.body.style.setProperty("--ftue-done", "1");

        this.btnPanelSolve.element.style.display = "none";
        this.btnPanelCancel.element.style.display = "grid";
        this.btnPanelStopping.element.style.display = "none";

        if (this.onSolveClickedCallback !== undefined) {
            this.onSolveClickedCallback();
        }
    }

    onCancelClicked() {
        this.btnPanelSolve.element.style.display = "none";
        this.btnPanelCancel.element.style.display = "none";
        this.btnPanelStopping.element.style.display = "";

        if (this.onCancelClickedCallback !== undefined) {
            this.onCancelClickedCallback();
        }
    }

    showSolveBtn() {
        this.btnPanelSolve.element.style.display = "";
        this.btnPanelCancel.element.style.display = "none";
        this.btnPanelStopping.element.style.display = "none";
    }
}