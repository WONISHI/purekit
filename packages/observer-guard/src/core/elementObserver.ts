import type { ElementNode, ElementObserverOptions } from '../types/index';
/**
 * ObserverGuard 配置项：
 * @param {Array<string|HTMLElement>} children - 需要监听尺寸变化的子元素
 * @param {boolean} watchChildNodes - 是否监听容器子节点增删
 * @param {boolean} watchContainerAttributes - 是否监听容器属性变化（非尺寸变化）
 * @param {boolean} watchSubtree - 是否监听容器子树
 * @param {boolean} preventMutationOnResize - 当容器尺寸变化触发 ResizeObserver 时，是否阻止 MutationObserver
 * @param {boolean} preventChildResizeMutation - 当子元素尺寸变化时，是否阻止 MutationObserver
 * @param {function(MutationRecord): void} onMutate - 子节点或属性变化回调
 * @param {function(ResizeObserverEntry): void} onResize - 容器尺寸变化回调
 * @param {function(ResizeObserverEntry): void} onChildResize - 子元素尺寸变化回调
 */
export class ElementObserver {
  private mutationObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private childResizeObservers: Map<HTMLElement, ResizeObserver> = new Map();

  private _lastContainerRect: { width: number; height: number } | null = null;
  private _lastChildRects: Map<HTMLElement, { width: number; height: number }> = new Map();

  private containerTarget: ElementNode;
  private options: ElementObserverOptions;

  constructor(container: ElementNode, options: ElementObserverOptions = {}) {
    this.containerTarget = container;
    this.options = options;
  }

  private resolveElement(target: ElementNode): HTMLElement | null {
    if (target instanceof HTMLElement) return target;

    const byId = document.getElementById(target);
    if (byId) return byId;

    const byClass = document.querySelector(`.${target}`);
    if (byClass instanceof HTMLElement) return byClass;

    return null;
  }

  start(): void {
    this.stop();

    const container = this.resolveElement(this.containerTarget);
    if (!container) return;

    const {
      watchChildNodes,
      watchContainerAttributes,
      watchSubtree,
      preventMutationOnResize,
      preventChildResizeMutation,
      onMutate,
      onResize,
      onChildResize,
      children,
    } = this.options;

    // ---------- 初始容器尺寸 ----------
    const rect = container.getBoundingClientRect();
    this._lastContainerRect = { width: rect.width, height: rect.height };

    // ---------- ResizeObserver for container ----------
    if (onResize) {
      this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const last = this._lastContainerRect;
          if (last && (width !== last.width || height !== last.height)) {
            this._lastContainerRect = { width, height };
            onResize(entry);
          }
        }
      });
      this.resizeObserver.observe(container);
    }

    // ---------- ResizeObserver for children ----------
    const childrenEls: HTMLElement[] = [];

    if (children && onChildResize) {
      children.forEach((child) => {
        const childEl = this.resolveElement(child);
        if (!childEl) return;

        childrenEls.push(childEl);

        const rect = childEl.getBoundingClientRect();
        this._lastChildRects.set(childEl, { width: rect.width, height: rect.height });

        const ro = new ResizeObserver((entries: ResizeObserverEntry[]) => {
          for (const entry of entries) {
            const target = entry.target as HTMLElement;
            const { width, height } = entry.contentRect;
            const lastRect = this._lastChildRects.get(target);

            if (!lastRect || width !== lastRect.width || height !== lastRect.height) {
              this._lastChildRects.set(target, { width, height });
              onChildResize(entry);
            }
          }
        });

        ro.observe(childEl);
        this.childResizeObservers.set(childEl, ro);
      });
    }

    // ---------- MutationObserver ----------
    if (watchChildNodes || watchContainerAttributes || watchSubtree) {
      this.mutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
        for (const m of mutations) {
          // 容器 resize 时过滤 style 变更
          if (preventMutationOnResize && m.type === 'attributes' && m.attributeName === 'style') {
            const { width, height } = container.getBoundingClientRect();
            const last = this._lastContainerRect;
            if (last && (width !== last.width || height !== last.height)) {
              continue;
            }
          }

          // 子元素 resize 过滤
          if (
            preventChildResizeMutation &&
            m.type === 'attributes' &&
            m.attributeName === 'style' &&
            m.target instanceof HTMLElement &&
            childrenEls.includes(m.target)
          ) {
            const rect = m.target.getBoundingClientRect();
            const lastRect = this._lastChildRects.get(m.target);
            if (lastRect && (rect.width !== lastRect.width || rect.height !== lastRect.height)) {
              continue;
            }
          }

          onMutate?.(m);
        }
      });

      this.mutationObserver.observe(container, {
        childList: watchChildNodes ?? true,
        attributes: watchContainerAttributes ?? false,
        subtree: watchSubtree ?? true,
      });
    }
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.childResizeObservers.forEach((ro) => ro.disconnect());

    this.childResizeObservers.clear();
    this._lastChildRects.clear();
    this._lastContainerRect = null;

    this.mutationObserver = null;
    this.resizeObserver = null;
  }
}
