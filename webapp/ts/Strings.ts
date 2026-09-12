export class Strings {
    public static phase0Title = "Phase 0 (parsing / allocations)";
    public static phase1Title = "Phase 1 (maximizing miners on edge)";
    public static phase1Desc = "Fills each edge-tile of the asteroid in clockwise order starting from a pseudo-random position on the top edge."
    public static phase2Title = "Phase 2 (optimize edge miner layout)";
    public static phase2Desc = "Smoothes out the 'inner' edge by retrying tiles with many mismatching neighbors until no more improvements can be found."
    public static phase3Title = "Phase 3 (fill with center miners)";
    public static phase3Desc = "Fills the remaining inner tiles with 14-piece miners."

    public static saveAs = "Save as";
    public static submit = "submit";
    public static saveLoad = "Save/Load";
    public static autoSave = "Save to browser automatically";
    public static saveToBrowser = "save to browser";
    public static saveSuccess = "saved!";
    public static saveFailed = "❌ saving failed";
    public static loadFromBrowser = "load from browser";
    public static loadSuccess = "loaded!";
    public static loadFailed = "❌ loading failed";
    public static saveToFile = "save to file";
    public static loadFromFile = "load from file";
    public static resetAll = "reset all";
    public static confirmResetAll = "Reset all settings (Solver profiles, GUI, Keymap)?";

    public static helpTitle = "Help";
    public static settingsTitle = "Settings";
    public static linksTitle = "Links";

    public static inputTitle = "Input";
    public static previewTitle = "Preview";
    public static outputTitle = "Output";
    public static statsTitle = "Stats";
    public static consoleTitle = "Console";

    public static copyToClipboard = "Copy to Clipboard";
    public static copySuccess = "copied!";
    public static copyFailed = "❌ copy failed";

    public static deleteProfile = "delete this solver-profile";
    public static resetProfile = "reset this solver-profile to the default";
    public static confirmOverwriteProfile = "Overwrite existing solver-profile '{0}'?";

    public static stats = {
        sum: "Sum",

        miners: "Miners",
        beltSaturation: "Spacebelt saturation",
        misc: "Misc.",

        total: "total",
        edge: "edge",
        center: "center",
        floors: "Floors",
        shapez: "Shapez",
        fluid: "Fluid",
        gapTiles: "Gap-Tiles",
        gapIslands: "Gap-Islands",
        time: "Time",
        millis: "ms",
        millisTotal: "ms total",
    };

    public static settings = {
        solver: "Solver",
        parser: "Parser",
        profile: "Profile",

        shapeCodes: "Shape codes",
        fluidCodes: "Fluid codes",
        ignoredCodes: "Ignored codes",
        fallbackMode: "Fallback mode",

        minerBps: "Miner Blueprints",
        shape: "Shape",
        fluid: "Fluid",

        advanced: "Advanced",
        phase1: "Phase 1",
        maxLookahead: "max lookahead",
        preScanCw: "pre-scan CW",
        preScanCcw: "pre-scan CCW",
        phase2: "Phase 2",
        optimizeOccupied: "optimize occupied",
        targetMinScore: "target min-score",
        maxRetryMiners: "max retry miners",
        phase3: "Phase 3",
        maxBeamWidth: "max beam width",
        beamWidthTiles: "beam width tiles",

        gui: "GUI",
        appearance: "Appearance",
        themeName: {
            purple: "Purple",
            magenta: "Magenta",
            red: "Red",
            copper: "Copper",
            green: "Green",
            blue: "Blue",
        },
        theme: "Theme",
        decor: "Decor",
        font: "Font",

        previewWindow: "Preview Window",
        liveUpdate: "Live update",
        resolutionScale: "Resolution scale",

        tooltip: "Tooltip",
        showWorldCoordinates: "Show world coordinates",
        showIslandCoordinates: "Show island coordinates",
        showIslandID: "Show island ID",
        showIslandType: "Show island type",
        showErrors: "Show errors",
        showWarnings: "Show warnings",

        keymap: "Keymap",
        keymapKeys: {
            nextFrame: "next frame",
            prevFrame: "prev frame",
            nextStat: "next stat",
            prevStat: "prev stat",
            toggleTooltip: "toggle tooltip",
            renderModeBitMap: "view Bitmap",
            renderModeSvg: "view Icons",
            renderModeOccupancy: "view Occupancy",
        },
        addNewChord: "Add new chord",
        deleteChord: "Delete chord",

    }
    public static parserHintHtml = `
        <span style="white-space: pre-line">The asteroid type is chosen based on the island-type placed on each tile.
        By default, only Miners and Extenders are mapped to their asteroid type.
        You can map additional island-types, such as 'Foundation_1x1'.
        
        To find the correct string you can:
        - run the solver and inspect the console for <code>Unrecognized island type: 'Foundation_1x1', fallback to mode 'shape'</code>
        - or inspect your blueprint with <a href="https://community-vortex.shapez2.com/blueprint/codec">https://community-vortex.shapez2.com/blueprint/codec</a>
        
        To add an island-type, simply add it as a new line. Blank lines get deleted automatically.</span>`;
    public static minerBpsHintHtml = `
        <span style="white-space: pre-line">The default miner blueprint uses 3 floors and minimum buildings.
        If you need 2-floor miners, or want them to use an "anti-gap" layout, you can select those from the preset blueprints.
        
        Alternatively, you can paste your own blueprint. It needs to be a 1x1 Island Blueprint of the Miner. Rotation does not matter.</span>`;
    public static advancedHintHtml = `
        <span style="white-space: pre-line">The default settings offer a good balance of runtime and quality, tested on ~25 sample asteroids.
        If your blueprint is solved poorly, you can adjust these settings.
        
        Many of these settings also significantly affect the runtime of the algorithm.</span>`;
    public static maxLookaheadHintHtml = `
        <span style="white-space: pre-line">The number of miner-placements to "look ahead" by when determining a miner placement.
        Example: <code>6</code> -> on each edge tile, accept the layout that minimizes the necessary gaps when placing <i>5</i> more miners.
        
        <code>Runtime cost</code>: high <span style="font-size: 0.8em;">(small exponential)</span></span>`;
    public static preScanCwHintHtml = `
        <span style="white-space: pre-line">How many CW (clockwise) miners are kept from the pre-scan.
        
        <code>Runtime cost</code>: none/minimal
        
        <h4 style="margin-bottom: 0;">About pre-scanning:</h4>
        The first few miner placements are suboptimal, because they are unconstrained in both CCW and CW directions.
        Pre-scanning places a few temporary miners in the CCW direction. This way the first "real" miner placement is unconstrained only in the CW direction.</span>`;
    public static preScanCcwHintHtml = `
        <span style="white-space: pre-line">How many temporary CCW (counter-clockwise) miners are placed during the pre-scan.
        
        <code>Runtime cost</code>: minimal</span>`;
    public static optimizeOccupiedHintHtml = `
        <span style="white-space: pre-line">If enabled, then occupied tiles will also be evaluated and optimized.
        Enabling this option rarely provides better quality solutions.
        
        <code>Runtime cost</code>: moderate</span>`;
    public static targetMinScoreHintHtml = `
        <span style="white-space: pre-line">Controls on which tiles optimization is attempted. Tiles with greater/equal score will be ignored.
        (negative values are slower, but may result in better solutions)
        
        <code>Runtime cost</code>: moderate</span>`;
    public static maxRetryMinersHintHtml = `
        <span style="white-space: pre-line">If negative: unlimited.
        Otherwise: limits how many edge-miners are retried when a tile is optimized.
        
        Note that only edge-miners that occupy a tile in a 2-city-block distance are considered for retrying.
        
        <code>Runtime cost</code>: high <span style="font-size: 0.8em;">(exponential)</span></span>`;
    public static maxBeamWidthHintHtml = `
        <span style="white-space: pre-line">The maximum "beam-width" when searching for center-miner placements.
        Controls how many positions are considered for a center-miner concurrently per iteration.
        
        Counterintuitively, large values can produce poor results because the greedy algorithm gets to delay hard choices.
        
        <code>Runtime cost</code>: moderate <span style="font-size: 0.8em;">(multiplicative)</span></span>`;
    public static beamWidthTilesHintHtml = `
        <span style="white-space: pre-line">Reduces the beam width by <code>tiles_left / N</code>.
        This setting aims to reduce beam with for large asteroids, significantly speeding up solving.
        
        <code>Runtime cost</code>: moderate</span>`;
    public static keymapHintHtml = `<span style="white-space: pre-line">Add/delete keybinds by right-clicking.

        Edit a keybind by left-clicking on a row.
        Finish editing by left-clicking elsewhere, or by pressing <code>tab</code>.
        
        Holding multiple keys creates a key-chord.</span>`;

    public static referenceHowToUseTitle = `<h2>How to use</h2>`;
    public static referenceHowToUseHtml = `<ol>
        <li>Drag extenders over the asteroid(s).</li>
        <li>Copy the extenders and paste the blueprint in the "Input" window.</li>
        <li>Press "SOLVE".</li>
        <li>Copy the blueprint from the "Output" back into your game.</li>
    </ol>`;
    public static referenceHowToUse2Html = `<span style="white-space: pre-line">Note that the solver only places 2 kinds of miner-layouts:<ul>
        <li>On the asteroid edge: a single miner with 3 extenders.</li>
        <li>Otherwise: 3 miners with 3 extenders each.</li>
    </ul>
    You are expected to fill the remaining space (if any) yourself.</span>`;

    public static referenceControlsTitle = `<h2>"Secret" Controls</h2>`;
    public static referenceControlsZoomTitle = `<span>Preview canvas zooming:</span>`;
    public static referenceControlsZoomHtml = `<span style="white-space: pre-line">Hold CTRL while left-click-dragging on the canvas.
        Or: Hold CTRL while scrolling with the mouse wheel.
        On mobile, you can 2-finger pinch to zoom.</span>`;
    public static referenceControlsResizeTitle = `<span>Resizing Windows:</span>`;
    public static referenceControlsResizeHtml = `<span style="white-space: pre-line">Drag the left/right edge of the windows to grow/shrink them horizontally.
        Drag the left edge of the sidebar to grow/shrink it.
        Drag the bottom/top edge of the "Preview" window to grow/shrink it vertically.</span>`;

    public static referenceDetailedExplanationsTitle = `<h2>Detailed Window Explanations</h2>`;
    public static referenceDtInputWinTitle = `<h3>"Input" Window</h3>`;
    public static referenceDtInputWinHtml = `<ol>
        <li>This is the input blueprint. Supported versions are 'SHAPEZ2-4' and 'SHAPEZ2-5'.</li>
        <li>The dropdown provides some example blueprints. This way you can experiment with the solver without starting the game.</li>
        <li>Press this button to start the Solver.</li>
    </ol>`;
    public static referenceDtPreviewTitle = `<h3>"Preview" Window</h3>`;
    public static referenceDtPreviewHtml = `<ol>
        <li>These buttons change how the solution is visualized.<ol>
            <li>Show as a bitmap (low performance cost) - it assigns each miner a different color.</li>
            <li>Show as icons (moderate to high performance cost) - each tile gets an icon, identifying extenders, belts and lifts.</li>
            <li>Show occupancy (low performance cost) - marks occupied tiles in bright green.</li>
        </ol></li>
        <li>This hides the preview. On low-end devices this can improve performance.</li>
        <li>Shows the progress of the solver.</li>
        <li>Enables/disables the tooltip.</li>
        <li>The tooltip shows basic information on the hovered tile. The 'world'-coordinate is relative to the blueprint center. The 'island'-coordinate is relative to the bounds of the asteroid, starting at (0,0) in the top-left.</li>
        <li>Each decision of the solver can be inspected on this timeline.</li>
    </ol>`;
    public static referenceDtOutputTitle = `<h3>"Output" Window</h3>`;
    public static referenceDtOutputHtml = `<ol>
        <li>This is the output blueprint. It will use the same version as the input blueprint.</li>
        <li>Press this button to copy the output blueprint.</li>
    </ol>`;
    public static referenceDtStatsTitle = `<h3>"Stats" Window</h3>`;
    public static referenceDtStatsHtml = `<ol>
        <li>This selects for which asteroid statistics are shown. The selected asteroid will also be marked on the "Preview" Window.</li>
        <li>The number of miners placed. This indicates the quality of the solution.</li>
        <li>This tells you how many space-belts you need for the asteroid. For example: if your miner blueprint outputs onto 2 floors, then you'll need 17 belts with 8 miners each, and an additional belt with 2 miners.</li>
        <li>Secondary quality metrics. Fewer gap-ties, gap-islands and runtime is better. Gap-islands are the number of unoccupied regions. Runtime is measured for each phase, you can hover on the numbers to see a brief description on what each phase does.</li>
    </ol>`;
    public static referenceDtConsoleTitle = `<h3>"Console" Window</h3>`;
    public static referenceDtConsoleHtml = `<span style="white-space: pre-line">When things go wrong, or the solution seems weird, you should check the console.
        Any warnings or errors that occurred while solving will be shown here.</span>`;

    public static linksSite = "[Site]";
    public static linksGithub = "[GitHub]";
    public static linksIeeeXplore = "[IEEE Xplore]";
    public static linksWikiGg = "[wiki.gg]";
    public static linksSteam = "[Steam]";

    public static linksThisProject = "This Solver"
    public static linksThisSource = "View the source code";
    public static linksThisIssues = "Report issues";
    public static linksThisOfflineVersion = "Download the offline version";
    public static linksThisSupportMe = "Support me? :)";

    public static linksRelatedProjects = "Related projects";
    public static linksJiahaoSolver = "Jiahao Wang's miner solver";
    public static linksJiahaoZmanSolver = "[Site2 by zman]";
    public static linksPolyominoSolver = "Chase Meadors' solver for polyomino tiling";
    public static linksResearchPaper1 = "Research paper: Deterministic polyomino packing algorithm";

    public static linksMoreShapezTools = "More Shapez 2 Tools";
    public static linksBlueprintInspector = "Blueprint Inspector";
    public static linksZmanOperatorLeaderboard = "zman's Operator Level Leaderboard";
    public static linksCommunityToolsIndex = "Wiki: Community Tools";

    public static linksHonorableMentions = "Honorable Mentions";
    public static linksLastCallBbs = "Last Call BBS (my primary UI inspiration)";
}