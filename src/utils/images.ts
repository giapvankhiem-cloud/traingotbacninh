/** Compress uploads before storing them in bounded Firestore documents. */
export async function compressImage(file: Blob, maxEdge = 900, maxBytes = 140_000): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP không quá 10 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    let edge = maxEdge;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể xử lý ảnh trên trình duyệt này.');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', 0.75);
      if (result.length <= maxBytes) return result;
      edge *= 0.72;
    }
    throw new Error('Ảnh còn quá lớn sau khi nén. Vui lòng chọn ảnh khác.');
  } finally { bitmap.close(); }
}
