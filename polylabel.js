'use strict';

var Queue = require('tinyqueue');

module.exports = polylabel;
module.exports.default = polylabel;
//Description:
//rectangleSize(width, height, rotateIterationStep)
function polylabel(polygon, rectangleSize, precision, debug) {

    var cell = gridAlgorithm(polygon, precision, debug);
    if(rectangleSize === undefined) {
        if (cell instanceof Cell) {
            return [cell.x, cell.y];
        }
        return cell;
    } else {
        var isValid = false, rectBoundDst, shiftCounts, rect;
        if(cell instanceof Cell) {
            rect = getRectangleBounds(cell.x, cell.y, rectangleSize);
        } else {
            rect = getRectangleBounds(cell[0], cell[1], rectangleSize);
        }

        var ck = 1;
        while(
            !isValid
            &&
            !(Math.abs(rect[5]) > 4)
        ) {

            var res;
            rect = getRotatedRectangleBounds(rect, rectangleSize[2]);
            console.log(rect);
            res = verifyBound(rect, polygon);
            isValid = res[0];
            rectBoundDst = res[1];
            res = shiftRectangle(rect, rectBoundDst);
            shiftCounts = res[0];
            rect = res[1];
            break;
            if(shiftCounts < 0) {
                break;
            }
            // ck++;
            // if(ck > 4) {
            //     return;
            // }
            // console.log(rect);
            // console.log( verifyBound(rect, polygon) );
            // console.log(Math.abs(rect[5]) > 4 );
        }
        return rect;
    }
}



function gridAlgorithm(polygon, precision, debug) {
    precision = precision || 1.0;

    // find the bounding box of the outer ring
    var minX, minY, maxX, maxY;
    for (var i = 0; i < polygon[0].length; i++) {
        var p = polygon[0][i];
        if (!i || p[0] < minX) minX = p[0];
        if (!i || p[1] < minY) minY = p[1];
        if (!i || p[0] > maxX) maxX = p[0];
        if (!i || p[1] > maxY) maxY = p[1];
    }

    var width = maxX - minX;
    var height = maxY - minY;
    var cellSize = Math.min(width, height);
    var h = cellSize / 2;

    // a priority queue of cells in order of their "potential" (max distance to polygon)
    var cellQueue = new Queue(null, compareMax);

    if (cellSize === 0) return [minX, minY];

    // cover polygon with initial cells
    for (var x = minX; x < maxX; x += cellSize) {
        for (var y = minY; y < maxY; y += cellSize) {
            cellQueue.push(new Cell(x + h, y + h, h, polygon));
        }
    }

    // take centroid as the first best guess
    var bestCell = getCentroidCell(polygon);

    // special case for rectangular polygons
    var bboxCell = new Cell(minX + width / 2, minY + height / 2, 0, polygon);
    if (bboxCell.d > bestCell.d) bestCell = bboxCell;

    var numProbes = cellQueue.length;

    while (cellQueue.length) {
        // pick the most promising cell from the queue
        var cell = cellQueue.pop();

        // update the best cell if we found a better one
        if (cell.d > bestCell.d) {
            bestCell = cell;
            if (debug) console.log('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
        }

        // do not drill down further if there's no chance of a better solution
        if (cell.max - bestCell.d <= precision) continue;

        // split the cell into four cells
        h = cell.h / 2;
        cellQueue.push(new Cell(cell.x - h, cell.y - h, h, polygon));
        cellQueue.push(new Cell(cell.x + h, cell.y - h, h, polygon));
        cellQueue.push(new Cell(cell.x - h, cell.y + h, h, polygon));
        cellQueue.push(new Cell(cell.x + h, cell.y + h, h, polygon));
        numProbes += 4;
    }

    if (debug) {
        console.log('num probes: ' + numProbes);
        console.log('best distance: ' + bestCell.d);
    }

    return bestCell;
}

function getRectangleBounds(x, y, size) {
    var dx = size[0] / 2,
        dy = size[1] / 2;

    return [
        [x-dx, y - dy],
        [x+dx, y - dy],
        [x+dx, y + dy],
        [x-dx, y + dy],
        [x, y]
    ];
}

function getRotatedRectangleBounds(bounds, angle) {
    var sinT = Math.sin(angle),
        cosT = Math.cos(angle),
        x, y, dx, dy, cx, cy,
        rotatedBounds = [],
        center = bounds[4],
        i = 0;

    for (; i < 4; i++) {
        x = bounds[i][0];
        y = bounds[i][1];
        cx = x - center[0];
        cy = y - center[1];
        dx = cx * cosT - cy * sinT + center[0];
        dy = cx * sinT + cy * cosT + center[1];
        rotatedBounds[i] = [dx, dy];
    }
    //angle as last element of array
    if(bounds.length > 5) {
        rotatedBounds[5] = bounds[5] + angle;
    } else {
        rotatedBounds[5] = angle;
    }

    rotatedBounds[4] = center;
    return rotatedBounds;
}

function verifyBound(bounds, polygon) {
    var isValid = true, i = 0, boundsDist = [];
    for(; i < 4; i++) {
        var dist = pointToPolygonDist(bounds[i][0], bounds[i][1], polygon);
        boundsDist[i] = dist;
        if(dist < 0) {
            isValid = false;
        }
    }
    return [isValid, boundsDist];
}

function shiftRectangle(bounds, boundsDist) {
    var i = 0, shiftDist, shiftIndex = [], shiftCount = 0, dx, dy;
    for(; i < 4; i++) {
        if(boundsDist[i] < 0) {
            shiftIndex.push(i);
            shiftDist = boundsDist[i];
            shiftCount++;
        }
    }

    if(shiftCount === 1) {
        shiftIndex = shiftIndex[0];
        dx = (shiftIndex === 0 || shiftIndex === 3) ? shiftDist : -shiftDist;
        dy = (shiftIndex === 2 || shiftIndex === 3) ? shiftDist : -shiftDist;
        i = 0;
        for(; i < 5; i++) {
            bounds[i][0] += dx;
            bounds[i][1] += dy;
        }
    }
    if(shiftCount === 2) {
        shiftDist = Math.max(boundsDist[shiftIndex[0]], boundsDist[shiftIndex[1]]);
        switch (shiftIndex[0] | shiftIndex[1]) {
            case 1 | 2:
            case 2 | 1:
                for(; i < 5; i++) {
                    bounds[i][1] -= shiftDist;
                }
                break;
            case 4 | 3:
            case 3 | 4:
                for(; i < 5; i++) {
                    bounds[i][1] += shiftDist;
                }
                break;
            case 3 | 2:
            case 2 | 3:
                for(; i < 5; i++) {
                    bounds[i][0] -= shiftDist;
                }
                break;
            case 4 | 1:
            case 1 | 4:
                for(; i < 5; i++) {
                    bounds[i][0] += shiftDist;
                }
                break;
            default:
                shiftCount = -1;
                break;
        }
    }
    return [shiftCount, bounds];
}

function compareMax(a, b) {
    return b.max - a.max;
}

function Cell(x, y, h, polygon) {
    this.x = x; // cell center x
    this.y = y; // cell center y
    this.h = h; // half the cell size
    this.d = pointToPolygonDist(x, y, polygon); // distance from cell center to polygon
    this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
}



// signed distance from point to polygon outline (negative if point is outside)
function pointToPolygonDist(x, y, polygon) {
    var inside = false;
    var minDistSq = Infinity;

    for (var k = 0; k < polygon.length; k++) {
        //Iterate for in-out side polygons
        var ring = polygon[k];

        for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
            var a = ring[i];
            var b = ring[j];

            // Check if point is inside fragment
            if ((a[1] > y !== b[1] > y) &&
                (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;

            minDistSq = Math.min(minDistSq, getSegDistSq(x, y, a, b));
        }
    }

    return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

// get polygon centroid
function getCentroidCell(polygon) {
    var area = 0;
    var x = 0;
    var y = 0;
    var points = polygon[0];

    for (var i = 0, len = points.length, j = len - 1; i < len; j = i++) {
        //example set:
        //   iteration 1: i = 0; j = 10
        //   iteration 2: i = 1; j = 0
        var a = points[i];
        var b = points[j];
        var f = a[0] * b[1] - b[0] * a[1];
        x += (a[0] + b[0]) * f;
        y += (a[1] + b[1]) * f;
        area += f * 3;
    }
    if (area === 0) return new Cell(points[0][0], points[0][1], 0, polygon);
    return new Cell(x / area, y / area, 0, polygon);
}

// get squared distance from a point to a segment
function getSegDistSq(px, py, a, b) {

    var x = a[0];
    var y = a[1];
    var dx = b[0] - x;
    var dy = b[1] - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = b[0];
            y = b[1];

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = px - x;
    dy = py - y;

    return dx * dx + dy * dy;
}
