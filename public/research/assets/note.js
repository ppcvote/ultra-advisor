/* Ultra Advisor · Research Note 動效層
   無依賴、漸進增強 — JS 關掉內容照樣完整可讀。
   prefers-reduced-motion 一律退讓。 */
(function () {
  "use strict";
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. 閱讀進度條 */
  var bar = document.createElement("div");
  bar.className = "read-progress";
  document.body.appendChild(bar);
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop || window.pageYOffset) / max : 0;
    bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, pct)) + ")";
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduce) { document.body.classList.add("reveal-all"); return; }

  /* 2. 捲動浮現 — section 與 card 進場 */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        // 數字跑動：元素進場時觸發一次
        if (e.target.dataset && e.target.dataset.count !== undefined) {
          countUp(e.target);
        }
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  var reveals = document.querySelectorAll("section, .card, table, blockquote, .big-claim, .takeaway, .next-link, .vol-card");
  reveals.forEach(function (el, i) {
    el.classList.add("reveal");
    // 同一容器內的卡片做極短的接力延遲
    if (el.classList.contains("card") || el.classList.contains("vol-card")) {
      el.style.transitionDelay = (Math.min(i % 5, 4) * 55) + "ms";
    }
    io.observe(el);
  });

  /* 3. 大數字跑動 — 把 .stat 標成可數，進場時從 0 跑到目標 */
  function prep(el) {
    var txt = el.textContent.trim();
    // 解析：前綴符號 + 數字（可含逗號/小數） + 後綴單位
    var m = txt.match(/^([^\d\-+]*[+\-]?)\s*([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return false;
    el.dataset.count = m[2].replace(/,/g, "");
    el.dataset.prefix = m[1];
    el.dataset.suffix = m[3];
    el.dataset.decimals = (m[2].split(".")[1] || "").length;
    el.dataset.grouped = /,/.test(m[2]) ? "1" : "";
    el.textContent = m[1] + "0" + m[3];
    return true;
  }
  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals, 10) || 0;
    var grouped = el.dataset.grouped === "1";
    var pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    var start = null, dur = 900;
    function fmt(v) {
      var s = v.toFixed(dec);
      if (grouped) {
        var parts = s.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        s = parts.join(".");
      }
      return pre + s + suf;
    }
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }
  document.querySelectorAll(".stat").forEach(function (el) {
    if (prep(el)) {
      // 數字本身不直接 observe（它在 card 裡），改由所屬 card 進場時觸發
      var host = el.closest(".card, .vol-card, section");
      if (host) {
        host.dataset.count = host.dataset.count || "";
        var prev = io;
        // 用獨立 observer 確保即使 host 已在視窗內也會跑
        new IntersectionObserver(function (es, ob) {
          es.forEach(function (e) {
            if (e.isIntersecting) { countUp(el); ob.disconnect(); }
          });
        }, { threshold: 0.2 }).observe(host);
      } else {
        countUp(el);
      }
    }
  });
})();
