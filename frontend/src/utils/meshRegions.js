/**
 * meshRegions — canonical face-mesh index sets (PRD Step 3 / manuscript
 * Sec. 3.3-D: "GET_CANONICAL_TRIANGLES(region) ... real anatomical
 * structure MediaPipe already provides").
 *
 * LIPS_OUTER, LIPS_INNER, and FACE_OVAL were extracted programmatically
 * from the installed @mediapipe/tasks-vision package's own exported
 * connection data (FaceLandmarker.FACE_LANDMARKS_LIPS /
 * FACE_LANDMARKS_FACE_OVAL). These are official, ordered rings: walk them
 * in order with ctx.moveTo/lineTo, then ctx.fill().
 *
 * Lips has two rings: the outer mouth boundary and the inner boundary
 * (where the lips meet). Fill with "evenodd" so the inner ring is cut out,
 * otherwise an open mouth gets painted solid.
 */

export const LIPS_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
  291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];

export const LIPS_INNER = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
  308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
];

// Whole-face boundary, single closed ring. Usable directly for the
// "full face" toggle (fill this ring with nonzero rule, no hole to cut).
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
  361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

/**
 * CHEEK_LEFT / CHEEK_RIGHT — MediaPipe does NOT export an official cheek
 * region (confirmed by checking every static export on the installed
 * FaceLandmarker: no FACE_LANDMARKS_CHEEK exists, unlike lips/eyes/oval).
 *
 * These indices are cross-referenced from two independent community
 * references documenting MediaPipe's 468-point topology (cheek surface
 * contour + cheekbone ridge points):
 *  - https://hackernoon.com/mediapipe-face-mesh-landmark-indices-cheat-sheet
 *  - https://dev.to/metsander/mediapipe-face-mesh-all-478-landmark-points-5ec8
 * Both list the same indices independently, and none collide with the
 * verified LIPS/FACE_OVAL sets above (234/127/162 and 454/356/389 sit
 * right on the FACE_OVAL boundary, which lines up anatomically — the
 * cheekbone ridge runs along the face's outer edge).
 *
 * "Left"/"right" follow MediaPipe's own convention: the SUBJECT's left and
 * right, not screen-left/right. CameraFeed mirrors the video for a normal
 * selfie view (scaleX(-1)), so screen-left shows the subject's right cheek.
 * Keep that in mind when Step 5 wires rendering to the mirrored canvas.
 */
export const CHEEK_LEFT = [36, 205, 206, 207, 187, 123, 116, 117, 118, 119, 100, 47, 234, 127, 162];
export const CHEEK_RIGHT = [266, 425, 426, 427, 411, 352, 345, 346, 347, 348, 329, 277, 454, 356, 389];

/**
 * orderRingByAngle — the cheek indices above are a documented point set,
 * not an official ordered boundary ring like LIPS/FACE_OVAL are. Drawing
 * them in list order risks a self-intersecting "bowtie" polygon instead of
 * a clean fill. This sorts a set of landmark indices into a proper
 * boundary loop by angle around their live centroid, every frame, using
 * whatever positions MediaPipe actually tracked (works for any face size
 * or head rotation, not a fixed-radius shape guessed in advance).
 *
 * @param {number[]} indices - landmark indices to order (e.g. CHEEK_LEFT)
 * @param {{x:number,y:number}[]} landmarks - full smoothed landmark array for the current frame
 * @returns {number[]} the same indices, reordered into a non-self-intersecting ring
 */
export function orderRingByAngle(indices, landmarks) {
  const points = indices.map((i) => ({ i, x: landmarks[i].x, y: landmarks[i].y }));
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
    .map((p) => p.i);
}

/**
 * EYE_LEFT / EYE_RIGHT — official MediaPipe eye boundary rings (unlike
 * cheeks, no approximation needed here — extracted the same way as
 * LIPS/FACE_OVAL, from FaceLandmarker.FACE_LANDMARKS_LEFT_EYE /
 * FACE_LANDMARKS_RIGHT_EYE). Each is one closed 16-point ring covering the
 * full eye opening (upper lid + lower lid).
 */
export const EYE_LEFT = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const EYE_RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

/**
 * EYEBROW_LEFT_A/B, EYEBROW_RIGHT_A/B — official MediaPipe eyebrow rings.
 * Each eyebrow exports as TWO 5-point rings (the brow shape's upper edge
 * and lower edge), not one — which one is "lower" (closer to the eye,
 * the boundary we actually want for eyeshadow) isn't knowable from the
 * index order alone, so pickCloserRing() below decides at render time
 * using the live tracked positions instead of a guessed assumption.
 */
export const EYEBROW_LEFT_A = [276, 283, 282, 295, 285];
export const EYEBROW_LEFT_B = [300, 293, 334, 296, 336];
export const EYEBROW_RIGHT_A = [46, 53, 52, 65, 55];
export const EYEBROW_RIGHT_B = [70, 63, 105, 66, 107];

/**
 * upperArc — splits a closed eye ring into just its upper-lid points, by
 * comparing each point's live y-position against the ring's own centroid
 * (smaller y = higher on screen = upper lid, in MediaPipe's normalized
 * image coordinates where y increases downward). Computed fresh every
 * frame from real tracked positions rather than hardcoding which static
 * indices are "upper", since that role isn't given by the index order.
 *
 * Two uses:
 *  - Eyeliner: trace this arc directly as a stroke along the lash line.
 *  - Eyeshadow: combine this arc with the eyebrow's closer ring (see
 *    pickCloserRing) as the two boundaries of a fillable region.
 */
export function upperArc(ringIndices, landmarks) {
  const centroidY = ringIndices.reduce((sum, i) => sum + landmarks[i].y, 0) / ringIndices.length;
  return ringIndices.filter((i) => landmarks[i].y <= centroidY);
}

/**
 * pickCloserRing — given an eyebrow's two rings, returns whichever sits
 * closer to the eye (larger average y = lower on screen, nearer the eye,
 * since the eyebrow as a whole sits above it). Same "verify from live
 * geometry, don't hardcode a role for a static index" approach as
 * upperArc.
 */
export function pickCloserRing(ringA, ringB, landmarks) {
  const avgY = (ring) => ring.reduce((sum, i) => sum + landmarks[i].y, 0) / ring.length;
  return avgY(ringA) > avgY(ringB) ? ringA : ringB;
}
