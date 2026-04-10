import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleUploadBookPost(c) {
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
    const title = formData.get('title') || '未命名作品';
    const description = formData.get('description') || '';
    const tags = JSON.parse(formData.get('tags') || '[]');
    const pagesStr = formData.get('pages');
    const pages = pagesStr ? JSON.parse(pagesStr) : [];

    // 检查是否有文件上传（封面或页面）
    const hasCover = !!formData.get('cover');
    let hasPages = false;
    
    let pageNumber = 1;
    while (true) {
      if (formData.get(`page_${pageNumber}`)) {
        hasPages = true;
        break;
      }
      pageNumber++;
      if (pageNumber > 100) break; // 防止无限循环
    }
    
    if (!hasCover && !hasPages) {
      return c.json({ error: '缺少文件' }, 400);
    }

    const timestamp = Date.now();
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8);
    
    let mainImageUrl = '';
    const processedPages = [];
    
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
      
      mainImageUrl = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
    }
    
    // 处理页面文件
    pageNumber = 1;
    while (true) {
      const pageFile = formData.get(`page_${pageNumber}`);
      if (!pageFile) {
        break;
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
      const pageText = pages[pageNumber-1]?.text || '';
      
      processedPages.push({
        imageUrl: fileUrl,
        text: pageText,
        pageNumber: pageNumber
      });
      
      pageNumber++;
    }

    const imageData = {
      id: `${timestamp}-${random}`,
      title,
      description,
      imageUrl: mainImageUrl,
      tags,
      type: 'book',
      uploadTime: timestamp,
      views: 0,
      pages: processedPages
    };

    await env.KV_STORE.put(`image:${imageData.id}`, JSON.stringify(imageData));

    // 添加到书籍列表
    const existingList = await env.KV_STORE.get('books');
    let list = existingList ? JSON.parse(existingList) : [];
    list.push(imageData.id);
    await env.KV_STORE.put('books', JSON.stringify(list));

    return c.json({ success: true, data: imageData });
  } catch (error) {
    console.error('上传失败:', error);
    return c.json({ error: '上传失败: ' + error.message }, 500);
  }
}