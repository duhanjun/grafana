# Portainer Git 自动化配置指南

本指南帮助您在 Portainer 中配置 Git 自动化，从 GitHub 仓库自动部署 Grafana。

## 前置条件

1. **Portainer 已安装并运行**（自托管）
2. **GitHub 仓库已准备好**（本仓库）
3. **MySQL 数据库已准备好**（用于存储 Grafana 数据）

## 配置步骤

### 1. 准备 GitHub 仓库

确保仓库中包含以下文件（已在仓库中准备好）：

- `custom/portainer-docker-compose.yaml` - Docker Compose 配置
- `custom/portainer.env` - 环境变量模板

### 2. 在 Portainer 中创建 Git 自动化

#### 步骤 2.1: 访问 Portainer

1. 打开 Portainer Web 界面
2. 选择您的 Docker 环境（Local 或自定义环境）

#### 步骤 2.2: 创建 Stack

1. 点击左侧菜单的 **"Stacks"**
2. 点击 **"+ Add stack"** 按钮
3. 选择 **"Repository"** 选项卡

#### 步骤 2.3: 配置 Git 仓库

填写以下信息：

```
Name: Grafana
Repository URL: https://github.com/duhanjun/grafana
Repository reference: main
Compose Path: custom/portainer-docker-compose.yaml
Authentication: No (公开仓库)
```

#### 步骤 2.4: 配置自动部署

在 **"Auto-update"** 部分：

```
✅ Enable auto-update
Auto-update policy: Watchtower
Frequency: Check every 1 hour
```

或者手动配置：

```
✅ Enable auto-update
Auto-update policy: Pull latest image and re-deploy
Frequency: Check every 1 hour
```

#### 步骤 2.5: 配置环境变量

在 **"Environment variables"** 部分，点击 **"+ Add an environment variable"**，添加以下必填变量：

```bash
# 容器配置
GRAFANA_VERSION=13.0.1
CONTAINER_NAME=Grafana
GRAFANA_PORT=3000
GRAFANA_INTERNAL_PORT=3000

# 数据库配置
GF_DATABASE_TYPE=mysql
GF_DATABASE_HOST=your-mysql-host.example.com:3306
GF_DATABASE_NAME=grafana
GF_DATABASE_USER=grafana_db
GF_DATABASE_PASSWORD=your-database-password
```

> **注意**: 其他可选配置（如 `GF_SERVER_DOMAIN`、`GF_SERVER_ROOT_URL`、`GF_SECURITY_ALLOW_EMBEDDING` 等）可以在 Grafana 部署后，通过 **Configuration → Server → General** 页面进行设置。

#### 步骤 2.6: 部署 Stack

1. 点击 **"Deploy the stack"** 按钮
2. 等待部署完成

### 3. 访问 Grafana

部署成功后，通过以下地址访问 Grafana：

```
http://your-server-ip:3000
```

使用配置的管理员账号登录：

```
用户名: admin（或其他配置的账号）
密码: your-strong-password（您在环境变量中设置的密码）
```

### 4. 配置 Webhooks（可选）

要实现 Push 代码时自动部署，请配置 GitHub Webhook：

#### 4.1: 在 Portainer 中获取 Webhook URL

1. 进入您创建的 Stack
2. 点击 **"Webhooks"**
3. 复制 Webhook URL

#### 4.2: 在 GitHub 中配置 Webhook

1. 打开 GitHub 仓库设置
2. 进入 **"Webhooks"** 页面
3. 点击 **"Add webhook"**
4. 填写信息：
   - **Payload URL**: 粘贴 Portainer Webhook URL
   - **Content type**: `application/json`
   - **Events**: 选择 **"Pushes"**
5. 点击 **"Add webhook"**

## 故障排除

### 常见问题

#### 1. 容器启动失败

**错误**: `Cannot connect to database`

**解决方案**:
- 检查 `GF_DATABASE_HOST` 环境变量是否正确
- 确认 MySQL 服务器可访问
- 检查数据库用户名和密码

#### 2. 端口冲突

**错误**: `port is already allocated`

**解决方案**:
- 修改 `GRAFANA_PORT` 环境变量，使用其他端口
- 或停止占用 3000 端口的其他服务

#### 3. 权限问题

**错误**: `permission denied`

**解决方案**:
- 确保 Docker 有权限访问映射的卷
- 检查 SELinux/AppArmor 配置

### 查看日志

```bash
# 查看容器日志
docker logs -f grafana

# 查看实时日志
docker logs --tail=100 -f grafana
```

### 手动更新

如果自动更新失败，可以手动更新：

1. 在 Portainer 中进入 Stack 页面
2. 点击 **"Update"** 按钮
3. Stack 会重新拉取最新的 Git 仓库内容并重新部署

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GRAFANA_VERSION` | 是 | latest | Grafana 镜像版本（可用 latest 或具体版本号） |
| `CONTAINER_NAME` | 是 | Grafana | Docker 容器名称 |
| `GRAFANA_PORT` | 是 | - | 宿主机映射端口 |
| `GRAFANA_INTERNAL_PORT` | 是 | - | 容器内部端口 |
| `GF_DATABASE_TYPE` | 是 | - | 数据库类型（mysql/postgres/sqlite3） |
| `GF_DATABASE_HOST` | 是 | - | 数据库主机地址（包含端口） |
| `GF_DATABASE_NAME` | 是 | grafana | 数据库名称 |
| `GF_DATABASE_USER` | 是 | - | 数据库用户名 |
| `GF_DATABASE_PASSWORD` | 是 | - | 数据库密码 |

> **注意**: 其他配置（如 `GF_SERVER_DOMAIN`、`GF_SERVER_ROOT_URL`、`GF_SECURITY_ALLOW_EMBEDDING` 等）可以在 Grafana 部署后通过 **Configuration → Server → General** 页面设置。

## 安全建议

1. **使用强密码**: 为数据库和 Grafana 管理员设置强密码
2. **启用 HTTPS**: 生产环境建议使用 HTTPS
3. **限制访问**: 配置防火墙规则，限制对 3000 端口的访问
4. **定期更新**: 保持 Grafana 版本最新
5. **备份数据**: 定期备份 MySQL 数据库

## 相关链接

- [Portainer 官方文档](https://documentation.portainer.io/)
- [Grafana Docker 官方文档](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)
- [Docker Compose 官方文档](https://docs.docker.com/compose/)
