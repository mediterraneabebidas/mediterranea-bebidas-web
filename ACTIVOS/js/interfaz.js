document.body.classList.remove('dark-theme');

function setThemeButtonLabel() {
  const btn = document.querySelector('.theme-toggle');
  if(!btn) return;
  const isDark = document.body.classList.contains('dark-theme');
  btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  setThemeButtonLabel();
}

function showTab(id, evt) {
  document.querySelectorAll('.catalog-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + id);
  if(panel) panel.classList.add('active');
  if(evt && evt.currentTarget) evt.currentTarget.classList.add('active');
}

function setupSiteCursor() {
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.documentElement.classList.add('custom-cursor-active');

  const cursor = document.createElement('div');
  cursor.className = 'site-cursor hidden';
  document.body.appendChild(cursor);

  let x = -80;
  let y = -80;
  let frame = null;

  function paint() {
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    frame = null;
  }

  function moveCursor(event) {
    x = event.clientX;
    y = event.clientY;
    cursor.classList.remove('hidden');
    if(!frame) frame = requestAnimationFrame(paint);
  }

  window.addEventListener('pointermove', moveCursor, { passive:true });
  window.addEventListener('mousemove', moveCursor, { passive:true });

  document.addEventListener('pointerover', (event) => {
    const hot = event.target.closest('a, button, [role="button"], .tab-btn, .wine-card, .bodega-card, .add-to-cart, .cart-toggle');
    cursor.classList.toggle('hover', Boolean(hot));
  }, true);

  document.addEventListener('mouseleave', () => {
    cursor.classList.add('hidden');
  });

  window.addEventListener('blur', () => {
    cursor.classList.add('hidden');
  });
}

setupSiteCursor();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

window.addEventListener('scroll', () => {
  const sections = ['inicio','nosotros','catalogo','bodegas','contacto'];
  const scrollY = window.scrollY;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const top = el.offsetTop - 100;
    const bottom = top + el.offsetHeight;
    if(scrollY >= top && scrollY < bottom) {
      document.querySelectorAll('.nav-links a').forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + id ? 'var(--accent)' : '';
      });
    }
  });
});

setThemeButtonLabel();
