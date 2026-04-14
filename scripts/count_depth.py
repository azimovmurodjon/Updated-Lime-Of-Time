with open('app/schedule-settings.tsx') as f:
    lines = f.readlines()

depth = 0
tags = ['View', 'ScrollView', 'ScreenContainer', 'Modal', 'Pressable', 'Text', 'Switch']
for i, line in enumerate(lines[356:801], start=357):
    old_depth = depth
    for tag in tags:
        opens = line.count(f'<{tag}') - line.count(f'<{tag}/')
        closes = line.count(f'</{tag}>')
        depth += opens - closes
    if depth != old_depth:
        print(f'L{i} d={depth}: {line.rstrip()[:90]}')

print(f'\nFinal depth: {depth}')
