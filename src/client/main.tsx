import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SharedPage } from './SharedPage';
import { MobileDemo } from './MobileDemo';
import { RallyDemo } from './RallyDemo';
import { getSharedPageToken, isMobileDemoContentPath } from '../shared/mobile-demo';
import './styles.css';

class AppBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="center-screen paper-bg"><section className="empty-paper"><h1>画面を表示できませんでした</h1><p>再読み込みして、保存済みのパンフレットを開き直してください。</p><button className="button button-primary" onClick={()=>window.location.reload()}>保存済みの内容を開く</button></section></main>:this.props.children;}
}

const pathname = window.location.pathname;
const rallyDemo = pathname === '/demo/rally' || pathname === '/demo/rally/';
const shareToken = getSharedPageToken(pathname);
const sharedPage = pathname === '/share' || pathname.startsWith('/share/') || pathname.startsWith('/demo/mobile/share/');
const mobileSharedPage = Boolean(shareToken && !isMobileDemoContentPath(pathname) && new URLSearchParams(window.location.search).get('view') === 'mobile');
const mobileDemo = pathname === '/demo/mobile' || pathname === '/demo/mobile/' || mobileSharedPage;

document.documentElement.classList.toggle('mobile-demo-content', isMobileDemoContentPath(pathname));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary>{rallyDemo ? <RallyDemo /> : mobileDemo ? <MobileDemo shareToken={shareToken} /> : sharedPage ? <SharedPage /> : <App />}</AppBoundary>
  </StrictMode>,
);
