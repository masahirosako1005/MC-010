import { useEffect, useRef, useState } from 'react';
import { BatteryFull, Maximize2, Minimize2, Monitor, Signal, Smartphone, Wifi } from 'lucide-react';
import { MOBILE_APP_PATH } from '../shared/mobile-demo';
import './mobile-demo.css';

const PHONE_WIDTH = 414;
const PHONE_HEIGHT = 936;

export function MobileDemo({ shareToken }: { shareToken?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  const [fullscreen, setFullscreen] = useState(false);
  const normalPath = shareToken ? `/share/${shareToken}` : '/';
  const framePath = shareToken ? `/demo/mobile/share/${shareToken}` : MOBILE_APP_PATH;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setScale(Math.min(1, entry.contentRect.width / PHONE_WIDTH, entry.contentRect.height / PHONE_HEIGHT));
    });
    observer.observe(stage);
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => {
      observer.disconnect();
      document.removeEventListener('fullscreenchange', updateFullscreen);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is optional; the page also fits inside a normal browser window.
    }
  }

  return <main className="mobile-demo">
    <header className="mobile-demo-header">
      <div className="mobile-demo-heading">
        <span className="mobile-demo-mark" aria-hidden="true"><Smartphone /></span>
        <div><h1>今度はあなたと</h1><p>スマートフォンデモ <span>／ 試作</span></p></div>
      </div>
      <nav className="mobile-demo-actions" aria-label="デモの表示設定">
        <a className="button" href={normalPath}><Monitor aria-hidden="true" /><span>通常表示</span></a>
        {document.fullscreenEnabled && <button className="button button-outline" onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          <span>{fullscreen ? '全画面を終了' : '全画面で見る'}</span>
        </button>}
      </nav>
    </header>

    <div className="mobile-demo-stage" ref={stageRef}>
      <div className="mobile-demo-device-space" style={{ width: PHONE_WIDTH * scale, height: PHONE_HEIGHT * scale }}>
        <section className="mobile-demo-phone" aria-label="スマートフォン型の利用者画面" style={{ transform: `scale(${scale})` }}>
          <span className="mobile-demo-side-button mobile-demo-side-button-left" aria-hidden="true" />
          <span className="mobile-demo-side-button mobile-demo-side-button-right" aria-hidden="true" />
          <div className="mobile-demo-screen">
            <div className="mobile-demo-status" aria-hidden="true">
              <span>9:41</span><span className="mobile-demo-camera" />
              <span className="mobile-demo-status-icons"><Signal /><Wifi /><BatteryFull /></span>
            </div>
            <iframe className="mobile-demo-app" src={framePath} title={shareToken ? '共有パンフレット・スマートフォン画面' : '今度はあなたと・利用者向けスマートフォン画面'} allow="clipboard-write" />
            <div className="mobile-demo-home" aria-hidden="true"><span /></div>
          </div>
        </section>
      </div>
    </div>

    <footer className="mobile-demo-footer"><span className="mobile-demo-live" aria-hidden="true" />実際に操作できます<span className="mobile-demo-footer-divider" aria-hidden="true">·</span><span>画面の中でクリック・スクロール</span></footer>
  </main>;
}
