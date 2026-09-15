export const EDIT_WINDOW_WIDTH = 320;
export const PLAYER_WINDOW_WIDTH = 400;
export const WINDOW_GAP = 20;
export const WINDOW_TOP_MIN = 72;

export function centeredPairLayout(vw: number, vh: number) {
  const playerHeight = Math.min(600, Math.max(258, vh - WINDOW_TOP_MIN - 16));
  const totalWidth = EDIT_WINDOW_WIDTH + WINDOW_GAP + PLAYER_WINDOW_WIDTH;
  const startX = Math.max(16, Math.round((vw - totalWidth) / 2));
  const y = Math.max(WINDOW_TOP_MIN, Math.round((vh - playerHeight) / 2));
  return {
    editX: startX,
    playerX: startX + EDIT_WINDOW_WIDTH + WINDOW_GAP,
    y,
    playerHeight,
  };
}
