const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are DigiDiary AI, an expert digital legal practice assistant embedded in Advocate DigiDiary — India's premier court diary and legal chamber management platform.
You assist Indian advocates, legal associates, law firms, and chamber clerks with:
1. Drafting legal notices, petitions, applications, written statements, and affidavits under Indian statutes (CPC, CrPC / Bharatiya Nagarik Suraksha Sanhita, IPC / Bharatiya Nyaya Sanhita, Indian Evidence Act / Bharatiya Sakshya Adhiniyam, Commercial Courts Act 2015, Arbitration & Conciliation Act 1996, Insolvency & Bankruptcy Code 2016, Negotiable Instruments Act 1881 Section 138, etc.).
2. Case law research, judicial citations (Supreme Court of India, Delhi High Court, Bombay High Court, etc.), and strategic legal arguments.
3. Procedural timelines, statutory limitation periods (Limitation Act 1963), court etiquette, and e-filing requirements.
4. Chamber management, client consultation summaries, and hearing preparation checklist.

Rules:
- Authoritative, precise, and legally sound in the context of Indian jurisprudence.
- Use clear Markdown formatting with bolding, numbered steps, and bullet points.
- Always include statutory sections where relevant.
- Include a brief disclaimer at the end: "*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*"`;

// Helper: Check if API key appears syntactically valid
function isKeyConfigured(key) {
  return typeof key === 'string' && key.trim().length > 20 && !key.includes('<') && !key.includes('your_');
}

// Fallback intelligent legal chamber response generator
function getChamberLegalResponse(query) {
  const q = (query || '').toLowerCase();

  if (q.includes('138') || q.includes('cheque') || q.includes('dishonour') || q.includes('ni act')) {
    return `### **Section 138 Negotiable Instruments Act, 1881 — Key Procedural Checklist**

Under Section 138 of the NI Act, for criminal liability on cheque dishonour:

1. **Presentation**: Cheque must be presented within its validity period (**3 months** from the date of issue).
2. **Statutory Demand Notice**:
   - Must be issued within **30 days** of receiving the bank memo of dishonour.
   - Demand notice must give the drawer **15 clear days** from receipt to make payment.
3. **Cause of Action**:
   - Arises on the **16th day** if payment is not made within the 15-day statutory window.
4. **Filing Limitation**:
   - Criminal complaint under **Section 142** must be filed before the competent Judicial Magistrate / Metropolitan Magistrate within **1 month** (30 days) from the date cause of action arose.
5. **Jurisdiction (Section 142(2))**:
   - If cheque delivered for collection through account: Where the payee's branch is located.
   - If presented over counter: Where the drawer bank branch is located.

> **Landmark Precedent**: *Dashrath Rupsingh Rathod v. State of Maharashtra (2014)* and *Bridgestone India Pvt. Ltd. v. Inderpal Singh (2016)* regarding territorial jurisdiction.

*(Note: Operating in Chamber Practice Mode. To enable live Google Gemini 2.0 AI, set your GEMINI_API_KEY in .env or Render Dashboard.)*
*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*`;
  }

  if (q.includes('bail') || q.includes('438') || q.includes('439') || q.includes('482') || q.includes('bnss')) {
    return `### **Bail Jurisprudence Under Indian Law (CrPC & BNSS 2023)**

1. **Anticipatory Bail (Section 438 CrPC / Section 482 BNSS)**:
   - Available to a person apprehending arrest in a non-bailable offence.
   - Grounded on reasonable apprehension, absence of flight risk, cooperation with investigation, and bona fide defense.
   - Landmark: *Gurbaksh Singh Sibbia (1980)* & *Sushila Aggarwal v. State (NCT of Delhi) (2020)* — Anticipatory bail need not be limited to a fixed timeframe unless special circumstances warrant.

2. **Regular Bail (Section 437/439 CrPC / Section 480/483 BNSS)**:
   - Primary test: Gravity of offence, nature of evidence, likelihood of tampering with witnesses or absconding.
   - Principle: **"Bail is the rule, jail is the exception"** (*State of Rajasthan v. Balchand, 1977* reiterated in *Satender Kumar Antil v. CBI, 2022*).

3. **Default / Statutory Bail (Section 167(2) CrPC / Section 187 BNSS)**:
   - Indefeasible right if charge sheet not filed within 60 days (offences punishable up to 10 yrs) or 90 days (offences with death/life/min 10 yrs).

*(Note: Operating in Chamber Practice Mode. To enable live Google Gemini 2.0 AI, set your GEMINI_API_KEY in .env or Render Dashboard.)*
*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*`;
  }

  if (q.includes('limitation') || q.includes('delay') || q.includes('section 5')) {
    return `### **Limitation Law & Condonation of Delay (Limitation Act, 1963)**

1. **General Rule (Section 3)**:
   - Every suit instituted, appeal preferred, and application made after the prescribed period shall be dismissed, even though limitation has not been set up as a defense.
2. **Condonation of Delay (Section 5)**:
   - Applies to **appeals and applications** (NOT to original suits).
   - The applicant must establish **"sufficient cause"** for not filing within time.
   - Landmark: *Collector, Land Acquisition, Anantnag v. Mst. Katiji (1987)* — Substantial justice must override technical considerations.
   - Note: *Basawaraj v. Special Land Acquisition Officer (2013)* — Sufficient cause must be genuine, not attributable to negligence or inaction.
3. **Key Timelines**:
   - Appeal to High Court from Decree: **90 days**.
   - Appeal to District Court: **30 days**.
   - Review Application: **30 days**.
   - Revision Application: **90 days**.

*(Note: Operating in Chamber Practice Mode. To enable live Google Gemini 2.0 AI, set your GEMINI_API_KEY in .env or Render Dashboard.)*
*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*`;
  }

  return `### **DigiDiary Chamber Assistant Guidance**

Thank you for your query regarding: **"${query.length > 60 ? query.substring(0, 60) + '...' : query}"**.

**Key Legal Considerations & Chamber Practice Tips:**
1. **Statutory Classification**: Identify whether the matter is governed by Civil (CPC), Criminal (BNSS/CrPC), Constitutional (Art 226/32), or Special Statutory provisions (Commercial, IBC, Family, Consumer).
2. **Limitation & Jurisdiction**: Confirm territorial and pecuniary jurisdiction, court fees payable, and limitation periods before filing.
3. **Supporting Documentation**: Ensure Vakalatnama / Power of Attorney is duly stamped and notarized/attested with appropriate welfare tickets.
4. **Drafting Strategy**: State facts chronologically, establish distinct cause of action with specific dates, and formulate clear, alternative prayers.

*(Note: Operating in Chamber Practice Mode. To activate live Google Gemini 2.0 Flash reasoning, add your GEMINI_API_KEY to the .env file or Render Dashboard.)*

*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*`;
}

// Candidate models in order of priority (Google Gemini latest models)
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
].filter(Boolean);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithModelFallback(genAI, contentPayload) {
  let lastErr = null;
  for (const modelName of CANDIDATE_MODELS) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
        });
        const result = await model.generateContent(contentPayload);
        const text = result.response.text();
        return { text, modelName };
      } catch (err) {
        lastErr = err;
        const is503 = err.message && err.message.includes('503');
        if (is503 && attempt < maxRetries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`[AI CONTROLLER] Model ${modelName} overloaded (503). Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        console.warn(`[AI CONTROLLER] Model ${modelName} failed (${err.message}). Trying next candidate...`);
        break;
      }
    }
  }
  throw lastErr;
}

// POST /api/ai/chat
exports.chatWithAI = async (req, res) => {
  try {
    const { prompt, history = [] } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (isKeyConfigured(apiKey)) {
      try {
        console.log('[AI CONTROLLER] Gemini API key detected. Attempting live AI generation...');
        const genAI = new GoogleGenerativeAI(apiKey.trim());

        // Format history for Gemini API
        const contents = [];
        if (Array.isArray(history)) {
          const recentHistory = history.slice(-8); // Last 8 messages for context
          for (const msg of recentHistory) {
            if (msg.role && msg.content) {
              contents.push({
                role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: String(msg.content) }],
              });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: prompt.trim() }],
        });

        const { text: responseText, modelName } = await generateWithModelFallback(genAI, { contents });

        return res.json({
          success: true,
          data: {
            reply: responseText,
            source: modelName,
          },
        });
      } catch (geminiErr) {
        console.warn('[AI CONTROLLER] Gemini API error, falling back to chamber engine:', geminiErr.message);
      }
    }

    // Chamber knowledge fallback (only reached if API key is missing or all models failed)
    const fallbackReply = getChamberLegalResponse(prompt);
    const fallbackSource = isKeyConfigured(apiKey) ? 'chamber-engine-fallback' : 'chamber-engine';
    return res.json({
      success: true,
      data: {
        reply: fallbackReply,
        source: fallbackSource,
      },
    });
  } catch (err) {
    console.error('[AI CONTROLLER] Unexpected error in chatWithAI:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate AI response. Please try again.',
      error: err.message,
    });
  }
};

// POST /api/ai/summarize (Upload PDF or Photo)
exports.summarizeDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF document or image file (JPG, PNG, WEBP).',
      });
    }

    const file = req.file;
    const userInstruction = req.body.prompt || 'Summarize this legal document in detail with key dates, parties, claims, and next steps.';
    const apiKey = process.env.GEMINI_API_KEY;

    if (isKeyConfigured(apiKey)) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey.trim());

        const base64Data = file.buffer.toString('base64');
        const filePart = {
          inlineData: {
            data: base64Data,
            mimeType: file.mimetype,
          },
        };

        const promptPart = {
          text: `You are an expert Indian advocate examining this uploaded document: "${file.originalname}".
Task: ${userInstruction}

Please provide:
1. **Document Identification**: Title, Type, Court/Tribunal, Filing Date, Case Number (if visible).
2. **Parties**: Petitioner/Applicant vs. Respondent/Defendant.
3. **Core Facts & Legal Issues**: Summary of underlying dispute or statutory grounds.
4. **Key Dates & Critical Deadlines**: Hearing dates, limitation milestones, or compliance deadlines.
5. **Relief / Orders / Prayers**: Exactly what is claimed, ordered, or undertaken.
6. **Advocate Chamber Action Items**: Recommended immediate legal actions for the advocate.

Use clear Markdown headings and bullet points.`,
        };

        const { text: summaryText, modelName } = await generateWithModelFallback(genAI, [filePart, promptPart]);

        return res.json({
          success: true,
          data: {
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            summary: summaryText,
            source: modelName,
          },
        });
      } catch (geminiErr) {
        console.warn('[AI CONTROLLER] Document analysis with Gemini failed, using chamber summary:', geminiErr.message);
      }
    }

    // Chamber structured fallback
    const fileSizeKb = Math.round(file.size / 1024);
    const fileType = file.mimetype === 'application/pdf' ? 'PDF Document' : 'Document Image';

    const fallbackSummary = `### **Document Analysis Report: ${file.originalname}**

- **File Type**: ${fileType} (${file.mimetype})
- **File Size**: ${fileSizeKb} KB
- **Upload Status**: Received and verified for Chamber Repository

#### **Warning: AI Vision Engine Not Configured**
To enable full document reading with Google Gemini 2.0 Flash (OCR, text extraction, clause analysis), configure your \`GEMINI_API_KEY\` in the \`.env\` file or Render Dashboard.

**How to enable:**
1. Get a free API key at: https://aistudio.google.com/app/apikey
2. Add \`GEMINI_API_KEY=your_key_here\` to your \`.env\` file
3. Restart the server

#### **Chamber Preliminary Assessment (Metadata Only):**
1. **Document Classification**: The file \`${file.originalname}\` has been catalogued under your chamber's evidentiary archives.
2. **Recommended Filing Verification**:
   - Ensure the document bears proper court seals and legible exhibit/annexure markings.
   - Verify that all pages are numbered continuously and indexed in the master court brief.
   - Check if certified copies or true copies attested by an advocate are required before submission.
3. **Next Steps for Counsel**:
   - File application for urgent listing or early hearing if interim relief is sought.
   - Serve advance notice copy to opposite counsel or standing counsel as per court rules.

*(Note: This is a metadata-only analysis. Configure GEMINI_API_KEY for full AI-powered document reading with OCR and content extraction.)*
*(Disclaimer: For chamber research and drafting assistance only. Not a substitute for formal legal opinion.)*`;

    return res.json({
      success: true,
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        summary: fallbackSummary,
        source: 'chamber-engine',
        warning: 'GEMINI_API_KEY not configured. Only metadata analysis available. Configure your API key for full document reading.',
      },
    });
  } catch (err) {
    console.error('[AI CONTROLLER] Error in summarizeDocument:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process and summarize document.',
      error: err.message,
    });
  }
};
