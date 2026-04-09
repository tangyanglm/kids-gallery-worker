export async function handleUpdatePost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    const { id, title, description, tags } = await request.json();

    if (!id) {
      return c.json({ error: '缺少图片ID' }, 400);
    }

    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return c.json({ error: '图片不存在' }, 404);
    }

    const parsedImageData = JSON.parse(imageData);

    // 更新字段
    if (title !== undefined) parsedImageData.title = title;
    if (description !== undefined) parsedImageData.description = description;
    if (tags !== undefined) parsedImageData.tags = tags;

    // 保存更新后的数据
    await env.KV_STORE.put(`image:${id}`, JSON.stringify(parsedImageData));

    return c.json({ 
      success: true, 
      data: parsedImageData
    });
  } catch (error) {
    console.error('更新失败:', error);
    return c.json({ error: '更新失败: ' + error.message }, 500);
  }
}
