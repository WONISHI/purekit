import watermark from '../src/index';

describe('Watermark Class', () => {
  it('测试 apply 方法', async () => {
    // 模拟 DOM
    document.body.innerHTML = '<div id="app"></div>';

    // // 运行你的逻辑
    await watermark.apply('内部资料', '#app');

    // 输出当前页面结构
    console.log(document.body.innerHTML);

    // // 断言
    // const el = document.querySelector('#watermark-layer');
    // expect(el).not.toBeNull();
    // // Jest 也支持这种写法
    // expect(el?.id).toBe('watermark-layer');
  });
});
