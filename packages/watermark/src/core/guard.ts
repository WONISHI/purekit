export class ObserverGuard {
  private observer: MutationObserver | null = null;
  private parentObserver: MutationObserver | null = null; // 新增：父节点监控
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private container: HTMLElement,
    private shadowRoot: ShadowRoot | null, // 支持 Shadow DOM
    private watermarkId: string,
    private onTamper: () => void,
    private onResize: (entry: ResizeObserverEntry) => void,
  ) {}

  start() {
    this.stop();

    // 目标节点：如果有 Shadow DOM，则监控 Shadow Root，否则监控容器
    const targetNode = this.shadowRoot || this.container;

    // 1. 内部防篡改 (水印节点被删或属性修改)
    this.observer = new MutationObserver((mutations) => {
      // @ts-ignore
      const watermarkDom = targetNode.querySelector(`#${this.watermarkId}`) || targetNode.getElementById?.(this.watermarkId);

      const isTampered = mutations.some((m) => {
        const removed = Array.from(m.removedNodes).some((n) => (n as HTMLElement).id === this.watermarkId);
        const modified = m.target === watermarkDom;
        return removed || modified;
      });

      if (isTampered) {
        this.onTamper();
      }
    });

    this.observer.observe(targetNode as Node, { childList: true, attributes: true, subtree: true });

    // 2. 外部防篡改 (监控容器的父节点，防止容器本身被移除)
    if (this.container.parentNode) {
      this.parentObserver = new MutationObserver((mutations) => {
        const isContainerRemoved = mutations.some((m) => Array.from(m.removedNodes).includes(this.container));
        if (isContainerRemoved) {
          this.onTamper();
        }
      });
      this.parentObserver.observe(this.container.parentNode, { childList: true });
    }

    // 3. 尺寸监听
    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) this.onResize(entries[0]);
    });
    this.resizeObserver.observe(this.container);
  }

  stop() {
    this.observer?.disconnect();
    this.parentObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.observer = null;
    this.parentObserver = null;
    this.resizeObserver = null;
  }
}
