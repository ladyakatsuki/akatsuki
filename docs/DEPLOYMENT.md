# 部署文档

本文档说明多人联机跑团平台的生产环境部署方式，包括后端服务、前端静态文件、Nginx 反向代理及公网安全配置。

## 目录

- [环境要求](#环境要求)
- [后端部署](#后端部署)
- [前端部署](#前端部署)
- [Nginx 反向代理示例](#nginx-反向代理示例)
- [PM2 进程管理示例](#pm2-进程管理示例)
- [公网部署安全注意事项](#公网部署安全注意事项)

## 环境要求

| 依赖 | 版本要求 | 说明 |
| --- | --- | --- |
| Node.js | `>=18.0.0`（推荐 20.x LTS 或 22.x LTS） | 后端运行时，前端构建 |
| npm | `>=9.0.0` | 随 Node.js 安装 |
| Nginx | `>=1.18` | 静态文件服务与反向代理（可选） |
| PM2 | `>=5.0` | Node.js 进程管理（可选） |

> 后端依赖 `better-sqlite3`，安装时会编译原生模块，需确保系统具备编译工具（Linux 需 `build-essential`/`python3`，Windows 需 Visual Studio Build Tools）。

## 后端部署

### 1. 环境变量配置

在 `backend/` 目录下复制 `.env.example` 为 `.env` 并按生产环境修改：

```bash
cp .env.example .env
```

```dotenv
# 服务端口
PORT=3000

# 上传文件存储目录（建议使用绝对路径）
UPLOAD_DIR=/var/www/tabletop/uploads

# CORS 允许来源（生产环境必须指定具体域名，禁止使用 *）
CORS_ORIGIN=https://tabletop.example.com

# SQLite 数据库文件路径
DB_PATH=/var/www/tabletop/data/app.db
```

#### 环境变量说明

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务监听端口 |
| `UPLOAD_DIR` | `./uploads` | 上传文件存储目录（运行时自动创建） |
| `CORS_ORIGIN` | `*` | CORS 允许来源，生产环境建议指定具体域名 |
| `DB_PATH` | `./data/app.db` | SQLite 数据库文件路径（运行时自动创建） |

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 4. 启动

```bash
npm start
```

启动后可访问健康检查接口验证：

```bash
curl http://localhost:3000/health
# 返回: { "status": "ok" }
```

### 5. PM2 进程管理示例

安装 PM2：

```bash
npm install -g pm2
```

在 `backend/` 目录下创建 `ecosystem.config.cjs`：

```javascript
module.exports = {
  apps: [
    {
      name: 'tabletop-backend',
      script: 'dist/index.js',
      cwd: '/var/www/tabletop/backend',
      instances: 1, // SQLite 单进程模式，不要使用 cluster
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        UPLOAD_DIR: '/var/www/tabletop/uploads',
        CORS_ORIGIN: 'https://tabletop.example.com',
        DB_PATH: '/var/www/tabletop/data/app.db',
      },
    },
  ],
};
```

启动：

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 设置开机自启
```

常用命令：

```bash
pm2 status              # 查看状态
pm2 logs tabletop-backend  # 查看日志
pm2 restart tabletop-backend
pm2 stop tabletop-backend
```

> 注意：后端使用 SQLite，必须以单进程模式运行（`instances: 1`），不可使用 cluster 模式，否则会导致数据库锁冲突。

## 前端部署

### 1. 环境变量配置

在 `frontend/` 目录下创建 `.env.production`：

```dotenv
# 后端 API 地址（生产环境域名）
VITE_API_URL=https://tabletop.example.com/api

# Socket.IO 服务地址（生产环境域名）
VITE_SOCKET_URL=https://tabletop.example.com
```

> 若前端与后端同域（通过 Nginx 反向代理），可配置为：
>
> ```dotenv
> VITE_API_URL=/api
> VITE_SOCKET_URL=
> ```

### 2. 安装依赖

```bash
cd frontend
npm install
```

### 3. 构建

```bash
npm run build
```

构建产物输出到 `frontend/dist/` 目录，包含 `index.html` 与 `assets/` 静态资源。

### 4. Nginx 静态文件服务示例

将 `dist/` 目录内容复制到服务器：

```bash
cp -r dist/* /var/www/tabletop/frontend/
```

Nginx 配置见下方 [Nginx 反向代理示例](#nginx-反向代理示例)。

## Nginx 反向代理示例

以下配置将前端静态文件、后端 API、WebSocket 代理统一在 443 端口（HTTPS）下：

```nginx
server {
    listen 80;
    server_name tabletop.example.com;
    # HTTP 重定向到 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tabletop.example.com;

    # SSL 证书配置
    ssl_certificate     /etc/nginx/ssl/tabletop.example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/tabletop.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # ============ 前端静态文件 ============
    root /var/www/tabletop/frontend;
    index index.html;

    # 单页应用路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ============ 后端 API 代理 ============
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 文件上传大小限制（与后端 5MB 一致）
        client_max_body_size 6m;
    }

    # ============ 上传文件代理 ============
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 7d;
    }

    # ============ 健康检查代理 ============
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }

    # ============ WebSocket 代理（Socket.IO） ============
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 长连接超时设置
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### 配置说明

| 路径 | 作用 |
| --- | --- |
| `/` | 前端静态文件，单页应用路由回退到 `index.html` |
| `/assets/` | 前端构建资源，长期缓存 |
| `/api/` | 后端 REST API 代理 |
| `/uploads/` | 后端上传文件代理 |
| `/health` | 后端健康检查 |
| `/socket.io/` | Socket.IO WebSocket 代理，需设置 `Upgrade` 与 `Connection` 头 |

重载 Nginx 配置：

```bash
nginx -t          # 测试配置
nginx -s reload   # 重载
```

## 公网部署安全注意事项

### CORS 配置

生产环境**禁止**使用 `CORS_ORIGIN=*`，必须指定具体域名：

```dotenv
# 正确：指定具体域名
CORS_ORIGIN=https://tabletop.example.com

# 错误：允许所有来源
CORS_ORIGIN=*
```

若前端与后端同域（通过 Nginx 反向代理），可不设置 CORS（同源无跨域问题）。

### HTTPS

公网部署必须启用 HTTPS：

1. 申请 SSL 证书（推荐 Let's Encrypt 免费证书）
2. Nginx 配置 443 端口 SSL
3. HTTP 80 端口重定向到 HTTPS
4. 后端 `CORS_ORIGIN` 使用 HTTPS 协议头

使用 Let's Encrypt 申请证书示例：

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
certbot --nginx -d tabletop.example.com
```

### 文件上传限制

后端已对文件上传做以下限制：

| 限制项 | 值 | 说明 |
| --- | --- | --- |
| 单文件大小 | 5MB | 立绘、素材、故事书上传均限制 5MB |
| 允许的 MIME 类型 | `image/jpeg`、`image/png`、`image/webp`、`image/gif` | 仅允许图片格式 |
| JSON 请求体大小 | 5MB | Express `express.json({ limit: '5mb' })` |

Nginx 侧需同步配置 `client_max_body_size`（建议略大于后端限制）：

```nginx
client_max_body_size 6m;
```

### 房间码访问控制

平台通过房间码（6 位字母数字）控制房间访问：

- 房间码由后端生成，仅房间内成员知晓
- Socket 连接需在 `handshake.auth` 中提供 `roomCode` 与 `playerId`，服务端校验：
  - 房间码存在
  - 玩家在房间成员列表中（DM 直接放行）
- DM 可踢出玩家（`room:kick` 事件）
- 玩家断线后保留房间成员身份，允许重连

**安全建议**：

- 房间码仅通过私密渠道分享，不在公开页面展示
- 定期清理长期空闲房间（可扩展实现定时任务）
- 生产环境可考虑增加房间码过期机制

### 其他安全建议

1. **限制端口暴露**：后端仅监听 `127.0.0.1:3000`，通过 Nginx 反向代理对外服务，不直接暴露 3000 端口。

   ```dotenv
   # 若无需直接访问后端，可绑定到本地
   # 修改 backend/src/index.ts 中 httpServer.listen 增加 hostname 参数
   ```

2. **日志脱敏**：生产环境日志不应记录敏感信息（如完整角色卡数据）。

3. **数据库备份**：定期备份 SQLite 数据库文件：

   ```bash
   # 使用 sqlite3 备份（在线备份，不锁库）
   sqlite3 /var/www/tabletop/data/app.db ".backup /backup/app-$(date +%Y%m%d).db"
   ```

4. **进程权限**：以非 root 用户运行 Node.js 服务：

   ```bash
   useradd -r -s /bin/false tabletop
   chown -R tabletop:tabletop /var/www/tabletop
   su tabletop -c "pm2 start ecosystem.config.cjs"
   ```
