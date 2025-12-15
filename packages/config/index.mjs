// packages/scroll-observer.js/rollup.config.mjs
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from '@rollup/plugin-terser';

export const baseConfig = {
  // 入口文件
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "dist/index.mjs",
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
    }),
    terser({
      format: {
        // 移除所有注释
        comments: false,
      },
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.log','console.info','console.debug'], 
      },
    }),
  ],
};