const express = require('express');
const { Pool } = require('pg');
const { stateField, applyState } = require('./src/domain');
const { capture } = require('./projectx-analytics');

const app = express();
app.use(express.json({ limit: '1mb' }));

const products = {
  agency: { name: 'Agency Revenue OS', fields: ['name', 'stage', 'value'], stages: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] },
  money: { name: 'Freelancer Money OS', fields: ['name', 'kind', 'amount'], stages: ['income', 'expense'] },
  delivery: { name: 'Client Delivery OS', fields: ['name', 'status', 'value'], stages: ['in_progress', 'qa', 'approved', 'complete', 'blocked'] },
  seller: { name: 'Digital Product Seller OS', fields: ['name', 'channel', 'gross', 'refunds'], stages: ['Payhip', 'Gumroad', 'Direct', 'Lemon Squeezy'] },
  business: { name: 'Small Business OS', fields: ['name', 'kind', 'status'], stages: ['open', 'done', 'overdue'] }
};

const seed = {
  agency: [{ name: 'Northstar Labs', stage: 'qualified', value: 18000, probability: 0.3, next: 'Today' }, { name: 'Brightline Studio', stage: 'proposal', value: 32000, probability: 0.5, next: 'Tomorrow' }],
  money: [{ name: 'Web build', kind: 'income', amount: 4800, status: 'paid' }, { name: 'Cloud + tools', kind: 'expense', amount: 310, status: 'cleared' }],
  delivery: [{ name: 'Acme Growth', status: 'in_progress', value: 12000, next: 'Approval' }, { name: 'Nova Health', status: 'qa', value: 8000, next: 'QA' }],
  seller: [{ name: 'Agency Revenue OS', channel: 'Payhip', gross: 2840, refunds: 100 }, { name: 'Money OS', channel: 'Gumroad', gross: 1920, refunds: 0 }],
  business: [{ name: 'Review pipeline', kind: 'task', status: 'open', priority: 'high' }, { name: 'Update onboarding SOP', kind: 'task', status: 'done', priority: 'medium' }]
};

let pool = null;
const memory = structuredClone(seed);

function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  return pool;
}

async function migrate() {
  const p = db();
  if (!p) return false;
  await p.query(`CREATE TABLE IF NOT EXISTS product_records(
    id BIGSERIAL PRIMARY KEY,
    product TEXT NOT NULL,
    record JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await p.query('CREATE INDEX IF NOT EXISTS product_records_product_id_idx ON product_records(product, id DESC)');
  return true;
}

async function list(product) {
  const p = db();
  if (!p) return memory[product];
  const r = await p.query('SELECT id, record, created_at, updated_at FROM product_records WHERE product=$1 ORDER BY id DESC', [product]);
  return r.rows.map(x => ({ ...x.record, _id: x.id }));
}

async function add(product, record) {
  const p = db();
  if (!p) {
    const item = { ...record, _id: Date.now() };
    memory[product].push(item);
    return item;
  }
  const r = await p.query('INSERT INTO product_records(product,record) VALUES($1,$2) RETURNING id,record', [product, record]);
  return { ...r.rows[0].record, _id: r.rows[0].id };
}

async function update(product, id, record) {
  const p = db();
  if (!p) {
    const i = memory[product].findIndex(x => String(x._id) === String(id));
    if (i < 0) throw new Error('Record not found');
    memory[product][i] = { ...memory[product][i], ...record };
    return memory[product][i];
  }
  const r = await p.query('UPDATE product_records SET record=$1,updated_at=now() WHERE id=$2 AND product=$3 RETURNING id,record', [record, id, product]);
  if (!r.rowCount) throw new Error('Record not found');
  return { ...r.rows[0].record, _id: r.rows[0].id };
}

function assertProduct(product) {
  if (!products[product]) {
    const error = new Error('Unknown product');
    error.status = 404;
    throw error;
  }
  return products[product];
}

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    void capture('project_x_http_request', {
      method: req.method,
      route: req.path,
      status_code: res.statusCode,
      duration_ms: Date.now() - started
    });
  });
  next();
});

app.get('/health', async (_req, res) => {
  try {
    const p = db();
    if (p) await p.query('SELECT 1');
    const payload = { ok: true, database: Boolean(p), products: Object.keys(products).length };
    void capture('project_x_health_check', payload);
    res.json(payload);
  } catch (e) {
    void capture('project_x_health_check_failed', { error: e.message });
    res.status(503).json({ ok: false, database: true, error: e.message });
  }
});

app.get('/api/products', (_req, res) => res.json(products));

app.get('/api/records/:product', async (req, res) => {
  try {
    assertProduct(req.params.product);
    res.json(await list(req.params.product));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/records/:product', async (req, res) => {
  try {
    const product = req.params.product;
    assertProduct(product);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid record' });
    const state = stateField(product);
    if (req.body[state] !== undefined && !products[product].stages.includes(req.body[state])) {
      return res.status(400).json({ error: `Invalid ${state}: ${req.body[state]}` });
    }
    const record = { ...req.body };
    if (product === 'agency' && record.stage) record.probability = { lead: 0.1, qualified: 0.3, proposal: 0.5, negotiation: 0.7, won: 1, lost: 0 }[record.stage];
    const saved = await add(product, record);
    void capture('project_x_record_created', { product, state: record[state] || null });
    res.status(201).json(saved);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.patch('/api/records/:product/:id', async (req, res) => {
  try {
    const product = req.params.product;
    const definition = assertProduct(product);
    const currentRows = await list(product);
    const current = currentRows.find(x => String(x._id) === String(req.params.id));
    if (!current) return res.status(404).json({ error: 'Record not found' });
    const field = stateField(product);
    const requestedState = req.body?.[field];
    if (requestedState !== undefined && !definition.stages.includes(requestedState)) {
      return res.status(400).json({ error: `Invalid ${field}: ${requestedState}` });
    }
    const next = requestedState === undefined ? { ...current, ...req.body } : applyState(product, { ...current, ...req.body }, requestedState);
    delete next._id;
    if (product === 'agency' && next.stage) next.probability = { lead: 0.1, qualified: 0.3, proposal: 0.5, negotiation: 0.7, won: 1, lost: 0 }[next.stage];
    const saved = await update(product, req.params.id, next);
    void capture('project_x_record_updated', { product, state_field: field, state: saved[field] || null });
    res.json(saved);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project X</title><style>*{box-sizing:border-box}body{margin:0;background:#070b17;color:#edf3ff;font:14px system-ui,sans-serif}.g{position:fixed;width:360px;height:360px;border-radius:50%;filter:blur(100px);opacity:.22;pointer-events:none}.a{background:#806cff;top:-160px;left:-100px}.b{background:#42d8ee;right:-140px;bottom:-150px}.glass{background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(22px);box-shadow:0 24px 70px #0005;border-radius:22px}.top{margin:14px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center}.top h1{margin:4px 0}.layout{display:grid;grid-template-columns:235px 1fr;gap:16px;padding:0 14px 30px}.side{padding:16px;height:calc(100vh - 110px);position:sticky;top:14px}.side button{display:block;width:100%;border:0;background:transparent;color:#aab8ce;text-align:left;padding:12px;border-radius:12px;cursor:pointer}.side button.active,.side button:hover{background:#fff1;color:#fff}.content{min-width:0}.hero{padding:24px;margin-bottom:14px}.hero h2{font-size:30px;margin:5px 0}.muted,small{color:#93a4bd}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.card,.panel{padding:18px}.value{font-size:27px;font-weight:900;margin-top:5px}.label{color:#91a2bb;font-size:12px}.split{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:10px 6px;border-bottom:1px solid #fff1;text-align:left}.form{display:grid;gap:8px}.form input,.form select{padding:11px;border-radius:10px;border:1px solid #fff2;background:#fff1;color:#fff}.btn{padding:11px;border:0;border-radius:11px;background:linear-gradient(135deg,#806cff,#42d8ee);font-weight:800;cursor:pointer}@media(max-width:850px){.layout{grid-template-columns:1fr}.side{height:auto;position:static}.grid{grid-template-columns:repeat(2,1fr)}.split{grid-template-columns:1fr}}@media(max-width:520px){.grid{grid-template-columns:1fr}}</style></head><body><div class="g a"></div><div class="g b"></div><header class="glass top"><div><small>PROJECT X · INTERNATIONAL</small><h1>Operating Systems</h1></div><div id="db"></div></header><main class="layout"><aside class="glass side" id="nav"></aside><section class="content" id="app"></section></main><script>
const P=${JSON.stringify(products)};let cur='agency';const nav=document.getElementById('nav');Object.entries(P).forEach(([id,p])=>{const b=document.createElement('button');b.textContent=p.name;b.onclick=()=>{cur=id;render()};b.dataset.id=id;nav.appendChild(b)});const money=n=>'$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0});async function rows(){const r=await fetch('/api/records/'+cur);if(!r.ok)throw new Error(await r.text());return r.json()}function metrics(r){if(cur==='agency'){let v=r.reduce((s,x)=>s+Number(x.value||0),0),w=r.reduce((s,x)=>s+Number(x.value||0)*Number(x.probability||0),0);return [['Pipeline',money(v)],['Weighted',money(w)],['Deals',r.length],['Due today',r.filter(x=>x.next==='Today').length]]}if(cur==='money'){let i=r.filter(x=>x.kind==='income').reduce((s,x)=>s+Number(x.amount||0),0),e=r.filter(x=>x.kind==='expense').reduce((s,x)=>s+Number(x.amount||0),0);return [['Revenue',money(i)],['Expenses',money(e)],['Profit',money(i-e)],['Margin',i?Math.round((i-e)/i*100)+'%':'0%']]}if(cur==='delivery'){let c=r.filter(x=>x.status==='complete').length;return [['Projects',r.length],['Complete',c],['Progress',r.length?Math.round(c/r.length*100)+'%':'0%'],['Blocked',r.filter(x=>x.status==='blocked').length]]}if(cur==='seller'){let g=r.reduce((s,x)=>s+Number(x.gross||0),0),f=r.reduce((s,x)=>s+Number(x.refunds||0),0);return [['Products',r.length],['Gross',money(g)],['Net',money(g-f)],['Refunds',money(f)]]}let d=r.filter(x=>x.status==='done').length;return [['Tasks',r.length],['Complete',r.length?Math.round(d/r.length*100)+'%':'0%'],['Overdue',r.filter(x=>x.status==='overdue').length],['Open',r.filter(x=>x.status==='open').length]]}async function render(){nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.id===cur));const r=await rows(),m=metrics(r),p=P[cur],stateField={agency:'stage',money:'kind',delivery:'status',seller:'channel',business:'status'}[cur];document.getElementById('app').innerHTML='<div class="glass hero"><small>PRODUCT '+(Object.keys(P).indexOf(cur)+1)+'/5</small><h2>'+p.name+'</h2><div class="muted">'+({agency:'Pipeline, follow-ups and revenue forecasting.',money:'Income, expenses, pricing and receivables.',delivery:'Projects, milestones, approvals and handoff.',seller:'Products, channels, launches and net revenue.',business:'Weekly operations, SOPs, clients and KPIs.'}[cur])+'</div></div><div class="grid">'+m.map(x=>'<div class="glass card"><div class="label">'+x[0]+'</div><div class="value">'+x[1]+'</div></div>').join('')+'</div><div class="split"><div class="glass panel"><h3>Live workflow</h3><table class="table"><tr>'+p.fields.map(x=>'<th>'+x+'</th>').join('')+'<th>State</th></tr>'+r.map((x,i)=>'<tr>'+p.fields.map(f=>'<td>'+(['value','amount','gross','refunds'].includes(f)?money(x[f]):(x[f]??''))+'</td>').join('')+'<td><select data-i="'+x._id+'" class="state">'+p.stages.map(s=>'<option '+(x[stateField]===s?'selected':'')+'>'+s+'</option>').join('')+'</select></td></tr>').join('')+'</table></div><div class="glass panel"><h3>Add record</h3><form id="form" class="form">'+p.fields.map(f=>'<input name="'+f+'" placeholder="'+f+'" '+(['value','amount','gross','refunds'].includes(f)?'type="number" step="0.01"':'')+' required>').join('')+'<button class="btn">Add to workflow</button></form><p class="muted">Records persist to the dedicated Postgres database when DATABASE_URL is configured.</p></div></div>';document.getElementById('form').onsubmit=async e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));['value','amount','gross','refunds'].forEach(k=>{if(k in d)d[k]=Number(d[k])});const resp=await fetch('/api/records/'+cur,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});if(!resp.ok)alert(await resp.text());else render()};document.querySelectorAll('.state').forEach(s=>s.onchange=async e=>{const id=e.target.dataset.i;const resp=await fetch('/api/records/'+cur+'/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({[stateField]:e.target.value})});if(!resp.ok)alert(await resp.text());else render()})}fetch('/health').then(r=>r.json()).then(x=>{document.getElementById('db').textContent=x.database?'DB CONNECTED':'DEMO MODE'}).catch(()=>document.getElementById('db').textContent='DB ERROR');render();</script></body></html>`;

app.get('/', (_req, res) => res.type('html').send(html));

async function start(port = process.env.PORT || 3000) {
  await migrate();
  const server = app.listen(port, () => console.log(`Project X listening on ${port}`));
  void capture('project_x_service_started', { database: Boolean(db()), products: Object.keys(products).length });
  return server;
}

if (require.main === module) {
  start().catch(error => {
    console.error('Project X startup failed:', error);
    process.exit(1);
  });
}

module.exports = { app, start, migrate, products };
