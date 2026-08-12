# Figma Cocos Exporter 文档

## 概述

Figma Cocos Exporter 是一个 Figma 插件，用于将 Figma 设计导出为 Cocos Creator 可导入的 ZIP 格式文件。

这是 Figma 到 Cocos Creator 工作流的第一步：
1. **Figma 插件导出** (本插件) → 生成 ZIP 文件
2. **Cocos 扩展导入** (`figmaPreview/extensions/figma-cocos-importer`) → 生成预制件

## 文档目录

- **[项目结构](structure.md)** - 文件组织、关键函数和构建流程
- **[导出格式](export-format.md)** - scene.json 格式规范和资源结构
- **[节点分类](node-classification.md)** - 节点类型判断逻辑和栅格化规则
- **[文本导出](text-export.md)** - TEXT 节点特殊处理，提取描边和阴影数据
- **[效果处理](effects-handling.md)** - Figma 效果的支持和限制

## 快速开始

### 安装插件

1. 在 Figma Desktop 中，菜单 → Plugins → Development → Import plugin from manifest
2. 选择 `plugins/plugin-samples/figma-cocos-exporter/manifest.json`

### 构建插件

```bash
cd plugins/plugin-samples/figma-cocos-exporter
npm install
tsc
```

**重要：** TypeScript 修改后必须运行 `tsc` 编译，否则更改不会生效。

### 使用流程

1. 在 Figma 中打开设计文件
2. 选择要导出的 Frame 或组件
3. 运行插件：Plugins → Figma Cocos Exporter
4. 点击"Export"按钮
5. 选择保存位置，生成 ZIP 文件
6. 使用 Cocos Creator 扩展导入 ZIP

## 导出内容

### ZIP 文件结构

```
exported-scene.zip
├── scene.json          # 场景数据（节点树、属性、效果）
└── images/             # 导出的图片资源
    ├── image-1.png
    ├── image-2.png
    └── ...
```

### scene.json 核心字段

```json
{
  "schemaVersion": "1.0.0",
  "name": "MainScene",
  "canvas": { "width": 1920, "height": 1080 },
  "nodes": [
    {
      "id": "123:456",
      "name": "Container",
      "type": "container",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 200, "height": 100 },
      "backgroundImage": "images/bg.png",
      "clipContent": true,
      "children": [...]
    }
  ],
  "assets": [
    {
      "path": "images/bg.png",
      "width": 200,
      "height": 100
    }
  ]
}
```

## 节点类型

| Figma 节点 | 导出类型 | 说明 |
|---|---|---|
| FRAME, GROUP, INSTANCE | `container` | 容器节点，保持层级结构 |
| TEXT | `label` | 文本节点，永不栅格化 |
| 其他有视觉内容 | `image` | 栅格化为图片 |

## 特殊处理

### TEXT 节点

- **永不栅格化**，即使有描边、填充或效果
- 提取描边数据（仅支持 SOLID 类型）
- 提取阴影数据（仅支持 DROP_SHADOW 和 INNER_SHADOW）
- 模糊效果不支持，会被忽略

### 效果支持

| Figma 效果 | TEXT 节点 | 其他节点 | 说明 |
|---|---|---|---|
| DROP_SHADOW | ✅ 导出数据 | ⚠️ 触发栅格化 | 外阴影 |
| INNER_SHADOW | ✅ 导出数据 | ⚠️ 触发栅格化 | 内阴影 |
| LAYER_BLUR | ❌ 忽略 | ⚠️ 触发栅格化 | 图层模糊 |
| BACKGROUND_BLUR | ❌ 忽略 | ⚠️ 触发栅格化 | 背景模糊 |

## 注意事项

- TypeScript 源码修改后必须运行 `tsc` 编译
- 编译后的 `code.js` 才是 Figma 实际加载的文件
- TEXT 节点的描边只支持第一个 SOLID 类型描边
- 阴影只提取第一个可见的 DROP_SHADOW 或 INNER_SHADOW
- 图片导出为 PNG 格式，分辨率为设计尺寸的 2 倍（@2x）

## 相关资源

- Figma Plugin API 文档：https://www.figma.com/plugin-docs/
- Cocos Creator 导入插件：`figmaPreview/extensions/figma-cocos-importer`
