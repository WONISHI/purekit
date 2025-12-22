export type LayoutMode = 'row' | 'column'; // 对应截图的 "水平方向" | "竖直方向"

export interface BaseContent {
  rotate?: number; // 单独旋转角度
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
  image: string;
  width?: number;  // 图片必须指定宽
  height?: number; // 图片必须指定高
}

export interface WatermarkGroup extends BaseContent {
  type: 'group';
  layout: LayoutMode;
  gap?: number; // 对应截图的 layoutGap
  items: WatermarkContent[]; // 对应截图的 colCotext
}

export type WatermarkContent = WatermarkText | WatermarkImage | WatermarkGroup;

// 更新 Options
export interface WatermarkOptions {
    /** 挂载容器 */
  el?: string | HTMLElement;
  /** 水印 ID */
  id?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
  /** 整体旋转角度 */
  rotate?: number;
  zIndex?: number;
  /** 防篡改监控 */
  monitor?: boolean;
  /** 布局模式：repeat(平铺), lt, rt, lb, rb, center */
  layout?: "repeat" | "lt" | "rt" | "lb" | "rb" | "center";
  /** 平铺间距 [x, y] */
  gap?: number | [number, number];
  /** 单点偏移 [x, y] */
  offset?: number | [number, number];
  content?: string | WatermarkContent; 
}