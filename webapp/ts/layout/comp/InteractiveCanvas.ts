import { getSettings, SettingObserver } from "../../Settings.js";

export type DrawCallback = (canvas: InteractiveCanvas) => void;
export type HoverCallback = (canvas: InteractiveCanvas, ev: PointerEvent, worldX: number, worldY: number) => void;

type CanvasInfo = {
    resolutionScale: number;
    paddingLeft: number;
    paddingTop: number;
    centerX: number;
    centerY: number;
}

type TransformInfo = {
    offsetX: number;
    offsetY: number;
    scale: number;
    dragStartX: number;
    dragStartY: number;
    isZoomDrag: boolean;
}

export class InteractiveCanvas {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    isDirty: boolean;
    onFrameCallback: () => void;
    canvasInfo: CanvasInfo;
    transformInfo: TransformInfo;
    activePointers: Map<any, PointerEvent>;
    lastPointerMoveEvent: PointerEvent | undefined;
    drawCallback?: DrawCallback;
    hoverCallback?: HoverCallback;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.context = this.canvas.getContext("2d")!;
        this.isDirty = false;

        const self = this;
        this.onFrameCallback = () => self.onFrame(self);

        this.canvasInfo = {
            resolutionScale: getSettings().layoutOptions.previewResolutionScale,
            paddingLeft: 0,
            paddingTop: 0,
            centerX: 0,
            centerY: 0,
        };
        this.transformInfo = {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            dragStartX: 0,
            dragStartY: 0,
            isZoomDrag: false,
        }

        this.activePointers = new Map<any, PointerEvent>();
        this.drawCallback = undefined;
        this.hoverCallback = undefined;

        window.addEventListener("resize", () => self.onResize(self));
        new ResizeObserver(() => self.onResize(self)).observe(this.canvas);
        this.onResize(self);
        this.canvas.addEventListener("pointerdown", ev => {
            const numActivePointers = self.activePointers.size;
            if (numActivePointers === 0) {
                self.canvas.setPointerCapture(ev.pointerId);
            }
            self.activePointers.set(ev.pointerId, ev);
            self.transformInfo.dragStartX = ev.clientX;
            self.transformInfo.dragStartY = ev.clientY;
            self.transformInfo.isZoomDrag = ev.ctrlKey;
        });
        window.addEventListener("pointerup", ev => {
            self.activePointers.delete(ev.pointerId);
        });
        window.addEventListener("pointercancel", ev => {
            self.activePointers.delete(ev.pointerId);
        });
        window.addEventListener("pointermove", ev => {
            const mostRecentEvent = self.activePointers.get(ev.pointerId);
            if (mostRecentEvent === undefined) {
                return;
            } // not a tracked pointer

            self.activePointers.set(ev.pointerId, ev);
            const numActivePointers = self.activePointers.size;
            if (numActivePointers === 1) {
                ev.preventDefault();
                if (self.transformInfo.isZoomDrag) {
                    const dy = ev.clientY - mostRecentEvent.clientY;
                    const scaleFactor = Math.pow(0.99, dy);
                    self.doZoom(self.transformInfo.dragStartX, self.transformInfo.dragStartY, scaleFactor);
                } else {
                    const dx = ev.clientX - mostRecentEvent.clientX;
                    const dy = ev.clientY - mostRecentEvent.clientY;
                    self.transformInfo.offsetX += dx;
                    self.transformInfo.offsetY += dy;
                }
                self._updateCanvas(self);
            } else if (numActivePointers === 2) {
                ev.preventDefault();
                const otherEventId = Array.from(self.activePointers.keys()).find(k => k !== ev.pointerId)!;
                const otherEvent = self.activePointers.get(otherEventId)!;

                const midX = (otherEvent.clientX + ev.clientX) / 2;
                const midY = (otherEvent.clientY + ev.clientY) / 2;
                const prevDx = otherEvent.clientX - mostRecentEvent.clientX;
                const prevDy = otherEvent.clientY - mostRecentEvent.clientY;
                const dx = otherEvent.clientX - ev.clientX;
                const dy = otherEvent.clientY - ev.clientY;
                const prevDistSqr = (prevDx * prevDx) + (prevDy * prevDy);
                const newDistSqr = (dx * dx) + (dy * dy);

                self.doZoom(midX, midY, newDistSqr / prevDistSqr);
            }
        });
        this.canvas.addEventListener("wheel", ev => {
            if (ev.ctrlKey) {
                ev.preventDefault();
                self.doZoom(ev.clientX, ev.clientY, ev.deltaY > 0 ? 0.9 : (1 / 0.9));
            }
        });
        this.canvas.addEventListener("pointermove", ev => {
            self.lastPointerMoveEvent = ev;
            self.updateTooltip();
        });
        SettingObserver.previewResolutionScale.addListener(() => {
            self.updateCanvasSize(self);
            self._updateCanvas(self);
        });

        // start the render loop
        window.requestAnimationFrame(self.onFrameCallback);
    }

    onResize(self: InteractiveCanvas) {
        self.updateCanvasSize(self);
        self._updateCanvas(self);
    }

    setDrawCallback(callback: DrawCallback): void {
        this.drawCallback = callback;
    }

    setHoverCallback(callback: HoverCallback): void {
        this.hoverCallback = callback;
    }

    updateCanvasSize(self: InteractiveCanvas) {
        const rect = self.canvas.getBoundingClientRect();
        if (rect.width == 0 || rect.height == 0)
            return;

        const resScale = getSettings().layoutOptions.previewResolutionScale;
        const roundWidth = Math.round(rect.width * resScale);
        const roundHeight = Math.round(rect.height * resScale);
        if (self.canvas.width !== roundWidth) {
            self.canvas.width = roundWidth;
        }
        if (self.canvas.height !== roundHeight) {
            self.canvas.height = roundHeight;
        }
        self.canvasInfo.resolutionScale = resScale;
        self.canvasInfo.paddingLeft = rect.x;
        self.canvasInfo.paddingTop = rect.y;
        self.canvasInfo.centerX = rect.width >> 1;
        self.canvasInfo.centerY = rect.height >> 1;
    }

    doZoom(cursorX: number, cursorY: number, zoomFactor: number): void {
        // we want to scale such that the pixel the cursor rests on stays fixed
        // however scaling is applied from the canvas center
        // basic idea:
        //   pa = offset of the hovered pixel from the canvas-center (before applying the new scale)
        //      = (cursor - padding - canvasCenter) * oldScale
        //   pb = new offset after applying the new scale
        //      = pa / oldScale * newScale
        //   delta = (pb - pa) / newScale;
        //         = ((pa / oldScale * newScale) - pa) / newScale
        //         = (pa / oldScale) - (pa / newScale)
        //         = pa * ((1 / oldScale) - (1 / newScale))
        //   canvasOffset -= delta

        // because scaling is applied after translating, the delta must be scaled as well (?).
        //   canvasOffset -= (delta * scrollFactor)

        const ti = this.transformInfo;
        const ci = this.canvasInfo;
        const centerX = ti.offsetX + ci.paddingLeft + ci.centerX;
        const centerY = ti.offsetY + ci.paddingTop + ci.centerY;
        const paX = (cursorX - centerX) * ti.scale;
        const paY = (cursorY - centerY) * ti.scale;
        const newScale = ti.scale * zoomFactor;
        const dX = paX * ((1 / ti.scale) - (1 / newScale));
        const dY = paY * ((1 / ti.scale) - (1 / newScale));

        ti.scale = newScale;
        ti.offsetX -= (dX * zoomFactor);
        ti.offsetY -= (dY * zoomFactor);

        this._updateCanvas(this);
    }

    updateTooltip(): void {
        const numActivePointers = this.activePointers.size;
        if (numActivePointers > 1 || this.lastPointerMoveEvent === undefined) {
            return;
        }

        const ev = this.lastPointerMoveEvent;
        if (this.hoverCallback) {
            this.updateCanvasSize(this);
            const worldPos = this.screenToWorld(ev.clientX, ev.clientY, true);
            this.hoverCallback(this, ev, worldPos.x, worldPos.y);
        }
    }

    screenToWorld(x: number, y: number, withPadding?: boolean): { x: number, y: number } {
        const ti = this.transformInfo;
        const ci = this.canvasInfo;
        const paddingLeft = withPadding ? ci.paddingLeft : 0;
        const paddingTop = withPadding ? ci.paddingTop : 0;
        const worldX = (x - ti.offsetX - ci.centerX - paddingLeft) / ti.scale;
        const worldY = (y - ti.offsetY - ci.centerY - paddingTop) / ti.scale;
        return { x: worldX, y: worldY };
    }

    worldToScreen(x: number, y: number, withPadding?: boolean): { x: number, y: number } {
        const ti = this.transformInfo;
        const ci = this.canvasInfo;
        const paddingLeft = withPadding ? ci.paddingLeft : 0;
        const paddingTop = withPadding ? ci.paddingTop : 0;
        const screenX = (x * ti.scale) + ti.offsetX + ci.centerX + paddingLeft;
        const screenY = (y * ti.scale) + ti.offsetY + ci.centerY + paddingTop;
        return { x: screenX, y: screenY };
    }

    updateCanvas() {
        this._updateCanvas(this);
    }

    _updateCanvas(self: InteractiveCanvas) {
        self.isDirty = true;
    }

    onFrame(self: InteractiveCanvas): void {
        if (self.isDirty) {
            self.isDirty = false;

            const ti = this.transformInfo;
            const ci = this.canvasInfo;
            const resScale = ci.resolutionScale;

            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.save();
            this.context.translate(
                (ti.offsetX + ci.centerX) * resScale,
                (ti.offsetY + ci.centerY) * resScale
            );
            this.context.scale(ti.scale * resScale, ti.scale * resScale);

            if (this.drawCallback)
                this.drawCallback(this);

            this.context.restore();
        }

        window.requestAnimationFrame(self.onFrameCallback);
    }
}