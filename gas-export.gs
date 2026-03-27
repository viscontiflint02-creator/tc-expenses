// ============================================================
//  Google Apps Script — экспорт данных ТС в GitHub Pages
//  Инструкция по настройке — в README ниже
// ============================================================

// ============ НАСТРОЙКИ — заполните перед использованием ============
var GITHUB_TOKEN  = "ВАШ_GITHUB_TOKEN";  // Personal Access Token (scope: repo)
var GITHUB_OWNER  = "viscontiflint02-creator";
var GITHUB_REPO   = "tc-expenses";
var GITHUB_BRANCH = "main";
var DATA_FILE     = "data.json";

var SHEET_ID  = "1XtQFD6PBXsrt5n7V9YHvX_m4RCk2d3JaPwIlYVHD2x8";
var SHEET_GID = 2035557245;
// ====================================================================

/**
 * HTTP-обработчик: вызывается по кнопке 🔄 из браузера (JSONP).
 * Одновременно возвращает данные в браузер И обновляет data.json на GitHub.
 */
function doGet(e) {
  var cb = e && e.parameter && e.parameter.callback;
  var data = getSheetData();

  // Обновить data.json на GitHub (не блокирует ответ)
  try {
    pushToGitHub(data);
  } catch (err) {
    Logger.log("GitHub push error: " + err);
  }

  var json = JSON.stringify(data);
  if (cb) {
    return ContentService
      .createTextOutput(cb + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Плановый экспорт: запускать по триггеру (каждые 1–4 часа).
 * Настройка: Редактор Apps Script → Триггеры → + Добавить триггер
 *   Функция: scheduledExport, Событие: по времени, каждый час (или по расписанию)
 */
function scheduledExport() {
  var data = getSheetData();
  pushToGitHub(data);
  Logger.log("Экспорт завершён: " + data.length + " строк");
}

// ── Вспомогательные функции ─────────────────────────────────────────

function getSheetData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var sheet = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SHEET_GID) {
      sheet = sheets[i];
      break;
    }
  }
  if (!sheet) sheet = ss.getActiveSheet();

  var values = sheet.getDataRange().getValues();

  // Привести числа и даты к строкам — как делает gviz
  return values.map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) {
        return Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      return cell === null || cell === undefined ? "" : cell;
    });
  });
}

function pushToGitHub(data) {
  var apiUrl = "https://api.github.com/repos/" +
    GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + DATA_FILE;

  var headers = {
    "Authorization": "token " + GITHUB_TOKEN,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "GoogleAppsScript"
  };

  // Получить SHA текущего файла (обязательно для обновления существующего)
  var sha = null;
  try {
    var getResp = UrlFetchApp.fetch(apiUrl, {
      headers: headers,
      muteHttpExceptions: true
    });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha;
    }
  } catch (e) {
    Logger.log("Не удалось получить SHA: " + e);
  }

  var content = Utilities.base64Encode(
    JSON.stringify(data),
    Utilities.Charset.UTF_8
  );

  var body = {
    message: "data: auto-update " + new Date().toISOString(),
    content: content,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  var putResp = UrlFetchApp.fetch(apiUrl, {
    method: "PUT",
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = putResp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error("GitHub API вернул " + code + ": " + putResp.getContentText());
  }
  Logger.log("data.json обновлён на GitHub (HTTP " + code + ")");
}

/*
  ================================================================
  README — Инструкция по настройке
  ================================================================

  1. Создайте репозиторий на GitHub (например: tc-expenses)
     - Settings → Pages → Source: Deploy from a branch → main / (root)
     - Ваша страница будет доступна по: https://ВАШ_USERNAME.github.io/tc-expenses/

  2. Загрузите файлы в репозиторий:
     - Автобновление ТС.html  →  переименуйте в index.html
     - этот .gs файл не загружать (он только в Apps Script)

  3. Создайте GitHub Personal Access Token:
     - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
     - Generate new token → отметьте "repo" (полный доступ к репо)
     - Скопируйте токен и вставьте в GITHUB_TOKEN выше

  4. Заполните константы вверху этого файла:
     GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

  5. Обновите константу DATA_JSON_URL в index.html:
     const DATA_JSON_URL = "https://ВАШ_USERNAME.github.io/tc-expenses/data.json";

  6. Разверните Apps Script как веб-приложение:
     - Развернуть → Новое развёртывание → Тип: Веб-приложение
     - Выполнять как: Я (ваш аккаунт)
     - Доступ: Все (анонимные)
     - Скопируйте URL и обновите APPS_SCRIPT_URL в index.html

  7. Настройте триггер для автообновления:
     - Редактор → Триггеры (иконка часов) → + Добавить триггер
     - Функция: scheduledExport
     - Источник: По времени → Часовой таймер → Каждый час
     (или выберите другой интервал)

  8. Запустите scheduledExport() вручную один раз для первоначального
     создания data.json в репозитории.

  ================================================================
*/
