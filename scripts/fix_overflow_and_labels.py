import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

STYLES_PATH = 'src/styles.css'

with open(STYLES_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace .game-arena-split, .game-photo-panel, .game-map-panel, .game-map-wrapper
old_split_block = """.game-arena-split {
  display: grid;
  grid-template-columns: 46% 54%;
  min-height: 560px;
}

/* 左侧照片与操作 */
.game-photo-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  background: #020617;
  overflow: hidden;
}"""

new_split_block = """.game-arena-split {
  display: grid;
  grid-template-columns: minmax(0, 48%) minmax(0, 52%);
  min-height: 580px;
  position: relative;
  overflow: hidden;
}

/* 左侧照片与操作 - 严格设置 z-index 防止地图瓦片溢出遮盖 */
.game-photo-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  background: #020617;
  overflow: hidden;
  position: relative;
  z-index: 10;
  min-width: 0;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.08);
}"""

if old_split_block in content:
    content = content.replace(old_split_block, new_split_block)
    print("Replaced split block (LF).")
else:
    old_crlf = old_split_block.replace('\n', '\r\n')
    new_crlf = new_split_block.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf)
        print("Replaced split block (CRLF).")
    else:
        print("Warning: old_split_block not found!")

# Replace .game-map-panel and .game-map-wrapper to have overflow: hidden
old_map_panel = """.game-map-panel {
  position: relative;
  min-height: 560px;
  background: #e5e7eb;
}

.game-map-wrapper {
  width: 100%;
  height: 100%;
  min-height: 560px;
}"""

new_map_panel = """.game-map-panel {
  position: relative;
  min-height: 580px;
  background: #e5e7eb;
  overflow: hidden; /* 严格裁切任何 Leaflet 瓦片或画布溢出，绝不遮盖左侧 */
  z-index: 1;
  min-width: 0;
}

.game-map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 580px;
  overflow: hidden;
}"""

if old_map_panel in content:
    content = content.replace(old_map_panel, new_map_panel)
    print("Replaced map panel block (LF).")
else:
    old_m_crlf = old_map_panel.replace('\n', '\r\n')
    new_m_crlf = new_map_panel.replace('\n', '\r\n')
    if old_m_crlf in content:
        content = content.replace(old_m_crlf, new_m_crlf)
        print("Replaced map panel block (CRLF).")
    else:
        print("Warning: old_map_panel not found!")

# Pin label vertical separation: target above, guess below
old_pin_labels = """.needle-pin-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 158, 11, 0.95);
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
}

.needle-pin-label.target {
  background: rgba(16, 185, 129, 0.95);
  top: -22px;
  font-size: 11px;
}"""

new_pin_labels = """.needle-pin-label {
  position: absolute;
  bottom: -22px; /* 猜测图钉标签位于针尖下方 */
  top: auto;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 158, 11, 0.95);
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
  z-index: 5;
}

.needle-pin-label.target {
  background: rgba(16, 185, 129, 0.95);
  top: -24px; /* 真实目标图钉标签位于水滴头部上方，绝不与猜测图钉碰撞 */
  bottom: auto;
  font-size: 11px;
  z-index: 6;
}"""

if old_pin_labels in content:
    content = content.replace(old_pin_labels, new_pin_labels)
    print("Replaced pin labels (LF).")
else:
    old_p_crlf = old_pin_labels.replace('\n', '\r\n')
    new_p_crlf = new_pin_labels.replace('\n', '\r\n')
    if old_p_crlf in content:
        content = content.replace(old_p_crlf, new_p_crlf)
        print("Replaced pin labels (CRLF).")
    else:
        print("Warning: old_pin_labels not found!")

with open(STYLES_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated styles.css with anti-overflow and clean pin separation!")
