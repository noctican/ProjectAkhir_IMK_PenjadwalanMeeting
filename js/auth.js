(function ($) {
  'use strict';
  if (!$('#auth-form').length && !$('#tab-masuk').length) return;
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
})(jQuery);
