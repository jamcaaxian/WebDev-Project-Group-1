export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const search = url.searchParams;

    // 查询函数
    async function query(sql, params = []) {
      const stmt = env.DB.prepare(sql);
      const res = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return res.results || [];
    }

    // 静态资源模板（作为 text 读取）
    async function getFile(name) {
      return await env.ASSETS.get(name, { type: "text" });
    }

    // 简单模板替换：支持 $[Key.SubKey]
    const render = (tpl, data) =>
      tpl.replace(/\$\[([A-Za-z0-9_\.]+)\]/g, (_, key) =>
        key.split(".").reduce((o, k) => o?.[k], data) ?? "");

    // 首页：销量前3产品
    if (path === "/" || path === "/index.html") {
      const top3 = await query("SELECT * FROM Products ORDER BY Sales DESC LIMIT 3");
      const html = await getFile("index.html");
      console.log(top3);
      return new Response(render(html, {
        ProductA: top3[0] || {},
        ProductB: top3[1] || {},
        ProductC: top3[2] || {}
      }), { headers: { "content-type": "text/html" } });
    }

    // 所有产品 products.html（以 JSON 渲染到页面）
    if (path === "/products.html") {
      const products = await query("SELECT * FROM Products");
      const html = await getFile("products.html");
      return new Response(render(html, {
        Products: { JSON: JSON.stringify(products) }
      }), { headers: { "content-type": "text/html" } });
    }

    // 产品详情页 detail.html?Pid=xxx
    if (path === "/detail.html") {
      const pid = search.get("Pid");
      const product = (await query("SELECT * FROM Products WHERE Pid = ?", [pid]))[0];
      const html = await getFile("detail.html");
      return new Response(render(html, { Product: product || {} }), {
        headers: { "content-type": "text/html" }
      });
    }

    // 购物车页 cart.html?Uid=xxx
    if (path === "/cart.html") {
      const uid = search.get("Uid");
      const user = (await query("SELECT * FROM Users WHERE Uid = ?", [uid]))[0];
      const cart = JSON.parse(user?.Cart || "[]");
      const html = await getFile("cart.html");
      return new Response(render(html, {
        CartItems: { JSON: JSON.stringify(cart) }
      }), { headers: { "content-type": "text/html" } });
    }

    // 评论页 comment.html?Pid=xxx
    if (path === "/comment.html") {
      const pid = search.get("Pid");
      const comments = await query("SELECT * FROM Comments WHERE Pid = ?", [pid]);
      const html = await getFile("comment.html");
      return new Response(render(html, {
        Comments: { JSON: JSON.stringify(comments.map(c => c.Comment)) }
      }), { headers: { "content-type": "text/html" } });
    }

    // 静态样式文件
    if (path === "/style.css") {
      const css = await env.ASSETS.get("style.css", { type: "text" });
      return new Response(css, {
        headers: { "content-type": "text/css" }
      });
    }

    return new Response("404 Not Found", { status: 404 });
  }
}
