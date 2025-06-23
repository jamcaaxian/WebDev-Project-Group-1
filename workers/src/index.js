export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const search = url.searchParams;

        const BASE = "https://jamcaaxian.github.io/WebDev-Project-Group-1/workers/public";

        function render(tpl, data) {
            const regex = /\$\[([a-zA-Z0-9_.]+)\]/g;
            return tpl.replace(regex, (_, key) => {
                const keys = key.split(".");
                let value = data;
                for (let k of keys) value = value?.[k];
                return value ?? "";
            });
        }

        async function getTemplate(name) {
            const res = await fetch(`${BASE}/${name}`);
            return await res.text();
        }

        async function query(sql, bindings = []) {
            const stmt = env.DB.prepare(sql);
            const res = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
            return res.results || [];
        }

        if (request.method === "POST" && path === "/add-to-cart") {
            const { Uid, Pid, Amount } = await request.json();
            if (!Uid || !Pid || !Amount) return new Response("Missing data", { status: 400 });

            const user = (await query("SELECT * FROM Users WHERE Uid = ?", [Uid]))[0];
            let cart = [];
            try { cart = JSON.parse(user?.Cart || "[]"); } catch { }

            const product = (await query("SELECT * FROM Products WHERE Pid = ?", [Pid]))[0];
            if (!product) return new Response("Product not found", { status: 404 });

            const index = cart.findIndex(item => item.Pid === Pid);
            if (index >= 0) {
                cart[index].Amount += Amount;
            } else {
                cart.push({
                    Pid,
                    ProductName: product.ProductName,
                    Price: product.Price,
                    Amount
                });
            }

            await env.DB.prepare("UPDATE Users SET Cart = ? WHERE Uid = ?")
                .bind(JSON.stringify(cart), Uid)
                .run();

            return new Response(JSON.stringify({ success: true }), {
                headers: { "content-type": "application/json" }
            });
        }

        if (request.method === "POST" && path === "/comment") {
            const form = await request.json();
            const { Pid, Comment } = form;
            if (!Pid || !Comment) return new Response("Invalid comment", { status: 400 });
            await env.DB.prepare("INSERT INTO Comments (Pid, Comment) VALUES (?, ?)")
                .bind(Pid, Comment)
                .run();
            return new Response(JSON.stringify({ status: "ok" }), { headers: { "content-type": "application/json" } });
        }

        if (path === "/" || path === "/index.html") {
            const top3 = await query("SELECT * FROM Products ORDER BY Sales DESC LIMIT 3");
            const html = await getTemplate("index.html");
            return new Response(render(html, {
                ProductA: top3[0] || {},
                ProductB: top3[1] || {},
                ProductC: top3[2] || {},
            }), { headers: { "content-type": "text/html" } });
        }

        if (path === "/products.html") {
            const products = await query("SELECT * FROM Products");
            const html = await getTemplate("products.html");
            return new Response(render(html, {
                Products: { JSON: JSON.stringify(products) }
            }), { headers: { "content-type": "text/html" } });
        }

        if (path === "/detail.html") {
            const pid = search.get("Pid");
            const product = (await query("SELECT * FROM Products WHERE Pid = ?", [pid]))[0];
            const comments = await query("SELECT Comment FROM Comments WHERE Pid = ?", [pid]);
            const html = await getTemplate("detail.html");
            return new Response(render(html, {
                Product: product || {},
                Comments: { JSON: JSON.stringify(comments.map(c => c.Comment)) }
            }), { headers: { "content-type": "text/html" } });
        }

        if (request.method === "POST" && path === "/login") {
            const { User, Password } = await request.json();
            const result = await query("SELECT * FROM Users WHERE User = ? AND Password = ?", [User, Password]);
            if (result.length > 0) {
                return new Response(JSON.stringify({ success: true, Uid: result[0].Uid }), {
                    headers: { "content-type": "application/json" }
                });
            } else {
                return new Response(JSON.stringify({ success: false }), {
                    headers: { "content-type": "application/json" }
                });
            }
        }

        if (path === "/login.html") {
            const html = await getTemplate("login.html");
            return new Response(html, { headers: { "content-type": "text/html" } });
        }

        if (path === "/cart.html") {
            const uid = search.get("Uid");
            const user = (await query("SELECT * FROM Users WHERE Uid = ?", [uid]))[0];
            const cart = user?.Cart ? JSON.parse(user.Cart) : [];
            const html = await getTemplate("cart.html");
            return new Response(render(html, {
                CartItems: { JSON: JSON.stringify(cart) }
            }), { headers: { "content-type": "text/html" } });
        }

        if (path === "/comment.html") {
            const pid = search.get("Pid");
            const comments = await query("SELECT Comment FROM Comments WHERE Pid = ?", [pid]);
            const html = await getTemplate("comment.html");
            return new Response(render(html, {
                Comments: { JSON: JSON.stringify(comments.map(c => c.Comment)) },
                Pid: pid
            }), { headers: { "content-type": "text/html" } });
        }

        if (path === "/style.css") {
            const res = await fetch(`${BASE}/style.css`);
            return new Response(await res.text(), {
                headers: { "content-type": "text/css" }
            });
        }

        return new Response("404 Not Found", { status: 404 });
    }
}