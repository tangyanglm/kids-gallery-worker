import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleUpdateBookPost(c) {
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
        tags: formData.get('tags') ? JSON.parse(formData.get('tags')) : undefined,
        pages: formData.get('pages') ? JSON.parse(formData.get('pages')) : undefined
      };
    } else {
      updateData = await request.json();
    }

    const { id, title, description, tags, pages } = updateData;

    if (!id) {
      return c.json({ error: '缺少图片ID' }, 400);
    }

    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return c.json({ error: '图片不存在' }, 404);
    }

    const parsedImageData = JSON.parse(imageData);

    // 检查类型是否为 book
    if (parsedImageData.type !== 'book') {
      return c.json({ error: '该ID对应的不是书籍' }, 400);
    }

    // 更新基本字段
    if (title !== undefined) parsedImageData.title = title;
    if (description !== undefined) parsedImageData.description = description;
    if (tags !== undefined) parsedImageData.tags = tags;
    if (pages !== undefined) parsedImageData.pages = pages;

    // 处理文件上传（如果有）
    if (contentType && contentType.includes('multipart/form-data')) {
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      // 处理封面文件
      const coverFile = formData.get('cover');
      if (coverFile) {
        const fileRandom = Math.random().toString(36).substring(2, 8);
        const extension = coverFile.name.split('.').pop() || 'png';
        const fileName = `${year}/${month}/${timestamp}-${fileRandom}.${extension}`;

        const arrayBuffer = await coverFile.arrayBuffer();
        await env.R2_BUCKET.put(fileName, arrayBuffer, {
          httpMetadata: {
            contentType: coverFile.type || 'image/png',
          },
        });

        parsedImageData.imageUrl = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
      }
      // 处理页面文件
      for (let i = 0; i < pages?.length || 0; i++) {
        const page = pages[i];
        const pageFile = formData.get(`page_${page.pageNumber}`);
        if (!pageFile) {
          continue;
        }
        const fileRandom = Math.random().toString(36).substring(2, 8);
        const extension = pageFile.name.split('.').pop() || 'png';
        const fileName = `${year}/${month}/${timestamp}-${fileRandom}.${extension}`;
        const arrayBuffer = await pageFile.arrayBuffer();
        await env.R2_BUCKET.put(fileName, arrayBuffer, {
          httpMetadata: {
            contentType: pageFile.type || 'image/png',
          },
        });
        const fileUrl = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
        pages[i].imageUrl = fileUrl;
      }

      if (pages !== undefined) {
        // 如果没有上传新文件，但提供了页面文本，则更新页面文本
        parsedImageData.pages = pages;
      }

      // 保存更新后的数据
      await env.KV_STORE.put(`image:${id}`, JSON.stringify(parsedImageData));

      return c.json({
        success: true,
        data: parsedImageData
      });
    } else {
      // 对于 JSON 请求，直接保存更新后的数据
      await env.KV_STORE.put(`image:${id}`, JSON.stringify(parsedImageData));

      return c.json({
        success: true,
        data: parsedImageData
      });
    }
  } catch (error) {
    console.error('更新失败:', error);
    return c.json({ error: '更新失败: ' + error.message }, 500);
  }
}