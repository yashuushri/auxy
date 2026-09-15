export {};

declare global {
  namespace YT {
    interface VideoData {
      video_id?: string;
      author?: string;
      title?: string;
      [key: string]: unknown;
    }

    class Player {
      constructor(
        element: HTMLElement | string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: Player }) => void;
            onStateChange?: (event: { data: number; target: Player }) => void;
            onError?: (event: { data: number; target: Player }) => void;
          };
        }
      );
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      setVolume(volume: number): void;
      getVolume(): number;
      loadVideoById(id: string, startSeconds?: number): void;
      cueVideoById(id: string, startSeconds?: number): void;
      loadPlaylist(args: { listType: string; list: string; index?: number }): void;
      cuePlaylist(args: { listType: string; list: string; index?: number }): void;
      nextVideo(): void;
      previousVideo(): void;
      playVideoAt(index: number): void;
      seekTo(seconds: number, allowSeekAhead?: boolean): void;
      getCurrentTime(): number;
      getDuration(): number;
      getVideoData(): VideoData;
    }

    const PlayerState: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  }

  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}
