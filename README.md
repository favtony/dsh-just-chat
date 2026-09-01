# dsh-just-chat

`dsh-just-chat` 是 DSH Web 的外部插件，不需要工作区，直接跟 agent 开始对话。

许可证：MIT。

## 兼容性

- DSH `0.1.1-rc.2`
- Node.js `^22.19.0 || >=24.0.0`

## 安装

从公开 GitHub 地址安装：

```powershell
dsh plugin --profile <profile> add github:favtony/dsh-just-chat#main
```

也可以把 `main` 替换为公开的标签或提交号。仓库地址：

<https://github.com/favtony/dsh-just-chat>

开发插件时，才使用本地目录安装：

```powershell
dsh plugin --profile <profile> add link:<插件绝对路径>
```

插件只适配当前 DSH 安装中官方的工作区选择器、输入栏和侧栏浏览器 live entry，官方组件、菜单、行、布局和目录流程仍由 DSH 渲染；不要与其他适配相同 live entry 的插件同时启用。

插件要求 DSH 内部包精确为 `0.1.1-rc.2`。安装阶段会检查版本，宿主启动时会再次检查；版本不匹配时安装或启动直接失败，不提供替代界面。

安装或更新后必须重启已经运行的 `dsh web`，再刷新浏览器页面；客户端插件清单在 Web 启动时生成，已打开的页面不会自动载入新版本。

## 使用

1. 新建对话时选择“`不在项目中工作`”，无需选择工作区。
2. 输入纯文本后发送，直接跟 agent 开始对话；此时才创建目录和真实会话。
3. 打开设置的“插件 -> 插件配置”，展开“`对话目录`”卡片，填写根目录和目录名模板。

未发送的文本会在刷新或重新打开后恢复。自动创建的会话显示在侧栏“`对话`”区域，工作区与对话搜索互不影响。
