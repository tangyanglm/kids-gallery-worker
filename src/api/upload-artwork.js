import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleUploadArtworkPost(c) {
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
    
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || '未命名作品';
    const description = formData.get('description') || '';
    const tags = JSON.parse(formData.get('tags') || '[]');

    if (!file) {
      return c.json({ error: '缺少文件' }, 400);
    }

    const timestamp = Date.now();
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'png';
    const fileName = `${year}/${month}/${timestamp}-${random}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    
    await env.R2_BUCKET.put(fileName, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/png',
      },
    });

    const imageData = {
      id: `${timestamp}-${random}`,
      title,
      description,
      imageUrl: `https://imgs.tangyiyi.dpdns.org/${fileName}`,
      tags,
      type: 'artwork',
      uploadTime: timestamp,
      views: 0,
      pages: []
    };

    await env.KV_STORE.put(`image:${imageData.id}`, JSON.stringify(imageData));

    // 添加到艺术品列表
    const existingList = await env.KV_STORE.get('artworks');
    let list = existingList ? JSON.parse(existingList) : [];
    list.push(imageData.id);
    await env.KV_STORE.put('artworks', JSON.stringify(list));

    return c.json({ success: true, data: imageData });
  } catch (error) {
    console.error('上传失败:', error);
    return c.json({ error: '上传失败: ' + error.message }, 500);
  }
}