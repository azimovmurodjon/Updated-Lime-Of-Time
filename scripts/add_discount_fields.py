#!/usr/bin/env python3
"""Add discount fields to admin plan form in adminRoutes.ts"""

content = open('server/adminRoutes.ts', 'r').read()

old = '''        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Monthly Price ($)</label>
            <input name="monthlyPrice" type="number" step="0.01" min="0" value="${p.monthlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Yearly Price ($)</label>
            <input name="yearlyPrice" type="number" step="0.01" min="0" value="${p.yearlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
        </div>'''

new = '''        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Monthly Price ($)</label>
            <input name="monthlyPrice" type="number" step="0.01" min="0" value="${p.monthlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Yearly Price ($)</label>
            <input name="yearlyPrice" type="number" step="0.01" min="0" value="${p.yearlyPrice || 0}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;" />
          </div>
        </div>
        <!-- Discount Section -->
        <div style="background:#f59e0b10;border:1px solid #f59e0b30;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:10px;letter-spacing:0.5px;text-transform:uppercase;">&#127991; Discount (Optional)</div>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Discount % (0 = none)</label>
              <input name="discountPercent" type="number" min="0" max="100" step="1" value="${(p as any).discountPercent || 0}"
                style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;"
                placeholder="e.g. 20" />
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                ${(p as any).discountPercent > 0
                  ? `Effective monthly: <strong>$${ (parseFloat(p.monthlyPrice as string) * (1 - (p as any).discountPercent / 100)).toFixed(2) }</strong> &nbsp; yearly: <strong>$${ (parseFloat((p as any).yearlyPrice as string) * (1 - (p as any).discountPercent / 100)).toFixed(2) }</strong>`
                  : 'Enter % to preview effective price'}
              </div>
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Discount Label (shown in app)</label>
              <input name="discountLabel" type="text" maxlength="100" value="${(p as any).discountLabel || ''}"
                style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;"
                placeholder="e.g. Launch Special · 20% off" />
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Appears as a badge on the plan card in the app</div>
            </div>
          </div>
        </div>'''

if old in content:
    content = content.replace(old, new, 1)
    open('server/adminRoutes.ts', 'w').write(content)
    print('SUCCESS: Admin plan form updated with discount fields')
else:
    print('ERROR: Pattern not found')
    # Debug: show what's around monthlyPrice
    idx = content.find('name="monthlyPrice"')
    print(repr(content[idx-200:idx+200]))
