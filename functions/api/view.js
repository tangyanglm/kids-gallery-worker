export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { id } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: '缺少图片ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await env.KV_STORE.get(`image:${id}`);
    if (!data) {
      return new Response(JSON.stringify({ error: '图片不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageData = JSON.parse(data);
    imageData.views = (imageData.views || 0) + 1;

    await env.KV_STORE.put(`image:${id}`, JSON.stringify(imageData));

    return new Response(JSON.stringify({ 
      success: true, 
      views: imageData.views 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('更新访问量失败:', error);
    return new Response(JSON.stringify({ error: '更新访问量失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}