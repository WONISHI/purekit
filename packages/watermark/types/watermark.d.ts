export  interface WatermarkOptions {
  /** 水印挂载的父容器，支持选择器字符串或 DOM 元素 */
  el?: string | HTMLElement;
  /** 水印元素的 ID */
  id?: string;
  /** 水印文字 */
  text?: string;
  /** 字体大小 */
  fontSize?: number;
  /** 水印间距 */
  gap?: number;
  /** 字体 */
  fontFamily?: string;
  /** 字体颜色 */
  fontColor?: string;
  /** 旋转角度 */
  rotate?: number;
  /** CSS 层级 */
  zIndex?: number;
  /** 是否开启防篡改监控 */
  monitor?: boolean;
}

export type InternalOptions = Required<Omit<WatermarkOptions, 'el'>>;