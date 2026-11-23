/* TemuYuk static — jQuery + Bootstrap-free, pola disamakan ke fe (slot drag, dialog native, theme). */
(function ($) {
  'use strict';

  /* ---------- theme (port theme-toggle fe) ---------- */
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
    } catch (e) { /* abaikan */ }
    paintThemeBtns();
  }
  $(document).on('click', '[data-theme-btn]', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('temuyuk-theme', next); } catch (e) { /* abaikan */ }
    paintThemeBtns();
  });

  /* ---------- toast (port Toasts fe) ---------- */
  function toast(msg, tone) {
    var $box = $('#toasts');
    if (!$box.length) return;
    var $t = $('<div class="toast' + (tone ? ' ' + tone : '') + '"><span></span></div>');
    $t.find('span').text(msg);
    $box.append($t);
    setTimeout(function () { $t.fadeOut(200, function () { $t.remove(); }); }, 2600);
  }

  /* ---------- helper waktu ---------- */
  var DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function mmToTime(m) { return pad(Math.floor(m / 60)) + '.' + pad(m % 60); }
  function dayIdx(iso) { return (new Date(iso + 'T00:00:00+07:00').getDay() + 6) % 7; }
  function fmtLong(iso) {
    var d = new Date(iso + 'T00:00:00+07:00');
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return DAY_NAMES[dayIdx(iso)] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtShort(iso) {
    var d = new Date(iso + 'T00:00:00+07:00');
    return DAY_NAMES[dayIdx(iso)].slice(0, 3) + ' ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()];
  }

  /* ---------- drag slot (port useSlotDrag: klik/tahan/geser) ---------- */
  var paintMode = 'toggle';
  var stroke = null;
  function applySlot($btn, mode) {
    var m = mode || paintMode;
    var sel = $btn.attr('data-state') === '1';
    var next = m === 'toggle' ? !sel : m === 'available';
    $btn.attr('data-state', next ? '1' : '0');
    $btn.attr('aria-pressed', next ? 'true' : 'false');
    var label = $btn.attr('aria-label') || '';
    $btn.attr('aria-label', label.replace(/— (bisa|tidak bisa|tersedia|tidak tersedia).*$/, '— ' + (next ? 'bisa hadir' : 'tidak bisa hadir')));
    return next;
  }
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
  function bindDrag(scope) {
    $(scope).find('[data-slot-key]').each(function () {
      var $b = $(this);
      if ($b.data('drag-bound')) return;
      $b.data('drag-bound', true);
      $b.on('pointerdown', function (e) {
        e.preventDefault();
        stroke = { mode: paintMode, seen: new Set([this]) };
        applySlot($b, paintMode);
        $b.trigger('slotpaint');
      });
      $b.on('click', function (e) {
        if (e.detail === 0) { applySlot($b, paintMode); $b.trigger('slotpaint'); }
      });
    });
  }
  $(document).on('click', '.slot-mode [data-slotmode]', function () {
    paintMode = $(this).data('slotmode');
    var $g = $(this).closest('.slot-mode');
    $g.find('[data-slotmode]').attr('aria-pressed', 'false');
    $(this).attr('aria-pressed', 'true');
  });
  // klik biasa (tanpa drag) untuk slot tanpa pointer presisi
  $(document).on('click', '.slot[data-state]', function (e) {
    if ($(this).data('drag-bound')) return;
    if (e.detail === 0) return;
    applySlot($(this), paintMode);
    $(this).trigger('slotpaint');
  });

  /* ---------- AUTH: tab + validasi ---------- */
  var authMode = 'masuk';
  function setAuth(m) {
    authMode = m;
    $('#tab-masuk').attr('aria-selected', m === 'masuk' ? 'true' : 'false');
    $('#tab-daftar').attr('aria-selected', m === 'daftar' ? 'true' : 'false');
    $('#name-field').prop('hidden', m !== 'daftar');
    $('#auth-name').prop('required', m === 'daftar');
    $('#auth-pass').attr('autocomplete', m === 'masuk' ? 'current-password' : 'new-password');
    $('#pass-hint').prop('hidden', m !== 'daftar');
    $('#auth-submit').text(m === 'daftar' ? 'Buat akun' : 'Masuk');
    $('#auth-title').text(m === 'daftar' ? 'Buat akun baru' : 'Masuk ke akunmu');
    $('#auth-sub').text(m === 'daftar' ? 'Akun dipakai untuk menyimpan jadwal rutin mingguanmu.' : 'Lanjutkan pengaturan jadwal dan event organisasimu.');
    $('#auth-error').prop('hidden', true);
  }
  $('#tab-masuk').on('click', function () { setAuth('masuk'); });
  $('#tab-daftar').on('click', function () { setAuth('daftar'); });
  $('#btn-google').on('click', function () {
    $('#auth-email').val('candra@student.ub.ac.id');
    window.location.href = 'hubungkan-kalender.html';
  });
  $('#auth-form').on('submit', function (e) {
    e.preventDefault();
    var email = $('#auth-email').val().trim();
    var pass = $('#auth-pass').val();
    var name = $('#auth-name').val().trim();
    var err = '';
    if (!/.+@.+\..+/.test(email)) err = 'Masukkan email yang valid.';
    else if (!pass) err = 'Masukkan kata sandi.';
    else if (authMode === 'daftar' && pass.length < 8) err = 'Kata sandi minimal 8 karakter.';
    else if (authMode === 'daftar' && name.length < 2) err = 'Masukkan nama lengkapmu.';
    if (err) { $('#auth-error').text(err).prop('hidden', false); return; }
    window.location.href = 'hubungkan-kalender.html';
  });

  /* ---------- kalender: hubungkan ---------- */
  function markCalConnected() {
    $('#cal-name').text('Kalender Kampus');
    $('#cal-meta').text('Terhubung · jadwal sibuk ikut dipertimbangkan.');
    $('#btn-connect, #btn-cal').text('Terhubung ✓').prop('disabled', false);
    toast('Google Calendar terhubung.', 'info');
  }
  $('#btn-connect, #btn-cal').on('click', function () {
    var $b = $(this);
    $b.text('Menghubungkan…').prop('disabled', true);
    setTimeout(markCalConnected, 500);
  });
  $('#btn-lanjut, #btn-lewati').on('click', function () { window.location.href = 'dasbor.html'; });

  /* ---------- wizard buat-event ---------- */
  var STEPS = [
    { t: 'Informasi event', s: 'Isi judul, durasi, dan pilih peserta yang perlu hadir.' },
    { t: 'Tanggal kandidat', s: 'Pilih tanggal yang mungkin untuk rapat, lewat rentang atau satu per satu.' },
    { t: 'Rentang jam', s: 'Tandai slot jam yang boleh dipakai pada tanggal-tanggal tersebut.' },
    { t: 'Visibilitas rekap', s: 'Tentukan apakah peserta lain boleh melihat rekap ketersediaan.' },
    { t: 'Tinjau dan publikasi', s: 'Periksa sekali lagi sebelum event dipublikasikan.' }
  ];
  var step = 1, dateMode = 'range', winMode = 'global';
  var dates = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-19'];
  var calCursor = '2026-11';
  var picks = {}; // iso -> number[48]

  function emptyPicks() { return Array.from({ length: 48 }, function () { return 0; }); }
  function ensurePicks() {
    dates.forEach(function (d) {
      if (!picks[d]) {
        var p = emptyPicks();
        for (var i = 18; i < 26; i++) p[i] = 1; // 09.00–13.00 awal
        picks[d] = p;
      }
    });
  }
  function formErr(msg) {
    var $e = $('#form-error');
    if (!msg) { $e.prop('hidden', true); return; }
    $e.text(msg).prop('hidden', false);
  }
  function paintStep() {
    $('.wizard-step').each(function () { $(this).prop('hidden', +$(this).data('step') !== step); });
    $('#stepper .step').each(function (i) {
      $(this).toggleClass('done', i + 1 < step);
      $(this).toggleClass('active', i + 1 === step);
      $(this).find('.step-num').text(i + 1 < step ? '✓' : (i + 1));
    });
    $('#step-title').text(STEPS[step - 1].t);
    $('#step-sub').text(STEPS[step - 1].s);
    $('#wiz-back').prop('hidden', step === 1);
    $('#wiz-draft').prop('hidden', step !== 5);
    $('#wiz-next').text(step === 5 ? 'Publikasikan event' : 'Lanjut ›');
    if (step === 3) renderJam();
    if (step === 5) renderSummary();
    $('#wiz-count').text($('#part-list .person[aria-pressed="true"]').length + ' peserta dipilih');
    $('#wiz-dates').text(dates.length + ' tanggal kandidat');
    window.scrollTo(0, 0);
  }
  function validate(n) {
    if (n === 1) {
      if ($('#ev-title').val().trim().length < 3) return 'Judul event minimal 3 karakter.';
      if ($('#part-list .person[aria-pressed="true"]').length === 0) return 'Pilih minimal satu peserta.';
    }
    if (n === 2 && dates.length === 0) return 'Pilih minimal satu tanggal kandidat.';
    if (n === 3) {
      ensurePicks();
      var dur = parseInt($('#ev-dur').val(), 10) || 60;
      for (var k = 0; k < dates.length; k++) {
        var p = picks[dates[k]];
        var on = p.reduce(function (a, v) { return a + v; }, 0);
        if (on === 0) return 'Tandai minimal satu jam untuk ' + fmtLong(dates[k]) + '.';
        var first = p.indexOf(1), last = p.lastIndexOf(1);
        for (var i = first; i <= last; i++) if (p[i] !== 1) return 'Tandai slot berurutan tanpa jeda untuk ' + fmtLong(dates[k]) + '.';
        if ((last - first + 1) * 30 < dur) return 'Rentang jam ' + fmtLong(dates[k]) + ' lebih pendek dari durasi event.';
      }
    }
    return '';
  }
  $('#wiz-next').on('click', function () {
    if (step < 5) {
      var bad = validate(step);
      if (bad) { formErr(bad); return; }
      formErr(''); step++; paintStep();
    } else {
      var all = validate(1) || validate(2) || validate(3);
      if (all) { formErr(all); return; }
      toast('Event dipublikasikan. Peserta bisa merespons sekarang.');
      setTimeout(function () { window.location.href = 'detail-event.html'; }, 500);
    }
  });
  $('#wiz-back').on('click', function () { formErr(''); step = Math.max(1, step - 1); paintStep(); });
  $('#wiz-draft').on('click', function () {
    var bad = validate(1) || validate(2) || validate(3);
    if (bad) { formErr(bad); return; }
    toast('Event disimpan sebagai draf.', 'info');
    setTimeout(function () { window.location.href = 'dasbor.html'; }, 500);
  });

  // peserta toggle
  $('#part-list').on('click', '.person', function () {
    var on = $(this).attr('aria-pressed') === 'true';
    $(this).attr('aria-pressed', on ? 'false' : 'true');
    $('#wiz-count').text($('#part-list .person[aria-pressed="true"]').length + ' peserta dipilih');
  });

  // mode tanggal
  $('[data-datemode]').on('click', function () {
    dateMode = $(this).data('datemode');
    $('[data-datemode]').attr('aria-pressed', 'false');
    $(this).attr('aria-pressed', 'true');
    $('#date-hint').text(dateMode === 'range' ? 'Klik tanggal mulai, lalu tanggal akhir pada kalender. Rentang langsung digunakan sebagai kandidat.' : 'Klik tanggal pada kalender untuk menambah atau menghapus.');
    renderCal();
  });
  $('#date-clear').on('click', function () { dates = []; renderCal(); renderChips(); });
  function shiftMonth(cur, amt) {
    var y = +cur.slice(0, 4), m = +cur.slice(5, 7) - 1 + amt;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  $('#cal-prev').on('click', function () { calCursor = shiftMonth(calCursor, -1); renderCal(); });
  $('#cal-next').on('click', function () { calCursor = shiftMonth(calCursor, 1); renderCal(); });
  var rangeAnchor = '2026-11-12';
  function renderCal() {
    var $c = $('#cal-cells').empty();
    if (!$c.length) return;
    var y = +calCursor.slice(0, 4), m = +calCursor.slice(5, 7) - 1;
    var first = new Date(Date.UTC(y, m, 1));
    $('#cal-title').text(first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
    var off = (first.getUTCDay() + 6) % 7;
    for (var i = 0; i < 42; i++) {
      (function (idx) {
        var d = new Date(first); d.setUTCDate(idx - off + 1);
        var iso = d.toISOString().slice(0, 10);
        var inM = d.getUTCMonth() === m;
        var chosen = dateMode === 'range'
          ? (rangeAnchor && iso >= rangeAnchor && iso <= (dates[dates.length - 1] || rangeAnchor))
          : dates.indexOf(iso) !== -1;
        var $b = $('<button type="button" class="cal-cell' + (chosen ? ' is-selected' : '') + '">' + (+iso.slice(8, 10)) + '</button>');
        $b.attr({ 'aria-pressed': chosen ? 'true' : 'false', 'aria-label': new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) });
        if (!inM) $b.prop('disabled', true);
        $b.on('click', function () {
          if (dateMode === 'range') {
            if (!rangeAnchor || iso < rangeAnchor || dates.length > 1 && rangeAnchor) { rangeAnchor = iso; dates = [iso]; }
            else {
              var out = [], cur = rangeAnchor;
              while (cur <= iso && out.length < 31) { out.push(cur); var dd = new Date(cur + 'T00:00:00Z'); dd.setUTCDate(dd.getUTCDate() + 1); cur = dd.toISOString().slice(0, 10); }
              dates = out.sort();
            }
          } else {
            var at = dates.indexOf(iso);
            if (at === -1) { if (dates.length >= 31) { formErr('Pilih paling banyak 31 tanggal kandidat.'); return; } dates.push(iso); dates.sort(); }
            else dates.splice(at, 1);
          }
          formErr(''); renderCal(); renderChips();
        });
        $c.append($b);
      })(i);
    }
  }
  function renderChips() {
    var $c = $('#date-chips').empty();
    $('#date-count').text(dates.length);
    $('#wiz-dates').text(dates.length + ' tanggal kandidat');
    if (!dates.length) { $c.append('<p class="hint">Belum ada tanggal kandidat.</p>'); return; }
    dates.slice().sort().forEach(function (iso) {
      var $chip = $('<span class="chip">' + fmtLong(iso) + '</span>');
      var $x = $('<button type="button" aria-label="Hapus ' + fmtLong(iso) + '">✕</button>');
      $x.on('click', function () { dates = dates.filter(function (d) { return d !== iso; }); renderCal(); renderChips(); });
      $chip.append($x); $c.append($chip);
    });
  }

  // jam: global vs per tanggal + render matrix 48 kolom
  $('[data-winmode]').on('click', function () {
    winMode = $(this).data('winmode');
    $('[data-winmode]').attr('aria-pressed', 'false');
    $(this).attr('aria-pressed', 'true');
    $('#win-hint').text(winMode === 'global' ? 'Satu baris untuk semua tanggal. Perubahan di bawah berlaku untuk setiap tanggal kandidat.' : 'Atur rentang jam untuk setiap tanggal kandidat.');
    renderJam();
  });
  $('#jam-all').on('click', function () { ensurePicks(); dates.forEach(function (d) { picks[d] = picks[d].map(function () { return 1; }); }); renderJam(); });
  $('#jam-none').on('click', function () { ensurePicks(); dates.forEach(function (d) { picks[d] = picks[d].map(function () { return 0; }); }); renderJam(); });
  function renderJam() {
    var $tb = $('#jam-body').empty();
    if (!$tb.length) return;
    ensurePicks();
    $('#ev-dur').length && $('#jam-dur').text(parseInt($('#ev-dur').val(), 10) || 60);
    var rows = winMode === 'global'
      ? [{ key: '__global', label: 'Semua tanggal' }]
      : dates.slice().sort().map(function (d) { return { key: d, label: fmtShort(d) }; });
    if (!dates.length) { $tb.append('<tr><td class="day">—</td></tr>'); return; }
    rows.forEach(function (row) {
      var $tr = $('<tr><td class="day">' + row.label + '</td></tr>');
      for (var c = 0; c < 48; c++) {
        (function (col) {
          var src = row.key === '__global' ? picks[dates.slice().sort()[0]] : picks[row.key];
          var v = src ? src[col] : 0;
          var $td = $('<td></td>');
          var $b = $('<button type="button" class="slot" data-state="' + (v ? '1' : '0') + '" data-slot-key="' + row.key + '|' + col + '" aria-pressed="' + (v ? 'true' : 'false') + '" aria-label="' + row.label + ' ' + mmToTime(col * 30) + '"></button>');
          $td.append($b); $tr.append($td);
        })(c);
      }
      $tb.append($tr);
    });
    bindDrag($tb);
    estimateSlots();
  }
  function estimateSlots() {
    ensurePicks();
    var dur = parseInt($('#ev-dur').val(), 10) || 60;
    var total = 0;
    dates.forEach(function (d) {
      var p = picks[d], first = p.indexOf(1), last = p.lastIndexOf(1);
      if (first === -1) return;
      var span = (last - first + 1) * 30;
      total += Math.max(0, Math.floor((span - dur) / 30) + 1);
    });
    $('#jam-total').text(total);
  }
  $(document).on('slotpaint', '#jam-body', function () {
    // sinkron nilai drag ke model picks
    $('#jam-body [data-slot-key]').each(function () {
      var parts = $(this).data('slot-key').split('|');
      var key = parts[0], col = +parts[1];
      var v = $(this).attr('data-state') === '1' ? 1 : 0;
      if (key === '__global') { dates.forEach(function (d) { ensurePicks(); picks[d][col] = v; }); }
      else { ensurePicks(); if (picks[key]) picks[key][col] = v; }
    });
    estimateSlots();
  });
  $('#ev-dur').on('change', function () { estimateSlots(); });
  $('#show-recap').on('change', function () {
    $('#recap-hint').text(this.checked ? 'Rekap agregat akan terlihat oleh semua peserta.' : 'Rekap hanya terlihat olehmu sebagai pembuat event. Ini pengaturan yang disarankan.');
  });
  function renderSummary() {
    var dur = $('#ev-dur').val();
    $('#sum-title').text($('#ev-title').val() || '—');
    $('#sum-desc').text($('#ev-desc').val() || '—');
    $('#sum-dur').text(dur);
    var names = [];
    $('#part-list .person[aria-pressed="true"]').each(function () { names.push($(this).find('.person-name').text()); });
    $('#sum-part').text(names.join(', ') || 'Belum dipilih');
    ensurePicks();
    var $d = $('#sum-dates').empty();
    dates.slice().sort().forEach(function (iso) {
      var p = picks[iso], f = p.indexOf(1), l = p.lastIndexOf(1);
      $d.append('<div class="date-row compact"><span class="date-label">' + fmtLong(iso) + '</span><span class="muted">' + (f === -1 ? '—' : mmToTime(f * 30) + '–' + mmToTime((l + 1) * 30)) + '</span></div>');
    });
    $('#sum-recap').text($('#show-recap').is(':checked') ? 'Ditampilkan' : 'Hanya pembuat event');
    $('#sum-slots').text($('#jam-total').text() + ' slot');
  }

  /* ---------- jadwal-saya: grid 7x48 ---------- */
  var weekly = null, weeklyUndo = null, weeklyDirty = false;
  function seedWeekly() {
    weekly = [];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 48; c++) {
      weekly.push(((r * 48 + c) % 3 === 2) ? 0 : 1);
    }
  }
  function renderWeekly() {
    var $tb = $('#weekly-body').empty();
    if (!$tb.length) return;
    if (!weekly) seedWeekly();
    DAY_NAMES.forEach(function (name, r) {
      var $tr = $('<tr><td class="day">' + name + '</td></tr>');
      for (var c = 0; c < 48; c++) {
        (function (col) {
          var v = weekly[r * 48 + col];
          var $td = $('<td></td>');
          $td.append('<button type="button" class="slot" data-state="' + v + '" data-slot-key="w|' + (r * 48 + col) + '" aria-pressed="' + (v ? 'true' : 'false') + '" aria-label="' + name + ' ' + mmToTime(col * 30) + ' — ' + (v ? 'tersedia' : 'tidak tersedia') + '"></button>');
          $tr.append($td);
        })(c);
      }
      $tb.append($tr);
    });
    bindDrag($tb);
    paintWeeklyState();
  }
  function paintWeeklyState() {
    var marked = weekly.filter(function (v) { return v === 1; }).length;
    $('#avail-count').text(marked);
    $('#weekly-note').text(weeklyDirty ? 'Ada perubahan yang belum disimpan.' : 'Jadwal ini dipakai sebagai isian awal saat kamu merespons event.').toggleClass('muted', !weeklyDirty);
    $('#weekly-save, #weekly-once').prop('disabled', !weeklyDirty);
    $('#weekly-undo').prop('hidden', !weeklyUndo);
  }
  function touchWeekly() {
    if (!weeklyUndo) weeklyUndo = weekly.slice();
    weeklyDirty = true; paintWeeklyState();
  }
  $(document).on('slotpaint', '#weekly-body', function () {
    var next = weekly.slice();
    $('#weekly-body [data-slot-key]').each(function () {
      next[+$(this).data('slot-key').split('|')[1]] = $(this).attr('data-state') === '1' ? 1 : 0;
    });
    weekly = next; touchWeekly();
  });
  $('#weekly-all').on('click', function () { weeklyUndo = weekly.slice(); weekly = weekly.map(function () { return 1; }); weeklyDirty = true; renderWeekly(); });
  $('#weekly-none').on('click', function () { weeklyUndo = weekly.slice(); weekly = weekly.map(function () { return 0; }); weeklyDirty = true; renderWeekly(); });
  $('#weekly-undo').on('click', function () { if (weeklyUndo) { weekly = weeklyUndo; weeklyUndo = null; weeklyDirty = true; renderWeekly(); } });
  $('#weekly-cal').on('click', function () { toast('Slot yang bertabrakan dengan jadwal sibuk ditandai tidak tersedia.', 'info'); touchWeekly(); renderWeekly(); });
  $('#weekly-once').on('click', function () { toast('Jadwal dipakai untuk sesi ini saja.', 'info'); });
  $('#weekly-save').on('click', function () { weeklyDirty = false; weeklyUndo = null; paintWeeklyState(); toast('Jadwal tersimpan.'); });

  /* ---------- respons peserta ---------- */
  function paintResp() {
    var sent = $('#resp-badge').text().indexOf('Sudah') === 0;
    $('#btn-send').text(sent ? 'Perbarui respons' : 'Kirim respons');
  }
  $('[data-bulk]').on('click', function () {
    var v = $(this).data('bulk') === 'available' ? '1' : '0';
    $('.avail .slot').attr('data-state', v).attr('aria-pressed', v === '1' ? 'true' : 'false');
    toast(v === '1' ? 'Semua slot ditandai bisa.' : 'Semua slot ditandai tidak bisa.', 'info');
  });
  $('#btn-suggest').on('click', function () { toast('Usulan awal dari jadwal rutin diterapkan.', 'info'); });
  $('#btn-send').on('click', function () {
    $('#resp-badge').text('Sudah dikirim').removeClass('pending').addClass('available');
    $('#resp-note').text('Responsmu sudah dikirim dan masih bisa diperbarui selama event terbuka.');
    paintResp(); toast('Respons ketersediaanmu tersimpan.');
  });
  $('#part-more').on('click', function () {
    var $x = $('.extra-part');
    var show = $x.first().prop('hidden');
    $x.prop('hidden', !show);
    $(this).text(show ? 'Tampilkan lebih sedikit' : 'Tampilkan semua (8)');
  });

  /* ---------- dialog slot + final + batal ---------- */
  var pendingFinal = '';
  function openDlg(id) { var d = document.getElementById(id); if (d && d.showModal) d.showModal(); }
  function closeDlg($d) { var d = $d.closest('dialog')[0]; if (d) d.close(); }
  $(document).on('click', '.slot.recap', function () {
    var parts = ($(this).data('slot') || '').split('|');
    var label = parts[0] || 'Slot', jam = parts[1] || '', ok = parts[2] || '0', no = parts[3] || '0', wait = parts[4] || '0';
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
  $('#final-confirm').on('click', function () { closeDlg($(this)); window.location.href = 'jadwal-final.html'; });
  $('#btn-remind').on('click', function () { toast('3 peserta diingatkan untuk merespons.', 'info'); });
  $('#btn-cancel-open').on('click', function () { openDlg('cancel-dialog'); });
  $('#cancel-confirm').on('click', function () { closeDlg($(this)); toast('Event dibatalkan.', 'error'); });

  /* ---------- final ---------- */
  $('#btn-gcal').on('click', function () {
    $(this).text('Sudah ditambahkan ✓').prop('disabled', true);
    $('#cal-state').text('Ditambahkan ke kalender');
    $('#cal-note').text('Sudah ditambahkan ke kalender.');
    toast('Jadwal ditambahkan ke Google Calendar.');
  });
  $('#btn-share').on('click', function () {
    try { navigator.clipboard && navigator.clipboard.writeText(location.href); } catch (e) { /* abaikan */ }
    $(this).text('Tautan disalin ✓');
    toast('Tautan event disalin.', 'info');
  });

  /* ---------- init ---------- */
  initTheme(); paintStep && null;
  if ($('.wizard-step').length) { renderCal(); renderChips(); paintStep(); }
  if ($('#weekly-body').length) renderWeekly();
  if ($('#resp-badge').length) paintResp();
  bindDrag(document);

})(jQuery);
