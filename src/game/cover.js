import { gameSettings } from './buildGame.js';

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** Draws a 1600 × 1000 (16:10) cover for the game card. Resolves to a PNG Blob. */
export function renderCover(config) {
  const s = gameSettings(config);
  const W = 1600;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, s.sky[0]);
  sky.addColorStop(1, s.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = s.ground;
  ctx.fillRect(0, H * 0.8, W, H * 0.2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Items scattered in a fixed pattern so the same game always gets the same cover.
  const spots = [[180, 200], [1420, 170], [320, 520], [1300, 480], [760, 140], [1080, 640], [520, 700]];
  spots.forEach(([x, y], i) => {
    const list = i % 3 === 2 ? s.bad : s.good;
    ctx.font = `${90 + (i % 3) * 20}px ${EMOJI}`;
    ctx.fillText(list[i % list.length], x, y);
  });
  ctx.font = `220px ${EMOJI}`;
  ctx.fillText(s.player, W / 2, H * 0.8 - 110);

  const ink = s.dark ? '#f6f5ee' : '#292a23';
  ctx.fillStyle = ink;
  let size = 150;
  ctx.font = `800 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  while (ctx.measureText(s.title).width > W - 200 && size > 60) {
    size -= 8;
    ctx.font = `800 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  }
  const titleY = H * 0.36;
  const width = ctx.measureText(s.title).width;
  ctx.fillStyle = '#d8fd71';
  ctx.fillRect(W / 2 - width / 2 - 20, titleY + size * 0.12, width + 40, size * 0.32);
  ctx.fillStyle = ink;
  ctx.fillText(s.title, W / 2, titleY);

  ctx.font = '700 44px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#fffefa';
  ctx.fillText(`${s.slug}.start.ng`, W / 2, H * 0.9);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the cover'))), 'image/png'),
  );
}
