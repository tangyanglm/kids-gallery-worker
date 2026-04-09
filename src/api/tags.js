const TAG_COLORS = [
  'bg-candy-pink',
  'bg-sunny-yellow',
  'bg-sky-blue',
  'bg-grape-purple',
  'bg-ocean-blue',
  'bg-coral-orange'
];

function getDefaultTags(type) {
  if (type === 'artwork') {
    return [
      { id: 'landscape', name: '风景', color: 'bg-sky-blue' },
      { id: 'animal', name: '动物', color: 'bg-coral-orange' },
      { id: 'portrait', name: '人物', color: 'bg-candy-pink' },
      { id: 'fantasy', name: '幻想', color: 'bg-grape-purple' },
      { id: 'nature', name: '自然', color: 'bg-sky-blue' },
      { id: 'abstract', name: '抽象', color: 'bg-ocean-blue' },
      { id: 'still-life', name: '静物', color: 'bg-sunny-yellow' }
    ];
  } else if (type === 'book') {
    return [
      { id: 'story', name: '故事', color: 'bg-candy-pink' },
      { id: 'fantasy', name: '幻想', color: 'bg-grape-purple' },
      { id: 'animal', name: '动物', color: 'bg-coral-orange' },
      { id: 'nature', name: '自然', color: 'bg-sky-blue' }
    ];
  }
  return [];
}

export async function handleTagsGet(c) {
  const url = new URL(c.req.url);
  const type = url.searchParams.get('type') || 'all';
  
  try {
    const env = c.env;
    
    // 尝试从KV中获取标签
    let artworkTags = [];
    let bookTags = [];
    
    const storedArtworkTags = await env.KV_STORE.get('artwork_tags');
    const storedBookTags = await env.KV_STORE.get('book_tags');
    
    if (storedArtworkTags) {
      artworkTags = JSON.parse(storedArtworkTags);
    } else {
      artworkTags = getDefaultTags('artwork');
      await env.KV_STORE.put('artwork_tags', JSON.stringify(artworkTags));
    }
    
    if (storedBookTags) {
      bookTags = JSON.parse(storedBookTags);
    } else {
      bookTags = getDefaultTags('book');
      await env.KV_STORE.put('book_tags', JSON.stringify(bookTags));
    }
    
    if (type === 'artwork') {
      return c.json({ success: true, data: artworkTags });
    } else if (type === 'book') {
      return c.json({ success: true, data: bookTags });
    } else {
      return c.json({ 
        success: true, 
        data: { artwork: artworkTags, book: bookTags } 
      });
    }
  } catch (error) {
    console.error('获取标签失败:', error);
    return c.json({ error: '获取标签失败' }, 500);
  }
}

export async function handleTagsPost(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    const { action, type, tag } = await request.json();
    
    if (action === 'add') {
      if (!type || !tag || !tag.name) {
        return c.json({ error: '缺少必要参数' }, 400);
      }
      
      const typeKey = type === 'artwork' ? 'artwork_tags' : 'book_tags';
      const storedTags = await env.KV_STORE.get(typeKey);
      let tags = storedTags ? JSON.parse(storedTags) : getDefaultTags(type);
      
      const id = tag.id || `tag_${Date.now()}`;
      const color = tag.color || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      
      const newTag = { id, name: tag.name, color };
      tags.push(newTag);
      
      await env.KV_STORE.put(typeKey, JSON.stringify(tags));
      
      return c.json({ success: true, data: newTag });
    }
    
    if (action === 'update') {
      if (!type || !tag || !tag.id) {
        return c.json({ error: '缺少必要参数' }, 400);
      }
      
      const typeKey = type === 'artwork' ? 'artwork_tags' : 'book_tags';
      const storedTags = await env.KV_STORE.get(typeKey);
      let tags = storedTags ? JSON.parse(storedTags) : getDefaultTags(type);
      
      const tagIndex = tags.findIndex(t => t.id === tag.id);
      if (tagIndex === -1) {
        return c.json({ error: '标签不存在' }, 404);
      }
      
      tags[tagIndex] = { ...tags[tagIndex], ...tag };
      await env.KV_STORE.put(typeKey, JSON.stringify(tags));
      
      return c.json({ success: true, data: tags[tagIndex] });
    }
    
    if (action === 'delete') {
      if (!type || !tag || !tag.id) {
        return c.json({ error: '缺少必要参数' }, 400);
      }
      
      const typeKey = type === 'artwork' ? 'artwork_tags' : 'book_tags';
      const storedTags = await env.KV_STORE.get(typeKey);
      let tags = storedTags ? JSON.parse(storedTags) : getDefaultTags(type);
      
      tags = tags.filter(t => t.id !== tag.id);
      await env.KV_STORE.put(typeKey, JSON.stringify(tags));
      
      return c.json({ success: true });
    }
    
    return c.json({ error: '无效的操作' }, 400);
  } catch (error) {
    console.error('操作标签失败:', error);
    return c.json({ error: '操作失败: ' + error.message }, 500);
  }
}
