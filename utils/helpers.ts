
import { ExtractedMetadata, PdfExportSettings, ScannedFile, ProcessingStatus, ReviewStatus, AuditLogEntry, ComplianceData, ComplianceLevel } from "../types.ts";
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

declare var html2pdf: any;
let pdfjs: any = (pdfjsLib as any).default || pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// --- New Helper Functions for Enterprise Features ---

export const createAuditLog = (action: string, details?: string, user: string = "Rendszer"): AuditLogEntry => {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    user,
    details
  };
};

export const evaluateCompliance = (metadata: ExtractedMetadata): ComplianceData => {
  const issues: string[] = [];
  let gdprFlag = false;

  // 1. Critical Data Check
  if (!metadata.date || metadata.date === 'null') issues.push("Hiányzó dátum");
  if (!metadata.amount || metadata.amount === 'null') issues.push("Hiányzó összeg");
  
  // 2. Confidence Check
  if ((metadata.confidenceScore || 0) < 80) issues.push("Alacsony AI megbízhatóság (<80%)");

  // 3. GDPR Keyword Check (Simulation)
  const gdprKeywords = ["személyi igazolvány", "lakcím", "útlevél", "taj", "adóazonosító", "születési"];
  if (metadata.summary && gdprKeywords.some(k => metadata.summary?.toLowerCase().includes(k))) {
    gdprFlag = true;
  }

  // Determine Level
  let level = ComplianceLevel.COMPLIANT;
  if (issues.length > 0) level = ComplianceLevel.WARNING;
  if (issues.length > 2 || (metadata.confidenceScore || 0) < 50) level = ComplianceLevel.NON_COMPLIANT;

  return { level, issues, gdprFlag };
};

// --- Existing Helpers ---

const shortenLegalSuffixes = (text: string): string => {
  if (!text) return text;
  
  let clean = text
    .replace(/\s+(Kereskedelmi|Gyártó|Szolgáltató|Külkereskedelmi|Nagykereskedelmi|Kiskereskedelmi|Ipari|Tanácsadó|Pénzügyi|Lízing|Informatikai|és|és\s+társa|vagy)\s+/gi, ' ')
    .replace(/\s+(Kereskedelmi|Gyártó|Szolgáltató|Ipari|Tanácsadó|Pénzügyi)$/gi, '')
    .trim();

  clean = clean
    .replace(/Korlátolt Felelősségű Társaság/gi, 'Kft.')
    .replace(/Részvénytársaság/gi, 'Zrt.')
    .replace(/Betéti Társaság/gi, 'Bt.')
    .replace(/Egyéni Vállalkozó/gi, 'e.v.')
    .replace(/Egyéni Cég/gi, 'e.c.')
    .replace(/K\.f\.t\./gi, 'Kft.')
    .replace(/K\.f\.t/gi, 'Kft.')
    .replace(/Z\.r\.t\./gi, 'Zrt.')
    .replace(/Z\.r\.t/gi, 'Zrt.')
    .replace(/\s+/g, ' ')
    .trim();

  clean = clean.replace(/,\s*Kft\./gi, ' Kft.').replace(/,\s*Zrt\./gi, ' Zrt.');
  
  return clean;
};

export const isSupportedFile = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.es3')
  );
};

export const getGeminiMimeType = (file: File): string => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/pdf'; 
};

export const getFileExtension = (file: File): string => {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || 'dat' : 'dat';
};

export const rotateImage = async (file: File, rotation: number): Promise<File> => {
  if (rotation === 0) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error("Canvas context error")); return; }
      
      if (Math.abs(rotation) % 180 !== 0) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type }));
        } else {
          reject(new Error("Blob creation failed"));
        }
      }, file.type);
    };
    img.src = url;
  });
};

export const renderPdfFirstPage = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context hiba");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error("PDF render hiba:", err);
    throw err;
  }
};

export const extractFilesFromZip = async (zipFile: File): Promise<{ extracted: { file: File, name: string }[], skipped: string[] }> => {
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(zipFile);
  const extracted: { file: File, name: string }[] = [];
  const skipped: string[] = [];
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      if (isSupportedFile(zipEntry.name)) {
        const p = zipEntry.async('blob').then(blob => {
          const fileName = zipEntry.name.split('/').pop() || zipEntry.name;
          const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
          extracted.push({ file, name: fileName });
        });
        promises.push(p);
      } else {
        skipped.push(zipEntry.name);
      }
    }
  });

  await Promise.all(promises);
  return { extracted, skipped };
};

export const extractFilesFromEs3 = async (es3File: File): Promise<{ extracted: { file: File, name: string }[], skipped: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const extracted: { file: File, name: string }[] = [];
        const skipped: string[] = [];
        const findElements = (doc: Document | Element, tagName: string) => {
            let els = doc.getElementsByTagName(tagName);
            if(els.length === 0) els = doc.getElementsByTagName("ns:" + tagName);
            if(els.length === 0) els = doc.getElementsByTagName("ds:" + tagName);
            return Array.from(els);
        };
        const dataElements = findElements(xmlDoc, "Data");
        dataElements.forEach((el, index) => {
            const base64 = el.textContent?.trim();
            if (base64 && base64.length > 50) {
                 let fileName = el.getAttribute("FileName");
                 if(!fileName && el.parentElement) {
                     const nameEl = findElements(el.parentElement, "FileName")[0];
                     if(nameEl) fileName = nameEl.textContent;
                 }
                 if(!fileName) fileName = `csatolmany_${index+1}.pdf`;
                 const mimeType = el.getAttribute("MimeType") || "application/pdf";
                 if (isSupportedFile(fileName)) {
                   try {
                       const blob = base64ToBlob(base64, mimeType);
                       extracted.push({ file: new File([blob], fileName, { type: mimeType }), name: fileName });
                   } catch(err) { skipped.push(fileName); }
                 } else { skipped.push(fileName); }
            }
        });
        resolve({ extracted, skipped });
      } catch (err) { reject(err); }
    };
    reader.readAsText(es3File);
  });
};

export const generateEmlFile = async (recipient: string, subject: string, body: string, attachments: { file: Blob | File, name: string }[]) => {
  const boundary = "----next-boundary-" + Math.random().toString(36).slice(2);
  const encodeHeader = (str: string) => `=?utf-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`;
  
  // RFC 2045: Base64 sorokat 76 karakterenként tördelni kell
  const chunkBase64 = (str: string) => {
    return str.match(/.{1,76}/g)?.join("\r\n") || str;
  };

  let emlContent = [
    `To: ${recipient}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(btoa(unescape(encodeURIComponent(body)))),
    ""
  ].join("\r\n");

  for (const att of attachments) {
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(att.file);
    });

    const contentType = att.name.endsWith('.ics') 
        ? "text/calendar; charset=utf-8; method=PUBLISH" 
        : (att.file.type || "application/octet-stream");

    emlContent += [
      `--${boundary}`,
      `Content-Type: ${contentType}; name="${encodeHeader(att.name)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${encodeHeader(att.name)}"`,
      "",
      chunkBase64(base64Data),
      ""
    ].join("\r\n");
  }
  emlContent += `--${boundary}--`;
  downloadBlob(new Blob([emlContent], { type: "message/rfc822" }), `email_${new Date().getTime()}.eml`);
};

export const exportMetadataToCsv = (files: ScannedFile[]) => {
  const dataToExport = files.filter(f => f.metadata);
  if (dataToExport.length === 0) {
    alert("Nincs exportálható adat!");
    return;
  }
  
  const headers = [
    "Ügyfél neve", 
    "Dokumentum típusa", 
    "Dátum", 
    "Projekt neve", 
    "Összeg", 
    "Ellenérdekű fél", 
    "Határidő", 
    "Teendő", 
    "Sürgősség", 
    "Eredeti fájlnév", 
    "Új fájlnév",
    "Összefoglaló",
    "Bizalmi Index (%)",
    "Compliance Státusz"
  ];

  const rows = dataToExport.map(f => [
    f.metadata?.clientName || "", 
    f.metadata?.documentType || "", 
    f.metadata?.date || "", 
    f.metadata?.projectName || "", 
    f.metadata?.amount || "", 
    f.metadata?.opposingParty || "",
    f.metadata?.deadline || "",
    f.metadata?.deadlineAction || "",
    f.metadata?.urgency || "0",
    f.originalName, 
    f.suggestedName,
    f.metadata?.summary || "",
    f.metadata?.confidenceScore || "0",
    f.compliance.level
  ].map(v => {
      const clean = (v || '').toString().replace(/"/g, '""');
      return `"${clean}"`;
  }).join(";"));
  
  const csvContent = headers.join(";") + "\r\n" + rows.join("\r\n");
  
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); 
  const encoder = new TextEncoder();
  const encodedContent = encoder.encode(csvContent);
  const blob = new Blob([bom, encodedContent], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `ICT_Europa_Export_${new Date().toISOString().split('T')[0]}.csv`);
};

export const generateIcsBlob = (title: string, description: string, date: Date, reminderMinutes: number = 0, withBom: boolean = true) => {
  const pad = (n: number) => n < 10 ? '0' + n : '' + n;
  
  const formatFloating = (d: Date) => {
      return d.getFullYear() +
             pad(d.getMonth() + 1) +
             pad(d.getDate()) + 'T' +
             pad(d.getHours()) +
             pad(d.getMinutes()) +
             pad(d.getSeconds());
  };

  const formatUtc = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const now = new Date();
  const dtStamp = formatUtc(now);
  const start = formatFloating(date);
  const end = formatFloating(new Date(date.getTime() + 30 * 60 * 1000));
  const uid = Math.random().toString(36).substring(2) + Date.now().toString(36) + "@icteuropa.autodoc";
  
  const escapedDescription = (description || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
    
  const escapedTitle = (title || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR", 
    "VERSION:2.0", 
    "PRODID:-//ICT Europa//Smart Autodoc//HU", 
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT", 
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${start}`, 
    `DTEND:${end}`, 
    `SUMMARY:${escapedTitle}`, 
    `DESCRIPTION:${escapedDescription}`, 
    "STATUS:CONFIRMED"
  ];
  
  if (reminderMinutes > 0) {
      lines.push("BEGIN:VALARM");
      lines.push(`TRIGGER:-PT${reminderMinutes}M`);
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:Reminder");
      lines.push("END:VALARM");
  }
  
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  const foldLine = (line: string): string => {
      const MAX_LENGTH = 60;
      if (line.length <= MAX_LENGTH) return line;
      
      let result = '';
      let index = 0;
      while (index < line.length) {
          if (index > 0) {
              result += '\r\n ';
          }
          result += line.substr(index, MAX_LENGTH);
          index += MAX_LENGTH;
      }
      return result;
  };

  const icsContent = lines.map(foldLine).join("\r\n");
  const blobContent = withBom ? "\uFEFF" + icsContent : icsContent;
  return new Blob([blobContent], { type: "text/calendar;charset=utf-8" });
};

export const generateIcsFile = (title: string, description: string, date: Date, fileName: string, reminderMinutes: number = 0) => {
  const blob = generateIcsBlob(title, description, date, reminderMinutes, true);
  downloadBlob(blob, `hatarido_${date.toISOString().slice(0, 10)}.ics`);
  return blob;
};

export const calculateDeadlineDate = (startDate: string, deadlineStr: string): Date => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let result: Date | null = null;

  if (deadlineStr) {
    const isoDateMatch = deadlineStr.match(/(\d{4})[-. ](\d{1,2})[-. ](\d{1,2})/);
    if (isoDateMatch) {
      const year = parseInt(isoDateMatch[1]);
      const month = parseInt(isoDateMatch[2]) - 1;
      const day = parseInt(isoDateMatch[3]);
      
      if (year > now.getFullYear() + 2 || year < 2000) {
        result = null;
      } else {
        result = new Date(year, month, day);
      }
    }

    if (!result) {
      const daysMatch = deadlineStr.match(/(\d+)/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        if (days < 366) {
          result = new Date(startDate);
          result.setDate(result.getDate() + days);
        }
      }
    }
  }

  if (!result || isNaN(result.getTime()) || result <= todayStart) {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow;
  }

  return result;
};

export const downloadBlob = (blob: Blob, newName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = newName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
};

export const validateMetadata = (metadata: ExtractedMetadata): string[] => {
  const warnings: string[] = [];
  const invalid = ["null", "none", "ismeretlen", "n/a", "undefined", "nincs", "unknown"];
  if (!metadata.clientName || invalid.includes(metadata.clientName.toLowerCase())) warnings.push("Ügyfél hiba");
  
  if (metadata.confidenceScore !== undefined && metadata.confidenceScore < 80) {
    warnings.push("ALACSONY BIZALMI INDEX! Fokozott ellenőrzés szükséges.");
  }

  return warnings;
};

export const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve((reader.result as string).split(',')[1]);
  reader.onerror = reject;
});

export const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64.replace(/[\r\n\s]/g, ''));
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([byteNumbers], { type: mimeType });
};

export const convertImageToPdf = async (imageFile: File): Promise<{file: File, url: string}> => {
  const arrayBuffer = await imageFile.arrayBuffer();
  const pdfDoc = await PDFDocument.create();
  let image = imageFile.type.includes('png') ? await pdfDoc.embedPng(arrayBuffer) : await pdfDoc.embedJpg(arrayBuffer);
  const { width, height } = image.scale(1);
  pdfDoc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  return { file: new File([await pdfDoc.save()], imageFile.name.replace(/\.[^/.]+$/, "") + ".pdf", { type: 'application/pdf' }), url: URL.createObjectURL(imageFile) };
};

export const convertWordToPdf = async (wordFile: File): Promise<{file: File, html: string}> => {
  const result = await mammoth.convertToHtml({ arrayBuffer: await wordFile.arrayBuffer() });
  const container = document.createElement('div');
  container.innerHTML = result.value;
  document.body.appendChild(container);
  const pdfBlob = await html2pdf().from(container).output('blob');
  document.body.removeChild(container);
  return { file: new File([pdfBlob], wordFile.name.replace(/\.[^/.]+$/, "") + ".pdf", { type: 'application/pdf' }), html: result.value };
};

export const processAndDownloadPdf = async (file: File, newName: string, settings: PdfExportSettings) => downloadBlob(file, newName);

export const formatSuggestedName = (metadata: ExtractedMetadata, format: string, defaultDept: string = "AUTO"): string => {
  let name = format;
  const finalDept = (defaultDept === "AUTO" || !defaultDept) ? (metadata.department || "Finance") : defaultDept;
  
  const client = shortenLegalSuffixes(metadata.clientName || 'Ismeretlen');
  const opposing = shortenLegalSuffixes(metadata.opposingParty || '');

  const replacements: Record<string, string> = { 
    '{Department}': finalDept, 
    '{Client}': client, 
    '{OpposingParty}': opposing,
    '{Type}': metadata.documentType || 'Dokumentum', 
    '{DateHU}': (metadata.date || '').replace(/\s/g, '.'), 
    '{Project}': metadata.projectName || '', 
    '{Amount}': metadata.amount || '' 
  };
  Object.entries(replacements).forEach(([token, value]) => { name = name.replace(new RegExp(token, 'g'), value); });
  return name.trim().replace(/[\/\\:*?"<>|]/g, '');
};

export const getDocumentStats = (files: ScannedFile[]) => {
  return { total: files.length, new: files.filter(f => f.reviewStatus === ReviewStatus.NEW).length };
};
