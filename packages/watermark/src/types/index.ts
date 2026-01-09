export type LayoutMode = 'repeat' | 'lt' | 'rt' | 'lb' | 'rb' | 'center';
export type ContentLayoutMode = 'row' | 'column';
export type ContentAlign = 'start' | 'center' | 'end'; // 新增：支持 flex-start/end/center 对齐
export type WatermarkImageType = string | Blob | File;

export interface BaseContent {
  rotate?: number;
}

export interface WatermarkText extends BaseContent {
  type: 'text';
  text: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
}

export interface WatermarkImage extends BaseContent {
  type: 'image';
  image: WatermarkImageType;
  width?: number;
  height?: number;
}

export interface WatermarkGroup extends BaseContent {
  type: 'group';
  layout: ContentLayoutMode;
  align?: ContentAlign; // 新增：组内对齐方式
  gap?: number;
  items: WatermarkContent[];
}

export type WatermarkContent = WatermarkText | WatermarkImage | WatermarkGroup;

export interface WatermarkCanvasDrawerRusult {
  base64: string; // 兼容旧逻辑
  blob: Blob; // 新增：用于 URL.createObjectURL 优化
  size: [number, number];
}

export interface WatermarkOptions {
  id?: string;
  el?: string | HTMLElement;
  content?: string | string[] | WatermarkContent;
  text?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
  rotate?: number;
  zIndex?: number;
  monitor?: boolean;
  layout?: LayoutMode;
  gap?: [number, number] | number;
  offset?: [number, number] | number;
  // 新增配置
  useShadowDom?: boolean; // 是否启用 Shadow DOM 隔离
  quality?: number; // 图片压缩质量 (0-1)
}

// 内部计算用的类型 (Measure 后的结果)
export interface MeasuredBase {
  _renderWidth: number;
  _renderHeight: number;
}

export type MeasuredNode =
  | (WatermarkText & MeasuredBase & { _font?: string; _color?: string })
  | (WatermarkImage & MeasuredBase)
  | MeasuredGroup;

export interface MeasuredGroup extends WatermarkGroup, MeasuredBase {
  items: MeasuredNode[];
  _gap?: number;
}
