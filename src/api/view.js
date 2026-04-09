export async function handleViewPost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    const { id } = await request.json();

    if (!id) {
      return c.json({ error: '缺少图片ID' }, 400);
    }

    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return c.json({ error: '图片不存在' }, 404);
    }

    const parsedImageData = JSON.parse(imageData);

    // 增加访问量
    parsedImageData.views = (parsedImageData.views || 0) + 1;

    // 保存更新后的数据
    await env.KV_STORE.put(`image:${id}`, JSON.stringify(parsedImageData));

    return c.json({ 
      success: true, 
      views: parsedImageData.views 
    });
  } catch (error) {
    console.error('更新访问量失败:', error);
    return c.json({ error: '更新访问量失败' }, 500);
  }
}
