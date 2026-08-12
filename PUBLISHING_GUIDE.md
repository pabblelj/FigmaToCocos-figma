# Figma Plugin 发布指南

## 发布前准备清单

### 1. 插件图标和封面
- [ ] 创建 128x128 插件图标 (icon.png)
- [ ] 准备封面图 (1920x960, 展示插件功能)
- [ ] 准备 3-5 张截图展示主要功能

### 2. 文档完善
- [x] manifest.json 包含所有必需字段
- [x] README.md 说明功能和使用方法
- [ ] 添加使用示例和最佳实践
- [ ] 准备中英文描述

### 3. 代码检查
- [ ] 移除所有 console.log 调试代码
- [ ] 处理所有错误情况
- [ ] 测试边界条件
- [ ] 确保没有硬编码路径或敏感信息

### 4. 测试
- [ ] 在不同大小的设计文件中测试
- [ ] 测试各种节点类型（文本、图片、矢量、组件）
- [ ] 验证导出的 JSON 格式正确
- [ ] 在 Cocos Creator 中测试导入流程

## 发布步骤

### Step 1: 在 Figma 中准备插件

1. 打开 Figma Desktop App
2. 进入 **Plugins** → **Development** → **Import plugin from manifest**
3. 选择你的 `manifest.json` 文件
4. 测试插件确保正常运行

### Step 2: 发布到 Figma Community

1. 在 Figma 中，打开你的插件开发界面
2. 点击插件名称旁的 **⋯** 菜单
3. 选择 **Publish**

### Step 3: 填写发布信息

**基本信息：**
- **Name**: Cocos Creator Exporter
- **Tagline**: Export Figma designs to Cocos Creator format
- **Description**:
  ```
  Export your Figma UI designs directly to Cocos Creator with full fidelity. 
  This plugin preserves layouts, text styles, effects, and component structures.
  
  Features:
  • Complete UI component export
  • Layout and constraint preservation
  • Text formatting with effects
  • Image and vector shape support
  • One-click batch export
  
  Requires the figma-cocos-importer extension in Cocos Creator.
  ```

**分类标签：**
- Export
- Developer Tools
- Productivity

**封面和截图：**
- 上传封面图（展示导出前后对比）
- 上传 3-5 张功能截图

### Step 4: 提交审核

1. 点击 **Submit for review**
2. Figma 团队会在 1-3 个工作日内审核
3. 审核通过后插件会出现在 Community

## 发布后维护

### 更新插件
1. 修改代码和 manifest.json 中的版本号
2. 在 Figma 中重新发布
3. 在发布页面填写更新日志

### 监控反馈
- 定期检查 Community 页面的用户评论
- 收集用户反馈和功能请求
- 修复 bug 并发布更新

## 推荐的图标设计

插件图标应该：
- 清晰表达功能（Figma → Cocos Creator）
- 使用 Cocos 品牌色（可选）
- 128x128 PNG，透明背景
- 简洁易识别

建议图标元素：
- Figma logo + 箭头 + Cocos logo
- 或设计元素 + 游戏控制器图标

## 注意事项

⚠️ **发布前必须检查：**
- 不要在描述中承诺未实现的功能
- 确保截图展示的是最新版本功能
- 测试插件在 Figma 和 FigJam 中的表现
- 准备好响应用户问题和反馈

✅ **审核要点：**
- 插件必须实际可用
- 不能包含恶意代码
- 不能违反 Figma 的使用条款
- 描述和截图必须准确反映功能

## 相关链接

- [Figma Plugin 开发文档](https://www.figma.com/plugin-docs/)
- [Figma Community 指南](https://help.figma.com/hc/en-us/articles/360038743434)
- [插件审核标准](https://www.figma.com/plugin-docs/publishing-guidelines/)
