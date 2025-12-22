module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修补 bug
        "docs", // 文档
        "style", // 格式（不影响代码运行的变动）
        "refactor", // 重构
        "perf", // 性能优化
        "test", // 测试
        "chore", // 构建过程或辅助工具的变动
        "revert", // 回退
        "build", // 打包
      ],
    ],
    "type-case": [0], // 允许大小写混用（可选）
    "subject-full-stop": [0, "never"],
    "subject-case": [0, "never"],
  },
};

// 第一步 安装核心工具
// pnpm install --save-dev @commitlint/config-conventional @commitlint/cli husky -w

// 第二步 启用 Husky
/*
* # 初始化 husky
* npx husky install
* 
* # 将 husky 安装脚本添加到 package.json，确保团队成员安装依赖后自动启用
* npm pkg set scripts.prepare="husky install"
*/

// 第三步 配置校验规则
/**
 * module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修补 bug
        'docs',     // 文档
        'style',    // 格式（不影响代码运行的变动）
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'chore',    // 构建过程或辅助工具的变动
        'revert',   // 回退
        'build'     // 打包
      ],
    ],
    'type-case': [0], // 允许大小写混用（可选）
    'subject-full-stop': [0, 'never'],
    'subject-case': [0, 'never'],
  },
};
 */

// 第四步：添加 Git Hook

// npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}'