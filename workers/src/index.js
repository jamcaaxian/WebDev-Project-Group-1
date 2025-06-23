export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    const render = (template, data) =>
      template.replace(/\$\[([A-Za-z0-9_\.]+)\]/g, (_, key) => {
        const keys = key.split(".");
        return keys.reduce((obj, k) => obj?.[k], data) ?? "";
      });

    async function getTemplate(filename) {
      return await env.ASSETS.get(filename);
    }

    async function query(sql, bindings = []) {
      const stmt = env.DB.prepare(sql);
      const res = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
      return res.results || [];
    }

    if (path === "/style.css") {
      const css = await getTemplate("style.css");
      return new Response(css, { headers: { "content-type": "text/css" } });
    }

    if (path === "/" || path === "/index.html") {
      const html = await getTemplate("index.html");
      const top3 = await query("SELECT * FROM Products ORDER BY Sales DESC LIMIT 3");

      return new Response(render(html, {
        ProductA: top3[0] || {},
        ProductB: top3[1] || {},
        ProductC: top3[2] || {}
      }), {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/products.html") {
      const html = await getTemplate("products.html");
      const products = await query("SELECT * FROM Products");
      return new Response(render(html, {
        Products: { JSON: JSON.stringify(products) }
      }), {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/detail.html") {
      const pid = searchParams.get("Pid");
      if (!pid) return new Response("Missing Pid", { status: 400 });

      const html = await getTemplate("detail.html");
      const product = (await query("SELECT * FROM Products WHERE Pid = ?", [pid]))[0];
      return new Response(render(html, {
        Product: product || {}
      }), {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/cart.html") {
      const uid = searchParams.get("Uid");
      if (!uid) return new Response("Missing Uid", { status: 400 });

      const html = await getTemplate("cart.html");
      const user = (await query("SELECT * FROM Users WHERE Uid = ?", [uid]))[0];
      let cartItems = [];

      try {
        cartItems = user?.Cart ? JSON.parse(user.Cart) : [];
      } catch {
        cartItems = [];
      }

      return new Response(render(html, {
        CartItems: { JSON: JSON.stringify(cartItems) }
      }), {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/comment.html") {
      const pid = searchParams.get("Pid");
      if (!pid) return new Response("Missing Pid", { status: 400 });

      const html = await getTemplate("comment.html");
      const rows = await query("SELECT Comment FROM Comments WHERE Pid = ?", [pid]);
      const comments = rows.map(r => r.Comment);

      return new Response(render(html, {
        Comments: { JSON: JSON.stringify(comments) }
      }), {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (path === "/login.html") {
      const html = await getTemplate("login.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    return new Response("404 Not Found", { status: 404 });
  }
}
