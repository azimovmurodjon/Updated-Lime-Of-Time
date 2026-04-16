#!/usr/bin/env python3
"""
Replace the homePage() function in publicRoutes.ts with the full landing page HTML,
and add a /home route alias.
"""
import re

# Read the landing page HTML
with open('/home/ubuntu/manus-scheduler/server/landing/home.html', 'r') as f:
    html_content = f.read()

# Escape backticks and ${} for embedding in a TypeScript template literal
html_escaped = html_content.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

# Read the publicRoutes.ts file
with open('/home/ubuntu/manus-scheduler/server/publicRoutes.ts', 'r') as f:
    source = f.read()

# Replace the homePage function
old_func_pattern = r'function homePage\(\): string \{[\s\S]*?^\}'
new_func = f'''function homePage(): string {{
  return `{html_escaped}`;
}}'''

new_source = re.sub(old_func_pattern, new_func, source, flags=re.MULTILINE)

# Also add /home route alias if it doesn't exist
if '"/home"' not in new_source and "'/home'" not in new_source:
    # Add before the /api/home route
    new_source = new_source.replace(
        'app.get("/api/home", (_req: Request, res: Response) => {',
        '''app.get("/home", (_req: Request, res: Response) => {
    res.send(homePage());
  });

  app.get("/api/home", (_req: Request, res: Response) => {'''
    )

with open('/home/ubuntu/manus-scheduler/server/publicRoutes.ts', 'w') as f:
    f.write(new_source)

print("Done! homePage() replaced and /home route added.")
