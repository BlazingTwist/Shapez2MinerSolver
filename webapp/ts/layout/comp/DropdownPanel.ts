import { TemplateElement } from "../../HtmlTemplating.js";

export class DropdownPanel {
    readonly panel: TemplateElement;
    private isOpen: boolean = false;

    constructor() {
        this.panel = TemplateElement.html(`<div style="position: absolute; left: 0; right: 0; top: calc(100% + 1em); z-index: 2; display: none;"></div>`);
        const self = this;
        this.panel.element.addEventListener("click", (ev) => {
            if (self.isOpen) {
                ev.stopPropagation();
            }
        });
        document.addEventListener("click", () => {
            if (self.isOpen) {
                self.hide();
            }
        });
    }

    show() {
        this.panel.element.style.display = "";
        this.isOpen = true;
    }

    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    hide() {
        this.panel.element.style.display = "none";
        this.isOpen = false;
    }
}