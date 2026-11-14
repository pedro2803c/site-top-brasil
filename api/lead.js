/* Recebe leads do site (orçamento, agendamento e suporte), valida no servidor e
   repassa por e-mail via FormSubmit. O e-mail de destino fica só aqui.
   Função Node sem dependências (plano Hobby da Vercel). */
const DEST = process.env.LEAD_EMAIL || 'sac@andrehuhn.com.br';
const SITE = 'https://www.siteprobrasil.com.br';
const ORIGINS = /^https:\/\/((www\.)?siteprobrasil\.com\.br|site-top-brasil(-[a-z0-9-]+)?\.vercel\.app)$/;
const TIPOS = {
  'Orçamento': ['nome', 'whatsapp', 'empresa', 'necessidade', 'email'],
  'Agendamento': ['nome', 'empresa', 'whatsapp', 'email', 'data', 'horario'],
  'Suporte': ['nome', 'empresa', 'doc', 'email', 'motivo', 'solicitacao']
};
const OBRIG = {
  'Orçamento': ['nome', 'whatsapp', 'empresa', 'necessidade'],
  'Agendamento': ['nome', 'empresa', 'whatsapp', 'data', 'horario'],
  'Suporte': ['nome', 'empresa', 'doc', 'email', 'motivo', 'solicitacao']
};
const ROTULO = { nome: 'Nome', whatsapp: 'WhatsApp', empresa: 'Empresa', necessidade: 'Necessidade', email: 'E-mail', data: 'Data', horario: 'Horário', doc: 'CPF/CNPJ', motivo: 'Motivo', solicitacao: 'Solicitação' };
const CAMP = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

/* limite simples por IP (memória da instância; sem custo extra) */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 5;
}
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim().slice(0, max);
}
const emailOk = v => v.length <= 120 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const origin = req.headers.origin || '';
  if (!ORIGINS.test(origin)) return res.status(403).json({ ok: false, error: 'origin' });
  if (!/application\/json/.test(req.headers['content-type'] || '')) return res.status(415).json({ ok: false, error: 'type' });
  if (Number(req.headers['content-length'] || 0) > 8000) return res.status(413).json({ ok: false, error: 'size' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate' });

  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  if (b._honey) return res.status(200).json({ ok: true }); /* robô: responde ok e descarta */
  const tipo = clean(b.tipo, 20);
  if (!TIPOS[tipo]) return res.status(400).json({ ok: false, error: 'tipo' });

  const d = {};
  for (const k of TIPOS[tipo]) d[k] = clean(b[k], k === 'solicitacao' ? 1000 : 120);
  const faltando = OBRIG[tipo].filter(k => d[k].length < 2);
  if (faltando.length) return res.status(400).json({ ok: false, error: 'campos', campos: faltando });
  if (d.whatsapp) { const n = d.whatsapp.replace(/\D/g, ''); if (n.length < 10 || n.length > 11) return res.status(400).json({ ok: false, error: 'whatsapp' }); }
  if (d.email && !emailOk(d.email)) return res.status(400).json({ ok: false, error: 'email' });
  if (tipo === 'Orçamento' && b.lgpd !== true) return res.status(400).json({ ok: false, error: 'lgpd' });

  const recebido = new Date().toISOString();
  const consentAt = clean(b.consentAt, 40);
  const mail = { _subject: `SitePro Brasil — ${tipo} — ${d.nome}`, _template: 'table', _captcha: 'false', Tipo: tipo };
  for (const k of TIPOS[tipo]) if (d[k]) mail[ROTULO[k]] = d[k];
  if (tipo === 'Orçamento') { mail['Consentimento LGPD'] = 'Sim'; mail['Consentimento em (ISO 8601)'] = /^\d{4}-\d{2}-\d{2}T/.test(consentAt) ? consentAt : recebido; }
  mail['Recebido em (ISO 8601)'] = recebido;
  mail['Página de origem'] = clean(b.origem, 300);
  const camp = (b.campanha && typeof b.campanha === 'object') ? b.campanha : {};
  for (const k of CAMP) { const v = clean(camp[k], 200); if (v) mail[k] = v; }
  if (d.email) mail._replyto = d.email;

  try {
    const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(DEST), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': SITE, 'Referer': SITE + '/' },
      body: JSON.stringify(mail),
      signal: AbortSignal.timeout(8000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || String(j.success) !== 'true') {
      console.error('lead destino recusou', r.status, String(j.message || '').slice(0, 200)); /* sem dados pessoais */
      return res.status(502).json({ ok: false, error: 'destino' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead destino indisponível', String(e && e.name || e).slice(0, 80));
    return res.status(502).json({ ok: false, error: 'destino' });
  }
};
