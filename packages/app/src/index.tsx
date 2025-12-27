import { Hono } from "hono";
import type { CloudflareBindings } from "./types";
import { renderer } from "./renderer";
import { loggerMiddleware } from "./middleware/logger";
import admin from "./routes/admin";
import claim from "./routes/claim";
import openai from "./routes/openai";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 全局中间件
app.use("*", loggerMiddleware);
app.use(renderer);

// 挂载路由
app.route("/admin", admin);
app.route("/v1", openai);
app.route("/", claim);

// 首页
app.get("/", (c) => {
  return c.render(<h1>Uni-Gateway - AI API 统一网关</h1>);
});

export default app;
