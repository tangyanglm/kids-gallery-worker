export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { id, title, description, tags, imageUrl, pages } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: '缺少ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingData = await env.KV_STORE.get(`image:${id}`);
    if (!existingData) {
      return new Response(JSON.stringify({ error: '图片不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageInfo = JSON.parse(existingData);
    
    if (title !== undefined) imageInfo.title = title;
    if (description !== undefined) imageInfo.description = description;
    if (tags !== undefined) imageInfo.tags = tags;
    if (imageUrl !== undefined) imageInfo.imageUrl = imageUrl;
    if (pages !== undefined) imageInfo.pages = pages;

    await env.KV_STORE.put(`image:${id}`, JSON.stringify(imageInfo));

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        ...imageInfo,
        image: imageInfo.imageUrl,
        cover: imageInfo.imageUrl,
        date: new Date(imageInfo.uploadTime).toISOString().split('T')[0]
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('更新失败:', error);
    return new Response(JSON.stringify({ error: '更新失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
