export async function handleUploadPost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    const formData = await request.formData();
    const files = formData.getAll('file');
    const title = formData.get('title') || '未命名作品';
    const description = formData.get('description') || '';
    const tags = JSON.parse(formData.get('tags') || '[]');
    const type = formData.get('type') || 'artwork';
    const pagesStr = formData.get('pages');
    const pages = pagesStr ? JSON.parse(pagesStr) : [];

    if (files.length === 0) {
      return c.json({ error: '缺少文件' }, 400);
    }

    const timestamp = Date.now();
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8);
    
    let mainImageUrl = '';
    const processedPages = [];
    
    // 处理所有上传的文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileRandom = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop() || 'png';
      const fileName = `${year}/${month}/${timestamp}-${fileRandom}.${extension}`;
      
      const arrayBuffer = await file.arrayBuffer();
      
      await env.R2_BUCKET.put(fileName, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'image/png',
        },
      });
      
      const fileUrl = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
      
      // 第一个文件作为主封面
      if (i === 0) {
        mainImageUrl = fileUrl;
      }
      
      // 如果是书籍类型，从第二个文件开始作为正文页
      if (type === 'book' && i > 0) {
        const pageText = pages[i-1]?.text || '';
        processedPages.push({
          imageUrl: fileUrl,
          text: pageText
        });
      }
    }

    const imageData = {
      id: `${timestamp}-${random}`,
      title,
      description,
      imageUrl: mainImageUrl,
      tags,
      type,
      uploadTime: timestamp,
      views: 0,
      pages: type === 'book' ? processedPages : []
    };

    await env.KV_STORE.put(`image:${imageData.id}`, JSON.stringify(imageData));

    // 只有真正的绘本(book)和作品(artwork)才添加到列表中，bookpage是绘本的一部分，不单独添加
    if (type === 'artwork' || type === 'book') {
      const typeKey = type === 'artwork' ? 'artworks' : 'books';
      const existingList = await env.KV_STORE.get(typeKey);
      let list = existingList ? JSON.parse(existingList) : [];
      list.push(imageData.id);
      await env.KV_STORE.put(typeKey, JSON.stringify(list));
    }

    return c.json({ success: true, data: imageData });
  } catch (error) {
    console.error('上传失败:', error);
    return c.json({ error: '上传失败: ' + error.message }, 500);
  }
}
