import type { WatermarkOptions } from '@/types';
import { resolveContainer, isFullScreen } from '@/utils/dom';
import { LayoutEngine } from '@/core/layout';
import { CanvasDrawer } from '@/core/drawer';
import { ObserverGuard } from '@/core/guard';
import { imageLoader } from '@/utils/image-loader';

/**
 * 强力隔离模式下的样式重置列表
 * 防止外部 CSS (如 * { margin: 10px }) 污染水印容器
 */
const RESET_STYLES: Record<string, string> = {
  margin: '0',
  padding: '0',
  border: 'none',
  boxSizing: 'content-box',
  lineHeight: 'normal',
  overflow: 'hidden',
  visibility: 'visible',
  display: 'block',
};

class Watermark {
  // 使用 private _xxx 避免构建工具报错
  private _options: WatermarkOptions = {
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
    useShadowDom: true, // 默认开启 Shadow DOM，可设为 false 降级
    quality: 1.0,
  };

  private _container: HTMLElement | null = null;
  private _shadowRoot: ShadowRoot | null = null;
  private _shadowHost: HTMLElement | null = null;
  private _guard: ObserverGuard | null = null;
  private _blobUrl: string | null = null;

  public apply(arg1?: string | string[] | WatermarkOptions, arg2?: HTMLElement | string): this {
    if (document.readyState === 'loading' && !document.body) {
      // @ts-ignore
      document.addEventListener('DOMContentLoaded', () => this.apply(arg1, arg2));
      return this;
    }

    let opts: WatermarkOptions = {};

    if (typeof arg1 === 'string' || Array.isArray(arg1)) {
      opts.content = arg1 as any;
      if (arg2) opts.el = arg2 as string | HTMLElement;
    } else if (typeof arg1 === 'object') {
      opts = arg1;
    }

    this._options = { ...this._options, ...opts };

    if (!this._options.content && this._options.text) {
      this._options.content = this._options.text;
    }

    if (opts.gap !== undefined) this._options.gap = Array.isArray(opts.gap) ? opts.gap : [opts.gap, opts.gap];
    if (opts.offset !== undefined) this._options.offset = Array.isArray(opts.offset) ? opts.offset : [opts.offset, opts.offset];

    this.destroy();

    this._container = resolveContainer(this._options.el);
    this._ensureContainerPosition();

    this._render();

    return this;
  }

  public destroy() {
    this._guard?.stop();
    this._guard = null;

    if (this._options.useShadowDom && this._shadowHost) {
      this._shadowHost.remove();
      this._shadowHost = null;
      this._shadowRoot = null;
    } else {
      const el = this._container?.querySelector(`#${this._options.id}`);
      el?.remove();
    }

    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }
  }

  public static async cover(source: string | Blob | File, options: WatermarkOptions): Promise<Blob> {
    const originalImg = await imageLoader.load(source);
    const width = originalImg.naturalWidth || originalImg.width;
    const height = originalImg.naturalHeight || originalImg.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(originalImg, 0, 0);

    const rootContent = LayoutEngine.normalize(options.content || '');
    await LayoutEngine.preload(rootContent);

    const layoutTree = LayoutEngine.measure(ctx, rootContent, options, 1);
    const { base64 } = await CanvasDrawer.generate(layoutTree, options, 1);
    const tileImg = await imageLoader.load(base64);

    const pattern = ctx.createPattern(tileImg, options.layout === 'repeat' ? 'repeat' : 'no-repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', options.quality || 0.8);
    });
  }

  private async _render() {
    if (!this._container) return;

    this._guard?.stop();

    const ratio = window.devicePixelRatio || 1;
    const rootContent = LayoutEngine.normalize(this._options.content || '');

    await LayoutEngine.preload(rootContent);
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    const layoutTree = LayoutEngine.measure(tempCtx, rootContent, this._options, ratio);

    const { blob, size } = await CanvasDrawer.generate(layoutTree, this._options, ratio);

    this._updateDOM(blob, size);

    if (this._options.monitor) {
      if (!this._guard) {
        this._guard = new ObserverGuard(
          this._container,
          this._shadowRoot,
          this._options.id!,
          () => this._render(),
          (entry) => this._handleResize(entry),
        );
      }
      this._guard.start();
    }
  }

  private _updateDOM(blob: Blob, size: [number, number]) {
    if (!this._container) return;

    if (this._blobUrl) URL.revokeObjectURL(this._blobUrl);
    this._blobUrl = URL.createObjectURL(blob);

    const { id, zIndex, layout, offset, useShadowDom } = this._options;
    const isBody = isFullScreen(this._container);

    let watermarkEl: HTMLElement;

    // --- 样式隔离策略分支 ---
    if (useShadowDom) {
      // 策略 A: Shadow DOM (最强隔离，但可能有兼容性顾虑)
      if (!this._shadowHost) {
        this._shadowHost = document.createElement('div');
        // ShadowHost 本身也需要一定的保护
        this._applyStyle(this._shadowHost, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '0',
          height: '0',
          pointerEvents: 'none',
          zIndex: String(zIndex),
        });
        this._container.appendChild(this._shadowHost);
        this._shadowRoot = this._shadowHost.attachShadow({ mode: 'closed' });
      }

      watermarkEl = this._shadowRoot!.getElementById(id!) as HTMLElement;
      if (!watermarkEl) {
        watermarkEl = document.createElement('div');
        watermarkEl.id = id!;
        this._shadowRoot!.appendChild(watermarkEl);
      }
    } else {
      // 策略 B: 内联样式重置 + !important 提权 (兼容性最好)
      watermarkEl = this._container.querySelector(`#${id}`) as HTMLElement;
      if (!watermarkEl) {
        watermarkEl = document.createElement('div');
        watermarkEl.id = id!;
        this._container.appendChild(watermarkEl);
      }
    }

    // 计算位置
    const widthVal = isBody ? '100vw' : Math.max(this._container.scrollWidth, this._container.clientWidth) + 'px';
    const heightVal = isBody ? '100vh' : Math.max(this._container.scrollHeight, this._container.clientHeight) + 'px';
    const positionVal = isBody ? 'fixed' : 'absolute';

    // 背景设置
    const [ox, oy] = (this._options.offset as [number, number]) || [20, 20];
    const posMap: Record<string, string> = {
      lt: `${ox}px ${oy}px`,
      rt: `calc(100% - ${ox}px) ${oy}px`,
      lb: `${ox}px calc(100% - ${oy}px)`,
      rb: `calc(100% - ${ox}px) calc(100% - ${oy}px)`,
      center: 'center',
    };
    const isRepeat = layout === 'repeat';

    // 组装最终样式
    const finalStyles: Record<string, string> = {
      position: positionVal,
      top: '0',
      left: '0',
      width: widthVal,
      height: heightVal,
      pointerEvents: 'none',
      zIndex: String(useShadowDom ? 1 : zIndex), // ShadowDOM 内部 1 即可，外部由 Host 控制
      backgroundImage: `url(${this._blobUrl})`,
      backgroundSize: `${size[0]}px ${size[1]}px`,
      backgroundRepeat: isRepeat ? 'repeat' : 'no-repeat',
      backgroundPosition: isRepeat ? '0 0' : posMap[layout!] || 'center',
    };

    // 如果不使用 Shadow DOM，混合进 Reset 样式以增强隔离
    if (!useShadowDom) {
      Object.assign(finalStyles, RESET_STYLES);
    }

    // 应用样式 (自动添加 !important)
    this._applyStyle(watermarkEl, finalStyles);
  }

  private _handleResize(entry: ResizeObserverEntry) {
    if (!this._container || isFullScreen(this._container)) return;

    const targetRoot = this._shadowRoot || this._container;
    const el = targetRoot.querySelector(`#${this._options.id}`) as HTMLElement;
    if (!el) return;

    const { scrollWidth, scrollHeight, clientWidth, clientHeight } = entry.target;
    const width = Math.max(scrollWidth, clientWidth);
    const height = Math.max(scrollHeight, clientHeight);

    // 即使是 Resize，也要用 important 确保不被覆盖
    el.style.setProperty('width', `${width}px`, 'important');
    el.style.setProperty('height', `${height}px`, 'important');
  }

  private _ensureContainerPosition() {
    if (!this._container || isFullScreen(this._container)) return;
    if (window.getComputedStyle(this._container).position === 'static') {
      this._container.style.position = 'relative';
    }
  }

  /**
   * 核心辅助方法：批量应用带 !important 的样式
   */
  private _applyStyle(el: HTMLElement, styles: Record<string, string>) {
    for (const [key, value] of Object.entries(styles)) {
      // 将驼峰 (zIndex) 转为连字符 (z-index) 以适配 setProperty
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      el.style.setProperty(cssKey, value, 'important');
    }
  }
}

export default new Watermark();

export * from '@/types';
