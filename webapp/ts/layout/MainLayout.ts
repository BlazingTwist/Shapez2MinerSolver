import { ShapeColors } from "./WindowStyle.js";
import { InputManager } from "../InputManager.js";
import { MainWindowStack } from "./MainWindowStack.js";
import { TemplateElement } from "../HtmlTemplating.js";
import { SidebarHandle } from "./sidebar/SidebarHandle.js";
import { LayoutHelper } from "./LayoutHelper.js";
import { SettingsManager } from "../Settings.js";

document.addEventListener("DOMContentLoaded", () => {
    new MainLayout(document.getElementById("layoutContainer")!);
})

export class MainLayout {
    readonly container: HTMLElement;
    readonly mainWindowStack: MainWindowStack;
    readonly sidebar: SidebarHandle;

    constructor(container: HTMLElement) {
        container.innerHTML = "";
        ShapeColors.injectStylesheet();
        InputManager.register();

        this.container = container;
        container.addEventListener("dragstart", e => {
            e.preventDefault(); // Disable native drag/drop from taking over UI interactivity.
        });
        LayoutHelper.init();
        SettingsManager.init();

        this.mainWindowStack = new MainWindowStack(this);
        this.sidebar = new SidebarHandle();
        this.sidebar.frame.element.style.zIndex = "10";
        const layout = TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr auto; max-height: 100vh;"></div>`)
            .child([
                this.mainWindowStack.container,
                this.sidebar.frame,
            ]);
        container.appendChild(layout.element);
    }
}