import React, { useEffect, useRef, useState, useCallback } from 'react';
import './research/research.css';
import { VOLUMES, ResearchVolume } from './research/content';

/**
 * Ultra Advisor · 研究報告（AI Trust Thesis 系列）
 *
 * 架構說明（為「未來擴展」而設計）：
 *  - 內容（VOLUMES）是 compliance-reviewed 的資料模組，bodyHtml 由 public/research/*.html
 *    產生，避免把法遵敏感的數字重新手打進 JSX 而引入錯誤。
 *  - 本元件提供 React 外殼：路由（/research、/research/:slug）、頂部導覽、閱讀進度條、
 *    捲動浮現與數字跑動動效、站內連結攔截。
 *  - 要新增一卷：在 content.ts 加一筆 VOLUMES。
 *  - 要加互動元件（例如 §09 兩檔基金試算表）：在 volume body 放一個 <div id="calc-mount">，
 *    本元件偵測到就掛載對應 React widget（見 mountWidgets）。
 */

const SLUGS = VOLUMES.map(v => v.slug);

function pathToSlug(pathname: string): string | null {
  // /research -> index(null) ; /research/the-brain -> 'the-brain'
  const m = pathname.match(/^\/research(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  return m[1] || '__index__';
}

interface Props { onBack?: () => void; }

const ResearchPage: React.FC<Props> = ({ onBack }) => {
  const [slug, setSlug] = useState<string>(() => {
    const s = pathToSlug(window.location.pathname);
    return s || '__index__';
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    const s = pathToSlug(to) || '__index__';
    setSlug(s);
    window.scrollTo(0, 0);
  }, []);

  // 字型（研究報告用 Noto Serif TC + IBM Plex Mono，主站未必載入）
  useEffect(() => {
    const id = 'research-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@400;500;700&family=IBM+Plex+Mono:wght@400;600&display=swap';
    document.head.appendChild(link);
  }, []);

  // popstate（上一頁/下一頁）
  useEffect(() => {
    const onPop = () => {
      const s = pathToSlug(window.location.pathname);
      if (s) setSlug(s); else onBack?.();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onBack]);

  // 閱讀進度條
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop || window.pageYOffset) / max : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, pct))})`;
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => document.removeEventListener('scroll', onScroll);
  }, [slug]);

  // 捲動浮現 + 數字跑動 + 站內連結攔截（作用在注入的內容上）
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 站內連結改走 pushState
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      let to: string | null = null;
      if (/vol1-the-gateway/.test(href)) to = '/research/the-gateway';
      else if (/vol2-the-brain/.test(href)) to = '/research/the-brain';
      else if (/vol3-the-parachute/.test(href)) to = '/research/the-parachute';
      else if (/\/research\/?$|index\.html/.test(href)) to = '/research';
      else if (/\/booking/.test(href)) to = '/booking';
      if (to) {
        e.preventDefault();
        if (to === '/booking') { window.history.pushState({}, '', '/booking'); window.location.reload(); return; }
        navigate(to);
      }
    };
    root.addEventListener('click', onClick);

    if (reduce) {
      root.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      return () => root.removeEventListener('click', onClick);
    }

    // 數字跑動
    const countUp = (el: HTMLElement) => {
      const txt = el.textContent?.trim() || '';
      const m = txt.match(/^([^\d\-+]*[+\-]?)\s*([\d,]+(?:\.\d+)?)(.*)$/);
      if (!m) return;
      const target = parseFloat(m[2].replace(/,/g, ''));
      const dec = (m[2].split('.')[1] || '').length;
      const grouped = /,/.test(m[2]);
      const pre = m[1], suf = m[3];
      const fmt = (v: number) => {
        let s = v.toFixed(dec);
        if (grouped) { const p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
        return pre + s + suf;
      };
      let start: number | null = null; const dur = 900;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          e.target.querySelectorAll<HTMLElement>('.stat').forEach(countUp);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    root.querySelectorAll('section, .card, table, blockquote, .big-claim, .takeaway, .next-link, .vol-card').forEach((el, i) => {
      el.classList.add('reveal');
      if (el.classList.contains('card') || el.classList.contains('vol-card')) {
        (el as HTMLElement).style.transitionDelay = `${Math.min(i % 5, 4) * 55}ms`;
      }
      io.observe(el);
    });

    return () => { root.removeEventListener('click', onClick); io.disconnect(); };
  }, [slug, navigate]);

  const volume: ResearchVolume | undefined = slug !== '__index__' ? VOLUMES.find(v => v.slug === slug) : undefined;

  return (
    <div className="research-root">
      <div className="read-progress" ref={progressRef} />
      <div className="topbar"><div className="wrap">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.location.reload(); }}>ULTRA ADVISOR</a>
        <nav>
          <a className={slug === '__index__' ? 'active' : ''} href="/research" onClick={(e) => { e.preventDefault(); navigate('/research'); }}>SERIES</a>
          <a className={slug === 'the-gateway' ? 'active' : ''} href="/research/the-gateway" onClick={(e) => { e.preventDefault(); navigate('/research/the-gateway'); }}>VOL.I</a>
          <a className={slug === 'the-brain' ? 'active' : ''} href="/research/the-brain" onClick={(e) => { e.preventDefault(); navigate('/research/the-brain'); }}>VOL.II</a>
          <a className={slug === 'the-parachute' ? 'active' : ''} href="/research/the-parachute" onClick={(e) => { e.preventDefault(); navigate('/research/the-parachute'); }}>VOL.III</a>
        </nav>
      </div></div>

      <div ref={bodyRef}>
        {volume ? (
          <div dangerouslySetInnerHTML={{ __html: volume.bodyHtml }} />
        ) : (
          <ResearchIndex onOpen={navigate} />
        )}
      </div>
    </div>
  );
};

const ResearchIndex: React.FC<{ onOpen: (to: string) => void }> = ({ onOpen }) => (
  <>
    <header className="cover"><div className="wrap">
      <div className="meta-row">
        <div>RESEARCH SERIES<b>AI TRUST THESIS</b></div>
        <div>VOLUMES<b>I · II · III</b></div>
        <div>AUTHOR<b>PPC, RFC · CHRP · MDRT</b></div>
        <div>EDITION<b>2026 / Q2</b></div>
      </div>
      <div className="kicker">Research Notes</div>
      <h1 className="display" style={{ fontSize: 'clamp(40px,7vw,72px)' }}>AI Trust Thesis<br />三部曲</h1>
      <div className="lede">
        <span className="hl">Vol.I 講地理。Vol.II 講工具。Vol.III 講時機。</span><br />
        從「全球 AI 資本為什麼必經台灣」到「不能 all in 的人怎麼留在桌上」——三卷用於真實客戶對話、經過市場驗證的研究報告。
      </div>
      <p className="note">本系列內容僅供參考，不構成投資建議。投資有賺有賠，申購前請詳閱公開說明書。</p>
    </div></header>
    <section><div className="wrap">
      <div className="cards" style={{ gridTemplateColumns: '1fr', gap: 24, maxWidth: 760 }}>
        {VOLUMES.map((v, i) => (
          <a key={v.slug} className="vol-card" href={`/research/${v.slug}`}
             onClick={(e) => { e.preventDefault(); onOpen(`/research/${v.slug}`); }}>
            <div className="vol-no">VOL. {['I', 'II', 'III'][i]} · {v.no} · {v.titleEn.toUpperCase().replace(/[.。]/g, '')}</div>
            <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 40, margin: '0 0 2px' }}>{v.title}</h3>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--accent)', fontSize: 18, marginBottom: 14 }}>{v.titleEn}</div>
            <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: 0 }}>{v.blurb}</p>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', color: 'var(--ink-2)', marginTop: 16, borderTop: '1px dashed var(--hairline)', paddingTop: 12 }}>{v.tags}</div>
          </a>
        ))}
      </div>
      <div className="card navy" style={{ maxWidth: 760, marginTop: 32 }}>
        <div className="mono-label">PRIVATE ADVISORY SESSION</div>
        <h4>30 分鐘投資組合健檢 · 免費 · 不推銷</h4>
        <p style={{ fontSize: 15, margin: '8px 0 0' }}>讀完任何一卷，想對照自己的配置——
          <a href="/booking" style={{ color: '#E8A87C', fontWeight: 700 }}
             onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/booking'); window.location.reload(); }}>預約諮詢 →</a></p>
      </div>
    </div></section>
    <footer><div className="wrap">
      <div className="legal">© 2026 Ultra Advisor · All Rights Reserved. 本系列為獨立研究成果，不構成投資建議、不為特定商品推廣。過往績效不代表未來表現，投資有賺有賠，申購基金前應詳閱公開說明書。投資型保險商品涉及保險成本、投資風險、資金流動性風險，詳細內容應以保險契約條款與商品說明為準。</div>
    </div></footer>
  </>
);

export default ResearchPage;
