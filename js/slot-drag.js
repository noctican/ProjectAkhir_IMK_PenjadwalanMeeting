(function ($) {
  'use strict';
  var stroke = null;
  TY.slot = TY.slot || {};
  TY.slot.mode = 'toggle';
  function applySlot($btn, mode) {
    var m = mode || TY.slot.mode;
    var sel = $btn.attr('data-state') === '1';
    var next = m === 'toggle' ? !sel : m === 'available';
    $btn.attr('data-state', next ? '1' : '0');
    $btn.attr('aria-pressed', next ? 'true' : 'false');
    var label = $btn.attr('aria-label') || '';
    $btn.attr('aria-label', label.replace(/— (bisa|tidak bisa|tersedia|tidak tersedia).*$/, '— ' + (next ? 'bisa hadir' : 'tidak bisa hadir')));
    return next;
  }
  TY.slot.apply = applySlot;
  function paintFromPoint(x, y) {
    if (!stroke) return;
    var el = document.elementFromPoint(x, y);
    var btn = el && el.closest ? el.closest('[data-slot-key]') : null;
    if (!btn || stroke.seen.has(btn)) return;
    stroke.seen.add(btn);
    applySlot($(btn), stroke.mode);
    $(btn).trigger('slotpaint');
  }
  $(document).on('pointermove', function (e) { paintFromPoint(e.clientX, e.clientY); });
  $(document).on('pointerup pointercancel', function () { stroke = null; });
  TY.slot.bind = function (scope) {
    $(scope).find('[data-slot-key]').each(function () {
      var $b = $(this);
      if ($b.data('drag-bound')) return;
      $b.data('drag-bound', true);
      $b.on('pointerdown', function (e) {
        e.preventDefault();
        stroke = { mode: TY.slot.mode, seen: new Set([this]) };
        applySlot($b, TY.slot.mode);
        $b.trigger('slotpaint');
      });
      $b.on('click', function (e) {
        if (e.detail === 0) { applySlot($b, TY.slot.mode); $b.trigger('slotpaint'); }
      });
    });
  };
  $(document).on('click', '.slot-mode [data-slotmode]', function () {
    TY.slot.mode = $(this).data('slotmode');
    var $g = $(this).closest('.slot-mode');
    $g.find('[data-slotmode]').attr('aria-pressed', 'false');
    $(this).attr('aria-pressed', 'true');
  });
  $(document).on('click', '.slot[data-state]', function (e) {
    if ($(this).data('drag-bound')) return;
    if (e.detail === 0) return;
    applySlot($(this), TY.slot.mode);
    $(this).trigger('slotpaint');
  });
})(jQuery);
