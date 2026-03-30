# SashimiCut.jsx

Cut selected paths along any straight line in Adobe Illustrator — **without outlining strokes**. Horizontal, vertical, 45°, any angle. Multiple lines at once.

## How to Use

1. Draw one or more **straight lines** where you want to cut (any angle)
2. **Select** the cutting line(s) + the target path(s)
3. Go to **File > Scripts > Other Script...** and choose `SashimiCut.jsx`
4. Done — your objects are split at the line(s)


## Features

- Works on **stroked paths** (no need to outline/expand)
- Works on **open and closed paths**
- Handles **bezier curves** (not just straight segments)
- Preserves stroke color, width, dashes, fill, and opacity
- Cuts **multiple objects** at once
- **Any angle** — horizontal, vertical, 45°, or arbitrary
- **Multiple cutting lines** at once — grid-slice in one action

## Requirements

- Adobe Illustrator CS6 or later (tested on CC 2019–2025)
- macOS or Windows

## Installation (Optional)

To add as a permanent script in Illustrator:

1. Copy `SashimiCut.jsx` to:
   - **Mac**: `/Applications/Adobe Illustrator 2025/Presets/en_US/Scripts/`
   - **Win**: `C:\Program Files\Adobe\Adobe Illustrator 2025\Presets\en_US\Scripts\`
2. Restart Illustrator
3. Access from **File > Scripts > SashimiCut**

## Keyboard Shortcut (Recommended)

Assign a shortcut so you can run SashimiCut with one key:

1. Open **Window > Actions**
2. Click the **New Action** button (folder icon first if needed)
3. Name it `SashimiCut`, assign a **Function Key** (e.g. `F5`), click **Record**
4. Go to **File > Scripts > Other Script...** and select `SashimiCut.jsx`
5. Click **Stop Recording** in the Actions panel

Now your workflow is:

> Draw line(s) → Select all → **F5** → Done

## Limitations (MVP)

- ~~Horizontal or vertical cuts only~~ Now supports any angle!
- Does not work on compound paths (yet)
- Does not cut grouped objects (ungroup first)
- Does not cut text (convert to outlines first)

## License

MIT — free to use, modify, and distribute.

## Author

Hiro — https://x.com/hiro_11go
