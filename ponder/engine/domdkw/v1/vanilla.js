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

// 预定义变量
let MCTextureMap;

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
let textureUrl = {};
let texturesLoaded = false;
let textureLoadPromises = [];

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

// ========================================
// 资源加载与管理
// ========================================

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


// 主要逻辑初始化
(async () => {
  //等待THREE.LoadingManager加载完成
  const index = window.Process.loader.indexes;
  if (!index) return;
  let [, mtm, command] = await Promise.all([
    loadTHREECSS2DRenderer(),
    loadFile(index, 'json', true, `<span class="file-tag mr y">vanilla.js</span>=><span class="file-tag mr ml y">${index}</span>加载贴图映射文件`),
    loadFile('/ponder/engine/domdkw/v1/command.js', 'js', true, '<span class="file-tag mr y">vanilla.js</span>=><span class="file-tag mr ml y">command.js</span>加载命令文件')
  ]);
  window.MCTextureMap = mtm;
  
  // 预加载语言数据
  languageManager.preloadAllLanguageData();
  
  startPreload();
})();
#等待更改
// 定义 MCTextureLoader 类
const MCTextureLoader = {
  load(block, variant = null){
    // 检查 MCTextureMap 是否已定义且包含该方块
    if(block in window.MCTextureMap) {
      switch (window.MCTextureMap[block].type) {
        case 6:
          // 对于类型6，直接返回贴图
          if (loadedTexture[block]) {
            return loadedTexture[block];
          } else {
            console.warn(`未找到贴图 ${block}，当前已加载的贴图:`, Object.keys(loadedTexture));
            return null;
          }
        case 'x':
          // 对于类型'x'，直接返回贴图
          if (loadedTexture[block]) {
            return loadedTexture[block];
          } else {
            console.warn(`未找到贴图 ${block}，当前已加载的贴图:`, Object.keys(loadedTexture));
            return null;
          }
        case 'd':
          // 对于类型'd'，使用 d 方法处理
          return MCTextureLoader.d(MCTextureMap[block].map, block);
        default:
          // 默认情况，尝试返回贴图
          if (loadedTexture[block]) {
            return loadedTexture[block];
          } else {
            console.warn(`未找到贴图 ${block}，当前已加载的贴图:`, Object.keys(loadedTexture));
            return null;
          }
      }//switch
    } else {
      // 如果没有找到贴图，返回 null
      console.warn(`未找到贴图 ${block}，当前已加载的贴图:`, Object.keys(loadedTexture));
      return null;
    }
  },
  
  d(map, block) {
    // 对于类型"d"，map是一个数组，需要特殊处理
    // 这里假设数组的第一个元素是顶面贴图，第二个是侧面贴图
    if (Array.isArray(map) && map.length >= 2) {
      // 在实际实现中，可能需要创建一个组合贴图或者返回特定的贴图
      // 目前我们返回第一个贴图作为示例
      if (loadedTexture[block]) {
        return loadedTexture[block];
      } else {
        console.warn(`未找到贴图 ${block}，当前已加载的贴图:`, Object.keys(loadedTexture));
        return null;
      }
    }
    // 如果不是预期的数组格式，直接返回
    return map;
  }
}

// 预加载贴图
function startPreload() {
  const needBlock = window.Process.loader.block;
  if(needBlock){
    console.log('###########已预加载贴图############');
    for (const block of needBlock) {
      console.log(block);
      if(!(block in window.MCTextureMap)) {//如果方块不在贴图映射中
        console.warn(`方块 ${block} 不在贴图映射中`);
        continue;
      }
      const blockName = block.split(':')[1];//取:后字段
      // 只存储带命名空间的键名
      textureUrl[block] = '/ponder/minecraft/textures/block/'+blockName+'.png';
    }
    console.log('###############End###############');
  };
  for (const scene of window.Process.scenes) {//遍历场景,根据base设置预加载贴图
    switch (scene.base.default) {
      case 'create':
          switch(scene.base.create.style){
            case '5x5chessboard':
              // 只存储带命名空间的键名
              textureUrl['minecraft:snow'] = '/ponder/minecraft/textures/block/snow.png';
              textureUrl['minecraft:clay'] = '/ponder/minecraft/textures/block/clay.png';
              break;
          }
        break;
    }
  }
  // 创建所有贴图加载的 Promise
  textureLoadPromises = Object.entries(textureUrl).map(([block, url]) => {
    return new Promise((resolve) => {
      TextureLoader.load(url, (texture) => {
        loadedTexture[block] = texture;
        resolve();
      }, undefined, (error) => {
        console.error(`贴图 ${block} 加载失败:`, error);
        resolve(); // 即使失败也resolve，避免Promise.all被卡住
      });
    });
  });
  
  // 等待所有贴图加载完成
  Promise.all(textureLoadPromises).then(() => {
    texturesLoaded = true;
    console.log('所有贴图加载完成');
  });
};

// 加载管理器事件处理
LoadingManager.onLoad = () => {//主要加载步骤
  // 加载完成后，渲染 CSS2D 元素
  console.log('renderCSS2D...');
  window.CSS2DRenderer = new window.CSS2DRenderer(renderer);

  console.log('所有资源加载完成');
  setTimeout(async () => {
    loadingDiv.style.opacity = '0';
    // 从window.Process.sense中获取默认场景索引
    const defaultSceneIndex = window.Process.sense && window.Process.sense.length > 0 ? window.Process.sense[0] : 0;
    CreateBase(defaultSceneIndex); // 使用sense中的第一个场景索引作为默认场景
    setTimeout(async () => {
      loadingDiv.style.display = 'none';
      // 在 loadingDiv 完全隐藏后再执行 CreateBase 和初始化片段播放
      if (texturesLoaded) {
        // 初始化片段播放
        initFragmentPlay();
      }
    }, 1000);
  }, 1000);
};

const {loadinfo:lmopli, rangeblock:lmoprb} = SNLB('lm-op', true);
lmopli.innerHTML = '<span class="file-tag y">THREE.LoadingManager</span>: 等待启动加载';

LoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  lmopli.innerHTML = `<span class="file-tag y">THREE.LoadingManager</span>: 已加载${itemsLoaded}个资源，共${itemsTotal}个资源`;
  lmoprb.style.width = Math.round((itemsLoaded/itemsTotal)*100) + '%';
};

LoadingManager.onError = (url) => {console.error(`加载错误: ${url}`);};

// ========================================
// 场景创建与基础功能
// ========================================

// 创建基础场景
function CreateBase(sceneNum){//创建CreateBase场景
  const createBase = window.Process.scenes[sceneNum].base.create;
  if(!createBase) return;
  //main -style
  if(!createBase.style) return;
  let cx = 0, cy = 0, cz = 0;
  if(createBase.offset){
    cx = createBase.offset.x;
    cy = createBase.offset.y;
    cz = createBase.offset.z;
  }
  switch(createBase.style){//根据style设置base
    case '5x5chessboard':
      const table = [[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],]
      for (let i = 0; i < table.length; i++) {
        const row = table[i];
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if(cell === 1){setblock('minecraft:snow', i+cx-2, cy, j+cz-2);}
          else{setblock('minecraft:clay', i+cx-2, cy, j+cz-2);}
        }
      }
      break;
  }
}

// ========================================
// 工具函数与辅助方法
// ========================================

// Ease in out 缓动函数
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
}

// 创建自定义事件 - 片段播放完成
const fragmentCompleteEvent = new Event('fragmentComplete');
const sceneCompleteEvent = new Event('sceneComplete');

// 片段时间时钟类
class fragmentDateClock {
  //计量单位 scene(all fragments) fragment(one fragment)
  start(){
    this.startTime = Date.now();
  }
  scene(){//返回相对于当前场景的时间
    return Date.now() - this.startTime;
  }
  fragment(){//返回相对于当前片段的时间
    // 计算前面所有片段的时间总和
    let previousFragmentsTime = 0;
    for(let i = 0; i < playState.currentFragment; i++){
      previousFragmentsTime += calculatePonderFragmentTime(i);
    }
    // 返回当前场景时间减去前面所有片段的时间总和
    return this.scene() - previousFragmentsTime * 1000; // 乘以1000将秒转换为毫秒
  }
  clear(){//重置时钟
    this.startTime = null;
  }
}

//!!! 片段播放函数
// 创建可取消的Promise包装器
function createCancellablePromise(promise) {
  let isCancelled = false;
  
  const cancellablePromise = new Promise(async (resolve, reject) => {
    try {
      const result = await promise;
      if (!isCancelled) {
        resolve(result);
      }
    } catch (error) {
      if (!isCancelled) {
        reject(error);
      }
    }
  });
  
  cancellablePromise.cancel = () => {
    isCancelled = true;
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

// 计算并缓存场景总时间
function calculateSceneTotalTime() {
  let totalSceneTime = 0;
  for(let i = 0; i < fragmentTotal; i++) {
    totalSceneTime += calculatePonderFragmentTime(i);
  }
  console.log('当前场景总时间:',totalSceneTime);
  sceneTotalTimeCache = totalSceneTime;
  return totalSceneTime;
}

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
    // 计算场景总时间
    const totalTime = calculateSceneTotalTime();
    
    if (totalTime > 0) {
      // 先移除过渡效果，立即归零
      progressFill.style.transitionDuration = '0.1s';
      progressFill.style.width = '0%';
      
      // 触发重排以确保立即归零生效
      void progressFill.offsetWidth;
      
      // 设置过渡时间为场景总时间，启动动画
      progressFill.style.transitionDuration = totalTime+'s';
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
  }
}

// 更新导航箭头的显示状态
function updateNavigationArrows() {
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
  removearea(minX, minY, minZ, maxX, maxY, maxZ);
  console.log('清理场景', sceneNum, '的区域');

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
  
  // 创建新场景的基础
  CreateBase(sceneNum);
  
  // 重置进度条
  ProgressBar.reset();

  // 启动进度条(延迟0.1秒)
  setTimeout(() => {
    ProgressBar.start();
  }, 100);
  
  // 更新导航箭头的显示状态
  updateNavigationArrows();
  // 如果正在播放，开始播放新场景的第一个片段
  if (playState.isPlaying) {
    // 如果有正在运行的异步操作，取消它
    if (playState.currentPromise) {
      playState.currentPromise.cancel();
      playState.currentPromise = null;
    }
  }
  
  // 标记为已停止，等待当前异步操作完成
  playState.isStopped = true;
  
  // 确保当前异步操作完全停止后再播放新片段
  setTimeout(() => {
    // 播放新场景的第一个片段
    playFragment(playState.currentFragment);
  }, 100);
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


// 切换自动播放
function toggleAutoPlay() {
  playState.autoPlay = !playState.autoPlay;
  
  // 更新UI状态
  updateUIState();
}

// 切换慢速模式
function toggleSlowMode() {
  playState.slowMode = !playState.slowMode;
  
  // 更新UI状态
  updateUIState();
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
  const currentFragmentDuration = calculatePonderFragmentTime(playState.currentFragment);
  
  // 如果当前片段播放时间超过预估持续时间，且不是最后一个片段，则触发片段完成事件
  if(playState.currentFragment < fragmentTotal-1 && currentFragmentTime >= currentFragmentDuration){
    // 触发片段完成事件
    window.dispatchEvent(fragmentCompleteEvent);
  }
}

// 计算 ponderFragment(x) 函数中所有函数将会使用的时间
function calculatePonderFragmentTime(fragmentNum) {
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
    'CreateBase': () => 0, // 立即执行，时间为 0
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

// ========================================
// UI 交互与按钮管理
// ========================================

// 将场景控制函数暴露到全局作用域，以便HTML中的按钮可以调用
window.previousScene = previousScene;
window.nextScene = nextScene;
window.switchToScene = switchToScene;
window.replayScene = replayScene;
window.toggleSlowMode = toggleSlowMode;

// 按钮交互逻辑
class PonderButtonManager {
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
    console.log('切换识别模式');
    const scanButton = document.getElementById('ponder-create-btn-explore');
    scanButton.classList.toggle('flash');
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
    
    // 更新进度文本
    const progressText = document.getElementById('ponder-progress-text');
    if (progressText) {
      progressText.textContent = `${Math.round(progress * 100)}%`;
    }
  }
  //通过CSS class检查
  toggleDeveloperMode() {
    const developerModeButton = document.getElementById('ponder-create-btn-developer-mode');
    const isActive = developerModeButton.classList.contains('active');
    developerModeButton.classList.toggle('active');
    developerModeButton.querySelector('.ponder-button-tag').textContent = isActive ? '切换为开发者' : '切换为用户';
    developerModeUI.terminal(isActive);
  }
  
  // 显示/隐藏用户模式按钮
  setEditingMode(active) {
    const developerModeButton = document.getElementById('ponder-create-btn-developer-mode');
    if (developerModeButton) {
      developerModeButton.style.display = active ? 'block' : 'none';
    }
  }
}

// 渲染PonderUI
function renderPonderUI() {
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

const developerModeUI = {
  terminal(active) {
    terminal.style.display = active ? 'block' : 'none';
  }
}

// 创建PonderButtonManager实例并暴露到全局
window.ponderButtonManager = new PonderButtonManager();

// 初始化UI渲染
renderPonderUI();

// 初始化导航箭头状态
updateNavigationArrows();

window.addEventListener('resize', renderPonderUI);
