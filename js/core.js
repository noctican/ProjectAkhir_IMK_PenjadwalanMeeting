window.TY = window.TY || {};
(function ($) {
  'use strict';
  TY.toast = function (msg, tone) {
    var $box = $('#toasts');
    if (!$box.length) return;
    var $t = $('<div class="toast' + (tone ? ' ' + tone : '') + '"><span></span></div>');
    $t.find('span').text(msg);
    $box.append($t);
    setTimeout(function () { $t.fadeOut(200, function () { $t.remove(); }); }, 2600);
  };
  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
  function paintThemeBtns() {
    var dark = currentTheme() === 'dark';
    $('[data-theme-btn]').each(function () {
      $(this).html('<i class="bi ' + (dark ? 'bi-sun' : 'bi-moon') + '" aria-hidden="true"></i>');
      $(this).attr('aria-label', dark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap');
      $(this).attr('title', dark ? 'Tema terang' : 'Tema gelap');
    });
  }
  function initTheme() {
    try {
      var saved = localStorage.getItem('temuyuk-theme');
      if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
    } catch (e) {  }
    paintThemeBtns();
  }
  $(document).on('click', '[data-theme-btn]', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('temuyuk-theme', next); } catch (e) {  }
    paintThemeBtns();
  });
  initTheme();
})(jQuery);
