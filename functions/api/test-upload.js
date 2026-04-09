export async function onRequestPost(context) {
  const { env, request } = context;

  console.log("env=", env);
  console.log("env.MY_R2=", env.R2_BUCKET);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "no file" }, { status: 400 });
    }

    const key = `test-${Date.now()}.png`;

    // ✨ 这里是正确的 R2 上传
    await env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    return Response.json({
      success: true,
      key: key
    });

  } catch (e) {
    return Response.json({ error: e.message });
  }
}