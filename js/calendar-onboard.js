(function ($) {
  'use strict';
  function markCalConnected() {
    $('#cal-name').text('Kalender Kampus');
    $('#cal-meta').text('Terhubung · jadwal sibuk ikut dipertimbangkan.');
    $('#btn-connect, #btn-cal').text('Terhubung ✓').prop('disabled', false);
    TY.toast('Google Calendar terhubung.', 'info');
  }
  $('#btn-connect, #btn-cal').on('click', function () {
    var $b = $(this);
    $b.text('Menghubungkan…').prop('disabled', true);
    setTimeout(markCalConnected, 500);
  });
  $('#btn-lanjut, #btn-lewati').on('click', function () {
    window.location.href = 'dasbor.html';
  });
})(jQuery);
