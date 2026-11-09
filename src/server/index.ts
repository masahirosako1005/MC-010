import { createApp } from './app.js';
import { pool } from './db.js';
const port=Number(process.env.PORT??3001);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT設定が正しくありません。');
const server=createApp().listen(port,'127.0.0.1',()=>console.log(`ローカルデモ: http://127.0.0.1:${port}`));
const stop=()=>{server.close(()=>{void pool.end().finally(()=>process.exit(0));});};
process.on('SIGINT',stop);process.on('SIGTERM',stop);

