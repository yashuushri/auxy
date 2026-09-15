export {};

declare global {
  namespace YT {
    class Player {
      constructor(
        element: HTMLElement | string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: (event: { target: Player }) => void;
            onStateChange?: (event: { data: number; target: Player }) => void;
          };
        }
      );
      playVideo(): void;
      pauseVideo(): void;
      setVolume(volume: number): void;
      loadVideoById(id: string): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getDuration(): number;
    }

    const PlayerState: {
      ENDED: number;
    };
  }

  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}
