# 项目结构

## 目录结构

```
figma-cocos-exporter/
├── code.ts              # 主要导出逻辑（TypeScript 源码）
├── code.js              # 编译后的代码（Figma 实际加载）
├── ui.html              # 插件 UI 界面
├── manifest.json        # 插件清单文件
├── tsconfig.json        # TypeScript 配置
├── package.json         # 依赖配置
└── docs/                # 文档目录
```

## 关键文件说明

### code.ts

TypeScript 源文件，包含所有导出逻辑：

**核心函数：**
- `exportToCocos()` - 主导出函数入口
- `classifyNode()` - 节点类型分类（container/label/image）
- `serializeNode()` - 序列化单个节点
- `shouldRasterize()` - 判断节点是否需要栅格化
- `getEffectDecision()` - 分析节点效果并决定处理方式
- `extractTextStroke()` - 提取文本描边数据
- `extractTextShadow()` - 提取文本阴影数据
- `exportImages()` - 导出栅格化图片

**关键位置：**
- `classifyNode()` (lines 568-591) - 节点分类逻辑
- `getEffectDecision()` (lines 751-801) - 效果决策逻辑
- `extractTextStroke()` (lines 705-725) - 描边提取
- `extractTextShadow()` (lines 727-749) - 阴影提取

### ui.html

插件的用户界面：
- 简单的导出按钮
- 状态显示
- 使用 `window.parent.postMessage` 与主代码通信

### manifest.json

Figma 插件配置文件：

```json
{
  "name": "Figma Cocos Exporter",
  "id": "...",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"]
}
```

**注意：** `main` 字段指向 `code.js`（编译后的文件），不是 `code.ts`

## 构建流程

### 编译命令

```bash
tsc
```

### 编译配置（tsconfig.json）

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["ES2017"],
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  }
}
```

### 编译输出

- `code.ts` → `code.js`
- Figma 加载 `code.js` 运行插件

### 重要提示

⚠️ **修改 TypeScript 文件后必须运行 `tsc`**

- 未编译的更改不会在 Figma 中生效
- 编译错误会显示在命令行输出中
- 建议使用 `tsc --watch` 监听文件变化自动编译

## 类型定义

### ExportOptions

导出配置选项：

```typescript
interface ExportOptions {
    scale?: number;                    // 导出缩放比例（默认 2）
    effects?: {
        shadows?: boolean;             // 是否导出阴影效果
        blurs?: boolean;               // 是否导出模糊效果
    };
}
```

### SceneNodeJson

导出的节点 JSON 结构：

```typescript
interface SceneNodeJson {
    id: string;                        // Figma 节点 ID
    name: string;                      // 节点名称
    type: "container" | "label" | "image";
    visible?: boolean;                 // 可见性
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    anchor?: { x: number; y: number }; // 锚点（默认 0.5, 0.5）
    image?: string;                    // 图片路径
    backgroundImage?: string;          // 背景图片路径
    clipContent?: boolean;             // 是否裁剪内容
    text?: TextData;                   // 文本数据
    children?: SceneNodeJson[];        // 子节点
}
```

### TextData

文本节点数据：

```typescript
interface TextData {
    content: string;                   // 文本内容
    fontSize: number;                  // 字体大小
    fontFamily: string;                // 字体家族
    color: string;                     // 颜色（十六进制）
    align: "left" | "center" | "right";
    verticalAlign: "top" | "middle" | "bottom";
    lineHeight: number;
    stroke?: {                         // 描边数据（可选）
        color: string;
        width: number;
    };
    shadow?: {                         // 阴影数据（可选）
        color: string;
        offset: { x: number; y: number };
        blur: number;
    };
}
```

### SceneJson

完整场景数据：

```typescript
interface SceneJson {
    schemaVersion: string;             // 格式版本（"1.0.0"）
    name: string;                      // 场景名称
    canvas?: {                         // 画布尺寸（可选）
        width: number;
        height: number;
    };
    nodes: SceneNodeJson[];            // 根节点数组
    assets: Array<{                    // 资源列表
        path: string;                  // 相对路径
        width: number;
        height: number;
    }>;
}
```

## Figma API 使用

### 常用节点类型

```typescript
// Frame 和容器
type FrameLikeNode = FrameNode | GroupNode | ComponentNode | InstanceNode;

// 文本节点
type TextNode = {
    type: "TEXT";
    characters: string;
    fontSize: number | PluginAPI['mixed'];
    fontFamily: string;
    strokes: Paint[];
    effects: Effect[];
    // ...
};
```

### 节点遍历

```typescript
function traverseNode(node: SceneNode, callback: (node: SceneNode) => void) {
    callback(node);
    if ('children' in node) {
        for (const child of node.children) {
            traverseNode(child, callback);
        }
    }
}
```

### 导出图片

```typescript
const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 2 }
});
```

## 调试技巧

### 查看编译输出

```bash
# 检查是否有编译错误
tsc

# 监听模式，文件修改时自动编译
tsc --watch
```

### 控制台输出

在 `code.ts` 中使用 `console.log()` 输出调试信息：

```typescript
console.log('Exporting node:', node.name, 'type:', node.type);
```

在 Figma 中：
1. 打开插件
2. 右键插件窗口 → Inspect
3. 在 DevTools 的 Console 面板查看输出

### 验证导出数据

```typescript
// 导出前打印 JSON 数据
console.log('Scene JSON:', JSON.stringify(sceneJson, null, 2));
```

### 测试特定节点

选择单个节点进行测试：

```typescript
const selection = figma.currentPage.selection[0];
if (selection) {
    const result = classifyNode(selection, false, false);
    console.log('Node type:', result);
}
```
