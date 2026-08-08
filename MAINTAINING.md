# 维护说明 · Image Hover Lightbox

## 版本

- 当前版本见根目录 `VERSION`（单行，如 `0.1.0`）
- 变更记录见 `CHANGELOG.md`
- Git 标签：`vX.Y.Z`（与 VERSION 一致）
- **本仓版本与 catalog、其它脚本仓无关**，各自递增

### 发版步骤

1. 改 `VERSION` + `CHANGELOG.md` + 脚本头注释中的 version  
2. `git commit` + `git tag vX.Y.Z` + `git push && git push --tags`  
3. 更新 [excalidraw-scripts-catalog](https://github.com/otto-OBplugins/excalidraw-scripts-catalog) 中该脚本的版本号一行  
4. （可选）GitHub Release 附说明  

## 仓库角色

| 位置 | 角色 |
|------|------|
| 本 GitHub 仓 | **发布源**（install raw、对外 README） |
| 本地业务仓 `obsidian-scripts` | 可选的开发/测试区，**不要求**与本仓同 remote |
| 用户 vault | 安装产物，**永不提交**到公开仓 |

## 敏感信息

禁止提交：本机路径、私人 vault 内容、token、`.env`、组织 billing 邮箱。

## 联系

- Issues：本仓库 GitHub Issues  
- 组织：https://github.com/otto-OBplugins  
