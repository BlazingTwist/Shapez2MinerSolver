import { BevelOptions, OctagonCut, RectBevel, ShapeColors, ShapeRenderer, WindowFrame } from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { LayoutHelper } from "../LayoutHelper.js";
import { getSettings, SettingObserver } from "../../Settings.js";
import { MainLayout } from "../MainLayout.js";
import { Strings } from "../../Strings.js";

export class LogLevel {
    readonly logClass: string | undefined;
    readonly displayName: string;

    constructor(logClass: string | undefined, displayName: string) {
        this.logClass = logClass;
        this.displayName = displayName;
    }

    public static info = new LogLevel(undefined, "Info");
    public static warn = new LogLevel("log-warn", "Warn");
    public static error = new LogLevel("log-error", "Error");
}

export class ConsoleWin {
    readonly frame: WindowFrame;
    private readonly container: TemplateElement;

    constructor(layout: MainLayout) {
        const self = this;
        this.frame = new WindowFrame(Strings.consoleTitle, SettingObserver.consoleWinClosed, OctagonCut.top);
        this.frame.frame.classList.add("window-after-ftue")

        this.frame.contentPanel.element.style.padding = "var(--bevel)";
        this.container = TemplateElement.html(`<div class="console-grid" style="scrollbar-color: ${ShapeColors.frameFg.colorExpr} ${ShapeColors.lightBtn.colorExpr};"></div>`);

        this.frame.contentPanel.child([
            TemplateElement.html(`<div class="drag-vert" style="position: absolute; top: 0; left: 0; right: 0; transform: translateY(-100%); height: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragYCallback(item, dy => {
                        SettingObserver.consoleHeight.set(getSettings().layoutOptions.consoleHeight - dy);
                        const scrollContainer = layout.mainWindowStack.container.element;
                        scrollContainer.scrollTop -= dy;
                    });
                }),
            TemplateElement.html(`<div class="drag-vert" style="position: absolute; bottom: 0; left: 0; right: 0; transform: translateY(100%); height: 1em;"></div>`)
                .and(item => {
                    LayoutHelper.addDragYCallback(item, dy => {
                        SettingObserver.consoleHeight.set(getSettings().layoutOptions.consoleHeight + dy);
                        const scrollContainer = layout.mainWindowStack.container.element;
                        scrollContainer.scrollTop += dy;
                    });
                }),
            self.container
                .and(item => ShapeRenderer.rect(item, BevelOptions.bevel2, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit))),
        ]);

        this.addLine(LogLevel.info, "Example info msg");
        this.addLine(LogLevel.warn, "Example warn msg");
        this.addLine(LogLevel.error, "Example error msg");
    }

    clear(): void {
        this.container.element.innerHTML = '';
    }

    addLine(level: LogLevel, text: string): void {
        const numLines = this.container.element.children.length / 2;
        const classStr = level.logClass === undefined ? "" : ` class="${level.logClass}"`;
        this.container.child([
            `<span>${numLines}</span>`,
            `<span>${new Date().toLocaleTimeString()} [${level.displayName}] <span${classStr}>${text}</span></span>`,
        ])
    }
}