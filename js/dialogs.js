(function ($) {
  'use strict';
  var pendingFinal = '';
  function openDlg(id) {
    var d = document.getElementById(id);
    if (d && d.showModal) d.showModal();
  }
  function closeDlg($d) {
    var d = $d.closest('dialog')[0];
    if (d) d.close();
  }
  $(document).on('click', '.slot.recap', function () {
    var parts = ($(this).data('slot') || '').split('|');
    var label = parts[0] || 'Slot', jam = parts[1] || '';
    var ok = parts[2] || '0', no = parts[3] || '0', wait = parts[4] || '0';
    if (!$('#slot-dialog').length) return;
    $('#slot-title').text(label + ', ' + jam);
    $('#slot-sub').text(jam + ' WIB · ' + ok + ' bisa, ' + no + ' tidak bisa, ' + wait + ' belum merespons.');
    $('#slot-ok').text(+ok ? 'Candra, Naufal, Bagas' : 'Belum ada peserta.');
    $('#slot-no').text(+no ? 'Salsabila, Raka' : 'Belum ada peserta.');
    $('#slot-wait').text(+wait ? 'Aulya, Fransiska, Pramudya, Dinda' : 'Semua sudah merespons.');
    pendingFinal = label + ' pukul ' + jam + ' WIB (' + ok + ' bisa hadir).';
    openDlg('slot-dialog');
  });
  $('#slot-close, [data-close]').on('click', function () { closeDlg($(this)); });
  $('#slot-final').on('click', function () {
    closeDlg($(this));
    $('#final-desc').text(pendingFinal + ' Tetapkan sebagai jadwal final?');
    openDlg('final-dialog');
  });
  $('#final-confirm').on('click', function () {
    closeDlg($(this));
    window.location.href = 'jadwal-final.html';
  });
  $('#btn-remind').on('click', function () {
    TY.toast('3 peserta diingatkan untuk merespons.', 'info');
  });
  $('#btn-cancel-open').on('click', function () { openDlg('cancel-dialog'); });
  $('#cancel-confirm').on('click', function () {
    closeDlg($(this));
    TY.toast('Event dibatalkan.', 'error');
  });
})(jQuery);
