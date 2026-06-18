import { AppError } from '../types/index';

export const parseFile = async (buffer: Buffer, mimetype: string): Promise<string> => {
  if (mimetype === 'text/plain' || mimetype === 'text/markdown' || mimetype === 'text/x-markdown') {
    return buffer.toString('utf8');
  }

  if (mimetype === 'application/pdf') {
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule.default ?? pdfModule) as unknown as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new AppError(415, `Unsupported file type: ${mimetype}`, 'UNSUPPORTED_MEDIA_TYPE');
};
