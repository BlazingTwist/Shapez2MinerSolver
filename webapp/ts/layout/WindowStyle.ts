import { TemplateElement } from "../HtmlTemplating.js";
import { LayoutHelper } from "./LayoutHelper.js";
import { getSettings, SettingObserver } from "../Settings.js";

export class ShapeColors {
    readonly colorClass: string;
    readonly colorExpr: string;

    constructor(colorClass: string, colorExpr: string) {
        this.colorClass = colorClass;
        this.colorExpr = colorExpr;
    }

    public static frameBg = new ShapeColors("colors-frameBg", "hsl(calc(266 + var(--color-shift)), 15%, 19%)"); /* #2f2937 */
    public static frameBgLit = new ShapeColors("colors-frameBgLit", "hsl(calc(266 + var(--color-shift)), 11%, 25%)"); /* #403a48 */
    public static frameBgUnlit = new ShapeColors("colors-frameBgUnlit", "hsl(calc(266 + var(--color-shift)), 18%, 15%)"); /* #26202e */

    public static frameFg = new ShapeColors("colors-frameFg", "hsl(calc(263 + var(--color-shift)), 39%, 31%)"); /* #48306e */
    public static frameFgLit = new ShapeColors("colors-frameFgLit", "hsl(calc(263 + var(--color-shift)), 27%, 44%)"); /* #68518d */
    public static frameFgUnlit = new ShapeColors("colors-frameFgUnlit", "hsl(calc(254 + var(--color-shift)), 48%, 24%)"); /* #2d1f59 */

    public static canvasBg = new ShapeColors("colors-canvasBg", "hsl(calc(268 + var(--color-shift)),15%,81%)"); /* #cdc6d5 */

    public static darkBtn = new ShapeColors("colors-darkBtn", "hsl(calc(264 + var(--color-shift)), 12%, 24%)"); /* #3c3645 */
    public static darkBtnLit = new ShapeColors("colors-darkBtnLit", "hsl(calc(265 + var(--color-shift)),10%,34%)"); /* #564f60 */
    public static darkBtnUnlit = new ShapeColors("colors-darkBtnUnlit", "hsl(calc(264 + var(--color-shift)),14%,21%)"); /* #332d3c */

    public static lightBtn = new ShapeColors("colors-lightBtn", "hsl(calc(269 + var(--color-shift)), 16%, 79%)"); /* #beb4c9 */
    public static lightBtnLit = new ShapeColors("colors-lightBtnLit", "hsl(calc(283 + var(--color-shift)), 15%, 84%)"); /* #d4cad8 */
    public static lightBtnUnlit = new ShapeColors("colors-lightBtnUnlit", "hsl(calc(258 + var(--color-shift)), 17%, 72%)"); /* #aca4be */

    // Note: Saturation dropped to 0 for a more neutral background, which works better with non-default themes.
    public static windowBg = new ShapeColors("colors-windowBg", "hsl(calc(113 + var(--color-shift)),0%,22%)"); /* #324030 */
    public static windowBgScrollBg = new ShapeColors("colors-windowBgScrollBg", "hsl(calc(115 + var(--color-shift)),0%,18%)"); /* #293428 */
    public static windowBgScrollFg = new ShapeColors("colors-windowBgScrollFg", "hsl(calc(111 + var(--color-shift)),0%,42%)"); /* #667264 */

    public static lightPanelShade = new ShapeColors("colors-lightPanelShade", "hsl(calc(268 + var(--color-shift)), 15%, 68%)"); /* #aca1b9 */
    public static lightPanelShadeUnlit = new ShapeColors("colors-lightPanelShadeUnlit", "hsl(calc(269 + var(--color-shift)),13%,62%)"); /* #9d91aa */

    public static greenBtn = new ShapeColors("colors-greenBtn", "#78b268");
    public static greenBtnLit = new ShapeColors("colors-greenBtnLit", "#bdecb1");
    public static greenBtnUnlit = new ShapeColors("colors-greenBtnUnlit", "#3d5237");

    public static redBtn = new ShapeColors("colors-redBtn", "#b26868");
    public static redBtnLit = new ShapeColors("colors-redBtnLit", "#d79999");
    public static redBtnUnlit = new ShapeColors("colors-redBtnUnlit", "#523737");

    public static fontLight2 = new ShapeColors("colors-fontLight2", "#cbcbcb");
    public static fontLight = new ShapeColors("colors-fontLight", "#a5a5a5");
    public static fontDark = new ShapeColors("colors-fontDark", "#21192a");

    public static alphaShadow44 = new ShapeColors("colors-alphaShadow44", "rgba(0, 0, 0, 0.44)");

    public static indicatorOnHighlight = new ShapeColors("colors-indicatorOnHigh", "hsl(calc(302 + var(--color-shift)), 100%, 85%)");
    public static indicatorOnInner = new ShapeColors("colors-indicatorOnInner", "hsl(calc(303 + var(--color-shift)), 100%, 72%)"); // #ff70f8
    public static indicatorOnOuter = new ShapeColors("colors-indicatorOnOuter", "hsl(calc(303 + var(--color-shift)), 64%, 59%)");

    public static indicatorOffHighlight = new ShapeColors("colors-indicatorOffHigh", "hsl(calc(272 + var(--color-shift)),18%,17%)");
    public static indicatorOffInner = new ShapeColors("colors-indicatorOffInner", "hsl(calc(272 + var(--color-shift)),16%,21%)");
    public static indicatorOffOuter = new ShapeColors("colors-indicatorOffOuter", "hsl(calc(270 + var(--color-shift)),11%,30%)");

    public static injectStylesheet() {
        let styleRules: string[] = [];
        for (let key in ShapeColors) {
            // @ts-ignore
            const val = ShapeColors[key];
            if (val instanceof ShapeColors) {
                styleRules.push(`.${val.colorClass} {--color: ${val.colorExpr};}`);
            }
        }

        const style = TemplateElement.html(`<style>${styleRules.join("\n")}</style>`);
        document.head.appendChild(style.element);
    }
}

export class CutOptions {
    readonly cutClass: string;

    constructor(cutClass: string) {
        this.cutClass = cutClass;
    }

    public static cut10 = new CutOptions("cut-10");
    public static cut8 = new CutOptions("cut-8");
    public static cut6 = new CutOptions("cut-6");
    public static cut4 = new CutOptions("cut-4");
    public static cut0 = new CutOptions("cut-0");
}

export class BevelOptions {
    readonly bevelClass: string;

    constructor(bevelClass: string) {
        this.bevelClass = bevelClass;
    }

    public static bevel4 = new BevelOptions("bevel-4");
    public static bevel2 = new BevelOptions("bevel-2");
}

export class BevelColors {
    colorTop: ShapeColors | undefined;
    colorRight: ShapeColors | undefined;
    colorBottom: ShapeColors | undefined;
    colorLeft: ShapeColors | undefined;

    constructor(colorTop: ShapeColors | undefined, colorRight: ShapeColors | undefined, colorBottom: ShapeColors | undefined, colorLeft: ShapeColors | undefined) {
        this.colorTop = colorTop;
        this.colorRight = colorRight;
        this.colorBottom = colorBottom;
        this.colorLeft = colorLeft;
    }

    public static ctor(colorTopLeft: ShapeColors | undefined, colorRightBottom: ShapeColors | undefined) {
        return new BevelColors(colorTopLeft, colorRightBottom, colorRightBottom, colorTopLeft);
    }
}

export class GradientColor {
    readonly color: ShapeColors;
    readonly percentage: number | undefined; // range [0, 100]

    constructor(color: ShapeColors, percentage: number | undefined) {
        this.color = color;
        this.percentage = percentage;
    }

    public static indicatorGradient(highlight: ShapeColors, inner: ShapeColors, outer: ShapeColors): GradientColor[] {
        return [
            new GradientColor(highlight, undefined),
            new GradientColor(inner, 4),
            new GradientColor(outer, 50),
        ];
    }
}

export class RectBevel extends BevelColors {
}

export class OctagonCut {
    cut_tl: boolean = true;
    cut_tr: boolean = true;
    cut_br: boolean = true;
    cut_bl: boolean = true;

    constructor(cut_tl: boolean, cut_tr: boolean, cut_br: boolean, cut_bl: boolean) {
        this.cut_tl = cut_tl;
        this.cut_tr = cut_tr;
        this.cut_br = cut_br;
        this.cut_bl = cut_bl;
    }

    public static all: OctagonCut = new OctagonCut(true, true, true, true);
    public static top: OctagonCut = new OctagonCut(true, true, false, false);
    public static bottom: OctagonCut = new OctagonCut(false, false, true, true);
    public static left: OctagonCut = new OctagonCut(true, false, false, true);
    public static right: OctagonCut = new OctagonCut(false, true, true, false);
}

export class OctagonBevel extends BevelColors {
}

export class TrapezoidCut {
    cutTl: string;
    cutTr: string;
    cutBr: string;
    cutBl: string;

    public static ctor(cutBottom: boolean, cutFrac: number) {
        const cutDist = cutFrac + "cqh";
        return new TrapezoidCut(
            cutBottom ? undefined : cutDist,
            cutBottom ? undefined : cutDist,
            cutBottom ? cutDist : undefined,
            cutBottom ? cutDist : undefined
        );
    }

    constructor(cutTl: string | undefined, cutTr: string | undefined, cutBr: string | undefined, cutBl: string | undefined) {
        this.cutTl = cutTl === undefined ? "0px" : cutTl;
        this.cutTr = cutTr === undefined ? "0px" : cutTr;
        this.cutBr = cutBr === undefined ? "0px" : cutBr;
        this.cutBl = cutBl === undefined ? "0px" : cutBl;
    }

    public static b45 = TrapezoidCut.ctor(true, 100);
    public static b15 = TrapezoidCut.ctor(true, 33);
    /** Diagonal `\` trapezoid at 45° angle. */
    public static db45 = new TrapezoidCut(undefined, "100cqh", undefined, "100cqh");
}

export class TrapezoidBevel extends BevelColors {
}

export class RectTlCutBevel extends BevelColors {
}

export class ShapeRenderer {
    public static newRect(
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        rBev: RectBevel | undefined,
    ): HTMLElement {
        return ShapeRenderer.rect(document.createElement("div"), bevel, color, rBev);
    }

    public static rect(
        container: HTMLElement,
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        rBev: RectBevel | undefined,
    ): HTMLElement {
        if (bevel !== undefined) {
            container.classList.add(bevel.bevelClass);
        }

        container.style.backgroundColor = color.colorExpr;

        if (rBev !== undefined) {
            if (rBev.colorTop !== undefined) {
                container.style.borderTop = `solid var(--bevel) ${rBev.colorTop.colorExpr}`;
            }
            if (rBev.colorRight !== undefined) {
                container.style.borderRight = `solid var(--bevel) ${rBev.colorRight.colorExpr}`;
            }
            if (rBev.colorBottom !== undefined) {
                container.style.borderBottom = `solid var(--bevel) ${rBev.colorBottom.colorExpr}`;
            }
            if (rBev.colorLeft !== undefined) {
                container.style.borderLeft = `solid var(--bevel) ${rBev.colorLeft.colorExpr}`;
            }
        }
        return container;
    }

    public static newOctagon(
        cut: CutOptions | undefined,
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        octCut: OctagonCut,
        octBevel: OctagonBevel | undefined,
    ): HTMLElement {
        return ShapeRenderer.octagon(document.createElement("div"), cut, bevel, color, octCut, octBevel);
    }

    public static octagon(
        container: HTMLElement,
        cut: CutOptions | undefined,
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        octCut: OctagonCut,
        octBevel: OctagonBevel | undefined,
    ): HTMLElement {
        if (cut !== undefined) {
            container.classList.add(cut.cutClass);
        }
        if (bevel !== undefined) {
            container.classList.add(bevel.bevelClass);
        }
        container.style.position = "relative";

        const bgContainer = TemplateElement.html(`<div class="${color.colorClass} renderer-octagon"></div>`);
        bgContainer.element.style.setProperty("--cut-tl", octCut.cut_tl ? "var(--edgeCut)" : "0px");
        bgContainer.element.style.setProperty("--cut-tr", octCut.cut_tr ? "var(--edgeCut)" : "0px");
        bgContainer.element.style.setProperty("--cut-br", octCut.cut_br ? "var(--edgeCut)" : "0px");
        bgContainer.element.style.setProperty("--cut-bl", octCut.cut_bl ? "var(--edgeCut)" : "0px");
        container.appendChild(bgContainer.element);

        if (octBevel !== undefined) {
            if (octBevel.colorTop !== undefined) {
                bgContainer.child(`<div class="${octBevel.colorTop.colorClass} renderer-octagon-top"></div>`);
            }
            if (octBevel.colorRight !== undefined) {
                bgContainer.child(`<div class="${octBevel.colorRight.colorClass} renderer-octagon-right"></div>`);
            }
            if (octBevel.colorBottom !== undefined) {
                bgContainer.child(`<div class="${octBevel.colorBottom.colorClass} renderer-octagon-bottom"></div>`);
            }
            if (octBevel.colorLeft !== undefined) {
                bgContainer.child(`<div class="${octBevel.colorLeft.colorClass} renderer-octagon-left"></div>`);
            }
        }

        return container;
    }

    /**
     * Creates an octagon where the right edge is inverted:
     * <pre>
     *      _____
     *     /   /
     *    |   |
     *    \___\
     * </pre>
     */
    public static octagonInvertR(
        container: HTMLElement,
        cut: CutOptions | undefined,
        color: ShapeColors
    ): HTMLElement {
        if (cut !== undefined) {
            container.classList.add(cut.cutClass);
        }
        container.classList.add(color.colorClass);
        container.classList.add("renderer-octagon-invertR");
        return container;
    }

    public static trapezoid(
        container: HTMLElement,
        cut: CutOptions | undefined,
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        tCut: TrapezoidCut | undefined,
        tBev: TrapezoidBevel | undefined,
    ): HTMLElement {
        if (cut !== undefined) {
            container.classList.add(cut.cutClass);
        }
        if (bevel !== undefined) {
            container.classList.add(bevel.bevelClass);
        }


        container.style.position = "relative";
        if (tCut === undefined) {
            container.style.setProperty("--cut-tl", "0px");
            container.style.setProperty("--cut-tr", "0px");
            container.style.setProperty("--cut-br", "0px");
            container.style.setProperty("--cut-bl", "0px");
        } else {
            container.style.setProperty("--cut-tl", tCut.cutTl);
            container.style.setProperty("--cut-tr", tCut.cutTr);
            container.style.setProperty("--cut-br", tCut.cutBr);
            container.style.setProperty("--cut-bl", tCut.cutBl);
        }

        let sizeQueryContainer = TemplateElement.html(`<div style="position: absolute; inset: 0; container-type: size; z-index: -1;"></div>`);
        container.appendChild(sizeQueryContainer.element);

        let trapezoid = TemplateElement.html(`<div class="${color.colorClass} renderer-trapezoid"></div>`);
        sizeQueryContainer.child(trapezoid);
        if (tBev !== undefined) {
            if (tBev.colorTop !== undefined) {
                trapezoid.child(`<div class="${tBev.colorTop.colorClass} renderer-trapezoid-top"></div>`);
            }
            if (tBev.colorRight !== undefined) {
                trapezoid.child(`<div class="${tBev.colorRight.colorClass} renderer-trapezoid-right"></div>`);
            }
            if (tBev.colorBottom !== undefined) {
                trapezoid.child(`<div class="${tBev.colorBottom.colorClass} renderer-trapezoid-bottom"></div>`);
            }
            if (tBev.colorLeft !== undefined) {
                trapezoid.child(`<div class="${tBev.colorLeft.colorClass} renderer-trapezoid-left"></div>`);
            }
        }
        return container;
    }

    /** Renders a rectangle with a cut top-left corner.
     * <pre>
     *   ___
     *  /   |
     *  ----
     * </pre>
     */
    public static rectTlCut(
        container: HTMLElement,
        bevel: BevelOptions | undefined,
        color: ShapeColors,
        rBev: RectTlCutBevel | undefined,
    ): HTMLElement {
        if (bevel !== undefined) {
            container.classList.add(bevel.bevelClass);
        }
        container.style.position = "relative";

        container.appendChild(TemplateElement.html(`<div style="position: absolute; inset: 0; z-index: -1;"></div>`)
            .and(wrapper => {
                wrapper.appendChild(TemplateElement.html(`<div class="${color.colorClass} renderer-rect-tlCut"></div>`).element);
                if (rBev !== undefined) {
                    if (rBev.colorLeft !== undefined) {
                        wrapper.appendChild(TemplateElement.html(`<div class="${rBev.colorLeft.colorClass} renderer-rect-tlCut-left"></div>`).element);
                    }
                    if (rBev.colorTop !== undefined) {
                        wrapper.appendChild(TemplateElement.html(`<div class="${rBev.colorTop.colorClass} renderer-rect-tlCut-top"></div>`).element);
                    }
                    if (rBev.colorRight !== undefined) {
                        wrapper.appendChild(TemplateElement.html(`<div class="${rBev.colorRight.colorClass} renderer-rect-tlCut-right"></div>`).element);
                    }
                    if (rBev.colorBottom !== undefined) {
                        wrapper.appendChild(TemplateElement.html(`<div class="${rBev.colorBottom.colorClass} renderer-rect-tlCut-bottom"></div>`).element);
                    }
                }
            })
            .element
        );

        return container;
    }

    public static indicator(
        container: HTMLElement,
        bevel: BevelOptions | undefined,
        borderColor: BevelColors | undefined,
        gradient: GradientColor[],
    ): HTMLElement {
        if (bevel !== undefined) {
            container.classList.add(bevel.bevelClass);
        }

        if (borderColor !== undefined) {
            if (borderColor.colorTop !== undefined) {
                container.style.borderTop = `solid var(--bevel) ${borderColor.colorTop.colorExpr}`;
            }
            if (borderColor.colorRight !== undefined) {
                container.style.borderRight = `solid var(--bevel) ${borderColor.colorRight.colorExpr}`;
            }
            if (borderColor.colorBottom !== undefined) {
                container.style.borderBottom = `solid var(--bevel) ${borderColor.colorBottom.colorExpr}`;
            }
            if (borderColor.colorLeft !== undefined) {
                container.style.borderLeft = `solid var(--bevel) ${borderColor.colorLeft.colorExpr}`;
            }
        }
        const gradientStr = gradient.map(g => g.color.colorExpr + (g.percentage !== undefined ? ` ${g.percentage}%` : "")).join(", ");
        container.style.background = `radial-gradient(circle at 60% 60%, ${gradientStr})`;

        return container;
    }
}

export class WindowFrame {
    readonly frame: HTMLElement;
    readonly handleSpacer: TemplateElement;
    readonly contentPanel: TemplateElement;
    private _isFolded: boolean = false;

    public get isFolded() {
        return this._isFolded;
    }

    constructor(title: string, foldedProp: SettingObserver<boolean>, cut?: OctagonCut) {
        if (cut === undefined)
            cut = OctagonCut.all;
        this.frame = ShapeRenderer.newOctagon(CutOptions.cut8, BevelOptions.bevel4, ShapeColors.frameFg, cut, OctagonBevel.ctor(ShapeColors.frameFgLit, ShapeColors.frameFgUnlit));
        const self = this;
        const frame = this.frame;
        frame.classList.add("window-frame");

        this.handleSpacer = TemplateElement.html(`<div style="position: relative; width: 100%; height: 70%; align-self: start;"></div>`)
            .and(spacer => ShapeRenderer.trapezoid(spacer, undefined, undefined, ShapeColors.frameBg, TrapezoidCut.b45, new TrapezoidBevel(undefined, ShapeColors.frameFgLit, ShapeColors.frameFgLit, ShapeColors.frameFgUnlit)));

        let handle = TemplateElement.html(`<div style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; justify-content: space-between; padding-bottom: 0.3em;"></div>`);
        handle.child([
            TemplateElement.html(`<div style="padding: var(--bevel); margin: 0.5em 0.5em 0;"></div>`)
                .child(ShapeRenderer.newOctagon(CutOptions.cut4, BevelOptions.bevel2, ShapeColors.darkBtn, OctagonCut.all, OctagonBevel.ctor(ShapeColors.frameFgUnlit, ShapeColors.frameFgLit)),
                    item => {
                        item.classList.add("flex-center");
                        item.style.padding = "0 1em";
                        item.style.height = "2.5em";
                        item.appendChild(TemplateElement.html(`<span style="font-size: 1.5em; color: ${ShapeColors.fontLight.colorExpr};">${title}</span>`).element);
                        return item;
                    }
                ),
            this.handleSpacer,
            TemplateElement.html(`<div style="padding: var(--bevel); margin: 0.5em 0.5em 0;"></div>`)
                .child(TemplateElement.html(`<button class="clickable flex-center" style="height: 2em; width: 2em;"></button>`)
                    .and(item => {
                        ShapeRenderer.octagon(item, CutOptions.cut4, BevelOptions.bevel2, ShapeColors.darkBtn, OctagonCut.all, OctagonBevel.ctor(ShapeColors.frameFgUnlit, ShapeColors.frameFgLit))
                        item.addEventListener("click", () => {
                            frame.toggleAttribute("folded");
                            self._isFolded = frame.hasAttribute("folded");
                            foldedProp.set(self._isFolded);
                        });
                        item.appendChild(TemplateElement.html(`<i class="window-content icon-collapse icon-color-gray" style="width: 1em; height: 1em;"></i>`).element);
                        item.appendChild(TemplateElement.html(`<i class="window-fold-content icon-chevron-right icon-color-gray" style="width: 1em; height: 1em;"></i>`).element);
                    })
                ),
        ]);
        frame.appendChild(handle.element);

        foldedProp.addListener(newIsFolded => {
            if (newIsFolded !== self._isFolded) {
                frame.toggleAttribute("folded");
                self._isFolded = newIsFolded;
            }
        });

        this.contentPanel = TemplateElement.html(`<div class="window-content"></div>`);
        frame.appendChild(this.contentPanel.element);
    }
}

export class SidebarPanel {
    readonly frame: TemplateElement;
    readonly contentWrapper: TemplateElement;
    private _visible: boolean = false;

    get visible(): boolean {
        return this._visible;
    }

    set visible(value: boolean) {
        this.frame.element.style.display = value ? "grid" : "none";
        this._visible = value;
    }

    constructor(title: string) {
        const self = this;
        this.contentWrapper = TemplateElement.html(`<div style="position: relative; padding: 0.5em; overflow: auto; scrollbar-color: ${ShapeColors.frameBgUnlit.colorExpr} ${ShapeColors.lightBtn.colorExpr};"></div>`)
            .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit)));
        this.frame = TemplateElement.html(`<div style="display: none; position: absolute; top: 0; right: 0; bottom: 0; width: var(--sidebar-width);"></div>`)
            .child([
                TemplateElement.html(`<div class="drag-horiz" style="position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); width: 1em;"></div>`)
                    .and(item => {
                        LayoutHelper.addDragXCallback(item, dx => {
                            SettingObserver.sidebarWidth.set(getSettings().layoutOptions.sidebarWidth - dx);
                        });
                    }),
                TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr; grid-template-rows: auto 1fr; padding: 0.5em; grid-row-gap: 0.5em; overflow: hidden;"></div>`)
                    .and(item => ShapeRenderer.octagon(item, CutOptions.cut8, BevelOptions.bevel4, ShapeColors.frameBgLit, new OctagonCut(true, false, false, false), undefined))
                    .child([
                        TemplateElement.html(`<div class="flex-center" style="padding: 0.2em 1em; justify-content: start;"></div>`)
                            .and(item => ShapeRenderer.octagon(item, CutOptions.cut8, BevelOptions.bevel2, ShapeColors.lightBtn, new OctagonCut(true, false, true, false), OctagonBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit)))
                            .child(`<span style="font-size: 1.75em; font-weight: bolder;">${title}</span>`),
                        self.contentWrapper
                    ])
            ]);
    }
}
