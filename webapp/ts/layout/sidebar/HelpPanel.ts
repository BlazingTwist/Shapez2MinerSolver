import { SidebarPanel } from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { Strings } from "../../Strings.js";

export class HelpPanel extends SidebarPanel {
    constructor(title: string) {
        super(title);
        const pad = "1em";
        this.contentWrapper.child([
            Strings.referenceHowToUseTitle,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    Strings.referenceHowToUseHtml,
                    // The video is large, so use GitHub as a supplier, even (especially) for the offline version.
                    `<div><video style="max-width: 100%;" controls src="https://github.com/BlazingTwist/Shapez2MinerSolver/raw/refs/heads/master/docs/demo.webm"></video></div>`,
                    Strings.referenceHowToUse2Html,
                ]),
            `<div style="height: 2em;"></div>`,
            Strings.referenceControlsTitle,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    Strings.referenceControlsZoomTitle,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceControlsZoomHtml,
                        ]),
                    Strings.referenceControlsResizeTitle,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceControlsResizeHtml,
                        ]),
                ]),
            `<div style="height: 2em;"></div>`,
            Strings.referenceDetailedExplanationsTitle,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    Strings.referenceDtInputWinTitle,
                    `<img alt="input window with annotated interactive elements" style="max-width: 100%;" src="resources/help/inputWin.avif">`,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceDtInputWinHtml,
                        ]),
                    Strings.referenceDtPreviewTitle,
                    `<img alt="preview window with annotated interactive elements" style="max-width: 100%;" src="resources/help/previewWin.avif">`,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceDtPreviewHtml,
                        ]),
                    Strings.referenceDtOutputTitle,
                    `<img alt="output window with annotated interactive elements" style="max-width: 100%;" src="resources/help/outputWin.avif">`,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceDtOutputHtml,
                        ]),
                    Strings.referenceDtStatsTitle,
                    `<img alt="stats window with annotated interactive elements" style="max-width: 100%;" src="resources/help/statsWin.avif">`,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceDtStatsHtml,
                        ]),
                    Strings.referenceDtConsoleTitle,
                    `<img alt="console window with annotated interactive elements" style="max-width: 100%;" src="resources/help/consoleWin.avif">`,
                    TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                        .child([
                            Strings.referenceDtConsoleHtml,
                        ]),
                ]),
        ]);
    }
}