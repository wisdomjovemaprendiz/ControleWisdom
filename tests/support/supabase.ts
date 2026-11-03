import type { Page } from "@playwright/test";
import { schoolFixture } from "../fixtures/school";
import { canAccess, type Store, type Profile } from "../../lib/domain";
const base = "http://127.0.0.1:54321";
export async function installSchoolApi(page: Page) {
  const store = schoolFixture();
  let actor = store.profiles[0];
  const objects = new Map<string, { body: Buffer; type: string }>();
  const user = () => ({
    id: actor.id,
    aud: "authenticated",
    role: "authenticated",
    email: `${actor.username || "admin"}@accounts.wisdom.invalid`,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  });
  const json = (route: any, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
    });
  await page.route(base + "/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (req.method() === "OPTIONS") return json(route, {}, 200);
    if (path === "/auth/v1/token") {
      const body = req.postDataJSON();
      const login = String(body.email).split("@")[0];
      const found = store.profiles.find(
        (p) => (p.username || "admin") === login,
      );
      if (!found)
        return json(route, { message: "Invalid login credentials" }, 400);
      actor = found;
      const payload = Buffer.from(
        JSON.stringify({
          sub: actor.id,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      return json(route, {
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`,
        refresh_token: "isolated-test-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: user(),
      });
    }
    if (path === "/auth/v1/user") return json(route, user());
    if (path === "/auth/v1/logout")
      return route.fulfill({
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (
      path.startsWith("/storage/v1/object/sign/student-photos/") &&
      req.method() === "POST"
    ) {
      const key = decodeURIComponent(
        path.slice("/storage/v1/object/sign/student-photos/".length),
      );
      return json(route, {
        signedURL: `/object/sign/student-photos/${key}?token=isolated-test-photo`,
      });
    }

    if (
      path.startsWith("/storage/v1/object/student-photos/") ||
      path.startsWith("/storage/v1/object/sign/student-photos/")
    ) {
      const key = decodeURIComponent(
        path.replace(/^\/storage\/v1\/object\/(?:sign\/)?student-photos\//, ""),
      );
      if (req.method() === "POST") {
        const body = req.postDataBuffer()!;
        const type = req.headers()["content-type"];
        if (type?.startsWith("multipart/form-data")) {
          const data = await new Response(new Uint8Array(body).buffer, {
            headers: { "Content-Type": type },
          }).formData();
          let photo: Blob | undefined;
          for (const value of data.values())
            if (value instanceof Blob) photo = value;
          if (!photo) return json(route, { error: "missing photo" }, 400);
          objects.set(key, {
            body: Buffer.from(await photo.arrayBuffer()),
            type: photo.type,
          });
        } else objects.set(key, { body, type });
        return json(route, { Key: `student-photos/${key}`, Id: "test-object" });
      }
      const object = objects.get(key);
      return object
        ? route.fulfill({
            status: 200,
            body: object.body,
            contentType: object.type,
            headers: { "Access-Control-Allow-Origin": "*" },
          })
        : json(route, {}, 404);
    }
    if (
      path === "/storage/v1/object/student-photos" &&
      req.method() === "DELETE"
    ) {
      for (const key of req.postDataJSON().prefixes || []) objects.delete(key);
      return json(route, []);
    }
    if (path === "/rest/v1/daily_analytics") return json(route, []);
    if (path === "/rest/v1/rpc/save_lesson_attendance") {
      const body = req.postDataJSON(),
        lesson = body.lesson_data;
      store.lessons = store.lessons
        .filter((l) => l.id !== lesson.id)
        .concat(lesson);
      for (const row of body.attendance_data)
        store.attendance = store.attendance
          .filter(
            (a) =>
              a.lesson_id !== row.lesson_id || a.student_id !== row.student_id,
          )
          .concat(row);
      return json(route, null);
    }
    if (path.startsWith("/rest/v1/")) {
      const table = path.slice("/rest/v1/".length) as keyof Store;
      if (!Array.isArray(store[table])) return json(route, [], 404);
      let values = store[table] as any[];
      if (req.method() === "POST") {
        const incoming = req.postDataJSON(),
          records = Array.isArray(incoming) ? incoming : [incoming];
        for (const record of records) {
          const index = values.findIndex((v) => v.id === record.id);
          if (index >= 0) values[index] = { ...values[index], ...record };
          else values.push(record);
        }
        return req.headers()["prefer"]?.includes("return=representation")
          ? json(route, records)
          : route.fulfill({
              status: 201,
              headers: { "Access-Control-Allow-Origin": "*" },
            });
      }
      if (req.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        for (const row of values)
          if (row.id === id) Object.assign(row, req.postDataJSON());
        return route.fulfill({
          status: 204,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
      values = values.filter((row) =>
        table === "units"
          ? canAccess(actor, row.id)
          : table === "profiles"
            ? row.id === actor.id || canAccess(actor, row.unit_id)
            : canAccess(actor, row.unit_id),
      );
      for (const [key, value] of url.searchParams)
        if (value.startsWith("eq."))
          values = values.filter((row) => String(row[key]) === value.slice(3));
      const range = req.headers()["range"];
      if (range) {
        const [a, b] = range.split("-").map(Number);
        values = values.slice(a, b + 1);
      }
      if (req.headers()["accept"]?.includes("vnd.pgrst.object"))
        return values[0]
          ? json(route, values[0])
          : json(route, { message: "No profile" }, 406);
      return json(route, values);
    }
    return json(route, {}, 404);
  });
  await page.route("**/api/team", async (route) => {
    if (actor.role !== "admin")
      return json(route, { error: "Apenas administradores." }, 403);
    const input = route.request().postDataJSON();
    if (input.action === "reset_password") {
      const target = store.profiles.find((p) => p.id === input.id);
      if (target) target.must_change_password = true;
      return json(route, { ok: true });
    }
    if (route.request().method() === "PATCH") {
      const target = store.profiles.find((p) => p.id === input.id);
      if (target) Object.assign(target, input);
      return json(route, { profile: target });
    }
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: input.name,
      username: input.username,
      unit_id: input.unit_id,
      role: input.role,
      active: true,
      must_change_password: true,
    };
    store.profiles.push(profile);
    return json(route, { profile }, 201);
  });
  await page.route("**/api/account/password", async (route) => {
    actor.must_change_password = false;
    return json(route, { ok: true, login_required: true });
  });
  return { store, objects, actor: () => actor };
}
export async function login(page: Page, username = "admin") {
  await page.getByLabel("Nome de usuário", { exact: true }).fill(username);
  await page.getByLabel("Senha", { exact: true }).fill("SenhaDeTeste123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("heading", {
      name:
        username === "ana.oliveira"
          ? "Meu diário de classe"
          : "Operação das unidades",
      exact: true,
    })
    .waitFor();
}
