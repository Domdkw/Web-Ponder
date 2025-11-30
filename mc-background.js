const imgBatch = [
  "2412",
  "2501",
  "2502",
  "create",
];
const imgLink = [
  ["https://i.postimg.cc",'wB0z0pYJ','sfBBQn5K','L4rJzzTS','QCWr8K9k','Tw16s4Ts','wvrpYQvj','hhWRf4VF','NjtLnBSP','8zbsQxVk','nLcrHTH4','xTMcgcxz','QM4tV5tR','hjXGmjQh','x8HTs4R2','Px05Qj1y','9F5f4cmF','DfbZySKM','QdSNn5pH','QxQd1vCg','htKPrMQk','rpmy6mJg','bJSzJB4t','N0zsQcCt','5ycfFmMk',
    'MHk38znj','SxZZx6X4','WbvYWbRB','2y4ckgW9','05mH0K4G','ZKx71t4C','sgf6z6gK','ydRnj2L6','KjyfHQWP','66dYvJ7Y','0NbVMzmw','GtJKwG0Z',
]
];
// 获取用户选择的全景图，如果没有选择则使用随机选择
let userSelectedPanorama = typeof sti_panorama !== 'undefined' ? sti_panorama : "none";
let imgDate, theme;

if (userSelectedPanorama !== "none") {
  // 如果用户选择了特定的全景图，则解析选择
  const parts = userSelectedPanorama.split("_");
  imgDate = parts[0];
  theme = parts[1];
} else {
  // 如果用户没有选择，则使用原来的随机逻辑
  imgDate = imgBatch[Math.floor(Math.random() * imgBatch.length)];
  const hours = new Date().getHours();
  theme = "null";
  if (imgDate === "2412" || imgDate === "2501") {
    if (hours <= 7 || hours > 18) {
      theme = "night";
    } else {
      theme = "day"; 
    }
  }
}
// 保留本地图片源功能模块但默认不启用
// 仅当需要时通过参数启用
const enableLocalSource = false; // 设置为true以启用本地资源
const velocity = 0.0004;


// RTT 函数优化 - 添加更好的资源清理
function RTT(url, timeout = 5000) {
  return new Promise((resolve) => {
    let img = new Image();
    const st = performance.now();
    let isTimeout = false;
    let timer = null;
    
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = ''; // 清除图片引用
      img = null;
    };
    
    img.onload = () => {
      if (isTimeout) return;
      const et = performance.now();
      const rtt = et - st;
      resolve(rtt);
      cleanup();
    };
    
    img.onerror = () => {
      if (isTimeout) return;
      resolve(-1);
      cleanup();
    };
    
    timer = setTimeout(() => {
      isTimeout = true;
      resolve(-1);
      cleanup();
    }, timeout);
    
    img.src = '//'+url+'/favicon.ico';
  })
}
//img-choose
//mirror
const imgMirror = ['i.postimg.cc'];
let imgDomain = 0, minImgRTT = -1;// 0: 本地 1: 远程;

// 添加控制变量，用于禁用镜像检测功能
const disableMirrorDetection = true;

// 修改后的镜像检测逻辑
// 通过变量控制是否执行镜像检测
let promises = [];
if (!disableMirrorDetection) {
  promises = imgMirror.map((url, index) => 
    RTT(url).then(rtt => {
      // 原子化更新最小值
      if (rtt > 0) {
        performance.mark(`mirror-test-${index}`);
        const currentMin = minImgRTT;
        if (currentMin === -1 || rtt < currentMin) {
          minImgRTT = rtt;
          imgDomain = index + 1; // 索引从1开始
        }
        performance.measure(`mirror-${index}`, `mirror-test-${index}`);
      }
      return { index, rtt };
    })
  );
}

// 将函数定义提升到文件顶部
function loadMcPanorama() {
  return new Promise(async (resolve, reject) => {
    try {
  const {loadstate: tls, loadinfo: tli, rangeblock:trb} = SNLB('texture', true);
  const {loadinfo: xli, rangeblock:xrb} = SNLB('Txhr', true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    100,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // 渲染器
  const renderer = new THREE.WebGLRenderer();
  THREE.ColorManagement.legacyMode = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.65;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  // 移除 LinearToneMapping，它会覆盖 ACESFilmicToneMapping
  // renderer.toneMapping = THREE.LinearToneMapping;
  renderer.gammaOutput = false;
  renderer.domElement.style.zIndex = '-1'; // 设置低于前景画布的z-index
  window.addEventListener('resize', onWindowResize, false);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  document.body.appendChild(renderer.domElement);
  //加载进度条
  tli.innerHTML = 'loading texture... ';
  trb.style.width = '0%';
  xrb.style.width = '0%';

  // 创建绘图
  const geometry = new THREE.PlaneGeometry(3, 3); // 平面的宽度和高度
  const textureLoader = new THREE.TextureLoader();
  
  // 添加全局变量来跟踪加载进度
  fileLoaded.imageLoadProgress = {
    loaded: 0,
    total: 0,
    completed: 0,
    images: []
  };
  
  // 存储材质和网格的引用
  const materials = [];
  const meshes = [];
  
  // 获取图片URL的函数
  function getImageUrl(n) {
    let imgUrl = null;
    if (imgDomain === 0) {
      imgUrl = `./panorama/${imgDate}_${theme}_${n}.png`;
    } else {
      const imgBatchToNum = {"2412": 0, "2501": 1, "2502":2, "create":3,};
      const themeToNum = {"day": 0, "night": 1, "null": 2}; // 添加"null"主题的支持
      let imgOutlinkKey = null;
      if(imgDate === "2501" || imgDate === "2412") {
        imgOutlinkKey = imgLink[imgDomain-1][ imgBatchToNum[imgDate] * 12 + themeToNum[theme]*6 + n+1 ];
      } else {
        imgOutlinkKey = imgLink[imgDomain-1][ imgBatchToNum[imgDate] * 6 + 12 + n+1 ];
      }
      imgUrl = `${imgLink[imgDomain-1][0]}/${imgOutlinkKey}/${imgDate}-${theme}-${n}.png`;
    }
    return imgUrl;
  }
  
  // 使用XMLHttpRequest获取图片大小
  function getImageSize(url) {
    xli.innerHTML = `texture XHR status: getImageSize -xhr(HEAD)`;
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          const size = parseInt(xhr.getResponseHeader('Content-Length')) || 0;
          resolve(size);
        } else {
          resolve(0);
        }
      };
      
      xhr.onerror = () => resolve(0);
      xhr.send();
    });
  }
  
  // 自定义图片加载器
  function customImageLoader(url, onLoad, onProgress, onError) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total
        });
      }
    };
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const img = new Image();
        
        img.onload = function() {
          onLoad(img);
        };
        img.onerror = onError;
        img.src = URL.createObjectURL(blob);
      } else {
        onError(new Error('Failed to load image'));
      }
    };
    
    xhr.onerror = onError;
    xhr.send();
  }
  
  // 添加全局变量跟踪上一次显示的进度
  let lastDisplayedPercent = -1;
  
  // 更新总进度的函数
  function updateTotalProgress() {
    const progress = fileLoaded.imageLoadProgress;
    const totalPercent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
    const roundedPercent = Math.round(totalPercent);
    
    // 只有当整数百分比变化时才更新DOM
    if (roundedPercent !== lastDisplayedPercent) {
      xrb.style.width = `${roundedPercent}%`;
      xli.innerHTML = `texture XHR status: ${roundedPercent}%_${progress.loaded}/${progress.total}`;
      lastDisplayedPercent = roundedPercent;
    }
  }
  
  // 创建材质的函数
  function createMaterial() {
    // 创建一个临时材质，稍后会更新纹理
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff), // 初始设置为白色
      transparent: false
    });
    return material;
  }
  
  // 更新材质纹理的函数
  // 更新材质纹理的函数
  function updateMaterialTexture(material, img) {
    // 创建纹理
    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    texture.encoding = THREE.sRGBEncoding;
    
    texture.flipY = true; // 对于所有面，翻转Y轴以纠正颠倒
    
    // 更新材质
    material.map = texture;
    material.needsUpdate = true;
    
    // 移除颜色覆盖，让纹理显示
    material.color.setHex(0xffffff);
  }
  
  // 预加载所有图片大小并初始化进度跟踪
  async function initializeImageLoading() {
    const imageUrls = [];
    for (let i = 0; i < 6; i++) {
      imageUrls.push(getImageUrl(i));
    }
    
    try {
      // 获取所有图片大小
      const sizes = await Promise.all(imageUrls.map(url => getImageSize(url).catch(() => 0)));
      
      // 初始化进度跟踪
      fileLoaded.imageLoadProgress.total = sizes.reduce((sum, size) => sum + size, 0);
      fileLoaded.imageLoadProgress.images = imageUrls.map((url, index) => ({
        url,
        size: sizes[index],
        loaded: 0
      }));
      
      // 创建所有材质和网格
      for (let i = 0; i < 6; i++) {
        const material = createMaterial(i);
        materials.push(material);
        
        const mesh = new THREE.Mesh(geometry, material);
        meshes.push(mesh);
        
        // 设置网格位置和旋转
        switch(i) {
          case 0: // front
            break;
          case 1: // right
            mesh.rotation.y = -Math.PI / 2;
            mesh.position.x = 1.5;
            mesh.position.z = 1.5;
            break;
          case 2: // back
            mesh.rotation.y = Math.PI;
            mesh.position.z = 3;
            break;
          case 3: // left
            mesh.rotation.y = Math.PI / 2;
            mesh.position.x = -1.5;
            mesh.position.z = 1.5;
            break;
          case 4: // up
            mesh.rotation.x = Math.PI / 2;
            mesh.position.z = 1.5;
            mesh.position.y = 1.5;
            break;
          case 5: // down
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.z = 1.5;
            mesh.position.y = -1.5;
            break;
        }
        
        scene.add(mesh);
      }
      
      // 使用自定义加载器加载图片
      for (let i = 0; i < 6; i++) {
        customImageLoader(
          imageUrls[i],
          // 在customImageLoader的onLoad回调中
          (img) => {
          // 更新材质纹理，传入索引参数
          updateMaterialTexture(materials[i], img, i);
          
          // 更新进度
          fileLoaded.imageLoadProgress.images[i].loaded = fileLoaded.imageLoadProgress.images[i].size;
          fileLoaded.imageLoadProgress.loaded = fileLoaded.imageLoadProgress.images.reduce((sum, img) => sum + img.loaded, 0);
          updateTotalProgress();
          
          // 标记完成
          fileLoaded.imageLoadProgress.completed++;
          const completedPercent = Math.round((fileLoaded.imageLoadProgress.completed / 6) * 100);
          tli.innerHTML = `loading texture... ${fileLoaded.imageLoadProgress.completed}/6`;
          trb.style.width = `${completedPercent}%`;
          
          if(fileLoaded.imageLoadProgress.completed === 6) {
            tls.style.backgroundColor = '#fff6';
                resolve(); // 所有纹理加载完成，resolve Promise
            setTimeout(() => {
              loadingDiv.style.opacity = '0';
              setTimeout(() => {
                loadingDiv.style.display = 'none';
              }, 1000);
            }, 1000);
          }
          },
          (progress) => {
            // 更新单个图片的加载进度
            fileLoaded.imageLoadProgress.images[i].loaded = progress.loaded;
            fileLoaded.imageLoadProgress.loaded = fileLoaded.imageLoadProgress.images.reduce((sum, img) => sum + img.loaded, 0);
            updateTotalProgress();
          },
          (error) => {
            console.error(`Failed to load image ${i}:`, error);
            // 标记为完成以避免阻塞
            fileLoaded.imageLoadProgress.completed++;
            if(fileLoaded.imageLoadProgress.completed === 6) {
              tls.style.backgroundColor = '#fff6';
                  resolve(); // 所有纹理加载完成（包括失败的），resolve Promise
              setTimeout(() => {
                loadingDiv.style.opacity = '0';
                setTimeout(() => {
                  loadingDiv.style.display = 'none';
                }, 1000);
              }, 1000);
            }
          }
        );
      }
      
    } catch (error) {
      console.error('Failed to initialize image loading:', error);
      // 回退到原始加载方式
      loadMaterialsOriginal();
      // 不再 reject，因为回退方式可能会成功
    }
  }
  
  // 原始加载方式作为回退
  fileLoaded.originalTextures = 0;//原始加载的纹理数量
  function loadMaterialsOriginal() {
    function loadMaterial(n) {
      const imgUrl = getImageUrl(n);
      return new THREE.MeshBasicMaterial({
        map: textureLoader.load(imgUrl, () => {
          fileLoaded.originalTextures++;
          tli.innerHTML = `loading texture... ${fileLoaded.originalTextures}/6`;
          trb.style.width = `${(fileLoaded.originalTextures / 6) * 100}%`;
          if(fileLoaded.originalTextures === 6) {
            tls.style.backgroundColor = '#fff6';
                resolve(); // 所有纹理加载完成，resolve Promise
            setTimeout(() => {
              loadingDiv.style.opacity = '0';
              setTimeout(() => {
                loadingDiv.style.display = 'none';
              }, 1000);
            }, 1000);
          }
        }),
        color: new THREE.Color(0xffffff), // 确保颜色为白色
      });
    }
    
    const materialFront = loadMaterial(0);
    const front = new THREE.Mesh(geometry, materialFront);
    scene.add(front);

    const materialRight = loadMaterial(1);
    const left = new THREE.Mesh(geometry, materialRight);
    left.rotation.y = -Math.PI / 2;
    left.position.x = 1.5;
    left.position.z = 1.5;
    scene.add(left);

    const materialBack = loadMaterial(2);
    const back = new THREE.Mesh(geometry, materialBack);
    back.rotation.y = Math.PI;
    back.position.z = 3;
    scene.add(back);

    const materialLeft = loadMaterial(3);
    const right = new THREE.Mesh(geometry, materialLeft);
    right.rotation.y = Math.PI / 2;
    right.position.x = -1.5;
    right.position.z = 1.5;
    scene.add(right);

    const materialUp = loadMaterial(4);
    const top = new THREE.Mesh(geometry, materialUp);
    top.rotation.x = Math.PI / 2;
    top.position.z = 1.5;
    top.position.y = 1.5;
    scene.add(top);

    const materialDown = loadMaterial(5);
    const bottom = new THREE.Mesh(geometry, materialDown);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.z = 1.5;
    bottom.position.y = -1.5;
    scene.add(bottom);
  }
  
  // 开始加载
  initializeImageLoading();
  
  // 相机设置
  camera.position.z = 1.5;

  // 获取用户设置的帧率限制，默认为30帧
  const targetFPS = typeof sti_panorama_fps !== 'undefined' ? parseInt(sti_panorama_fps) : 30;
  const frameInterval = 1000 / targetFPS; // 计算每帧之间的时间间隔（毫秒）
  let lastFrameTime = 0;

  // 计划动画
  const animate = (timestamp) => {
    requestAnimationFrame(animate);
    camera.rotation.y -= velocity;
    
    // 帧率限制逻辑
    if (timestamp - lastFrameTime >= frameInterval) {
      renderer.render(scene, camera);
      lastFrameTime = timestamp;
    }
  };

  animate();
    } catch (error) {
      console.error('Error in loadMcPanorama:', error);
      reject(error);
    }
  });
}

// 修改 Promise.allSettled 的回调部分
// 增强兜底逻辑
// 通过变量控制是否执行镜像检测逻辑
if (!disableMirrorDetection) {
  Promise.allSettled(promises).then(results => {
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value.rtt > 0)
      .map(r => r.value);

    if (validResults.length === 0) {
      console.warn('All mirrors failed, using local resources');
      imgDomain = 0;
      minImgRTT = -1;
    } else {
      // 找到响应最快的镜像
      const fastest = validResults.reduce((prev, current) => 
        current.rtt < prev.rtt ? current : prev
      );
      imgDomain = fastest.index + 1;
      minImgRTT = fastest.rtt;
    }
    const {loadinfo:mrtl1}= SNLB('img', false);
    mrtl1.innerHTML = `<span class="file-tag y mr">mc-background.js</span>=>imgMirror: ${imgDomain}, imgDate: ${imgDate}, theme: ${theme}`;
  });
} else {
  // 禁用镜像检测时，直接使用本地资源
  imgDomain = 0;
  minImgRTT = -1;
  const {loadinfo:mrtl2, loadstate:mrts2}= SNLB('imgWarn', false);
  mrts2.style.backgroundColor = '#dbbe03b3';
  mrtl2.style.fontSize = '14px'
  mrtl2.style.fontWeight = 'normal'
  mrtl2.innerHTML = `<span class="file-tag y mr">mc-background.js</span>=>imgDomain=0,'use local'.imgDate: ${imgDate}, theme: ${theme}<br>⚠The image mirror source has been disabled.<br>-The image transfer rate may be affected.UI option cannot be operated.<br>-at mc-background.js enabledLocalSource=false`;
}