(function(){
  var M = [{"id": "vellura", "url": "https://vellura-landing.vercel.app/", "name": "Vellura · Psicologia e Bem-estar", "seg": "Saúde e psicologia"}, {"id": "advocacia", "url": "https://lp-advogado-ivory.vercel.app/", "name": "Martins & Rocha · Advocacia", "seg": "Advocacia"}, {"id": "steepl", "url": "https://steepl-engenharia-lp.vercel.app/", "name": "Steepl Engenharia", "seg": "Engenharia industrial"}, {"id": "sushi", "url": "https://sushi-today-landing.vercel.app/", "name": "Sushi Today", "seg": "Restaurante japonês"}, {"id": "sonder", "url": "https://sonder-house-five.vercel.app/", "name": "Sonder House", "seg": "Imobiliário"}, {"id": "contabilidade", "url": "https://lp-contabilidade-mais.vercel.app/", "name": "Contabilidade Mais", "seg": "Contabilidade"}, {"id": "saborearte", "url": "https://sabor-e-arte-lp.vercel.app/", "name": "Sabor & Arte", "seg": "Restaurante"}, {"id": "dentora", "url": "https://dentora-landing-page-nu.vercel.app/", "name": "Dentora", "seg": "Odontologia"}, {"id": "nutrisavvy", "url": "https://lp-nutricionista-one.vercel.app/", "name": "NutriSavvy", "seg": "Nutrição"}, {"id": "crust", "url": "https://crust-pizza-lp.vercel.app/", "name": "Crust Pizza Co.", "seg": "Pizzaria"}];
  var WA = '5511943935206';
  var q = new URLSearchParams(location.search), i = 0;
  M.forEach(function(m, k){ if (m.id === q.get('m')) i = k; });
  var embed = q.get('embed') === '1' && window.parent !== window;
  if (embed) {
    document.documentElement.classList.add('embed');
    var tell = function(msg){ try { parent.postMessage(msg, location.origin); } catch (e) {} };
    document.getElementById('cls').onclick = function(){ tell('demo:close'); };
    document.getElementById('cta').addEventListener('click', function(e){ e.preventDefault(); tell('demo:offer'); });
    document.querySelector('.lg').addEventListener('click', function(e){ e.preventDefault(); tell('demo:close'); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') tell('demo:close'); });
  }
  var fr = document.getElementById('fr'), ld = document.getElementById('ld'), dev = document.getElementById('dev'), tip = document.getElementById('tip'), th = document.getElementById('th');
  if (window.matchMedia && matchMedia('(max-width: 680px)').matches) dev.className = 'dev mob';
  M.forEach(function(m, k){ var a = document.createElement('a'); a.href = '?m=' + m.id; a.textContent = m.name.split(' · ')[0]; a.addEventListener('click', function(e){ e.preventDefault(); go(k); }); th.appendChild(a); });
  var tipT = 0, loadT = 0, first = true;
  function go(k){
    i = (k + M.length) % M.length; var m = M[i];
    document.title = m.name + ' · Demonstração | SitePro Brasil';
    document.getElementById('nm').textContent = m.name;
    document.getElementById('sg').textContent = 'Ao vivo · ' + m.seg;
    document.getElementById('url').textContent = m.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    document.getElementById('ldn').textContent = m.name;
    document.getElementById('cnt').textContent = (i + 1) + ' / ' + M.length;
    document.getElementById('ext').href = m.url;
    document.getElementById('wa').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Olá! Vi o modelo ' + m.name + ' e quero um site assim para minha empresa.');
    [].forEach.call(th.children, function(a, k2){ a.classList.toggle('on', k2 === i); });
    var on = th.children[i]; if (on) th.scrollTo({ left: on.offsetLeft - th.clientWidth / 2 + on.clientWidth / 2, behavior: first ? 'auto' : 'smooth' });
    ld.classList.remove('hide');
    fr.src = m.url;
    clearTimeout(loadT); loadT = setTimeout(done, 7000);
    try { history.replaceState(null, '', '?m=' + m.id + (embed ? '&embed=1' : '')); } catch (e) {}
    first = false;
  }
  function done(){ clearTimeout(loadT); ld.classList.add('hide'); tip.classList.add('show'); clearTimeout(tipT); tipT = setTimeout(function(){ tip.classList.remove('show'); }, 3800); }
  fr.addEventListener('load', function(){ if (fr.getAttribute('src')) setTimeout(done, 250); });
  document.getElementById('prev').onclick = function(){ go(i - 1); };
  document.getElementById('next').onclick = function(){ go(i + 1); };
  document.addEventListener('keydown', function(e){ if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
  [].forEach.call(document.querySelectorAll('.seg button'), function(b){
    b.onclick = function(){ [].forEach.call(document.querySelectorAll('.seg button'), function(x){ x.classList.toggle('on', x === b); }); dev.className = 'dev ' + b.dataset.d; };
  });
  go(i);
})();
