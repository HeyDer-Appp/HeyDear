import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * CODE128 barcode (SVG), readable by any USB/Bluetooth laser barcode scanner -
 * unlike the QR codes elsewhere, which need a 2D imager or a phone camera.
 */
export default function Barcode({ value, height = 40, width = 1.4, fontSize = 11, displayValue = true, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), { format: 'CODE128', height, width, fontSize, margin: 0, displayValue });
    } catch {
      // Value has characters CODE128 can't encode - leave the svg empty rather than crash.
    }
  }, [value, height, width, fontSize, displayValue]);

  return <svg ref={ref} className={className} />;
}
