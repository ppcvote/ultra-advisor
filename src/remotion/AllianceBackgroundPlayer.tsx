/**
 * Ultra Alliance Background Player
 *
 * 在網頁中播放粒子連結網絡動態背景
 * 使用 Remotion Player 實現即時渲染
 */

import React from 'react';
import { Player } from '@remotion/player';
import { UltraAllianceBackground } from './UltraAllianceBackground';

interface AllianceBackgroundPlayerProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const AllianceBackgroundPlayer: React.FC<AllianceBackgroundPlayerProps> = ({
  width = '100%',
  height = '100%',
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Player
        component={UltraAllianceBackground}
        durationInFrames={600} // 10秒循環
        fps={60}
        compositionWidth={1920}
        compositionHeight={1080}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }}
        loop
        autoPlay
        controls={false}
        showVolumeControls={false}
        clickToPlay={false}
      />
    </div>
  );
};

export default AllianceBackgroundPlayer;
