#!/usr/bin/env python3
"""Replace the clientsPage function in adminRoutes.ts with the new tabbed version."""

with open('/home/ubuntu/manus-scheduler/server/adminRoutes.ts', 'r') as f:
    lines = f.readlines()

# Lines are 1-indexed; function is at lines 3689-3754 (0-indexed: 3688-3753)
# We'll replace from the comment line (3689) to the closing brace (3754)
start_line = 3688  # 0-indexed, line 3689
end_line = 3754    # 0-indexed, line 3754 (inclusive)

new_func = r"""// ─── Clients Page ───────────────────────────────────────────────────
function clientsPage(allClients: any[], allBiz: any[], allClientAccounts: any[] = [], allClientMessages: any[] = []): string {
  const bizMap = new Map(allBiz.map((b: any) => [b.id, b.businessName]));
  const bizOptions = allBiz.map((b: any) => `<option value="${b.id}">${escHtml(b.businessName)}</option>`).join('');

  // Business-side clients table rows
  const rows = allClients.map((c: any) => `<tr class="cli-row" data-name="${escHtml((c.name || '').toLowerCase())}" data-phone="${escHtml((c.phone || '').toLowerCase())}" data-email="${escHtml((c.email || '').toLowerCase())}" data-biz="${c.businessOwnerId}">
    <td style="font-weight:500;">${escHtml(c.name)}</td>
    <td style="font-size:13px;color:var(--text-muted);">${c.phone || '—'}</td>
    <td style="font-size:13px;">${c.email || '—'}</td>
    <td><a href="/api/admin/businesses/${c.businessOwnerId}" style="color:var(--primary);">${escHtml(bizMap.get(c.businessOwnerId) || 'Unknown')}</a></td>
    <td style="font-size:12px;color:var(--text-muted);">${fmtDate(c.createdAt)}</td>
    <td><form class="delete-form" method="POST" action="/api/admin/delete/client/${c.id}" onsubmit="return confirm('Delete client ${escHtml(c.name)}? This will also delete their appointments and reviews.')"><button type="submit" class="btn-delete-sm">Delete</button></form></td>
  </tr>`).join('');

  // Client portal accounts table rows
  const msgCountMap = new Map<number, number>();
  for (const m of allClientMessages) {
    msgCountMap.set(m.clientAccountId, (msgCountMap.get(m.clientAccountId) || 0) + 1);
  }
  const portalRows = allClientAccounts.map((ca: any) => {
    const msgCount = msgCountMap.get(ca.id) || 0;
    const hasPush = ca.expoPushToken ? '✅' : '—';
    return `<tr class="portal-row" data-name="${escHtml((ca.name || '').toLowerCase())}" data-phone="${escHtml((ca.phone || '').toLowerCase())}" data-email="${escHtml((ca.email || '').toLowerCase())}">
      <td style="font-weight:500;">${escHtml(ca.name || '—')}</td>
      <td style="font-size:13px;color:var(--text-muted);">${escHtml(ca.phone)}</td>
      <td style="font-size:13px;">${escHtml(ca.email || '—')}</td>
      <td style="text-align:center;">${hasPush}</td>
      <td style="text-align:center;">
        ${msgCount > 0 ? `<button onclick="showMsgs(${ca.id},'${escHtml(ca.name || ca.phone)}')" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;">${msgCount} msg${msgCount !== 1 ? 's' : ''}</button>` : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${fmtDate(ca.createdAt)}</td>
    </tr>`;
  }).join('');

  // Build messages JSON for client-side modal
  const msgsJson = JSON.stringify(
    allClientMessages.reduce((acc: Record<number, any[]>, m: any) => {
      if (!acc[m.clientAccountId]) acc[m.clientAccountId] = [];
      acc[m.clientAccountId].push({ sender: m.senderType, body: m.body, time: m.createdAt });
      return acc;
    }, {})
  );

  return adminLayout('Clients', 'clients', `
    <div class="page-header">
      <div>
        <h2>Clients</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${allClients.length} business clients &bull; ${allClientAccounts.length} portal accounts</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <button id="tabBizBtn" onclick="switchTab('biz')" style="padding:8px 20px;border-radius:20px;border:1px solid var(--primary);background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Business Clients (${allClients.length})</button>
      <button id="tabPortalBtn" onclick="switchTab('portal')" style="padding:8px 20px;border-radius:20px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer;">Portal Accounts (${allClientAccounts.length})</button>
    </div>

    <!-- Business Clients Tab -->
    <div id="tabBiz">
      <div class="search-bar">
        <input type="text" id="cliSearch" placeholder="🔍 Search by name, phone, or email..." oninput="filterCli()" style="max-width:340px;">
        <select id="cliBizFilter" onchange="filterCli()">
          <option value="">All Businesses</option>
          ${bizOptions}
        </select>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table id="cliTable">
          <thead>
            <tr style="background:var(--bg-hover);">
              <th style="padding:12px 16px;">Name</th>
              <th style="padding:12px 16px;">Phone</th>
              <th style="padding:12px 16px;">Email</th>
              <th style="padding:12px 16px;">Business</th>
              <th style="padding:12px 16px;">Created</th>
              <th style="padding:12px 16px;">Actions</th>
            </tr>
          </thead>
          <tbody id="cliTbody">
            ${allClients.length === 0 ? '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted);">No clients yet</td></tr>' : rows}
          </tbody>
        </table>
      </div>
      <div id="cliEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No clients match your filters.</div>
    </div>

    <!-- Portal Accounts Tab -->
    <div id="tabPortal" style="display:none;">
      <div class="search-bar">
        <input type="text" id="portalSearch" placeholder="🔍 Search portal accounts..." oninput="filterPortal()" style="max-width:340px;">
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table id="portalTable">
          <thead>
            <tr style="background:var(--bg-hover);">
              <th style="padding:12px 16px;">Name</th>
              <th style="padding:12px 16px;">Phone</th>
              <th style="padding:12px 16px;">Email</th>
              <th style="padding:12px 16px;text-align:center;">Push</th>
              <th style="padding:12px 16px;text-align:center;">Messages</th>
              <th style="padding:12px 16px;">Joined</th>
            </tr>
          </thead>
          <tbody id="portalTbody">
            ${allClientAccounts.length === 0 ? '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted);">No portal accounts yet</td></tr>' : portalRows}
          </tbody>
        </table>
      </div>
      <div id="portalEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No portal accounts match your search.</div>
    </div>

    <!-- Message History Modal -->
    <div id="msgModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
      <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">
        <button onclick="document.getElementById('msgModal').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">✕</button>
        <h3 id="msgModalTitle" style="margin:0 0 16px;font-size:16px;"></h3>
        <div id="msgModalBody"></div>
      </div>
    </div>

    <script>
      var ALL_MSGS = ${msgsJson};
      function switchTab(t) {
        document.getElementById('tabBiz').style.display = t === 'biz' ? '' : 'none';
        document.getElementById('tabPortal').style.display = t === 'portal' ? '' : 'none';
        var bizBtn = document.getElementById('tabBizBtn');
        var portalBtn = document.getElementById('tabPortalBtn');
        bizBtn.style.background = t === 'biz' ? 'var(--primary)' : 'var(--bg-card)';
        bizBtn.style.color = t === 'biz' ? '#fff' : 'var(--text-muted)';
        bizBtn.style.borderColor = t === 'biz' ? 'var(--primary)' : 'var(--border)';
        portalBtn.style.background = t === 'portal' ? 'var(--primary)' : 'var(--bg-card)';
        portalBtn.style.color = t === 'portal' ? '#fff' : 'var(--text-muted)';
        portalBtn.style.borderColor = t === 'portal' ? 'var(--primary)' : 'var(--border)';
      }
      function filterCli() {
        const q = document.getElementById('cliSearch').value.toLowerCase();
        const biz = document.getElementById('cliBizFilter').value;
        let visible = 0;
        document.querySelectorAll('#cliTbody .cli-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const phone = row.getAttribute('data-phone') || '';
          const email = row.getAttribute('data-email') || '';
          const rowBiz = row.getAttribute('data-biz') || '';
          const show = (!q || name.includes(q) || phone.includes(q) || email.includes(q)) && (!biz || rowBiz === biz);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('cliEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('cliTable').style.display = visible === 0 ? 'none' : '';
      }
      function filterPortal() {
        const q = document.getElementById('portalSearch').value.toLowerCase();
        let visible = 0;
        document.querySelectorAll('#portalTbody .portal-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const phone = row.getAttribute('data-phone') || '';
          const email = row.getAttribute('data-email') || '';
          const show = !q || name.includes(q) || phone.includes(q) || email.includes(q);
          row.style.display = show ? '' : 'none';
          if (show) visible++
        });
        document.getElementById('portalEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('portalTable').style.display = visible === 0 ? 'none' : '';
      }
      function showMsgs(clientId, name) {
        var msgs = ALL_MSGS[clientId] || [];
        document.getElementById('msgModalTitle').textContent = 'Messages — ' + name;
        var html = msgs.map(function(m) {
          var isClient = m.sender === 'client';
          var time = m.time ? new Date(m.time).toLocaleString() : '';
          return '<div style="display:flex;flex-direction:column;align-items:' + (isClient ? 'flex-start' : 'flex-end') + ';margin-bottom:10px;">' +
            '<div style="max-width:80%;background:' + (isClient ? 'var(--bg-hover)' : 'var(--primary)') + ';color:' + (isClient ? 'var(--text)' : '#fff') + ';padding:8px 12px;border-radius:12px;font-size:13px;">' + String(m.body).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + (isClient ? 'Client' : 'Business') + ' &bull; ' + time + '</div>' +
            '</div>';
        }).join('');
        document.getElementById('msgModalBody').innerHTML = html || '<p style="color:var(--text-muted);text-align:center;">No messages</p>';
        document.getElementById('msgModal').style.display = 'flex';
      }
    </script>
  `);
}
"""

# Replace lines 3689-3754 (0-indexed 3688-3753) with new function
new_lines = lines[:start_line] + [new_func] + lines[end_line:]

with open('/home/ubuntu/manus-scheduler/server/adminRoutes.ts', 'w') as f:
    f.writelines(new_lines)

print(f"Done. Replaced lines {start_line+1}-{end_line} with new clientsPage function.")
print(f"New file has {len(new_lines)} lines (was {len(lines)})")
