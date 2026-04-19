/**
 * Renders a DOM element to a PDF file and triggers download.
 * Uses html2canvas (screenshot) + jsPDF (embed as image in PDF).
 */
export async function downloadPdf(elementId: string, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF }       = await import('jspdf');

  const el = document.getElementById(elementId);
  if (!el) return;

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData  = canvas.toDataURL('image/jpeg', 0.95);
  const imgW     = 210; // A4 width in mm
  const imgH     = (canvas.height * imgW) / canvas.width;

  const pdf = new jsPDF({
    orientation: imgH > imgW ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageH   = pdf.internal.pageSize.getHeight();
  let position  = 0;
  let remaining = imgH;

  // Add pages if content is taller than one A4 page
  while (remaining > 0) {
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    remaining -= pageH;
    position  -= pageH;
    if (remaining > 0) pdf.addPage();
  }

  pdf.save(filename);
}
