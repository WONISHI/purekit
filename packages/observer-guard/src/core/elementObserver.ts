import type { ElementNode, ElementObserverOptions } from '@/types';
/**
 * ObserverGuard 配置项：
 * @param {Array<string|HTMLElement>} children - 需要监听尺寸变化的子元素
 * @param {boolean} watchChildNodes - 是否监听容器子节点增删
 * @param {boolean} watchContainerAttributes - 是否监听容器属性变化（非尺寸变化）
 * @param {boolean} watchSubtree - 是否监听容器子树
 * @param {boolean} preventMutationOnResize - 当容器尺寸变化触发 ResizeObserver 时，是否阻止 MutationObserver
 * @param {boolean} preventChildResizeMutation - 当子元素尺寸变化时，是否阻止 MutationObserver
 * @param {function(MutationRecord): void} onMutate - 容器或属性变化回调
 * @param {function(MutationRecord): void} onChildMutate - 子节点或属性变化回调
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
  private options: Partial<ElementObserverOptions>;

  constructor(container: ElementNode, options: Partial<ElementObserverOptions> = {}) {
    this.containerTarget = container;
    this.options = options;
    // 当页面被卸载或者关闭自动关闭监听
    window.addEventListener('beforeunload', this.stop);
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
      onChildMutate,
      onResize,
      onChildResize,
      children,
    } = this.options;

    const rect = container.getBoundingClientRect();
    this._lastContainerRect = { width: rect.width, height: rect.height };

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

    // 当尺寸发生变化的时候是先触发MutationObserver然后才触发ResizeObserver
    /**
     *  监听子节点增删
     *  watchChildNodes?: boolean;
     *
     *  监听容器自身 attributes 变化
     *  watchContainerAttributes?: boolean;
     *
     *  是否递归监听子树
     *  watchSubtree?: boolean;
     */
    if (watchChildNodes || watchContainerAttributes || watchSubtree) {
      this.mutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          const target = m.target;
          // 容器元素
          if (target === container) {
            if (preventMutationOnResize && m.type === 'attributes' && m.attributeName === 'style') {
              const { width, height } = container.getBoundingClientRect();
              const last = this._lastContainerRect;
              if (last && (width !== last.width || height !== last.height)) {
                continue;
              }
            }
            onMutate?.(m);
            continue;
          }
          // 子节点
          if (target instanceof HTMLElement && childrenEls.includes(target)) {
            if (preventChildResizeMutation && m.type === 'attributes' && m.attributeName === 'style') {
              const rect = target.getBoundingClientRect();
              const lastRect = this._lastChildRects.get(target);
              if (lastRect && (rect.width !== lastRect.width || rect.height !== lastRect.height)) {
                continue;
              }
            }
            onChildMutate?.(m);
            continue;
          }
          if (watchSubtree) {
            onChildMutate?.(m);
          }
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
