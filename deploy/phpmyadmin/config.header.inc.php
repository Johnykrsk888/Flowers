<?php
declare(strict_types=1);
/**
 * После входа в MariaDB (в т.ч. root) — сразу открыть структуру БД.
 * Важно: один сервер — $cfg['Servers'][1], $cfg['ServerDefault'] = 1 (см. deploy/vps-mysql-phpmyadmin.sh).
 * Вариант с Servers[0] и ServerDefault=0 даёт пустой Server или «неверный индекс сервера».
 * Повторный заход на «главную» в той же вкладке — без редиректа (sessionStorage).
 */
$db = 'flowers_mysql';
?>
<script>
(function () {
  'use strict';
  var db = <?php echo json_encode($db, JSON_THROW_ON_ERROR); ?>;
  var tries = 0;
  var maxTries = 120;
  function tick() {
    tries++;
    try {
      if (typeof CommonParams === 'undefined') {
        if (tries < maxTries) setTimeout(tick, 100);
        return;
      }
      if (!CommonParams.get('logged_in')) {
        try { sessionStorage.removeItem('pma_landed_flowers'); } catch (e) {}
        if (tries < maxTries) setTimeout(tick, 100);
        return;
      }
      var dbCp = CommonParams.get('db');
      if (dbCp != null && String(dbCp) !== '') return;
      var sp = new URLSearchParams(window.location.search);
      var route = sp.get('route') || '';
      if (route !== '/' && route !== '') return;
      if (sp.get('db')) return;
      if (sessionStorage.getItem('pma_landed_flowers') === '1') return;
      var server = sp.get('server') || String(CommonParams.get('server') ?? '1');
      sessionStorage.setItem('pma_landed_flowers', '1');
      window.location.replace(
        'index.php?route=/database/structure&db=' + encodeURIComponent(db) +
        '&server=' + encodeURIComponent(server)
      );
    } catch (e) {}
  }
  tick();
})();
</script>
