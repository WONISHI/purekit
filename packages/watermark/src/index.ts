import type { WatermarkOptions } from '@/types';
import { resolveContainer, isFullScreen } from '@/utils/dom';
import { imageLoader } from '@/utils/image-loader';
import { isDef, isObject, isString, isArray } from '@purekit/is';
import { LayoutEngine } from '@/core/layout';
import { CanvasDrawer } from '@/core/drawer';
import { ElementObserver } from '@purekit/observer-guard';

// ElementGuard、ObserverGuard、VisibilityGuard

class Watermark {
  private options: WatermarkOptions = {
    id: 'watermark-layer',
    content: '内部资料',
    fontSize: 16,
    fontWeight: 'normal',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontColor: 'rgba(0, 0, 0, 0.15)',
    rotate: -20,
    zIndex: 9999,
    monitor: true,
    layout: 'repeat',
    gap: [100, 100],
    offset: [20, 20],
  };

  private container: HTMLElement | null = null;
  #guard: ElementObserver | null = null;

  /**
   * 初始化/应用水印
   * 修改点：arg1 类型增加 string[]
   */
  public apply(arg1?: string | string[] | WatermarkOptions, arg2?: HTMLElement | string): this {
    if (document.readyState === 'loading' && !document.body) {
      document.addEventListener('DOMContentLoaded', () => this.apply(arg1, arg2));
      return this;
    }

    let opts: WatermarkOptions = {};

    if (isString(arg1) || isArray(arg1)) {
      opts.content = arg1 as any;
      if (arg2) opts.el = arg2 as string | HTMLElement;
    } else if (isObject(arg1)) {
      opts = arg1;
    }

    this.options = { ...this.options, ...opts };

    if (!this.options.content && this.options.text) {
      this.options.content = this.options.text;
    }

    if (isDef(opts.gap)) this.options.gap = isArray(opts.gap) ? opts.gap : [opts.gap, opts.gap];
    if (isDef(opts.offset)) this.options.offset = isArray(opts.offset) ? opts.offset : [opts.offset, opts.offset];

    this.container = resolveContainer(this.options.el);
    this._ensureContainerPosition();

    this.render();

    return this;
  }

  public async render() {
    if (!this.container) return;

    // 1. 暂停监控
    this.#guard?.stop();

    const ratio = window.devicePixelRatio || 1;

    // 2. 布局计算
    // 注意：如果 apply 里已经把 array 转成了 object，LayoutEngine.normalize 会直接透传 object
    const rootContent = LayoutEngine.normalize(this.options.content || '');

    await LayoutEngine.preload(rootContent);
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    const layoutTree = LayoutEngine.measure(tempCtx, rootContent, this.options, ratio);

    // 3. 生成图片
    const { base64, size } = await CanvasDrawer.generate(layoutTree, this.options, ratio);

    // 4. 更新 DOM
    this._updateDOM(base64, size);

    // 5. 恢复监控
    if (this.options.monitor) {
      if (!this.#guard) {
        this.#guard = new ElementObserver(this.container, {
          children: [this.options.id!],
          watchChildNodes: true,
          watchContainerAttributes: true,
          watchSubtree: false,
          preventMutationOnResize: false,
          preventChildResizeMutation: false,
          // 监听容器属性组件变化
          onMutate: (e) => this._ensureContainerPosition(),
          // 监听子节点的属性变化
          onChildMutate: () => this.render(),
        });
      }
      this.#guard.start();
    }
  }

  /**
   * 更新 DOM 样式
   */
  private _updateDOM(base64: string, size: [number, number]) {
    if (!this.container) return;
    const { id, zIndex, layout, offset } = this.options;
    const isBody = isFullScreen(this.container);

    let el = this.container.querySelector(`#${id}`) as HTMLElement;
    if (!el) {
      el = document.createElement('div');
      el.id = id!;
      this.container.appendChild(el);
    }

    // 尺寸策略
    // 全屏：fixed + 100vw/vh
    const widthVal = isBody ? '100vw' : '100%';
    const heightVal = isBody ? '100vh' : '100%';
    const positionVal = isBody ? 'fixed' : 'absolute';

    el.style.cssText = `
      position: ${positionVal} !important;
      top: 0 !important; left: 0!important;
      width: ${widthVal} !important;
      height: ${heightVal} !important;
      pointer-events: none !important;
      z-index: ${zIndex} !important;
      display: block !important;
      visibility: visible !important;
    `;

    // 背景设置
    const [ox, oy] = (this.options.offset as [number, number]) || [20, 20];
    const posMap: Record<string, string> = {
      lt: `${ox}px ${oy}px`,
      rt: `calc(100% - ${ox}px) ${oy}px`,
      lb: `${ox}px calc(100% - ${oy}px)`,
      rb: `calc(100% - ${ox}px) calc(100% - ${oy}px)`,
      center: 'center',
    };
    const isRepeat = layout === 'repeat';

    el.style.setProperty('background-image', `url(${base64})`, 'important');
    el.style.setProperty('background-size', `${size[0]}px ${size[1]}px`, 'important');
    el.style.setProperty('background-repeat', isRepeat ? 'repeat' : 'no-repeat', 'important');
    el.style.setProperty('background-position', isRepeat ? '0 0' : posMap[layout!] || 'center', 'important');
  }

  private _handleResize(entry: ResizeObserverEntry) {
    if (!this.container || isFullScreen(this.container)) return;
    // 仅处理局部容器的尺寸变大
    const el = this.container.querySelector(`#${this.options.id}`) as HTMLElement;
    if (!el) return;
    const { scrollWidth, scrollHeight, clientWidth, clientHeight } = entry.target;
    const width = Math.max(scrollWidth, clientWidth);
    const height = Math.max(scrollHeight, clientHeight);

    // if (el.style.width !== `${width}px`) el.style.width = `${width}px`;
    // if (el.style.height !== `${height}px`) el.style.height = `${height}px`;
  }

  // 为父元素定位兜底
  private _ensureContainerPosition() {
    if (!this.container || isFullScreen(this.container)) return;
    const style = window.getComputedStyle(this.container);
    if (['relative', 'absolute', 'fixed', 'sticky'].includes(style.position)) {
      return;
    }
    if (style.transform !== 'none') return;
    if (style.contain && style.contain !== 'none') return;

    this.container.style.cssText += '; contain: paint;';
  }

  // 增加cover方法
  public cover() {}

  // 将质量的方法
  public loadCompress(src: string | Blob | File, quality: number): Promise<HTMLImageElement> {
    return imageLoader.compress(src, quality);
  }
}

export default new Watermark();

export * from '@/types';
