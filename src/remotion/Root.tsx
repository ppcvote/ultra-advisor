import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { FinancialCalculatorAnimation } from './FinancialCalculatorAnimation';
import { UltraAdvisorBrandVideo } from './UltraAdvisorBrandVideo';
import { UltraAdvisorFirstPersonDemo } from './UltraAdvisorFirstPersonDemo';
import { UltraAdvisorSystemDemo } from './UltraAdvisorSystemDemo';
import { UltraAllianceBackground } from './UltraAllianceBackground';
import { UltraAlliancePromo } from './UltraAlliancePromo';

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ==================== 品牌形象影片 ==================== */}

      {/* Ultra Advisor 品牌形象影片 - 17秒 */}
      <Composition
        id="BrandVideo"
        component={UltraAdvisorBrandVideo}
        durationInFrames={1020} // 17秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
      />

      {/* Ultra Advisor 第一人稱視角宣傳片 - 22秒 (v5 加快節奏) */}
      <Composition
        id="FirstPersonDemo"
        component={UltraAdvisorFirstPersonDemo}
        durationInFrames={1320} // 22秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
      />

      {/* Ultra Advisor 60 秒系統示範影片 */}
      <Composition
        id="SystemDemo"
        component={UltraAdvisorSystemDemo}
        durationInFrames={3600} // 60秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
      />

      {/* ==================== 計算機動畫 ==================== */}

      {/* 計算過程動畫 - 橫向 16:9 */}
      <Composition
        id="FinancialCalculator"
        component={FinancialCalculatorAnimation}
        durationInFrames={420} // 7秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{
          loanAmount: 1000,
          loanTerm: 30,
          loanRate: 2.2,
          investReturnRate: 6,
        }}
      />

      {/* 計算過程動畫 - 短版 (3秒) */}
      <Composition
        id="FinancialCalculatorShort"
        component={FinancialCalculatorAnimation}
        durationInFrames={180}
        fps={60}
        width={1080}
        height={1080}
        defaultProps={{
          loanAmount: 1000,
          loanTerm: 30,
          loanRate: 2.2,
          investReturnRate: 6,
        }}
      />

      {/* 計算過程動畫 - 直向版本 (9:16) */}
      <Composition
        id="FinancialCalculatorVertical"
        component={FinancialCalculatorAnimation}
        durationInFrames={420}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{
          loanAmount: 1000,
          loanTerm: 30,
          loanRate: 2.2,
          investReturnRate: 6,
        }}
      />

      {/* ==================== 傲創聯盟背景動畫 ==================== */}

      {/* Ultra Alliance 粒子連結網絡 - 10秒循環 (網頁背景用) */}
      <Composition
        id="AllianceBackground"
        component={UltraAllianceBackground}
        durationInFrames={600} // 10秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
      />

      {/* Ultra Alliance 粒子連結網絡 - 方形版 */}
      <Composition
        id="AllianceBackgroundSquare"
        component={UltraAllianceBackground}
        durationInFrames={600}
        fps={60}
        width={1080}
        height={1080}
      />

      {/* ==================== 傲創聯盟招商影片 ==================== */}

      {/* 傲創聯盟 30 秒招商宣傳影片 - 給店家看 (v4 絲滑版) */}
      <Composition
        id="AlliancePromo"
        component={UltraAlliancePromo}
        durationInFrames={1800} // 30秒 @ 60fps
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 傲創聯盟招商影片 - 直向版 (IG Reels / TikTok) */}
      <Composition
        id="AlliancePromoVertical"
        component={UltraAlliancePromo}
        durationInFrames={1800} // 30秒 @ 60fps
        fps={60}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
