export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { id } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: '缺少ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return new Response(JSON.stringify({ error: '图片不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageInfo = JSON.parse(imageData);
    const type = imageInfo.type || 'artwork';
    const typeKey = type === 'artwork' ? 'artworks' : 'books';

    const existingList = await env.KV_STORE.get(typeKey);
    if (existingList) {
      let list = JSON.parse(existingList);
      list = list.filter(itemId => itemId !== id);
      await env.KV_STORE.put(typeKey, JSON.stringify(list));
    }

    await env.KV_STORE.delete(`image:${id}`);

    const fileName = id + '.' + (imageInfo.imageUrl?.split('.').pop() || 'png');
    try {
      await env.R2_BUCKET.delete(fileName);
    } catch (e) {
      console.log('R2 delete error:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除失败:', error);
    return new Response(JSON.stringify({ error: '删除失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
