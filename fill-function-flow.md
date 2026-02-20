# fill 函数放置方块完整流程

## 概述

`fill` 函数用于在指定的三维区域内批量放置方块。本文档详细说明了从函数调用到方块渲染的完整流程。

## 函数签名

```javascript
fill(blockStr, x1, y1, z1, x2, y2, z2)
```

**参数说明：**
- `blockStr`: 方块字符串，格式如 `"minecraft:grass_block,snowy=false"`
- `x1, y1, z1`: 区域起始坐标
- `x2, y2, z2`: 区域结束坐标

## 完整流程图

```
fill() 调用
    │
    ├─> 1. 解析方块字符串 (parseBlockStr)
    │       │
    │       └─> 提取 blockName 和 props
    │
    ├─> 2. 计算坐标范围
    │       │
    │       └─> 确保坐标从小到大排序
    │
    ├─> 3. 加载纹理 (getFaceTextures)
    │       │
    │       ├─> 3.1 解析方块状态 (parseBlockStates)
    │       │       │
    │       │       └─> 提取 blockName 和 states 对象
    │       │
    │       ├─> 3.2 获取模型 (getModelForStates)
    │       │       │
    │       │       ├─> 查找方块状态定义
    │       │       ├─> 构建状态键 (buildStateKey)
    │       │       ├─> 匹配变体
    │       │       └─> 返回模型ID
    │       │
    │       └─> 3.3 加载所有面纹理 (loadAllFaceTextures)
    │               │
    │               ├─> 获取模型的面纹理引用
    │               ├─> 为每个面加载纹理
    │               └─> 处理 overlay 纹理
    │
    ├─> 4. 创建 Three.js 材质数组
    │       │
    │       └─> 为6个面分别创建材质
    │
    ├─> 5. 遍历坐标范围创建方块
    │       │
    │       ├─> 移除已存在的方块 (removeblock)
    │       ├─> 创建 Mesh 对象
    │       ├─> 设置位置和名称
    │       └─> 处理 overlay 纹理（如有）
    │
    └─> 6. 添加到场景并渲染
```

## 详细步骤说明

### 步骤 1: 解析方块字符串

**位置：** [command.js:139-152](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L139-L152)

```javascript
function parseBlockStr(blockStr) {
  const parts = blockStr.split(',');
  const blockName = parts[0];
  const props = parts[1]?.split('|') || null;
  return { blockName, props };
}
```

**示例：**
- 输入：`"minecraft:grass_block,snowy=false"`
- 输出：`{ blockName: "minecraft:grass_block", props: ["snowy=false"] }`

### 步骤 2: 计算坐标范围

**位置：** [command.js:251-256](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L251-L256)

```javascript
const minX = Math.min(x1, x2);
const maxX = Math.max(x1, x2);
const minY = Math.min(y1, y2);
const maxY = Math.max(y1, y2);
const minZ = Math.min(z1, z2);
const maxZ = Math.max(z1, z2);
```

**目的：** 确保坐标范围正确，无论用户输入的顺序如何。

### 步骤 3: 加载纹理

#### 3.1 解析方块状态

**位置：** [vanilla.js:1123-1182](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/vanilla.js#L1123-L1182)

```javascript
parseBlockStates(blockWithStates) {
  const parts = blockWithStates.split(',');
  const blockName = parts[0];
  const states = {};
  
  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split('=');
    if (key && value) {
      states[key.trim()] = value.trim();
    }
  }
  
  return { blockName, states };
}
```

**示例：**
- 输入：`"minecraft:grass_block,snowy=false"`
- 输出：`{ blockName: "minecraft:grass_block", states: { snowy: "false" } }`

#### 3.2 获取模型

**位置：** [vanilla.js:1187-1266](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/vanilla.js#L1187-L1266)

```javascript
getModelForStates(blockName, states = {}) {
  // 去除 minecraft: 前缀
  blockName = blockName.replace('minecraft:', '');
  
  // 获取方块状态定义
  const blockState = this.blockStatesData[blockName];
  const variants = blockState.variants;
  
  // 构建状态键
  const stateKey = this.buildStateKey(states);
  
  // 查找匹配的变体
  let variant = variants[stateKey];
  
  // 如果没有找到，尝试默认变体
  if (!variant && variants[""]) {
    variant = variants[""];
  }
  
  return variant;
}
```

**状态键构建：**
- 输入：`{ snowy: "false" }`
- 输出：`"snowy=false"`

**变体匹配：**
在 `grass_block` 的方块状态文件中查找：
```json
{
  "variants": {
    "snowy=false": { "model": "minecraft:block/grass_block" },
    "snowy=true": { "model": "minecraft:block/grass_block_snow" }
  }
}
```

#### 3.3 加载所有面纹理

**位置：** [vanilla.js:1325-1404](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/vanilla.js#L1325-L1404)

```javascript
loadAllFaceTextures(block, variant = null) {
  const { blockName, states } = mcBlockStateLoader.parseBlockStates(block);
  
  // 从状态获取模型ID
  let modelId = blockName;
  if (Object.keys(states).length > 0) {
    const stateModel = mcBlockStateLoader.getModelForStates(blockName, states);
    if (stateModel && stateModel.model) {
      modelId = stateModel.model;
    }
  }
  
  // 获取模型的面纹理引用
  const faceTextureRefs = mcModelLoader.getAllFaceTextures(modelId);
  
  // 为每个面加载纹理
  const faceTextures = {
    down: null,   // 底面
    up: null,     // 顶面
    north: null,  // 北面
    south: null,  // 南面
    west: null,   // 西面
    east: null    // 东面
  };
  
  for (const [face, textureRef] of Object.entries(faceTextureRefs)) {
    if (textureRef) {
      const texturePath = this.resolveTexturePath(textureRef);
      faceTextures[face] = this.loadTexture(texturePath);
    }
  }
  
  return faceTextures;
}
```

**返回值：**
```javascript
{
  down: THREE.Texture,   // 泥土纹理
  up: THREE.Texture,     // 草方块顶部纹理
  north: THREE.Texture,  // 草方块侧面纹理
  south: THREE.Texture,  // 草方块侧面纹理
  west: THREE.Texture,   // 草方块侧面纹理
  east: THREE.Texture    // 草方块侧面纹理
}
```

### 步骤 4: 创建 Three.js 材质数组

**位置：** [command.js:268-273](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L268-L273)

```javascript
// Three.js BoxGeometry 的面顺序：右、左、顶、底、前、后
// 对应我们的纹理顺序：东、西、顶、底、北、南
const threejsMaterials = [
  textures[5], // 右面 -> 东面
  textures[4], // 左面 -> 西面
  textures[1], // 顶面
  textures[0], // 底面
  textures[2], // 前面 -> 北面
  textures[3]  // 后面 -> 南面
];
```

**材质创建：** [command.js:285-305](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L285-L305)

```javascript
const materials = threejsMaterials.map((texture, index) => {
  const materialOptions = {
    transparent: true,
    opacity: 1,
    color: 0xffffff
  };
  
  if (texture) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    materialOptions.map = texture;
  } else {
    materialOptions.color = new THREE.Color(0xff0000);
  }
  
  return new THREE.MeshBasicMaterial({
    ...materialOptions,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide
  });
});
```

### 步骤 5: 遍历坐标范围创建方块

**位置：** [command.js:277-365](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L277-L365)

```javascript
for(let x = minX; x <= maxX; x++){
  for(let y = minY; y <= maxY; y++){
    for(let z = minZ; z <= maxZ; z++){
      // 移除已存在的方块
      removeblock(x, y, z);
      
      // 创建 Mesh 对象
      const geometry = getReusableBoxGeometry();
      const blockObj = new THREE.Mesh(geometry, materials);
      blockObj.position.set(x, y, z);
      blockObj.name = block;
      
      // 处理 overlay 纹理（如有）
      if (overlayTextures && overlayTextures.some(t => t !== null)) {
        // 创建 overlay 几何体和材质
        const overlayGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterials);
        overlayMesh.position.copy(blockObj.position);
        blockObj.add(overlayMesh);
      }
      
      blocksToAdd.push(blockObj);
    }
  }
}
```

### 步骤 6: 添加到场景并渲染

**位置：** [command.js:367-376](file:///d:/Web%20project/MC-Panorama/ponder/engine/domdkw/v1/command.js#L367-L376)

```javascript
// 批量添加到场景
blocksToAdd.forEach(blockObj => {
  scene.add(blockObj);
});

// 延迟渲染
requestAnimationFrame(() => {
  renderer.render(scene, camera);
});
```

## 关键文件位置

| 功能 | 文件路径 | 行号 |
|------|----------|------|
| fill 函数 | `ponder/engine/domdkw/v1/command.js` | 246-376 |
| parseBlockStr 函数 | `ponder/engine/domdkw/v1/command.js` | 139-152 |
| parseBlockStates 函数 | `ponder/engine/domdkw/v1/vanilla.js` | 1123-1182 |
| getModelForStates 函数 | `ponder/engine/domdkw/v1/vanilla.js` | 1187-1266 |
| loadAllFaceTextures 函数 | `ponder/engine/domdkw/v1/vanilla.js` | 1325-1404 |
| getFaceTextures 函数 | `ponder/engine/domdkw/v1/vanilla.js` | 1454-1498 |

## 示例

### 调用示例

```javascript
fill('minecraft:grass_block,snowy=false', 3, 0, 0, 3, 0, 0)
```

### 执行过程

1. **解析方块字符串：**
   - `blockName = "minecraft:grass_block"`
   - `props = ["snowy=false"]`

2. **计算坐标范围：**
   - `minX = maxX = 3`
   - `minY = maxY = 0`
   - `minZ = maxZ = 0`
   - 只创建 1 个方块

3. **加载纹理：**
   - 解析状态：`{ snowy: "false" }`
   - 获取模型：`"minecraft:block/grass_block"`
   - 加载面纹理：
     - `down`: 泥土纹理
     - `up`: 草方块顶部纹理
     - `north/south/west/east`: 草方块侧面纹理（无积雪）

4. **创建材质：**
   - 为 6 个面分别创建 `MeshBasicMaterial`

5. **创建方块：**
   - 在位置 `(3, 0, 0)` 创建方块
   - 设置名称为 `"minecraft:grass_block"`

6. **渲染：**
   - 添加到场景
   - 渲染画面

## 注意事项

1. **方块状态解析：** 必须传递完整的方块字符串（包含状态）给 `getFaceTextures`，否则无法正确应用状态。

2. **纹理缓存：** 已加载的纹理会被缓存，避免重复加载。

3. **几何体复用：** 使用 `getReusableBoxGeometry()` 复用几何体，提高性能。

4. **Overlay 纹理：** 某些方块（如草方块）可能有 overlay 纹理，需要单独处理。

5. **坐标顺序：** 坐标参数顺序不重要，函数会自动处理。
