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

        // CSS
        if (path === "/style.css") {
            const css = await getTemplate("style.css");
            return new Response(css, {
                headers: { "content-type": "text/css" }
            });
        }

        // index.html
        if (path === "/" || path === "/index") {
            const top3 = await query("SELECT * FROM Products ORDER BY Sales DESC LIMIT 3");
            const html = await getTemplate("index.html");
            const data = {
                "Products.A.Image": top3[0]?.Images,
                "Products.A.Name": top3[0]?.ProductName,
                "Products.A.Price": top3[0]?.Price,
                "Products.B.Image": top3[1]?.Images,
                "Products.B.Name": top3[1]?.ProductName,
                "Products.B.Price": top3[1]?.Price,
                "Products.C.Image": top3[2]?.Images,
                "Products.C.Name": top3[2]?.ProductName,
                "Products.C.Price": top3[2]?.Price,
            };
            return new Response(render(html, data), {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // products.html
        if (path === "/products") {
            const products = await query("SELECT * FROM Products");
            const html = await getTemplate("products.html");
            return new Response(render(html, { Products: JSON.stringify(products) }), {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // detial.html?Pid=xxx
        if (path === "/detail") {
            const pid = searchParams.get("Pid");
            if (!pid) return new Response("Missing Pid", { status: 400 });
            const product = (await query("SELECT * FROM Products WHERE Pid = ?", [pid]))[0];
            const html = await getTemplate("detail.html");
            return new Response(render(html, {
                Product: product || {}
            }), {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // cart.html?Uid=xxx
        if (path === "/cart") {
            const uid = searchParams.get("Uid");
            if (!uid) return new Response("Missing Uid", { status: 400 });
            const user = (await query("SELECT * FROM Users WHERE Uid = ?", [uid]))[0];
            const html = await getTemplate("cart.html");
            return new Response(render(html, {
                CartItems: user ? JSON.parse(user.Cart || "[]") : []
            }), {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // comment.html?Pid=xxx
        if (path === "/comment") {
            const pid = searchParams.get("Pid");
            if (!pid) return new Response("Missing Pid", { status: 400 });
            const comments = await query("SELECT * FROM Comments WHERE Pid = ?", [pid]);
            const html = await getTemplate("comment.html");
            return new Response(render(html, {
                Comments: JSON.stringify(comments)
            }), {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // login.html
        if (path === "/login") {
            const html = await getTemplate("login.html");
            return new Response(html, {
                headers: { "content-type": "text/html; charset=UTF-8" }
            });
        }

        // 404
        return new Response("404 Not Found", { status: 404 });
    }
}
