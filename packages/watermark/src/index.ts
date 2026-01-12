import type { WatermarkOptions } from '@/types';
import { resolveContainer, isFullScreen } from '@/utils/dom';
import { isDef, isObject, isString, isArray } from '@/utils/is';
import { LayoutEngine } from '@/core/layout';
import { CanvasDrawer } from '@/core/drawer';
import { ObserverGuard } from '@/core/guard';
import { ElementObserver } from '@purekit/observer-guard';

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
  private guard: ObserverGuard | null = null;

  /**
   * 初始化/应用水印
   * 修改点：arg1 类型增加 string[]
   */
  public apply(arg1?: string | string[] | WatermarkOptions, arg2?: HTMLElement | string): this {
    if (document.readyState === 'loading' && !document.body) {
      // @ts-ignore: 参数透传
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
    this.guard?.stop();

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
      if (!this.guard) {
        this.guard = new ObserverGuard(
          this.container,
          this.options.id!,
          () => this.render(),
          (entry) => this._handleResize(entry),
        );
      }
      this.guard.start();
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
      position: ${positionVal};
      top: 0; left: 0;
      width: ${widthVal};
      height: ${heightVal};
      pointer-events: none;
      z-index: ${zIndex};
      display: block;
      visibility: visible;
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

    Object.assign(el.style, {
      backgroundImage: `url(${base64})`,
      backgroundSize: `${size[0]}px ${size[1]}px`,
      backgroundRepeat: isRepeat ? 'repeat' : 'no-repeat',
      backgroundPosition: isRepeat ? '0 0' : posMap[layout!] || 'center',
    });
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

  private _ensureContainerPosition() {
    if (!this.container || isFullScreen(this.container)) return;
    if (window.getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
  }
}

export default new Watermark();

export * from '@/types';
