// SCENE操作

// idle 函数：等待指定秒数（优化版）
function idle(duration) {
  // 使用更简洁的Promise语法，避免不必要的函数包装
  return new Promise(resolve => setTimeout(resolve, duration * 1000));
}

// 移动方块函数 - 处理位置变化（优化版）
function moveBlock(startX, startY, startZ, targetX, targetY, targetZ, duration) {
  // 使用更高效的查找方法，避免重复遍历
  let blockToMove = null;
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.position.x === startX && 
        child.position.y === startY && 
        child.position.z === startZ && 
        child.type === 'Mesh') {
      blockToMove = child;
      break;
    }
  }
  
  if (!blockToMove) {
    console.warn(`在位置 (${startX}, ${startY}, ${startZ}) 未找到方块`);
    return Promise.resolve();
  }
  
  return new Promise(resolve => {
    let startTime = null;
    let animationFrameId = null;
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // 应用缓动函数
      const easedProgress = easeInOut(progress);
      
      // 直接更新位置，避免创建临时变量
      blockToMove.position.x = startX + (targetX - startX) * easedProgress;
      blockToMove.position.y = startY + (targetY - startY) * easedProgress;
      blockToMove.position.z = startZ + (targetZ - startZ) * easedProgress;
      
      // 渲染场景
      renderer.render(scene, camera);
      
      // 如果动画未完成，继续更新
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // 动画完成时进行一次最终渲染
        renderer.render(scene, camera);
        resolve();
      }
    }
    
    // 开始动画
    animationFrameId = requestAnimationFrame(animate);
    
    // 添加取消动画的方法，避免内存泄漏
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  });
}
// 渐变效果函数 - 处理透明度变化（优化版）
function fadeBlock(x, y, z, startOpacity, endOpacity, duration) {
  // 使用更高效的查找方法
  let blockToFade = null;
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.position.x === x && 
        child.position.y === y && 
        child.position.z === z && 
        child.type === 'Mesh') {
      blockToFade = child;
      break;
    }
  }
  
  if (!blockToFade) {
    console.warn(`在位置 (${x}, ${y}, ${z}) 未找到方块`);
    return Promise.resolve();
  }
  
  // 预先设置材质属性，避免在动画循环中重复设置
  if (!blockToFade.material.transparent) {
    blockToFade.material.transparent = true;
  }
  
  return new Promise(resolve => {
    let startTime = null;
    let animationFrameId = null;
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // 应用缓动函数
      const easedProgress = easeInOut(progress);
      
      // 直接计算透明度，避免使用THREE.MathUtils.lerp
      blockToFade.material.opacity = startOpacity + (endOpacity - startOpacity) * easedProgress;
      
      // 渲染场景
      renderer.render(scene, camera);
      
      // 如果动画未完成，继续更新
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // 动画完成时进行一次最终渲染
        renderer.render(scene, camera);
        resolve();
      }
    }
    
    // 开始动画
    animationFrameId = requestAnimationFrame(animate);
    
    // 添加取消动画的方法
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  });
}

//setblock（优化版）
function setblock(block, x, y, z){
  // 检查目标位置是否已有方块，如果有则先移除
  removeblock(x, y, z);
  
  const texture = MCTextureLoader.load(block);
  
  // 创建材质，使用对象字面量避免重复创建
  const materialOptions = {
    transparent: true,
    opacity: 1,
    color: 0xffffff
  };
  
  // 只有当贴图存在时才设置 map 属性
  if (texture) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    materialOptions.map = texture;
  } else {
    console.warn(`方块 ${block} 的贴图未找到，使用默认颜色`);
    materialOptions.color = new THREE.Color(0xff0000);
  }
  
  // 重用几何体实例，避免重复创建
  const geometry = getReusableBoxGeometry();
  const material = new THREE.MeshBasicMaterial(materialOptions);
  
  const blockObj = new THREE.Mesh(geometry, material);
  blockObj.position.set(x, y, z);
  blockObj.name = block;
  
  scene.add(blockObj);
  
  // 延迟渲染，避免频繁渲染
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
  });
}

// 可重用的几何体缓存
let reusableBoxGeometry = null;
function getReusableBoxGeometry() {
  if (!reusableBoxGeometry) {
    reusableBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  }
  return reusableBoxGeometry;
}
// setblockfall 函数：放置方块并添加下落动画（优化版）
function setblockfall(block, x, y, z, duration) {
  // 检查目标位置是否已有方块，如果有则先移除
  removeblock(x, y, z);
  
  const texture = MCTextureLoader.load(block);
  
  // 创建材质，使用对象字面量
  const materialOptions = {
    transparent: true,
    opacity: 0,
    color: 0xffffff
  };
  
  // 只有当贴图存在时才设置 map 属性
  if (texture) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    materialOptions.map = texture;
  } else {
    console.warn(`方块 ${block} 的贴图未找到，使用默认颜色`);
    materialOptions.color = new THREE.Color(0xff0000);
  }
  
  // 重用几何体实例
  const geometry = getReusableBoxGeometry();
  const material = new THREE.MeshBasicMaterial(materialOptions);
  
  const blockObj = new THREE.Mesh(geometry, material);
  blockObj.position.set(x, y + 1, z); // 初始位置在目标位置上方一个单位
  blockObj.name = block;
  
  scene.add(blockObj);
  
  // 返回一个 Promise，同时执行移动和渐变动画
  return Promise.all([
    moveBlock(x, y + 1, z, x, y, z, duration),
    fadeBlock(x, y + 1, z, 0, 1, duration)
  ]);
}
//fill填充（优化版）
function fill(block, x1, y1, z1, x2, y2, z2){
  // 确保坐标范围正确（从小到大）
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  
  // 预先加载纹理，避免重复查找
  const texture = MCTextureLoader.load(block);
  
  // 批量创建方块，减少函数调用次数
  const blocksToAdd = [];
  
  for(let x = minX; x <= maxX; x++){
    for(let y = minY; y <= maxY; y++){
      for(let z = minZ; z <= maxZ; z++){
        // 检查目标位置是否已有方块，如果有则先移除
        removeblock(x, y, z);
        
        // 创建材质
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
        
        // 重用几何体实例
        const geometry = getReusableBoxGeometry();
        const material = new THREE.MeshBasicMaterial(materialOptions);
        
        const blockObj = new THREE.Mesh(geometry, material);
        blockObj.position.set(x, y, z);
        blockObj.name = block;
        
        blocksToAdd.push(blockObj);
      }
    }
  }
  
  // 批量添加到场景
  blocksToAdd.forEach(blockObj => {
    scene.add(blockObj);
  });
  
  // 延迟渲染，避免频繁渲染
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
  });
}
//fillfall填充（优化版）
function fillfall(block, x1, y1, z1, x2, y2, z2, duration){
  // 确保坐标范围正确（从小到大）
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  
  // 预先加载纹理，避免重复查找
  const texture = MCTextureLoader.load(block);
  
  // 创建一个组来包含所有方块
  const blockGroup = new THREE.Group();
  
  // 计算区域的中心点，用于组的位置
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 + 1; // 初始位置在目标位置上方一个单位
  const centerZ = (minZ + maxZ) / 2;
  
  // 重用几何体实例
  const geometry = getReusableBoxGeometry();
  
  // 为每个位置创建方块并添加到组中
  for(let x = minX; x <= maxX; x++){
    for(let y = minY; y <= maxY; y++){
      for(let z = minZ; z <= maxZ; z++){
        // 检查目标位置是否已有方块，如果有则先移除
        removeblock(x, y, z);
        
        // 创建材质
        const materialOptions = {
          transparent: true,
          opacity: 0,
          color: 0xffffff
        };
        
        // 只有当贴图存在时才设置 map 属性
        if (texture) {
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          materialOptions.map = texture;
        } else {
          materialOptions.color = new THREE.Color(0xff0000);
        }
        
        const material = new THREE.MeshBasicMaterial(materialOptions);
        const blockObj = new THREE.Mesh(geometry, material);
        
        // 相对于组的位置设置方块位置
        blockObj.position.set(x - centerX, y - (centerY - 1), z - centerZ);
        blockObj.name = block;
        
        blockGroup.add(blockObj);
      }
    }
  }
  
  // 设置组的初始位置
  blockGroup.position.set(centerX, centerY, centerZ);
  
  // 将组添加到场景中
  scene.add(blockGroup);
  
  // 返回一个 Promise，用于执行组的动画
  return new Promise(resolve => {
    let startTime = null;
    let animationFrameId = null;
    
    // 目标位置
    const targetY = centerY - 1; // 下落到目标位置
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // 应用缓动函数
      const easedProgress = easeInOut(progress);
      
      // 直接计算位置，避免使用THREE.MathUtils.lerp
      blockGroup.position.y = centerY + (targetY - centerY) * easedProgress;
      
      // 更新组内所有方块的透明度
      const children = blockGroup.children;
      for (let i = 0; i < children.length; i++) {
        const blockObj = children[i];
        if (blockObj.material) {
          blockObj.material.opacity = easedProgress;
        }
      }
      
      // 渲染场景
      renderer.render(scene, camera);
      
      // 如果动画未完成，继续更新
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // 动画完成，将组中的所有方块单独添加到场景中，并移除组
        const blocksToAdd = [];
        const children = blockGroup.children;
        
        for (let i = 0; i < children.length; i++) {
          const blockObj = children[i];
          const worldPosition = new THREE.Vector3();
          blockObj.getWorldPosition(worldPosition);
          blockObj.position.copy(worldPosition);
          blocksToAdd.push(blockObj);
        }
        
        scene.remove(blockGroup);
        
        // 批量添加方块到场景
        for (let i = 0; i < blocksToAdd.length; i++) {
          scene.add(blocksToAdd[i]);
        }
        
        // 动画完成时进行一次最终渲染
        renderer.render(scene, camera);
        
        // 解析 Promise，表示动画完成
        resolve();
      }
    }
    
    // 开始动画
    animationFrameId = requestAnimationFrame(animate);
    
    // 添加取消动画的方法
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  });
}

// tip函数：在指定位置显示提示信息
async function tip(x, y, z, text, color, duration) {
  // 应用语言映射
  let localizedText = text;
  // 如果是字符串且不是HTML格式，尝试获取本地化文本
  if (typeof text === 'string' && !text.includes('<')) {
    // 调用vanilla.js中的getLocalizedText函数
   localizedText = languageManager.getLocalizedText(text);
  }
  
  // 确保场景已初始化
  if (!scene) {
    console.error("Scene not initialized");
    return;
  }
  
  // 1. 创建正方体线框
  const tubeRadius = 0.03;
  const radialSegments = 6;
  const outline = new THREE.Group();
  const edges = [];
  
  // 创建边框线条的通用函数
  function createEdge(start, end, opacity = 0.8) {
    const curve = new THREE.LineCurve3(start, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({ 
      color: color || 'red',
      transparent: true,
      opacity
    });
    const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    outline.add(tubeMesh);
    edges.push(tubeMesh);
    return tubeMesh;
  }
  
  // 创建底面四条边（固定不动）
  createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5), 0.9);
  createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5), 0.9);
  createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5), 0.9);
  createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5), 0.9);
  
  // 创建顶面四条边（初始位置在底面）
  const topEdgeMeshes = [
    {
      mesh: createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5), 0.9),
      targetStartPos: new THREE.Vector3(x - 0.5, y + 0.5, z - 0.5),
      targetEndPos: new THREE.Vector3(x + 0.5, y + 0.5, z - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5), 0.9),
      targetStartPos: new THREE.Vector3(x + 0.5, y + 0.5, z - 0.5),
      targetEndPos: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5), 0.9),
      targetStartPos: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      targetEndPos: new THREE.Vector3(x - 0.5, y + 0.5, z + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5), 0.9),
      targetStartPos: new THREE.Vector3(x - 0.5, y + 0.5, z + 0.5),
      targetEndPos: new THREE.Vector3(x - 0.5, y + 0.5, z - 0.5)
    }
  ];
  
  // 创建四条垂直边（初始高度为0）
  const verticalEdgeMeshes = [
    {
      mesh: createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5)),
      startPos: new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
      targetEndPos: new THREE.Vector3(x - 0.5, y + 0.5, z - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5)),
      startPos: new THREE.Vector3(x + 0.5, y - 0.5, z - 0.5),
      targetEndPos: new THREE.Vector3(x + 0.5, y + 0.5, z - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5)),
      startPos: new THREE.Vector3(x + 0.5, y - 0.5, z + 0.5),
      targetEndPos: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5), new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5)),
      startPos: new THREE.Vector3(x - 0.5, y - 0.5, z + 0.5),
      targetEndPos: new THREE.Vector3(x - 0.5, y + 0.5, z + 0.5)
    }
  ];
  
  scene.add(outline);
  
  // 2. 创建2D HTML内容
  const tipElement = document.createElement('div');
  tipElement.className = 'ponder-tip-progress';
  tipElement.innerHTML = localizedText;
  tipElement.style.opacity = '0'; // 初始透明
  
  // 创建进度条
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'ponder-tip-progress-container';
  const progressBar = document.createElement('div');
  progressBar.className = 'ponder-tip-progress-bar';
  progressBar.style.width = '0%'; // 初始宽度为0
  progressBarContainer.appendChild(progressBar);
  tipElement.appendChild(progressBarContainer);
  
  document.body.appendChild(tipElement);
  
  // 3. 更新文本框位置的函数
  const blockPosition = new THREE.Vector3(x, y + 1.2, z);
  
  // 使用局部变量存储动画帧ID，避免与全局变量冲突
  let tipAnimationFrameId;
  let tipOutlineAnimationFrameId;
  let tipFadeAnimationFrameId;
  let resizeListener;
  
  function updateTipPosition() {
    const vector = blockPosition.clone().project(camera);
    const xPercent = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const yPercent = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    tipElement.style.left = (xPercent + 20) + 'px';
    tipElement.style.top = yPercent + 'px';
    tipElement.style.display = vector.z < 1 ? 'block' : 'none';
  }
  
  // 初始更新位置
  updateTipPosition();
  
  // 添加事件监听器
  resizeListener = () => updateTipPosition();
  window.addEventListener('resize', resizeListener);
  
  // 添加渲染循环监听器，持续更新位置
  function animate() {
    updateTipPosition();
    tipAnimationFrameId = requestAnimationFrame(animate);
  }
  tipAnimationFrameId = requestAnimationFrame(animate);
  
  // 4. 边框动画效果
  const animationDuration = 0.5;
  const startTime = Date.now();
  
  function updateOutlineAnimation() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rawProgress = Math.min(elapsed / animationDuration, 1);
    const progress = easeInOut(rawProgress);
    
    // 更新顶面位置
    for (let i = 0; i < topEdgeMeshes.length; i++) {
      const edgeObj = topEdgeMeshes[i];
      const currentY = y - 0.5 + (progress * 1);
      const currentStartPos = new THREE.Vector3(edgeObj.targetStartPos.x, currentY, edgeObj.targetStartPos.z);
      const currentEndPos = new THREE.Vector3(edgeObj.targetEndPos.x, currentY, edgeObj.targetEndPos.z);
      
      const curve = new THREE.LineCurve3(currentStartPos, currentEndPos);
      edgeObj.mesh.geometry.dispose();
      edgeObj.mesh.geometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    }
    
    // 更新垂直边高度
    for (let i = 0; i < verticalEdgeMeshes.length; i++) {
      const edgeObj = verticalEdgeMeshes[i];
      const currentEndY = edgeObj.startPos.y + (progress * 1);
      const currentEndPos = new THREE.Vector3(edgeObj.startPos.x, currentEndY, edgeObj.startPos.z);
      
      const curve = new THREE.LineCurve3(edgeObj.startPos, currentEndPos);
      edgeObj.mesh.geometry.dispose();
      edgeObj.mesh.geometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    }
    
    // 手动渲染场景以确保动画可见
    renderer.render(scene, camera);
    
    if (rawProgress < 1) {
      tipOutlineAnimationFrameId = requestAnimationFrame(updateOutlineAnimation);
    }
  }
  
  // 开始边框动画
  tipOutlineAnimationFrameId = requestAnimationFrame(updateOutlineAnimation);
  
  // 5. 文本动画效果
  await idle(animationDuration);
  tipElement.style.opacity = '1';
  
  progressBar.style.transition = `width ${duration}s linear`;
  requestAnimationFrame(() => {
    progressBar.style.width = '100%';
  });
  
  await idle(duration);
  
  tipElement.style.opacity = '0';
  await idle(0.5);
  
  // 6. 为线条添加透明度渐变效果
  const fadeOutDuration = 1.0; // 1秒的渐变效果
  const originalOpacities = [];
  for (let i = 0; i < edges.length; i++) {
    originalOpacities.push(edges[i].material.opacity);
  }
  
  const fadeStartTime = Date.now();
  
  function updateEdgeOpacity() {
    const elapsed = (Date.now() - fadeStartTime) / 1000;
    const progress = Math.min(elapsed / fadeOutDuration, 1);
    
    // 更新所有线条的透明度
    for (let i = 0; i < edges.length; i++) {
      edges[i].material.opacity = originalOpacities[i] * (1 - progress);
    }
    
    // 如果渐变未完成，继续更新
    if (progress < 1) {
      tipFadeAnimationFrameId = requestAnimationFrame(updateEdgeOpacity);
    } else {
      // 渐变完成后，清理资源
      cleanupResources();
    }
  }
  
  // 开始透明度渐变
  tipFadeAnimationFrameId = requestAnimationFrame(updateEdgeOpacity);
  
  // 7. 清理资源
  function cleanupResources() {
    scene.remove(outline);
    document.body.removeChild(tipElement);
    
    for (let i = 0; i < edges.length; i++) {
      edges[i].geometry.dispose();
      edges[i].material.dispose();
    }
    
    window.removeEventListener('resize', resizeListener);
    if (tipAnimationFrameId) cancelAnimationFrame(tipAnimationFrameId);
    if (tipOutlineAnimationFrameId) cancelAnimationFrame(tipOutlineAnimationFrameId);
    if (tipFadeAnimationFrameId) cancelAnimationFrame(tipFadeAnimationFrameId);
    
    // 强制最终渲染更新
    renderer.render(scene, camera);
  }
}

// tiparea函数：在指定区域内显示提示信息
async function tiparea(x1, y1, z1, x2, y2, z2, text, color, duration) {
  // 应用语言映射
  let localizedText = text;
  // 如果是字符串且不是HTML格式，尝试获取本地化文本
  if (typeof text === 'string' && !text.includes('<')) {
    // 调用vanilla.js中的getLocalizedText函数
   localizedText = languageManager.getLocalizedText(text);
  }
  
  // 确保场景已初始化
  if (!scene) {
    console.error("Scene not initialized");
    return;
  }
  
  // 确保坐标范围正确（从小到大）
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  
  // 计算区域中心点
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  
  // 1. 创建区域轮廓
  const tubeRadius = 0.03;
  const radialSegments = 6;
  const areaOutline = new THREE.Group();
  const edges = [];
  
  // 创建边框线条的通用函数
  function createEdge(start, end, opacity = 0.8) {
    const curve = new THREE.LineCurve3(start, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({ 
      color: color || 'red',
      transparent: true,
      opacity
    });
    const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    areaOutline.add(tubeMesh);
    edges.push(tubeMesh);
    return tubeMesh;
  }
  
  // 创建区域的12条边
  const bottomY = minY - 0.5;
  const topY = maxY + 0.5;
  
  // 底面四条边（固定不动）
  createEdge(new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5), new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5), 0.9);
  createEdge(new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5), new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5), 0.9);
  createEdge(new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5), 0.9);
  createEdge(new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5), 0.9);
  
  // 顶面四条边（初始位置在底面）
  const topEdgeMeshes = [
    {
      mesh: createEdge(new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5), new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5), 0.9),
      targetStartPos: new THREE.Vector3(minX - 0.5, topY, minZ - 0.5),
      targetEndPos: new THREE.Vector3(maxX + 0.5, topY, minZ - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5), new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5), 0.9),
      targetStartPos: new THREE.Vector3(maxX + 0.5, topY, minZ - 0.5),
      targetEndPos: new THREE.Vector3(maxX + 0.5, topY, maxZ + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5), 0.9),
      targetStartPos: new THREE.Vector3(maxX + 0.5, topY, maxZ + 0.5),
      targetEndPos: new THREE.Vector3(minX - 0.5, topY, maxZ + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5), 0.9),
      targetStartPos: new THREE.Vector3(minX - 0.5, topY, maxZ + 0.5),
      targetEndPos: new THREE.Vector3(minX - 0.5, topY, minZ - 0.5)
    }
  ];
  
  // 四条垂直边（初始高度为0）
  const verticalEdgeMeshes = [
    {
      mesh: createEdge(new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5), new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5)),
      startPos: new THREE.Vector3(minX - 0.5, bottomY, minZ - 0.5),
      targetEndPos: new THREE.Vector3(minX - 0.5, topY, minZ - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5), new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5)),
      startPos: new THREE.Vector3(maxX + 0.5, bottomY, minZ - 0.5),
      targetEndPos: new THREE.Vector3(maxX + 0.5, topY, minZ - 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5)),
      startPos: new THREE.Vector3(maxX + 0.5, bottomY, maxZ + 0.5),
      targetEndPos: new THREE.Vector3(maxX + 0.5, topY, maxZ + 0.5)
    },
    {
      mesh: createEdge(new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5), new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5)),
      startPos: new THREE.Vector3(minX - 0.5, bottomY, maxZ + 0.5),
      targetEndPos: new THREE.Vector3(minX - 0.5, topY, maxZ + 0.5)
    }
  ];
  
  scene.add(areaOutline);
  
  // 2. 创建2D HTML内容
  const tipElement = document.createElement('div');
  tipElement.className = 'ponder-tip-progress';
  tipElement.innerHTML = localizedText;
  tipElement.style.opacity = '0'; // 初始透明
  
  // 创建进度条
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'ponder-tip-progress-container';
  const progressBar = document.createElement('div');
  progressBar.className = 'ponder-tip-progress-bar';
  progressBar.style.width = '0%'; // 初始宽度为0
  progressBarContainer.appendChild(progressBar);
  tipElement.appendChild(progressBarContainer);
  
  document.body.appendChild(tipElement);
  
  // 3. 更新文本框位置的函数
  const areaPosition = new THREE.Vector3(centerX, centerY + (maxY - minY + 1)/2 + 0.7, centerZ);
  
  // 使用局部变量存储动画帧ID，避免与全局变量冲突
  let tipareaAnimationFrameId;
  let tipareaOutlineAnimationFrameId;
  let tipareaFadeAnimationFrameId;
  let resizeListener;
  
  function updateTipPosition() {
    const vector = areaPosition.clone().project(camera);
    const xPercent = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const yPercent = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    tipElement.style.left = (xPercent + 20) + 'px';
    tipElement.style.top = yPercent + 'px';
    tipElement.style.display = vector.z < 1 ? 'block' : 'none';
  }
  
  // 初始更新位置
  updateTipPosition();
  
  // 添加事件监听器
  resizeListener = () => updateTipPosition();
  window.addEventListener('resize', resizeListener);
  
  // 添加渲染循环监听器，持续更新位置
  function animate() {
    updateTipPosition();
    tipareaAnimationFrameId = requestAnimationFrame(animate);
  }
  tipareaAnimationFrameId = requestAnimationFrame(animate);
  
  // 4. 边框动画效果
  const animationDuration = 0.5;
  const startTime = Date.now();
  const heightDiff = topY - bottomY;
    
  function updateOutlineAnimation() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rawProgress = Math.min(elapsed / animationDuration, 1);
    const progress = easeInOut(rawProgress);
    
    // 更新顶面位置
    for (let i = 0; i < topEdgeMeshes.length; i++) {
      const edgeObj = topEdgeMeshes[i];
      const currentY = bottomY + (heightDiff * progress);
      const currentStartPos = new THREE.Vector3(edgeObj.targetStartPos.x, currentY, edgeObj.targetStartPos.z);
      const currentEndPos = new THREE.Vector3(edgeObj.targetEndPos.x, currentY, edgeObj.targetEndPos.z);
      
      const curve = new THREE.LineCurve3(currentStartPos, currentEndPos);
      edgeObj.mesh.geometry.dispose();
      edgeObj.mesh.geometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    }
    
    // 更新垂直边高度
    for (let i = 0; i < verticalEdgeMeshes.length; i++) {
      const edgeObj = verticalEdgeMeshes[i];
      const currentEndY = edgeObj.startPos.y + (heightDiff * progress);
      const currentEndPos = new THREE.Vector3(edgeObj.startPos.x, currentEndY, edgeObj.startPos.z);
      
      const curve = new THREE.LineCurve3(edgeObj.startPos, currentEndPos);
      edgeObj.mesh.geometry.dispose();
      edgeObj.mesh.geometry = new THREE.TubeGeometry(curve, 1, tubeRadius, radialSegments, false);
    }
    
    // 手动渲染场景以确保动画可见
    renderer.render(scene, camera);
    
    if (rawProgress < 1) {
      tipareaOutlineAnimationFrameId = requestAnimationFrame(updateOutlineAnimation);
    }
  }
  
  // 开始边框动画
  tipareaOutlineAnimationFrameId = requestAnimationFrame(updateOutlineAnimation);
  
  // 5. 文本动画效果
  await idle(animationDuration);
  tipElement.style.opacity = '1';
  
  progressBar.style.transition = `width ${duration}s linear`;
  requestAnimationFrame(() => {
    progressBar.style.width = '100%';
  });
  
  await idle(duration);
  
  tipElement.style.opacity = '0';
  await idle(0.5);
  
  // 6. 为线条添加透明度渐变效果
  const fadeOutDuration = 1.0; // 1秒的渐变效果
  const originalOpacities = [];
  for (let i = 0; i < edges.length; i++) {
    originalOpacities.push(edges[i].material.opacity);
  }
  
  const fadeStartTime = Date.now();
  
  function updateEdgeOpacity() {
    const elapsed = (Date.now() - fadeStartTime) / 1000;
    const progress = Math.min(elapsed / fadeOutDuration, 1);
    
    // 更新所有线条的透明度
    for (let i = 0; i < edges.length; i++) {
      edges[i].material.opacity = originalOpacities[i] * (1 - progress);
    }
    
    // 如果渐变未完成，继续更新
    if (progress < 1) {
      tipareaFadeAnimationFrameId = requestAnimationFrame(updateEdgeOpacity);
    } else {
      // 渐变完成后，清理资源
      cleanupResources();
    }
  }
  
  // 开始透明度渐变
  tipareaFadeAnimationFrameId = requestAnimationFrame(updateEdgeOpacity);
  
  // 7. 清理资源
  function cleanupResources() {
    scene.remove(areaOutline);
    document.body.removeChild(tipElement);
    
    for (let i = 0; i < edges.length; i++) {
      edges[i].geometry.dispose();
      edges[i].material.dispose();
    }
    
    window.removeEventListener('resize', resizeListener);
    if (tipareaAnimationFrameId) cancelAnimationFrame(tipareaAnimationFrameId);
    if (tipareaOutlineAnimationFrameId) cancelAnimationFrame(tipareaOutlineAnimationFrameId);
    if (tipareaFadeAnimationFrameId) cancelAnimationFrame(tipareaFadeAnimationFrameId);
    
    // 强制最终渲染更新
    renderer.render(scene, camera);
  }
}

// 摄像机平滑移动函数
function moveCamera(isAsync, x, y, z, duration) {
  // 获取当前摄像机位置
  const startPos = camera.position.clone();
  const targetPos = new THREE.Vector3(x, y, z);
  
  let startTime = null;
  let animationFrameId;
  
  // 创建 Promise，仅在 isAsync 为 false 时返回
  const promise = new Promise(resolve => {
    function animateCamera(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000; // 转换为秒
      const progress = Math.min(elapsed / duration, 1); // 0到1的进度
      const easedProgress = easeInOut(progress); // 应用缓动函数
      
      // 使用线性插值计算当前位置
      const currentPos = new THREE.Vector3().lerpVectors(startPos, targetPos, easedProgress);
      camera.position.copy(currentPos);
      
      // 确保摄像机始终朝向原点 (0,0,0)
      camera.lookAt(0, 0, 0);
      
      // 渲染场景
      renderer.render(scene, camera);
      
      // 如果动画未完成，继续更新
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateCamera);
      } else if (!isAsync) {
        // 动画完成且需要等待时，解析 Promise
        resolve();
      }
    }
    
    // 开始摄像机动画
    animationFrameId = requestAnimationFrame(animateCamera);
  });
  
  // 根据 isAsync 参数决定是否返回 Promise
  return isAsync ? undefined : promise;
}

// 移除方块
function removeblock(x, y, z) {
  // 查找位于指定坐标的方块
  let blockToRemove = null;
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.position.x === x && 
        child.position.y === y && 
        child.position.z === z && 
        child.type === 'Mesh') {
      blockToRemove = child;
      break;
    }
  }
  
  if (blockToRemove) {
    // 从场景中移除方块
    scene.remove(blockToRemove);
    
    // 释放几何体和材质的内存
    if (blockToRemove.geometry) {
      blockToRemove.geometry.dispose();
    }
    if (blockToRemove.material) {
      if (Array.isArray(blockToRemove.material)) {
        for (let i = 0; i < blockToRemove.material.length; i++) {
          blockToRemove.material[i].dispose();
        }
      } else {
        blockToRemove.material.dispose();
      }
    }
    
    // 强制渲染更新
    renderer.render(scene, camera);
  }
  // 如果没有找到方块，不显示任何信息
}
function removeblockup(x, y, z, duration) {
  // 查找位于指定坐标的方块
  let blockToRemove = null;
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.position.x === x && 
        child.position.y === y && 
        child.position.z === z && 
        child.type === 'Mesh') {
      blockToRemove = child;
      break;
    }
  }
  
  if (blockToRemove) {
    // 返回一个 Promise，以便支持 await 等待
    return new Promise(resolve => {
      // 同时执行移动和渐变动画
      Promise.all([
        moveBlock(x, y, z, x, y + 1, z, duration),
        fadeBlock(x, y, z, 1, 0, duration)
      ]).then(() => {
        // 动画完成后，从场景中移除方块
        scene.remove(blockToRemove);
        
        // 释放几何体和材质的内存
        if (blockToRemove.geometry) {
          blockToRemove.geometry.dispose();
        }
        if (blockToRemove.material) {
          if (Array.isArray(blockToRemove.material)) {
            for (let i = 0; i < blockToRemove.material.length; i++) {
              blockToRemove.material[i].dispose();
            }
          } else {
            blockToRemove.material.dispose();
          }
        }
        
        // 强制最终渲染更新
        renderer.render(scene, camera);
        
        // 解析 Promise，表示动画完成
        resolve();
      });
    });
  } else {
    // 如果没有找到方块，返回一个已解析的 Promise，不显示任何信息
    return Promise.resolve();
  }
}
function removearea(x1, y1, z1, x2, y2, z2) {
  // 确保坐标范围正确（从小到大）
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  
  // 遍历区域内的每个坐标，并调用 removeblock 函数
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        removeblock(x, y, z);
      }
    }
  }
  
  // 在区域移除完成后进行一次渲染
  renderer.render(scene, camera);
}
function removeareaup(x1, y1, z1, x2, y2, z2, duration) {
  // 确保坐标范围正确（从小到大）
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  
  // 创建一个组来包含所有方块
  const blockGroup = new THREE.Group();
  
  // 计算区域的中心点，用于组的位置
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  
  // 查找区域内的所有方块，并将它们添加到组中
  const blocksToRemove = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        // 查找位于指定坐标的方块
        let blockToRemove = null;
        for (let i = 0; i < scene.children.length; i++) {
          const child = scene.children[i];
          if (child.position.x === x && 
              child.position.y === y && 
              child.position.z === z && 
              child.type === 'Mesh') {
            blockToRemove = child;
            break;
          }
        }
        
        if (blockToRemove) {
          // 从场景中移除方块
          scene.remove(blockToRemove);
          
          // 相对于组的位置设置方块位置
          blockToRemove.position.set(x - centerX, y - centerY, z - centerZ);
          
          // 确保材质支持透明度
          if (!blockToRemove.material.transparent) {
            blockToRemove.material.transparent = true;
          }
          
          // 将方块添加到组中
          blockGroup.add(blockToRemove);
          blocksToRemove.push(blockToRemove);
        }
      }
    }
  }
  
  // 如果没有找到任何方块，返回一个已解析的 Promise
  if (blocksToRemove.length === 0) {
    return Promise.resolve();
  }
  
  // 设置组的位置
  blockGroup.position.set(centerX, centerY, centerZ);
  
  // 将组添加到场景中
  scene.add(blockGroup);
  
  // 强制渲染一次，确保组已添加到场景中
  renderer.render(scene, camera);
  
  // 返回一个 Promise，用于执行组的动画
  return new Promise(resolve => {
    let startTime = null;
    let animationFrameId;
    
    // 目标位置
    const targetY = centerY + 1; // 向上移动一个单位
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // 应用缓动函数
      const easedProgress = easeInOut(progress);
      
      // 更新组的位置
      blockGroup.position.y = centerY + (targetY - centerY) * easedProgress;
      
      // 更新组内所有方块的透明度
      const opacity = 1 - easedProgress;
      for (let i = 0; i < blockGroup.children.length; i++) {
        const blockObj = blockGroup.children[i];
        if (blockObj.material) {
          blockObj.material.opacity = opacity;
        }
      }
      
      // 渲染场景
      renderer.render(scene, camera);
      
      // 如果动画未完成，继续更新
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // 动画完成，释放所有方块的资源
        for (let i = 0; i < blockGroup.children.length; i++) {
          const blockObj = blockGroup.children[i];
          // 释放几何体和材质的内存
          if (blockObj.geometry) {
            blockObj.geometry.dispose();
          }
          if (blockObj.material) {
            if (Array.isArray(blockObj.material)) {
              for (let j = 0; j < blockObj.material.length; j++) {
                blockObj.material[j].dispose();
              }
            } else {
              blockObj.material.dispose();
            }
          }
        }
        
        // 从场景中移除组
        scene.remove(blockGroup);
        
        // 强制最终渲染更新
        renderer.render(scene, camera);
        
        // 解析 Promise，表示动画完成
        resolve();
      }
    }
    
    // 开始动画
    animationFrameId = requestAnimationFrame(animate);
  });
}

// 重置场景函数，自动发现区域大小并清除所有方块
function cleanscene(isAsync) {
  // 初始化最大和最小坐标
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  // 遍历场景中的所有对象，找到所有方块的最大和最小坐标
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.type === 'Mesh') {
      // 更新最小坐标
      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      minZ = Math.min(minZ, child.position.z);
      
      // 更新最大坐标
      maxX = Math.max(maxX, child.position.x);
      maxY = Math.max(maxY, child.position.y);
      maxZ = Math.max(maxZ, child.position.z);
    }
  }
  
  // 如果场景中没有方块，直接返回
  if (minX === Infinity || maxX === -Infinity) {
    return isAsync ? undefined : Promise.resolve();
  }
  
  // 调用 removeareaup 函数删除发现的区域内的所有方块
  const result = removeareaup(minX, minY, minZ, maxX, maxY, maxZ, 1);
  
  // 根据 isAsync 参数决定是否返回 Promise
  return isAsync ? undefined : result;
}
