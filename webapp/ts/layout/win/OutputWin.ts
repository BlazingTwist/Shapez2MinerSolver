import { BevelOptions, CutOptions, OctagonBevel, OctagonCut, RectBevel, ShapeColors, ShapeRenderer, WindowFrame } from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { Toast } from "../comp/Toast.js";
import { Strings } from "../../Strings.js";
import { SettingObserver } from "../../Settings.js";

export class OutputWin {
    readonly frame: WindowFrame;
    private readonly outputArea: TemplateElement;

    constructor() {
        const self = this;
        this.frame = new WindowFrame(Strings.outputTitle, SettingObserver.outputWinClosed, OctagonCut.top);
        this.frame.frame.classList.add("window-after-ftue")

        this.outputArea = TemplateElement.html(`<span style="font-size: 1.25em; padding: 0 0.2em; overflow-x: scroll; scrollbar-width: thin; scrollbar-color: ${ShapeColors.frameFg.colorExpr} ${ShapeColors.lightBtn.colorExpr};">SHAPEZ2-5-EXAMPLE$</span>`);

        this.frame.contentPanel.child([
            TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr auto; height: calc(1.5em + 12px + var(--bevel)); padding: calc(1em + var(--bevel)) calc(0.5em + var(--bevel)); column-gap: 0.5em; align-items: stretch; box-sizing: content-box"></div>`)
                .and(item => ShapeRenderer.rect(item, BevelOptions.bevel2, ShapeColors.frameBg, new RectBevel(ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit, ShapeColors.frameBgLit)))
                .child([
                    this.outputArea.and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.frameBgLit))),
                    TemplateElement.html(`<button class="clickable flex-center" style="z-index: 1; padding: 0.5em;" title="${Strings.copyToClipboard}"></button>`)
                        .and(item => {
                            ShapeRenderer.octagon(item, CutOptions.cut8, undefined, ShapeColors.greenBtn, OctagonCut.right, OctagonBevel.ctor(ShapeColors.greenBtnLit, ShapeColors.greenBtnUnlit));
                            item.addEventListener("click", () => self.onClickCopyOutput(item));
                        })
                        .child(`<i class="icon-copy icon-color-dark" style="width: 1em; height: 1em; margin-right: var(--edgeCut); margin-left: 0.1em;"></i>`),
                ]),
        ]);
    }

    setOutput(text: string): void {
        this.outputArea.element.innerHTML = text;
    }

    onClickCopyOutput(copyBtn: HTMLElement) {
        try {
            navigator.clipboard.writeText(this.outputArea.element.innerHTML)
                .then(() => Toast.getInstance().show(Strings.copySuccess, copyBtn))
                .catch(() => Toast.getInstance().show(Strings.copyFailed, copyBtn));
        } catch (e) {
            Toast.getInstance().show(Strings.copyFailed, copyBtn);
            console.error("clipboard copying failed", e);
        }
    }
}