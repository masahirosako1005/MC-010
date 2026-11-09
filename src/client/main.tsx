import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

class AppBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="center-screen paper-bg"><section className="empty-paper"><h1>画面を表示できませんでした</h1><p>再読み込みして、保存済みのパンフレットを開き直してください。</p><button className="button button-primary" onClick={()=>window.location.reload()}>保存済みの内容を開く</button></section></main>:this.props.children;}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary><App /></AppBoundary>
  </StrictMode>,
);
