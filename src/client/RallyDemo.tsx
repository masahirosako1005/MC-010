import { BookOpen } from 'lucide-react';
import './rally-demo.css';

export function RallyDemo() {
  return <main className="rally-demo" aria-labelledby="rally-demo-title">
    <h1 id="rally-demo-title" className="sr-only">スタンプラリーから、次の旅へ</h1>
    <div className="rally-demo-screen">
      <img
        className="rally-demo-image"
        src="/assets/rally-demo-home.png"
        width="587"
        height="990"
        alt="N西市デジタルスタンプラリーのホーム画面（デモ用の背景）"
      />
      <a className="rally-demo-cta" href="/demo/mobile">
        <BookOpen aria-hidden="true" />
        <span>旅のしおりを<br />つくる</span>
      </a>
    </div>
  </main>;
}
