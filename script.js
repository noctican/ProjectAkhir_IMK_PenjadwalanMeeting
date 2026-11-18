/* TemuYuk static */
(function ($) {
  'use strict';
  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'light' : 'light';
  }
  function paintThemeBtns() {
    var dark = currentTheme() === 'dark';
    $('[data-theme-btn]').each(function () {
      $(this).html('<i class="bi ' + (dark ? 'bi-sun' : 'bi-moon') + '" aria-hidden="true"></i>');
    });
  }
  function initTheme() { paintThemeBtns(); }
  $(document).on('click', '[data-theme-btn]', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    paintThemeBtns();
  });
  $('#auth-form').on('submit', function (e) {
    e.preventDefault();
    var email = $('#auth-email').val().trim();
    if (!/.+@.+\..+/.test(email)) {
      $('#auth-error').text('Masukkan email yang valid.').prop('hidden', false);
      return;
    }
    window.location.href = 'hubungkan-kalender.html';
  });
  $('#btn-google').on('click', function () {
    window.location.href = 'hubungkan-kalender.html';
  });
  initTheme();
})(jQuery);
