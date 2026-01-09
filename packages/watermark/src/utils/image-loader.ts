import { isString, isDef } from '@/utils/is';

export class ImageLoader {
  // Key 建议改为： "URL_Quality" 格式，防止不同质量的请求命中同一个缓存
  private cache = new Map<string, HTMLImageElement>();

  /**
   * 加载图片（带缓存功能）
   * 内部会自动调用 compress 进行压缩
   */
  public async load(src: string | Blob | File, quality: number = 0.6): Promise<HTMLImageElement> {
    // 1. 生成缓存 Key (注意：Blob/File 无法生成稳定字符串 Key，通常不缓存或使用临时 URL 作为 Key)
    let cacheKey = '';
    if (typeof src === 'string') {
      cacheKey = `${src}_${quality}`; // 关键：将 quality 加入缓存 Key
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }
    }

    // 2. 调用 compress 获取压缩后的图片对象
    const compressedImg = await this.compress(src, quality);

    // 3. 存入缓存
    if (cacheKey) {
      this.cache.set(cacheKey, compressedImg);
    }

    return compressedImg;
  }

  /**
   * 压缩图片方法
   * 接收资源，返回压缩后的 Image 对象
   */
  public async compress(src: string | Blob | File, quality: number): Promise<HTMLImageElement> {
    // 1. 先把 raw 资源加载为一张可绘制的 Image 对象
    const originalImage = await this._loadRawImage(src);

    // 如果质量要求是 1，或者图片本身无法压缩（如 svg），可以直接返回原图
    if (quality >= 1) {
      return originalImage;
    }

    // 2. 使用 Canvas 进行压缩
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      // 设置尺寸 (这里保持原尺寸，如果需要缩放可在此处修改 width/height)
      canvas.width = originalImage.naturalWidth;
      canvas.height = originalImage.naturalHeight;

      // 绘制原图
      ctx.drawImage(originalImage, 0, 0);

      // 3. 导出压缩后的 Base64
      // 【关键点】：
      // image/jpeg: 压缩率高，但不支持透明（透明变黑/白）。
      // image/png:  不支持 quality 参数（无损）。
      // image/webp: 支持透明 + 支持压缩 (最佳选择)。
      const mimeType = 'image/webp';
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // 4. 将 Base64 转换回 Image 对象返回
      const newImg = new Image();
      newImg.onload = () => resolve(newImg);
      newImg.onerror = (e) => reject(e);
      newImg.src = dataUrl;
    });
  }

  /**
   * 私有辅助方法：将 URL/Blob/File 转换为原始 HTMLImageElement
   * 不做任何压缩，纯粹为了获取图像数据
   */
  private async _loadRawImage(src: string | Blob | File): Promise<HTMLImageElement> {
    let url: string;
    let isBlob = false;

    if ((typeof Blob !== 'undefined' && src instanceof Blob) || (typeof File !== 'undefined' && src instanceof File)) {
      url = URL.createObjectURL(src);
      isBlob = true;
    } else {
      url = src as string;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      // 处理跨域
      if (typeof url === 'string' && !url.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        if (isBlob) {
          URL.revokeObjectURL(url); // 图片加载完后立即释放 Blob URL 内存
        }
        resolve(img);
      };

      img.onerror = (e) => {
        if (isBlob) URL.revokeObjectURL(url);
        console.error('Raw image load failed:', url);
        reject(e);
      };

      img.src = url;
    });
  }
}

export const imageLoader = new ImageLoader();
