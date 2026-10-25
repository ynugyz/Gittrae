// 本机模型代理入口：仅绑定 127.0.0.1。
import { createInsightsServer } from './insights.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const server = createInsightsServer();

server.listen(port, host, () => {
  console.log(`[insights] listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
