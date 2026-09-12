import { SidebarPanel } from "../WindowStyle.js";
import { TemplateElement } from "../../HtmlTemplating.js";
import { Strings } from "../../Strings.js";

export class LinksPanel extends SidebarPanel {
    constructor(title: string) {
        super(title);
        const pad = "1em";
        this.contentWrapper.child([
            `<h2>${Strings.linksThisProject}</h2>`,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    `<ul>
                        <li><a href="https://github.com/BlazingTwist/Shapez2MinerSolver">${Strings.linksThisSource}</a></li>
                        <li><a href="https://github.com/BlazingTwist/Shapez2MinerSolver/issues">${Strings.linksThisIssues}</a></li>
                        <li><a href="https://github.com/BlazingTwist/Shapez2MinerSolver/releases/latest">${Strings.linksThisOfflineVersion}</a></li>
                        <li><a href="https://ko-fi.com/blazingtwist0016">${Strings.linksThisSupportMe}</a></li>
                    </ul>`,
                ]),
            `<div style="height: 2em;"></div>`,
            `<h2>${Strings.linksRelatedProjects}</h2>`,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    `<ul>
                        <li>${Strings.linksJiahaoSolver}
                            <a href="https://shapez2-tools.com/">${Strings.linksSite}</a>
                            <a href="https://s2-tools.zserver.dev/#planner">${Strings.linksJiahaoZmanSolver}</a>
                            <a href="https://github.com/jiahao-0204/Shapez2-MIP-Miner">${Strings.linksGithub}</a>
                        </li>
                        <li>${Strings.linksPolyominoSolver}
                            <a href="https://cemulate.github.io/polyomino-solver/">${Strings.linksSite}</a>
                            <a href="https://github.com/cemulate/polyomino-solver">${Strings.linksGithub}</a>
                        </li>
                        <li>${Strings.linksResearchPaper1}
                            <a href="https://ieeexplore.ieee.org/document/5641803">${Strings.linksIeeeXplore}</a>
                        </li>
                    </ul>`,
                ]),
            `<div style="height: 2em;"></div>`,
            `<h2>${Strings.linksMoreShapezTools}</h2>`,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    `<ul>
                        <li>${Strings.linksBlueprintInspector}
                            <a href="https://community-vortex.shapez2.com/blueprint">${Strings.linksSite}</a>
                        </li>
                        <li>${Strings.linksZmanOperatorLeaderboard}
                            <a href="https://s2-board.zserver.dev/">${Strings.linksSite}</a>
                        </li>
                        <li>${Strings.linksCommunityToolsIndex}
                            <a href="https://shapez2.wiki.gg/wiki/Community_Tools">${Strings.linksWikiGg}</a>
                        </li>
                    </ul>`,
                ]),
            `<div style="height: 2em;"></div>`,
            `<h2>${Strings.linksHonorableMentions}</h2>`,
            TemplateElement.html(`<div style="padding-left: ${pad};"></div>`)
                .child([
                    `<ul>
                        <li>${Strings.linksLastCallBbs}
                            <a href="https://store.steampowered.com/app/1511780/Last_Call_BBS/">${Strings.linksSteam}</a>
                        </li>
                    </ul>`,
                ]),
        ]);
    }
}