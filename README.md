# GuillotineCut.jsx

Cut selected paths along a horizontal or vertical line in Adobe Illustrator — **without outlining strokes**.

## How to Use

1. Draw a straight **horizontal or vertical line** where you want to cut
2. **Select** the cutting line + the target path(s)
3. Go to **File > Scripts > Other Script...** and choose `GuillotineCut.jsx`
4. Done — your objects are split at the line

![concept](https://via.placeholder.com/400x200?text=Before+→+After)

## Features

- Works on **stroked paths** (no need to outline/expand)
- Works on **open and closed paths**
- Handles **bezier curves** (not just straight segments)
- Preserves stroke color, width, dashes, fill, and opacity
- Cuts **multiple objects** at once
- Horizontal and vertical cutting

## Requirements

- Adobe Illustrator CS6 or later (tested on CC 2019–2025)
- macOS or Windows

## Installation (Optional)

To add as a permanent script in Illustrator:

1. Copy `GuillotineCut.jsx` to:
   - **Mac**: `/Applications/Adobe Illustrator 2025/Presets/en_US/Scripts/`
   - **Win**: `C:\Program Files\Adobe\Adobe Illustrator 2025\Presets\en_US\Scripts\`
2. Restart Illustrator
3. Access from **File > Scripts > GuillotineCut**

## Limitations (MVP)

- Horizontal or vertical cuts only (no diagonal)
- Does not work on compound paths (yet)
- Does not cut grouped objects (ungroup first)
- Does not cut text (convert to outlines first)

## License

MIT — free to use, modify, and distribute.

## Author

FrameTools — https://x.com/FrameTools01
