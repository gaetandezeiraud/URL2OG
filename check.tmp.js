import sharp from 'sharp';
for (const f of process.argv.slice(2)) {
  const { data } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => [...data.subarray((y * 1200 + x) * 3, (y * 1200 + x) * 3 + 3)].join(',');
  console.log(f.split('/').pop(), 'right', px(1195, 300), 'bottom', px(600, 626), 'center', px(600, 300));
}
