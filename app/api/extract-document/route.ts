import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      return Response.json({ text: result.value.trim() });
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const text = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        return `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(ws)}`;
      }).join('\n\n');
      return Response.json({ text: text.trim() });
    }

    if (ext === 'pptx' || ext === 'ppt') {
      return Response.json({ text: `[PowerPoint presentation: ${file.name}]\n\nNote: slide text could not be extracted automatically. Please paste the relevant content as text if needed.` });
    }

    return Response.json({ error: 'Unsupported file format' }, { status: 400 });
  } catch (err) {
    console.error('[extract-document]', err);
    return Response.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
