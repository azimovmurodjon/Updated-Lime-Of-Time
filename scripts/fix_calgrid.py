with open('app/schedule-settings.tsx') as f:
    content = f.read()

start_marker = 'styles.calGrid}>\n'
end_marker = '               })}\n              </View>\n\n              {/* Selected Date Detail */'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Markers not found: start={start_idx}, end={end_idx}")
    exit(1)

old_block = content[start_idx:end_idx + len('               })}\n              </View>')]

new_block = '''styles.calGrid}>
                {customCalDays.map((day, i) => {
                  const todayDateStr = formatDateStr(new Date());
                  const dateStr = day !== null ? getDateStr(day) : "";
                  return (
                    <CalCell
                      key={day !== null ? String(day) : `e${i}`}
                      day={day}
                      i={i}
                      dateStr={dateStr}
                      customDay={day !== null ? getCustomDayForDate(dateStr) : null}
                      isSelected={selectedCustomDate === dateStr}
                      isToday={dateStr === todayDateStr}
                      isPast={dateStr < todayDateStr}
                      colors={colors}
                      styles={styles}
                      onPress={() => day !== null && setSelectedCustomDate(selectedCustomDate === dateStr ? null : dateStr)}
                    />
                  );
                })}
              </View>'''

new_content = content[:start_idx] + new_block + content[end_idx + len('               })}\n              </View>'):]

with open('app/schedule-settings.tsx', 'w') as f:
    f.write(new_content)

print("Done!")
print(f"Old: {len(old_block)} chars, New: {len(new_block)} chars")
