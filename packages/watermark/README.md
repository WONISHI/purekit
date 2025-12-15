# @purekit/watermark

## 📦 安装 (Installation)

```JS
npm install @purekit/watermark
# or
yarn add @purekit/watermark
```

## 🚀 使用指南 (Usage)

基础用法

```typescript
import watermark from 'my-ui-utils/watermark';

// 方式 A: 最简单（默认挂载到 body）
watermark.apply("机密文件");

// 方式 B: 指定容器（选择器字符串 或 HTMLElement）
watermark.apply("内部资料", "#app");

// 方式 C: 完整配置
watermark.apply({
  text: "User: 10086",
  el: document.getElementById("content"),
  rotate: -45,
  fontColor: "rgba(200, 0, 0, 0.15)",
  fontSize: 20
});

// 移除水印
watermark.remove();
```

## 配置项 (WatermarkOptions)

| **属性**     | **类型**               | **默认值**          | **说明**                 |
| ------------ | ---------------------- | ------------------- | ------------------------ |
| `text`       | `string`               | `"侵权必究"`        | 水印文字内容             |
| `el`         | `string | HTMLElement` | `body`              | 挂载容器                 |
| `id`         | `string`               | `"watermark-layer"` | 水印层 DOM ID            |
| `width`      | `number`               | -                   | 画布宽度（通常自动计算） |
| `height`     | `number`               | -                   | 画布高度（通常自动计算） |
| `fontSize`   | `number`               | `16`                | 字体大小                 |
| `fontFamily` | `string`               | `system-ui...`      | 字体                     |
| `fontColor`  | `string`               | `rgba(0,0,0,0.15)`  | 字体颜色                 |
| `rotate`     | `number`               | `-20`               | 旋转角度                 |
| `gap`        | `number`               | `100`               | 水印间距                 |
| `zIndex`     | `number`               | `9999`              | 层级                     |
| `monitor`    | `boolean`              | `true`              | 是否开启防篡改监控       |