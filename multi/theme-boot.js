/* Applique le thème avant le premier rendu pour éviter le flash de couleur.
   Externalisé (et non inline) afin que la CSP puisse rester en script-src 'self'. */
(function () {
  var t = localStorage.getItem('pdfed.theme') || 'system';
  document.documentElement.dataset.theme = t;
  if (t === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.classList.add('sys-light');
  }
})();
