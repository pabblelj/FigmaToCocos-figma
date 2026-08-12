# 节点分类

## 概述

Figma 中的节点类型多样，导出时需要将它们分类为三种基本类型：
- **container** - 容器节点，保持层级结构
- **label** - 文本节点，保留为可编辑文本
- **image** - 视觉节点，栅格化为图片

## classifyNode 函数

核心分类逻辑位于 `code.ts` 的 `classifyNode()` 函数（lines 568-591）。

### 函数签名

```typescript
function classifyNode(
    node: SceneNode,
    hasChildren: boolean,
    shouldRasterize: boolean
): "container" | "label" | "image"
```

### 参数说明

- `node` - Figma 节点对象
- `hasChildren` - 节点是否有子节点
- `shouldRasterize` - 是否需要栅格化（由 `getEffectDecision` 判断）

### 分类规则

```typescript
function classifyNode(node: SceneNode, hasChildren: boolean, shouldRasterize: boolean): SceneNodeJson["type"] {
    // 规则 1: 有子节点的 Frame-like 节点 → container
    if (hasChildren && isFrameLikeNode(node)) {
        return "container";
    }
    
    // 规则 2: TEXT 节点永远是 label（即使需要栅格化）
    if (node.type === "TEXT") {
        return "label";
    }
    
    // 规则 3: 需要栅格化 → image
    if (shouldRasterize) {
        return "image";
    }
    
    // 规则 4: Frame-like 节点（无子节点）→ container
    if (isFrameLikeNode(node)) {
        return "container";
    }
    
    // 规则 5: 默认 → image
    return "image";
}
```

## 节点类型映射

### Container 类型

**Figma 节点类型：**
- `FRAME`
- `GROUP`
- `COMPONENT`
- `INSTANCE`
- `SECTION`

**判断条件：**
```typescript
function isFrameLikeNode(node: SceneNode): boolean {
    return (
        node.type === "FRAME" ||
        node.type === "GROUP" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE" ||
        node.type === "SECTION"
    );
}
```

**特性：**
- 可以包含子节点
- 保持层级结构
- 可以有背景图片（`backgroundImage`）
- 可以设置裁剪（`clipContent`）

### Label 类型

**Figma 节点类型：**
- `TEXT`

**特性：**
- **永远不会被栅格化**，即使有复杂效果
- 保留文本可编辑性
- 提取描边和阴影数据

**重要性：**
```typescript
// TEXT 节点的特殊处理
if (node.type === "TEXT") {
    return "label";  // 立即返回，跳过所有其他检查
}
```

### Image 类型

**Figma 节点类型：**
- `RECTANGLE`
- `ELLIPSE`
- `POLYGON`
- `STAR`
- `VECTOR`
- `LINE`
- `BOOLEAN_OPERATION`
- 其他所有视觉节点

**触发条件：**
1. 节点类型不是 Frame-like 或 TEXT
2. 节点需要栅格化（有不支持的效果）
3. 节点是基础图形

## 栅格化决策

### shouldRasterize 判断

由 `getEffectDecision()` 函数决定（lines 751-801）：

```typescript
function getEffectDecision(node: SceneNode, options: ExportOptions): Partial<ExportOptions["effects"]> {
    const result: Partial<ExportOptions["effects"]> = {};
    
    // TEXT 节点特殊处理：只检查不支持的效果
    if (node.type === "TEXT") {
        // stroke 和 shadow 不触发栅格化（会作为数据导出）
        // 只有 blur 触发栅格化（TEXT 不支持）
        if (hasBlurEffects(node)) {
            result.blurs = true;
        }
        return result;
    }
    
    // 其他节点：检查所有效果
    if (hasStroke(node)) result.effects = true;
    if (hasShadow(node)) result.shadows = true;
    if (hasBlur(node)) result.blurs = true;
    if (hasBlendMode(node)) result.effects = true;
    
    return result;
}
```

### 栅格化触发条件

**对于非 TEXT 节点：**
- ✅ 有描边（Stroke）
- ✅ 有阴影（Shadow）
- ✅ 有模糊效果（Blur）
- ✅ 有混合模式（Blend Mode）
- ✅ 有填充渐变（Gradient）
- ✅ 有图片填充（Image Fill）

**对于 TEXT 节点：**
- ❌ 描边不触发栅格化（作为数据导出）
- ❌ 阴影不触发栅格化（作为数据导出）
- ⚠️ 模糊效果理论上会触发，但实际被忽略
- ❌ 混合模式不触发栅格化（TEXT 很少使用）

## 决策流程图

```
                    ┌─────────────┐
                    │   节点输入   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ 是 TEXT？   │
                    └──────┬──────┘
                      Yes  │  No
                    ┌──────▼──────┐
                    │   label     │
                    └─────────────┘
                           │
                    ┌──────▼──────────┐
                    │ 有子节点 &&     │
                    │ Frame-like？    │
                    └──────┬──────────┘
                      Yes  │  No
                    ┌──────▼──────┐
                    │  container  │
                    └─────────────┘
                           │
                    ┌──────▼──────────┐
                    │ shouldRasterize?│
                    └──────┬──────────┘
                      Yes  │  No
                    ┌──────▼──────┐
                    │    image    │
                    └─────────────┘
                           │
                    ┌──────▼──────────┐
                    │  Frame-like？   │
                    └──────┬──────────┘
                      Yes  │  No
                    ┌──────▼──────┐  ┌──────▼──────┐
                    │  container  │  │    image    │
                    └─────────────┘  └─────────────┘
```

## 实际示例

### 示例 1：简单容器

```typescript
// Figma 节点
Frame "Container"
  └─ Rectangle "Background"

// 分类结果
Container → type: "container"
  └─ Rectangle → type: "image" (栅格化)
```

### 示例 2：文本节点

```typescript
// Figma 节点
Text "Title"
  - Stroke: 2px black
  - Shadow: 4px 4px 8px

// 分类结果
Text → type: "label" (不栅格化，提取 stroke 和 shadow 数据)
```

### 示例 3：复杂效果

```typescript
// Figma 节点
Frame "Card"
  - Background Blur
  - Drop Shadow

// 分类结果
Frame → shouldRasterize = true → type: "image"
// 注意：即使是 Frame，也会因为效果而变成 image
```

### 示例 4：空容器

```typescript
// Figma 节点
Frame "EmptyContainer"
  // 没有子节点

// 分类结果
Frame → hasChildren = false → type: "container"
// 仍然是 container，因为是 Frame-like
```

## 边界情况

### 隐藏节点

```typescript
if (node.visible === false) {
    // 通常在序列化前就被过滤掉
    return null;
}
```

### 锁定节点

锁定状态不影响分类和导出。

### 组件实例

```typescript
// Component Instance
Instance "Button"
  └─ Text "Label"

// 分类结果
Instance → type: "container"
  └─ Text → type: "label"
```

### 混合内容

```typescript
// Frame with mixed content
Frame "MixedContent"
  ├─ Text "Title"          → label
  ├─ Rectangle "Divider"   → image
  └─ Group "SubGroup"      → container
      └─ ...
```

## 优化建议

### 避免不必要的栅格化

**问题：** Frame 因为背景效果被栅格化，子节点无法单独修改

**解决方案：**
```
优化前（整体栅格化）：
Frame "Card" (Background Blur)
  └─ Text "Title"
  
导出结果: 整个 Card 变成一张图片

优化后（分离效果层）：
Frame "Card"
  ├─ Rectangle "BlurredBg" (Background Blur) → image
  └─ Text "Title" → label

导出结果: 背景是图片，文本保持可编辑
```

### TEXT 节点最佳实践

**推荐：** 使用 Figma 支持的 TEXT 效果
- ✅ SOLID 描边
- ✅ DROP_SHADOW
- ✅ INNER_SHADOW

**避免：** 使用 TEXT 不支持的效果
- ❌ LAYER_BLUR
- ❌ BACKGROUND_BLUR
- ❌ 渐变描边

### 容器结构优化

**推荐：** 保持浅层级结构
```
✅ 好：
Frame
  ├─ Background (image)
  ├─ Content (container)
  └─ Overlay (image)

❌ 差：
Frame
  └─ Group
      └─ Frame
          └─ Group
              └─ Content (嵌套过深)
```

## 调试技巧

### 检查分类结果

在 `code.ts` 中添加日志：

```typescript
const nodeType = classifyNode(node, hasChildren, shouldRasterize);
console.log(`Node: ${node.name}, Type: ${nodeType}, Rasterize: ${shouldRasterize}`);
```

### 验证栅格化决策

```typescript
const decision = getEffectDecision(node, options);
console.log(`Node: ${node.name}, Decision:`, decision);
```

### 查看节点树

```typescript
function printNodeTree(node: SceneNode, indent = 0) {
    const prefix = '  '.repeat(indent);
    const type = classifyNode(node, 'children' in node && node.children.length > 0, false);
    console.log(`${prefix}${node.name} (${node.type}) → ${type}`);
    
    if ('children' in node) {
        for (const child of node.children) {
            printNodeTree(child, indent + 1);
        }
    }
}

// 使用
printNodeTree(figma.currentPage.selection[0]);
```
