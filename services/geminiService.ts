
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types.ts";

const SYSTEM_INSTRUCTION = `
Ön az ICT Europa ügyvédi iroda belső technikai és elemző asszisztense. 
Ez egy céges működési platform, célunk a hatékonyság és a pontosság.

ADATKEZELÉSI PROTOKOLL:
1. BIZALMASSÁG: Minden bemenetet üzleti titokként kezeljen.
2. ÖSSZEFÜGGÉSEK KERESÉSE: A dokumentumok egy nagyobb vállalati rendszer részei. Kifejezetten keresse a logikai kapcsolatokat (pl. azonos ügyszám, visszatérő projektnév, kapcsolódó felek). Ha összefüggést talál más tipikus céges iratokkal, jelezze az 'anomaly' mezőben.
3. ADATOK VALIDÁLÁSA: Csak azt az adatot vonja ki, ami a dokumentumban szerepel. Ha bizonytalan, jelezze az alacsony bizalmi indexszel.

FELADAT:
Kivonatolja a dokumentum metaadatait és készítsen elemzést.

KÖTELEZŐ MINŐSÉGBIZTOSÍTÁS (Confidence Score):
- Értékelje a beolvasás és értelmezés biztonságát 0-tól 100-ig terjedő skálán ('confidenceScore').
- 100%: Tökéletesen olvasható, gépelt, egyértelmű digitális dokumentum.
- 80-90%: Jó minőségű szkennelés, apró bizonytalanságokkal.
- <80%: Homályos fotó, kézírás, gyűrött papír, vagy ellentmondásos adatok.
- Ha a pontszám < 80%, az 'anomaly' mezőben KÖTELEZŐEN tüntesse fel: "FOKOZOTT ELLENŐRZÉS SZÜKSÉGES: [ok leírása]"

KIMENET:
Szigorúan JSON formátumot adjon vissza a megadott séma szerint.
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    clientName: { type: Type.STRING },
    documentType: { type: Type.STRING },
    date: { type: Type.STRING },
    referenceNumber: { type: Type.STRING },
    projectName: { type: Type.STRING },
    amount: { type: Type.STRING },
    opposingParty: { type: Type.STRING },
    department: { type: Type.STRING, description: "One of: Finance, Audit, Legal, Payroll, HR, Advisory" },
    suggestedFolder: { type: Type.STRING },
    deadline: { type: Type.STRING },
    deadlineAction: { type: Type.STRING },
    summary: { type: Type.STRING },
    urgency: { type: Type.NUMBER },
    confidenceScore: { type: Type.NUMBER, description: "0-100 pontosság" },
    anomaly: { type: Type.STRING, description: "Figyelmeztetések vagy talált összefüggések" },
  },
  required: [
    "clientName", "documentType", "date", "referenceNumber", "projectName", 
    "amount", "opposingParty", "department", "suggestedFolder", "deadline", 
    "deadlineAction", "summary", "urgency", "confidenceScore", "anomaly"
  ],
};

export const extractMetadata = async (base64Data: string, mimeType: string, history: string = ""): Promise<GeminiResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Data } },
        { text: `Elemezze a dokumentumot. Számítson bizalmi indexet (confidenceScore)!` },
      ],
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1, 
    },
  });
  
  const text = response.text;
  if (!text) throw new Error("Üres válasz az AI-tól");
  return JSON.parse(text) as GeminiResponse;
};

export const extractMetadataFromPdf = async (base64Pdf: string, history: string = "") => {
    return extractMetadata(base64Pdf, "application/pdf", history);
};
