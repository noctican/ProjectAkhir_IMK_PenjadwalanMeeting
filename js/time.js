(function () {
  'use strict';
  var DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function mmToTime(m) { return pad(Math.floor(m / 60)) + '.' + pad(m % 60); }
  function dayIdx(iso) { return (new Date(iso + 'T00:00:00+07:00').getDay() + 6) % 7; }
  function fmtLong(iso) {
    var d = new Date(iso + 'T00:00:00+07:00');
    return DAY_NAMES[dayIdx(iso)] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtShort(iso) {
    var d = new Date(iso + 'T00:00:00+07:00');
    return DAY_NAMES[dayIdx(iso)].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }
  TY.time = {
    DAY_NAMES: DAY_NAMES,
    pad: pad,
    mmToTime: mmToTime,
    dayIdx: dayIdx,
    fmtLong: fmtLong,
    fmtShort: fmtShort
  };
})();
