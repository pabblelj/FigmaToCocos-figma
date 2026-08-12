# 导出格式

## ZIP 文件结构

```
exported-scene.zip
├── scene.json          # 场景描述文件
└── images/             # 图片资源目录
    ├── node-123-456.png
    ├── node-789-012.png
    └── ...
```

## scene.json 格式规范

### 完整示例

```json
{
  "schemaVersion": "1.0.0",
  "name": "MainScene",
  "canvas": {
    "width": 1920,
    "height": 1080
  },
  "nodes": [
    {
      "id": "123:456",
      "name": "RootContainer",
      "type": "container",
      "visible": true,
      "position": { "x": 0, "y": 0 },
      "size": { "width": 1920, "height": 1080 },
      "anchor": { "x": 0.5, "y": 0.5 },
      "backgroundImage": "images/node-123-456.png",
      "clipContent": false,
      "children": [
        {
          "id": "789:012",
          "name": "Title",
          "type": "label",
          "position": { "x": 960, "y": 100 },
          "size": { "width": 400, "height": 60 },
          "text": {
            "content": "Hello World",
            "fontSize": 48,
            "fontFamily": "Inter",
            "color": "#FFFFFF",
            "align": "center",
            "verticalAlign": "middle",
            "lineHeight": 56,
            "stroke": {
              "color": "#000000",
              "width": 2
            },
            "shadow": {
              "color": "#00000080",
              "offset": { "x": 2, "y": 4 },
              "blur": 8
            }
          }
        },
        {
          "id": "345:678",
          "name": "Icon",
          "type": "image",
          "position": { "x": 100, "y": 100 },
          "size": { "width": 64, "height": 64 },
          "image": "images/node-345-678.png"
        }
      ]
    }
  ],
  "assets": [
    {
      "path": "images/node-123-456.png",
      "width": 3840,
      "height": 2160
    },
    {
      "path": "images/node-345-678.png",
      "width": 128,
      "height": 128
    }
  ]
}
```

## 字段说明

### 根对象

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | ✅ | 格式版本号，当前为 "1.0.0" |
| `name` | string | ✅ | 场景名称，来自 Figma 选中节点的名称 |
| `canvas` | object | ❌ | 画布尺寸，仅当根节点是 Frame 时包含 |
| `nodes` | array | ✅ | 根节点数组，通常只有一个元素 |
| `assets` | array | ✅ | 资源清单，列出所有导出的图片 |

### 节点对象（SceneNodeJson）

#### 基础字段

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | Figma 节点 ID（格式：`"数字:数字"`） |
| `name` | string | ✅ | 节点名称 |
| `type` | string | ✅ | 节点类型：`"container"` / `"label"` / `"image"` |
| `visible` | boolean | ❌ | 可见性，默认 `true`，不可见节点可能被省略 |
| `position` | object | ❌ | 相对父节点的位置 `{x, y}` |
| `size` | object | ❌ | 节点尺寸 `{width, height}` |
| `anchor` | object | ❌ | 锚点 `{x, y}`，默认 `{0.5, 0.5}` 表示中心 |

#### 类型特定字段

| 字段 | 类型 | 节点类型 | 说明 |
|---|---|---|---|
| `children` | array | `container` | 子节点数组 |
| `backgroundImage` | string | `container` | 背景图片路径（相对于 ZIP 根目录） |
| `clipContent` | boolean | `container` | 是否裁剪子内容 |
| `image` | string | `image` | 图片路径（相对于 ZIP 根目录） |
| `text` | object | `label` | 文本数据，见下方详细说明 |

### 文本对象（TextData）

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `content` | string | ✅ | 文本内容 |
| `fontSize` | number | ✅ | 字体大小（像素） |
| `fontFamily` | string | ✅ | 字体家族名称 |
| `color` | string | ✅ | 文本颜色（十六进制：`#RRGGBB` 或 `#RRGGBBAA`） |
| `align` | string | ✅ | 水平对齐：`"left"` / `"center"` / `"right"` |
| `verticalAlign` | string | ✅ | 垂直对齐：`"top"` / `"middle"` / `"bottom"` |
| `lineHeight` | number | ✅ | 行高（像素） |
| `stroke` | object | ❌ | 描边数据，见下方 |
| `shadow` | object | ❌ | 阴影数据，见下方 |

#### 描边对象（TextStroke）

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `color` | string | ✅ | 描边颜色（十六进制） |
| `width` | number | ✅ | 描边宽度（像素） |

**注意：**
- 只提取第一个可见的 SOLID 类型描边
- 渐变描边不支持

#### 阴影对象（TextShadow）

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `color` | string | ✅ | 阴影颜色（十六进制，包含透明度） |
| `offset` | object | ✅ | 阴影偏移 `{x, y}`（像素） |
| `blur` | number | ✅ | 模糊半径（像素） |

**注意：**
- 只提取第一个可见的 DROP_SHADOW 或 INNER_SHADOW
- LAYER_BLUR 和 BACKGROUND_BLUR 不支持

### 资源对象（Asset）

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `path` | string | ✅ | 图片文件路径（相对于 ZIP 根目录） |
| `width` | number | ✅ | 图片宽度（像素，导出时的实际尺寸） |
| `height` | number | ✅ | 图片高度（像素，导出时的实际尺寸） |

**注意：**
- 图片默认以 2 倍分辨率导出（@2x）
- `width` 和 `height` 是导出后的实际像素尺寸

## 坐标系统

### Figma 坐标系

- 原点：Frame 左上角
- X 轴：向右为正
- Y 轴：向下为正

### 导出坐标

导出的 `position` 字段保持 Figma 的坐标系统，由 Cocos 导入插件负责转换。

```
Figma Frame (0, 0) 左上角
    ↓
    ├─ position: {x: 100, y: 50}  ← 相对父节点
    └─ anchor: {x: 0.5, y: 0.5}   ← 锚点在中心
```

## 节点命名规范

### 图片文件命名

```
images/node-{id}.png
```

- `{id}` 是 Figma 节点 ID，冒号 `:` 替换为 `-`
- 例如：节点 ID `"123:456"` → 文件名 `node-123-456.png`

### 路径格式

所有路径使用正斜杠 `/`，相对于 ZIP 根目录：

```
✅ "images/node-123-456.png"
❌ "images\\node-123-456.png"
❌ "/images/node-123-456.png"
```

## 颜色格式

### 十六进制字符串

```
不透明颜色：#RRGGBB
半透明颜色：#RRGGBBAA
```

### 示例

```json
{
  "color": "#FF5733",      // 不透明红色
  "color": "#FF573380"     // 50% 透明红色 (0x80 = 128 = 50%)
}
```

### 转换函数（code.ts）

```typescript
function rgbToHex(color: RGB, opacity: number = 1): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = Math.round(opacity * 255);
    
    if (a < 255) {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

## 版本兼容性

### schemaVersion: "1.0.0"

当前导出格式版本。未来如果格式发生重大变化，版本号会递增。

Cocos 导入插件应检查此字段以确保兼容性：

```typescript
if (scene.schemaVersion !== "1.0.0") {
    throw new Error(`Unsupported schema version: ${scene.schemaVersion}`);
}
```

## 边界情况处理

### 空节点

如果节点没有视觉内容且没有子节点，可能被省略或导出为空 container：

```json
{
  "id": "123:456",
  "name": "EmptyContainer",
  "type": "container",
  "children": []
}
```

### Mixed 值

Figma 中某些属性可能是 `mixed`（例如多个文本段落有不同字体大小），导出时会使用第一个值或默认值。

### 隐藏节点

`visible: false` 的节点通常会被省略，除非它们是容器且包含可见子节点。

### 大尺寸图片

图片导出有尺寸限制（Figma API 限制），超大节点可能导出失败并在控制台显示错误。

## 验证工具

### JSON Schema（未来）

考虑提供 JSON Schema 定义用于验证导出文件的有效性：

```bash
# 验证 scene.json 格式
npx ajv validate -s scene-schema.json -d scene.json
```

### 手动验证清单

导出后检查：
- ✅ `scene.json` 是有效的 JSON
- ✅ 所有 `assets` 中的文件都存在于 `images/` 目录
- ✅ 所有 `image` 和 `backgroundImage` 字段引用的路径都在 `assets` 中
- ✅ 没有重复的节点 ID
- ✅ TEXT 节点有 `text` 对象
- ✅ `container` 节点有 `children` 数组
