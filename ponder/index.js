//2025.8.12 从/index.html抽离
//此脚本用于构建HTML、拉取JS文件和处理物品数据
//初始化
let ponderApi;
let processURL;

// terminal
document.getElementById('terminal').style.zIndex = 4;

//通过?processURL=指定流程URL,直接加载 -2025.10.18
const UPpu1 = new URLSearchParams(window.location.search).get('processURL');
// 获取engine参数
const engineParam = new URLSearchParams(window.location.search).get('engine');
//to line34

//添加表格
const CreatePage = document.createElement('section');
CreatePage.id = 'create-page';
CreatePage.classList.add('dirt', 'abso');
CreatePage.innerHTML = `
<div id="outer-container">
  <div class="chest-title">
    <span>思索索引</span>
  </div>
  <table id="chest-grid">
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  </table>
</div>
`;
document.body.appendChild(CreatePage);

if (UPpu1) {
  processURL = UPpu1;
  terminal.innerHTML = '通过?processURL=指定流程URL,直接加载:'+processURL;
  
  // 如果有engine参数，创建一个包含engine配置的itemData对象
  let itemData = null;
  if (engineParam) {
    try {
      // 尝试解析engine参数为JSON
      const engineConfig = JSON.parse(decodeURIComponent(engineParam));
      itemData = {
        engine: engineConfig
      };
      terminal.innerHTML += '<br>检测到engine参数，使用指定的engine配置';
    } catch (error) {
      console.warn('无法解析engine参数:', error);
      terminal.innerHTML += '<br>警告: engine参数格式不正确，将忽略';
    }
  }
  
  ponderApiLoad(itemData).catch(error => {console.error('Failed to load ponder API:', error);});
}else{
  // 获取物品JSON数据
  const ItemJson = fetch('./ponder/item.json');
  terminal.innerHTML += '加载物品列表数据(/ponder/item.json)<br>';
  ItemJson.then(res => res.json()).then(json => {
    // 等待页面元素创建完成后处理数据
    setTimeout(() => {
      addItemsToGrid(json);
    }, 100);
  }).catch(e => {console.error(e);terminal.innerHTML = e;});
}

// 将物品添加到表格网格并实现分页功能8.15
function addItemsToGrid(items) {
  const table = document.getElementById('chest-grid');
  if (!table) return;
  // 配置
  const itemsPerPage = 45; // 5行 × 9列
  let currentPage = 0;
  const totalPages = Math.ceil(items.length / itemsPerPage);

  // 获取所有单元格，跳过最后一行
  const contentRows = table.querySelectorAll('tr:not(:last-child)');
  // 获取最后一行（分页控制行）
  const paginationRow = table.querySelector('tr:last-child');
  const paginationCells = paginationRow.querySelectorAll('td');

  // 渲染指定页的物品
  function renderPage(pageIndex) {
    // 清空所有内容单元格
    contentRows.forEach(row => {
      row.querySelectorAll('td').forEach(cell => {
        cell.innerHTML = '';
      });
    });

    // 计算当前页的物品范围
    const startIndex = pageIndex * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);

    // 渲染物品到表格
    pageItems.forEach((item, index) => {
      const globalIndex = startIndex + index;
      const rowIndex = Math.floor(globalIndex / 9);
      const colIndex = globalIndex % 9;

      if (rowIndex < contentRows.length) {// 检查行索引是否有效
        const cell = contentRows[rowIndex].querySelectorAll('td')[colIndex];
        if (!cell) return;// 检查单元格是否存在
        const img = document.createElement('img');// 创建图片元素
        terminal.innerHTML += '-加载物品图标(' + item.icon + ')<br>';
        img.src = item.icon;
        img.alt = item.name;
        img.setAttribute('data-itemindex', globalIndex);
        cell.innerHTML = '';
        cell.appendChild(img);
        // 只给包含图片的单元格添加点击事件监听器
        cell.addEventListener('click', function() {
          const imgElement = this.querySelector('img');
          if (!imgElement) return;// 确保单元格包含图片
          const itemIndex = imgElement.getAttribute('data-itemindex');// 获取itemindex属性
          if (itemIndex === null) return;// 检查是否拥有索引
          // 从JSON数据中获取对应的API地址和Process信息
          const selectedItem = items[parseInt(itemIndex)];
          if (!selectedItem) return;
          processURL = selectedItem.process;
          // 传递选中的物品数据
          ponderApiLoad(selectedItem).catch(error => {console.error('Failed to load ponder API:', error);});
        });
      }
    });
    updatePaginationButtons();// 更新分页按钮状态
  }

  // 更新分页按钮状态
  function updatePaginationButtons() {
    // 清空分页行所有单元格
    paginationCells.forEach(cell => { cell.innerHTML = ''; });

    // 只有当物品数量超过一页时才显示分页按钮
    if (totalPages > 1) {
      // 左翻页按钮（第一个单元格）
      if (currentPage > 0) {
        const leftImg = document.createElement('img');
        leftImg.src = '/ponder/minecraft/item/spectral_arrow.webp';
        leftImg.alt = '上一页';
        leftImg.style.transform = 'rotate(-135deg)'; // 旋转-135度
        leftImg.style.cursor = 'pointer';
        leftImg.addEventListener('click', () => {
          currentPage--;
          renderPage(currentPage);
        });
        paginationCells[0].appendChild(leftImg);
      }
      // 右翻页按钮（最后一个单元格）
      if (currentPage < totalPages - 1) {
        const rightImg = document.createElement('img');
        rightImg.src = '/ponder/minecraft/item/spectral_arrow.webp';
        rightImg.alt = '下一页';
        rightImg.style.transform = 'rotate(45deg)'; // 旋转+45度
        rightImg.style.cursor = 'pointer';
        rightImg.addEventListener('click', () => {
          currentPage++;
          renderPage(currentPage);
        });
        paginationCells[8].appendChild(rightImg);
      }
    }
  }
  // 初始化第一页
  renderPage(currentPage);
}

//拉取文件显示函数->调用SNLB（简单封装一下）
function sf (n){
  const {loadinfo} = SNLB('ponderFile-'+n, false);
  loadinfo.textContent = n;
}

// HTML解析函数
function processBootHtml(html) {
  try {
    // 创建一个临时容器元素
    const tempContainer = document.createElement('div');
    // 将获取到的HTML内容设置为临时容器的innerHTML
    tempContainer.innerHTML = html;
    
    // 处理临时容器中的所有子元素
    const children = Array.from(tempContainer.children);
    let hasNonScriptElements = false;
    let sectionContainer = null;
    
    children.forEach(child => {
      if (child.tagName === 'SCRIPT') {
        // 如果是script标签，直接添加到body中执行
        const script = document.createElement('script');
        if (child.src) {
          script.src = child.src;
        } else {
          script.textContent = child.textContent;
        }
        if (child.type) script.type = child.type;
        if (child.async) script.async = child.async;
        if (child.defer) script.defer = child.defer;
        document.body.appendChild(script);
      } else {
        // 对于非script标签，创建section容器
        if (!hasNonScriptElements) {
          hasNonScriptElements = true;
          sectionContainer = document.createElement('section');
          sectionContainer.className = 'boot-html-container';
          document.body.appendChild(sectionContainer);
        }
        sectionContainer.appendChild(child.cloneNode(true));
      }
    });
    
    sf('boot.html内容已按规则处理并添加到body');
  } catch (error) {
    console.error('Failed to process boot HTML content:', error);
  }
}

// 根据文件后缀名决定加载方式
async function loadProcessByExtension(processUrl, itemData) {
  // 获取文件后缀名，更加灵活地处理URL
  let extension = '';
  try {
    // 尝试从URL中提取文件名和后缀
    const urlParts = processUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const nameParts = fileName.split('.');
    
    // 如果有多个点，取最后一个作为后缀
    if (nameParts.length > 1) {
      extension = nameParts[nameParts.length - 1].toLowerCase();
    }
  } catch (error) {
    console.warn('无法解析URL后缀:', error);
  }
  
  // 如果是json文件，像现在一样加载
  if (extension === 'json') {
    window.Process = await loadFile(processUrl, 'json', true, '加载思索流程<span class="file-tag y ml">'+processUrl+'</span>');
    return Process;
  } 
  // 如果没有后缀或者不是json，则必须使用boot配置
  else {
    // 如果不是json文件，检查itemData中是否有boot配置
    if (itemData && itemData.boot) {
      // 统一使用boot传入url的方式
      let bootUrl = '';
      
      // 检查boot的类型
      if (typeof itemData.boot === 'string') {
        // 如果boot是字符串，直接作为URL
        bootUrl = itemData.boot;
      } else if (typeof itemData.boot === 'object' && itemData.boot.url) {
        // 如果boot是对象且包含url属性，使用url属性
        bootUrl = itemData.boot.url;
      } else {
        throw new Error('boot配置必须是字符串URL或包含url属性的对象');
      }
      
      // 返回一个默认的Process对象，使用boot配置
      return {
        loader: {
          boot: bootUrl
        }
      };
    } else {
      throw new Error('非JSON文件必须包含boot配置');
    }
  }
}

async function ponderApiLoad(itemData = null) {
  //先清除前面的打印
  loadBox.innerHTML = '';
  //渐显加载界面100ms
  loadingDiv.style.display = 'flex';
  setTimeout(() => {
    loadingDiv.style.opacity = 1;
  }, 100);

  //释放界面元素
  sf('移除界面元素=>[create-page, options-page, app]');
  terminal.innerHTML = '';
  document.getElementById('create-page').remove();
  document.getElementById('options-page').remove();
  document.getElementById('app').remove();

  // 根据文件后缀名决定加载方式
  try {
    window.Process = await loadProcessByExtension(processURL, itemData);
  } catch (error) {
    console.error('Failed to load process:', error);
    sf('加载失败: ' + error.message);
    return;
  }

  // 处理boot
  if (Process.loader.boot) {
    let bootUrl = '';
    
    // 检查boot的类型
    if (typeof Process.loader.boot === 'string') {
      // 如果boot是字符串，直接作为URL
      bootUrl = Process.loader.boot;
    } else if (typeof Process.loader.boot === 'object' && Process.loader.boot.url) {
      // 如果boot是对象且包含url属性，使用url属性
      bootUrl = Process.loader.boot.url;
    } else {
      console.error('boot配置必须是字符串URL或包含url属性的对象:', Process.loader.boot);
      sf('boot配置必须是字符串URL或包含url属性的对象: ' + JSON.stringify(Process.loader.boot));
      return;
    }
    
    // 获取boot文件的后缀
    let bootExtension = '';
    try {
      const urlParts = bootUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const nameParts = fileName.split('.');
      
      if (nameParts.length > 1) {
        bootExtension = nameParts[nameParts.length - 1].toLowerCase();
      }
    } catch (error) {
      console.warn('无法解析boot URL后缀:', error);
    }
    
    // 根据后缀加载不同类型的文件
    if (bootExtension === 'js') {
      loadFile(bootUrl, 'js', true, '加载boot.js<span class="file-tag y ml">'+bootUrl+'</span>')
      .catch(error => {
        console.error('Failed to load boot.js:', error);
      });
    } else if (bootExtension === 'html') {
      loadFile(bootUrl, 'html', true, '加载boot.html<span class="file-tag y ml">'+bootUrl+'</span>')
      .then(html => {
        processBootHtml(html);
      })
      .catch(error => {
        console.error('Failed to load boot HTML:', error);
      });
    } else {
      // 默认尝试作为JS加载
      loadFile(bootUrl, 'js', true, '加载boot<span class="file-tag y ml">'+bootUrl+'</span>')
      .catch(error => {
        console.error('Failed to load boot:', error);
      });
    }
  } else {
    console.error('缺少boot配置');
    sf('缺少boot配置');
    return;
  }
  loadBox.innerHTML = '';
}