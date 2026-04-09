export async function handleTestUploadPost(c) {
  try {
    const request = c.req.raw;
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return c.json({ error: '缺少文件' }, 400);
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return c.json({ 
      success: true, 
      fileName: file.name, 
      size: buffer.length, 
      type: file.type 
    });
  } catch (error) {
    console.error('测试上传失败:', error);
    return c.json({ error: '测试上传失败: ' + error.message }, 500);
  }
}
