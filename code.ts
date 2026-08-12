type EffectPolicy = "discard" | "rasterize";
type FontMode = "system" | "figma";
type ExportFormat = "PNG";

interface ExportOptions {
  includeHiddenLayers: boolean;
  imageScale: number;
  fontMode: FontMode;
  effects: {
    shadow: EffectPolicy;
    blur: EffectPolicy;
    blendMode: EffectPolicy;
  };
}

interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PointLike {
  x: number;
  y: number;
}

interface ExportedAsset {
  id: string;
  type: "image";
  path: string;
  width: number;
  height: number;
  scale: number;
  sourceNodeId: string;
}

interface ExportedFile {
  path: string;
  bytes: Uint8Array;
}

interface ExportProgress {
  totalImages: number;
  exportedImages: number;
  stage: string;
}

interface ExportContext {
  assets: ExportedAsset[];
  warnings: ExportWarning[];
  usedPaths: Set<string>;
  progress: ExportProgress;
}

interface PreviewItem {
  id: string;
  name: string;
  path: string;
  width: number;
  height: number;
  bytes: Uint8Array;
}

interface ExportWarning {
  nodeId: string;
  nodeName: string;
  message: string;
}

interface SceneNodeJson {
  id: string;
  name: string;
  type: "container" | "sprite" | "label" | "color" | "image";
  figmaType: string;
  position: PointLike;
  size: {
    width: number;
    height: number;
  };
  anchor: PointLike;
  visible: boolean;
  opacity: number;
  clipContent?: boolean;
  image?: string;
  backgroundImage?: string;
  color?: string;
  text?: {
    content: string;
    fontSize: number;
    fontFamily: string;
    figmaFontFamily?: string;
    figmaFontStyle?: string;
    color: string;
    align: "left" | "center" | "right" | "justified";
    verticalAlign: "top" | "middle" | "bottom";
    alignment: {
      horizontal: "left" | "center" | "right" | "justified";
      vertical: "top" | "middle" | "bottom";
      figmaHorizontal: TextNode["textAlignHorizontal"];
      figmaVertical: TextNode["textAlignVertical"];
      cocosHorizontal: "LEFT" | "CENTER" | "RIGHT";
      cocosVertical: "TOP" | "CENTER" | "BOTTOM";
    };
    lineHeight?: number;
    stroke?: {
      color: string;
      width: number;
    };
    shadow?: {
      color: string;
      offset: { x: number; y: number };
      blur: number;
    };
  };
  effects?: {
    shadow?: EffectPolicy;
    blur?: EffectPolicy;
    blendMode?: EffectPolicy;
  };
  children?: SceneNodeJson[];
}

interface SceneJson {
  schemaVersion: string;
  name: string;
  source: {
    tool: "figma";
    pageName: string;
    rootNodeId: string;
    selectedNodeIds: string[];
  };
  settings: {
    coordinateSystem: "cocos";
    anchor: PointLike;
    origin: "parent-center";
    imageScale: number;
    fontMode: FontMode;
    effects: ExportOptions["effects"];
  };
  canvas: {
    width: number;
    height: number;
  };
  nodes: SceneNodeJson[];
  assets: ExportedAsset[];
  warnings: ExportWarning[];
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeHiddenLayers: false,
  imageScale: 2,
  fontMode: "system",
  effects: {
    shadow: "rasterize",
    blur: "rasterize",
    blendMode: "discard",
  },
};

const MAX_EXPORT_SIDE = 4096;
const MAX_PREVIEW_ITEMS = 30;

figma.showUI(__html__, { width: 420, height: 700, themeColors: true });
sendSelectionSummary();

figma.on("selectionchange", sendSelectionSummary);

figma.ui.onmessage = async (message) => {
  if (message.type === "preview") {
    try {
      const options = normalizeOptions(message.options);
      const items = await buildImagePreview(options);
      figma.ui.postMessage({
        type: "preview-ready",
        requestId: message.requestId,
        items,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      figma.ui.postMessage({
        type: "preview-error",
        requestId: message.requestId,
        message: messageText,
      });
    }
    return;
  }

  if (message.type !== "export") {
    return;
  }

  try {
    const options = normalizeOptions(message.options);
    const progress = createExportProgress();
    await waitForUiPaint();
    const result = await exportCurrentSelection(options, progress);
    figma.ui.postMessage({ type: "export-ready", payload: result });
    figma.notify("Figma Cocos zip 已准备好。");
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({ type: "export-error", message: messageText });
    figma.notify(messageText, { error: true });
  }
};

function sendSelectionSummary() {
  const selected = figma.currentPage.selection;
  figma.ui.postMessage({
    type: "selection",
    count: selected.length,
    names: selected.map((node) => node.name),
  });
}

function normalizeOptions(value: Partial<ExportOptions> | undefined): ExportOptions {
  return {
    includeHiddenLayers: Boolean(value && value.includeHiddenLayers),
    imageScale: clampNumber(value && value.imageScale, 1, 4, DEFAULT_OPTIONS.imageScale),
    fontMode: value && value.fontMode === "figma" ? "figma" : "system",
    effects: {
      shadow: normalizePolicy(value && value.effects && value.effects.shadow, DEFAULT_OPTIONS.effects.shadow),
      blur: normalizePolicy(value && value.effects && value.effects.blur, DEFAULT_OPTIONS.effects.blur),
      blendMode: normalizePolicy(value && value.effects && value.effects.blendMode, DEFAULT_OPTIONS.effects.blendMode),
    },
  };
}

function normalizePolicy(value: unknown, fallback: EffectPolicy): EffectPolicy {
  return value === "discard" || value === "rasterize" ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

async function exportCurrentSelection(options: ExportOptions, progress: ExportProgress) {
  const roots = figma.currentPage.selection.filter((node) => canReadBounds(node));

  if (roots.length === 0) {
    throw new Error("请先选择至少一个可见图层或 Frame。");
  }

  updateExportProgress(progress, "分析选区", 4);
  progress.totalImages = countExportImages(roots, options);
  updateExportProgress(progress, "准备导出图片", 8);

  const canvasBounds = unionBounds(roots.map((node) => node.absoluteBoundingBox as RectLike));
  const context: ExportContext = {
    assets: [],
    warnings: [],
    usedPaths: new Set<string>(),
    progress,
  };
  const rootName = roots.length === 1 ? roots[0].name : figma.currentPage.name || "选择内容";

  const nodes: SceneNodeJson[] = [];
  for (const root of roots) {
    const parsed = await parseNode(root, canvasBounds, options, context, true);
    if (parsed) {
      nodes.push(parsed);
    }
  }

  updateExportProgress(progress, "生成 scene.json", 92);
  const scene: SceneJson = {
    schemaVersion: "1.0.0",
    name: sanitizeName(rootName),
    source: {
      tool: "figma",
      pageName: figma.currentPage.name,
      rootNodeId: roots.length === 1 ? roots[0].id : "selection",
      selectedNodeIds: roots.map((node) => node.id),
    },
    settings: {
      coordinateSystem: "cocos",
      anchor: { x: 0.5, y: 0.5 },
      origin: "parent-center",
      imageScale: options.imageScale,
      fontMode: options.fontMode,
      effects: options.effects,
    },
    canvas: {
      width: round(canvasBounds.width),
      height: round(canvasBounds.height),
    },
    nodes,
    assets: context.assets,
    warnings: context.warnings,
  };

  const sceneFile: ExportedFile = {
    path: "scene.json",
    bytes: Uint8Array.from(stringToUtf8Bytes(JSON.stringify(scene, null, 2))),
  };

  updateExportProgress(progress, "准备打包 zip", 96);

  return {
    fileName: `${sanitizeName(rootName)}.figma2cocos.zip`,
    scene,
    sceneFile,
  };
}

function createExportProgress(): ExportProgress {
  const progress: ExportProgress = {
    totalImages: 0,
    exportedImages: 0,
    stage: "准备导出",
  };
  updateExportProgress(progress, progress.stage, 1);
  return progress;
}

function waitForUiPaint() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 30);
  });
}

function yieldToRuntime() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function updateExportProgress(progress: ExportProgress, stage: string, percent?: number) {
  progress.stage = stage;
  figma.ui.postMessage({
    type: "export-progress",
    stage,
    percent: percent === undefined ? getImageExportPercent(progress) : percent,
    exportedImages: progress.exportedImages,
    totalImages: progress.totalImages,
  });
}

function postExportFile(file: ExportedFile) {
  figma.ui.postMessage({
    type: "export-file",
    file,
  });
}

function advanceImageProgress(progress: ExportProgress, stage: string) {
  progress.exportedImages += 1;
  updateExportProgress(progress, stage);
}

function getImageExportPercent(progress: ExportProgress) {
  if (progress.totalImages <= 0) {
    return 90;
  }

  return Math.min(90, Math.round(10 + (progress.exportedImages / progress.totalImages) * 80));
}

function countExportImages(nodes: readonly SceneNode[], options: ExportOptions) {
  let count = 0;

  for (const node of nodes) {
    count += countNodeExportImages(node, options);
  }

  return count;
}

function countNodeExportImages(node: SceneNode, options: ExportOptions): number {
  if (!options.includeHiddenLayers && node.visible === false) {
    return 0;
  }

  if (!canReadBounds(node)) {
    return 0;
  }

  const effects = getEffectDecision(node, options);
  const shouldRasterize = Object.keys(effects).some((key) => effects[key as keyof typeof effects] === "rasterize");
  const hasChildren = "children" in node && node.children.length > 0;
  const type = classifyNode(node, hasChildren, shouldRasterize);
  let count = 0;

  if (type === "container" && shouldRasterizeOwnAppearance(node, effects)) {
    count += 1;
  }

  if (type === "sprite" || type === "image") {
    return count + 1;
  }

  if (hasChildren && type === "container" && "children" in node) {
    for (const child of node.children) {
      count += countNodeExportImages(child, options);
    }
  }

  return count;
}

async function buildImagePreview(options: ExportOptions): Promise<PreviewItem[]> {
  const roots = figma.currentPage.selection.filter((node) => canReadBounds(node));
  const items: PreviewItem[] = [];
  const usedPaths = new Set<string>();

  for (const root of roots) {
    if (items.length >= MAX_PREVIEW_ITEMS) {
      break;
    }
    await collectPreviewItems(root, options, items, usedPaths);
  }

  return items;
}

async function collectPreviewItems(
  node: SceneNode,
  options: ExportOptions,
  items: PreviewItem[],
  usedPaths: Set<string>
) {
  if (items.length >= MAX_PREVIEW_ITEMS) {
    return;
  }

  if (!options.includeHiddenLayers && node.visible === false) {
    return;
  }

  if (!canReadBounds(node)) {
    return;
  }

  const bounds = node.absoluteBoundingBox as RectLike;
  const effects = getEffectDecision(node, options);
  const shouldRasterize = Object.keys(effects).some((key) => effects[key as keyof typeof effects] === "rasterize");
  const hasChildren = "children" in node && node.children.length > 0;
  const type = classifyNode(node, hasChildren, shouldRasterize);
  const shouldExportBackground = type === "container" && shouldRasterizeOwnAppearance(node, effects);

  if (shouldExportBackground) {
    items.push(await exportNodeBackgroundPreview(node, bounds, usedPaths));
    if (items.length >= MAX_PREVIEW_ITEMS) {
      return;
    }
  }

  if (type === "sprite" || type === "image") {
    items.push(await exportNodePreview(node, bounds, usedPaths));
    return;
  }

  if (hasChildren && type === "container" && "children" in node) {
    for (const child of node.children) {
      await collectPreviewItems(child, options, items, usedPaths);
    }
  }
}

async function parseNode(
  node: SceneNode,
  parentBounds: RectLike,
  options: ExportOptions,
  context: ExportContext,
  isRoot: boolean,
): Promise<SceneNodeJson | null> {
  if (!options.includeHiddenLayers && node.visible === false) {
    return null;
  }

  if (!canReadBounds(node)) {
    context.warnings.push({
      nodeId: node.id,
      nodeName: node.name,
      message: "该节点没有可读取的尺寸，已跳过。",
    });
    return null;
  }

  const bounds = node.absoluteBoundingBox as RectLike;
  const effects = getEffectDecision(node, options);
  const shouldRasterize = Object.keys(effects).some((key) => effects[key as keyof typeof effects] === "rasterize");
  const hasChildren = "children" in node && node.children.length > 0;
  const type = classifyNode(node, hasChildren, shouldRasterize);
  const shouldExportBackground = type === "container" && shouldRasterizeOwnAppearance(node, effects);
  const clipsContent = getClipsContent(node);
  const json: SceneNodeJson = {
    id: node.id,
    name: node.name,
    type,
    figmaType: node.type,
    position: isRoot ? { x: 0, y: 0 } : toCocosPosition(bounds, parentBounds),
    size: {
      width: round(bounds.width),
      height: round(bounds.height),
    },
    anchor: { x: 0.5, y: 0.5 },
    visible: node.visible !== false,
    opacity: round("opacity" in node ? node.opacity : 1),
  };

  if (clipsContent) {
    json.clipContent = true;
  }

  if (Object.keys(effects).length > 0) {
    json.effects = effects;
    for (const key in effects) {
      context.warnings.push({
        nodeId: node.id,
        nodeName: node.name,
        message: `${formatEffectName(key)}已${formatEffectPolicy(effects[key as keyof typeof effects])}。`,
      });
    }
  }

  if (type === "label" && node.type === "TEXT") {
    json.text = parseTextNode(node, options);
  } else if (type === "color") {
    json.color = getSolidFillColor(node) || "#ffffff";
  } else if (type === "sprite" || type === "image") {
    const asset = await exportNodeImage(node, bounds, options, context.usedPaths);
    json.image = asset.path;
    context.assets.push(asset);
    postExportFile(asset.file);
    advanceImageProgress(context.progress, `导出图片：${node.name}`);
    await yieldToRuntime();
  }

  if (shouldExportBackground) {
    const asset = await exportNodeBackgroundImage(node, bounds, options, context.usedPaths);
    json.backgroundImage = asset.path;
    context.assets.push(asset);
    postExportFile(asset.file);
    advanceImageProgress(context.progress, `导出背景：${node.name}`);
    await yieldToRuntime();
    context.warnings.push({
      nodeId: node.id,
      nodeName: node.name,
      message: "Frame 自身外观已栅格化为背景图，子节点保持独立导出。",
    });
  }

  if (hasChildren && type === "container" && "children" in node) {
    const children: SceneNodeJson[] = [];
    for (const child of node.children) {
      const parsed = await parseNode(child, bounds, options, context, false);
      if (parsed) {
        children.push(parsed);
      }
    }

    if (children.length > 0) {
      json.children = children;
    }
  } else if (hasChildren && shouldRasterize) {
    context.warnings.push({
      nodeId: node.id,
      nodeName: node.name,
      message: "子节点已包含在父节点栅格化图片中。",
    });
  }

  return json;
}

function classifyNode(node: SceneNode, hasChildren: boolean, shouldRasterize: boolean): SceneNodeJson["type"] {
  if (hasChildren && isFrameLikeNode(node)) {
    return "container";
  }

  // TEXT 节点永远不栅格化，即使有 stroke、fill、effects
  if (node.type === "TEXT") {
    return "label";
  }

  if (shouldRasterize) {
    return "image";
  }

  if (hasChildren) {
    return "container";
  }

  if (isSimpleSolidRect(node)) {
    return "color";
  }

  return "sprite";
}

function canReadBounds(node: SceneNode): node is SceneNode & { absoluteBoundingBox: RectLike } {
  return "absoluteBoundingBox" in node && !!node.absoluteBoundingBox && node.absoluteBoundingBox.width > 0 && node.absoluteBoundingBox.height > 0;
}

function toCocosPosition(bounds: RectLike, parentBounds: RectLike): PointLike {
  const nodeCenterX = bounds.x + bounds.width / 2;
  const nodeCenterY = bounds.y + bounds.height / 2;
  const parentCenterX = parentBounds.x + parentBounds.width / 2;
  const parentCenterY = parentBounds.y + parentBounds.height / 2;

  return {
    x: round(nodeCenterX - parentCenterX),
    y: round(parentCenterY - nodeCenterY),
  };
}

function unionBounds(boundsList: RectLike[]): RectLike {
  const left = Math.min.apply(null, boundsList.map((bounds) => bounds.x));
  const top = Math.min.apply(null, boundsList.map((bounds) => bounds.y));
  const right = Math.max.apply(null, boundsList.map((bounds) => bounds.x + bounds.width));
  const bottom = Math.max.apply(null, boundsList.map((bounds) => bounds.y + bounds.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function parseTextNode(node: TextNode, options: ExportOptions): NonNullable<SceneNodeJson["text"]> {
  const figmaFont = typeof node.fontName === "symbol" ? undefined : node.fontName;
  const solidColor = getSolidFillColor(node) || "#000000";

  const textData: NonNullable<SceneNodeJson["text"]> = {
    content: node.characters,
    fontSize: typeof node.fontSize === "number" ? round(node.fontSize) : 14,
    fontFamily: options.fontMode === "figma" && figmaFont ? figmaFont.family : "system",
    figmaFontFamily: figmaFont ? figmaFont.family : undefined,
    figmaFontStyle: figmaFont ? figmaFont.style : undefined,
    color: solidColor,
    align: mapHorizontalAlign(node.textAlignHorizontal),
    verticalAlign: mapVerticalAlign(node.textAlignVertical),
    alignment: {
      horizontal: mapHorizontalAlign(node.textAlignHorizontal),
      vertical: mapVerticalAlign(node.textAlignVertical),
      figmaHorizontal: node.textAlignHorizontal,
      figmaVertical: node.textAlignVertical,
      cocosHorizontal: mapCocosHorizontalAlign(node.textAlignHorizontal),
      cocosVertical: mapCocosVerticalAlign(node.textAlignVertical),
    },
    lineHeight: typeof node.lineHeight === "object" && node.lineHeight.unit === "PIXELS" ? round(node.lineHeight.value) : undefined,
  };

  // 提取 stroke 数据
  const strokeData = extractTextStroke(node);
  if (strokeData) {
    textData.stroke = strokeData;
  }

  // 提取 shadow 数据（仅阴影有效）
  const shadowData = extractTextShadow(node);
  if (shadowData) {
    textData.shadow = shadowData;
  }

  return textData;
}

function mapHorizontalAlign(value: TextNode["textAlignHorizontal"]): "left" | "center" | "right" | "justified" {
  if (value === "CENTER") {
    return "center";
  }
  if (value === "RIGHT") {
    return "right";
  }
  if (value === "JUSTIFIED") {
    return "justified";
  }
  return "left";
}

function mapVerticalAlign(value: TextNode["textAlignVertical"]): "top" | "middle" | "bottom" {
  if (value === "CENTER") {
    return "middle";
  }
  if (value === "BOTTOM") {
    return "bottom";
  }
  return "top";
}

function mapCocosHorizontalAlign(value: TextNode["textAlignHorizontal"]): "LEFT" | "CENTER" | "RIGHT" {
  if (value === "CENTER") {
    return "CENTER";
  }
  if (value === "RIGHT") {
    return "RIGHT";
  }
  return "LEFT";
}

function mapCocosVerticalAlign(value: TextNode["textAlignVertical"]): "TOP" | "CENTER" | "BOTTOM" {
  if (value === "CENTER") {
    return "CENTER";
  }
  if (value === "BOTTOM") {
    return "BOTTOM";
  }
  return "TOP";
}

function extractTextStroke(node: TextNode): { color: string; width: number } | undefined {
  if (!node.strokes || node.strokes.length === 0) {
    return undefined;
  }

  // 只提取第一个可见的描边
  const stroke = node.strokes.find((s) => s.visible !== false);
  if (!stroke || stroke.type !== "SOLID") {
    return undefined;
  }

  const strokeWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
  if (strokeWeight <= 0) {
    return undefined;
  }

  return {
    color: rgbaToHex(stroke.color, stroke.opacity),
    width: round(strokeWeight),
  };
}

function extractTextShadow(node: TextNode): { color: string; offset: { x: number; y: number }; blur: number } | undefined {
  if (!node.effects || node.effects.length === 0) {
    return undefined;
  }

  // 只提取第一个可见的阴影效果（DROP_SHADOW 或 INNER_SHADOW）
  const shadow = node.effects.find(
    (e) => e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
  );

  if (!shadow || (shadow.type !== "DROP_SHADOW" && shadow.type !== "INNER_SHADOW")) {
    return undefined;
  }

  return {
    color: rgbaToHex(shadow.color, shadow.color.a),
    offset: {
      x: round(shadow.offset.x),
      y: round(shadow.offset.y),
    },
    blur: round(shadow.radius),
  };
}

function getEffectDecision(node: SceneNode, options: ExportOptions): Partial<ExportOptions["effects"]> {
  const result: Partial<ExportOptions["effects"]> = {};

  // TEXT 节点的 stroke、fill、shadow 不应触发栅格化，因为这些效果会被导出为数据
  if (node.type === "TEXT") {
    // 只检查 TEXT 不支持的效果（blur、blendMode）
    if ("effects" in node) {
      for (const effect of node.effects) {
        if (effect.visible === false) {
          continue;
        }

        // TEXT 支持 shadow，不标记为需要栅格化
        if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
          continue;
        }

        // TEXT 不支持 blur，标记为需要栅格化
        if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
          result.blur = options.effects.blur;
        }
      }
    }

    if ("blendMode" in node && node.blendMode !== "NORMAL" && node.blendMode !== "PASS_THROUGH") {
      result.blendMode = options.effects.blendMode;
    }

    return result;
  }

  // 非 TEXT 节点的原有逻辑
  if ("effects" in node) {
    for (const effect of node.effects) {
      if (effect.visible === false) {
        continue;
      }

      if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
        result.shadow = options.effects.shadow;
      }

      if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
        result.blur = options.effects.blur;
      }
    }
  }

  if ("blendMode" in node && node.blendMode !== "NORMAL" && node.blendMode !== "PASS_THROUGH") {
    result.blendMode = options.effects.blendMode;
  }

  return result;
}

function isFrameLikeNode(node: SceneNode) {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function getClipsContent(node: SceneNode) {
  return "clipsContent" in node && node.clipsContent === true;
}

function shouldRasterizeOwnAppearance(node: SceneNode, effects: Partial<ExportOptions["effects"]>) {
  if (!isFrameLikeNode(node)) {
    return false;
  }

  return hasVisibleFill(node) || hasVisibleStroke(node) || Object.keys(effects).some((key) => effects[key as keyof typeof effects] === "rasterize");
}

function hasVisibleFill(node: SceneNode) {
  return "fills" in node && Array.isArray(node.fills) && node.fills.some((paint) => paint.visible !== false);
}

function hasVisibleStroke(node: SceneNode) {
  return "strokes" in node && Array.isArray(node.strokes) && node.strokes.some((paint) => paint.visible !== false);
}

function isSimpleSolidRect(node: SceneNode) {
  return node.type === "RECTANGLE" && hasSingleSolidFill(node) && (!("strokes" in node) || node.strokes.length === 0);
}

function hasSingleSolidFill(node: SceneNode) {
  return "fills" in node && Array.isArray(node.fills) && node.fills.length === 1 && node.fills[0].type === "SOLID";
}

function getSolidFillColor(node: SceneNode) {
  if (!hasSingleSolidFill(node) || !("fills" in node) || !Array.isArray(node.fills)) {
    return undefined;
  }

  const paint = node.fills[0] as SolidPaint;
  const opacity = paint.opacity === undefined ? 1 : paint.opacity;
  return rgbaToCss(paint.color.r, paint.color.g, paint.color.b, opacity);
}

async function exportNodeImage(
  node: SceneNode,
  bounds: RectLike,
  options: ExportOptions,
  usedPaths: Set<string>
): Promise<ExportedAsset & { file: ExportedFile }> {
  const maybeExportable = node as SceneNode & Partial<ExportMixin>;
  if (typeof maybeExportable.exportAsync !== "function") {
    throw new Error(`节点“${node.name}”无法导出为图片。`);
  }

  const constraint = getSafeExportConstraint(bounds, options.imageScale);
  const bytes = await maybeExportable.exportAsync({
    format: "PNG" as ExportFormat,
    constraint,
  });
  const path = makeUniquePath(`images/${sanitizeName(node.name)}.png`, usedPaths);
  const outputSize = getConstrainedSize(bounds, constraint);

  return {
    id: `asset_${sanitizeId(node.id)}`,
    type: "image",
    path,
    width: outputSize.width,
    height: outputSize.height,
    scale: outputSize.scale,
    sourceNodeId: node.id,
    file: {
      path,
      bytes,
    },
  };
}

async function exportNodeBackgroundImage(
  node: SceneNode,
  bounds: RectLike,
  options: ExportOptions,
  usedPaths: Set<string>
): Promise<ExportedAsset & { file: ExportedFile }> {
  const constraint = getSafeExportConstraint(bounds, options.imageScale);
  const bytes = await exportNodeOwnAppearance(node, constraint);
  const path = makeUniquePath(`images/${sanitizeName(node.name)}_background.png`, usedPaths);
  const outputSize = getConstrainedSize(bounds, constraint);

  return {
    id: `asset_${sanitizeId(node.id)}_background`,
    type: "image",
    path,
    width: outputSize.width,
    height: outputSize.height,
    scale: outputSize.scale,
    sourceNodeId: node.id,
    file: {
      path,
      bytes,
    },
  };
}

async function exportNodeBackgroundPreview(node: SceneNode, bounds: RectLike, usedPaths: Set<string>): Promise<PreviewItem> {
  const longestSide = Math.max(bounds.width, bounds.height);
  const constraint = bounds.width >= bounds.height
    ? { type: "WIDTH" as const, value: Math.max(1, Math.min(80, Math.round(bounds.width))) }
    : { type: "HEIGHT" as const, value: Math.max(1, Math.min(80, Math.round(bounds.height))) };
  const bytes = await exportNodeOwnAppearance(node, longestSide > 0 ? constraint : { type: "SCALE", value: 1 });
  const path = makeUniquePath(`images/${sanitizeName(node.name)}_background.png`, usedPaths);

  return {
    id: `${node.id}_background`,
    name: `${node.name} 背景`,
    path,
    width: round(bounds.width),
    height: round(bounds.height),
    bytes,
  };
}

async function exportNodeOwnAppearance(
  node: SceneNode,
  constraint: ExportSettingsConstraints
): Promise<Uint8Array> {
  const maybeCloneable = node as SceneNode & Partial<BaseNodeMixin>;

  if (typeof maybeCloneable.clone !== "function") {
    throw new Error(`节点“${node.name}”无法克隆用于背景导出。`);
  }

  const clone = maybeCloneable.clone() as SceneNode & Partial<ChildrenMixin> & Partial<ExportMixin>;

  try {
    if ("children" in clone) {
      for (const child of clone.children) {
        child.visible = false;
      }
    }

    if (typeof clone.exportAsync !== "function") {
      throw new Error(`节点“${node.name}”无法导出自身外观。`);
    }

    return await clone.exportAsync({
      format: "PNG" as ExportFormat,
      constraint,
    });
  } finally {
    clone.remove();
  }
}

async function exportNodePreview(node: SceneNode, bounds: RectLike, usedPaths: Set<string>): Promise<PreviewItem> {
  const maybeExportable = node as SceneNode & Partial<ExportMixin>;
  if (typeof maybeExportable.exportAsync !== "function") {
    throw new Error(`节点“${node.name}”无法导出为图片预览。`);
  }

  const longestSide = Math.max(bounds.width, bounds.height);
  const constraint = bounds.width >= bounds.height
    ? { type: "WIDTH" as const, value: Math.max(1, Math.min(80, Math.round(bounds.width))) }
    : { type: "HEIGHT" as const, value: Math.max(1, Math.min(80, Math.round(bounds.height))) };
  const bytes = await maybeExportable.exportAsync({
    format: "PNG" as ExportFormat,
    constraint: longestSide > 0 ? constraint : { type: "SCALE", value: 1 },
  });
  const path = makeUniquePath(`images/${sanitizeName(node.name)}.png`, usedPaths);

  return {
    id: node.id,
    name: node.name,
    path,
    width: round(bounds.width),
    height: round(bounds.height),
    bytes,
  };
}

function getSafeExportConstraint(bounds: RectLike, requestedScale: number): ExportSettingsConstraints {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const requestedWidth = width * requestedScale;
  const requestedHeight = height * requestedScale;

  if (requestedWidth <= MAX_EXPORT_SIDE && requestedHeight <= MAX_EXPORT_SIDE) {
    return {
      type: "SCALE",
      value: requestedScale,
    };
  }

  if (width >= height) {
    return {
      type: "WIDTH",
      value: MAX_EXPORT_SIDE,
    };
  }

  return {
    type: "HEIGHT",
    value: MAX_EXPORT_SIDE,
  };
}

function getConstrainedSize(bounds: RectLike, constraint: ExportSettingsConstraints) {
  if (constraint.type === "SCALE") {
    return {
      width: Math.round(bounds.width * constraint.value),
      height: Math.round(bounds.height * constraint.value),
      scale: constraint.value,
    };
  }

  if (constraint.type === "WIDTH") {
    const scale = constraint.value / Math.max(1, bounds.width);
    return {
      width: Math.round(constraint.value),
      height: Math.round(bounds.height * scale),
      scale: round(scale),
    };
  }

  const scale = constraint.value / Math.max(1, bounds.height);
  return {
    width: Math.round(bounds.width * scale),
    height: Math.round(constraint.value),
    scale: round(scale),
  };
}

function makeUniquePath(basePath: string, usedPaths: Set<string>) {
  if (!usedPaths.has(basePath)) {
    usedPaths.add(basePath);
    return basePath;
  }

  const dotIndex = basePath.lastIndexOf(".");
  const prefix = dotIndex === -1 ? basePath : basePath.slice(0, dotIndex);
  const suffix = dotIndex === -1 ? "" : basePath.slice(dotIndex);
  let index = 2;
  let candidate = `${prefix}_${index}${suffix}`;

  while (usedPaths.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}${suffix}`;
  }

  usedPaths.add(candidate);
  return candidate;
}

function sanitizeName(value: string) {
  const result = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");

  return result || "figma_export";
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function formatEffectName(value: string) {
  if (value === "shadow") {
    return "阴影";
  }
  if (value === "blur") {
    return "模糊";
  }
  if (value === "blendMode") {
    return "混合模式";
  }
  return value;
}

function formatEffectPolicy(value: EffectPolicy | undefined) {
  return value === "rasterize" ? "栅格化" : "丢弃";
}

function rgbaToCss(r: number, g: number, b: number, a: number) {
  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(b * 255);

  if (a >= 1) {
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${round(a)})`;
}

function rgbaToHex(color: RGB, opacity?: number) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = opacity !== undefined ? opacity : 1;

  if (a >= 1) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(a * 255))}`;
}

function toHex(value: number) {
  const hex = value.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function stringToUtf8Bytes(value: string) {
  const bytes: number[] = [];

  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.charCodeAt(i);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return bytes;
}
