# 公网 Web App 部署说明

本文档用于把《算法驱动的衣橱经济学与色彩唤醒系统》部署成公网演示版。请按步骤操作，不需要写代码。

## 一、当前部署目标

- 前端部署到 Vercel。
- 后端部署到 Render。
- 数据库暂时使用 SQLite，作为公网演示版。
- 当前版本是公网演示版，不是正式多人商业版。

## 二、当前版本限制

- 当前版本没有登录注册。
- 所有人共用同一份演示衣柜数据。
- A 用户新增或删除衣服，B 用户也会看到变化。
- 点击“重置演示数据”会影响所有访问者看到的演示数据。
- SQLite 适合当前公网演示版，但不适合正式多人长期使用。
- 免费云服务可能会休眠、冷启动、访问慢。
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

## 四、后端部署到 Render

1. 打开 Render。

2. 点击 `New`，选择 `Web Service`。

3. 连接你的 GitHub 仓库。

4. 选择当前项目仓库。

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

8. 设置环境变量：

   ```text
   HOST=0.0.0.0
   DATABASE_PATH=./data/wardrobe.sqlite
   CORS_ORIGIN=
   ```

   `CORS_ORIGIN` 先留空，等前端 Vercel 部署完成后再回来填写。

9. `PORT` 通常由 Render 自动提供，不一定要手动填写。

10. 点击部署。部署完成后，Render 会给你一个后端公网地址，例如：

    ```text
    https://your-backend-service.onrender.com
    ```

11. 打开后端健康检查地址：

    ```text
    https://你的后端域名/health
    ```

12. 如果能看到类似下面的内容，说明后端正常：

    ```json
    {
      "success": true
    }
    ```

## 五、前端部署到 Vercel

1. 打开 Vercel。

2. 点击 `Add New`，选择 `Project`。

3. 选择 `Import GitHub Project`。

4. 选择当前项目仓库。

5. `Root Directory` 填：

   ```text
   client
   ```

6. `Framework Preset` 选择 `Vite`，也可以让 Vercel 自动识别。

7. `Build Command` 填：

   ```bash
   npm run build
   ```

8. `Output Directory` 填：

   ```text
   dist
   ```

9. 设置环境变量：

   ```text
   VITE_API_BASE_URL=https://你的 Render 后端域名
   ```

   示例：

   ```text
   VITE_API_BASE_URL=https://your-backend-service.onrender.com
   ```

10. 点击部署。部署完成后，Vercel 会给你一个前端公网地址，例如：

    ```text
    https://your-project.vercel.app
    ```

11. 用手机浏览器打开这个前端公网地址。

## 六、部署后回填 CORS

1. 拿到 Vercel 前端域名后，复制完整地址，例如：

   ```text
   https://your-project.vercel.app
   ```

2. 回到 Render 后端服务设置。

3. 找到环境变量 `CORS_ORIGIN`。

4. 填入 Vercel 前端域名，例如：

   ```text
   CORS_ORIGIN=https://your-project.vercel.app
   ```

5. 保存环境变量。

6. 重新部署 Render 后端。

7. 再次打开 Vercel 前端网址测试。

## 七、上线后验收清单

- [ ] 前端公网网址能打开。
- [ ] 后端 `/health` 能打开。
- [ ] 首页能加载 5 件衣服。
- [ ] 图片能显示。
- [ ] 重置演示数据能用。
- [ ] 今天穿了它能用。
- [ ] 防重复打卡提示正常。
- [ ] 一键诊断衣橱能用。
- [ ] 诊断弹窗能打开。
- [ ] 生成转卖文案能用。
- [ ] 复制文案能用。
- [ ] 新增单品能用。
- [ ] 删除确认弹窗能用。
- [ ] 手机浏览器能正常访问。

## 八、常见问题排查

### 1. 前端能打开，但衣柜加载失败

- 检查 Vercel 的 `VITE_API_BASE_URL` 是否填了 Render 后端域名。
- 检查后端 `/health` 是否正常。
- 检查 Render 的 `CORS_ORIGIN` 是否正确。
- 如果刚部署完 Render，等待一会儿再刷新，免费服务可能会冷启动。

### 2. 后端部署失败

- 检查 Render 的 `Root Directory` 是否是：

  ```text
  server
  ```

- 检查 `Start Command` 是否是：

  ```bash
  npm start
  ```

- 检查 `server/package.json` 是否有 `start` 脚本。

### 3. 前端部署失败

- 检查 Vercel 的 `Root Directory` 是否是：

  ```text
  client
  ```

- 检查 `Build Command` 是否是：

  ```bash
  npm run build
  ```

- 检查 `Output Directory` 是否是：

  ```text
  dist
  ```

### 4. 图片不显示

- 检查 `client/public/assets/items` 是否存在图片。
- 检查接口里的 `imageUrl` 是否是 `/assets/items/xxx.png`。
- 检查 Vercel 是否成功部署了 `public` 目录。
- 如果图片文件名写成了 `.png.png`，需要改成 `.png`。

### 5. 数据被别人改了

- 当前是无登录公网演示版，所有人共用数据。
- 任何访问者新增、删除、打卡或重置演示数据，都会影响所有人看到的内容。
- 后续需要做匿名用户模式或登录系统，让每个人的数据隔离。

## 九、后续升级建议

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

## 十、最终提醒

- 当前阶段目标是“公网演示版”。
- 不要在里面存真实隐私数据。
- 如果要让每个人长期使用自己的衣柜，下一阶段必须做用户数据隔离。
