import type { WatermarkOptions, InternalOptions } from "../types/watermark";

class Watermark {
  // 内部配置使用必填类型，避免随处可见的判空逻辑
  private options: InternalOptions;
  private container: HTMLElement | null = null;
  private watermarkDom: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private _debounceRender: any = null; // 使用 any 兼容 Node/Browser 的 Timer 类型差异

  constructor() {
    // 默认配置
    this.options = {
      id: "watermark-layer",
      text: "侵权必究",
      fontSize: 16,
      gap: 100,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontColor: "rgba(0, 0, 0, 0.15)",
      rotate: -20,
      zIndex: 9999,
      monitor: true,
    };
  }

  // =================================================================
  // 1. 函数重载定义 (Function Overloads)
  // =================================================================

  /** 方式一：只传入文本 (挂载到 body) */
  public apply(text: string): this | void;

  /** 方式二：传入文本 和 挂载容器 (选择器或元素) */
  public apply(text: string, el: HTMLElement | string): this | void;

  /** 方式三：传入完整配置对象 */
  public apply(options?: WatermarkOptions): this | void;

  public apply(
    arg1?: string | WatermarkOptions,
    arg2?: HTMLElement | string
  ): this | void {
    // --- 参数归一化 (Normalization) ---
    let options: WatermarkOptions = {};

    if (typeof arg1 === "string") {
      options.text = arg1;
      if (arg2) {
        options.el = arg2;
      }
    } else if (typeof arg1 === "object") {
      options = arg1;
    }

    const { el, ...rest } = options;

    Object.keys(rest).forEach((k) => {
      const key = k as keyof typeof rest;
      if (rest[key] !== undefined) {
        (this.options as any)[key] = rest[key];
      }
    });

    // 1. 如果用户明确传入了 el，就必须找到它，找不到应该报错（或者警告）
    if (el) {
      this.container = typeof el === "string" ? document.querySelector(el) : el;
      if (!this.container) {
        console.error(
          `Watermark: Container "${el}" not found. Please check the selector or ensure the element is rendered.`
        );
        return;
      }
    }

    // 2. 如果用户压根没传 el，也没找到（且上面没 return），则默认回退到 body
    if (!this.container) {
      this.container = document.body;
    }

    // 3. 最后的防线（防止 body 都不存在的情况，如 head 中执行）
    if (!this.container) {
      console.error(
        "Watermark: Mount element not found (document.body is null)."
      );
      return;
    }

    // 5. 确保容器具有定位上下文 (Containing Block)
    // 即使外部把 position 设为 static，也能通过其他手段锁住水印
    this._ensureContainerPosition();

    // 6. 渲染与启动监听
    this.render();

    if (this.options.monitor) {
      this.startMonitor();
    }

    this.startResizeObserver();

    return this;
  }

  /**
   * 【核心逻辑】确保父容器能锁住 absolute 的水印
   * 优先检查是否已有定位，如果没有，使用副作用最小的 contain: paint
   */
  private _ensureContainerPosition(): void {
    // Body 元素天生就是定位基准，不需要处理
    if (!this.container || this.container === document.body) return;

    const style = window.getComputedStyle(this.container);

    // 1. 如果用户自己设置了定位，很好，直接用
    if (["relative", "absolute", "fixed", "sticky"].includes(style.position)) {
      return;
    }

    // 2. 如果用户设置了 transform 或 contain，这些属性也会创建包含块
    if (style.transform !== "none") return;
    // @ts-ignore: contain 属性在部分 TS 版本定义中可能缺失
    if (style.contain && style.contain !== "none") return;

    // 3. 如果以上都没有，为了防止水印“飞”出去，我们施加最小干预
    // 使用 contain: paint; 它会让元素成为 containing block，但不会像 position: relative 那样改变布局流
    this.container.style.cssText += "; contain: paint;";
  }

  /**
   * 生成水印 Canvas Base64
   */
  createBase64(): { base64: string; size: number } {
    const { text, fontSize, fontFamily, fontColor, rotate, gap } = this.options;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;

    if (!ctx) {
      throw new Error("Watermark: Canvas context creation failed.");
    }

    ctx.font = `${fontSize * ratio}px ${fontFamily}`;
    const textWidth = ctx.measureText(text).width;
    const canvasSize = Math.max(textWidth, 100) + gap * ratio;

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((Math.PI / 180) * rotate);

    ctx.font = `${fontSize * ratio}px ${fontFamily}`;
    ctx.fillStyle = fontColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);

    return {
      base64: canvas.toDataURL(),
      size: canvasSize / ratio,
    };
  }

  render(): void {
    const { base64, size } = this.createBase64();
    const { id, zIndex } = this.options;

    // 渲染前暂停监听，防止自己触发自己
    this.stopMonitor();

    if (!this.container) return;

    // 清理旧水印
    const existing = this.container.querySelector(`#${id}`);
    if (existing) {
      this.container.removeChild(existing);
    }

    // 创建新水印 DOM
    this.watermarkDom = document.createElement("div");
    this.watermarkDom.id = id;

    const style: Partial<CSSStyleDeclaration> = {
      position: "absolute", // 依赖 _ensureContainerPosition 提供的基准
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: zIndex.toString(),
      backgroundImage: `url(${base64})`,
      backgroundSize: `${size}px ${size}px`,
      backgroundRepeat: "repeat",
      inset: "0",
    };

    Object.assign(this.watermarkDom.style, style);
    this.container.appendChild(this.watermarkDom);

    // 恢复监听
    if (this.options.monitor) {
      this.startMonitor();
    }
  }

  startMonitor() {
    if (this.observer || !this.container) return;

    this.observer = new MutationObserver((mutations) => {
      let needRender = false;
      let containerStyleChanged = false;

      mutations.forEach((mutation) => {
        // 1. 监听水印是否被删除
        if (mutation.type === "childList") {
          mutation.removedNodes.forEach((node) => {
            if (node === this.watermarkDom) {
              needRender = true;
            }
          });
        }

        // 2. 监听水印属性是否被篡改
        if (
          mutation.type === "attributes" &&
          mutation.target === this.watermarkDom
        ) {
          needRender = true;
        }

        // 3. 【自我防御】监听父容器样式变化
        // 如果外部修改了父容器的 position/transform，我们需要重新检查
        if (
          mutation.type === "attributes" &&
          mutation.target === this.container
        ) {
          containerStyleChanged = true;
        }
      });

      // 如果父容器样式变了，立即检查并补救定位基准
      if (containerStyleChanged) {
        this._ensureContainerPosition();
      }

      if (needRender) {
        if (this._debounceRender) clearTimeout(this._debounceRender);
        this._debounceRender = setTimeout(() => {
          this.render();
        }, 100);
      }
    });

    this.observer.observe(this.container, {
      childList: true,
      attributes: true,
      subtree: true, // 必须为 true 才能监听到子节点移除
      attributeFilter: ["style", "class", "hidden"], // 关注这些属性
    });
  }

  stopMonitor() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  startResizeObserver() {
    if (this.resizeObserver || !this.container) return;

    this.resizeObserver = new ResizeObserver(() => {
      // 只有当水印节点丢失时才重绘，单纯的大小变化通常由 CSS 自动适应
      if (
        this.container &&
        !this.container.querySelector(`#${this.options.id}`)
      ) {
        this.render();
      }
    });

    this.resizeObserver.observe(this.container);
  }

  downloadImage(fileName = "watermark.png") {
    const { base64 } = this.createBase64();
    const link = document.createElement("a");
    link.href = base64;
    link.download = fileName;
    link.click();
  }

  destroy() {
    this.stopMonitor();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (
      this.watermarkDom &&
      this.container &&
      this.container.contains(this.watermarkDom)
    ) {
      this.container.removeChild(this.watermarkDom);
    }
    this.watermarkDom = null;
    // 不建议在 destroy 时重置父容器的 contain 属性，因为可能是用户自己加上去的
  }
}

// =================================================================
// 3. 导出接口与单例 (Export)
// =================================================================

interface WatermarkExport {
  /** 方式一：只传入文本 */
  apply(text: string): void | Watermark;

  /** 方式二：传入文本 和 挂载容器 */
  apply(text: string, el: HTMLElement | string): void | Watermark;

  /** 方式三：传入完整配置对象 */
  apply(options?: WatermarkOptions): void | Watermark;

  remove: () => void;
  getInstance: () => Watermark;
}

let instance: Watermark | null = null;

const watermarkInstance: WatermarkExport = {
  apply: (...args: any[]) => {
    if (!instance) {
      instance = new Watermark();
    }
    // @ts-ignore: Spread arguments forwarding
    return instance.apply(...args);
  },
  remove: () => {
    if (instance) instance.destroy();
  },
  getInstance: () => {
    if (!instance) instance = new Watermark();
    return instance;
  },
};

export default watermarkInstance;
export type { WatermarkOptions };
