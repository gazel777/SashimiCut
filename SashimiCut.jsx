/*
  SashimiCut.jsx — Illustrator Script
  Cut selected paths along any straight line (horizontal, vertical, 45°, or any angle).
  Supports multiple cutting lines — slice objects into grids in one action.

  Usage:
    1. Draw one or more straight lines (horizontal and/or vertical) as cutting guides
    2. Select the cutting line(s) + target paths
    3. Run File > Scripts > SashimiCut.jsx
    4. Objects are split at all cutting lines

  Requires: Adobe Illustrator CS6+
  License: MIT
  Author: FrameTools (https://x.com/FrameTools01)
*/

(function () {
  // ============================================================
  // Constants
  // ============================================================
  var TOLERANCE = 0.01; // pt precision
  var EPSILON = 1e-10;
  var ANGLE_TOLERANCE = 0.5; // degrees — tolerance for H/V detection

  // ============================================================
  // Entry Point
  // ============================================================
  if (app.documents.length === 0) {
    alert("No document open.");
    return;
  }
  var doc = app.activeDocument;
  var sel = doc.selection;

  if (!sel || sel.length < 2) {
    alert(
      "SashimiCut\n\nSelect a cutting line (horizontal or vertical) and one or more target paths, then run this script."
    );
    return;
  }

  // ============================================================
  // 1. Identify cutting line vs target paths
  // ============================================================
  // Flatten selection: extract PathItems from groups and compound paths
  var allPaths = [];
  function collectPaths(items) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.typename === "PathItem") {
        allPaths.push(item);
      } else if (item.typename === "CompoundPathItem") {
        collectPaths(item.pathItems);
      } else if (item.typename === "GroupItem") {
        collectPaths(item.pageItems);
      }
    }
  }
  collectPaths(sel);

  if (allPaths.length < 2) {
    alert(
      "SashimiCut\n\nSelect a cutting line (horizontal or vertical) and one or more target paths."
    );
    return;
  }

  // Find ALL cutting lines and separate from targets
  var cuttingLines = [];
  var targets = [];

  for (var i = 0; i < allPaths.length; i++) {
    if (isCuttingLine(allPaths[i])) {
      cuttingLines.push(allPaths[i]);
    } else {
      targets.push(allPaths[i]);
    }
  }

  if (cuttingLines.length === 0) {
    alert(
      "SashimiCut\n\nNo cutting line found.\nDraw a straight horizontal or vertical line and include it in your selection."
    );
    return;
  }
  if (targets.length === 0) {
    alert(
      "SashimiCut\n\nNo target paths found.\nSelect at least one path to cut in addition to the cutting line(s)."
    );
    return;
  }

  // Build cut info for each cutting line
  var cutInfos = [];
  for (var ci = 0; ci < cuttingLines.length; ci++) {
    cutInfos.push(getCutInfo(cuttingLines[ci]));
  }

  // ============================================================
  // 2. Process each cutting line in sequence
  // ============================================================
  app.executeMenuCommand("deselectall");

  var currentTargets = targets;
  for (var ci = 0; ci < cutInfos.length; ci++) {
    var nextTargets = [];
    for (var t = 0; t < currentTargets.length; t++) {
      var results = splitPathMulti(currentTargets[t], cutInfos[ci]);
      for (var r = 0; r < results.length; r++) {
        nextTargets.push(results[r]);
      }
    }
    currentTargets = nextTargets;
  }

  // Remove all cutting lines
  for (var ci = 0; ci < cuttingLines.length; ci++) {
    cuttingLines[ci].remove();
  }

  // ============================================================
  // Helper: Detect if a path is a cutting line (2-point straight line, any angle)
  // ============================================================
  function isCuttingLine(path) {
    if (path.pathPoints.length !== 2) return false;
    var p0 = path.pathPoints[0];
    var p1 = path.pathPoints[1];
    // Must be straight (handles == anchors)
    if (!isStraightPoint(p0) || !isStraightPoint(p1)) return false;
    // Must have some length
    var a0 = p0.anchor;
    var a1 = p1.anchor;
    var dx = Math.abs(a1[0] - a0[0]);
    var dy = Math.abs(a1[1] - a0[1]);
    return (dx > TOLERANCE || dy > TOLERANCE);
  }

  function isStraightPoint(pp) {
    var a = pp.anchor;
    var l = pp.leftDirection;
    var r = pp.rightDirection;
    return (
      Math.abs(a[0] - l[0]) < TOLERANCE &&
      Math.abs(a[1] - l[1]) < TOLERANCE &&
      Math.abs(a[0] - r[0]) < TOLERANCE &&
      Math.abs(a[1] - r[1]) < TOLERANCE
    );
  }

  function getCutInfo(line) {
    var a0 = line.pathPoints[0].anchor;
    var a1 = line.pathPoints[1].anchor;
    // General line equation: la*x + lb*y + lc = 0
    // From two points: (y0-y1)*x + (x1-x0)*y + (x0*y1 - x1*y0) = 0
    var la = a0[1] - a1[1];
    var lb = a1[0] - a0[0];
    var lc = a0[0] * a1[1] - a1[0] * a0[1];
    // Normalize so that la^2 + lb^2 = 1 (unit normal)
    var len = Math.sqrt(la * la + lb * lb);
    la /= len;
    lb /= len;
    lc /= len;
    return { la: la, lb: lb, lc: lc };
  }

  // ============================================================
  // 3. Main splitting logic — returns array of resulting PathItems
  // ============================================================
  function splitPathMulti(path, cut) {
    var pts = path.pathPoints;
    var isClosed = path.closed;
    var segCount = isClosed ? pts.length : pts.length - 1;

    // Collect all intersections: { segIndex, t, point }
    var intersections = [];
    for (var s = 0; s < segCount; s++) {
      var s1 = s;
      var s2 = (s + 1) % pts.length;
      var seg = getSegment(pts[s1], pts[s2]);
      var ts = findIntersections(seg, cut);
      for (var ti = 0; ti < ts.length; ti++) {
        var pt = evalBezier(seg, ts[ti]);
        intersections.push({ segIndex: s, t: ts[ti], point: pt });
      }
    }

    if (intersections.length === 0) return [path]; // No intersection, return original

    // Sort intersections by segment index, then by t
    intersections.sort(function (a, b) {
      if (a.segIndex !== b.segIndex) return a.segIndex - b.segIndex;
      return a.t - b.t;
    });

    if (isClosed) {
      return splitClosedPath(path, cut, intersections);
    } else {
      return splitOpenPath(path, cut, intersections);
    }
  }

  // ============================================================
  // Segment extraction from PathPoints
  // ============================================================
  function getSegment(pp0, pp1) {
    // Returns cubic bezier control points [P0, P1, P2, P3]
    return [
      [pp0.anchor[0], pp0.anchor[1]],
      [pp0.rightDirection[0], pp0.rightDirection[1]],
      [pp1.leftDirection[0], pp1.leftDirection[1]],
      [pp1.anchor[0], pp1.anchor[1]],
    ];
  }

  // ============================================================
  // 4. Bezier-line intersection (general line: la*x + lb*y + lc = 0)
  // ============================================================
  function findIntersections(seg, cut) {
    // seg = [P0, P1, P2, P3] cubic bezier
    // cut = { la, lb, lc } — line equation la*x + lb*y + lc = 0
    // Compute f(t) = la*Bx(t) + lb*By(t) + lc = 0
    // where B(t) is the cubic bezier

    // Evaluate la*x + lb*y + lc at each control point
    var f0 = cut.la * seg[0][0] + cut.lb * seg[0][1] + cut.lc;
    var f1 = cut.la * seg[1][0] + cut.lb * seg[1][1] + cut.lc;
    var f2 = cut.la * seg[2][0] + cut.lb * seg[2][1] + cut.lc;
    var f3 = cut.la * seg[3][0] + cut.lb * seg[3][1] + cut.lc;

    // Convert to polynomial: a*t^3 + b*t^2 + c*t + d = 0
    var a = -f0 + 3 * f1 - 3 * f2 + f3;
    var b = 3 * f0 - 6 * f1 + 3 * f2;
    var c = -3 * f0 + 3 * f1;
    var d = f0;

    var roots = solveCubic(a, b, c, d);
    var validRoots = [];
    for (var i = 0; i < roots.length; i++) {
      var t = roots[i];
      if (t > EPSILON && t < 1 - EPSILON) {
        validRoots.push(t);
      }
    }
    return validRoots;
  }

  // ============================================================
  // 5. Cubic equation solver (Cardano)
  // ============================================================
  function solveCubic(a, b, c, d) {
    // Handle degenerate cases
    if (Math.abs(a) < EPSILON) {
      return solveQuadratic(b, c, d);
    }

    // Normalize
    var bn = b / a;
    var cn = c / a;
    var dn = d / a;

    var p = (3 * cn - bn * bn) / 3;
    var q = (2 * bn * bn * bn - 9 * bn * cn + 27 * dn) / 27;
    var disc = (q * q) / 4 + (p * p * p) / 27;

    var roots = [];
    if (Math.abs(disc) < EPSILON) {
      // Multiple roots
      if (Math.abs(q) < EPSILON) {
        roots.push(-bn / 3);
      } else {
        var u = cubeRoot(-q / 2);
        roots.push(2 * u - bn / 3);
        roots.push(-u - bn / 3);
      }
    } else if (disc > 0) {
      // One real root
      var sqrtDisc = Math.sqrt(disc);
      var u1 = cubeRoot(-q / 2 + sqrtDisc);
      var u2 = cubeRoot(-q / 2 - sqrtDisc);
      roots.push(u1 + u2 - bn / 3);
    } else {
      // Three real roots (casus irreducibilis)
      var r = Math.sqrt((-p * p * p) / 27);
      var theta = Math.acos((-q / 2) / r);
      var m = 2 * cubeRoot(r);
      roots.push(m * Math.cos(theta / 3) - bn / 3);
      roots.push(m * Math.cos((theta + 2 * Math.PI) / 3) - bn / 3);
      roots.push(m * Math.cos((theta + 4 * Math.PI) / 3) - bn / 3);
    }
    return roots;
  }

  function solveQuadratic(a, b, c) {
    if (Math.abs(a) < EPSILON) {
      if (Math.abs(b) < EPSILON) return [];
      return [-c / b];
    }
    var disc = b * b - 4 * a * c;
    if (disc < -EPSILON) return [];
    if (disc < EPSILON) return [-b / (2 * a)];
    var sq = Math.sqrt(disc);
    return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
  }

  function cubeRoot(v) {
    if (v < 0) return -Math.pow(-v, 1 / 3);
    return Math.pow(v, 1 / 3);
  }

  // ============================================================
  // 6. Bezier evaluation and De Casteljau split
  // ============================================================
  function evalBezier(seg, t) {
    var mt = 1 - t;
    var mt2 = mt * mt;
    var t2 = t * t;
    return [
      mt2 * mt * seg[0][0] +
        3 * mt2 * t * seg[1][0] +
        3 * mt * t2 * seg[2][0] +
        t2 * t * seg[3][0],
      mt2 * mt * seg[0][1] +
        3 * mt2 * t * seg[1][1] +
        3 * mt * t2 * seg[2][1] +
        t2 * t * seg[3][1],
    ];
  }

  function splitBezierAt(seg, t) {
    // De Casteljau — returns { left: [P0..P3], right: [P0..P3] }
    var p0 = seg[0],
      p1 = seg[1],
      p2 = seg[2],
      p3 = seg[3];

    var p01 = lerp2d(p0, p1, t);
    var p12 = lerp2d(p1, p2, t);
    var p23 = lerp2d(p2, p3, t);
    var p012 = lerp2d(p01, p12, t);
    var p123 = lerp2d(p12, p23, t);
    var p0123 = lerp2d(p012, p123, t);

    return {
      left: [p0, p01, p012, p0123],
      right: [p0123, p123, p23, p3],
    };
  }

  function lerp2d(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // ============================================================
  // 7. Split open path
  // ============================================================
  function splitOpenPath(path, cut, intersections) {
    var pts = path.pathPoints;
    // Build sub-paths by walking segments and splitting at intersections
    var subPaths = [];
    var currentPoints = []; // array of { anchor, leftDir, rightDir }

    // Intersection lookup: segIndex -> [list of {t, point}] sorted by t
    var interMap = {};
    for (var i = 0; i < intersections.length; i++) {
      var ix = intersections[i];
      if (!interMap[ix.segIndex]) interMap[ix.segIndex] = [];
      interMap[ix.segIndex].push(ix);
    }

    var segCount = pts.length - 1;
    // Start with first point
    currentPoints.push({
      anchor: [pts[0].anchor[0], pts[0].anchor[1]],
      leftDirection: [pts[0].leftDirection[0], pts[0].leftDirection[1]],
      rightDirection: [pts[0].rightDirection[0], pts[0].rightDirection[1]],
    });

    for (var s = 0; s < segCount; s++) {
      var seg = getSegment(pts[s], pts[s + 1]);
      var segInters = interMap[s] || [];

      if (segInters.length === 0) {
        // No intersection — add end point
        currentPoints.push({
          anchor: [pts[s + 1].anchor[0], pts[s + 1].anchor[1]],
          leftDirection: [
            pts[s + 1].leftDirection[0],
            pts[s + 1].leftDirection[1],
          ],
          rightDirection: [
            pts[s + 1].rightDirection[0],
            pts[s + 1].rightDirection[1],
          ],
        });
      } else {
        // Split segment at each intersection
        var remainingSeg = seg;
        var usedT = 0;
        for (var j = 0; j < segInters.length; j++) {
          var rawT = segInters[j].t;
          // Remap t to remaining segment
          var localT = (rawT - usedT) / (1 - usedT);
          if (localT <= EPSILON || localT >= 1 - EPSILON) continue;

          var split = splitBezierAt(remainingSeg, localT);

          // Update last point's right direction
          currentPoints[currentPoints.length - 1].rightDirection = [
            split.left[1][0],
            split.left[1][1],
          ];
          // Add intersection point as end of current sub-path
          currentPoints.push({
            anchor: [split.left[3][0], split.left[3][1]],
            leftDirection: [split.left[2][0], split.left[2][1]],
            rightDirection: [split.left[3][0], split.left[3][1]], // placeholder
          });

          // Save current sub-path
          subPaths.push(currentPoints);

          // Start new sub-path from intersection
          currentPoints = [];
          currentPoints.push({
            anchor: [split.right[0][0], split.right[0][1]],
            leftDirection: [split.right[0][0], split.right[0][1]], // placeholder
            rightDirection: [split.right[1][0], split.right[1][1]],
          });

          remainingSeg = split.right;
          usedT = rawT;
        }

        // Add final point of this segment
        currentPoints[currentPoints.length - 1].rightDirection = [
          remainingSeg[1][0],
          remainingSeg[1][1],
        ];
        currentPoints.push({
          anchor: [remainingSeg[3][0], remainingSeg[3][1]],
          leftDirection: [remainingSeg[2][0], remainingSeg[2][1]],
          rightDirection: [
            pts[s + 1].rightDirection[0],
            pts[s + 1].rightDirection[1],
          ],
        });
      }
    }
    // Final sub-path
    if (currentPoints.length > 0) {
      subPaths.push(currentPoints);
    }

    if (subPaths.length < 2) return [path]; // Nothing to split

    // Create new paths
    var layer = path.layer;
    var results = [];
    for (var sp = 0; sp < subPaths.length; sp++) {
      results.push(createPathFromPoints(layer, subPaths[sp], false, path));
    }

    // Remove original
    path.remove();
    return results;
  }

  // ============================================================
  // 8. Split closed path
  // ============================================================
  function splitClosedPath(path, cut, intersections) {
    if (intersections.length < 2) {
      // Need at least 2 intersections to split a closed path
      return;
    }

    var pts = path.pathPoints;
    var segCount = pts.length;

    // Build intersection map
    var interMap = {};
    for (var i = 0; i < intersections.length; i++) {
      var ix = intersections[i];
      if (!interMap[ix.segIndex]) interMap[ix.segIndex] = [];
      interMap[ix.segIndex].push(ix);
    }

    // For a closed path with 2 intersections, we create 2 closed sub-paths
    // Walk segments, splitting at intersections, alternate between two groups
    var groups = [[], []];
    var currentGroup = 0;
    var groupStarted = false;

    // We need to "unroll" the closed path starting from the first intersection
    // Rebuild all segments with splits, then partition into 2 closed paths

    // Step 1: Build a linear sequence of points with splits
    var allPoints = [];
    var splitIndices = []; // indices in allPoints where splits happen

    for (var s = 0; s < segCount; s++) {
      var s2 = (s + 1) % pts.length;
      var seg = getSegment(pts[s], pts[s2]);
      var segInters = interMap[s] || [];

      // Add start point of segment (avoid duplicate)
      if (allPoints.length === 0 || s > 0) {
        allPoints.push({
          anchor: [pts[s].anchor[0], pts[s].anchor[1]],
          leftDirection: [pts[s].leftDirection[0], pts[s].leftDirection[1]],
          rightDirection: [pts[s].rightDirection[0], pts[s].rightDirection[1]],
        });
      }

      if (segInters.length === 0) {
        // No split — we'll add end point in the next iteration (or handle last)
        if (s === segCount - 1) {
          // Last segment of closed path — end point is pts[0], already handled
        }
      } else {
        var remainingSeg = seg;
        var usedT = 0;
        for (var j = 0; j < segInters.length; j++) {
          var rawT = segInters[j].t;
          var localT = (rawT - usedT) / (1 - usedT);
          if (localT <= EPSILON || localT >= 1 - EPSILON) continue;

          var split = splitBezierAt(remainingSeg, localT);

          // Update last point's rightDirection
          allPoints[allPoints.length - 1].rightDirection = [
            split.left[1][0],
            split.left[1][1],
          ];

          // Add intersection point
          allPoints.push({
            anchor: [split.left[3][0], split.left[3][1]],
            leftDirection: [split.left[2][0], split.left[2][1]],
            rightDirection: [split.right[1][0], split.right[1][1]],
          });
          splitIndices.push(allPoints.length - 1);

          remainingSeg = split.right;
          usedT = rawT;
        }
        // Update rightDir for the last point before the end
        allPoints[allPoints.length - 1].rightDirection = [
          remainingSeg[1][0],
          remainingSeg[1][1],
        ];

        // If this is the last segment, the end point is the start of allPoints
        if (s < segCount - 1) {
          allPoints.push({
            anchor: [remainingSeg[3][0], remainingSeg[3][1]],
            leftDirection: [remainingSeg[2][0], remainingSeg[2][1]],
            rightDirection: [
              pts[s2].rightDirection[0],
              pts[s2].rightDirection[1],
            ],
          });
        } else {
          // Last segment — update the first point's leftDirection
          allPoints[0].leftDirection = [
            remainingSeg[2][0],
            remainingSeg[2][1],
          ];
        }
      }
    }

    // If no actual splits happened, bail
    if (splitIndices.length < 2) return;

    // Step 2: Partition points into 2 closed paths
    // Use first 2 split points to divide the ring
    var idx1 = splitIndices[0];
    var idx2 = splitIndices[1];

    var path1Points = [];
    var path2Points = [];

    // Path 1: from idx1 to idx2 (inclusive)
    for (var k = idx1; k !== (idx2 + 1) % allPoints.length; k = (k + 1) % allPoints.length) {
      path1Points.push(clonePoint(allPoints[k]));
      if (path1Points.length > allPoints.length + 1) break; // safety
    }

    // Path 2: from idx2 to idx1 (inclusive)
    for (var k = idx2; k !== (idx1 + 1) % allPoints.length; k = (k + 1) % allPoints.length) {
      path2Points.push(clonePoint(allPoints[k]));
      if (path2Points.length > allPoints.length + 1) break; // safety
    }

    if (path1Points.length < 2 || path2Points.length < 2) return [path];

    // Fix cut edges: the closing segment (last→first) must be straight
    straightenCutEdge(path1Points);
    straightenCutEdge(path2Points);

    // Create new closed paths
    var layer = path.layer;
    var results = [];
    results.push(createPathFromPoints(layer, path1Points, true, path));
    results.push(createPathFromPoints(layer, path2Points, true, path));

    // Remove original
    path.remove();
    return results;
  }

  function straightenCutEdge(pts) {
    // For a closed sub-path, the segment from last→first is the cut edge.
    // Make it a straight line by setting handles = anchors on that segment.
    var last = pts[pts.length - 1];
    var first = pts[0];
    last.rightDirection = [last.anchor[0], last.anchor[1]];
    first.leftDirection = [first.anchor[0], first.anchor[1]];
  }

  function clonePoint(p) {
    return {
      anchor: [p.anchor[0], p.anchor[1]],
      leftDirection: [p.leftDirection[0], p.leftDirection[1]],
      rightDirection: [p.rightDirection[0], p.rightDirection[1]],
    };
  }

  // ============================================================
  // 9. Create a new PathItem from point data
  // ============================================================
  function createPathFromPoints(layer, pointsArr, closed, origPath) {
    var newPath = layer.pathItems.add();

    // Copy style from original
    copyStyle(origPath, newPath);
    newPath.closed = closed;

    // Set path points
    newPath.setEntirePath(
      map(pointsArr, function (p) {
        return p.anchor;
      })
    );

    // Set handles
    for (var i = 0; i < pointsArr.length; i++) {
      var pp = newPath.pathPoints[i];
      pp.leftDirection = pointsArr[i].leftDirection;
      pp.rightDirection = pointsArr[i].rightDirection;
      pp.pointType = PointType.SMOOTH;
    }

    return newPath;
  }

  // ============================================================
  // 10. Copy style properties
  // ============================================================
  function copyStyle(src, dst) {
    // Stroke
    dst.stroked = src.stroked;
    if (src.stroked) {
      dst.strokeColor = src.strokeColor;
      dst.strokeWidth = src.strokeWidth;
      dst.strokeCap = src.strokeCap;
      dst.strokeJoin = src.strokeJoin;
      dst.strokeMiterLimit = src.strokeMiterLimit;
      try {
        dst.strokeDashes = src.strokeDashes;
      } catch (e) {}
    }
    // Fill
    dst.filled = src.filled;
    if (src.filled) {
      dst.fillColor = src.fillColor;
    }
    // Opacity
    dst.opacity = src.opacity;
  }

  // ============================================================
  // Utility: map (ExtendScript has no Array.map)
  // ============================================================
  function map(arr, fn) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      result.push(fn(arr[i], i));
    }
    return result;
  }
})();
