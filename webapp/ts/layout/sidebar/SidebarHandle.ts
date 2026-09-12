import { TemplateElement } from "../../HtmlTemplating.js";
import { BevelOptions, CutOptions, OctagonBevel, OctagonCut, RectBevel, ShapeColors, ShapeRenderer, SidebarPanel } from "../WindowStyle.js";
import { LayoutHelper } from "../LayoutHelper.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { SettingObserver } from "../../Settings.js";
import { Strings } from "../../Strings.js";
import { HelpPanel } from "./HelpPanel.js";

enum ESidebarButtons {
    Help,
    Settings,
    Links,
}

class SidebarButton {
    readonly iconClass: string;
    readonly button: ESidebarButtons;
    readonly title: string;
    readonly panel: SidebarPanel;
    readonly labelIcon: TemplateElement;

    constructor(iconClass: string, button: ESidebarButtons, title: string) {
        this.iconClass = iconClass;
        this.button = button;
        this.title = title;
        switch (button) {
            case ESidebarButtons.Help:
                this.panel = new HelpPanel(title);
                break;
            case ESidebarButtons.Settings:
                this.panel = new SettingsPanel(title);
                break;
            case ESidebarButtons.Links:
                this.panel = new SidebarPanel(title); // TODO
                break;

        }
        this.labelIcon = TemplateElement.html(`<i class="${iconClass} icon-color-gray" style="width: 1.25em;"></i>`)
    }

    public showPanel(visible: boolean): void {
        this.panel.visible = visible;
        const iconClassList = this.labelIcon.element.classList;
        if (visible) {
            iconClassList.remove("icon-color-gray");
            iconClassList.add("icon-color-white");
        } else {
            iconClassList.remove("icon-color-white");
            iconClassList.add("icon-color-gray");
        }
    }

    public static readonly all: SidebarButton[] = [
        new SidebarButton("icon-qmark", ESidebarButtons.Help, Strings.helpTitle),
        new SidebarButton("icon-gear", ESidebarButtons.Settings, Strings.settingsTitle),
        new SidebarButton("icon-link", ESidebarButtons.Links, Strings.linksTitle),
    ]
}

export class SidebarHandle {
    readonly frame: TemplateElement;

    constructor() {
        this.frame = TemplateElement.html(`<div class="sidebar-frame"></div>`)
            .child([
                TemplateElement.html(`<div style="position: relative;"></div>`)
                    .child(SidebarButton.all.map(btn => btn.panel.frame)),
                TemplateElement.html(`<div class="${BevelOptions.bevel2.bevelClass}" style="display: grid; padding: 0.3em; z-index: 1; background-color: ${ShapeColors.windowBg.colorExpr};"></div>`)
                    .child(TemplateElement.html(`<div style="position: relative; overflow: hidden;"></div>`)
                        .and(item => ShapeRenderer.octagon(item, CutOptions.cut8, BevelOptions.bevel4, ShapeColors.frameFg, OctagonCut.all, OctagonBevel.ctor(ShapeColors.frameFgLit, ShapeColors.frameFgUnlit)))
                        .child(TemplateElement.html(`<div class="${BevelOptions.bevel2.bevelClass} ${CutOptions.cut4.cutClass}"
                                                      style="position: absolute; inset: 0; display: grid; grid-template-columns: 1fr; grid-template-rows: repeat(3, auto) 1fr auto; grid-row-gap: 0.5em; padding: calc(0.5em + var(--bevel)) 0;"></div>`)
                            .child(SidebarButton.all.map(btn => {
                                return TemplateElement.html(`<div class="flex-center"></div>`)
                                    .child(TemplateElement.html(`<div class="flex-center clickable" title="${btn.title}" style="aspect-ratio: 1; padding: 0.75em;"></div>`)
                                        .and(item => ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.frameBg, OctagonCut.all, OctagonBevel.ctor(ShapeColors.frameFgUnlit, ShapeColors.frameFgLit)))
                                        .and(item => item.addEventListener("click", () => {
                                            if (btn.panel.visible) {
                                                btn.showPanel(false);
                                                LayoutHelper.setSidebarVisible(false);
                                            } else {
                                                for (let otherBtn of SidebarButton.all) {
                                                    otherBtn.showPanel(false);
                                                }
                                                btn.showPanel(true);
                                                LayoutHelper.setSidebarVisible(true);
                                            }
                                        }))
                                        .child(btn.labelIcon)
                                    )
                            }))
                            .child(TemplateElement.html(`<div class="${BevelOptions.bevel4.bevelClass}" style="position: relative; left: 0; display: grid;"></div>`)
                                .child([
                                    TemplateElement.html(`<div style="width: 100%; transform: translateX(-50%); container-type: size; --edgeCut: 50cqw;"></div>`)
                                        .and(item => ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.windowBg, OctagonCut.right, new OctagonBevel(undefined, ShapeColors.frameFgLit, ShapeColors.frameFgLit, undefined)))
                                ])
                            )
                            .child(TemplateElement.html(`<div style="display: grid; height: calc(20vh + 1em); grid-template-rows: auto 1fr; grid-row-gap: 0.5em; padding: 0 10%;"></div>`)
                                .and2(item => {
                                    // Font-Scale slider
                                    const slider = <HTMLInputElement>TemplateElement.html(`<input type="range" min="0.2" max="4" step="0.05" orient="vertical" class="clickable slider-vertical" style="position: absolute; inset: 0; margin: 0; opacity: 0;" aria-label="font-size slider">`).element;
                                    const sliderHandle = TemplateElement.html(`<div style="position: absolute; width: 75%; left: 50%; transform: translate(-50%, -50%); height: 0.5em; box-sizing: border-box;"></div>`)
                                    SettingObserver.fontScale.addListener(val => {
                                        slider.value = "" + val
                                        sliderHandle.element.style.bottom = ((val - Number(slider.min)) * 100 / Number(slider.max)) + "%";
                                    });
                                    slider.addEventListener("change", () => SettingObserver.fontScale.set(Number(slider.value)));
                                    slider.addEventListener("input", () => SettingObserver.fontScale.set(Number(slider.value)));

                                    const sliderWrapper = TemplateElement.html(`<div class="clickable" style="padding: 0.5em 0; position: relative;"></div>`)
                                        .and(item => {
                                            ShapeRenderer.rect(item, undefined, ShapeColors.frameBg, RectBevel.ctor(ShapeColors.frameBgUnlit, ShapeColors.frameFgLit));
                                        })
                                        .child([
                                            slider,
                                            TemplateElement.html(`<div style="position: relative; height: 100%; width: 100%; pointer-events: none;"></div>`)
                                                .child([
                                                    TemplateElement.html(`<div style="position: absolute; top: 0; bottom: 0; left: 50%; transform: translateX(-50%); width: 0.25em; box-sizing: border-box;"></div>`)
                                                        .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.frameBgUnlit, undefined)),
                                                    sliderHandle
                                                        .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightBtnLit, ShapeColors.lightBtnUnlit))),
                                                ]),
                                        ]);

                                    item.child(TemplateElement.html(`<div class="flex-center"><i class="icon-magnifier-pm icon-color-gray" style="height: 1em;"></i></div>`))
                                    item.child(sliderWrapper);
                                })
                            )
                        )
                    )
            ]);
    }
}