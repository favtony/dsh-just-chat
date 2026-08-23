# DSH 隔离验证安全规则

- 禁止在当前 shell 中手工修改 `DSH_HOME` 或 `DSH_AGENTS_HOME` 后直接运行 DSH；安装验证只能执行 `pnpm run verify:isolated-profile`，真实 Web 验证只能执行 `pnpm run start:isolated-web`。
- 禁止直接使用递归删除命令清理验证环境；只能使用仓库的受控清理入口。
- 调用清理入口前，必须向用户展示规范化绝对 `sandboxRoot` 和所有权编号，并取得对该准确目标的删除确认。
- profile 验证和隔离目录清理不得申请提升权限。
