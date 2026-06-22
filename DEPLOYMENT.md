# 公网 Web App 部署说明

本文档用于把《算法驱动的衣橱经济学与色彩唤醒系统》部署成公网演示版。当前主部署方案已经改为全部使用 Render：后端使用 Render Web Service，前端使用 Render Static Site。

## 一、当前部署目标

- 后端部署到 Render Web Service。
- 前端部署到 Render Static Site。
- 数据库暂时使用 SQLite，作为公网演示版。
- 当前版本是公网演示版，不是正式多人商业版。
- Vercel 现在只作为备用前端部署方案，不作为主流程。

## 二、当前版本限制

- 当前版本没有登录注册。
- 所有人共用同一份演示衣柜数据。
- A 用户新增或删除衣服，B 用户也会看到变化。
- 点击“重置演示数据”会影响所有访问者看到的演示数据。
- SQLite 适合当前公网演示版，但不适合正式多人长期保存和多人长期使用。
- Render 免费服务可能会休眠，首次访问可能出现冷启动，页面或接口可能变慢。
- 当前版本不适合存放真实隐私衣柜数据。

## 三、部署前准备

1. 确认本地前端 build 通过：

   ```bash
   cd client
   npm run build
   ```

2. 确认后端可以启动：

   ```bash
   cd server
   npm start
   ```

3. 确认项目已上传到 GitHub 仓库。

4. 如果本机 git 不可用，可以用 GitHub Desktop 或 GitHub 网页上传代码。

5. 不要上传真实 `.env` 文件。

6. 可以上传 `.env.example` 文件。

## 四、Codex 已准备的配置文件

- `render.yaml`：用于 Render 后端 Web Service 的 Blueprint / 配置参考。它指向 `server` 目录，使用 `npm install` 构建、`npm start` 启动，并设置了 `HOST=0.0.0.0` 和 `DATABASE_PATH=./data/wardrobe.sqlite`。
- `vercel.json`：历史备用配置，仅用于以后如果重新选择 Vercel 部署前端时参考。当前主流程不使用 Vercel。

注意：

- 当前前端主流程是在 Render 创建 Static Site。
- 如果 `render.yaml` 没有自动创建前端 Static Site，请在 Render 网页里手动创建 Static Site，并按本文档填写。
- Render 后端的 `Root Directory` 必须是 `server`。
- Render 前端的 `Root Directory` 必须是 `client`。

## 五、后端部署到 Render Web Service

1. 打开 Render。

2. 点击 `New`，选择 `Web Service`。

3. 连接 GitHub 仓库：

   ```text
   https://github.com/zqw878210a-ctrl/zqw
   ```

4. 服务名称建议填写：

   ```text
   wardrobe-mvp-server
   ```

5. `Root Directory` 填：

   ```text
   server
   ```

6. `Build Command` 填：

   ```bash
   npm install
   ```

7. `Start Command` 填：

   ```bash
   npm start
   ```

8. 设置后端环境变量：

   ```text
   HOST=0.0.0.0
   DATABASE_PATH=./data/wardrobe.sqlite
   CORS_ORIGIN=https://wardrobe-mvp-client.onrender.com
   JWT_SECRET=请替换为一段足够长的随机字符串
   JWT_EXPIRES_IN=7d
   ```

9. 不要手动设置 `PORT`，Render 会自动提供。

10. 部署完成后，后端公网地址应类似：

    ```text
    https://wardrobe-mvp-server.onrender.com
    ```

11. 打开健康检查地址：

    ```text
    https://wardrobe-mvp-server.onrender.com/health
    ```

12. 如果能看到类似下面的内容，说明后端正常：

    ```json
    {
      "success": true
    }
    ```

## 六、前端部署到 Render Static Site

1. 打开 Render。

2. 点击 `New`，选择 `Static Site`。

3. 连接同一个 GitHub 仓库：

   ```text
   https://github.com/zqw878210a-ctrl/zqw
   ```

4. 服务名称建议填写：

   ```text
   wardrobe-mvp-client
   ```

5. `Root Directory` 填：

   ```text
   client
   ```

6. `Build Command` 填：

   ```bash
   npm install && npm run build
   ```

7. `Publish Directory` 填：

   ```text
   dist
   ```

8. 设置前端环境变量：

   ```text
   VITE_API_BASE_URL=https://wardrobe-mvp-server.onrender.com
   ```

9. 部署完成后，前端公网地址应类似：

   ```text
   https://wardrobe-mvp-client.onrender.com
   ```

10. 用电脑或手机浏览器打开前端公网地址测试。

## 七、部署顺序建议

1. 先部署后端 Render Web Service。
2. 打开 `https://wardrobe-mvp-server.onrender.com/health`，确认后端正常。
3. 再部署前端 Render Static Site。
4. 前端环境变量填写：

   ```text
   VITE_API_BASE_URL=https://wardrobe-mvp-server.onrender.com
   ```

5. 回到后端环境变量，确认：

   ```text
   CORS_ORIGIN=https://wardrobe-mvp-client.onrender.com
   ```

6. 如果修改过环境变量，重新部署对应服务。

## 八、上线后验收清单

- [ ] 后端 `/health` 能打开：`https://wardrobe-mvp-server.onrender.com/health`。
- [ ] 前端公网网址能打开：`https://wardrobe-mvp-client.onrender.com`。
- [ ] 首页能加载 5 件演示衣服。
- [ ] 5 件衣服图片能显示。
- [ ] 重置演示数据能用。
- [ ] 今天穿了它能用。
- [ ] 防重复打卡提示正常。
- [ ] 一键诊断衣橱能用。
- [ ] 诊断弹窗能打开。
- [ ] 生成转卖文案能用。
- [ ] 复制完整发布文案能用。
- [ ] 新增单品能用。
- [ ] 删除确认弹窗能用。
- [ ] 手机浏览器能正常访问前端公网地址。
- [ ] Render 冷启动后刷新页面，功能仍能恢复正常。

## 九、常见问题排查

### 1. 前端能打开，但衣柜加载失败

- 检查 Render 前端 Static Site 的环境变量是否是：

  ```text
  VITE_API_BASE_URL=https://wardrobe-mvp-server.onrender.com
  ```

- 检查后端健康检查是否正常：

  ```text
  https://wardrobe-mvp-server.onrender.com/health
  ```

- 检查 Render 后端 Web Service 的环境变量是否是：

  ```text
  CORS_ORIGIN=https://wardrobe-mvp-client.onrender.com
  ```

- 如果刚部署完或长时间没人访问，等待一会儿再刷新，Render 免费服务可能正在冷启动。

### 2. 后端部署失败

- 检查后端服务类型是否是 `Web Service`。
- 检查 `Root Directory` 是否是：

  ```text
  server
  ```

- 检查 `Build Command` 是否是：

  ```bash
  npm install
  ```

- 检查 `Start Command` 是否是：

  ```bash
  npm start
  ```

- 检查 `server/package.json` 是否有 `start` 脚本。

### 3. 前端部署失败

- 检查前端服务类型是否是 `Static Site`。
- 检查 `Root Directory` 是否是：

  ```text
  client
  ```

- 检查 `Build Command` 是否是：

  ```bash
  npm install && npm run build
  ```

- 检查 `Publish Directory` 是否是：

  ```text
  dist
  ```

### 4. 图片不显示

- 检查 `client/public/assets/items` 是否存在图片。
- 检查接口里的 `imageUrl` 是否是 `/assets/items/xxx.png`。
- 检查 Render Static Site 是否成功部署了 `client/public` 目录里的静态资源。
- 如果图片文件名写成了 `.png.png`，需要改成 `.png`。

### 5. 数据被别人改了

- 当前是无登录公网演示版，所有人共用数据。
- 任何访问者新增、删除、打卡或重置演示数据，都会影响所有人看到的内容。
- 后续需要做匿名用户模式或登录系统，让每个人的数据隔离。

### 6. 数据突然恢复或丢失

- 当前数据库是 SQLite 文件，适合公网演示，不适合长期保存。
- 免费云服务的磁盘和实例行为不适合作为正式长期数据库使用。
- 后续如果要正式多人使用，应迁移到 PostgreSQL。

## 十、Vercel 备用方案

当前主方案不使用 Vercel。如果以后重新选择 Vercel 部署前端，可以参考根目录的 `vercel.json`，并在 Vercel 中填写：

- Root Directory：`client`
- Build Command：`npm run build`
- Output Directory：`dist`
- Environment Variable：

  ```text
  VITE_API_BASE_URL=https://wardrobe-mvp-server.onrender.com
  ```

如果使用 Vercel 作为前端域名，需要把后端 `CORS_ORIGIN` 改成实际的 Vercel 前端域名。

## 十一、后续升级建议

### V1.4：匿名用户模式

- 每个浏览器生成一个匿名 `userId`。
- 每个人看到自己的衣柜。
- 不用正式注册。

### V1.5：迁移 PostgreSQL

- 解决 SQLite 不适合多人长期使用的问题。
- 让公网部署更稳定，更适合多人访问。

### V1.6：PWA

- 让用户可以把网站添加到手机桌面。
- 像 App 一样打开。

### V2.0：微信小程序

- 如果后续确认主要用户在微信生态，再考虑小程序。

## 十二、最终提醒

- 当前阶段目标是“公网演示版”。
- 不要在里面存真实隐私数据。
- Render 免费服务可能冷启动，首次打开慢是正常现象。
- 所有人共用同一份演示衣柜数据。
- SQLite 数据不适合长期保存。
- 如果要让每个人长期使用自己的衣柜，下一阶段必须做用户数据隔离，并迁移到更适合生产环境的数据库。
