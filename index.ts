import { Database } from "bun:sqlite";

const db = new Database("routes.sqlite");
db.run(
  "CREATE TABLE IF NOT EXISTS routes (path TEXT PRIMARY KEY, url TEXT NOT NULL)"
);

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const redirect = db
      .query("SELECT url FROM routes WHERE path = ?")
      .get(url.pathname) as { url: string } | null;

    if (redirect) {
      return Response.redirect(redirect.url, 301);
    }

    const routes = db.query("SELECT path, url FROM routes").all() as {
      path: string;
      url: string;
    }[];
    const routesList = routes
      .map((route) => `<li>${route.path} -> ${route.url}</li>`)
      .join("");

    const form = `
      <form method="POST">
        <input name="path" placeholder="Short path" required>
        <input name="url" placeholder="Full URL" required>
        <button type="submit">Create Shortcut</button>
      </form>
      <h2>Existing Routes:</h2>
      <ul>
        ${routesList}
      </ul>
    `;

    if (req.method === "POST") {
      const formData = await req.formData();
      const path = formData.get("path") as string;
      const url = formData.get("url") as string;

      if (path && url) {
        db.run("INSERT OR REPLACE INTO routes (path, url) VALUES (?, ?)", [
          path,
          url,
        ]);
        return new Response("Shortcut created!", { status: 201 });
      }
    }

    return new Response(form, {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log("URL shortener running on http://localhost:3000");
