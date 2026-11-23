// yetanothergroceryapp Worker: static files from site/ are served before this runs;
// the only route here is the Android APK, streamed from the yaga-downloads R2 bucket.
// Upload a new build with:
//   npx wrangler r2 object put yaga-downloads/yaga.apk --file <apk> --remote \
//     --content-type application/vnd.android.package-archive \
//     --content-disposition 'attachment; filename="yaga-<version>.apk"'
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== "/download/yaga.apk") return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

    const apk = request.method === "HEAD" ? await env.DOWNLOADS.head("yaga.apk") : await env.DOWNLOADS.get("yaga.apk");
    if (!apk) return new Response("No APK has been uploaded yet.", { status: 404 });
    const headers = new Headers({ etag: apk.httpEtag, "content-length": String(apk.size), "cache-control": "public, max-age=300" });
    apk.writeHttpMetadata(headers); // content-type and content-disposition set at upload
    return new Response(request.method === "HEAD" ? null : apk.body, { headers });
  },
};
