(function (root, factory) {
  const api = factory();
  root.ShoplyPageAccess = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HOST_PERMISSION_ERROR = /cannot access|host permission|permission to access|not allowed to access/i;

  function isScriptableUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function isHostPermissionError(error) {
    return HOST_PERMISSION_ERROR.test(String(error?.message || error || ""));
  }

  return { isScriptableUrl, isHostPermissionError };
});
