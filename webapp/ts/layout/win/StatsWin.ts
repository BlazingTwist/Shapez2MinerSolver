import { BevelOptions, CutOptions, OctagonBevel, OctagonCut, ShapeColors, ShapeRenderer, WindowFrame } from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { SolutionStats, StatNumMiners } from "../../ShapezSolverWasm.js";
import { getSettings, KeybindObservers, KeybindT, SettingObserver } from "../../Settings.js";
import { Strings } from "../../Strings.js";

interface IStatPanel {
    readonly title: string;
    readonly contentPanel: TemplateElement;

    update(stats: SolutionStats): void;
}

class MinersStatPanel implements IStatPanel {
    readonly title: string;
    readonly contentPanel: TemplateElement;
    private readonly totalCount: HTMLSpanElement;
    private readonly edgeCount: HTMLSpanElement;
    private readonly centerCount: HTMLSpanElement;

    constructor() {
        const self = this;
        this.title = Strings.stats.miners;

        this.totalCount = document.createElement("b");
        this.edgeCount = document.createElement("b");
        this.centerCount = document.createElement("b");
        this.contentPanel = TemplateElement.html(`<div class="stats-panel" style="--num-columns: 1"></div>`)
            .child([
                TemplateElement.html(`<span></span>`)
                    .child([
                        self.totalCount,
                        TemplateElement.html(`<span>&nbsp;(${Strings.stats.total})</span>`),
                    ]),
                TemplateElement.html(`<span></span>`)
                    .child([
                        self.edgeCount,
                        TemplateElement.html(`<span>&nbsp;(${Strings.stats.edge})&nbsp;+&nbsp;</span>`),
                        self.centerCount,
                        TemplateElement.html(`<span>&nbsp;(${Strings.stats.center})</span>`),
                    ]),
            ].map(cell => {
                return TemplateElement.html(`<div class="stats-panel-row"></div>`).child(cell);
            }));
    }

    update(stats: SolutionStats): void {
        const numEdgeMiners = stats.numShapeMiners.numEdgeMiners + stats.numFluidMiners.numEdgeMiners;
        const numCenterMiners = stats.numShapeMiners.numCenterMiners + stats.numFluidMiners.numCenterMiners;
        const numTotalMiners = numEdgeMiners + numCenterMiners;

        this.totalCount.innerHTML = "" + numTotalMiners;
        this.edgeCount.innerHTML = "" + numEdgeMiners;
        this.centerCount.innerHTML = "" + numCenterMiners;
    }
}

class SaturationOutputs {
    readonly factor: number;
    readonly satOutput: HTMLSpanElement;
    readonly remOutput: HTMLSpanElement;
    readonly wrapper: TemplateElement;

    constructor(factor: number) {
        this.factor = factor;
        const factorStr = ("" + factor).padEnd(2, " ").replace(" ", "&nbsp;");
        this.satOutput = document.createElement("b");
        this.remOutput = document.createElement("b");
        this.wrapper = TemplateElement.html(`<span style="justify-self: end;"></span>`)
            .child([
                this.satOutput,
                `<span>*${factorStr}&nbsp;+&nbsp;</span>`,
                this.remOutput,
            ]);
    }
}

class SaturationStatPanel implements IStatPanel {
    readonly title: string;
    readonly contentPanel: TemplateElement;
    private readonly shapezSaturations: SaturationOutputs[];
    private readonly fluidSaturations: SaturationOutputs[];

    constructor() {
        const self = this;
        this.title = Strings.stats.beltSaturation;
        this.shapezSaturations = [new SaturationOutputs(12), new SaturationOutputs(8), new SaturationOutputs(4),];
        this.fluidSaturations = [new SaturationOutputs(72), new SaturationOutputs(48), new SaturationOutputs(24),];
        this.contentPanel = TemplateElement.html(`<div class="stats-panel" style="--num-columns: 3"></div>`)
            .child(TemplateElement.html(`<div class="stats-panel-row"></div>`)
                .child([
                    `<span>${Strings.stats.floors}</span>`,
                    `<span>${Strings.stats.shapez}</span>`,
                    `<span>${Strings.stats.fluid}</span>`,
                ])
            )
            .child([3, 2, 1].map((floors, index) => {
                return TemplateElement.html(`<div class="stats-panel-row"></div>`)
                    .child([
                        TemplateElement.html(`<span style="justify-self: end;">${floors}</span>`),
                        self.shapezSaturations[index].wrapper,
                        self.fluidSaturations[index].wrapper,
                    ]);
            }));
    }

    update(stats: SolutionStats): void {
        const updateHandler = (stat: StatNumMiners, outputs: SaturationOutputs[]): void => {
            const numMiners = stat.numEdgeMiners + stat.numCenterMiners;
            for (let output of outputs) {
                const numSaturated = Math.floor(numMiners / output.factor);
                const numRemaining = numMiners % output.factor;
                output.satOutput.innerHTML = "" + numSaturated;
                output.remOutput.innerHTML = ("" + numRemaining).padStart(2, " ").replace(" ", "&nbsp;");
            }
        }
        updateHandler(stats.numShapeMiners, this.shapezSaturations);
        updateHandler(stats.numFluidMiners, this.fluidSaturations);
    }
}

class MiscStatPanel implements IStatPanel {
    readonly title: string;
    readonly contentPanel: TemplateElement;
    private readonly gapTilesOutput: HTMLSpanElement;
    private readonly gapIslandsOutput: HTMLSpanElement;
    private readonly timePhasesOutput: HTMLSpanElement;
    private readonly timeTotalOutput: HTMLSpanElement;

    constructor() {
        const self = this;
        this.title = Strings.stats.misc;

        this.gapTilesOutput = document.createElement("b");
        this.gapIslandsOutput = document.createElement("b");
        this.timePhasesOutput = document.createElement("span");
        this.timeTotalOutput = document.createElement("b");

        this.contentPanel = TemplateElement.html(`<div class="stats-panel" style="--num-columns: 2"></div>`)
            .child(
                [
                    [
                        `<span style="justify-self: end;">${Strings.stats.gapTiles}:</span>`,
                        TemplateElement.html(`<span></span>`).child(self.gapTilesOutput),
                    ],
                    [
                        `<span style="justify-self: end;">${Strings.stats.gapIslands}:</span>`,
                        TemplateElement.html(`<span></span>`).child(self.gapIslandsOutput),
                    ],
                    [
                        `<span style="justify-self: end;">${Strings.stats.time}:</span>`,
                        TemplateElement.html(`<span></span>`)
                            .child([
                                self.timePhasesOutput,
                                `<span>&nbsp;(${Strings.stats.millis})</span>`,
                            ]),
                    ],
                    [
                        `<span></span>`,
                        TemplateElement.html(`<span></span>`)
                            .child([
                                self.timeTotalOutput,
                                `<span>&nbsp;(${Strings.stats.millisTotal})</span>`,
                            ]),
                    ],
                ].map(children => TemplateElement.html(`<div class="stats-panel-row"></div>`).child(children))
            );
    }

    update(stats: SolutionStats): void {
        this.gapTilesOutput.innerHTML = "" + stats.numGapTiles;
        this.gapIslandsOutput.innerHTML = "" + stats.numGapIslands;
        if (stats.runtime.length <= 0) {
            this.timePhasesOutput.innerHTML = `<b>0</b>`;
        } else {
            this.timePhasesOutput.innerHTML = stats.runtime.map(item => {
                return `<b title="${item.label}">${Math.round(item.millis)}</b>`;
            }).join("&nbsp;+&nbsp;");
        }
        this.timeTotalOutput.innerHTML = "" + Math.round(stats.runtime.reduce((acc, val) => acc + val.millis, 0));
    }
}

export class StatsWin {
    readonly frame: WindowFrame;
    private readonly selectorContainer: TemplateElement;
    private readonly statsPanels: IStatPanel[] = [];
    /* Index 0 = sum. Index [1,] = stats of (roidIdx + 1) */
    private allStats: SolutionStats[] = [];
    private currentStatIdx: number = 0;

    onAsteroidSelectedCallback: ((roidIdx: number | undefined) => void) | undefined;

    constructor() {
        const self = this;
        this.frame = new WindowFrame(Strings.statsTitle, SettingObserver.statsWinClosed);
        this.frame.frame.classList.add("window-after-ftue")

        this.frame.contentPanel.element.style.setProperty("--bevel", "2px");
        this.frame.contentPanel.element.style.padding = "var(--bevel)";

        this.selectorContainer = TemplateElement.html(`<div
                style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.25em; z-index: 1; color: ${ShapeColors.fontDark.colorExpr}; --color2: ${ShapeColors.lightPanelShade.colorExpr};"
                class="${CutOptions.cut4.cutClass} ${BevelOptions.bevel2.bevelClass};"></div>`);

        this.statsPanels.push(new MinersStatPanel());
        this.statsPanels.push(new SaturationStatPanel());
        this.statsPanels.push(new MiscStatPanel());

        this.frame.contentPanel.child([
            TemplateElement.html(`<div class="stats-win-content" style="display: grid; grid-template-columns: 1fr; grid-row-gap: 2.5em; padding: 1em; scrollbar-color: ${ShapeColors.lightBtnUnlit.colorExpr} ${ShapeColors.lightBtn.colorExpr};"></div>`)
                .and(item => ShapeRenderer.octagon(item, CutOptions.cut6, undefined, ShapeColors.lightBtn, OctagonCut.bottom, undefined))
                .child(TemplateElement.html(`<div style="display: flex; flex-direction: row; align-items: start; gap: 0.25em;"></div>`)
                    .child([
                        TemplateElement.html(`<button class="clickable flex-center stats-selector" style="height: 1.5em;"></button>`)
                            .and(item => {
                                ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.lightBtn, OctagonCut.left, OctagonBevel.ctor(ShapeColors.darkBtnLit, ShapeColors.darkBtnUnlit));
                                item.addEventListener("click", () => self.onStatSelected(self.currentStatIdx - 1));
                                item.addEventListener("pointerover", () => {
                                    item.title = `Previous Island (Hotkey: ${getSettings().keybinds[KeybindT.prevStat.settingsKey].toString()})`;
                                });
                            })
                            .child(`<i class="icon-chevron-left icon-color-dark" style="height: 50%;"></i>`),
                        self.selectorContainer,
                        TemplateElement.html(`<button class="clickable flex-center stats-selector" style="height: 1.5em;"></button>`)
                            .and(item => {
                                ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.lightBtn, OctagonCut.right, OctagonBevel.ctor(ShapeColors.darkBtnLit, ShapeColors.darkBtnUnlit));
                                item.addEventListener("click", () => self.onStatSelected(self.currentStatIdx + 1));
                                item.addEventListener("pointerover", () => {
                                    item.title = `Next Island (Hotkey: ${getSettings().keybinds[KeybindT.nextStat.settingsKey].toString()})`;
                                });
                            })
                            .child(`<i class="icon-chevron-right icon-color-dark" style="height: 50%;"></i>`),
                    ])
                )
                .child(self.statsPanels.map(stat => {
                    return TemplateElement.html(`<div class="stats-panel-wrapper" style="--color: ${ShapeColors.lightPanelShade.colorExpr}; --color2: ${ShapeColors.lightBtn.colorExpr}"></div>`)
                        .child([
                            TemplateElement.html(`<div class="stats-panel-title"></div>`)
                                .child([
                                    TemplateElement.html(`<span style="padding: 0.2em 0.75em; letter-spacing: 1px;">${stat.title}</span>`),
                                    TemplateElement.html(`<div class="stats-panel-trapezoid"></div>`),
                                ]),
                            stat.contentPanel,
                        ]);
                })),
        ]);

        KeybindObservers[KeybindT.nextStat.settingsKey].addCallback(() => self.onStatSelected(self.currentStatIdx + 1));
        KeybindObservers[KeybindT.prevStat.settingsKey].addCallback(() => self.onStatSelected(self.currentStatIdx - 1));

        this.reset();
    }

    public reset(): void {
        this.allStats = [];
        this.selectorContainer.element.innerHTML = "";
        this.currentStatIdx = 0;
        this.addStats({
            numShapeMiners: {
                numCenterMiners: 0,
                numEdgeMiners: 0,
            },
            numFluidMiners: {
                numCenterMiners: 0,
                numEdgeMiners: 0,
            },
            numGapTiles: 0,
            numGapIslands: 0,
            runtime: [],
        });
        this.onStatSelected(0);
    }

    public addStats(stats: SolutionStats): void {
        const self = this;
        const statIdx = this.allStats.length;
        const statLabel = statIdx === 0 ? Strings.stats.sum : ("" + statIdx);

        this.allStats.push(stats);
        this.updateSum();
        this.selectorContainer.child(
            TemplateElement.html(`<span class="clickable stats-selector">${statLabel}</span>`)
                .and(item => {
                    ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.lightBtn, OctagonCut.all, OctagonBevel.ctor(ShapeColors.darkBtnLit, ShapeColors.darkBtnUnlit));
                    item.addEventListener("click", () => self.onStatSelected(statIdx));
                })
        );
    }

    private onStatSelected(statIdx: number): void {
        this.currentStatIdx = Math.max(0, Math.min(this.allStats.length - 1, statIdx));
        const causeElement = this.selectorContainer.element.children.item(this.currentStatIdx);
        const selectorButtons = this.selectorContainer.element.children;
        for (let i = 0; i < selectorButtons.length; i++) {
            (<HTMLElement>selectorButtons.item(i)).classList.remove("stats-selector-selected");
        }
        if (causeElement !== undefined) {
            causeElement!.classList.add("stats-selector-selected");
        }
        this.updateDisplay();

        if (this.onAsteroidSelectedCallback !== undefined) {
            this.onAsteroidSelectedCallback((this.currentStatIdx <= 0) ? undefined : (this.currentStatIdx - 1));
        }
    }

    private updateSum(): void {
        const sum = this.allStats[0];
        sum.numShapeMiners.numEdgeMiners = 0;
        sum.numShapeMiners.numCenterMiners = 0;
        sum.numFluidMiners.numEdgeMiners = 0;
        sum.numFluidMiners.numCenterMiners = 0;
        sum.numGapTiles = 0;
        sum.numGapIslands = 0;
        sum.runtime = [];
        for (let i = 1; i < this.allStats.length; i++) {
            const stat = this.allStats[i];
            sum.numShapeMiners.numEdgeMiners += stat.numShapeMiners.numEdgeMiners;
            sum.numShapeMiners.numCenterMiners += stat.numShapeMiners.numCenterMiners;
            sum.numFluidMiners.numEdgeMiners += stat.numFluidMiners.numEdgeMiners;
            sum.numFluidMiners.numCenterMiners += stat.numFluidMiners.numCenterMiners;
            sum.numGapTiles += stat.numGapTiles;
            sum.numGapIslands += stat.numGapIslands;
            for (let ri = sum.runtime.length; ri < stat.runtime.length; ri++) {
                sum.runtime.push({
                    label: stat.runtime[ri].label,
                    millis: 0,
                });
            }
            for (let ri = 0; ri < stat.runtime.length; ri++) {
                sum.runtime[ri].millis += stat.runtime[ri].millis;
            }
        }
        this.updateDisplay();
    }

    private updateDisplay(): void {
        const selectedStat = this.allStats[this.currentStatIdx];
        for (let panel of this.statsPanels) {
            panel.update(selectedStat);
        }
    }
}