export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all'; // artwork, book, all
    const tag = url.searchParams.get('tag') || '';
    const search = url.searchParams.get('search') || '';

    let imageIds = [];
    
    if (type === 'artwork') {
      const artworks = await env.KV_STORE.get('artworks');
      imageIds = artworks ? JSON.parse(artworks) : [];
    } else if (type === 'book') {
      const books = await env.KV_STORE.get('books');
      imageIds = books ? JSON.parse(books) : [];
    } else {
      const artworks = await env.KV_STORE.get('artworks');
      const books = await env.KV_STORE.get('books');
      imageIds = [
        ...(artworks ? JSON.parse(artworks) : []),
        ...(books ? JSON.parse(books) : [])
      ];
    }

    // 并行获取所有图片数据，减少KV操作次数
    const images = [];
    const imagePromises = imageIds.map(async (id) => {
      const data = await env.KV_STORE.get(`image:${id}`);
      return data ? JSON.parse(data) : null;
    });
    const results = await Promise.all(imagePromises);
    for (const result of results) {
      if (result) {
        images.push(result);
      }
    }

    // 按时间倒序排序
    images.sort((a, b) => b.uploadTime - a.uploadTime);

    // 标签筛选
    let filteredImages = images;
    if (tag) {
      filteredImages = filteredImages.filter(img => 
        img.tags && img.tags.includes(tag)
      );
    }

    // 搜索筛选
    if (search) {
      const searchLower = search.toLowerCase();
      filteredImages = filteredImages.filter(img => 
        (img.title && img.title.toLowerCase().includes(searchLower)) ||
        (img.description && img.description.toLowerCase().includes(searchLower))
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: filteredImages 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5分钟缓存
      }
    });
  } catch (error) {
    console.error('获取列表失败:', error);
    return new Response(JSON.stringify({ error: '获取列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}