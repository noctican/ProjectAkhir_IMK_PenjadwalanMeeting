(function ($) {
  'use strict';
  if (!$('#weekly-body').length) return;
  var weekly = null, weeklyUndo = null, weeklyDirty = false;
  function seedWeekly() {
    weekly = [];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 48; c++) {
      weekly.push(((r * 48 + c) % 3 === 2) ? 0 : 1);
    }
  }
  function paintWeeklyState() {
    var marked = weekly.filter(function (v) { return v === 1; }).length;
    $('#avail-count').text(marked);
    $('#weekly-note')
      .text(weeklyDirty ? 'Ada perubahan yang belum disimpan.' : 'Jadwal ini dipakai sebagai isian awal saat kamu merespons event.')
      .toggleClass('muted', !weeklyDirty);
    $('#weekly-save, #weekly-once').prop('disabled', !weeklyDirty);
    $('#weekly-undo').prop('hidden', !weeklyUndo);
  }
  function renderWeekly() {
    var $tb = $('#weekly-body').empty();
    if (!weekly) seedWeekly();
    TY.time.DAY_NAMES.forEach(function (name, r) {
      var $tr = $('<tr><td class="day">' + name + '</td></tr>');
      for (var c = 0; c < 48; c++) {
        (function (col) {
          var v = weekly[r * 48 + col];
          var $td = $('<td></td>');
          $td.append('<button type="button" class="slot" data-state="' + v + '" data-slot-key="w|' + (r * 48 + col) + '" aria-pressed="' + (v ? 'true' : 'false') + '" aria-label="' + name + ' ' + TY.time.mmToTime(col * 30) + ' — ' + (v ? 'tersedia' : 'tidak tersedia') + '"></button>');
          $tr.append($td);
        })(c);
      }
      $tb.append($tr);
    });
    TY.slot.bind($tb);
    paintWeeklyState();
  }
  function touchWeekly() {
    if (!weeklyUndo) weeklyUndo = weekly.slice();
    weeklyDirty = true;
    paintWeeklyState();
  }
  $(document).on('slotpaint', '#weekly-body', function () {
    var next = weekly.slice();
    $('#weekly-body [data-slot-key]').each(function () {
      next[+$(this).data('slot-key').split('|')[1]] = $(this).attr('data-state') === '1' ? 1 : 0;
    });
    weekly = next;
    touchWeekly();
  });
  $('#weekly-all').on('click', function () { weeklyUndo = weekly.slice(); weekly = weekly.map(function () { return 1; }); weeklyDirty = true; renderWeekly(); });
  $('#weekly-none').on('click', function () { weeklyUndo = weekly.slice(); weekly = weekly.map(function () { return 0; }); weeklyDirty = true; renderWeekly(); });
  $('#weekly-undo').on('click', function () { if (weeklyUndo) { weekly = weeklyUndo; weeklyUndo = null; weeklyDirty = true; renderWeekly(); } });
  $('#weekly-cal').on('click', function () { TY.toast('Slot yang bertabrakan dengan jadwal sibuk ditandai tidak tersedia.', 'info'); touchWeekly(); renderWeekly(); });
  $('#weekly-once').on('click', function () { TY.toast('Jadwal dipakai untuk sesi ini saja.', 'info'); });
  $('#weekly-save').on('click', function () { weeklyDirty = false; weeklyUndo = null; paintWeeklyState(); TY.toast('Jadwal tersimpan.'); });
  renderWeekly();
})(jQuery);
