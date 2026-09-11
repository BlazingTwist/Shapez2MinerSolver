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
}