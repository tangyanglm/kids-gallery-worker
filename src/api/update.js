export async function handleUpdatePost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    
    // 检查请求是否为 multipart/form-data
    const contentType = request.headers.get('content-type');
    let updateData;
    let files = [];
    
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      updateData = {
        id: formData.get('id'),
        title: formData.get('title'),
        description: formData.get('description'),
        tags: formData.get('tags') ? JSON.parse(formData.get('tags')) : undefined,
        pages: formData.get('pages') ? JSON.parse(formData.get('pages')) : undefined
      };
      files = formData.getAll('file');
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

    // 更新基本字段
    if (title !== undefined) parsedImageData.title = title;
    if (description !== undefined) parsedImageData.description = description;
    if (tags !== undefined) parsedImageData.tags = tags;
    
    // 处理文件上传（如果有）
    if (files.length > 0) {
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // 处理封面图片（第一个文件）
      if (files[0]) {
        const file = files[0];
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
      
      // 处理正文页面图片（从第二个文件开始）
      if (parsedImageData.type === 'book' && files.length > 1) {
        const processedPages = [];
        
        for (let i = 1; i < files.length; i++) {
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
          const pageText = pages?.[i-1]?.text || '';
          
          processedPages.push({
            imageUrl: fileUrl,
            text: pageText
          });
        }
        
        parsedImageData.pages = processedPages;
      } else if (parsedImageData.type === 'book' && pages !== undefined) {
        // 如果是书籍类型且只上传了封面文件，但提供了页面文本，则更新页面文本
        parsedImageData.pages = pages;
      }
    } else if (pages !== undefined && parsedImageData.type === 'book') {
      // 如果没有上传新文件，但提供了页面文本，则更新页面文本
      parsedImageData.pages = pages;
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
