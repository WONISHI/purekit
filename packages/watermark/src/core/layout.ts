import type { WatermarkContent, WatermarkOptions, MeasuredNode, MeasuredGroup, WatermarkText, WatermarkGroup } from '@/types';
import { imageLoader } from '@/utils/image-loader';
import { isString, isArray } from '@purekit/is';

export class LayoutEngine {
  /** 1. 预加载资源 (保持不变) */
  static async preload(node: WatermarkContent): Promise<void> {
    if (node.type === 'image') {
      await imageLoader.load(node.image, Math.min(1, Math.max(0, node.quality || 0.6)));
    } else if (node.type === 'group') {
      await Promise.all(node.items.map((item) => this.preload(item)));
    }
  }

  /** 2. 标准化输入 */
  /** * 2. 标准化输入
   * @param content 内容节点
   * @param inheritedGap 从父级继承下来的 gap (专门用于给自动拆分的文本组使用)
   */
  static normalize(content: string | string[] | WatermarkContent | undefined, inheritedGap: number = 0): WatermarkContent {
    if (!content) {
      return { type: 'text', text: '' };
    }
    if (isArray(content)) {
      return {
        type: 'group',
        layout: 'column',
        gap: inheritedGap,
        items: content.map((item) => this.normalize(item, inheritedGap)),
      };
    }
    if (isString(content)) {
      return this._normalizeText(content, {}, inheritedGap);
    }
    if (content.type === 'text') {
      // 这里的 content.text 也是字符串，同样需要检查是否含有换行符
      return this._normalizeText(content.text, content, inheritedGap);
    } else if (content.type === 'group') {
      const currentLevelGap = this._resolveGap(content.gap);
      return {
        ...content,
        items: (content.items || []).map((item) => this.normalize(item, currentLevelGap)),
      };
    } else if (content.type === 'image') {
      return content;
    }

    return content;
  }

  /**
   * 内部处理文本：检测 \n 或 <br> 并拆分
   * 🚀 核心修改：增强正则，支持 <br>, <br/>, <br />, <BR>
   */
  private static _normalizeText(text: string, style: Partial<WatermarkText>, parentGap: number): WatermarkContent {
    // 统一处理换行符: 将 <br>, <br/>, <br />, \r\n 等统一转为 \n
    const rawText = String(text)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\r\n/g, '\n');

    if (!rawText.includes('\n')) {
      return { type: 'text', ...style, text: rawText } as WatermarkText;
    }

    const lines = rawText.split('\n');

    return {
      type: 'group',
      layout: 'column', // 垂直排列
      gap: parentGap, // 沿用父级的 gap
      items: lines.map((line) => ({
        type: 'text',
        ...style,
        text: line,
      })),
    } as WatermarkGroup;
  }

  // 获取行列的间隙
  private static _resolveGap(gap?: number | [number, number]): number {
    if (isArray(gap)) return gap[0];
    return gap || 0;
  }

  /** 3. 测量尺寸 (保持不变) */
  static measure(ctx: CanvasRenderingContext2D, node: WatermarkContent, globalOptions: WatermarkOptions, ratio: number): MeasuredNode {
    if (node.type === 'text') {
      const fontSize = (node.fontSize || globalOptions.fontSize || 16) * ratio;
      const font = `${node.fontWeight || globalOptions.fontWeight || 'normal'} ${fontSize}px ${
        node.fontFamily || globalOptions.fontFamily || 'sans-serif'
      }`;
      ctx.font = font;
      const metrics = ctx.measureText(node.text);
      return {
        ...node,
        _renderWidth: metrics.width,
        _renderHeight: fontSize * 1.2,
        _font: font,
        _color: node.fontColor || globalOptions.fontColor,
      };
    } else if (node.type === 'image') {
      return {
        ...node,
        _renderWidth: (node.width || 50) * ratio,
        _renderHeight: (node.height || 50) * ratio,
      };
    } else if (node.type === 'group') {
      const measuredItems = node.items.map((item) => this.measure(ctx, item, globalOptions, ratio));
      const gap = (node.gap || 0) * ratio;
      let totalW = 0,
        totalH = 0;
      if (node.layout === 'row') {
        totalW = measuredItems.reduce((acc, item) => acc + item._renderWidth, 0) + (measuredItems.length - 1) * gap;
        totalH = Math.max(...measuredItems.map((i) => i._renderHeight));
      } else {
        totalW = Math.max(...measuredItems.map((i) => i._renderWidth));
        totalH = measuredItems.reduce((acc, item) => acc + item._renderHeight, 0) + (measuredItems.length - 1) * gap;
      }

      return {
        ...node,
        items: measuredItems,
        _renderWidth: totalW,
        _renderHeight: totalH,
        _gap: gap,
      } as MeasuredGroup;
    }
    return { ...(node as any), _renderWidth: 0, _renderHeight: 0 };
  }
}
