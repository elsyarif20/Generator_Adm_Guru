
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { FormData, GeneratedSection, GroundingSource } from "../types";

// Helper function to safely get the AI client
const getAiClient = (): GoogleGenAI => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const sectionsSchema = {
    type: Type.OBJECT,
    properties: {
        sections: {
            type: Type.ARRAY,
            description: "An array of generated document sections.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Unique identifier for the section." },
                    title: { type: Type.STRING, description: "The title of the generated section." },
                    content: { type: Type.STRING, description: "The full HTML content of the section." },
                },
                required: ['id', 'title', 'content'],
            },
        },
    },
    required: ['sections'],
};

const cleanAndParseJson = (text: string): any => {
    if (!text) throw new Error("Respon AI kosong.");
    let cleanText = text.trim();
    cleanText = cleanText.replace(/```json|```/g, '');
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error("Gagal memproses format data dari AI.");
    }
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error.toString().toLowerCase().includes('503') || error.toString().toLowerCase().includes('unavailable'))) {
            await new Promise(res => setTimeout(res, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

export const getCPSuggestions = async (formData: Partial<FormData>): Promise<string> => {
    const ai = getAiClient();
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buat daftar Elemen Capaian Pembelajaran (CP) untuk mata pelajaran ${formData.mata_pelajaran}, jenjang ${formData.jenjang}, kelas ${formData.kelas}, fase ${formData.fase}. Sajikan dalam format Markdown.`,
    }));
    return response.text;
};

export const getTopicSuggestions = async (formData: Partial<FormData>): Promise<string> => {
    const ai = getAiClient();
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Berikan daftar ide Topik/Materi Pembelajaran yang relevan untuk mata pelajaran ${formData.mata_pelajaran}, jenjang ${formData.jenjang}, kelas ${formData.kelas} untuk semester ${formData.semester}. Jika ini untuk Try Out, berikan materi kumulatif dari Kelas 10, 11, dan 12 yang sering keluar di ujian. Sajikan dalam format Markdown.`,
    }));
    return response.text;
};

export const generateAdminContent = async (formData: FormData): Promise<GeneratedSection[]> => {
    const ai = getAiClient();
    const harakatInstruction = formData.bahasa === 'Bahasa Arab' 
        ? "**INSTRUKSI KHUSUS BAHASA ARAB: Seluruh teks Arab WAJIB MENGGUNAKAN HARAKAT LENGKAP.**"
        : "";
    const mathInstruction = "**FORMAT MATEMATIKA PENTING:** Jika menuliskan rumus atau angka berpangkat, WAJIB menggunakan superscript Unicode (seperti x², m³, 10⁻⁴). JANGAN GUNAKAN simbol caret (^).";

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Anda adalah asisten ahli guru. Buat dokumen administrasi Kurikulum Merdeka.
        **Data:** ${formData.mata_pelajaran}, Kelas ${formData.kelas}, Fase ${formData.fase}, CP: ${formData.cp_elements}.
        Tugas: Generate ATP, Prota, Promes, Modul Ajar, KKTP, dan Jurnal Harian dalam format JSON.
        ${harakatInstruction}
        ${mathInstruction}
        Gunakan tag '<table>' untuk semua dokumen.`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: sectionsSchema,
            temperature: 0.7,
            ...(formData.use_thinking_mode && { thinkingConfig: { thinkingBudget: 32768 } })
        }
    }));

    const result = cleanAndParseJson(response.text);
    return result.sections;
};

export const generateSoalContentSections = async (formData: FormData): Promise<GeneratedSection[]> => {
    const ai = getAiClient();
    const mathInstruction = "**FORMAT MATEMATIKA PENTING:** Gunakan superscript Unicode (x², m³, 10⁻⁴) untuk pangkat. JANGAN GUNAKAN simbol caret (^).";

    let tkaInstruction = "";
    if (formData.sertakan_soal_tka || formData.sertakan_soal_tka_uraian) {
        tkaInstruction = `
    **SOAL TAMBAHAN TKA (Tes Kemampuan Akademik) - Kelompok ${formData.kelompok_tka}:**
    ${formData.sertakan_soal_tka ? `- Tambahkan TEPAT ${formData.jumlah_soal_tka} soal Pilihan Ganda TKA.` : ''}
    ${formData.sertakan_soal_tka_uraian ? `- Tambahkan TEPAT ${formData.jumlah_soal_tka_uraian} soal Uraian/Essay TKA.` : ''}`;
    }

    const prompt = `Buat paket asesmen lengkap: Naskah Soal, Kunci Jawaban & Pembahasan, Kisi-kisi, Rubrik, Analisis Kualitatif, dan Ringkasan Materi.
    Mapel: ${formData.mata_pelajaran}, Topik: ${formData.topik_materi}.
    Tingkat Kesulitan: ${formData.tingkat_kesulitan}.
    
    **ATURAN JUMLAH SOAL (WAJIB DIPATUHI):**
    - Hasilkan TEPAT ${formData.jumlah_pg || 0} soal Pilihan Ganda (Mapel Utama).
    - Hasilkan TEPAT ${formData.jumlah_uraian || 0} soal Uraian (Mapel Utama).
    - Hasilkan TEPAT ${formData.jumlah_isian_singkat || 0} soal Isian Singkat (jika ada).
    ${tkaInstruction}
    
    **PENTING:** Anda DILARANG KERAS meringkas, memotong, atau mempersingkat jumlah soal. Jika diminta 30 soal, Anda harus memberikan 30 soal lengkap satu per satu. Jangan berhenti di tengah jalan atau memberikan contoh saja.
    
    ${mathInstruction}
    JSON format dengan sections array.`;

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: sectionsSchema,
            temperature: 0.5,
            ...(formData.use_thinking_mode && { thinkingConfig: { thinkingBudget: 32768 } })
        }
    }));

    const result = cleanAndParseJson(response.text);
    return result.sections;
};

export const generateTryoutContent = async (formData: FormData): Promise<GeneratedSection[]> => {
    const ai = getAiClient();
    const mathInstruction = "**FORMAT MATEMATIKA PENTING:** Gunakan superscript Unicode (x², m³, 10⁻⁴). JANGAN GUNAKAN simbol caret (^).";
    
    const prompt = `Buat paket asesmen KOMPREHENSIF (TRY OUT / UAS) untuk jenjang SMA.
    Mata Pelajaran: ${formData.mata_pelajaran}
    Kelompok TKA: ${formData.kelompok_tka}
    Bahasa: ${formData.bahasa}
    Tingkat Kesulitan: ${formData.tingkat_kesulitan}
    
    **Materi Utama yang diujikan:** ${formData.topik_materi || "Materi kumulatif standar Kelas 10, 11, dan 12"}
    
    **ATURAN JUMLAH SOAL (WAJIB DIPATUHI - JANGAN DIPERSINGKAT):**
    1. Soal Pilihan Ganda Standar: TEPAT ${formData.jumlah_pg} soal.
    2. Soal Essay/Uraian Standar: TEPAT ${formData.jumlah_uraian} soal.
    3. Soal Pilihan Ganda TKA (Tes Kemampuan Akademik): TEPAT ${formData.jumlah_soal_tka} soal.
    4. Soal Essay/Uraian TKA: TEPAT ${formData.jumlah_soal_tka_uraian} soal.
    
    **INSTRUKSI KRITIKAL:** Anda HARUS menuliskan setiap butir soal secara lengkap. JANGAN memberikan ringkasan atau memotong output. Total soal harus sesuai akumulasi angka di atas. Kualitas dan kuantitas adalah prioritas utama.
    
    ${mathInstruction}
    
    Generate output dalam format JSON yang berisi array of 'sections'. Setiap section mencakup:
    - Naskah Soal (Gunakan tabel untuk soal PG).
    - Kunci Jawaban & Pembahasan Mendalam.
    - Kisi-kisi Soal (Tabel: No, Materi, Kelas, Level Kognitif, Indikator).
    - Rubrik Penilaian.
    
    Format output: JSON dengan properti 'sections' berisi objek {id, title, content}. Gunakan HTML dalam 'content'.`;

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: sectionsSchema,
            temperature: 0.6,
            ...(formData.use_thinking_mode && { thinkingConfig: { thinkingBudget: 32768 } })
        }
    }));

    const result = cleanAndParseJson(response.text);
    return result.sections;
};

export const groundedSearch = async (query: string, tool: 'web' | 'maps', location?: { latitude: number, longitude: number }): Promise<{ text: string, sources: GroundingSource[] }> => {
    const ai = getAiClient();
    const tools: any[] = tool === 'web' ? [{ googleSearch: {} }] : [{ googleMaps: {} }];
    const model = tool === 'maps' ? 'gemini-2.5-flash-lite-latest' : 'gemini-3-flash-preview';
    const config: any = { tools };
    if (tool === 'maps' && location) config.toolConfig = { retrievalConfig: { latLng: location } };
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model,
        contents: query,
        config,
    }));
    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks.map((chunk: any) => {
         if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title };
         if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title };
         return null;
    }).filter((s: any): s is GroundingSource => s !== null);
    return { text, sources };
};

// Text to Speech
export const textToSpeech = async (text: string): Promise<AudioBuffer> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Gagal generate audio.");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const bytes = decode(base64Audio);
    return await decodeAudioData(bytes, audioContext, 24000, 1);
};

// Image generation
export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: { aspectRatio: "1:1" }
        }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Gambar tidak ditemukan.");
};

// Image editing
export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt }
            ]
        }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Gagal mengedit gambar.");
};

// Image analysis
export const analyzeImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt }
            ]
        }
    });
    return response.text || "";
};

// Video generation
export const generateVideo = async (prompt: string, image: { imageBytes: string, mimeType: string } | null, aspectRatio: '16:9' | '9:16') => {
    const ai = getAiClient();
    return await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        ...(image && {
            image: {
                imageBytes: image.imageBytes,
                mimeType: image.mimeType,
            }
        }),
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio,
        }
    });
};

export const checkVideoOperation = async (operation: any) => {
    const ai = getAiClient();
    return await ai.operations.getVideosOperation({ operation: operation });
};

// Video analysis
export const analyzeVideoFrames = async (frames: { data: string, mimeType: string }[], prompt: string): Promise<string> => {
    const ai = getAiClient();
    const parts = frames.map(f => ({ inlineData: f }));
    parts.push({ text: prompt } as any);
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts }
    });
    return response.text || "";
};
