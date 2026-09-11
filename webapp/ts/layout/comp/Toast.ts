import { TemplateElement } from "../../HtmlTemplating.js";
import { BevelOptions, RectBevel, ShapeColors, ShapeRenderer } from "../WindowStyle.js";

export class Toast {
    private static instance: Toast;

    public static getInstance(): Toast {
        if (Toast.instance === undefined) {
            Toast.instance = new Toast();
        }
        return Toast.instance;
    }

    readonly panel: TemplateElement;
    private hideTimeout: number | undefined;

    constructor() {
        this.panel = TemplateElement.html(`<div class="toast overlay shadow"></div>`)
            .and(item => ShapeRenderer.rect(item, BevelOptions.bevel4, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit)));
        document.body.appendChild(this.panel.element);
    }

    public show(text: string, overElement: Element): void {
        let targetRect = overElement.getBoundingClientRect();
        const x = targetRect.left + (targetRect.width / 2);
        const y = targetRect.top;
        this._show(text, x, y);
    }

    private _show(text: string, x: number, y: number): void {
        if (this.panel.element.classList.contains("show")) {
            this._hide();
            const self = this;
            window.requestAnimationFrame(() => self._show(text, x, y));
            return;
        }

        this.panel.element.style.left = x + "px";
        this.panel.element.style.top = y + "px";
        this.panel.element.innerHTML = text;
        this.panel.element.classList.add("show");
        const self = this;
        this.hideTimeout = window.setTimeout(() => self._hide(), 1500);
    }

    private _hide(): void {
        this.panel.element.classList.remove("show");
        window.clearTimeout(this.hideTimeout);
        this.hideTimeout = undefined;
    }
}