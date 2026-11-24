(function ($) {
  'use strict';
  if (!$('#btn-gcal').length && !$('#btn-share').length) return;
  $('#btn-gcal').on('click', function () {
    $(this).text('Sudah ditambahkan ✓').prop('disabled', true);
    $('#cal-state').text('Ditambahkan ke kalender');
    $('#cal-note').text('Sudah ditambahkan ke kalender.');
    TY.toast('Jadwal ditambahkan ke Google Calendar.');
  });
  $('#btn-share').on('click', function () {
    try { if (navigator.clipboard) navigator.clipboard.writeText(location.href); } catch (e) {  }
    $(this).text('Tautan disalin ✓');
    TY.toast('Tautan event disalin.', 'info');
  });
})(jQuery);
