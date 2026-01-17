// ========================================
// Three.js 初始化与渲染设置
// ========================================

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.45;
renderer.domElement.style.zIndex = '10'; // 设置高于背景画布的z-index(mcbackground)
terminal.style.zIndex = '15';

const scene = new THREE.Scene();
scene.background = null; // 设置为null以使用透明背景
renderer.setClearColor(0x000000, 0.5); // 设置半透明黑色清除颜色

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
const geometry = new THREE.BoxGeometry();
camera.position.set(12, 10, 10);
camera.lookAt(0, 0, 0);

document.body.appendChild(renderer.domElement);

// 窗口大小调整事件
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========================================
// 全局变量与状态管理
// ========================================

// 片段切换 !!新，类似于M3U8播放器
let playState = {
  isPlaying: false, //是否正在播放
  isStopped: false, //是否已停止
  currentScene: 0, //场景
  currentFragment: 0, //片段
  autoPlay: false, //是否自动播放（默认关闭，防止自动切换场景）
  slowMode: false, //是否慢速模式
  progress: 0, //当前场景进度
  currentPromise: null // 当前正在执行的Promise，可用于取消
}

// 资源加载相关变量
let loadedTexture = {};
let texturesLoaded = false;

// 场景与片段相关变量
const sceneTotal = window.Process.scenes.length;
let fragmentTotal = 0;
console.log(`场景总数: ${sceneTotal}`);

// 动画与时间控制
let fragmentClock = null; // 延迟初始化
let animationFrameId = null; // 用于存储动画帧ID

// 加载管理器
const LoadingManager = new THREE.LoadingManager();
const TextureLoader = new THREE.TextureLoader(LoadingManager);
const {loadinfo:lmopli, rangeblock:lmoprb} = SNLB('lm-op', true);
lmopli.innerHTML = '<span class="file-tag y">THREE.LoadingManager</span>: 等待启动加载';


// ========================================
// mc管理类
// ========================================

class MCSpriteAtlas {
  constructor() {
    this.atlasData = null;
    this.atlasTexture = null;
    this.textureCache = new Map(); // 缓存已创建的纹理
    this.isLoaded = false;
  }

  // 加载精灵图数据和纹理
  async load(atlasJsonPath, atlasImagePath, loadingManager) {
    try {
      // 创建两个Promise，让JSON数据和纹理可以异步同时加载
      const jsonPromise = loadFile(atlasJsonPath, 'json', true, 'Loading atlasJson ...');
      
      const texturePromise = new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader(loadingManager);
        textureLoader.load(
          atlasImagePath,
          (texture) => {
            // 设置纹理属性以获得更好的渲染效果
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.generateMipmaps = false;
            resolve(texture);
          },
          (progress) => {
            // 移除单独的进度条显示，让LoadingManager统一管理所有资源加载进度
          },
          (error) => {
            console.error('精灵图纹理加载失败:', error);
            reject(error);
          }
        );
      });
      
      // 显示加载进度
      lmopli.innerHTML = `<span class="file-tag mr y">THREE.TextureLoader</span>: 正在加载精灵图纹理 ...`;

      // 等待两个Promise都完成
      const [atlasData, atlasTexture] = await Promise.all([jsonPromise, texturePromise]);
      
      // 保存结果
      this.atlasData = atlasData;
      this.atlasTexture = atlasTexture;
      this.isLoaded = true;
      
      console.log(`精灵图加载成功: ${atlasImagePath}, 包含 ${Object.keys(this.atlasData.frames).length} 个纹理`);
    } catch (error) {
      console.error('精灵图加载失败:', error);
      throw error;
    }
  }

  // 获取指定名称的精灵纹理
  getSpriteTexture(spriteName) {
    if (!this.isLoaded) {
      console.warn('精灵图尚未加载');
      return null;
    }

    // 检查缓存
    if (this.textureCache.has(spriteName)) {
      return this.textureCache.get(spriteName);
    }

    // 获取精灵数据
    const spriteData = this.atlasData.frames[spriteName];
    if (!spriteData) {
      console.warn(`未找到精灵: ${spriteName}`);
      return null;
    }

    // 使用Three.js的纹理克隆和偏移功能
    const { frame } = spriteData;
    const { x, y, w, h } = frame;
    
    // 克隆原始纹理
    const spriteTexture = this.atlasTexture.clone();
    
    // 计算UV偏移和重复
    const atlasWidth = this.atlasData.meta.size.w;
    const atlasHeight = this.atlasData.meta.size.h;
    
    // 设置纹理的重复和偏移，使其只显示精灵图的一部分
    spriteTexture.repeat = new THREE.Vector2(w / atlasWidth, h / atlasHeight);
    spriteTexture.offset = new THREE.Vector2(x / atlasWidth, (atlasHeight - y - h) / atlasHeight);
    
    // 确保其他纹理属性与原始纹理一致
    spriteTexture.magFilter = THREE.NearestFilter;
    spriteTexture.minFilter = THREE.NearestFilter;
    spriteTexture.wrapS = THREE.ClampToEdgeWrapping;
    spriteTexture.wrapT = THREE.ClampToEdgeWrapping;
    spriteTexture.generateMipmaps = false;
    
    // 缓存纹理
    this.textureCache.set(spriteName, spriteTexture);
    
    return spriteTexture;
  }

  // 检查精灵是否存在
  hasSprite(spriteName) {
    return this.isLoaded && this.atlasData.frames.hasOwnProperty(spriteName);
  }

  // 获取精灵图数据
  getSpriteData(spriteName) {
    return this.isLoaded ? this.atlasData.frames[spriteName] : null;
  }

  // 清除纹理缓存
  clearCache() {
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
  }

  // 释放资源
  dispose() {
    this.clearCache();
    if (this.atlasTexture) {
      this.atlasTexture.dispose();
      this.atlasTexture = null;
    }
    this.atlasData = null;
    this.isLoaded = false;
  }
}

/**
 * Minecraft 模型加载器类
 * 负责加载、解析和管理 Minecraft 风格的 3D 模型数据
 * 支持模型继承、纹理解析和缓存机制
 */
class MCModelLoader {
  constructor() {
    /**
     * 模型缓存，存储已解析的模型数据以提高重复加载性能
     * 使用Map结构，键为模型ID，值为解析后的模型数据
     */
    this.modelCache = new Map();
    
    /**
     * 基础模型定义，提供常用的方块模型模板
     * 这些是内置的基础模型，可以被其他模型继承和扩展
     */
    this.baseModels = {
      /**
       * 标准立方体模型，6个面分别对应不同纹理
       * 每个面都有对应的UV坐标和纹理引用
       */
      'block/cube': {
        elements: [
          {
            from: [0, 0, 0],  // 立方体起始坐标
            to: [16, 16, 16], // 立方体结束坐标
            faces: {
              down: { uv: [0, 16, 16, 0], texture: '#down', cullface: 'down' },   // 底面
              up: { uv: [0, 0, 16, 16], texture: '#up', cullface: 'up' },         // 顶面
              north: { uv: [0, 0, 16, 16], texture: '#north', cullface: 'north' }, // 北面
              south: { uv: [0, 0, 16, 16], texture: '#south', cullface: 'south' }, // 南面
              west: { uv: [0, 0, 16, 16], texture: '#west', cullface: 'west' },    // 西面
              east: { uv: [0, 0, 16, 16], texture: '#east', cullface: 'east' }     // 东面
            }
          }
        ]
      },
      
      /**
       * 空模型，用于特殊方块（如空气方块）
       * 没有elements，表示不渲染任何几何体
       */
      'block/block': {
        elements: []
      },
      
      /**
       * 所有面使用相同纹理的立方体
       * 继承自block/cube，所有面都使用同一个纹理
       */
      'block/cube_all': {
        parent: 'block/cube',
        textures: {
          particle: '#all',  // 粒子纹理
          down: '#all',      // 底面纹理
          up: '#all',        // 顶面纹理
          north: '#all',     // 北面纹理
          east: '#all',      // 东面纹理
          south: '#all',     // 南面纹理
          west: '#all'       // 西面纹理
        }
      },
      
      /**
       * 柱状模型，侧面和端面使用不同纹理
       * 继承自block/cube，侧面用side纹理，端面用end纹理
       * 常用于树干、柱子等方块
       */
      'block/cube_column': {
        parent: 'block/cube',
        textures: {
          particle: '#side',
          down: '#end',      // 底面端面纹理
          up: '#end',        // 顶面端面纹理
          north: '#side',    // 侧面纹理
          east: '#side',     // 侧面纹理
          south: '#side',    // 侧面纹理
          west: '#side'      // 侧面纹理
        }
      },
      
      /**
       * 所有面使用侧面纹理的立方体
       * 继承自block/cube，所有面都使用侧面纹理
       */
      'block/cube_side': {
        parent: 'block/cube',
        textures: {
          particle: '#side',
          down: '#side',     // 底面纹理
          up: '#side',       // 顶面纹理
          north: '#side',    // 北面纹理
          east: '#side',     // 东面纹理
          south: '#side',    // 南面纹理
          west: '#side'      // 西面纹理
        }
      }
    };
    
    /**
     * 外部加载的模型数据
     * 从JSON文件加载的模型数据存储在这里
     */
    this.modelData = null;
    
    /**
     * 加载状态标志
     * 用于防止重复加载同一数据
     */
    this.isLoading = false;
  }

/**
   * 异步加载模型数据JSON文件
   * @param {string} jsonPath - 模型数据JSON文件的路径
   * @throws {Error} 当加载失败时抛出错误
   * @returns {Promise<void>}
   */
  async loadModelData(jsonPath) {
    // 检查是否正在加载中，避免重复加载
    if (this.isLoading) {
      console.warn('[MCModelLoader] 模型数据正在加载中，请稍候');
      return;
    }

    try {
      this.isLoading = true;
      
      // 使用fetch API获取JSON文件
      const response = await fetch(jsonPath);
      
      // 检查HTTP响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 解析JSON数据并存储
      this.modelData = await response.json();
      console.log(`[MCModelLoader] 模型数据加载成功: ${jsonPath}`);
      
    } catch (error) {
      // 记录错误信息并重新抛出
      console.error('[MCModelLoader] 模型数据加载失败:', error);
      throw error;
    } finally {
      // 无论成功或失败都要重置加载状态
      this.isLoading = false;
    }
  }

  /**
   * 解析模型数据，支持模型继承和缓存
   * @param {string} modelId - 模型ID
   * @param {string[]} inheritanceChain - 继承链，用于检测循环继承
   * @returns {Object|null} 解析后的模型数据，失败返回null
   */
  resolveModel(modelId, inheritanceChain = []) {
    
    // 检查循环继承，避免无限递归
    if (inheritanceChain.includes(modelId)) {
      console.warn(`[MCModelLoader] 检测到循环继承: ${inheritanceChain.join(' -> ')} -> ${modelId}`);
      return null;
    }

    // 检查缓存，如果已存在则直接返回
    if (this.modelCache.has(modelId)) {
      return this.modelCache.get(modelId);
    }

    let modelData = null;
    
    // 标准化模型ID，处理minecraft:前缀
    const normalizedId = this.normalizeModelId(modelId);

    // 按优先级查找模型数据：基础模型 -> 外部模型
    if (this.baseModels[normalizedId]) {
      // 优先查找标准化的基础模型
      modelData = JSON.parse(JSON.stringify(this.baseModels[normalizedId]));
    } else if (this.modelData && this.modelData[normalizedId]) {
      // 优先查找标准化的外部模型
      modelData = JSON.parse(JSON.stringify(this.modelData[normalizedId]));
    } else if (this.baseModels[modelId]) {
      // 回退到原始ID的基础模型
      modelData = JSON.parse(JSON.stringify(this.baseModels[modelId]));
    } else if (this.modelData && this.modelData[modelId]) {
      // 回退到原始ID的外部模型
      modelData = JSON.parse(JSON.stringify(this.modelData[modelId]));
    } else {
      // 未找到任何模型
      console.warn(`[MCModelLoader] 未找到模型: ${modelId}`);
      return null;
    }

    // 处理模型继承
    if (modelData.parent) {
      const parentId = modelData.parent;
      
      // 递归解析父模型
      const parentModel = this.resolveModel(parentId, [...inheritanceChain, modelId]);

      if (parentModel) {
        // 合并父模型和当前模型数据
        modelData = this.mergeModelData(parentModel, modelData);
      } else {
        console.warn(`[MCModelLoader] 父模型不存在: ${parentId}`);
      }
    }

    // 将解析结果存入缓存
    this.modelCache.set(modelId, modelData);
    return modelData;
  }

  /**
   * 标准化模型ID，统一处理minecraft:前缀
   * @param {string} modelId - 原始模型ID
   * @returns {string} 标准化后的模型ID
   */
  normalizeModelId(modelId) {
    // 检查是否以minecraft:开头
    if (modelId.startsWith('minecraft:')) {
      // 提取路径部分
      const path = modelId.substring(10);
      
      // 如果路径已以block/开头，直接返回路径
      if (path.startsWith('block/')) {
        return path;
      }
      
      // 否则添加block/前缀
      return `block/${path}`;
    }
    
    // 如果不是minecraft:前缀，但也不包含block/，则添加block/前缀
    if (!modelId.includes('/') && !modelId.startsWith('block/')) {
      return `block/${modelId}`;
    }
    
    // 其他情况直接返回原ID
    return modelId;
  }

  /**
   * 合并模型数据，子模型继承并覆盖父模型的属性
   * @param {Object} parent - 父模型数据
   * @param {Object} child - 子模型数据
   * @returns {Object} 合并后的模型数据
   */
  mergeModelData(parent, child) {
    // 深度复制父模型数据
    const merged = JSON.parse(JSON.stringify(parent));

    // 合并纹理定义，子模型的纹理会覆盖父模型的同名纹理
    if (child.textures) {
      merged.textures = { ...parent.textures, ...child.textures };
    }

    // 替换几何元素，子模型的elements完全覆盖父模型的elements
    if (child.elements) {
      merged.elements = child.elements;
    }

    // 合并显示设置
    if (child.display) {
      merged.display = { ...parent.display, ...child.display };
    }

    // 处理环境光遮蔽设置
    if (child.ambientocclusion !== undefined) {
      merged.ambientocclusion = child.ambientocclusion;
    }

    // 处理加载器设置
    if (child.loader) {
      merged.loader = child.loader;
    }

    return merged;
  }

  /**
   * 解析模型纹理，处理纹理变量引用
   * @param {Object} modelData - 模型数据
   * @returns {Object} 解析后的纹理映射表
   */
  resolveTextures(modelData) {
    // 检查模型数据和纹理定义是否存在
    if (!modelData || !modelData.textures) {
      return {};
    }

    const resolvedTextures = {};
    const textureMap = modelData.textures;
    
    // 用于检测纹理变量循环引用的访问记录
    const visited = new Set();

    /**
     * 递归解析单个纹理引用
     * @param {string} textureRef - 纹理引用（可能是变量或直接路径）
     * @returns {string|null} 解析后的纹理路径，失败返回null
     */
    const resolveTexture = (textureRef) => {
      // 无效纹理引用直接返回
      if (!textureRef || typeof textureRef !== 'string') {
        return textureRef;
      }

      // 如果不是变量引用（不以#开头），直接返回
      if (!textureRef.startsWith('#')) {
        return textureRef;
      }

      // 提取变量名
      const varName = textureRef.substring(1);

      // 检测循环引用
      if (visited.has(varName)) {
        console.warn(`[MCModelLoader] 检测到纹理变量循环引用: ${varName}`);
        return null;
      }

      // 记录当前访问的变量
      visited.add(varName);

      // 递归解析变量引用
      if (textureMap[varName]) {
        const result = resolveTexture(textureMap[varName]);
        visited.delete(varName);
        return result;
      }

      // 清理访问记录
      visited.delete(varName);
      return null;
    };

    // 解析所有纹理变量
    for (const [key, value] of Object.entries(textureMap)) {
      if (value) {
        resolvedTextures[key] = resolveTexture(value);
      }
    }

    return resolvedTextures;
  }

  /**
   * 获取完整的模型数据，包括解析后的纹理
   * @param {string} modelId - 模型ID
   * @returns {Object|null} 完整的模型数据，失败返回null
   */
  getModel(modelId) {
    // 检查模型数据是否已加载
    if (!this.modelData) {
      console.warn('[MCModelLoader] 模型数据未加载，请先调用loadModelData');
      return null;
    }

    // 解析模型数据
    const modelData = this.resolveModel(modelId);
    if (!modelData) {
      return null;
    }

    // 解析纹理引用
    const resolvedTextures = this.resolveTextures(modelData);

    // 返回完整的模型数据
    return {
      id: modelId,
      elements: modelData.elements || [],
      textures: resolvedTextures,
      display: modelData.display,
      ambientocclusion: modelData.ambientocclusion !== undefined ? modelData.ambientocclusion : true
    };
  }

  /**
   * 清除模型缓存
   * 强制重新加载所有模型时会用到
   */
  clearCache() {
    this.modelCache.clear();
    console.log('[MCModelLoader] 模型缓存已清除');
  }

  /**
   * 释放所有资源
   * 包括清除缓存和模型数据
   */
  dispose() {
    this.clearCache();
    this.modelData = null;
    console.log('[MCModelLoader] 已释放资源');
  }

  /**
   * 检查指定ID的模型是否存在
   * @param {string} modelId - 模型ID
   * @returns {boolean} 模型是否存在
   */
  hasModel(modelId) {
    // 标准化模型ID
    const normalizedId = this.normalizeModelId(modelId);
    
    // 检查基础模型是否存在
    if (this.baseModels[normalizedId] || this.baseModels[modelId]) {
      return true;
    }
    
    // 检查外部模型数据是否存在
    if (this.modelData && (this.modelData[normalizedId] || this.modelData[modelId])) {
      return true;
    }
    
    return false;
  }

  /**
   * 获取模型的继承链
   * @param {string} modelId - 模型ID
   * @returns {string[]} 继承链数组，从当前模型到最顶层父模型
   */
  getModelInheritanceChain(modelId) {
    const chain = [];
    let currentId = modelId;
    
    // 用于检测循环继承的访问记录
    const visited = new Set();

    // 沿着继承链向上遍历
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      chain.push(currentId);

      let modelData = null;
      const normalizedId = this.normalizeModelId(currentId);
      
      // 按优先级查找模型数据
      if (this.baseModels[normalizedId]) {
        modelData = this.baseModels[normalizedId];
      } else if (this.baseModels[currentId]) {
        modelData = this.baseModels[currentId];
      } else if (this.modelData && this.modelData[normalizedId]) {
        modelData = this.modelData[normalizedId];
      } else if (this.modelData && this.modelData[currentId]) {
        modelData = this.modelData[currentId];
      }

      // 如果模型存在且有父模型，继续向上遍历
      if (modelData && modelData.parent) {
        currentId = modelData.parent;
      } else {
        // 没有父模型，继承链结束
        break;
      }
    }

    return chain;
  }

  /**
   * 获取模型使用的所有纹理列表
   * @param {string} modelId - 模型ID
   * @returns {string[]} 纹理路径数组
   */
  getAllTextures(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return [];
    }

    const textures = new Set();
    const elements = model.elements || [];

    // 从几何元素的面的纹理中提取纹理
    elements.forEach(element => {
      if (element.faces) {
        Object.values(element.faces).forEach(face => {
          // 只收集直接纹理引用（不以#开头的）
          if (face.texture && typeof face.texture === 'string' && !face.texture.startsWith('#')) {
            textures.add(face.texture);
          }
        });
      }
    });

    // 从模型纹理定义中提取纹理
    Object.values(model.textures || {}).forEach(textureRef => {
      // 只收集直接纹理引用（不以#开头的）
      if (textureRef && typeof textureRef === 'string' && !textureRef.startsWith('#')) {
        textures.add(textureRef);
      }
    });

    return Array.from(textures);
  }

  /**
   * 预加载多个模型数据
   * @param {string[]} modelIds - 模型ID数组
   * @returns {Promise<Object>} 预加载结果，键为模型ID，值为成功/失败状态和模型数据
   */
  async preloadModels(modelIds) {
    const results = {};

    // 逐个加载模型
    for (const modelId of modelIds) {
      try {
        const model = this.getModel(modelId);
        if (model) {
          results[modelId] = { success: true, model };
        } else {
          results[modelId] = { success: false, error: 'Model not found' };
        }
      } catch (error) {
        results[modelId] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * 获取模型的详细信息
   * @param {string} modelId - 模型ID
   * @returns {Object|null} 模型详细信息，失败返回null
   */
  getModelInfo(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return null;
    }

    return {
      id: model.id,
      hasParent: this.hasParent(modelId),
      parent: this.getParentId(modelId),
      inheritanceChain: this.getModelInheritanceChain(modelId),
      elementCount: model.elements ? model.elements.length : 0,
      textures: this.getAllTextures(modelId),
      hasDisplay: !!model.display,
      ambientOcclusion: model.ambientocclusion
    };
  }

  /**
   * 检查模型是否有父模型
   * @param {string} modelId - 模型ID
   * @returns {boolean} 是否有父模型
   */
  hasParent(modelId) {
    // 标准化模型ID
    const normalizedId = this.normalizeModelId(modelId);
    
    // 检查基础模型是否有父模型
    if (this.baseModels[normalizedId] || this.baseModels[modelId]) {
      return !!(this.baseModels[normalizedId]?.parent || this.baseModels[modelId]?.parent);
    }
    
    // 检查外部模型数据是否有父模型
    if (this.modelData && (this.modelData[normalizedId] || this.modelData[modelId])) {
      return !!(this.modelData[normalizedId]?.parent || this.modelData[modelId]?.parent);
    }
    
    return false;
  }

  /**
   * 获取模型的父模型ID
   * @param {string} modelId - 模型ID
   * @returns {string|null} 父模型ID，不存在返回null
   */
  getParentId(modelId) {
    // 标准化模型ID
    const normalizedId = this.normalizeModelId(modelId);
    
    // 按优先级查找基础模型的父模型
    if (this.baseModels[normalizedId]) {
      return this.baseModels[normalizedId].parent || null;
    }
    if (this.baseModels[modelId]) {
      return this.baseModels[modelId].parent || null;
    }
    
    // 按优先级查找外部模型的父模型
    if (this.modelData && this.modelData[normalizedId]) {
      return this.modelData[normalizedId].parent || null;
    }
    if (this.modelData && this.modelData[modelId]) {
      return this.modelData[modelId].parent || null;
    }
    
    return null;
  }

  /**
   * 获取模型的所有面纹理
   * @param {string} modelId - 模型ID
   * @returns {Object|null} 包含6个面纹理的对象，失败返回null
   */
  getAllFaceTextures(modelId) {
    // 获取模型数据
    const model = this.getModel(modelId);
    if (!model) {
      console.warn(`[MCModelLoader] 无法获取模型: ${modelId}`);
      return null;
    }

    console.log(`[MCModelLoader] 成功获取模型: ${modelId}`, model);

    const faceTextures = {
      down: null,
      up: null,
      north: null,
      south: null,
      west: null,
      east: null
    };

    // 如果模型有元素，从元素中提取面纹理
    if (model.elements && model.elements.length > 0) {
      for (let i = 0; i < model.elements.length; i++) {
        const element = model.elements[i];
        if (element.faces) {
          for (const [faceName, faceData] of Object.entries(element.faces)) {
            if (faceData.texture) {
              // 解析纹理引用
              const textureRef = this.resolveTextureReference(faceData.texture, model.textures);
              if (textureRef) {
                // 如果是第一个元素，直接设置纹理
                if (i === 0) {
                  faceTextures[faceName] = textureRef;
                } 
                // 如果是第二个元素，检查是否需要处理overlay
                else if (i === 1) {
                  // 对于有overlay的情况，我们需要合并纹理
                  if (faceTextures[faceName]) {
                    // 检查是否已经有overlay
                    if (typeof faceTextures[faceName] === 'object' && faceTextures[faceName].overlay) {
                      // 已经有overlay，跳过
                      continue;
                    }
                    
                    // 创建包含基础纹理和overlay纹理的对象
                    faceTextures[faceName] = {
                      base: faceTextures[faceName],
                      overlay: textureRef
                    };
                  } else {
                    // 如果第一个元素没有设置这个面的纹理，直接设置
                    faceTextures[faceName] = textureRef;
                  }
                }
              }
            }
          }
        }
      }
      
      // 输出关键信息
      console.log(`[MCModelLoader] ${modelId}: 底面=${faceTextures.down?.base || faceTextures.down}, 顶面=${faceTextures.up?.base || faceTextures.up}, 侧面=${faceTextures.north?.base || faceTextures.north || faceTextures.south || faceTextures.west || faceTextures.east}`);
      if (faceTextures.north?.overlay || faceTextures.south?.overlay || faceTextures.west?.overlay || faceTextures.east?.overlay) {
        console.log(`[MCModelLoader] ${modelId}: 侧面有overlay纹理`);
      }
    }

    // 如果从元素中没有获取到某些面的纹理，尝试从模型纹理定义中获取
    const textureMap = model.textures || {};
    console.log(`[MCModelLoader] 模型纹理定义:`, textureMap);
    
    const faceTextureMap = {
      down: ['down', 'bottom', 'side', 'all'],
      up: ['up', 'top', 'side', 'all'],
      north: ['north', 'front', 'side', 'all'],
      south: ['south', 'back', 'side', 'all'],
      west: ['west', 'left', 'side', 'all'],
      east: ['east', 'right', 'side', 'all']
    };

    for (const [face, possibleTextureNames] of Object.entries(faceTextureMap)) {
      if (!faceTextures[face]) {
        for (const textureName of possibleTextureNames) {
          if (textureMap[textureName]) {
            const textureRef = this.resolveTextureReference(textureMap[textureName], textureMap);
            if (textureRef) {
              faceTextures[face] = textureRef;
              console.log(`[MCModelLoader] 从纹理定义中为面 ${face} 设置纹理: ${textureName} -> ${textureRef}`);
              break;
            }
          }
        }
      }
    }

    console.log(`[MCModelLoader] 最终面纹理:`, faceTextures);
    return faceTextures;
  }

  /**
   * 解析纹理引用，处理变量引用
   * @param {string} textureRef - 纹理引用
   * @param {Object} textureMap - 纹理映射表
   * @returns {string|null} 解析后的纹理路径
   */
  resolveTextureReference(textureRef, textureMap = {}) {
    if (!textureRef || typeof textureRef !== 'string') {
      return null;
    }

    // 如果不是变量引用，直接返回
    if (!textureRef.startsWith('#')) {
      return textureRef;
    }

    // 提取变量名
    const varName = textureRef.substring(1);
    
    // 检查纹理映射表中是否有该变量
    if (textureMap[varName]) {
      // 递归解析，处理嵌套变量引用
      return this.resolveTextureReference(textureMap[varName], textureMap);
    }

    return null;
  }

  /**
   * 从模型数据创建THREE.js几何体网格
   * @param {string} modelId - 模型ID
   * @param {Object} textureMap - 纹理映射表，键为纹理路径，值为THREE.js材质
   * @returns {THREE.BufferGeometry|null} 创建的几何体，失败返回null
   */
  createMeshFromModel(modelId, textureMap = {}) {
    // 获取模型数据
    const model = this.getModel(modelId);
    if (!model) {
      console.warn(`[MCModelLoader] 无法创建网格，模型不存在: ${modelId}`);
      return null;
    }

    // 创建THREE.js几何体和属性数组
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    let vertexOffset = 0; // 顶点偏移量，用于索引计算

    // 遍历模型中的所有几何元素
    for (const element of model.elements) {
      const { from, to, faces } = element;
      const [fx, fy, fz] = from; // 起始坐标
      const [tx, ty, tz] = to;   // 结束坐标

      // 定义面的渲染顺序（这会影响面剔除）
      const faceOrder = ['north', 'south', 'east', 'west', 'up', 'down'];
      
      // 定义每个面的法向量，用于光照计算
      const faceNormals = {
        down: [0, -1, 0],   // 底面法向量向下
        up: [0, 1, 0],      // 顶面法向量向上
        north: [0, 0, -1],  // 北面法向量向后
        south: [0, 0, 1],   // 南面法向量向前
        west: [-1, 0, 0],   // 西面法向量向左
        east: [1, 0, 0]     // 东面法向量向右
      };

      // 定义每个面的顶点坐标（以顺时针顺序定义，用于正确的面朝向）
      const faceVertices = {
        down: [
          [tx, fy, fz], [fx, fy, fz], [fx, fy, tz], [tx, fy, tz]
        ],
        up: [
          [fx, ty, fz], [tx, ty, fz], [tx, ty, tz], [fx, ty, tz]
        ],
        north: [
          [tx, fy, fz], [tx, ty, fz], [fx, ty, fz], [fx, fy, fz]
        ],
        south: [
          [fx, fy, tz], [fx, ty, tz], [tx, ty, tz], [tx, fy, tz]
        ],
        west: [
          [fx, fy, fz], [fx, ty, fz], [fx, ty, tz], [fx, fy, tz]
        ],
        east: [
          [tx, fy, tz], [tx, ty, tz], [tx, ty, fz], [tx, fy, fz]
        ]
      };

      // 渲染每个面
      for (const faceName of faceOrder) {
        const face = faces[faceName];
        if (!face) continue; // 如果面不存在，跳过

        const faceVerts = faceVertices[faceName];
        const normal = faceNormals[faceName];
        const uv = face.uv || [0, 0, 16, 16]; // UV坐标，默认值

        const textureRef = face.texture;
        let material = null;

        // 查找对应的材质
        if (textureRef && textureMap[textureRef]) {
          material = textureMap[textureRef];
        } else if (model.textures && model.textures.all && textureMap[model.textures.all]) {
          material = textureMap[model.textures.all];
        }

        // 处理面的四个顶点
        for (const [vx, vy, vz] of faceVerts) {
          // 添加顶点坐标（偏移-8以居中到原点）
          vertices.push(vx - 8, vy, vz - 8);
          
          // 添加法向量
          normals.push(...normal);

          // 计算UV坐标（将16x16的纹理坐标转换为0-1范围）
          if (uv && Array.isArray(uv) && uv.length === 4) {
            let u1, v1, u2, v2;
            
            // 根据面的方向计算UV坐标
            if (faceName === 'down' || faceName === 'up') {
              u1 = uv[0] / 16;
              v1 = 1 - uv[3] / 16;
              u2 = uv[2] / 16;
              v2 = 1 - uv[1] / 16;
            } else if (faceName === 'north' || faceName === 'south') {
              u1 = uv[0] / 16;
              v1 = 1 - uv[3] / 16;
              u2 = uv[2] / 16;
              v2 = 1 - uv[1] / 16;
            } else {
              u1 = uv[0] / 16;
              v1 = 1 - uv[3] / 16;
              u2 = uv[2] / 16;
              v2 = 1 - uv[1] / 16;
            }
            
            // 添加UV坐标（两个三角形，共6个顶点）
            uvs.push(u1, v1, u2, v1, u2, v2, u1, v2);
          } else {
            // 默认UV坐标
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
          }
        }

        // 添加面的索引（两个三角形组成一个四边形面）
        const baseIndex = vertexOffset;
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,    // 第一个三角形
          baseIndex, baseIndex + 2, baseIndex + 3     // 第二个三角形
        );

        vertexOffset += 4; // 每个面增加4个顶点
      }
    }

    // 设置几何体属性
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
  }
}

class MCTextureLoader {
  constructor() {
    this.textureCache = new Map();
    this.blockModelCache = new Map();
  }

  get modelData() {
    return mcModelLoader.modelData;
  }

  /**
   * 加载方块的所有面纹理
   * @param {string} block - 方块名称或ID
   * @param {string} variant - 方块变体（可选）
   * @returns {Object|null} 包含6个面纹理的对象，失败返回null
   */
  loadAllFaceTextures(block, variant = null) {
    const blockName = this.extractBlockName(block);
    const cacheKey = variant ? `${block}:${variant}:faces` : `${block}:faces`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    // 获取模型的所有面纹理引用
    const faceTextureRefs = mcModelLoader.getAllFaceTextures(blockName);
    if (!faceTextureRefs) {
      console.warn(`[MCTextureLoader] 未找到方块 ${block} 的面纹理引用`);
      return null;
    }

    const faceTextures = {
      down: null,
      up: null,
      north: null,
      south: null,
      west: null,
      east: null
    };

    // 为每个面加载纹理
    for (const [face, textureRef] of Object.entries(faceTextureRefs)) {
      if (textureRef) {
        // 检查是否是overlay纹理对象
        if (typeof textureRef === 'object' && textureRef.base && textureRef.overlay) {
          // 处理overlay纹理
          const basePath = this.resolveTexturePath(textureRef.base);
          const overlayPath = this.resolveTexturePath(textureRef.overlay);
          
          if (basePath && overlayPath) {
            const baseTexture = this.loadTexture(basePath, `${blockName}_${face}_base`);
            const overlayTexture = this.loadTexture(overlayPath, `${blockName}_${face}_overlay`);
            
            // 创建一个包含基础纹理和overlay纹理的对象
            faceTextures[face] = {
              base: baseTexture,
              overlay: overlayTexture
            };
          }
        } else {
          // 处理普通纹理
          const texturePath = this.resolveTexturePath(textureRef);
          if (texturePath) {
            const texture = this.loadTexture(texturePath, `${blockName}_${face}`);
            faceTextures[face] = texture;
          }
        }
      }
    }

    // 输出关键信息
    console.log(`[MCTextureLoader] ${blockName}: 底面=${faceTextures.down?.base || faceTextures.down}, 顶面=${faceTextures.up?.base || faceTextures.up}, 侧面=${faceTextures.north?.base || faceTextures.north || faceTextures.south || faceTextures.west || faceTextures.east}`);
    if (faceTextures.north?.overlay || faceTextures.south?.overlay || faceTextures.west?.overlay || faceTextures.east?.overlay) {
      console.log(`[MCTextureLoader] ${blockName}: 侧面有overlay纹理`);
    }
    
    this.textureCache.set(cacheKey, faceTextures);
    return faceTextures;
  }

  /**
   * 加载方块纹理（保持向后兼容）
   * @param {string} block - 方块名称或ID
   * @param {string} variant - 方块变体（可选）
   * @returns {Array} 包含纹理和额外信息的数组
   */
  load(block, variant = null) {
    const blockName = this.extractBlockName(block);
    const cacheKey = variant ? `${block}:${variant}` : block;

    if (this.textureCache.has(cacheKey)) {
      return [this.textureCache.get(cacheKey), null];
    }

    const model = this.getModelForBlock(blockName);
    if (!model) {
      console.warn(`未找到方块 ${block} 的模型 (尝试的方块名称: ${blockName})`);
      return [null, null];
    }

    const texture = this.loadTextureFromModel(model, blockName, variant);
    if (texture) {
      this.textureCache.set(cacheKey, texture);
    }

    return [texture, model];
  }

  /**
   * 获取方块的所有面纹理，如果没有特定面纹理则使用默认纹理
   * @param {string} block - 方块名称或ID
   * @param {string} variant - 方块变体（可选）
   * @returns {Array} 包含6个面纹理的数组
   */
  getFaceTextures(block, variant = null) {
    console.log(`[MCTextureLoader] 获取方块 ${block} 的面纹理`);
    
    // 尝试加载所有面纹理
    const faceTextures = this.loadAllFaceTextures(block, variant);
    
    if (faceTextures) {
      // 如果成功加载所有面纹理，返回6个面的纹理
      const result = [
        faceTextures.down,
        faceTextures.up,
        faceTextures.north,
        faceTextures.south,
        faceTextures.west,
        faceTextures.east
      ];
      
      // 对于包含overlay纹理的面，只返回基础纹理
      // 这样可以保持返回的数据结构一致性
      const finalResult = result.map(texture => {
        if (texture && typeof texture === 'object' && texture.base) {
          console.log(`[MCTextureLoader] 提取面基础纹理，跳过overlay`);
          return texture.base;
        }
        return texture;
      });
      
      console.log(`[MCTextureLoader] 方块 ${block} 的最终面纹理数组:`, finalResult);
      return finalResult;
    } else {
      // 如果无法加载所有面纹理，回退到单一纹理
      console.log(`[MCTextureLoader] 无法加载所有面纹理，回退到单一纹理`);
      const [texture] = this.load(block, variant);
      if (texture) {
        // 所有面使用相同纹理
        const result = new Array(6).fill(texture);
        console.log(`[MCTextureLoader] 方块 ${block} 使用单一纹理:`, texture);
        return result;
      }
      
      // 如果连单一纹理都加载失败，返回6个null
      console.log(`[MCTextureLoader] 方块 ${block} 连单一纹理都加载失败`);
      return new Array(6).fill(null);
    }
  }

  /**
   * 获取方块的所有面overlay纹理
   * @param {string} block - 方块名称或ID
   * @param {string} variant - 方块变体（可选）
   * @returns {Array} 包含6个面overlay纹理的数组
   */
  getFaceOverlayTextures(block, variant = null) {
    // 尝试加载所有面纹理
    const faceTextures = this.loadAllFaceTextures(block, variant);
    
    if (faceTextures) {
      // 如果成功加载所有面纹理，返回6个面的overlay纹理
      const result = [
        faceTextures.down,
        faceTextures.up,
        faceTextures.north,
        faceTextures.south,
        faceTextures.west,
        faceTextures.east
      ];
      
      // 只返回overlay纹理，如果没有overlay则返回null
      return result.map(texture => {
        if (texture && typeof texture === 'object' && texture.overlay) {
          return texture.overlay;
        }
        return null;
      });
    }
    
    // 如果无法加载所有面纹理，返回6个null
    return new Array(6).fill(null);
  }

  preloadTextures(blockList) {
    const results = {};

    for (const block of blockList) {
      const texture = this.load(block);
      results[block] = texture;
    }

    return results;
  }

  extractBlockName(block) {
    if (typeof block === 'string') {
      return block.includes(':') ? block.split(':')[1] : block;
    }
    return block;
  }

  getModelForBlock(blockName) {
    if (this.blockModelCache.has(blockName)) {
      return this.blockModelCache.get(blockName);
    }

    // 直接使用blockName，不需要额外的标准化
    // 因为JSON文件中的键就是"grass_block"这样的名称
    if (!this.modelData || !this.modelData[blockName]) {
      console.warn(`[MCTextureLoader] 未找到方块 ${blockName}`);
      return null;
    }

    const blockModel = this.modelData[blockName];
    const parentId = blockModel.parent;

    if (!parentId) {
      console.warn(`[MCTextureLoader] 方块 ${blockName} 没有父模型定义`);
      return null;
    }

    const parentModel = mcModelLoader.getModel(parentId);
    if (!parentModel) {
      console.warn(`[MCTextureLoader] 无法加载父模型 ${parentId}`);
      return null;
    }

    // 创建合并后的模型
    const mergedModel = {
      ...parentModel,
      id: `minecraft:block/${blockName}`
    };

    // 合并纹理定义，子模型的纹理会覆盖父模型的同名纹理
    if (blockModel.textures) {
      mergedModel.textures = { ...parentModel.textures, ...blockModel.textures };
    }

    // 如果子模型有自己的元素，使用子模型的元素
    // 这对于像grass_block这样有多个元素的模型很重要
    if (blockModel.elements) {
      mergedModel.elements = blockModel.elements;
      console.log(`[MCTextureLoader] 使用子模型的元素:`, blockModel.elements.length);
    }

    this.blockModelCache.set(blockName, mergedModel);
    return mergedModel;
  }

  normalizeBlockName(blockName) {
    if (blockName.startsWith('minecraft:')) {
      return blockName.substring(10);
    }
    if (blockName.startsWith('block/')) {
      return blockName.substring(6);
    }
    return blockName;
  }

  loadTextureFromModel(model, blockName, variant) {
    if (!model || !model.textures) {
      return null;
    }

    const textures = model.textures;
    const textureRef = textures.all || textures.particle || textures.side || textures.texture || textures.down;

    if (!textureRef) {
      console.warn(`模型 ${blockName} 没有可用的纹理引用`);
      return null;
    }

    let resolvedTextureRef = textureRef;
    if (typeof textureRef === 'string' && textureRef.startsWith('#')) {
      const varName = textureRef.substring(1);
      if (textures[varName]) {
        resolvedTextureRef = textures[varName];
      }
    }

    const texturePath = this.resolveTexturePath(resolvedTextureRef);
    if (!texturePath) {
      return null;
    }

    return this.loadTexture(texturePath, blockName);
  }

  resolveTexturePath(textureRef) {
    if (!textureRef || typeof textureRef !== 'string') {
      return null;
    }

    if (textureRef.startsWith('#')) {
      return null;
    }

    const parts = textureRef.split(':');
    let namespace, path;

    if (parts.length === 2) {
      namespace = parts[0];
      path = parts[1];
    } else {
      namespace = 'minecraft';
      path = textureRef;
    }

    // 处理精灵图名称，确保格式正确
    let spriteName = path;
    if (!spriteName.endsWith('.png')) {
      spriteName = `${spriteName}.png`;
    }
    // 移除 block/ 前缀，因为精灵图中没有这个前缀
    spriteName = spriteName.replace(/^block\//, '');

    return {
      namespace,
      path,
      spriteName
    };
  }

  loadTexture(texturePath, blockName) {
    const spriteName = texturePath.spriteName;

    if (mcSpriteAtlas.hasSprite(spriteName)) {
      const spriteTexture = mcSpriteAtlas.getSpriteTexture(spriteName);
      if (spriteTexture) {
        console.log(`从精灵图加载纹理: ${spriteName} (方块: ${blockName})`);
        return spriteTexture;
      }
    } else {
      console.warn(`精灵图中未找到纹理: ${spriteName} (方块: ${blockName})`);
    }

    return null;
  }

  preloadTextures(blockList) {
    const results = {};

    for (const block of blockList) {
      const texture = this.load(block);
      results[block] = texture;
    }

    return results;
  }

  clearCache() {
    this.textureCache.clear();
    this.blockModelCache.clear();
    console.log('[MCTextureLoader] 缓存已清除');
  }

  getCacheSize() {
    return {
      textures: this.textureCache.size,
      models: this.blockModelCache.size
    };
  }
}

// ========================================
// LanguageManager 类 - 语言管理
// ========================================

class LanguageManager {
  constructor() {
    this.currentLanguage = selectedLanguageId || 'en-US';
    
    // 初始化缓存
    if (!window.Process || !window.Process.lang) {
      window.Process = window.Process || {};
      window.Process.lang = window.Process.lang || {};
    }
    if (!window.Process.lang.urlCache) {
      window.Process.lang.urlCache = {};
    }
    
    // 确保全局可访问
    window.languageManager = this;
  }
  
  // 语言匹配辅助函数
  findBestLanguageMatch(availableLanguages, targetLanguage) {
    // 1. 尝试直接匹配
    if (availableLanguages.includes(targetLanguage)) {
      return targetLanguage;
    }
    
    // 2. 尝试匹配语言前缀（如 zh-tw 匹配 zh）
    const targetPrefix = targetLanguage.split('-')[0].toLowerCase();
    for (const lang of availableLanguages) {
      if (lang.split('-')[0].toLowerCase() === targetPrefix) {
        console.log(`[Language] Prefix match found: "${lang}" matches prefix "${targetPrefix}"`);
        return lang;
      }
    }
    
    // 3. 尝试匹配 en-US 作为回退
    if (availableLanguages.includes('en-US')) {
      console.log(`[Language] Using fallback language "en-US"`);
      return 'en-US';
    }
    
    // 4. 使用第一个可用语言
    if (availableLanguages.length > 0) {
      console.log(`[Language] Using first available language: "${availableLanguages[0]}"`);
      return availableLanguages[0];
    }
    
    return null;
  }
  
  // 获取本地化文本
  getLocalizedText(textKey) {
    // 检查是否有语言配置
    if (!window.Process || !window.Process.lang) {
      console.warn(`[Language] No language configuration found, returning original text: "${textKey}"`);
      return textKey; // 如果没有语言配置，返回原始文本
    }
    
    // 优先从内嵌的语言映射中查找
    if (window.Process.lang.embed) {
      const langEmbed = window.Process.lang.embed;
      const availableLanguages = Object.keys(langEmbed);
      
      const matchedLanguage = this.findBestLanguageMatch(availableLanguages, this.currentLanguage);
      
      // 如果找到了匹配的语言且文本键存在，返回本地化文本
      if (matchedLanguage && langEmbed[matchedLanguage] && langEmbed[matchedLanguage][textKey]) {
        const localizedText = langEmbed[matchedLanguage][textKey];
        console.log(`[Language] Found embedded text for key "${textKey}" in language "${matchedLanguage}": "${localizedText}"`);
        return localizedText;
      } else {
        console.log(`[Language] Text key "${textKey}" not found in embedded language "${matchedLanguage || 'none'}"`);
      }
    }
    
    // 如果内嵌中没有对应的键，尝试从 lang.url 获取语言映射
    if (window.Process.lang.url) {
      // 检查是否已经缓存了 URL 语言数据
      if (window.Process.lang.urlCache) {
        const urlLangs = Object.keys(window.Process.lang.urlCache);
        
        const matchedLang = this.findBestLanguageMatch(urlLangs, this.currentLanguage);
        
        // 如果找到了匹配的语言且文本键存在，返回本地化文本
        if (matchedLang && window.Process.lang.urlCache[matchedLang] && window.Process.lang.urlCache[matchedLang][textKey]) {
          const localizedText = window.Process.lang.urlCache[matchedLang][textKey];
          console.log(`[Language] Found URL text for key "${textKey}" in language "${matchedLang}": "${localizedText}"`);
          return localizedText;
        } else {
          console.log(`[Language] Text key "${textKey}" not found in URL language "${matchedLang || 'none'}"`);
        }
      } else {
        console.warn(`[Language] URL language cache is empty, trying to load data`);
        // 尝试动态加载当前语言的数据
        this.loadUrlLanguageData().then(() => {
          // 加载完成后，重新调用函数获取本地化文本
          return this.getLocalizedText(textKey);
        }).catch(error => {
          console.error(`[Language] Failed to load language data:`, error);
          // 不抛出错误，只记录错误信息，程序继续运行
        });
        // 返回原始文本，因为异步加载需要时间
        return textKey;
      }
    } else {
      console.log(`[Language] No URL language data configured`);
    }
    
    // 如果没有找到任何本地化文本，返回原始文本
    console.warn(`[Language] No localized text found for key "${textKey}", returning original text`);
    return textKey;
  }
  
  // 加载URL语言数据的函数
  async loadUrlLanguageData() {
    if (!window.Process || !window.Process.lang || !window.Process.lang.url) {
      return; // 如果没有URL，则不加载
    }
    
    try {
      // 初始化缓存
      if (!window.Process.lang.urlCache) {
        window.Process.lang.urlCache = {};
        console.log('[Language] Initialized URL language cache');
      }
      
      console.log(`[Language] Loading language data for "${this.currentLanguage}"`);
      
      // 检查是否为"all"配置
      if (window.Process.lang.url.all) {
        console.log('[Language] Detected "all" configuration, loading combined language file');
        
        // 如果已经缓存了所有语言数据，则不再加载
        if (Object.keys(window.Process.lang.urlCache).length > 0) {
          console.log('[Language] Combined language data already cached, skipping load');
          return;
        }
        
        // 加载包含所有语言数据的单一文件
        const url = window.Process.lang.url.all;
        console.log(`[Language] Loading combined language data from: ${url}`);
        
        const response = await fetch(url);
        if (response.ok) {
          const allLangData = await response.json();
          
          // 将数据按语言代码拆分到缓存中
          for (const [langCode, langData] of Object.entries(allLangData)) {
            if (typeof langData === 'object' && langData !== null) {
              window.Process.lang.urlCache[langCode] = langData;
              console.log(`[Language] Loaded language data for "${langCode}" from combined file`);
              console.log(`[Language] Available keys in "${langCode}": ${Object.keys(langData).join(', ')}`);
            }
          }
          
          console.log('[Language] Successfully loaded all language data from combined file');
        } else {
          console.error(`[Language] Failed to load combined language data from ${url}: HTTP ${response.status} ${response.statusText}`);
          // 不抛出错误，只记录错误信息，程序继续运行
        }
      } else {
        // 原有的单个语言文件加载逻辑
        let url;
        if (window.Process.lang.url && window.Process.lang.url[this.currentLanguage]) {
          // 如果有特定语言的URL，使用该URL
          url = window.Process.lang.url[this.currentLanguage];
          console.log(`[Language] Using specific URL for "${this.currentLanguage}": ${url}`);
        } else {
          // 否则使用基础URL加上语言代码
          const baseUrl = window.Process.lang.url;
          url = `${baseUrl}/${this.currentLanguage}.json`;
          console.log(`[Language] Using constructed URL for "${this.currentLanguage}": ${url}`);
        }
        
        // 如果已经缓存了当前语言的数据，则不再加载
        if (window.Process.lang.urlCache[this.currentLanguage]) {
          return;
        }
        
        // 获取语言数据
        const response = await fetch(url);
        if (response.ok) {
          const langData = await response.json();
          window.Process.lang.urlCache[this.currentLanguage] = langData;
          console.log(`[Language] Successfully loaded language data for "${this.currentLanguage}" from URL`);
          console.log(`[Language] Available keys in loaded data: ${Object.keys(langData).join(', ')}`);
        } else {
          console.error(`[Language] Failed to load language data from ${url}: HTTP ${response.status} ${response.statusText}`);
          // 不抛出错误，只记录错误信息，程序继续运行
        }
      }
    } catch (error) {
      console.error('[Language] Failed to load language data from URL:', error);
      // 不抛出错误，只记录错误信息，程序继续运行
    }
  }
  
  // 加载单个语言数据的辅助函数
  async loadSingleLanguageData(languageCode) {
    if (!window.Process || !window.Process.lang || !window.Process.lang.url) {
      return;
    }
    
    // 检查是否为"all"配置
    if (window.Process.lang.url.all) {
      console.log(`[Language] "all" configuration detected, skipping individual preload for "${languageCode}"`);
      return; // 在"all"配置下，单个语言预加载不需要执行
    }
    
    // 如果已经缓存了该语言的数据，则不再加载
    if (window.Process.lang.urlCache[languageCode]) {
      console.log(`[Language] Language data for "${languageCode}" already cached, skipping preload`);
      return;
    }
    
    try {
      // 从语言配置获取语言文件路径
      let url;
      if (window.Process.lang.url && window.Process.lang.url[languageCode]) {
        // 如果有特定语言的URL，使用该URL
        url = window.Process.lang.url[languageCode];
        console.log(`[Language] Using specific URL for "${languageCode}": ${url}`);
      } else {
        // 否则使用基础URL加上语言代码
        const baseUrl = window.Process.lang.url;
        url = `${baseUrl}/${languageCode}.json`;
        console.log(`[Language] Using constructed URL for "${languageCode}": ${url}`);
      }
      
      console.log(`[Language] Preloading language data for "${languageCode}" from: ${url}`);
      
      // 获取语言数据
      const response = await fetch(url);
      if (response.ok) {
        const langData = await response.json();
        window.Process.lang.urlCache[languageCode] = langData;
        console.log(`[Language] Successfully preloaded language data for "${languageCode}"`);
        console.log(`[Language] Available keys in preloaded data: ${Object.keys(langData).join(', ')}`);
      } else {
        console.error(`[Language] Failed to preload language data from ${url}: HTTP ${response.status} ${response.statusText}`);
        // 不抛出错误，只记录错误信息，程序继续运行
      }
    } catch (error) {
      console.error(`[Language] Failed to preload language data for "${languageCode}":`, error);
      // 不抛出错误，只记录错误信息，程序继续运行
    }
  }
  
  // 预加载所有可用语言数据的函数
  async preloadAllLanguageData() {
    if (!window.Process || !window.Process.lang || !window.Process.lang.url) {
      console.log('[Language] No URL language data configured, skipping preload');
      return; // 如果没有URL，则不加载
    }
    
    console.log('[Language] Starting preload of all language data');
    
    // 初始化缓存
    if (!window.Process.lang.urlCache) {
      window.Process.lang.urlCache = {};
      console.log('[Language] Initialized URL language cache for preload');
    }
    
    // 检查是否为"all"配置
    if (window.Process.lang.url.all) {
      console.log('[Language] "all" configuration detected, loading combined language file for preload');
      
      // 如果已经缓存了数据，则不再加载
      if (Object.keys(window.Process.lang.urlCache).length > 0) {
        console.log('[Language] Combined language data already cached, skipping preload');
        return;
      }
      
      // 加载包含所有语言数据的单一文件
      const url = window.Process.lang.url.all;
      console.log(`[Language] Preloading combined language data from: ${url}`);
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const allLangData = await response.json();
          
          // 将数据按语言代码拆分到缓存中
          for (const [langCode, langData] of Object.entries(allLangData)) {
            if (typeof langData === 'object' && langData !== null) {
              window.Process.lang.urlCache[langCode] = langData;
              console.log(`[Language] Preloaded language data for "${langCode}" from combined file`);
            }
          }
          
          console.log('[Language] Successfully preloaded all language data from combined file');
        } else {
          console.error(`[Language] Failed to preload combined language data from ${url}: HTTP ${response.status} ${response.statusText}`);
          // 不抛出错误，只记录错误信息，程序继续运行
        }
      } catch (error) {
        console.error('[Language] Failed to preload combined language data:', error);
        // 不抛出错误，只记录错误信息，程序继续运行
      }
      
      return; // 在"all"配置下，不需要执行原有的预加载逻辑
    }
    
    // 原有的单个语言文件预加载逻辑
    
    // 从语言配置获取需要预加载的语言列表
    let languagesToPreload = [];
    
    if (window.Process && window.Process.lang && window.Process.lang.available) {
      // 如果有可用语言列表，使用该列表
      languagesToPreload = window.Process.lang.available;
      console.log('[Language] Using available languages from configuration:', languagesToPreload);
    } else if (window.Process.lang.embed) {
      // 否则使用嵌入语言数据中的语言
      languagesToPreload = Object.keys(window.Process.lang.embed);
      console.log('[Language] Using embedded languages:', languagesToPreload);
    }
    
    // 确保包含当前语言和英语作为回退
    if (!languagesToPreload.includes(this.currentLanguage)) {
      languagesToPreload.push(this.currentLanguage);
    }
    if (!languagesToPreload.includes('en-US')) {
      languagesToPreload.push('en-US');
    }
    
    // 预加载所有语言
    for (const lang of languagesToPreload) {
      await this.loadSingleLanguageData(lang);
    }
    
    console.log('[Language] Completed preload of all language data');
  }
  
  // 更新当前语言
  setCurrentLanguage(languageCode) {
    this.currentLanguage = languageCode;
    window.selectedLanguageId = languageCode;
    console.log(`[Language] Current language set to: ${languageCode}`);
  }
  
  // 获取当前语言
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  
  // 清除语言缓存
  clearCache() {
    if (window.Process && window.Process.lang && window.Process.lang.urlCache) {
      window.Process.lang.urlCache = {};
      console.log('[Language] Language cache cleared');
    }
  }
}

// 创建LanguageManager实例
const languageManager = new LanguageManager();

// ========================================
// 资源加载与管理
// ========================================

// 预加载贴图
function preloadBaseTextures() {
  //动态检测需要预加载的方块
  const blockFunction = ['setblock', 'setblockfall', 'fill', 'fillfall'];
  const needBlock = [];

  for (const scene of window.Process.scenes) {
    if (!scene.fragment) continue;

    for (const fragment of scene.fragment) {
      if (!Array.isArray(fragment)) continue;

      for (const line of fragment) {
        if (line.startsWith('//')) continue;

        for (const func of blockFunction) {
          if (!line.includes(func)) continue;

          const match = line.match(new RegExp(`${func}\\s*\\(\\s*'([^']+)'`));
          if (match?.[1] && !needBlock.includes(match[1])) {
            needBlock.push(match[1]);
          }
        }
      }
    }
  }

  console.log('###########开始预加载贴图############');
  console.log(`需要预加载的方块数量: ${needBlock.length}`);

  for (const block of needBlock) {
    const texture = mcTextureLoader.load(block);
    if (texture) {
      console.log(`已加载纹理: ${block}`);
    } else {
      console.warn(`未能加载纹理: ${block}`);
    }
  }

  console.log('###############命令预加载完成###############');

  for (let i = 0; i < window.Process.scenes.length; i++) {
    const scene = window.Process.scenes[i];
    if (!scene.base) {
      console.log(`[PreloadBaseTexture] 场景${i+1}/${window.Process.scenes.length}没有base属性，跳过预加载`);
      continue;
    }
    Base.preloadTexture(i);
  }

  texturesLoaded = true;
  console.log('所有贴图预加载完成');
  console.log(`纹理缓存大小: ${mcTextureLoader.getCacheSize().textures}`);
  console.log(`模型缓存大小: ${mcTextureLoader.getCacheSize().models}`);
};

// 主要逻辑初始化：加载资源
const vanilla = (async () => {
  await Promise.all([
    loadFile('/ponder/engine/domdkw/v1/command.js', 'js', true, '<span class="file-tag mr y">vanilla.js</span>=><span class="file-tag mr ml y">command.js</span>加载命令文件'),
    mcSpriteAtlas.load(
      '/ponder/minecraft/textures/block/1.21.8.basic.atlas.json',
      '/ponder/minecraft/textures/block/1.21.8.basic.atlas.png',
      LoadingManager
    ),
    mcModelLoader.loadModelData('https://unpkg.com/minecraft-assets@1.17.0/minecraft-assets/data/1.21.8/blocks_models.json')
  ]);
   
  languageManager.preloadAllLanguageData();
  
  preloadBaseTextures();
});


// 加载管理器事件处理
LoadingManager.onLoad = async () => {//主要加载步骤
  // 加载完成后，渲染 CSS2D 元素
  console.log('[LoadingManager] loading CSS2DRender...');
  
  // 先加载 CSS2DRenderer 模块
  try {
    await loadTHREECSS2DRenderer();
    console.log('[LoadingManager] CSS2DRenderer finished.');
  } catch (error) {
    console.error('[LoadingManager] CSS2DRenderer error:', error);
    // 如果 CSS2DRenderer 加载失败，继续执行其他逻辑
  }

  console.log('[LoadingManager] 所有资源加载完成');
  setTimeout(async () => {
    loadingDiv.style.opacity = '0';
    // 从window.Process.sense中获取默认场景索引
    const defaultSceneIndex = window.Process.sense && window.Process.sense.length > 0 ? window.Process.sense[0] : 0;
    Base.Create.checkSet(defaultSceneIndex); // 使用sense中的第一个场景索引作为默认场景
    setTimeout(async () => {
      loadingDiv.style.display = 'none';
      if (texturesLoaded) {
        // 初始化片段播放
        initFragmentPlay();
      } else {
        console.warn('[LoadingManager] 纹理尚未加载完成，但继续初始化');
        // 即使纹理未加载完成，也尝试初始化片段播放
        initFragmentPlay();
      }
    }, 1000);
  }, 1000);
};

LoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const percentComplete = Math.round((itemsLoaded/itemsTotal)*100);
  lmopli.innerHTML = `<span class="file-tag mr y">总加载进度</span>=><span class="file-tag mr ml y">正在加载: ${url.split('/').pop()}</span> (${percentComplete}%)`;
  lmoprb.style.width = percentComplete + '%';
};

LoadingManager.onError = (url) => {console.error(`加载错误: ${url}`);};


// ========================================
// 场景创建与基础功能
// ========================================

// BASE基础场景
class BaseClass{
  set(sceneNum){
    const scene = window.Process.scenes[sceneNum];
    if(!scene || !scene.base) return;
    
    switch (scene.base.default) {
      case 'create':
        this.Create.checkSet(sceneNum);
        break;
      case 'meadow':
        this.meadow.set(scene.base.style);
        break;
      default:
        console.warn(`未处理的base默认值: ${scene.base.default}`);
        break;
    }
  }
  preloadTexture(sceneNum){//预加载场景的所有贴图
    const scene = window.Process.scenes[sceneNum];
    if(!scene || !scene.base) return;
    switch (scene.base.default) {
      case 'create':
        Base.Create.preloadTexture(window.Process.scenes[sceneNum].base.create, sceneNum);
        break;
      case 'meadow':
        Base.meadow.preloadTexture(window.Process.scenes[sceneNum].base.style);
        break;
      default:
        console.warn(`未处理的base默认值: ${window.Process.scenes[sceneNum].base.default}`);
        break;
    }
  }
  
  Create = {
    preloadTexture:(baseSetting, sceneNum) =>{//预加载场景的所有贴图
      switch (baseSetting.style) {
        case '5x5chessboard':
          // 尝试从精灵图中加载雪和粘土块
          if (mcSpriteAtlas.hasSprite('snow.png')) {
            loadedTexture['minecraft:snow_block'] = mcSpriteAtlas.getSpriteTexture('snow.png');
          }
          if (mcSpriteAtlas.hasSprite('clay.png')) {
            loadedTexture['minecraft:clay'] = mcSpriteAtlas.getSpriteTexture('clay.png');
          }
          console.log(`[PBT=>Base.Create] 场景${sceneNum+1}/${window.Process.scenes.length} Create:5x5chessboard: snow.png, clay.png`);
          break;
        default:
          console.warn(`[PBT=>Base.Create] 未处理的base样式: ${baseSetting.style}`);
          break;
      }
    },
    checkSet:(sceneNum) =>{//检查并创建CreateBase场景
      if(!window.Process.scenes[sceneNum].base) return;
      const baseSetting = window.Process.scenes[sceneNum].base.create;
      if(!baseSetting) return;
      //main -style
      if(!baseSetting.style) return;
      let cx = 0, cy = 0, cz = 0;
      if(baseSetting.offset){
        cx = baseSetting.offset.x;
        cy = baseSetting.offset.y;
        cz = baseSetting.offset.z;
      }
      switch(baseSetting.style){//根据style设置base
        case '5x5chessboard':
          const table = [[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],]
          for (let i = 0; i < table.length; i++) {
            const row = table[i];
            for (let j = 0; j < row.length; j++) {
              const cell = row[j];
              if(cell === 1){setblock('minecraft:snow_block', i+cx-2, cy, j+cz-2);}
              else{setblock('minecraft:clay', i+cx-2, cy, j+cz-2);}
            }
          }
          break;
      }
    }
  }
  meadow = {
    preloadTexture:(style) =>{
      const {surface} = style;
      
      loadedTexture['minecraft:grass_block'] = mcSpriteAtlas.getSpriteTexture('grass_block_top.png');
      
      // 预加载泥土方块贴图
      loadedTexture['minecraft:dirt'] = mcSpriteAtlas.getSpriteTexture('dirt.png');
      
      console.log(`[PBT=>Base.meadow] 预加载贴图: grass_block_top.png, dirt.png (surface=${surface})`);
    },
    set:(style) =>{
      const {size={x:4,y:1,z:4}, offset={x:0,y:0,z:0}, 'grass_block-surface':surface=true} = style;
      
      // 收集所有方块放置的Promise
      const promises = [];
      
      if(surface) {
        // 如果surface为true，grass_block的y=1，dirt的y=size.y-1
        if(size.y > 1) {
          // 如果size.y大于1，创建泥土层
          // 创建顶层草地方块
          fill('minecraft:grass_block', offset.x, offset.y, offset.z, offset.x+size.x, offset.y, offset.z+size.z);
          fill('minecraft:dirt', offset.x, offset.y-1, offset.z, offset.x+size.x, offset.y-1+size.y, offset.z+size.z);
        }else if(size.y === 1){
          fill('minecraft:grass_block', offset.x, offset.y, offset.z, offset.x+size.x, offset.y, offset.z+size.z);
        }
      } else {
        // 如果surface为false，dirt的y=0
        fill('minecraft:dirt', offset.x, offset.y, offset.z, offset.x+size.x, offset.y+size.y, offset.z+size.z);
      }
      
      // 返回所有Promise的聚合，当所有方块放置完成时resolve
      return Promise.all(promises);
    }
  }
}
const Base = new BaseClass();

// ========================================
// 工具函数与辅助方法
// ========================================

//缓动函数
class transition{
  static easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
  static easeOut(t) {
    return t * (2 - t);
  }
  static easeIn(t) {
    return t * t;
  }
  static linear(t) {
    return t;
  }
}

// 需要await的函数列表
const ffawait = ['idle(', 'tip(','moveCamera(false', 'cleanscene(false', 'tiparea('];

// ========================================
// 片段解析与播放控制
// ========================================

// 解析流程
function parseFragment(sceneNum){
  const scene = window.Process.scenes[sceneNum];
  if(!scene) return;
  if(!scene.fragment) return;
  fragmentTotal = scene.fragment.length;
  console.log(`场景${sceneNum}片段总数: ${fragmentTotal}`);
  
  // 强制删除旧的script元素，确保完全清理
  let script = document.getElementById('ponderSceneScript');
  if (script) {
    script.remove();
    script = null;
  }
  
  // 解析fragment
  let ffunctions = '';
  for(let i = 0; i < scene.fragment.length; i++){
    let command = '';
    const fragment = scene.fragment[i];
    //2025年11月15日，将片段函数改为生成器函数
    for(let j = 0; j < fragment.length; j++){
      // 区分同步异步
      const isAsyncCall = ffawait.some(func => {
        // 使用正则表达式检查是否包含函数调用，更灵活的匹配方式
        // 匹配函数名后跟括号的形式，允许前面有空格或其他字符
        const regex = new RegExp(`\\b${func.replace('(', '\\s*\\(')}`);
        return regex.test(fragment[j].trim());
      });
      // 检查是否包含函数调用
      if(isAsyncCall){
        command += 'yield ' + fragment[j] + ';\n';
      } else {
        command += fragment[j] + ';\n';
      }
    }
    ffunctions += 'function* ponderFragment'+i+'(){\n'+command+'};\n';
  }
  
  // 创建新的script元素
  script = document.createElement('script');
  script.id = 'ponderSceneScript';
  script.textContent = ffunctions;
  document.body.appendChild(script);
  
  console.log('解析command完成，已生成新的片段函数');
  //打印至terminal
  terminal.innerHTML += '<details><summary class="unselectable">片段函数</summary>'+ffunctions+'</details>';//折叠元素
}

// 创建自定义事件 - 片段播放完成
const fragmentCompleteEvent = new Event('fragmentComplete');
const sceneCompleteEvent = new Event('sceneComplete');

// 片段时间时钟类
class fragmentDateClock {
  //计量单位 scene(all fragments) fragment(one fragment)
  start(){
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.isPaused = false;
    this.pauseStartTime = null;
  }
  scene(){//返回相对于当前场景的时间
    if (this.isPaused) {
      return this.pauseStartTime - this.startTime - this.pausedTime;
    }
    return Date.now() - this.startTime - this.pausedTime;
  }
  fragment(){//返回相对于当前片段的时间
    // 计算前面所有片段的时间总和
    let previousFragmentsTime = 0;
    for(let i = 0; i < playState.currentFragment; i++){
      previousFragmentsTime += calculateTime.fragmentTime(i);
    }
    // 返回当前场景时间减去前面所有片段的时间总和
    return this.scene() - previousFragmentsTime * 1000; // 乘以1000将秒转换为毫秒
  }
  clear(){//重置时钟
    this.startTime = null;
    this.pausedTime = 0;
    this.isPaused = false;
    this.pauseStartTime = null;
  }
  pause(){
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseStartTime = Date.now();
  }
  resume(){
    if (!this.isPaused) return;
    this.isPaused = false;
    this.pausedTime += Date.now() - this.pauseStartTime;
    this.pauseStartTime = null;
  }
}

//!!! 片段播放函数
// 创建可取消的Promise包装器
function createCancellablePromise(promise) {
  let isCancelled = false;
  let cancelCallback = null;
  
  const cancellablePromise = new Promise(async (resolve, reject) => {
    try {
      const result = await promise;
      if (!isCancelled) {
        resolve(result);
      }
    } catch (error) {
      reject(new Error('Promise was cancelled'));
    }
  });
  
  cancellablePromise.cancel = () => {
    isCancelled = true;
    console.log('Promise已取消');
    
    // 如果有取消回调，调用它
    if (cancelCallback && typeof cancelCallback === 'function') {
      cancelCallback();
    }
  };
  
  // 设置取消回调
  cancellablePromise.setCancelCallback = (callback) => {
    cancelCallback = callback;
  };
  
  return cancellablePromise;
}

// 播放指定片段
async function playFragment(i) {
  // 每次播放片段时都重新获取函数引用，确保使用最新的函数定义
  const fragmentFunction = window['ponderFragment' + i];
  if (!fragmentFunction) {
    console.error(`未找到片段函数 ponderFragment${i}`);
    return;
  }
  
  // 创建新的生成器对象，确保使用最新的函数定义
  const generator = fragmentFunction();
  currentGenerator = generator; // 保存当前生成器到全局变量
  playState.isStopped = false;
  playState.isPlaying = true;
  
  // 存储当前可取消的Promise引用
  let currentPromise = null;
  
  // 执行片段函数
  while(!playState.isStopped){
    try {
      const {value, done} = generator.next();
      
      if (done) {
        // 片段执行完成，触发退出循环
        break;
      }
      
      // 如果有返回值且是 Promise，则等待它完成
      if (value instanceof Promise) {
        // 创建可取消的Promise
        currentPromise = createCancellablePromise(value);
        playState.currentPromise = currentPromise; // 存储到playState中，以便外部可以取消
        
        await currentPromise;
        
        // 检查是否在等待过程中被停止
        if (playState.isStopped) {
          console.log(`片段 ${i} 在异步操作中被停止`);
          return;
        }
      } else {
        console.log('Fragment returned value:', value);
      }
      
    } catch (error) {
      console.error(`执行片段 ${i} 时发生错误:`, error);
      break;
    }
  }
}

// 初始化片段播放
function initFragmentPlay(){//初始化每个场景的片段播放，每个场景只执行一次
  // 初始化片段时间时钟
  if (!fragmentClock) {
    fragmentClock = new fragmentDateClock();
  }
  
  // 解析当前场景的片段
  parseFragment(playState.currentScene);
  
  // 初始化场景基础
  Base.set(playState.currentScene);

  // 初始化播放状态
  playState.isPlaying = false;
  playState.isStopped = true;
  playState.currentFragment = 0;
  playState.progress = 0;
  playState.currentPromise = null; // 初始化当前Promise引用
  
  // 启动片段时间时钟
  fragmentClock.start();
  
  // 添加片段完成事件监听器
  window.addEventListener('fragmentComplete', handleFragmentComplete);
  window.addEventListener('sceneComplete', handleSceneComplete);
  
  // 开始播放第一个片段
  playFragment(playState.currentFragment);
  
  // 启动进度检查循环
  startProgressCheck();
}

// 处理片段完成事件
function handleFragmentComplete() {
  // 如果当前片段不是最后一个片段，则切换到下一个片段
  if(playState.currentFragment < fragmentTotal-1) {
    playState.currentFragment++;
    playState.isStopped = true;
    // 执行下一个片段
    playFragment(playState.currentFragment);
  } else {
    // 当前场景的所有片段播放完成
    window.dispatchEvent(sceneCompleteEvent);
  }
}

// 处理场景完成事件
function handleSceneComplete() {
  // 当前场景播放完成
  console.log(`场景 ${playState.currentScene} 播放完成`);
  
  // 如果自动播放开启且不是最后一个场景，则切换到下一个场景
  if (playState.autoPlay && playState.currentScene < sceneTotal-1) {
    switchToScene(playState.currentScene + 1);
  } else {
    // 停止播放
    playState.isPlaying = false;
    playState.isStopped = true;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
}

// 启动进度检查
function startProgressCheck() {
  // 取消之前的动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // 启动进度条
  ProgressBar.start();
  
  // 只需要检查片段切换，不需要更新进度条
  function checkProgress() {
    if (!playState.isPlaying) return;
    
    // 检查是否需要切换片段
    checkFragmentSwitch();
    
    // 继续下一帧检查
    animationFrameId = requestAnimationFrame(checkProgress);
  }
  
  // 开始检查
  animationFrameId = requestAnimationFrame(checkProgress);
}

// 场景总时间缓存
let sceneTotalTimeCache = null;

//进度条
const progressFill = document.getElementById('ponder-create-progress-fill');
const ProgressBar = {
  reset(){
    // 先移除过渡效果，立即归零
    progressFill.style.transitionDuration = '0.1s';
    progressFill.style.width = '0%';
    console.log('重置进度条');
  },
  start(){
    // 计算场景总时间并缓存
    sceneTotalTimeCache = calculateTime.sceneTotalTime();
    
    if (sceneTotalTimeCache > 0) {
      // 先移除过渡效果，立即归零
      progressFill.style.transitionDuration = '0.1s';
      progressFill.style.width = '0%';
      
      // 触发重排以确保立即归零生效
      void progressFill.offsetWidth;
      
      // 设置过渡时间为场景总时间，启动动画
      progressFill.style.transitionDuration = sceneTotalTimeCache+'s';
      progressFill.style.width = '100%';
    }
  },
  pause(){
    // 获取当前进度
    const currentWidth = window.getComputedStyle(progressFill).width;
    
    // 设置快速过渡效果（0.1秒）
    progressFill.style.transition = 'width 0.1s linear';
    
    // 保持当前进度
    progressFill.style.width = currentWidth;
  },
  resume(){
    // 获取当前进度
    const currentWidth = window.getComputedStyle(progressFill).width;
    const currentPercent = parseFloat(currentWidth) / parseFloat(window.getComputedStyle(progressFill.parentElement).width) * 100;
    
    // 使用缓存的总时间，避免重复计算
    const totalTime = sceneTotalTimeCache || calculateTime.sceneTotalTime();
    const remainingTime = totalTime * (1 - currentPercent / 100);
    
    if (remainingTime > 0) {
      // 设置剩余时间的过渡效果
      progressFill.style.transitionDuration = remainingTime+'s';
      progressFill.style.width = '100%';
    }
  }
}


// 切换到指定场景
function switchToScene(sceneNum) {
  // 验证场景索引是否有效
  if (sceneNum < 0 || sceneNum >= sceneTotal) {
    console.error(`场景索引 ${sceneNum} 超出范围 [0, ${sceneTotal-1}]`);
    return;
  }

  // 清理当前场景的区域
  let minX = 0, minY = 0, minZ = 0;
  let maxX = 0, maxY = 0, maxZ = 0;
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.type === 'Mesh') {
      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      minZ = Math.min(minZ, child.position.z);
      maxX = Math.max(maxX, child.position.x);
      maxY = Math.max(maxY, child.position.y);
      maxZ = Math.max(maxZ, child.position.z);
    }
  }

  // 更新播放状态
  playState.currentScene = sceneNum;
  playState.currentFragment = 0;
  playState.progress = 0;
  // 清除场景总时间缓存，因为场景已切换
  sceneTotalTimeCache = null;
  // 确保片段时间时钟已初始化
  if (!fragmentClock) {
    fragmentClock = new fragmentDateClock();
  }
  
  // 重置时钟
  fragmentClock.clear();
  fragmentClock.start();
  
  // 解析新场景的片段
  parseFragment(sceneNum);
  
  //setbase
  Base.set(sceneNum);
  
  // 重置进度条
  ProgressBar.reset();

  // 启动进度条(延迟0.1秒)
  setTimeout(() => {
    ProgressBar.start();
  }, 100);
  
  // 更新导航箭头的显示状态
  window.PonderUIManager.updateNavigationArrows();
  
  // 取消任何正在运行的异步操作
  if (playState.currentPromise) {
    playState.currentPromise.cancel();
    playState.currentPromise = null;
  }
  
  // 重置播放状态，确保新场景能正常播放
  playState.isStopped = false;
  playState.isPlaying = true;
  
  // 清理任何可能存在的暂停状态
  if (pausedGenerator) {
    pausedGenerator = null;
  }
  if (pausedPromise) {
    pausedPromise = null;
  }
  
  //promise完成后清理区域
  removearea(minX, minY, minZ, maxX, maxY, maxZ);
  console.log('清理场景', sceneNum, '的区域');

  // 立即播放新场景的第一个片段
  playFragment(playState.currentFragment);
}

// 切换到上一个场景
function previousScene() {
  if (playState.currentScene > 0) {
    switchToScene(playState.currentScene - 1);
  }
}

// 切换到下一个场景
function nextScene() {
  if (playState.currentScene < sceneTotal - 1) {
    switchToScene(playState.currentScene + 1);
  }
}

// 切换慢速模式
function toggleSlowMode() {
  playState.slowMode = !playState.slowMode;
}

// 重新播放当前场景
function replayScene() {
  // 重置到当前场景的开始
  switchToScene(playState.currentScene);
}

// 检查是否需要切换片段
function checkFragmentSwitch(){//检查是否需要切换片段
  // 使用片段时间时钟检查当前片段是否已播放完成
  const currentFragmentTime = fragmentClock.fragment() / 1000; // 转换为秒
  const currentFragmentDuration = calculateTime.fragmentTime(playState.currentFragment);
  
  // 如果当前片段播放时间超过预估持续时间，且不是最后一个片段，则触发片段完成事件
  if(playState.currentFragment < fragmentTotal-1 && currentFragmentTime >= currentFragmentDuration){
    // 触发片段完成事件
    window.dispatchEvent(fragmentCompleteEvent);
  }
}

// 计算 ponderFragment(x) 函数中所有函数将会使用的时间
class CalculateTime{
  fragmentTime(fragmentNum) {
    // 通过fragmentNum获取对应的函数
    const fragmentFunction = window['ponderFragment'+fragmentNum];
    if(!fragmentFunction){
      console.error(`未找到ponderFragment${fragmentNum}函数`);
      return 0;
    }
    // 将函数转换为字符串
    const functionString = fragmentFunction.toString();
    
    // 提取函数体
    const functionBody = functionString.match(/{([\s\S]*)}/)[1];
  
    // 按行分割函数体
    const lines = functionBody.split('\n');
    
    let totalTime = 0;
    
    // 定义每个函数的执行时间（秒）
    const functionTimes = {
      'idle': (params) => {
        // idle(duration) - 执行时间为指定的秒数
        const duration = parseFloat(params[0]);
        return isNaN(duration) ? 0 : duration;
      },
      'setblock': () => 0, // 立即执行，时间为 0
      'setblockfall': (params) => {
        // setblockfall(block, x, y, z, duration) - 执行时间为 duration 秒
        // 注意：多个setblockfall通常是并行执行的，所以只计算一次
        const duration = parseFloat(params[4]);
        return isNaN(duration) ? 0 : duration;
      },
      'fill': () => 0, // 立即执行，时间为 0
      'fillfall': (params) => {
        // fillfall(block, x1, y1, z1, x2, y2, z2, duration) - 执行时间为 duration 秒
        // 虽然fillfall函数内部调用多个setblockfall，但它们是并行执行的，所以只计算一次duration
        const duration = parseFloat(params[7]);
        return isNaN(duration) ? 0 : duration;
      },
      'tip': (params) => {
        // tip(x, y, z, text, color, duration) - 执行时间为 duration + 1 秒
        // 包括：边框动画(0.5秒) + 文本显示(duration) + 文本淡出(0.5秒)
        const duration = parseFloat(params[5]);
        return (isNaN(duration) ? 0 : duration) + 1;
      },
      'tiparea': (params) => {
        // tiparea(x1, y1, z1, x2, y2, z2, text, color, duration) - 执行时间为 duration + 1 秒
        // 包括：边框动画(0.5秒) + 文本显示(duration) + 文本淡出(0.5秒)
        const duration = parseFloat(params[8]);
        return (isNaN(duration) ? 0 : duration) + 1;
      },
      'moveCamera': (params) => {
        // moveCamera(isAsync, x, y, z, duration) - 执行时间为 duration 秒
        // 只有当第一个参数为 'false' 或 false 时，才需要等待并计算时间
        const duration = parseFloat(params[4]);
        const needsWait = params[0] === 'false' || params[0] === false;
        return needsWait ? (isNaN(duration) ? 0 : duration) : 0;
      },
      'removeblockup': (params) => {
        // removeblockup(x, y, z, duration) - 执行时间为 duration 秒
        const duration = parseFloat(params[3]);
        return isNaN(duration) ? 0 : duration;
      },
      'removeareaup': (params) => {
        // removeareaup(x1, y1, z1, x2, y2, z2, duration) - 执行时间为 duration 秒
        const duration = parseFloat(params[6]);
        return isNaN(duration) ? 0 : duration;
      },
      'cleanscene': (params) => {
        // cleanscene(isAsync) - 特殊处理，内部调用 removeareaup
        // 特殊处理：检查是否有默认 duration 参数
        const hasDuration = params.length > 1 && !isNaN(parseFloat(params[1]));
        const duration = hasDuration ? parseFloat(params[1]) : 1; // 默认 1 秒
        return duration;
      },
      'removeblock': () => 0, // 立即执行，时间为 0
      'removearea': () => 0, // 立即执行，时间为 0
      'moveBlock': (params) => {
        // moveBlock(startX, startY, startZ, targetX, targetY, targetZ, duration) - 执行时间为 duration 秒
        const duration = parseFloat(params[6]);
        return isNaN(duration) ? 0 : duration;
      },
      'fadeBlock': (params) => {
        // fadeBlock(x, y, z, startOpacity, endOpacity, duration) - 执行时间为 duration 秒
        const duration = parseFloat(params[5]);
        return isNaN(duration) ? 0 : duration;
      }
    };
    
    // 遍历每一行
    for (const line of lines) {
      // 去除行首尾的空白字符
      const trimmedLine = line.trim();
      
      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        continue;
      }
      
      // 检查是否包含函数调用
      for (const [funcName, timeCalculator] of Object.entries(functionTimes)) {
        // 创建正则表达式来匹配函数调用
        const regex = new RegExp(`${funcName}\\s*\\(([^)]*)\\)`);
        const match = trimmedLine.match(regex);
        
        if (match) {
          // 提取参数
          const params = match[1].split(',').map(param => param.trim());
          
          // 根据ffawait数组判断是否需要await
          let needsAwait = false;
          
          // 检查是否匹配ffawait数组中的任何模式
          for (const awaitPattern of ffawait) {
            // 使用正则表达式检查是否匹配
            const regex = new RegExp(`\\b${awaitPattern.replace('(', '\\s*\\(')}`);
            if (regex.test(trimmedLine)) {
              needsAwait = true;
              break;
            }
          }
          
          // 计算函数执行时间
          const time = timeCalculator(params);
          
          // 只有需要await的函数才累加时间
          if (needsAwait) {
            totalTime += time;
          }
          
          break; // 跳出循环，避免重复计算
        }
      }
    }
    
    return totalTime;
  }
  // 计算并缓存场景总时间
  sceneTotalTime() {
    let totalSceneTime = 0;
    for(let i = 0; i < fragmentTotal; i++) {
      totalSceneTime += this.fragmentTime(i);
    }
    console.log('当前场景总时间:',totalSceneTime);
    sceneTotalTimeCache = totalSceneTime;
    return totalSceneTime;
  }
}
const calculateTime = new CalculateTime();

// 全局变量，用于保存和恢复播放状态
let pausedGenerator = null;
let pausedFragmentIndex = -1;
let pausedPromise = null;
let currentGenerator = null; // 当前正在执行的生成器

// 动画暂停器类 - 专门负责动画的暂停和恢复
class AnimationPauser {
  constructor() {
    this.isPaused = false;
    this.pausedTime = 0;
    this.pauseStartTime = null;
  }
  
  // 暂停动画播放
  pause() {
    if (this.isPaused) return;
    
    console.log('AnimationPauser: 暂停动画播放');
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    
    // 保存当前播放状态
    if (playState.isPlaying) {
      // 保存生成器状态
      pausedGenerator = currentGenerator;
      pausedFragmentIndex = playState.currentFragment;
      
      // 保存当前Promise（如果有）
      pausedPromise = playState.currentPromise;
      
      // 暂停动画播放
      playState.isPlaying = false;
      playState.isStopped = true;
      
      // 取消动画帧循环
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      // 暂停片段时间时钟
      if (fragmentClock && typeof fragmentClock.pause === 'function') {
        fragmentClock.pause();
      }
      
      // 如果有正在执行的Promise，尝试取消它
      if (pausedPromise && typeof pausedPromise.cancel === 'function') {
        console.log('AnimationPauser: 取消当前执行的Promise');
        pausedPromise.cancel();
      }
    }
  }
  
  // 恢复动画播放
  resume() {
    if (!this.isPaused) return;
    
    console.log('AnimationPauser: 恢复动画播放');
    this.isPaused = false;
    
    // 计算暂停时长并更新暂停时间
    if (this.pauseStartTime) {
      this.pausedTime += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }
    
    // 恢复播放状态
    playState.isPlaying = true;
    playState.isStopped = false;
    
    // 恢复片段时间时钟
    if (fragmentClock && typeof fragmentClock.resume === 'function') {
      fragmentClock.resume();
    }
    
    // 重新启动动画
    if (pausedFragmentIndex >= 0) {
      // 如果存在保存的生成器，则继续执行
      if (pausedGenerator) {
        currentGenerator = pausedGenerator;
        // 使用 setTimeout 确保异步执行
        setTimeout(async () => {
          try {
            // 继续执行当前片段，并获取执行结果
            const completed = await continueFragmentExecution();
            
            // 检查是否需要继续下一个片段
            if (completed && !playState.isStopped && playState.isPlaying) {
              // 片段正常完成，触发片段完成事件以继续下一个片段
              window.dispatchEvent(fragmentCompleteEvent);
            } else if (!playState.isStopped && playState.isPlaying) {
              // 片段未完成或被停止，继续进度检查
              if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
              }
              startProgressCheck();
            }
          } catch (error) {
            console.error('AnimationPauser: 恢复动画时发生错误:', error);
            // 发生错误时，尝试重新播放当前片段
            playFragment(pausedFragmentIndex);
          }
        }, 100);
      } else {
        // 否则重新播放当前片段
        setTimeout(() => {
          playFragment(pausedFragmentIndex);
        }, 100);
      }
    }
    
    // 清理保存的状态
    pausedGenerator = null;
    pausedFragmentIndex = -1;
    pausedPromise = null;
  }
}

class IdentifyMode {
  constructor() {
    this.isActive = false;
    this.animationPauser = new AnimationPauser();
    
    // 性能优化：复用对象，避免频繁创建
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.currentPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    
    // 状态管理
    this.highlightedBlock = null;
    this.highlightOutline = null;
    this.labelRenderer = null;
    this.blockLabel = null;
    
    // 动画控制
    this.animationFrameId = null;
    this.identifyRenderLoopId = null;
    this.animationStartTime = null;
    this.animationDuration = 200; // 0.2秒
    
    // 事件处理
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    this.clickHandler = this.handleClick.bind(this);
    
    // 性能优化：缓存场景中的方块列表，避免每次射线检测都过滤
    this.cachedBlocks = null;
    this.lastBlockFilterTime = 0;
    this.BLOCK_FILTER_CACHE_DURATION = 1000; // 缓存1秒
    
    // 性能优化：节流鼠标移动事件
    this.lastMouseMoveTime = 0;
    this.MOUSE_MOVE_THROTTLE = 16; // 约60fps
    
    // 性能优化：动画状态标志
    this.isAnimating = false;
  }
  
  run() {
    if (this.isActive) return;
    
    console.log('IdentifyMode: 开始识别模式，暂停动画播放');
    this.isActive = true;
    
    // 使用动画控制器暂停动画播放
    this.animationPauser.pause();
    
    // 初始化CSS2DRenderer
    this.initCSS2DRenderer();
    
    // 添加鼠标事件监听器
    renderer.domElement.addEventListener('mousemove', this.mouseMoveHandler);
    renderer.domElement.addEventListener('click', this.clickHandler);
    
    // 设置鼠标样式
    renderer.domElement.style.cursor = 'crosshair';
    
    // 启动识别模式的渲染循环
    this.startIdentifyRenderLoop();
  }
  
  stop() {
    if (!this.isActive) return;
    
    console.log('IdentifyMode: 结束识别模式，恢复动画播放');
    this.isActive = false;
    
    // 移除鼠标事件监听器
    renderer.domElement.removeEventListener('mousemove', this.mouseMoveHandler);
    renderer.domElement.removeEventListener('click', this.clickHandler);
    
    // 恢复鼠标样式
    renderer.domElement.style.cursor = 'default';
    
    // 停止所有动画
    this.stopAnimation();
    
    // 清除高亮效果和标签
    this.clearHighlight();
    
    // 停止识别模式的渲染循环
    this.stopIdentifyRenderLoop();
    
    // 清理缓存
    this.cachedBlocks = null;
    
    // 使用动画控制器恢复动画播放
    this.animationPauser.resume();
  }
  
  startIdentifyRenderLoop() {
    if (this.identifyRenderLoopId) {
      cancelAnimationFrame(this.identifyRenderLoopId);
    }
    
    const renderLoop = () => {
      if (!this.isActive) return;
      
      // 渲染WebGL场景
      renderer.render(scene, camera);
      
      // 渲染CSS2D标签（如果可用）
      if (this.labelRenderer) {
        this.labelRenderer.render(scene, camera);
      }
      
      // 继续下一帧
      this.identifyRenderLoopId = requestAnimationFrame(renderLoop);
    };
    
    this.identifyRenderLoopId = requestAnimationFrame(renderLoop);
  }
  
  stopIdentifyRenderLoop() {
    if (this.identifyRenderLoopId) {
      cancelAnimationFrame(this.identifyRenderLoopId);
      this.identifyRenderLoopId = null;
    }
  }
  
  startSmoothAnimation() {
    this.stopAnimation();
    this.isAnimating = true;
    
    const animate = () => {
      if (!this.isAnimating || !this.isActive) {
        this.animationFrameId = null;
        return;
      }
      
      const elapsed = Date.now() - this.animationStartTime;
      const progress = Math.min(elapsed / this.animationDuration, 1);
      const easedProgress = transition.easeInOut(progress);
      
      // 平滑插值位置
      this.currentPosition.lerpVectors(this.currentPosition, this.targetPosition, easedProgress);
      
      // 更新边框位置
      if (this.highlightOutline) {
        this.highlightOutline.position.copy(this.currentPosition);
      }
      
      // 更新标签位置
      if (this.blockLabel) {
        this.blockLabel.position.copy(this.currentPosition);
        this.blockLabel.position.y += 0.8;
      }
      
      // 如果动画未完成，继续下一帧
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.animationFrameId = null;
      }
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
  }
  
  initCSS2DRenderer() {
    if (this.labelRenderer) return; // 已经初始化
    
    if (window.CSS2DRenderer) {
      // 创建CSS2DRenderer实例
      this.labelRenderer = new window.CSS2DRenderer();
      
      // 设置CSS2DRenderer的DOM元素
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer.domElement.style.position = 'absolute';
      this.labelRenderer.domElement.style.top = '0px';
      this.labelRenderer.domElement.style.pointerEvents = 'none';
      this.labelRenderer.domElement.style.zIndex = '12';
      
      // 将CSS2DRenderer的DOM元素添加到页面中
      document.body.appendChild(this.labelRenderer.domElement);
      
      console.log('CSS2DRenderer 已初始化');
    } else {
      console.warn('CSS2DRenderer 未找到，标签显示功能将不可用');
    }
  }
  
  handleMouseMove(event) {
    if (!this.isActive) return;
    
    // 性能优化：节流鼠标移动事件
    const now = performance.now();
    if (now - this.lastMouseMoveTime < this.MOUSE_MOVE_THROTTLE) {
      return;
    }
    this.lastMouseMoveTime = now;
    
    // 计算鼠标在归一化设备坐标中的位置
    const rect = renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // 执行射线检测
    this.performRaycast();
  }
  
  handleClick(event) {
    if (!this.isActive) return;
    
    // 点击时显示方块详细信息
    if (this.highlightedBlock) {
      console.log('点击方块:', this.highlightedBlock.name, '位置:', this.highlightedBlock.position);
    }
  }
  
  // 性能优化：缓存方块列表
  getCachedBlocks() {
    const now = performance.now();
    
    // 如果缓存有效，直接返回
    if (this.cachedBlocks && (now - this.lastBlockFilterTime < this.BLOCK_FILTER_CACHE_DURATION)) {
      return this.cachedBlocks;
    }
    
    // 重新过滤并缓存
    this.cachedBlocks = scene.children.filter(child => child.type === 'Mesh');
    this.lastBlockFilterTime = now;
    
    return this.cachedBlocks;
  }
  
  performRaycast() {
    // 更新射线投射器
    this.raycaster.setFromCamera(this.mouse, camera);
    
    // 使用缓存的方块列表
    const blocks = this.getCachedBlocks();
    
    // 执行射线检测
    const intersects = this.raycaster.intersectObjects(blocks);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.highlightBlock(intersect.object);
    } else {
      this.clearHighlight();
    }
  }
  
  highlightBlock(block) {
    if (this.highlightedBlock === block) return;
    
    // 设置当前高亮方块
    this.highlightedBlock = block;
    
    // 如果边框不存在，创建边框
    if (!this.highlightOutline) {
      this.createHighlightOutline(block);
      this.currentPosition.copy(block.position);
      this.targetPosition.copy(block.position);
    } else {
      // 更新目标位置
      this.targetPosition.copy(block.position);
      this.animationStartTime = Date.now();
      
      // 启动动画
      this.startSmoothAnimation();
    }
    
    // 显示方块类型标签
    this.showBlockLabel(block);
  }
  
  createHighlightOutline(block) {
    // 创建边框几何体 - 使用BoxGeometry而不是block.geometry来避免共享问题
    const outlineGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02); // 稍微放大一点以包裹方块
    const edges = new THREE.EdgesGeometry(outlineGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffff00, 
      linewidth: 5,
      transparent: true,
      opacity: 0.8
    });
    
    this.highlightOutline = new THREE.LineSegments(edges, outlineMaterial);
    this.highlightOutline.position.copy(block.position);
    scene.add(this.highlightOutline);
  }
  
  showBlockLabel(block) {
    if (!this.labelRenderer) return;
    
    // 获取方块坐标
    const x = Math.floor(block.position.x);
    const y = Math.floor(block.position.y);
    const z = Math.floor(block.position.z);
    
    // 如果标签已存在，只更新内容
    if (this.blockLabel) {
      this.blockLabel.element.innerHTML = `
        <div style="margin-bottom: 2px; font-size: 10px; color: #cccccc;">坐标: (${x}, ${y}, ${z})</div>
        <div>${block.name}</div>
      `;
      return;
    }
    
    // 创建标签元素
    const labelDiv = document.createElement('div');
    labelDiv.className = 'block-label';
    labelDiv.innerHTML = `
      <div style="margin-bottom: 2px; font-size: 10px; color: #cccccc;">坐标: (${x}, ${y}, ${z})</div>
      <div>${block.name}</div>
    `;
    labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    labelDiv.style.color = '#ffffff';
    labelDiv.style.padding = '4px 8px';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.fontFamily = 'Arial, sans-serif';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.border = '1px solid rgba(255, 255, 0, 0.5)';
    labelDiv.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    labelDiv.style.textAlign = 'center';
    
    // 创建CSS2D对象
    this.blockLabel = new window.CSS2DObject(labelDiv);
    this.blockLabel.position.copy(block.position);
    this.blockLabel.position.y += 0.8; // 在方块上方显示
    scene.add(this.blockLabel);
    
    // 确保CSS2DRenderer在渲染循环中更新
    if (this.labelRenderer && this.labelRenderer.domElement) {
      this.labelRenderer.domElement.style.zIndex = '20';
    }
  }
  
  clearHighlight() {
    // 停止动画
    this.stopAnimation();
    
    // 移除边框高亮
    if (this.highlightOutline) {
      scene.remove(this.highlightOutline);
      this.highlightOutline.geometry.dispose();
      this.highlightOutline.material.dispose();
      this.highlightOutline = null;
    }
    
    // 移除标签
    if (this.blockLabel) {
      scene.remove(this.blockLabel);
      this.blockLabel = null;
    }
    
    this.highlightedBlock = null;
  }
}

// 继续执行片段（从暂停的位置继续）
async function continueFragmentExecution() {
  if (!currentGenerator) {
    console.error('没有可继续执行的生成器');
    return false; // 返回 false 表示执行失败
  }
  
  playState.isStopped = false;
  playState.isPlaying = true;
  
  // 存储当前可取消的Promise引用
  let currentPromise = null;
  
  try {
    // 继续执行片段函数
    while(!playState.isStopped){
      const {value, done} = currentGenerator.next();
      
      if (done) {
        // 片段执行完成，返回 true 表示正常完成
        console.log('片段执行完成');
        return true;
      }
      
      // 如果有返回值且是 Promise，则等待它完成
      if (value instanceof Promise) {
        // 创建可取消的Promise
        currentPromise = createCancellablePromise(value);
        playState.currentPromise = currentPromise; // 存储到playState中，以便外部可以取消
        
        try {
          await currentPromise;
          
          // 检查是否在等待过程中被停止
          if (playState.isStopped) {
            console.log(`片段在异步操作中被停止`);
            return false; // 返回 false 表示被停止
          }
        } catch (error) {
          if (error.message && error.message.includes('cancelled')) {
            console.log('片段操作被取消');
            return false;
          } else {
            console.error('片段异步操作出错:', error);
            throw error;
          }
        }
      } else {
        console.log('Fragment returned value:', value);
      }
    }
  } catch (error) {
    console.error(`执行片段时发生错误:`, error);
    // 发生错误时，重置播放状态
    playState.isStopped = true;
    playState.isPlaying = false;
    return false; // 返回 false 表示出错
  }
  
  return false; // 返回 false 表示被停止
}

const identifyMode = new IdentifyMode();



// ========================================
// UI 交互与按钮管理
// ========================================

// 将场景控制函数暴露到全局作用域，以便HTML中的按钮可以调用
window.previousScene = previousScene;
window.nextScene = nextScene;
window.switchToScene = switchToScene;
window.replayScene = replayScene;
window.toggleSlowMode = toggleSlowMode;

class PonderUIManager {
  constructor() {
    this.buttons = {};
    this.currentState = 'idle';
    this.init();
  }
  
  init() {
    // 获取所有按钮
    const buttons = document.querySelectorAll('.ponder-button');
    buttons.forEach(button => {
      const id = button.id;
      this.buttons[id] = button;
      
      // 添加事件监听器
      button.addEventListener('click', (e) => this.handleClick(e, button));
    });
    
    // 添加快捷键支持
    this.initShortcuts();
  }
    
  handleClick(event, button) {
    event.preventDefault();
    const buttonId = button.id;
    
    switch(buttonId) {
      case 'ponder-create-btn-explore':
        this.toggleIdentifyMode();
        break;
      case 'ponder-create-btn-left':
        this.previousScene();
        break;
      case 'ponder-create-btn-close':
        this.closePonderUI();
        break;
      case 'ponder-create-btn-right':
        this.nextScene();
        break;
      case 'ponder-create-btn-replay':
        this.replayScene();
        break;
      case 'ponder-create-btn-slow-mode':
        this.toggleSlowMode();
        break;
      case 'ponder-create-btn-developer-mode':
        this.toggleDeveloperMode();
        break;
    }
  }
  
  initShortcuts() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toUpperCase();
      
      switch(key) {
        case 'Q': // 扫描
          document.getElementById('ponder-create-btn-explore')?.click();
          break;
        case 'A': // 左箭头
          document.getElementById('ponder-create-btn-left')?.click();
          break;
        case 'E': // 关闭
          document.getElementById('ponder-create-btn-close')?.click();
          break;
        case 'D': // 右箭头
          document.getElementById('ponder-create-btn-right')?.click();
          break;
        case 'S': // 重播
          document.getElementById('ponder-create-btn-replay')?.click();
          break;
      }
    });
  }
  
  toggleIdentifyMode() {
    const scanButton = document.getElementById('ponder-create-btn-explore');
    scanButton.classList.toggle('flash');
    if (scanButton.classList.contains('flash')) {
      identifyMode.run();
    } else {
      identifyMode.stop();
    }
  }
  
  previousScene() {
    if (window.previousScene) {
      window.previousScene();
    }
  }
  
  nextScene() {
    if (window.nextScene) {
      window.nextScene();
    }
  }
  
  closePonderUI() {
    console.log('关闭Ponder UI');
    // 这里可以添加关闭逻辑
  }
  
  replayScene() {
    if (window.replayScene) {
      window.replayScene();
    }
  }
  
  toggleSlowMode() {
    if (window.toggleSlowMode) {
      window.toggleSlowMode();
    }
    const slowModeButton = document.getElementById('ponder-create-btn-slow-mode');
    slowModeButton.classList.toggle('active');
  }
  
  updateProgressBar(progress) {
    const progressFill = document.getElementById('ponder-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${progress * 100}%`;
    }
    
  }
  //通过CSS class检查
  toggleDeveloperMode() {
    const developerModeButton = document.getElementById('ponder-create-btn-developer-mode');
    const isActive = developerModeButton.classList.contains('active');
    developerModeButton.classList.toggle('active');
    developerModeButton.querySelector('.ponder-button-tag').textContent = isActive ? '切换为开发者' : '切换为用户';
    developerModeUI.terminal(!isActive); // 修复：传入切换后的状态
  }
  
  // 显示/隐藏用户模式按钮
  setEditingMode(active) {
    const developerModeButton = document.getElementById('ponder-create-btn-developer-mode');
    if (developerModeButton) {
      developerModeButton.style.display = active ? 'block' : 'none';
    }
  }

  // 渲染PonderUI
  renderPonderUI() {
    const buttonSize = '50';
    const WW = window.innerWidth;
    const WH = window.innerHeight;
    const ponderControlButtons = document.getElementById('ponder-control-buttons').querySelectorAll('.ponder-button');
    ponderControlButtons.forEach(button => {
      if (!button.id) return;
      switch(button.id) {
        case 'ponder-create-btn-explore':
          button.style.left = `${WW / 2 - buttonSize*4.5}px`;
          break;
        case 'ponder-create-btn-left':
          button.style.left = `${WW / 2 - buttonSize*2}px`;
          break;
        case 'ponder-create-btn-close':
          button.style.left = `${WW / 2 - buttonSize/2}px`;
          break;
        case 'ponder-create-btn-right':
          button.style.left = `${WW / 2 + buttonSize*1}px`;
          break;
        case 'ponder-create-btn-replay':
          button.style.left = `${WW / 2 + buttonSize*3}px`;
          break;
        case 'ponder-create-btn-slow-mode':
          button.style.right = '64px';
          break;
        case 'ponder-create-btn-developer-mode':
          button.style.right = '12px';
          break;
      }
    });
  }

  // 更新导航箭头的显示状态
  updateNavigationArrows() {
    const leftArrow = document.getElementById('ponder-create-btn-left');
    const rightArrow = document.getElementById('ponder-create-btn-right');
    
    if (!leftArrow || !rightArrow) {
      console.warn('导航箭头按钮未找到');
      return;
    }
    
    // 如果是第一个场景，隐藏左箭头
    if (playState.currentScene <= 0) {
      leftArrow.style.display = 'none';
    } else {
      leftArrow.style.display = 'block';
    }
    
    // 如果是最后一个场景，隐藏右箭头
    if (playState.currentScene >= sceneTotal - 1) {
      rightArrow.style.display = 'none';
    } else {
      rightArrow.style.display = 'block';
    }
  }
}

const developerModeUI = {
  terminal(active) {
    terminal.style.display = active ? 'block' : 'none';
  }
}

// 创建PonderUIManager实例并暴露到全局
window.PonderUIManager = new PonderUIManager();

// 初始化UI渲染
window.PonderUIManager.renderPonderUI();

// 初始化导航箭头状态
window.PonderUIManager.updateNavigationArrows();

window.addEventListener('resize', window.PonderUIManager.renderPonderUI());

// 全局精灵图管理器实例
const mcSpriteAtlas = new MCSpriteAtlas();
// 全局纹理加载器实例
const mcTextureLoader = new MCTextureLoader();
// 全局模型加载器实例
const mcModelLoader = new MCModelLoader();
// 启动Ponder引擎
window.onload = vanilla();