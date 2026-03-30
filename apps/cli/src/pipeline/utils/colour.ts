// Port of colour.js to TypeScript for deltaE00 color comparison

export class Colour {
  /**
   * Convert RGBA to LAB color space
   */
  static rgba2lab(r: number, g: number, b: number, a: number = 1): [number, number, number] {
    const [x, y, z] = Colour.rgb2xyz(r, g, b, a);
    return Colour.xyz2lab(x, y, z);
  }

  /**
   * Convert RGB to XYZ color space
   */
  static rgb2xyz(r: number, g: number, b: number, a: number = 1): [number, number, number] {
    // Clamp values
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    a = Math.max(0, Math.min(1, a));

    // Normalize to 0-1
    let rNorm = r / 255;
    let gNorm = g / 255;
    let bNorm = b / 255;

    // Apply gamma correction
    if (rNorm > 0.04045) {
      rNorm = Math.pow((rNorm + 0.055) / 1.055, 2.4);
    } else {
      rNorm = rNorm / 12.92;
    }
    if (gNorm > 0.04045) {
      gNorm = Math.pow((gNorm + 0.055) / 1.055, 2.4);
    } else {
      gNorm = gNorm / 12.92;
    }
    if (bNorm > 0.04045) {
      bNorm = Math.pow((bNorm + 0.055) / 1.055, 2.4);
    } else {
      bNorm = bNorm / 12.92;
    }

    // Scale
    rNorm = rNorm * 100;
    gNorm = gNorm * 100;
    bNorm = bNorm * 100;

    // Convert to XYZ using D65 illuminant
    const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
    const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175;
    const z = rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041;

    return [x, y, z];
  }

  /**
   * Convert XYZ to LAB color space
   */
  static xyz2lab(x: number, y: number, z: number): [number, number, number] {
    // D65 illuminant (CIE 1964 10° observer)
    const referenceX = 94.811;
    const referenceY = 100;
    const referenceZ = 107.304;

    // Normalize
    let xNorm = x / referenceX;
    let yNorm = y / referenceY;
    let zNorm = z / referenceZ;

    // Apply function
    if (xNorm > 0.008856) {
      xNorm = Math.pow(xNorm, 1 / 3);
    } else {
      xNorm = 7.787 * xNorm + 16 / 116;
    }
    if (yNorm > 0.008856) {
      yNorm = Math.pow(yNorm, 1 / 3);
    } else {
      yNorm = 7.787 * yNorm + 16 / 116;
    }
    if (zNorm > 0.008856) {
      zNorm = Math.pow(zNorm, 1 / 3);
    } else {
      zNorm = 7.787 * zNorm + 16 / 116;
    }

    // Calculate LAB
    const l = 116 * yNorm - 16;
    const a = 500 * (xNorm - yNorm);
    const b = 200 * (yNorm - zNorm);

    return [l, a, b];
  }

  /**
   * Calculate deltaE00 - perceptual color difference
   * Returns a number where:
   * < 1: imperceptible
   * 1-2: perceptible through close observation
   * 2-10: perceptible at a glance
   * 11-49: colors are more similar than different
   * > 50: completely different colors
   */
  static deltaE00(
    l1: number,
    a1: number,
    b1: number,
    l2: number,
    a2: number,
    b2: number
  ): number {
    // Helper functions
    const rad2deg = (rad: number) => (360 * rad) / (2 * Math.PI);
    const deg2rad = (deg: number) => (2 * Math.PI * deg) / 360;

    const avgL = (l1 + l2) / 2;
    const c1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
    const c2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
    const avgC = (c1 + c2) / 2;
    const g = (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7)))) / 2;

    const a1p = a1 * (1 + g);
    const a2p = a2 * (1 + g);

    const c1p = Math.sqrt(Math.pow(a1p, 2) + Math.pow(b1, 2));
    const c2p = Math.sqrt(Math.pow(a2p, 2) + Math.pow(b2, 2));

    const avgCp = (c1p + c2p) / 2;

    let h1p = rad2deg(Math.atan2(b1, a1p));
    if (h1p < 0) {
      h1p = h1p + 360;
    }

    let h2p = rad2deg(Math.atan2(b2, a2p));
    if (h2p < 0) {
      h2p = h2p + 360;
    }

    const avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;

    const t =
      1 -
      0.17 * Math.cos(deg2rad(avghp - 30)) +
      0.24 * Math.cos(deg2rad(2 * avghp)) +
      0.32 * Math.cos(deg2rad(3 * avghp + 6)) -
      0.2 * Math.cos(deg2rad(4 * avghp - 63));

    let deltahp = h2p - h1p;
    if (Math.abs(deltahp) > 180) {
      if (h2p <= h1p) {
        deltahp += 360;
      } else {
        deltahp -= 360;
      }
    }

    const deltalp = l2 - l1;
    const deltacp = c2p - c1p;

    const deltahpFinal = 2 * Math.sqrt(c1p * c2p) * Math.sin(deg2rad(deltahp) / 2);

    const sl = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
    const sc = 1 + 0.045 * avgCp;
    const sh = 1 + 0.015 * avgCp * t;

    const deltaro = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2));
    const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
    const rt = -rc * Math.sin(2 * deg2rad(deltaro));

    const kl = 1;
    const kc = 1;
    const kh = 1;

    const deltaE = Math.sqrt(
      Math.pow(deltalp / (kl * sl), 2) +
        Math.pow(deltacp / (kc * sc), 2) +
        Math.pow(deltahpFinal / (kh * sh), 2) +
        rt * (deltacp / (kc * sc)) * (deltahpFinal / (kh * sh))
    );

    return deltaE;
  }
}
