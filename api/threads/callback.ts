import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Threads OAuth Callback
 *
 * 接收 Threads 授權後的 redirect，將 code 帶回前端頁面。
 * 用戶授權後 Threads 會 redirect 到這個 URL，帶有 ?code=xxx
 * 這個 API 把 code 嵌入一個簡單的 HTML 頁面，用 postMessage 傳回前端。
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description } = req.query;

  if (error) {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>授權失敗</title></head>
      <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;max-width:400px;padding:20px;">
          <h2 style="color:#f87171;">授權失敗</h2>
          <p style="color:#94a3b8;">${String(error_description || error || '未知錯誤')}</p>
          <p style="color:#64748b;font-size:14px;">你可以關閉此頁面，回到 Ultra Advisor 重試。</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'threads-oauth-error', error: ${JSON.stringify(String(error_description || error))} }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>缺少授權碼</title></head>
      <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;max-width:400px;padding:20px;">
          <h2 style="color:#f87171;">缺少授權碼</h2>
          <p style="color:#94a3b8;">URL 中未找到授權碼參數。</p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // 成功取得 code，用 postMessage 傳回 opener 並自動關閉
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head><title>授權成功</title></head>
    <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="text-align:center;max-width:400px;padding:20px;">
        <h2 style="color:#4ade80;">✓ 授權成功</h2>
        <p style="color:#94a3b8;">正在將授權碼傳回 Ultra Advisor...</p>
        <p style="color:#64748b;font-size:14px;">此頁面將自動關閉。</p>
        <script>
          var code = ${JSON.stringify(String(code))};
          if (window.opener) {
            window.opener.postMessage({ type: 'threads-oauth-code', code: code }, '*');
            setTimeout(function() { window.close(); }, 1500);
          } else {
            // 如果不是 popup 開啟的，顯示授權碼讓用戶手動複製
            document.body.innerHTML = '<div style="text-align:center;max-width:500px;padding:20px;margin:auto;">' +
              '<h2 style="color:#4ade80;">✓ 授權成功</h2>' +
              '<p style="color:#94a3b8;">請複製以下授權碼，貼回 Ultra Advisor：</p>' +
              '<input readonly value="' + code + '" style="width:100%;padding:12px;background:#1e293b;border:1px solid #475569;border-radius:8px;color:white;font-family:monospace;font-size:14px;text-align:center;" onclick="this.select()" />' +
              '<p style="color:#64748b;font-size:12px;margin-top:12px;">點擊上方文字框即可全選複製</p>' +
              '</div>';
          }
        </script>
      </div>
    </body>
    </html>
  `);
}
