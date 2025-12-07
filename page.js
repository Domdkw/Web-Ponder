const title_main = document.getElementById("title");
let LS_accept = localStorage.getItem('LS_accept') || false;
//sti let start
let sti = {
  moreOoops: false,
  panorama: "none", // 存储用户选择的全景图
  imgMirror: "local", // 存储用户选择的全景图镜像源
  ooops_lang: "auto", // 存储用户选择的ooops语言
  audio_file: 'random', // 存储音频文件设置
  showConsole: true, // 存储用户选择的显示控制台选项
  panorama_fps: "30" // 存储用户选择的全景图帧数限制
};
//sti let end
//自动应用LS信息25.7.31
if(LS_accept && localStorage.getItem('sti')){
  const stiObj = JSON.parse( localStorage.getItem('sti') );
  stiObj.forEach(function(i){//单个键值
    switch(i.id){
      case 'sti-moreooops':sti.moreOoops = i.value;break;
      case 'sti-panorama':sti.panorama = i.value;break; // 加载用户选择的全景图
      case 'sti-imgMirror':sti.imgMirror = i.value;break; // 加载用户选择的全景图镜像源
      case 'sti-ooops-lang':sti.ooops_lang = i.value;break; // 加载用户选择的ooops语言
      case 'sti-showConsole':sti.showConsole = i.value;break; // 加载用户选择的显示控制台选项
      case 'sti-panorama-fps':sti.panorama_fps = i.value;break; // 加载用户选择的全景图帧数限制
    }
  });
}

// 兼容性检测立即执行函数
(function() {
  // 检测IE浏览器
  function isIEBrowser() {
    return /MSIE|Trident/.test(navigator.userAgent);
  }
  
  // 检测移动端设备
  function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|iphone|ipod|blackberry|windows phone|webos|iemobile/.test(userAgent);
  }
  
  // 检测WebGL 1.0支持
  function isWebGL1Supported() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  }
  
  // 隐藏警告的函数
  window.hideCompatibilityWarning = function() {
    const warning = document.getElementById('compatibility-warning');
    if (warning) {
      warning.classList.remove('show');
    }
  };
  
  // 检测兼容性问题
  const issues = [];
  
  if (isIEBrowser()) {
    issues.push('IE浏览器：不支持现代Web技术');
  }
  
  if (isMobileDevice()) {
    issues.push('移动设备：3D图形性能较差');
  }
  
  if (!isWebGL1Supported()) {
    issues.push('WebGL 1.0：不支持或性能过低');
  }
  
  // 如果有兼容性问题，显示警告
  if (issues.length > 0) {
    const warning = document.getElementById('compatibility-warning');
    const issuesList = document.getElementById('warning-issues');
    
    if (warning && issuesList) {
      // 动态生成警告内容
      issuesList.innerHTML = '';
      issues.forEach(issue => {
        const li = document.createElement('li');
        li.textContent = issue;
        issuesList.appendChild(li);
      });
      
      warning.classList.add('show');
    }
  }
})();

//region language

const supportedLanguages = ["en-US","zh-TW","zh-CN"];
let currentLanguage = navLang;
let languageData;
if(supportedLanguages.includes(navLang) && navLang !== 'zh-CN'){
  window.onload = function(){
    fetch('./lang/' + navLang + '.json')
    .then(response => response.json())
    .then(data => {
      languageData = Array.isArray(data)? data : [data];
      handleLanguageData(languageData);
    })
    .catch(error => console.error('Error fetching JSON:', error));
  }
}
function handleLanguageData(languageObject){
  if (Array.isArray(languageObject) && languageObject.length > 0){
    const dataObject = languageObject[0];
    for (const key in dataObject){
      if (dataObject.hasOwnProperty(key)){
        // 处理id属性
        const languageElement = document.getElementById(key);
        if (languageElement){
          if (languageElement.tagName === 'INPUT'){
            languageElement.value = dataObject[key];
          } else{
            languageElement.textContent = dataObject[key];
          }
        }
        
        // 处理data-lang属性
        const dataLangElements = document.querySelectorAll(`[data-lang="${key}"]`);
        dataLangElements.forEach(element => {
          if (element.tagName === 'INPUT'){
            element.value = dataObject[key];
          } else{
            element.textContent = dataObject[key];
          }
        });
      }
    }
  }
}

//language choose page
const languageChooseDiv = document.getElementById("lang-div");
let selectedLanguageId = navLang;
if(!supportedLanguages.includes(selectedLanguageId)){
  selectedLanguageId = 'lang-unknown';
}
function showlang(){
  title_main.style.display = "none";
  languageChooseDiv.style.display = "flex";
  let currentLanguageSpan = document.getElementById(selectedLanguageId);
  currentLanguageSpan.classList.add('clicked');
  const languageList = document.querySelector('.language-list');

  languageList.addEventListener('click', function (languageEvent) {
    if (languageEvent.target.tagName === 'SPAN' && languageEvent.target.id !== 'lang-unknown') {
      currentLanguageSpan.classList.remove('clicked');
      selectedLanguageId = languageEvent.target.id;
      currentLanguageSpan = document.getElementById(selectedLanguageId);
      currentLanguageSpan.classList.add('clicked');
    }
  });
}
function hiddenlang(){
  title_main.style.display = "flex";
  languageChooseDiv.style.display = "none";
  if(supportedLanguages.includes(selectedLanguageId) && selectedLanguageId !== currentLanguage){
    terminal.innerHTML = '请求加载语言-'+selectedLanguageId;
    
    // 检查该语言的存储是否已存在
    let languageStorageKey = 'lang_' + selectedLanguageId;
    let languageDataExists = localStorage.getItem(languageStorageKey) !== null;
    
    fetch('./lang/' + selectedLanguageId + '.json')
    .then(response => response.json())
    .then(data => {
      languageData = Array.isArray(data)? data : [data];
      handleLanguageData(languageData);
      currentLanguage = selectedLanguageId;
      
      // 无论语言存储是否存在，都重新拉取数据并更新存储
      localStorage.setItem(languageStorageKey, JSON.stringify(languageData));
      
      // 如果是ooops支持的语言，也需要更新ooops数据
        if(selectedLanguageId === 'zh-CN' || selectedLanguageId === 'en-US') {
          // 如果当前已下载的语言与目标语言不同，则清除旧的ooops文本
          let targetOoopsLanguage = sti.ooops_lang === "auto" ? selectedLanguageId : sti.ooops_lang;
          
          // 如果用户选择的是"auto"，则根据当前选择的语言自动选择
          if(targetOoopsLanguage === "auto") {
            targetOoopsLanguage = selectedLanguageId;
          }
          
          if(DlOoops !== targetOoopsLanguage) {
            // 清除旧的ooops文本
            localStorage.removeItem('OoopsText');
          }
          
          // 如果启用了更多ooops信息，则重新加载ooops
          if(sti.moreOoops) {
            (async () => {
              // 如果当前已下载的语言与目标语言不同，或者没有下载任何语言，则重新下载
              if(DlOoops !== targetOoopsLanguage) {
                let oopsTextData = null;
                
                // 根据目标语言加载对应的ooops文件
                if(targetOoopsLanguage === 'zh-CN'){
                  oopsTextData = await loadFile('./assets/ooops/zh-CN.json','json',true,'获取zh-CN的ooops文件') || null;
                } else if(targetOoopsLanguage === 'en-US'){
                  oopsTextData = await loadFile('./assets/ooops/en-US.json','json',true,'get en-US ooops file') || null;
                }
                
                if(oopsTextData) {
                  localStorage.setItem('OoopsText', JSON.stringify(oopsTextData));
                  DlOoops = targetOoopsLanguage; // 更新为当前下载的语言
                  localStorage.setItem('DlOoops', DlOoops); // 直接存储语言代码字符串
                  
                  // 更新页面上的ooops文本
                  const oopsInnerText = JSON.parse(localStorage.getItem('OoopsText'));
                  if(oopsInnerText){
                    ooops.innerHTML = oopsInnerText[Math.floor(Math.random() * oopsInnerText.length)];
                    ooops.style.right = `-${ooops.offsetWidth/3}px`;
                    ooops.style.fontSize = `${-0.6*ooops.textContent.length +35}px`;
                  }
                }
              }
            })();
          }
        }
      
      terminal.innerHTML = '加载语言-'+selectedLanguageId+'成功' + (languageDataExists ? '（已更新存储）' : '');
    })
    .catch(error => {
      terminal.innerHTML = '加载语言-'+selectedLanguageId+'失败';
      console.error('Can not get language profile,Error:', error);
    });
  }
  if(ttf_usestate_text){
    document.body.style.fontFamily = "'Minecraft-Regular', sans-serif";
  }else{
    document.body.style.fontFamily = "sans-serif";
  }
}
let firstfontload = false;
let ttf_usestate_text = false;
const ttf_usestate_element = document.getElementById('ttf-state');
function unicode(){
  if(!firstfontload){
    firstfontload = true;
    const styleSheet = document.createElement('style');
    document.head.appendChild(styleSheet);
    styleSheet.sheet.insertRule('@font-face {font-family: "Minecraft-Regular";src: url("./assets/Minecraft-Regular.otf") format("opentype");}');
    terminal.innerHTML = '请求加载字体';
  }
  ttf_usestate_text = !ttf_usestate_text;
  if(ttf_usestate_text){
    ttf_usestate_element.textContent = 'on';
  }else{
    ttf_usestate_element.textContent = 'off'
  }
}
//endregion

//region ooops
const ooops = document.querySelector('.ooops');
// 尝试从 localStorage 获取 DlOoops 数据，若不存在则初始化
let DlOoopsStr = localStorage.getItem('DlOoops');
let DlOoops = ''; // 默认值为空字符串，表示未下载任何ooops文件
if(DlOoopsStr){
  DlOoops = DlOoopsStr; // 直接存储语言代码字符串
}
if(sti.moreOoops){//不仅检查moreooops是否启用，并且检查用户是否同意使用LS
  (async ()=>{//下载对应语言的文本
    let targetLang = sti.ooops_lang; // 获取用户选择的语言
    
    // 如果用户选择的是"auto"，则根据浏览器语言自动选择
    if(targetLang === "auto") {
      if(navLang === 'zh' || navLang === 'zh-CN') {
        targetLang = 'zh-CN';
      } else {
        targetLang = 'en-US';
      }
    }
    
    // 如果当前已下载的语言与目标语言不同，或者没有下载任何语言，则重新下载
    if(DlOoops !== targetLang) {
      // 先清空文本，阻塞显示
      ooops.innerHTML = '';
      
      let OoopsText = null;
      
      // 根据目标语言加载对应的ooops文件
      if(targetLang === 'zh-CN'){
        OoopsText = await loadFile('./assets/ooops/zh-CN.json','json',true,'获取zh-CN的ooops文件') || null;
      } else if(targetLang === 'en-US'){
        OoopsText = await loadFile('./assets/ooops/en-US.json','json',true,'get en-US ooops file') || null;
      }
      
      if(OoopsText) {
        // 文件下载完成后，直接从下载的文件中选择语句显示，不经过localStorage
        if(OoopsText && Array.isArray(OoopsText) && OoopsText.length > 0) {
          ooops.innerHTML = OoopsText[Math.floor(Math.random() * OoopsText.length)];
          // 立即应用样式
          ooops.style.right = `-${ooops.offsetWidth/3}px`;
          ooops.style.fontSize = `${-0.6*ooops.textContent.length +35}px`;
        }
        
        // 然后才存入本地存储供后续使用
        localStorage.setItem('OoopsText', JSON.stringify(OoopsText));
        DlOoops = targetLang; // 更新为当前下载的语言
        localStorage.setItem('DlOoops', DlOoops); // 直接存储语言代码字符串
      }
    } else {
      // 如果不需要下载文件，直接使用现有的文本
      const ooopsTextStr = localStorage.getItem('OoopsText');
      let ooopsInnerText = null;
      if(ooopsTextStr) {
        try {
          ooopsInnerText = JSON.parse(ooopsTextStr);
        } catch (e) {
          console.error('Error parsing OoopsText from localStorage:', e);
          // If parsing fails, try to parse it as direct JSON array
          try {
            ooopsInnerText = JSON.parse(ooopsTextStr);
          } catch (e2) {
            console.error('Failed to parse OoopsText as JSON:', e2);
          }
        }
      }
      if(ooopsInnerText){
        ooops.innerHTML = ooopsInnerText[Math.floor(Math.random() * ooopsInnerText.length)];
        // 应用样式
        ooops.style.right = `-${ooops.offsetWidth/3}px`;
        ooops.style.fontSize = `${-0.6*ooops.textContent.length +35}px`;
      }
    }
  })();
}

//region cd
const cdbg = document.getElementById('cd-page')
const cd_text_link = document.getElementById('cd_text_link')
const cd_text = document.getElementById('cd_text_info')
const cdbtn = document.getElementById('openurl')
const cdcopy = document.getElementById('urlcopy')
function cd(url, text){
  if(url){
    title_main.style.display = 'none';
    cdbg.style.display = 'block';
    cd_text_link.textContent = url;
    cd_text_link.setAttribute('href', url);
    cdbtn.setAttribute('onclick', 'window.location.href=\''+url+'\'');
    cdcopy.onclick = async function(){
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {
        console.error('无法复制文本到剪贴板: ', err);
      }
    }
    if(text){
      cd_text.innerHTML = text; 
    }
  }else{
    title_main.style.display = 'flex';
    cdbg.style.display = 'none';
  }
}
//endregion

//region server
const serverpage = document.getElementById('server-page');
const sv_refresh = document.getElementById('sv_refresh');
const copy_svlink = document.getElementById('copy_svlink');
const sv_list = document.querySelector('.sv-list');
const sv_list_item = document.querySelector('.sv-item');
let get_server_state = false;
let sv_item = null;
let refreshType = 'all';
function server(show){
  if(show){
    title_main.style.display = 'none';
    serverpage.style.display = 'block';
    if(!get_server_state){
      refreshsv('all');
      get_server_state = true;
    }
    sv_list.addEventListener('click', function (get_sv_item) {
      if(sv_item){
        sv_item.classList.remove('clicked');
        refreshType = 'all';
      }
      sv_item = get_sv_item.target.closest('.sv-item');
      if(sv_item){
        sv_item.classList.add('clicked');
        refreshType = sv_item.dataset.serverIp;
      }
    })
  }else{
    title_main.style.display = 'flex';
    serverpage.style.display = 'none';
  }
}
const sv_list_url = ['play.simpfun.cn:19533', 'mc.catserver.moe']
function refreshsv(){
  terminal.innerHTML = '等待服务器响应';
  if(refreshType === 'all'){
    let i = 0;
    let url = '';
    while(i < sv_list_url.length){
      if(i === sv_list_url.length - 1){
        url += sv_list_url[i]; 
      }else{
        url += sv_list_url[i] + ',';
      }
      i++;
    }
    fetch(`//minecraft-server-api-dm-7fqyy01fd0wk.deno.dev?address=${url}`)//可自建服务器，code在https://github.com/Domdkw/mcserver-api
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(jsonData => {
      terminal.innerHTML = '获取服务器状态成功';
      FSS(jsonData);
    })
    .catch(error => {
      terminal.innerHTML = '获取服务器状态失败';
      console.error('There has been a problem with your fetch operation:', error);
    });
  }else{
    fetch(`//minecraft-server-api-dm-7fqyy01fd0wk.deno.dev?address=${refreshType}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(jsonData => {
      terminal.innerHTML = '获取服务器状态成功';
      FSS(jsonData);
    })
    .catch(error => {
      terminal.innerHTML = '获取服务器状态失败';
      console.error('There has been a problem with your fetch operation:', error);
    });
  }
}
function FSS(jsonData){//refreshServer.fetchServerState刷新服务器状态
  console.log(jsonData);
  sv_list_url.forEach(serverUrl => {
    const serverElement = document.querySelector(`[data-server-ip="${serverUrl}"]`);
    if (serverElement) {
      const player_stateElement = serverElement.querySelector('.player-state');
      const sv_description = serverElement.querySelector('.sv-description');
      //const sv_item_state = serverElement.querySelector('.sv-item-state');
      if (player_stateElement) {
        let type = 'unreachable';
        let online_players = '?';
        let max_players = '?';
        if(jsonData[serverUrl].max_players){
          online_players = jsonData[serverUrl].online_players;
          max_players = jsonData[serverUrl].max_players;
          player_stateElement.innerHTML = `${online_players}<span style="color:#eee8">/</span>${max_players}`;
        }else{
          player_stateElement.innerHTML = '无法获取数据';
          player_stateElement.style.fontSize = '12px';
          player_stateElement.style.color = '#fff9';
          type = 'unreachable';
        }
      }
      if(sv_description){
        if(jsonData[serverUrl].description){
          sv_description.textContent = jsonData[serverUrl].description.text;
        }else if(jsonData[serverUrl].error){
          sv_description.textContent = jsonData[serverUrl].error;
          type = 'unreachable';
        }
      }
      const div = document.createElement('div');
      div.classList.add('sv-item-sp', type);
      player_stateElement.appendChild(div);      
    }
  });
}
//endregion
//region Create
function create(){
  title_main.style.display = 'none';
  //css
  const css = document.createElement('link');
  css.href = '/ponder/chest.css';
  css.rel = 'stylesheet';
  document.body.appendChild(css);
  //追加脚本（无加载屏幕）
  terminal.innerHTML += '加载ponder界面渲染脚本(/ponder/index.js) =>插入body<br>加载表格样式表./chest.css<br>';
  const script = document.createElement('script');
  script.src = './ponder/index.js';
  document.body.appendChild(script);
}
//endregion

//region options
const optionsPage = document.getElementById('options-page');
//为下列id的元素添加监听器，使状态实时刷新
const optionAddListenerIds = ['sti-moreooops'];

const options = {
  show: async function(){
  this.handleChange = function (e) { //重写逻辑（优化）
    if (!e.target.classList.contains('canClick')) return;//如果不是可点击元素-class=canClick（处理非btn元素）,直接返回
    const sti = e.target.closest('.setting-item');
    if (!sti) return; //如果不是setting-item元素,直接返回
    const sIType = sti.dataset.type;
    switch(sIType){
      case 'checkbox':
          // 当复选框类型改变时，调用select方法
          if(optionAddListenerIds.includes(sti.id)){
            options.render.select(sti.id);
          }
        break;
      case 'select':
        // 如果是全景图镜像源的选项，需要更新全局变量
        if(sti.id === 'sti-imgMirror') {
          sti.imgMirror = sti.querySelector('select').value;
          terminal.innerHTML = '全景图镜像源已更改为: ' + sti.imgMirror;
        }
        // 如果是指定全景图的选项，需要更新全局变量
      if(sti.id === 'sti-panorama') {
        sti.panorama = value;
        // 提示用户需要刷新页面才能看到效果
        terminal.innerHTML = '全景图设置已更改，请刷新页面以应用更改';
      }
      // 如果是指定ooops语言的选项，需要更新全局变量并提示用户需要刷新页面
      if(sti.id === 'sti-ooops-lang') {
        sti.ooops_lang = value;
        // 提示用户需要刷新页面才能看到效果
        terminal.innerHTML = 'ooops语言设置已更改，请刷新页面以应用更改';
      }
        // 如果是指定音频文件的选项，需要更新全局变量并提示用户需要刷新页面
      if(sti.id === 'sti-audio-file') {
        sti.audio_file = value;
        // 提示用户需要刷新页面才能看到效果
        terminal.innerHTML = '背景音乐设置已更改，请刷新页面以应用更改';
      }
        // 如果是显示控制台的选项，需要更新全局变量
      if(sti.id === 'sti-showConsole') {
        sti.showConsole = value;
      }
      // 如果是全景图帧数限制的选项，需要更新全局变量
      if(sti.id === 'sti-panorama-fps') {
        sti.panorama_fps = value;
        terminal.innerHTML = '全景图帧数限制已更改为 ' + sti.panorama_fps + ' 帧';
      }
        break;
    }
  }
  if (!LS_accept) {
    const accept = await askLocalStorage('本界面使用LocalStorage储存桶来存储设置配置。是否启用LocalStorage?');
    if (accept) return;
    options.hide();
    return;
  }else{
    options.load();
  }
  title_main.style.display = 'none';
  optionsPage.style.display = 'block';
  optionsPage.addEventListener('change', this.handleChange);
  },
  hide: function(){
  optionsPage.removeEventListener('change', this.handleChange);
  title_main.style.display = 'flex';
  optionsPage.style.display = 'none';
  },
  load: function(){
  if(!LS_accept) return;
  const stiObj = JSON.parse( localStorage.getItem('sti') );
  if (!stiObj) return;//检查是否转JSON成功
  stiObj.forEach(function(i){//单个键值
    const sti = optionsPage.querySelector(`#${i.id}`);//sti=setting-item元素
    const sIType = sti.dataset.type;
    switch(sIType){
      case 'checkbox':
        const Cbox = sti.querySelector('label').querySelector('input[type=checkbox]');
        Cbox.checked = i.value;
        if(optionAddListenerIds.includes(sti.id)){
          options.render.select(sti.id);
        }
      break;
      case 'select':
        const sISelect = sti.querySelector('select');
        sISelect.value = i.value;
        // 如果是指定全景图的选项，需要更新全局变量
        if(i.id === 'sti-panorama') {
          sti.panorama = i.value;
        }
        // 如果是指定ooops语言的选项，需要更新全局变量
        if(i.id === 'sti-ooops-lang') {
          sti.ooops_lang = i.value;
        }
        // 如果是指定音频文件的选项，需要更新全局变量
        if(i.id === 'sti-audio-file') {
          sti.audio_file = i.value;
        }
        // 如果是显示控制台的选项，需要更新全局变量
        if(i.id === 'sti-showConsole') {
          sti.showConsole = i.value;
        }
        // 如果是全景图帧数限制的选项，需要更新全局变量
        if(i.id === 'sti-panorama-fps') {
          sti.panorama_fps = i.value;
        }
      break;
    }
  });
  },
  save: function(){
  const sIs = optionsPage.querySelectorAll('.setting-item');
  let result = [];
  sIs.forEach(function(sI){
    const sIType = sI.dataset.type;
    switch(sIType){
    case 'checkbox':
      const Cbox = sI.querySelector('label').querySelector('input[type=checkbox]');
      result.push({id: sI.id,value: Cbox.checked});
    break;
    case 'select':
      const sISelect = sI.querySelector('select');
      const value = sISelect.value;
      result.push({id: sI.id,value: value});
      // 如果是指定全景图的选项，需要更新全局变量
      if(sI.id === 'sti-panorama') {
        sti.panorama = value;
      }
      // 如果是指定ooops语言的选项，需要更新全局变量
      if(sI.id === 'sti-ooops-lang') {
        sti.ooops_lang = value;
      }
      // 如果是指定音频文件的选项，需要更新全局变量
      if(sI.id === 'sti-audio-file') {
        sti.audio_file = value;
      }
      // 如果是显示控制台的选项，需要更新全局变量
      if(sI.id === 'sti-showConsole') {
        sti.showConsole = value;
      }
      // 如果是全景图帧数限制的选项，需要更新全局变量
      if(sI.id === 'sti-panorama-fps') {
        sti.panorama_fps = value;
      }
    break;
    }
  });
  if(LS_accept){
    localStorage.setItem('sti', JSON.stringify(result));
  }
  },
  render: {//render:渲染动态更改的元素
    select: function(id){
      switch(id){// 使用switch处理不同ID的情况
        case 'sti-moreooops':
          const sourceElement = document.getElementById('sti-ooops-source');
          const langElement = document.getElementById('sti-ooops-lang');
          const moreOoops = document.getElementById('sti-moreooops');
          const isChecked = moreOoops.querySelector('label').querySelector('input[type=checkbox]').checked;
          
          // 控制"ooops信息来源"选项
          sourceElement.style.color = isChecked ? 'white' : '';
          sourceElement.classList.toggle('disabled', !isChecked);
          sourceElement.querySelector('select').disabled = !isChecked;
          
          // 控制"指定ooops语言"选项
          langElement.style.color = isChecked ? 'white' : '';
          langElement.classList.toggle('disabled', !isChecked);
          langElement.querySelector('select').disabled = !isChecked;
          break;
        // 可以在这里添加更多case来处理其他ID
        default:
          break;
      }
    }
  },
  btn: {
    showLSInfoSti: function(){
      const stiLSInfoSti = optionsPage.querySelector('.sti-LS-info-sti');
      const LSInfo = localStorage.getItem('sti') || 'LocalStorage.sti未储存任何数据';
      stiLSInfoSti.innerHTML = LSInfo;
    },
    showLSInfoAll: function(){
      const stiLSInfoAll = optionsPage.querySelector('.sti-LS-info-all');
      const LSInfo = JSON.stringify(localStorage) || 'LocalStorage未储存任何数据';
      stiLSInfoAll.innerHTML = LSInfo;
    },
    cleanLS: function(){
      localStorage.removeItem('sti');
      const stiLScleanSti = optionsPage.querySelector('.sti-LS-clean-sti');
      stiLScleanSti.innerHTML = 'LocalStorage.sti已清除';
    },
    cleanAllLS: function(){
      localStorage.clear();
      LS_accept = false;
      const stiLScleanAll = optionsPage.querySelector('.sti-LS-clean-all');
      const stiLScleanSti = optionsPage.querySelector('.sti-LS-clean-sti');
      stiLScleanSti.innerHTML = 'LocalStorage.sti已清除';
      stiLScleanAll.innerHTML = '所有LocalStorage已清除';
    },
  },
  subPage: function(page){
    //子界面切换
    const settingDivs = optionsPage.querySelectorAll('.setting-div');
    settingDivs.forEach(function(div){
      div.classList.remove('show');
    });
    const activeDiv = optionsPage.querySelector(`.setting-div.${page}`);
    activeDiv.classList.add('show');
    //Tab按钮样式更改
    const tabs = optionsPage.querySelectorAll('.tab');
    tabs.forEach(function(tab){
      tab.classList.remove('active');
    });
    const activeTab = optionsPage.querySelector(`.tab[onclick="options.subPage('${page}')"]`);
    activeTab.classList.add('active');
  },
}
window.options = options;
//region 询问LocalStorage
const oLASection = document.getElementById('option-LS');
const oLAText = document.getElementById('oLA-text');
function askLocalStorage(text) {
  return new Promise((resolve) => {
    if (!LS_accept) {
      oLAText.innerHTML = text;
      oLASection.style.display = 'block';
      const handleClick = function (e) {
        if (e.target.id === 'oLA-accept-Btn') {
          LS_accept = true;
          localStorage.setItem('LS_accept', 'true');
          oLASection.style.display = 'none';
          oLASection.removeEventListener('click', handleClick);
          resolve(true);
        } else if (e.target.id === 'oLA-cancel-Btn') {
          LS_accept = false;
          oLASection.style.display = 'none';
          oLASection.removeEventListener('click', handleClick);
          resolve(false);
        }
      };
      oLASection.addEventListener('click', handleClick);
    } else {
      resolve(true);
    }
  });
}
//endregion

//check href
function checkHref(){
  const search = window.location.search;
  //检查是否有ponder参数
  const ponder = new URLSearchParams(search).get('ponder');
  console.log('ponder直接跳转参数:', ponder);
  if(ponder === 'true'){
    //加载ponder界面
    create();
    //先通过create函数拉取出读取进度的主要文件.在那个文件中再进行多次引导到进入ponder
  }
  //如果没有的话则需要点击按钮才会进ponder
}

//region music functions
let sound_enable = false;

// 初始化音乐功能
document.querySelector('.sound_range_div').addEventListener('click', () => {
  if (sound_enable) return;
  sound_enable = true;
  document.getElementById('sound_state').textContent = 'Loading';
  terminal.innerHTML = '加载音乐功能';
  initMusic();
});

function initMusic() {
  const audio = document.getElementById('Playmusic');
  const soundstate = document.getElementById('sound_state');
  const volumeSlider = document.getElementById('volume_slider');
  const audioFiles = [
    "Mutation.mp3",
    "Beginning_2.mp3",
    "Floating_trees.mp3",
    "Crescent Dunes - Aaron Cherof&Minecraft.mp3",
    "Infinite Amethyst - Lena Raine、Minecraft.mp3"
  ];

  // 从localStorage获取选定的音频文件设置
  const stiData = localStorage.getItem('sti');
  let audioSetting = 'random';

  if (stiData) {
    try {
      const parsedData = JSON.parse(stiData);
      const audioConfig = parsedData.find(item => item.id === 'sti-audio-file');
      if (audioConfig) {
        audioSetting = audioConfig.value;
      }
    } catch (e) {
      console.error('解析localStorage.sti失败:', e);
    }
  }

  let selectedAudioFile;
  if (audioSetting === 'random') {
    // 随机选择音频文件
    const randomIndex = Math.floor(Math.random() * audioFiles.length);
    selectedAudioFile = audioFiles[randomIndex];
  } else {
    // 使用指定的音频文件
    selectedAudioFile = audioSetting;
  }

  terminal.innerHTML = '音频文件：<a href="./assets/sound/'+selectedAudioFile+'">'+selectedAudioFile+'</a>';

  let currentVolume = parseFloat(volumeSlider.value);

  // 定义一个变量来保存点击音效的 Audio 对象
  let clickAudio = null;
  audio.src = './assets/sound/'+selectedAudioFile;
  //检查滑块是否改变（!==0）
  if (volumeSlider.value !== 0) Playmusic();

  //侦听滑块状态，改变音量
  volumeSlider.addEventListener('input', () => Playmusic());

  function Playmusic(){
    currentVolume = parseFloat(volumeSlider.value); // 更新当前音量值
    audio.volume = currentVolume;
    soundstate.textContent = Math.round(currentVolume * 100) + '%';
    if (currentVolume > 0) {
      if (audio.paused) {
        audio.play();
      }
    } else {
      audio.pause();
    }
  }

  //点击音乐
  document.body.addEventListener('click', function (Click_ogg) {
    const Click_ogg_button = Click_ogg.target.closest('button') || Click_ogg.target.closest('.canClick'); // 查找最近的按钮元素
    if (Click_ogg_button) {
      if (currentVolume > 0) {
        if (!clickAudio) {
          // 如果 clickAudio 还没有创建，则创建一个新的 Audio 对象
          clickAudio = new Audio('./assets/sound/Click.ogg.mp3');
        }
        clickAudio.volume = currentVolume;
        if (clickAudio.paused) {
          clickAudio.currentTime = 0;
          clickAudio.play();
        }
      }
    }
  });
}
//endregion
