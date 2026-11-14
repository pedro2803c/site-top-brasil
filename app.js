/* Proteção dos formulários: limpeza, limites, honeypot, tempo mínimo e intervalo entre envios */
window.lpSec = (function(){
  var t0 = Date.now(), last = {};
  function clean(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim().slice(0, max || 200); }
  function email(v){ v = String(v || '').trim(); return v.length <= 120 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v); }
  function allow(tipo, root){
    var hp = root && root.querySelector('[data-hp]');
    if (hp && hp.value) return false;              /* robô preencheu o campo-isca */
    if (Date.now() - t0 < 4000) return false;      /* envio rápido demais para uma pessoa */
    var now = Date.now(), k = 'lp-sent-' + tipo, prev = last[tipo] || 0;
    try { prev = Math.max(prev, +sessionStorage.getItem(k) || 0); } catch (e) {}
    if (now - prev < 60000) return false;          /* no máximo 1 e-mail por minuto por formulário */
    last[tipo] = now; try { sessionStorage.setItem(k, String(now)); } catch (e) {}
    return true;
  }
  return { clean: clean, email: email, allow: allow };
})();
/* =============================================================================
   CONFIGURAÇÃO DO SITE
   - whatsapp: número que recebe os contatos. O visitante só chega ao WhatsApp
     depois de preencher o formulário de orçamento ou o agendamento.
   - metaPixelId / googleTagId: troque os placeholders pelos IDs reais.
     Enquanto estiverem como 'SEU_PIXEL_ID' / 'G-XXXXXXXXXX', nada é carregado.
   - leadEndpoint (destino dos leads):
       ''  (vazio)  -> o envio do formulário abre o WhatsApp com a mensagem pronta.
       URL         -> formulário e agendamento enviam os dados por POST (JSON) para
                      essa URL (Formspree: https://formspree.io/f/SEU_ID ·
                      Web3Forms: https://api.web3forms.com/submit · função serverless)
                      e o formulário mostra a confirmação sem abrir o WhatsApp.
       Web3Forms exige a chave: leadExtra: { access_key: 'SUA_CHAVE' }.
       FormSubmit (padrão atual, grátis e sem conta): https://formsubmit.co/ajax/<destino>.
       Troque o e-mail pelo ALIAS ALEATÓRIO que o FormSubmit envia no e-mail de ativação
       (ex.: https://formsubmit.co/ajax/a1b2c3d4e5...) para não expor o endereço.
       O FormSubmit só aceita envios do navegador (recusa servidores com 403).
       Endpoint de outro domínio: libere-o em "connect-src" da Content-Security-Policy
       no vercel.json, senão o navegador bloqueia o envio.
   ============================================================================= */
var CONFIG = {
  checkoutUrl: '',              /* link de pagamento (vazio: contratação segue no WhatsApp após o formulário) */
  agendaUrl: '',                /* link de agenda externa (vazio: usa o agendamento do próprio site) */
  whatsapp: '5511943935206',
  metaPixelId: 'SEU_PIXEL_ID',  /* ex.: '123456789012345' */
  googleTagId: 'G-XXXXXXXXXX',  /* ex.: 'G-AB12CD34EF' (GA4) */
  leadEndpoint: 'https://formsubmit.co/ajax/1b48b570aacae35a6aa375e741964f04',  /* alias do FormSubmit (não expõe o e-mail) */
  leadExtra: {}
};
/* IDs só valem quando deixam de ser placeholder */
var TRACK_IDS = {
  pixel: /^\d{8,20}$/.test(CONFIG.metaPixelId) ? CONFIG.metaPixelId : '',
  gtag: (/^(G|AW)-[A-Z0-9]{6,}$/.test(CONFIG.googleTagId) && !/^G-X+$/.test(CONFIG.googleTagId)) ? CONFIG.googleTagId : ''
};
/* Mapa de eventos Meta -> GA4 */
window.lpTrack = function(name, label, extra){
  var GA = { InitiateCheckout: 'begin_checkout', Lead: 'generate_lead', Schedule: 'schedule_meeting', Contact: 'contact', ViewContent: 'view_item' };
  var p = {}, g = {}, k;
  if (label) { p.content_name = label; g.event_label = label; }
  for (k in (extra || {})) { p[k] = extra[k]; g[k] = extra[k]; }
  try { if (window.fbq) fbq('track', name, p); } catch (e) {}
  try { if (window.gtag) gtag('event', GA[name] || name, g); } catch (e) {}
};
/* form_start: primeiro foco no formulário de orçamento e no agendamento (mede abandono; não é conversão) */
(function(){
  var seen = {};
  document.addEventListener('focusin', function(e){
    var f = e.target.closest && e.target.closest('#lf-form, #bkm'); if (!f || seen[f.id]) return;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.hasAttribute('data-hp')) return;
    seen[f.id] = true;
    var id = f.id === 'bkm' ? 'agendamento' : 'orcamento';
    try { if (window.gtag) gtag('event', 'form_start', { form_id: id }); } catch (er) {}
    try { if (window.fbq) fbq('trackCustom', 'FormStart', { form_id: id }); } catch (er) {}
  });
})();
/* Envio para o endpoint de leads (quando configurado) */
window.lpPost = function(data, keep){
  var body = {}, k, camp = {};
  try { camp = JSON.parse(sessionStorage.getItem('stb_camp') || '{}'); } catch (e) {}
  for (k in CONFIG.leadExtra) body[k] = CONFIG.leadExtra[k];
  body.origem = location.href; body.campanha = camp; body._honey = '';
  for (k in data) body[k] = data[k];
  if (/formsubmit\.co/.test(CONFIG.leadEndpoint)) body = lpFormsubmit(body);
  return fetch(CONFIG.leadEndpoint, { method: 'POST', keepalive: !!keep, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json().catch(function(){ return {}; }); })
    .then(function(j){ if (/formsubmit\.co/.test(CONFIG.leadEndpoint) && String(j.success) !== 'true') throw new Error('destino'); return j; });
};
/* Formato do e-mail do FormSubmit: tabela com rótulos, LGPD, datas ISO 8601 e campanha */
function lpFormsubmit(b){
  var R = { nome: 'Nome', whatsapp: 'WhatsApp', empresa: 'Empresa', necessidade: 'Necessidade', email: 'E-mail', data: 'Data', horario: 'Horário', doc: 'CPF/CNPJ', motivo: 'Motivo', solicitacao: 'Solicitação' };
  var m = { _subject: 'SitePro Brasil — ' + b.tipo + ' — ' + (b.nome || ''), _template: 'table', _captcha: 'false', _honey: b._honey || '', Tipo: b.tipo }, k;
  for (k in R) if (b[k]) m[R[k]] = b[k];
  if (b.lgpd === true) { m['Consentimento LGPD (lgpd)'] = 'true'; m['Consentimento em (consentAt)'] = b.consentAt || new Date().toISOString(); }
  m['Enviado em (ISO 8601)'] = new Date().toISOString();
  m['Página de origem'] = b.origem || location.href;
  for (k in (b.campanha || {})) m[k] = b.campanha[k];
  if (b.email && lpSec.email(b.email)) m._replyto = b.email;
  return m;
}

/* Formulário de orçamento: único caminho comercial até o WhatsApp */
(function(){
  var fm = document.getElementById('lf-form'); if (!fm) return;
  var ok = document.getElementById('lf-ok'), fail = document.getElementById('lf-fail'), btn = fm.querySelector('.lf-send');
  var FIELDS = ['nome', 'whats', 'empresa', 'necessidade', 'email', 'lgpd'], touched = {}, sent = false, waUrl = '';
  function el(n){ return fm.elements[n]; }
  function digits(v){ return String(v || '').replace(/\D/g, ''); }
  function val(n){ return n === 'lgpd' ? el(n).checked : lpSec.clean(el(n).value, n === 'email' ? 120 : 100); }
  function msgFor(n){
    var v = val(n);
    if (n === 'nome' && v.length < 2) return 'Informe seu nome';
    if (n === 'empresa' && v.length < 2) return 'Informe o nome da empresa';
    if (n === 'whats' && (digits(v).length < 10 || digits(v).length > 11)) return 'Informe um WhatsApp válido com DDD';
    if (n === 'necessidade' && !v) return 'Escolha uma opção';
    if (n === 'email' && v && !lpSec.email(v)) return 'Confira o e-mail ou deixe em branco';
    if (n === 'lgpd' && !v) return 'Marque para autorizar o contato';
    return '';
  }
  function check(n){
    var m = msgFor(n), e = document.getElementById('lf-e-' + n);
    e.textContent = m; e.hidden = !m; el(n).setAttribute('aria-invalid', m ? 'true' : 'false');
    return !m;
  }
  /* máscara do telefone */
  el('whats').addEventListener('input', function(){
    var v = digits(this.value).slice(0, 11);
    this.value = v.length > 6 ? '(' + v.slice(0, 2) + ') ' + v.slice(2, v.length - 4) + '-' + v.slice(-4) : v.length > 2 ? '(' + v.slice(0, 2) + ') ' + v.slice(2) : v;
  });
  FIELDS.forEach(function(n){
    var f = el(n);
    f.addEventListener('blur', function(){ touched[n] = true; if (n !== 'lgpd') check(n); });
    f.addEventListener(n === 'lgpd' || n === 'necessidade' ? 'change' : 'input', function(){ if (touched[n] || f.getAttribute('aria-invalid') === 'true') check(n); });
  });
  function busy(on){ btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); btn.querySelector('.lf-t').textContent = on ? 'Enviando…' : 'Enviar e falar com a equipe'; }
  function done(viaEndpoint){
    sent = true; busy(false);
    lpTrack('Lead', 'Formulário de orçamento', { value: 444, currency: 'BRL' });
    fm.hidden = true; ok.hidden = false;
    var link = document.getElementById('lf-ok-wa'), txt = document.getElementById('lf-ok-t');
    if (viaEndpoint) { link.hidden = true; txt.textContent = 'Obrigado! Nossa equipe vai chamar você no WhatsApp informado, de segunda a sexta, das 10h às 20h'; }
    else link.href = waUrl;
    ok.focus();
  }
  fm.addEventListener('submit', function(e){
    e.preventDefault();
    if (sent || btn.disabled) return;
    fail.hidden = true;
    var bad = FIELDS.filter(function(n){ touched[n] = true; return !check(n); });
    if (bad.length) { el(bad[0]).focus(); return; }
    var hp = fm.querySelector('[data-hp]');
    if (hp && hp.value) { sent = true; fm.hidden = true; ok.hidden = false; document.getElementById('lf-ok-wa').hidden = true; return; } /* robô: finge sucesso, sem envio */
    var d = { nome: val('nome'), whats: el('whats').value.trim(), empresa: val('empresa'), necessidade: val('necessidade'), email: val('email') };
    var msg = 'Olá! Preenchi o formulário no site da SitePro Brasil e quero atendimento.\n\n' +
      'Nome: ' + d.nome + '\nEmpresa: ' + d.empresa + '\nWhatsApp: ' + d.whats + '\nNecessidade: ' + d.necessidade + (d.email ? '\nE-mail: ' + d.email : '');
    waUrl = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg);
    busy(true);
    if (!CONFIG.leadEndpoint) {
      var w = window.open(waUrl, '_blank'); try { if (w) w.opener = null; } catch (er) {}
      setTimeout(function(){ done(false); }, 250);
      return;
    }
    lpPost({ tipo: 'Orçamento', nome: d.nome, whatsapp: d.whats, empresa: d.empresa, necessidade: d.necessidade, email: d.email, lgpd: true, consentAt: new Date().toISOString() })
      .then(function(){ done(true); })
      .catch(function(){ busy(false); document.getElementById('lf-fail-wa').href = waUrl; fail.hidden = false; });
  });
  /* CTAs que apontam para o formulário: rolam até ele e posicionam o cursor no primeiro campo */
  window.lpGoForm = function(){
    var sec = document.getElementById('orcamento'); if (!sec) return;
    $$m('details.mnav[open]').forEach(function(x){ x.open = false; });
    window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    setTimeout(function(){ try { (sent ? ok : el('nome')).focus({ preventScroll: true }); } catch (er) {} }, 650);
  };
  function $$m(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href="#orcamento"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault(); e.stopPropagation(); lpGoForm();
    if (a.getAttribute('data-event') === 'InitiateCheckout') lpTrack('InitiateCheckout', (a.textContent || '').trim().slice(0, 60), { value: 444, currency: 'BRL' });
  }, true);
})();

window.__lpMain=function(){
(function(){
  /* CONFIG fica no topo do arquivo */

  /* Campanha: guarda UTMs/fbclid/gclid da URL e repassa para o checkout e a agenda */
  var TRACK_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'];
  var camp = {};
  try { camp = JSON.parse(sessionStorage.getItem('stb_camp') || '{}'); } catch (err) {}
  var qs = new URLSearchParams(location.search), got = false;
  TRACK_KEYS.forEach(function(k){ var v = qs.get(k); if (v) { camp[k] = v; got = true; } });
  if (got) { try { sessionStorage.setItem('stb_camp', JSON.stringify(camp)); } catch (err) {} }
  function withCamp(url){
    if (!url || url.charAt(0) === '#') return url;
    try { var u = new URL(url, location.href); Object.keys(camp).forEach(function(k){ if (!u.searchParams.has(k)) u.searchParams.set(k, camp[k]); }); return u.toString(); }
    catch (err) { return url; }
  }
  if (CONFIG.checkoutUrl) CONFIG.checkoutUrl = withCamp(CONFIG.checkoutUrl);
  if (CONFIG.agendaUrl) CONFIG.agendaUrl = withCamp(CONFIG.agendaUrl);

  /* Pixel da Meta e Google Tag: só carregam se o ID estiver preenchido */
  if (TRACK_IDS.pixel) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', TRACK_IDS.pixel); fbq('track', 'PageView');
  }
  if (TRACK_IDS.gtag) {
    var gs = document.createElement('script'); gs.async = true; gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TRACK_IDS.gtag); document.head.appendChild(gs);
    window.dataLayer = window.dataLayer || []; window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', TRACK_IDS.gtag);
  }
  if (window.fbq) fbq('track', 'ViewContent', { content_name: 'Site profissional · plano anual', value: 444, currency: 'BRL' });
  if (window.gtag) gtag('event', 'view_item', { currency: 'BRL', value: 444, items: [{ item_id: 'plano-anual', item_name: 'Site profissional · plano anual', price: 444 }] });
  /* Cliques com data-event (cada elemento dispara um único evento) */
  document.addEventListener('click', function(ev){
    var el = ev.target.closest && ev.target.closest('[data-event]'); if (!el) return;
    var name = el.getAttribute('data-event'), label = (el.textContent || '').trim().slice(0, 60);
    if (name === 'Lead') return; /* Lead só no envio bem-sucedido do formulário */
    lpTrack(name, label, name === 'InitiateCheckout' ? { value: 444, currency: 'BRL' } : undefined);
  });

  /* Desempenho: pausa animações pesadas quando estão fora da tela */
  if ('IntersectionObserver' in window) {
    var offIO = new IntersectionObserver(function(es){ es.forEach(function(e){ e.target.classList.toggle('is-off', !e.isIntersecting); }); }, { rootMargin: '120px 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.hero-3d, .mk3d, .offer-sec, .sec.dark-sec, .fab, .bonus-posts'), function(el){ offIO.observe(el); });
  }
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  if (CONFIG.checkoutUrl) $$('[data-link="checkout"]').forEach(function(a){ a.href = CONFIG.checkoutUrl; });
  if (CONFIG.agendaUrl) $$('[data-link="agenda"]').forEach(function(a){ a.href = CONFIG.agendaUrl; a.target = '_blank'; });
  /* Sem link de agenda: o botão abre a mesma janela do WhatsApp do botão flutuante */
  else $$('[data-link="agenda"]').forEach(function(a){
    a.removeAttribute('data-wa'); a.setAttribute('data-bk', 'open'); a.removeAttribute('target');
    a.addEventListener('click', function(e){ e.preventDefault(); });
  });

  /* Agendamento: dados -> data/horário -> confirma no WhatsApp (e envia cópia por e-mail) */
  (function(){
    var m = document.getElementById('bkm'); if (!m) return;
    var st = 1, d = {}, sel = null, hora = '', view = new Date(); view.setDate(1);
    var HORAS = ['09:00','10:00','11:00','14:00','15:00','16:00','17:00'];
    var MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    var SEM = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var lim = new Date(hoje); lim.setDate(lim.getDate() + 45);
    function g(k){ return String(d[k] || '').trim(); }
    function okDados(){ return g('nome').length > 1 && g('empresa').length > 1 && g('whats').replace(/\D/g,'').length >= 10 && (!g('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email'))); }
    function fmt(x){ return SEM[x.getDay()] + ', ' + x.getDate() + ' de ' + MES[x.getMonth()]; }
    function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function btns(){
      $('.bkm-pane[data-pane="1"] .bkm-go', m).disabled = !okDados();
      $('.bkm-pane[data-pane="2"] .bkm-go', m).disabled = !(sel && hora);
    }
    function go(n){
      st = n;
      $$('.bkm-pane', m).forEach(function(p){ p.hidden = +p.getAttribute('data-pane') !== n; });
      $$('.bkm-steps li', m).forEach(function(l){ var s = +l.getAttribute('data-st'); l.className = s === n ? 'on' : (s < n ? 'ok' : ''); });
      if (n === 2) cal();
      if (n === 3) resumo();
      btns();
    }
    function cal(){
      var y = view.getFullYear(), mo = view.getMonth();
      $('#bkm-mes').textContent = MES[mo] + ' ' + y;
      $('[data-bk="prev"]', m).disabled = y === hoje.getFullYear() && mo === hoje.getMonth();
      $('[data-bk="nextm"]', m).disabled = new Date(y, mo + 1, 1) > lim;
      var first = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate(), h = '';
      for (var i = 0; i < first; i++) h += '<i></i>';
      for (var dd = 1; dd <= n; dd++) {
        var x = new Date(y, mo, dd), wd = x.getDay(), on = x > hoje && x <= lim && wd > 0 && wd < 6;
        var s = sel && x.getTime() === sel.getTime();
        h += on ? '<button type="button" data-day="' + dd + '"' + (s ? ' class="sel" aria-pressed="true"' : '') + ' aria-label="' + fmt(x) + '">' + dd + '</button>' : '<i>' + dd + '</i>';
      }
      $('#bkm-days').innerHTML = h;
      horas();
    }
    function horas(){
      var b = $('#bkm-times');
      if (!sel) { b.innerHTML = '<em>Escolha uma data no calendário</em>'; $('#bkm-dsel').textContent = ''; btns(); return; }
      $('#bkm-dsel').textContent = '· ' + fmt(sel);
      b.innerHTML = HORAS.map(function(t){ return '<button type="button" data-hr="' + t + '"' + (t === hora ? ' class="sel"' : '') + '>' + t + '</button>'; }).join('');
      btns();
    }
    function msg(){
      return 'Olá! Vim pelo site da SitePro Brasil e quero agendar uma reunião gratuita (até 30 min).\n\n' +
        'Nome: ' + g('nome') + '\nEmpresa: ' + g('empresa') + '\nWhatsApp: ' + g('whats') + (g('email') ? '\nE-mail: ' + g('email') : '') +
        '\n\nData desejada: ' + fmt(sel) + '\nHorário: ' + hora + '\n\nPodem confirmar?';
    }
    function resumo(){
      var rows = [['Nome', g('nome')], ['Empresa', g('empresa')], ['WhatsApp', g('whats')]];
      if (g('email')) rows.push(['E-mail', g('email')]);
      $('#bkm-sum').innerHTML = rows.map(function(r){ return '<div><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') +
        '<div class="hi"><span>Data</span><b>' + fmt(sel) + '</b></div><div class="hi"><span>Horário</span><b>' + hora + ' · online</b></div>';
      $('#bkm-send').href = 'https://wa.me/' + String(CONFIG.whatsapp).replace(/\D/g,'') + '?text=' + encodeURIComponent(msg());
    }
    function open(){ m.hidden = false; document.documentElement.classList.add('bkm-open'); go(1); var f = $('[data-bkk="nome"]', m); if (f) setTimeout(function(){ f.focus(); }, 50); }
    function close(){ m.hidden = true; document.documentElement.classList.remove('bkm-open'); }
    $$('[data-bkk]', m).forEach(function(el){ el.addEventListener('input', function(){
      if (el.getAttribute('data-bkk') === 'whats') { var v = el.value.replace(/\D/g,'').slice(0,11); el.value = v.length > 6 ? '(' + v.slice(0,2) + ') ' + v.slice(2, v.length - 4) + '-' + v.slice(-4) : v.length > 2 ? '(' + v.slice(0,2) + ') ' + v.slice(2) : v; }
      d[el.getAttribute('data-bkk')] = el.value; btns();
    }); });
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-bk],[data-day],[data-hr]'); if (!b) return;
      if (b.hasAttribute('data-day')) { sel = new Date(view.getFullYear(), view.getMonth(), +b.getAttribute('data-day')); hora = ''; cal(); return; }
      if (b.hasAttribute('data-hr')) { hora = b.getAttribute('data-hr'); horas(); return; }
      var a = b.getAttribute('data-bk');
      if (a === 'open') { e.preventDefault(); open(); }
      else if (a === 'close') close();
      else if (a === 'next') { if (!b.disabled) go(st + 1); }
      else if (a === 'back') go(st - 1);
      else if (a === 'prev') { view.setMonth(view.getMonth() - 1); cal(); }
      else if (a === 'nextm') { view.setMonth(view.getMonth() + 1); cal(); }
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !m.hidden) close(); });
    $('#bkm-send').addEventListener('click', function(){
      if (!okDados() || !sel || !hora || !lpSec.allow('Agendamento', m)) { setTimeout(close, 400); return; }
      var c = function(k){ return lpSec.clean(g(k), 120); };
      if (CONFIG.leadEndpoint) lpPost({ tipo: 'Agendamento', nome: c('nome'), empresa: c('empresa'), whatsapp: c('whats'), email: c('email'), data: fmt(sel), horario: hora }, true).catch(function(){});
      setTimeout(close, 400);
    });
  })();

  /* Filtro do portfólio: 3 modelos de início, "Ver todos" libera o resto */
  var pfOpen = false, pfMore = $('#pf-more');
  function pfApply(g){
    $$('.pf-grid article').forEach(function(a, i){
      var all = g === 'todos', show = all ? (pfOpen || i < 3) : a.getAttribute('data-grp') === g;
      a.hidden = !show;
      a.className = 'pf ' + (all && pfOpen ? a.getAttribute('data-size') : 'sm');
    });
    if (pfMore) pfMore.parentNode.hidden = g !== 'todos' || pfOpen;
  }
  $$('.chip[data-grp]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var g = btn.getAttribute('data-grp');
      $$('.chip[data-grp]').forEach(function(b){ var on = b === btn; b.className = on ? 'chip on' : 'chip'; b.setAttribute('aria-pressed', on); });
      pfApply(g);
    });
  });
  if (pfMore) pfMore.addEventListener('click', function(){
    pfOpen = true; pfMore.setAttribute('aria-expanded', 'true'); pfApply('todos');
    var n4 = $$('.pf-grid article')[3]; if (n4) { var l = n4.querySelector('a'); if (l) l.focus({ preventScroll: true }); }
  });
  pfApply('todos');

  /* Prévias: em telas touch, anima só os cards visíveis */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ e.target.classList.toggle('inview', e.isIntersecting); }); }, { threshold: 0.35 });
    $$('.pf-grid article').forEach(function(a){ io.observe(a); });
  }

  /* Mockup 3D "Seu site": troca de modelo e inclinação pelo mouse */
  $$('.mk3d').forEach(function(mk){
    var groups = [$$('.mk-scr img', mk), $$('.mk-pscr img', mk)], n = 0;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) setInterval(function(){
      n = (n + 1) % groups[0].length;
      groups.forEach(function(g){ g.forEach(function(img, k){ img.classList.toggle('on', k === n % g.length); }); });
    }, 7000);
    mk.addEventListener('pointermove', function(e){
      if (e.pointerType !== 'mouse') return;
      var r = mk.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      mk.style.setProperty('--ry', (-22 + x * 26).toFixed(1) + 'deg');
      mk.style.setProperty('--rx', (14 - y * 16).toFixed(1) + 'deg');
    });
    mk.addEventListener('pointerleave', function(){ mk.style.removeProperty('--ry'); mk.style.removeProperty('--rx'); });
  });

  /* Entrada suave de todos os elementos ao rolar, em cascata */
  (function(){
    if ((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || !('IntersectionObserver' in window)) return;
    var SEL = '.eyebrow,.h-sec,.h3,p,.card,.pf,.pf-filters,.pf-stat,.chk,.btn,.faq,.pill,.mk3d,.steps>li:not(.line),.g-foot>div,.pf-head>div';
    var all = [];
    $$('.lp>.sec:not(#topo),.lp>footer').forEach(function(s){ all = all.concat($$(SEL, s)); });
    var set = new Set(all);
    var els = all.filter(function(e){
      if (e.classList.contains('chk')) return true;
      for (var p = e.parentElement; p && !p.classList.contains('lp'); p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
    els.forEach(function(e){
      var i = 0, s = e.previousElementSibling;
      while (s) { if (set.has(s)) i++; s = s.previousElementSibling; }
      e.style.setProperty('--d', Math.min(i * 80, 480) + 'ms');
      e.classList.add('anim');
    });
    var done = function(e){ e.classList.remove('anim', 'in'); e.style.removeProperty('--d'); };
    var io = new IntersectionObserver(function(es){
      es.forEach(function(en){
        if (!en.isIntersecting) return;
        var e = en.target; io.unobserve(e);
        e.classList.add('in');
        setTimeout(function(){ done(e); }, 1100 + parseInt(e.style.getPropertyValue('--d') || 0, 10));
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function(e){ io.observe(e); });
  })();

  /* Cursor neon com etiqueta "Você" + 3 mensagens suaves + convite opcional para ver a oferta */
  (function(){
    var tag = document.querySelector('.neo-tag'), txt = tag && tag.querySelector('.neo-txt');
    var toast = document.querySelector('.neo-toast'), ttxt = toast && toast.querySelector('.neo-txt');
    var inv = document.querySelector('.neo-invite');
    var offer = document.getElementById('investimento');
    if (!tag || !offer) return;
    var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    var root = document.documentElement;
    if (fine) root.classList.add('neo-on');

    /* etiqueta embaixo do ponteiro (vira de lado perto das bordas) */
    var mx = -100, my = -100, raf = 0;
    function place(){
      raf = 0;
      var w = tag.offsetWidth, h = tag.offsetHeight, vw = root.clientWidth, vh = window.innerHeight;
      var x = mx + 16, y = my + 24;
      if (x + w > vw - 8) x = Math.max(8, mx - w - 6);
      if (y + h > vh - 8) y = my - h - 10;
      tag.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }
    var DEFAULT = 'Você', cur = DEFAULT, msgTimer = 0;
    function setText(s, isMsg){
      if (s === cur) return; cur = s;
      tag.classList.add('swap');
      setTimeout(function(){ txt.textContent = s; tag.classList.toggle('msg', !!isMsg); tag.classList.remove('swap'); place(); }, 160);
    }
    function say(s, ms){
      clearTimeout(msgTimer);
      if (fine) {
        setText(s, true);
        msgTimer = setTimeout(function(){ setText(DEFAULT, false); }, ms);
      } else if (toast) {
        ttxt.textContent = s; toast.classList.add('show');
        msgTimer = setTimeout(function(){ toast.classList.remove('show'); }, ms);
      }
    }
    if (fine) {
      document.addEventListener('mousemove', function(e){ mx = e.clientX; my = e.clientY; tag.classList.toggle('off', !!(e.target.closest && e.target.closest('a,button,[role=button],input,textarea,select,label'))); if (!raf) raf = requestAnimationFrame(place); }, { passive: true });
      document.addEventListener('mouseleave', function(){ tag.classList.add('off'); });
      document.addEventListener('mouseout', function(e){ if (!e.relatedTarget) tag.classList.add('off'); });
    }

    /* só 3 mensagens, uma vez cada, com folga entre elas */
    var MSG = [
      ['#modelos', 'Imagine sua empresa num desses'],
      ['#investimento', 'Tudo isso por R$ 37/mês'],
      ['#reuniao', 'Prefere conversar antes? Sem compromisso']
    ];
    var lastMsg = 0;
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function(es){
        es.forEach(function(e){
          if (!e.isIntersecting || e.target.__said || Date.now() - lastMsg < 12000) return;
          e.target.__said = true; lastMsg = Date.now();
          say(e.target.__msg, 3500);
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      MSG.forEach(function(m){ var el = document.querySelector(m[0]); if (el) { el.__msg = m[1]; mio.observe(el); } });
    }

    /* convite: só aparece se a pessoa ficar ~12s sem rolar, uma vez por visita; a página só desce se ela clicar */
    if (!inv) return;
    var IDLE = 12000, idleT = 0, shown = false, used = false, y0 = 0;
    function beforeOffer(){ return offer.getBoundingClientRect().top > window.innerHeight * 0.6; }
    function hideInv(){ inv.classList.remove('show'); inv.setAttribute('tabindex', '-1'); }
    function showInv(){
      if (used || shown || !beforeOffer() || document.hidden) return;
      if (document.querySelector('#wa:not([hidden]), details.mnav[open]')) { arm(); return; }
      shown = true; y0 = window.scrollY; inv.classList.add('show'); inv.removeAttribute('tabindex');
      if (toast) toast.classList.remove('show');
    }
    function arm(){ clearTimeout(idleT); if (!shown && !used) idleT = setTimeout(showInv, IDLE); }
    window.addEventListener('scroll', function(){
      if (shown && Math.abs(window.scrollY - y0) > 160) { hideInv(); used = true; }
      if (!beforeOffer()) { used = true; clearTimeout(idleT); }
      arm();
    }, { passive: true });
    ['keydown', 'touchstart'].forEach(function(ev){ window.addEventListener(ev, arm, { passive: true }); });
    inv.querySelector('.neo-go').addEventListener('click', function(){
      hideInv(); used = true;
      var y = offer.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
    inv.querySelector('.neo-x').addEventListener('click', function(){ hideInv(); used = true; });
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) arm(); });
    arm();
  })();

  /* Demonstração dos modelos em janela suspensa */
  (function(){
    var dm = document.getElementById('dm'), fr = document.getElementById('dm-fr'), last = null;
    if (!dm) return;
    function open(href){
      last = document.activeElement;
      fr.src = href + (href.indexOf('?') > -1 ? '&' : '?') + 'embed=1';
      dm.hidden = false; document.documentElement.classList.add('dm-open');
      dm.querySelector('.dm-x').focus();
    }
    function close(){
      dm.hidden = true; document.documentElement.classList.remove('dm-open');
      fr.src = 'about:blank';
      if (last && last.focus) last.focus();
    }
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="demo.html"]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault(); open(a.getAttribute('href'));
    });
    [].forEach.call(dm.querySelectorAll('[data-close]'), function(b){ b.addEventListener('click', close); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !dm.hidden) close(); });
    window.addEventListener('message', function(e){
      if (e.origin !== location.origin) return;
      if (e.data === 'demo:close') close();
      if (e.data === 'demo:offer') { close(); if (window.cvFull) { cvFull(); void document.documentElement.offsetHeight; } if (window.lpGoForm) lpGoForm(); }
    });
  })();

  /* Animação do processo de agendamento */
  (function(){
    var root = document.querySelector('.bk'); if (!root) return;
    var scr = root.querySelector('.bk-scr'), cur = root.querySelector('.bk-cur');
    var S = root.querySelectorAll('.bk-s'), bars = root.querySelectorAll('.bk-prog i');
    var lis = document.querySelectorAll('.bk-list .bk-li'), list = document.querySelector('.bk-list');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = [4600, 6200, 3600, 4200], step = -1, timers = [], running = false;
    function later(fn, ms){ timers.push(setTimeout(fn, ms)); }
    function clear(){ timers.forEach(clearTimeout); timers = []; }
    function moveTo(el, cb){
      if (reduce) { if (cb) cb(); return; }
      var r = el.getBoundingClientRect(), b = scr.getBoundingClientRect();
      cur.classList.add('show');
      cur.style.transform = 'translate(' + (r.left - b.left + r.width / 2 - 4) + 'px,' + (r.top - b.top + r.height / 2 - 3) + 'px)';
      later(function(){ cur.classList.remove('tap'); void cur.offsetWidth; cur.classList.add('tap'); if (cb) cb(); }, 850);
    }
    function type(f, txt, done){
      var sp = f.querySelector('span'), k = 0; f.classList.add('typing');
      (function tick(){ sp.textContent = txt.slice(0, ++k); if (k < txt.length) later(tick, reduce ? 0 : 28); else { f.classList.remove('typing'); later(done, 120); } })();
    }
    function show(n){
      clear(); step = n;
      [].forEach.call(S, function(s, k){ s.classList.remove('p1', 'p2'); s.classList.toggle('on', k === n); s.classList.toggle('out', k === (n + 3) % 4 && k !== n); });
      [].forEach.call(bars, function(b, k){ b.classList.remove('on'); b.classList.toggle('done', k < n); });
      var bar = bars[n]; bar.style.setProperty('--bkd', DUR[n] + 'ms'); void bar.offsetWidth; bar.classList.add('on');
      if (list) list.classList.add('bk-live');
      [].forEach.call(lis, function(li, k){ li.classList.toggle('on', k === n); });
      var s = S[n];
      if (n === 0) {
        cur.style.transition = 'none'; cur.style.transform = 'translate(70%,240px)'; void cur.offsetWidth; cur.style.transition = '';
        later(function(){ moveTo(s.querySelector('.bk-d.pick'), function(){ s.classList.add('p1');
          later(function(){ moveTo(s.querySelector('.bk-times .pick'), function(){ s.classList.add('p2'); }); }, 500); }); }, 450);
      } else if (n === 1) {
        var fs = s.querySelectorAll('.bk-f'); [].forEach.call(fs, function(f){ f.querySelector('span').textContent = ''; });
        cur.classList.remove('show');
        var i = 0;
        (function next(){ if (i < fs.length) { var f = fs[i++]; type(f, f.querySelector('span').getAttribute('data-type'), next); }
          else later(function(){ moveTo(s.querySelector('.bk-btn'), function(){ s.classList.add('p1'); }); }, 150); })();
      } else { cur.classList.remove('show'); }
      later(function(){ if (running) show((n + 1) % 4); }, DUR[n]);
    }
    function start(){ if (running) return; running = true; show(step < 0 ? 0 : step); }
    function stop(){ running = false; clear(); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){ es.forEach(function(e){ e.isIntersecting ? start() : stop(); }); }, { threshold: .25 }).observe(root);
    } else start();
    document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(); });
  })();

  /* Depoimentos em vídeo: o player do YouTube só carrega no clique */
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.dp-vid[data-yt]'); if (!b || b.querySelector('iframe')) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.getAttribute('data-yt') + '?autoplay=1&rel=0&playsinline=1';
    f.title = b.getAttribute('aria-label');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    b.appendChild(f);
    if (window.fbq) fbq('trackCustom', 'VideoDepoimento');
    if (window.gtag) gtag('event', 'video_start', { video_title: f.title });
  });

  /* Textos legais em janela suspensa */
  (function(){
    var m = document.getElementById('lgm'); if (!m) return;
    var last = null;
    function show(k){
      [].forEach.call(m.querySelectorAll('[data-doc]'), function(d){ d.hidden = d.getAttribute('data-doc') !== k; });
      [].forEach.call(m.querySelectorAll('.lgm-tabs [data-legal]'), function(b){ var on = b.getAttribute('data-legal') === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      m.querySelector('.lgm-body').scrollTop = 0;
    }
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-legal]');
      if (b) {
        e.preventDefault();
        if (m.hidden) { last = b; m.hidden = false; document.documentElement.classList.add('lgm-open'); m.querySelector('.lgm-x').focus(); }
        show(b.getAttribute('data-legal')); return;
      }
      if (e.target.closest && e.target.closest('[data-lgm-close]')) close();
    });
    function close(){ m.hidden = true; document.documentElement.classList.remove('lgm-open'); if (last && last.focus) last.focus(); }
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !m.hidden) close(); });
  })();

  /* Como funciona: liga o destaque em loop só com a seção visível */
  (function(){
    var st=document.querySelector('.cf-steps'); if(!st || !('IntersectionObserver' in window)) return;
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var t; new IntersectionObserver(function(es){ clearTimeout(t);
      if(es[0].isIntersecting) t=setTimeout(function(){ st.classList.add('cf-on'); },900); else st.classList.remove('cf-on');
    },{threshold:.2}).observe(st);
  })();

  /* Carrossel de avaliações */
  (function(){
    var tr=document.querySelector('.tc-track'); if(!tr) return;
    var cs=tr.children, dots=document.querySelector('.tc-dots'), pv=document.querySelector('.tc-prev'), nx=document.querySelector('.tc-next');
    function per(){ return Math.max(1, Math.round(tr.clientWidth / cs[0].offsetWidth)); }
    function pages(){ return cs.length - per() + 1; }
    function idx(){ return Math.round(tr.scrollLeft / (cs[1].offsetLeft - cs[0].offsetLeft)); }
    function draw(){ var n=pages(), i=Math.min(idx(), n-1); if(dots.children.length!==n){ dots.innerHTML=new Array(n+1).join('<i></i>'); }
      for(var j=0;j<n;j++) dots.children[j].className = j===i?'on':''; pv.disabled = i<=0; nx.disabled = i>=n-1;
      var p=per(); for(var k=0;k<cs.length;k++) cs[k].classList.toggle('in', k>=i && k<i+p); }
    function go(d){ var s=cs[1].offsetLeft - cs[0].offsetLeft; tr.scrollBy({left:d*s}); }
    pv.addEventListener('click',function(){go(-1)}); nx.addEventListener('click',function(){go(1)});
    tr.addEventListener('scroll',function(){ requestAnimationFrame(draw); },{passive:true});
    window.addEventListener('resize',function(){ if(tr.dataset.on) draw(); });
    if('IntersectionObserver' in window){ var io=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ io.disconnect(); tr.dataset.on=1; draw(); } },{rootMargin:'300px'}); io.observe(tr); } else { tr.dataset.on=1; draw(); }

    /* Autoplay: a barra do ponto ativo é o cronômetro; ao terminar, avança (volta ao início no fim) */
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var wrap=tr.parentNode, st={hover:0,focus:0,touch:0,off:1}, tt;
    function hold(){ dots.classList.toggle('hold', !!(st.hover||st.focus||st.touch||st.off)); }
    tr.classList.add('fx'); dots.classList.add('auto'); hold();
    dots.addEventListener('animationend',function(){ if(idx()>=pages()-1) tr.scrollTo({left:0}); else go(1); });
    wrap.addEventListener('pointerenter',function(e){ if(e.pointerType==='mouse'){ st.hover=1; hold(); } });
    wrap.addEventListener('pointerleave',function(e){ if(e.pointerType==='mouse'){ st.hover=0; hold(); } });
    wrap.addEventListener('focusin',function(e){ var fv=true; try{ fv=e.target.matches(':focus-visible'); }catch(x){} if(fv){ st.focus=1; hold(); } });
    wrap.addEventListener('focusout',function(){ st.focus=0; hold(); });
    tr.addEventListener('touchstart',function(){ clearTimeout(tt); st.touch=1; hold(); },{passive:true});
    tr.addEventListener('touchend',function(){ clearTimeout(tt); tt=setTimeout(function(){ st.touch=0; hold(); },2500); },{passive:true});
    if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ st.off=es[0].isIntersecting?0:1; hold(); },{threshold:.35}).observe(tr); } else { st.off=0; hold(); }
  })();

  /* Triagem WhatsApp */
  var wa = $('#wa'), f = {};
  function mode(m){
    $$('[data-pane]', wa).forEach(function(p){ p.hidden = p.getAttribute('data-pane') !== m; });
  }
  function ok(v){ return String(v || '').trim().length > 1; }
  function upd(){
    var num = String(CONFIG.whatsapp).replace(/\D/g, '');
    var g = function(k){ return String(f[k] || '').trim(); };
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email'));
    var clienteOk = ['nome','empresa','doc','desc'].every(function(k){ return ok(f[k]); }) && emailOk && !!f.motivo;
    $('[data-blk="clienteOk"]').hidden = !clienteOk; $('[data-blk="clientePend"]').hidden = clienteOk;
    var msgCliente = 'Olá! Já sou cliente da SitePro Brasil e preciso de atendimento.\n\n' +
      'Nome: ' + g('nome') + '\nEmpresa: ' + g('empresa') + '\nCPF/CNPJ: ' + g('doc') +
      '\nE-mail cadastrado: ' + g('email') + '\nAssunto: ' + (f.motivo || '') + '\nDescrição da solicitação: ' + g('desc');
    $('#wa-cliente').href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msgCliente);
  }
  $$('[data-k]', wa).forEach(function(el){
    var h = function(){
      var k = el.getAttribute('data-k'); f[k] = el.value;
      $$('[data-k="' + k + '"]', wa).forEach(function(o){ if (o !== el) o.value = el.value; });
      upd();
    };
    el.addEventListener('input', h); el.addEventListener('change', h);
  });
  document.addEventListener('click', function(e){
    /* Segurança do funil: qualquer link direto de WhatsApp fora dos fluxos com dados leva ao formulário */
    var l = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
    if (l && !l.closest('#wa, #bkm, #orcamento') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.button) {
      e.preventDefault();
      var lg = document.getElementById('lgm');
      if (lg && !lg.hidden) { lg.hidden = true; document.documentElement.classList.remove('lgm-open'); }
      lpGoForm(); return;
    }
    var b = e.target.closest && e.target.closest('[data-wa]'); if (!b) return;
    var a = b.getAttribute('data-wa');
    if (a === 'open') { wa.hidden = false; mode('modeNone'); }
    else if (a === 'close') wa.hidden = true;
    else if (a === 'novo') { wa.hidden = true; lpGoForm(); }
    else if (a === 'cliente-open') { wa.hidden = false; mode('modeCliente'); var lg2 = document.getElementById('lgm'); if (lg2 && !lg2.hidden) { lg2.hidden = true; document.documentElement.classList.remove('lgm-open'); } }
    else if (a === 'cliente') mode('modeCliente');
    else if (a === 'back') mode('modeNone');
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !wa.hidden) wa.hidden = true; });
  /* Registro do pedido de suporte (o WhatsApp abre normalmente pelo link) */
  $('#wa-cliente').addEventListener('click', function(){
    if (!CONFIG.leadEndpoint || !lpSec.allow('Suporte', wa)) return;
    var g = function(k){ return lpSec.clean(f[k], k === 'desc' ? 1000 : 120); };
    lpPost({ tipo: 'Suporte', nome: g('nome'), empresa: g('empresa'), doc: g('doc'), email: g('email'), motivo: g('motivo'), solicitacao: g('desc') }, true).catch(function(){});
  });
  upd();
})();

};

(function(){var done=false;
function ensure(){if(done)return;done=true;
var tb=document.getElementById('lp-below'),sl=document.getElementById('lp-slot');if(tb&&sl)sl.replaceWith(tb.content);
var tm=document.getElementById('lp-modals');if(tm)document.body.appendChild(tm.content);
if(window.__lpMain)window.__lpMain();}
window.lpEnsure=ensure;
if(location.hash.length>1)ensure();
['pointerdown','touchstart','keydown','wheel','scroll'].forEach(function(n){addEventListener(n,ensure,{once:true,passive:true,capture:true})});
addEventListener('load',function(){setTimeout(function(){(window.requestIdleCallback||setTimeout)(ensure,{timeout:1500})},3000)});
})();

/* Renderização sob demanda só no carregamento inicial; depois a página fica completa (âncoras precisas) */
(function(){var d=document.documentElement;
function full(){d.classList.add('cv-off')}
function go(id){var el=id&&document.getElementById(id);if(!el)return;void d.offsetHeight;el.scrollIntoView({behavior:'smooth',block:'start'});var k=0,t=setInterval(function(){var y=el.getBoundingClientRect().top,m=parseFloat(getComputedStyle(el).scrollMarginTop)||0;if(++k>12||(Math.abs(y-m)<3&&k>3)){clearInterval(t);if(Math.abs(y-m)>=3)el.scrollIntoView({behavior:'instant',block:'start'})}},150)}
if(location.hash.length>1){full();addEventListener('load',function(){go(location.hash.slice(1))})}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1),el=id&&document.getElementById(id);if(!el||d.classList.contains('cv-off'))return;full();void d.offsetHeight;var k=0,t=setInterval(function(){var y=el.getBoundingClientRect().top,m=parseFloat(getComputedStyle(el).scrollMarginTop)||0;if(++k>14){clearInterval(t);if(Math.abs(y-m)>=3)el.scrollIntoView({behavior:'instant',block:'start'})}},150)},true);
window.cvFull=full;})();
