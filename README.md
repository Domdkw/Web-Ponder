# MC-Panorama - Create:Ponder 项目

[![GitHub commit activity](https://img.shields.io/github/commit-activity/t/Domdkw/Web-Ponder)](https://github.com/Domdkw/Web-Ponder/commits/master)
[![GitHub last commit](https://img.shields.io/github/last-commit/Domdkw/Web-Ponder)](https://github.com/Domdkw/Web-Ponder/commits/master)
[![GitHub license](https://img.shields.io/github/license/Domdkw/Web-Ponder)](https://github.com/Domdkw/Web-Ponder/blob/main/LICENSE)
[![Netlify Status](https://api.netlify.com/api/v1/badges/e952630e-4b26-42f8-8a65-07ab035ea003/deploy-status)](https://app.netlify.com/projects/domdkw-mc/deploys)
## 项目概述

MC-Panorama是一个基于Web的Minecraft物品可视化与交互式学习平台，专注于机械动力(Create)模组的教学和展示。

## 核心功能

- **物品网格系统**: 5×9的Minecraft箱子布局，支持分页浏览
- **3D可视化引擎**: 基于Three.js构建的3D渲染引擎
- **学习流程系统**: 通过JSON配置文件定义学习流程
- **多语言支持**: 支持中文和英文界面
- **全景背景系统**: 动态加载的Minecraft全景背景

## 技术架构

- **核心框架**: 原生JavaScript (ES6+)
- **3D引擎**: Three.js
- **样式系统**: CSS3与Minecraft风格UI设计
- **模块化设计**: 插件式引擎架构

### domdkw/v1引擎

核心渲染引擎位于 `/ponder/engine/domdkw/v1/` 目录，包含：
- **vanilla.js**: 实现Minecraft风格3D场景渲染
- **command.js**: 提供方块操作、动画和场景控制的命令集
- **nogltf.boot.html**: 引擎启动引导文件和UI界面

## 使用方法

1. 直接打开 `index.html` 文件
2. 点击"机械动力：思索"按钮进入物品界面
3. 浏览物品网格，点击感兴趣的项目
4. 跟随3D场景中的提示进行交互学习

## 配置说明

### 物品配置 (`ponder/item.json`)
```json
[
  {
    "name": "dirt",
    "icon": "/ponder/minecraft/item/block/dirt.png",
    "process": "/ponder/process/dirt.json"
  }
]
```

### 流程配置 (domdkw/v1:`ponder/process/dirt.json`)
```json
{
  "title": {
    "name": "dirt",
    "icon": {
      "size": "normal",
      "tag": "minecraft:dirt"
    }
  },
  "loader": {
    "indexes": "/ponder/engine/domdkw/v1/1.21.8.texture.mapping.json",
    "engine": ["domdkw/v1/vanilla.js"],
    "boot": {
      "html": "/ponder/engine/domdkw/v1/nogltf.boot.html"
    },
    "block": ["minecraft:dirt", "minecraft:stone"]
  },
  "scenes": [
    {
      "description": "dirt is a block that is found in the overworld.",
      "base": {
        "default": "create",
        "create": {
          "style": "5x5chessboard",
          "offset": {"x": 0, "y": -1, "z": 0}
        }
      },
      "fragment": [
        ["setblockfall('minecraft:dirt',0,0,5)", "idle(1)"]
      ]
    }
  ]
}
```

## 项目结构
```
MC-Panorama/
├── index.html          # 主页面
├── mc-background.js    # 全景背景管理
├── page.js            # 页面逻辑与交互
├── styles.css         # 全局样式文件
├── playsound.js       # 音效管理
├── ponder/            # 核心功能目录
│   ├── index.js       # 思索功能主逻辑
│   ├── chest.css      # 思索界面样式
│   ├── item.json      # 物品配置
│   ├── process/       # 流程配置文件
│   │   ├── dirt.json  # 泥土示例流程
│   │   └── onlypanorama.json  # 仅全景示例
│   ├── engine/        # 引擎插件
│   │   ├── domdkw/    # domdkw引擎实现
│   │   │   └── v1/    # v1版本引擎
│   │   │       ├── vanilla.js        # 核心渲染引擎
│   │   │       ├── command.js        # 命令集实现
│   │   │       ├── nogltf.boot.html  # 引擎启动引导
│   │   │       └── 1.21.8.texture.mapping.json  # 纹理映射
│   │   └── create/     # Create引擎(待开发)
│   ├── minecraft/     # Minecraft资源文件
│   │   ├── textures/  # 纹理资源
│   │   └── item/      # 物品图标资源
│   └── create/        # Create模组资源
├── assets/            # 静态资源
│   ├── ooops/         # 随机提示文本
│   ├── page/          # 页面相关资源
│   ├── sound/         # 音效文件
│   └── server/        # 服务器相关资源
├── lang/              # 多语言支持
│   ├── zh-CN.json     # 简体中文
│   ├── zh-TW.json     # 繁体中文
│   └── en-US.json     # 英文
├── panorama/          # 全景背景图片
└── LICENSE            # MIT许可证文件
```

## 开发指南

### 添加新物品
1. 在 `ponder/minecraft/item/` 目录下添加物品图标
2. 在 `ponder/item.json` 中添加物品配置
3. 创建对应的流程配置文件到 `ponder/process/` 目录
4. 如需新纹理，更新 `ponder/engine/domdkw/v1/1.21.8.texture.mapping.json`

### 自定义流程
流程配置支持以下命令：
- `setblock(block, x, y, z)`: 放置方块
- `setblockfall(block, x, y, z, duration)`: 放置带下落动画的方块
- `removeblock(x, y, z)`: 移除方块
- `moveBlock(x1, y1, z1, x2, y2, z2, duration)`: 移动方块
- `tip(x, y, z, text, color, duration)`: 显示提示文本
- `idle(duration)`: 等待指定时间

## 未来开发计划

### 短期目标
- [ ] 增加更多机械动力物品和流程
- [ ] 优化移动端体验和触控支持
- [x] 添加声音效果和背景音乐
- [ ] 改进3D渲染性能和内存管理
- [ ] 实现场景编辑器功能

### 长期目标
- [ ] 支持更多模组（如热力膨胀、应用能源等）
- [ ] 添加用户自定义流程功能
- [ ] 实现云端同步和分享功能
- [ ] 构建社区分享平台

## 关于作者

作者技术水平有限，代码可能存在许多不足之处。项目仍在学习和改进中，欢迎各位提出建议和帮助改进。

## 贡献指南

我们欢迎所有形式的贡献！无论是提交Bug报告、功能请求，还是直接提交代码，都能帮助项目变得更好。
Fork 本仓库 or
创建一个Pull Request
## 许可证

本项目采用 **MIT许可证** - 详见 [LICENSE](LICENSE) 文件

## 支持与反馈

如有问题或建议，请通过GitHub Issues提交。

---

> 提示：本项目仍在开发中，代码质量可能不高，欢迎反馈和建议！