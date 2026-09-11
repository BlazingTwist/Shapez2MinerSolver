import {
    BevelOptions,
    CutOptions,
    GradientColor,
    OctagonBevel,
    OctagonCut,
    RectBevel,
    ShapeColors,
    ShapeRenderer,
    SidebarPanel
} from "../WindowStyle.js";
import { ChildElement, TemplateElement } from "../../HtmlTemplating.js";
import { KeybindT, SettingObserver, SettingsHelper, SettingsManager } from "../../Settings.js";
import { LayoutHelper } from "../LayoutHelper.js";
import { Strings } from "../../Strings.js";
import { KeyChord } from "../../InputManager.js";
import { Toast } from "../comp/Toast.js";

class SectionHeader {
    readonly panel: TemplateElement;
    readonly container: TemplateElement;

    constructor(title: string, tooltipContent: TemplateElement | undefined) {
        this.container = TemplateElement.html(`<div style="display: grid; grid-template-columns: auto; grid-row-gap: 1.5em; padding: 0.5em;"></div>`);
        this.panel = TemplateElement.html(`<div style="
            display: grid; grid-template-columns: 1fr; grid-row-gap: 1em;
            border-left: var(--thinLineFixed) solid ${ShapeColors.frameBgUnlit.colorExpr};
            border-right: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};
            padding-bottom: 0.5em;
            "></div>`)
            .child(TemplateElement.html(`<div style="position: relative; display: flex; flex-direction: row; align-items: stretch;"></div>`)
                .child([
                    TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto; grid-column-gap: 0.75em; background-color: ${ShapeColors.frameFg.colorExpr}; padding: 0 0.25em;
                        border-top: var(--thinLineFixed) solid ${ShapeColors.frameBgUnlit.colorExpr};
                        border-bottom: var(--thinLineFixed) solid ${ShapeColors.frameBgUnlit.colorExpr};"></div>`)
                        .child(`<span style="color: white; font-size: 1.15em;">${title}</span>`)
                        .and2(item => {
                            if (tooltipContent !== undefined) {
                                item.child(
                                    TemplateElement.html(`<div class="flex-center" style="border: 2px solid ${ShapeColors.lightPanelShadeUnlit.colorExpr}; background-color: ${ShapeColors.lightPanelShade.colorExpr}; height: 100%; box-sizing: border-box;"></div>`)
                                        .child(`<i class="icon-info hoverable" style="aspect-ratio: 1; height: 100%;"></i>`)
                                        .and2(trigger => LayoutHelper.tooltip(trigger).child(
                                            tooltipContent
                                        ))
                                );
                            }
                        }),
                    TemplateElement.html(`<div style="padding-right: calc(var(--thinLine) * 3); box-sizing: border-box; position: relative; height: 100%;"></div>`)
                        .child([
                            `<div style="aspect-ratio: 1; height: 100%; box-sizing: border-box; clip-path: polygon(-10px -10px, calc(100% + 10px) -10px, -10px calc(100% + 10px));
                                background-color: ${ShapeColors.frameFg.colorExpr};
                                border-top: var(--thinLineFixed) solid ${ShapeColors.frameBgUnlit.colorExpr};
                                border-bottom: var(--thinLineFixed) solid ${ShapeColors.frameBgUnlit.colorExpr};"></div>`,
                            `<div style="position: absolute; top: 0; right: 0; bottom: 0; aspect-ratio: 1; box-sizing: border-box; clip-path: polygon(calc(100% + 10px) -10px, calc(100% + 10px) calc(100% + 10px), -10px calc(100% + 10px));
                                background-color: ${ShapeColors.lightPanelShade.colorExpr};
                                border-top: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};
                                border-bottom: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};"></div>`
                        ]),
                    TemplateElement.html(`<div style="flex-grow: 1; background-color: ${ShapeColors.lightPanelShade.colorExpr};
                        border-top: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};
                        border-bottom: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};"></div>`),
                ])
            )
            .child(this.container);
    }

    then(fn: (self: SectionHeader) => void): SectionHeader {
        fn(this);
        return this;
    }
}

function valueShadow(target: TemplateElement): TemplateElement {
    target.element.style.boxShadow = "calc(var(--bevel) / 2) calc(var(--bevel) / 2) rgba(0, 0, 0, 0.2)";
    return target;
}

class OneLineEntry {
    readonly labelItem: TemplateElement;
    readonly valueItem: TemplateElement;

    constructor(label: string) {
        this.labelItem = TemplateElement.html(`<div style="display: grid; z-index: 1; padding-right: calc(3 * var(--thinLine));"></div>`)
            .and(item => ShapeRenderer.octagon(item, CutOptions.cut10, BevelOptions.bevel2, ShapeColors.lightBtn, new OctagonCut(false, false, true, false), new OctagonBevel(undefined, ShapeColors.lightPanelShade, undefined, undefined)))
            .child(TemplateElement.html(`<div style="display: grid; padding: 0 0.25em;"></div>`)
                .and(item => ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.frameBgLit, new OctagonCut(false, false, true, false), OctagonBevel.ctor(ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit)))
                .child(`<span style="align-self: center; padding: 0 0.25em; color: ${ShapeColors.fontLight2.colorExpr};">${label}</span>`)
            );
        this.valueItem = TemplateElement.html(`<div style="display: grid;
                border-top: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
                border-right: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
                border-bottom: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
                padding-left: calc(3 * var(--thinLine));
                margin-left: calc(-3 * var(--thinLine));
                "></div>`);
        valueShadow(this.valueItem);
    }

    then(fn: (self: OneLineEntry) => void): OneLineEntry {
        fn(this);
        return this;
    }

    items(): TemplateElement[] {
        return [this.labelItem, this.valueItem];
    }
}

function inlineTooltip(tooltipContent: TemplateElement): TemplateElement {
    return TemplateElement.html(`<div class="flex-center" style="margin-left: calc(3 * var(--thinLine));
            background-color: ${ShapeColors.lightPanelShade.colorExpr}; height: 100%; aspect-ratio: 1; box-sizing: border-box;
            border: var(--thinLineFixed) solid ${ShapeColors.lightPanelShadeUnlit.colorExpr};
            "></div>`)
        .child(`<i class="icon-info hoverable" style="height: 70%"></i>`)
        .and2(trigger => LayoutHelper.tooltip(trigger).child(
            tooltipContent
        ));
}

function handleTooltip(line: ChildElement[], tooltipContent: TemplateElement | undefined): ChildElement[] {
    if (tooltipContent === undefined) {
        return [...line, `<span></span>`];
    } else {
        return [
            TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 4; position: relative;"></div>`)
                .child(line)
                .child(inlineTooltip(tooltipContent)),
        ];
    }
}

function checkbox(prop: SettingObserver<boolean>): TemplateElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    prop.addListener(val => input.checked = val);
    input.addEventListener("change", _ => prop.set(input.checked));
    return TemplateElement.html(`<div class="transparent-checkbox"></div>`)
        .child(input)
        .child(TemplateElement.html(`<div class="input-check-on"></div>`)
            .and(item => ShapeRenderer.indicator(item, undefined, undefined,
                GradientColor.indicatorGradient(ShapeColors.indicatorOnHighlight, ShapeColors.indicatorOnInner, ShapeColors.indicatorOnOuter)
            )))
        ;
}

function checkboxOneLiner(label: string, prop: SettingObserver<boolean>, tooltipContent: TemplateElement | undefined = undefined): ChildElement[] {
    const line = new OneLineEntry(label);
    line.valueItem.child(checkbox(prop));
    return handleTooltip([
        line.labelItem,
        TemplateElement.html(`<div style="display: grid; grid-template-columns: auto 1fr;"></div>`)
            .child(line.valueItem)
    ], tooltipContent);
}

function numberInput(min: number, max: number, step: number, prop: SettingObserver<number>): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "" + min;
    input.max = "" + max;
    input.step = "" + step;
    prop.addListener(val => input.value = "" + val);
    input.addEventListener("change", _ => {
        let newValue = Number(input.value);
        if (newValue > max) {
            input.value = "" + max;
            newValue = max;
        } else if (newValue < min) {
            input.value = "" + min;
            newValue = min;
        }
        prop.set(newValue);
    });
    return input;
}

function stringInput(prop: SettingObserver<string>): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    prop.addListener(val => input.value = val);
    input.addEventListener("change", _ => {
        prop.set(input.value);
    });
    return input;
}

function multilinePanel(label: string, content: ChildElement[]): TemplateElement {
    const wrapper = TemplateElement.html(`<div style="position: relative; display: grid; grid-template-columns: subgrid; grid-column: span 3; grid-template-rows: auto 1fr;"></div>`);
    const labelItem = TemplateElement.html(`<div style="display: grid; z-index: 1; padding-right: calc(3 * var(--thinLine));"></div>`)
        .and(item => ShapeRenderer.octagon(item, CutOptions.cut10, BevelOptions.bevel2, ShapeColors.lightBtn, new OctagonCut(false, false, true, false), new OctagonBevel(undefined, ShapeColors.lightPanelShade, undefined, undefined)))
        .child(TemplateElement.html(`<div style="display: grid; padding: calc(2 * var(--bevel)) 0.25em;"></div>`)
            .and(item => ShapeRenderer.octagon(item, undefined, undefined, ShapeColors.frameBgLit, new OctagonCut(false, false, true, false), OctagonBevel.ctor(ShapeColors.frameBgUnlit, ShapeColors.frameBgUnlit)))
            .child(`<span style="align-self: center; padding: 0 0.25em; color: ${ShapeColors.fontLight2.colorExpr};">${label}</span>`)
        );
    const valueItem = TemplateElement.html(`<div style="grid-row: span 2; display: grid;
            border-top: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
            border-right: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
            border-bottom: var(--bevel) solid ${ShapeColors.lightPanelShade.colorExpr};
            border-left: var(--thinLine) solid ${ShapeColors.lightPanelShade.colorExpr};
            padding-left: calc(3 * var(--thinLine));
            margin-left: calc(-3 * var(--thinLine));
            "></div>`);

    valueItem.child(content);

    const c1 = ShapeColors.lightBtn.colorExpr;
    const c2 = ShapeColors.lightPanelShade.colorExpr;
    // noinspection CssInvalidPropertyValue
    const spacer = TemplateElement.html(`<div class="${CutOptions.cut8.cutClass}" style="
            position: absolute; inset: 0;
            border: 1px solid ${c2};
            border-right: none;
            background: repeating-linear-gradient(225deg, ${c1}, ${c1} calc(1.25 * var(--edgeCut)), ${c2} var(--edgeCut), ${c2} calc(2 * var(--edgeCut)));
            "></div>`);

    wrapper.child([
        labelItem,
        valueItem,
        `<span></span>`,
        TemplateElement.html(`<div style="position: relative; overflow: hidden; display: grid; margin-right: calc(3 * var(--thinLine)); margin-top: calc(2 * var(--thinLine));"></div>`)
            .child(spacer),
    ]);
    return wrapper;
}

function multiLineTrimToNullParser(val: string): string[] {
    return val.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 0);
}

function multiLineText(label: string, prop: SettingObserver<string[]>, valParser: (val: string) => string[]): TemplateElement {
    const textAreaTmp = TemplateElement.html(`<textarea style="field-sizing: content; resize: none; min-width: 5ch;"></textarea>`);
    const textArea = <HTMLTextAreaElement>textAreaTmp.element;
    prop.addListener(lines => {
        textArea.value = lines.join("\n");
    });
    textArea.addEventListener("change", () => {
        prop.set(valParser(textArea.value));
    });

    return multilinePanel(label, [textAreaTmp]);
}

function dropDownInput(prop: SettingObserver<string>, choices: SettingObserver<string[]>): TemplateElement {
    const selectTemplate = TemplateElement.html(`<select class="clickable" style="width: 100%;"></select>`);
    const select = <HTMLSelectElement>selectTemplate.element;
    choices.addListener(val => {
        select.innerHTML = "";
        selectTemplate.child(val.map(choice => TemplateElement.html(`<option value="${choice}">${choice}</option>`)));
        select.value = prop.get();
    });
    prop.addListener(val => select.value = val);
    select.addEventListener("change", () => prop.set(select.value));
    return selectTemplate;
}

function dropDownInputFixed(prop: SettingObserver<string>, choices: TemplateElement[]): TemplateElement {
    const selectTemplate = TemplateElement.html(`<select class="clickable" style="width: 100%;"></select>`);
    const select = <HTMLSelectElement>selectTemplate.element;
    selectTemplate.child(choices);
    prop.addListener(val => select.value = val);
    select.addEventListener("change", () => prop.set(select.value));
    return selectTemplate;
}

function numberOneLiner(label: string, min: number, max: number, step: number, prop: SettingObserver<number>, tooltipContent: TemplateElement | undefined = undefined): ChildElement[] {
    const line = new OneLineEntry(label);
    const input = numberInput(min, max, step, prop);
    line.valueItem.child(input);
    return handleTooltip(line.items(), tooltipContent);
}

function sliderH(min: number, max: number, step: number, prop: SettingObserver<number>, immediate: boolean = true): {
    wrapper: TemplateElement,
    slider: HTMLInputElement
} {
    const slider = <HTMLInputElement>TemplateElement.html(`<input type="range" min="${min}" max="${max}" step="${step}" class="clickable" style="position: absolute; inset: 0; margin: 0; opacity: 0;">`).element;
    const sliderHandle = TemplateElement.html(`<div style="position: absolute; height: 75%; top: 50%; transform: translate(-50%, -50%); width: 0.5em; box-sizing: border-box;"></div>`)
    prop.addListener(val => {
        slider.value = "" + val
        sliderHandle.element.style.left = ((val - Number(slider.min)) * 100 / Number(slider.max)) + "%";
    });
    slider.addEventListener("change", () => prop.set(Number(slider.value)));
    if (immediate) {
        slider.addEventListener("input", () => prop.set(Number(slider.value)));
    } else {
        slider.addEventListener("input", () => {
            sliderHandle.element.style.left = ((Number(slider.value) - Number(slider.min)) * 100 / Number(slider.max)) + "%";
        });
    }

    const sliderWrapper = TemplateElement.html(`<div class="clickable" style="padding: 0 0.5em; position: relative;"></div>`)
        .child([
            slider,
            TemplateElement.html(`<div style="position: relative; height: 100%; width: 100%; pointer-events: none;"></div>`)
                .child([
                    TemplateElement.html(`<div style="position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 0.25em; box-sizing: border-box;"></div>`)
                        .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.frameBgUnlit, undefined)),
                    sliderHandle
                        .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.frameFg, RectBevel.ctor(ShapeColors.frameFgLit, ShapeColors.frameFgUnlit))),
                ]),
        ]);

    return {
        wrapper: sliderWrapper,
        slider: slider
    };
}

function sliderOneLiner(label: string, min: number, max: number, step: number, prop: SettingObserver<number>, immediate: boolean = true): ChildElement[] {
    const line = new OneLineEntry(label);
    let input: HTMLInputElement;

    input = numberInput(min, max, step, prop);
    input.style.width = "6ch";
    const sliderTuple = sliderH(min, max, step, prop, immediate);

    line.valueItem.child(input);
    return [...line.items(), sliderTuple.wrapper];
}

function button(label: string, onclick: (self: TemplateElement) => void): TemplateElement {
    return TemplateElement.html(`<button class="clickable ${BevelOptions.bevel2.bevelClass}" style="font-size: 0.9em;">${label}</button>`)
        .and(item => ShapeRenderer.octagon(item, CutOptions.cut4, undefined, ShapeColors.lightBtn, OctagonCut.left, OctagonBevel.ctor(ShapeColors.lightPanelShade, ShapeColors.lightPanelShadeUnlit)))
        .and2(item => item.element.addEventListener("click", () => onclick(item)));
}

function tooltipButtonSquare(labelIconClass: string): TemplateElement {
    return valueShadow(
        TemplateElement.html(`
            <button class="flex-center ${BevelOptions.bevel4.bevelClass}" style="padding: 0 0.25em;">
                <i style="height: 0.8em;" class="clickable icon-color-dark ${labelIconClass}"></i>
            </button>`)
            .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightPanelShade, ShapeColors.lightPanelShadeUnlit)))
    );
}

function buttonSquare(labelIconClass: string, title: string, onclick: () => void): TemplateElement {
    return valueShadow(
        TemplateElement.html(`
            <button class="flex-center clickable ${BevelOptions.bevel4.bevelClass}" style="padding: 0 0.25em;" title="${title}">
                <i style="height: 0.9em;" class="icon-color-dark ${labelIconClass}"></i>
            </button>`)
            .and(item => ShapeRenderer.rect(item, undefined, ShapeColors.lightBtn, RectBevel.ctor(ShapeColors.lightPanelShade, ShapeColors.lightPanelShadeUnlit)))
            .and(item => item.addEventListener("click", () => onclick()))
    );
}

function themeButton(label: string, hueShift: number): TemplateElement {
    return TemplateElement.html(`<button class="clickable ${BevelOptions.bevel4}" style="color: white; font-size: 0.9em; --color-shift: ${hueShift}; padding: 0.1em 0.5em;">${label}</button>`)
        .and(item => ShapeRenderer.octagon(item, CutOptions.cut4, undefined, ShapeColors.frameFg, OctagonCut.left, OctagonBevel.ctor(ShapeColors.frameFgLit, ShapeColors.frameFgUnlit)))
        .and(item => item.addEventListener("click", () => {
            SettingObserver.colorShift.set(hueShift);
        }));
}

function minerBpPanel(wrapper: TemplateElement | undefined, label: string, bpProp: SettingObserver<string>, bpPresetProp: SettingObserver<string>, bpList: TemplateElement[]): TemplateElement {
    if (wrapper === undefined) {
        wrapper = TemplateElement.html(`<div style="display: grid; grid-template-columns: auto minmax(0, max-content) 1fr; grid-row-gap: 1em;"></div>`);
    }

    const bpInput = stringInput(bpProp);
    bpInput.addEventListener("input", () => bpPresetProp.set("custom"));
    bpInput.style.borderBottom = `1px solid ${ShapeColors.lightPanelShade.colorExpr}`

    wrapper.child([
        multilinePanel(label, [
            bpInput,
            dropDownInputFixed(bpPresetProp, bpList)
        ])
    ]);
    return wrapper;
}

const noOp = (..._: any[]) => {
}

const solverFallbackModes = new SettingObserver(() => ["shape", "fluid", "ignored"], noOp);
type MinerBlueprint = {
    name: string;
    author: string | undefined;
    numFloors: 2 | 3;
    numBuildings: number;
    fileName: string;
}
const shapeBlueprints: MinerBlueprint[] = [
    { name: "Cheapest post 1.0", author: "404", numFloors: 3, numBuildings: 76, fileName: "shape_f3_1_cheapest_v2.spz2" },
    { name: "Anti-Gap", author: undefined, numFloors: 3, numBuildings: 100, fileName: "shape_f3_2_anti_gap.spz2" },
    { name: "Cheapest pre 1.0", author: "404", numFloors: 3, numBuildings: 94, fileName: "shape_f3_3_cheapest_v1.spz2" },
    { name: "Cheapest post 1.0", author: undefined, numFloors: 2, numBuildings: 62, fileName: "shape_f2_1_cheapest_v2.spz2" },
    { name: "Anti-Gap", author: undefined, numFloors: 2, numBuildings: 82, fileName: "shape_f2_2_anti_gap.spz2" },
];
const fluidBlueprints: MinerBlueprint[] = [
    { name: "Default", author: undefined, numFloors: 3, numBuildings: 62, fileName: "fluid_f3_1_default.spz2" },
    { name: "Default", author: undefined, numFloors: 2, numBuildings: 53, fileName: "fluid_f2_1_default.spz2" },
];

function minerToOption(miner: MinerBlueprint) {
    const x = miner;
    const authorStr = x.author === undefined ? "" : ` - by ${x.author}`;
    return TemplateElement.html(`<option value="${x.fileName}">${x.numFloors} floors - ${x.numBuildings} buildings${authorStr} - ${x.name}</option>`);
}

const shapeMinerDropdown: TemplateElement[] = [
    TemplateElement.html(`<option value="custom">custom</option>`),
    TemplateElement.html(`<optgroup label="3 Floors"></optgroup>`)
        .child(shapeBlueprints.filter(x => x.numFloors == 3).map(minerToOption)),
    TemplateElement.html(`<optgroup label="2 Floors"></optgroup>`)
        .child(shapeBlueprints.filter(x => x.numFloors == 2).map(minerToOption)),
];
const fluidMinerDropdown: TemplateElement[] = [
    TemplateElement.html(`<option value="custom">custom</option>`),
    TemplateElement.html(`<optgroup label="3 Floors"></optgroup>`)
        .child(fluidBlueprints.filter(x => x.numFloors == 3).map(minerToOption)),
    TemplateElement.html(`<optgroup label="2 Floors"></optgroup>`)
        .child(fluidBlueprints.filter(x => x.numFloors == 2).map(minerToOption)),
];

function phaseSettingsHeader(phaseName: string, tooltipText: string, padTop: boolean = false): TemplateElement {
    return TemplateElement.html(`<div style="position: relative; grid-column: span 4; ${padTop ? 'padding-top: 0.3em;' : ''}"></div>`)
        .child(TemplateElement.html(`<div style="display: flex; flex-direction: row;"></div>`)
            .child([
                `<span style="font-weight: bold;">${phaseName}</span>`,
                TemplateElement.html(`<div style="display: grid; height: 1.2em; width: 1.2em;"></div>`)
                    .child(inlineTooltip(TemplateElement.html(`<span style="white-space: wrap;">${tooltipText}</span>`))),
            ])
        )
}

function keyMapGroupHeader(groupName: string, padTop: boolean = false): TemplateElement {
    return TemplateElement.html(`<div style="position: relative; grid-column: span 3; ${padTop ? 'padding-top: 0.3em;' : ''}"></div>`)
        .child(TemplateElement.html(`<div style="display: flex; flex-direction: row;"></div>`)
            .child(`<span style="font-weight: bold;">${groupName}</span>`)
        );
}

function multiLineKeybind(label: string, prop: SettingObserver<KeyChord[]>): TemplateElement {
    const chordContainer = TemplateElement.html(`<div class="${ShapeColors.lightPanelShade.colorClass} key-chord-container" style="display: grid;"></div>`);
    const popOverContainer = TemplateElement.html(`<div style="display: grid;"></div>`)
        .child(chordContainer);
    const chordPopOver = LayoutHelper.popOver(popOverContainer);
    let focusInputIdx: number | undefined = undefined;
    const openPopup: () => void = () => {
        const addBtn = TemplateElement.html(`<button class="clickable-light">${Strings.settings.addNewChord}</button>`);

        chordPopOver.content.element.innerHTML = "";
        chordPopOver.content.child(TemplateElement.html(`<div style="display: grid; grid-row-gap: 0.5em;"></div>`)
            .child(addBtn
                .and(item => item.addEventListener("click", () => {
                    const chordsCopy = [...prop.get()];
                    focusInputIdx = chordsCopy.length;
                    chordsCopy.push(["KeyA"]);
                    chordPopOver.closeFn();
                    prop.set(chordsCopy);
                }))
            )
            .child(prop.get().map(chord => {
                    return TemplateElement.html(`<button class="clickable-light">${Strings.settings.deleteChord} '${chord.join("+")}'</button>`)
                        .and(item => item.addEventListener("click", () => {
                            const chordsCopy = [...prop.get()];
                            const idx = chordsCopy.indexOf(chord);
                            if (idx >= 0) {
                                chordsCopy.splice(idx, 1);
                                prop.set(chordsCopy);
                            }
                            chordPopOver.closeFn();
                        }))
                })
            )
        );
        window.requestAnimationFrame(() => {
            addBtn.element.focus();
        });
        chordPopOver.openFn();
    };
    chordContainer.element.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        openPopup();
    })
    prop.addListener(chords => {
        const chordsCopy = [...chords];
        chordContainer.element.innerHTML = "";
        chordContainer.child(chords.map((c, i) => {
            const keyHandler = TemplateElement.html(`<input type="text" style="field-sizing: content; min-width: 5ch;">`);
            const keyHandlerInput = <HTMLInputElement>keyHandler.element;
            keyHandlerInput.value = c.join("+");
            let pressedKeys: Set<string> = new Set<string>();
            let newChord: string[] = [];
            keyHandlerInput.addEventListener("mousedown", ev => {
                if (ev.button === 2) {
                    ev.preventDefault();
                }
            });
            keyHandlerInput.addEventListener("focusin", () => {
                keyHandlerInput.value = "...";
                pressedKeys.clear();
                newChord = [];
            });
            keyHandlerInput.addEventListener("focusout", () => {
                if (newChord.length > 0) {
                    if (c.length > 0) {
                        c.splice(0, c.length);
                    }
                    c.push(...newChord);
                    prop.set(chordsCopy);
                }
                keyHandlerInput.value = c.join("+");
            });
            keyHandlerInput.addEventListener("keydown", ev => {
                if (ev.code == "Tab") {
                    return;
                }

                ev.preventDefault();
                ev.stopPropagation();

                if (ev.code == "ContextMenu") {
                    openPopup();
                    return;
                }

                pressedKeys.add(ev.code);
                newChord = Array.from(pressedKeys);
                if (newChord.length <= 0) {
                    keyHandlerInput.value = "...";
                } else {
                    keyHandlerInput.value = newChord.join("+");
                }
            });
            keyHandlerInput.addEventListener("keyup", ev => {
                ev.preventDefault();
                ev.stopPropagation();
                pressedKeys.delete(ev.code);
            });

            if (focusInputIdx === i) {
                focusInputIdx = undefined;
                window.requestAnimationFrame(() => {
                    keyHandlerInput.focus();
                });
            }

            return keyHandler;
        }));
    });

    return multilinePanel(label, [popOverContainer]);
}

export class SettingsPanel extends SidebarPanel {
    constructor(title: string) {
        super(title);
        this.contentWrapper.element.id = "settings-panel";
        this.contentWrapper.child([
            TemplateElement.html(`<div style="width: 100%; display: grid; grid-template-columns: 1fr; grid-row-gap: 1em;"></div>`)
                .child([
                    new SectionHeader(Strings.saveLoad, undefined)
                        .then(header => header.container.child(
                            TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                .child(checkboxOneLiner(Strings.autoSave, SettingObserver.saveToBrowserAutomatically))
                                .child(TemplateElement.html(`<div style="grid-column: span 3; display: grid; grid-template-columns: auto auto 1fr; grid-gap: 1em; z-index: 1;"></div>`)
                                    .child([
                                        button(Strings.saveToBrowser, (btn) => {
                                            const msg = SettingsManager.exportToLocalStorage() ? Strings.saveSuccess : Strings.saveFailed;
                                            Toast.getInstance().show(msg, btn.element);
                                        }),
                                        button(Strings.loadFromBrowser, (btn) => {
                                            const msg = SettingsManager.importFromLocalStorage() ? Strings.loadSuccess : Strings.loadFailed;
                                            Toast.getInstance().show(msg, btn.element);
                                        }),
                                        `<span></span>`,
                                        button(Strings.saveToFile, (_) => SettingsManager.exportSettingsToFile()),
                                        button(Strings.loadFromFile, (_) => SettingsManager.importSettingsFromFile()),
                                        `<span></span>`,
                                        button(Strings.resetAll, (_) => {
                                            const userOk = window.confirm(Strings.confirmResetAll);
                                            if (userOk) {
                                                SettingsManager.resetAll();
                                            }
                                        }).and(item => item.style.gridColumn = "span 2"),
                                        `<span></span>`,
                                    ])
                                )
                        ))
                        .panel,
                    new SectionHeader(Strings.settings.solver, undefined)
                        .then(header => header.container.child(
                            TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr; grid-row-gap: 1em;"></div>`)
                                .child([
                                    TemplateElement.html(`<div style="position: relative; display: grid; grid-template-columns: auto minmax(0, max-content) auto 1fr; grid-row-gap: 1em;"></div>`)
                                        .child([
                                            ...new OneLineEntry(Strings.settings.profile).then(line => {
                                                line.valueItem.child(dropDownInput(SettingObserver.profile, SettingObserver.profiles))
                                            }).items(),
                                            TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto auto; padding-left: 0.5em; grid-column-gap: 0.5em;"></div>`)
                                                .child([
                                                    tooltipButtonSquare("icon-plus")
                                                        .and2(trigger => {
                                                                const popOver = LayoutHelper.popOver(trigger, true);
                                                                popOver.content.and2(saveAsPanel => {
                                                                    let saveAsName = "";
                                                                    const saveAsNameObserver = new SettingObserver(
                                                                        () => saveAsName,
                                                                        (val) => saveAsName = val,
                                                                    );
                                                                    SettingObserver.profile.addListener(val => saveAsNameObserver.set(val));
                                                                    const saveAsInput = new OneLineEntry(Strings.saveAs).then(line => {
                                                                        line.valueItem.child(stringInput(saveAsNameObserver));
                                                                    });
                                                                    const submitBtn = button(Strings.submit, (_) => {
                                                                        SettingsHelper.saveProfile({
                                                                                name: saveAsName,
                                                                                profile: SettingsHelper.clone(SettingsHelper.getSolverSettings()),
                                                                            },
                                                                            () => window.confirm(Strings.confirmOverwriteProfile.replaceAll("{0}", saveAsName))
                                                                        );
                                                                        SettingObserver.profile.set(saveAsName);
                                                                        popOver.closeFn();
                                                                    });
                                                                    submitBtn.element.style.zIndex = "1";
                                                                    saveAsPanel.child(TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 0.5em auto 1fr"></div>`)
                                                                        .child(saveAsInput.items())
                                                                        .child(`<span></span>`)
                                                                        .child(submitBtn)
                                                                    );
                                                                })
                                                            }
                                                        ),
                                                    buttonSquare("icon-minus", Strings.deleteProfile, () => {
                                                        SettingsHelper.deleteProfile();
                                                    }),
                                                    buttonSquare("icon-reset", Strings.resetProfile, () => {
                                                        SettingsHelper.resetProfile();
                                                    }),
                                                ]),
                                            `<span></span>`
                                        ])
                                ])
                        ))
                        .then(solverHeader => solverHeader.container.child(new SectionHeader(Strings.settings.parser, TemplateElement.html(Strings.parserHintHtml))
                            .then(header => {
                                header.container.child(TemplateElement.html(`<div style="display: grid; grid-template-columns: auto minmax(0, max-content) 1fr; grid-row-gap: 1em;"></div>`)
                                    .child([
                                        multiLineText(Strings.settings.shapeCodes, SettingObserver.solverShapeCodes, multiLineTrimToNullParser),
                                        multiLineText(Strings.settings.fluidCodes, SettingObserver.solverFluidCodes, multiLineTrimToNullParser),
                                        multiLineText(Strings.settings.ignoredCodes, SettingObserver.solverIgnoredCodes, multiLineTrimToNullParser),
                                        ...new OneLineEntry(Strings.settings.fallbackMode).then(line => {
                                            line.valueItem.child(dropDownInput(SettingObserver.solverFallbackMode, solverFallbackModes))
                                        }).items(),
                                        `<span></span>`,
                                    ])
                                );
                            })
                            .panel
                        ))
                        .then(solverHeader => solverHeader.container.child(new SectionHeader(Strings.settings.minerBps, TemplateElement.html(Strings.minerBpsHintHtml))
                            .then(header => {
                                const content = minerBpPanel(undefined, Strings.settings.shape, SettingObserver.solverShapeMiner, SettingObserver.solverShapeMinerPresetId, shapeMinerDropdown);
                                minerBpPanel(content, Strings.settings.fluid, SettingObserver.solverFluidMiner, SettingObserver.solverFluidMinerPresetId, fluidMinerDropdown);
                                header.container.child(content);
                            })
                            .panel
                        ))
                        .then(solverHeader => solverHeader.container.child(new SectionHeader(Strings.settings.advanced, TemplateElement.html(Strings.advancedHintHtml))
                            .then(header => {
                                header.container.child(TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                    .child(phaseSettingsHeader(Strings.settings.phase1, Strings.phase1Desc))
                                    .child(TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 4; padding-left: 0.5em; grid-row-gap: 0.75em;"></div>`)
                                        .child(numberOneLiner(Strings.settings.maxLookahead, 0, 1023, 1, SettingObserver.solverP1MaxLookahead, TemplateElement.html(Strings.maxLookaheadHintHtml)))
                                        .child(numberOneLiner(Strings.settings.preScanCw, 0, 1023, 1, SettingObserver.solverP1PreScanCwCount, TemplateElement.html(Strings.preScanCwHintHtml)))
                                        .child(numberOneLiner(Strings.settings.preScanCcw, 0, 1023, 1, SettingObserver.solverP1PreScanCcwCount, TemplateElement.html(Strings.preScanCcwHintHtml)))
                                    )
                                    .child(phaseSettingsHeader(Strings.settings.phase2, Strings.phase2Desc, true))
                                    .child(TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 4; padding-left: 0.5em; grid-row-gap: 0.75em;"></div>`)
                                        .child(checkboxOneLiner(Strings.settings.optimizeOccupied, SettingObserver.solverP2OptimizeOccupied, TemplateElement.html(Strings.optimizeOccupiedHintHtml)))
                                        .child(numberOneLiner(Strings.settings.targetMinScore, -65565, 65565, 1, SettingObserver.solverP2TargetMinScore, TemplateElement.html(Strings.targetMinScoreHintHtml)))
                                        .child(numberOneLiner(Strings.settings.maxRetryMiners, -1, 1023, 1, SettingObserver.solverP2MaxRetryMiners, TemplateElement.html(Strings.maxRetryMinersHintHtml)))
                                    )
                                    .child(phaseSettingsHeader(Strings.settings.phase3, Strings.phase3Desc, true))
                                    .child(TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 4; padding-left: 0.5em; grid-row-gap: 0.75em;"></div>`)
                                        .child(numberOneLiner(Strings.settings.maxBeamWidth, 1, 255, 1, SettingObserver.solverP3MaxBeamWidth, TemplateElement.html(Strings.maxBeamWidthHintHtml)))
                                        .child(numberOneLiner(Strings.settings.beamWidthTiles, 1, 16777215, 100, SettingObserver.solverP3ReduceBeamWidthNTiles, TemplateElement.html(Strings.beamWidthTilesHintHtml)))
                                    )
                                );
                            })
                            .panel
                        ))
                        .panel,
                    new SectionHeader(Strings.settings.gui, undefined)
                        .then(guiHeader => guiHeader.container.child(
                            new SectionHeader(Strings.settings.appearance, undefined)
                                .then(appearanceHeader => {
                                    appearanceHeader.container.child(TemplateElement.html(`<div style="display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; z-index: 1; gap: 0.5em;"></div>`)
                                        .child([
                                            themeButton(Strings.settings.themeName.purple, 0),
                                            themeButton(Strings.settings.themeName.magenta, 56),
                                            themeButton(Strings.settings.themeName.red, 95),
                                            themeButton(Strings.settings.themeName.copper, 131),
                                            themeButton(Strings.settings.themeName.green, 191),
                                            themeButton(Strings.settings.themeName.blue, 326),
                                        ])
                                    );
                                    appearanceHeader.container.child(TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; z-index: 1; grid-row-gap: 1em;"></div>`)
                                        .child(sliderOneLiner(Strings.settings.theme, 0, 360, 1, SettingObserver.colorShift))
                                        .child(sliderOneLiner(Strings.settings.decor, 0.2, 4, 1 / 20, SettingObserver.decorationScale))
                                        .child(sliderOneLiner(Strings.settings.font, 0.2, 4, 1 / 20, SettingObserver.fontScale, false))
                                    );
                                })
                                .panel
                        ))
                        .then(guiHeader => guiHeader.container.child(
                            new SectionHeader(Strings.settings.previewWindow, undefined)
                                .then(header => header.container.child(
                                    TemplateElement.html(`<div style="display: grid; grid-template-columns: 1fr; grid-row-gap: 1em;"></div>`)
                                        .child([
                                            TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                                .child(checkboxOneLiner(Strings.settings.liveUpdate, SettingObserver.previewLiveUpdate)),
                                            TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                                .child(sliderOneLiner(Strings.settings.resolutionScale, 0.1, 2, 0.1, SettingObserver.previewResolutionScale)),
                                        ])
                                ))
                                .then(previewHeader => previewHeader.container.child(
                                    new SectionHeader(Strings.settings.tooltip, undefined)
                                        .then(header => header.container.child(
                                            TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                                .child([
                                                    ...checkboxOneLiner(Strings.settings.showWorldCoordinates, SettingObserver.tooltipShowWorldCoordinates),
                                                    ...checkboxOneLiner(Strings.settings.showIslandCoordinates, SettingObserver.tooltipShowIslandCoordinates),
                                                    ...checkboxOneLiner(Strings.settings.showIslandID, SettingObserver.tooltipShowIslandId),
                                                    ...checkboxOneLiner(Strings.settings.showIslandType, SettingObserver.tooltipShowIslandType),
                                                    ...checkboxOneLiner(Strings.settings.showErrors, SettingObserver.tooltipShowErrors),
                                                    ...checkboxOneLiner(Strings.settings.showWarnings, SettingObserver.tooltipShowWarnings),
                                                ])
                                        ))
                                        .panel
                                ))
                                .panel
                        ))
                        .panel,
                    new SectionHeader(Strings.settings.keymap, TemplateElement.html(Strings.keymapHintHtml))
                        .then(header => {
                            header.container.child(TemplateElement.html(`<div style="display: grid; grid-template-columns: auto auto 1fr; grid-row-gap: 1em;"></div>`)
                                .child(keyMapGroupHeader(Strings.previewTitle, true))
                                .child(TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 3; padding-left: 0.5em; grid-row-gap: 0.75em;"></div>`)
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.nextFrame, SettingObserver.keybinds[KeybindT.nextFrame.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.prevFrame, SettingObserver.keybinds[KeybindT.prevFrame.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.toggleTooltip, SettingObserver.keybinds[KeybindT.toggleTooltip.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.renderModeBitMap, SettingObserver.keybinds[KeybindT.renderModeBitMap.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.renderModeSvg, SettingObserver.keybinds[KeybindT.renderModeSvg.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.renderModeOccupancy, SettingObserver.keybinds[KeybindT.renderModeOccupancy.settingsKey]))
                                )
                                .child(keyMapGroupHeader(Strings.statsTitle))
                                .child(TemplateElement.html(`<div style="display: grid; grid-template-columns: subgrid; grid-column: span 3; padding-left: 0.5em; grid-row-gap: 0.75em;"></div>`)
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.nextStat, SettingObserver.keybinds[KeybindT.nextStat.settingsKey]))
                                    .child(multiLineKeybind(Strings.settings.keymapKeys.prevStat, SettingObserver.keybinds[KeybindT.prevStat.settingsKey]))
                                )
                            );
                        })
                        .panel,
                    TemplateElement.html(`<div style="height: 3em;"></div>`),
                ]),
        ])
    }
}