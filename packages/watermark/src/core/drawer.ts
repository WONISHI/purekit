import type { MeasuredNode, MeasuredGroup, WatermarkOptions, WatermarkCanvasDrawerRusult } from '@/types';
import { imageLoader } from '@/utils/image-loader';

export class CanvasDrawer {
  static async generate(layoutTree: MeasuredNode, options: WatermarkOptions, ratio: number): Promise<WatermarkCanvasDrawerRusult> {
    const { rotate, gap, layout, quality = 0.92 } = options;
    // @ts-ignore
    const [gx, gy] = (Array.isArray(gap) ? gap : [gap, gap] || [100, 100]).map((n) => n * ratio);

    const contentW = layoutTree._renderWidth;
    const contentH = layoutTree._renderHeight;

    const angle = ((rotate || -20) * Math.PI) / 180;

    const canvasW = Math.abs(Math.cos(angle) * contentW) + Math.abs(Math.sin(angle) * contentH) + (layout === 'repeat' ? gx : 0);
    const canvasH = Math.abs(Math.sin(angle) * contentW) + Math.abs(Math.cos(angle) * contentH) + (layout === 'repeat' ? gy : 0);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // 绘制起点居中
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(angle);
    ctx.translate(-contentW / 2, -contentH / 2);

    await this._drawRecursive(ctx, layoutTree);

    // 优化：同时返回 Blob 和 Base64
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve({
            base64: canvas.toDataURL('image/png', quality),
            blob: blob!,
            size: [canvasW / ratio, canvasH / ratio],
          });
        },
        'image/png',
        quality,
      );
    });
  }

  /**
   * 核心：支持 Group 内的对齐 (align)
   */
  private static async _drawRecursive(ctx: CanvasRenderingContext2D, node: MeasuredNode | MeasuredGroup, x = 0, y = 0) {
    ctx.save();

    const centerX = x + node._renderWidth / 2;
    const centerY = y + node._renderHeight / 2;
    if (node.rotate) {
      ctx.translate(centerX, centerY);
      ctx.rotate((node.rotate * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    if (node.type === 'text') {
      ctx.font = node._font!;
      ctx.fillStyle = node._color!;
      ctx.textBaseline = 'top';
      ctx.fillText(node.text, x, y + (node._renderHeight - parseInt(ctx.font)) / 2 + 2);
    } else if (node.type === 'image') {
      const img = await imageLoader.load(node.image);
      ctx.drawImage(img, x, y, node._renderWidth, node._renderHeight);
    } else if (node.type === 'group') {
      let currentX = x;
      let currentY = y;
      const isRow = node.layout === 'row';
      const align = node.align || 'center'; // 默认居中

      for (const item of node.items) {
        let itemX = currentX;
        let itemY = currentY;

        // 优化布局对齐逻辑
        if (isRow) {
          // 水平排列时，处理垂直对齐
          if (align === 'center') itemY = y + (node._renderHeight - item._renderHeight) / 2;
          else if (align === 'end') itemY = y + (node._renderHeight - item._renderHeight);
          // start 默认为 y
        } else {
          // 垂直排列时，处理水平对齐
          if (align === 'center') itemX = x + (node._renderWidth - item._renderWidth) / 2;
          else if (align === 'end') itemX = x + (node._renderWidth - item._renderWidth);
          // start 默认为 x
        }

        await this._drawRecursive(ctx, item, itemX, itemY);

        if (isRow) currentX += item._renderWidth + (node._gap || 0);
        else currentY += item._renderHeight + (node._gap || 0);
      }
    }
    ctx.restore();
  }
}
