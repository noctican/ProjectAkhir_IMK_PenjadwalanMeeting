(function ($) {
  'use strict';
  if (!$('#resp-badge').length) return;
  function paintResp() {
    var sent = $('#resp-badge').text().indexOf('Sudah') === 0;
    $('#btn-send').text(sent ? 'Perbarui respons' : 'Kirim respons');
  }
  $('[data-bulk]').on('click', function () {
    var v = $(this).data('bulk') === 'available' ? '1' : '0';
    $('.avail .slot').attr('data-state', v).attr('aria-pressed', v === '1' ? 'true' : 'false');
    TY.toast(v === '1' ? 'Semua slot ditandai bisa.' : 'Semua slot ditandai tidak bisa.', 'info');
  });
  $('#btn-suggest').on('click', function () {
    TY.toast('Usulan awal dari jadwal rutin diterapkan.', 'info');
  });
  $('#btn-send').on('click', function () {
    $('#resp-badge').text('Sudah dikirim').removeClass('pending').addClass('available');
    $('#resp-note').text('Responsmu sudah dikirim dan masih bisa diperbarui selama event terbuka.');
    paintResp();
    TY.toast('Respons ketersediaanmu tersimpan.');
  });
  $('#part-more').on('click', function () {
    var $x = $('.extra-part');
    var show = $x.first().prop('hidden');
    $x.prop('hidden', !show);
    $(this).text(show ? 'Tampilkan lebih sedikit' : 'Tampilkan semua (8)');
  });
  paintResp();
})(jQuery);
