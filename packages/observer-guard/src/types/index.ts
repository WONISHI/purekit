export type ElementNode = HTMLElement | string;

// 容器尺寸变化
export type ElementResizeCallback = (entry: ResizeObserverEntry) => void;

// DOM 变更
export type ElementMutationCallback = (mutation: MutationRecord) => void;

export interface ElementObserverOptions {
  /** 监听子节点增删 */
  watchChildNodes?: boolean;

  /** 监听容器自身 attributes 变化 */
  watchContainerAttributes?: boolean;

  /** 是否递归监听子树 */
  watchSubtree?: boolean;

  /** 容器尺寸变化时，不触发 MutationObserver 回调 */
  preventMutationOnResize?: boolean;

  /** 子元素尺寸变化时，不触发 MutationObserver 回调 */
  preventChildResizeMutation?: boolean;

  /** 需要单独监听尺寸的子元素 */
  children?: ElementNode[];

  /** DOM 结构或属性发生变化 */
  onMutate?: ElementMutationCallback;

  /** 子元素属性变化*/
  onChildMutate?: ElementMutationCallback;

  /** 容器尺寸变化 */
  onResize?: ElementResizeCallback;

  /** 子元素尺寸变化 */
  onChildResize?: ElementResizeCallback;
}
