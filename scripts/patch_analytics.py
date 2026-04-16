#!/usr/bin/env python3
"""
Replaces lines 2020-2217 (the analyticsPage return statement) in adminRoutes.ts
with a redesigned version that clearly separates Developer/Platform metrics
from Business Owner activity.
"""

import sys

FILE = "/home/ubuntu/manus-scheduler/server/adminRoutes.ts"

# Lines to replace: 2020 to 2217 inclusive (1-indexed)
REPLACE_START = 2020
REPLACE_END = 2217

NEW_LINES = r"""  return adminLayout("Analytics", "analytics", `
    <div class="page-header">
      <div>
        <h2>Analytics Dashboard</h2>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Platform-wide metrics &mdash; updated on page load</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 1 — DEVELOPER / PLATFORM REVENUE
         This is YOUR income as the developer selling this SaaS to businesses.
    ═══════════════════════════════════════════════════════════════════════ -->
    <div style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:14px 18px;background:linear-gradient(135deg,#05966915,#0a7ea415);border-radius:12px;border:1px solid #05966930;">
        <div style="width:4px;height-36px;min-height:36px;background:linear-gradient(180deg,#059669,#0a7ea4);border-radius:2px;"></div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">&#128200; Platform Revenue &mdash; Your SaaS Income</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Money you earn from businesses subscribing to Lime Of Time</div>
        </div>
        <div style="margin-left:auto;background:#05966920;color:#059669;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.05em;">DEVELOPER VIEW</div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));">
        <div class="stat-card" style="border-left:4px solid #059669;">
          <div class="stat-icon" style="color:#059669;">$</div>
          <div class="stat-label">MRR</div>
          <div class="stat-value" style="color:#059669;">\$${data.mrr.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Monthly Recurring Revenue</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #0a7ea4;">
          <div class="stat-icon" style="color:#0a7ea4;">&#128200;</div>
          <div class="stat-label">ARR</div>
          <div class="stat-value" style="color:#0a7ea4;">\$${data.arr.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Annual Run Rate</div>
        </div>
        <div class="stat-card" style="border-left:4px solid ${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">
          <div class="stat-icon" style="color:${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">&#128197;</div>
          <div class="stat-label">Churn Rate</div>
          <div class="stat-value" style="color:${data.churnRate > 10 ? '#ef4444' : '#f59e0b'};">${data.churnRate}%</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${data.recentlyChurned} expired last 30d</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #6b7280;">
          <div class="stat-icon">&#127970;</div>
          <div class="stat-label">Total Businesses</div>
          <div class="stat-value">${data.totalBiz}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${data.activeBiz} active / trial</div>
        </div>
      </div>

      <!-- Plan Distribution (SaaS) -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:18px;">&#127381;</span>
          <h3 style="margin:0;">Subscription Plan Distribution</h3>
          <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">How many businesses are on each plan</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${Object.entries(data.planDist).map(([plan, count]) => {
            const pct = Math.round((count / totalPlanBiz) * 100);
            const col = planColors[plan] || '#6b7280';
            return `
              <div style="background:var(--bg-hover);border-radius:10px;padding:14px 16px;border:1px solid ${col}30;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-size:14px;font-weight:700;color:${col};">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
                  <span style="font-size:22px;font-weight:800;color:${col};">${count}</span>
                </div>
                <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-bottom:6px;">
                  <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width 0.4s;"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">${pct}% of all businesses</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- New Signups Per Week -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:18px;">&#128101;</span>
          <h3 style="margin:0;">New Business Signups Per Week</h3>
        </div>
        ${data.signupsByWeek.length === 0
          ? '<div class="empty-state"><p>No signups yet</p></div>'
          : data.signupsByWeek.map((w) => `
            <div class="chart-bar">
              <div class="chart-bar-label" style="min-width:80px;font-size:11px;">${w.week}</div>
              <div class="chart-bar-fill" style="width:${Math.max((w.count / maxWeek) * 100, w.count > 0 ? 8 : 2)}%;background:#059669;">
                ${w.count > 0 ? `<span class="chart-bar-value">${w.count}</span>` : ''}
              </div>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Divider -->
    <div style="display:flex;align-items:center;gap:12px;margin:28px 0 20px;">
      <div style="flex:1;height:1px;background:var(--border);"></div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;padding:0 8px;">&#8595; Business Owner Activity</div>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         SECTION 2 — BUSINESS OWNER ACTIVITY
         Aggregated operational data from all businesses using the app.
         This is what business owners see in their own dashboards.
    ═══════════════════════════════════════════════════════════════════════ -->
    <div style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:14px 18px;background:linear-gradient(135deg,#7c3aed15,#f59e0b15);border-radius:12px;border:1px solid #7c3aed30;">
        <div style="width:4px;min-height:36px;background:linear-gradient(180deg,#7c3aed,#f59e0b);border-radius:2px;"></div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">&#128188; Business Owner Activity &mdash; Aggregated Across All Businesses</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Revenue and appointments generated by businesses using your app</div>
        </div>
        <div style="margin-left:auto;background:#7c3aed20;color:#7c3aed;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.05em;">BUSINESS VIEW</div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));">
        <div class="stat-card" style="border-left:4px solid #7c3aed;">
          <div class="stat-icon" style="color:#7c3aed;">&#128179;</div>
          <div class="stat-label">Total Appt Revenue</div>
          <div class="stat-value" style="color:#7c3aed;">\$${data.totalApptRevenue.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">From completed bookings (all businesses)</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #f59e0b;">
          <div class="stat-icon" style="color:#f59e0b;">&#11088;</div>
          <div class="stat-label">Avg Rating</div>
          <div class="stat-value" style="color:#f59e0b;">${Number(data.avgRating).toFixed(1)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Across all business reviews</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #3b82f6;">
          <div class="stat-icon" style="color:#3b82f6;">&#128197;</div>
          <div class="stat-label">Total Appointments</div>
          <div class="stat-value" style="color:#3b82f6;">${data.apptsByStatus.reduce((s,x) => s + x.count, 0).toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">All statuses combined</div>
        </div>
      </div>

      <!-- Charts: Appointments by Month + by Status -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">&#128200;</span>
            <h3 style="margin:0;">Appointments by Month</h3>
          </div>
          ${data.apptsByMonth.length === 0
            ? '<div class="empty-state"><p>No data yet</p></div>'
            : data.apptsByMonth.map((m) => `
              <div class="chart-bar">
                <div class="chart-bar-label" style="min-width:80px;font-size:11px;">${m.month}</div>
                <div class="chart-bar-fill" style="width:${Math.max((m.count / maxApptMonth) * 100, 8)}%;background:#7c3aed;">
                  <span class="chart-bar-value">${m.count}</span>
                </div>
              </div>
            `).join('')}
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">&#9989;</span>
            <h3 style="margin:0;">Appointments by Status</h3>
          </div>
          ${data.apptsByStatus.map((s) => {
            const col = s.status === 'confirmed' ? '#059669' : s.status === 'pending' ? '#f59e0b' : s.status === 'cancelled' ? '#ef4444' : '#3b82f6';
            const total = data.apptsByStatus.reduce((sum, x) => sum + x.count, 0) || 1;
            const pct = Math.round((s.count / total) * 100);
            return `
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:13px;font-weight:600;color:${col};">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${s.count.toLocaleString()} (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Per-Business Revenue Table -->
    <div class="card" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">&#128203;</span>
          <h3 style="margin:0;">Revenue by Business</h3>
          <span style="font-size:12px;color:var(--text-muted);">Appointment revenue + subscription plan per business</span>
        </div>
        <div class="search-bar" style="margin:0;">
          <input type="text" id="bizRevSearch" placeholder="&#128269; Search by name..." oninput="filterBizRev()" style="max-width:220px;">
          <select id="bizRevPlanFilter" onchange="filterBizRev()">
            <option value="">All Plans</option>
            <option value="solo">Solo</option>
            <option value="growth">Growth</option>
            <option value="studio">Studio</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select id="bizRevStatusFilter" onchange="filterBizRev()">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="free">Free</option>
          </select>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table id="bizRevTable">
          <thead>
            <tr style="background:var(--bg-hover);">
              <th style="padding:10px 14px;">Business</th>
              <th style="padding:10px 14px;">Plan</th>
              <th style="padding:10px 14px;">Status</th>
              <th style="padding:10px 14px;text-align:right;">Appt Revenue</th>
              <th style="padding:10px 14px;text-align:right;">Completed Appts</th>
              <th style="padding:10px 14px;">Joined</th>
              <th style="padding:10px 14px;">Actions</th>
            </tr>
          </thead>
          <tbody id="bizRevTbody">
            ${data.bizRevTable.length === 0
              ? '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted);">No businesses yet</td></tr>'
              : data.bizRevTable.map((b) => {
                  const pc = planColors[b.plan] || '#6b7280';
                  const sc = b.status === 'active' ? '#059669' : b.status === 'trial' ? '#f59e0b' : b.status === 'expired' ? '#ef4444' : '#6b7280';
                  return `<tr class="biz-rev-row" data-name="${escHtml(b.name.toLowerCase())}" data-plan="${b.plan}" data-status="${b.status}">
                    <td style="font-weight:600;"><a href="/api/admin/businesses/${b.id}" style="color:var(--text);text-decoration:none;">${escHtml(b.name)}</a></td>
                    <td><span style="background:${pc}20;color:${pc};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">${b.plan.charAt(0).toUpperCase() + b.plan.slice(1)}</span></td>
                    <td><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:10px;font-size:12px;">${b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span></td>
                    <td style="text-align:right;font-weight:600;color:${b.revenue > 0 ? '#059669' : 'var(--text-muted)'};">\$${b.revenue.toFixed(2)}</td>
                    <td style="text-align:right;color:var(--text-muted);">${b.apptCount}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${fmtDate(b.createdAt)}</td>
                    <td><a href="/api/admin/businesses/${b.id}" class="btn btn-secondary btn-sm">View &rarr;</a></td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>
      <div id="bizRevEmpty" style="display:none;padding:40px;text-align:center;color:var(--text-muted);">No businesses match your filters.</div>
    </div>

    <script>
      function filterBizRev() {
        const q = document.getElementById('bizRevSearch').value.toLowerCase();
        const plan = document.getElementById('bizRevPlanFilter').value;
        const status = document.getElementById('bizRevStatusFilter').value;
        let visible = 0;
        document.querySelectorAll('#bizRevTbody .biz-rev-row').forEach(function(row) {
          const name = row.getAttribute('data-name') || '';
          const rowPlan = row.getAttribute('data-plan') || '';
          const rowStatus = row.getAttribute('data-status') || '';
          const show = (!q || name.includes(q)) && (!plan || rowPlan === plan) && (!status || rowStatus === status);
          row.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        document.getElementById('bizRevEmpty').style.display = visible === 0 ? 'block' : 'none';
        document.getElementById('bizRevTable').style.display = visible === 0 ? 'none' : '';
      }
    </script>
  `);
}
"""

with open(FILE, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")
print(f"Replacing lines {REPLACE_START}-{REPLACE_END}")

# Build new content: lines before + new + lines after
before = lines[:REPLACE_START - 1]   # 0-indexed, lines 1..(REPLACE_START-1)
after  = lines[REPLACE_END:]          # lines after REPLACE_END (0-indexed: REPLACE_END onwards)

new_content = before + [NEW_LINES] + after

with open(FILE, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("Done.")
