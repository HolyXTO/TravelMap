import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

STYLES_PATH = 'src/styles.css'

with open(STYLES_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add .travel-game-section to standard container width
target_str_1 = """.country-gallery-section,
.overview-section {
  width: min(1240px, 100%);
  margin: 0 auto;
}"""

repl_str_1 = """.country-gallery-section,
.overview-section,
.travel-game-section {
  width: min(1240px, 100%);
  margin: 0 auto;
}"""

if target_str_1 in content:
    content = content.replace(target_str_1, repl_str_1)
    print("Added .travel-game-section to global container width list.")
else:
    # try with CRLF
    target_crlf = target_str_1.replace('\n', '\r\n')
    repl_crlf = repl_str_1.replace('\n', '\r\n')
    if target_crlf in content:
        content = content.replace(target_crlf, repl_crlf)
        print("Added .travel-game-section to global container width list (CRLF).")
    else:
        print("Warning: target_str_1 not found!")

# 2. Add pushpin styles and update .travel-game-section
extra_styles = """
/* =========================================================================
   GeoGuessr Pushpin (图钉) & Targeted Needle Markers
   ========================================================================= */

.travel-game-section {
  position: relative;
  width: min(1240px, 100%);
  margin: 40px auto 54px;
  padding: 0;
}

.geoguessr-needle-pin {
  position: relative;
  width: 38px;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
}

.geoguessr-needle-pin:active {
  cursor: grabbing;
}

.pin-head-bubble {
  position: relative;
  width: 38px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.geoguessr-needle-pin:hover .pin-head-bubble {
  transform: translateY(-4px) scale(1.08);
}

.needle-pin-label {
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
}

.needle-ground-shadow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 75%);
  pointer-events: none;
}

.target-ground-ripple {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translate(-50%, 50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #10b981;
  animation: ground-ripple-wave 1.8s infinite ease-out;
  pointer-events: none;
}

.target-ground-ripple.delayed {
  animation-delay: 0.9s;
}

@keyframes ground-ripple-wave {
  0% {
    width: 10px;
    height: 10px;
    opacity: 1;
    transform: translate(-50%, 50%) scale(1);
  }
  100% {
    width: 68px;
    height: 68px;
    opacity: 0;
    transform: translate(-50%, 50%) scale(1);
  }
}

.geoguessr-midpoint-badge .mid-dist {
  color: #fbbf24;
  font-weight: 800;
  margin-right: 6px;
}

.geoguessr-midpoint-badge .mid-score {
  color: #34d399;
  font-weight: 900;
  font-family: var(--prophet-code);
}
"""

if ".geoguessr-needle-pin" not in content:
    content += "\n" + extra_styles
    print("Appended .geoguessr-needle-pin styles.")

with open(STYLES_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated styles.css successfully!")
