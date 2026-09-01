# 公开 GitHub 地址安装规格

## 目标

不上架 dsh-market，不发布 npm，也不发布 GitHub 预构建包。目标是让其他人拿到公开 GitHub 地址后，直接通过 DSH 安装 dsh-just-chat。

## 已确认的方案

- GitHub 仓库： https://github.com/favtony/dsh-just-chat
- 安装来源：公开 GitHub 仓库源码。
- 不发布 npm。
- 不发布 GitHub Release 预构建 .tgz。
- 不提交 awesome-dsh-plugin 收录申请。
- 不要求 dsh-plugin topic、10 个提交或 dsh-market 同步。
- 不为兼容旧 DSH 版本增加替代界面或其它不等价 fallback。

## 对外安装方式

README 需要提供下面的公开安装命令：

    dsh plugin --profile <profile> add github:favtony/dsh-just-chat#main

其中 <profile> 替换为用户自己的 profile 名称。也可以把 main 替换为具体的公开分支、标签或提交号。

仓库已有实际验证过的 GitHub 安装形式：

    dsh plugin --profile web add github:favtony/dsh-just-chat#7f44dbf

安装或更新后需要重启已经运行的 dsh web，再刷新页面；README 需要保留 DSH 版本要求、Node.js 要求、功能、限制、更新和卸载说明。

## URL 安装必须满足的条件

- GitHub 仓库为 Public，普通用户无需登录即可读取仓库内容。
- 用户安装的分支、标签或提交包含已构建的 lib 文件；当前仓库的 lib 目录已纳入 Git 跟踪。
- package.json 保留 dsh.bundle.patch 声明，并能找到 cordis.patch.yml；当前仓库已有这两项。
- package.json 的 files 清单包含 lib、补丁文件、安装兼容检查脚本和 README；当前打包预览已通过。
- 安装阶段和启动阶段继续执行现有宿主版本检查；版本不匹配时直接失败，不显示替代界面。
- 公开仓库历史和当前文件不能包含密钥、令牌、内部地址、本机路径或内部资料。

不发布 npm，所以保留 package.json 中的 private: true；GitHub 源码安装不以 npm 发布为前提。

## 当前基线

- 当前分支：main，与 origin/main 同步。
- 当前包名和版本：dsh-just-chat@0.1.0。
- 当前 DSH 兼容版本：0.1.1-rc.2。
- 当前 Node.js 要求：^22.19.0 || >=24.0.0。
- 当前 GitHub 安装验证曾使用 github:favtony/dsh-just-chat#7f44dbf，并成功启动 profile。
- 当前工作树有未跟踪文件 docs/架构审查报告.html；它不纳入本次公开发布，也不自动提交。
- 已确认采用 MIT 许可证。

## 已确认的发布决定

- 许可证采用 MIT。
- README 对外描述为：不需要工作区，直接跟 agent 开始对话。
- 安装只使用公开 GitHub 地址，不发布 npm，也不发布 GitHub 预构建包。

## 公开前待处理问题

已跟踪的内部规格文档 `规格-不在项目中工作对话.md` 曾包含本机绝对路径、隔离验证目录和所有权编号。它们不是访问凭据，但公开仓库后会暴露本机环境信息。已按用户确认的方案 A 脱敏，不删除该文档。

- 已执行方案 A：保留文档，将本机路径、隔离目录、所有权编号和测试目录改为脱敏占位。
- 未删除该文档。

## 实施工作

已确认许可证后执行：

1. 更新 README，把安装入口改为公开 GitHub 地址，并明确不需要工作区即可直接和 agent 开始对话。
2. 创建 MIT LICENSE，并在 README 标明许可证和仓库地址。
3. 检查 package.json、构建产物、补丁文件和 Git 跟踪状态，确保公开 GitHub 安装拿到的是可运行版本。
4. 执行类型检查、测试、构建、打包检查和仓库规定的隔离 profile 安装验证。
5. 检查公开发布内容和全部 Git 历史，确认没有敏感信息或内部资料。
6. 由用户在 GitHub 将仓库改为 Public，并把准备好的改动推送到公开可访问的分支或提交；未经明确要求不替用户修改可见性或推送。
7. 仓库公开并推送后，使用公开 GitHub 地址在全新隔离 profile 中安装，验证插件加载和 Web 页面功能。
8. 将最终安装命令、兼容版本、重启要求和已知限制保留在 README 中。

## 不在范围内

- dsh-market 搜索、目录收录和市场同步。
- awesome-dsh-plugin 条目或 Pull Request。
- dsh-plugin topic 和仓库 10 个提交门槛。
- npm 包、npm 版本或 npm 下载量。
- GitHub Release 和预构建 .tgz。
- 修改 DSH 官方仓库或 dsh-market 实现。
- 把 docs/架构审查报告.html 纳入本次发布。

## 本轮验证记录

- `pnpm run typecheck`：通过。
- `pnpm run build`：通过；仅有 tsdown 已有的弃用配置和 sourcemap 警告。
- `pnpm pack --dry-run`：通过；清单包含 `LICENSE`、README、`cordis.patch.yml`、`lib` 和安装检查脚本。没有发布或保留预构建包。
- `pnpm run smoke:package`：通过。
- `git diff --check`：通过。
- `pnpm run test`：未进入测试用例；Vitest 加载配置时因当前环境禁止子进程，报 `spawn EPERM`。
- `pnpm run verify:isolated-profile`：未完成；脚本按规定创建并保留隔离目录，但启动 DSH 子进程时因当前环境禁止 `spawnSync node.exe`，报 `EPERM`。
- GitHub 当前状态仍为 Private、没有 topic；未修改 GitHub 设置，已完成本地提交，未推送。
- 当前文件的路径信息已脱敏；旧历史中的本机路径、用户名、隔离目录和所有权编号已按用户确认执行本地历史改写，远端尚未推送。

## 进度跟踪

- [x] 确认不上架 dsh-market。
- [x] 确认不发布 npm。
- [x] 确认不发布 GitHub 预构建包。
- [x] 确认通过公开 GitHub 地址安装。
- [x] 查实当前 GitHub 安装命令格式，并有历史成功验证记录。
- [x] 确认采用 MIT 许可证。
- [x] 更新 README 的公开 GitHub 安装说明。
- [x] 创建 MIT 许可证文件并更新 README。
- [x] 完成构建和打包验证；隔离安装因当前环境禁止启动 node.exe 子进程而被 `spawnSync ... EPERM` 阻断。
- [ ] 用户完成 GitHub Public 和推送。
- [ ] 完成公开 GitHub 地址安装验证；需在允许启动子进程的环境中执行。

## 资料来源

- [DSH 官方插件扩展接口调研](../调研-官方DSH扩展接口.md)
- [DSH 插件检查工具说明](https://github.com/deepseek-ai/deepseek-harness/discussions/1693)
