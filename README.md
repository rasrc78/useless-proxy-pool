# 超级没用的代理池

不是代理连不上，就是连上后被GFW发RESET包。这只是赶工出来的概念验证版本，应该不会继续维护。

默认的代理提供源基本都是些**从公网探测到的无鉴权代理服务器**，或者是莫名奇妙的漏洞导致意外能处理代理请求，一般来说都很不稳定。

有人说[站大爷](https://www.zdaye.com/free/)提供的免费代理存活率比较高，我随机抽样了几个，基本都能连通，但是一发请求就RESET。

## 使用

1. 安装 [Node.js](https://nodejs.org/zh-cn/download) 和 [pnpm](https://pnpm.io/installation)（可选）。
2. 克隆或下载该仓库到本地，进入项目文件夹。
3. 在终端执行`pnpm i`安装依赖。
4. 在终端执行`pnpm start`运行，或者使用`pnpm dev`查看更详细的日志。
5. 如果未安装`pnpm`, 执行`npm i && npx tsc && node ./dist/index.js`安装依赖并运行。
