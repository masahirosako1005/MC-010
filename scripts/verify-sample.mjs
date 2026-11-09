import assert from 'node:assert/strict';
import pg from 'pg';
const base=new URL(process.env.E2E_BASE_URL??'http://127.0.0.1:3001');
assert(['127.0.0.1','localhost'].includes(base.hostname)&&base.protocol==='http:','ローカルHTTPのみ検証できます。');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://postgres:postgres@127.0.0.1:5432/kondo_anatato'});
async function request(route,body,cookie){
  const response=await fetch(new URL(route,base),{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Requested-With':'kondo',Origin:base.origin,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
try{
  const login=await request('/api/login',{email:'sample@example.test',code:'1111'});
  assert.equal(login.status,200);assert.equal(login.data.user.source,'organizer');assert(login.data.visits.length>0);
  const userId=login.data.user.id;
  const original=(await db.query('SELECT count(*)::int AS count FROM visits WHERE user_id=$1',[userId])).rows[0].count;
  assert.equal(login.data.visits.length,original);
  const first=await request('/api/brochure/ensure',{},login.cookie);
  assert.equal((await request('/api/logout',{},login.cookie)).status,200);
  const relogin=await request('/api/login',{email:'sample@example.test',code:'1111'});
  assert.equal(relogin.status,200);assert.equal(relogin.data.brochure.id,first.data.brochure.id);
  const second=await request('/api/brochure/ensure',{},relogin.cookie);
  assert.equal(first.status,200);assert.equal(first.data.brochure.id,second.data.brochure.id);
  const visited=new Set(login.data.visits.map(v=>v.spotId));
  for(const item of first.data.brochure.items)assert.equal(item.kind==='visited',visited.has(item.spotId));
  const empty=await request('/api/login',{email:'sample-empty@example.test',code:'1111'});
  assert.equal(empty.status,200);assert.equal(empty.data.visits.length,0);
  assert.equal((await request('/api/brochure/ensure',{},empty.cookie)).status,422);
  const counts=(await db.query("SELECT (SELECT count(*)::int FROM users WHERE source='organizer') AS users,(SELECT count(*)::int FROM visits v JOIN users u ON u.id=v.user_id WHERE u.source='organizer') AS visits")).rows[0];
  console.log(JSON.stringify({verified:true,organizerUsers:counts.users,organizerStampEvents:counts.visits,aliasHistoryMatchesDatabase:true,emptyHistoryNotGenerated:true,reloginDoesNotDuplicate:true}));
} finally { await db.end(); }
