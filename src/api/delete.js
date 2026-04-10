import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleDeletePost(c) {
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
    
    const { id, type } = await request.json();

    if (!id) {
      return c.json({ error: '缺少图片ID' }, 400);
    }

    // 从KV中删除图片数据
    const imageData = await env.KV_STORE.get(`image:${id}`);
    if (!imageData) {
      return c.json({ error: '图片不存在' }, 404);
    }

    const parsedImageData = JSON.parse(imageData);
    
    // 从R2中删除文件
    if (parsedImageData.imageUrl) {
      // 从URL中提取文件名
      const url = new URL(parsedImageData.imageUrl);
      const fileName = url.pathname.substring(1); // 移除开头的斜杠
      
      try {
        await env.R2_BUCKET.delete(fileName);
      } catch (error) {
        console.error('删除R2文件失败:', error);
        // 继续执行，即使R2删除失败
      }
    }

    // 从KV中删除图片数据
    await env.KV_STORE.delete(`image:${id}`);

    // 从列表中移除
    const typeKey = parsedImageData.type === 'artwork' ? 'artworks' : 'books';
    const existingList = await env.KV_STORE.get(typeKey);
    if (existingList) {
      let list = JSON.parse(existingList);
      list = list.filter(itemId => itemId !== id);
      await env.KV_STORE.put(typeKey, JSON.stringify(list));
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('删除失败:', error);
    return c.json({ error: '删除失败: ' + error.message }, 500);
  }
}
