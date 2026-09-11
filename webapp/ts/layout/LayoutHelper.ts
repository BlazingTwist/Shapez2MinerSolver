import { SettingObserver } from "../Settings.js";
import { TemplateElement } from "../HtmlTemplating.js";
import { BevelOptions, RectBevel, ShapeColors, ShapeRenderer } from "./WindowStyle.js";

export class LayoutHelper {
    public static addDragXCallback(item: HTMLElement, callback: (dx: number) => void): void {
        let dragPrevX: number | undefined = undefined;
        item.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            item.setPointerCapture(ev.pointerId);
            dragPrevX = ev.clientX;
        });
        item.addEventListener("pointermove", ev => {
            if (dragPrevX !== undefined) {
                ev.preventDefault();
                const dx = ev.clientX - dragPrevX!;
                callback(dx);
                dragPrevX = ev.clientX;
            }
        });
        item.addEventListener("pointerup", ev => {
            if (dragPrevX !== undefined) {
                ev.preventDefault();
                dragPrevX = undefined;
            }
        });
        item.addEventListener("pointercancel", _ => {
            dragPrevX = undefined;
        });
    }

    public static addDragYCallback(item: HTMLElement, callback: (dy: number) => void): void {
        let dragPrevY: number | undefined = undefined;
        item.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            item.setPointerCapture(ev.pointerId);
            dragPrevY = ev.clientY;
        });
        item.addEventListener("pointermove", ev => {
            if (dragPrevY !== undefined) {
                ev.preventDefault();
                const dy = ev.clientY - dragPrevY!;
                callback(dy);
                dragPrevY = ev.clientY;
            }
        });
        item.addEventListener("pointerup", ev => {
            if (dragPrevY !== undefined) {
                ev.preventDefault();
                dragPrevY = undefined;
            }
        });
        item.addEventListener("pointercancel", _ => {
            dragPrevY = undefined;
        });
    }

    public static tooltip(parent: TemplateElement): TemplateElement {
        parent.element.classList.add("tooltip-wrapper");
        const tooltipContent = TemplateElement.html(`<div style="padding: 0.5em;"></div>`);
        const tooltip = TemplateElement.html(`<div class="tooltip-item"></div>`)
            .child(tooltipContent
                .and(item => ShapeRenderer.rect(item, BevelOptions.bevel4, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.lightBtnUnlit)))
            );
        parent.child(tooltip);
        return tooltipContent;
    }

    public static popOver(parent: TemplateElement, toggleOnParentClicked: boolean = false): {
        content: TemplateElement,
        openFn: () => void,
        closeFn: () => void
    } {
        const tooltipContent = TemplateElement.html(`<div style="padding: 0.5em;"></div>`);
        const tooltip = TemplateElement.html(`<div style="display: none;" class="tooltip-item"></div>`)
            .child(tooltipContent
                .and(item => ShapeRenderer.rect(item, BevelOptions.bevel4, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnUnlit, ShapeColors.lightBtnUnlit)))
            );
        parent.child(tooltip);
        const closeListener = () => {
            tooltip.element.style.display = "none";
            document.removeEventListener("click", closeListener);
        };
        const openFn = () => {
            const isHidden = tooltip.element.style.display === "none";
            if (isHidden) {
                tooltip.element.style.display = "grid";
                document.addEventListener("click", closeListener);
            }
        }
        if (toggleOnParentClicked) {
            parent.element.addEventListener("click", ev => {
                const isHidden = tooltip.element.style.display === "none";
                if (isHidden) {
                    openFn();
                } else {
                    tooltip.element.style.display = "none";
                    closeListener();
                }
                ev.stopPropagation();
            });
        }
        tooltipContent.element.addEventListener("click", ev => ev.stopPropagation());
        return {
            content: tooltipContent,
            openFn: openFn,
            closeFn: closeListener
        };
    }

    public static init(): void {
        SettingObserver.fontScale.addListener(val => {
            document.body.style.setProperty('--font-scale', '' + val);
            document.body.style.fontSize = val + 'em';
        });
        SettingObserver.decorationScale.addListener(val => {
            document.body.style.setProperty("--gui-scale", "" + val);
        })
        SettingObserver.colorShift.addListener(val => {
            document.body.style.setProperty('--color-shift', "" + val);
        });
        SettingObserver.windowWidth.addListener(val => {
            document.body.style.setProperty("--window-width", `calc(min(100vw - 10em, ${val}px))`);
        });
        SettingObserver.sidebarWidth.addListener(val => {
            document.body.style.setProperty("--sidebar-width", `calc(min(100vw - 10em, ${val}px))`);
        });
        SettingObserver.previewHeight.addListener(val => {
            document.body.style.setProperty("--preview-height", val + "px");
        });
        SettingObserver.consoleHeight.addListener(val => {
            document.body.style.setProperty("--console-height", val + "px");
        });
    }

    public static setSidebarVisible(visible: boolean): void {
        document.body.style.setProperty("--sidebar-open", visible ? '1' : '0');
    }
}