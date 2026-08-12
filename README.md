# Cocos Creator 导出插件

将 Figma 设计直接导出为 Cocos Creator 格式，完整支持 UI 组件、布局和效果。

## 概述

这是一个将 Figma 设计导入 Cocos Creator 的两阶段工作流：

1. **Figma 插件** (`https://github.com/pabblelj/FigmaToCocos-figma.git`)：将 Figma 设计导出为包含 scene.json 和资源的 ZIP 文件
2. **Cocos 插件** (`https://github.com/pabblelj/FigmaToCocos-cocos.git`)：将 ZIP 文件导入 Cocos Creator 并生成预制体

## 功能特性

- **完整 UI 导出**：导出帧、组件、文本、图像和矢量图形
- **布局保留**：保持 Widget 布局、约束和响应式行为
- **效果支持**：保留阴影、描边、填充和混合模式
- **文本格式**：保持字体样式、颜色和文本效果
- **资源管理**：自动处理图像导出和精灵引用
- **一键导出**：简单的界面用于导出选中的帧或整个页面

## 使用方法

1. 选择要导出的帧或组件
2. 从插件菜单运行插件
3. 点击"导出选中的图层"或"导出当前页面"
4. 使用配套的导入扩展将生成的 JSON 文件导入 Cocos Creator

## 系统要求

- Figma 桌面应用或浏览器版本
- Cocos Creator 3.x 并安装 figma-cocos-importer 扩展

## 安装方法

从 Figma 社区安装，或者：
1. 下载插件文件
2. 在 Figma 中：插件 → 开发 → 从 manifest 导入插件
3. 选择 manifest.json 文件

## 开源协议

MIT 协议 - 详见 [LICENSE](LICENSE) 文件

## 支持

如有问题或功能请求，请联系 [your contact info]
