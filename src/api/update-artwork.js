import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleUpdateArtworkPost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    
    // 检查是否已登录
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                  getCookieFromRequest(request, 'admin_token');
    
    if (!token) {
      return c.json({ error: '未授权' }, 401);
    }
    
    const sessionData = await env.KV_STORE.get(`session:${token}`);
    if (!sessionData) {
      return c.json({ error: '会话无效' }, 401);
    }
    
    const session = JSON.parse(sessionData);
    const now = Date.now();
    
    if (now > session.expiresAt) {
      await env.KV_STORE.delete(`session:${token}`);
      return c.json({ error: '会话已过期' }, 401);
    }
    
    // 检查请求是否为 multipart/form-data
    const contentType = request.headers.get('content-type');
    let updateData;
    let formData;
    
    if (contentType && contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      updateData = {
        id: formData.get('id'),
        title: formData.get('title'),
        description: formData.get('description'),
        tags: formData.get('tags') ? JSON.parse(formData.get('tags')) : undefined
      };
    } else {
      updateData = await request.json();
    }

    const { id, title, description, tags } = updateData;

    if (!id) {
      return c.json({ error: '缺少图片ID' }, 400);
    }

    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return c.json({ error: '图片不存在' }, 404);
    }

    const parsedImageData = JSON.parse(imageData);

    // 检查类型是否为 artwork
    if (parsedImageData.type !== 'artwork') {
      return c.json({ error: '该ID对应的不是艺术品' }, 400);
    }

    // 更新基本字段
    if (title !== undefined) parsedImageData.title = title;
    if (description !== undefined) parsedImageData.description = description;
    if (tags !== undefined) parsedImageData.tags = tags;
    
    // 处理文件上传（如果有）
    if (contentType && contentType.includes('multipart/form-data')) {
      const file = formData.get('file');
      if (file) {
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const fileRandom = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop() || 'png';
        const fileName = `${year}/${month}/${timestamp}-${fileRandom}.${extension}`;
        
        const arrayBuffer = await file.arrayBuffer();
        await env.R2_BUCKET.put(fileName, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || 'image/png',
          },
        });
        
        parsedImageData.imageUrl = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
      }
    }

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